import { NextResponse } from "next/server";
import OpenAI from "openai";
import { SYSTEM_PROMPT } from "@/lib/systemPrompt";
import { extraerJSON, normalizarAnalisis } from "@/lib/parseAnalisis";

const MODELO = "gpt-4o";
const LONGITUD_MINIMA = 100;
const LONGITUD_MAXIMA = 15000;

function respuestaError(error: string, message: string, status: number) {
  return NextResponse.json({ error, message }, { status });
}

export async function POST(request: Request) {
  let nota: unknown;
  try {
    const cuerpo = await request.json();
    nota = (cuerpo as { nota?: unknown } | null)?.nota;
  } catch {
    return respuestaError(
      "solicitud_invalida",
      "La solicitud no tiene un formato válido.",
      400
    );
  }

  if (typeof nota !== "string" || nota.trim().length < LONGITUD_MINIMA) {
    return respuestaError(
      "nota_muy_breve",
      "La nota es demasiado breve para un análisis funcional fiable. Incluye al menos la situación, la conducta y lo que ocurrió después.",
      400
    );
  }

  if (nota.length > LONGITUD_MAXIMA) {
    return respuestaError(
      "nota_muy_larga",
      "La nota excede la longitud máxima permitida.",
      400
    );
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return respuestaError(
      "falta_api_key",
      "Falta configurar la clave de API. Revisa el archivo .env.local.",
      500
    );
  }

  try {
    const openai = new OpenAI({ apiKey });
    const respuesta = await openai.chat.completions.create({
      model: MODELO,
      max_tokens: 4096,
      temperature: 0.2,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: `Notas clínicas a analizar:\n\n${nota}`,
        },
      ],
    });

    const texto = respuesta.choices[0]?.message?.content?.trim() ?? "";

    const analisis = normalizarAnalisis(JSON.parse(extraerJSON(texto)));

    return NextResponse.json({ analisis });
  } catch (error) {
    console.error(
      "Error al generar el análisis funcional:",
      error instanceof Error ? error.message : "error desconocido"
    );
    return respuestaError(
      "error_analisis",
      "No se pudo completar el análisis. Intenta nuevamente.",
      502
    );
  }
}
