/**
 * Cifrado del historial local.
 *
 * Decisión de arquitectura: los análisis guardados se cifran en el navegador con
 * una clave derivada de una contraseña que elige el clínico. El servidor no
 * participa y no puede leerlos. Esto mantiene a ACIA fuera del papel de
 * responsable del tratamiento de datos de salud.
 *
 * Consecuencia asumida: si el usuario pierde la contraseña, los datos no se
 * pueden recuperar. No hay puerta trasera, y eso es precisamente la garantía.
 * La interfaz debe decirlo con claridad antes de que el usuario elija contraseña.
 *
 * Usa WebCrypto, disponible en todos los navegadores actuales bajo HTTPS (y en
 * localhost). No hay dependencias externas.
 */

const ITERACIONES = 310_000; // PBKDF2-SHA256, recomendación OWASP 2023
const LONGITUD_SAL = 16;
const LONGITUD_IV = 12; // AES-GCM
const ALGORITMO = "AES-GCM";

/** Testigo que se cifra al configurar y se descifra para validar la contraseña. */
const TESTIGO = "acia-historial-v1";

export interface SobreCifrado {
  iv: number[];
  datos: number[];
}

function cripto(): Crypto {
  const c = globalThis.crypto;
  if (!c?.subtle) {
    throw new Error(
      "Este navegador no permite cifrar el historial. Requiere una conexión segura (HTTPS)."
    );
  }
  return c;
}

export function generarSal(): number[] {
  return Array.from(cripto().getRandomValues(new Uint8Array(LONGITUD_SAL)));
}

/**
 * Deriva la clave AES a partir de la contraseña. Es deliberadamente lenta
 * (310.000 iteraciones): encarece el ataque por fuerza bruta si alguien se lleva
 * la base de datos del navegador. Tarda unos cientos de milisegundos, así que se
 * hace una sola vez al desbloquear, no en cada guardado.
 */
export async function derivarClave(
  contrasena: string,
  sal: number[]
): Promise<CryptoKey> {
  const c = cripto();
  const material = await c.subtle.importKey(
    "raw",
    new TextEncoder().encode(contrasena),
    "PBKDF2",
    false,
    ["deriveKey"]
  );

  return c.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: new Uint8Array(sal),
      iterations: ITERACIONES,
      hash: "SHA-256",
    },
    material,
    { name: ALGORITMO, length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

export async function cifrar(clave: CryptoKey, texto: string): Promise<SobreCifrado> {
  const c = cripto();
  const iv = c.getRandomValues(new Uint8Array(LONGITUD_IV));
  const datos = await c.subtle.encrypt(
    { name: ALGORITMO, iv },
    clave,
    new TextEncoder().encode(texto)
  );
  return { iv: Array.from(iv), datos: Array.from(new Uint8Array(datos)) };
}

/** Devuelve null si la clave no corresponde, en vez de lanzar. */
export async function descifrar(
  clave: CryptoKey,
  sobre: SobreCifrado
): Promise<string | null> {
  try {
    const plano = await cripto().subtle.decrypt(
      { name: ALGORITMO, iv: new Uint8Array(sobre.iv) },
      clave,
      new Uint8Array(sobre.datos)
    );
    return new TextDecoder().decode(plano);
  } catch {
    // AES-GCM falla la verificación de integridad: contraseña incorrecta o
    // dato manipulado. Para quien llama son el mismo caso.
    return null;
  }
}

export async function crearTestigo(clave: CryptoKey): Promise<SobreCifrado> {
  return cifrar(clave, TESTIGO);
}

export async function verificarTestigo(
  clave: CryptoKey,
  testigo: SobreCifrado
): Promise<boolean> {
  return (await descifrar(clave, testigo)) === TESTIGO;
}

export function nuevoId(): string {
  return cripto().randomUUID();
}
