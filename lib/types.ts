import type { Cita } from "./citas";

export type { Cita };

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

/**
 * Distingue si la persona no sabe emitir la conducta adecuada o sabe pero otra
 * contingencia lo impide. Cambia por completo la intervención: adquisición
 * (modelado, ensayo, moldeamiento) frente a exposición o manejo de contingencias.
 */
export type DeficitOInterferencia =
  | "deficit"
  | "interferencia"
  | "mixto"
  | "no_determinable";

export interface ConductaProblema {
  descripcion: string;
  tipo: TipoConducta;
  importancia: NivelConfianza;
  /** Conducta que alivia dentro de la situación temida sin resolverla: blanco de eliminación, nunca de prescripción. */
  es_conducta_seguridad: boolean;
  deficit_o_interferencia: DeficitOInterferencia;
  justificacion_deficit: string;
  evidencia: Cita;
}

export interface VariableModuladora {
  tipo: TipoVariableModuladora;
  descripcion: string;
  evidencia: Cita;
}

/**
 * Ciclo de acomodación del entorno (principio 7): alguien del entorno hace
 * gestiones por el consultante, responde por él, lo tranquiliza, lo sustituye
 * o le evita la situación temida. Antes vivía solo en prosa dentro de
 * variables_moduladoras/ciclo_interconductual; como campo propio se puede
 * validar y mostrar aparte.
 */
export interface Acomodacion {
  quien: string;
  conducta_acomodacion: string;
  funcion: string;
  evidencia: Cita;
}

/**
 * Revisión de indicadores de riesgo (principio 17): escalada de consumo,
 * ideación suicida o autolesión, riesgo laboral o legal, menores implicados,
 * violencia, deterioro físico. `evaluado: false` es una respuesta válida y
 * distinta de "sin indicadores": significa que la nota no daba base para
 * pronunciarse, no que se haya descartado el riesgo.
 */
export interface Riesgo {
  evaluado: boolean;
  indicadores: string[];
}

export interface CadenaOperante {
  antecedente: string;
  operacion_motivacional: string | null;
  respuesta: string;
  consecuencia: string;
  tipo_contingencia: TipoContingencia;
  inmediatez: "inmediata" | "demorada";
  /** Efecto a mediano/largo plazo del patrón (CMLP): coste o mantenimiento futuro, distinto de la consecuencia inmediata. */
  consecuencias_largo_plazo: string | null;
  evidencia: Cita;
}

export interface CadenaRespondiente {
  estimulo: string;
  respuesta_condicionada: string;
  conexion_con_operante: string | null;
  evidencia: Cita;
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
  evidencia: Cita;
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
  evidencia: Cita;
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

/**
 * Aviso metodológico producido por los validadores del servidor (lib/validadores.ts),
 * NO por el modelo. Señala problemas de coherencia del propio informe.
 */
export interface Alerta {
  codigo:
    | "confianza_sin_cita"
    | "conducta_sin_analisis"
    | "prescribe_conducta_seguridad"
    | "intervencion_depende_de_dato_faltante"
    | "riesgo_posible_no_detectado";
  gravedad: "alta" | "media";
  ruta: string;
  mensaje: string;
}

/**
 * Trazabilidad de la generación: qué modelo y qué versión del prompt la
 * produjeron. Lo fija el servidor (ver app/api/analizar/route.ts), igual que
 * `alertas` — el modelo no lo envía ni el reanálisis parcial lo toca.
 */
export interface MetaGeneracion {
  modelo: string;
  version_prompt: string;
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
  /** Principio 7: ciclos de acomodación del entorno, con quién y qué función. */
  acomodacion_entorno: Acomodacion[];
  /** Principio 18: direcciones valiosas o metas que el consultante expresa. */
  valores_y_metas: string[];
  /** Principio 19: actividades reforzantes abandonadas y su papel en el mantenimiento. */
  perdida_de_reforzadores: string[];
  /** Principio 17: revisión de indicadores de riesgo. Ver tipo Riesgo. */
  riesgo: Riesgo;
  /** Lo rellena el servidor tras validar; el modelo nunca lo envía. */
  alertas: Alerta[];
  /**
   * Qué bloques se pidieron en esta generación (ver lib/bloques.ts). Vacío
   * significa informe completo, para no romper los análisis guardados antes de
   * que existiera el análisis por partes.
   */
  campos_generados: string[];
  /** Modelo y versión de prompt que generaron este informe. Ver MetaGeneracion. */
  meta: MetaGeneracion;
}

/**
 * Única fuente de verdad de las claves de nivel superior de AnalisisFuncional
 * que se pueden reanalizar por separado (ver /api/reanalizar-seccion y
 * lib/parseAnalisis.ts#normalizarFragmento). La línea de abajo no compila si
 * falta o sobra una clave respecto a AnalisisFuncional — así, si agregas un
 * campo nuevo al análisis y olvidas añadirlo aquí, el build falla en vez de
 * fallar en silencio en producción.
 */
export const CAMPOS_ANALISIS_FUNCIONAL = [
  "resumen_clinico",
  "conductas_problema",
  "variables_moduladoras",
  "situaciones",
  "hipotesis_mantenimiento",
  "hipotesis_origen",
  "formulacion",
  "conductas_alternativas",
  "capa_act",
  "capa_dbt",
  "capa_mc",
  "hipotesis_alternativas",
  "preguntas_para_sesion",
  "lineas_de_intervencion_tentativas",
  "datos_faltantes",
  "acomodacion_entorno",
  "valores_y_metas",
  "perdida_de_reforzadores",
  "riesgo",
  "alertas",
  "campos_generados",
  "meta",
] as const satisfies readonly (keyof AnalisisFuncional)[];

type _TodasLasClavesCubiertas =
  keyof AnalisisFuncional extends (typeof CAMPOS_ANALISIS_FUNCIONAL)[number]
    ? true
    : ["Falta una clave de AnalisisFuncional en CAMPOS_ANALISIS_FUNCIONAL"];
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _chequeoCamposCompletos: _TodasLasClavesCubiertas = true;
