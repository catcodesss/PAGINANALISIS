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
    "lib/ordenSecciones.ts",
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
const { SECCIONES_INFORME, GRUPOS_INFORME, posicionDeGrupo } = require(
  join(RAIZ, ".tmp-evals/secciones.js")
);
const { reconciliarOrden } = require(join(RAIZ, ".tmp-evals/ordenSecciones.js"));

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

/* ── Selector de lente ───────────────────────────────────────────────────── */

prueba("el selector de lente aparece una sola vez en el informe", () => {
  // Repetir el mando en cada sección no daba más control: daba ocasiones de
  // leer una situación en ACT y la de al lado en DBT sin darse cuenta. Si
  // alguien vuelve a colocar un <SelectorDeLente> dentro de una sección, esto
  // lo caza — no da error, solo devuelve el problema que se acaba de quitar.
  const usos = [...reportView.matchAll(/<SelectorDeLente\b/g)];
  assert.equal(
    usos.length,
    1,
    `el selector de lente se pinta ${usos.length} veces; tiene que ser una`
  );
});

prueba("la lente elegida no vive en el estado del componente", () => {
  // Es una preferencia del terapeuta, no del informe: se guarda como el orden
  // de los bloques (ver components/useLente.ts). Con useState volvería a ACT en
  // cada informe nuevo, que es justo lo que se quería dejar de pedirle.
  assert.ok(
    /useLente\(/.test(reportView),
    "ReportView ya no usa la preferencia persistida de lente"
  );
  assert.ok(
    !/useState<ModeloTerapeutico>/.test(reportView),
    "la lente volvió a un useState local"
  );
});

/* ── Grupos del índice ───────────────────────────────────────────────────── */

prueba("toda sección declara un grupo que existe", () => {
  const idsGrupo = GRUPOS_INFORME.map((g) => g.id);
  const invalidos = SECCIONES_INFORME.filter((s) => !idsGrupo.includes(s.grupo));
  assert.deepEqual(
    invalidos.map((s) => s.id),
    []
  );
});

prueba("el orden de fábrica no entremezcla grupos", () => {
  // Si un grupo aparece, se acaba y vuelve a aparecer más abajo, el informe se
  // lee como si dos tramos distintos fueran el mismo. Las posiciones de grupo
  // del orden de fábrica tienen que ser monótonas crecientes.
  const posiciones = SECCIONES_INFORME.map((s) => posicionDeGrupo(s.id));
  const ordenadas = [...posiciones].sort((a, b) => a - b);
  assert.deepEqual(
    posiciones,
    ordenadas,
    `un grupo se interrumpe y vuelve: ${SECCIONES_INFORME.map((s) => s.grupo).join(" ")}`
  );
});

prueba("ningún grupo se queda sin secciones", () => {
  // Un grupo vacío es un grupo que se declaró y nadie usa: o sobra, o alguien
  // olvidó mover ahí la sección que lo motivaba.
  const usados = new Set(SECCIONES_INFORME.map((s) => s.grupo));
  const vacios = GRUPOS_INFORME.filter((g) => !usados.has(g.id)).map((g) => g.id);
  assert.deepEqual(vacios, []);
});

/* ── Conciliación del orden guardado ─────────────────────────────────────── */

prueba("un orden guardado con ids que ya no existen se concilia sin romperse", () => {
  // Los ids viejos que queden en localStorage —una sección retirada, o dos que
  // se fusionaron en una— tienen que caerse solos, sin dejar el informe con
  // una sección de menos ni una entrada muerta en el índice.
  const conBasura = reconciliarOrden(
    ["seccion-que-ya-no-existe", "resumen", 42, null, "alertas", "datos-faltantes"],
    IDS
  );
  assert.deepEqual(
    conBasura.filter((id) => !IDS.includes(id)),
    [],
    "sobrevivió un id que no está en lib/secciones.ts"
  );
  assert.deepEqual(
    [...conBasura].sort(),
    [...IDS].sort(),
    "la conciliación perdió o duplicó alguna sección"
  );
});

prueba("el grupo manda sobre la posición guardada", () => {
  // Un orden guardado que sube la última sección hasta la primera posición: se
  // respeta que suba dentro de su grupo, pero no que se cuele delante de la
  // apertura del informe.
  const ultima = SECCIONES_INFORME[SECCIONES_INFORME.length - 1].id;
  const conciliado = reconciliarOrden(
    [ultima, ...IDS.filter((id) => id !== ultima)],
    IDS
  );
  const posiciones = conciliado.map(posicionDeGrupo);
  assert.deepEqual(posiciones, [...posiciones].sort((a, b) => a - b));
  assert.notEqual(conciliado[0], ultima, "un bloque saltó por encima de su grupo");
});

prueba("dentro de un grupo se respeta entero el orden elegido", () => {
  const delGrupo = SECCIONES_INFORME.filter((s) => s.grupo === "apertura").map(
    (s) => s.id
  );
  assert.ok(delGrupo.length >= 2, "el grupo de apertura debería tener varias secciones");
  const invertido = [...delGrupo].reverse();
  const conciliado = reconciliarOrden(
    [...invertido, ...IDS.filter((id) => !delGrupo.includes(id))],
    IDS
  );
  assert.deepEqual(conciliado.slice(0, delGrupo.length), invertido);
});

console.log(`\n${pasadas} pruebas correctas\n`);
