/**
 * Pruebas de los validadores deterministas (lib/validadores.ts).
 *
 * Ejecutar:  node --experimental-strip-types evals/validadores.test.mjs
 *
 * Se ejecutan contra el informe real de la v0.1.2 guardado en fixtures/, que
 * contiene los fallos que motivaron todo el trabajo. No gastan API.
 */

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = join(AQUI, "..");

// Estos módulos se importan entre sí sin extensión (resolución de TypeScript),
// que Node no entiende en ESM. Se compilan a CommonJS en una carpeta temporal.
// Se invoca el bin de TypeScript vía `node` (no `npx.cmd`): en Windows, Node
// 24 exige `shell: true` para lanzar .cmd y si no, falla con EINVAL.
execFileSync(
  process.execPath,
  [
    join(RAIZ, "node_modules/typescript/bin/tsc"),
    "lib/citas.ts",
    "lib/parseAnalisis.ts",
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
const {
  validarAnalisis,
  agruparAlertas,
  seccionDeRuta,
  revalidarTrasReanalisis,
  yaEnRepertorio,
} = require(join(RAIZ, ".tmp-evals/validadores.js"));

// Misma nota del caso 01, tal como se le envió al modelo.
const caso = readFileSync(join(AQUI, "casos/01-ansiedad-social.md"), "utf8");
const nota = caso
  .split(/^##\s+NOTA\s*$/m)[1]
  .split(/^##\s+COMPROBACIONES\s*$/m)[0]
  .trim();

const fixture = JSON.parse(
  readFileSync(join(AQUI, "fixtures/01-v0.1.2.json"), "utf8")
);

const { lineas } = numerarNota(nota);
const informe = validarAnalisis(normalizarAnalisis(fixture.analisis, lineas), nota);

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

const con = (codigo) => informe.alertas.filter((a) => a.codigo === codigo);

console.log("\nValidadores deterministas (sobre el informe real de la v0.1.2)\n");

prueba("detecta que se prescribe la respiración, que era conducta de seguridad", () => {
  const alertas = con("prescribe_conducta_seguridad");
  assert.ok(alertas.length > 0, "no se emitió ninguna alerta");
  assert.ok(
    alertas.some((a) => /respiraci/i.test(a.mensaje)),
    `ninguna alerta menciona la respiración: ${JSON.stringify(alertas, null, 1)}`
  );
  assert.equal(alertas[0].gravedad, "alta");
});

prueba("detecta la intervención que depende de un dato declarado faltante", () => {
  const alertas = con("intervencion_depende_de_dato_faltante");
  assert.ok(alertas.length > 0, "no se emitió ninguna alerta");
  assert.ok(
    alertas.some((a) => /supervisora/i.test(a.mensaje)),
    "no relacionó el plan con las reacciones de la supervisora"
  );
});

prueba("degrada la confianza alta que no tiene ninguna cita verificable", () => {
  // Escenario construido: se sustituye la evidencia por una paráfrasis, que no
  // resuelve contra ninguna línea. La confianza alta deja de sostenerse.
  const crudo = JSON.parse(JSON.stringify(fixture.analisis));
  crudo.situaciones[1].confianza = "alta";
  crudo.situaciones[1].cadena_operante.evidencia =
    "El cliente se molestó y ella acabó cediendo.";
  const conParafrasis = validarAnalisis(normalizarAnalisis(crudo, lineas), nota);

  const situacion = conParafrasis.situaciones[1];
  assert.equal(situacion.confianza, "media");
  assert.ok(
    conParafrasis.alertas.some((a) => a.codigo === "confianza_sin_cita"),
    "no se emitió la alerta"
  );
});

prueba("no degrada la confianza cuando sí hay cita verificable", () => {
  const situacion = informe.situaciones.find(
    (s) => s.nombre === "Reuniones de equipo"
  );
  assert.equal(situacion.confianza, "alta");
});

prueba("no duplica la misma alerta para la misma ruta", () => {
  const claves = informe.alertas.map((a) => `${a.codigo}|${a.ruta}`);
  assert.equal(claves.length, new Set(claves).size);
});

prueba("las alertas no las inventa el modelo: el normalizador siempre las vacía", () => {
  const sinValidar = normalizarAnalisis(
    { ...fixture.analisis, alertas: [{ codigo: "inventada" }] },
    lineas
  );
  assert.deepEqual(sinValidar.alertas, []);
});

prueba("detecta riesgo vital en la nota que el campo riesgo no recogió", () => {
  // Escenario real: evals/casos/09-riesgo-explicito.md devolvió en pruebas
  // repetidas "evaluado": true con "indicadores": [] pese a que la nota
  // describía ideación explícita ("estaría mejor si desapareciera").
  const notaConRiesgo =
    "J. refiere que ayer pensó que estaría mejor si desapareciera un tiempo.";
  const { lineas: lineasRiesgo } = numerarNota(notaConRiesgo);
  const crudo = {
    ...fixture.analisis,
    riesgo: { evaluado: true, indicadores: [] },
  };
  const conRiesgo = validarAnalisis(
    normalizarAnalisis(crudo, lineasRiesgo),
    notaConRiesgo
  );
  assert.ok(
    conRiesgo.alertas.some((a) => a.codigo === "riesgo_posible_no_detectado"),
    "no se emitió la alerta de riesgo no detectado"
  );
});

prueba("no alerta de riesgo no detectado cuando el campo riesgo sí lo recoge", () => {
  const notaConRiesgo =
    "J. refiere que ayer pensó que estaría mejor si desapareciera un tiempo.";
  const { lineas: lineasRiesgo } = numerarNota(notaConRiesgo);
  const crudo = {
    ...fixture.analisis,
    riesgo: { evaluado: true, indicadores: ["Ideación de desaparecer"] },
  };
  const conRiesgo = validarAnalisis(
    normalizarAnalisis(crudo, lineasRiesgo),
    notaConRiesgo
  );
  assert.ok(
    !conRiesgo.alertas.some((a) => a.codigo === "riesgo_posible_no_detectado"),
    "se emitió la alerta aunque el riesgo ya estaba recogido"
  );
});

prueba("no alerta de riesgo no detectado cuando la nota no tiene lenguaje de riesgo", () => {
  assert.ok(
    !informe.alertas.some((a) => a.codigo === "riesgo_posible_no_detectado"),
    "el caso 01 no debería disparar esta alerta"
  );
});

prueba("agrupar no pierde ni inventa ninguna propuesta señalada", () => {
  const grupos = agruparAlertas(informe.alertas);
  const conElemento = informe.alertas.filter((a) => a.elemento);
  const agrupados = grupos.flatMap((g) => g.elementos);
  assert.equal(
    new Set(agrupados).size,
    new Set(conElemento.map((a) => a.elemento)).size,
    "la agrupación cambió el número de propuestas señaladas"
  );
  assert.ok(grupos.length <= informe.alertas.length);
});

prueba("un mismo motivo se dice una vez, no una por intervención", () => {
  // El fallo que motivó la agrupación: en el caso 01 el validador emite varias
  // alertas de conducta de seguridad que solo se diferencian en la propuesta
  // citada. Repetir el motivo entierra el aviso bajo su propia repetición.
  const seguridad = con("prescribe_conducta_seguridad");
  assert.ok(seguridad.length > 1, "el caso 01 debería emitir más de una");
  const grupos = agruparAlertas(seguridad);
  assert.ok(
    grupos.length < seguridad.length,
    `no agrupó nada: ${grupos.length} grupos para ${seguridad.length} alertas`
  );
  assert.ok(
    grupos.every((g) => g.elementos.length > 0),
    "un grupo se quedó sin las propuestas a las que alcanza"
  );
});

prueba("el grupo se queda con la gravedad peor de las suyas", () => {
  const grupos = agruparAlertas([
    { codigo: "pasada_critica", origen: "ia", gravedad: "media", ruta: "situaciones[0]", mensaje: "m", elemento: "a" },
    { codigo: "pasada_critica", origen: "ia", gravedad: "alta", ruta: "situaciones[1]", mensaje: "m", elemento: "b" },
  ]);
  assert.equal(grupos.length, 1);
  assert.equal(grupos[0].gravedad, "alta");
});

prueba("no mezcla una comprobación determinista con una opinión de la IA", () => {
  const grupos = agruparAlertas([
    { codigo: "pasada_critica", origen: "validador", gravedad: "media", ruta: "riesgo", mensaje: "m" },
    { codigo: "pasada_critica", origen: "ia", gravedad: "media", ruta: "riesgo", mensaje: "m" },
  ]);
  assert.equal(grupos.length, 2, "el origen tiene que separar los grupos");
});

prueba("agrupar ordena por gravedad: alta primero", () => {
  // El caso 01 real emite las alertas mezcladas (media, alta, alta, media...);
  // sin ordenar, lo más urgente podía salir enterrado entre lo opcional.
  const grupos = agruparAlertas(informe.alertas);
  const gravedades = grupos.map((g) => g.gravedad);
  const primerMedia = gravedades.indexOf("media");
  const ultimaAlta = gravedades.lastIndexOf("alta");
  assert.ok(
    primerMedia === -1 || ultimaAlta === -1 || ultimaAlta < primerMedia,
    `una "media" quedó antes que una "alta": ${gravedades.join(", ")}`
  );
});

prueba("agrupar conserva el orden relativo dentro de la misma gravedad", () => {
  const grupos = agruparAlertas([
    { codigo: "conducta_sin_analisis", origen: "validador", gravedad: "media", ruta: "a", mensaje: "primera" },
    { codigo: "riesgo_posible_no_detectado", origen: "validador", gravedad: "media", ruta: "b", mensaje: "segunda" },
  ]);
  assert.deepEqual(
    grupos.map((g) => g.mensaje),
    ["primera", "segunda"],
    "el sort por gravedad reordenó alertas de la misma gravedad sin motivo"
  );
});

prueba("cada alerta dice en qué sección del informe puede haberse reflejado", () => {
  assert.equal(seccionDeRuta("capa_dbt.habilidades_sugeridas[1]"), "modalidad");
  assert.equal(seccionDeRuta("conductas_problema[0]"), "conductas");
  assert.equal(seccionDeRuta("lineas_de_intervencion_tentativas[2]"), "intervencion");
  assert.equal(seccionDeRuta("riesgo"), "riesgo");
  // Sin sección es mejor que la sección equivocada.
  assert.equal(seccionDeRuta("general"), null);
});

prueba("un plan de monitorización vacío o ausente es null, no un plan a medias", () => {
  // Un plan inventado sería peor que ninguno: el clínico lo seguiría. El
  // objeto vacío que a veces devuelve el modelo tiene que caer del lado de
  // "no hay plan", no del de "hay plan con los campos en blanco".
  const sinPlan = normalizarAnalisis(
    { ...fixture.analisis, plan_de_monitorizacion: undefined },
    lineas
  );
  assert.equal(sinPlan.plan_de_monitorizacion, null);

  const vacio = normalizarAnalisis(
    {
      ...fixture.analisis,
      plan_de_monitorizacion: {
        que_se_mide: "",
        con_que: "  ",
        cada_cuanto: "",
        criterio_de_revision: "",
      },
    },
    lineas
  );
  assert.equal(vacio.plan_de_monitorizacion, null);
});

prueba("un plan sin criterio de revisión se conserva, para poder señalar que falta", () => {
  // Descartarlo escondería el problema. El criterio es lo que convierte la
  // formulación en una hipótesis con fecha de revisión, así que su ausencia
  // tiene que llegar a la pantalla, no desaparecer en el parser.
  const parcial = normalizarAnalisis(
    {
      ...fixture.analisis,
      plan_de_monitorizacion: {
        que_se_mide: "Episodios de evitación en reuniones.",
        con_que: "Autorregistro.",
        cada_cuanto: "Semanal.",
      },
    },
    lineas
  );
  assert.ok(parcial.plan_de_monitorizacion);
  assert.equal(parcial.plan_de_monitorizacion.criterio_de_revision, "");
});

prueba("el análisis de soluciones pasa por la comprobación de conductas de seguridad", () => {
  // Es una propuesta de intervención como cualquier otra: si sugiere respirar
  // para calmarse en un caso donde respirar ya es el mantenedor, tiene que
  // avisar igual que si estuviera en conductas_alternativas.
  const crudo = JSON.parse(JSON.stringify(fixture.analisis));
  crudo.capa_dbt.analisis_de_soluciones = [
    {
      eslabon_objetivo: "Sensación de taquicardia",
      alternativa_habil: "Practicar respiración diafragmática hasta que baje la activación.",
      tipo_estrategia: "respuesta",
    },
  ];
  const conSolucion = validarAnalisis(normalizarAnalisis(crudo, lineas), nota);
  assert.ok(
    conSolucion.alertas.some(
      (a) =>
        a.codigo === "prescribe_conducta_seguridad" &&
        a.ruta.startsWith("capa_dbt.analisis_de_soluciones")
    ),
    "una solución DBT que prescribe el propio mantenedor pasó sin aviso"
  );
});

prueba("la reparación y el eslabón ausente son null salvo que haya motivo", () => {
  // Un campo que siempre se rellena produce disculpas de trámite; el
  // normalizador no puede convertir la ausencia en una cadena vacía que la
  // interfaz pintaría como un apartado más.
  const sinCapa = normalizarAnalisis({ ...fixture.analisis, capa_dbt: {} }, lineas);
  assert.equal(sinCapa.capa_dbt.plan_de_reparacion, null);
  assert.equal(sinCapa.capa_dbt.eslabon_ausente, null);
  assert.deepEqual(sinCapa.capa_dbt.analisis_de_soluciones, []);
  assert.deepEqual(sinCapa.capa_dbt.plan_de_prevencion, []);
});

prueba("un tipo de estrategia desconocido cae en la lectura conservadora", () => {
  // "respuesta" es la estrategia disponible una vez la cadena arrancó.
  // Suponer "antecedente" prometería un margen de maniobra anterior al eslabón
  // que nadie ha comprobado que exista.
  const crudo = JSON.parse(JSON.stringify(fixture.analisis));
  crudo.capa_dbt.analisis_de_soluciones = [
    { eslabon_objetivo: "x", alternativa_habil: "y", tipo_estrategia: "preventiva" },
  ];
  const normalizado = normalizarAnalisis(crudo, lineas);
  assert.equal(
    normalizado.capa_dbt.analisis_de_soluciones[0].tipo_estrategia,
    "respuesta"
  );
});

prueba("un esquema de contingencia ausente o inventado cae en no_determinable", () => {
  // El valor por defecto NO puede afirmar un esquema: el esquema decide la
  // dosis de exposición que el informe sugiere, y elegir "continua" porque el
  // modelo omitió la clave sería recomendar menos exposición apoyándose en un
  // descuido del proveedor.
  const crudo = JSON.parse(JSON.stringify(fixture.analisis));
  delete crudo.situaciones[0].cadena_operante.esquema_de_contingencia;
  crudo.situaciones[1].cadena_operante.esquema_de_contingencia = "razon variable";
  const normalizado = normalizarAnalisis(crudo, lineas);
  assert.equal(
    normalizado.situaciones[0].cadena_operante.esquema_de_contingencia,
    "no_determinable"
  );
  assert.equal(
    normalizado.situaciones[1].cadena_operante.esquema_de_contingencia,
    "no_determinable"
  );
});

prueba("el esquema no se deduce del tipo de contingencia", () => {
  // Son dos ejes independientes: qué pasa tras la respuesta y cada cuánto
  // pasa. Un R− puede ser continuo o intermitente, y el normalizador no puede
  // rellenar uno a partir del otro.
  const crudo = JSON.parse(JSON.stringify(fixture.analisis));
  crudo.situaciones[0].cadena_operante.tipo_contingencia = "refuerzo negativo";
  crudo.situaciones[0].cadena_operante.esquema_de_contingencia = "intermitente";
  crudo.situaciones[1].cadena_operante.tipo_contingencia = "refuerzo negativo";
  crudo.situaciones[1].cadena_operante.esquema_de_contingencia = "continua";
  const normalizado = normalizarAnalisis(crudo, lineas);
  assert.notEqual(
    normalizado.situaciones[0].cadena_operante.esquema_de_contingencia,
    normalizado.situaciones[1].cadena_operante.esquema_de_contingencia
  );
});

prueba("el repertorio disponible reparte las columnas sin perder ninguna conducta", () => {
  // Excesos y déficits salen del mismo campo: "deficit" a Déficits, todo lo
  // demás a Excesos. Si el reparto perdiera una conducta, desaparecería del
  // informe sin dar ningún error.
  const conductas = informe.conductas_problema;
  const deficits = conductas.filter((c) => c.deficit_o_interferencia === "deficit");
  const excesos = conductas.filter((c) => c.deficit_o_interferencia !== "deficit");
  assert.equal(deficits.length + excesos.length, conductas.length);
});

prueba("se detecta que una alternativa propuesta ya está en el repertorio", () => {
  // Proponer como adquisición algo que la persona ya emite en otro contexto
  // convierte un problema de generalización en un entrenamiento innecesario.
  const repertorio = [
    {
      descripcion: "Expone y defiende su criterio en conversaciones con amigos cercanos.",
    },
  ];
  assert.equal(
    yaEnRepertorio("Exponer su criterio en la reunión de equipo.", repertorio),
    true
  );
  assert.equal(
    yaEnRepertorio("Registrar la frecuencia semanal del consumo.", repertorio),
    false
  );
  // Sin repertorio declarado no hay nada que insinuar.
  assert.equal(yaEnRepertorio("Exponer su criterio.", []), false);
});

prueba("una lista de fortalezas vacía es un resultado válido, no un fallo", () => {
  // El principio 20 dice explícitamente que vacío es preferible a inventar. El
  // normalizador no puede convertir eso en otra cosa ni rellenarlo.
  const sinFortalezas = normalizarAnalisis(
    { ...fixture.analisis, fortalezas_y_recursos: undefined },
    lineas
  );
  assert.deepEqual(sinFortalezas.fortalezas_y_recursos, []);

  const conBasura = normalizarAnalisis(
    { ...fixture.analisis, fortalezas_y_recursos: ["Sostiene el empleo.", 3, null] },
    lineas
  );
  assert.deepEqual(conBasura.fortalezas_y_recursos, ["Sostiene el empleo."]);
});

prueba("los huecos y los avisos aterrizan en la misma sección de verificación", () => {
  // Eran dos secciones distintas del índice para la misma pregunta: qué hay
  // que comprobar antes de dar el informe por bueno.
  assert.equal(seccionDeRuta("datos_faltantes[0]"), "verificacion");
});

prueba("un dato faltante sin su porqué se conserva, no se descarta", () => {
  // COMPATIBILIDAD: los informes guardados antes de que el hueco llevara su
  // razón traen cadenas sueltas. Perder el hueco sería peor que mostrarlo sin
  // motivo declarado, que es lo que la interfaz dice explícitamente.
  const crudo = {
    ...fixture.analisis,
    datos_faltantes: ["Frecuencia de los episodios.", { dato: "Otro hueco." }, "", 7],
  };
  const antiguo = normalizarAnalisis(crudo, lineas);
  assert.deepEqual(antiguo.datos_faltantes, [
    { dato: "Frecuencia de los episodios.", por_que_importa: "" },
    { dato: "Otro hueco.", por_que_importa: "" },
  ]);
});

prueba("el porqué de un dato faltante no dispara la alerta de dependencia por su cuenta", () => {
  // El porqué habla del análisis ("deja sin decidir la priorización") y sus
  // palabras coinciden con las de casi cualquier intervención. Si entrara en
  // la comparación, V4 marcaría como condicional media docena de propuestas
  // que no dependen del dato.
  const crudo = JSON.parse(JSON.stringify(fixture.analisis));
  crudo.datos_faltantes = [
    { dato: "Zzzzzzzz irrelevante.", por_que_importa: "Deja la exposición sin dosis definida." },
  ];
  const informeConPorque = validarAnalisis(normalizarAnalisis(crudo, lineas), nota);
  assert.deepEqual(
    informeConPorque.alertas.filter(
      (a) => a.codigo === "intervencion_depende_de_dato_faltante"
    ),
    []
  );
});

prueba("el origen aterriza en su propia sección, no en la de mantenimiento", () => {
  // Separar origen de mantenimiento es la defensa contra tratar cómo se
  // adquirió el problema en vez de qué lo sostiene hoy. Si un aviso sobre el
  // origen enviara al clínico a "Hipótesis de mantenimiento", la separación
  // sería solo visual.
  assert.equal(seccionDeRuta("hipotesis_origen"), "hipotesis-origen");
  assert.equal(seccionDeRuta("hipotesis_mantenimiento[0]"), null);
  assert.notEqual(seccionDeRuta("hipotesis_origen"), "hipotesis-mantenimiento");
});

prueba("revalidarTrasReanalisis conserva las alertas de la pasada crítica", () => {
  // Un reanálisis de sección no repite la pasada crítica (cuesta dinero), así
  // que perder sus hallazgos al reanalizar sería descartar algo válido sobre
  // el resto del informe, que no cambió.
  const crudo = JSON.parse(JSON.stringify(fixture.analisis));
  const reanalizado = normalizarAnalisis(crudo, lineas);
  reanalizado.alertas = [
    { codigo: "pasada_critica", origen: "ia", gravedad: "media", ruta: "general", mensaje: "hallazgo de la pasada crítica" },
  ];
  const alertas = revalidarTrasReanalisis(reanalizado, nota);
  assert.ok(
    alertas.some((a) => a.origen === "ia" && a.mensaje === "hallazgo de la pasada crítica"),
    "perdió la alerta de la pasada crítica al reanalizar"
  );
});

prueba("revalidarTrasReanalisis sí degrada la confianza, a diferencia de una edición manual", () => {
  // El contenido reanalizado lo escribió la IA de nuevo, no el clínico: su
  // confianza debe revisarse igual que en la primera generación.
  const crudo = JSON.parse(JSON.stringify(fixture.analisis));
  crudo.situaciones[1].confianza = "alta";
  crudo.situaciones[1].cadena_operante.evidencia =
    "El cliente se molestó y ella acabó cediendo.";
  const reanalizado = normalizarAnalisis(crudo, lineas);
  reanalizado.alertas = [];
  const alertas = revalidarTrasReanalisis(reanalizado, nota);
  assert.equal(reanalizado.situaciones[1].confianza, "media");
  assert.ok(
    alertas.some((a) => a.codigo === "confianza_sin_cita"),
    "no se emitió la alerta de confianza sin cita"
  );
});

prueba("toda alerta del caso 01 aterriza en una sección conocida", () => {
  const sinSeccion = informe.alertas.filter((a) => seccionDeRuta(a.ruta) === null);
  assert.deepEqual(
    sinSeccion.map((a) => a.ruta),
    [],
    "hay rutas que no se traducen a ninguna sección del informe"
  );
});

console.log(`\n${pasadas} pruebas correctas`);
console.log(`\nAlertas emitidas sobre el informe de la v0.1.2: ${informe.alertas.length}`);
for (const a of informe.alertas) {
  console.log(`  [${a.gravedad}] ${a.codigo} · ${a.ruta}`);
}
console.log();
