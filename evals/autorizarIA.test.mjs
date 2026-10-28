/**
 * Pruebas de quién puede llamar a las rutas de IA (fase 13, etapa 7).
 * Sin Firebase ni red: la verificación del token y la base van simuladas.
 *
 * Ejecutar:  npm run test:ia
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
execFileSync(
  process.execPath,
  [
    join(RAIZ, "node_modules/typescript/bin/tsc"),
    "lib/servidor/autorizarIA.ts",
    "--outDir", ".tmp-evals-autorizacion",
    "--rootDir", "lib",
    "--module", "commonjs",
    "--moduleResolution", "node",
    "--target", "es2022",
    "--skipLibCheck",
  ],
  { cwd: RAIZ, stdio: "inherit" }
);
const require = createRequire(import.meta.url);
const A = require(join(RAIZ, ".tmp-evals-autorizacion/servidor/autorizarIA.js"));

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
const cod = async (p) => p.then(() => "ok", (e) => e.codigo ?? e.message);

const CASO = "caso-0001-abcdef";
const AJENO = "caso-0002-abcdef";
const ARCHIVADO = "caso-0003-abcdef";

// Ranuras por usuario: la base simulada solo responde por usuarios/{uid}/ranuras/{caso}.
const ranuras = {
  A: { [CASO]: "activo", [ARCHIVADO]: "archivado" },
  B: { [AJENO]: "activo" },
};
const consultas = [];
const bd = () => ({
  collection: () => ({
    doc: (uid) => ({
      collection: () => ({
        doc: (caso) => ({
          get: async () => {
            consultas.push(`${uid}/${caso}`);
            const estado = ranuras[uid]?.[caso];
            return { exists: estado !== undefined, data: () => ({ estado }) };
          },
        }),
      }),
    }),
  }),
});
const tokens = {
  tokenA: { uid: "A", email_verified: true },
  tokenSinVerificar: { uid: "A", email_verified: false },
};
const verificar = async (t) => {
  if (!tokens[t]) throw new Error("token inválido");
  return tokens[t];
};
const deps = { verificar, bd };
const peticion = (token) =>
  new Request("http://x/api/analizar", { method: "POST", headers: token ? { authorization: `Bearer ${token}` } : {} });

console.log("Sesión");
await prueba("sin token: 401", async () => {
  assert.equal(await cod(A.identificarLlamada(peticion(null), deps, true)), "sin_sesion");
});
await prueba("token inválido: 401", async () => {
  assert.equal(await cod(A.identificarLlamada(peticion("falso"), deps, true)), "sesion_invalida");
});
await prueba("correo sin verificar: 403", async () => {
  assert.equal(await cod(A.identificarLlamada(peticion("tokenSinVerificar"), deps, true)), "correo_sin_verificar");
});
await prueba("con sesión, el uid sale del token", async () => {
  const l = await A.identificarLlamada(peticion("tokenA"), deps, true);
  assert.equal(l.uid, "A");
});
await prueba("sin exigir sesión no se consulta el token", async () => {
  const l = await A.identificarLlamada(peticion(null), deps, false);
  assert.equal(l.uid, null);
});

console.log("Caso");
await prueba("caso propio y activo: pasa, y se busca bajo el uid del token", async () => {
  consultas.length = 0;
  const l = await A.identificarLlamada(peticion("tokenA"), deps, true);
  assert.equal(await l.comprobarCaso(CASO, true), CASO);
  assert.deepEqual(consultas, [`A/${CASO}`]);
});
await prueba("caso de otra cuenta: 403", async () => {
  const l = await A.identificarLlamada(peticion("tokenA"), deps, true);
  assert.equal(await cod(l.comprobarCaso(AJENO, true)), "caso_ajeno");
});
await prueba("caso archivado: 409", async () => {
  const l = await A.identificarLlamada(peticion("tokenA"), deps, true);
  assert.equal(await cod(l.comprobarCaso(ARCHIVADO, true)), "caso_archivado");
});
await prueba("caso_uid con forma inválida: 400", async () => {
  const l = await A.identificarLlamada(peticion("tokenA"), deps, true);
  assert.equal(await cod(l.comprobarCaso("../B/x", true)), "caso_invalido");
  assert.equal(await cod(l.comprobarCaso(42, true)), "caso_invalido");
});
await prueba("falta el caso: 400 si es obligatorio, null si no", async () => {
  const l = await A.identificarLlamada(peticion("tokenA"), deps, true);
  assert.equal(await cod(l.comprobarCaso(undefined, true)), "caso_requerido");
  assert.equal(await l.comprobarCaso(undefined, false), null);
});

console.log("Configuración");
await prueba("sesión exigida solo con cuentas configuradas", () => {
  assert.equal(A.sesionExigida({ NODE_ENV: "production" }), false);
  assert.equal(A.sesionExigida({ NODE_ENV: "production", NEXT_PUBLIC_FIREBASE_PROJECT_ID: "p" }), true);
});
await prueba("el atajo de evals funciona en desarrollo y se ignora en producción", () => {
  const base = { NEXT_PUBLIC_FIREBASE_PROJECT_ID: "p", ACIA_SIN_SESION_IA: "1" };
  assert.equal(A.sesionExigida({ ...base, NODE_ENV: "development" }), false);
  assert.equal(A.sesionExigida({ ...base, NODE_ENV: "production" }), true);
});
await prueba("operacion_id: opcional, pero con forma válida", () => {
  assert.equal(A.validarOperacionId(undefined), null);
  assert.equal(A.validarOperacionId("0f8fad5b-d9cb-469f-a165-70867728950e"), "0f8fad5b-d9cb-469f-a165-70867728950e");
  assert.throws(() => A.validarOperacionId("x"), (e) => e.codigo === "operacion_invalida");
  assert.throws(() => A.validarOperacionId({}), (e) => e.codigo === "operacion_invalida");
});

console.log("Código de las rutas");
const rutas = readdirSync(join(RAIZ, "app/api")).filter((r) => r !== "ranuras");
await prueba("las cinco rutas de IA piden identificar y comprobar", () => {
  assert.equal(rutas.length, 5, rutas.join(","));
  for (const r of rutas) {
    const src = readFileSync(join(RAIZ, `app/api/${r}/route.ts`), "utf8");
    assert.match(src, /await identificar\(request\)/, `${r}: sin identificar`);
    assert.match(src, /await comprobar\(llamada,/, `${r}: sin comprobar`);
  }
});
await prueba("ninguna ruta de IA escribe en Firestore", () => {
  for (const r of rutas) {
    const src = readFileSync(join(RAIZ, `app/api/${r}/route.ts`), "utf8");
    assert.doesNotMatch(src, /firestore|\.set\(|\.update\(/i, r);
  }
});
await prueba("la petición a OpenAI lleva store: false", () => {
  const src = readFileSync(join(RAIZ, "lib/clienteIA.ts"), "utf8");
  assert.match(src, /store:\s*false/);
});

console.log(`\n${n} pruebas pasadas`);
