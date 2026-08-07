/**
 * Coherencia entre ficheros que ningún compilador vigila.
 *
 * Ejecutar:  node evals/coherencia.test.mjs
 *
 * Por qué existe: los fallos más caros de este proyecto no han sido errores de
 * lógica sino acuerdos tácitos entre dos ficheros que uno de los dos dejó de
 * cumplir — una escala de texto declarada en TypeScript y otra distinta en CSS,
 * una regla escrita a mano que Tailwind anula, un identificador de sección que
 * solo existe en una de las cuatro listas que lo usaban. Nada de eso da error:
 * da una preferencia que no hace nada, un enlace roto o un bloque que no se
 * imprime, y solo se ve mirándolo.
 *
 * Lo que se puede expresar en el sistema de tipos ya está allí (ver
 * `IdSeccion` en lib/secciones.ts). Aquí quedan los cruces que salen del
 * lenguaje: TypeScript contra CSS, y código contra la hoja de estilos.
 *
 * No gasta API.
 */

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = join(AQUI, "..");

// Mismo rodeo que evals/validadores.test.mjs: estos módulos se importan entre
// sí sin extensión, que Node no entiende en ESM.
execFileSync(
  process.execPath,
  [
    join(RAIZ, "node_modules/typescript/bin/tsc"),
    "lib/preferencias.ts",
    "lib/secciones.ts",
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
const { ESCALA_TEXTO } = require(join(RAIZ, ".tmp-evals/preferencias.js"));
const { SECCIONES_INFORME } = require(join(RAIZ, ".tmp-evals/secciones.js"));

const css = readFileSync(join(RAIZ, "app/globals.css"), "utf8");
const reportView = readFileSync(join(RAIZ, "components/ReportView.tsx"), "utf8");

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

console.log("\nCoherencia entre ficheros (TypeScript ↔ CSS ↔ componentes)\n");

/* ── Escala de texto ─────────────────────────────────────────────────────── */

prueba("cada tamaño de texto de TypeScript tiene su regla en CSS, con el mismo número", () => {
  for (const [nombre, escala] of Object.entries(ESCALA_TEXTO)) {
    if (escala === 1) continue; // "normal" es el valor base de html, sin regla propia
    const re = new RegExp(
      `html\\[data-texto="${nombre}"\\]\\s*\\{[^}]*--escala-texto:\\s*([\\d.]+)`
    );
    const m = css.match(re);
    assert.ok(m, `falta la regla CSS de "${nombre}" (lo declara ESCALA_TEXTO)`);
    assert.equal(
      Number(m[1]),
      escala,
      `"${nombre}": TypeScript dice ${escala} y el CSS dice ${m[1]}`
    );
  }
});

prueba("el CSS no define tamaños que TypeScript no ofrezca", () => {
  const enCss = [...css.matchAll(/html\[data-texto="([a-z]+)"\]/g)].map((m) => m[1]);
  const sobran = enCss.filter((n) => !(n in ESCALA_TEXTO));
  assert.deepEqual(sobran, [], "reglas CSS de tamaños que ya no existen");
});

/* ── Tamaños en píxeles literales ────────────────────────────────────────── */

prueba("todo text-[Npx] que se usa tiene su anulación escalada", () => {
  // Sin la anulación, esa clase se queda con el px fijo de Tailwind y deja de
  // obedecer a la preferencia de tamaño. No falla: simplemente no escala.
  const usados = new Set(
    [...reportView.matchAll(/\btext-\[(\d+)px\]/g)].map((m) => m[1])
  );
  const escalados = new Set(
    [...css.matchAll(/\.text-\\\[(\d+)px\\\]\s*\{[^}]*var\(--escala-texto\)/g)].map(
      (m) => m[1]
    )
  );
  const sinEscalar = [...usados].filter((px) => !escalados.has(px));
  assert.deepEqual(
    sinEscalar.sort(),
    [],
    `text-[Npx] sin regla en globals.css: ${sinEscalar.join(", ")}px`
  );
});

prueba("las anulaciones de tamaño están fuera de @layer, que es lo que las hace ganar", () => {
  // Tailwind emite su propia .text-[15px] dentro de @layer utilities. Lo no
  // encapsulado gana a lo encapsulado pase lo que pase con el orden; meter
  // estas reglas en una capa las volvería silenciosamente inertes.
  const dentroDeCapa = [];
  const re = /\.text-\\\[\d+px\\\]/g;
  let m;
  while ((m = re.exec(css)) !== null) {
    const antes = css.slice(0, m.index);
    const abiertas = (antes.match(/@layer[^;{]*\{/g) || []).length;
    // Cuenta llaves para saber si alguna capa sigue abierta en esa posición.
    if (abiertas > 0) {
      const cierres = (antes.match(/\}/g) || []).length;
      const aperturas = (antes.match(/\{/g) || []).length;
      if (aperturas > cierres) dentroDeCapa.push(m[0]);
    }
  }
  assert.deepEqual(dentroDeCapa, [], "hay anulaciones de tamaño dentro de @layer");
});

/* ── Secciones del informe ───────────────────────────────────────────────── */

const IDS = SECCIONES_INFORME.map((s) => s.id);

/**
 * Qué secciones pinta de verdad ReportView. Hay dos formas: `<Seccion>`, que
 * envuelve en `BloqueOrdenable` por dentro, y `<BloqueOrdenable>` suelto para
 * las cuatro que no siguen el molde (datos faltantes, riesgo, alertas y la
 * formulación destacada). Las dos cuentan.
 */
function seccionesDibujadas() {
  const ids = [
    ...reportView.matchAll(/<BloqueOrdenable\s+id="([^"]+)"/g),
    ...reportView.matchAll(/<Seccion\s+id="([^"]+)"/g),
    ...reportView.matchAll(/<Seccion\s*\n\s*id="([^"]+)"/g),
  ].map((m) => m[1]);
  return new Set(ids);
}

prueba("no hay identificadores de sección repetidos", () => {
  assert.equal(new Set(IDS).size, IDS.length);
});

prueba("cada bloque que se dibuja está en la lista de secciones", () => {
  // Un bloque fuera de la lista no aparecería en el índice ni podría
  // reordenarse, y el informe exportado lo emitiría al final por la red de
  // seguridad de leerOrdenGuardado en vez de en su sitio.
  const dibujados = seccionesDibujadas();
  const huerfanos = [...dibujados].filter((id) => !IDS.includes(id));
  assert.deepEqual(huerfanos, [], `bloques que no están en lib/secciones.ts`);
});

prueba("cada sección de la lista se dibuja de verdad", () => {
  const dibujados = seccionesDibujadas();
  const sinDibujar = IDS.filter((id) => !dibujados.has(id));
  assert.deepEqual(
    sinDibujar,
    [],
    "secciones listadas en el índice que ningún BloqueOrdenable pinta"
  );
});

prueba("toda sección tiene título y ninguno se repite", () => {
  const titulos = SECCIONES_INFORME.map((s) => s.titulo);
  assert.ok(titulos.every((t) => t && t.trim().length > 0));
  assert.equal(new Set(titulos).size, titulos.length, "hay títulos duplicados");
});

console.log(`\n${pasadas} pruebas correctas\n`);
