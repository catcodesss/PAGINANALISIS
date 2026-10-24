import { authAdmin, firestoreAdmin } from "@/lib/servidor/admin";
import { manejarRanuras } from "@/lib/servidor/ranurasHttp";

export const runtime = "nodejs";

/**
 * Ranuras de casos: reclamar, archivar y reactivar (fase 13A §1).
 * Usa el Admin SDK, que no está sujeto a las reglas de Firestore: la identidad se
 * valida aquí con el ID Token y el tope del plan se aplica en una transacción.
 */
export async function POST(peticion: Request) {
  return manejarRanuras(peticion, {
    verificar: (token, revocados) => authAdmin().verifyIdToken(token, revocados),
    bd: firestoreAdmin,
  });
}
