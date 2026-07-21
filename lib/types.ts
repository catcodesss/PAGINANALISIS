export type NivelConfianza = "alta" | "media" | "baja";

export type ModeloTerapeutico = "act" | "dbt";

export interface HabilidadRecomendada {
  habilidad: string;
  modulo: string;
  justificacion: string;
  como_practicarla: string;
}

export interface ConductaProblema {
  descripcion: string;
  tipo: string;
  evidencia: string;
}

export interface EstimuloDiscriminativo {
  descripcion: string;
  evidencia: string;
}

export interface ContextoSituacional {
  descripcion: string;
  evidencia: string;
}

export interface Antecedentes {
  estimulos_discriminativos: EstimuloDiscriminativo[];
  contexto_situacional: ContextoSituacional[];
  confianza: NivelConfianza;
}

export interface OperacionMotivacional {
  tipo: string;
  descripcion: string;
  efecto_hipotetizado: string;
  evidencia: string;
}

export interface Contingencia {
  tipo: string;
  descripcion: string;
  inmediatez: string;
  evidencia: string;
}

export interface ConsecuenciasYMantenimiento {
  contingencias: Contingencia[];
  confianza: NivelConfianza;
}

export interface HipotesisFuncionalPrincipal {
  enunciado: string;
  funcion: string;
  confianza: NivelConfianza;
}

export interface HipotesisAlternativa {
  enunciado: string;
  como_descartarla: string;
}

export interface ReglaVerbal {
  regla: string;
  clase: string;
  rigidez: NivelConfianza;
  analisis: string;
}

export interface ProcesoACT {
  proceso: string;
  descripcion: string;
  evidencia: string;
}

export interface AnalisisFuncional {
  resumen_clinico: string;
  conductas_problema: ConductaProblema[];
  antecedentes: Antecedentes;
  operaciones_motivacionales: OperacionMotivacional[];
  consecuencias_y_mantenimiento: ConsecuenciasYMantenimiento;
  hipotesis_funcional_principal: HipotesisFuncionalPrincipal;
  hipotesis_alternativas: HipotesisAlternativa[];
  reglas_verbales: ReglaVerbal[];
  procesos_act: ProcesoACT[];
  preguntas_para_sesion: string[];
  lineas_de_intervencion_tentativas: string[];
  datos_faltantes: string[];
  modelo_terapeutico: ModeloTerapeutico;
  habilidades_recomendadas: HabilidadRecomendada[];
}
