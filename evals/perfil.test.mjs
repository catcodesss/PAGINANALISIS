/**
 * Perfil básico de la cuenta (nombre, fecha de nacimiento, país): validación y
 * ruta POST /api/perfil, sin Firebase ni red.
 *
 * Ejecutar:  node evals/perfil.test.mjs
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
execFileSync(
  process.execPath,
  [
    join(RAIZ, "node_modules/typescript/bin/tsc"),
    "lib/servidor/perfilHttp.ts",
    "--outDir", ".tmp-evals-perfil",
    "--rootDir", "lib",
    "--module", "commonjs",
    "--moduleResolution", "node",
    "--target", "es2022",
    "--skipLibCheck",
  ],
  { cwd: RAIZ, stdio: "inherit" }
);
const require = createRequire(import.meta.url);
const { manejarPerfil } = require(join(RAIZ, ".tmp-evals-perfil/servidor/perfilHttp.js"));
const { validarPerfil, PAISES } = require(join(RAIZ, ".tmp-evals-perfil/perfil.js"));

let n = 0;
async function prueba(nombre, fn) {
  try {
    await fn();
    n++;
    console.log(`  ok   ${nombre}`);
  } catch (e) {
    console.error(`  FALLA ${nombre}\n        ${e.stack}`);
    process.exitCode = 1;
  }
}

const HOY = new Date("2026-10-28T12:00:00Z");
const bueno = { nombre: "  Ana  María Pérez ", nacimiento: "1990-05-17", pais: "PE" };

console.log("\nPerfil\n");

await prueba("un perfil correcto se limpia (espacios) y se acepta", () => {
  const r = validarPerfil(bueno, HOY);
  assert.deepEqual(r.perfil, { nombre: "Ana María Pérez", nacimiento: "1990-05-17", pais: "PE" });
});
await prueba("pide nombre, fecha y país", () => {
  assert.match(validarPerfil({ ...bueno, nombre: " " }, HOY).error, /nombre/i);
  assert.match(validarPerfil({ ...bueno, nacimiento: "" }, HOY).error, /fecha/i);
  assert.match(validarPerfil({ ...bueno, pais: "" }, HOY).error, /país/i);
  assert.match(validarPerfil(null, HOY).error, /nombre/i);
});
await prueba("fechas imposibles o de menores se rechazan", () => {
  assert.ok(validarPerfil({ ...bueno, nacimiento: "1990-02-31" }, HOY).error);
  assert.ok(validarPerfil({ ...bueno, nacimiento: "1850-01-01" }, HOY).error);
  assert.match(validarPerfil({ ...bueno, nacimiento: "2010-01-01" }, HOY).error, /18/);
});
await prueba("justo a los 18 años se acepta, un día antes no", () => {
  assert.ok(validarPerfil({ ...bueno, nacimiento: "2008-10-28" }, HOY).perfil);
  assert.ok(validarPerfil({ ...bueno, nacimiento: "2008-10-29" }, HOY).error);
});
await prueba("el país tiene que ser de la lista", () => {
  assert.ok(validarPerfil({ ...bueno, pais: "ZZ" }, HOY).error);
  assert.ok(PAISES.every((p) => /^[A-Z]{2}$/.test(p.codigo)));
});

// --- ruta ------------------------------------------------------------------

const escrituras = [];
const bd = () => ({
  collection: (c) => ({
    doc: (uid) => ({
      set: async (datos, opciones) => void escrituras.push({ c, uid, datos, opciones }),
    }),
  }),
});
const tokens = {
  tokenA: { uid: "A", email_verified: true },
  tokenSinVerificar: { uid: "A", email_verified: false },
  tokenInvitado: { uid: "G", email_verified: false, firebase: { sign_in_provider: "anonymous" } },
};
const verificar = async (t) => {
  if (!tokens[t]) throw new Error("token inválido");
  return tokens[t];
};
const llamar = (token, cuerpo) =>
  manejarPerfil(
    new Request("http://x/api/perfil", {
      method: "POST",
      headers: token ? { authorization: `Bearer ${token}` } : {},
      body: typeof cuerpo === "string" ? cuerpo : JSON.stringify(cuerpo),
    }),
    { verificar, bd }
  );

await prueba("sin sesión, sin correo verificado o como invitado: no escribe nada", async () => {
  escrituras.length = 0;
  assert.equal((await llamar(null, bueno)).status, 401);
  assert.equal((await llamar("tokenSinVerificar", bueno)).status, 403);
  const r = await llamar("tokenInvitado", bueno);
  assert.equal(r.status, 403);
  assert.equal((await r.json()).error, "cuenta_requerida");
  assert.equal(escrituras.length, 0);
});
await prueba("con sesión verificada guarda el perfil bajo el uid del token", async () => {
  escrituras.length = 0;
  const r = await llamar("tokenA", { ...bueno, uid: "OTRO" });
  assert.equal(r.status, 200);
  assert.equal(escrituras.length, 1);
  assert.equal(escrituras[0].uid, "A");
  assert.equal(escrituras[0].c, "usuarios");
  assert.deepEqual(escrituras[0].datos.perfil, { nombre: "Ana María Pérez", nacimiento: "1990-05-17", pais: "PE" });
  assert.ok(!("uid" in escrituras[0].datos.perfil));
  assert.deepEqual(escrituras[0].opciones, { merge: true });
});
await prueba("un perfil inválido o un cuerpo roto da 400 y no escribe", async () => {
  escrituras.length = 0;
  assert.equal((await llamar("tokenA", { ...bueno, pais: "ZZ" })).status, 400);
  assert.equal((await llamar("tokenA", "no es json")).status, 400);
  assert.equal(escrituras.length, 0);
});

await prueba("contacto de respaldo: ambos opcionales, se normalizan y se validan", async () => {
  const { validarContacto } = require(join(RAIZ, ".tmp-evals-perfil/perfil.js"));
  assert.deepEqual(validarContacto({}).contacto, { correo_respaldo: "", telefono: "" });
  assert.deepEqual(
    validarContacto({ correo_respaldo: "  Ana@Ejemplo.COM ", telefono: "+51 994-229 729" }).contacto,
    { correo_respaldo: "ana@ejemplo.com", telefono: "+51994229729" }
  );
  assert.ok(validarContacto({ correo_respaldo: "no-es-correo" }).error);
  assert.match(validarContacto({ telefono: "994229729" }).error, /código del país/);
});
await prueba("la ruta guarda solo el contacto cuando llega {contacto}, bajo el uid del token", async () => {
  escrituras.length = 0;
  const r = await llamar("tokenA", { contacto: { correo_respaldo: "b@x.com", telefono: "+51994229729" } });
  assert.equal(r.status, 200);
  assert.equal(escrituras[0].uid, "A");
  assert.deepEqual(escrituras[0].datos.contacto, { correo_respaldo: "b@x.com", telefono: "+51994229729" });
  assert.ok(!("perfil" in escrituras[0].datos));
  assert.equal((await llamar("tokenA", { contacto: { telefono: "123" } })).status, 400);
  assert.equal((await llamar("tokenInvitado", { contacto: {} })).status, 403);
});

console.log(`\n${n} pruebas pasadas\n`);
