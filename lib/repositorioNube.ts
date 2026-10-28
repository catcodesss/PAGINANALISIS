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
import {
  abrirClaveCaso,
  crearBoveda,
  crearClaveCaso,
  desbloquearConFrase,
  restablecerFraseConRecuperacion,
  type Boveda,
  type ClaveCasoEnvuelta,
} from "./boveda";
import { cifrarParte, descifrarParte, type ContextoParte } from "./cifradoV2";
import { partirExpediente, unirExpediente, type Parte } from "./nube/particion";
import {
  ConflictoDeRevision,
  type AlmacenRemoto,
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
 * Esta etapa NO incluye: caché sin conexión, cola de escritura ni fusión de
 * conflictos (etapa 4). Un conflicto de revisión se avisa y no se pisa.
 */

export const ID_INDICE = "indice";

type SobreConClave = { cc: CryptoKey; envuelta: ClaveCasoEnvuelta };

/** Lo último que este dispositivo vio de un caso: revisiones y contenido en claro. */
interface Vista {
  revCabecera: number;
  revIndice: number;
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

  /** Crea la bóveda. La clave de recuperación se recoge una sola vez con `tomarClaveRecuperacion`. */
  async configurar(frase: string): Promise<void> {
    const uid = this.exigirUid();
    if (await this.cargarBoveda()) throw new Error("Esta cuenta ya tiene una bóveda de claves.");
    const { boveda, cmd, claveRecuperacion } = await crearBoveda(frase);
    await this.almacen().guardarBoveda(uid, boveda);
    this.boveda = boveda;
    this.cmd = cmd;
    this.pendienteRecuperacion = claveRecuperacion;
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
      v = { revCabecera: 0, revIndice: 0, partes: new Map() };
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

  /** Sube solo las partes que cambiaron desde lo último visto, y después el índice. */
  private async escribirCaso(expediente: Expediente): Promise<void> {
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

  async obtenerCaso(id: string): Promise<Expediente | null> {
    const uid = this.exigirUid();
    const clave = await this.claveDeCaso(id);
    if (!clave) return null;
    const remotas = await this.almacen().listarPartes(uid, id);
    const vista = this.vista(id);
    vista.partes.clear();

    const partes: Parte[] = [];
    const corruptas: string[] = [];
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
    throw new Error("Importar un respaldo en la nube todavía no está disponible.");
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
