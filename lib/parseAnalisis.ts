import type { AnalisisFuncional, NivelConfianza } from "./types";

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

function comoObjeto(valor: unknown): Record<string, unknown> {
  return typeof valor === "object" && valor !== null
    ? (valor as Record<string, unknown>)
    : {};
}

function comoConfianza(valor: unknown): NivelConfianza {
  return valor === "alta" || valor === "media" || valor === "baja"
    ? valor
    : "baja";
}

/**
 * Garantiza la forma completa de AnalisisFuncional aunque el modelo omita
 * claves: las listas ausentes se convierten en arreglos vacíos en lugar de
 * romper la interfaz.
 */
export function normalizarAnalisis(json: unknown): AnalisisFuncional {
  const datos = comoObjeto(json);
  const antecedentes = comoObjeto(datos.antecedentes);
  const consecuencias = comoObjeto(datos.consecuencias_y_mantenimiento);
  const hipotesisPrincipal = comoObjeto(datos.hipotesis_funcional_principal);

  return {
    resumen_clinico: comoTexto(datos.resumen_clinico),
    conductas_problema: comoArreglo(datos.conductas_problema),
    antecedentes: {
      estimulos_discriminativos: comoArreglo(
        antecedentes.estimulos_discriminativos
      ),
      contexto_situacional: comoArreglo(antecedentes.contexto_situacional),
      confianza: comoConfianza(antecedentes.confianza),
    },
    operaciones_motivacionales: comoArreglo(datos.operaciones_motivacionales),
    consecuencias_y_mantenimiento: {
      contingencias: comoArreglo(consecuencias.contingencias),
      confianza: comoConfianza(consecuencias.confianza),
    },
    hipotesis_funcional_principal: {
      enunciado: comoTexto(hipotesisPrincipal.enunciado),
      funcion: comoTexto(hipotesisPrincipal.funcion),
      confianza: comoConfianza(hipotesisPrincipal.confianza),
    },
    hipotesis_alternativas: comoArreglo(datos.hipotesis_alternativas),
    reglas_verbales: comoArreglo(datos.reglas_verbales),
    procesos_act: comoArreglo(datos.procesos_act),
    preguntas_para_sesion: comoArreglo<string>(datos.preguntas_para_sesion),
    lineas_de_intervencion_tentativas: comoArreglo<string>(
      datos.lineas_de_intervencion_tentativas
    ),
    datos_faltantes: comoArreglo<string>(datos.datos_faltantes),
  };
}
