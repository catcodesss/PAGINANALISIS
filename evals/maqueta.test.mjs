/**
 * El informe de maqueta no puede llegar nunca a un usuario real.
 *
 * Ejecutar:  node evals/maqueta.test.mjs
 *
 * Sirve para revisar la interfaz sin gastar llamadas a OpenAI (ver
 * lib/maqueta.ts y `npm run dev:maqueta`). Justo por eso es peligroso: un
 * informe inventado presentado como análisis de la nota del clínico sería el
 * peor fallo posible de esta herramienta. De ahí el doble candado, y de ahí
 * esta prueba, que es lo único que impide que alguien lo afloje sin darse
 * cuenta.
 *
 * No gasta API.
 */

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = join(AQUI, "..");

// Mismo rodeo que las demás suites: estos módulos se importan entre sí sin
// extensión (resolución de TypeScript), que Node no entiende en ESM.
execFileSync(
  process.execPath,
  [
    join(RAIZ, "node_modules/typescript/bin/tsc"),
    "lib/maqueta.ts",
    "lib/formatearInforme.ts",
    "lib/parseAnalisis.ts",
    "--outDir", ".tmp-evals",
    "--rootDir", "lib",
    "--module", "commonjs",
    "--moduleResolution", "node",
    "--target", "es2022",
    "--skipLibCheck",
  ],
  { cwd: RAIZ, stdio: "inherit" }
);

const require = createRequire(import.meta.url);
const { CLAVE_MAQUETA, AVISO_EJEMPLO, maquetaActivada } = require(
  join(RAIZ, ".tmp-evals/maqueta.js")
);
const { formatearInformeTexto } = require(
  join(RAIZ, ".tmp-evals/formatearInforme.js")
);
const { readFileSync } = await import("node:fs");

let pasadas = 0;
function prueba(nombre, fn) {
  try {
    fn();
    pasadas += 1;
    console.log(`  ok   ${nombre}`);
  } catch (e) {
    console.error(`  FALLA ${nombre}\n        ${e.message}`);
    process.exitCode = 1;
  }
}

/** Ejecuta fn con NODE_ENV y la variable puestas, y luego lo deja como estaba. */
function con(entorno, valor, fn) {
  const antesEntorno = process.env.NODE_ENV;
  const antesValor = process.env[CLAVE_MAQUETA];
  try {
    process.env.NODE_ENV = entorno;
    if (valor === undefined) delete process.env[CLAVE_MAQUETA];
    else process.env[CLAVE_MAQUETA] = valor;
    return fn();
  } finally {
    process.env.NODE_ENV = antesEntorno;
    if (antesValor === undefined) delete process.env[CLAVE_MAQUETA];
    else process.env[CLAVE_MAQUETA] = antesValor;
  }
}

console.log("\nCandado del informe de maqueta\n");

prueba("en producción no se activa, ni con la variable puesta", () => {
  assert.equal(con("production", "true", maquetaActivada), false);
});

prueba("en desarrollo no se activa sola: hace falta pedirla", () => {
  assert.equal(con("development", undefined, maquetaActivada), false);
});

prueba("cualquier valor que no sea exactamente \"true\" la deja apagada", () => {
  for (const valor of ["1", "TRUE", "si", "yes", "", "false"]) {
    assert.equal(
      con("development", valor, maquetaActivada),
      false,
      `se activó con ${JSON.stringify(valor)}`
    );
  }
});

prueba("en desarrollo y pedida explícitamente, se activa", () => {
  assert.equal(con("development", "true", maquetaActivada), true);
});

prueba("en la fase de pruebas también, que es donde se revisa la interfaz", () => {
  assert.equal(con("test", "true", maquetaActivada), true);
});

/* ── El aviso viaja dentro del documento ─────────────────────────────────── */

const { normalizarAnalisis } = require(join(RAIZ, ".tmp-evals/parseAnalisis.js"));

// Normalizado, como cualquier informe que llega a la interfaz: el JSON crudo
// del fixture no trae `meta` ni los campos que el normalizador rellena.
const ANALISIS_MINIMO = normalizarAnalisis(
  JSON.parse(readFileSync(join(AQUI, "fixtures/01-v0.1.2.json"), "utf8")).analisis,
  []
);

prueba("el informe de ejemplo se marca en la primera línea del texto", () => {
  // Un Word descargado desde la página de ejemplo se lee fuera de contexto: si
  // no lo dice él mismo, pasa por un informe real.
  const texto = formatearInformeTexto(
    ANALISIS_MINIMO,
    "",
    "fecha de ejemplo",
    undefined,
    true
  );
  assert.ok(
    texto.startsWith(AVISO_EJEMPLO),
    `el texto no empieza con el aviso: ${texto.slice(0, 80)}`
  );
});

prueba("un informe normal no lleva el aviso por ninguna parte", () => {
  // El fallo simétrico y peor: marcar como ejemplo el análisis de un paciente.
  const texto = formatearInformeTexto(ANALISIS_MINIMO, "", "fecha");
  assert.ok(!texto.includes("INFORME DE EJEMPLO"), "se coló el aviso");
  assert.ok(!texto.includes(AVISO_EJEMPLO));
});

console.log(`\n${pasadas} pruebas correctas\n`);
