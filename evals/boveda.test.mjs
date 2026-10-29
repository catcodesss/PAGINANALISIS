/**
 * Pruebas de la bóveda de claves, el KDF y el sobre v2 (fase 13, etapa 1).
 *
 * Ejecutar:  node --experimental-strip-types evals/boveda.test.mjs
 * Usan Argon2id con memoria mínima para ir rápido; en producción son 64 MiB.
 */
import assert from "node:assert/strict";
import {
  abrirClaveCaso,
  cambiarFrase,
  crearBoveda,
  crearClaveCaso,
  desbloquearConFrase,
  desbloquearConRecuperacion,
  regenerarRecuperacion,
  restablecerFraseConRecuperacion,
  rotarCmd,
  tieneRecuperacion,
} from "../lib/boveda.ts";
import { cifrarParte, descifrarParte } from "../lib/cifradoV2.ts";
import {
  codificarRecuperacion,
  decodificarPalabras,
  decodificarRecuperacion,
  codificarPalabras,
  PALABRAS_RECUPERACION,
  PARAMETROS_POR_DEFECTO,
} from "../lib/kdf.ts";

const RAPIDO = { m: 1024, t: 1, p: 1 };
const FRASE = "frase de paso larga del clínico";
const UID = "uid-A";
const NOTA = "M., mujer de 29 años. Pidió ir al baño y estuvo allí respirando.";

let n = 0;
async function prueba(nombre, fn) {
  try {
    await fn();
    n++;
    console.log(`  ok   ${nombre}`);
  } catch (e) {
    console.error(`  FALLA ${nombre}\n        ${e.message}`);
    process.exitCode = 1;
  }
}
const ctx = (o = {}) => ({ uid: UID, caso_uid: "c1", parte_id: "p1", rev: 1, kid: 1, ...o });

console.log("\nBóveda, KDF y sobre v2\n");

const { boveda, cmd, claveRecuperacion } = await crearBoveda(FRASE, RAPIDO);

await prueba("parámetros por defecto: Argon2id 64 MiB, 3 pasadas", () => {
  assert.deepEqual({ ...PARAMETROS_POR_DEFECTO }, { m: 65536, t: 3, p: 1 });
});
await prueba("rechaza una frase de menos de 12 caracteres", async () => {
  await assert.rejects(() => crearBoveda("corta", RAPIDO));
});
await prueba("la CMD no es extraíble", async () => {
  assert.equal(cmd.extractable, false);
  await assert.rejects(() => crypto.subtle.exportKey("raw", cmd));
});
await prueba("desbloquea con la frase; con otra frase, null", async () => {
  assert.ok(await desbloquearConFrase(boveda, FRASE));
  assert.equal(await desbloquearConFrase(boveda, "otra frase distinta"), null);
});
await prueba("desbloquea con la clave de recuperación (con guiones, minúsculas o espacios)", async () => {
  assert.ok(await desbloquearConRecuperacion(boveda, claveRecuperacion));
  assert.ok(
    await desbloquearConRecuperacion(boveda, claveRecuperacion.toLowerCase().replaceAll("-", " "))
  );
  assert.equal(await desbloquearConRecuperacion(boveda, "0000-0000"), null);
});
await prueba("la clave de recuperación ida y vuelta es exacta", () => {
  const b = crypto.getRandomValues(new Uint8Array(32));
  assert.deepEqual(decodificarRecuperacion(codificarRecuperacion(b)), b);
});
await prueba("la bóveda serializada no contiene la frase ni la clave de recuperación", () => {
  const json = JSON.stringify(boveda);
  assert.ok(!json.includes(FRASE));
  assert.ok(!json.includes(claveRecuperacion.replaceAll("-", "")));
});

const { envuelta, cc } = await crearClaveCaso(cmd, UID, "c1");

await prueba("clave de caso: se abre con la CMD y no es extraíble", async () => {
  const abierta = await abrirClaveCaso(cmd, UID, envuelta);
  assert.ok(abierta);
  assert.equal(abierta.extractable, false);
});
await prueba("clave de caso atada a usuario y a caso", async () => {
  assert.equal(await abrirClaveCaso(cmd, "uid-B", envuelta), null);
  assert.equal(await abrirClaveCaso(cmd, UID, { ...envuelta, caso_uid: "c2" }), null);
});

const sobre = await cifrarParte(cc, NOTA, ctx());

await prueba("sobre v2: ida y vuelta intacta", async () => {
  assert.equal(await descifrarParte(cc, sobre, ctx()), NOTA);
});
await prueba("el texto no aparece en el sobre", () => {
  assert.ok(!JSON.stringify(sobre).includes("baño"));
});
await prueba("AAD: sobre movido a otro usuario, caso, parte o revisión falla", async () => {
  for (const c of [{ uid: "uid-B" }, { caso_uid: "c2" }, { parte_id: "p2" }, { rev: 0 }]) {
    assert.equal(await descifrarParte(cc, sobre, ctx(c)), null, JSON.stringify(c));
  }
});
await prueba("sobre manipulado o con otra clave: null", async () => {
  const roto = { ...sobre, ct: sobre.ct.slice(0, -4) + "AAAA" };
  assert.equal(await descifrarParte(cc, roto, ctx()), null);
  const otra = (await crearClaveCaso(cmd, UID, "c1")).cc;
  assert.equal(await descifrarParte(otra, sobre, ctx()), null);
});
await prueba("relleno: textos de distinto tamaño dan sobres del mismo tamaño", async () => {
  const a = await cifrarParte(cc, "a".repeat(10), ctx());
  const b = await cifrarParte(cc, "b" + "xyzw".repeat(200), ctx());
  assert.equal(a.ct.length, b.ct.length);
});
await prueba("compresión + base64: 230 KB repetitivos caben en pocos KB", async () => {
  const s = await cifrarParte(cc, "texto clínico repetido ".repeat(10000), ctx());
  assert.ok(s.ct.length < 20000, `ct=${s.ct.length}`);
});
await prueba("IV distinto en cada cifrado", async () => {
  const s2 = await cifrarParte(cc, NOTA, ctx());
  assert.notEqual(s2.iv, sobre.iv);
});

await prueba("cambiar la frase: la nueva sirve, la vieja no, los datos siguen legibles", async () => {
  const nueva = await cambiarFrase(boveda, FRASE, "una frase nueva bien larga", RAPIDO);
  assert.ok(nueva);
  assert.equal(await desbloquearConFrase(nueva, FRASE), null);
  const cmd2 = await desbloquearConFrase(nueva, "una frase nueva bien larga");
  const cc2 = await abrirClaveCaso(cmd2, UID, envuelta);
  assert.equal(await descifrarParte(cc2, sobre, ctx()), NOTA);
  assert.equal(
    await cambiarFrase(boveda, "frase equivocada!!", "otra frase nueva larga", RAPIDO),
    null
  );
});
await prueba("olvidó la frase: la recuperación restablece una nueva", async () => {
  const nueva = await restablecerFraseConRecuperacion(
    boveda,
    claveRecuperacion,
    "frase tras recuperar 1",
    RAPIDO
  );
  const cmd2 = await desbloquearConFrase(nueva, "frase tras recuperar 1");
  assert.ok(cmd2);
  assert.equal(await descifrarParte(await abrirClaveCaso(cmd2, UID, envuelta), sobre, ctx()), NOTA);
});
await prueba("regenerar la recuperación invalida la anterior", async () => {
  const r = await regenerarRecuperacion(boveda, FRASE);
  assert.equal(await desbloquearConRecuperacion(r.boveda, claveRecuperacion), null);
  assert.ok(await desbloquearConRecuperacion(r.boveda, r.claveRecuperacion));
});
await prueba("rotar la CMD: claves reenvueltas, datos legibles, recuperación vieja inválida", async () => {
  const r = await rotarCmd(boveda, FRASE, UID, [envuelta], RAPIDO);
  assert.ok(r);
  assert.equal(r.boveda.version_clave, 2);
  assert.equal(await desbloquearConRecuperacion(r.boveda, claveRecuperacion), null);
  const cmd2 = await desbloquearConFrase(r.boveda, FRASE);
  const cc2 = await abrirClaveCaso(cmd2, UID, r.casos[0]);
  assert.equal(await descifrarParte(cc2, sobre, ctx()), NOTA);
  assert.equal(await abrirClaveCaso(cmd, UID, r.casos[0]), null);
});
await prueba("rotar con frase incorrecta no cambia nada", async () => {
  assert.equal(await rotarCmd(boveda, "frase incorrecta!!", UID, [envuelta], RAPIDO), null);
});

await prueba("clave de recuperación: 12 palabras de la lista, ida y vuelta", () => {
  const palabras = claveRecuperacion.split(" ");
  assert.equal(palabras.length, 12);
  assert.ok(palabras.every((p) => PALABRAS_RECUPERACION.includes(p)));
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  assert.deepEqual([...decodificarPalabras(codificarPalabras(bytes))], [...bytes]);
});
await prueba("la lista tiene 2048 palabras distintas de 4 letras", () => {
  assert.equal(PALABRAS_RECUPERACION.length, 2048);
  assert.equal(new Set(PALABRAS_RECUPERACION).size, 2048);
  assert.ok(PALABRAS_RECUPERACION.every((p) => /^[a-z]{4}$/.test(p)));
});
await prueba("palabras: tolera mayúsculas, comas y saltos de línea", () => {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  const sucio = codificarPalabras(bytes).toUpperCase().replaceAll(" ", ", ");
  assert.deepEqual([...decodificarPalabras(sucio)], [...bytes]);
});
await prueba("palabras: detecta una errata, una palabra de menos y palabras ajenas", () => {
  const palabras = codificarPalabras(crypto.getRandomValues(new Uint8Array(16))).split(" ");
  const otra = PALABRAS_RECUPERACION.find((p) => p !== palabras[4]);
  let detectadas = 0;
  for (const cand of PALABRAS_RECUPERACION.slice(0, 64)) {
    if (cand === palabras[4]) continue;
    const alterada = [...palabras];
    alterada[4] = cand;
    if (decodificarPalabras(alterada.join(" ")) === null) detectadas++;
  }
  assert.ok(detectadas >= 55, `solo ${detectadas}/63 erratas detectadas`);
  assert.equal(decodificarPalabras(palabras.slice(1).join(" ")), null);
  assert.equal(decodificarPalabras(palabras.map(() => "hola").join(" ")), null);
  assert.ok(otra);
});
await prueba("la clave de 12 palabras abre la bóveda", async () => {
  assert.ok(await desbloquearConRecuperacion(boveda, claveRecuperacion.toUpperCase()));
  assert.equal(await desbloquearConRecuperacion(boveda, "bafe ".repeat(12)), null);
});
await prueba("el formato antiguo (52 caracteres) sigue sirviendo", async () => {
  const viejo = codificarRecuperacion(crypto.getRandomValues(new Uint8Array(32)));
  assert.equal(decodificarRecuperacion(viejo)?.length, 32);
});
await prueba("bóveda sin clave de recuperación: se abre con la frase y no tiene ranura", async () => {
  const r = await crearBoveda(FRASE, RAPIDO, { conRecuperacion: false });
  assert.equal(r.claveRecuperacion, null);
  assert.equal(tieneRecuperacion(r.boveda), false);
  assert.ok(await desbloquearConFrase(r.boveda, FRASE));
  assert.equal(tieneRecuperacion(boveda), true);
});
await prueba("la clave se puede crear más tarde y entonces sirve", async () => {
  const r = await crearBoveda(FRASE, RAPIDO, { conRecuperacion: false });
  const g = await regenerarRecuperacion(r.boveda, FRASE);
  assert.equal(tieneRecuperacion(g.boveda), true);
  assert.ok(await desbloquearConRecuperacion(g.boveda, g.claveRecuperacion));
  assert.equal(await regenerarRecuperacion(r.boveda, "frase equivocada!!"), null);
});
await prueba("rotar la CMD no crea una clave de recuperación si no existía", async () => {
  const r = await crearBoveda(FRASE, RAPIDO, { conRecuperacion: false });
  const rot = await rotarCmd(r.boveda, FRASE, UID, [], RAPIDO);
  assert.equal(rot.claveRecuperacion, null);
  assert.equal(tieneRecuperacion(rot.boveda), false);
});

console.log(`\n${n} pruebas pasadas\n`);
