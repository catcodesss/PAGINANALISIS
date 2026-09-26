/**
 * Pruebas del Plan por blanco (lib/plan.ts).
 *
 * Ejecutar:  node evals/plan.test.mjs
 *
 * QUÉ FIJAN. Reorganizar el Plan en tarjetas no puede costar contenido ni
 * esconder avisos. Tres cosas que, si se rompen, no dan ningún error visible:
 *
 * - Una conducta problema sin tarjeta, o una alternativa que no sale en
 *   ninguna parte (o que sale dos veces, con dos textos que nada iguala).
 * - Un aviso del validador sobre una propuesta que la tarjeta no enseña: la
 *   propuesta se leería como recomendación normal. Es lo que motivó mover los
 *   avisos dentro de la tarjeta; aquí se comprueba que llegan, también al
 *   texto copiado y al Word.
 * - Un informe guardado antes de los estados que no se abre, o un estado
 *   inválido en el historial que rompe la tarjeta.
 *
 * Se ejecutan contra el informe REAL de la v0.1.2 (el de la maqueta), que
 * trae el caso de la respiración como conducta de seguridad prescrita.
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
    "lib/plan.ts",
    "lib/formaPlan.ts",
    "lib/formatearInforme.ts",
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
const { migrarAV2 } = require(join(RAIZ, ".tmp-evals/identidad.js"));
const { validarAnalisis } = require(join(RAIZ, ".tmp-evals/validadores.js"));
const {
  construirPlanPorBlanco,
  datosFaltantesDe,
  estadoDeBlanco,
} = require(join(RAIZ, ".tmp-evals/plan.js"));
const { formatearInformeTexto } = require(join(RAIZ, ".tmp-evals/formatearInforme.js"));

const NOTA = readFileSync(join(RAIZ, "evals/casos/01-ansiedad-social.md"), "utf8")
  .split(/^##\s+NOTA\s*$/m)[1]
  .split(/^##\s+COMPROBACIONES\s*$/m)[0]
  .trim();
const { lineas } = numerarNota(NOTA);

const crudo = () =>
  JSON.parse(readFileSync(join(RAIZ, "evals/fixtures/01-v0.1.2.json"), "utf8")).analisis;
const informe = () => validarAnalisis(normalizarAnalisis(crudo(), lineas), NOTA);

/** Solo el apartado del plan del texto exportado. */
function textoDelPlan(a) {
  const texto = formatearInformeTexto(a, "caso", "hoy");
  const desde = texto.indexOf("PLAN POR BLANCO");
  const hasta = texto.indexOf("MONITORIZACIÓN DEL CASO");
  assert.ok(desde !== -1, "el texto exportado no trae el plan por blanco");
  return texto.slice(desde, hasta === -1 ? undefined : hasta);
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
    console.log(`        ${error.message.split("\n").slice(0, 12).join("\n        ")}`);
  }
}

console.log("\nPlan por blanco\n");

prueba("cada conducta problema tiene exactamente una tarjeta", () => {
  const a = informe();
  const plan = construirPlanPorBlanco(a);
  const ids = plan.tarjetas.map((t) => t.conducta.id);
  assert.equal(new Set(ids).size, ids.length, "hay una conducta con dos tarjetas");
  assert.deepEqual([...ids].sort(), a.conductas_problema.map((c) => c.id).sort());
});

prueba("cada conducta alternativa sale una vez: en una tarjeta o sin blanco", () => {
  const a = informe();
  const plan = construirPlanPorBlanco(a);
  const indices = [
    ...plan.tarjetas.flatMap((t) => t.alternativas.map((x) => x.indice)),
    ...plan.alternativasSinBlanco.map((x) => x.indice),
  ];
  assert.deepEqual(
    [...indices].sort(),
    a.conductas_alternativas.map((_, i) => i),
    "se pierde o se repite una conducta alternativa"
  );
});

prueba("en el caso 01 las alternativas se enlazan por id, no quedan sueltas", () => {
  const plan = construirPlanPorBlanco(informe());
  assert.equal(plan.alternativasSinBlanco.length, 0);
});

prueba("las tarjetas priorizadas van primero y en el orden de la priorización", () => {
  const a = informe();
  const plan = construirPlanPorBlanco(a);
  const priorizadas = a.formulacion.priorizacion.filter((p) => p.conducta_id);
  priorizadas.forEach((p, i) => {
    assert.equal(plan.tarjetas[i].conducta.id, p.conducta_id);
    assert.equal(plan.tarjetas[i].prioridad, i + 1);
  });
});

prueba("una conducta de seguridad nunca recibe conducta alternativa", () => {
  const a = informe();
  // Se marca como de seguridad la conducta de la situación que trae una
  // alternativa: la alternativa tiene que irse a otra conducta o quedar suelta.
  const conAlternativa = construirPlanPorBlanco(a).tarjetas.find((t) => t.alternativas.length > 0);
  conAlternativa.conducta.es_conducta_seguridad = true;
  const plan = construirPlanPorBlanco(a);
  for (const t of plan.tarjetas) {
    if (t.conducta.es_conducta_seguridad) assert.equal(t.alternativas.length, 0);
  }
});

prueba("el aviso de conducta de seguridad prescrita aparece en su tarjeta", () => {
  const a = informe();
  const plan = construirPlanPorBlanco(a);
  const respiracion = plan.tarjetas
    .flatMap((t) => t.alternativas)
    .find((x) => /respiraci/i.test(x.alternativa.conducta_propuesta));
  assert.ok(respiracion, "el fixture debería traer la alternativa con respiración");
  assert.ok(
    respiracion.alertas.some((al) => al.codigo === "prescribe_conducta_seguridad"),
    "la alternativa con respiración no lleva su aviso en la tarjeta"
  );
});

prueba("todo aviso sobre el plan llega al texto exportado, junto a su propuesta", () => {
  const a = informe();
  const texto = formatearInformeTexto(a, "caso", "hoy");
  const delPlan = a.alertas.filter((al) =>
    /^(conductas_alternativas|lineas_de_intervencion_tentativas|conductas_problema)\[/.test(al.ruta)
  );
  assert.ok(delPlan.length > 0, "el fixture debería traer avisos sobre el plan");
  const plan = textoDelPlan(a);
  const intervenciones = texto.slice(texto.indexOf("INTERVENCIONES SIN BLANCO"));
  for (const al of delPlan) {
    const donde = al.ruta.startsWith("lineas_") ? intervenciones : plan;
    const primeraFrase = al.mensaje.split(/(?<=\.)\s/)[0];
    assert.ok(
      donde.includes(primeraFrase) || al.codigo === "intervencion_depende_de_dato_faltante",
      `falta en el exportado el aviso de ${al.ruta}: ${primeraFrase}`
    );
  }
});

prueba("una propuesta que depende de un dato faltante se exporta como condicional", () => {
  const a = informe();
  const dato = a.datos_faltantes[0].dato;
  const alt = a.conductas_alternativas[0];
  a.alertas.push({
    codigo: "intervencion_depende_de_dato_faltante",
    origen: "validador",
    gravedad: "media",
    ruta: "conductas_alternativas[0]",
    mensaje: `Depende de información que el informe declara faltante: "${dato}". Trátalo como condicional hasta confirmarlo.`,
    elemento: alt.conducta_propuesta,
  });
  const plan = construirPlanPorBlanco(a);
  const item = plan.tarjetas.flatMap((t) => t.alternativas).find((x) => x.indice === 0);
  assert.deepEqual(datosFaltantesDe(a, item.alertas), [dato]);
  const texto = textoDelPlan(a);
  assert.ok(texto.includes(`Primero explorar: ${dato}`));
  assert.ok(texto.includes(`Propuesta condicional: ${alt.conducta_propuesta}`));
});

prueba("estado: con avisos arranca en «Revisar», sin ellos en «Propuesto por IA»", () => {
  const a = informe();
  const id = a.conductas_problema[0].id;
  assert.equal(estadoDeBlanco(a, id, true), "revisar");
  assert.equal(estadoDeBlanco(a, id, false), "propuesto");
});

prueba("estado: la decisión del clínico gana, y un valor inválido se ignora", () => {
  const a = informe();
  const id = a.conductas_problema[0].id;
  a.estados_plan[id] = "aprobado";
  assert.equal(estadoDeBlanco(a, id, true), "aprobado");
  a.estados_plan[id] = "inventado";
  assert.equal(estadoDeBlanco(a, id, false), "propuesto");
});

prueba("el estado viaja al texto exportado", () => {
  const a = informe();
  const primera = construirPlanPorBlanco(a).tarjetas[0].conducta;
  a.estados_plan[primera.id] = "descartado";
  assert.ok(textoDelPlan(a).includes("Blanco 1 · Prioridad 1 · Estado: Descartado"));
});

prueba("un informe guardado sin estados se abre con estados vacíos", () => {
  const a = informe();
  delete a.estados_plan;
  const migrado = migrarAV2(a);
  assert.deepEqual(migrado.estados_plan, {});
  assert.doesNotThrow(() => construirPlanPorBlanco(migrado));
});

prueba("un informe nuevo no trae estados: el modelo nunca los decide", () => {
  const a = normalizarAnalisis({ ...crudo(), estados_plan: { x: "aprobado" } }, lineas);
  assert.deepEqual(a.estados_plan, {});
});

/* ── Fase B: intervención y monitorización por blanco (prompt 1.7.0) ───── */

/** El crudo del caso 01 con el plan en la forma nueva, como lo emitiría el modelo. */
function crudoConPlanPorBlanco() {
  const c = crudo();
  const reuniones = c.conductas_problema[0].descripcion;
  const alcohol = c.conductas_problema[3].descripcion;
  c.lineas_de_intervencion_tentativas = [
    {
      conducta: reuniones,
      intervencion: "Exposición gradual a exponer en reuniones, retirando la salida al baño.",
      porque: "La evitación parece mantenerse por el alivio inmediato de escapar de la evaluación.",
      depende_de: null,
    },
    {
      conducta: alcohol,
      intervencion: "",
      porque: "",
      depende_de: c.datos_faltantes[1].dato,
    },
    {
      conducta: "",
      intervencion: "Coordinar con su médico de atención primaria.",
      porque: "Descartar causas orgánicas de las palpitaciones.",
      depende_de: null,
    },
  ];
  c.plan_de_monitorizacion = [
    {
      conducta: reuniones,
      que_se_mide: "Reuniones en que expone sin salir.",
      con_que: "Autorregistro.",
      cada_cuanto: "Tras cada reunión.",
      criterio_de_revision: "Si al retirar la salida al baño la evitación no disminuye, revisar la función.",
    },
  ];
  return c;
}

prueba("las intervenciones y la monitorización caen en la tarjeta de su conducta, por id", () => {
  const a = validarAnalisis(normalizarAnalisis(crudoConPlanPorBlanco(), lineas), NOTA);
  const plan = construirPlanPorBlanco(a);
  const reuniones = plan.tarjetas.find((t) => t.conducta.id === a.conductas_problema[0].id);
  const alcohol = plan.tarjetas.find((t) => t.conducta.id === a.conductas_problema[3].id);
  assert.deepEqual(reuniones.intervenciones.map((x) => x.indice), [0]);
  assert.deepEqual(reuniones.monitorizacion.map((x) => x.indice), [0]);
  assert.deepEqual(alcohol.intervenciones.map((x) => x.indice), [1]);
  // La coordinación médica es común al caso: no se cuelga de ninguna tarjeta.
  assert.deepEqual(plan.intervencionesSinBlanco.map((x) => x.indice), [2]);
});

prueba("cada intervención sale una vez: en una tarjeta o sin blanco", () => {
  const a = validarAnalisis(normalizarAnalisis(crudoConPlanPorBlanco(), lineas), NOTA);
  const plan = construirPlanPorBlanco(a);
  const indices = [
    ...plan.tarjetas.flatMap((t) => t.intervenciones.map((x) => x.indice)),
    ...plan.intervencionesSinBlanco.map((x) => x.indice),
  ].sort();
  assert.deepEqual(indices, a.lineas_de_intervencion_tentativas.map((_, i) => i));
});

prueba("sin base para intervenir, el exportado dice qué explorar y no propone nada", () => {
  const a = validarAnalisis(normalizarAnalisis(crudoConPlanPorBlanco(), lineas), NOTA);
  const texto = textoDelPlan(a);
  assert.ok(
    texto.includes("Información insuficiente para proponer intervención. Primero explorar: Impacto del consumo"),
    "falta el «primero explorar» del blanco sin base"
  );
  assert.ok(texto.includes("Por qué: La evitación parece mantenerse por el alivio inmediato"));
  assert.ok(texto.includes("Revisar la hipótesis si: Si al retirar la salida al baño"));
  assert.ok(!texto.includes("[object Object]"));
});

prueba("una intervención con intervención vacía y sin dato del que dependa se descarta", () => {
  const c = crudoConPlanPorBlanco();
  c.lineas_de_intervencion_tentativas.push({ conducta: "x", intervencion: "  ", porque: "", depende_de: null });
  const a = normalizarAnalisis(c, lineas);
  assert.equal(a.lineas_de_intervencion_tentativas.length, 3);
});

prueba("un informe anterior (textos sueltos, un solo plan) se migra sin blanco y sin perder nada", () => {
  const viejo = informe();
  // Así lo guardaba el historial antes del 1.7.0.
  viejo.lineas_de_intervencion_tentativas = ["Entrenamiento en asertividad.", "Reducir el consumo."];
  viejo.plan_de_monitorizacion = {
    que_se_mide: "Evitaciones.", con_que: "Autorregistro.", cada_cuanto: "Diario.", criterio_de_revision: "",
  };
  const a = migrarAV2(viejo);
  assert.deepEqual(
    a.lineas_de_intervencion_tentativas.map((l) => [l.intervencion, l.conducta_id]),
    [["Entrenamiento en asertividad.", null], ["Reducir el consumo.", null]]
  );
  assert.equal(a.plan_de_monitorizacion.length, 1);
  assert.equal(a.plan_de_monitorizacion[0].conducta_id, null);
  const plan = construirPlanPorBlanco(a);
  assert.equal(plan.intervencionesSinBlanco.length, 2);
  assert.equal(plan.monitorizacionSinBlanco.length, 1);
  // Y abrirlo dos veces no cambia nada.
  assert.deepEqual(migrarAV2(structuredClone(a)).lineas_de_intervencion_tentativas, a.lineas_de_intervencion_tentativas);
});

prueba("sin ningún plan de medición, el exportado lo dice en vez de callarlo", () => {
  const a = informe();
  a.plan_de_monitorizacion = [];
  const texto = formatearInformeTexto(a, "caso", "hoy");
  assert.ok(texto.includes("La nota no daba base para proponer un plan de medición"));
});

console.log(`\n${pasadas} ok, ${fallos} fallos\n`);
process.exit(fallos === 0 ? 0 : 1);
