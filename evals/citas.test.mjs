/**
 * Pruebas del mecanismo de citas verificables (lib/citas.ts).
 *
 * Ejecutar:  node --experimental-strip-types evals/citas.test.mjs
 *
 * Son las pruebas del fallo más grave detectado en la v0.1.2: el informe
 * presentaba paráfrasis entre comillas bajo el rótulo "De la nota".
 */

import assert from "node:assert/strict";
import { numerarNota, resolverCita } from "../lib/citas.ts";

const NOTA = `M., mujer de 29 años, consulta derivada por su médico de cabecera.

Pidió ir al baño, estuvo allí unos diez minutos respirando y al volver la reunión ya había pasado a otro punto.

Duerme mal los domingos.`;

const { lineas, texto } = numerarNota(NOTA);

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

console.log("\nCitas verificables\n");

prueba("numera las líneas conservando los blancos", () => {
  assert.equal(lineas.length, 5);
  assert.ok(texto.startsWith("[L1] M., mujer de 29 años"));
  assert.ok(texto.includes("[L5] Duerme mal los domingos."));
});

prueba("resuelve un rango de una sola línea con el texto real", () => {
  const cita = resolverCita(lineas, { linea_inicio: 5, linea_fin: 5 });
  assert.equal(cita.verificada, true);
  assert.equal(cita.texto, "Duerme mal los domingos.");
  assert.equal(cita.linea_inicio, 5);
});

prueba("resuelve un rango de varias líneas", () => {
  const cita = resolverCita(lineas, { linea_inicio: 1, linea_fin: 3 });
  assert.equal(cita.verificada, true);
  assert.ok(cita.texto.includes("médico de cabecera"));
  assert.ok(cita.texto.includes("Pidió ir al baño"));
});

prueba("recorta el rango que se sale de la nota en vez de romperse", () => {
  const cita = resolverCita(lineas, { linea_inicio: 4, linea_fin: 999 });
  assert.equal(cita.verificada, true);
  assert.equal(cita.texto, "Duerme mal los domingos.");
});

prueba("rechaza una referencia ausente", () => {
  const cita = resolverCita(lineas, null);
  assert.equal(cita.verificada, false);
  assert.equal(cita.motivo, "sin_referencia");
});

prueba("rechaza un rango invertido", () => {
  const cita = resolverCita(lineas, { linea_inicio: 5, linea_fin: 2 });
  assert.equal(cita.verificada, false);
  assert.equal(cita.motivo, "rango_invalido");
});

prueba("rechaza una línea en blanco", () => {
  const cita = resolverCita(lineas, { linea_inicio: 2, linea_fin: 2 });
  assert.equal(cita.verificada, false);
  assert.equal(cita.motivo, "linea_vacia");
});

// El caso que motivó todo el cambio.
prueba("RECHAZA la paráfrasis que la v0.1.2 mostraba entre comillas", () => {
  const cita = resolverCita(lineas, "Refiere que pidió ir al baño y evitó exponer.");
  assert.equal(cita.verificada, false);
  assert.equal(cita.motivo, "no_literal");
});

prueba("acepta una cita literal antigua y le asigna su línea", () => {
  const cita = resolverCita(lineas, "Duerme mal los domingos");
  assert.equal(cita.verificada, true);
  assert.equal(cita.linea_inicio, 5);
});

prueba("acepta una cita literal con comillas alrededor", () => {
  const cita = resolverCita(lineas, '"Duerme mal los domingos."');
  assert.equal(cita.verificada, true);
});

console.log(`\n${pasadas} pruebas correctas\n`);
