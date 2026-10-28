import { autenticacion, cuentasActivadas, nubeActivada } from "../firebaseCliente";

/**
 * Cabeceras de las llamadas a las rutas de IA (fase 13, etapa 7). Con cuentas
 * activadas lleva el ID Token: el servidor saca de ahí quién eres. Sin cuentas,
 * va como antes.
 */
export async function cabecerasIA(): Promise<Record<string, string>> {
  const cabeceras: Record<string, string> = { "Content-Type": "application/json" };
  if (!cuentasActivadas()) return cabeceras;
  const usuario = autenticacion().currentUser;
  if (!usuario) throw new Error("Inicia sesión para usar el análisis.");
  cabeceras.authorization = `Bearer ${await usuario.getIdToken()}`;
  return cabeceras;
}

/** Identifica este intento; un reintento con el mismo id no se cobrará dos veces (etapa 9). */
export function nuevaOperacionId(): string {
  return crypto.randomUUID();
}

/** Solo con la nube activada las rutas ligadas a un caso comprueban su ranura. */
export function casoParaIA(casoUid: string | undefined): { caso_uid?: string } {
  return nubeActivada() && casoUid ? { caso_uid: casoUid } : {};
}
