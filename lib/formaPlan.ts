/**
 * La forma de las intervenciones y de la monitorización, nueva y antigua.
 *
 * Hasta el prompt 1.7.0 `lineas_de_intervencion_tentativas` era `string[]` y
 * `plan_de_monitorizacion` un solo objeto (o null). Desde entonces cada entrada
 * nombra su blanco. Estas dos funciones aceptan las dos formas y devuelven
 * siempre la nueva; las usan el normalizador de la respuesta del modelo
 * (lib/parseAnalisis.ts) y el migrador de los informes guardados
 * (lib/identidad.ts#migrarAV2), que es lo único que pasa un informe del
 * historial al abrirlo.
 *
 * Viven aparte y sin dependencias porque parseAnalisis ya importa identidad:
 * ponerlas en cualquiera de los dos obligaría al otro a importarlo de vuelta.
 *
 * LO ANTIGUO NO SE ASIGNA. Una intervención vieja entra con `conducta: ""` y
 * `conducta_id: null`. Deducir su blanco por las palabras de la intervención
 * sería el emparejamiento por prosa que el esquema v2 retiró; aparece en
 * «Intervenciones sin blanco» y el clínico la coloca si quiere.
 */

import type { LineaIntervencion, PlanDeMonitorizacion } from "./types";

const texto = (v: unknown): string => (typeof v === "string" ? v : "");
const id = (v: unknown): string | null => (typeof v === "string" && v.length > 0 ? v : null);
const objeto = (v: unknown): Record<string, unknown> | null =>
  typeof v === "object" && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : null;

export function normalizarLineasIntervencion(valor: unknown): LineaIntervencion[] {
  if (!Array.isArray(valor)) return [];
  return valor.flatMap((v): LineaIntervencion[] => {
    if (typeof v === "string") {
      return v.trim()
        ? [{ conducta: "", conducta_id: null, intervencion: v, porque: "", depende_de: null }]
        : [];
    }
    const d = objeto(v);
    if (!d) return [];
    const depende = texto(d.depende_de).trim();
    const linea: LineaIntervencion = {
      conducta: texto(d.conducta),
      conducta_id: id(d.conducta_id),
      intervencion: texto(d.intervencion),
      porque: texto(d.porque),
      depende_de: depende || null,
    };
    // Sin intervención solo vale si dice de qué dato depende: es la forma de
    // declarar «no hay base para proponer nada todavía». Sin eso es un hueco.
    return linea.intervencion.trim() || linea.depende_de ? [linea] : [];
  });
}

function normalizarUnPlan(valor: unknown): PlanDeMonitorizacion | null {
  const d = objeto(valor);
  if (!d) return null;
  const plan: PlanDeMonitorizacion = {
    conducta: texto(d.conducta),
    conducta_id: id(d.conducta_id),
    que_se_mide: texto(d.que_se_mide),
    con_que: texto(d.con_que),
    cada_cuanto: texto(d.cada_cuanto),
    criterio_de_revision: texto(d.criterio_de_revision),
  };
  // Un objeto entero vacío es lo mismo que no haber plan.
  const conContenido = [plan.que_se_mide, plan.con_que, plan.cada_cuanto, plan.criterio_de_revision]
    .some((v) => v.trim().length > 0);
  return conContenido ? plan : null;
}

export function normalizarPlanesMonitorizacion(valor: unknown): PlanDeMonitorizacion[] {
  const lista = Array.isArray(valor) ? valor : [valor];
  return lista.map(normalizarUnPlan).filter((p): p is PlanDeMonitorizacion => p !== null);
}
