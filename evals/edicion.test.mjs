/**
 * Edición del Mapa (fase 5C): convertir en pregunta, citas del clínico desde
 * la Fuente, frases sin usar convertidas en elementos y reclasificación por
 * carril. Lógica pura de lib/edicionMapa.ts, sobre el informe guardado del
 * caso 01.
 *
 * Ejecutar:  node evals/edicion.test.mjs
 *
 * No gasta API.
 */

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = join(AQUI, "..");

execFileSync(
  process.execPath,
  [
    join(RAIZ, "node_modules/typescript/bin/tsc"),
    "lib/edicionMapa.ts",
    "lib/parseAnalisis.ts",
    "lib/procedencia.ts",
    "lib/formatearInforme.ts",
    "lib/coberturaNota.ts",
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
const { construirNodosGrafo, agregarArista, borrarNodo, numeroDeApoyoArista } = require(join(RAIZ, ".tmp-evals/grafo.js"));
const { calcularApoyoAristas } = require(join(RAIZ, ".tmp-evals/apoyoAristas.js"));
const { formatearInformeTexto } = require(join(RAIZ, ".tmp-evals/formatearInforme.js"));
const { calcularCoberturaNota } = require(join(RAIZ, ".tmp-evals/coberturaNota.js"));
const { segmentarFrases } = require(join(RAIZ, ".tmp-evals/citas.js"));
const { procedenciaDe } = require(join(RAIZ, ".tmp-evals/procedencia.js"));
const edicion = require(join(RAIZ, ".tmp-evals/edicionMapa.js"));

const NOTA = readFileSync(join(RAIZ, "evals/casos/01-ansiedad-social.md"), "utf8")
  .split(/^##\s+NOTA\s*$/m)[1]
  .split(/^##\s+COMPROBACIONES\s*$/m)[0]
  .trim();
const { lineas } = numerarNota(NOTA);
const informe = () =>
  normalizarAnalisis(
    JSON.parse(readFileSync(join(RAIZ, "evals/fixtures/01-v0.1.2.json"), "utf8")).analisis,
    lineas
  );

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

console.log("\nEdición del Mapa\n");

/* ── Convertir en pregunta ───────────────────────────────────────────────── */

prueba("convertir un nodo en pregunta crea una pregunta abierta tuya y lo quita", () => {
  const a = informe();
  const om = construirNodosGrafo(a).find((n) => n.tipo === "om");
  const antes = a.preguntas.length;
  const id = edicion.convertirEnPregunta(a, om.id);
  assert.ok(id);
  assert.equal(a.preguntas.length, antes + 1);
  const p = a.preguntas.find((x) => x.id === id);
  assert.equal(p.origen, "clinico");
  assert.equal(p.estado, "abierta");
  assert.equal(p.dato_faltante, om.etiqueta);
  assert.ok(!construirNodosGrafo(a).some((n) => n.id === om.id), "el nodo sigue en el Mapa");
});

prueba("la pregunta pone a prueba la hipótesis que pasaba por el nodo", () => {
  const a = informe();
  const h = a.hipotesis_mantenimiento.find((x) => x.origen_id);
  const id = edicion.convertirEnPregunta(a, h.origen_id);
  assert.equal(a.preguntas.find((x) => x.id === id).pone_a_prueba, h.id);
});

prueba("convertir algo que no es un nodo no hace nada", () => {
  const a = informe();
  const antes = JSON.stringify(a);
  assert.equal(edicion.convertirEnPregunta(a, "no_existe"), null);
  assert.equal(JSON.stringify(a), antes);
});

prueba("la procedencia de un nodo sin tocar es propuesta de la IA", () => {
  // Es lo que el Mapa pinta con borde discontinuo y «IA».
  const a = informe();
  const n = construirNodosGrafo(a)[0];
  assert.equal(procedenciaDe(a, n.id).estado, "propuesta");
});

/* ── Citas del clínico (esquema v7) ──────────────────────────────────────── */

/** La primera frase de la nota con al menos cuatro palabras que nada cita. */
function fraseSinUsar(a) {
  const cobertura = calcularCoberturaNota(lineas, a);
  return cobertura.sinUsar[0];
}

prueba("la cita de una frase sale de la nota, por su posición", () => {
  const c = edicion.citaDeFrase(lineas, 3, 2);
  assert.equal(c.verificada, true);
  assert.equal(c.texto, segmentarFrases(lineas[2])[1].trim());
  assert.deepEqual([c.linea_inicio, c.linea_fin, c.frase_inicio, c.frase_fin], [3, 3, 2, 2]);
  assert.equal(edicion.citaDeFrase(lineas, 3, 99), null);
  assert.equal(edicion.citaDeFrase(lineas, 999, 1), null);
});

prueba("citar un nodo sin campo de cita (la OM) sube su apoyo y no cambia su procedencia", () => {
  const a = informe();
  const om = construirNodosGrafo(a).find((n) => n.tipo === "om");
  assert.equal(om.apoyo, 1);
  assert.ok(edicion.citarEnElemento(a, om.id, edicion.citaDeFrase(lineas, 3, 2)));
  const despues = construirNodosGrafo(a).find((n) => n.id === om.id);
  assert.ok(despues.apoyo >= 2, `apoyo ${despues.apoyo}`);
  assert.equal(despues.citas_clinico.length, 1);
  // Lo que dijo la IA sigue siendo de la IA: la cita va aparte.
  assert.equal(despues.evidencia, null);
  assert.equal(procedenciaDe(a, om.id).estado, "propuesta");
});

prueba("la misma frase no se une dos veces al mismo elemento", () => {
  const a = informe();
  const om = construirNodosGrafo(a).find((n) => n.tipo === "om");
  const c = edicion.citaDeFrase(lineas, 3, 2);
  assert.ok(edicion.citarEnElemento(a, om.id, c));
  assert.equal(edicion.citarEnElemento(a, om.id, { ...c }), false);
  assert.equal(a.citas_del_clinico[om.id].length, 1);
});

prueba("solo se cita en nodos y relaciones que existen", () => {
  const a = informe();
  assert.equal(edicion.citarEnElemento(a, "no_existe", edicion.citaDeFrase(lineas, 3, 2)), false);
  assert.deepEqual(a.citas_del_clinico, {});
});

prueba("citar una relación sube su techo a textual, con el tope de sus extremos, y su evidencia sigue siendo del modelo", () => {
  const a = informe();
  const inferida = a.aristas.find((x) => x.apoyo === "inferido");
  const nodos = new Map(construirNodosGrafo(a).map((n) => [n.id, n]));
  // Una frase que ninguna cita del modelo usa: si apareciera en `evidencia`,
  // sería porque la del clínico se coló ahí.
  const f = fraseSinUsar(a);
  const c = edicion.citaDeFrase(lineas, f.linea, f.frase);
  edicion.citarEnElemento(a, inferida.id, c);
  calcularApoyoAristas(a);
  const despues = a.aristas.find((x) => x.id === inferida.id);
  const tope = Math.min(nodos.get(despues.desde).apoyo, nodos.get(despues.hasta).apoyo);
  assert.equal(numeroDeApoyoArista(despues.apoyo), tope);
  assert.ok(!JSON.stringify(despues.evidencia).includes(c.texto), "la cita del clínico entró en la evidencia del modelo");
});

prueba("una relación tuya deja de ser inferida forzosa en cuanto tiene cita", () => {
  const a = informe();
  const nodos = construirNodosGrafo(a).filter((n) => n.apoyo >= 2);
  const [x, y] = [nodos[0], nodos.find((n) => n.id !== nodos[0].id && !a.aristas.some((r) => r.desde === nodos[0].id && r.hasta === n.id))];
  agregarArista(a, x.id, y.id);
  const nueva = a.aristas[a.aristas.length - 1];
  calcularApoyoAristas(a);
  assert.equal(a.aristas.find((r) => r.id === nueva.id).apoyo, "inferido");
  edicion.citarEnElemento(a, nueva.id, edicion.citaDeFrase(lineas, 3, 2));
  calcularApoyoAristas(a);
  assert.notEqual(a.aristas.find((r) => r.id === nueva.id).apoyo, "inferido");
  assert.equal(procedenciaDe(a, nueva.id).estado, "creado");
});

prueba("quitar una cita tuya la retira, y sin citas desaparece la entrada", () => {
  const a = informe();
  const om = construirNodosGrafo(a).find((n) => n.tipo === "om");
  edicion.citarEnElemento(a, om.id, edicion.citaDeFrase(lineas, 3, 2));
  edicion.citarEnElemento(a, om.id, edicion.citaDeFrase(lineas, 3, 1));
  edicion.quitarCitaDelClinico(a, om.id, 0);
  assert.equal(a.citas_del_clinico[om.id].length, 1);
  assert.equal(a.citas_del_clinico[om.id][0].frase_inicio, 1);
  edicion.quitarCitaDelClinico(a, om.id, 0);
  assert.ok(!(om.id in a.citas_del_clinico));
});

prueba("borrar un nodo borra sus citas tuyas", () => {
  const a = informe();
  const om = construirNodosGrafo(a).find((n) => n.tipo === "om");
  edicion.citarEnElemento(a, om.id, edicion.citaDeFrase(lineas, 3, 2));
  borrarNodo(a, om.id);
  assert.ok(!(om.id in a.citas_del_clinico));
});

prueba("convertir una frase sin usar: elemento tuyo, con la frase como texto y como cita", () => {
  for (const tipo of ["conducta", "acomodacion", "valor", "moduladora"]) {
    const a = informe();
    const f = fraseSinUsar(a);
    const c = edicion.citaDeFrase(lineas, f.linea, f.frase);
    const antes = calcularCoberturaNota(lineas, a).usadas;
    const situacion = tipo === "conducta" ? a.situaciones[0].id : null;
    const id = edicion.convertirFrase(a, c, tipo, situacion);
    assert.equal(procedenciaDe(a, id).estado, "creado", tipo);
    assert.deepEqual(a.citas_del_clinico[id], [c], tipo);
    assert.equal(calcularCoberturaNota(lineas, a).usadas, antes + 1, `${tipo}: la frase sigue sin usar`);
    if (tipo === "conducta") {
      assert.ok(a.situaciones[0].conductas_ids.includes(id));
      assert.equal(a.conductas_problema.find((x) => x.id === id).evidencia.verificada, false, "la cita no va al campo del modelo");
    }
    if (tipo === "valor") assert.equal(a.valores_y_metas[a.valores_y_metas.length - 1], c.texto);
  }
});

prueba("una conducta convertida sin situación queda fuera del grafo, a la vista en el raíl", () => {
  const a = informe();
  const f = fraseSinUsar(a);
  const id = edicion.convertirFrase(a, edicion.citaDeFrase(lineas, f.linea, f.frase), "conducta", null);
  assert.ok(a.conductas_problema.some((x) => x.id === id));
  assert.ok(!a.situaciones.some((s) => s.conductas_ids.includes(id)));
});

prueba("borrar un valor corre las citas de los de detrás", () => {
  const a = informe();
  const f = fraseSinUsar(a);
  const c = edicion.citaDeFrase(lineas, f.linea, f.frase);
  a.valores_y_metas = ["Uno", "Dos"];
  a.citas_del_clinico = { valor_2: [c] };
  borrarNodo(a, "valor_1");
  assert.deepEqual(a.citas_del_clinico, { valor_1: [c] });
  assert.deepEqual(a.valores_y_metas, ["Dos"]);
});

prueba("la exportación lleva las citas tuyas en su apartado, marcadas; sin ellas no hay apartado", () => {
  const a = informe();
  assert.ok(!formatearInformeTexto(a, "CASO", "hoy").includes("CITAS AÑADIDAS POR EL PROFESIONAL"));
  const om = construirNodosGrafo(a).find((n) => n.tipo === "om");
  const c = edicion.citaDeFrase(lineas, 3, 2);
  edicion.citarEnElemento(a, om.id, c);
  const texto = formatearInformeTexto(a, "CASO", "hoy");
  assert.ok(texto.includes("CITAS AÑADIDAS POR EL PROFESIONAL"));
  assert.ok(texto.includes(`De la nota (cita añadida por el profesional): "${c.texto}"`));
  assert.ok(texto.includes(`Operación motivadora: ${om.etiqueta}`));
});

console.log(`\n${pasadas} pruebas correctas\n`);
