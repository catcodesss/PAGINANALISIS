export type NivelConfianza = "alta" | "media" | "baja";

export type ModeloTerapeutico = "act" | "dbt";

export interface HabilidadRecomendada {
  habilidad: string;
  modulo: string;
  justificacion: string;
  como_practicarla: string;
}

export type TipoRespuesta = "operante" | "respondiente";
export type TipoManifestacion = "manifiesta" | "encubierta";
export type CategoriaVariableModuladora = "personal" | "ambiental";
export type TipoContingencia =
  | "refuerzo positivo"
  | "refuerzo negativo"
  | "castigo positivo"
  | "castigo negativo"
  | "extincion";

export interface VariableModuladora {
  descripcion: string;
  categoria: CategoriaVariableModuladora;
  evidencia: string;
}

export interface EslabonCadena {
  antecedente: { descripcion: string; evidencia: string };
  operacion_motivacional: {
    tipo: "establecedora" | "abolidora";
    descripcion: string;
    evidencia: string;
  } | null;
  conducta: {
    descripcion: string;
    tipo_manifestacion: TipoManifestacion;
    tipo_respuesta: TipoRespuesta;
    evidencia: string;
  };
  /** null cuando tipo_respuesta = "respondiente": no está mantenida por una consecuencia. */
  consecuencia: {
    tipo: TipoContingencia;
    descripcion: string;
    inmediatez: "inmediata" | "demorada";
    evidencia: string;
  } | null;
}

export interface HipotesisAlternativa {
  enunciado: string;
  como_descartarla: string;
}

export interface AnalisisSituacional {
  id: string;
  contexto: string;
  patron_central: boolean;
  cadena: EslabonCadena[];
  hipotesis: {
    enunciado: string;
    funcion: string;
    confianza: NivelConfianza;
  };
  hipotesis_alternativas: HipotesisAlternativa[];
  consecuencias_mantenimiento_largo_plazo: {
    descripcion: string;
    evidencia: string;
  } | null;
}

export interface AnalisisCuidador {
  situacion_id: string | null;
  patron: string;
  descripcion: string;
  evidencia: string;
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
  variables_moduladoras: VariableModuladora[];
  analisis_situacional: AnalisisSituacional[];
  analisis_cuidador: AnalisisCuidador[];
  reglas_verbales: ReglaVerbal[];
  procesos_act: ProcesoACT[];
  preguntas_para_sesion: string[];
  lineas_de_intervencion_tentativas: string[];
  datos_faltantes: string[];
  modelo_terapeutico: ModeloTerapeutico;
  habilidades_recomendadas: HabilidadRecomendada[];
}
