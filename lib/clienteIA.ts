import OpenAI from "openai";

/**
 * Única puerta a la API del modelo. Las cuatro llamadas (análisis, reanálisis,
 * datos faltantes y pasada crítica) pasan por aquí para que cambiar de
 * proveedor vuelva a ser tocar un solo fichero.
 *
 * PROVISIONAL: OpenAI mientras no se pueda usar Claude. Al volver a Sonnet se
 * cambia este fichero (SDK, modelos, `NOMBRE_PROVEEDOR` y `VARIABLE_CLAVE`) y
 * nada más: las rutas leen la clave y los mensajes de aquí.
 */
export const MODELO_PRINCIPAL = "gpt-4o";
export const MODELO_LIGERO = "gpt-4o-mini";
export const NOMBRE_PROVEEDOR = "OpenAI";
export const VARIABLE_CLAVE = "OPENAI_API_KEY";

// Fija para que las evals sean comparables entre ejecuciones. El modelo la
// trata como "mejor esfuerzo": no garantiza determinismo, pero reduce varianza.
const SEED = Number(process.env.IA_SEED ?? 42);

export function leerClaveIA(): string | undefined {
  return process.env[VARIABLE_CLAVE];
}

export interface PeticionIA {
  modelo: string;
  sistema: string;
  usuario: string;
  maxTokens: number;
  temperatura: number;
}

export interface RespuestaIA {
  texto: string;
  /** El modelo agotó maxTokens: el JSON llega cortado. */
  truncada: boolean;
  /** Solo cifras de consumo: sirven para comparar versiones del prompt, sin contenido clínico. */
  tokensEntrada: number;
  tokensSalida: number;
}

export async function generarTexto(
  apiKey: string,
  p: PeticionIA
): Promise<RespuestaIA> {
  const cliente = new OpenAI({ apiKey });
  const respuesta = await cliente.chat.completions.create({
    model: p.modelo,
    max_tokens: p.maxTokens,
    temperature: p.temperatura,
    seed: SEED,
    // Sin conservar la petición en OpenAI y sin uid ni correo del usuario (fase 13 §6.3).
    store: false,
    messages: [
      { role: "system", content: p.sistema },
      { role: "user", content: p.usuario },
    ],
  });
  const eleccion = respuesta.choices[0];
  return {
    texto: eleccion?.message?.content?.trim() ?? "",
    truncada: eleccion?.finish_reason === "length",
    tokensEntrada: respuesta.usage?.prompt_tokens ?? 0,
    tokensSalida: respuesta.usage?.completion_tokens ?? 0,
  };
}
