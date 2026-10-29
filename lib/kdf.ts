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

// --- Clave de recuperación en 12 palabras ---------------------------------
//
// 128 bits aleatorios + 4 bits de control = 132 bits = 12 palabras de 11 bits.
// Las palabras son pronunciables y de 4 letras (consonante-vocal-consonante-vocal,
// sin c/g/h/j/ñ/q/x/y/k/w para que no haya sonidos ambiguos al dictarlas ni al
// copiarlas a mano). 3 540 combinaciones posibles, se usan 2 048 repartidas.

const CONSONANTES = "bdflmnprstvz";
const VOCALES = "aeiou";
const SILABAS = [...CONSONANTES].flatMap((c) => [...VOCALES].map((v) => c + v));

export const PALABRAS_RECUPERACION: readonly string[] = (() => {
  const todas: string[] = [];
  for (const a of SILABAS) for (const b of SILABAS) if (a !== b) todas.push(a + b);
  return Array.from({ length: 2048 }, (_, i) => todas[Math.floor((i * todas.length) / 2048)]);
})();

const INDICE_PALABRA = new Map(PALABRAS_RECUPERACION.map((p, i) => [p, i]));

export const NUM_PALABRAS_RECUPERACION = 12;

function control4(bytes: Uint8Array): number {
  let c = 7;
  for (const b of bytes) c = (c * 31 + b + 1) & 0xff;
  return (c ^ (c >> 4)) & 15;
}

/** 16 bytes aleatorios → 12 palabras separadas por espacios. */
export function codificarPalabras(bytes: Uint8Array): string {
  if (bytes.length !== 16) throw new Error("La clave de recuperación debe tener 16 bytes.");
  let bits = "";
  for (const b of bytes) bits += b.toString(2).padStart(8, "0");
  bits += control4(bytes).toString(2).padStart(4, "0");
  const palabras: string[] = [];
  for (let i = 0; i < bits.length; i += 11) palabras.push(PALABRAS_RECUPERACION[parseInt(bits.slice(i, i + 11), 2)]);
  return palabras.join(" ");
}

/** Null si no son 12 palabras de la lista o el control no cuadra (una errata). */
export function decodificarPalabras(texto: string): Uint8Array<ArrayBuffer> | null {
  const palabras = texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter(Boolean);
  if (palabras.length !== NUM_PALABRAS_RECUPERACION) return null;
  let bits = "";
  for (const p of palabras) {
    const i = INDICE_PALABRA.get(p);
    if (i === undefined) return null;
    bits += i.toString(2).padStart(11, "0");
  }
  const bytes = new Uint8Array(16);
  for (let i = 0; i < 16; i++) bytes[i] = parseInt(bits.slice(i * 8, i * 8 + 8), 2);
  return parseInt(bits.slice(128), 2) === control4(bytes) ? bytes : null;
}

/** Devuelve null si el texto no es una clave de recuperación válida (en palabras o en el formato antiguo). */
export function decodificarRecuperacion(texto: string): Uint8Array<ArrayBuffer> | null {
  const enPalabras = decodificarPalabras(texto);
  if (enPalabras) return enPalabras;
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
