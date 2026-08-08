import { NextResponse } from "next/server";
import OpenAI from "openai";
import { construirSystemPrompt, VERSION_PROMPT } from "@/lib/systemPrompt";
import { extraerJSON, normalizarAnalisis } from "@/lib/parseAnalisis";
import { numerarNota } from "@/lib/citas";
import { validarAnalisis } from "@/lib/validadores";
import { ejecutarPasadaCritica } from "@/lib/pasadaCritica";
import { comprobarLimite, ipDe } from "@/lib/limitePeticiones";
import { camposParaBloques, IDS_TODOS } from "@/lib/bloques";
import { CAMPOS_ANALISIS_FUNCIONAL } from "@/lib/types";
import { informeDeMaqueta, maquetaActivada } from "@/lib/maqueta";

const MODELO = "gpt-4o";
// Fija para que las evals sean comparables entre ejecuciones. El modelo lo
// trata como "mejor esfuerzo": no garantiza determinismo, pero reduce varianza.
const SEED = Number(process.env.OPENAI_SEED ?? 42);
// Opt-in: duplica el coste del análisis (segunda llamada, ver lib/pasadaCritica.ts).
// Desactivada por defecto; se activa con PASADA_CRITICA=true.
const PASADA_CRITICA_ACTIVADA = process.env.PASADA_CRITICA === "true";
const RUTA = "analizar";
const LIMITE_PETICIONES = Number(process.env.LIMITE_ANALISIS_POR_VENTANA ?? 5);
const VENTANA_MS = Number(process.env.LIMITE_VENTANA_MS ?? 10 * 60 * 1000);
const LONGITUD_MINIMA = 100;
// Ampliado a petición de uso real. gpt-4o admite mucho más contexto del que
// gastamos; el límite existe para acotar el coste, no por capacidad del modelo.
const LONGITUD_MAXIMA = Number(process.env.LONGITUD_MAXIMA_NOTA ?? 40000);

/**
 * A 0.2 el modelo toma siempre el camino más típico, y típico sale genérico:
 * es la calibración correcta para que las evals sean comparables entre
 * ejecuciones, y la equivocada para la profundidad del informe (ver principio
 * 22 del prompt). Por eso producción va más alta y las evals fijan la suya:
 * córrelas con OPENAI_TEMPERATURA=0.2 o los números no se podrán comparar con
 * las marcas anteriores.
 */
const TEMPERATURA = Number(process.env.OPENAI_TEMPERATURA ?? 0.5);

/**
 * Techo de salida proporcional a lo que se pide. No cambia el precio por token,
 * pero evita que una respuesta se descontrole y corta antes si algo va mal.
 *
 * El tope global es el máximo real de gpt-4o (16 384). Antes estaba en 12 000 y
 * mordía: el informe completo con las tres capas pide 23 campos, y ahora además
 * gasta el razonamiento previo antes de empezar a escribirlo.
 */
function techoDeSalida(numeroDeCampos: number): number {
  return Math.min(16000, 2000 + numeroDeCampos * 1100);
}

function respuestaError(error: string, message: string, status: number) {
  return NextResponse.json({ error, message }, { status });
}

/**
 * Traduce el fallo a algo que el clínico pueda accionar. "Intenta nuevamente"
 * es un mal consejo cuando reintentar no puede funcionar: si la cuenta de
 * OpenAI no tiene saldo o la clave está mal, el usuario reintenta diez veces
 * sin enterarse de nada. Todos los textos son fijos: no llevan nada de la nota
 * ni del análisis (invariante 5).
 */
function causaDelFallo(error: unknown): { error: string; message: string } {
  const estado =
    typeof error === "object" && error !== null && "status" in error
      ? Number((error as { status?: unknown }).status)
      : undefined;

  if (estado === 401 || estado === 403) {
    return {
      error: "clave_rechazada",
      message:
        "OpenAI rechazó la clave de API. Revisa que OPENAI_API_KEY sea válida y tenga permisos sobre el modelo.",
    };
  }
  if (estado === 429) {
    return {
      error: "cuota_openai",
      message:
        "OpenAI está limitando las peticiones o la cuenta se quedó sin saldo. Revisa el saldo y los límites de uso antes de reintentar.",
    };
  }
  if (estado === 400) {
    return {
      error: "peticion_rechazada",
      message:
        "OpenAI rechazó la petición por un parámetro fuera de rango. Es un fallo de configuración del servidor, no de tu nota.",
    };
  }
  if (estado !== undefined && estado >= 500) {
    return {
      error: "openai_caido",
      message:
        "OpenAI no respondió correctamente. Suele ser temporal: espera un minuto e intenta de nuevo.",
    };
  }
  if (error instanceof SyntaxError) {
    return {
      error: "respuesta_ilegible",
      message:
        "El modelo devolvió una respuesta que no se pudo leer como informe. Intenta de nuevo; si se repite, genera el informe por partes.",
    };
  }
  return {
    error: "error_analisis",
    message: "No se pudo completar el análisis. Intenta nuevamente.",
  };
}

export async function POST(request: Request) {
  /*
    Modo maqueta: devuelve un informe guardado, sin llamar a OpenAI. Va lo
    primero de todo, antes incluso del límite de peticiones, porque no consume
    nada y revisar la interfaz no debería tener cupo. Solo funciona fuera de
    producción y con la variable puesta (ver lib/maqueta.ts).
  */
  if (maquetaActivada()) {
    return NextResponse.json({ analisis: informeDeMaqueta().analisis });
  }

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
      temperature: TEMPERATURA,
      seed: SEED,
      messages: [
        { role: "system", content: construirSystemPrompt(campos) },
        {
          role: "user",
          content: `Notas clínicas a analizar (con líneas numeradas):\n\n${notaNumerada}`,
        },
      ],
    });

    const eleccion = respuesta.choices[0];
    const texto = eleccion?.message?.content?.trim() ?? "";

    // Si el modelo agota el techo de salida, el JSON llega cortado y
    // JSON.parse falla con un mensaje que no dice nada de la causa real. Se
    // distingue aquí para que el usuario sepa que puede generar por partes en
    // lugar de reintentar lo mismo. El motivo de parada es una palabra de
    // estado del proveedor, no contenido de la nota: se puede registrar.
    if (eleccion?.finish_reason === "length") {
      console.error(
        `Respuesta truncada: el modelo agotó max_tokens=${techoDeSalida(
          campos.length
        )} con ${campos.length} campos pedidos.`
      );
      return respuestaError(
        "respuesta_truncada",
        "El análisis salió más largo de lo que cabe en una sola respuesta. Genera el informe por partes con el selector de secciones, o acorta la nota.",
        502
      );
    }

    const analisis = validarAnalisis(
      normalizarAnalisis(JSON.parse(extraerJSON(texto)), lineas),
      nota
    );
    // Qué se pidió, para que la interfaz sepa qué secciones tiene sentido mostrar.
    analisis.campos_generados =
      bloquesPedidos.length === IDS_TODOS.length ? [] : bloquesPedidos;
    // Trazabilidad: qué modelo y qué versión del prompt generaron este informe.
    analisis.meta = { modelo: MODELO, version_prompt: VERSION_PROMPT };

    // Opt-in y solo para el informe completo: sobre un análisis parcial, la
    // pasada crítica generaría falsas alarmas de "contenido no recogido" por
    // secciones que ni se pidieron.
    if (PASADA_CRITICA_ACTIVADA && bloquesPedidos.length === IDS_TODOS.length) {
      try {
        const hallazgos = await ejecutarPasadaCritica(analisis, notaNumerada, apiKey);
        const vistos = new Set(analisis.alertas.map((a) => `${a.ruta}|${a.mensaje}`));
        for (const hallazgo of hallazgos) {
          const clave = `${hallazgo.ruta}|${hallazgo.mensaje}`;
          if (vistos.has(clave)) continue;
          vistos.add(clave);
          analisis.alertas.push(hallazgo);
        }
      } catch (error) {
        // La pasada crítica es un extra: si falla, el análisis principal ya
        // generado se devuelve igual, sin sus hallazgos.
        console.error(
          "Error en la pasada crítica (no bloquea el análisis):",
          error instanceof Error ? error.message : "error desconocido"
        );
      }
    }

    return NextResponse.json({ analisis });
  } catch (error) {
    // El nombre del error distingue de un vistazo las tres causas que se
    // confunden bajo el mismo mensaje genérico: SyntaxError es JSON mal
    // formado (respuesta cortada o con texto alrededor), APIError es un
    // rechazo de OpenAI (clave, cuota, parámetro fuera de rango) y el resto
    // es cosa nuestra. Nunca se registra la nota ni el análisis.
    console.error(
      "Error al generar el análisis funcional:",
      error instanceof Error ? `${error.name}: ${error.message}` : "error desconocido"
    );
    const causa = causaDelFallo(error);
    return respuestaError(causa.error, causa.message, 502);
  }
}
