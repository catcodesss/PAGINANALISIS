import { idConsecuenciaAlternativa, idNodoSituacion } from "./aristas";
import type {
  AnalisisFuncional,
  Cita,
  Id,
  NivelConfianza,
  Situacion,
  TipoArista,
} from "./types";

export type CarrilGrafo =
  | "contexto"
  | "antecedente"
  | "encubierto"
  | "conducta"
  | "inmediata"
  | "demorada";

export type TipoNodoGrafo =
  | "om"
  | "moduladora"
  | "ed"
  | "ec"
  | "regla_verbal"
  | "encubierta"
  | "conducta"
  | "repertorio"
  | "alternativa"
  | "consecuencia"
  | "consecuencia_alternativa"
  | "funcion"
  | "valor";

export interface NodoGrafo {
  id: Id;
  tipo: TipoNodoGrafo;
  carril: CarrilGrafo;
  etiqueta: string;
  situacion_id: Id | null;
  alternativa: boolean;
  evidencia: Cita | null;
  confianza: NivelConfianza;
  apoyo: 1 | 2 | 3;
  detalle?: string;
}

export interface HuecoGrafo {
  id: string;
  situacion_id: string;
  carril: CarrilGrafo;
  etiqueta: string;
}

export const CARRILES_GRAFO: readonly {
  id: CarrilGrafo;
  titulo: string;
  subtitulo: string;
}[] = [
  { id: "contexto", titulo: "Contexto / OM", subtitulo: "Operaciones motivacionales" },
  { id: "antecedente", titulo: "Antecedente", subtitulo: "Ed · EΔ · EC · regla" },
  { id: "encubierto", titulo: "Encadenamiento", subtitulo: "Eventos encubiertos" },
  { id: "conducta", titulo: "Conducta", subtitulo: "Respuesta observable" },
  { id: "inmediata", titulo: "Consec. inmediata", subtitulo: "Lo que mantiene ahora" },
  { id: "demorada", titulo: "Consec. demorada", subtitulo: "Coste a medio y largo plazo" },
] as const;

function evidenciaDeclarada(cita: Cita | null): boolean {
  if (!cita || !("motivo" in cita)) return false;
  return cita.motivo !== "sin_referencia";
}

/** La longitud, y no solo el color, codifica el respaldo de la nota. */
export function derivarApoyo(
  cita: Cita | null,
  confianza: NivelConfianza
): 1 | 2 | 3 {
  if (cita?.verificada && (confianza === "alta" || confianza === "media")) return 3;
  if (cita?.verificada || evidenciaDeclarada(cita)) return 2;
  return 1;
}

function nodo(
  base: Omit<NodoGrafo, "apoyo"> & { apoyo?: never }
): NodoGrafo {
  return { ...base, apoyo: derivarApoyo(base.evidencia, base.confianza) };
}

function nodosSituacion(
  analisis: AnalisisFuncional,
  situacion: Situacion
): NodoGrafo[] {
  const salida: NodoGrafo[] = [];
  const operante = situacion.cadena_operante;
  const respondiente = situacion.cadena_respondiente;
  const dbt = situacion.cadena_dbt;
  const evidenciaOperante = operante?.evidencia ?? null;

  if (operante?.operacion_motivacional) {
    salida.push(nodo({
      id: idNodoSituacion(situacion, "om"), tipo: "om", carril: "contexto",
      etiqueta: operante.operacion_motivacional, situacion_id: situacion.id,
      alternativa: false, evidencia: evidenciaOperante, confianza: situacion.confianza,
    }));
  }
  if (operante?.antecedente) {
    salida.push(nodo({
      id: idNodoSituacion(situacion, "ed"), tipo: "ed", carril: "antecedente",
      etiqueta: operante.antecedente, situacion_id: situacion.id,
      alternativa: false, evidencia: evidenciaOperante, confianza: situacion.confianza,
    }));
  }
  if (respondiente?.estimulo) {
    salida.push(nodo({
      id: idNodoSituacion(situacion, "ec"), tipo: "ec", carril: "antecedente",
      etiqueta: respondiente.estimulo, situacion_id: situacion.id,
      alternativa: false, evidencia: respondiente.evidencia, confianza: situacion.confianza,
      detalle: respondiente.respuesta_condicionada,
    }));
  }
  for (const eslabon of dbt?.eslabones ?? []) {
    salida.push(nodo({
      id: eslabon.id, tipo: "encubierta", carril: "encubierto",
      etiqueta: eslabon.descripcion, situacion_id: situacion.id,
      alternativa: false, evidencia: dbt?.evidencia ?? null,
      confianza: situacion.confianza, detalle: eslabon.tipo,
    }));
  }
  for (const idConducta of situacion.conductas_ids) {
    const conducta = analisis.conductas_problema.find((c) => c.id === idConducta);
    if (!conducta) continue;
    salida.push(nodo({
      id: conducta.id, tipo: "conducta", carril: "conducta",
      etiqueta: conducta.descripcion, situacion_id: situacion.id,
      alternativa: false, evidencia: conducta.evidencia,
      confianza: conducta.importancia, detalle: conducta.tipo,
    }));
  }
  if (operante?.consecuencia.texto) {
    salida.push(nodo({
      id: operante.consecuencia.id, tipo: "consecuencia", carril: "inmediata",
      etiqueta: operante.consecuencia.texto, situacion_id: situacion.id,
      alternativa: false, evidencia: evidenciaOperante, confianza: situacion.confianza,
      detalle: operante.tipo_contingencia,
    }));
  }
  if (operante?.consecuencias_largo_plazo?.texto) {
    salida.push(nodo({
      id: operante.consecuencias_largo_plazo.id, tipo: "consecuencia", carril: "demorada",
      etiqueta: operante.consecuencias_largo_plazo.texto, situacion_id: situacion.id,
      alternativa: false, evidencia: evidenciaOperante, confianza: situacion.confianza,
    }));
  }
  if (situacion.funcion_hipotetizada) {
    salida.push(nodo({
      id: idNodoSituacion(situacion, "funcion"), tipo: "funcion", carril: "inmediata",
      etiqueta: situacion.funcion_hipotetizada, situacion_id: situacion.id,
      alternativa: false, evidencia: evidenciaOperante, confianza: situacion.confianza,
    }));
  }
  for (const alternativa of analisis.conductas_alternativas.filter(
    (c) => c.situacion_id === situacion.id
  )) {
    salida.push(nodo({
      id: alternativa.id, tipo: "alternativa", carril: "conducta",
      etiqueta: alternativa.conducta_propuesta, situacion_id: situacion.id,
      alternativa: true, evidencia: null, confianza: "baja",
    }));
    if (alternativa.consecuencia_necesaria) {
      salida.push(nodo({
        id: idConsecuenciaAlternativa(alternativa.id),
        tipo: "consecuencia_alternativa", carril: "inmediata",
        etiqueta: alternativa.consecuencia_necesaria,
        situacion_id: situacion.id, alternativa: true,
        evidencia: null, confianza: "baja",
      }));
    }
  }
  return salida;
}

export function construirNodosGrafo(analisis: AnalisisFuncional): NodoGrafo[] {
  const salida = analisis.situaciones.flatMap((s) => nodosSituacion(analisis, s));
  for (const variable of analisis.variables_moduladoras) {
    salida.push(nodo({
      id: variable.id, tipo: "moduladora", carril: "contexto",
      etiqueta: variable.descripcion, situacion_id: null, alternativa: false,
      evidencia: variable.evidencia,
      // Modificabilidad no es confianza. Sin una escala de respaldo propia, la
      // cita solo autoriza el nivel intermedio; nunca se infiere "alta".
      confianza: variable.evidencia.verificada ? "media" : "baja",
      detalle: `${variable.nivel} · ${variable.dimension} · ${variable.momento}`,
    }));
  }
  for (const repertorio of analisis.repertorio_disponible) {
    salida.push(nodo({
      id: repertorio.id, tipo: "repertorio", carril: "conducta",
      etiqueta: repertorio.descripcion, situacion_id: null, alternativa: true,
      evidencia: repertorio.evidencia,
      confianza: repertorio.evidencia?.verificada ? "media" : "baja",
      detalle: repertorio.contexto_en_que_ocurre,
    }));
  }
  for (const regla of analisis.capa_act.reglas_verbales) {
    salida.push(nodo({
      id: regla.id, tipo: "regla_verbal", carril: "antecedente",
      etiqueta: regla.regla, situacion_id: null, alternativa: false,
      evidencia: null, confianza: regla.rigidez,
      detalle: `${regla.clase} · ${regla.textual_o_inferida}`,
    }));
  }
  analisis.valores_y_metas.forEach((valor, indice) => {
    salida.push(nodo({
      id: `valor_${indice + 1}`, tipo: "valor", carril: "contexto",
      etiqueta: valor, situacion_id: null, alternativa: true,
      evidencia: null, confianza: "baja",
    }));
  });
  return salida;
}

/** Las lecturas clínicas especializadas requieren al menos una conducta relacionada. */
export function hayGrafoBase(analisis: AnalisisFuncional): boolean {
  const idsConducta = new Set(analisis.conductas_problema.map((conducta) => conducta.id));
  return idsConducta.size > 0 && analisis.aristas.some(
    (arista) => idsConducta.has(arista.desde) || idsConducta.has(arista.hasta)
  );
}

export function apoyoCadena(nodos: readonly NodoGrafo[]): 1 | 2 | 3 {
  const relevantes = nodos.filter((n) => !n.alternativa && n.tipo !== "funcion");
  return relevantes.length
    ? Math.min(...relevantes.map((n) => n.apoyo)) as 1 | 2 | 3
    : 1;
}

export function huecosDeSituacion(
  analisis: AnalisisFuncional,
  situacion: Situacion,
  nodos: readonly NodoGrafo[]
): HuecoGrafo[] {
  const tiene = (carril: CarrilGrafo, tipo?: TipoNodoGrafo) =>
    nodos.some((n) => n.situacion_id === situacion.id && n.carril === carril && (!tipo || n.tipo === tipo));
  const huecos: HuecoGrafo[] = [];
  const agregar = (carril: CarrilGrafo, etiqueta: string) => huecos.push({
    id: `hueco_${situacion.id}_${carril}_${huecos.length}`,
    situacion_id: situacion.id,
    carril,
    etiqueta,
  });
  if (!tiene("antecedente")) agregar("antecedente", "¿antecedente?");
  if (!tiene("conducta", "conducta")) agregar("conducta", "¿conducta?");
  if (!tiene("inmediata", "consecuencia")) agregar("inmediata", "¿consecuencia inmediata?");
  if (!tiene("demorada", "consecuencia")) agregar("demorada", "¿consecuencia demorada?");
  if (analisis.alertas.some((a) => a.ruta.includes(situacion.id))) {
    agregar("contexto", "¿dato señalado por verificación?");
  }
  return huecos;
}

function retirarAristas(analisis: AnalisisFuncional, ids: readonly string[]) {
  const retirados = new Set(ids);
  analisis.aristas = analisis.aristas.filter(
    (a) => !retirados.has(a.desde) && !retirados.has(a.hasta)
  );
}

export function actualizarEtiquetaNodo(
  analisis: AnalisisFuncional,
  id: string,
  etiqueta: string
): void {
  const conducta = analisis.conductas_problema.find((c) => c.id === id);
  if (conducta) conducta.descripcion = etiqueta;
  const variable = analisis.variables_moduladoras.find((v) => v.id === id);
  if (variable) variable.descripcion = etiqueta;
  const repertorio = analisis.repertorio_disponible.find((r) => r.id === id);
  if (repertorio) repertorio.descripcion = etiqueta;
  const regla = analisis.capa_act.reglas_verbales.find((r) => r.id === id);
  if (regla) regla.regla = etiqueta;
  const alternativa = analisis.conductas_alternativas.find((a) => a.id === id);
  if (alternativa) alternativa.conducta_propuesta = etiqueta;
  const valor = /^valor_(\d+)$/.exec(id);
  if (valor && analisis.valores_y_metas[Number(valor[1]) - 1] !== undefined) {
    analisis.valores_y_metas[Number(valor[1]) - 1] = etiqueta;
  }
  for (const situacion of analisis.situaciones) {
    const operante = situacion.cadena_operante;
    if (id === idNodoSituacion(situacion, "om") && operante) operante.operacion_motivacional = etiqueta;
    if (id === idNodoSituacion(situacion, "ed") && operante) operante.antecedente = etiqueta;
    if (id === idNodoSituacion(situacion, "ec") && situacion.cadena_respondiente) situacion.cadena_respondiente.estimulo = etiqueta;
    if (id === idNodoSituacion(situacion, "funcion")) situacion.funcion_hipotetizada = etiqueta;
    const eslabon = situacion.cadena_dbt?.eslabones.find((e) => e.id === id);
    if (eslabon) eslabon.descripcion = etiqueta;
    if (operante?.consecuencia.id === id) operante.consecuencia.texto = etiqueta;
    if (operante?.consecuencias_largo_plazo?.id === id) operante.consecuencias_largo_plazo.texto = etiqueta;
  }
  for (const alt of analisis.conductas_alternativas) {
    if (id === idConsecuenciaAlternativa(alt.id)) alt.consecuencia_necesaria = etiqueta;
  }
}

export function borrarNodo(analisis: AnalisisFuncional, id: string): void {
  analisis.conductas_problema = analisis.conductas_problema.filter((c) => c.id !== id);
  analisis.variables_moduladoras = analisis.variables_moduladoras.filter((v) => v.id !== id);
  analisis.repertorio_disponible = analisis.repertorio_disponible.filter((r) => r.id !== id);
  analisis.capa_act.reglas_verbales = analisis.capa_act.reglas_verbales.filter((r) => r.id !== id);
  analisis.conductas_alternativas = analisis.conductas_alternativas.filter((a) => a.id !== id);
  const valor = /^valor_(\d+)$/.exec(id);
  if (valor) analisis.valores_y_metas.splice(Number(valor[1]) - 1, 1);
  const idsRetirados = [id];
  for (const situacion of analisis.situaciones) {
    situacion.conductas_ids = situacion.conductas_ids.filter((c) => c !== id);
    const operante = situacion.cadena_operante;
    if (id === idNodoSituacion(situacion, "om") && operante) operante.operacion_motivacional = null;
    if (id === idNodoSituacion(situacion, "ed") && operante) operante.antecedente = "";
    if (id === idNodoSituacion(situacion, "ec")) situacion.cadena_respondiente = null;
    if (id === idNodoSituacion(situacion, "funcion")) situacion.funcion_hipotetizada = "";
    if (operante?.consecuencia.id === id) operante.consecuencia.texto = "";
    if (operante?.consecuencias_largo_plazo?.id === id) operante.consecuencias_largo_plazo = null;
    if (situacion.cadena_dbt) {
      situacion.cadena_dbt.eslabones = situacion.cadena_dbt.eslabones.filter((e) => e.id !== id);
    }
  }
  for (const alternativa of analisis.conductas_alternativas) {
    const idConsecuencia = idConsecuenciaAlternativa(alternativa.id);
    if (id === idConsecuencia) alternativa.consecuencia_necesaria = "";
  }
  retirarAristas(analisis, idsRetirados);
}

function nuevoId(analisis: AnalisisFuncional, prefijo: string): string {
  const id = `${prefijo}_${analisis.siguiente_id}`;
  analisis.siguiente_id += 1;
  return id;
}

export function agregarArista(
  analisis: AnalisisFuncional,
  desde: string,
  hasta: string,
  tipo: TipoArista = "secuencial"
): void {
  if (desde === hasta || analisis.aristas.some((a) => a.desde === desde && a.hasta === hasta && a.tipo === tipo)) return;
  analisis.aristas.push({ id: nuevoId(analisis, "ari"), desde, hasta, tipo });
}

export function agregarNodo(
  analisis: AnalisisFuncional,
  situacionId: string | null,
  tipo: TipoNodoGrafo,
  etiqueta: string
): void {
  const situacion = analisis.situaciones.find((s) => s.id === situacionId);
  const sinCita = { texto: null, verificada: false, motivo: "sin_referencia" } as const;
  if (tipo === "moduladora") {
    const id = nuevoId(analisis, "vmd");
    analisis.variables_moduladoras.push({ id, nivel: "psicologico", dimension: "conducta", momento: "actual", descripcion: etiqueta, modificabilidad: "baja", evidencia: sinCita });
    if (situacion) agregarArista(analisis, id, idNodoSituacion(situacion, "om"), "moderadora");
    return;
  }
  if (tipo === "repertorio") {
    analisis.repertorio_disponible.push({ id: nuevoId(analisis, "rep"), descripcion: etiqueta, contexto_en_que_ocurre: "", evidencia: null });
    return;
  }
  if (tipo === "regla_verbal") {
    analisis.capa_act.reglas_verbales.push({ id: nuevoId(analisis, "rvb"), regla: etiqueta, textual_o_inferida: "inferida", clase: "tracking", rigidez: "baja", analisis: "" });
    return;
  }
  if (tipo === "valor") {
    analisis.valores_y_metas.push(etiqueta);
    return;
  }
  if (!situacion) return;
  if (tipo === "om" && situacion.cadena_operante && !situacion.cadena_operante.operacion_motivacional) situacion.cadena_operante.operacion_motivacional = etiqueta;
  if (tipo === "ed" && situacion.cadena_operante && !situacion.cadena_operante.antecedente) situacion.cadena_operante.antecedente = etiqueta;
  if (tipo === "funcion" && !situacion.funcion_hipotetizada) situacion.funcion_hipotetizada = etiqueta;
  if (tipo === "encubierta" && situacion.cadena_dbt) situacion.cadena_dbt.eslabones.push({ id: nuevoId(analisis, "esl"), tipo: "pensamiento", descripcion: etiqueta });
  if (tipo === "conducta") {
    const id = nuevoId(analisis, "cnd");
    analisis.conductas_problema.push({ id, descripcion: etiqueta, tipo: "manifiesta", importancia: "baja", es_conducta_seguridad: false, deficit_o_interferencia: "no_determinable", justificacion_deficit: "", evidencia: sinCita });
    situacion.conductas_ids.push(id);
  }
  if (tipo === "alternativa") {
    analisis.conductas_alternativas.push({ id: nuevoId(analisis, "alt"), situacion: situacion.nombre, situacion_id: situacion.id, conducta_propuesta: etiqueta, consecuencia_necesaria: "" });
  }
  if (tipo === "consecuencia" && situacion.cadena_operante) {
    if (!situacion.cadena_operante.consecuencia.texto) situacion.cadena_operante.consecuencia.texto = etiqueta;
    else if (!situacion.cadena_operante.consecuencias_largo_plazo) situacion.cadena_operante.consecuencias_largo_plazo = { id: nuevoId(analisis, "cns"), texto: etiqueta };
  }
}
