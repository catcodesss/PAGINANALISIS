import { NextResponse } from "next/server";
import { detectarDatosFaltantesPrevios } from "@/lib/datosFaltantesPrevios";
import { comprobarLimite, ipDe } from "@/lib/limitePeticiones";
import { maquetaActivada } from "@/lib/maqueta";

const RUTA = "detectar-datos-faltantes";
const LIMITE_PETICIONES = Number(process.env.LIMITE_DETECCION_POR_VENTANA ?? 10);
const VENTANA_MS = Number(process.env.LIMITE_VENTANA_MS ?? 10 * 60 * 1000);
const LONGITUD_MINIMA = 100;
// Igual que /api/analizar: el límite es de coste, no de capacidad del modelo.
const LONGITUD_MAXIMA = Number(process.env.LONGITUD_MAXIMA_NOTA ?? 40000);

/**
 * Comprobación previa al análisis completo (ver lib/datosFaltantesPrevios.ts
 * y app/page.tsx). Deliberadamente permisiva con sus propios fallos: esto es
 * un paso opcional antes de /api/analizar, así que cualquier problema aquí
 * (límite alcanzado, cuerpo inválido, nota fuera de rango, fallo de OpenAI)
 * se traduce en "sin preguntas" en vez de un error — el terapeuta nunca debe
 * quedarse bloqueado por un paso que solo pretendía ahorrarle una vuelta.
 */
export async function POST(request: Request) {
  // Ver lib/maqueta.ts: mismo doble candado que /api/analizar. En modo
  // maqueta el informe ya es uno guardado, así que nunca hay nada que
  // preguntar antes de generarlo.
  if (maquetaActivada()) {
    return NextResponse.json({ preguntas: [] });
  }

  const limite = comprobarLimite(`${RUTA}:${ipDe(request)}`, LIMITE_PETICIONES, VENTANA_MS);
  if (!limite.permitido) {
    return NextResponse.json({ preguntas: [] });
  }

  let nota: unknown;
  try {
    const cuerpo = await request.json();
    nota = (cuerpo as { nota?: unknown } | null)?.nota;
  } catch {
    return NextResponse.json({ preguntas: [] });
  }

  if (
    typeof nota !== "string" ||
    nota.trim().length < LONGITUD_MINIMA ||
    nota.length > LONGITUD_MAXIMA
  ) {
    return NextResponse.json({ preguntas: [] });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ preguntas: [] });
  }

  const preguntas = await detectarDatosFaltantesPrevios(nota, apiKey);
  return NextResponse.json({ preguntas });
}
