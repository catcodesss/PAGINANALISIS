import type { Firestore } from "firebase-admin/firestore";
import { autenticar, ErrorHttp, type VerificadorToken } from "./autenticar";
import { validarPerfil } from "../perfil";

/**
 * Lógica HTTP de POST /api/perfil: guarda nombre, fecha de nacimiento y país en
 * `usuarios/{uid}` (mundo administrativo: el cliente no escribe, solo el Admin
 * SDK). El uid sale del ID Token verificado, nunca del cuerpo. Un invitado no
 * tiene perfil: `autenticar` lo rechaza.
 */

export interface DependenciasPerfil {
  verificar: VerificadorToken;
  bd: () => Firestore;
}

function json(cuerpo: unknown, estado = 200): Response {
  return new Response(JSON.stringify(cuerpo), {
    status: estado,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

export async function manejarPerfil(peticion: Request, deps: DependenciasPerfil): Promise<Response> {
  try {
    const { uid } = await autenticar(peticion, deps.verificar);

    let cuerpo: unknown;
    try {
      cuerpo = await peticion.json();
    } catch {
      throw new ErrorHttp(400, "cuerpo_invalido", "Petición no válida.");
    }
    const r = validarPerfil(cuerpo);
    if ("error" in r) throw new ErrorHttp(400, "perfil_invalido", r.error);

    await deps
      .bd()
      .collection("usuarios")
      .doc(uid)
      .set({ perfil: r.perfil, perfil_actualizado: new Date().toISOString() }, { merge: true });
    return json({ ok: true });
  } catch (error) {
    if (error instanceof ErrorHttp) {
      return json({ error: error.codigo, message: error.message }, error.estado);
    }
    // Nunca se registra el cuerpo ni el uid: solo el nombre del error.
    console.error("Error en /api/perfil:", error instanceof Error ? error.name : "desconocido");
    return json({ error: "error_interno", message: "No se pudo guardar tu perfil." }, 500);
  }
}
