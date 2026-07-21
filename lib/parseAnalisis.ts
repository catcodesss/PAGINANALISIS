import type {
  AnalisisCuidador,
  AnalisisFuncional,
  AnalisisSituacional,
  EslabonCadena,
  ModeloTerapeutico,
  NivelConfianza,
  TipoContingencia,
} from "./types";

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

/**
 * Claude puede envolver el JSON en texto o fences pese a la instrucción del
 * system prompt. Se localiza la primera "{" y la última "}" para aislar el
 * objeto antes de intentar el parseo.
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

function comoBooleano(valor: unknown): boolean {
  return valor === true;
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

function normalizarEslabon(valor: unknown): EslabonCadena {
  const datos = comoObjeto(valor);
  const antecedente = comoObjeto(datos.antecedente);
  const conducta = comoObjeto(datos.conducta);
  const om = comoObjetoONulo(datos.operacion_motivacional);
  const consecuencia = comoObjetoONulo(datos.consecuencia);

  return {
    antecedente: {
      descripcion: comoTexto(antecedente.descripcion),
      evidencia: comoTexto(antecedente.evidencia),
    },
    operacion_motivacional: om
      ? {
          tipo: om.tipo === "abolidora" ? "abolidora" : "establecedora",
          descripcion: comoTexto(om.descripcion),
          evidencia: comoTexto(om.evidencia),
        }
      : null,
    conducta: {
      descripcion: comoTexto(conducta.descripcion),
      tipo_manifestacion:
        conducta.tipo_manifestacion === "encubierta"
          ? "encubierta"
          : "manifiesta",
      tipo_respuesta:
        conducta.tipo_respuesta === "respondiente"
          ? "respondiente"
          : "operante",
      evidencia: comoTexto(conducta.evidencia),
    },
    consecuencia: consecuencia
      ? {
          tipo: comoTipoContingencia(consecuencia.tipo),
          descripcion: comoTexto(consecuencia.descripcion),
          inmediatez: consecuencia.inmediatez === "demorada" ? "demorada" : "inmediata",
          evidencia: comoTexto(consecuencia.evidencia),
        }
      : null,
  };
}

function normalizarSituacion(valor: unknown, indice: number): AnalisisSituacional {
  const datos = comoObjeto(valor);
  const hipotesis = comoObjeto(datos.hipotesis);
  const cmlp = comoObjetoONulo(datos.consecuencias_mantenimiento_largo_plazo);

  return {
    id: comoTexto(datos.id, `situacion-${indice + 1}`),
    contexto: comoTexto(datos.contexto, `Situación ${indice + 1}`),
    patron_central: comoBooleano(datos.patron_central),
    cadena: comoArreglo<unknown>(datos.cadena).map(normalizarEslabon),
    hipotesis: {
      enunciado: comoTexto(hipotesis.enunciado),
      funcion: comoTexto(hipotesis.funcion),
      confianza: comoConfianza(hipotesis.confianza),
    },
    hipotesis_alternativas: comoArreglo(datos.hipotesis_alternativas),
    consecuencias_mantenimiento_largo_plazo: cmlp
      ? {
          descripcion: comoTexto(cmlp.descripcion),
          evidencia: comoTexto(cmlp.evidencia),
        }
      : null,
  };
}

function normalizarCuidador(valor: unknown): AnalisisCuidador {
  const datos = comoObjeto(valor);
  return {
    situacion_id:
      typeof datos.situacion_id === "string" ? datos.situacion_id : null,
    patron: comoTexto(datos.patron),
    descripcion: comoTexto(datos.descripcion),
    evidencia: comoTexto(datos.evidencia),
  };
}

/**
 * Garantiza la forma completa de AnalisisFuncional aunque el modelo omita
 * claves: las listas ausentes se convierten en arreglos vacíos en lugar de
 * romper la interfaz. Si ninguna situación viene marcada como patron_central,
 * se marca la primera para que el informe siempre tenga un titular.
 */
export function normalizarAnalisis(
  json: unknown,
  modelo: ModeloTerapeutico
): AnalisisFuncional {
  const datos = comoObjeto(json);

  const analisisSituacional = comoArreglo<unknown>(
    datos.analisis_situacional
  ).map(normalizarSituacion);

  if (
    analisisSituacional.length > 0 &&
    !analisisSituacional.some((s) => s.patron_central)
  ) {
    analisisSituacional[0].patron_central = true;
  }

  return {
    resumen_clinico: comoTexto(datos.resumen_clinico),
    variables_moduladoras: comoArreglo(datos.variables_moduladoras),
    analisis_situacional: analisisSituacional,
    analisis_cuidador: comoArreglo<unknown>(datos.analisis_cuidador).map(
      normalizarCuidador
    ),
    reglas_verbales: comoArreglo(datos.reglas_verbales),
    procesos_act: comoArreglo(datos.procesos_act),
    preguntas_para_sesion: comoArreglo<string>(datos.preguntas_para_sesion),
    lineas_de_intervencion_tentativas: comoArreglo<string>(
      datos.lineas_de_intervencion_tentativas
    ),
    datos_faltantes: comoArreglo<string>(datos.datos_faltantes),
    modelo_terapeutico: modelo,
    habilidades_recomendadas: comoArreglo(datos.habilidades_recomendadas),
  };
}
