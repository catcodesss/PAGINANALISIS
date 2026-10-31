/**
 * Pruebas de casos y sesiones (lib/casos.ts, lib/respaldo.ts), fase 7.
 *
 * Ejecutar:  node evals/casos.test.mjs
 *
 * IndexedDB no existe en Node y probarlo pediría una dependencia
 * (fake-indexeddb). Se prueba la lógica pura que el repositorio llama antes de
 * escribir: si `comprobarCambioExpediente` rechaza algo, el repositorio no lo
 * guarda.
 *
 * Usa el informe REAL del caso 01 (fixtures/01-v0.1.2.json). No gasta API.
 */

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = join(AQUI, "..");

execFileSync(
  process.execPath,
  [
    join(RAIZ, "node_modules/typescript/bin/tsc"),
    "lib/citas.ts",
    "lib/identidad.ts",
    "lib/parseAnalisis.ts",
    "lib/casos.ts",
    "lib/respaldo.ts",
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
const { migrarAV9 } = require(join(RAIZ, ".tmp-evals/identidad.js"));
const C = require(join(RAIZ, ".tmp-evals/casos.js"));
const { leerRespaldo } = require(join(RAIZ, ".tmp-evals/respaldo.js"));

const NOTA = readFileSync(join(RAIZ, "evals/casos/01-ansiedad-social.md"), "utf8")
  .split(/^##\s+NOTA\s*$/m)[1]
  .split(/^##\s+COMPROBACIONES\s*$/m)[0]
  .trim();
const { lineas } = numerarNota(NOTA);
const analisis01 = () =>
  migrarAV9(
    normalizarAnalisis(
      JSON.parse(readFileSync(join(RAIZ, "evals/fixtures/01-v0.1.2.json"), "utf8")).analisis,
      lineas
    )
  );

let n = 0;
const id = () => `id_${++n}`;
const T0 = "2026-10-01T10:00:00.000Z";

let fallos = 0;
let pasadas = 0;
function prueba(nombre, fn) {
  try {
    fn();
    pasadas += 1;
    console.log(`  ok   ${nombre}`);
  } catch (error) {
    fallos += 1;
    console.log(`  FALLA ${nombre}`);
    console.log(`        ${error.message.split("\n").slice(0, 8).join("\n        ")}`);
  }
}

/** Un caso del historial anterior, ya migrado: caso + sesión 1 + versión. */
const casoMigrado = () =>
  C.expedienteDesdeAnalisis({ referencia: "M.34", nota: NOTA, analisis: analisis01(), fecha: T0 }, id);

console.log("\nCasos y sesiones\n");

prueba("un análisis del historial anterior pasa a caso con una sesión, su nota y su formulación", () => {
  const exp = casoMigrado();
  assert.equal(exp.caso.alias, "M.34");
  assert.equal(exp.sesiones.length, 1);
  assert.equal(exp.sesiones[0].n, 1);
  assert.equal(C.textoDeSesion(exp, exp.sesiones[0].id), NOTA);
  assert.deepEqual(C.obtenerVersion(exp, exp.sesiones[0].id), analisis01());
  assert.equal(C.resumirExpediente(exp).ultima_sesion, 1);
});

prueba("la versión de la sesión 1 se reabre idéntica tras editar en la sesión 2", () => {
  let exp = casoMigrado();
  const s1 = exp.sesiones[0].id;
  const original = C.obtenerVersion(exp, s1);
  const { expediente, sesion } = C.anadirSesion(exp, { nota: "Sesión 2." }, T0, id);
  const editado = structuredClone(original);
  editado.conductas_problema[0].descripcion = "Editada por el clínico";
  exp = C.guardarVersion(expediente, sesion.id, editado, id);
  assert.deepEqual(C.obtenerVersion(exp, s1), original);
  assert.equal(C.formulacionVigente(exp).analisis.conductas_problema[0].descripcion, "Editada por el clínico");
});

prueba("una versión cerrada no se puede guardar de nuevo ni modificar", () => {
  const exp = casoMigrado();
  const s1 = exp.sesiones[0].id;
  const { expediente } = C.anadirSesion(exp, { nota: "S2" }, T0, id);
  assert.throws(() => C.guardarVersion(expediente, s1, analisis01(), id));
  const manipulado = structuredClone(expediente);
  manipulado.versiones[0].analisis.conductas_problema[0].descripcion = "otra";
  assert.match(C.comprobarCambioExpediente(expediente, manipulado), /sesión cerrada/);
});

prueba("una nota analizada no se puede editar; sí anotar", () => {
  const exp = casoMigrado();
  const editada = structuredClone(exp);
  editada.notas[0].texto += " (cambiado)";
  assert.match(C.comprobarCambioExpediente(exp, editada), /no se puede editar/);
  const anotada = C.anotarNota(exp, exp.notas[0].id, "Corrijo: era el martes.", T0);
  assert.equal(C.comprobarCambioExpediente(exp, anotada), null);
  assert.equal(anotada.notas[0].texto, exp.notas[0].texto);
  assert.equal(anotada.notas[0].anotaciones.length, 1);
});

prueba("las revisiones solo se añaden", () => {
  const exp = casoMigrado();
  const s1 = exp.sesiones[0].id;
  const antes = C.obtenerVersion(exp, s1);
  const despues = structuredClone(antes);
  despues.conductas_problema[0].descripcion = "Nueva";
  const revs = C.revisionesEntre(antes, despues, { caso_id: exp.caso.id, sesion_id: s1, autor: "clinico" }, T0, id);
  const con = C.registrarRevisiones(exp, revs);
  assert.equal(C.comprobarCambioExpediente(exp, con), null);
  const sinUna = { ...con, revisiones: [] };
  assert.match(C.comprobarCambioExpediente(con, sinUna), /solo se añaden/);
  const alterada = structuredClone(con);
  alterada.revisiones[0].autor = "ia";
  assert.match(C.comprobarCambioExpediente(con, alterada), /solo se añaden/);
});

prueba("una edición deja una revisión por elemento con su autor; sin cambios, ninguna", () => {
  const a = analisis01();
  const datos = { caso_id: "c", sesion_id: "s", autor: "clinico" };
  assert.equal(C.revisionesEntre(a, structuredClone(a), datos, T0, id).length, 0);
  const b = structuredClone(a);
  const objetivo = b.conductas_problema[0].id;
  b.conductas_problema[0].descripcion = "Otra";
  b.conductas_problema.pop();
  const revs = C.revisionesEntre(a, b, datos, T0, id);
  const editada = revs.find((r) => r.objeto_id === objetivo);
  assert.ok(editada && editada.antes && editada.despues);
  assert.equal(editada.autor, "clinico");
  assert.ok(revs.some((r) => r.despues === null), "la conducta borrada deja revisión");
  const exp = C.registrarRevisiones(casoMigrado(), revs);
  assert.ok(C.listarRevisiones(exp, objetivo).length >= 1);
});

prueba("un respaldo v1 se sigue importando; uno ajeno se rechaza", () => {
  const v1 = leerRespaldo(JSON.stringify({ formato: "acia-respaldo-v1", sal: [1], testigo: { iv: [], datos: [] }, registros: [{ id: "r", fecha: T0, sobre: { iv: [], datos: [] } }] }));
  assert.equal(v1.registros.length, 1);
  assert.deepEqual(v1.casos, []);
  const v2 = leerRespaldo(JSON.stringify({ formato: "acia-respaldo-v2", sal: [1], testigo: {}, registros: [], casos: [{ id: "c" }] }));
  assert.equal(v2.casos.length, 1);
  assert.throws(() => leerRespaldo('{"formato":"otro"}'));
  assert.throws(() => leerRespaldo("no es json"));
});

prueba("el alias avisa si parece un nombre o trae datos de contacto", () => {
  assert.equal(C.avisoAlias("M.34"), null);
  assert.equal(C.avisoAlias("M. R."), null);
  assert.ok(C.avisoAlias("Marta Ríos"));
  assert.ok(C.avisoAlias("M 987654321"));
});

prueba("una sesión añadida no lanza análisis: la formulación vigente sigue igual", () => {
  const exp = casoMigrado();
  const antes = C.formulacionVigente(exp).analisis;
  const { expediente } = C.anadirSesion(exp, { nota: "S2", registro: "Revisó registros" }, T0, id);
  assert.equal(expediente.sesiones[1].n, 2);
  assert.equal(expediente.sesiones[1].version_id, null);
  assert.deepEqual(C.formulacionVigente(expediente).analisis, antes);
});

prueba("una sesión vacía se crea sin nota ni formulación y no cambia la vigente", () => {
  const exp = casoMigrado();
  const antes = C.formulacionVigente(exp).analisis;
  const { expediente, sesion } = C.anadirSesion(exp, { nota: "" }, T0, id);
  assert.equal(sesion.n, 2);
  assert.equal(C.esSesionVacia(expediente, sesion), true);
  assert.equal(C.esSesionVacia(expediente, expediente.sesiones[0]), false);
  assert.deepEqual(C.formulacionVigente(expediente).analisis, antes);
  assert.equal(C.comprobarCambioExpediente(exp, expediente), null);
});

prueba("completar la sesión vacía le pone la nota sin crear otra sesión", () => {
  const exp = casoMigrado();
  const { expediente: conVacia, sesion } = C.anadirSesion(exp, { nota: "" }, T0, id);
  const { expediente, sesion: completa } = C.completarSesion(conVacia, sesion.id, { nota: "S2", registro: "Tareas" }, T0, id);
  assert.equal(expediente.sesiones.length, 2);
  assert.equal(completa.id, sesion.id);
  assert.equal(completa.registro, "Tareas");
  assert.equal(C.textoDeSesion(expediente, sesion.id), "S2");
  assert.equal(C.esSesionVacia(expediente, completa), false);
  assert.equal(C.comprobarCambioExpediente(conVacia, expediente), null);
  const guardado = C.guardarVersion(expediente, sesion.id, C.formulacionVigente(exp).analisis, id);
  assert.equal(C.formulacionVigente(guardado).sesion.id, sesion.id);
  assert.throws(() => C.completarSesion(expediente, sesion.id, { nota: "otra" }, T0, id));
});

prueba("solo se borra una sesión vacía", () => {
  const exp = casoMigrado();
  const { expediente: conVacia, sesion } = C.anadirSesion(exp, { nota: "" }, T0, id);
  const sin = C.quitarSesionVacia(conVacia, sesion.id, T0);
  assert.equal(sin.sesiones.length, 1);
  assert.equal(C.comprobarCambioExpediente(conVacia, sin), null);
  assert.throws(() => C.quitarSesionVacia(exp, exp.sesiones[0].id, T0));
});

// Tamaño de guardar una instantánea completa por sesión (decisión de lib/casos.ts).
{
  let exp = casoMigrado();
  for (let i = 2; i <= 7; i++) {
    const { expediente, sesion } = C.anadirSesion(exp, { nota: NOTA }, T0, id);
    exp = C.guardarVersion(expediente, sesion.id, analisis01(), id);
  }
  const kb = (x) => (Buffer.byteLength(JSON.stringify(x)) / 1024).toFixed(1);
  console.log(`\n  medida: un análisis ${kb(analisis01())} KB · caso con 7 sesiones ${kb(exp)} KB`);
}

console.log(fallos === 0 ? `\n${pasadas} pruebas correctas\n` : `\n${fallos} PRUEBAS FALLIDAS\n`);
process.exit(fallos === 0 ? 0 : 1);
