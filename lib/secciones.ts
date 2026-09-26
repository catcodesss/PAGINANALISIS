/**
 * Los cinco bloques del informe, y las anclas que viven dentro de cada uno.
 *
 * Desde la reorganización en pestañas, cada bloque ES una pestaña (ver
 * components/informe/pestanas.tsx). Los ids no cambian —son los que guardan
 * `secciones_editadas` y los enlaces—; cambian los títulos, y «preguntas» pasa
 * al Resumen porque es lo que se lleva a la próxima sesión.
 *
 * QUÉ CAMBIÓ Y POR QUÉ. Hasta aquí había diecisiete secciones, cada una una
 * unidad del índice, del orden y del arrastre. Diecisiete entradas no son un
 * índice: son una lista que se lee una vez y luego se ignora. Y peor que eso,
 * el reparto no seguía a la información — «Evitar exponer en reuniones»
 * aparecía en Repertorio, en Situaciones, en Hipótesis de mantenimiento, en
 * Formulación, en Conductas alternativas y en Intervención, como seis cadenas
 * de texto distintas que nada obligaba a decir lo mismo.
 *
 * Los cinco grupos que ya existían pasan a ser **el bloque renderizado**, y las
 * secciones de dentro dejan de ser unidades de orden. Lo que se arrastra, lo
 * que se oculta y lo que el índice lista son cinco cosas, no diecisiete.
 *
 * LAS ANCLAS NO SE PIERDEN. Cada id viejo sigue existiendo como ancla dentro de
 * su bloque: `#hipotesis-principal` sigue llevando donde llevaba, los enlaces
 * guardados no se rompen y `secciones_editadas` —que guarda qué escribió el
 * clínico a mano, invariante 6— sigue hablando el mismo idioma. Lo que cambia
 * es que un ancla no se puede mover ni ocultar por su cuenta.
 *
 * EL ORDEN DE ESTA LISTA ES EL ORDEN DE FÁBRICA. Sigue el recorrido de una
 * formulación: qué obliga a actuar hoy, qué está pasando, por qué se mantiene,
 * qué se hace, y qué podría desmontarlo. Los contrapesos van al final porque se
 * leen cuando ya hay una propuesta sobre la mesa, que es cuando importa saber
 * qué la desmentiría.
 */

export const SECCIONES_INFORME = [
  { id: "sintesis", titulo: "Resumen" },
  { id: "que-pasa", titulo: "Análisis funcional" },
  { id: "mantenimiento", titulo: "Formulación" },
  { id: "plan", titulo: "Plan" },
  { id: "pendientes", titulo: "Revisión" },
] as const satisfies readonly { id: string; titulo: string }[];

export type IdSeccion = (typeof SECCIONES_INFORME)[number]["id"];

/**
 * Las anclas: los identificadores anteriores, con el bloque donde aterrizan.
 *
 * `IdAncla` sale de esta lista, así que nombrar un ancla que no existe es un
 * error de compilación y no un enlace roto que solo se descubre pulsándolo. Es
 * la misma idea que tenía `IdSeccion` cuando las secciones eran diecisiete: que
 * el compilador vigile lo que ninguna prueba mira.
 */
export const ANCLAS_INFORME = [
  { id: "riesgo", titulo: "Riesgo", bloque: "sintesis" },
  { id: "resumen", titulo: "Resumen clínico", bloque: "sintesis" },
  { id: "hipotesis-principal", titulo: "Formulación principal", bloque: "sintesis" },
  { id: "prioridades", titulo: "Tres prioridades", bloque: "sintesis" },
  { id: "preguntas", titulo: "Preguntas para la próxima sesión", bloque: "sintesis" },
  { id: "conductas", titulo: "Repertorio conductual", bloque: "que-pasa" },
  { id: "variables-moduladoras", titulo: "Contexto y variables moduladoras", bloque: "que-pasa" },
  { id: "situaciones", titulo: "Análisis por situaciones", bloque: "que-pasa" },
  { id: "modalidad", titulo: "Detalle según modelo terapéutico", bloque: "que-pasa" },
  { id: "hipotesis-mantenimiento", titulo: "Hipótesis de mantenimiento", bloque: "mantenimiento" },
  { id: "hipotesis-origen", titulo: "Hipótesis de origen", bloque: "mantenimiento" },
  { id: "formulacion", titulo: "Formulación del caso", bloque: "mantenimiento" },
  { id: "conductas-alternativas", titulo: "Conductas alternativas", bloque: "plan" },
  { id: "intervencion", titulo: "Líneas de intervención", bloque: "plan" },
  { id: "monitorizacion", titulo: "Plan de monitorización", bloque: "plan" },
  { id: "hipotesis-alternativas", titulo: "Hipótesis alternativas", bloque: "pendientes" },
  { id: "verificacion", titulo: "Datos faltantes y puntos a verificar", bloque: "pendientes" },
  { id: "niveles-confianza", titulo: "Grado de apoyo", bloque: "pendientes" },
] as const satisfies readonly { id: string; titulo: string; bloque: IdSeccion }[];

export type IdAncla = (typeof ANCLAS_INFORME)[number]["id"];

/** Orden de fábrica. Lo usan el informe exportado y el reordenado de bloques. */
export const ORDEN_SECCIONES_POR_DEFECTO: IdSeccion[] = SECCIONES_INFORME.map(
  (s) => s.id
);

/** Nombre legible de un bloque, para nombrarlo dentro de una frase. */
export const TITULO_DE_SECCION = Object.fromEntries(
  SECCIONES_INFORME.map((s) => [s.id, s.titulo])
) as Record<IdSeccion, string>;

export const TITULO_DE_ANCLA = Object.fromEntries(
  ANCLAS_INFORME.map((a) => [a.id, a.titulo])
) as Record<IdAncla, string>;

/**
 * En qué bloque vive cada ancla. Acepta `string` a propósito: un id guardado
 * por una versión anterior —o un enlace copiado de un informe viejo— tiene que
 * poder preguntarse aquí sin romper nada. Devuelve null si no lo conoce.
 */
const BLOQUE_POR_ANCLA = Object.fromEntries(
  ANCLAS_INFORME.map((a) => [a.id, a.bloque])
) as Record<string, IdSeccion | undefined>;

export function bloqueDeAncla(id: string): IdSeccion | null {
  return BLOQUE_POR_ANCLA[id] ?? null;
}

/** Las anclas de un bloque, en orden de fábrica. */
export const ANCLAS_DE_BLOQUE = Object.fromEntries(
  ORDEN_SECCIONES_POR_DEFECTO.map((b) => [
    b,
    ANCLAS_INFORME.filter((a) => a.bloque === b).map((a) => a.id),
  ])
) as Record<IdSeccion, IdAncla[]>;
