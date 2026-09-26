import OpenAI from "openai";
import { construirPromptDatosFaltantesPrevios } from "./systemPrompt";
import { extraerJSON } from "./parseAnalisis";
import type { PreguntaPrevia } from "./types";

const MODELO_DETECCION = "gpt-4o-mini";
type Categoria = "consecuencia" | "contexto" | "frecuencia";

/**
 * La redacción de la pregunta y su porqué son fijas y viven aquí, no en el
 * modelo: así el cuadro es igual para cualquier caso y el porqué nunca nombra
 * una función concreta (escape, atención…) que la nota no ha establecido. El
 * modelo solo elige la categoría y aporta persona y conducta con las palabras
 * de la nota.
 */
const PLANTILLAS: Record<
  Categoria,
  { pregunta: (persona: string, verbal: string, nominal: string) => string; porQue: string }
> = {
  consecuencia: {
    pregunta: (persona, verbal) =>
      `¿Qué ocurre justo después de que ${persona} ${verbal}?`,
    porQue: "Sin esto no se distingue qué busca lograr o evitar la conducta.",
  },
  contexto: {
    pregunta: (persona, verbal) =>
      `¿Qué estaba pasando justo antes de que ${persona} ${verbal}?`,
    porQue: "Sin esto no se distingue qué situación la activa.",
  },
  frecuencia: {
    pregunta: (_persona, _verbal, nominal) =>
      `¿Con qué frecuencia y en qué situaciones se repite ${nominal}?`,
    porQue: "Sin esto no se distingue si es algo puntual o si se repite.",
  },
};

const ORDEN: Categoria[] = ["consecuencia", "contexto", "frecuencia"];

function texto(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

/**
 * Una entrada sin categoría válida o sin conducta se descarta: sin ellas la
 * plantilla no puede formar una pregunta que se entienda.
 */
function normalizarPregunta(valor: unknown): [Categoria, PreguntaPrevia] | null {
  if (typeof valor !== "object" || valor === null) return null;
  const d = valor as Record<string, unknown>;
  const categoria = d.categoria as Categoria;
  if (!ORDEN.includes(categoria)) return null;
  const verbal = texto(d.conducta_verbal);
  const nominal = texto(d.conducta_nominal) || verbal;
  if (!verbal) return null;
  const persona = texto(d.persona) || "la persona";
  const plantilla = PLANTILLAS[categoria];
  return [
    categoria,
    {
      pregunta: plantilla.pregunta(persona, verbal, nominal),
      por_que_importa: plantilla.porQue,
    },
  ];
}

/**
 * Comprobación previa al análisis completo (ver app/page.tsx): con un modelo
 * barato, identifica qué le falta a la nota y lo convierte en preguntas que
 * el terapeuta puede responder ANTES de gastar la llamada completa a gpt-4o.
 * Lo confirmado se incorpora a la nota y lo omitido ("No sé") se declara en
 * datos_faltantes sin depender de que el modelo lo vuelva a detectar (ver
 * app/api/analizar/route.ts) — el ahorro real es no tener que reanalizar
 * después para incorporar lo que faltaba.
 *
 * Cualquier fallo (red, JSON inválido, forma inesperada) se traduce en una
 * lista vacía: esto es un extra: si no funciona, el flujo sigue directo al
 * análisis completo, exactamente como si la nota no tuviera nada que aclarar.
 */
export async function detectarDatosFaltantesPrevios(
  nota: string,
  apiKey: string
): Promise<PreguntaPrevia[]> {
  try {
    const openai = new OpenAI({ apiKey });
    const respuesta = await openai.chat.completions.create({
      model: MODELO_DETECCION,
      max_tokens: 600,
      temperature: 0,
      messages: [
        { role: "system", content: construirPromptDatosFaltantesPrevios() },
        { role: "user", content: `Nota clínica:\n\n${nota}` },
      ],
    });

    const texto = respuesta.choices[0]?.message?.content?.trim() ?? "";
    const json = JSON.parse(extraerJSON(texto)) as { preguntas?: unknown };
    if (!Array.isArray(json.preguntas)) return [];

    // Una por categoría y siempre en el mismo orden, decida lo que decida el modelo.
    const porCategoria = new Map<Categoria, PreguntaPrevia>();
    for (const item of json.preguntas.map(normalizarPregunta)) {
      if (item && !porCategoria.has(item[0])) porCategoria.set(item[0], item[1]);
    }
    return ORDEN.flatMap((c) => porCategoria.get(c) ?? []);
  } catch {
    return [];
  }
}
