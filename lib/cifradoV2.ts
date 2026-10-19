import { aBase64, deBase64 } from "./kdf.ts";

/**
 * Sobre cifrado v2 para datos clínicos en la nube (fase 13, §3.7 y §4.2).
 *
 * Respecto a `cifrado.ts` (v1, que se conserva para leer y migrar):
 *  - base64 en vez de arreglos de bytes (el v1 infla 3–4× en JSON);
 *  - compresión gzip antes de cifrar;
 *  - relleno a múltiplos de 4 KiB para no revelar el tamaño exacto del texto;
 *  - AAD: el sobre queda atado a usuario, caso, parte, revisión y clave, así que
 *    mover un sobre a otro sitio o devolver uno antiguo falla la verificación.
 */

export const VERSION_SOBRE = 2;
const BLOQUE = 4096;
const LONGITUD_IV = 12;

export interface SobreV2 {
  v: 2;
  /** Versión de la clave de caso con la que se cifró. */
  kid: number;
  iv: string; // base64
  ct: string; // base64
}

export interface ContextoParte {
  uid: string;
  caso_uid: string;
  parte_id: string;
  rev: number;
  kid: number;
}

export function aadDeParte(c: ContextoParte): Uint8Array<ArrayBuffer> {
  return new TextEncoder().encode(
    `acia|parte|${c.uid}|${c.caso_uid}|${c.parte_id}|${c.rev}|${c.kid}|${VERSION_SOBRE}`
  );
}

async function transformar(
  datos: Uint8Array<ArrayBuffer>,
  Clase: typeof CompressionStream | typeof DecompressionStream,
  formato: "gzip"
): Promise<Uint8Array<ArrayBuffer>> {
  const flujo = new Blob([datos]).stream().pipeThrough(new Clase(formato));
  return new Uint8Array(await new Response(flujo).arrayBuffer());
}

/** [longitud 4 bytes][gzip][ceros hasta múltiplo de BLOQUE] */
async function empaquetar(texto: string): Promise<Uint8Array<ArrayBuffer>> {
  const gz = await transformar(new TextEncoder().encode(texto), CompressionStream, "gzip");
  const total = Math.ceil((4 + gz.length) / BLOQUE) * BLOQUE;
  const salida = new Uint8Array(total);
  new DataView(salida.buffer).setUint32(0, gz.length);
  salida.set(gz, 4);
  return salida;
}

async function desempaquetar(plano: Uint8Array<ArrayBuffer>): Promise<string> {
  const largo = new DataView(plano.buffer, plano.byteOffset).getUint32(0);
  if (largo > plano.length - 4) throw new Error("formato inválido");
  const gz = plano.slice(4, 4 + largo);
  return new TextDecoder().decode(await transformar(gz, DecompressionStream, "gzip"));
}

export async function cifrarParte(
  clave: CryptoKey,
  texto: string,
  contexto: ContextoParte
): Promise<SobreV2> {
  const iv = crypto.getRandomValues(new Uint8Array(LONGITUD_IV));
  const ct = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: aadDeParte(contexto) },
    clave,
    await empaquetar(texto)
  );
  return { v: 2, kid: contexto.kid, iv: aBase64(iv), ct: aBase64(new Uint8Array(ct)) };
}

/** null si la clave no corresponde, el sobre se movió o fue manipulado. */
export async function descifrarParte(
  clave: CryptoKey,
  sobre: SobreV2,
  contexto: ContextoParte
): Promise<string | null> {
  if (sobre?.v !== 2 || sobre.kid !== contexto.kid) return null;
  try {
    const plano = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: deBase64(sobre.iv), additionalData: aadDeParte(contexto) },
      clave,
      deBase64(sobre.ct)
    );
    return await desempaquetar(new Uint8Array(plano));
  } catch {
    return null;
  }
}
