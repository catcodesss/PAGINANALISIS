/**
 * Contraseña única: de una contraseña salen dos claves independientes.
 * Ejecutar:  node --experimental-strip-types evals/credenciales.test.mjs
 */
import assert from "node:assert/strict";
import { derivarCredenciales } from "../lib/credenciales.ts";
import { crearBoveda, desbloquearConFrase } from "../lib/boveda.ts";
import {
  esCuentaAntigua,
  guardarSecretoBoveda,
  obtenerSecretoBoveda,
  olvidarSecretoBoveda,
} from "../lib/secretoSesion.ts";
import { precioEnCoins } from "../lib/precios.ts";

const RAPIDO = { m: 1024, t: 1, p: 1 };
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

console.log("\nContraseña única\n");

const a = await derivarCredenciales("ana@ejemplo.com", "una contraseña larga y buena", RAPIDO);

await prueba("es determinista: mismos datos, mismas claves", async () => {
  const b = await derivarCredenciales("ana@ejemplo.com", "una contraseña larga y buena", RAPIDO);
  assert.deepEqual(a, b);
});
await prueba("la clave de acceso y la de la bóveda son distintas", () => {
  assert.notEqual(a.acceso, a.boveda);
  assert.match(a.acceso, /^v2\.[A-Za-z0-9_-]{43}$/);
  assert.match(a.boveda, /^v2\.[A-Za-z0-9_-]{43}$/);
});
await prueba("otra contraseña u otro correo dan claves distintas", async () => {
  const c = await derivarCredenciales("ana@ejemplo.com", "otra contraseña muy distinta", RAPIDO);
  const d = await derivarCredenciales("luis@ejemplo.com", "una contraseña larga y buena", RAPIDO);
  for (const x of [c, d]) {
    assert.notEqual(x.acceso, a.acceso);
    assert.notEqual(x.boveda, a.boveda);
  }
});
await prueba("el correo se normaliza (mayúsculas y espacios no cambian nada)", async () => {
  const b = await derivarCredenciales("  ANA@Ejemplo.com ", "una contraseña larga y buena", RAPIDO);
  assert.deepEqual(a, b);
});
await prueba("la clave de acceso no abre la bóveda; la de la bóveda sí", async () => {
  const { boveda } = await crearBoveda(a.boveda, RAPIDO, { conRecuperacion: false });
  assert.ok(await desbloquearConFrase(boveda, a.boveda));
  assert.equal(await desbloquearConFrase(boveda, a.acceso), null);
});
await prueba("la contraseña en sí no aparece en lo derivado", () => {
  assert.ok(!JSON.stringify(a).includes("contraseña"));
});
await prueba("secreto de sesión: solo en memoria, se puede olvidar", () => {
  guardarSecretoBoveda("x".repeat(20), true);
  assert.equal(obtenerSecretoBoveda(), "x".repeat(20));
  assert.equal(esCuentaAntigua(), true);
  olvidarSecretoBoveda();
  assert.equal(obtenerSecretoBoveda(), null);
  assert.equal(esCuentaAntigua(), false);
});
await prueba("precio: el invitado paga más; con cuenta, el precio base", () => {
  assert.equal(precioEnCoins(10, false), 10);
  assert.ok(precioEnCoins(10, true) > 10);
});
await prueba("secreto de sesión: sobrevive a una recarga (sessionStorage) y se borra al abrir la bóveda", async () => {
  const datos = new Map();
  globalThis.sessionStorage = {
    getItem: (k) => datos.get(k) ?? null,
    setItem: (k, v) => void datos.set(k, String(v)),
    removeItem: (k) => void datos.delete(k),
  };
  guardarSecretoBoveda("secreto-de-prueba-largo", false);
  const mod = await import("../lib/secretoSesion.ts?recarga");
  assert.equal(mod.obtenerSecretoBoveda(), "secreto-de-prueba-largo");
  olvidarSecretoBoveda();
  assert.equal(datos.size, 0);
  assert.equal((await import("../lib/secretoSesion.ts?otra")).obtenerSecretoBoveda(), null);
  delete globalThis.sessionStorage;
});

console.log(`\n${n} pruebas pasadas\n`);
