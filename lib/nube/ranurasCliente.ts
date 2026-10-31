import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import { autenticacion, firestore } from "../firebaseCliente";
import type { ServicioRanuras } from "./almacen";

type Accion = "reclamar" | "archivar" | "reactivar" | "eliminar" | "recuperar" | "borrar";

/** Cliente de POST /api/ranuras. Envía el ID Token; el servidor decide el uid. */
async function llamar(accion: Accion, casoUid: string): Promise<void> {
  const usuario = autenticacion().currentUser;
  if (!usuario) throw new Error("Inicia sesión para gestionar tus casos.");
  const token = await usuario.getIdToken();

  const r = await fetch("/api/ranuras", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify({ accion, caso_uid: casoUid }),
  });
  if (!r.ok) {
    const cuerpo = (await r.json().catch(() => null)) as { message?: string } | null;
    throw new Error(cuerpo?.message ?? "No se pudo actualizar la ranura del caso.");
  }
}

/** Las ranuras eliminadas se leen directo: las reglas dejan al dueño leerlas. */
async function eliminados(): Promise<Map<string, string>> {
  const usuario = autenticacion().currentUser;
  if (!usuario) return new Map();
  const consulta = query(
    collection(firestore(), "usuarios", usuario.uid, "ranuras"),
    where("estado", "==", "eliminado")
  );
  const mapa = new Map<string, string>();
  for (const d of (await getDocs(consulta)).docs) {
    const cuando = d.data().eliminado_en as { toDate?: () => Date } | undefined;
    mapa.set(d.id, (cuando?.toDate?.() ?? new Date()).toISOString());
  }
  return mapa;
}

export const ranurasDelServidor: ServicioRanuras = {
  reclamar: (c) => llamar("reclamar", c),
  archivar: (c) => llamar("archivar", c),
  reactivar: (c) => llamar("reactivar", c),
  eliminar: (c) => llamar("eliminar", c),
  recuperar: (c) => llamar("recuperar", c),
  borrar: (c) => llamar("borrar", c),
  eliminados,
};

/** Plan y casos activos de la cuenta, para mostrarlos. El tope lo hace cumplir el servidor. */
export async function leerPlanCasos(): Promise<{ plan_id: string; casos_activos: number } | null> {
  const usuario = autenticacion().currentUser;
  if (!usuario) return null;
  const d = await getDoc(doc(firestore(), "usuarios", usuario.uid));
  return {
    plan_id: typeof d.data()?.plan_id === "string" ? d.data()!.plan_id : "gratuito",
    casos_activos: Number(d.data()?.casos_activos ?? 0),
  };
}
