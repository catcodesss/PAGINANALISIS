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
  const r = new RepositorioNube(() => almacen, {
    reclamar: async (c) => void ranuras?.add(c),
    archivar: async (c) => void ranuras?.delete(c),
    reactivar: async (c) => void ranuras?.add(c),
  });
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
// --- Etapa 4: fusión de conflictos entre dispositivos (propuesta §12, pruebas 15 a 19) ---

async function dosDispositivos() {
  const { almacen, r, ranuras } = await cuentaNueva();
  const exp = casoConSesion();
  await r.crearCaso(exp);
  const b = await dispositivo(almacen, "uid-A", ranuras);
  await b.desbloquear(FRASE);
  await b.obtenerCaso(exp.caso.id);
  return { almacen, a: r, b, exp };
}
const con = (exp, cambios) => ({ ...exp, ...cambios });

await prueba("15. dos dispositivos añaden sesiones sin coordinarse: se fusionan sin perder datos", async () => {
  const { a, b, exp } = await dosDispositivos();
  await a.actualizarCaso(C.anadirSesion(exp, { nota: "Sesión desde A." }, "2026-10-08T10:00:00.000Z", id).expediente);
  await b.actualizarCaso(C.anadirSesion(exp, { nota: "Sesión desde B." }, "2026-10-08T11:00:00.000Z", id).expediente);
  const final = await a.obtenerCaso(exp.caso.id);
  const textos = final.notas.map((x) => x.texto);
  assert.ok(textos.includes("Sesión desde A.") && textos.includes("Sesión desde B.") && textos.includes(NOTA));
  assert.equal(final.sesiones.length, 3);
  assert.deepEqual(await b.obtenerCaso(exp.caso.id), final, "los dos dispositivos ven lo mismo");
});
await prueba("17. sesión creada en paralelo: ambas se conservan y se renumeran, con aviso", async () => {
  const { a, b, exp } = await dosDispositivos();
  await a.actualizarCaso(C.anadirSesion(exp, { nota: "Desde A." }, "2026-10-08T10:00:00.000Z", id).expediente);
  await b.actualizarCaso(C.anadirSesion(exp, { nota: "Desde B." }, "2026-10-08T11:00:00.000Z", id).expediente);
  const final = await a.obtenerCaso(exp.caso.id);
  assert.deepEqual(final.sesiones.map((x) => x.n), [1, 2, 3]);
  const segunda = final.sesiones.find((x) => x.n === 2);
  assert.equal(final.notas.find((x) => x.id === segunda.nota_ids[0]).texto, "Desde A.", "la más antigua conserva su número");
  assert.ok(b.tomarAvisosFusion().some((x) => x.tipo === "sesion_renumerada"));
  assert.equal(b.tomarAvisosFusion().length, 0, "los avisos se entregan una vez");
});
await prueba("16. mismo campo editado en ambos: gana el más reciente y el otro queda como revisión", async () => {
  const { a, b, exp } = await dosDispositivos();
  await a.actualizarCaso(con(exp, { caso: { ...exp.caso, motivo: "motivo desde A", actualizado: "2026-10-02T10:00:00.000Z" } }));
  await b.actualizarCaso(con(exp, { caso: { ...exp.caso, motivo: "motivo desde B", actualizado: "2026-10-02T11:00:00.000Z" } }));
  const final = await b.obtenerCaso(exp.caso.id);
  assert.equal(final.caso.motivo, "motivo desde B");
  const rev = final.revisiones.find((x) => x.antes?.includes("motivo desde A"));
  assert.ok(rev, "lo que perdió queda recuperable");
  assert.ok(b.tomarAvisosFusion().some((x) => x.tipo === "dato_en_conflicto"));
});
await prueba("campos distintos editados a la vez: se conservan los dos sin conflicto", async () => {
  const { a, b, exp } = await dosDispositivos();
  await a.actualizarCaso(con(exp, { caso: { ...exp.caso, motivo: "otro motivo", actualizado: "2026-10-02T10:00:00.000Z" } }));
  await b.actualizarCaso(con(exp, { caso: { ...exp.caso, alias: "M.R.", actualizado: "2026-10-02T11:00:00.000Z" } }));
  const final = await a.obtenerCaso(exp.caso.id);
  assert.equal(final.caso.motivo, "otro motivo");
  assert.equal(final.caso.alias, "M.R.");
  assert.equal(final.revisiones.length, 0);
  assert.equal(b.tomarAvisosFusion().length, 0);
});
await prueba("18. corte de red a mitad de subida: se reanuda sin duplicar", async () => {
  const { almacen, a, exp } = await dosDispositivos();
  const original = almacen.guardarParte.bind(almacen);
  let llamadas = 0;
  almacen.guardarParte = async (...args) => {
    if (++llamadas === 2) throw new Error("red caída");
    return original(...args);
  };
  const exp2 = C.anadirSesion(
    C.anadirSesion(exp, { nota: "Dos." }, "2026-10-08T10:00:00.000Z", id).expediente,
    { nota: "Tres." },
    "2026-10-15T10:00:00.000Z",
    id
  ).expediente;
  await assert.rejects(() => a.actualizarCaso(exp2), /red caída/);
  const subidas = llamadas;
  await a.actualizarCaso(exp2); // reintento: sube solo lo que faltaba
  assert.ok(llamadas - subidas <= 3, "no vuelve a subir lo que ya estaba");
  const final = await a.obtenerCaso(exp.caso.id);
  assert.equal(final.sesiones.length, 3);
  assert.equal(new Set(final.sesiones.map((x) => x.id)).size, 3, "sin duplicados");
});
await prueba("19. una parte corrupta no impide abrir el resto, ni se pisa al guardar", async () => {
  const { almacen, a, b, exp } = await dosDispositivos();
  await a.actualizarCaso(C.anadirSesion(exp, { nota: "Dos." }, "2026-10-08T10:00:00.000Z", id).expediente);
  const clave = [...almacen._partes.keys()].filter((c) => c.includes("/s-")).at(-1);
  const p = almacen._partes.get(clave);
  const antes = p.sobre.ct;
  p.sobre.ct = p.sobre.ct.slice(0, -4) + "AAAA";
  const sano = await a.obtenerCaso(exp.caso.id);
  assert.equal(sano.sesiones.length, 1, "se abre lo sano");
  // B se había quedado atrás: al guardar, la fusión se niega a pisar la parte ilegible.
  await assert.rejects(
    () => b.actualizarCaso(C.anadirSesion(exp, { nota: "Desde B." }, "2026-10-09T10:00:00.000Z", id).expediente),
    /no se pueden leer/
  );
  assert.notEqual(almacen._partes.get(clave).sobre.ct, "", "la parte dañada sigue ahí");
  assert.ok(antes.length > 0);
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
await prueba("archivar guarda antes de liberar la ranura; reactivar ocupa antes de guardar", async () => {
  const { almacen, r, ranuras } = await cuentaNueva();
  const exp = casoConSesion();
  await r.crearCaso(exp);
  const archivado = { ...exp, caso: { ...exp.caso, fase: "archivado", actualizado: "2026-10-02T00:00:00.000Z" } };
  await r.actualizarCaso(archivado);
  assert.equal(ranuras.has(exp.caso.id), false);
  // archivado: se puede leer y exportar, pero no escribir
  assert.equal((await r.obtenerCaso(exp.caso.id)).caso.fase, "archivado");
  assert.ok((await (await r.exportarRespaldo()).text()).includes(exp.caso.id));
  await assert.rejects(() => almacen.guardarParte("uid-A", exp.caso.id, 99, { parte_id: "x", tipo: "sesion", sobre: {}, hash_ct: "" }), /PERMISSION_DENIED|Conflicto|cambió/);
  const activo = { ...archivado, caso: { ...archivado.caso, fase: "activo", actualizado: "2026-10-03T00:00:00.000Z" } };
  await r.actualizarCaso(activo);
  assert.equal(ranuras.has(exp.caso.id), true);
});
await prueba("reactivar sin hueco falla y no guarda nada", async () => {
  const { almacen, r } = await cuentaNueva();
  const exp = casoConSesion();
  await r.crearCaso(exp);
  await r.actualizarCaso({ ...exp, caso: { ...exp.caso, fase: "archivado", actualizado: "2026-10-02T00:00:00.000Z" } });
  const sinHueco = new RepositorioNube(() => almacen, {
    reclamar: async () => {}, archivar: async () => {},
    reactivar: async () => { throw new Error("Tu plan permite 2 casos activos."); },
  });
  await sinHueco.asociarCuenta("uid-A");
  await sinHueco.desbloquear(FRASE);
  const vista = await sinHueco.obtenerCaso(exp.caso.id);
  await assert.rejects(
    () => sinHueco.actualizarCaso({ ...vista, caso: { ...vista.caso, fase: "activo", actualizado: "2026-10-04T00:00:00.000Z" } }),
    /plan permite/
  );
  assert.equal((await r.obtenerCaso(exp.caso.id)).caso.fase, "archivado");
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

// --- Etapa 5: historial de partes y respaldo (propuesta §12, pruebas 20 y 22) ---

await prueba("20. restaurar una parte desde el historial; lo sustituido también queda en el historial", async () => {
  const { almacen, r } = await cuentaNueva();
  const exp = casoConSesion();
  await r.crearCaso(exp);
  const idParte = `s-${exp.sesiones[0].id}`;
  // Un cambio legítimo de la sesión (el registro) sobrescribe su parte.
  const editado = { ...exp, sesiones: exp.sesiones.map((x) => ({ ...x, registro: "Registro nuevo." })) };
  await r.actualizarCaso(editado);
  assert.equal((await r.obtenerCaso(exp.caso.id)).sesiones[0].registro, "Registro nuevo.");

  const historial = await r.historialDeParte(exp.caso.id, idParte);
  assert.equal(historial.length, 1);
  const vuelta = await r.restaurarParte(exp.caso.id, idParte, historial[0].historial_id);
  assert.equal(vuelta.sesiones[0].registro, "", "vuelve a la versión anterior");
  assert.equal((await r.historialDeParte(exp.caso.id, idParte)).length, 2, "la sustituida no se pierde");
  // El almacén no tiene texto legible ni siquiera en el historial.
  assert.ok(!JSON.stringify(await almacen.listarHistorial("uid-A", exp.caso.id, idParte)).includes("Registro nuevo"));
});
await prueba("20b. una parte dañada se recupera desde su versión anterior", async () => {
  const { almacen, r } = await cuentaNueva();
  const exp = casoConSesion();
  await r.crearCaso(exp);
  const idParte = `s-${exp.sesiones[0].id}`;
  await r.actualizarCaso({ ...exp, sesiones: exp.sesiones.map((x) => ({ ...x, registro: "Cambio." })) });
  const clave = [...almacen._partes.keys()].find((c) => c.endsWith(`/${idParte}`));
  const p = almacen._partes.get(clave);
  p.sobre.ct = p.sobre.ct.slice(0, -4) + "AAAA";
  const [h] = await r.historialDeParte(exp.caso.id, idParte);
  const arreglado = await r.restaurarParte(exp.caso.id, idParte, h.historial_id);
  assert.equal(arreglado.sesiones.length, 1);
  assert.equal((await r.obtenerCaso(exp.caso.id)).notas[0].texto, NOTA);
});
await prueba("restaurar una versión que no existe falla sin tocar nada", async () => {
  const { r } = await cuentaNueva();
  const exp = casoConSesion();
  await r.crearCaso(exp);
  await assert.rejects(
    () => r.restaurarParte(exp.caso.id, `s-${exp.sesiones[0].id}`, "inventada__1"),
    /ya no está disponible/
  );
});
await prueba("22. importar un respaldo de la nube en una cuenta nueva", async () => {
  const { r } = await cuentaNueva();
  const exp = casoConSesion();
  await r.crearCaso(exp);
  const archivado = C.crearExpediente({ alias: "A.", motivo: "otro" }, "2026-10-02T10:00:00.000Z", id);
  await r.crearCaso(archivado);
  await r.actualizarCaso({
    ...archivado,
    caso: { ...archivado.caso, fase: "archivado", actualizado: "2026-10-03T00:00:00.000Z" },
  });
  const respaldo = await (await r.exportarRespaldo()).text();

  const ranuras = new Set();
  const almacenNuevo = almacenMemoria({ ranurasActivas: ranuras });
  const nueva = await dispositivo(almacenNuevo, "uid-NUEVA", ranuras);
  await nueva.configurar("otra frase distinta y larga");
  await assert.rejects(() => nueva.importarRespaldoNube(respaldo, "frase equivocada!!"), /no abre este respaldo/);
  assert.deepEqual(await nueva.importarRespaldoNube(respaldo, FRASE), { importados: 2, omitidos: 0, fallidos: 0 });
  assert.deepEqual(await nueva.obtenerCaso(exp.caso.id), exp);
  assert.equal((await nueva.obtenerCaso(archivado.caso.id)).caso.fase, "archivado");
  assert.equal(ranuras.has(archivado.caso.id), false, "el archivado no ocupa ranura");
  // Repetir no duplica.
  assert.deepEqual(await nueva.importarRespaldoNube(respaldo, FRASE), { importados: 0, omitidos: 2, fallidos: 0 });
  assert.equal((await nueva.listarCasos()).length, 2);
});

await prueba("versiones anteriores: se muestran como sesiones, con fecha y dispositivo; una parte ilegible se marca", async () => {
  const { almacen, r } = await cuentaNueva();
  const exp = casoConSesion();
  await r.crearCaso(exp);
  assert.deepEqual(await r.versionesAnteriores(exp.caso.id), [], "sin sobrescrituras no hay versiones");
  await r.actualizarCaso({
    ...exp,
    caso: { ...exp.caso, actualizado: "2026-10-02T00:00:00.000Z" },
    sesiones: exp.sesiones.map((x) => ({ ...x, registro: "Cambio." })),
  });
  const grupos = await r.versionesAnteriores(exp.caso.id);
  const sesion = grupos.find((g) => g.etiqueta === "Sesión 1");
  assert.ok(sesion, "la sesión se llama «Sesión 1», no por su id interno");
  assert.equal(sesion.versiones.length, 1);
  assert.ok(sesion.versiones[0].archivado_en, "trae la fecha en que se archivó");
  assert.ok(grupos.some((g) => g.etiqueta.startsWith("Datos del caso")));
  assert.ok(grupos.every((g) => !g.ilegible));

  // Se daña la sesión: sigue llamándose «Sesión 1» (por su versión anterior) y se marca ilegible.
  const clave = [...almacen._partes.keys()].find((c) => c.includes("/s-"));
  const p = almacen._partes.get(clave);
  p.sobre.ct = p.sobre.ct.slice(0, -4) + "AAAA";
  await r.obtenerCaso(exp.caso.id);
  assert.deepEqual(r.partesIlegibles(exp.caso.id), [clave.split("/").at(-1)]);
  const despues = await r.versionesAnteriores(exp.caso.id);
  assert.equal(despues[0].etiqueta, "Sesión 1");
  assert.equal(despues[0].ilegible, true, "las ilegibles van primero");
});

await prueba("clave de recuperación opcional: la bóveda nace sin ella y se crea después", async () => {
  const almacen = almacenMemoria({ ranurasActivas: new Set() });
  const r = await dispositivo(almacen, "uid-A");
  await r.configurar(FRASE, { conRecuperacion: false });
  assert.equal(r.tomarClaveRecuperacion(), null);
  assert.equal(await r.tieneRecuperacion(), false);
  assert.equal(await r.crearRecuperacion("frase equivocada!!"), null);
  assert.equal(await r.tieneRecuperacion(), false);
  const clave = await r.crearRecuperacion(FRASE);
  assert.equal(clave.split(" ").length, 12);
  assert.equal(await r.tieneRecuperacion(), true);

  // Otro ordenador: la clave guardada en el almacén sirve para recuperar el acceso.
  const otro = await dispositivo(almacen, "uid-A");
  assert.equal(await otro.tieneRecuperacion(), true);
  assert.equal(await otro.desbloquearConRecuperacion(clave, "frase nueva muy larga"), true);
});

console.log(`\n${n} pruebas pasadas\n`);
