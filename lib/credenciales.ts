import { argon2id } from "hash-wasm";
import { aBase64, PARAMETROS_POR_DEFECTO } from "./kdf.ts";

/**
 * Una sola contraseña para la cuenta y para la bóveda.
 *
 *   contraseña + correo ──Argon2id──► clave maestra ─┬─ HKDF "acceso" ─► lo que recibe Firebase
 *                                                    └─ HKDF "boveda" ─► la «frase» de la bóveda
 *
 * Firebase solo ve la derivada de acceso. Con ella no se puede calcular la de
 * la bóveda (HKDF es de un solo sentido y los dominios están separados), así
 * que ni el servidor ni quien lo controle puede abrir los casos.
 *
 * La sal sale del correo: hace falta para poder iniciar sesión en un
 * dispositivo nuevo sin consultar nada antes. Argon2id es lo que encarece
 * probar contraseñas.
 */

export interface Credenciales {
  /** Se envía a Firebase como si fuera la contraseña. */
  acceso: string;
  /** Hace de «frase» de la bóveda; nunca sale del navegador. */
  boveda: string;
}

export interface OpcionesCredenciales {
  m?: number;
  t?: number;
  p?: number;
}

/** Igual que el servidor: minúsculas y sin espacios. */
const normalizarCorreo = (correo: string) => correo.trim().toLowerCase();

function aBase64Url(bytes: Uint8Array): string {
  return aBase64(bytes).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

async function hkdf(maestra: Uint8Array<ArrayBuffer>, info: string): Promise<Uint8Array> {
  const base = await crypto.subtle.importKey("raw", maestra, "HKDF", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: new TextEncoder().encode("acia-cuenta-v1"),
      info: new TextEncoder().encode(info),
    },
    base,
    256
  );
  return new Uint8Array(bits);
}

export async function derivarCredenciales(
  correo: string,
  contrasena: string,
  { m, t, p }: OpcionesCredenciales = {}
): Promise<Credenciales> {
  if (!crypto?.subtle) throw new Error("Este navegador no permite cifrar. Requiere HTTPS.");
  const sal = new Uint8Array(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`acia|cuenta|v1|${normalizarCorreo(correo)}`))
  ).slice(0, 16);
  const maestra = new Uint8Array(
    await argon2id({
      password: contrasena.normalize("NFKC"),
      salt: sal,
      parallelism: p ?? PARAMETROS_POR_DEFECTO.p,
      iterations: t ?? PARAMETROS_POR_DEFECTO.t,
      memorySize: m ?? PARAMETROS_POR_DEFECTO.m,
      hashLength: 32,
      outputType: "binary",
    })
  );
  return {
    acceso: `v2.${aBase64Url(await hkdf(maestra, "acceso"))}`,
    boveda: `v2.${aBase64Url(await hkdf(maestra, "boveda"))}`,
  };
}
