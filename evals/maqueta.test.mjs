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
    "lib/matrixACT.ts",
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

prueba("el ejemplo enseña los antiguos procedimientos MC como intervenciones con su contingencia", () => {
  // La maqueta es lo único que se revisa desde el móvil: si la fusión de MC en
  // el Plan no se ve aquí, no se ve en ningún sitio.
  const conContingencia = ANALISIS_MINIMO.lineas_de_intervencion_tentativas.filter(
    (l) => l.contingencia_objetivo
  );
  assert.ok(conContingencia.length >= 2, "faltan las intervenciones con contingencia objetivo");
  const texto = formatearInformeTexto(ANALISIS_MINIMO, "", "fecha");
  for (const l of conContingencia) {
    assert.ok(texto.includes(`Contingencia objetivo: ${l.contingencia_objetivo}`));
  }
  assert.ok(!texto.includes("CAPA CONDUCTUAL"), "sigue la sección MC aparte");
});

/* ── Procesos ACT y vista Matrix ─────────────────────────────────────────── */

const { construirNodosGrafo } = require(join(RAIZ, ".tmp-evals/grafo.js"));
const { clasificarMatrix } = require(join(RAIZ, ".tmp-evals/matrixACT.js"));

prueba("ningún proceso ACT del ejemplo se pinta en un nodo que no le corresponde", () => {
  // Los dos procesos del ejemplo nombran una situación entera; en la v2 se
  // pintaban en todos sus nodos. Ahora quedan sin anclar, a la vista.
  const ids = new Set(construirNodosGrafo(ANALISIS_MINIMO).map((n) => n.id));
  const procesos = ANALISIS_MINIMO.capa_act.procesos_act;
  assert.ok(procesos.length > 0);
  for (const p of procesos) {
    assert.ok(p.nodo_id === null || ids.has(p.nodo_id), `ancla a un nodo inexistente: ${p.nodo_id}`);
  }
  assert.deepEqual(procesos.map((p) => p.nodo_id), [null, null]);
});

prueba("Matrix: el malestar interior solo tiene eventos privados", () => {
  const m = clasificarMatrix(ANALISIS_MINIMO, construirNodosGrafo(ANALISIS_MINIMO));
  assert.ok(m.interior.length > 0);
  assert.ok(m.interior.every((n) => n.tipo === "encubierta" || n.tipo === "ec"), "se coló una OM u otro nodo");
});

prueba("Matrix: alejamiento solo con base funcional; el resto, en su fila", () => {
  const a = structuredClone(ANALISIS_MINIMO);
  for (const s of a.situaciones) if (s.cadena_operante) s.cadena_operante.tipo_contingencia = "refuerzo positivo";
  a.capa_act.procesos_act = [];
  const nodos = () => construirNodosGrafo(a);
  let m = clasificarMatrix(a, nodos());
  assert.equal(m.alejamiento.length, 0, "una conducta cayó en alejamiento solo por ser conducta problema");
  assert.equal(m.sinFuncionEstablecida.length, a.conductas_problema.filter((c) =>
    a.situaciones.some((s) => s.conductas_ids.includes(c.id))).length);

  const objetivo = m.sinFuncionEstablecida[0];
  const proceso = {
    id: "pac_9", proceso: "evitacion_experiencial", elemento_objetivo: objetivo.etiqueta,
    nodo_id: objetivo.id, justificacion_funcional: "", evidencia: { texto: null, verificada: false, motivo: "sin_referencia" },
  };
  a.capa_act.procesos_act = [proceso];
  m = clasificarMatrix(a, nodos());
  assert.equal(m.alejamiento.length, 0, "una anotación sin justificación no establece la función");

  proceso.justificacion_funcional = "Reduce la activación y se mantiene pese al coste laboral.";
  m = clasificarMatrix(a, nodos());
  assert.deepEqual(m.alejamiento.map((n) => n.id), [objetivo.id]);

  // Y el refuerzo negativo de su situación también la establece.
  a.capa_act.procesos_act = [];
  const suya = a.situaciones.find((s) => s.conductas_ids.includes(objetivo.id));
  suya.cadena_operante.tipo_contingencia = "refuerzo negativo";
  m = clasificarMatrix(a, nodos());
  assert.ok(m.alejamiento.some((n) => n.id === objetivo.id));
});

prueba("Matrix: una conducta en dos situaciones sale una sola vez", () => {
  const m = clasificarMatrix(ANALISIS_MINIMO, construirNodosGrafo(ANALISIS_MINIMO));
  const ids = [...m.alejamiento, ...m.sinFuncionEstablecida].map((n) => n.id);
  assert.equal(new Set(ids).size, ids.length);
});

console.log(`\n${pasadas} pruebas correctas\n`);
