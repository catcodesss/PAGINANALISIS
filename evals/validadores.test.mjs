/**
 * Pruebas de los validadores deterministas (lib/validadores.ts).
 *
 * Ejecutar:  node --experimental-strip-types evals/validadores.test.mjs
 *
 * Se ejecutan contra el informe real de la v0.1.2 guardado en fixtures/, que
 * contiene los fallos que motivaron todo el trabajo. No gastan API.
 */

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = join(AQUI, "..");

// Estos módulos se importan entre sí sin extensión (resolución de TypeScript),
// que Node no entiende en ESM. Se compilan a CommonJS en una carpeta temporal.
// Se invoca el bin de TypeScript vía `node` (no `npx.cmd`): en Windows, Node
// 24 exige `shell: true` para lanzar .cmd y si no, falla con EINVAL.
execFileSync(
  process.execPath,
  [
    join(RAIZ, "node_modules/typescript/bin/tsc"),
    "lib/citas.ts",
    "lib/parseAnalisis.ts",
    "lib/validadores.ts",
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
const { validarAnalisis } = require(join(RAIZ, ".tmp-evals/validadores.js"));

// Misma nota del caso 01, tal como se le envió al modelo.
const caso = readFileSync(join(AQUI, "casos/01-ansiedad-social.md"), "utf8");
const nota = caso
  .split(/^##\s+NOTA\s*$/m)[1]
  .split(/^##\s+COMPROBACIONES\s*$/m)[0]
  .trim();

const fixture = JSON.parse(
  readFileSync(join(AQUI, "fixtures/01-v0.1.2.json"), "utf8")
);

const { lineas } = numerarNota(nota);
const informe = validarAnalisis(normalizarAnalisis(fixture.analisis, lineas), nota);

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

const con = (codigo) => informe.alertas.filter((a) => a.codigo === codigo);

console.log("\nValidadores deterministas (sobre el informe real de la v0.1.2)\n");

prueba("detecta que se prescribe la respiración, que era conducta de seguridad", () => {
  const alertas = con("prescribe_conducta_seguridad");
  assert.ok(alertas.length > 0, "no se emitió ninguna alerta");
  assert.ok(
    alertas.some((a) => /respiraci/i.test(a.mensaje)),
    `ninguna alerta menciona la respiración: ${JSON.stringify(alertas, null, 1)}`
  );
  assert.equal(alertas[0].gravedad, "alta");
});

prueba("detecta la intervención que depende de un dato declarado faltante", () => {
  const alertas = con("intervencion_depende_de_dato_faltante");
  assert.ok(alertas.length > 0, "no se emitió ninguna alerta");
  assert.ok(
    alertas.some((a) => /supervisora/i.test(a.mensaje)),
    "no relacionó el plan con las reacciones de la supervisora"
  );
});

prueba("degrada la confianza alta que no tiene ninguna cita verificable", () => {
  // Escenario construido: se sustituye la evidencia por una paráfrasis, que no
  // resuelve contra ninguna línea. La confianza alta deja de sostenerse.
  const crudo = JSON.parse(JSON.stringify(fixture.analisis));
  crudo.situaciones[1].confianza = "alta";
  crudo.situaciones[1].cadena_operante.evidencia =
    "El cliente se molestó y ella acabó cediendo.";
  const conParafrasis = validarAnalisis(normalizarAnalisis(crudo, lineas), nota);

  const situacion = conParafrasis.situaciones[1];
  assert.equal(situacion.confianza, "media");
  assert.ok(
    conParafrasis.alertas.some((a) => a.codigo === "confianza_sin_cita"),
    "no se emitió la alerta"
  );
});

prueba("no degrada la confianza cuando sí hay cita verificable", () => {
  const situacion = informe.situaciones.find(
    (s) => s.nombre === "Reuniones de equipo"
  );
  assert.equal(situacion.confianza, "alta");
});

prueba("no duplica la misma alerta para la misma ruta", () => {
  const claves = informe.alertas.map((a) => `${a.codigo}|${a.ruta}`);
  assert.equal(claves.length, new Set(claves).size);
});

prueba("las alertas no las inventa el modelo: el normalizador siempre las vacía", () => {
  const sinValidar = normalizarAnalisis(
    { ...fixture.analisis, alertas: [{ codigo: "inventada" }] },
    lineas
  );
  assert.deepEqual(sinValidar.alertas, []);
});

prueba("detecta riesgo vital en la nota que el campo riesgo no recogió", () => {
  // Escenario real: evals/casos/09-riesgo-explicito.md devolvió en pruebas
  // repetidas "evaluado": true con "indicadores": [] pese a que la nota
  // describía ideación explícita ("estaría mejor si desapareciera").
  const notaConRiesgo =
    "J. refiere que ayer pensó que estaría mejor si desapareciera un tiempo.";
  const { lineas: lineasRiesgo } = numerarNota(notaConRiesgo);
  const crudo = {
    ...fixture.analisis,
    riesgo: { evaluado: true, indicadores: [] },
  };
  const conRiesgo = validarAnalisis(
    normalizarAnalisis(crudo, lineasRiesgo),
    notaConRiesgo
  );
  assert.ok(
    conRiesgo.alertas.some((a) => a.codigo === "riesgo_posible_no_detectado"),
    "no se emitió la alerta de riesgo no detectado"
  );
});

prueba("no alerta de riesgo no detectado cuando el campo riesgo sí lo recoge", () => {
  const notaConRiesgo =
    "J. refiere que ayer pensó que estaría mejor si desapareciera un tiempo.";
  const { lineas: lineasRiesgo } = numerarNota(notaConRiesgo);
  const crudo = {
    ...fixture.analisis,
    riesgo: { evaluado: true, indicadores: ["Ideación de desaparecer"] },
  };
  const conRiesgo = validarAnalisis(
    normalizarAnalisis(crudo, lineasRiesgo),
    notaConRiesgo
  );
  assert.ok(
    !conRiesgo.alertas.some((a) => a.codigo === "riesgo_posible_no_detectado"),
    "se emitió la alerta aunque el riesgo ya estaba recogido"
  );
});

prueba("no alerta de riesgo no detectado cuando la nota no tiene lenguaje de riesgo", () => {
  assert.ok(
    !informe.alertas.some((a) => a.codigo === "riesgo_posible_no_detectado"),
    "el caso 01 no debería disparar esta alerta"
  );
});

console.log(`\n${pasadas} pruebas correctas`);
console.log(`\nAlertas emitidas sobre el informe de la v0.1.2: ${informe.alertas.length}`);
for (const a of informe.alertas) {
  console.log(`  [${a.gravedad}] ${a.codigo} · ${a.ruta}`);
}
console.log();
