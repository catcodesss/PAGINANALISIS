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
    "lib/aristas.ts",
    "lib/grafo.ts",
    "lib/identidad.ts",
    "lib/parseAnalisis.ts",
    "lib/validadores.ts",
    "lib/formatearInforme.ts",
    "lib/redFuncional.ts",
    "lib/priorizacion.ts",
    "lib/vacios.ts",
    "lib/alertasNodo.ts",
    "lib/apoyoAristas.ts",
    "lib/procedencia.ts",
    "lib/procedenciaEdicion.ts",
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
const { migrarAV5, todosLosIds, situacionDeLaCadenaDBT } = require(
  join(RAIZ, ".tmp-evals/identidad.js")
);
const { construirRedFuncional } = require(join(RAIZ, ".tmp-evals/redFuncional.js"));
const { hayCamino, idNodoSituacion } = require(join(RAIZ, ".tmp-evals/aristas.js"));
const { derivarVistasProsa, formatearInformeTexto } = require(
  join(RAIZ, ".tmp-evals/formatearInforme.js")
);
const { priorizarBlancos } = require(join(RAIZ, ".tmp-evals/priorizacion.js"));
const { estadoVacio, TEXTO_VACIO } = require(join(RAIZ, ".tmp-evals/vacios.js"));
const { alertasPorNodo } = require(join(RAIZ, ".tmp-evals/alertasNodo.js"));
const { validarAnalisis } = require(join(RAIZ, ".tmp-evals/validadores.js"));
const { calcularApoyoAristas, hipotesisDeArista } = require(join(RAIZ, ".tmp-evals/apoyoAristas.js"));
const { procedenciaDe, confirmarElemento } = require(join(RAIZ, ".tmp-evals/procedencia.js"));
const { cerrarEdicion } = require(join(RAIZ, ".tmp-evals/procedenciaEdicion.js"));
const {
  actualizarEtiquetaNodo,
  agregarArista,
  agregarNodo,
  numeroDeApoyoArista,
  borrarNodo,
  apoyoCadena,
  construirNodosGrafo,
  derivarApoyo,
} = require(join(RAIZ, ".tmp-evals/grafo.js"));

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

console.log("\nMigración v1 → v2\n");

prueba("un informe v1 se abre sin lanzar y queda marcado con la versión actual", () => {
  const a = normalizarAnalisis(crudoV1(), lineas);
  assert.equal(a.version, 5);
  assert.ok(a.siguiente_id > 1, "siguiente_id debe quedar por encima de los asignados");
});

prueba("no se pierde ni una entidad por el camino", () => {
  const v1 = crudoV1();
  const a = normalizarAnalisis(v1, lineas);

  assert.equal(a.conductas_problema.length, v1.conductas_problema.length);
  assert.equal(a.variables_moduladoras.length, v1.variables_moduladoras.length);
  assert.equal(a.hipotesis_mantenimiento.length, v1.hipotesis_mantenimiento.length);
  assert.equal(a.conductas_alternativas.length, v1.conductas_alternativas.length);
  assert.equal(a.reglas_verbales.length, v1.capa_act.reglas_verbales.length);
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
  const dos = migrarAV5(JSON.parse(JSON.stringify(una)));
  assert.deepEqual(dos, una);
});

prueba("un informe anterior al grafo materializa aristas una sola vez", () => {
  const a = normalizarAnalisis(crudoV1(), lineas);
  assert.ok(a.aristas.length > 0, "la cadena implícita no produjo relaciones");
  assert.ok(a.aristas.every((arista) => arista.id && arista.desde && arista.hasta));

  // Vaciar el grafo es una edición válida. El migrador no puede reconstruirlo
  // después y deshacer lo que trazó el profesional.
  a.aristas = [];
  assert.deepEqual(migrarAV5(JSON.parse(JSON.stringify(a))).aristas, []);
});

prueba("una franja completa exige una cita verificada", () => {
  const sinCita = { texto: null, verificada: false, motivo: "sin_referencia" };
  const cita = { texto: "texto literal", linea_inicio: 1, linea_fin: 1, verificada: true };
  assert.equal(derivarApoyo(sinCita, "alta"), 1);
  assert.equal(derivarApoyo(cita, "baja"), 2);
  assert.equal(derivarApoyo(cita, "media"), 3);
});

prueba("la cadena hereda el apoyo del eslabón o la relación más débil", () => {
  const a = normalizarAnalisis(crudoV1(), lineas);
  const nodos = construirNodosGrafo(a).filter(
    (n) => n.situacion_id === a.situaciones[0].id && !n.alternativa
  );
  // La OM y la función son construcciones del análisis: no rebajan la cadena.
  const piezas = nodos.filter((n) => n.tipo !== "funcion" && n.tipo !== "om");
  assert.equal(apoyoCadena(nodos), Math.min(...piezas.map((n) => n.apoyo)));
  // Con las relaciones, la cadena nunca es más fuerte que su relación más débil.
  const aristas = a.aristas;
  const numero = { textual: 3, parcial: 2, inferido: 1 };
  const ids = new Set(piezas.map((n) => n.id));
  const deLaCadena = aristas.filter((r) => ids.has(r.desde) && ids.has(r.hasta));
  for (const r of deLaCadena) assert.ok(apoyoCadena(nodos, aristas) <= numero[r.apoyo]);
});

prueba("editar un nodo modifica la entidad original y no una copia del grafo", () => {
  const a = normalizarAnalisis(crudoV1(), lineas);
  const conducta = a.conductas_problema[0];
  actualizarEtiquetaNodo(a, conducta.id, "Etiqueta revisada por el clínico");
  assert.equal(a.conductas_problema[0].descripcion, "Etiqueta revisada por el clínico");
  assert.equal(
    construirNodosGrafo(a).find((n) => n.id === conducta.id)?.etiqueta,
    "Etiqueta revisada por el clínico"
  );
  const arista = a.aristas.find((actual) => actual.hasta === conducta.id);
  if (arista) assert.equal(hayCamino(a.aristas, arista.desde, conducta.id), true);
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

prueba("editar una conducta en el grafo actualiza hipótesis y destacado", () => {
  /*
    Criterio 3 del encargo: reescribir la etiqueta de una conducta en el bloque
    2 cambia el texto del bloque 3 y del bloque 4, sin recargar y sin llamar a
    la API. Aquí se comprueba la parte derivable en Node.

    NO se comprueba el resumen clínico, y es deliberado: el resumen dejó de
    derivarse del grafo. Llegó a hacerlo y el resultado era un recuento de
    nodos —«el grafo contiene 3 situaciones, 4 conductas…»— en el sitio donde
    antes decía de quién es el caso y por qué consulta. El grafo no contiene
    eso, así que derivarlo de ahí no lo reescribe: lo pierde.
  */
  const a = normalizarAnalisis(crudoV1(), lineas);
  const conducta = a.conductas_problema[0];
  actualizarEtiquetaNodo(a, conducta.id, "Conducta revisada desde el grafo");
  const prosa = derivarVistasProsa(a);
  assert.ok(prosa.destacada.enunciado.includes("Conducta revisada desde el grafo"));
  assert.ok(prosa.hipotesis.some((h) => h.conducta === "Conducta revisada desde el grafo"));
});

prueba("el resumen clínico sobrevive a la derivación", () => {
  // La regresión que esto vigila: el resumen sustituido por un inventario del
  // grafo. Es el único sitio del informe que dice de quién hablamos y por qué
  // consulta, y no se puede reconstruir desde nodos y aristas.
  const a = normalizarAnalisis(crudoV1(), lineas);
  assert.ok(a.resumen_clinico.length > 0, "el fixture no trae resumen");
  const prosa = derivarVistasProsa(a);
  assert.equal(prosa.resumen, a.resumen_clinico);
  assert.ok(
    !/contiene \d+ situaci/.test(prosa.resumen),
    "el resumen volvió a ser un recuento de nodos"
  );
});

prueba("una ruta Ed-conducta borrada se declara no trazada", () => {
  const a = normalizarAnalisis(crudoV1(), lineas);
  const h = a.hipotesis_mantenimiento.find((actual) => actual.destino_id);
  const situacion = a.situaciones.find((s) => s.conductas_ids.includes(h.destino_id));
  const ed = idNodoSituacion(situacion, "ed");
  a.aristas = a.aristas.filter((arista) => arista.desde !== ed);
  const derivada = derivarVistasProsa(a).hipotesis.find((actual) => actual.id === h.id);
  assert.ok(derivada.enunciado.includes("[Ed no trazado hasta la conducta]"));
});

prueba("la prosa manual tiene precedencia sobre la derivada", () => {
  const a = normalizarAnalisis(crudoV1(), lineas);
  a.secciones_editadas = ["resumen", "hipotesis-mantenimiento"];
  a.resumen_clinico = "Resumen escrito por el profesional.";
  a.hipotesis_mantenimiento[0].enunciado = "Hipótesis escrita por el profesional.";
  const prosa = derivarVistasProsa(a);
  assert.equal(prosa.resumen, "Resumen escrito por el profesional.");
  assert.equal(prosa.hipotesis[0].enunciado, "Hipótesis escrita por el profesional.");
});

prueba("la formulación destacada derivada viaja al texto y al Word", () => {
  const a = normalizarAnalisis(crudoV1(), lineas);
  const texto = formatearInformeTexto(a, "CASO-1", "fecha");
  assert.ok(texto.includes("FORMULACIÓN FUNCIONAL DESTACADA"));
  assert.ok(texto.includes(derivarVistasProsa(a).destacada.enunciado));
});

console.log("\nMigración v2 → v3\n");

/**
 * Un informe tal como lo guardaba el historial en v2: ya con ids y aristas,
 * y todavía con su capa MC y las reglas verbales dentro de `capa_act`. Se
 * reconstruye a partir del normalizado porque el normalizador de hoy ya no
 * produce esa forma.
 */
function guardadoEnV2() {
  const a = JSON.parse(JSON.stringify(normalizarAnalisis(crudoV1(), lineas)));
  a.version = 2;
  a.lineas_de_intervencion_tentativas = a.lineas_de_intervencion_tentativas.filter(
    (l) => l.contingencia_objetivo === null
  );
  a.capa_mc = JSON.parse(JSON.stringify(crudoV1().capa_mc));
  a.capa_act.reglas_verbales = a.reglas_verbales;
  delete a.reglas_verbales;
  // Los procesos, como los guardaba la v2: texto libre y ancla por situación.
  const originales = crudoV1().capa_act.procesos_act;
  a.capa_act.procesos_act = a.capa_act.procesos_act.map((p, i) => ({
    id: p.id,
    proceso: originales[i].proceso,
    vinculo_con_cadena: originales[i].vinculo_con_cadena,
    situacion_id: a.situaciones[i]?.id ?? null,
    eslabon_id: null,
    evidencia: p.evidencia,
  }));
  return a;
}

prueba("las reglas verbales suben al núcleo y conservan su id", () => {
  const v2 = guardadoEnV2();
  const antes = v2.capa_act.reglas_verbales.map((r) => [r.id, r.regla]);
  assert.ok(antes.length > 0 && antes.every(([id]) => id), "el v2 de prueba no trae reglas con id");
  const a = migrarAV5(v2);
  assert.deepEqual(a.reglas_verbales.map((r) => [r.id, r.regla]), antes);
  assert.ok(!("reglas_verbales" in a.capa_act), "las reglas siguen también en capa_act");
  // Y el grafo las sigue pintando con el mismo id: una arista hacia rvb_N no se rompe.
  const ids = new Set(construirNodosGrafo(a).map((n) => n.id));
  for (const [id] of antes) assert.ok(ids.has(id), `el nodo ${id} desapareció del grafo`);
});

prueba("un JSON con reglas arriba y dentro de capa_act no pierde ninguna", () => {
  const crudo = crudoV1();
  crudo.reglas_verbales = [{ regla: "Si lo digo mal, me juzgarán.", textual_o_inferida: "inferida", clase: "tracking", rigidez: "media", analisis: "" }];
  const a = normalizarAnalisis(crudo, lineas);
  assert.equal(a.reglas_verbales.length, 1 + crudoV1().capa_act.reglas_verbales.length);
});

prueba("ningún procedimiento MC se pierde: cada uno es una línea de intervención", () => {
  const procedimientos = crudoV1().capa_mc.procedimientos_sugeridos;
  for (const a of [normalizarAnalisis(crudoV1(), lineas), migrarAV5(guardadoEnV2())]) {
    assert.ok(!("capa_mc" in a), "la capa MC sigue en el informe");
    for (const p of procedimientos) {
      const linea = a.lineas_de_intervencion_tentativas.find(
        (l) => l.intervencion === p.procedimiento
      );
      assert.ok(linea, `se perdió «${p.procedimiento}»`);
      assert.equal(linea.contingencia_objetivo, p.contingencia_objetivo);
      assert.equal(linea.precauciones, p.precauciones);
    }
  }
});

prueba("un procedimiento MC migrado no se asigna a un blanco por sus palabras", () => {
  const a = migrarAV5(guardadoEnV2());
  const migradas = a.lineas_de_intervencion_tentativas.filter((l) => l.contingencia_objetivo);
  assert.equal(migradas.length, 2);
  assert.ok(migradas.every((l) => l.conducta === "" && l.conducta_id === null));
});

prueba("un procedimiento MC parecido a una línea existente no se descarta", () => {
  const a = guardadoEnV2();
  const antes = a.lineas_de_intervencion_tentativas.length;
  a.lineas_de_intervencion_tentativas.push({
    conducta: "", conducta_id: null, intervencion: "Exposición graduada",
    porque: "", depende_de: null, contingencia_objetivo: null, precauciones: null,
  });
  const migrado = migrarAV5(a);
  assert.equal(migrado.lineas_de_intervencion_tentativas.length, antes + 1 + 2);
  assert.equal(
    migrado.lineas_de_intervencion_tentativas.filter((l) => l.intervencion === "Exposición graduada").length,
    2
  );
});

prueba("migrar un informe v2 a v5 dos veces da lo mismo, y queda en v5", () => {
  const una = migrarAV5(guardadoEnV2());
  assert.equal(una.version, 5);
  assert.deepEqual(migrarAV5(JSON.parse(JSON.stringify(una))), una);
});

prueba("los procedimientos migrados salen en el Plan exportado, no en una capa aparte", () => {
  const texto = formatearInformeTexto(migrarAV5(guardadoEnV2()), "CASO-1", "fecha");
  assert.ok(!texto.includes("CAPA CONDUCTUAL"), "sigue la sección MC");
  assert.ok(texto.includes("Contingencia objetivo: R− que mantiene la evitación en reuniones."));
  assert.ok(texto.includes("Precauciones: Vigilar la aparición de conductas de seguridad"));
});

prueba("los procesos ACT pasan a anotaciones: enum, elemento y sin ancla por situación", () => {
  for (const a of [normalizarAnalisis(crudoV1(), lineas), migrarAV5(guardadoEnV2())]) {
    const [fusion, evitacion] = a.capa_act.procesos_act;
    assert.equal(fusion.proceso, "fusion");
    assert.equal(evitacion.proceso, "evitacion_experiencial");
    assert.equal(fusion.elemento_objetivo, "Reuniones de equipo");
    for (const p of a.capa_act.procesos_act) {
      assert.ok(!("situacion_id" in p) && !("eslabon_id" in p) && !("vinculo_con_cadena" in p));
      assert.ok(!p.revisar_proceso, "un proceso con nombre conocido no debe quedar para revisar");
    }
  }
});

prueba("un proceso que solo nombra una situación queda sin anclar, no en un nodo cualquiera", () => {
  // «Reuniones de equipo» comparte palabras con el Ed de esa situación; engancharlo
  // ahí sería la conjetura de la v2 en pequeño.
  for (const a of [normalizarAnalisis(crudoV1(), lineas), migrarAV5(guardadoEnV2())]) {
    assert.deepEqual(a.capa_act.procesos_act.map((p) => p.nodo_id), [null, null]);
  }
});

prueba("un proceso cuyo elemento no casa con nada queda en null", () => {
  const crudo = crudoV1();
  crudo.capa_act.procesos_act = [{
    proceso: "fusion", elemento_objetivo: "Contemplación del paisaje marítimo invernal",
    justificacion_funcional: "x", evidencia: null,
  }];
  assert.equal(normalizarAnalisis(crudo, lineas).capa_act.procesos_act[0].nodo_id, null);
});

prueba("un proceso cuyo elemento es una conducta se ancla a esa conducta", () => {
  const crudo = crudoV1();
  const conducta = crudo.conductas_problema[0].descripcion;
  crudo.capa_act.procesos_act = [{
    proceso: "evitacion_experiencial", elemento_objetivo: conducta,
    justificacion_funcional: "Se mantiene por el alivio del malestar pese al coste laboral.",
    evidencia: null,
  }];
  const a = normalizarAnalisis(crudo, lineas);
  assert.equal(a.capa_act.procesos_act[0].nodo_id, a.conductas_problema[0].id);
});

prueba("un proceso v2 anclado a un eslabón conserva ese nodo", () => {
  const v2 = guardadoEnV2();
  const eslabon = v2.situaciones.flatMap((s) => s.cadena_dbt?.eslabones ?? [])[0];
  v2.capa_act.procesos_act[0].eslabon_id = eslabon.id;
  assert.equal(migrarAV5(v2).capa_act.procesos_act[0].nodo_id, eslabon.id);
});

prueba("un proceso con nombre desconocido se conserva, marcado para revisar", () => {
  const v2 = guardadoEnV2();
  v2.capa_act.procesos_act[0].proceso = "Rigidez psicológica general";
  const p = migrarAV5(v2).capa_act.procesos_act[0];
  assert.equal(p.revisar_proceso, true);
  assert.notEqual(p.proceso, "evitacion_experiencial", "el valor por defecto no puede afirmar evitación");
  assert.ok(p.justificacion_funcional.includes("Rigidez psicológica general"));
});

prueba("borrar el nodo de un proceso lo deja sin anclar, no lo borra", () => {
  const crudo = crudoV1();
  crudo.capa_act.procesos_act = [{
    proceso: "evitacion_experiencial", elemento_objetivo: crudo.conductas_problema[0].descripcion,
    justificacion_funcional: "x", evidencia: null,
  }];
  const a = normalizarAnalisis(crudo, lineas);
  borrarNodo(a, a.capa_act.procesos_act[0].nodo_id);
  assert.equal(a.capa_act.procesos_act.length, 1);
  assert.equal(a.capa_act.procesos_act[0].nodo_id, null);
});

prueba("el exportado da de cada proceso su elemento, su justificación y su cita", () => {
  const texto = formatearInformeTexto(normalizarAnalisis(crudoV1(), lineas), "CASO-1", "fecha");
  const lineasTexto = texto.split("\n");
  const i = lineasTexto.findIndex((l) => l.startsWith("- Posible patrón de fusión — sobre: Reuniones de equipo (sin anclar"));
  assert.ok(i >= 0, "falta el proceso con su elemento");
  assert.ok(lineasTexto[i + 1].startsWith("  Justificación funcional: no declarada"));
  assert.ok(lineasTexto[i + 2].startsWith("  De la nota: "));
});

console.log("\nSeguridad clínica (fase 1 del rediseño)\n");

prueba("un informe v3 guardado sin campos_ausentes migra a v5 con la lista vacía, dos veces igual", () => {
  const v3 = JSON.parse(JSON.stringify(normalizarAnalisis(crudoV1(), lineas)));
  v3.version = 3;
  delete v3.campos_ausentes;
  const una = migrarAV5(v3);
  assert.equal(una.version, 5);
  assert.deepEqual(una.campos_ausentes, []);
  assert.deepEqual(migrarAV5(JSON.parse(JSON.stringify(una))), una);
});

prueba("vacíos: ausente es «no se generó»; presente y vacío es «la IA no encontró nada»", () => {
  // El fixture v0.1.2 es anterior a valores, reforzadores perdidos y riesgo.
  const a = normalizarAnalisis(crudoV1(), lineas);
  for (const campo of ["valores_y_metas", "perdida_de_reforzadores", "riesgo"]) {
    assert.ok(a.campos_ausentes.includes(campo), `${campo} debería constar como ausente`);
  }
  assert.equal(estadoVacio(a, "valores_y_metas"), "no_generado");
  assert.ok(!a.campos_ausentes.includes("situaciones"));

  const conClave = normalizarAnalisis({ ...crudoV1(), valores_y_metas: [] }, lineas);
  assert.equal(estadoVacio(conClave, "valores_y_metas"), "sin_hallazgos");

  // Un bloque no pedido tampoco se generó, aunque la clave exista.
  conClave.campos_generados = ["base"];
  assert.equal(estadoVacio(conClave, "valores_y_metas"), "no_generado");
});

prueba("vacíos: el exportado no culpa a la nota y distingue los dos estados", () => {
  const texto = formatearInformeTexto(normalizarAnalisis(crudoV1(), lineas), "CASO-1", "fecha");
  assert.ok(!texto.includes("Sin hallazgos suficientes en la nota"));
  assert.ok(!/no dice nada sobre/.test(texto));
  const valores = texto.split("Valores y metas del consultante:")[1].split("\n")[1];
  assert.equal(valores, TEXTO_VACIO.no_generado);
  assert.ok(texto.includes("El análisis no evaluó el riesgo. No significa que no lo haya."));
});

prueba("blanco 1: el sueño no sale como palanca sin la marca de relación inferida", () => {
  const a = normalizarAnalisis(crudoV1(), lineas);
  const [primero] = priorizarBlancos(a);
  assert.equal(primero.id, "cnd_1");
  assert.equal(primero.palanca.id, "vmd_1");
  assert.equal(primero.palanca.relacion_inferida, true);
  // Una inferencia no ordena el plan: el blanco se ordena como uno sin palanca.
  assert.equal(primero.rendimiento, null);
  const texto = formatearInformeTexto(a, "CASO-1", "fecha");
  assert.ok(texto.includes("Por dónde moverla (relación inferida): Sueño deficiente los domingos."));
  assert.ok(!texto.includes("Por dónde moverla: Sueño"));
  assert.ok(texto.includes("modificabilidad alta (estimada desde una relación inferida)"));
});

prueba("la formulación derivada dice que el origen es una relación inferida", () => {
  const a = normalizarAnalisis(crudoV1(), lineas);
  const h1 = derivarVistasProsa(a).hipotesis.find((h) => h.destino_id === "cnd_1");
  assert.ok(h1.enunciado.includes("relación de mantenimiento inferida (ninguna línea de la nota la sostiene), desde: Sueño deficiente los domingos"));
  assert.ok(!h1.enunciado.includes("trazada parte de"));
});

prueba("ninguna prosa derivada lleva «» vacío ni entrecomilla etiquetas del modelo", () => {
  const a = normalizarAnalisis(crudoV1(), lineas);
  for (const h of derivarVistasProsa(a).hipotesis) {
    assert.ok(!h.enunciado.includes("«"), `etiqueta entrecomillada: ${h.enunciado}`);
  }
  const h3 = derivarVistasProsa(a).hipotesis.find((h) => h.destino_id === "cnd_4");
  assert.ok(h3.enunciado.includes("[origen no trazado]"));
  assert.ok(!formatearInformeTexto(a, "CASO-1", "fecha").includes("«»"));
});

prueba("un bucle con un tramo inferido lo dice", () => {
  const red = construirRedFuncional(normalizarAnalisis(crudoV1(), lineas));
  const i = red.bucles.findIndex((b) => b.includes("Sueño deficiente"));
  assert.ok(i >= 0, "falta el bucle del sueño");
  assert.equal(red.buclesConRelacionInferida[i], true);
});

prueba("la alerta de la respiración resuelve al nodo de la alternativa", () => {
  const a = validarAnalisis(normalizarAnalisis(crudoV1(), lineas), NOTA);
  const avisos = alertasPorNodo(a).get("alt_1") ?? [];
  assert.ok(avisos.some((x) => x.codigo === "prescribe_conducta_seguridad" && x.gravedad === "alta"));
});


console.log("\nApoyo en las relaciones y procedencia por elemento (fase 3 del rediseño)\n");

const copiar = (x) => JSON.parse(JSON.stringify(x));

prueba("un informe v3 pasa a v5 sin perder nada y migrar dos veces da lo mismo", () => {
  const v3 = copiar(normalizarAnalisis(crudoV1(), lineas));
  v3.version = 3;
  delete v3.procedencia;
  delete v3.campos_ausentes;
  for (const a of v3.aristas) { delete a.apoyo; delete a.evidencia; }
  const antes = copiar(v3);
  const una = migrarAV5(v3);
  assert.equal(una.version, 5);
  assert.deepEqual(todosLosIds(una).sort(), todosLosIds(antes).sort());
  assert.equal(una.aristas.length, antes.aristas.length);
  assert.equal(una.conductas_problema.length, antes.conductas_problema.length);
  assert.deepEqual(una.procedencia, {}, "todo nace como propuesta (ausente)");
  assert.deepEqual(migrarAV5(copiar(una)), una);
});

prueba("la operación motivacional del caso 01 no es cita textual", () => {
  const a = normalizarAnalisis(crudoV1(), lineas);
  const oms = construirNodosGrafo(a).filter((n) => n.tipo === "om");
  assert.ok(oms.length > 0, "el fixture no trae OM");
  for (const om of oms) {
    assert.equal(om.evidencia, null, "la OM no hereda la cita de la cadena");
    assert.equal(om.apoyo, 1);
  }
  // La función hipotetizada tampoco: ninguna frase la dice.
  for (const f of construirNodosGrafo(a).filter((n) => n.tipo === "funcion")) assert.equal(f.apoyo, 1);
});

prueba("sueño → evitar exponer no es textual, y el bucle que lo usa tampoco", () => {
  const a = normalizarAnalisis(crudoV1(), lineas);
  const sueno = a.variables_moduladoras.find((v) => /sue[ñn]o/i.test(v.descripcion));
  assert.ok(sueno, "el fixture no trae la variable del sueño");
  // Sus dos extremos sí están citados: eso es justo lo que no basta.
  const nodos = new Map(construirNodosGrafo(a).map((n) => [n.id, n]));
  const arista = a.aristas.find((r) => r.desde === sueno.id && nodos.get(r.hasta)?.tipo === "conducta");
  assert.ok(arista, "no hay relación del sueño a una conducta");
  assert.equal(nodos.get(arista.desde).apoyo, 3);
  assert.notEqual(arista.apoyo, "textual");
  assert.deepEqual(arista.evidencia, [], "ninguna frase afirma la relación");
  const red = construirRedFuncional(a);
  assert.ok(red.bucles.length > 0);
  red.apoyoDeBucles.forEach((apoyo) => assert.notEqual(apoyo, "textual"));
});

prueba("ninguna relación tiene más apoyo que sus extremos, ni lista citas si es inferida", () => {
  const a = normalizarAnalisis(crudoV1(), lineas);
  const nodos = new Map(construirNodosGrafo(a).map((n) => [n.id, n]));
  for (const r of a.aristas) {
    const extremos = [nodos.get(r.desde)?.apoyo ?? 1, nodos.get(r.hasta)?.apoyo ?? 1];
    assert.ok(numeroDeApoyoArista(r.apoyo) <= Math.min(...extremos), `${r.id} supera a sus extremos`);
    if (r.apoyo === "inferido") assert.deepEqual(r.evidencia, [], `${r.id} inferida lista una cita`);
  }
});

prueba("solo conducta → consecuencia inmediata de la cadena operante puede ser textual", () => {
  const a = normalizarAnalisis(crudoV1(), lineas);
  const nodos = new Map(construirNodosGrafo(a).map((n) => [n.id, n]));
  const inmediatas = new Set(a.situaciones.map((s) => s.cadena_operante?.consecuencia.id).filter(Boolean));
  for (const r of a.aristas.filter((x) => x.apoyo === "textual")) {
    assert.equal(nodos.get(r.desde)?.tipo, "conducta", `${r.id}: el origen no es una conducta`);
    assert.ok(inmediatas.has(r.hasta), `${r.id}: no va a la consecuencia inmediata`);
    assert.ok(r.evidencia.length > 0, `${r.id}: textual sin cita`);
  }
  assert.ok(a.aristas.some((r) => r.apoyo === "textual"), "el fixture debería tener al menos una");
});

prueba("una hipótesis de confianza baja baja su relación a inferida", () => {
  const a = normalizarAnalisis(crudoV1(), lineas);
  const h = a.hipotesis_mantenimiento.find((x) => x.origen_id && x.destino_id && x.confianza !== "baja");
  assert.ok(h, "el fixture no trae una hipótesis de confianza media o alta");
  const otras = a.hipotesis_mantenimiento.filter((x) => x !== h);
  const aristaDe = () => a.aristas.find((r) => r.desde === h.origen_id && r.hasta === h.destino_id);
  assert.notEqual(aristaDe().apoyo, "inferido", "el punto de partida ya era inferido");
  // Si otra hipótesis comparte el par, la mejor apoyada manda: se apartan.
  for (const o of otras) if (hipotesisDeArista(a, h.origen_id, h.destino_id).includes(o)) o.confianza = "baja";
  h.confianza = "baja";
  calcularApoyoAristas(a);
  assert.equal(aristaDe().apoyo, "inferido");
});

prueba("una relación creada por el clínico es inferida, sin cita y suya; recalcular no la mejora", () => {
  const a = normalizarAnalisis(crudoV1(), lineas);
  const [x, y] = a.conductas_problema;
  agregarArista(a, x.id, y.id);
  const nueva = a.aristas.at(-1);
  assert.equal(nueva.apoyo, "inferido");
  assert.deepEqual(nueva.evidencia, []);
  assert.equal(procedenciaDe(a, nueva.id).estado, "creado");
  calcularApoyoAristas(a);
  assert.equal(a.aristas.at(-1).apoyo, "inferido");
  const guardada = migrarAV5(copiar(a));
  assert.equal(procedenciaDe(guardada, nueva.id).estado, "creado", "la procedencia sobrevive a la migración");
  assert.equal(guardada.aristas.at(-1).apoyo, "inferido");
});

prueba("los elementos de una sección ya editada pasan a editado al migrar, una sola vez", () => {
  const v4 = copiar(normalizarAnalisis(crudoV1(), lineas));
  v4.version = 4;
  delete v4.procedencia;
  v4.secciones_editadas = ["hipotesis-mantenimiento"];
  const una = migrarAV5(copiar(v4));
  for (const h of una.hipotesis_mantenimiento) {
    assert.equal(procedenciaDe(una, h.id).estado, "editado");
    assert.equal(procedenciaDe(una, h.id).original, undefined, "no se puede saber el original");
  }
  assert.equal(procedenciaDe(una, una.conductas_problema[0].id).estado, "propuesta");
  // Después, la procedencia es por elemento: confirmar uno y volver a migrar no
  // reescribe la sección entera ni deshace la decisión.
  const otra = copiar(una);
  const libre = otra.variables_moduladoras[0].id;
  confirmarElemento(otra, libre);
  const deNuevo = migrarAV5(copiar(otra));
  assert.equal(procedenciaDe(deNuevo, libre).estado, "confirmado");
  assert.deepEqual(deNuevo.procedencia, otra.procedencia);
});

prueba("invariante 6 por elemento: editado, confirmado y creado salen distintos en el texto exportado", () => {
  const a = normalizarAnalisis(crudoV1(), lineas);
  const conducta = a.conductas_problema[0];
  const otra = a.conductas_problema[1];

  // Editar a mano: la etiqueta cambia y el elemento queda como editado.
  const editada = copiar(a);
  actualizarEtiquetaNodo(editada, conducta.id, "Texto que escribió el profesional");
  cerrarEdicion(a, editada, false);
  assert.equal(procedenciaDe(editada, conducta.id).estado, "editado");
  assert.equal(procedenciaDe(editada, conducta.id).original, conducta.descripcion);

  // Confirmar no es editar.
  const confirmada = copiar(editada);
  confirmarElemento(confirmada, otra.id);
  cerrarEdicion(editada, confirmada, true);
  assert.equal(procedenciaDe(confirmada, otra.id).estado, "confirmado");
  // …y confirmar algo que el clínico ya editó no lo devuelve a «confirmado».
  confirmarElemento(confirmada, conducta.id);
  assert.equal(procedenciaDe(confirmada, conducta.id).estado, "editado");

  // Crear: el elemento es del profesional.
  const creada = copiar(confirmada);
  agregarNodo(creada, creada.situaciones[0].id, "conducta", "Conducta que añadió el profesional");
  const nuevaConducta = creada.conductas_problema.at(-1);
  assert.equal(procedenciaDe(creada, nuevaConducta.id).estado, "creado");

  const texto = formatearInformeTexto(creada, "CASO-1", "fecha");
  const bloqueDe = (descripcion) => {
    const i = texto.indexOf(`] ${descripcion}`);
    assert.ok(i >= 0, `no sale «${descripcion}»`);
    const fin = texto.indexOf("\n- ", i);
    return texto.slice(i, fin > 0 ? fin : undefined);
  };
  assert.match(bloqueDe("Texto que escribió el profesional"), /Procedencia: \[Editado\]/);
  assert.match(bloqueDe(otra.descripcion), /Procedencia: \[Confirmado\]/);
  assert.doesNotMatch(bloqueDe(otra.descripcion), /\[Editado\]/);
  assert.match(bloqueDe("Conducta que añadió el profesional"), /Procedencia: \[Del profesional\]/);
  assert.match(texto, /\[Propuesta de la IA\]/);
  // El Word se construye sobre el mismo texto: una sola fuente, un solo contrato.
  const fuenteWord = readFileSync(join(RAIZ, "lib/exportarDocx.ts"), "utf8");
  assert.match(fuenteWord, /formatearInformeTexto\(/);
});

prueba("el texto exportado dice el apoyo de la relación de cada hipótesis", () => {
  const a = normalizarAnalisis(crudoV1(), lineas);
  const texto = formatearInformeTexto(a, "CASO-1", "fecha");
  const cuenta = (texto.match(/Apoyo de la relación:/g) ?? []).length;
  assert.equal(cuenta, a.hipotesis_mantenimiento.length);
  assert.doesNotMatch(texto, /Apoyo de la relación: Cita textual/);
});

prueba("la procedencia no entra en lo que el modelo puede escribir", () => {
  const a = normalizarAnalisis(
    { ...crudoV1(), procedencia: { cnd_1: { estado: "confirmado" } }, razonamiento_previo: "x" },
    lineas
  );
  assert.deepEqual(a.procedencia, {}, "una respuesta del modelo no puede traer procedencia");
});

console.log(
  fallos === 0
    ? `\n${pasadas} pruebas correctas\n`
    : `\n${fallos} PRUEBAS FALLIDAS\n`
);
process.exit(fallos === 0 ? 0 : 1);
