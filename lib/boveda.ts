import {
  aBase64,
  codificarRecuperacion,
  decodificarRecuperacion,
  deBase64,
  derivarKekDeFrase,
  derivarKekDeRecuperacion,
  parametrosNuevos,
  type ParametrosArgon2,
} from "./kdf.ts";

/**
 * Bóveda de claves (fase 13, §3.1).
 *
 *   frase ──Argon2id──► KEK ─┐
 *   clave de recuperación ───┼─ envuelven ─► CMD ─ envuelve ─► CC de cada caso
 *
 * El servidor guarda solo la `Boveda` (ranuras = CMD envuelta). Sin la frase o
 * la clave de recuperación son opacas. La CMD y las CC se devuelven como
 * `CryptoKey` NO extraíbles: no hay forma de sacarlas del navegador. Las
 * operaciones que necesitan reenvolverlas (cambiar frase, rotar) vuelven a
 * desbloquear internamente con una copia extraíble de vida corta.
 */

export const FORMATO_BOVEDA = 1;
const LONGITUD_IV = 12;
const USOS: KeyUsage[] = ["encrypt", "decrypt", "wrapKey", "unwrapKey"];

export interface RanuraClave {
  id: string;
  tipo: "frase" | "recuperacion";
  /** Solo en `frase`. */
  kdf?: ParametrosArgon2;
  iv: string;
  /** CMD envuelta (AES-GCM). */
  cmd: string;
}

export interface Boveda {
  formato: number;
  /** Sube al rotar la CMD. */
  version_clave: number;
  ranuras: RanuraClave[];
  creado_en: string;
}

export interface ClaveCasoEnvuelta {
  caso_uid: string;
  kid: number;
  iv: string;
  cc: string;
}

export interface OpcionesKdf {
  m?: number;
  t?: number;
  p?: number;
}

function aadRanura(
  r: Pick<RanuraClave, "id" | "tipo">,
  versionClave: number
): Uint8Array<ArrayBuffer> {
  return new TextEncoder().encode(`acia|ranura|${r.tipo}|${r.id}|${versionClave}`);
}

function aadCaso(uid: string, casoUid: string, kid: number): Uint8Array<ArrayBuffer> {
  return new TextEncoder().encode(`acia|cc|${uid}|${casoUid}|${kid}`);
}

const iv12 = () => crypto.getRandomValues(new Uint8Array(LONGITUD_IV));

async function envolver(
  clave: CryptoKey,
  kek: CryptoKey,
  aad: Uint8Array<ArrayBuffer>
): Promise<{ iv: string; datos: string }> {
  const iv = iv12();
  const datos = await crypto.subtle.wrapKey("raw", clave, kek, {
    name: "AES-GCM",
    iv,
    additionalData: aad,
  });
  return { iv: aBase64(iv), datos: aBase64(new Uint8Array(datos)) };
}

async function desenvolver(
  datos: string,
  iv: string,
  kek: CryptoKey,
  aad: Uint8Array<ArrayBuffer>,
  extraible: boolean
): Promise<CryptoKey | null> {
  try {
    return await crypto.subtle.unwrapKey(
      "raw",
      deBase64(datos),
      kek,
      { name: "AES-GCM", iv: deBase64(iv), additionalData: aad },
      { name: "AES-GCM", length: 256 },
      extraible,
      USOS
    );
  } catch {
    return null;
  }
}

function generarClave(): Promise<CryptoKey> {
  return crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, USOS);
}

/** Reimporta una clave extraíble como no extraíble. */
async function comoNoExtraible(clave: CryptoKey): Promise<CryptoKey> {
  const crudo = await crypto.subtle.exportKey("raw", clave);
  return crypto.subtle.importKey("raw", crudo, { name: "AES-GCM" }, false, USOS);
}

async function ranuraDeFrase(
  cmd: CryptoKey,
  frase: string,
  versionClave: number,
  opciones: OpcionesKdf
): Promise<RanuraClave> {
  const kdf = parametrosNuevos(opciones);
  const base = { id: crypto.randomUUID(), tipo: "frase" as const };
  const kek = await derivarKekDeFrase(frase, kdf);
  const { iv, datos } = await envolver(cmd, kek, aadRanura(base, versionClave));
  return { ...base, kdf, iv, cmd: datos };
}

async function ranuraDeRecuperacion(
  cmd: CryptoKey,
  versionClave: number
): Promise<{ ranura: RanuraClave; clave: string }> {
  const secreto = crypto.getRandomValues(new Uint8Array(32));
  const base = { id: crypto.randomUUID(), tipo: "recuperacion" as const };
  const kek = await derivarKekDeRecuperacion(secreto);
  const { iv, datos } = await envolver(cmd, kek, aadRanura(base, versionClave));
  return { ranura: { ...base, iv, cmd: datos }, clave: codificarRecuperacion(secreto) };
}

/** Mínimo exigido a la frase de paso (§3.2). */
export function fraseAceptable(frase: string): boolean {
  return frase.normalize("NFKC").length >= 12;
}

function exigirFrase(frase: string) {
  if (!fraseAceptable(frase)) {
    throw new Error("La frase de paso debe tener al menos 12 caracteres.");
  }
}

export async function crearBoveda(
  frase: string,
  opciones: OpcionesKdf = {}
): Promise<{ boveda: Boveda; cmd: CryptoKey; claveRecuperacion: string }> {
  exigirFrase(frase);
  const cmdExtraible = await generarClave();
  const version = 1;
  const rf = await ranuraDeFrase(cmdExtraible, frase, version, opciones);
  const rr = await ranuraDeRecuperacion(cmdExtraible, version);
  return {
    boveda: {
      formato: FORMATO_BOVEDA,
      version_clave: version,
      ranuras: [rf, rr.ranura],
      creado_en: new Date().toISOString(),
    },
    cmd: await comoNoExtraible(cmdExtraible),
    claveRecuperacion: rr.clave,
  };
}

async function desbloquearInterno(
  b: Boveda,
  tipo: RanuraClave["tipo"],
  kek: (r: RanuraClave) => Promise<CryptoKey | null>,
  extraible: boolean
): Promise<CryptoKey | null> {
  for (const r of b.ranuras.filter((x) => x.tipo === tipo)) {
    const k = await kek(r);
    if (!k) continue;
    const cmd = await desenvolver(r.cmd, r.iv, k, aadRanura(r, b.version_clave), extraible);
    if (cmd) return cmd;
  }
  return null;
}

const conFrase = (frase: string) => async (r: RanuraClave) =>
  r.kdf ? derivarKekDeFrase(frase, r.kdf) : null;

const conRecuperacion = (texto: string) => async (): Promise<CryptoKey | null> => {
  const secreto = decodificarRecuperacion(texto);
  return secreto ? derivarKekDeRecuperacion(secreto) : null;
};

/** CMD no extraíble, o null si la frase no corresponde. */
export function desbloquearConFrase(b: Boveda, frase: string): Promise<CryptoKey | null> {
  return desbloquearInterno(b, "frase", conFrase(frase), false);
}

export function desbloquearConRecuperacion(b: Boveda, clave: string): Promise<CryptoKey | null> {
  return desbloquearInterno(b, "recuperacion", conRecuperacion(clave), false);
}

/** Cambiar frase: solo se reenvuelve la CMD; los datos no se tocan. */
export async function cambiarFrase(
  b: Boveda,
  fraseActual: string,
  fraseNueva: string,
  opciones: OpcionesKdf = {}
): Promise<Boveda | null> {
  exigirFrase(fraseNueva);
  const cmd = await desbloquearInterno(b, "frase", conFrase(fraseActual), true);
  if (!cmd) return null;
  const nueva = await ranuraDeFrase(cmd, fraseNueva, b.version_clave, opciones);
  return { ...b, ranuras: [...b.ranuras.filter((r) => r.tipo !== "frase"), nueva] };
}

/** Olvidó la frase: la clave de recuperación permite fijar una nueva. */
export async function restablecerFraseConRecuperacion(
  b: Boveda,
  claveRecuperacion: string,
  fraseNueva: string,
  opciones: OpcionesKdf = {}
): Promise<Boveda | null> {
  exigirFrase(fraseNueva);
  const cmd = await desbloquearInterno(b, "recuperacion", conRecuperacion(claveRecuperacion), true);
  if (!cmd) return null;
  const nueva = await ranuraDeFrase(cmd, fraseNueva, b.version_clave, opciones);
  return { ...b, ranuras: [...b.ranuras.filter((r) => r.tipo !== "frase"), nueva] };
}

/** Nueva clave de recuperación; la anterior deja de servir. */
export async function regenerarRecuperacion(
  b: Boveda,
  frase: string
): Promise<{ boveda: Boveda; claveRecuperacion: string } | null> {
  const cmd = await desbloquearInterno(b, "frase", conFrase(frase), true);
  if (!cmd) return null;
  const rr = await ranuraDeRecuperacion(cmd, b.version_clave);
  return {
    boveda: { ...b, ranuras: [...b.ranuras.filter((r) => r.tipo !== "recuperacion"), rr.ranura] },
    claveRecuperacion: rr.clave,
  };
}

// --- Claves por caso -----------------------------------------------------

export async function crearClaveCaso(
  cmd: CryptoKey,
  uid: string,
  casoUid: string,
  kid = 1
): Promise<{ envuelta: ClaveCasoEnvuelta; cc: CryptoKey }> {
  const ccExtraible = await generarClave();
  const { iv, datos } = await envolver(ccExtraible, cmd, aadCaso(uid, casoUid, kid));
  return {
    envuelta: { caso_uid: casoUid, kid, iv, cc: datos },
    cc: await comoNoExtraible(ccExtraible),
  };
}

export function abrirClaveCaso(
  cmd: CryptoKey,
  uid: string,
  e: ClaveCasoEnvuelta
): Promise<CryptoKey | null> {
  return desenvolver(e.cc, e.iv, cmd, aadCaso(uid, e.caso_uid, e.kid), false);
}

/**
 * Rotar la CMD (sospecha de filtración): CMD nueva, ranuras nuevas (también
 * clave de recuperación nueva) y reenvoltura de todas las claves de caso. Los
 * datos clínicos no se recifran porque las CC no cambian. Todo o nada: si una
 * clave de caso no se abre, no se devuelve nada.
 */
export async function rotarCmd(
  b: Boveda,
  frase: string,
  uid: string,
  casos: ClaveCasoEnvuelta[],
  opciones: OpcionesKdf = {}
): Promise<{ boveda: Boveda; casos: ClaveCasoEnvuelta[]; claveRecuperacion: string } | null> {
  const vieja = await desbloquearInterno(b, "frase", conFrase(frase), false);
  if (!vieja) return null;
  const nuevaCmd = await generarClave();
  const version = b.version_clave + 1;

  const reenvueltas: ClaveCasoEnvuelta[] = [];
  for (const e of casos) {
    const cc = await desenvolver(e.cc, e.iv, vieja, aadCaso(uid, e.caso_uid, e.kid), true);
    if (!cc) return null;
    const { iv, datos } = await envolver(cc, nuevaCmd, aadCaso(uid, e.caso_uid, e.kid));
    reenvueltas.push({ ...e, iv, cc: datos });
  }
  const rf = await ranuraDeFrase(nuevaCmd, frase, version, opciones);
  const rr = await ranuraDeRecuperacion(nuevaCmd, version);
  return {
    boveda: { ...b, version_clave: version, ranuras: [rf, rr.ranura] },
    casos: reenvueltas,
    claveRecuperacion: rr.clave,
  };
}
