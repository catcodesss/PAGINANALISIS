/**
 * Las secciones del informe: una sola lista, y de ella salen todas las demás.
 *
 * Por qué existe: los mismos quince identificadores estaban escritos cuatro
 * veces —el índice de la interfaz, el orden por defecto del informe exportado,
 * los títulos del informe copiado y el mapa de qué bloque hace falta para cada
 * sección— sin nada que los comparase. Cualquiera de esas listas podía quedarse
 * atrás al añadir o renombrar una sección, y el fallo no da error: da un bloque
 * que no se imprime, un título que dice otra cosa, o un aviso que señala una
 * sección inexistente. Ninguna prueba lo habría visto.
 *
 * `IdSeccion` sale de la propia lista, así que un identificador mal escrito en
 * cualquiera de los sitios que la usan es un error de compilación, no un fallo
 * en tiempo de ejecución. Es la misma idea que `CAMPOS_ANALISIS_FUNCIONAL` en
 * lib/types.ts: que el compilador vigile lo que ningún test mira.
 *
 * El orden de esta lista ES el orden de fábrica del informe. Cambiarlo cambia
 * cómo se lee un informe recién generado; el clínico puede reordenarlo después
 * (ver components/ordenBloques.tsx).
 */

export const SECCIONES_INFORME = [
  { id: "datos-faltantes", titulo: "Datos faltantes" },
  { id: "riesgo", titulo: "Riesgo" },
  { id: "alertas", titulo: "Puntos a verificar del análisis" },
  { id: "hipotesis-principal", titulo: "Formulación destacada" },
  { id: "resumen", titulo: "Resumen clínico" },
  { id: "conductas", titulo: "Conductas problema" },
  { id: "variables-moduladoras", titulo: "Variables moduladoras" },
  { id: "situaciones", titulo: "Análisis por situaciones" },
  { id: "hipotesis-mantenimiento", titulo: "Hipótesis de mantenimiento" },
  { id: "formulacion", titulo: "Formulación del caso" },
  { id: "conductas-alternativas", titulo: "Conductas alternativas" },
  { id: "modalidad", titulo: "Detalle según modelo terapéutico" },
  { id: "hipotesis-alternativas", titulo: "Hipótesis alternativas" },
  { id: "preguntas", titulo: "Preguntas para la próxima sesión" },
  { id: "intervencion", titulo: "Líneas de intervención" },
] as const satisfies readonly { id: string; titulo: string }[];

export type IdSeccion = (typeof SECCIONES_INFORME)[number]["id"];

/** Orden de fábrica. Lo usan el informe exportado y el reordenado de bloques. */
export const ORDEN_SECCIONES_POR_DEFECTO: IdSeccion[] = SECCIONES_INFORME.map(
  (s) => s.id
);

/** Nombre legible de una sección, para nombrarla dentro de una frase. */
export const TITULO_DE_SECCION = Object.fromEntries(
  SECCIONES_INFORME.map((s) => [s.id, s.titulo])
) as Record<IdSeccion, string>;
