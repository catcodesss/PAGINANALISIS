import { normalizarTexto } from "./citas";
import type {
  AnalisisFuncional,
  EstadoHipotesis,
  EstadoPregunta,
  HipotesisMantenimiento,
  Id,
  OrigenPregunta,
  PreguntaClinica,
} from "./types";

/**
 * Preguntas clínicas: normalizar lo que llega, convertir lo heredado y fusionar
 * un reanálisis sin tirar lo que el clínico ya trabajó.
 *
 * Vive aparte de lib/parseAnalisis.ts y de lib/identidad.ts porque los dos lo
 * necesitan y ya se importan entre sí: un tercero sin dependencias evita el ciclo.
 */

export const ESTADOS_PREGUNTA: readonly EstadoPregunta[] = [
  "abierta",
  "respondida",
  "respondida_en_parte",
  "descartada",
];

export const ETIQUETA_ESTADO_PREGUNTA: Record<EstadoPregunta, string> = {
  abierta: "Abierta",
  respondida: "Respondida",
  respondida_en_parte: "Respondida en parte",
  descartada: "Descartada",
};

const ORIGENES: readonly OrigenPregunta[] = ["ia", "clinico", "previa"];

/** Una pregunta sin responder del todo sigue condicionando lo que depende de ella. */
export function estaAbierta(p: Pick<PreguntaClinica, "estado">): boolean {
  return p.estado === "abierta" || p.estado === "respondida_en_parte";
}

const texto = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

function objeto(v: unknown): Record<string, unknown> | null {
  return typeof v === "object" && v !== null && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}

/**
 * Acepta las dos formas: la que emite el modelo ({ pregunta, hipotesis, dato,
 * decision }) y la ya guardada (PreguntaClinica). `estado` y `respuesta` solo se
 * leen de la guardada: el modelo no los decide (regla 2 de la fase 4), así que
 * una respuesta suya con esos campos no los hace efectivos.
 */
export function normalizarPregunta(valor: unknown, id: Id = ""): PreguntaClinica | null {
  const d = objeto(valor);
  if (!d) return null;
  const guardada = typeof d.id === "string" && d.id.length > 0;
  const textoPregunta = texto(d.texto) || texto(d.pregunta);
  const dato = texto(d.dato_faltante) || texto(d.dato);
  const decision = texto(d.decision);
  if (!textoPregunta && !dato) return null;

  const respuesta = objeto(d.respuesta);
  const estado =
    guardada && ESTADOS_PREGUNTA.includes(d.estado as EstadoPregunta)
      ? (d.estado as EstadoPregunta)
      : "abierta";
  const pregunta: PreguntaClinica = {
    id: guardada ? (d.id as string) : id,
    texto: textoPregunta || dato,
    hipotesis: texto(d.hipotesis),
    pone_a_prueba: guardada && typeof d.pone_a_prueba === "string" && d.pone_a_prueba ? d.pone_a_prueba : null,
    dato_faltante: dato,
    decision,
    origen: guardada && ORIGENES.includes(d.origen as OrigenPregunta) ? (d.origen as OrigenPregunta) : "ia",
    estado,
  };
  if (guardada && respuesta && texto(respuesta.texto)) {
    pregunta.respuesta = { texto: texto(respuesta.texto), autor: "clinico" };
  }
  if (guardada && d.revisar === true) pregunta.revisar = true;
  return pregunta;
}

export function normalizarPreguntas(valor: unknown): PreguntaClinica[] {
  if (!Array.isArray(valor)) return [];
  return valor.flatMap((v) => normalizarPregunta(v) ?? []);
}

/** El número más alto de un id `prg_N`, para no reutilizar el de una pregunta borrada. */
function mayorNumero(preguntas: readonly PreguntaClinica[]): number {
  let mayor = 0;
  for (const p of preguntas) {
    const n = Number(p.id.split("_")[1]);
    if (Number.isInteger(n) && n > mayor) mayor = n;
  }
  return mayor;
}

export function nuevoIdPregunta(preguntas: readonly PreguntaClinica[]): Id {
  return `prg_${mayorNumero(preguntas) + 1}`;
}

/**
 * Convierte lo que traía un informe anterior a la v6 en preguntas:
 *
 * - cada dato faltante → pregunta con `dato_faltante = dato` y
 *   `decision = por_que_importa`;
 * - cada pregunta suelta → pregunta sin hipótesis ni decisión, marcada para
 *   revisar. No se completa por adivinación.
 *
 * Los datos van primero porque eran las preguntas con motivo. Una pregunta
 * suelta cuyo texto ya es un dato faltante no se duplica.
 */
export function preguntasDeLegado(
  datosFaltantes: unknown,
  preguntasSueltas: unknown,
  existentes: readonly PreguntaClinica[]
): PreguntaClinica[] {
  const salida: PreguntaClinica[] = [];
  const claves = new Set(
    existentes.flatMap((p) => [normalizarTexto(p.texto), normalizarTexto(p.dato_faltante)]).filter(Boolean)
  );
  const todas = () => [...existentes, ...salida];

  if (Array.isArray(datosFaltantes)) {
    for (const v of datosFaltantes) {
      const d = objeto(v);
      const dato = typeof v === "string" ? v.trim() : texto(d?.dato);
      if (!dato) continue;
      const clave = normalizarTexto(dato);
      if (claves.has(clave)) continue;
      claves.add(clave);
      salida.push({
        id: nuevoIdPregunta(todas()),
        texto: dato,
        hipotesis: "",
        pone_a_prueba: null,
        dato_faltante: dato,
        decision: texto(d?.por_que_importa),
        origen: "ia",
        estado: "abierta",
      });
    }
  }

  if (Array.isArray(preguntasSueltas)) {
    for (const v of preguntasSueltas) {
      const t = typeof v === "string" ? v.trim() : "";
      if (!t) continue;
      const clave = normalizarTexto(t);
      if (claves.has(clave)) continue;
      claves.add(clave);
      salida.push({
        id: nuevoIdPregunta(todas()),
        texto: t,
        hipotesis: "",
        pone_a_prueba: null,
        dato_faltante: "",
        decision: "",
        origen: "ia",
        estado: "abierta",
        revisar: true,
      });
    }
  }
  return salida;
}

/**
 * Tras reanalizar la sección de preguntas, lo nuevo no pisa lo que el
 * clínico trabajó: se conservan las respondidas, descartadas, escritas a mano o
 * nacidas del paso previo, y solo se sustituyen las que seguían abiertas y eran
 * de la IA. Lo nuevo que repite una pregunta conservada no se añade otra vez.
 */
export function fusionarPreguntas(
  previas: readonly PreguntaClinica[],
  nuevas: readonly PreguntaClinica[]
): PreguntaClinica[] {
  const trabajadas = previas.filter(
    (p) => p.origen !== "ia" || p.estado !== "abierta" || p.respuesta !== undefined
  );
  const clave = (p: PreguntaClinica) => normalizarTexto(p.dato_faltante || p.texto);
  const vistas = new Set(trabajadas.map(clave));
  const resultado = [...trabajadas];
  for (const p of nuevas) {
    if (vistas.has(clave(p))) continue;
    vistas.add(clave(p));
    resultado.push({ ...p, id: p.id || nuevoIdPregunta(resultado) });
  }
  return resultado;
}

/** Cómo nombrar una hipótesis dentro de una pregunta, sin repetir su prosa entera. */
export function rotuloHipotesis(
  h: Pick<HipotesisMantenimiento, "conducta" | "funcion" | "enunciado" | "origen">
): string {
  if (h.conducta.trim() && h.funcion.trim()) return `${h.funcion} · ${h.conducta}`;
  if (h.origen.trim() && h.conducta.trim()) return `${h.origen} → ${h.conducta}`;
  return h.enunciado.trim() || h.funcion.trim() || "hipótesis sin texto";
}

/**
 * Las preguntas con más valor de decisión, para el Resumen: primero las que
 * desbloquean un plan (una intervención sin proponer hasta saberlo), luego las
 * que condicionan alguna propuesta, luego las que ponen a prueba una hipótesis.
 * A igualdad gana la más antigua, que es la que lleva más tiempo abierta; no
 * hay fecha en la pregunta, así que el orden de la lista hace de antigüedad.
 */
export function preguntasPrioritarias(
  analisis: Pick<AnalisisFuncional, "preguntas" | "lineas_de_intervencion_tentativas">,
  cuantas = 3
): PreguntaClinica[] {
  const puntos = (p: PreguntaClinica): number => {
    const lineas = analisis.lineas_de_intervencion_tentativas.filter(
      (l) => l.pregunta_id === p.id
    );
    return (
      (lineas.some((l) => !l.intervencion.trim()) ? 4 : 0) +
      (lineas.length > 0 ? 2 : 0) +
      (p.pone_a_prueba ? 1 : 0)
    );
  };
  return analisis.preguntas
    .map((p, i) => ({ p, i, puntos: puntos(p) }))
    .filter(({ p }) => estaAbierta(p))
    .sort((a, b) => b.puntos - a.puntos || a.i - b.i)
    .slice(0, cuantas)
    .map(({ p }) => p);
}

export const ETIQUETA_ESTADO_HIPOTESIS: Record<EstadoHipotesis, string> = {
  en_prueba: "En prueba",
  sostenida: "Sostenida",
  modificada: "Modificada",
  debilitada: "Debilitada",
  descartada: "Descartada",
};

export const ESTADOS_HIPOTESIS: readonly EstadoHipotesis[] = [
  "en_prueba",
  "sostenida",
  "modificada",
  "debilitada",
  "descartada",
];
