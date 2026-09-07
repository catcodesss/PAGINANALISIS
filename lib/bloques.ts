import type { AnalisisFuncional } from "./types";

/**
 * Bloques que el clínico puede pedir por separado.
 *
 * Por qué existe: generar el informe completo cuesta tokens y tiempo. Si alguien
 * solo quiere las conductas problema o solo la lectura ACT, no tiene sentido
 * producir las tres capas de modalidad y toda la formulación.
 *
 * El ahorro real está en dos sitios: el prompt no incluye los bloques de las
 * modalidades que no se piden (son largos), y la salida es mucho más corta.
 *
 * DEPENDENCIAS: las secciones no son independientes. Las hipótesis de
 * mantenimiento se apoyan en las situaciones, y las tres capas también. Pedir
 * "capa ACT" sin situaciones daría una capa hueca, así que cada bloque declara
 * todo lo que necesita y la unión se calcula aquí, no en la interfaz.
 */

export type CampoAnalisis = keyof AnalisisFuncional;

/**
 * Siempre presentes, cuesten lo que cuesten: el resumen orienta la lectura y
 * los datos faltantes son la salvaguarda que impide leer el informe como si
 * fuera completo. No se ofrecen como opción porque no deben poder desactivarse.
 */
const CAMPOS_SIEMPRE: CampoAnalisis[] = [
  "resumen_clinico",
  "datos_faltantes",
  "riesgo",
  "alertas",
  "campos_generados",
  "meta",
  "secciones_editadas",
];

/**
 * Agrupación puramente visual para el selector: no cambia campos ni
 * dependencias, solo evita que 11 tarjetas se lean como una lista plana de
 * nombres sin relación entre sí.
 */
export type CategoriaBloque =
  | "Descripción"
  | "Análisis funcional"
  | "Formulación y plan"
  | "Capas de modalidad";

export interface Bloque {
  id: string;
  etiqueta: string;
  descripcion: string;
  categoria: CategoriaBloque;
  /** Todo lo que hay que generar para que este bloque tenga sentido. */
  campos: CampoAnalisis[];
  /** Peso relativo, solo para estimar el coste en la interfaz. */
  peso: number;
}

export const BLOQUES: Bloque[] = [
  {
    id: "base",
    etiqueta: "Repertorio conductual y variables moduladoras",
    descripcion:
      "Qué se hace de más, qué falta y qué ya está disponible, y el contexto biológico y de aprendizaje que lo modula.",
    categoria: "Descripción",
    campos: ["conductas_problema", "repertorio_disponible", "variables_moduladoras"],
    peso: 2,
  },
  {
    id: "situaciones",
    etiqueta: "Análisis por situaciones",
    descripcion: "Encadena estímulo, respuesta y consecuencia en cada situación concreta.",
    categoria: "Análisis funcional",
    campos: ["conductas_problema", "situaciones", "acomodacion_entorno"],
    peso: 3,
  },
  {
    id: "mantenimiento",
    etiqueta: "Hipótesis de mantenimiento",
    descripcion: "Qué refuerzo sostiene la conducta hoy, y de dónde pudo originarse.",
    categoria: "Análisis funcional",
    campos: ["conductas_problema", "situaciones", "hipotesis_mantenimiento", "hipotesis_origen"],
    peso: 4,
  },
  {
    id: "hipotesis_alternativas",
    etiqueta: "Hipótesis alternativas",
    descripcion: "Otras lecturas funcionales posibles, y cómo distinguirlas de la principal.",
    categoria: "Análisis funcional",
    campos: ["situaciones", "hipotesis_mantenimiento", "hipotesis_alternativas"],
    peso: 4,
  },
  {
    id: "formulacion",
    etiqueta: "Formulación del caso",
    descripcion: "Cómo se relacionan los problemas entre sí, y cuáles priorizar.",
    categoria: "Formulación y plan",
    campos: [
      "conductas_problema",
      "situaciones",
      "hipotesis_mantenimiento",
      "formulacion",
      "fortalezas_y_recursos",
      "valores_y_metas",
      "perdida_de_reforzadores",
    ],
    peso: 5,
  },
  {
    id: "alternativas",
    etiqueta: "Conductas alternativas",
    descripcion: "Qué podría ocupar el mismo lugar funcional, y qué consecuencia lo sostendría.",
    categoria: "Formulación y plan",
    campos: [
      "conductas_problema",
      "situaciones",
      "hipotesis_mantenimiento",
      "conductas_alternativas",
    ],
    peso: 5,
  },
  {
    id: "intervencion",
    etiqueta: "Líneas de intervención",
    descripcion: "Orientaciones de tratamiento tentativas, sin comprometerse con una modalidad.",
    categoria: "Formulación y plan",
    campos: [
      "conductas_problema",
      "situaciones",
      "hipotesis_mantenimiento",
      "lineas_de_intervencion_tentativas",
    ],
    peso: 5,
  },
  {
    id: "monitorizacion",
    etiqueta: "Plan de monitorización",
    descripcion:
      "Qué se mide, con qué y cada cuánto — y qué observación desmentiría esta formulación.",
    categoria: "Formulación y plan",
    campos: [
      "conductas_problema",
      "hipotesis_mantenimiento",
      "plan_de_monitorizacion",
    ],
    peso: 2,
  },
  {
    id: "preguntas",
    etiqueta: "Preguntas para la sesión",
    descripcion: "Qué preguntar para confirmar o descartar cada hipótesis.",
    categoria: "Formulación y plan",
    campos: ["preguntas_para_sesion"],
    peso: 1,
  },
  {
    id: "act",
    etiqueta: "Capa ACT",
    descripcion: "Reglas verbales y procesos de inflexibilidad psicológica.",
    categoria: "Capas de modalidad",
    campos: ["conductas_problema", "situaciones", "capa_act"],
    peso: 4,
  },
  {
    id: "dbt",
    etiqueta: "Capa DBT",
    descripcion: "Análisis en cadena con habilidades sugeridas en cada eslabón.",
    categoria: "Capas de modalidad",
    campos: ["conductas_problema", "situaciones", "capa_dbt"],
    peso: 4,
  },
  {
    id: "mc",
    etiqueta: "Capa conductual (MC)",
    descripcion: "Procedimientos de manejo de contingencias.",
    categoria: "Capas de modalidad",
    campos: ["conductas_problema", "situaciones", "capa_mc"],
    peso: 4,
  },
];

/** Todos los bloques: equivale al informe completo de siempre. */
export const IDS_TODOS = BLOQUES.map((b) => b.id);

export function bloquePorId(id: string): Bloque | undefined {
  return BLOQUES.find((b) => b.id === id);
}

/**
 * Une los campos de los bloques pedidos, resolviendo las dependencias, y añade
 * los que van siempre. Devuelve el orden canónico de AnalisisFuncional para que
 * el JSON salga siempre igual, independientemente de en qué orden se marcaron
 * las casillas.
 */
export function camposParaBloques(
  idsBloques: string[],
  orden: readonly CampoAnalisis[]
): CampoAnalisis[] {
  const pedidos = new Set<CampoAnalisis>(CAMPOS_SIEMPRE);

  for (const id of idsBloques) {
    const bloque = bloquePorId(id);
    if (!bloque) continue;
    for (const campo of bloque.campos) pedidos.add(campo);
  }

  return orden.filter((campo) => pedidos.has(campo));
}

/** Estimación grosera del coste relativo, para orientar en la interfaz. */
export function pesoDe(idsBloques: string[]): number {
  const total = BLOQUES.reduce((suma, b) => suma + b.peso, 0);
  const elegido = idsBloques.reduce(
    (suma, id) => suma + (bloquePorId(id)?.peso ?? 0),
    0
  );
  return total === 0 ? 0 : Math.round((elegido / total) * 100);
}
