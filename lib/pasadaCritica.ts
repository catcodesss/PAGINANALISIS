import OpenAI from "openai";
import { construirPromptPasadaCritica } from "./systemPrompt";
import { extraerJSON } from "./parseAnalisis";
import type { Alerta, AnalisisFuncional } from "./types";

const MODELO_PASADA_CRITICA = "gpt-4o-mini";

interface HallazgoCrudo {
  gravedad?: unknown;
  ruta?: unknown;
  mensaje?: unknown;
}

/**
 * Segunda llamada, opt-in (ver PASADA_CRITICA en app/api/analizar/route.ts),
 * con un modelo más barato que solo busca fallos en el análisis ya generado:
 * contenido de la nota no recogido, confianza por encima de la evidencia,
 * contradicciones. A diferencia de lib/validadores.ts, esto SÍ depende de que
 * un modelo obedezca — por eso el llamador marca estas alertas origen:"ia" y
 * nunca sustituyen a los validadores deterministas.
 *
 * Cualquier fallo (red, JSON inválido, forma inesperada) se traduce en un
 * arreglo vacío: la pasada crítica es un extra, nunca debe romper el análisis
 * principal que ya se generó.
 */
export async function ejecutarPasadaCritica(
  analisis: AnalisisFuncional,
  notaNumerada: string,
  apiKey: string
): Promise<Alerta[]> {
  const openai = new OpenAI({ apiKey });
  const respuesta = await openai.chat.completions.create({
    model: MODELO_PASADA_CRITICA,
    max_tokens: 1500,
    temperature: 0,
    messages: [
      { role: "system", content: construirPromptPasadaCritica() },
      {
        role: "user",
        content: `Nota clínica con líneas numeradas:\n\n${notaNumerada}\n\nAnálisis funcional generado (JSON):\n\n${JSON.stringify(analisis)}`,
      },
    ],
  });

  const texto = respuesta.choices[0]?.message?.content?.trim() ?? "";

  let hallazgos: unknown;
  try {
    hallazgos = JSON.parse(extraerJSON(texto)).hallazgos;
  } catch {
    return [];
  }
  if (!Array.isArray(hallazgos)) return [];

  return hallazgos
    .map((crudo): Alerta | null => {
      const d = crudo as HallazgoCrudo;
      if (typeof d.mensaje !== "string" || !d.mensaje.trim()) return null;
      return {
        codigo: "pasada_critica",
        origen: "ia",
        gravedad: d.gravedad === "alta" ? "alta" : "media",
        ruta: typeof d.ruta === "string" && d.ruta.trim() ? d.ruta : "general",
        mensaje: d.mensaje.trim(),
      };
    })
    .filter((a): a is Alerta => a !== null);
}
