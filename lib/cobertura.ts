import type {
  DimensionVariable,
  NivelVariable,
  VariableModuladora,
} from "./types";

/**
 * Cobertura de datos de la rejilla de contexto y procesos: cuántas de las 18
 * celdas (3 niveles × 6 dimensiones) tienen alguna variable declarada.
 *
 * SE LLAMA "COBERTURA DE DATOS" Y NUNCA "CONFIANZA". La distinción no es de
 * estilo: una rejilla llena de datos malos no vale más que una incompleta con
 * datos buenos, y llamar "confianza" a este número invitaría a leerlo como una
 * medida de calidad del análisis. Solo cuenta CASILLAS CON ALGO ESCRITO. No
 * mira la evidencia, ni la modificabilidad, ni si lo escrito es correcto.
 *
 * PARA QUÉ SIRVE ENTONCES. Una celda vacía es información sobre la evaluación,
 * no sobre el consultante: dice que en esa intersección —por ejemplo, procesos
 * atencionales a nivel biofisiológico— no se ha registrado nada. Puede que no
 * haya nada que registrar, o puede que nadie lo haya preguntado, y esas dos
 * cosas se distinguen preguntando, no mirando la rejilla. Por eso los huecos se
 * enlazan con la sección de verificación en vez de presentarse como un
 * resultado.
 */

export const NIVELES: readonly NivelVariable[] = [
  "biofisiologico",
  "psicologico",
  "sociocultural",
] as const;

export const DIMENSIONES: readonly DimensionVariable[] = [
  "afecto",
  "cognicion",
  "atencion",
  "self",
  "motivacion",
  "conducta",
] as const;

/** Cómo se nombra cada eje de cara al clínico. */
export const ETIQUETA_NIVEL: Record<NivelVariable, string> = {
  biofisiologico: "Biofisiológico",
  psicologico: "Psicológico",
  sociocultural: "Sociocultural",
};

export const ETIQUETA_DIMENSION: Record<DimensionVariable, string> = {
  afecto: "Afecto",
  cognicion: "Cognición",
  atencion: "Atención",
  self: "Self",
  motivacion: "Motivación",
  conducta: "Conducta",
};

export interface Celda {
  nivel: NivelVariable;
  dimension: DimensionVariable;
  variables: VariableModuladora[];
}

export interface Cobertura {
  /** Las 18 celdas, siempre todas y siempre en el mismo orden. */
  celdas: Celda[];
  conDato: number;
  totales: number;
  /** Entero de 0 a 100. Es un recuento de casillas, no una nota. */
  porcentaje: number;
  /** Las celdas vacías, para poder nombrarlas en la sección de verificación. */
  huecos: { nivel: NivelVariable; dimension: DimensionVariable }[];
}

/**
 * Reparte las variables por celda. Una variable cae en exactamente una: su
 * nivel y su dimensión ya vienen decididos por el análisis, y repartir una
 * variable entre varias celdas inflaría la cobertura sin añadir nada.
 */
export function calcularCobertura(variables: VariableModuladora[]): Cobertura {
  const celdas: Celda[] = [];

  for (const nivel of NIVELES) {
    for (const dimension of DIMENSIONES) {
      celdas.push({
        nivel,
        dimension,
        variables: variables.filter(
          (v) => v.nivel === nivel && v.dimension === dimension
        ),
      });
    }
  }

  const conDato = celdas.filter((c) => c.variables.length > 0).length;
  return {
    celdas,
    conDato,
    totales: celdas.length,
    porcentaje: Math.round((conDato / celdas.length) * 100),
    huecos: celdas
      .filter((c) => c.variables.length === 0)
      .map(({ nivel, dimension }) => ({ nivel, dimension })),
  };
}
