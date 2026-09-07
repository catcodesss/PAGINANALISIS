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

/**
 * La conducta adecuada que el consultante SÍ emite, y dónde.
 *
 * Es la tercera columna del repertorio, junto a los excesos y los déficits, y
 * cambia el tratamiento: si la conducta ya está en el repertorio y solo falta
 * en el contexto problemático, el problema es de generalización y no de
 * adquisición — lo que descarta el entrenamiento en habilidades como primera
 * línea y lo sustituye por trabajar el control de estímulos y las
 * contingencias del contexto donde no aparece.
 */
export interface RepertorioDisponible {
  descripcion: string;
  /** Dónde, con quién o bajo qué condiciones sí ocurre. Sin esto el dato no sirve. */
  contexto_en_que_ocurre: string;
  evidencia: Cita | null;
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

/**
 * Cada cuánto sigue la consecuencia a la respuesta. No es lo mismo que
 * `tipo_contingencia` (esa dice QUÉ pasa: R+/R−/C+/C−/extinción) y no se
 * deduce de ella: es CON QUÉ REGULARIDAD pasa.
 *
 * Explica la resistencia a la extinción, que es la variable que decide la
 * dosis de tratamiento. Un alivio que llega siempre se apaga rápido en cuanto
 * deja de llegar; uno intermitente sostiene la evitación mucho más tiempo, y
 * exige bastante más exposición antes de que el patrón ceda. Sin este dato,
 * dos cadenas idénticas sobre el papel piden planes de intervención distintos
 * sin que nada lo indique.
 *
 * "no_determinable" es una respuesta válida y frecuente: la nota de una sesión
 * rara vez dice cada cuánto ocurre algo, y adivinarlo aquí produciría una dosis
 * de exposición apoyada en nada.
 */
export type EsquemaDeContingencia = "continua" | "intermitente" | "no_determinable";

/**
 * Cómo se nombra cada esquema de cara al clínico. Vive junto al tipo y no en
 * el componente porque el informe exportado escribe lo mismo: dos redacciones
 * del mismo dato acabarían diciendo cosas distintas.
 */
export const ETIQUETA_ESQUEMA: Record<EsquemaDeContingencia, string> = {
  continua: "esquema continuo",
  intermitente: "esquema intermitente",
  no_determinable: "esquema no determinable",
};

export interface CadenaOperante {
  antecedente: string;
  operacion_motivacional: string | null;
  respuesta: string;
  consecuencia: string;
  tipo_contingencia: TipoContingencia;
  /** Cada cuánto sigue la consecuencia. Ver EsquemaDeContingencia. */
  esquema_de_contingencia: EsquemaDeContingencia;
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

/**
 * Un hueco de la nota y por qué importa.
 *
 * Antes era una lista de cadenas sueltas. "Frecuencia de los episodios" no le
 * dice al terapeuta si eso es un matiz que se puede confirmar cuando toque o
 * un bloqueante que invalida la priorización del informe entero, y esa
 * diferencia es justo la que decide qué se pregunta en la próxima sesión.
 */
export interface DatoFaltante {
  dato: string;
  /** Qué parte del análisis queda en el aire mientras no se sepa. */
  por_que_importa: string;
}

/**
 * Una pregunta del paso previo al análisis (ver lib/datosFaltantesPrevios.ts),
 * con el porqué que acompañará al hueco si el terapeuta responde "No sé". El
 * porqué viaja desde aquí y no se inventa después: quien detectó el vacío es
 * quien sabe qué parte del análisis deja en el aire.
 */
export interface PreguntaPrevia {
  pregunta: string;
  por_que_importa: string;
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

/**
 * Análisis de soluciones: por cada eslabón de la cadena, qué habría podido
 * hacerse en su lugar. Es la mitad terapéutica del análisis en cadena — sin
 * ella la cadena solo describe cómo se llegó a la conducta problema, que es
 * exactamente lo que el consultante ya sabe.
 *
 * `tipo_estrategia` distingue las dos formas de romper una cadena, y no es un
 * matiz: "antecedente" actúa ANTES de que el eslabón ocurra (cambiar la
 * situación, salir del contexto, resolver la vulnerabilidad) y "respuesta"
 * actúa CUANDO ya está ocurriendo (tolerar, regular, actuar de otro modo). La
 * primera es más fiable y la segunda es la única disponible una vez la cadena
 * arrancó; confundirlas produce planes que solo funcionan en el momento en que
 * ya es tarde.
 */
export interface SolucionDBT {
  eslabon_objetivo: string;
  alternativa_habil: string;
  tipo_estrategia: "antecedente" | "respuesta";
}

export interface CapaModalidadDBT {
  analisis_en_cadena: AnalisisEnCadenaDBT;
  habilidades_sugeridas: HabilidadSugeridaDBT[];
  /** Qué hacer en cada eslabón en lugar de lo que se hizo. Ver SolucionDBT. */
  analisis_de_soluciones: SolucionDBT[];
  /** Cómo reducir las vulnerabilidades que abren la cadena, antes de que empiece. */
  plan_de_prevencion: string[];
  /**
   * Solo si hubo daño real a terceros. `null` es lo normal, y es importante que
   * lo sea: convertir la reparación en un campo que siempre se rellena produce
   * disculpas de trámite, que es justo el gesto superficial que la reparación
   * genuina —reparar el daño concreto, no aliviar la culpa propia— pretende
   * evitar.
   */
  plan_de_reparacion: string | null;
  /**
   * Análisis de eslabón faltante: cuando lo relevante no es lo que se hizo sino
   * lo que NO se hizo (no pedir ayuda, no usar la habilidad que ya conoce, no
   * avisar). `null` cuando la cadena se explica por lo emitido.
   */
  eslabon_ausente: string | null;
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
    | "riesgo_posible_no_detectado"
    | "pasada_critica";
  gravedad: "alta" | "media";
  ruta: string;
  /**
   * El motivo, sin nombrar el fragmento concreto al que apunta. Va aparte de
   * `elemento` porque una misma causa alcanza a varias propuestas del informe:
   * en un caso de comprobación compulsiva, "comprobación ya cumple función de
   * alivio" vale para las seis intervenciones que la mencionan. Repetir el
   * motivo seis veces entierra el aviso bajo su propia repetición; con el
   * motivo separado, la interfaz agrupa y lo dice una vez.
   */
  mensaje: string;
  /** Fragmento del informe señalado. Ausente cuando la alerta es del informe entero. */
  elemento?: string;
  /**
   * "validador": lib/validadores.ts, determinista, sin IA, siempre el mismo
   * resultado. "ia": una segunda llamada a un modelo revisando al primero
   * (ver lib/pasadaCritica.ts) — es una opinión más, no una comprobación
   * determinista, y la interfaz debe distinguirla como tal.
   */
  origen: "validador" | "ia";
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
  /** La tercera columna del repertorio. Ver RepertorioDisponible. */
  repertorio_disponible: RepertorioDisponible[];
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
  datos_faltantes: DatoFaltante[];
  /** Principio 7: ciclos de acomodación del entorno, con quién y qué función. */
  acomodacion_entorno: Acomodacion[];
  /**
   * Lo que el consultante ya tiene a favor: repertorio disponible, apoyos
   * sociales, económicos y vocacionales, éxitos previos de afrontamiento y
   * exposición previa a intervenciones. Un informe que solo enumera déficits
   * describe a una persona que no existe, y deja fuera justo el material con
   * el que se construye la intervención. Vacío es una respuesta válida: la
   * alternativa —inventar fortalezas que la nota no sostiene— es peor.
   */
  fortalezas_y_recursos: string[];
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
  /**
   * Ids de las secciones del informe que el clínico ha editado a mano (ver
   * components/ReportView.tsx#SECCIONES). El modelo nunca lo envía: lo escribe
   * la interfaz al editar. Sirve para no presentar como generado por IA algo
   * que escribió el profesional, y al revés — la contrapartida del invariante 2
   * para el sentido inverso.
   */
  secciones_editadas: string[];
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
  "repertorio_disponible",
  "variables_moduladoras",
  "situaciones",
  "hipotesis_mantenimiento",
  "hipotesis_origen",
  "formulacion",
  "fortalezas_y_recursos",
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
  "secciones_editadas",
] as const satisfies readonly (keyof AnalisisFuncional)[];

type _TodasLasClavesCubiertas =
  keyof AnalisisFuncional extends (typeof CAMPOS_ANALISIS_FUNCIONAL)[number]
    ? true
    : ["Falta una clave de AnalisisFuncional en CAMPOS_ANALISIS_FUNCIONAL"];
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _chequeoCamposCompletos: _TodasLasClavesCubiertas = true;
