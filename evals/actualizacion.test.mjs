/**
 * Pruebas de la actualización por sesión (lib/actualizacion.ts), fase 8.
 *
 * Ejecutar:  node evals/actualizacion.test.mjs        (--refs imprime la formulación compacta)
 *
 * Fijan el invariante 1 generalizado y la regla «nada se aplica sin el
 * clínico», con el informe real del caso 01 y operaciones simuladas del
 * modelo. No gastan API.
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
    "lib/actualizacion.ts",
    "lib/apoyoAristas.ts",
    "lib/validadores.ts",
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
const { migrarAV9 } = require(join(RAIZ, ".tmp-evals/identidad.js"));
const A = require(join(RAIZ, ".tmp-evals/actualizacion.js"));
const { calcularApoyoAristas } = require(join(RAIZ, ".tmp-evals/apoyoAristas.js"));
const { validarAnalisis } = require(join(RAIZ, ".tmp-evals/validadores.js"));

const leerCaso = (f) => readFileSync(join(RAIZ, "evals/casos", f), "utf8");
const seccion = (texto, nombre) =>
  (texto.split(new RegExp(`^##\\s+${nombre}\\s*$`, "m"))[1] ?? "").split(/^##\s+/m)[0].trim();

const NOTA1 = seccion(leerCaso("01-ansiedad-social.md"), "NOTA");
const NOTA2 = seccion(leerCaso("10-sesion2-registro.md"), "NOTA SESIÓN 2");
const analisis01 = () => {
  const a = migrarAV9(
    normalizarAnalisis(
      JSON.parse(readFileSync(join(RAIZ, "evals/fixtures/01-v0.1.2.json"), "utf8")).analisis,
      numerarNota(NOTA1).lineas
    )
  );
  calcularApoyoAristas(a);
  return a;
};

if (process.argv.includes("--refs")) {
  console.log(A.construirReferencias(analisis01()).texto);
  console.log("\n" + numerarNota(NOTA2).texto);
  process.exit(0);
}

let fallos = 0;
let pasadas = 0;
function prueba(nombre, fn) {
  try {
    fn();
    pasadas += 1;
    console.log(`  ok   ${nombre}`);
  } catch (error) {
    fallos += 1;
    console.log(`  FALLA ${nombre}`);
    console.log(`        ${error.message.split("\n").slice(0, 8).join("\n        ")}`);
  }
}

/** Lo que hace el servidor con la respuesta del modelo. */
function proponer(analisis, crudo, nota = NOTA2) {
  const mapa = A.construirReferencias(analisis);
  const { lineas } = numerarNota(nota);
  return { mapa, ...A.normalizarOperaciones(crudo, analisis, mapa, lineas) };
}

const refDe = (mapa, tipo, n = 1) => [...mapa.porRef.values()].filter((o) => o.tipo === tipo)[n - 1];

console.log("\nActualización por sesión\n");

prueba("una referencia inventada se descarta, se cuenta y no llega al cliente", () => {
  const a = analisis01();
  const r = proponer(a, {
    operaciones: [
      { op: "añadir_evidencia", ref: "H99", frases: ["L1.1"], postura: "a_favor", justificacion: "x" },
      { op: "proponer_estado", ref: "Q1", estado: "sostenida", frases: ["L1.1"], justificacion: "x" },
    ],
  });
  assert.equal(r.propuestas.length, 0);
  assert.equal(r.descartadas.referencia_inexistente, 2);
  assert.ok(!JSON.stringify(r.propuestas).includes("H99"));
});

prueba("sin frase verificable no hay propuesta: ni frase inventada ni texto pegado", () => {
  const a = analisis01();
  const h = refDe(A.construirReferencias(a), "hipotesis").ref;
  const r = proponer(a, {
    operaciones: [
      { op: "añadir_evidencia", ref: h, frases: ["L999.1"], postura: "a_favor" },
      { op: "añadir_evidencia", ref: h, frases: ["pidió ir al baño"], postura: "a_favor" },
      { op: "añadir_evidencia", ref: h, frases: [], postura: "a_favor" },
      { op: "añadir_evidencia", ref: h, frases: ["L1.1", "L999"], postura: "a_favor" },
    ],
  });
  assert.equal(r.propuestas.length, 0);
  assert.equal(r.descartadas.sin_frase, 4);
});

prueba("ningún razonamiento del modelo sale en las propuestas", () => {
  const a = analisis01();
  const h = refDe(A.construirReferencias(a), "hipotesis").ref;
  const r = proponer(a, {
    razonamiento_previo: "BORRADOR-SECRETO de la persona",
    operaciones: [{ op: "añadir_evidencia", ref: h, frases: ["L1.1"], postura: "a_favor", justificacion: "ok", razonamiento: "BORRADOR-SECRETO" }],
  });
  assert.equal(r.propuestas.length, 1);
  assert.ok(!JSON.stringify(r).includes("BORRADOR-SECRETO"));
});

prueba("la justificación no puede entrecomillar texto como si fuera de la nota", () => {
  assert.equal(A.limpiarJustificacion('Dice «me fui al baño» otra vez'), "Dice … otra vez");
});

prueba("un elemento confirmado no cambia sin aceptación explícita", () => {
  const a = analisis01();
  const mapa = A.construirReferencias(a);
  const h = refDe(mapa, "hipotesis");
  a.procedencia[h.id] = { estado: "confirmado" };
  const r = proponer(a, {
    operaciones: [{ op: "modificar", ref: h.ref, campo: "funcion", valor: "Escape de la exposición en grupos grandes", frases: ["L1.1"], justificacion: "x" }],
  });
  assert.equal(r.propuestas.length, 1);
  assert.equal(r.propuestas[0].toca_confirmado, true);
  const antes = JSON.stringify(a.hipotesis_mantenimiento);
  const sinAceptar = structuredClone(a);
  A.aplicarPropuestas(sinAceptar, [], 2);
  assert.equal(JSON.stringify(sinAceptar.hipotesis_mantenimiento), antes);
  const aceptado = structuredClone(a);
  A.aplicarPropuestas(aceptado, [{ propuesta: r.propuestas[0] }], 2);
  assert.equal(aceptado.hipotesis_mantenimiento.find((x) => x.id === h.id).funcion, "Escape de la exposición en grupos grandes");
});

prueba("lo editado por el clínico queda como suyo; lo aceptado tal cual, de la IA", () => {
  const a = analisis01();
  const c = refDe(A.construirReferencias(a), "conducta");
  const r = proponer(a, {
    operaciones: [{ op: "crear", tipo: "conducta", contenido: { descripcion: "Evita llamar al seguro", misma_clase_que: c.ref }, frases: ["L1.1"], justificacion: "x" }],
  });
  const tal = structuredClone(a);
  A.aplicarPropuestas(tal, [{ propuesta: r.propuestas[0] }], 2);
  const nueva = tal.conductas_problema.at(-1);
  assert.equal(nueva.descripcion, "Evita llamar al seguro");
  assert.equal(tal.seguimiento.evidencia[nueva.id][0].autor, "ia");
  assert.ok(!tal.procedencia[nueva.id], "propuesta de la IA");
  assert.ok(tal.blancos.some((b) => b.conducta_ids.includes(c.id) && b.conducta_ids.includes(nueva.id)), "entra en el blanco de su clase");
  const editado = structuredClone(a);
  A.aplicarPropuestas(editado, [{ propuesta: r.propuestas[0], valorEditado: "No llama a la aseguradora" }], 2);
  const suya = editado.conductas_problema.at(-1);
  assert.equal(editado.procedencia[suya.id].estado, "creado");
  assert.equal(editado.seguimiento.evidencia[suya.id][0].autor, "clinico");
});

prueba("un cambio de hipótesis avisa en sus blancos hasta que el clínico los toca", () => {
  const a = analisis01();
  const mapa = A.construirReferencias(a);
  const b = a.blancos.find((x) => x.hipotesis_id);
  assert.ok(b, "el caso 01 tiene un blanco con hipótesis");
  const h = mapa.porId.get(b.hipotesis_id);
  const r = proponer(a, { operaciones: [{ op: "proponer_estado", ref: h, estado: "sostenida", frases: ["L1.1"], justificacion: "x" }] });
  const despues = structuredClone(a);
  A.aplicarPropuestas(despues, r.propuestas.map((propuesta) => ({ propuesta })), 2);
  assert.equal(despues.seguimiento.blancos_a_revisar[b.id], 2);
  assert.ok(validarAnalisis(structuredClone(despues), "").alertas.some((x) => x.codigo === "hipotesis_cambiada"));
  const tocado = structuredClone(despues);
  tocado.blancos.find((x) => x.id === b.id).mecanismo = "Revisado";
  A.limpiarBlancosRevisados(despues, tocado);
  assert.equal(tocado.seguimiento.blancos_a_revisar[b.id], undefined);
});

prueba("evidencia en contra aceptada marca ⊘ la relación y baja su apoyo", () => {
  const a = analisis01();
  const mapa = A.construirReferencias(a);
  const arista = a.aristas.find((x) => a.hipotesis_mantenimiento.some((h) => h.origen_id === x.desde && h.destino_id === x.hasta));
  assert.ok(arista);
  const h = a.hipotesis_mantenimiento.find((x) => x.origen_id === arista.desde && x.destino_id === arista.hasta);
  const r = proponer(a, { operaciones: [{ op: "marcar_contradiccion", ref: mapa.porId.get(h.id), frases: ["L1.1"], justificacion: "x" }] });
  const d = structuredClone(a);
  A.aplicarPropuestas(d, [{ propuesta: r.propuestas[0] }], 2);
  calcularApoyoAristas(d);
  const tras = d.aristas.find((x) => x.id === arista.id);
  assert.equal(tras.contradicha, true);
  assert.equal(tras.apoyo, "inferido");
  calcularApoyoAristas(a);
  assert.ok(!a.aristas.find((x) => x.id === arista.id).contradicha);
});

prueba("un estado igual al actual o un campo no editable se descartan", () => {
  const a = analisis01();
  const mapa = A.construirReferencias(a);
  const h = refDe(mapa, "hipotesis");
  const actual = a.hipotesis_mantenimiento.find((x) => x.id === h.id).estado;
  const r = proponer(a, {
    operaciones: [
      { op: "proponer_estado", ref: h.ref, estado: actual, frases: ["L1.1"] },
      { op: "modificar", ref: h.ref, campo: "confianza", valor: "alta", frases: ["L1.1"] },
    ],
  });
  assert.equal(r.propuestas.length, 0);
  assert.equal(r.descartadas.estado_invalido, 1);
  assert.equal(r.descartadas.campo_no_editable, 1);
});

prueba("el fixture de maqueta de la sesión 2 resuelve entero contra el caso 01", () => {
  const a = analisis01();
  const crudo = JSON.parse(readFileSync(join(RAIZ, "evals/fixtures/01-sesion2-operaciones.json"), "utf8"));
  const r = proponer(a, crudo);
  assert.deepEqual(r.descartadas, {});
  assert.equal(r.propuestas.length, crudo.operaciones.length);
});

// Tokens de entrada a lo largo de siete sesiones simuladas (≈ caracteres / 4).
{
  let a = analisis01();
  const prompt = readFileSync(join(RAIZ, "lib/promptActualizacion.ts"), "utf8").length;
  const nota = numerarNota(NOTA2).texto.length;
  const medidas = [];
  for (let s = 2; s <= 8; s++) {
    const mapa = A.construirReferencias(a);
    medidas.push(Math.round((mapa.texto.length + nota + prompt) / 4));
    const h = refDe(mapa, "hipotesis").ref;
    const c = refDe(mapa, "conducta").ref;
    const { propuestas } = proponer(a, {
      operaciones: [
        { op: "añadir_evidencia", ref: h, frases: ["L1.1"], postura: "a_favor" },
        { op: "crear", tipo: "conducta", contenido: { descripcion: `Conducta nueva ${s}`, misma_clase_que: c }, frases: ["L1.1"] },
        { op: "nueva_pregunta", texto: `Pregunta ${s}`, frases: ["L1.1"] },
      ],
    });
    A.aplicarPropuestas(a, propuestas.map((propuesta) => ({ propuesta })), s);
  }
  console.log(`\n  medida: tokens de entrada (≈) sesión 2→8: ${medidas.join(" · ")}`);
}

console.log(fallos === 0 ? `\n${pasadas} pruebas correctas\n` : `\n${fallos} PRUEBAS FALLIDAS\n`);
process.exit(fallos === 0 ? 0 : 1);
