/**
 * Cobertura de la nota (lib/coberturaNota.ts) y segmentación sobre los nueve casos.
 *
 * Ejecutar:  node evals/cobertura.test.mjs
 *
 * No gasta API: usa el informe guardado del caso 01 y las notas de evals/casos/.
 */

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = join(AQUI, "..");

execFileSync(
  process.execPath,
  [
    join(RAIZ, "node_modules/typescript/bin/tsc"),
    "lib/citas.ts",
    "lib/coberturaNota.ts",
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
const { numerarNota, segmentarFrases } = require(join(RAIZ, ".tmp-evals/citas.js"));
const { calcularCoberturaNota, PALABRAS_MINIMAS_FRASE } = require(join(RAIZ, ".tmp-evals/coberturaNota.js"));
const { normalizarAnalisis } = require(join(RAIZ, ".tmp-evals/parseAnalisis.js"));

const notaDe = (archivo) =>
  readFileSync(join(RAIZ, "evals/casos", archivo), "utf8")
    .split(/^##\s+NOTA\s*$/m)[1]
    .split(/^##\s+COMPROBACIONES\s*$/m)[0]
    .trim();

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

console.log("\nCobertura de la nota\n");

const NOTA = notaDe("01-ansiedad-social.md");
const { lineas } = numerarNota(NOTA);
const analisis = normalizarAnalisis(
  JSON.parse(readFileSync(join(RAIZ, "evals/fixtures/01-v0.1.2.json"), "utf8")).analisis,
  lineas
);
const cobertura = calcularCoberturaNota(lineas, analisis);
const sinUsarTexto = cobertura.sinUsar.map((f) => f.texto).join(" | ");

prueba("las frases usadas y las que faltan suman el total", () => {
  assert.equal(cobertura.usadas + cobertura.sinUsar.length, cobertura.total);
  assert.ok(cobertura.total > 0 && cobertura.usadas > 0);
});

prueba("caso 01: las visitas a urgencias salen como sin usar", () => {
  assert.match(sinUsarTexto, /urgencias/i);
});

prueba("caso 01: ocultárselo a la supervisora sale como sin usar", () => {
  assert.match(sinUsarTexto, /supervisora/i);
});

prueba("caso 01: el ascenso sale como sin usar", () => {
  assert.match(sinUsarTexto, /ascenso/i);
});

prueba("una frase citada no aparece como sin usar", () => {
  const c = analisis.conductas_problema.find((x) => x.evidencia?.verificada)?.evidencia;
  assert.ok(c, "el fixture tiene al menos una conducta con cita verificada");
  assert.ok(
    !cobertura.sinUsar.some(
      (f) => f.linea >= c.linea_inicio && f.linea <= c.linea_fin && c.frase_inicio === undefined
    ),
    "una cita de línea entera cubre todas sus frases"
  );
});

prueba("las frases de pocas palabras no cuentan ni como usadas ni como sin usar", () => {
  const corta = "Sí. Ya. No. Ok. Una frase con suficientes palabras para contar.";
  const c = calcularCoberturaNota([corta], { evidencia: null });
  assert.equal(c.total, 1);
  assert.equal(c.sinUsar.length, 1);
  assert.ok(PALABRAS_MINIMAS_FRASE >= 3);
});

prueba("el análisis vacío deja toda la nota sin usar", () => {
  const c = calcularCoberturaNota(lineas, {});
  assert.equal(c.usadas, 0);
  assert.equal(c.sinUsar.length, c.total);
});

prueba("segmentar los nueve casos reconstruye cada línea sin perder texto", () => {
  // Solo los casos de sesión 1: los de varias sesiones (fase 8) no tienen «## NOTA».
  const archivos = readdirSync(join(RAIZ, "evals/casos")).filter(
    (f) => f.endsWith(".md") && /^##\s+NOTA\s*$/m.test(readFileSync(join(RAIZ, "evals/casos", f), "utf8"))
  );
  assert.equal(archivos.length, 9);
  for (const archivo of archivos) {
    for (const linea of notaDe(archivo).split("\n")) {
      const unida = segmentarFrases(linea).join(" ");
      assert.equal(unida, linea.replace(/\s+/g, " ").trim(), `${archivo}: «${linea.slice(0, 40)}…»`);
    }
  }
});

console.log(`\n${pasadas} pruebas correctas\n`);
