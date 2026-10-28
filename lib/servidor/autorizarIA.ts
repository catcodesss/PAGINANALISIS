import type { Firestore } from "firebase-admin/firestore";
import { autenticar, ErrorHttp, type VerificadorToken } from "./autenticar";
import { validarCasoUid } from "./ranuras";

/**
 * Quién puede llamar a las rutas de IA (fase 13, etapa 7).
 *
 * Con cuentas configuradas, cada petición lleva el ID Token de Firebase: el uid
 * sale de ahí, nunca del cuerpo. Si además trae un `caso_uid`, tiene que ser una
 * ranura ACTIVA de ese mismo usuario. Esta capa no lee ni guarda contenido clínico.
 *
 * Sin cuentas configuradas (modo local sin Firebase) las rutas siguen abiertas,
 * como antes, protegidas solo por el límite de peticiones.
 */

export interface DependenciasAutorizacion {
  verificar: VerificadorToken;
  bd: () => Firestore;
}

export interface Llamada {
  /** `null` solo cuando no se exige sesión. */
  uid: string | null;
  /**
   * Valida el `caso_uid` del cuerpo. Devuelve el id limpio, o `null` si no vino y
   * no era obligatorio. Con sesión, comprueba que la ranura sea de este usuario y esté activa.
   */
  comprobarCaso(casoUid: unknown, obligatorio: boolean): Promise<string | null>;
}

export function sesionExigida(env: NodeJS.ProcessEnv = process.env): boolean {
  // Atajo solo para las evals en local; en producción no se respeta.
  if (env.NODE_ENV !== "production" && env.ACIA_SIN_SESION_IA === "1") return false;
  return Boolean(env.NEXT_PUBLIC_FIREBASE_PROJECT_ID);
}

/** Con la nube activada, las rutas ligadas a un caso exigen su `caso_uid`. */
export function casoObligatorio(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.NEXT_PUBLIC_ACIA_NUBE === "1";
}

export async function identificarLlamada(
  peticion: Request,
  deps: DependenciasAutorizacion,
  exigirSesion: boolean = sesionExigida()
): Promise<Llamada> {
  const uid = exigirSesion ? (await autenticar(peticion, deps.verificar)).uid : null;

  return {
    uid,
    async comprobarCaso(casoUid, obligatorio) {
      if (casoUid === undefined || casoUid === null) {
        if (obligatorio) throw new ErrorHttp(400, "caso_requerido", "Falta el identificador del caso.");
        return null;
      }
      const id = validarCasoUid(casoUid);
      if (uid === null) return id;

      const ranura = await deps.bd().collection("usuarios").doc(uid).collection("ranuras").doc(id).get();
      if (!ranura.exists) {
        throw new ErrorHttp(403, "caso_ajeno", "Ese caso no está en tu cuenta.");
      }
      if (ranura.data()?.estado !== "activo") {
        throw new ErrorHttp(409, "caso_archivado", "Ese caso está archivado. Reactívalo para usar la IA.");
      }
      return id;
    },
  };
}

const OPERACION_ID_RE = /^[A-Za-z0-9_-]{8,80}$/;

/** Identifica un intento para que un reintento no se cobre dos veces (cobro: etapa 9). */
export function validarOperacionId(valor: unknown): string | null {
  if (valor === undefined || valor === null) return null;
  if (typeof valor !== "string" || !OPERACION_ID_RE.test(valor)) {
    throw new ErrorHttp(400, "operacion_invalida", "Identificador de operación no válido.");
  }
  return valor;
}

export function respuestaDeErrorHttp(error: unknown): Response | null {
  if (!(error instanceof ErrorHttp)) return null;
  return new Response(JSON.stringify({ error: error.codigo, message: error.message }), {
    status: error.estado,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}
