import { NextResponse } from "next/server";
import { generarTexto, leerClaveIA, MODELO_PRINCIPAL } from "@/lib/clienteIA";
import { MENSAJE_MOTOR_DESACTIVADO, MOTOR_IA_ACTIVO } from "@/lib/motorIA";
import { extraerJSON } from "@/lib/parseAnalisis";
import { numerarNota } from "@/lib/citas";
import { comprobarLimite, ipDe } from "@/lib/limitePeticiones";
import { identificar, comprobar } from "@/lib/servidor/guardiaIA";
import { migrarAV9 } from "@/lib/identidad";
import { calcularApoyoAristas } from "@/lib/apoyoAristas";
import { validarAnalisis } from "@/lib/validadores";
import {
  aplicarPropuestas,
  construirReferencias,
  frasesSinUsar,
  normalizarOperaciones,
  type ConjuntoCambios,
} from "@/lib/actualizacion";
import {
  mensajeUsuarioActualizacion,
  PROMPT_ACTUALIZACION,
  VERSION_PROMPT_ACTUALIZACION,
} from "@/lib/promptActualizacion";
import type { AnalisisFuncional } from "@/lib/types";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { maquetaActivada } from "@/lib/maqueta";

/**
 * Propone cambios sobre la formulación vigente con la nota de la sesión N.
 * No aplica nada: devuelve un ConjuntoCambios pendiente (fase 8).
 *
 * Invariante 5: ni la nota ni la formulación serializada ni la respuesta del
 * modelo se registran. Los errores se escriben solo con su código.
 */

// Mismo límite que /api/analizar y en la misma cuenta: es otra llamada completa.
const RUTA = "analizar";
const LIMITE_PETICIONES = Number(process.env.LIMITE_ANALISIS_POR_VENTANA ?? 5);
const VENTANA_MS = Number(process.env.LIMITE_VENTANA_MS ?? 10 * 60 * 1000);
const TEMPERATURA = Number(process.env.IA_TEMPERATURA ?? 0.5);
const LONGITUD_MINIMA = 40;
const LONGITUD_MAXIMA = 40000;

function error(codigo: string, message: string, status: number) {
  return NextResponse.json({ error: codigo, message }, { status });
}

/**
 * Modo maqueta: la respuesta del modelo es el fixture de la sesión 2 del caso
 * 01, escrito a mano. Pasa por el mismo normalizado y los mismos validadores
 * que una respuesta real. Doble candado en lib/maqueta.ts.
 */
function respuestaDeMaqueta() {
  const texto = readFileSync(join(process.cwd(), "evals/fixtures/01-sesion2-operaciones.json"), "utf8");
  return { texto, truncada: false, tokensEntrada: 0, tokensSalida: 0 };
}

export async function POST(request: Request) {
  const maqueta = maquetaActivada();
  if (!maqueta && !MOTOR_IA_ACTIVO) return error("motor_desactivado", MENSAJE_MOTOR_DESACTIVADO, 503);

  const { llamada, error: errorSesion } = await identificar(request);
  if (!llamada) return errorSesion;

  const limite = maqueta
    ? { permitido: true, reintentarEn: 0 }
    : comprobarLimite(`${RUTA}:${ipDe(request)}`, LIMITE_PETICIONES, VENTANA_MS);
  if (!limite.permitido) {
    return NextResponse.json(
      { error: "demasiadas_peticiones", message: "Has alcanzado el límite de análisis por ahora. Espera unos minutos." },
      { status: 429, headers: { "Retry-After": String(limite.reintentarEn) } }
    );
  }

  let nota: unknown;
  let analisis: unknown;
  let sesion: unknown;
  let cuerpoCrudo: unknown;
  try {
    const cuerpo = (await request.json()) as Record<string, unknown>;
    cuerpoCrudo = cuerpo;
    nota = cuerpo?.nota;
    analisis = cuerpo?.analisis;
    sesion = cuerpo?.sesion;
  } catch {
    return error("solicitud_invalida", "La solicitud no tiene un formato válido.", 400);
  }
  const errorCaso = await comprobar(llamada, cuerpoCrudo, true);
  if (errorCaso) return errorCaso;

  if (typeof nota !== "string" || nota.trim().length < LONGITUD_MINIMA) {
    return error("nota_muy_breve", "La nota de la sesión es demasiado breve para actualizar nada.", 400);
  }
  if (nota.length > LONGITUD_MAXIMA) return error("nota_muy_larga", "La nota excede la longitud máxima.", 400);
  if (typeof analisis !== "object" || analisis === null || !Array.isArray((analisis as AnalisisFuncional).conductas_problema)) {
    return error("solicitud_invalida", "Falta la formulación vigente.", 400);
  }
  const n = Number(sesion);
  if (!Number.isInteger(n) || n < 2) return error("solicitud_invalida", "Falta el número de sesión.", 400);

  const apiKey = leerClaveIA();
  if (!apiKey && !maqueta) return error("falta_api_key", "Falta configurar la clave de API.", 500);

  try {
    const vigente = migrarAV9(structuredClone(analisis as AnalisisFuncional));
    const mapa = construirReferencias(vigente);
    const { lineas, texto: notaNumerada, frases } = numerarNota(nota);

    const respuesta = maqueta ? respuestaDeMaqueta() : await generarTexto(apiKey!, {
      modelo: MODELO_PRINCIPAL,
      maxTokens: 4000,
      temperatura: TEMPERATURA,
      sistema: PROMPT_ACTUALIZACION,
      usuario: mensajeUsuarioActualizacion(mapa.texto, notaNumerada),
    });
    // Solo cifras, nunca contenido.
    console.info(
      `[tokens] actualizar prompt=${VERSION_PROMPT_ACTUALIZACION} entrada=${respuesta.tokensEntrada} salida=${respuesta.tokensSalida}`
    );
    if (respuesta.truncada) return error("respuesta_truncada", "La respuesta del modelo llegó cortada. Intenta de nuevo.", 502);

    const { propuestas, descartadas } = normalizarOperaciones(JSON.parse(extraerJSON(respuesta.texto)), vigente, mapa, lineas);

    // Invariante 3: los validadores corren sobre el resultado de aceptarlo todo.
    const todo = structuredClone(vigente);
    aplicarPropuestas(todo, propuestas.map((propuesta) => ({ propuesta })), n);
    calcularApoyoAristas(todo);
    const antes = new Set(vigente.alertas.map((a) => `${a.codigo}|${a.ruta}`));
    const nuevas = validarAnalisis(todo, "").alertas.filter((a) => !antes.has(`${a.codigo}|${a.ruta}`));

    const conjunto: ConjuntoCambios = {
      sesion: n,
      propuestas,
      descartadas,
      frases_sin_usar: frasesSinUsar(frases, propuestas),
      alertas_nuevas: nuevas.map((a) => a.codigo),
      version_prompt: VERSION_PROMPT_ACTUALIZACION,
    };
    return NextResponse.json({ conjunto, tokens: { entrada: respuesta.tokensEntrada, salida: respuesta.tokensSalida } });
  } catch (e) {
    console.error("Error al actualizar:", e instanceof SyntaxError ? "json_invalido" : "error_modelo");
    return error("error_actualizacion", "No se pudo analizar la sesión. Intenta nuevamente.", 502);
  }
}
