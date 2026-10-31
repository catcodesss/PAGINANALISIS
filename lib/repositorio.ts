import type { AnalisisFuncional } from "./types";
import { migrarAV9 } from "./identidad";
import {
  comprobarCambioExpediente,
  diasParaBorrar,
  expedienteDesdeAnalisis,
  resumirExpediente,
  type Expediente,
  type ResumenCaso,
} from "./casos";
import { FORMATO_RESPALDO, leerRespaldo } from "./respaldo";
import {
  cifrar,
  crearTestigo,
  derivarClave,
  descifrar,
  generarSal,
  nuevoId,
  verificarTestigo,
  type SobreCifrado,
} from "./cifrado";
import { RepositorioNube } from "./repositorioNube";
import { almacenFirestore } from "./nube/almacenFirestore";
import { ranurasDelServidor } from "./nube/ranurasCliente";
import { firestore, nubeActivada } from "./firebaseCliente";

/**
 * Historial de análisis.
 *
 * La interfaz `Repositorio` es el punto de sustitución: hoy la implementa
 * `repositorioLocal` sobre IndexedDB cifrado, y mañana puede implementarla un
 * backend con cuentas sin tocar la interfaz de usuario. Por eso ningún
 * componente debe hablar con IndexedDB directamente.
 *
 * Qué se guarda en claro: el identificador y la fecha, para poder ordenar la
 * lista sin descifrar. Todo lo demás —referencia del caso, nota clínica y
 * análisis— va dentro del sobre cifrado.
 */

export interface EntradaHistorial {
  referencia: string;
  nota: string;
  analisis: AnalisisFuncional;
}

export interface RegistroHistorial extends EntradaHistorial {
  id: string;
  fecha: string;
}

/** Lo que necesita la lista, sin cargar el análisis completo. */
export interface ResumenHistorial {
  id: string;
  fecha: string;
  referencia: string;
  conductas: number;
  alertas: number;
}

export interface Repositorio {
  /** Falso en entornos sin IndexedDB (algunos modos privados, SSR). */
  disponible(): boolean;
  /**
   * Ata la biblioteca a una cuenta (`usuario_id`): cada cuenta abre su propia
   * base local, y otra cuenta en el mismo navegador no ve estos casos. Bloquea
   * el historial. `null` = sin cuentas (modo sin Firebase configurado).
   */
  asociarCuenta(usuarioId: string | null): Promise<void>;
  yaConfigurado(): Promise<boolean>;
  configurar(contrasena: string): Promise<void>;
  desbloquear(contrasena: string): Promise<boolean>;
  bloquear(): void;
  desbloqueado(): boolean;
  guardar(entrada: EntradaHistorial): Promise<string>;
  listar(): Promise<ResumenHistorial[]>;
  obtener(id: string): Promise<RegistroHistorial | null>;
  eliminar(id: string): Promise<void>;
  /** Respaldo cifrado: el usuario se lo lleva a otro equipo. */
  exportarRespaldo(): Promise<Blob>;
  importarRespaldo(contenido: string): Promise<number>;

  // --- casos (fase 7) ---
  /**
   * Convierte cada análisis suelto del historial anterior en un caso con una
   * sesión. El que falla se queda donde estaba y se cuenta.
   */
  migrarHistorial(): Promise<{ migrados: number; fallidos: number }>;
  crearCaso(expediente: Expediente): Promise<void>;
  listarCasos(): Promise<ResumenCaso[]>;
  obtenerCaso(id: string): Promise<Expediente | null>;
  /** Rechaza el cambio si edita una nota, borra revisiones o toca una versión cerrada. */
  actualizarCaso(expediente: Expediente): Promise<void>;
  /**
   * Elimina el caso: sale de la lista y libera su lugar del plan, pero espera
   * DIAS_PARA_BORRAR días antes del borrado definitivo. Hasta entonces se recupera.
   */
  eliminarCaso(id: string): Promise<void>;
  /** Devuelve un caso eliminado a como estaba. */
  recuperarCaso(id: string): Promise<void>;
  /** Borrado definitivo de un caso ya eliminado, sin esperar los 30 días. */
  borrarCasoDefinitivo(id: string): Promise<void>;
}

// --- IndexedDB ---------------------------------------------------------

const BD = "acia-historial";
// Marca de qué cuenta heredó la base anterior a las cuentas (`acia-historial`).
const MARCA_BD_HEREDADA = "acia-bd-heredada";
let nombreBd = BD;

function nombreBdDeCuenta(usuarioId: string): string {
  return `${BD}-${usuarioId}`;
}
const VERSION = 2;
const ALMACEN_REGISTROS = "registros";
const ALMACEN_CASOS = "casos";
const ALMACEN_CONFIG = "config";
const CLAVE_CONFIG = "cifrado";

interface ConfigCifrado {
  clave: string;
  sal: number[];
  testigo: SobreCifrado;
}

interface RegistroCrudo {
  id: string;
  fecha: string;
  sobre: SobreCifrado;
}

function abrirBd(): Promise<IDBDatabase> {
  return new Promise((resolver, rechazar) => {
    const solicitud = indexedDB.open(nombreBd, VERSION);
    solicitud.onupgradeneeded = () => {
      const bd = solicitud.result;
      if (!bd.objectStoreNames.contains(ALMACEN_REGISTROS)) {
        bd.createObjectStore(ALMACEN_REGISTROS, { keyPath: "id" });
      }
      if (!bd.objectStoreNames.contains(ALMACEN_CONFIG)) {
        bd.createObjectStore(ALMACEN_CONFIG, { keyPath: "clave" });
      }
      // Un expediente por caso, en un solo sobre: el alias también va cifrado.
      if (!bd.objectStoreNames.contains(ALMACEN_CASOS)) {
        bd.createObjectStore(ALMACEN_CASOS, { keyPath: "id" });
      }
    };
    solicitud.onsuccess = () => resolver(solicitud.result);
    solicitud.onerror = () => rechazar(solicitud.error);
  });
}

function operacion<T>(peticion: IDBRequest<T>): Promise<T> {
  return new Promise((resolver, rechazar) => {
    peticion.onsuccess = () => resolver(peticion.result);
    peticion.onerror = () => rechazar(peticion.error);
  });
}

async function leerConfig(): Promise<ConfigCifrado | null> {
  const bd = await abrirBd();
  try {
    const tx = bd.transaction(ALMACEN_CONFIG, "readonly");
    const resultado = await operacion<ConfigCifrado | undefined>(
      tx.objectStore(ALMACEN_CONFIG).get(CLAVE_CONFIG)
    );
    return resultado ?? null;
  } finally {
    bd.close();
  }
}

async function existeBdAnterior(): Promise<boolean> {
  if (typeof indexedDB === "undefined" || !indexedDB.databases) return false;
  try {
    return (await indexedDB.databases()).some((d) => d.name === BD);
  } catch {
    return false;
  }
}

class RepositorioLocal implements Repositorio {
  private clave: CryptoKey | null = null;

  disponible(): boolean {
    return typeof indexedDB !== "undefined";
  }

  async asociarCuenta(usuarioId: string | null): Promise<void> {
    this.clave = null;
    if (usuarioId === null) {
      nombreBd = BD;
      return;
    }
    // Los casos creados antes de las cuentas viven en `acia-historial`: la
    // primera cuenta que entre en este navegador los hereda; las demás, no.
    let heredada: string | null = null;
    try {
      heredada = localStorage.getItem(MARCA_BD_HEREDADA);
    } catch {}
    if (heredada === null && (await existeBdAnterior())) {
      try {
        localStorage.setItem(MARCA_BD_HEREDADA, usuarioId);
        heredada = usuarioId;
      } catch {}
    }
    nombreBd = heredada === usuarioId ? BD : nombreBdDeCuenta(usuarioId);
  }

  async yaConfigurado(): Promise<boolean> {
    return (await leerConfig()) !== null;
  }

  async configurar(contrasena: string): Promise<void> {
    if (await this.yaConfigurado()) {
      throw new Error("El historial ya tiene una contraseña configurada.");
    }
    const sal = generarSal();
    const clave = await derivarClave(contrasena, sal);
    const config: ConfigCifrado = {
      clave: CLAVE_CONFIG,
      sal,
      testigo: await crearTestigo(clave),
    };

    const bd = await abrirBd();
    try {
      const tx = bd.transaction(ALMACEN_CONFIG, "readwrite");
      await operacion(tx.objectStore(ALMACEN_CONFIG).put(config));
    } finally {
      bd.close();
    }
    this.clave = clave;
  }

  async desbloquear(contrasena: string): Promise<boolean> {
    const config = await leerConfig();
    if (!config) return false;

    const clave = await derivarClave(contrasena, config.sal);
    if (!(await verificarTestigo(clave, config.testigo))) return false;

    this.clave = clave;
    return true;
  }

  bloquear(): void {
    this.clave = null;
  }

  desbloqueado(): boolean {
    return this.clave !== null;
  }

  private exigirClave(): CryptoKey {
    if (!this.clave) {
      throw new Error("El historial está bloqueado. Introduce tu contraseña.");
    }
    return this.clave;
  }

  async guardar(entrada: EntradaHistorial): Promise<string> {
    const clave = this.exigirClave();
    const registro: RegistroCrudo = {
      id: nuevoId(),
      fecha: new Date().toISOString(),
      sobre: await cifrar(clave, JSON.stringify(entrada)),
    };

    const bd = await abrirBd();
    try {
      const tx = bd.transaction(ALMACEN_REGISTROS, "readwrite");
      await operacion(tx.objectStore(ALMACEN_REGISTROS).put(registro));
    } finally {
      bd.close();
    }
    return registro.id;
  }

  private async todosLosCrudos(): Promise<RegistroCrudo[]> {
    const bd = await abrirBd();
    try {
      const tx = bd.transaction(ALMACEN_REGISTROS, "readonly");
      return await operacion<RegistroCrudo[]>(
        tx.objectStore(ALMACEN_REGISTROS).getAll()
      );
    } finally {
      bd.close();
    }
  }

  /**
   * La referencia del caso va cifrada, así que la lista exige descifrar todos
   * los registros. Con volúmenes de consulta (decenas o cientos) es
   * instantáneo; si algún día crece, habría que guardar un índice cifrado
   * aparte en vez de descifrar de uno en uno.
   */
  async listar(): Promise<ResumenHistorial[]> {
    const clave = this.exigirClave();
    const crudos = await this.todosLosCrudos();
    const resumenes: ResumenHistorial[] = [];

    for (const crudo of crudos) {
      const plano = await descifrar(clave, crudo.sobre);
      if (!plano) continue; // registro de otra contraseña o corrupto: se omite
      const entrada = JSON.parse(plano) as EntradaHistorial;
      resumenes.push({
        id: crudo.id,
        fecha: crudo.fecha,
        referencia: entrada.referencia || "Sin referencia",
        conductas: entrada.analisis.conductas_problema.length,
        alertas: entrada.analisis.alertas.length,
      });
    }

    return resumenes.sort((a, b) => b.fecha.localeCompare(a.fecha));
  }

  async obtener(id: string): Promise<RegistroHistorial | null> {
    const clave = this.exigirClave();
    const bd = await abrirBd();
    let crudo: RegistroCrudo | undefined;
    try {
      const tx = bd.transaction(ALMACEN_REGISTROS, "readonly");
      crudo = await operacion<RegistroCrudo | undefined>(
        tx.objectStore(ALMACEN_REGISTROS).get(id)
      );
    } finally {
      bd.close();
    }
    if (!crudo) return null;

    const plano = await descifrar(clave, crudo.sobre);
    if (!plano) return null;

    const entrada = JSON.parse(plano) as EntradaHistorial;

    return {
      id: crudo.id,
      fecha: crudo.fecha,
      ...entrada,
      /*
        Un informe guardado puede ser de cualquier versión anterior: el
        historial es local y nadie lo actualiza por detrás. migrarAV9 le da
        identidad a sus entidades y funde la cadena DBT duplicada; es
        idempotente, así que uno que ya sea v2 pasa por aquí sin cambiar.

        Se migra AL LEER y no al guardar a propósito: al guardar habría que
        reescribir todo el almacén cifrado en una migración de arranque, y un
        fallo a media migración dejaría el historial en dos versiones sin que
        el usuario pudiera hacer nada. Leyendo, el peor caso es que el informe
        se migre otra vez la próxima vez que se abra.
      */
      analisis: migrarAV9(entrada.analisis),
    };
  }

  async eliminar(id: string): Promise<void> {
    const bd = await abrirBd();
    try {
      const tx = bd.transaction(ALMACEN_REGISTROS, "readwrite");
      await operacion(tx.objectStore(ALMACEN_REGISTROS).delete(id));
    } finally {
      bd.close();
    }
  }

  /**
   * El respaldo sale cifrado tal cual está: se puede guardar en cualquier sitio
   * sin exponer nada, y solo se abre con la misma contraseña. Incluye la sal,
   * que hace falta para volver a derivar la clave en otro equipo.
   */
  async exportarRespaldo(): Promise<Blob> {
    const config = await leerConfig();
    if (!config) throw new Error("No hay historial que exportar.");

    const respaldo = {
      formato: FORMATO_RESPALDO,
      exportado: new Date().toISOString(),
      sal: config.sal,
      testigo: config.testigo,
      registros: await this.todosLosCrudos(),
      casos: await this.todosLosCasosCrudos(),
    };
    return new Blob([JSON.stringify(respaldo)], { type: "application/json" });
  }

  async importarRespaldo(contenido: string): Promise<number> {
    // Acepta v1 y v2 (lib/respaldo.ts): los registros de un v1 se convierten
    // en casos con la próxima migración.
    const respaldo = leerRespaldo(contenido);

    const config = await leerConfig();
    if (config && JSON.stringify(config.sal) !== JSON.stringify(respaldo.sal)) {
      throw new Error(
        "El respaldo se creó con otra contraseña. Importa en un historial vacío o usa la contraseña original."
      );
    }

    const bd = await abrirBd();
    try {
      if (!config) {
        const txConfig = bd.transaction(ALMACEN_CONFIG, "readwrite");
        await operacion(
          txConfig.objectStore(ALMACEN_CONFIG).put({
            clave: CLAVE_CONFIG,
            sal: respaldo.sal,
            testigo: respaldo.testigo,
          })
        );
      }

      const { registros, casos } = respaldo;
      const tx = bd.transaction([ALMACEN_REGISTROS, ALMACEN_CASOS], "readwrite");
      for (const registro of registros) {
        await operacion(tx.objectStore(ALMACEN_REGISTROS).put(registro));
      }
      for (const caso of casos) {
        await operacion(tx.objectStore(ALMACEN_CASOS).put(caso));
      }
      return registros.length + casos.length;
    } finally {
      bd.close();
    }
  }

  // --- casos ---------------------------------------------------------------

  private async todosLosCasosCrudos(): Promise<RegistroCrudo[]> {
    const bd = await abrirBd();
    try {
      const tx = bd.transaction(ALMACEN_CASOS, "readonly");
      return await operacion<RegistroCrudo[]>(tx.objectStore(ALMACEN_CASOS).getAll());
    } finally {
      bd.close();
    }
  }

  private async escribirCaso(expediente: Expediente, borrarRegistro?: string): Promise<void> {
    const clave = this.exigirClave();
    const crudo: RegistroCrudo = {
      id: expediente.caso.id,
      fecha: expediente.caso.actualizado,
      sobre: await cifrar(clave, JSON.stringify(expediente)),
    };
    const bd = await abrirBd();
    try {
      // Caso nuevo y registro viejo en la misma transacción: o los dos o ninguno.
      const tx = bd.transaction([ALMACEN_CASOS, ALMACEN_REGISTROS], "readwrite");
      await operacion(tx.objectStore(ALMACEN_CASOS).put(crudo));
      if (borrarRegistro) await operacion(tx.objectStore(ALMACEN_REGISTROS).delete(borrarRegistro));
    } finally {
      bd.close();
    }
  }

  async migrarHistorial(): Promise<{ migrados: number; fallidos: number }> {
    const clave = this.exigirClave();
    let migrados = 0;
    let fallidos = 0;
    for (const crudo of await this.todosLosCrudos()) {
      try {
        const plano = await descifrar(clave, crudo.sobre);
        if (!plano) throw new Error("ilegible");
        const entrada = JSON.parse(plano) as EntradaHistorial;
        const expediente = expedienteDesdeAnalisis({
          referencia: entrada.referencia,
          nota: entrada.nota,
          analisis: migrarAV9(entrada.analisis),
          fecha: crudo.fecha,
        });
        await this.escribirCaso(expediente, crudo.id);
        migrados += 1;
      } catch {
        fallidos += 1; // se queda en `registros`, intacto
      }
    }
    return { migrados, fallidos };
  }

  async crearCaso(expediente: Expediente): Promise<void> {
    await this.escribirCaso(expediente);
  }

  async listarCasos(): Promise<ResumenCaso[]> {
    const clave = this.exigirClave();
    const resumenes: ResumenCaso[] = [];
    for (const crudo of await this.todosLosCasosCrudos()) {
      const plano = await descifrar(clave, crudo.sobre);
      if (!plano) continue;
      const resumen = resumirExpediente(JSON.parse(plano) as Expediente);
      // Pasado el plazo, el caso eliminado se borra al listar.
      if (resumen.eliminado_en && diasParaBorrar(resumen.eliminado_en) === 0) {
        await this.borrarDelDisco(resumen.id);
        continue;
      }
      resumenes.push(resumen);
    }
    return resumenes.sort((a, b) => b.actualizado.localeCompare(a.actualizado));
  }

  async obtenerCaso(id: string): Promise<Expediente | null> {
    const clave = this.exigirClave();
    const bd = await abrirBd();
    let crudo: RegistroCrudo | undefined;
    try {
      const tx = bd.transaction(ALMACEN_CASOS, "readonly");
      crudo = await operacion<RegistroCrudo | undefined>(tx.objectStore(ALMACEN_CASOS).get(id));
    } finally {
      bd.close();
    }
    if (!crudo) return null;
    const plano = await descifrar(clave, crudo.sobre);
    if (!plano) return null;
    const expediente = JSON.parse(plano) as Expediente;
    // Igual que `obtener`: se migra al leer. Las versiones no se reescriben en
    // disco por esto; solo se abren en el esquema de hoy.
    for (const v of expediente.versiones) v.analisis = migrarAV9(v.analisis);
    return expediente;
  }

  async actualizarCaso(expediente: Expediente): Promise<void> {
    const previo = await this.obtenerCaso(expediente.caso.id);
    const motivo = comprobarCambioExpediente(previo, expediente);
    if (motivo) throw new Error(motivo);
    await this.escribirCaso(expediente);
  }

  async eliminarCaso(id: string): Promise<void> {
    const exp = await this.obtenerCaso(id);
    if (!exp || exp.caso.eliminado_en) return;
    await this.escribirCaso({ ...exp, caso: { ...exp.caso, eliminado_en: new Date().toISOString() } });
  }

  async recuperarCaso(id: string): Promise<void> {
    const exp = await this.obtenerCaso(id);
    if (!exp || !exp.caso.eliminado_en) return;
    await this.escribirCaso({ ...exp, caso: { ...exp.caso, eliminado_en: null } });
  }

  async borrarCasoDefinitivo(id: string): Promise<void> {
    const exp = await this.obtenerCaso(id);
    if (exp && !exp.caso.eliminado_en) throw new Error("Elimina el caso antes de borrarlo definitivamente.");
    await this.borrarDelDisco(id);
  }

  private async borrarDelDisco(id: string): Promise<void> {
    const bd = await abrirBd();
    try {
      const tx = bd.transaction(ALMACEN_CASOS, "readwrite");
      await operacion(tx.objectStore(ALMACEN_CASOS).delete(id));
    } finally {
      bd.close();
    }
  }
}

/** Local cifrado (por defecto) o nube cifrada de extremo a extremo (NEXT_PUBLIC_ACIA_NUBE=1). */
export const repositorio: Repositorio = nubeActivada()
  ? new RepositorioNube(() => almacenFirestore(firestore()), ranurasDelServidor)
  : new RepositorioLocal();

/** Solo con la nube activa; la interfaz de la bóveda la usa para mostrar la clave de recuperación. */
export function repositorioNube(): RepositorioNube | null {
  return repositorio instanceof RepositorioNube ? repositorio : null;
}
