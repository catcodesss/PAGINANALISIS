/**
 * Pruebas del enmascarado de datos identificables (lib/pii.ts).
 *
 * Ejecutar:  node --experimental-strip-types evals/pii.test.mjs
 *
 * Incluyen los falsos positivos que hay que evitar: si el enmascarado destroza
 * el texto clínico, el clínico lo desactiva y no protege a nadie.
 */

import assert from "node:assert/strict";
import {
  contieneDatosIdentificables,
  enmascararDatosIdentificables,
} from "../lib/pii.ts";

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

const tapa = (texto, fragmento) => {
  const salida = enmascararDatosIdentificables(texto);
  assert.ok(
    !salida.includes(fragmento),
    `no tapó "${fragmento}" — resultado: ${salida}`
  );
  assert.ok(contieneDatosIdentificables(texto), "no lo detectó como identificable");
  return salida;
};

console.log("\nEnmascarado de datos identificables\n");

prueba("correo electrónico", () => {
  tapa("Escribe a marta.lopez@gmail.com para las citas.", "marta.lopez@gmail.com");
});

prueba("teléfono", () => {
  tapa("Su teléfono es 612 345 678.", "612 345 678");
});

prueba("documento de identidad", () => {
  tapa("DNI 12345678Z en la ficha.", "12345678");
});

prueba("dirección postal", () => {
  tapa("Vive en Calle Mayor 14, cerca del centro.", "Calle Mayor 14");
});

prueba("nombre propio tras un marcador de persona", () => {
  const salida = tapa("Su pareja Marta llama por ella.", "Marta");
  assert.ok(salida.includes("Su pareja"), "debería conservar el marcador");
});

prueba("nombre de empresa", () => {
  tapa("Trabaja en Textiles Robledo desde hace tres años.", "Textiles Robledo");
});

prueba("matrícula", () => {
  tapa("Evita conducir; el coche 1234 ABC lleva meses parado.", "1234 ABC");
});

// --- Falsos positivos: lo que NO debe tocar ---

prueba("no toca terminología clínica capitalizada", () => {
  const texto =
    "Ante el Ed de exposición social emite evitación, mantenida por R−. Aplica DBT.";
  assert.equal(enmascararDatosIdentificables(texto), texto);
  assert.equal(contieneDatosIdentificables(texto), false);
});

prueba("no toca cifras clínicas normales", () => {
  const texto = "Duerme 5 horas. Bebe 2 o 3 copas. Lleva 8 meses así.";
  assert.equal(enmascararDatosIdentificables(texto), texto);
});

prueba("no toca el inicio de frase capitalizado", () => {
  const texto = "Refiere malestar. Comenta que le cuesta dormir.";
  assert.equal(enmascararDatosIdentificables(texto), texto);
});

prueba("una nota con iniciales pasa intacta", () => {
  const texto =
    "M., mujer de 29 años, consulta por episodios de ansiedad. Duerme mal los domingos.";
  assert.equal(enmascararDatosIdentificables(texto), texto);
  assert.equal(contieneDatosIdentificables(texto), false);
});

console.log(`\n${pasadas} pruebas correctas\n`);
