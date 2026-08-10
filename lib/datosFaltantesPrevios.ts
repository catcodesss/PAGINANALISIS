import OpenAI from "openai";
import { construirPromptDatosFaltantesPrevios } from "./systemPrompt";
import { extraerJSON } from "./parseAnalisis";

const MODELO_DETECCION = "gpt-4o-mini";
const MAXIMO_PREGUNTAS = 5;

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
): Promise<string[]> {
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
      .filter((p): p is string => typeof p === "string" && p.trim().length > 0)
      .map((p) => p.trim())
      .slice(0, MAXIMO_PREGUNTAS);
  } catch {
    return [];
  }
}
