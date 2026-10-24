/**
 * El espacio de trabajo (fase 5) no esconde nada al quitar las pestañas.
 *
 * Ejecutar:  node evals/espacio.test.mjs
 *
 * Dos garantías, sin gastar API, sobre el informe guardado del caso 01:
 *
 * 1. Cada aviso tiene un elemento visible donde se pinta su insignia: un nodo
 *    del Mapa, una hipótesis o una pregunta (Inspector), o una tarjeta
 *    de Blancos. Moverlos de pestaña no puede esconderlos (regla 4).
 * 2. La exportación no pierde secciones respecto a la de antes de la fase: se
 *    comparan las cabeceras del texto copiado, que es también lo que se
 *    imprime y lo que lleva el Word.
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
    "lib/destinoAlerta.ts",
    "lib/parseAnalisis.ts",
    "lib/validadores.ts",
    "lib/formatearInforme.ts",
    "lib/grafo.ts",
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
const { formatearInformeTexto } = require(join(RAIZ, ".tmp-evals/formatearInforme.js"));
const { construirNodosGrafo } = require(join(RAIZ, ".tmp-evals/grafo.js"));
const { destinoDeAlerta } = require(join(RAIZ, ".tmp-evals/destinoAlerta.js"));

const NOTA = readFileSync(join(RAIZ, "evals/casos/01-ansiedad-social.md"), "utf8")
  .split(/^##\s+NOTA\s*$/m)[1]
  .split(/^##\s+COMPROBACIONES\s*$/m)[0]
  .trim();
const { lineas } = numerarNota(NOTA);
const informe = () =>
  validarAnalisis(
    normalizarAnalisis(
      JSON.parse(readFileSync(join(RAIZ, "evals/fixtures/01-v0.1.2.json"), "utf8")).analisis,
      lineas
    ),
    NOTA
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

console.log("\nEspacio de trabajo\n");

prueba("cada aviso del caso 01 tiene un elemento visible donde pintar su insignia", () => {
  const a = informe();
  assert.ok(a.alertas.length > 0, "el fixture tiene avisos");
  const nodos = new Set(construirNodosGrafo(a).map((n) => n.id));
  const hipotesis = new Set(a.hipotesis_mantenimiento.map((h) => h.id));
  const preguntas = new Set(a.preguntas.map((p) => p.id));
  const conductas = new Set(a.conductas_problema.map((c) => c.id));
  const situaciones = new Set(a.situaciones.map((s) => s.id));
  const sinSitio = [];
  for (const alerta of a.alertas) {
    const destino = destinoDeAlerta(a, alerta);
    if (!destino) {
      sinSitio.push(`${alerta.codigo} · ${alerta.ruta}: sin destino`);
      continue;
    }
    const existe =
      destino.vista === "blancos"
        ? destino.id === null || conductas.has(destino.id)
        : destino.id === null || // franja «Avisos sin nodo» del Mapa
          nodos.has(destino.id) ||
          conductas.has(destino.id) || // Inspector, aunque no tenga nodo
          hipotesis.has(destino.id) ||
          preguntas.has(destino.id) ||
          situaciones.has(destino.id);
    if (!existe) sinSitio.push(`${alerta.codigo} · ${alerta.ruta}: destino ${destino.id} no existe`);
  }
  assert.deepEqual(sinSitio, []);
});

prueba("los componentes pintan la insignia donde lleva cada destino", () => {
  // El nodo (Mapa), la tarjeta de Blancos, y el
  // Inspector tienen que pintar el aviso; si alguno deja de hacerlo, el
  // destino existe pero el aviso no se ve.
  const leer = (r) => readFileSync(join(RAIZ, r), "utf8");
  assert.match(leer("components/grafo/GrafoAFC.tsx"), /<InsigniaAlerta\b/);
  assert.match(leer("components/informe/BloquePlan.tsx"), /<AvisoEnLinea\b/);
  assert.match(leer("components/espacio/Inspector.tsx"), /<AvisosDelNodo\b|<InsigniaAlerta\b/);
  assert.match(leer("components/espacio/Cabecera.tsx"), /destinoDeAlerta\(/);
  assert.match(leer("components/espacio/VistaMapa.tsx"), /<AvisosSinNodo\b/);
});

/**
 * Cabeceras del texto copiado del caso 01 antes de la fase 5 (16/10/2026, con
 * las preguntas de la fase 4). Si alguna desaparece, el Word, el texto copiado
 * y el impreso dejan de llevarla.
 */
const CABECERAS_ANTES = [
  "REPERTORIO CONDUCTUAL",
  "CONTEXTO Y VARIABLES MODULADORAS",
  "ANÁLISIS POR SITUACIONES",
  "ACOMODACIÓN DEL ENTORNO",
  "REGLAS VERBALES",
  "CAPA ACT — PROCESOS DE INFLEXIBILIDAD (anotaciones funcionales; hipótesis)",
  "CAPA DBT — ANÁLISIS EN CADENA",
  "CAPA DBT — ANÁLISIS DE SOLUCIONES",
  "CAPA DBT — PLAN DE PREVENCIÓN",
  "CAPA DBT — HABILIDADES SUGERIDAS",
  "RIESGO",
  "RESUMEN CLÍNICO",
  "FORMULACIÓN FUNCIONAL DESTACADA",
  "PREGUNTAS PARA LA PRÓXIMA SESIÓN",
  "HIPÓTESIS DE MANTENIMIENTO",
  "HIPÓTESIS DE ORIGEN (TENTATIVAS)",
  "FORMULACIÓN DEL CASO",
  "PLAN POR BLANCO",
  "INTERVENCIONES SIN BLANCO",
  "MONITORIZACIÓN SIN BLANCO",
  "HIPÓTESIS ALTERNATIVAS",
  "DATOS FALTANTES Y PUNTOS A VERIFICAR",
  "GRADO DE APOYO EN LA NOTA",
];

prueba("la exportación no pierde ninguna sección respecto a la de antes de la fase", () => {
  const texto = formatearInformeTexto(informe(), "CASO-1", "fecha").split("\n");
  const cabeceras = texto.filter((l, i) => /^-{3,}$/.test(texto[i + 1] ?? ""));
  assert.deepEqual(
    CABECERAS_ANTES.filter((c) => !cabeceras.includes(c)),
    [],
    "secciones que ya no salen en el texto exportado"
  );
});

console.log(`\n${pasadas} pruebas correctas\n`);
