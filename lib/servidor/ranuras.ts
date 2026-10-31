import type { Firestore } from "firebase-admin/firestore";
import { FieldValue } from "firebase-admin/firestore";
import { ErrorHttp } from "./autenticar";

/**
 * Ranuras de casos (fase 13A §1). El servidor solo sabe de cada caso: su
 * `caso_uid` opaco, si está activo o archivado y cuándo. Nunca ve alias, motivo
 * ni contenido, y no tiene claves para descifrarlos.
 *
 *   usuarios/{uid}                 plan_id, casos_activos (contador)
 *   usuarios/{uid}/ranuras/{caso}  estado "activo" | "archivado", fechas
 *
 * Todo cambio es UNA transacción que lee el contador y la ranura, comprueba el
 * tope y escribe las dos. Firestore reintenta la transacción si otra tocó
 * el mismo documento, así que dos dispositivos a la vez no pueden pasarse del tope.
 *
 * Reglas de negocio (aprobadas):
 *  - «En pausa» sigue ocupando ranura: el servidor solo distingue activo/archivado.
 *  - Nada se archiva ni se elimina solo. Sin Coins, o tras bajar de plan, los casos
 *    activos siguen activos y legibles; solo se impide reclamar/reactivar otro.
 *  - Los casos archivados siguen siendo legibles y exportables (reglas de cliente).
 *  - Repetir una operación no cambia nada (idempotente).
 */

export interface PlanCasos {
  id: string;
  max_casos_activos: number;
}

/** Fuente de verdad de los topes. `planes/{id}` en Firestore podrá sustituirla más adelante. */
export const PLANES: Record<string, PlanCasos> = {
  gratuito: { id: "gratuito", max_casos_activos: 3 },
  profesional: { id: "profesional", max_casos_activos: 15 },
  intensivo: { id: "intensivo", max_casos_activos: 50 },
};
export const PLAN_POR_DEFECTO = "gratuito";

export type AccionRanura = "reclamar" | "archivar" | "reactivar";
export type EstadoRanura = "activo" | "archivado";

export interface ResultadoRanura {
  caso_uid: string;
  estado: EstadoRanura;
  casos_activos: number;
  max_casos_activos: number;
  /** Falso si la operación ya estaba hecha (repetición). */
  cambio: boolean;
}

const CASO_UID_RE = /^[A-Za-z0-9_-]{8,80}$/;

export function validarCasoUid(valor: unknown): string {
  if (typeof valor !== "string" || !CASO_UID_RE.test(valor)) {
    throw new ErrorHttp(400, "caso_invalido", "Identificador de caso no válido.");
  }
  return valor;
}

function planDe(id: unknown): PlanCasos {
  return (typeof id === "string" && PLANES[id]) || PLANES[PLAN_POR_DEFECTO];
}

export async function cambiarRanura(
  bd: Firestore,
  uid: string,
  casoUid: string,
  accion: AccionRanura,
  ahora: () => Date = () => new Date()
): Promise<ResultadoRanura> {
  if (!uid) throw new ErrorHttp(401, "sin_sesion", "Inicia sesión para continuar.");
  validarCasoUid(casoUid);

  const refUsuario = bd.collection("usuarios").doc(uid);
  const refRanura = refUsuario.collection("ranuras").doc(casoUid);

  return bd.runTransaction(async (tx) => {
    // En Firestore todas las lecturas van antes de las escrituras.
    const [usuario, ranura] = await Promise.all([tx.get(refUsuario), tx.get(refRanura)]);
    const plan = planDe(usuario.data()?.plan_id);
    const activos = Number(usuario.data()?.casos_activos ?? 0);
    const estado = ranura.exists ? (ranura.data()?.estado as EstadoRanura) : null;

    const resultado = (e: EstadoRanura, n: number, cambio: boolean): ResultadoRanura => ({
      caso_uid: casoUid,
      estado: e,
      casos_activos: n,
      max_casos_activos: plan.max_casos_activos,
      cambio,
    });

    if (accion === "archivar") {
      if (estado === null) throw new ErrorHttp(404, "caso_inexistente", "Ese caso no tiene ranura.");
      if (estado === "archivado") return resultado("archivado", activos, false);
      const nuevos = Math.max(0, activos - 1);
      tx.set(refUsuario, { casos_activos: nuevos, plan_id: usuario.data()?.plan_id ?? plan.id }, { merge: true });
      tx.update(refRanura, { estado: "archivado", archivado_en: FieldValue.serverTimestamp() });
      return resultado("archivado", nuevos, true);
    }

    // reclamar y reactivar ocupan una ranura activa
    if (estado === "activo") return resultado("activo", activos, false);
    if (accion === "reactivar" && estado === null) {
      throw new ErrorHttp(404, "caso_inexistente", "Ese caso no tiene ranura.");
    }
    if (accion === "reclamar" && estado === "archivado") {
      throw new ErrorHttp(409, "caso_archivado", "Ese caso está archivado. Reactívalo para volver a usarlo.");
    }
    if (activos >= plan.max_casos_activos) {
      throw new ErrorHttp(
        409,
        "tope_de_casos",
        `Tu plan permite ${plan.max_casos_activos} casos activos. Archiva uno o mejora el plan.`
      );
    }
    const nuevos = activos + 1;
    tx.set(refUsuario, { casos_activos: nuevos, plan_id: usuario.data()?.plan_id ?? plan.id }, { merge: true });
    if (estado === null) {
      tx.set(refRanura, { estado: "activo", activado_en: ahora(), ultima_ia_en: null });
    } else {
      tx.update(refRanura, { estado: "activo", reactivado_en: FieldValue.serverTimestamp() });
    }
    return resultado("activo", nuevos, true);
  });
}
