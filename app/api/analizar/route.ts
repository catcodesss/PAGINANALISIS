import { NextResponse } from "next/server";
import OpenAI from "openai";
import { construirSystemPrompt } from "@/lib/systemPrompt";
import { extraerJSON, normalizarAnalisis } from "@/lib/parseAnalisis";
import { numerarNota } from "@/lib/citas";
import { validarAnalisis } from "@/lib/validadores";
import { comprobarLimite, ipDe } from "@/lib/limitePeticiones";
import { camposParaBloques, IDS_TODOS } from "@/lib/bloques";
import { CAMPOS_ANALISIS_FUNCIONAL } from "@/lib/types";

const MODELO = "gpt-4o";
const RUTA = "analizar";
const LIMITE_PETICIONES = Number(process.env.LIMITE_ANALISIS_POR_VENTANA ?? 5);
const VENTANA_MS = Number(process.env.LIMITE_VENTANA_MS ?? 10 * 60 * 1000);
const LONGITUD_MINIMA = 100;
// Ampliado a petición de uso real. gpt-4o admite mucho más contexto del que
// gastamos; el límite existe para acotar el coste, no por capacidad del modelo.
const LONGITUD_MAXIMA = Number(process.env.LONGITUD_MAXIMA_NOTA ?? 40000);

/**
 * Techo de salida proporcional a lo que se pide. No cambia el precio por token,
 * pero evita que una respuesta se descontrole y corta antes si algo va mal.
 */
function techoDeSalida(numeroDeCampos: number): number {
  return Math.min(12000, 1500 + numeroDeCampos * 900);
}

function respuestaError(error: string, message: string, status: number) {
  return NextResponse.json({ error, message }, { status });
}

export async function POST(request: Request) {
  // Ruta pública sin autenticación: sin límite, cualquiera puede consumir el
  // saldo de OpenAI del propietario. Ver lib/limitePeticiones.ts.
  const limite = comprobarLimite(
    `${RUTA}:${ipDe(request)}`,
    LIMITE_PETICIONES,
    VENTANA_MS
  );
  if (!limite.permitido) {
    return NextResponse.json(
      {
        error: "demasiadas_peticiones",
        message:
          "Has alcanzado el límite de análisis por ahora. Espera unos minutos e intenta de nuevo.",
      },
      { status: 429, headers: { "Retry-After": String(limite.reintentarEn) } }
    );
  }

  let nota: unknown;
  let bloques: unknown;
  try {
    const cuerpo = await request.json();
    nota = (cuerpo as { nota?: unknown } | null)?.nota;
    bloques = (cuerpo as { bloques?: unknown } | null)?.bloques;
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

  // Sin selección explícita se genera el informe completo, como siempre.
  const bloquesPedidos =
    Array.isArray(bloques) && bloques.length > 0
      ? bloques.filter((b): b is string => typeof b === "string")
      : IDS_TODOS;
  const campos = camposParaBloques(bloquesPedidos, CAMPOS_ANALISIS_FUNCIONAL);

  try {
    // La nota se envía con las líneas numeradas: el modelo referencia evidencia
    // por número de línea y el servidor recorta el texto real (ver lib/citas.ts).
    const { lineas, texto: notaNumerada } = numerarNota(nota);

    const openai = new OpenAI({ apiKey });
    const respuesta = await openai.chat.completions.create({
      model: MODELO,
      max_tokens: techoDeSalida(campos.length),
      temperature: 0.2,
      messages: [
        { role: "system", content: construirSystemPrompt(campos) },
        {
          role: "user",
          content: `Notas clínicas a analizar (con líneas numeradas):\n\n${notaNumerada}`,
        },
      ],
    });

    const texto = respuesta.choices[0]?.message?.content?.trim() ?? "";

    const analisis = validarAnalisis(
      normalizarAnalisis(JSON.parse(extraerJSON(texto)), lineas),
      nota
    );
    // Qué se pidió, para que la interfaz sepa qué secciones tiene sentido mostrar.
    analisis.campos_generados =
      bloquesPedidos.length === IDS_TODOS.length ? [] : bloquesPedidos;

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
