import { NextResponse } from "next/server";
import OpenAI from "openai";
import { construirPromptReanalisisSeccion } from "@/lib/systemPrompt";
import { extraerJSON, normalizarFragmento } from "@/lib/parseAnalisis";

const MODELO = "gpt-4o";
const LONGITUD_MINIMA_NOTA_ORIGINAL = 20;
const LONGITUD_MINIMA_NOTA_ADICIONAL = 3;
const LONGITUD_MAXIMA_NOTA_ADICIONAL = 4000;

const CAMPOS_VALIDOS = new Set([
  "resumen_clinico",
  "conductas_problema",
  "variables_moduladoras",
  "situaciones",
  "hipotesis_mantenimiento",
  "hipotesis_origen",
  "formulacion",
  "conductas_alternativas",
  "capa_act",
  "capa_dbt",
  "capa_mc",
  "hipotesis_alternativas",
  "preguntas_para_sesion",
  "lineas_de_intervencion_tentativas",
  "datos_faltantes",
]);

function respuestaError(error: string, message: string, status: number) {
  return NextResponse.json({ error, message }, { status });
}

export async function POST(request: Request) {
  let notaOriginal: unknown;
  let notaAdicional: unknown;
  let campos: unknown;
  let analisisActual: unknown;

  try {
    const cuerpo = await request.json();
    notaOriginal = (cuerpo as { notaOriginal?: unknown } | null)?.notaOriginal;
    notaAdicional = (cuerpo as { notaAdicional?: unknown } | null)
      ?.notaAdicional;
    campos = (cuerpo as { campos?: unknown } | null)?.campos;
    analisisActual = (cuerpo as { analisisActual?: unknown } | null)
      ?.analisisActual;
  } catch {
    return respuestaError(
      "solicitud_invalida",
      "La solicitud no tiene un formato válido.",
      400
    );
  }

  if (
    typeof notaOriginal !== "string" ||
    notaOriginal.trim().length < LONGITUD_MINIMA_NOTA_ORIGINAL
  ) {
    return respuestaError(
      "solicitud_invalida",
      "Falta la nota clínica original.",
      400
    );
  }

  if (
    typeof notaAdicional !== "string" ||
    notaAdicional.trim().length < LONGITUD_MINIMA_NOTA_ADICIONAL
  ) {
    return respuestaError(
      "nota_muy_breve",
      "Agrega algo de texto antes de reanalizar esta sección.",
      400
    );
  }

  if (notaAdicional.length > LONGITUD_MAXIMA_NOTA_ADICIONAL) {
    return respuestaError(
      "nota_muy_larga",
      "La nota adicional excede la longitud máxima permitida.",
      400
    );
  }

  if (
    !Array.isArray(campos) ||
    campos.length === 0 ||
    !campos.every((c) => typeof c === "string" && CAMPOS_VALIDOS.has(c))
  ) {
    return respuestaError(
      "solicitud_invalida",
      "No se reconoce la sección a reanalizar.",
      400
    );
  }

  if (typeof analisisActual !== "object" || analisisActual === null) {
    return respuestaError(
      "solicitud_invalida",
      "Falta el análisis actual como contexto.",
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
      max_tokens: 6000,
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content: construirPromptReanalisisSeccion(campos as string[]),
        },
        {
          role: "user",
          content: `Nota clínica original:\n\n${notaOriginal}\n\nAnálisis funcional actual (contexto, no lo reescribas salvo los campos solicitados):\n\n${JSON.stringify(
            analisisActual
          )}\n\nNota adicional del clínico para esta sección:\n\n${notaAdicional}`,
        },
      ],
    });

    const texto = respuesta.choices[0]?.message?.content?.trim() ?? "";
    const json = JSON.parse(extraerJSON(texto));
    const fragmento = normalizarFragmento(campos as string[], json);

    return NextResponse.json({ fragmento });
  } catch (error) {
    console.error(
      "Error al reanalizar sección:",
      error instanceof Error ? error.message : "error desconocido"
    );
    return respuestaError(
      "error_analisis",
      "No se pudo reanalizar esta sección. Intenta nuevamente.",
      502
    );
  }
}
