/**
 * El Mapa de la fase 5B: niveles, fusión del eslabón «acción», ruta de la
 * selección y recorrido con el teclado.
 *
 * Ejecutar:  node evals/mapa.test.mjs
 *
 * No gasta API: usa el informe guardado del caso 01.
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
    "lib/rutaMapa.ts",
    "lib/grafo.ts",
    "lib/preferencias.ts",
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
const { numerarNota } = require(join(RAIZ, ".tmp-evals/citas.js"));
const { normalizarAnalisis } = require(join(RAIZ, ".tmp-evals/parseAnalisis.js"));
const { construirNodosGrafo, eslabonRepiteConducta } = require(join(RAIZ, ".tmp-evals/grafo.js"));
const { nivelDeGuardado, NIVEL_MAPA_POR_DEFECTO } = require(join(RAIZ, ".tmp-evals/preferencias.js"));
const { rutaDeSeleccion, textoDeRuta, siguientePorTeclado } = require(join(RAIZ, ".tmp-evals/rutaMapa.js"));

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

console.log("\nMapa\n");

/* ── Fusión del eslabón «acción» ─────────────────────────────────────────── */

prueba("el eslabón «acción» que repite la conducta se funde con ella", () => {
  assert.equal(
    eslabonRepiteConducta(
      { tipo: "accion", descripcion: "Pide ir al baño y evita exponer." },
      { descripcion: "Evita exponer resultados en reuniones, pidiendo ir al baño." }
    ),
    true
  );
});

prueba("una acción distinta de la conducta no se funde", () => {
  assert.equal(
    eslabonRepiteConducta(
      { tipo: "accion", descripcion: "Sale de la sala sin avisar a nadie." },
      { descripcion: "Evita exponer resultados en reuniones, pidiendo ir al baño." }
    ),
    false
  );
});

prueba("solo se funde un eslabón de tipo acción, y con al menos dos raíces", () => {
  assert.equal(
    eslabonRepiteConducta(
      { tipo: "pensamiento", descripcion: "Evita exponer pidiendo ir al baño" },
      { descripcion: "Evita exponer resultados en reuniones, pidiendo ir al baño." }
    ),
    false,
    "un pensamiento no es la conducta aunque la nombre"
  );
  assert.equal(
    eslabonRepiteConducta({ tipo: "accion", descripcion: "Evita." }, { descripcion: "Evita exponer." }),
    false,
    "con una sola raíz no hay base para fundir"
  );
});

prueba("caso 01: el eslabón 4 se funde y el dato no se borra", () => {
  const a = informe();
  const situacion = a.situaciones.find((s) => s.cadena_dbt?.eslabones.length);
  const conducta = a.conductas_problema.find((c) => situacion.conductas_ids.includes(c.id));
  const fundidos = situacion.cadena_dbt.eslabones.filter((e) => eslabonRepiteConducta(e, conducta));
  assert.equal(fundidos.length, 1);
  assert.equal(fundidos[0].tipo, "accion");
  // Fundir es de presentación: el eslabón sigue en los datos.
  assert.ok(construirNodosGrafo(a).some((n) => n.id === fundidos[0].id));
});

prueba("lo que cuelga del eslabón fundido se pinta junto a la conducta", () => {
  // Regla 4 de la fase 5: fundir no puede esconder un aviso ni una
  // intervención DBT. El tablero los recoge de los eslabones fundidos.
  const tablero = readFileSync(join(RAIZ, "components/grafo/TableroSituacion.tsx"), "utf8");
  assert.match(tablero, /avisosFundidos\s*=\s*\[\.\.\.fundidos\]\.flatMap\(\(id\) => avisos\(id\)\)/);
  assert.match(tablero, /<InsigniaAlerta alertas=\{avisosFundidos\}/);
  assert.match(tablero, /solucionesFundidas\.map/);
  assert.match(tablero, /habilidadesFundidas\.map/);
  // Y la cadena se pinta aunque todos sus eslabones se fundan.
  assert.match(tablero, /nivel !== "situacion" && eslabones\.length > 0/);
});

prueba("elegir la conducta resalta también el antecedente que le llega por la cadena", () => {
  const a = informe();
  const nodos = construirNodosGrafo(a);
  const situacion = a.situaciones.find((s) => s.cadena_dbt?.eslabones.length);
  const conducta = situacion.conductas_ids[0];
  const ed = nodos.find((n) => n.tipo === "ed" && n.situacion_id === situacion.id);
  const ruta = rutaDeSeleccion(a, nodos, conducta);
  assert.ok(ruta.ids.has(ed.id), "el Ed de la situación quedó atenuado");
  // Y se lee en orden: la relación que sale del antecedente va antes que la
  // que entra en la conducta desde la cadena.
  const desdeEd = ruta.aristas.findIndex((x) => x.desde === ed.id);
  const aConducta = ruta.aristas.findIndex(
    (x) => x.hasta === conducta && nodos.find((n) => n.id === x.desde)?.tipo === "encubierta"
  );
  assert.ok(desdeEd >= 0 && aConducta > desdeEd, `orden: Ed en ${desdeEd}, cadena→conducta en ${aConducta}`);
});

/* ── Nivel guardado ──────────────────────────────────────────────────────── */

prueba("un estilo guardado por una versión anterior cae en su nivel", () => {
  assert.equal(nivelDeGuardado("afc"), "situacion");
  assert.equal(nivelDeGuardado("dbt"), "clinico");
  assert.equal(nivelDeGuardado("act"), "clinico");
  assert.equal(nivelDeGuardado("evidencia"), "situacion");
  assert.equal(nivelDeGuardado("caso"), "caso");
});

prueba("un valor que no existe cae al nivel por defecto", () => {
  assert.equal(nivelDeGuardado("matrix"), NIVEL_MAPA_POR_DEFECTO);
  assert.equal(nivelDeGuardado(""), NIVEL_MAPA_POR_DEFECTO);
  assert.equal(nivelDeGuardado(null), NIVEL_MAPA_POR_DEFECTO);
  assert.equal(NIVEL_MAPA_POR_DEFECTO, "situacion");
});

/* ── Ruta y teclado ──────────────────────────────────────────────────────── */

prueba("seleccionar una conducta resalta sus relaciones y lo que hay al otro lado", () => {
  const a = informe();
  const nodos = construirNodosGrafo(a);
  const conducta = a.conductas_problema[0].id;
  const ruta = rutaDeSeleccion(a, nodos, conducta);
  assert.ok(ruta.ids.has(conducta));
  const suyas = a.aristas.filter((x) => x.desde === conducta || x.hasta === conducta);
  assert.ok(suyas.length > 0, "la conducta tiene relaciones en el fixture");
  for (const x of suyas) {
    assert.ok(ruta.ids.has(x.id) && ruta.ids.has(x.desde) && ruta.ids.has(x.hasta));
  }
});

prueba("seleccionar una relación resalta solo ella y sus extremos", () => {
  const a = informe();
  const nodos = construirNodosGrafo(a);
  const arista = a.aristas[0];
  const ruta = rutaDeSeleccion(a, nodos, arista.id);
  assert.deepEqual([...ruta.ids].sort(), [arista.id, arista.desde, arista.hasta].sort());
});

prueba("sin selección no se atenúa nada", () => {
  const a = informe();
  assert.equal(rutaDeSeleccion(a, construirNodosGrafo(a), null).ids.size, 0);
  assert.equal(rutaDeSeleccion(a, construirNodosGrafo(a), "id_que_no_existe").ids.size, 0);
});

prueba("leer como texto: una frase por relación de la ruta, o la cadena de cada situación", () => {
  const a = informe();
  const nodos = construirNodosGrafo(a);
  const rotular = (n) => `${n.tipo}: ${n.etiqueta}`;
  const apoyo = (x) => x.apoyo;
  const general = textoDeRuta(a, nodos, null, rotular, apoyo);
  assert.equal(general.length, a.situaciones.length);
  assert.ok(general.every((l) => l.includes("→") || l.includes("sin cadena")));
  const arista = a.aristas[0];
  const deArista = textoDeRuta(a, nodos, arista.id, rotular, apoyo);
  assert.equal(deArista.length, 1);
  assert.match(deArista[0], /→/);
});

prueba("las flechas recorren las relaciones: nodo → relación → nodo", () => {
  const a = informe();
  const conducta = a.conductas_problema[0].id;
  const saliente = siguientePorTeclado(a, conducta, "ArrowRight");
  const arista = a.aristas.find((x) => x.id === saliente);
  assert.ok(arista, "→ sobre un nodo lleva a una relación que sale de él");
  assert.equal(arista.desde, conducta);
  assert.equal(siguientePorTeclado(a, saliente, "ArrowRight"), arista.hasta);
  assert.equal(siguientePorTeclado(a, saliente, "ArrowLeft"), conducta);
  assert.equal(siguientePorTeclado(a, null, "ArrowRight"), null);
});

console.log(`\n${pasadas} pruebas correctas\n`);
