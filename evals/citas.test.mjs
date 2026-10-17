/**
 * Pruebas del mecanismo de citas verificables (lib/citas.ts).
 *
 * Ejecutar:  node --experimental-strip-types evals/citas.test.mjs
 *
 * Son las pruebas del fallo más grave detectado en la v0.1.2: el informe
 * presentaba paráfrasis entre comillas bajo el rótulo "De la nota".
 */

import assert from "node:assert/strict";
import {
  citaCubreFrase,
  etiquetaCita,
  numerarNota,
  referenciaEnTexto,
  resolverCita,
  segmentarFrases,
} from "../lib/citas.ts";

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
  assert.ok(texto.startsWith("[L1] [L1.1] M., mujer de 29 años"));
  assert.ok(texto.includes("[L5] [L5.1] Duerme mal los domingos."));
  assert.ok(texto.split(String.fromCharCode(10))[1] === "[L2] ", "una línea vacía no lleva frases");
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

// ── Frases ─────────────────────────────────────────────────────────────────

prueba("segmenta por . ? ! y respeta ¿ ¡ « al inicio de la siguiente", () => {
  assert.deepEqual(
    segmentarFrases("Llegó tarde. ¿Y entonces? ¡Se fue! «Nada» dijo después."),
    ["Llegó tarde.", "¿Y entonces?", "¡Se fue!", "«Nada» dijo después."]
  );
});

prueba("no corta en iniciales", () => {
  assert.deepEqual(
    segmentarFrases("M., mujer de 29 años, consulta. J. R. la acompaña."),
    ["M., mujer de 29 años, consulta.", "J. R. la acompaña."]
  );
});

prueba("no corta en abreviaturas", () => {
  assert.deepEqual(
    segmentarFrases("Lo derivó la Dra. Pérez, p. ej. por insomnio, etc. Ana vino."),
    ["Lo derivó la Dra. Pérez, p. ej. por insomnio, etc. Ana vino."]
  );
  assert.equal(segmentarFrases("Vive en la pág. 5 del informe. Luego salió.").length, 2);
});

prueba("no corta en decimales ni ordinales", () => {
  assert.deepEqual(
    segmentarFrases("Toma 2.5 mg al día desde el 1.º de mayo. Duerme poco."),
    ["Toma 2.5 mg al día desde el 1.º de mayo.", "Duerme poco."]
  );
});

prueba("no corta dentro de comillas ni paréntesis sin cerrar", () => {
  assert.equal(
    segmentarFrases('Dijo "No puedo. Me voy" y salió. Volvió tarde.').length,
    2
  );
  assert.equal(
    segmentarFrases("Se fue (lo hizo antes. Otra vez) a casa. Ya.").length,
    2
  );
});

prueba("una línea vacía no tiene frases", () => {
  assert.deepEqual(segmentarFrases("   "), []);
});

// ── Citas por frase ────────────────────────────────────────────────────────

const NOTA_FRASES = `Primera de la línea uno. Segunda de la línea uno. Tercera de la línea uno.

Cuarta, ya en la línea tres. Quinta y última.`;
const { lineas: lf } = numerarNota(NOTA_FRASES);

prueba("resuelve una sola frase con su texto exacto", () => {
  const cita = resolverCita(lf, { linea_inicio: 1, frase_inicio: 2, linea_fin: 1, frase_fin: 2 });
  assert.equal(cita.verificada, true);
  assert.equal(cita.texto, "Segunda de la línea uno.");
  assert.equal(etiquetaCita(cita), "L1.2");
  assert.equal(referenciaEnTexto(cita), "línea 1, frase 2");
});

prueba("resuelve varias frases de una línea", () => {
  const cita = resolverCita(lf, { linea_inicio: 1, frase_inicio: 2, linea_fin: 1, frase_fin: 3 });
  assert.equal(cita.texto, "Segunda de la línea uno. Tercera de la línea uno.");
  assert.equal(etiquetaCita(cita), "L1.2–3");
});

prueba("un rango que cruza líneas recorta desde la frase de inicio hasta la de fin", () => {
  const cita = resolverCita(lf, { linea_inicio: 1, frase_inicio: 3, linea_fin: 3, frase_fin: 1 });
  assert.equal(cita.verificada, true);
  assert.equal(cita.texto, "Tercera de la línea uno. Cuarta, ya en la línea tres.");
  assert.equal(etiquetaCita(cita), "L1.3–L3.1");
});

prueba("una cita antigua sin frase sigue cubriendo la línea entera", () => {
  const cita = resolverCita(lf, { linea_inicio: 1, linea_fin: 1 });
  assert.equal(cita.verificada, true);
  assert.equal(cita.frase_inicio, undefined);
  assert.ok(cita.texto.includes("Primera") && cita.texto.includes("Tercera"));
  assert.equal(etiquetaCita(cita), "L1");
  assert.ok(citaCubreFrase(cita, 1, 3, 3));
});

prueba("una frase que no existe deja la cita sin verificar", () => {
  const cita = resolverCita(lf, { linea_inicio: 1, frase_inicio: 9, linea_fin: 1, frase_fin: 9 });
  assert.equal(cita.verificada, false);
  assert.equal(cita.motivo, "rango_invalido");
  const invertida = resolverCita(lf, { linea_inicio: 1, frase_inicio: 3, linea_fin: 1, frase_fin: 1 });
  assert.equal(invertida.verificada, false);
});

prueba("citaCubreFrase solo cubre las frases del rango", () => {
  const cita = resolverCita(lf, { linea_inicio: 1, frase_inicio: 2, linea_fin: 1, frase_fin: 2 });
  assert.equal(citaCubreFrase(cita, 1, 1, 3), false);
  assert.equal(citaCubreFrase(cita, 1, 2, 3), true);
  assert.equal(citaCubreFrase(cita, 1, 3, 3), false);
  assert.equal(citaCubreFrase(cita, 3, 1, 2), false);
});

console.log(`\n${pasadas} pruebas correctas\n`);
