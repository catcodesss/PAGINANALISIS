/**
 * Pruebas del migrador v1 → v2 (lib/identidad.ts).
 *
 * Ejecutar:  node evals/migracion.test.mjs
 *
 * QUÉ FIJAN. El invariante que más caro sale romper: **ningún análisis guardado
 * se pierde ni se degrada**. El historial es local y cifrado, no hay copia en
 * ningún servidor, y nadie puede regenerar un informe antiguo — la nota que lo
 * produjo puede no existir ya. Un migrador que pierda una conducta por el
 * camino destruye trabajo clínico de forma definitiva y silenciosa.
 *
 * Se ejecutan contra el informe REAL de la v0.1.2 guardado en fixtures/, no
 * contra un objeto inventado para la ocasión: es el que trae la copia duplicada
 * de la cadena DBT y las referencias por prosa que motivaron todo esto.
 *
 * No gastan API.
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
    "lib/validadores.ts",
    "lib/formatearInforme.ts",
    "lib/redFuncional.ts",
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
const { migrarAV2, todosLosIds, situacionDeLaCadenaDBT } = require(
  join(RAIZ, ".tmp-evals/identidad.js")
);
const { construirRedFuncional } = require(join(RAIZ, ".tmp-evals/redFuncional.js"));

const NOTA = readFileSync(join(RAIZ, "evals/casos/01-ansiedad-social.md"), "utf8")
  .split(/^##\s+NOTA\s*$/m)[1]
  .split(/^##\s+COMPROBACIONES\s*$/m)[0]
  .trim();

const { lineas } = numerarNota(NOTA);

/** El JSON v1 tal cual está en el disco, sin tocar. */
const crudoV1 = () =>
  JSON.parse(
    readFileSync(join(RAIZ, "evals/fixtures/01-v0.1.2.json"), "utf8")
  ).analisis;

let fallos = 0;
function prueba(nombre, fn) {
  try {
    fn();
    console.log(`  ok   ${nombre}`);
  } catch (error) {
    fallos += 1;
    console.log(`  FALLA ${nombre}`);
    console.log(`        ${error.message.split("\n").slice(0, 12).join("\n        ")}`);
  }
}

console.log("\nMigración v1 → v2\n");

prueba("un informe v1 se abre sin lanzar y queda marcado como v2", () => {
  const a = normalizarAnalisis(crudoV1(), lineas);
  assert.equal(a.version, 2);
  assert.ok(a.siguiente_id > 1, "siguiente_id debe quedar por encima de los asignados");
});

prueba("no se pierde ni una entidad por el camino", () => {
  const v1 = crudoV1();
  const a = normalizarAnalisis(v1, lineas);

  assert.equal(a.conductas_problema.length, v1.conductas_problema.length);
  assert.equal(a.variables_moduladoras.length, v1.variables_moduladoras.length);
  assert.equal(a.hipotesis_mantenimiento.length, v1.hipotesis_mantenimiento.length);
  assert.equal(a.conductas_alternativas.length, v1.conductas_alternativas.length);
  assert.equal(a.capa_act.reglas_verbales.length, v1.capa_act.reglas_verbales.length);
  assert.equal(
    a.capa_dbt.habilidades_sugeridas.length,
    v1.capa_dbt.habilidades_sugeridas.length
  );
  // Las situaciones pueden CRECER (una cadena DBT que no casa se convierte en
  // situación suelta) pero nunca menguar.
  assert.ok(a.situaciones.length >= v1.situaciones.length);
});

prueba("toda entidad recibe un id y ninguno se repite", () => {
  const a = normalizarAnalisis(crudoV1(), lineas);
  const ids = todosLosIds(a);
  assert.ok(ids.length > 0);
  assert.equal(new Set(ids).size, ids.length, "hay ids repetidos");
  assert.ok(
    ids.every((id) => typeof id === "string" && id.length > 0),
    "hay ids vacíos"
  );
});

prueba("la cadena DBT duplicada se funde en su situación, sin crear una suelta", () => {
  const v1 = crudoV1();
  // Premisa de la prueba: el fixture TRAE la copia. Si algún día deja de
  // traerla, esta prueba dejaría de comprobar nada sin decirlo.
  assert.ok(v1.capa_dbt.analisis_en_cadena, "el fixture ya no trae la copia");

  const a = normalizarAnalisis(v1, lineas);
  assert.equal(
    a.situaciones.length,
    v1.situaciones.length,
    "no debería haber hecho falta una situación suelta"
  );
  assert.equal(a.capa_dbt.analisis_en_cadena, undefined, "la copia sigue ahí");

  // Y la cadena que el informe enseña como «análisis en cadena» es la de una
  // situación de verdad.
  const situacion = situacionDeLaCadenaDBT(a);
  assert.ok(situacion?.cadena_dbt, "sin cadena que enseñar");
  assert.ok(situacion.cadena_dbt.eslabones.length > 0);
});

prueba("una cadena DBT que no casa con ninguna situación no se pierde", () => {
  const v1 = crudoV1();
  v1.capa_dbt.analisis_en_cadena = {
    conducta_objetivo: "Rechinar los dientes al dormir",
    vulnerabilidades: ["Bruxismo previo"],
    evento_precipitante: "Acostarse tras un día de tensión",
    eslabones: [{ tipo: "sensacion", descripcion: "Mandíbula apretada" }],
    consecuencias_corto_plazo: ["Alivio de la tensión"],
    consecuencias_largo_plazo: ["Desgaste dental"],
  };

  const a = normalizarAnalisis(v1, lineas);
  assert.equal(a.situaciones.length, v1.situaciones.length + 1);

  const suelta = a.situaciones[a.situaciones.length - 1];
  assert.match(suelta.nombre, /dientes/i);
  assert.equal(suelta.conductas_ids.length, 0, "una cadena suelta no inventa conductas");
  assert.equal(suelta.cadena_dbt.eslabones.length, 1);
  // Las dos listas de consecuencias se juntan en la descripción de CadenaDBT:
  // ninguna de las dos se queda fuera.
  assert.match(suelta.cadena_dbt.consecuencias, /Alivio de la tensión/);
  assert.match(suelta.cadena_dbt.consecuencias, /Desgaste dental/);
});

prueba("las referencias por prosa quedan resueltas a ids que existen", () => {
  const a = normalizarAnalisis(crudoV1(), lineas);
  const ids = new Set(todosLosIds(a));

  const apunta = (id) => id === null || ids.has(id);

  for (const s of a.situaciones) {
    for (const id of s.conductas_ids) {
      assert.ok(ids.has(id), `situación apunta a una conducta inexistente: ${id}`);
    }
  }
  for (const h of a.hipotesis_mantenimiento) {
    assert.ok(apunta(h.destino_id), `destino_id inválido: ${h.destino_id}`);
    assert.ok(apunta(h.origen_id), `origen_id inválido: ${h.origen_id}`);
  }
  for (const h of a.capa_dbt.habilidades_sugeridas) {
    assert.ok(apunta(h.eslabon_id), `eslabon_id inválido: ${h.eslabon_id}`);
  }
  for (const p of a.formulacion.priorizacion) {
    assert.ok(apunta(p.conducta_id), `conducta_id inválido: ${p.conducta_id}`);
  }

  // Y no es que estén todas en null: el emparejamiento tiene que resolver algo.
  assert.ok(
    a.situaciones.some((s) => s.conductas_ids.length > 0),
    "ninguna situación resolvió sus conductas"
  );
  assert.ok(
    a.hipotesis_mantenimiento.some((h) => h.destino_id !== null),
    "ninguna hipótesis resolvió su conducta"
  );
});

prueba("las habilidades DBT resuelven contra los eslabones de la situación fundida", () => {
  const a = normalizarAnalisis(crudoV1(), lineas);
  const eslabones = new Set(
    a.situaciones.flatMap((s) => (s.cadena_dbt?.eslabones ?? []).map((e) => e.id))
  );
  const resueltas = a.capa_dbt.habilidades_sugeridas.filter((h) => h.eslabon_id);
  assert.ok(
    resueltas.length > 0,
    "ninguna habilidad encontró su eslabón: la fusión rompió el vínculo"
  );
  for (const h of resueltas) {
    assert.ok(eslabones.has(h.eslabon_id), `${h.eslabon_id} no es de ninguna cadena`);
  }
});

prueba("las consecuencias quedan envueltas, conservando su texto", () => {
  const v1 = crudoV1();
  const a = normalizarAnalisis(v1, lineas);

  const original = v1.situaciones.find((s) => s.cadena_operante);
  const migrada = a.situaciones.find((s) => s.cadena_operante);
  assert.equal(
    migrada.cadena_operante.consecuencia.texto,
    original.cadena_operante.consecuencia
  );
  assert.ok(migrada.cadena_operante.consecuencia.id.length > 0);
});

prueba("migrar dos veces da exactamente lo mismo", () => {
  const una = normalizarAnalisis(crudoV1(), lineas);
  const dos = migrarAV2(JSON.parse(JSON.stringify(una)));
  assert.deepEqual(dos, una);
});

prueba("la red funcional no dibuja menos relaciones que antes", () => {
  // La prueba que demuestra que esto no es solo fontanería. Con ids, la red
  // deja de perder aristas cuando el enunciado no repite las palabras de la
  // variable — que era el fallo silencioso de la v1.
  const a = normalizarAnalisis(crudoV1(), lineas);
  const red = construirRedFuncional(a);
  const conDosExtremos = a.hipotesis_mantenimiento.filter(
    (h) => h.origen_id && h.destino_id && h.origen_id !== h.destino_id
  ).length;
  assert.equal(
    red.aristas.length,
    conDosExtremos,
    "toda hipótesis con sus dos extremos resueltos tiene que dibujarse"
  );
  assert.equal(red.sinResolver, a.hipotesis_mantenimiento.length - conDosExtremos);
});

console.log(
  fallos === 0
    ? `\n${10} pruebas correctas\n`
    : `\n${fallos} PRUEBAS FALLIDAS\n`
);
process.exit(fallos === 0 ? 0 : 1);
