import { resolverCita } from "./citas";
import {
  CAMPOS_ANALISIS_FUNCIONAL,
  type Acomodacion,
  type AnalisisFuncional,
  type CadenaDBT,
  type CadenaOperante,
  type CadenaRespondiente,
  type CapaModalidadACT,
  type CapaModalidadDBT,
  type CapaModalidadMC,
  type ConductaAlternativa,
  type ConductaProblema,
  type DatoFaltante,
  type DeficitOInterferencia,
  type DimensionVariable,
  type EsquemaDeContingencia,
  type Formulacion,
  type HipotesisAlternativa,
  type HipotesisMantenimiento,
  type NivelConfianza,
  type NivelVariable,
  type PlanDeMonitorizacion,
  type PriorizacionBlanco,
  type RepertorioDisponible,
  type Riesgo,
  type Situacion,
  type TipoRelacion,
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

function normalizarRepertorioDisponible(
  valor: unknown,
  lineas: string[]
): RepertorioDisponible {
  const d = comoObjeto(valor);
  return {
    descripcion: comoTexto(d.descripcion),
    contexto_en_que_ocurre: comoTexto(d.contexto_en_que_ocurre),
    evidencia: resolverCita(lineas, d.evidencia),
  };
}

const NIVELES_VARIABLE: NivelVariable[] = [
  "biofisiologico",
  "psicologico",
  "sociocultural",
];

const DIMENSIONES_VARIABLE: DimensionVariable[] = [
  "afecto",
  "cognicion",
  "atencion",
  "self",
  "motivacion",
  "conducta",
];

/**
 * COMPATIBILIDAD con la clasificación anterior.
 *
 * Hasta la rejilla de contexto y procesos, cada variable llevaba un solo campo
 * `tipo` con tres valores. Los informes ya guardados en el historial (ver
 * lib/repositorio.ts) siguen trayéndolo, y un modelo que no obedezca el esquema
 * nuevo puede devolverlo otra vez. Sin este mapeo, esos informes pintarían la
 * rejilla entera vacía: no un fallo visible, sino un informe antiguo que de
 * pronto parece no haber evaluado nada.
 *
 * "historia_de_aprendizaje" es el caso interesante: no era un nivel, era un
 * momento. Se traduce a nivel psicológico —que es donde opera un patrón
 * aprendido— y momento histórico, que es lo que la categoría vieja quería decir
 * de verdad.
 */
const NIVEL_DESDE_TIPO_ANTIGUO: Record<string, NivelVariable> = {
  biologica: "biofisiologico",
  contextual: "sociocultural",
  historia_de_aprendizaje: "psicologico",
};

function normalizarVariableModuladora(valor: unknown, lineas: string[]): VariableModuladora {
  const d = comoObjeto(valor);
  const tipoAntiguo = typeof d.tipo === "string" ? d.tipo : "";

  const nivel = NIVELES_VARIABLE.includes(d.nivel as NivelVariable)
    ? (d.nivel as NivelVariable)
    : (NIVEL_DESDE_TIPO_ANTIGUO[tipoAntiguo] ?? "psicologico");

  const momento =
    d.momento === "historico" || d.momento === "actual"
      ? d.momento
      : tipoAntiguo === "historia_de_aprendizaje"
        ? "historico"
        : "actual";

  return {
    nivel,
    // Sin dimensión declarada cae en "conducta": es la dimensión que el resto
    // del informe siempre describe, así que es la lectura que menos añade.
    dimension: DIMENSIONES_VARIABLE.includes(d.dimension as DimensionVariable)
      ? (d.dimension as DimensionVariable)
      : "conducta",
    momento,
    descripcion: comoTexto(d.descripcion),
    // Lo desconocido cae en "baja" por comoConfianza. Suponer modificabilidad
    // alta inflaría la posición de esta variable en la priorización (ver
    // lib/priorizacion.ts) apoyándose en una clave que el modelo omitió.
    modificabilidad: comoConfianza(d.modificabilidad),
    evidencia: resolverCita(lineas, d.evidencia),
  };
}

const ESQUEMAS_CONTINGENCIA: EsquemaDeContingencia[] = [
  "continua",
  "intermitente",
  "no_determinable",
];

/**
 * Lo desconocido cae en "no_determinable", nunca en "continua" ni en
 * "intermitente": un valor por defecto que afirmara un esquema concreto
 * alteraría la dosis de exposición que el informe sugiere, apoyándose en que
 * el modelo omitió una clave.
 */
function comoEsquemaContingencia(valor: unknown): EsquemaDeContingencia {
  return ESQUEMAS_CONTINGENCIA.includes(valor as EsquemaDeContingencia)
    ? (valor as EsquemaDeContingencia)
    : "no_determinable";
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
    esquema_de_contingencia: comoEsquemaContingencia(d.esquema_de_contingencia),
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

const TIPOS_RELACION: TipoRelacion[] = ["causal", "moderadora", "mediadora"];

function normalizarHipotesisMantenimiento(valor: unknown): HipotesisMantenimiento {
  const d = comoObjeto(valor);
  return {
    conducta: comoTexto(d.conducta),
    enunciado: comoTexto(d.enunciado),
    funcion: comoTexto(d.funcion),
    confianza: comoConfianza(d.confianza),
    fuerza: comoConfianza(d.fuerza),
    // "unidireccional" por defecto: declarar un bucle es una afirmación más
    // fuerte que declarar una flecha, y la red funcional resalta los bucles
    // cerrados (ver RedFuncional en components/ReportView.tsx). Un valor por
    // defecto "bidireccional" dibujaría bucles que nadie afirmó.
    direccion: d.direccion === "bidireccional" ? "bidireccional" : "unidireccional",
    // "causal" por defecto: es la lectura llana de una hipótesis de
    // mantenimiento. "moderadora" y "mediadora" afirman ADEMÁS algo sobre el
    // mecanismo, así que no pueden salir de una clave ausente.
    tipo_relacion: TIPOS_RELACION.includes(d.tipo_relacion as TipoRelacion)
      ? (d.tipo_relacion as TipoRelacion)
      : "causal",
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
    analisis_de_soluciones: comoArreglo<unknown>(d.analisis_de_soluciones).map(
      (s) => {
        const so = comoObjeto(s);
        return {
          eslabon_objetivo: comoTexto(so.eslabon_objetivo),
          alternativa_habil: comoTexto(so.alternativa_habil),
          // Lo desconocido cae en "respuesta": es la estrategia disponible
          // una vez la cadena arrancó, así que es la lectura conservadora.
          // Suponer "antecedente" prometería un margen de maniobra anterior
          // al eslabón que nadie ha comprobado que exista.
          tipo_estrategia:
            so.tipo_estrategia === "antecedente" ? "antecedente" : "respuesta",
        };
      }
    ),
    plan_de_prevencion: comoArregloDeTexto(d.plan_de_prevencion),
    // null y no "": la ausencia de daño a terceros es un hallazgo, no un
    // campo vacío que alguien deba rellenar.
    plan_de_reparacion: comoTextoONulo(d.plan_de_reparacion),
    eslabon_ausente: comoTextoONulo(d.eslabon_ausente),
  };
}

function normalizarAcomodacion(valor: unknown, lineas: string[]): Acomodacion {
  const d = comoObjeto(valor);
  return {
    quien: comoTexto(d.quien),
    conducta_acomodacion: comoTexto(d.conducta_acomodacion),
    funcion: comoTexto(d.funcion),
    evidencia: resolverCita(lineas, d.evidencia),
  };
}

/**
 * COMPATIBILIDAD: hasta que "datos_faltantes" pasó a llevar el porqué, cada
 * hueco era una cadena suelta. Los informes ya guardados en el historial (ver
 * lib/repositorio.ts) siguen trayendo esa forma, y un modelo que no obedezca
 * el esquema puede devolverla otra vez. Una cadena se acepta como el dato, con
 * el porqué vacío: la interfaz lo muestra como "sin motivo declarado", que es
 * honesto — mejor eso que perder el hueco entero o inventarle una razón.
 */
function normalizarDatoFaltante(valor: unknown): DatoFaltante {
  if (typeof valor === "string") return { dato: valor, por_que_importa: "" };
  const d = comoObjeto(valor);
  return {
    dato: comoTexto(d.dato),
    por_que_importa: comoTexto(d.por_que_importa),
  };
}

function normalizarDatosFaltantes(valor: unknown): DatoFaltante[] {
  return comoArreglo<unknown>(valor)
    .map(normalizarDatoFaltante)
    .filter((d) => d.dato.trim().length > 0);
}

/**
 * null cuando la nota no da base para un plan de medición. Un plan inventado
 * sería peor que ninguno: el clínico lo seguiría, y mediría lo que a nadie le
 * consta que haya que medir. Si el objeto llega pero sin criterio de revisión,
 * se conserva igual: la interfaz dice en voz alta que falta, que es lo que
 * convierte la formulación en un documento sin fecha de revisión.
 */
function normalizarPlanDeMonitorizacion(
  valor: unknown
): PlanDeMonitorizacion | null {
  const d = comoObjetoONulo(valor);
  if (!d) return null;
  const plan = {
    que_se_mide: comoTexto(d.que_se_mide),
    con_que: comoTexto(d.con_que),
    cada_cuanto: comoTexto(d.cada_cuanto),
    criterio_de_revision: comoTexto(d.criterio_de_revision),
  };
  // Un objeto entero vacío es lo mismo que no haber plan.
  return Object.values(plan).some((v) => v.trim().length > 0) ? plan : null;
}

function normalizarRiesgo(valor: unknown): Riesgo {
  const d = comoObjeto(valor);
  return {
    evaluado: d.evaluado === true,
    indicadores: comoArregloDeTexto(d.indicadores),
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
    repertorio_disponible: comoArreglo<unknown>(d.repertorio_disponible).map((r) =>
      normalizarRepertorioDisponible(r, lineas)
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
    fortalezas_y_recursos: comoArregloDeTexto(d.fortalezas_y_recursos),
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
    plan_de_monitorizacion: normalizarPlanDeMonitorizacion(d.plan_de_monitorizacion),
    datos_faltantes: normalizarDatosFaltantes(d.datos_faltantes),
    acomodacion_entorno: comoArreglo<unknown>(d.acomodacion_entorno).map((a) =>
      normalizarAcomodacion(a, lineas)
    ),
    valores_y_metas: comoArregloDeTexto(d.valores_y_metas),
    perdida_de_reforzadores: comoArregloDeTexto(d.perdida_de_reforzadores),
    riesgo: normalizarRiesgo(d.riesgo),
    // Las alertas no vienen del modelo: las produce lib/validadores.ts.
    alertas: [],
    // Lo fija la ruta según lo que se haya pedido, no el modelo.
    campos_generados: [],
    // Lo fija la ruta tras la llamada a OpenAI (ver app/api/analizar/route.ts).
    meta: { modelo: "", version_prompt: "" },
    // Solo la escribe la interfaz cuando el clínico edita; el modelo nunca.
    secciones_editadas: [],
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
  repertorio_disponible: (d, lineas) =>
    comoArreglo<unknown>(d.repertorio_disponible).map((r) =>
      normalizarRepertorioDisponible(r, lineas)
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
  fortalezas_y_recursos: (d) => comoArregloDeTexto(d.fortalezas_y_recursos),
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
  plan_de_monitorizacion: (d) =>
    normalizarPlanDeMonitorizacion(d.plan_de_monitorizacion),
  datos_faltantes: (d) => normalizarDatosFaltantes(d.datos_faltantes),
  acomodacion_entorno: (d, lineas) =>
    comoArreglo<unknown>(d.acomodacion_entorno).map((a) =>
      normalizarAcomodacion(a, lineas)
    ),
  valores_y_metas: (d) => comoArregloDeTexto(d.valores_y_metas),
  perdida_de_reforzadores: (d) => comoArregloDeTexto(d.perdida_de_reforzadores),
  riesgo: (d) => normalizarRiesgo(d.riesgo),
  alertas: () => [],
  campos_generados: () => [],
  meta: () => ({ modelo: "", version_prompt: "" }),
  secciones_editadas: () => [],
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
