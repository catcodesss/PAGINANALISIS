import type {
  RegistroHistorial,
  Repositorio,
  ResumenHistorial,
} from "./repositorio";
import { migrarAV9 } from "./identidad";
import {
  comprobarCambioExpediente,
  resumirExpediente,
  type Expediente,
  type ResumenCaso,
} from "./casos";
import { fusionarExpedientes, type AvisoFusion } from "./nube/fusion";
import {
  abrirClaveCaso,
  cambiarFrase,
  crearBoveda,
  crearClaveCaso,
  desbloquearConFrase,
  regenerarRecuperacion,
  tieneRecuperacion,
  restablecerFraseConRecuperacion,
  type Boveda,
  type ClaveCasoEnvuelta,
} from "./boveda";
import { cifrarParte, descifrarParte, type ContextoParte } from "./cifradoV2";
import { borrarCmdLocal, guardarCmdLocal, leerCmdLocal } from "./sesionLocal";
import { partirExpediente, unirExpediente, type Parte } from "./nube/particion";
import {
  ConflictoDeRevision,
  type AlmacenRemoto,
  type CabeceraRemota,
  type ParteRemota,
  type ServicioRanuras,
} from "./nube/almacen";

/**
 * Repositorio sobre Firestore con cifrado de extremo a extremo (fase 13,
 * propuesta §3, §4 y §7). Sustituye al local cuando NEXT_PUBLIC_ACIA_NUBE=1.
 *
 * Reparto de claves: la frase abre la CMD (bóveda); la CMD abre la clave de
 * cada caso (CC); la CC cifra las partes del caso y su entrada del índice. Así
 * rotar la CMD no obliga a recifrar nada.
 *
 * Conflictos (etapa 4): si otro dispositivo cambió el caso, se descarga lo nuevo,
 * se fusiona con lo local (lib/nube/fusion.ts) y se reintenta. Nunca se pisa nada.
 * Sigue pendiente: caché sin conexión, cola de escritura persistente y escucha en
 * tiempo real.
 */

const INTENTOS_DE_FUSION = 3;

export const ID_INDICE = "indice";

export interface VersionAnterior {
  historial_id: string;
  rev: number;
  archivado_en: string | null;
  dispositivo_id: string;
}

/** Una sesión (o los datos del caso) con las versiones anteriores que se pueden recuperar. */
export interface GrupoVersiones {
  parte_id: string;
  etiqueta: string;
  /** Fecha de la sesión, si se conoce. */
  fecha: string | null;
  /** La versión actual no se puede leer: es el caso más urgente. */
  ilegible: boolean;
  versiones: VersionAnterior[];
}

type SobreConClave = { cc: CryptoKey; envuelta: ClaveCasoEnvuelta };

/** Lo último que este dispositivo vio de un caso: revisiones y contenido en claro. */
interface Vista {
  revCabecera: number;
  revIndice: number;
  /** Partes que no se pudieron leer en la última carga del caso. */
  ilegibles: string[];
  partes: Map<string, { rev: number; tipo: Parte["tipo"]; contenido: string }>;
}

async function sha256Hex(texto: string): Promise<string> {
  const h = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(texto));
  return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

const sinRanuras: ServicioRanuras = {
  reclamar: async () => {
    throw new Error("Las ranuras de casos no están disponibles.");
  },
  archivar: async () => {
    throw new Error("Las ranuras de casos no están disponibles.");
  },
  reactivar: async () => {
    throw new Error("Las ranuras de casos no están disponibles.");
  },
};

export class RepositorioNube implements Repositorio {
  private uid: string | null = null;
  private boveda: Boveda | null = null;
  private cmd: CryptoKey | null = null;
  private claves = new Map<string, SobreConClave>();
  private vistas = new Map<string, Vista>();
  private pendienteRecuperacion: string | null = null;
  private avisosFusion: AvisoFusion[] = [];
  private huboFusion = false;

  constructor(
    private readonly almacen: () => AlmacenRemoto,
    private readonly ranuras: ServicioRanuras = sinRanuras
  ) {}

  // --- cuenta y bóveda -------------------------------------------------

  disponible(): boolean {
    return typeof crypto !== "undefined" && Boolean(crypto.subtle);
  }

  async asociarCuenta(usuarioId: string | null): Promise<void> {
    this.bloquear();
    this.uid = usuarioId;
    this.boveda = null;
  }

  private exigirUid(): string {
    if (!this.uid) throw new Error("Inicia sesión para usar tus casos.");
    return this.uid;
  }

  private exigirCmd(): CryptoKey {
    if (!this.cmd) throw new Error("Tus casos están bloqueados. Introduce tu frase de paso.");
    return this.cmd;
  }

  async yaConfigurado(): Promise<boolean> {
    return (await this.cargarBoveda()) !== null;
  }

  private async cargarBoveda(): Promise<Boveda | null> {
    if (!this.boveda) this.boveda = await this.almacen().leerBoveda(this.exigirUid());
    return this.boveda;
  }

  /**
   * Crea la bóveda. Con `conRecuperacion` (por defecto), la clave de recuperación
   * se recoge una sola vez con `tomarClaveRecuperacion`; sin ella, se puede crear
   * más tarde con `crearRecuperacion`.
   */
  async configurar(frase: string, { conRecuperacion = true }: { conRecuperacion?: boolean } = {}): Promise<void> {
    const uid = this.exigirUid();
    if (await this.cargarBoveda()) throw new Error("Esta cuenta ya tiene una bóveda de claves.");
    const { boveda, cmd, claveRecuperacion } = await crearBoveda(frase, {}, { conRecuperacion });
    await this.almacen().guardarBoveda(uid, boveda);
    this.boveda = boveda;
    this.cmd = cmd;
    this.pendienteRecuperacion = claveRecuperacion;
    await this.recordarEnEsteDispositivo();
  }

  /** Guarda la CMD (no extraíble) para no pedir la contraseña al recargar. Un fallo solo quita la comodidad. */
  private async recordarEnEsteDispositivo(): Promise<void> {
    if (!this.cmd || !this.boveda || !this.uid) return;
    await guardarCmdLocal(this.uid, this.boveda.version_clave, this.cmd).catch(() => {});
  }

  /**
   * Tras recargar: reabre la bóveda con la CMD recordada, si es de esta cuenta y
   * la bóveda no cambió de versión (rotación). Devuelve si quedó abierta.
   */
  async restaurarSesion(): Promise<boolean> {
    if (this.cmd) return true;
    if (!this.uid) return false;
    const guardada = await leerCmdLocal(this.uid).catch(() => null);
    if (!guardada) return false;
    const b = await this.cargarBoveda();
    if (!b || b.version_clave !== guardada.version_clave) {
      await borrarCmdLocal().catch(() => {});
      return false;
    }
    this.cmd = guardada.cmd;
    return true;
  }

  /** Cerrar sesión: este dispositivo deja de recordar la clave. */
  async olvidarEnEsteDispositivo(): Promise<void> {
    await borrarCmdLocal().catch(() => {});
  }

  /** ¿Esta cuenta ya tiene clave de recuperación? Es opcional. */
  async tieneRecuperacion(): Promise<boolean> {
    const b = await this.cargarBoveda();
    return b !== null && tieneRecuperacion(b);
  }

  /**
   * Crea la clave de recuperación (o una nueva, invalidando la anterior). Pide la
   * frase porque la CMD no se puede sacar del navegador. Devuelve la clave en
   * palabras, o null si la frase no es la correcta.
   */
  async crearRecuperacion(frase: string): Promise<string | null> {
    const b = await this.cargarBoveda();
    if (!b) return null;
    const r = await regenerarRecuperacion(b, frase);
    if (!r) return null;
    await this.almacen().guardarBoveda(this.exigirUid(), r.boveda);
    this.boveda = r.boveda;
    return r.claveRecuperacion;
  }

  /** Devuelve la clave de recuperación recién creada y la olvida. */
  tomarClaveRecuperacion(): string | null {
    const c = this.pendienteRecuperacion;
    this.pendienteRecuperacion = null;
    return c;
  }

  async desbloquear(frase: string): Promise<boolean> {
    const b = await this.cargarBoveda();
    if (!b) return false;
    const cmd = await desbloquearConFrase(b, frase);
    if (!cmd) return false;
    this.cmd = cmd;
    await this.recordarEnEsteDispositivo();
    return true;
  }

  /** Cambia la frase de la bóveda (p. ej. para unirla a la contraseña de la cuenta). */
  async cambiarFrase(fraseActual: string, fraseNueva: string): Promise<boolean> {
    const b = await this.cargarBoveda();
    if (!b) return false;
    const nueva = await cambiarFrase(b, fraseActual, fraseNueva);
    if (!nueva) return false;
    await this.almacen().guardarBoveda(this.exigirUid(), nueva);
    this.boveda = nueva;
    return true;
  }

  /** Olvidó la frase: la clave de recuperación abre y fija una frase nueva. */
  async desbloquearConRecuperacion(clave: string, fraseNueva: string): Promise<boolean> {
    const b = await this.cargarBoveda();
    if (!b) return false;
    const nueva = await restablecerFraseConRecuperacion(b, clave, fraseNueva);
    if (!nueva) return false;
    await this.almacen().guardarBoveda(this.exigirUid(), nueva);
    this.boveda = nueva;
    return this.desbloquear(fraseNueva);
  }

  bloquear(): void {
    this.cmd = null;
    this.claves.clear();
    this.vistas.clear();
    this.pendienteRecuperacion = null;
  }

  desbloqueado(): boolean {
    return this.cmd !== null;
  }

  // --- claves y contexto ---------------------------------------------------

  private ctx(casoUid: string, parteId: string, rev: number, kid: number): ContextoParte {
    return { uid: this.exigirUid(), caso_uid: casoUid, parte_id: parteId, rev, kid };
  }

  private async claveDeCaso(casoUid: string): Promise<SobreConClave | null> {
    const guardada = this.claves.get(casoUid);
    if (guardada) return guardada;
    const cab = await this.almacen().leerCabecera(this.exigirUid(), casoUid);
    if (!cab) return null;
    const cc = await abrirClaveCaso(this.exigirCmd(), this.exigirUid(), cab.cc_envuelta);
    if (!cc) throw new Error("No se pudo abrir la clave de este caso. Puede estar dañado.");
    const entrada = { cc, envuelta: cab.cc_envuelta };
    this.claves.set(casoUid, entrada);
    this.vista(casoUid).revCabecera = cab.rev;
    return entrada;
  }

  private vista(casoUid: string): Vista {
    let v = this.vistas.get(casoUid);
    if (!v) {
      v = { revCabecera: 0, revIndice: 0, ilegibles: [], partes: new Map() };
      this.vistas.set(casoUid, v);
    }
    return v;
  }

  // --- casos -----------------------------------------------------------------

  async crearCaso(expediente: Expediente): Promise<void> {
    const uid = this.exigirUid();
    const casoUid = expediente.caso.id;
    if (!this.claves.has(casoUid) && !(await this.almacen().leerCabecera(uid, casoUid))) {
      await this.ranuras.reclamar(casoUid);
      const { envuelta, cc } = await crearClaveCaso(this.exigirCmd(), uid, casoUid);
      this.vista(casoUid).revCabecera = await this.almacen().guardarCabecera(uid, casoUid, 0, envuelta);
      this.claves.set(casoUid, { cc, envuelta });
    }
    await this.escribirCaso(expediente);
  }

  async actualizarCaso(expediente: Expediente): Promise<void> {
    const casoUid = expediente.caso.id;
    if (!this.vistas.has(casoUid)) await this.obtenerCaso(casoUid);
    const previo = this.expedienteVisto(casoUid);
    const motivo = comprobarCambioExpediente(previo, expediente);
    if (motivo) throw new Error(motivo);

    /*
      Archivar y reactivar tocan la ranura del servidor. El orden importa porque
      las reglas solo dejan escribir en casos con ranura ACTIVA:
       - archivar: primero se guarda el cambio, después se libera la ranura;
       - reactivar: primero se ocupa la ranura (falla si no hay hueco), después se guarda.
      «En pausa» sigue ocupando ranura, así que no pasa por el servidor.
    */
    const antes = previo?.caso.fase;
    const despues = expediente.caso.fase;
    if (antes === "archivado" && despues !== "archivado") {
      await this.ranuras.reactivar(casoUid);
      await this.escribirCaso(expediente);
    } else if (antes !== "archivado" && despues === "archivado") {
      await this.escribirCaso(expediente);
      await this.ranuras.archivar(casoUid);
    } else {
      await this.escribirCaso(expediente);
    }
  }

  private expedienteVisto(casoUid: string): Expediente | null {
    const v = this.vistas.get(casoUid);
    if (!v || v.partes.size === 0) return null;
    return unirExpediente(
      [...v.partes.entries()].map(([parte_id, p]) => ({ parte_id, tipo: p.tipo, contenido: p.contenido }))
    );
  }

  /** Avisos de las fusiones hechas desde la última vez; se entregan una sola vez. */
  tomarAvisosFusion(): AvisoFusion[] {
    return this.tomarResultadoFusion().avisos;
  }

  /** `fusionado`: se mezcló con cambios de otro dispositivo, aunque no haya nada que avisar. */
  tomarResultadoFusion(): { fusionado: boolean; avisos: AvisoFusion[] } {
    const resultado = { fusionado: this.huboFusion, avisos: this.avisosFusion };
    this.avisosFusion = [];
    this.huboFusion = false;
    return resultado;
  }

  /**
   * Guarda el caso; si otro dispositivo se adelantó, fusiona y reintenta. Cada
   * intento sube solo lo que falta, así que un corte a medias se reanuda sin duplicar.
   */
  private async escribirCaso(expediente: Expediente, intento = 1): Promise<void> {
    try {
      await this.subirCaso(expediente);
    } catch (e) {
      if (!(e instanceof ConflictoDeRevision) || intento >= INTENTOS_DE_FUSION) throw e;
      const casoUid = expediente.caso.id;
      const base = this.expedienteVisto(casoUid);
      const remoto = await this.obtenerCaso(casoUid, true);
      if (!remoto) throw e;
      // El índice también pudo cambiar en el otro dispositivo.
      const indice = (await this.almacen().listarIndices(this.exigirUid())).find((i) => i.caso_uid === casoUid);
      if (indice) this.vista(casoUid).revIndice = indice.rev;
      const { expediente: fusionado, avisos } = fusionarExpedientes(base, expediente, remoto);
      const motivo = comprobarCambioExpediente(remoto, fusionado);
      if (motivo) {
        throw new Error(`No se pudo fusionar con los cambios de otro dispositivo (${motivo}) Recarga el caso.`);
      }
      this.avisosFusion.push(...avisos);
      this.huboFusion = true;
      await this.escribirCaso(fusionado, intento + 1);
    }
  }

  /** Sube solo las partes que cambiaron desde lo último visto, y después el índice. */
  private async subirCaso(expediente: Expediente): Promise<void> {
    const uid = this.exigirUid();
    const casoUid = expediente.caso.id;
    const clave = await this.claveDeCaso(casoUid);
    if (!clave) throw new Error("El caso no existe en la nube.");
    const vista = this.vista(casoUid);
    const kid = clave.envuelta.kid;

    for (const parte of partirExpediente(expediente)) {
      const previa = vista.partes.get(parte.parte_id);
      if (previa?.contenido === parte.contenido) continue;
      const revPrevia = previa?.rev ?? 0;
      const sobre = await cifrarParte(clave.cc, parte.contenido, this.ctx(casoUid, parte.parte_id, revPrevia + 1, kid));
      const rev = await this.almacen().guardarParte(uid, casoUid, revPrevia, {
        parte_id: parte.parte_id,
        tipo: parte.tipo,
        sobre,
        hash_ct: await sha256Hex(sobre.ct),
      });
      vista.partes.set(parte.parte_id, { rev, tipo: parte.tipo, contenido: parte.contenido });
    }

    const resumen = JSON.stringify(resumirExpediente(expediente));
    const sobreIndice = await cifrarParte(clave.cc, resumen, this.ctx(casoUid, ID_INDICE, vista.revIndice + 1, kid));
    vista.revIndice = await this.almacen().guardarIndice(uid, casoUid, vista.revIndice, sobreIndice);
  }

  /** `paraFusionar`: si hay partes ilegibles no se sigue, para no pisarlas al guardar. */
  async obtenerCaso(id: string, paraFusionar = false): Promise<Expediente | null> {
    const uid = this.exigirUid();
    const clave = await this.claveDeCaso(id);
    if (!clave) return null;
    const remotas = await this.almacen().listarPartes(uid, id);
    const vista = this.vista(id);
    vista.partes.clear();

    const partes: Parte[] = [];
    const corruptas: string[] = [];
    vista.ilegibles = corruptas;
    for (const r of remotas) {
      const texto = await this.descifrarRemota(clave, id, r);
      if (texto === null) {
        corruptas.push(r.parte_id);
        continue;
      }
      vista.partes.set(r.parte_id, { rev: r.rev, tipo: r.tipo, contenido: texto });
      partes.push({ parte_id: r.parte_id, tipo: r.tipo, contenido: texto });
    }
    // Una parte ilegible no se borra ni se oculta: se avisa y se abre solo lo sano.
    if (corruptas.length > 0) {
      console.error(`Partes ilegibles en el caso (${corruptas.length}).`);
      if (paraFusionar) {
        throw new Error("Hay partes del caso que no se pueden leer: no se guarda encima. Restáuralo desde una copia.");
      }
    }
    const expediente = unirExpediente(partes);
    if (!expediente) {
      if (corruptas.length > 0) {
        throw new Error("La cabecera de este caso no se puede leer. Restáuralo desde una copia.");
      }
      return null;
    }
    for (const v of expediente.versiones) v.analisis = migrarAV9(v.analisis);
    return expediente;
  }

  private descifrarRemota(clave: SobreConClave, casoUid: string, r: ParteRemota) {
    return descifrarParte(clave.cc, r.sobre, this.ctx(casoUid, r.parte_id, r.rev, clave.envuelta.kid));
  }

  async listarCasos(): Promise<ResumenCaso[]> {
    const uid = this.exigirUid();
    const resumenes: ResumenCaso[] = [];
    for (const ind of await this.almacen().listarIndices(uid)) {
      const clave = await this.claveDeCaso(ind.caso_uid);
      if (!clave) continue;
      const texto = await descifrarParte(
        clave.cc,
        ind.sobre,
        this.ctx(ind.caso_uid, ID_INDICE, ind.rev, clave.envuelta.kid)
      );
      if (texto === null) continue;
      this.vista(ind.caso_uid).revIndice = ind.rev;
      resumenes.push(JSON.parse(texto) as ResumenCaso);
    }
    return resumenes.sort((a, b) => b.actualizado.localeCompare(a.actualizado));
  }

  async eliminarCaso(): Promise<void> {
    // Las reglas impiden borrar desde el cliente a propósito (propuesta §5).
    throw new Error("Un caso en la nube no se elimina desde aquí. Archívalo para liberar su ranura.");
  }

  // --- respaldo (cifrado) ----------------------------------------------------

  async exportarRespaldo(): Promise<Blob> {
    const uid = this.exigirUid();
    const boveda = await this.cargarBoveda();
    const casos = [];
    for (const ind of await this.almacen().listarIndices(uid)) {
      casos.push({
        caso_uid: ind.caso_uid,
        cabecera: await this.almacen().leerCabecera(uid, ind.caso_uid),
        indice: ind,
        partes: await this.almacen().listarPartes(uid, ind.caso_uid),
      });
    }
    const respaldo = {
      formato: "acia-respaldo-nube-v1",
      exportado: new Date().toISOString(),
      uid,
      boveda,
      casos,
    };
    return new Blob([JSON.stringify(respaldo)], { type: "application/json" });
  }

  async importarRespaldo(): Promise<number> {
    throw new Error("Para importar un respaldo hace falta la frase de paso de la cuenta que lo creó.");
  }

  /**
   * Importa un respaldo de la nube (propuesta §7.3.2). Sus sobres están atados al
   * uid de la cuenta de origen, así que no se pueden copiar tal cual: se abren con
   * la frase de ESA bóveda y los casos se recrean en esta cuenta con claves nuevas.
   * Un caso que ya existe aquí se omite; uno que falla no detiene a los demás.
   */
  async importarRespaldoNube(
    contenido: string,
    frase: string | string[]
  ): Promise<{ importados: number; omitidos: number; fallidos: number }> {
    this.exigirCmd();
    const datos = JSON.parse(contenido) as {
      formato?: string;
      uid?: string;
      boveda?: Boveda;
      casos?: { caso_uid: string; cabecera: CabeceraRemota | null; partes: ParteRemota[] }[];
    };
    if (datos.formato !== "acia-respaldo-nube-v1" || !datos.uid || !datos.boveda || !Array.isArray(datos.casos)) {
      throw new Error("El archivo no es un respaldo de la nube de ACIA.");
    }
    // Varias candidatas: la clave derivada de la contraseña, o la frase aparte de una cuenta anterior.
    let cmdOrigen: CryptoKey | null = null;
    for (const candidata of Array.isArray(frase) ? frase : [frase]) {
      cmdOrigen = await desbloquearConFrase(datos.boveda, candidata);
      if (cmdOrigen) break;
    }
    if (!cmdOrigen) throw new Error("La contraseña no abre este respaldo.");

    const existentes = new Set((await this.almacen().listarIndices(this.exigirUid())).map((i) => i.caso_uid));
    let importados = 0;
    let omitidos = 0;
    let fallidos = 0;
    for (const c of datos.casos) {
      if (existentes.has(c.caso_uid)) {
        omitidos++;
        continue;
      }
      try {
        const expediente = await this.abrirCasoDeRespaldo(datos.uid, cmdOrigen, c);
        // Un caso archivado necesita ranura activa para escribirse; se archiva después.
        const final = expediente.caso.fase;
        await this.crearCaso(final === "archivado" ? { ...expediente, caso: { ...expediente.caso, fase: "activo" } } : expediente);
        if (final === "archivado") await this.actualizarCaso(expediente);
        importados++;
      } catch {
        fallidos++;
      }
    }
    return { importados, omitidos, fallidos };
  }

  private async abrirCasoDeRespaldo(
    uidOrigen: string,
    cmdOrigen: CryptoKey,
    c: { caso_uid: string; cabecera: CabeceraRemota | null; partes: ParteRemota[] }
  ): Promise<Expediente> {
    if (!c.cabecera) throw new Error("Falta la cabecera.");
    const cc = await abrirClaveCaso(cmdOrigen, uidOrigen, c.cabecera.cc_envuelta);
    if (!cc) throw new Error("No se pudo abrir la clave del caso.");
    const partes: Parte[] = [];
    for (const r of c.partes) {
      const texto = await descifrarParte(cc, r.sobre, {
        uid: uidOrigen,
        caso_uid: c.caso_uid,
        parte_id: r.parte_id,
        rev: r.rev,
        kid: c.cabecera.cc_envuelta.kid,
      });
      if (texto === null) throw new Error("Una parte del respaldo no se puede leer.");
      partes.push({ parte_id: r.parte_id, tipo: r.tipo, contenido: texto });
    }
    const expediente = unirExpediente(partes);
    if (!expediente) throw new Error("El respaldo no tiene la cabecera del caso.");
    for (const v of expediente.versiones) v.analisis = migrarAV9(v.analisis);
    return expediente;
  }

  // --- historial de partes (etapa 5) -----------------------------------------

  /** Ids de las partes que no se pudieron leer la última vez que se abrió el caso. */
  partesIlegibles(casoUid: string): string[] {
    return [...(this.vistas.get(casoUid)?.ilegibles ?? [])];
  }

  /**
   * Lo que el terapeuta puede recuperar, en sus palabras (sesiones, no «partes»).
   * Incluye las partes ilegibles aunque no tengan versiones, para poder avisar.
   */
  async versionesAnteriores(casoUid: string): Promise<GrupoVersiones[]> {
    const uid = this.exigirUid();
    const clave = await this.claveDeCaso(casoUid);
    if (!clave) return [];
    const [remotas, historial] = await Promise.all([
      this.almacen().listarPartes(uid, casoUid),
      this.almacen().listarHistorialCaso(uid, casoUid),
    ]);

    const grupos = new Map<
      string,
      { tipo: Parte["tipo"]; texto: string | null; ilegible: boolean; versiones: VersionAnterior[] }
    >();
    for (const r of remotas) {
      const texto = await this.descifrarRemota(clave, casoUid, r);
      grupos.set(r.parte_id, { tipo: r.tipo, texto, ilegible: texto === null, versiones: [] });
    }
    for (const h of historial) {
      let g = grupos.get(h.parte_id);
      if (!g) {
        g = { tipo: h.tipo, texto: null, ilegible: false, versiones: [] };
        grupos.set(h.parte_id, g);
      }
      g.versiones.push({
        historial_id: h.historial_id,
        rev: h.rev,
        archivado_en: h.archivado_en,
        dispositivo_id: h.dispositivo_id,
      });
      // Si la parte actual no se lee, su etiqueta sale de la versión anterior.
      if (g.texto === null) {
        g.texto = await descifrarParte(clave.cc, h.sobre, this.ctx(casoUid, h.parte_id, h.rev, clave.envuelta.kid));
      }
    }

    const numeroDeSesion = new Map<string, number>();
    const datosDeSesion = new Map<string, { n: number; fecha: string }>();
    for (const [parteId, g] of grupos) {
      if (g.tipo !== "sesion" || g.texto === null) continue;
      try {
        const { sesion } = JSON.parse(g.texto) as { sesion: { n: number; fecha: string } };
        numeroDeSesion.set(parteId.replace(/^s-/, ""), sesion.n);
        datosDeSesion.set(parteId, sesion);
      } catch {}
    }

    const etiqueta = (parteId: string, tipo: Parte["tipo"]): { etiqueta: string; fecha: string | null } => {
      if (tipo === "cabecera") return { etiqueta: "Datos del caso (alias y motivo)", fecha: null };
      if (tipo === "revisiones") {
        const n = numeroDeSesion.get(parteId.replace(/^r-/, ""));
        return { etiqueta: n ? `Registro de cambios · sesión ${n}` : "Registro de cambios", fecha: null };
      }
      const d = datosDeSesion.get(parteId);
      return d ? { etiqueta: `Sesión ${d.n}`, fecha: d.fecha } : { etiqueta: "Una sesión del caso", fecha: null };
    };

    return [...grupos.entries()]
      .filter(([, g]) => g.versiones.length > 0 || g.ilegible)
      .map(([parteId, g]) => ({ parte_id: parteId, ...etiqueta(parteId, g.tipo), ilegible: g.ilegible, versiones: g.versiones }))
      .sort(
        (a, b) =>
          Number(b.ilegible) - Number(a.ilegible) || a.etiqueta.localeCompare(b.etiqueta, "es", { numeric: true })
      );
  }

  /** Versiones anteriores de una parte, de la más reciente a la más antigua. */
  async historialDeParte(casoUid: string, parteId: string): Promise<{ historial_id: string; rev: number }[]> {
    const h = await this.almacen().listarHistorial(this.exigirUid(), casoUid, parteId);
    return h.map(({ historial_id, rev }) => ({ historial_id, rev }));
  }

  /**
   * Devuelve una parte a una versión anterior. No borra nada: la versión que se
   * sustituye pasa a su vez al historial. Sirve también para una parte dañada.
   */
  async restaurarParte(casoUid: string, parteId: string, historialId: string): Promise<Expediente | null> {
    const uid = this.exigirUid();
    const clave = await this.claveDeCaso(casoUid);
    if (!clave) throw new Error("El caso no existe en la nube.");
    const kid = clave.envuelta.kid;

    const anterior = (await this.almacen().listarHistorial(uid, casoUid, parteId)).find(
      (h) => h.historial_id === historialId
    );
    if (!anterior) throw new Error("Esa versión anterior ya no está disponible.");
    const texto = await descifrarParte(clave.cc, anterior.sobre, this.ctx(casoUid, parteId, anterior.rev, kid));
    if (texto === null) throw new Error("Esa versión anterior no se puede leer.");

    const actual = (await this.almacen().listarPartes(uid, casoUid)).find((p) => p.parte_id === parteId);
    if (!actual) throw new Error("La parte ya no existe.");
    const sobre = await cifrarParte(clave.cc, texto, this.ctx(casoUid, parteId, actual.rev + 1, kid));
    await this.almacen().guardarParte(uid, casoUid, actual.rev, {
      parte_id: parteId,
      tipo: anterior.tipo,
      sobre,
      hash_ct: await sha256Hex(sobre.ct),
    });

    // Lo restaurado puede cambiar el resumen de la lista: se relee y se rehace el índice.
    const expediente = await this.obtenerCaso(casoUid);
    if (expediente) await this.escribirCaso(expediente);
    return expediente;
  }

  // --- historial anterior a los casos (no existe en la nube) -----------------

  async guardar(): Promise<string> {
    throw new Error("El historial suelto ya no se usa: crea un caso.");
  }
  async listar(): Promise<ResumenHistorial[]> {
    return [];
  }
  async obtener(): Promise<RegistroHistorial | null> {
    return null;
  }
  async eliminar(): Promise<void> {}
  async migrarHistorial(): Promise<{ migrados: number; fallidos: number }> {
    return { migrados: 0, fallidos: 0 };
  }
}

export { ConflictoDeRevision };
