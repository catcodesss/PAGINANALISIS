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
 * GRUPOS. Cada sección declara a qué grupo pertenece, y el grupo manda sobre
 * la posición guardada: el clínico puede reordenar dentro de un grupo y mover
 * grupos enteros, pero no intercalar "Datos faltantes y puntos a verificar"
 * entre dos secciones descriptivas. La razón es que el informe se lee como un
 * recorrido —qué obliga a actuar hoy, qué se observó, qué se infiere de ello,
 * qué se hace, y qué lo pondría en duda— y una sección suelta fuera de su
 * tramo no se lee como una preferencia: se lee como un error del documento.
 *
 * El orden dentro de cada grupo sigue ese mismo recorrido: primero lo que
 * obliga a actuar (riesgo), luego de quién hablamos y la frase que sintetiza
 * el caso; después el material observado (repertorio, contexto, situaciones y
 * su lectura por modelo); luego lo que se infiere de él (mantenimiento,
 * origen, formulación); después lo que se hace con todo eso (alternativas,
 * intervención, monitorización); y al final los contrapesos: hipótesis
 * alternativas, lo que falta por verificar y las preguntas que se derivan de
 * ello. Se leen cuando ya hay una propuesta sobre la mesa, que es cuando
 * importa saber qué podría desmontarla.
 *
 * "niveles-confianza" cierra la lista. No es análisis: es la leyenda del chip
 * de color que acompaña a cada hallazgo. Estuvo arriba, antes del resumen,
 * para explicar la convención en cuanto el lector se la encuentra; ahora va al
 * final porque interrumpía la lectura clínica, y la propia barra ya lleva un
 * resumen desplegable con el enlace a esta definición completa.
 */

export const GRUPOS_INFORME = [
  { id: "apertura", titulo: "Punto de partida" },
  { id: "descripcion", titulo: "Lo observado" },
  { id: "mantenimiento", titulo: "Lo que se infiere" },
  { id: "plan", titulo: "Lo que se hace" },
  { id: "pendientes", titulo: "Contrapesos y pendientes" },
] as const satisfies readonly { id: string; titulo: string }[];

export type IdGrupo = (typeof GRUPOS_INFORME)[number]["id"];

export const SECCIONES_INFORME = [
  { id: "riesgo", titulo: "Riesgo", grupo: "apertura" },
  { id: "resumen", titulo: "Resumen clínico", grupo: "apertura" },
  { id: "hipotesis-principal", titulo: "Formulación destacada", grupo: "apertura" },
  { id: "conductas", titulo: "Repertorio conductual", grupo: "descripcion" },
  { id: "variables-moduladoras", titulo: "Variables moduladoras", grupo: "descripcion" },
  { id: "situaciones", titulo: "Análisis por situaciones", grupo: "descripcion" },
  { id: "modalidad", titulo: "Detalle según modelo terapéutico", grupo: "descripcion" },
  { id: "hipotesis-mantenimiento", titulo: "Hipótesis de mantenimiento", grupo: "mantenimiento" },
  { id: "hipotesis-origen", titulo: "Hipótesis de origen", grupo: "mantenimiento" },
  { id: "formulacion", titulo: "Formulación del caso", grupo: "mantenimiento" },
  { id: "conductas-alternativas", titulo: "Conductas alternativas", grupo: "plan" },
  { id: "intervencion", titulo: "Líneas de intervención", grupo: "plan" },
  { id: "hipotesis-alternativas", titulo: "Hipótesis alternativas", grupo: "pendientes" },
  { id: "verificacion", titulo: "Datos faltantes y puntos a verificar", grupo: "pendientes" },
  { id: "preguntas", titulo: "Preguntas para la próxima sesión", grupo: "pendientes" },
  { id: "niveles-confianza", titulo: "Niveles de confianza", grupo: "pendientes" },
] as const satisfies readonly { id: string; titulo: string; grupo: IdGrupo }[];

export type IdSeccion = (typeof SECCIONES_INFORME)[number]["id"];

/** Orden de fábrica. Lo usan el informe exportado y el reordenado de bloques. */
export const ORDEN_SECCIONES_POR_DEFECTO: IdSeccion[] = SECCIONES_INFORME.map(
  (s) => s.id
);

/** Nombre legible de una sección, para nombrarla dentro de una frase. */
export const TITULO_DE_SECCION = Object.fromEntries(
  SECCIONES_INFORME.map((s) => [s.id, s.titulo])
) as Record<IdSeccion, string>;

const GRUPO_DE_SECCION = Object.fromEntries(
  SECCIONES_INFORME.map((s) => [s.id, s.grupo])
) as Record<IdSeccion, IdGrupo>;

const POSICION_DE_GRUPO = new Map<string, number>(
  GRUPOS_INFORME.map((g, i) => [g.id, i])
);

/**
 * Posición del grupo al que pertenece una sección. Es lo que
 * components/ordenBloques.tsx usa para que el grupo mande sobre el orden
 * guardado: un id desconocido —guardado por una versión anterior— cae detrás
 * de todo en vez de colarse en mitad de un grupo al que no pertenece.
 */
export function posicionDeGrupo(id: string): number {
  const grupo = GRUPO_DE_SECCION[id as IdSeccion];
  return grupo === undefined ? GRUPOS_INFORME.length : POSICION_DE_GRUPO.get(grupo)!;
}
