import type { AnalisisFuncional } from "./types";
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
}

// --- IndexedDB ---------------------------------------------------------

const BD = "ancia-historial";
const VERSION = 1;
const ALMACEN_REGISTROS = "registros";
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
    const solicitud = indexedDB.open(BD, VERSION);
    solicitud.onupgradeneeded = () => {
      const bd = solicitud.result;
      if (!bd.objectStoreNames.contains(ALMACEN_REGISTROS)) {
        bd.createObjectStore(ALMACEN_REGISTROS, { keyPath: "id" });
      }
      if (!bd.objectStoreNames.contains(ALMACEN_CONFIG)) {
        bd.createObjectStore(ALMACEN_CONFIG, { keyPath: "clave" });
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

class RepositorioLocal implements Repositorio {
  private clave: CryptoKey | null = null;

  disponible(): boolean {
    return typeof indexedDB !== "undefined";
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

    return {
      id: crudo.id,
      fecha: crudo.fecha,
      ...(JSON.parse(plano) as EntradaHistorial),
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
      formato: "ancia-respaldo-v1",
      exportado: new Date().toISOString(),
      sal: config.sal,
      testigo: config.testigo,
      registros: await this.todosLosCrudos(),
    };
    return new Blob([JSON.stringify(respaldo)], { type: "application/json" });
  }

  async importarRespaldo(contenido: string): Promise<number> {
    const respaldo = JSON.parse(contenido);
    if (respaldo?.formato !== "ancia-respaldo-v1") {
      throw new Error("El archivo no es un respaldo de ANCIA.");
    }

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

      const tx = bd.transaction(ALMACEN_REGISTROS, "readwrite");
      const almacen = tx.objectStore(ALMACEN_REGISTROS);
      for (const registro of respaldo.registros as RegistroCrudo[]) {
        await operacion(almacen.put(registro));
      }
      return respaldo.registros.length;
    } finally {
      bd.close();
    }
  }
}

export const repositorio: Repositorio = new RepositorioLocal();
