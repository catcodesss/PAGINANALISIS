import { authAdmin, firestoreAdmin } from "@/lib/servidor/admin";
import { manejarPerfil } from "@/lib/servidor/perfilHttp";

export const runtime = "nodejs";

/** Perfil básico de la cuenta (nombre, fecha de nacimiento, país). Escribe el Admin SDK. */
export async function POST(peticion: Request) {
  return manejarPerfil(peticion, {
    verificar: (token, revocados) => authAdmin().verifyIdToken(token, revocados),
    bd: firestoreAdmin,
  });
}
