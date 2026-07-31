import { resolverCita } from "./citas";
import {
  CAMPOS_ANALISIS_FUNCIONAL,
  type AnalisisFuncional,
  type CadenaDBT,
  type CadenaOperante,
  type CadenaRespondiente,
  type CapaModalidadACT,
  type CapaModalidadDBT,
  type CapaModalidadMC,
  type ConductaAlternativa,
  type ConductaProblema,
  type DeficitOInterferencia,
  type Formulacion,
  type HipotesisAlternativa,
  type HipotesisMantenimiento,
  type NivelConfianza,
  type PriorizacionBlanco,
  type Situacion,
  type TipoContingencia,
  type VariableModuladora,
} from "./types";

/**
 * El proveedor puede envolver el JSON en texto o fences pese a la instrucción
 * del system prompt. Se localiza la primera "{" y la última "}" para aislar
 * el objeto antes de intentar el parseo.
 */
export function extraerJSON(textoCrudo: string): string {
  const sinFences = textoCrudo.replace(/```json/gi, "").replace(/```/g, "");
  const inicio = sinFences.indexOf("{");
  const fin = sinFences.lastIndexOf("}");
  if (inicio === -1 || fin === -1 || fin <= inicio) {
    throw new Error("La respuesta no contiene un objeto JSON reconocible.");
  }
  return sinFences.slice(inicio, fin + 1);
}

function comoArreglo<T>(valor: unknown): T[] {
  return Array.isArray(valor) ? (valor as T[]) : [];
}

/**
 * Como comoArreglo<string>, pero valida el contenido real de cada elemento
 * en vez de solo confiar en el tipo genérico: filtra cualquier elemento que
 * no sea texto en lugar de dejarlo pasar como si lo fuera (el proveedor de
 * IA a veces devuelve objetos donde se le pidió una lista de strings).
 */
function comoArregloDeTexto(valor: unknown): string[] {
  return comoArreglo<unknown>(valor).filter(
    (elemento): elemento is string => typeof elemento === "string"
  );
}

function comoTexto(valor: unknown, porDefecto = ""): string {
  return typeof valor === "string" ? valor : porDefecto;
}

function comoTextoONulo(valor: unknown): string | null {
  return typeof valor === "string" ? valor : null;
}

function comoObjeto(valor: unknown): Record<string, unknown> {
  return typeof valor === "object" && valor !== null
    ? (valor as Record<string, unknown>)
    : {};
}

function comoObjetoONulo(valor: unknown): Record<string, unknown> | null {
  return typeof valor === "object" && valor !== null
    ? (valor as Record<string, unknown>)
    : null;
}

function comoConfianza(valor: unknown): NivelConfianza {
  return valor === "alta" || valor === "media" || valor === "baja"
    ? valor
    : "baja";
}

const TIPOS_CONTINGENCIA: TipoContingencia[] = [
  "refuerzo positivo",
  "refuerzo negativo",
  "castigo positivo",
  "castigo negativo",
  "extincion",
];

function comoTipoContingencia(valor: unknown): TipoContingencia {
  return TIPOS_CONTINGENCIA.includes(valor as TipoContingencia)
    ? (valor as TipoContingencia)
    : "extincion";
}

const VALORES_DEFICIT: DeficitOInterferencia[] = [
  "deficit",
  "interferencia",
  "mixto",
  "no_determinable",
];

function comoDeficitOInterferencia(valor: unknown): DeficitOInterferencia {
  return VALORES_DEFICIT.includes(valor as DeficitOInterferencia)
    ? (valor as DeficitOInterferencia)
    : "no_determinable";
}

function normalizarConductaProblema(valor: unknown, lineas: string[]): ConductaProblema {
  const d = comoObjeto(valor);
  return {
    descripcion: comoTexto(d.descripcion),
    tipo: d.tipo === "encubierta" ? "encubierta" : "manifiesta",
    importancia: comoConfianza(d.importancia),
    es_conducta_seguridad: d.es_conducta_seguridad === true,
    deficit_o_interferencia: comoDeficitOInterferencia(d.deficit_o_interferencia),
    justificacion_deficit: comoTexto(d.justificacion_deficit),
    evidencia: resolverCita(lineas, d.evidencia),
  };
}

function normalizarVariableModuladora(valor: unknown, lineas: string[]): VariableModuladora {
  const d = comoObjeto(valor);
  const tipo =
    d.tipo === "biologica" || d.tipo === "contextual"
      ? d.tipo
      : "historia_de_aprendizaje";
  return {
    tipo,
    descripcion: comoTexto(d.descripcion),
    evidencia: resolverCita(lineas, d.evidencia),
  };
}

function normalizarCadenaOperante(valor: unknown, lineas: string[]): CadenaOperante | null {
  const d = comoObjetoONulo(valor);
  if (!d) return null;
  return {
    antecedente: comoTexto(d.antecedente),
    operacion_motivacional: comoTextoONulo(d.operacion_motivacional),
    respuesta: comoTexto(d.respuesta),
    consecuencia: comoTexto(d.consecuencia),
    tipo_contingencia: comoTipoContingencia(d.tipo_contingencia),
    inmediatez: d.inmediatez === "demorada" ? "demorada" : "inmediata",
    consecuencias_largo_plazo: comoTextoONulo(d.consecuencias_largo_plazo),
    evidencia: resolverCita(lineas, d.evidencia),
  };
}

function normalizarCadenaRespondiente(valor: unknown, lineas: string[]): CadenaRespondiente | null {
  const d = comoObjetoONulo(valor);
  if (!d) return null;
  return {
    estimulo: comoTexto(d.estimulo),
    respuesta_condicionada: comoTexto(d.respuesta_condicionada),
    conexion_con_operante: comoTextoONulo(d.conexion_con_operante),
    evidencia: resolverCita(lineas, d.evidencia),
  };
}

function normalizarCadenaDBT(valor: unknown, lineas: string[]): CadenaDBT | null {
  const d = comoObjetoONulo(valor);
  if (!d) return null;
  return {
    factores_vulnerabilidad: comoArregloDeTexto(d.factores_vulnerabilidad),
    evento_precipitante: comoTexto(d.evento_precipitante),
    eslabones: comoArreglo<unknown>(d.eslabones).map((e) => {
      const eo = comoObjeto(e);
      return {
        tipo: TIPOS_ESLABON_DBT.includes(eo.tipo as string)
          ? (eo.tipo as "pensamiento")
          : "pensamiento",
        descripcion: comoTexto(eo.descripcion),
      };
    }),
    conducta_problema: comoTexto(d.conducta_problema),
    consecuencias: comoTexto(d.consecuencias),
    evidencia: resolverCita(lineas, d.evidencia),
  };
}

function normalizarSituacion(valor: unknown, indice: number, lineas: string[]): Situacion {
  const d = comoObjeto(valor);
  return {
    nombre: comoTexto(d.nombre, `Situación ${indice + 1}`),
    cadena_operante: normalizarCadenaOperante(d.cadena_operante, lineas),
    cadena_respondiente: normalizarCadenaRespondiente(d.cadena_respondiente, lineas),
    cadena_dbt: normalizarCadenaDBT(d.cadena_dbt, lineas),
    ciclo_interconductual: comoTextoONulo(d.ciclo_interconductual),
    funcion_hipotetizada: comoTexto(d.funcion_hipotetizada),
    confianza: comoConfianza(d.confianza),
  };
}

function normalizarHipotesisMantenimiento(valor: unknown): HipotesisMantenimiento {
  const d = comoObjeto(valor);
  return {
    conducta: comoTexto(d.conducta),
    enunciado: comoTexto(d.enunciado),
    funcion: comoTexto(d.funcion),
    confianza: comoConfianza(d.confianza),
  };
}

function normalizarPriorizacion(valor: unknown): PriorizacionBlanco {
  const d = comoObjeto(valor);
  return {
    blanco: comoTexto(d.blanco),
    justificacion: comoTexto(d.justificacion),
  };
}

function normalizarFormulacion(valor: unknown): Formulacion {
  const d = comoObjeto(valor);
  return {
    relaciones_entre_problemas: comoArregloDeTexto(d.relaciones_entre_problemas),
    priorizacion: comoArreglo<unknown>(d.priorizacion).map(normalizarPriorizacion),
  };
}

function normalizarConductaAlternativa(valor: unknown): ConductaAlternativa {
  const d = comoObjeto(valor);
  return {
    situacion: comoTexto(d.situacion),
    conducta_propuesta: comoTexto(d.conducta_propuesta),
    consecuencia_necesaria: comoTexto(d.consecuencia_necesaria),
  };
}

function normalizarHipotesisAlternativa(valor: unknown): HipotesisAlternativa {
  const d = comoObjeto(valor);
  return {
    enunciado: comoTexto(d.enunciado),
    como_descartarla: comoTexto(d.como_descartarla),
  };
}

function normalizarCapaAct(valor: unknown, lineas: string[]): CapaModalidadACT {
  const d = comoObjeto(valor);
  return {
    reglas_verbales: comoArreglo<unknown>(d.reglas_verbales).map((r) => {
      const ro = comoObjeto(r);
      return {
        regla: comoTexto(ro.regla),
        textual_o_inferida:
          ro.textual_o_inferida === "inferida" ? "inferida" : "textual",
        clase:
          ro.clase === "tracking" || ro.clase === "augmenting"
            ? ro.clase
            : "pliance",
        rigidez: comoConfianza(ro.rigidez),
        analisis: comoTexto(ro.analisis),
      };
    }),
    procesos_act: comoArreglo<unknown>(d.procesos_act).map((p) => {
      const po = comoObjeto(p);
      return {
        proceso: comoTexto(po.proceso),
        vinculo_con_cadena: comoTexto(po.vinculo_con_cadena),
        evidencia: resolverCita(lineas, po.evidencia),
      };
    }),
  };
}

const TIPOS_ESLABON_DBT = ["pensamiento", "emocion", "sensacion", "impulso", "accion"];
const MODULOS_DBT = [
  "mindfulness",
  "tolerancia_al_malestar",
  "regulacion_emocional",
  "efectividad_interpersonal",
];

function normalizarCapaDbt(valor: unknown): CapaModalidadDBT {
  const d = comoObjeto(valor);
  const cadena = comoObjeto(d.analisis_en_cadena);
  return {
    analisis_en_cadena: {
      conducta_objetivo: comoTexto(cadena.conducta_objetivo),
      vulnerabilidades: comoArregloDeTexto(cadena.vulnerabilidades),
      evento_precipitante: comoTexto(cadena.evento_precipitante),
      eslabones: comoArreglo<unknown>(cadena.eslabones).map((e) => {
        const eo = comoObjeto(e);
        return {
          tipo: TIPOS_ESLABON_DBT.includes(eo.tipo as string)
            ? (eo.tipo as "pensamiento")
            : "pensamiento",
          descripcion: comoTexto(eo.descripcion),
        };
      }),
      consecuencias_corto_plazo: comoArregloDeTexto(
        cadena.consecuencias_corto_plazo
      ),
      consecuencias_largo_plazo: comoArregloDeTexto(
        cadena.consecuencias_largo_plazo
      ),
    },
    habilidades_sugeridas: comoArreglo<unknown>(d.habilidades_sugeridas).map(
      (h) => {
        const ho = comoObjeto(h);
        return {
          modulo: MODULOS_DBT.includes(ho.modulo as string)
            ? (ho.modulo as "mindfulness")
            : "mindfulness",
          habilidad: comoTexto(ho.habilidad),
          eslabon_objetivo: comoTexto(ho.eslabon_objetivo),
        };
      }
    ),
  };
}

function normalizarCapaMc(valor: unknown): CapaModalidadMC {
  const d = comoObjeto(valor);
  return {
    procedimientos_sugeridos: comoArreglo<unknown>(
      d.procedimientos_sugeridos
    ).map((p) => {
      const po = comoObjeto(p);
      return {
        procedimiento: comoTexto(po.procedimiento),
        contingencia_objetivo: comoTexto(po.contingencia_objetivo),
        precauciones: comoTexto(po.precauciones),
      };
    }),
  };
}

/**
 * Garantiza la forma completa de AnalisisFuncional aunque el modelo omita
 * claves: las listas ausentes se convierten en arreglos vacíos y los objetos
 * ausentes en null, en lugar de romper la interfaz.
 */
export function normalizarAnalisis(json: unknown, lineas: string[]): AnalisisFuncional {
  const d = comoObjeto(json);

  return {
    resumen_clinico: comoTexto(d.resumen_clinico),
    conductas_problema: comoArreglo<unknown>(d.conductas_problema).map((c) =>
      normalizarConductaProblema(c, lineas)
    ),
    variables_moduladoras: comoArreglo<unknown>(d.variables_moduladoras).map((v) =>
      normalizarVariableModuladora(v, lineas)
    ),
    situaciones: comoArreglo<unknown>(d.situaciones).map((s, i) =>
      normalizarSituacion(s, i, lineas)
    ),
    hipotesis_mantenimiento: comoArreglo<unknown>(
      d.hipotesis_mantenimiento
    ).map(normalizarHipotesisMantenimiento),
    hipotesis_origen: comoArregloDeTexto(d.hipotesis_origen),
    formulacion: normalizarFormulacion(d.formulacion),
    conductas_alternativas: comoArreglo<unknown>(d.conductas_alternativas).map(
      normalizarConductaAlternativa
    ),
    capa_act: normalizarCapaAct(d.capa_act, lineas),
    capa_dbt: normalizarCapaDbt(d.capa_dbt),
    capa_mc: normalizarCapaMc(d.capa_mc),
    hipotesis_alternativas: comoArreglo<unknown>(d.hipotesis_alternativas).map(
      normalizarHipotesisAlternativa
    ),
    preguntas_para_sesion: comoArregloDeTexto(d.preguntas_para_sesion),
    lineas_de_intervencion_tentativas: comoArregloDeTexto(
      d.lineas_de_intervencion_tentativas
    ),
    datos_faltantes: comoArregloDeTexto(d.datos_faltantes),
    // Las alertas no vienen del modelo: las produce lib/validadores.ts.
    alertas: [],
  };
}

/**
 * Un normalizador por cada clave de AnalisisFuncional, reutilizando las
 * mismas funciones tolerantes que usa normalizarAnalisis. El tipo de este
 * objeto obliga (en tiempo de compilación) a que TODAS las claves de
 * AnalisisFuncional tengan un normalizador: si agregas un campo al tipo y
 * olvidas agregarlo aquí, el build falla en vez de fallar en silencio
 * cuando alguien reanalice esa sección en producción.
 */
const NORMALIZADORES_POR_CAMPO: {
  [K in keyof AnalisisFuncional]: (
    d: Record<string, unknown>,
    lineas: string[]
  ) => AnalisisFuncional[K];
} = {
  resumen_clinico: (d) => comoTexto(d.resumen_clinico),
  conductas_problema: (d, lineas) =>
    comoArreglo<unknown>(d.conductas_problema).map((c) =>
      normalizarConductaProblema(c, lineas)
    ),
  variables_moduladoras: (d, lineas) =>
    comoArreglo<unknown>(d.variables_moduladoras).map((v) =>
      normalizarVariableModuladora(v, lineas)
    ),
  situaciones: (d, lineas) =>
    comoArreglo<unknown>(d.situaciones).map((s, i) =>
      normalizarSituacion(s, i, lineas)
    ),
  hipotesis_mantenimiento: (d) =>
    comoArreglo<unknown>(d.hipotesis_mantenimiento).map(
      normalizarHipotesisMantenimiento
    ),
  hipotesis_origen: (d) => comoArregloDeTexto(d.hipotesis_origen),
  formulacion: (d) => normalizarFormulacion(d.formulacion),
  conductas_alternativas: (d) =>
    comoArreglo<unknown>(d.conductas_alternativas).map(
      normalizarConductaAlternativa
    ),
  capa_act: (d, lineas) => normalizarCapaAct(d.capa_act, lineas),
  capa_dbt: (d) => normalizarCapaDbt(d.capa_dbt),
  capa_mc: (d) => normalizarCapaMc(d.capa_mc),
  hipotesis_alternativas: (d) =>
    comoArreglo<unknown>(d.hipotesis_alternativas).map(
      normalizarHipotesisAlternativa
    ),
  preguntas_para_sesion: (d) => comoArregloDeTexto(d.preguntas_para_sesion),
  lineas_de_intervencion_tentativas: (d) =>
    comoArregloDeTexto(d.lineas_de_intervencion_tentativas),
  datos_faltantes: (d) => comoArregloDeTexto(d.datos_faltantes),
  alertas: () => [],
};

function esCampoDeAnalisis(campo: string): campo is keyof AnalisisFuncional {
  return (CAMPOS_ANALISIS_FUNCIONAL as readonly string[]).includes(campo);
}

/** Asigna resultado[campo] con el normalizador correspondiente, sin recurrir a "as" para saltarse el tipo. */
function asignarCampoNormalizado<K extends keyof AnalisisFuncional>(
  resultado: Partial<AnalisisFuncional>,
  campo: K,
  d: Record<string, unknown>,
  lineas: string[]
): void {
  resultado[campo] = NORMALIZADORES_POR_CAMPO[campo](d, lineas);
}

/**
 * Normaliza una respuesta parcial (reanálisis de una sola sección): solo
 * rellena las claves pedidas en "campos", reutilizando los mismos
 * normalizadores tolerantes que el análisis completo. Las claves que no son
 * un campo válido de AnalisisFuncional se ignoran silenciosamente (ya se
 * validaron antes en la API route; esto es una segunda barrera).
 */
export function normalizarFragmento(
  campos: string[],
  json: unknown,
  lineas: string[]
): Partial<AnalisisFuncional> {
  const d = comoObjeto(json);
  const resultado: Partial<AnalisisFuncional> = {};

  for (const campo of campos) {
    if (esCampoDeAnalisis(campo)) {
      asignarCampoNormalizado(resultado, campo, d, lineas);
    }
  }

  return resultado;
}
