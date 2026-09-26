import type { Cita } from "./citas";

export type { Cita };

export type NivelConfianza = "alta" | "media" | "baja";
export type ModeloTerapeutico = "act" | "dbt" | "mc";
export type TipoConducta = "manifiesta" | "encubierta";
/**
 * Rejilla de contexto y procesos: dos ejes independientes en lugar de una sola
 * lista de categorías.
 *
 * La clasificación anterior —biológica / historia de aprendizaje / contextual—
 * mezclaba dos preguntas distintas en una. "Biológica" y "contextual" dicen a
 * QUÉ NIVEL opera la variable; "historia de aprendizaje" dice CUÁNDO se
 * adquirió, que es una pregunta ortogonal: un patrón aprendido en la infancia
 * puede operar hoy a nivel psicológico o sociocultural, y con la lista vieja
 * había que elegir entre decir dónde opera o decir que viene de atrás.
 *
 * Separados en `nivel`, `dimension` y `momento`, cada variable responde a las
 * tres preguntas sin que ninguna desplace a las otras, y las combinaciones que
 * el informe NO cubre se pueden ver de un vistazo — que es lo que convierte una
 * celda vacía en información sobre la evaluación.
 */
export type NivelVariable = "biofisiologico" | "psicologico" | "sociocultural";

/**
 * Las seis dimensiones de proceso. No son escuelas ni módulos: son las clases
 * de proceso que una variable puede modular.
 */
export type DimensionVariable =
  | "afecto"
  | "cognicion"
  | "atencion"
  | "self"
  | "motivacion"
  | "conducta";

/**
 * CUÁNDO se adquirió, no qué es. La historia de aprendizaje dejó de ser una
 * categoría hermana de "biológica" y "contextual" porque no es un tipo de
 * variable: es un eje aparte que se cruza con los otros dos.
 */
export type MomentoVariable = "historico" | "actual";
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

/**
 * Identidad de las entidades del análisis.
 *
 * Por qué existe: hasta la v2, todo se referenciaba por prosa. Una hipótesis de
 * mantenimiento nombraba su conducta escribiéndola otra vez, con otras palabras,
 * y quien quisiera saber de qué conducta hablaba tenía que emparejar raíces de
 * palabra en tiempo de render — lo hacían lib/redFuncional.ts, lib/priorizacion.ts
 * y `yaEnRepertorio` de lib/validadores.ts, cada uno por su cuenta y con la
 * posibilidad de concluir cosas distintas sobre el mismo par. Cuando el
 * emparejamiento fallaba, la red funcional descartaba la relación EN SILENCIO.
 *
 * LOS IDS LOS GENERA EL SERVIDOR, NUNCA EL MODELO. Un modelo no emite
 * identificadores estables, y pedírselos añadiría un campo que puede repetir,
 * omitir o inventar. Se asignan al normalizar (lib/parseAnalisis.ts) a partir de
 * la posición, y a partir de ahí viajan con la entidad: no se recalculan al
 * reordenar ni al borrar.
 *
 * La heurística de prosa no desaparece — sigue siendo lo único que puede casar
 * un texto del modelo con una entidad — pero pasa a ejecutarse UNA SOLA VEZ, en
 * el borde, y lo que no resuelve queda en `null`. Un vínculo sin resolver deja
 * de ser una arista que no se dibuja y pasa a ser un hueco que se ve.
 */
export type Id = string;

/**
 * Una consecuencia con identidad propia.
 *
 * El modelo sigue emitiendo un string; el servidor lo envuelve. Es la misma
 * asimetría que ya existe con `evidencia` (el modelo manda un rango de líneas y
 * se guarda una `Cita`): el contrato con el modelo no cambia, y la consecuencia
 * gana un id al que la flecha «conducta → consecuencia» puede apuntar.
 */
export interface Consecuencia {
  id: Id;
  texto: string;
}

export interface ConductaProblema {
  id: Id;
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
  id: Id;
  descripcion: string;
  /** Dónde, con quién o bajo qué condiciones sí ocurre. Sin esto el dato no sirve. */
  contexto_en_que_ocurre: string;
  evidencia: Cita | null;
}

export interface VariableModuladora {
  id: Id;
  /** A qué nivel opera. Ver NivelVariable. */
  nivel: NivelVariable;
  /** Qué clase de proceso modula. Ver DimensionVariable. */
  dimension: DimensionVariable;
  /** Cuándo se adquirió. Ver MomentoVariable. */
  momento: MomentoVariable;
  descripcion: string;
  /**
   * Cuánto puede cambiar ESTO con intervención. No es lo mismo que cuánto
   * importa: la historia de aprendizaje puede ser el factor más determinante
   * del caso y tener modificabilidad baja, y una rutina de sueño puede ser
   * secundaria y muy modificable. Confundir las dos escalas lleva a priorizar
   * lo que más pesa en la explicación en vez de lo que más puede moverse, que
   * es donde el tratamiento rinde.
   */
  modificabilidad: NivelConfianza;
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
  id: Id;
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
  consecuencia: Consecuencia;
  tipo_contingencia: TipoContingencia;
  /** Cada cuánto sigue la consecuencia. Ver EsquemaDeContingencia. */
  esquema_de_contingencia: EsquemaDeContingencia;
  inmediatez: "inmediata" | "demorada";
  /** Efecto a mediano/largo plazo del patrón (CMLP): coste o mantenimiento futuro, distinto de la consecuencia inmediata. */
  consecuencias_largo_plazo: Consecuencia | null;
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
  id: Id;
  nombre: string;
  /**
   * Qué conductas problema se analizan aquí, por id.
   *
   * No existía ninguna referencia entre situación y conducta: el vínculo se
   * adivinaba comparando la prosa de la situación con la de cada conducta, en
   * cada sitio que lo necesitaba. Lo resuelve el servidor al normalizar, con esa
   * misma heurística pero una sola vez; lo que no case se queda fuera de la
   * lista en vez de emparejarse con la conducta más parecida.
   */
  conductas_ids: Id[];
  cadena_operante: CadenaOperante | null;
  cadena_respondiente: CadenaRespondiente | null;
  cadena_dbt: CadenaDBT | null;
  ciclo_interconductual: string | null;
  funcion_hipotetizada: string;
  confianza: NivelConfianza;
}

/**
 * Qué papel juega una relación dentro de la formulación.
 *
 * - "causal": esta variable produce o sostiene el problema.
 * - "moderadora": altera la FUERZA de otra relación — el efecto existe igual
 *   sin ella, pero es mayor o menor según su valor ("la evitación aparece
 *   igual, pero se dispara los días de mal sueño").
 * - "mediadora": explica el MECANISMO por el que otra relación ocurre — es el
 *   paso intermedio a través del cual el efecto se produce ("la crítica lleva
 *   a la anticipación, y es la anticipación la que produce la evitación").
 *
 * La distinción decide dónde se interviene: sobre una moderadora se actúa para
 * atenuar el efecto, sobre una mediadora para cortarlo.
 */
export type TipoRelacion = "causal" | "moderadora" | "mediadora";

/**
 * Relación estructural persistida del grafo funcional.
 *
 * No sustituye a TipoRelacion: una arista dice qué nodos están trazados; la
 * hipótesis dice cómo interpreta clínicamente ese trazo. Mantener ambos ejes
 * separados permite borrar una conexión sin reescribir una interpretación.
 */
export type TipoArista = "secuencial" | "moderadora" | "bucle";

export interface Arista {
  id: Id;
  desde: Id;
  hasta: Id;
  tipo: TipoArista;
}

export interface HipotesisMantenimiento {
  id: Id;
  /** A qué conducta se refiere, con las palabras del modelo. Para mostrar. */
  conducta: string;
  /** El otro extremo nombrado por el modelo; el servidor lo resuelve a id. */
  origen: string;
  /**
   * Los dos extremos de la relación, resueltos a id.
   *
   * `destino_id` sale de `conducta`; `origen_id`, de `origen`. En informes
   * anteriores a la fase 4 se recupera desde el enunciado heredado. Son lo que permite a
   * lib/redFuncional.ts dibujar la arista sin adivinarla: antes extraía el
   * origen del enunciado por raíces de palabra y, si no lo encontraba, se
   * saltaba la relación sin decir nada. `null` significa que no se pudo
   * resolver, y eso ahora se ve como hueco en vez de desaparecer.
   */
  destino_id: Id | null;
  origen_id: Id | null;
  /** Prosa heredada o escrita a mano. La vista normal se deriva del grafo. */
  enunciado: string;
  funcion: string;
  confianza: NivelConfianza;
  /**
   * Cuánto pesa esta relación en el mantenimiento. Distinta de `confianza`,
   * que mide cuánto respalda la nota lo afirmado: una relación puede estar
   * bien documentada y pesar poco, o ser una inferencia sobre algo central.
   */
  fuerza: NivelConfianza;
  /** Si el efecto va en un sentido o los dos se alimentan (un bucle). */
  direccion: "unidireccional" | "bidireccional";
  tipo_relacion: TipoRelacion;
}

export interface PriorizacionBlanco {
  /** El blanco tal y como lo nombró el modelo. Para mostrar. */
  blanco: string;
  /** La conducta problema a la que corresponde, si se pudo resolver. */
  conducta_id: Id | null;
  justificacion: string;
}

export interface Formulacion {
  relaciones_entre_problemas: string[];
  priorizacion: PriorizacionBlanco[];
}

export interface ConductaAlternativa {
  id: Id;
  /** El nombre de la situación según el modelo. Para mostrar. */
  situacion: string;
  situacion_id: Id | null;
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

/**
 * Una línea de intervención, atada a su blanco y con su razón.
 *
 * Hasta el prompt 1.7.0 era una cadena suelta («Entrenamiento en habilidades de
 * afrontamiento»): no decía a qué conducta se dirigía ni sobre qué función
 * actuaba, y el terapeuta tenía que emparejarla de cabeza con el resto del
 * informe. Ahora el modelo nombra la conducta (el servidor la resuelve a id,
 * como `priorizacion`) y el porqué funcional.
 *
 * `intervencion` vacía con `depende_de` es una respuesta válida y deliberada:
 * «para este blanco no hay base para proponer nada hasta saber X» (principio
 * 29). Es mejor que un plan completo apoyado en lo que falta.
 *
 * Los informes anteriores se migran con `conducta: ""` y `conducta_id: null`:
 * no se intenta adivinar su blanco por las palabras de la intervención.
 */
export interface LineaIntervencion {
  /** A qué conducta problema se dirige, con las palabras del modelo. "" si es común al caso. */
  conducta: string;
  conducta_id: Id | null;
  intervencion: string;
  /** Sobre qué función o contingencia actúa, y por qué esta intervención y no otra. */
  porque: string;
  /** El dato de `datos_faltantes` del que depende; null si no depende de ninguno. */
  depende_de: string | null;
}

/**
 * Qué se mide, con qué, cada cuánto — y, sobre todo, qué habría que observar
 * para concluir que esta formulación estaba equivocada.
 *
 * `criterio_de_revision` es el campo que importa. Sin él, una formulación es un
 * documento: se escribe, se archiva y nada la obliga a rendir cuentas. Con él
 * es una hipótesis con fecha de revisión, que es lo que dice ser desde el
 * principio 1. Un criterio que no pueda salir mal ("si mejora, seguimos") no
 * cumple: tiene que nombrar la observación concreta que obligaría a rehacer el
 * análisis.
 *
 * Sin entrada para un blanco cuando la nota no da base para proponerla; es
 * preferible a un plan de medición inventado que el clínico acabaría siguiendo.
 */
export interface PlanDeMonitorizacion {
  /**
   * De qué blanco es. Desde el prompt 1.7.0 hay uno por blanco: una sola tabla
   * para exposición laboral, alcohol y asertividad mezclaba indicadores que se
   * revisan por separado y con criterios distintos.
   */
  conducta: string;
  conducta_id: Id | null;
  que_se_mide: string;
  con_que: string;
  cada_cuanto: string;
  criterio_de_revision: string;
}

/**
 * En qué punto está cada blanco del plan, según el clínico. Ver lib/plan.ts.
 *
 * No es contenido del informe sino una decisión sobre él, así que cambiarlo no
 * marca la sección como editada (invariante 6 habla de texto escrito a mano):
 * aprobar una propuesta no la convierte en texto del clínico.
 */
export type EstadoPlan = "propuesto" | "revisar" | "aprobado" | "en_curso" | "descartado";

export interface HipotesisAlternativa {
  enunciado: string;
  como_descartarla: string;
}

// --- Capas de modalidad: las tres se generan siempre en la misma llamada,
// para poder alternar entre ellas en pantalla sin volver a consultar la IA. ---

export interface ReglaVerbal {
  id: Id;
  regla: string;
  textual_o_inferida: "textual" | "inferida";
  clase: "pliance" | "tracking" | "augmenting";
  rigidez: NivelConfianza;
  analisis: string;
}

export interface ProcesoACT {
  id: Id;
  proceso: string;
  /**
   * Cómo se engancha el proceso a la cadena, en prosa. A diferencia de las otras
   * referencias, esta NO es redundante con lo que apunta: dice algo que el id no
   * dice, así que los ids se añaden y el texto se queda.
   */
  vinculo_con_cadena: string;
  situacion_id: Id | null;
  eslabon_id: Id | null;
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
  id: Id;
  tipo: TipoEslabonDBT;
  descripcion: string;
}

export type ModuloDBT =
  | "mindfulness"
  | "tolerancia_al_malestar"
  | "regulacion_emocional"
  | "efectividad_interpersonal";

export interface HabilidadSugeridaDBT {
  modulo: ModuloDBT;
  habilidad: string;
  /** El eslabón según el modelo. Para mostrar cuando el id no resuelva. */
  eslabon_objetivo: string;
  eslabon_id: Id | null;
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
  id: Id;
  /** El eslabón según el modelo. Para mostrar cuando el id no resuelva. */
  eslabon_objetivo: string;
  eslabon_id: Id | null;
  alternativa_habil: string;
  tipo_estrategia: "antecedente" | "respuesta";
}

/**
 * La capa DBT ya no lleva `analisis_en_cadena`.
 *
 * Era una copia literal de la `cadena_dbt` de una de las situaciones: mismos
 * factores de vulnerabilidad, mismo evento precipitante, mismos eslabones y las
 * mismas consecuencias partidas en corto y largo plazo. Dos copias del mismo
 * análisis que nada obligaba a coincidir, y un campo más que generar en cada
 * llamada. La cadena vive donde siempre debió: en su situación, que además es la
 * que tiene los eslabones a los que apuntan las habilidades y las soluciones.
 *
 * Los informes guardados que aún lo traen se funden al migrar a la v2 (ver
 * lib/parseAnalisis.ts#migrarAV2). Nada se pierde: si la cadena no casa con
 * ninguna situación, se convierte en una situación suelta.
 */
export interface CapaModalidadDBT {
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

/**
 * Versión del esquema del análisis. La 2 es la que da identidad a las entidades
 * (ver `Id`). Un informe guardado sin este campo es de la v1 y se migra al
 * leerlo; nunca se descarta. Ver lib/parseAnalisis.ts#migrarAV2.
 */
export const VERSION_ANALISIS = 2;

export interface AnalisisFuncional {
  version: number;
  /**
   * De dónde sale el próximo id que cree el clínico a mano. Arranca en el mayor
   * asignado + 1 y solo sube: reutilizar el id de una entidad borrada haría que
   * una relación vieja apuntara a una entidad nueva sin que nada lo avisara.
   */
  siguiente_id: number;
  /** El modelo no las emite: se materializan una vez al normalizar. */
  aristas: Arista[];
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
  lineas_de_intervencion_tentativas: LineaIntervencion[];
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
  /** Ver PlanDeMonitorizacion: qué desmentiría esta formulación, y cuándo se mira. */
  /** Uno por blanco. Vacío cuando la nota no da base para ninguno. */
  plan_de_monitorizacion: PlanDeMonitorizacion[];
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
  /**
   * Estado de cada blanco del plan, por id de conducta problema. Solo guarda
   * las decisiones explícitas del clínico; lo que no está aquí se deriva (ver
   * lib/plan.ts#estadoDeBlanco). El modelo nunca lo envía.
   */
  estados_plan: Record<Id, EstadoPlan>;
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
  // Las dos primeras las fija el servidor y el modelo no las envía nunca, igual
  // que `alertas`, `meta` y `secciones_editadas`.
  "version",
  "siguiente_id",
  "aristas",
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
  "plan_de_monitorizacion",
  "datos_faltantes",
  "acomodacion_entorno",
  "valores_y_metas",
  "perdida_de_reforzadores",
  "riesgo",
  "alertas",
  "campos_generados",
  "meta",
  "secciones_editadas",
  "estados_plan",
] as const satisfies readonly (keyof AnalisisFuncional)[];

type _TodasLasClavesCubiertas =
  keyof AnalisisFuncional extends (typeof CAMPOS_ANALISIS_FUNCIONAL)[number]
    ? true
    : ["Falta una clave de AnalisisFuncional en CAMPOS_ANALISIS_FUNCIONAL"];
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _chequeoCamposCompletos: _TodasLasClavesCubiertas = true;
