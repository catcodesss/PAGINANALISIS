import { NextResponse } from "next/server";
import OpenAI from "openai";
import { construirPromptReanalisisSeccion } from "@/lib/systemPrompt";
import { extraerJSON, normalizarFragmento } from "@/lib/parseAnalisis";
import { numerarNota } from "@/lib/citas";
import { comprobarLimite, ipDe } from "@/lib/limitePeticiones";
import { CAMPOS_ANALISIS_FUNCIONAL, type AnalisisFuncional } from "@/lib/types";

const MODELO = "gpt-4o";
// Misma semilla que app/api/analizar/route.ts: mejor esfuerzo de determinismo.
const SEED = Number(process.env.OPENAI_SEED ?? 42);
// Y la misma temperatura, por la misma razón (ver el comentario de esa ruta).
const TEMPERATURA = Number(process.env.OPENAI_TEMPERATURA ?? 0.5);
const RUTA = "reanalizar";
const LIMITE_PETICIONES = Number(process.env.LIMITE_REANALISIS_POR_VENTANA ?? 20);
const VENTANA_MS = Number(process.env.LIMITE_VENTANA_MS ?? 10 * 60 * 1000);
const LONGITUD_MINIMA_NOTA_ORIGINAL = 20;
const LONGITUD_MINIMA_NOTA_ADICIONAL = 3;
const LONGITUD_MAXIMA_NOTA_ADICIONAL = 4000;

// Misma lista que usa lib/parseAnalisis.ts para normalizar: una sola fuente
// de verdad (lib/types.ts) evita que esta ruta y el normalizador se desincronicen.
const CAMPOS_VALIDOS = new Set<string>(CAMPOS_ANALISIS_FUNCIONAL);

function esListaDeCamposValida(
  valor: unknown
): valor is (keyof AnalisisFuncional)[] {
  return (
    Array.isArray(valor) &&
    valor.length > 0 &&
    valor.every((c) => typeof c === "string" && CAMPOS_VALIDOS.has(c))
  );
}

function respuestaError(error: string, message: string, status: number) {
  return NextResponse.json({ error, message }, { status });
}

export async function POST(request: Request) {
  // Ruta pública sin autenticación: sin límite, cualquiera puede consumir el
  // saldo de OpenAI del propietario. Ver lib/limitePeticiones.ts.
  const limite = comprobarLimite(`${RUTA}:${ipDe(request)}`, LIMITE_PETICIONES, VENTANA_MS);
  if (!limite.permitido) {
    return NextResponse.json(
      { error: "demasiadas_peticiones", message: "Has alcanzado el límite de reanálisis por ahora. Espera unos minutos e intenta de nuevo." },
      { status: 429, headers: { "Retry-After": String(limite.reintentarEn) } }
    );
  }

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

  if (!esListaDeCamposValida(campos)) {
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
    // La nota original y la adicional se numeran como un solo documento continuo:
    // la evidencia del reanálisis puede proceder de cualquiera de las dos, y los
    // números de línea deben resolverse contra el mismo arreglo (ver lib/citas.ts).
    const documento = `${notaOriginal}\n\n--- Nota adicional del clínico ---\n\n${notaAdicional}`;
    const { lineas, texto: documentoNumerado } = numerarNota(documento);

    const openai = new OpenAI({ apiKey });
    const respuesta = await openai.chat.completions.create({
      model: MODELO,
      // Mismo criterio que en /api/analizar: la temperatura baja se reserva
      // para las evals, y el techo deja sitio al razonamiento previo.
      max_tokens: 8000,
      temperature: TEMPERATURA,
      seed: SEED,
      messages: [
        {
          role: "system",
          content: construirPromptReanalisisSeccion(campos),
        },
        {
          role: "user",
          content: `Nota clínica original y nota adicional del clínico (un solo documento, con líneas numeradas):\n\n${documentoNumerado}\n\nAnálisis funcional actual (contexto, no lo reescribas salvo los campos solicitados):\n\n${JSON.stringify(
            analisisActual
          )}`,
        },
      ],
    });

    const texto = respuesta.choices[0]?.message?.content?.trim() ?? "";
    const json = JSON.parse(extraerJSON(texto));
    const fragmento = normalizarFragmento(campos, json, lineas);

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
