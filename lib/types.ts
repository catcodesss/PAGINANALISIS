export type NivelConfianza = "alta" | "media" | "baja";
export type ModeloTerapeutico = "act" | "dbt" | "mc";
export type TipoConducta = "manifiesta" | "encubierta";
export type TipoVariableModuladora =
  | "biologica"
  | "historia_de_aprendizaje"
  | "contextual";
export type TipoContingencia =
  | "refuerzo positivo"
  | "refuerzo negativo"
  | "castigo positivo"
  | "castigo negativo"
  | "extincion";

export interface ConductaProblema {
  descripcion: string;
  tipo: TipoConducta;
  importancia: NivelConfianza;
  evidencia: string;
}

export interface VariableModuladora {
  tipo: TipoVariableModuladora;
  descripcion: string;
  evidencia: string;
}

export interface CadenaOperante {
  antecedente: string;
  operacion_motivacional: string | null;
  respuesta: string;
  consecuencia: string;
  tipo_contingencia: TipoContingencia;
  inmediatez: "inmediata" | "demorada";
  evidencia: string;
}

export interface CadenaRespondiente {
  estimulo: string;
  respuesta_condicionada: string;
  conexion_con_operante: string | null;
  evidencia: string;
}

/**
 * Cadena de eslabones al estilo DBT para la misma situación: lo que en la
 * cadena operante se conceptualiza como operación motivacional (OE/OA) aquí
 * se conceptualiza como factores de vulnerabilidad dentro de una cadena de
 * eslabones. Se genera siempre junto a cadena_operante (no una en vez de la
 * otra) para poder alternar de pestaña sin volver a consultar la IA.
 */
export interface CadenaDBT {
  factores_vulnerabilidad: string[];
  evento_precipitante: string;
  eslabones: EslabonDBT[];
  conducta_problema: string;
  consecuencias: string;
  evidencia: string;
}

export interface Situacion {
  nombre: string;
  cadena_operante: CadenaOperante | null;
  cadena_respondiente: CadenaRespondiente | null;
  cadena_dbt: CadenaDBT | null;
  ciclo_interconductual: string | null;
  funcion_hipotetizada: string;
  confianza: NivelConfianza;
}

export interface HipotesisMantenimiento {
  conducta: string;
  enunciado: string;
  funcion: string;
  confianza: NivelConfianza;
}

export interface PriorizacionBlanco {
  blanco: string;
  justificacion: string;
}

export interface Formulacion {
  relaciones_entre_problemas: string[];
  priorizacion: PriorizacionBlanco[];
}

export interface ConductaAlternativa {
  situacion: string;
  conducta_propuesta: string;
  consecuencia_necesaria: string;
}

export interface HipotesisAlternativa {
  enunciado: string;
  como_descartarla: string;
}

// --- Capas de modalidad: las tres se generan siempre en la misma llamada,
// para poder alternar entre ellas en pantalla sin volver a consultar la IA. ---

export interface ReglaVerbal {
  regla: string;
  textual_o_inferida: "textual" | "inferida";
  clase: "pliance" | "tracking" | "augmenting";
  rigidez: NivelConfianza;
  analisis: string;
}

export interface ProcesoACT {
  proceso: string;
  vinculo_con_cadena: string;
  evidencia: string;
}

export interface CapaModalidadACT {
  reglas_verbales: ReglaVerbal[];
  procesos_act: ProcesoACT[];
}

export type TipoEslabonDBT =
  | "pensamiento"
  | "emocion"
  | "sensacion"
  | "impulso"
  | "accion";

export interface EslabonDBT {
  tipo: TipoEslabonDBT;
  descripcion: string;
}

export interface AnalisisEnCadenaDBT {
  conducta_objetivo: string;
  vulnerabilidades: string[];
  evento_precipitante: string;
  eslabones: EslabonDBT[];
  consecuencias_corto_plazo: string[];
  consecuencias_largo_plazo: string[];
}

export type ModuloDBT =
  | "mindfulness"
  | "tolerancia_al_malestar"
  | "regulacion_emocional"
  | "efectividad_interpersonal";

export interface HabilidadSugeridaDBT {
  modulo: ModuloDBT;
  habilidad: string;
  eslabon_objetivo: string;
}

export interface CapaModalidadDBT {
  analisis_en_cadena: AnalisisEnCadenaDBT;
  habilidades_sugeridas: HabilidadSugeridaDBT[];
}

export interface ProcedimientoSugeridoMC {
  procedimiento: string;
  contingencia_objetivo: string;
  precauciones: string;
}

export interface CapaModalidadMC {
  procedimientos_sugeridos: ProcedimientoSugeridoMC[];
}

export interface AnalisisFuncional {
  resumen_clinico: string;
  conductas_problema: ConductaProblema[];
  variables_moduladoras: VariableModuladora[];
  situaciones: Situacion[];
  hipotesis_mantenimiento: HipotesisMantenimiento[];
  hipotesis_origen: string[];
  formulacion: Formulacion;
  conductas_alternativas: ConductaAlternativa[];
  capa_act: CapaModalidadACT;
  capa_dbt: CapaModalidadDBT;
  capa_mc: CapaModalidadMC;
  hipotesis_alternativas: HipotesisAlternativa[];
  preguntas_para_sesion: string[];
  lineas_de_intervencion_tentativas: string[];
  datos_faltantes: string[];
}
