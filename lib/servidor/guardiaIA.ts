import { authAdmin, firestoreAdmin } from "./admin";
import {
  casoObligatorio,
  identificarLlamada,
  respuestaDeErrorHttp,
  validarOperacionId,
  type Llamada,
} from "./autorizarIA";

/**
 * Atajo para las rutas de IA: conecta autorizarIA con Firebase Admin.
 * `identificar` va antes de leer el cuerpo; `comprobar` después, con su `caso_uid`.
 * Si algo falla devuelve la Response de error lista para devolver; si no, `null`.
 */

export async function identificar(
  peticion: Request
): Promise<{ llamada: Llamada; error: null } | { llamada: null; error: Response }> {
  try {
    const llamada = await identificarLlamada(peticion, {
      verificar: (token, revocados) => authAdmin().verifyIdToken(token, revocados),
      bd: firestoreAdmin,
    });
    return { llamada, error: null };
  } catch (e) {
    return { llamada: null, error: errorDe(e) };
  }
}

/** `ligadaACaso`: la ruta opera sobre un caso y, con la nube activa, exige su `caso_uid`. */
export async function comprobar(
  llamada: Llamada,
  cuerpo: unknown,
  ligadaACaso: boolean
): Promise<Response | null> {
  const datos = (cuerpo ?? {}) as { caso_uid?: unknown; operacion_id?: unknown };
  try {
    await llamada.comprobarCaso(datos.caso_uid, ligadaACaso && casoObligatorio());
    validarOperacionId(datos.operacion_id);
    return null;
  } catch (e) {
    return errorDe(e);
  }
}

function errorDe(e: unknown): Response {
  const respuesta = respuestaDeErrorHttp(e);
  if (respuesta) return respuesta;
  // Solo el nombre del error: nunca el cuerpo ni el uid.
  console.error("Error de autorización de IA:", e instanceof Error ? e.name : "desconocido");
  return new Response(
    JSON.stringify({ error: "error_interno", message: "No se pudo verificar tu sesión." }),
    { status: 500, headers: { "content-type": "application/json", "cache-control": "no-store" } }
  );
}
