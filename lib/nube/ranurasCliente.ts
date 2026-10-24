import { autenticacion } from "../firebaseCliente";
import type { ServicioRanuras } from "./almacen";

/** Cliente de POST /api/ranuras. Envía el ID Token; el servidor decide el uid. */
async function llamar(accion: "reclamar" | "archivar" | "reactivar", casoUid: string): Promise<void> {
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

export const ranurasDelServidor: ServicioRanuras = {
  reclamar: (c) => llamar("reclamar", c),
  archivar: (c) => llamar("archivar", c),
  reactivar: (c) => llamar("reactivar", c),
};
