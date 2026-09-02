/**
 * Las secciones del informe: una sola lista, y de ella salen todas las demás.
 *
 * Por qué existe: los mismos identificadores estaban escritos cuatro veces
 * —el índice de la interfaz, el orden por defecto del informe exportado, los
 * títulos del informe copiado y el mapa de qué bloque hace falta para cada
 * sección— sin nada que los comparase. Cualquiera de esas listas podía
 * quedarse atrás al añadir o renombrar una sección, y el fallo no da error: da
 * un bloque que no se imprime, un título que dice otra cosa, o un aviso que
 * señala una sección inexistente. Ninguna prueba lo habría visto.
 *
 * `IdSeccion` sale de la propia lista, así que un identificador mal escrito en
 * cualquiera de los sitios que la usan es un error de compilación, no un fallo
 * en tiempo de ejecución. Es la misma idea que `CAMPOS_ANALISIS_FUNCIONAL` en
 * lib/types.ts: que el compilador vigile lo que ningún test mira.
 *
 * El orden de esta lista ES el orden de fábrica del informe. Cambiarlo cambia
 * cómo se lee un informe recién generado; el clínico puede reordenarlo después
 * (ver components/ordenBloques.tsx).
 *
 * El orden sigue el recorrido de una formulación: primero lo que obliga a
 * actuar hoy (riesgo), luego de quién hablamos (resumen) y la frase que
 * sintetiza el caso; después el material observado (conductas, variables,
 * situaciones y su lectura por modelo); luego lo que se infiere de él
 * (hipótesis de mantenimiento, formulación); y por último lo que se hace con
 * todo eso (conductas alternativas, intervención). Las hipótesis alternativas
 * y los puntos a verificar cierran el análisis como contrapeso: se leen
 * cuando ya hay una propuesta sobre la mesa, que es cuando importa saber qué
 * podría desmontarla.
 *
 * "datos-faltantes" va al final, no al principio: desde que existe el paso de
 * preguntas previo (ver lib/datosFaltantesPrevios.ts y
 * components/PreguntasDatosFaltantes.tsx), lo que aquí aparece no es lo
 * primero que hay que revisar, sino lo que el propio terapeuta ya reconoció
 * como no disponible al responder "No sé". Ya no hace falta leerlo antes que
 * el resto: arriba va lo que el análisis sí pudo decir. Y "preguntas" va justo
 * detrás porque se deriva de él y de los puntos a verificar.
 *
 * "niveles-confianza" cierra la lista. No es análisis: es la leyenda del chip
 * de color que acompaña a cada hallazgo. Estuvo arriba, antes del resumen,
 * para explicar la convención en cuanto el lector se la encuentra; ahora va al
 * final porque interrumpía la lectura clínica, y la propia barra ya lleva un
 * resumen desplegable con el enlace a esta definición completa.
 */

export const SECCIONES_INFORME = [
  { id: "riesgo", titulo: "Riesgo" },
  { id: "resumen", titulo: "Resumen clínico" },
  { id: "hipotesis-principal", titulo: "Formulación destacada" },
  { id: "conductas", titulo: "Conductas problema" },
  { id: "variables-moduladoras", titulo: "Variables moduladoras" },
  { id: "situaciones", titulo: "Análisis por situaciones" },
  { id: "modalidad", titulo: "Detalle según modelo terapéutico" },
  { id: "hipotesis-mantenimiento", titulo: "Hipótesis de mantenimiento" },
  { id: "formulacion", titulo: "Formulación del caso" },
  { id: "conductas-alternativas", titulo: "Conductas alternativas" },
  { id: "intervencion", titulo: "Líneas de intervención" },
  { id: "hipotesis-alternativas", titulo: "Hipótesis alternativas" },
  { id: "alertas", titulo: "Puntos a verificar del análisis" },
  { id: "datos-faltantes", titulo: "Datos faltantes" },
  { id: "preguntas", titulo: "Preguntas para la próxima sesión" },
  { id: "niveles-confianza", titulo: "Niveles de confianza" },
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
