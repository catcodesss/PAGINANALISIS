import { NextResponse } from "next/server";
import { generarTexto, leerClaveIA, MODELO_PRINCIPAL } from "@/lib/clienteIA";
import { MENSAJE_MOTOR_DESACTIVADO, MOTOR_IA_ACTIVO } from "@/lib/motorIA";
import { construirPromptCadenaDbt } from "@/lib/systemPrompt";
import { extraerJSON, normalizarCadenasDbt } from "@/lib/parseAnalisis";
import { numerarNota } from "@/lib/citas";
import { comprobarLimite, ipDe } from "@/lib/limitePeticiones";
import { identificar, comprobar } from "@/lib/servidor/guardiaIA";

/**
 * Añade la cadena DBT a un análisis generado sin ella. La cadena es opcional
 * (ver IDS_POR_DEFECTO en lib/bloques.ts): el clínico la pide desde el nivel
 * Clínico del Mapa y esta ruta la genera sobre la misma nota, sin tocar el
 * resto del análisis. Mismo modelo, temperatura y límite que el reanálisis.
 */

const MODELO = MODELO_PRINCIPAL;
const TEMPERATURA = Number(process.env.IA_TEMPERATURA ?? 0.5);
const RUTA = "reanalizar";
const LIMITE_PETICIONES = Number(process.env.LIMITE_REANALISIS_POR_VENTANA ?? 20);
const VENTANA_MS = Number(process.env.LIMITE_VENTANA_MS ?? 10 * 60 * 1000);
const LONGITUD_MINIMA_NOTA = 20;

interface SituacionResumida {
  nombre: string;
  antecedente: string | null;
  conducta: string | null;
  consecuencia: string | null;
  funcion: string;
}

function respuestaError(error: string, message: string, status: number) {
  return NextResponse.json({ error, message }, { status });
}

/** Solo lo necesario para que el modelo sepa de qué situación habla cada cadena. */
function resumirSituaciones(valor: unknown): SituacionResumida[] | null {
  if (!Array.isArray(valor) || valor.length === 0) return null;
  const texto = (v: unknown) => (typeof v === "string" ? v : null);
  return valor.map((s) => {
    const o = (s ?? {}) as Record<string, unknown>;
    const op = (o.cadena_operante ?? {}) as Record<string, unknown>;
    const consecuencia = (op.consecuencia ?? {}) as Record<string, unknown>;
    return {
      nombre: texto(o.nombre) ?? "",
      antecedente: texto(op.antecedente),
      conducta: texto(op.respuesta),
      consecuencia: texto(consecuencia.texto) ?? texto(op.consecuencia),
      funcion: texto(o.funcion_hipotetizada) ?? "",
    };
  });
}

export async function POST(request: Request) {
  if (!MOTOR_IA_ACTIVO) {
    return respuestaError("motor_desactivado", MENSAJE_MOTOR_DESACTIVADO, 503);
  }

  const { llamada, error: errorSesion } = await identificar(request);
  if (!llamada) return errorSesion;

  const limite = comprobarLimite(`${RUTA}:${ipDe(request)}`, LIMITE_PETICIONES, VENTANA_MS);
  if (!limite.permitido) {
    return NextResponse.json(
      { error: "demasiadas_peticiones", message: "Has alcanzado el límite de reanálisis por ahora. Espera unos minutos e intenta de nuevo." },
      { status: 429, headers: { "Retry-After": String(limite.reintentarEn) } }
    );
  }

  let notaOriginal: unknown;
  let situaciones: SituacionResumida[] | null;
  let cuerpoCrudo: unknown;
  try {
    const cuerpo = (await request.json()) as { notaOriginal?: unknown; situaciones?: unknown } | null;
    cuerpoCrudo = cuerpo;
    notaOriginal = cuerpo?.notaOriginal;
    situaciones = resumirSituaciones(cuerpo?.situaciones);
  } catch {
    return respuestaError("solicitud_invalida", "La solicitud no tiene un formato válido.", 400);
  }

  const errorCaso = await comprobar(llamada, cuerpoCrudo, false);
  if (errorCaso) return errorCaso;

  if (typeof notaOriginal !== "string" || notaOriginal.trim().length < LONGITUD_MINIMA_NOTA) {
    return respuestaError("solicitud_invalida", "Falta la nota clínica original.", 400);
  }
  if (!situaciones) {
    return respuestaError("solicitud_invalida", "El análisis no tiene situaciones a las que añadir la cadena.", 400);
  }

  const apiKey = leerClaveIA();
  if (!apiKey) {
    return respuestaError("falta_api_key", "Falta configurar la clave de API. Revisa el archivo .env.local.", 500);
  }

  try {
    const { lineas, texto: notaNumerada } = numerarNota(notaOriginal);
    const listado = situaciones
      .map((s, i) => `${i}. ${JSON.stringify(s)}`)
      .join("\n");

    const { texto, tokensEntrada, tokensSalida } = await generarTexto(apiKey, {
      modelo: MODELO,
      maxTokens: 8000,
      temperatura: TEMPERATURA,
      sistema: construirPromptCadenaDbt(),
      usuario: `Notas clínicas (con líneas numeradas):\n\n${notaNumerada}\n\nSituaciones ya analizadas (numeradas desde 0):\n\n${listado}`,
    });

    console.info(`[tokens] cadena-dbt entrada=${tokensEntrada} salida=${tokensSalida}`);

    const resultado = normalizarCadenasDbt(JSON.parse(extraerJSON(texto)), situaciones.length, lineas);
    return NextResponse.json(resultado);
  } catch (error) {
    console.error(
      "Error al generar la cadena DBT:",
      error instanceof Error ? `${error.name}: ${error.message}` : "error desconocido"
    );
    return respuestaError("error_analisis", "No se pudo generar la cadena DBT. Intenta nuevamente.", 502);
  }
}
