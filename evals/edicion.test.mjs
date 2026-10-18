/**
 * Edición del Mapa (fase 5C): convertir en pregunta, citas del clínico desde
 * la Fuente, frases sin usar convertidas en elementos y reclasificación por
 * carril. Lógica pura de lib/edicionMapa.ts, sobre el informe guardado del
 * caso 01.
 *
 * Ejecutar:  node evals/edicion.test.mjs
 *
 * No gasta API.
 */

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = join(AQUI, "..");

execFileSync(
  process.execPath,
  [
    join(RAIZ, "node_modules/typescript/bin/tsc"),
    "lib/edicionMapa.ts",
    "lib/parseAnalisis.ts",
    "lib/procedencia.ts",
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
const { numerarNota } = require(join(RAIZ, ".tmp-evals/citas.js"));
const { normalizarAnalisis } = require(join(RAIZ, ".tmp-evals/parseAnalisis.js"));
const { construirNodosGrafo } = require(join(RAIZ, ".tmp-evals/grafo.js"));
const { procedenciaDe } = require(join(RAIZ, ".tmp-evals/procedencia.js"));
const edicion = require(join(RAIZ, ".tmp-evals/edicionMapa.js"));

const NOTA = readFileSync(join(RAIZ, "evals/casos/01-ansiedad-social.md"), "utf8")
  .split(/^##\s+NOTA\s*$/m)[1]
  .split(/^##\s+COMPROBACIONES\s*$/m)[0]
  .trim();
const { lineas } = numerarNota(NOTA);
const informe = () =>
  normalizarAnalisis(
    JSON.parse(readFileSync(join(RAIZ, "evals/fixtures/01-v0.1.2.json"), "utf8")).analisis,
    lineas
  );

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

console.log("\nEdición del Mapa\n");

/* ── Convertir en pregunta ───────────────────────────────────────────────── */

prueba("convertir un nodo en pregunta crea una pregunta abierta tuya y lo quita", () => {
  const a = informe();
  const om = construirNodosGrafo(a).find((n) => n.tipo === "om");
  const antes = a.preguntas.length;
  const id = edicion.convertirEnPregunta(a, om.id);
  assert.ok(id);
  assert.equal(a.preguntas.length, antes + 1);
  const p = a.preguntas.find((x) => x.id === id);
  assert.equal(p.origen, "clinico");
  assert.equal(p.estado, "abierta");
  assert.equal(p.dato_faltante, om.etiqueta);
  assert.ok(!construirNodosGrafo(a).some((n) => n.id === om.id), "el nodo sigue en el Mapa");
});

prueba("la pregunta pone a prueba la hipótesis que pasaba por el nodo", () => {
  const a = informe();
  const h = a.hipotesis_mantenimiento.find((x) => x.origen_id);
  const id = edicion.convertirEnPregunta(a, h.origen_id);
  assert.equal(a.preguntas.find((x) => x.id === id).pone_a_prueba, h.id);
});

prueba("convertir algo que no es un nodo no hace nada", () => {
  const a = informe();
  const antes = JSON.stringify(a);
  assert.equal(edicion.convertirEnPregunta(a, "no_existe"), null);
  assert.equal(JSON.stringify(a), antes);
});

prueba("la procedencia de un nodo sin tocar es propuesta de la IA", () => {
  // Es lo que el Mapa pinta con borde discontinuo y «IA».
  const a = informe();
  const n = construirNodosGrafo(a)[0];
  assert.equal(procedenciaDe(a, n.id).estado, "propuesta");
});

console.log(`\n${pasadas} pruebas correctas\n`);
