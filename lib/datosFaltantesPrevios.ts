import OpenAI from "openai";
import { construirPromptDatosFaltantesPrevios } from "./systemPrompt";
import { extraerJSON } from "./parseAnalisis";
import type { PreguntaPrevia } from "./types";

const MODELO_DETECCION = "gpt-4o-mini";
const MAXIMO_PREGUNTAS = 5;

/**
 * Una pregunta suelta se acepta como pregunta sin porqué en lugar de
 * descartarse: es la forma que devolvía este paso antes de que el porqué
 * existiera, y perder el vacío detectado por un campo de más sería peor que
 * mostrarlo sin motivo declarado. Lo que sí se descarta es lo que no tiene
 * pregunta: sin ella no hay nada que enseñarle al terapeuta.
 */
function normalizarPregunta(valor: unknown): PreguntaPrevia | null {
  if (typeof valor === "string") {
    return valor.trim() ? { pregunta: valor.trim(), por_que_importa: "" } : null;
  }
  if (typeof valor !== "object" || valor === null) return null;
  const d = valor as Record<string, unknown>;
  const pregunta = typeof d.pregunta === "string" ? d.pregunta.trim() : "";
  if (!pregunta) return null;
  return {
    pregunta,
    por_que_importa:
      typeof d.por_que_importa === "string" ? d.por_que_importa.trim() : "",
  };
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

    return json.preguntas
      .map(normalizarPregunta)
      .filter((p): p is PreguntaPrevia => p !== null)
      .slice(0, MAXIMO_PREGUNTAS);
  } catch {
    return [];
  }
}
