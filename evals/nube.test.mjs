/**
 * Pruebas del repositorio en la nube con un almacén en memoria (fase 13, etapa 3).
 * No toca Firebase. Reproduce las reglas que importan: revisión + 1 y ranura activa.
 *
 * Ejecutar:  node evals/nube.test.mjs
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
execFileSync(
  process.execPath,
  [
    join(RAIZ, "node_modules/typescript/bin/tsc"),
    "lib/repositorioNube.ts",
    "lib/nube/almacen.ts",
    "lib/casos.ts",
    "--outDir", ".tmp-evals-nube",
    "--rootDir", "lib",
    "--module", "commonjs",
    "--moduleResolution", "node",
    "--target", "es2022",
    "--rewriteRelativeImportExtensions",
    "--skipLibCheck",
  ],
  { cwd: RAIZ, stdio: "inherit" }
);
const require = createRequire(import.meta.url);
const { RepositorioNube } = require(join(RAIZ, ".tmp-evals-nube/repositorioNube.js"));
const { almacenMemoria, ConflictoDeRevision } = require(join(RAIZ, ".tmp-evals-nube/nube/almacen.js"));
const C = require(join(RAIZ, ".tmp-evals-nube/casos.js"));

let n = 0;
async function prueba(nombre, fn) {
  try {
    await fn();
    n++;
    console.log(`  ok   ${nombre}`);
  } catch (e) {
    console.error(`  FALLA ${nombre}\n        ${e.stack}`);
    process.exitCode = 1;
  }
}

const FRASE = "frase de paso larga del clínico";
const NOTA = "M. pidió ir al baño y estuvo allí respirando.";
let k = 0;
const id = () => `id_${++k}`;

function dispositivo(almacen, uid, ranuras) {
  const r = new RepositorioNube(
    () => almacen,
    async (casoUid) => {
      if (ranuras) ranuras.add(casoUid);
    }
  );
  return r.asociarCuenta(uid).then(() => r);
}
async function cuentaNueva(ranuras = new Set()) {
  const almacen = almacenMemoria({ ranurasActivas: ranuras });
  const r = await dispositivo(almacen, "uid-A", ranuras);
  await r.configurar(FRASE);
  return { almacen, r, ranuras };
}
function casoConSesion() {
  const base = C.crearExpediente({ alias: "M.", motivo: "ansiedad" }, "2026-10-01T10:00:00.000Z", id);
  return C.anadirSesion(base, { nota: NOTA }, "2026-10-01T10:00:00.000Z", id).expediente;
}

console.log("\nRepositorio en la nube (almacén en memoria)\n");

await prueba("crear bóveda: la clave de recuperación se entrega una sola vez", async () => {
  const { r } = await cuentaNueva();
  assert.ok(r.tomarClaveRecuperacion());
  assert.equal(r.tomarClaveRecuperacion(), null);
});
await prueba("crear caso, bloquear, desbloquear y recuperar el mismo expediente", async () => {
  const { almacen, r } = await cuentaNueva();
  const exp = casoConSesion();
  await r.crearCaso(exp);
  r.bloquear();
  await assert.rejects(() => r.listarCasos(), /bloqueados/);

  const otro = await dispositivo(almacen, "uid-A"); // "otro ordenador"
  assert.equal(await otro.desbloquear("frase equivocada!!"), false);
  assert.equal(await otro.desbloquear(FRASE), true);
  const lista = await otro.listarCasos();
  assert.equal(lista.length, 1);
  assert.equal(lista[0].alias, "M.");
  const vuelta = await otro.obtenerCaso(exp.caso.id);
  assert.deepEqual(vuelta, exp);
});
await prueba("nada legible en el almacén: ni nota ni alias", async () => {
  const { almacen, r } = await cuentaNueva();
  await r.crearCaso(casoConSesion());
  const volcado = JSON.stringify([...almacen._partes.values()]) + JSON.stringify(await almacen.listarIndices("uid-A"));
  assert.ok(!volcado.includes("baño"));
  assert.ok(!volcado.includes("ansiedad"));
  assert.ok(!volcado.includes('"M."'));
});
await prueba("actualizar sube solo las partes que cambiaron", async () => {
  const { almacen, r } = await cuentaNueva();
  const exp = casoConSesion();
  await r.crearCaso(exp);
  const antes = new Map([...almacen._partes].map(([c, p]) => [c, p.rev]));
  const exp2 = C.anadirSesion(exp, { nota: "Segunda sesión." }, "2026-10-08T10:00:00.000Z", id).expediente;
  await r.actualizarCaso(exp2);
  const cambiadas = [...almacen._partes].filter(([c, p]) => antes.get(c) !== p.rev).map(([c]) => c);
  assert.ok(cambiadas.some((c) => c.endsWith("/cabecera")), "la cabecera cambia (fecha de actualización)");
  assert.equal(cambiadas.filter((c) => c.includes("/s-")).length, 1, "solo la sesión nueva");
  assert.deepEqual((await r.obtenerCaso(exp.caso.id)).sesiones.length, 2);
});
await prueba("sin ranura activa no se puede crear un caso (las reglas lo rechazan)", async () => {
  const almacen = almacenMemoria({ ranurasActivas: new Set() });
  const r = await dispositivo(almacen, "uid-A", null); // reclamar no hace nada
  await r.configurar(FRASE);
  await assert.rejects(() => r.crearCaso(casoConSesion()), /PERMISSION_DENIED/);
});
await prueba("conflicto: dos dispositivos editan el mismo caso, el segundo recibe aviso", async () => {
  const { almacen, r, ranuras } = await cuentaNueva();
  const exp = casoConSesion();
  await r.crearCaso(exp);
  const b = await dispositivo(almacen, "uid-A", ranuras);
  await b.desbloquear(FRASE);
  await b.obtenerCaso(exp.caso.id);

  const deA = C.anadirSesion(exp, { nota: "Sesión desde A." }, "2026-10-08T10:00:00.000Z", id).expediente;
  await r.actualizarCaso(deA);
  const deB = C.anadirSesion(exp, { nota: "Sesión desde B." }, "2026-10-08T11:00:00.000Z", id).expediente;
  await assert.rejects(() => b.actualizarCaso(deB), ConflictoDeRevision);
  // Nada se pisó: A sigue viendo su sesión.
  assert.equal((await r.obtenerCaso(exp.caso.id)).sesiones.length, 2);
});
await prueba("una cuenta no abre los casos de otra", async () => {
  const { almacen, r } = await cuentaNueva();
  await r.crearCaso(casoConSesion());
  const b = await dispositivo(almacen, "uid-B");
  assert.equal(await b.yaConfigurado(), false);
  assert.deepEqual(await b.asociarCuenta("uid-B"), undefined);
  await b.configurar(FRASE);
  assert.equal((await b.listarCasos()).length, 0);
});
await prueba("parte manipulada en el servidor: no se abre y el resto sigue", async () => {
  const { almacen, r } = await cuentaNueva();
  const exp = C.anadirSesion(casoConSesion(), { nota: "Otra." }, "2026-10-08T10:00:00.000Z", id).expediente;
  await r.crearCaso(exp);
  const clave = [...almacen._partes.keys()].find((c) => c.includes("/s-"));
  const p = almacen._partes.get(clave);
  p.sobre.ct = p.sobre.ct.slice(0, -4) + "AAAA";
  r.bloquear();
  await r.desbloquear(FRASE);
  const abierto = await r.obtenerCaso(exp.caso.id);
  assert.equal(abierto.sesiones.length, 1, "la parte rota no se inventa");
});
await prueba("eliminar no está permitido desde el cliente", async () => {
  const { r } = await cuentaNueva();
  await assert.rejects(() => r.eliminarCaso("x"), /Archívalo/);
});
await prueba("el respaldo exportado es solo texto cifrado", async () => {
  const { r } = await cuentaNueva();
  await r.crearCaso(casoConSesion());
  const texto = await (await r.exportarRespaldo()).text();
  assert.ok(texto.includes("acia-respaldo-nube-v1"));
  assert.ok(!texto.includes("baño"));
});
await prueba("olvidó la frase: la recuperación abre y fija una nueva", async () => {
  const { almacen, r } = await cuentaNueva();
  const recup = r.tomarClaveRecuperacion();
  await r.crearCaso(casoConSesion());
  const b = await dispositivo(almacen, "uid-A");
  assert.equal(await b.desbloquearConRecuperacion("0000-0000", "frase nueva muy larga"), false);
  assert.equal(await b.desbloquearConRecuperacion(recup, "frase nueva muy larga"), true);
  assert.equal((await b.listarCasos()).length, 1);
  const c = await dispositivo(almacen, "uid-A");
  assert.equal(await c.desbloquear(FRASE), false);
  assert.equal(await c.desbloquear("frase nueva muy larga"), true);
});

console.log(`\n${n} pruebas pasadas\n`);
