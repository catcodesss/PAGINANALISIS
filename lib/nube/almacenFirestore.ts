import {
  collection,
  doc,
  getDoc,
  getDocs,
  runTransaction,
  serverTimestamp,
  setDoc,
  Timestamp,
  type DocumentReference,
  type Firestore,
} from "firebase/firestore";
import { ConflictoDeRevision, DIAS_DE_HISTORIAL, type AlmacenRemoto } from "./almacen";
import type { Boveda } from "../boveda";

/**
 * Implementación de `AlmacenRemoto` sobre Firestore. Las rutas y la forma de
 * cada documento son las que validan las reglas (firestore.rules): cualquier
 * campo de más haría fallar la escritura.
 */

const CLAVE_DISPOSITIVO = "acia-dispositivo-id";

/** Id aleatorio por navegador; no identifica a la persona. */
function dispositivoId(): string {
  try {
    let id = localStorage.getItem(CLAVE_DISPOSITIVO);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(CLAVE_DISPOSITIVO, id);
    }
    return id;
  } catch {
    return "sin-almacenamiento";
  }
}

export function almacenFirestore(bd: Firestore): AlmacenRemoto {
  const ref = (uid: string, ...ruta: string[]) =>
    doc(bd, "usuarios", uid, ...(ruta as [string, ...string[]]));

  /** Escribe con comprobación de revisión: la transacción reintenta si otro la tocó. */
  async function escribirConRev(
    r: DocumentReference,
    revPrevia: number,
    donde: string,
    datos: (rev: number) => Record<string, unknown>
  ): Promise<number> {
    return runTransaction(bd, async (tx) => {
      const actual = await tx.get(r);
      const revActual = actual.exists() ? (actual.data().rev as number) : 0;
      if (revActual !== revPrevia) throw new ConflictoDeRevision(donde);
      const rev = revPrevia + 1;
      tx.set(r, datos(rev));
      return rev;
    });
  }

  return {
    async leerBoveda(uid) {
      const s = await getDoc(ref(uid, "boveda", "principal"));
      return s.exists() ? (s.data() as Boveda) : null;
    },
    async guardarBoveda(uid, boveda) {
      await setDoc(ref(uid, "boveda", "principal"), boveda);
    },

    async listarIndices(uid) {
      const s = await getDocs(collection(bd, "usuarios", uid, "indice"));
      return s.docs.map((d) => ({
        caso_uid: d.id,
        rev: d.data().rev,
        sobre: d.data().sobre,
      }));
    },
    guardarIndice(uid, casoUid, previa, sobre) {
      return escribirConRev(ref(uid, "indice", casoUid), previa, "indice", (rev) => ({
        sobre,
        rev,
        actualizado_en: serverTimestamp(),
        dispositivo_id: dispositivoId(),
      }));
    },

    async leerCabecera(uid, casoUid) {
      const s = await getDoc(ref(uid, "casos", casoUid));
      return s.exists() ? { cc_envuelta: s.data().cc_envuelta, rev: s.data().rev } : null;
    },
    guardarCabecera(uid, casoUid, previa, cc) {
      return escribirConRev(ref(uid, "casos", casoUid), previa, "cabecera", (rev) => ({
        cc_envuelta: cc,
        rev,
        actualizado_en: serverTimestamp(),
        dispositivo_id: dispositivoId(),
      }));
    },

    async listarPartes(uid, casoUid) {
      const s = await getDocs(collection(bd, "usuarios", uid, "casos", casoUid, "partes"));
      return s.docs.map((d) => ({
        parte_id: d.id,
        tipo: d.data().tipo,
        rev: d.data().rev,
        sobre: d.data().sobre,
        hash_ct: d.data().hash_ct,
      }));
    },
    /**
     * Sobrescribe la parte y, en la MISMA transacción, archiva la versión que había
     * en `partes_historial` (30 días; la política TTL sobre `expira_en` la borra).
     * Así un error del cliente no destruye nada: la anterior sigue recuperable.
     */
    guardarParte(uid, casoUid, previa, parte) {
      const r = ref(uid, "casos", casoUid, "partes", parte.parte_id);
      return runTransaction(bd, async (tx) => {
        const actual = await tx.get(r);
        const anterior = actual.exists() ? actual.data() : null;
        if ((anterior?.rev ?? 0) !== previa) throw new ConflictoDeRevision(parte.parte_id);
        if (anterior) {
          tx.set(ref(uid, "casos", casoUid, "partes_historial", `${parte.parte_id}__${anterior.rev}`), {
            parte_id: parte.parte_id,
            sobre: anterior.sobre,
            rev: anterior.rev,
            tipo: anterior.tipo,
            hash_ct: anterior.hash_ct,
            dispositivo_id: dispositivoId(),
            archivado_en: serverTimestamp(),
            expira_en: Timestamp.fromMillis(Date.now() + DIAS_DE_HISTORIAL * 86_400_000),
          });
        }
        const rev = previa + 1;
        tx.set(r, {
          sobre: parte.sobre,
          rev,
          tipo: parte.tipo,
          actualizado_en: serverTimestamp(),
          dispositivo_id: dispositivoId(),
          hash_ct: parte.hash_ct,
        });
        return rev;
      });
    },
    async listarHistorial(uid, casoUid, parteId) {
      const s = await getDocs(collection(bd, "usuarios", uid, "casos", casoUid, "partes_historial"));
      return s.docs
        .filter((d) => d.data().parte_id === parteId)
        .map((d) => ({
          historial_id: d.id,
          parte_id: parteId,
          rev: d.data().rev as number,
          tipo: d.data().tipo,
          sobre: d.data().sobre,
          hash_ct: d.data().hash_ct as string,
        }))
        .sort((a, b) => b.rev - a.rev);
    },
  };
}
