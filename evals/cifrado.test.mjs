/**
 * Pruebas del cifrado del historial local (lib/cifrado.ts).
 *
 * Ejecutar:  node --experimental-strip-types evals/cifrado.test.mjs
 *
 * Node trae WebCrypto, así que estas pruebas corren sin navegador. La capa de
 * IndexedDB (lib/repositorio.ts) no se puede probar aquí: necesita navegador.
 */

import assert from "node:assert/strict";
import {
  cifrar,
  crearTestigo,
  derivarClave,
  descifrar,
  generarSal,
  nuevoId,
  verificarTestigo,
} from "../lib/cifrado.ts";

let pasadas = 0;
async function prueba(nombre, fn) {
  try {
    await fn();
    pasadas += 1;
    console.log(`  ok   ${nombre}`);
  } catch (e) {
    console.error(`  FALLA ${nombre}\n        ${e.message}`);
    process.exitCode = 1;
  }
}

const NOTA =
  "M., mujer de 29 años. Pidió ir al baño y estuvo allí respirando. Duerme mal los domingos.";

console.log("\nCifrado del historial local\n");

const sal = generarSal();
const clave = await derivarClave("contraseña larga del clínico", sal);

await prueba("ida y vuelta: lo cifrado se recupera intacto", async () => {
  const sobre = await cifrar(clave, NOTA);
  assert.equal(await descifrar(clave, sobre), NOTA);
});

await prueba("el texto original no aparece en el sobre cifrado", async () => {
  const sobre = await cifrar(clave, NOTA);
  const bytes = Buffer.from(sobre.datos).toString("utf8");
  assert.ok(!bytes.includes("respirando"), "el contenido se ve en claro");
  assert.ok(!bytes.includes("domingos"));
});

await prueba("dos cifrados del mismo texto son distintos (IV aleatorio)", async () => {
  const a = await cifrar(clave, NOTA);
  const b = await cifrar(clave, NOTA);
  assert.notDeepEqual(a.datos, b.datos, "sin IV único se filtra que son iguales");
  assert.notDeepEqual(a.iv, b.iv);
});

await prueba("una contraseña incorrecta devuelve null, no lanza", async () => {
  const sobre = await cifrar(clave, NOTA);
  const otra = await derivarClave("contraseña equivocada", sal);
  assert.equal(await descifrar(otra, sobre), null);
});

await prueba("la misma contraseña con otra sal no abre el sobre", async () => {
  const sobre = await cifrar(clave, NOTA);
  const conOtraSal = await derivarClave("contraseña larga del clínico", generarSal());
  assert.equal(await descifrar(conOtraSal, sobre), null);
});

await prueba("un sobre manipulado no se descifra (AES-GCM verifica integridad)", async () => {
  const sobre = await cifrar(clave, NOTA);
  sobre.datos[5] = (sobre.datos[5] + 1) % 256;
  assert.equal(await descifrar(clave, sobre), null);
});

await prueba("el testigo valida la contraseña correcta", async () => {
  const testigo = await crearTestigo(clave);
  assert.equal(await verificarTestigo(clave, testigo), true);
});

await prueba("el testigo rechaza la contraseña incorrecta", async () => {
  const testigo = await crearTestigo(clave);
  const otra = await derivarClave("otra distinta", sal);
  assert.equal(await verificarTestigo(otra, testigo), false);
});

await prueba("los identificadores no se repiten", () => {
  const ids = new Set(Array.from({ length: 500 }, nuevoId));
  assert.equal(ids.size, 500);
});

await prueba("un análisis completo cabe y vuelve igual", async () => {
  const entrada = {
    referencia: "Caso 12",
    nota: NOTA,
    analisis: { conductas_problema: [{ descripcion: "Evita exponer" }], alertas: [] },
  };
  const sobre = await cifrar(clave, JSON.stringify(entrada));
  assert.deepEqual(JSON.parse(await descifrar(clave, sobre)), entrada);
});

console.log(`\n${pasadas} pruebas correctas\n`);
