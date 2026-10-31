import type { SobreV2 } from "../cifradoV2";
import type { Boveda, ClaveCasoEnvuelta } from "../boveda";
import type { TipoParte } from "./particion";

/**
 * Lo que el repositorio necesita del almacén remoto. La implementación real usa
 * Firestore (almacenFirestore.ts); la de memoria sirve a las pruebas y reproduce
 * las reglas que importan: revisión + 1 y ranura activa para escribir.
 */

export interface ParteRemota {
  parte_id: string;
  tipo: TipoParte;
  rev: number;
  sobre: SobreV2;
  hash_ct: string;
}

/** Versión anterior de una parte, guardada al sobrescribirla (propuesta §7.3.3). */
export interface HistorialParteRemoto {
  historial_id: string;
  parte_id: string;
  /** Revisión que tenía la parte cuando se archivó: con ella se descifra. */
  rev: number;
  tipo: TipoParte;
  sobre: SobreV2;
  hash_ct: string;
  /** Cuándo se archivó (ISO) y desde qué dispositivo; null si el servidor aún no puso la hora. */
  archivado_en: string | null;
  dispositivo_id: string;
}

/** Días que se conserva una versión anterior; después la borra la política TTL de Firestore. */
export const DIAS_DE_HISTORIAL = 30;

export interface IndiceRemoto {
  caso_uid: string;
  rev: number;
  sobre: SobreV2;
}

export interface CabeceraRemota {
  cc_envuelta: ClaveCasoEnvuelta;
  rev: number;
}

export class ConflictoDeRevision extends Error {
  constructor(public readonly donde: string) {
    super(
      "Este caso cambió en otro dispositivo mientras lo editabas. Recarga el caso para ver la última versión."
    );
    this.name = "ConflictoDeRevision";
  }
}

export interface AlmacenRemoto {
  leerBoveda(uid: string): Promise<Boveda | null>;
  /** Crea (sin `previa`) o reemplaza la bóveda. */
  guardarBoveda(uid: string, boveda: Boveda): Promise<void>;

  listarIndices(uid: string): Promise<IndiceRemoto[]>;
  /** `revPrevia` = revisión que el cliente vio (0 = no existe). Lanza ConflictoDeRevision. */
  guardarIndice(uid: string, casoUid: string, revPrevia: number, sobre: SobreV2): Promise<number>;

  leerCabecera(uid: string, casoUid: string): Promise<CabeceraRemota | null>;
  guardarCabecera(
    uid: string,
    casoUid: string,
    revPrevia: number,
    cc: ClaveCasoEnvuelta
  ): Promise<number>;

  listarPartes(uid: string, casoUid: string): Promise<ParteRemota[]>;
  guardarParte(
    uid: string,
    casoUid: string,
    revPrevia: number,
    parte: Omit<ParteRemota, "rev">
  ): Promise<number>;
  /** Versiones anteriores de una parte, de la más reciente a la más antigua. */
  listarHistorial(uid: string, casoUid: string, parteId: string): Promise<HistorialParteRemoto[]>;
  /** Las versiones anteriores de todas las partes de un caso, de la más reciente a la más antigua. */
  listarHistorialCaso(uid: string, casoUid: string): Promise<HistorialParteRemoto[]>;
}

/** Ranuras de casos en el servidor (fase 13A §1): topes por plan, comprobados en una transacción. */
export interface ServicioRanuras {
  reclamar(casoUid: string): Promise<void>;
  archivar(casoUid: string): Promise<void>;
  reactivar(casoUid: string): Promise<void>;
  /** Libera la ranura; el borrado definitivo llega a los 30 días. */
  eliminar(casoUid: string): Promise<void>;
  /** Devuelve un caso eliminado a como estaba (activo o archivado). */
  recuperar(casoUid: string): Promise<void>;
  /** Borrado definitivo de un caso ya eliminado. */
  borrar(casoUid: string): Promise<void>;
  /** Casos eliminados de esta cuenta y cuándo se eliminaron (ISO). */
  eliminados(): Promise<Map<string, string>>;
}

// --- Memoria (pruebas) ---------------------------------------------------

export function almacenMemoria(opciones: { ranurasActivas?: Set<string> } = {}) {
  const bovedas = new Map<string, Boveda>();
  const indices = new Map<string, IndiceRemoto>();
  const cabeceras = new Map<string, CabeceraRemota>();
  const partes = new Map<string, ParteRemota>();
  const historial = new Map<string, HistorialParteRemoto>();
  const k = (...p: string[]) => p.join("/");
  const exigirRanura = (casoUid: string) => {
    if (opciones.ranurasActivas && !opciones.ranurasActivas.has(casoUid)) {
      throw new Error("PERMISSION_DENIED: ranura no activa");
    }
  };
  const comprobar = (actual: number | undefined, previa: number, donde: string) => {
    if ((actual ?? 0) !== previa) throw new ConflictoDeRevision(donde);
    return previa + 1;
  };

  const almacen: AlmacenRemoto & { _partes: Map<string, ParteRemota> } = {
    _partes: partes,
    async leerBoveda(uid) {
      return bovedas.get(uid) ?? null;
    },
    async guardarBoveda(uid, b) {
      bovedas.set(uid, structuredClone(b));
    },
    async listarIndices(uid) {
      return [...indices.entries()].filter(([c]) => c.startsWith(`${uid}/`)).map(([, v]) => structuredClone(v));
    },
    async guardarIndice(uid, casoUid, previa, sobre) {
      const rev = comprobar(indices.get(k(uid, casoUid))?.rev, previa, "indice");
      indices.set(k(uid, casoUid), { caso_uid: casoUid, rev, sobre: structuredClone(sobre) });
      return rev;
    },
    async leerCabecera(uid, casoUid) {
      return structuredClone(cabeceras.get(k(uid, casoUid)) ?? null);
    },
    async guardarCabecera(uid, casoUid, previa, cc) {
      exigirRanura(casoUid);
      const rev = comprobar(cabeceras.get(k(uid, casoUid))?.rev, previa, "cabecera");
      cabeceras.set(k(uid, casoUid), { cc_envuelta: structuredClone(cc), rev });
      return rev;
    },
    async listarPartes(uid, casoUid) {
      return [...partes.entries()]
        .filter(([c]) => c.startsWith(`${uid}/${casoUid}/`))
        .map(([, v]) => structuredClone(v));
    },
    async guardarParte(uid, casoUid, previa, parte) {
      exigirRanura(casoUid);
      const actual = partes.get(k(uid, casoUid, parte.parte_id));
      const rev = comprobar(actual?.rev, previa, parte.parte_id);
      if (actual) {
        const historial_id = `${actual.parte_id}__${actual.rev}`;
        historial.set(k(uid, casoUid, historial_id), {
          historial_id,
          parte_id: actual.parte_id,
          rev: actual.rev,
          tipo: actual.tipo,
          sobre: structuredClone(actual.sobre),
          hash_ct: actual.hash_ct,
          archivado_en: new Date().toISOString(),
          dispositivo_id: "memoria",
        });
      }
      partes.set(k(uid, casoUid, parte.parte_id), { ...structuredClone(parte), rev });
      return rev;
    },
    async listarHistorialCaso(uid, casoUid) {
      return [...historial.entries()]
        .filter(([c]) => c.startsWith(`${uid}/${casoUid}/`))
        .map(([, v]) => structuredClone(v))
        .sort((a, b) => b.rev - a.rev);
    },
    async listarHistorial(uid, casoUid, parteId) {
      return (await almacen.listarHistorialCaso(uid, casoUid)).filter((h) => h.parte_id === parteId);
    },
  };
  return almacen;
}
