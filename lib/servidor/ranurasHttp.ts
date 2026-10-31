import type { Firestore } from "firebase-admin/firestore";
import { autenticar, ErrorHttp, type VerificadorToken } from "./autenticar";
import { borrarCasoEliminado, cambiarRanura, validarCasoUid, type AccionRanura } from "./ranuras";

/**
 * Lógica HTTP de POST /api/ranuras, separada de la ruta para poder probarla sin
 * Next. Cuerpo: { accion: "reclamar" | "archivar" | "reactivar" | "eliminar" | "recuperar" | "borrar", caso_uid }.
 * El uid sale del ID Token verificado; si el cuerpo trae uno, se ignora.
 */

/** «borrar» es el borrado definitivo; solo vale para un caso ya eliminado. */
const ACCIONES: readonly (AccionRanura | "borrar")[] = ["reclamar", "archivar", "reactivar", "eliminar", "recuperar", "borrar"];

export interface DependenciasRanuras {
  verificar: VerificadorToken;
  bd: () => Firestore;
}

function json(cuerpo: unknown, estado = 200): Response {
  return new Response(JSON.stringify(cuerpo), {
    status: estado,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

export async function manejarRanuras(peticion: Request, deps: DependenciasRanuras): Promise<Response> {
  try {
    const { uid } = await autenticar(peticion, deps.verificar);

    let cuerpo: { accion?: unknown; caso_uid?: unknown };
    try {
      cuerpo = await peticion.json();
    } catch {
      throw new ErrorHttp(400, "cuerpo_invalido", "Petición no válida.");
    }
    if (!ACCIONES.includes(cuerpo.accion as AccionRanura | "borrar")) {
      throw new ErrorHttp(400, "accion_invalida", "Acción no válida.");
    }
    const casoUid = validarCasoUid(cuerpo.caso_uid);

    if (cuerpo.accion === "borrar") {
      return json(await borrarCasoEliminado(deps.bd(), uid, casoUid));
    }
    const resultado = await cambiarRanura(deps.bd(), uid, casoUid, cuerpo.accion as AccionRanura);
    return json(resultado);
  } catch (error) {
    if (error instanceof ErrorHttp) {
      return json({ error: error.codigo, message: error.message }, error.estado);
    }
    // Nunca se registra el cuerpo ni el uid: solo el nombre del error.
    console.error("Error en /api/ranuras:", error instanceof Error ? error.name : "desconocido");
    return json({ error: "error_interno", message: "No se pudo completar la operación." }, 500);
  }
}
