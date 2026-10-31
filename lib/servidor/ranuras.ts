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

/** Fuente de verdad de los topes: lib/planesCasos.ts. `planes/{id}` en Firestore podrá sustituirla. */
import { PLANES, PLAN_POR_DEFECTO, planDe, type PlanCasos } from "../planesCasos";
export { PLANES, PLAN_POR_DEFECTO, type PlanCasos };

export type AccionRanura = "reclamar" | "archivar" | "reactivar" | "eliminar" | "recuperar";
export type EstadoRanura = "activo" | "archivado" | "eliminado";

/** Días que un caso eliminado espera antes del borrado definitivo. */
export const DIAS_PARA_BORRAR = 30;

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

    /*
      Eliminar: el caso sale de la lista y libera su ranura, pero no se borra
      hasta pasados DIAS_PARA_BORRAR (purgarEliminados). Se recuerda cómo estaba
      para que «recuperar» lo devuelva igual.
    */
    if (accion === "eliminar") {
      if (estado === null) throw new ErrorHttp(404, "caso_inexistente", "Ese caso no tiene ranura.");
      if (estado === "eliminado") return resultado("eliminado", activos, false);
      const nuevos = estado === "activo" ? Math.max(0, activos - 1) : activos;
      tx.set(refUsuario, { casos_activos: nuevos, plan_id: usuario.data()?.plan_id ?? plan.id }, { merge: true });
      tx.update(refRanura, { estado: "eliminado", estado_previo: estado, eliminado_en: ahora() });
      return resultado("eliminado", nuevos, true);
    }

    if (accion === "recuperar") {
      if (estado === null) throw new ErrorHttp(404, "caso_inexistente", "Ese caso no tiene ranura.");
      if (estado !== "eliminado") return resultado(estado, activos, false);
      const previo = ranura.data()?.estado_previo === "archivado" ? "archivado" : "activo";
      if (previo === "activo" && activos >= plan.max_casos_activos) {
        throw new ErrorHttp(
          409,
          "tope_de_casos",
          `Tu plan permite ${plan.max_casos_activos} casos activos. Archiva uno para recuperar este.`
        );
      }
      const nuevos = previo === "activo" ? activos + 1 : activos;
      tx.set(refUsuario, { casos_activos: nuevos, plan_id: usuario.data()?.plan_id ?? plan.id }, { merge: true });
      tx.update(refRanura, {
        estado: previo,
        estado_previo: FieldValue.delete(),
        eliminado_en: FieldValue.delete(),
        recuperado_en: FieldValue.serverTimestamp(),
      });
      return resultado(previo, nuevos, true);
    }

    // Un caso eliminado solo sale de ahí con «recuperar».
    if (estado === "eliminado") {
      throw new ErrorHttp(409, "caso_eliminado", "Ese caso está eliminado. Recupéralo para volver a usarlo.");
    }

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

/**
 * Borrado definitivo de un caso ELIMINADO: su cabecera con la clave del caso,
 * todas sus partes y versiones anteriores, su índice y su ranura. Sin la clave
 * del caso, cualquier copia que quedara ya no se puede descifrar.
 * Un caso que no está eliminado no se borra: primero hay que eliminarlo.
 */
export async function borrarCasoEliminado(bd: Firestore, uid: string, casoUid: string): Promise<{ borrado: boolean }> {
  if (!uid) throw new ErrorHttp(401, "sin_sesion", "Inicia sesión para continuar.");
  validarCasoUid(casoUid);
  const refUsuario = bd.collection("usuarios").doc(uid);
  const refRanura = refUsuario.collection("ranuras").doc(casoUid);
  const ranura = await refRanura.get();
  if (!ranura.exists) return { borrado: false };
  if (ranura.data()?.estado !== "eliminado") {
    throw new ErrorHttp(409, "caso_no_eliminado", "Elimina el caso antes de borrarlo definitivamente.");
  }
  await bd.recursiveDelete(refUsuario.collection("casos").doc(casoUid));
  await refUsuario.collection("indice").doc(casoUid).delete();
  await refRanura.delete();
  return { borrado: true };
}

/**
 * Tarea diaria: borra para siempre los casos eliminados hace DIAS_PARA_BORRAR
 * días o más. Recorre usuario por usuario: no necesita índices de grupo.
 * Llamarla antes de tiempo no adelanta nada.
 */
export async function purgarEliminados(
  bd: Firestore,
  ahora: () => Date = () => new Date()
): Promise<{ borrados: number }> {
  const limite = ahora().getTime() - DIAS_PARA_BORRAR * 24 * 60 * 60 * 1000;
  let borrados = 0;
  for (const usuario of await bd.collection("usuarios").listDocuments()) {
    const eliminados = await usuario.collection("ranuras").where("estado", "==", "eliminado").get();
    for (const r of eliminados.docs) {
      const cuando = r.data().eliminado_en as { toMillis?: () => number } | Date | undefined;
      const ms = cuando instanceof Date ? cuando.getTime() : cuando?.toMillis?.();
      if (ms === undefined || ms > limite) continue;
      if ((await borrarCasoEliminado(bd, usuario.id, r.id)).borrado) borrados++;
    }
  }
  return { borrados };
}
