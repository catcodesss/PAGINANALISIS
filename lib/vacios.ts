import { camposParaBloques, type CampoAnalisis } from "./bloques";
import { CAMPOS_ANALISIS_FUNCIONAL, type AnalisisFuncional } from "./types";

/**
 * Por qué un apartado del informe está vacío. Antes los tres casos posibles
 * se pintaban con la misma frase, «Sin hallazgos suficientes en la nota», y en
 * el caso de ejemplo eso decía que la nota no hablaba de valores ni de
 * reforzadores perdidos cuando sí hablaba del ascenso y del baile: el error
 * inverso al de una cita inventada (mesa-clínica §A.6).
 *
 * - `no_generado`: el bloque no se pidió, o el informe es anterior al campo
 *   (la respuesta no traía la clave). No hay nada que leer en ese vacío.
 * - `sin_hallazgos`: se generó y salió vacío. La IA no encontró nada, que no es
 *   lo mismo que que no esté en la nota.
 *
 * El tercer estado —la nota no lo contiene— no existe: nada lo comprueba, y un
 * texto que lo afirmara sería una conclusión sin base.
 */
export type EstadoVacio = "no_generado" | "sin_hallazgos";

export const TEXTO_VACIO: Record<EstadoVacio, string> = {
  no_generado: "Este análisis no incluye este apartado.",
  sin_hallazgos: "El análisis no recoge ninguno. Revisa la nota: puede haberlo.",
};

/** Riesgo no evaluado: nunca se lee como «no hay riesgo». */
export const TEXTO_RIESGO_NO_EVALUADO = "El análisis no evaluó el riesgo. No significa que no lo haya.";
export const TEXTO_RIESGO_SIN_INDICADORES =
  "El análisis evaluó el riesgo y no recoge indicadores. Revisa la nota: puede haberlos.";

export function estadoVacio(analisis: AnalisisFuncional, campo: CampoAnalisis): EstadoVacio {
  if (analisis.campos_ausentes.includes(campo)) return "no_generado";
  if (
    analisis.campos_generados.length > 0 &&
    !camposParaBloques(analisis.campos_generados, CAMPOS_ANALISIS_FUNCIONAL).includes(campo)
  ) {
    return "no_generado";
  }
  return "sin_hallazgos";
}

/**
 * Tras reanalizar una sección, lo que el fragmento trae ya se generó: deja de
 * contar como ausente aunque vuelva vacío.
 */
export function ausentesTrasReanalisis(
  analisis: AnalisisFuncional,
  fragmento: Partial<AnalisisFuncional>
): string[] {
  return analisis.campos_ausentes.filter((campo) => !(campo in fragmento));
}
