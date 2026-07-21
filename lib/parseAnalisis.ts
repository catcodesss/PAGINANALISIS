import type {
  AnalisisFuncional,
  CadenaOperante,
  CadenaRespondiente,
  CapaModalidad,
  ConductaAlternativa,
  ConductaProblema,
  Formulacion,
  HipotesisAlternativa,
  HipotesisMantenimiento,
  ModeloTerapeutico,
  NivelConfianza,
  PriorizacionBlanco,
  Situacion,
  TipoContingencia,
  VariableModuladora,
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

function normalizarConductaProblema(valor: unknown): ConductaProblema {
  const d = comoObjeto(valor);
  return {
    descripcion: comoTexto(d.descripcion),
    tipo: d.tipo === "encubierta" ? "encubierta" : "manifiesta",
    importancia: comoConfianza(d.importancia),
    evidencia: comoTexto(d.evidencia),
  };
}

function normalizarVariableModuladora(valor: unknown): VariableModuladora {
  const d = comoObjeto(valor);
  const tipo =
    d.tipo === "biologica" || d.tipo === "contextual"
      ? d.tipo
      : "historia_de_aprendizaje";
  return {
    tipo,
    descripcion: comoTexto(d.descripcion),
    evidencia: comoTexto(d.evidencia),
  };
}

function normalizarCadenaOperante(valor: unknown): CadenaOperante | null {
  const d = comoObjetoONulo(valor);
  if (!d) return null;
  return {
    antecedente: comoTexto(d.antecedente),
    operacion_motivacional: comoTextoONulo(d.operacion_motivacional),
    respuesta: comoTexto(d.respuesta),
    consecuencia: comoTexto(d.consecuencia),
    tipo_contingencia: comoTipoContingencia(d.tipo_contingencia),
    inmediatez: d.inmediatez === "demorada" ? "demorada" : "inmediata",
    evidencia: comoTexto(d.evidencia),
  };
}

function normalizarCadenaRespondiente(valor: unknown): CadenaRespondiente | null {
  const d = comoObjetoONulo(valor);
  if (!d) return null;
  return {
    estimulo: comoTexto(d.estimulo),
    respuesta_condicionada: comoTexto(d.respuesta_condicionada),
    conexion_con_operante: comoTextoONulo(d.conexion_con_operante),
    evidencia: comoTexto(d.evidencia),
  };
}

function normalizarSituacion(valor: unknown, indice: number): Situacion {
  const d = comoObjeto(valor);
  return {
    nombre: comoTexto(d.nombre, `Situación ${indice + 1}`),
    cadena_operante: normalizarCadenaOperante(d.cadena_operante),
    cadena_respondiente: normalizarCadenaRespondiente(d.cadena_respondiente),
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
    relaciones_entre_problemas: comoArreglo<string>(d.relaciones_entre_problemas),
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

function normalizarCapaModalidad(
  modelo: ModeloTerapeutico,
  valor: unknown
): CapaModalidad {
  const d = comoObjeto(valor);

  if (modelo === "dbt") {
    const cadena = comoObjeto(d.analisis_en_cadena);
    return {
      modalidad: "dbt",
      analisis_en_cadena: {
        conducta_objetivo: comoTexto(cadena.conducta_objetivo),
        vulnerabilidades: comoArreglo<string>(cadena.vulnerabilidades),
        evento_precipitante: comoTexto(cadena.evento_precipitante),
        eslabones: comoArreglo<unknown>(cadena.eslabones).map((e) => {
          const eo = comoObjeto(e);
          const tiposValidos = [
            "pensamiento",
            "emocion",
            "sensacion",
            "impulso",
            "accion",
          ];
          return {
            tipo: tiposValidos.includes(eo.tipo as string)
              ? (eo.tipo as "pensamiento")
              : "pensamiento",
            descripcion: comoTexto(eo.descripcion),
          };
        }),
        consecuencias_corto_plazo: comoArreglo<string>(
          cadena.consecuencias_corto_plazo
        ),
        consecuencias_largo_plazo: comoArreglo<string>(
          cadena.consecuencias_largo_plazo
        ),
      },
      habilidades_sugeridas: comoArreglo<unknown>(d.habilidades_sugeridas).map(
        (h) => {
          const ho = comoObjeto(h);
          const modulosValidos = [
            "mindfulness",
            "tolerancia_al_malestar",
            "regulacion_emocional",
            "efectividad_interpersonal",
          ];
          return {
            modulo: modulosValidos.includes(ho.modulo as string)
              ? (ho.modulo as "mindfulness")
              : "mindfulness",
            habilidad: comoTexto(ho.habilidad),
            eslabon_objetivo: comoTexto(ho.eslabon_objetivo),
          };
        }
      ),
    };
  }

  if (modelo === "mc") {
    return {
      modalidad: "mc",
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

  return {
    modalidad: "act",
    reglas_verbales: comoArreglo<unknown>(d.reglas_verbales).map((r) => {
      const ro = comoObjeto(r);
      return {
        regla: comoTexto(ro.regla),
        textual_o_inferida: ro.textual_o_inferida === "inferida" ? "inferida" : "textual",
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
        evidencia: comoTexto(po.evidencia),
      };
    }),
  };
}

/**
 * Garantiza la forma completa de AnalisisFuncional aunque el modelo omita
 * claves: las listas ausentes se convierten en arreglos vacíos y los objetos
 * ausentes en null, en lugar de romper la interfaz.
 */
export function normalizarAnalisis(
  json: unknown,
  modelo: ModeloTerapeutico
): AnalisisFuncional {
  const d = comoObjeto(json);

  return {
    modalidad: modelo,
    resumen_clinico: comoTexto(d.resumen_clinico),
    conductas_problema: comoArreglo<unknown>(d.conductas_problema).map(
      normalizarConductaProblema
    ),
    variables_moduladoras: comoArreglo<unknown>(d.variables_moduladoras).map(
      normalizarVariableModuladora
    ),
    situaciones: comoArreglo<unknown>(d.situaciones).map(normalizarSituacion),
    hipotesis_mantenimiento: comoArreglo<unknown>(
      d.hipotesis_mantenimiento
    ).map(normalizarHipotesisMantenimiento),
    hipotesis_origen: comoArreglo<string>(d.hipotesis_origen),
    formulacion: normalizarFormulacion(d.formulacion),
    conductas_alternativas: comoArreglo<unknown>(d.conductas_alternativas).map(
      normalizarConductaAlternativa
    ),
    capa_modalidad: normalizarCapaModalidad(modelo, d.capa_modalidad),
    hipotesis_alternativas: comoArreglo<unknown>(d.hipotesis_alternativas).map(
      normalizarHipotesisAlternativa
    ),
    preguntas_para_sesion: comoArreglo<string>(d.preguntas_para_sesion),
    lineas_de_intervencion_tentativas: comoArreglo<string>(
      d.lineas_de_intervencion_tentativas
    ),
    datos_faltantes: comoArreglo<string>(d.datos_faltantes),
  };
}
