/**
 * Pruebas de las ranuras de casos del servidor (fase 13, etapa de ranuras).
 * Usa el Admin SDK contra el emulador de Firestore: no toca el proyecto real.
 *
 * Ejecutar (JDK 21+):  npm run test:ranuras
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

if (!process.env.FIRESTORE_EMULATOR_HOST) {
  console.error("Falta FIRESTORE_EMULATOR_HOST: ejecuta esto con `npm run test:ranuras`.");
  process.exit(1);
}

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
execFileSync(
  process.execPath,
  [
    join(RAIZ, "node_modules/typescript/bin/tsc"),
    "lib/servidor/ranuras.ts",
    "lib/servidor/ranurasHttp.ts",
    "--outDir", ".tmp-evals-ranuras",
    "--rootDir", "lib",
    "--module", "commonjs",
    "--moduleResolution", "node",
    "--target", "es2022",
    "--skipLibCheck",
  ],
  { cwd: RAIZ, stdio: "inherit" }
);
const require = createRequire(import.meta.url);
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { cambiarRanura, PLANES, borrarCasoEliminado, purgarEliminados } = require(join(RAIZ, ".tmp-evals-ranuras/servidor/ranuras.js"));
const { manejarRanuras } = require(join(RAIZ, ".tmp-evals-ranuras/servidor/ranurasHttp.js"));

const bd = getFirestore(initializeApp({ projectId: "demo-acia" }));

let n = 0;
let corrida = 0;
async function prueba(nombre, fn) {
  corrida++;
  try {
    await fn(`u${corrida}`);
    n++;
    console.log(`  ok   ${nombre}`);
  } catch (e) {
    console.error(`  FALLA ${nombre}\n        ${e.stack}`);
    process.exitCode = 1;
  }
}

const caso = (i) => `caso-${String(i).padStart(4, "0")}-abcdef`;
const estados = async (uid) =>
  Object.fromEntries((await bd.collection(`usuarios/${uid}/ranuras`).get()).docs.map((d) => [d.id, d.data().estado]));
const contador = async (uid) => (await bd.doc(`usuarios/${uid}`).get()).data()?.casos_activos ?? 0;
const cod = async (p) => p.then(() => "ok", (e) => e.codigo ?? e.message);

// Verificador falso: "token-<uid>[-sinverificar]" => sesión; otra cosa => inválido.
const verificar = async (token) => {
  const m = /^token-(\w+?)(-sinverificar)?$/.exec(token);
  if (!m) throw new Error("token inválido");
  return { uid: m[1], email_verified: !m[2] };
};
const post = (token, cuerpo, extra = {}) =>
  manejarRanuras(
    new Request("http://x/api/ranuras", {
      method: "POST",
      headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: typeof cuerpo === "string" ? cuerpo : JSON.stringify(cuerpo),
      ...extra,
    }),
    { verificar, bd: () => bd }
  );

console.log("\nRanuras de casos (Admin SDK + emulador)\n");

await prueba("plan gratuito: tres casos sí, el cuarto se rechaza", async (u) => {
  assert.equal((await cambiarRanura(bd, u, caso(1), "reclamar")).casos_activos, 1);
  assert.equal((await cambiarRanura(bd, u, caso(2), "reclamar")).casos_activos, 2);
  assert.equal((await cambiarRanura(bd, u, caso(3), "reclamar")).casos_activos, 3);
  assert.equal(await cod(cambiarRanura(bd, u, caso(4), "reclamar")), "tope_de_casos");
  assert.equal(await contador(u), 3);
});

await prueba("concurrencia: 8 dispositivos a la vez no superan el tope (solo 3 entran)", async (u) => {
  const resultados = await Promise.all(
    Array.from({ length: 8 }, (_, i) => cod(cambiarRanura(bd, u, caso(i), "reclamar")))
  );
  assert.equal(resultados.filter((r) => r === "ok").length, PLANES.gratuito.max_casos_activos);
  assert.equal(resultados.filter((r) => r === "tope_de_casos").length, 5);
  assert.equal(await contador(u), 3);
  assert.equal(Object.values(await estados(u)).filter((e) => e === "activo").length, 3);
});

await prueba("concurrencia: el mismo caso reclamado 6 veces cuenta una sola", async (u) => {
  const r = await Promise.all(Array.from({ length: 6 }, () => cambiarRanura(bd, u, caso(1), "reclamar")));
  assert.equal(r.filter((x) => x.cambio).length, 1);
  assert.equal(await contador(u), 1);
});

await prueba("repetir reclamar, archivar y reactivar no cambia nada", async (u) => {
  await cambiarRanura(bd, u, caso(1), "reclamar");
  assert.equal((await cambiarRanura(bd, u, caso(1), "reclamar")).cambio, false);
  assert.equal((await cambiarRanura(bd, u, caso(1), "archivar")).cambio, true);
  assert.equal((await cambiarRanura(bd, u, caso(1), "archivar")).cambio, false);
  assert.equal(await contador(u), 0);
  assert.equal((await cambiarRanura(bd, u, caso(1), "reactivar")).cambio, true);
  assert.equal((await cambiarRanura(bd, u, caso(1), "reactivar")).cambio, false);
  assert.equal(await contador(u), 1);
});

await prueba("archivar libera hueco; reactivar lo vuelve a ocupar y respeta el tope", async (u) => {
  for (const i of [1, 2, 3]) await cambiarRanura(bd, u, caso(i), "reclamar");
  await cambiarRanura(bd, u, caso(1), "archivar");
  await cambiarRanura(bd, u, caso(4), "reclamar");
  assert.equal(await cod(cambiarRanura(bd, u, caso(1), "reactivar")), "tope_de_casos");
  assert.equal((await estados(u))[caso(1)], "archivado", "sigue archivado, no se borra ni se pierde");
});

await prueba("reactivar concurrente con un solo hueco: entra uno", async (u) => {
  for (const i of [1, 2, 3]) await cambiarRanura(bd, u, caso(i), "reclamar");
  for (const i of [1, 2]) await cambiarRanura(bd, u, caso(i), "archivar");
  const r = await Promise.all([1, 2].flatMap(() => [1, 2]).map((i) => cod(cambiarRanura(bd, u, caso(i), "reactivar"))));
  assert.ok(await contador(u) <= 3);
  assert.equal((await contador(u)), Object.values(await estados(u)).filter((e) => e === "activo").length);
  assert.ok(r.includes("ok"));
});

await prueba("aislamiento: la ranura de un usuario no cuenta ni afecta a otro", async (u) => {
  const otro = `${u}b`;
  await cambiarRanura(bd, u, caso(1), "reclamar");
  await cambiarRanura(bd, u, caso(2), "reclamar");
  assert.equal(await cod(cambiarRanura(bd, otro, caso(1), "archivar")), "caso_inexistente");
  assert.equal((await cambiarRanura(bd, otro, caso(1), "reclamar")).casos_activos, 1);
  assert.equal(await contador(u), 2);
  assert.deepEqual(await estados(u), { [caso(1)]: "activo", [caso(2)]: "activo" });
});

await prueba("bajar de plan: los casos que sobran siguen activos; solo se impide reclamar más", async (u) => {
  await bd.doc(`usuarios/${u}`).set({ plan_id: "profesional", casos_activos: 0 });
  for (const i of [1, 2, 3, 4]) await cambiarRanura(bd, u, caso(i), "reclamar");
  await bd.doc(`usuarios/${u}`).update({ plan_id: "gratuito" }); // el pago caduca
  assert.equal(await contador(u), 4);
  assert.equal(await cod(cambiarRanura(bd, u, caso(5), "reclamar")), "tope_de_casos");
  assert.deepEqual(Object.values(await estados(u)), ["activo", "activo", "activo", "activo"]);
  await cambiarRanura(bd, u, caso(1), "archivar"); // archivar sigue permitido
  assert.equal(await contador(u), 3);
});

await prueba("nada se archiva solo: reclamar más allá del tope no toca los demás", async (u) => {
  for (const i of [1, 2, 3]) await cambiarRanura(bd, u, caso(i), "reclamar");
  await cod(cambiarRanura(bd, u, caso(4), "reclamar"));
  assert.deepEqual(await estados(u), { [caso(1)]: "activo", [caso(2)]: "activo", [caso(3)]: "activo" });
});

await prueba("un caso archivado no se reclama; reactivar un caso desconocido falla", async (u) => {
  await cambiarRanura(bd, u, caso(1), "reclamar");
  await cambiarRanura(bd, u, caso(1), "archivar");
  assert.equal(await cod(cambiarRanura(bd, u, caso(1), "reclamar")), "caso_archivado");
  assert.equal(await cod(cambiarRanura(bd, u, caso(9), "reactivar")), "caso_inexistente");
});

await prueba("HTTP: sin token 401; token inválido 401; correo sin verificar 403", async (u) => {
  assert.equal((await post(null, { accion: "reclamar", caso_uid: caso(1) })).status, 401);
  assert.equal((await post("basura", { accion: "reclamar", caso_uid: caso(1) })).status, 401);
  assert.equal((await post(`token-${u}-sinverificar`, { accion: "reclamar", caso_uid: caso(1) })).status, 403);
  assert.equal(Object.keys(await estados(u)).length, 0);
});

await prueba("HTTP: el uid sale del token, no del cuerpo", async (u) => {
  const victima = `${u}v`;
  const r = await post(`token-${u}`, { accion: "reclamar", caso_uid: caso(1), uid: victima, usuario_id: victima });
  assert.equal(r.status, 200);
  assert.equal(await contador(victima), 0);
  assert.equal(await contador(u), 1);
});

await prueba("HTTP: validación de acción, caso_uid y cuerpo", async (u) => {
  const t = `token-${u}`;
  assert.equal((await post(t, { accion: "destruir", caso_uid: caso(1) })).status, 400);
  assert.equal((await post(t, { accion: "reclamar", caso_uid: "../otro" })).status, 400);
  assert.equal((await post(t, { accion: "reclamar" })).status, 400);
  assert.equal((await post(t, "no es json")).status, 400);
  assert.equal(Object.keys(await estados(u)).length, 0);
});

await prueba("HTTP: tope devuelve 409 con código; la respuesta no trae datos de otros", async (u) => {
  const t = `token-${u}`;
  await post(t, { accion: "reclamar", caso_uid: caso(1) });
  await post(t, { accion: "reclamar", caso_uid: caso(2) });
  await post(t, { accion: "reclamar", caso_uid: caso(3) });
  const r = await post(t, { accion: "reclamar", caso_uid: caso(4) });
  assert.equal(r.status, 409);
  assert.equal((await r.json()).error, "tope_de_casos");
});

await prueba("HTTP: archivar y reactivar de punta a punta", async (u) => {
  const t = `token-${u}`;
  await post(t, { accion: "reclamar", caso_uid: caso(1) });
  const a = await (await post(t, { accion: "archivar", caso_uid: caso(1) })).json();
  assert.equal(a.estado, "archivado");
  const b = await (await post(t, { accion: "reactivar", caso_uid: caso(1) })).json();
  assert.equal(b.estado, "activo");
  assert.equal(b.casos_activos, 1);
});

// --- Eliminar con 30 días para arrepentirse ----------------------------

const DIA = 24 * 60 * 60 * 1000;
async function sembrarCaso(uid, c) {
  // Contenido cifrado de mentira: el servidor nunca lo lee, solo lo borra.
  await bd.doc(`usuarios/${uid}/casos/${c}`).set({ rev: 1 });
  await bd.doc(`usuarios/${uid}/casos/${c}/partes/p1`).set({ rev: 1 });
  await bd.doc(`usuarios/${uid}/casos/${c}/partes_historial/p1__1`).set({ rev: 1 });
  await bd.doc(`usuarios/${uid}/indice/${c}`).set({ rev: 1 });
}
const existe = async (ruta) => (await bd.doc(ruta).get()).exists;

await prueba("eliminar libera la ranura y recuperar la vuelve a ocupar", async (u) => {
  await cambiarRanura(bd, u, caso(1), "reclamar");
  assert.equal((await cambiarRanura(bd, u, caso(1), "eliminar")).estado, "eliminado");
  assert.equal(await contador(u), 0);
  assert.equal((await cambiarRanura(bd, u, caso(1), "eliminar")).cambio, false, "repetir no cambia nada");
  assert.equal((await cambiarRanura(bd, u, caso(1), "recuperar")).estado, "activo");
  assert.equal(await contador(u), 1);
  const d = (await bd.doc(`usuarios/${u}/ranuras/${caso(1)}`).get()).data();
  assert.equal(d.eliminado_en, undefined);
  assert.equal(d.estado_previo, undefined);
});

await prueba("un archivado eliminado vuelve archivado y no ocupa ranura", async (u) => {
  await cambiarRanura(bd, u, caso(1), "reclamar");
  await cambiarRanura(bd, u, caso(1), "archivar");
  await cambiarRanura(bd, u, caso(1), "eliminar");
  assert.equal(await contador(u), 0);
  assert.equal((await cambiarRanura(bd, u, caso(1), "recuperar")).estado, "archivado");
  assert.equal(await contador(u), 0);
});

await prueba("recuperar sin hueco falla y el caso sigue eliminado", async (u) => {
  await cambiarRanura(bd, u, caso(1), "reclamar");
  await cambiarRanura(bd, u, caso(1), "eliminar");
  for (const i of [2, 3, 4]) await cambiarRanura(bd, u, caso(i), "reclamar");
  assert.equal(await cod(cambiarRanura(bd, u, caso(1), "recuperar")), "tope_de_casos");
  assert.equal((await estados(u))[caso(1)], "eliminado");
});

await prueba("un caso eliminado no se archiva, reactiva ni reclama", async (u) => {
  await cambiarRanura(bd, u, caso(1), "reclamar");
  await cambiarRanura(bd, u, caso(1), "eliminar");
  for (const a of ["archivar", "reactivar", "reclamar"]) {
    assert.equal(await cod(cambiarRanura(bd, u, caso(1), a)), "caso_eliminado", a);
  }
});

await prueba("borrar exige que esté eliminado y lo borra todo", async (u) => {
  await cambiarRanura(bd, u, caso(1), "reclamar");
  await sembrarCaso(u, caso(1));
  assert.equal(await cod(borrarCasoEliminado(bd, u, caso(1))), "caso_no_eliminado");
  assert.ok(await existe(`usuarios/${u}/casos/${caso(1)}/partes/p1`), "no se borró nada");
  await cambiarRanura(bd, u, caso(1), "eliminar");
  assert.deepEqual(await borrarCasoEliminado(bd, u, caso(1)), { borrado: true });
  for (const ruta of [
    `usuarios/${u}/casos/${caso(1)}`,
    `usuarios/${u}/casos/${caso(1)}/partes/p1`,
    `usuarios/${u}/casos/${caso(1)}/partes_historial/p1__1`,
    `usuarios/${u}/indice/${caso(1)}`,
    `usuarios/${u}/ranuras/${caso(1)}`,
  ]) {
    assert.equal(await existe(ruta), false, ruta);
  }
});

await prueba("purgar borra solo lo eliminado hace 30 días o más", async (u) => {
  const t0 = new Date("2026-10-01T12:00:00Z");
  for (const i of [1, 2, 3]) {
    await cambiarRanura(bd, u, caso(i), "reclamar");
    await sembrarCaso(u, caso(i));
  }
  await cambiarRanura(bd, u, caso(1), "eliminar", () => t0);
  await cambiarRanura(bd, u, caso(2), "eliminar", () => new Date(t0.getTime() + 5 * DIA));
  // Día 29: nada. Día 30: solo el caso 1. El 3 nunca, porque no está eliminado.
  await purgarEliminados(bd, () => new Date(t0.getTime() + 29 * DIA));
  assert.equal(await existe(`usuarios/${u}/ranuras/${caso(1)}`), true);
  await purgarEliminados(bd, () => new Date(t0.getTime() + 30 * DIA));
  assert.equal(await existe(`usuarios/${u}/ranuras/${caso(1)}`), false);
  assert.equal(await existe(`usuarios/${u}/casos/${caso(1)}/partes/p1`), false);
  assert.equal(await existe(`usuarios/${u}/ranuras/${caso(2)}`), true);
  assert.equal(await existe(`usuarios/${u}/casos/${caso(3)}/partes/p1`), true);
});

await prueba("HTTP: eliminar y borrar de punta a punta; otro usuario no borra lo ajeno", async (u) => {
  const t = `token-${u}`;
  await post(t, { accion: "reclamar", caso_uid: caso(1) });
  await sembrarCaso(u, caso(1));
  assert.equal((await (await post(t, { accion: "eliminar", caso_uid: caso(1) })).json()).estado, "eliminado");
  assert.equal((await (await post(`token-${u}x`, { accion: "borrar", caso_uid: caso(1) })).json()).borrado, false);
  assert.ok(await existe(`usuarios/${u}/casos/${caso(1)}/partes/p1`), "lo ajeno sigue ahí");
  assert.equal((await (await post(t, { accion: "borrar", caso_uid: caso(1) })).json()).borrado, true);
  assert.equal(await existe(`usuarios/${u}/casos/${caso(1)}/partes/p1`), false);
});

console.log(`\n${n} pruebas pasadas\n`);
process.exit(process.exitCode ?? 0);
