/**
 * Los procesos ACT como anotaciones funcionales sobre el grafo (esquema v3).
 *
 * Un proceso ya no es una etiqueta suelta enganchada a una situación entera:
 * se ancla a UN elemento del análisis funcional (`nodo_id`) y dice qué lo
 * controla (`justificacion_funcional`). La misma topografía —un pensamiento
 * negativo, ir al baño— puede cumplir funciones distintas en dos personas, así
 * que sin justificación funcional la etiqueta no dice nada.
 *
 * Sin dependencias del resto de lib/ más allá de los tipos y de citas: lo usan
 * el normalizador, el migrador, la interfaz y la exportación.
 */

import { normalizarTexto } from "./citas";
import type { Id, ProcesoACT, TipoProcesoACT } from "./types";

export const TIPOS_PROCESO_ACT: readonly TipoProcesoACT[] = [
  "fusion",
  "evitacion_experiencial",
  "presente",
  "yo_conceptualizado",
  "valores",
  "accion",
];

/** Nombre del polo de inflexibilidad, tal como lo lee el clínico. */
export const ETIQUETA_PROCESO_ACT: Record<TipoProcesoACT, string> = {
  fusion: "Fusión",
  evitacion_experiencial: "Evitación experiencial",
  presente: "Pérdida de contacto con el presente",
  yo_conceptualizado: "Apego al yo conceptualizado",
  valores: "Falta de claridad de valores",
  accion: "Inacción o impulsividad",
};

/**
 * Del texto libre de la v2 («Fusión cognitiva», «Inacción o impulsividad»…)
 * al enum. Por palabras clave y no por parecido difuso: son seis nombres
 * conocidos del hexaflex, y un emparejamiento aproximado podría convertir
 * «evitación social» en evitación experiencial, que es justo la confusión de
 * topografía con función que la v3 retira.
 */
export function procesoDesdeTexto(texto: string): TipoProcesoACT | null {
  const t = normalizarTexto(texto).replace(/_/g, " ");
  if ((TIPOS_PROCESO_ACT as readonly string[]).includes(t.replace(/ /g, "_"))) {
    return t.replace(/ /g, "_") as TipoProcesoACT;
  }
  if (/\bfusion/.test(t)) return "fusion";
  if (/evitacion experiencial|experiencial/.test(t)) return "evitacion_experiencial";
  if (/presente|contacto con el momento/.test(t)) return "presente";
  if (/\byo\b|conceptualizad|\bself\b/.test(t)) return "yo_conceptualizado";
  if (/valor/.test(t)) return "valores";
  if (/accion|impulsiv|compromet/.test(t)) return "accion";
  return null;
}

/**
 * Lo que no casa con ningún proceso se conserva y se marca para revisar. El
 * valor por defecto es «fusión» a propósito: la vista Matrix clasifica como
 * alejamiento una conducta con evitación experiencial, así que caer por
 * defecto en ella afirmaría una función que nadie ha establecido.
 */
const PROCESO_POR_DEFECTO: TipoProcesoACT = "fusion";

function texto(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function idONulo(v: unknown): Id | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}

/**
 * Lleva un proceso de cualquier forma (v2 o v3, del modelo o del historial) a
 * la forma v3, sin la cita: quien llama la resuelve (el normalizador desde la
 * nota) o la conserva (el migrador, que ya la tiene resuelta).
 *
 * De la v2: `vinculo_con_cadena` pasa a `elemento_objetivo`; `eslabon_id`, si
 * lo había, pasa a `nodo_id` (un eslabón es un nodo del grafo); `situacion_id`
 * se descarta como ancla, porque un proceso se engancha a un elemento y no a
 * una situación entera.
 */
export function procesoAV3(
  crudo: Record<string, unknown>
): Omit<ProcesoACT, "evidencia"> {
  const original = texto(crudo.proceso).trim();
  const casado = procesoDesdeTexto(original);
  const justificacion = texto(crudo.justificacion_funcional).trim();
  const salida: Omit<ProcesoACT, "evidencia"> = {
    id: texto(crudo.id),
    proceso: casado ?? PROCESO_POR_DEFECTO,
    elemento_objetivo: texto(crudo.elemento_objetivo) || texto(crudo.vinculo_con_cadena),
    nodo_id: idONulo(crudo.nodo_id) ?? idONulo(crudo.eslabon_id),
    justificacion_funcional: justificacion,
  };
  if (!casado || crudo.revisar_proceso === true) {
    salida.revisar_proceso = true;
    // El texto original no se pierde: queda donde el clínico lo va a leer.
    if (!casado && original) {
      salida.justificacion_funcional = justificacion
        ? `${justificacion} (Proceso indicado originalmente: «${original}».)`
        : `Proceso indicado originalmente: «${original}».`;
    }
  }
  return salida;
}

/** ¿Tiene ya la forma v3? Sirve para no reconvertir lo que ya lo está. */
export function esProcesoV3(crudo: Record<string, unknown>): boolean {
  return (
    (TIPOS_PROCESO_ACT as readonly unknown[]).includes(crudo.proceso) &&
    "elemento_objetivo" in crudo &&
    !("vinculo_con_cadena" in crudo)
  );
}

/**
 * ¿Cuenta como base funcional? Solo un proceso con justificación declarada y
 * que no esté pendiente de revisar. Un proceso migrado de la v2 no la tiene:
 * se enseña, pero no sirve para clasificar nada.
 */
export function tieneBaseFuncional(p: Pick<ProcesoACT, "justificacion_funcional" | "revisar_proceso">): boolean {
  return p.justificacion_funcional.trim().length > 0 && !p.revisar_proceso;
}

