import { argon2id } from "hash-wasm";

/**
 * Derivación de claves a partir de secretos de usuario (fase 13, §3.2).
 *
 * La frase de paso pasa por Argon2id (WASM): es memoria-dura, así que encarece
 * el ataque offline si alguien se lleva la ranura de clave de Firestore. Los
 * parámetros viajan dentro de cada ranura para poder subirlos más adelante
 * recifrando solo la ranura.
 *
 * La clave de recuperación ya es aleatoria de 256 bits: no necesita un KDF
 * lento, basta HKDF para separar dominios.
 */

export interface ParametrosArgon2 {
  alg: "argon2id";
  /** KiB de memoria. */
  m: number;
  /** Pasadas. */
  t: number;
  /** Hilos. En navegador, 1. */
  p: number;
  sal: string; // base64
}

export const PARAMETROS_POR_DEFECTO = { m: 65536, t: 3, p: 1 } as const;

export function aBase64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(s);
}

export function deBase64(texto: string): Uint8Array<ArrayBuffer> {
  const s = atob(texto);
  const salida = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) salida[i] = s.charCodeAt(i);
  return salida;
}

function cripto(): Crypto {
  const c = globalThis.crypto;
  if (!c?.subtle) throw new Error("Este navegador no permite cifrar. Requiere HTTPS.");
  return c;
}

export function parametrosNuevos(
  sobrescribir: Partial<Pick<ParametrosArgon2, "m" | "t" | "p">> = {}
): ParametrosArgon2 {
  return {
    alg: "argon2id",
    ...PARAMETROS_POR_DEFECTO,
    ...sobrescribir,
    sal: aBase64(cripto().getRandomValues(new Uint8Array(16))),
  };
}

/** Clave de envoltura (AES-GCM 256) derivada de la frase de paso. */
export async function derivarKekDeFrase(
  frase: string,
  params: ParametrosArgon2
): Promise<CryptoKey> {
  const crudo = await argon2id({
    password: frase.normalize("NFKC"),
    salt: deBase64(params.sal),
    parallelism: params.p,
    iterations: params.t,
    memorySize: params.m,
    hashLength: 32,
    outputType: "binary",
  });
  return importarKek(new Uint8Array(crudo));
}

/** Clave de envoltura derivada de la clave de recuperación (256 bits aleatorios). */
export async function derivarKekDeRecuperacion(secreto: Uint8Array<ArrayBuffer>): Promise<CryptoKey> {
  const c = cripto();
  const base = await c.subtle.importKey("raw", secreto, "HKDF", false, ["deriveBits"]);
  const bits = await c.subtle.deriveBits(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: new TextEncoder().encode("acia-recuperacion-v1"),
      info: new TextEncoder().encode("kek"),
    },
    base,
    256
  );
  return importarKek(new Uint8Array(bits));
}

function importarKek(crudo: Uint8Array<ArrayBuffer>): Promise<CryptoKey> {
  return cripto().subtle.importKey("raw", crudo, { name: "AES-GCM" }, false, [
    "wrapKey",
    "unwrapKey",
  ]);
}

// --- Clave de recuperación legible: 52 caracteres Crockford en grupos de 4 ---

const ALFABETO = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

export function codificarRecuperacion(bytes: Uint8Array): string {
  let bits = 0;
  let valor = 0;
  let s = "";
  for (const b of bytes) {
    valor = (valor << 8) | b;
    bits += 8;
    while (bits >= 5) {
      s += ALFABETO[(valor >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) s += ALFABETO[(valor << (5 - bits)) & 31];
  return s.match(/.{1,4}/g)!.join("-");
}

/** Devuelve null si el texto no es una clave de recuperación válida. */
export function decodificarRecuperacion(texto: string): Uint8Array<ArrayBuffer> | null {
  const limpio = texto
    .toUpperCase()
    .replace(/[\s-]/g, "")
    .replace(/O/g, "0")
    .replace(/[IL]/g, "1");
  if (limpio.length !== 52) return null;
  const salida = new Uint8Array(32);
  let bits = 0;
  let valor = 0;
  let i = 0;
  for (const ch of limpio) {
    const v = ALFABETO.indexOf(ch);
    if (v < 0) return null;
    valor = (valor << 5) | v;
    bits += 5;
    if (bits >= 8) {
      salida[i++] = (valor >>> (bits - 8)) & 255;
      bits -= 8;
    }
    if (i === 32) break;
  }
  return salida;
}
