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
    "lib/redFuncional.ts",
    "lib/priorizacion.ts",
    "lib/cobertura.ts",
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
const { construirRedFuncional } = require(join(RAIZ, ".tmp-evals/redFuncional.js"));
const { calcularCobertura } = require(join(RAIZ, ".tmp-evals/cobertura.js"));
const { priorizarBlancos, VALOR_CUALITATIVO, RENDIMIENTO_MAXIMO } = require(
  join(RAIZ, ".tmp-evals/priorizacion.js")
);

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

/* ── Rejilla de contexto y procesos ──────────────────────────────────────── */

prueba("un informe con la clasificación vieja sigue pintándose en la rejilla", () => {
  // COMPATIBILIDAD: los informes guardados en el historial traen un solo campo
  // `tipo`. Sin el mapeo, la rejilla saldría entera vacía — no un fallo
  // visible, sino un informe antiguo que de pronto parece no haber evaluado
  // nada.
  const antiguo = normalizarAnalisis(
    {
      ...fixture.analisis,
      variables_moduladoras: [
        { tipo: "biologica", descripcion: "Hipotiroidismo en tratamiento." },
        { tipo: "contextual", descripcion: "Turnos rotativos en el trabajo." },
        { tipo: "historia_de_aprendizaje", descripcion: "Padre crítico." },
      ],
    },
    lineas
  );
  const [bio, ctx, hist] = antiguo.variables_moduladoras;
  assert.equal(bio.nivel, "biofisiologico");
  assert.equal(ctx.nivel, "sociocultural");
  // La historia de aprendizaje no era un nivel: era un momento.
  assert.equal(hist.nivel, "psicologico");
  assert.equal(hist.momento, "historico");
  assert.equal(bio.momento, "actual");
});

prueba("la cobertura cuenta celdas con dato, no calidad", () => {
  // Se llama cobertura de datos y no confianza a propósito: una rejilla llena
  // de datos malos no vale más que una incompleta con datos buenos. Lo único
  // que puede hacer este cálculo es contar casillas.
  const cobertura = calcularCobertura(informe.variables_moduladoras);
  assert.equal(cobertura.totales, 18, "3 niveles × 6 dimensiones");
  assert.equal(cobertura.celdas.length, 18, "la rejilla se emite siempre entera");
  assert.equal(
    cobertura.conDato + cobertura.huecos.length,
    cobertura.totales,
    "las celdas con dato y los huecos no suman la rejilla"
  );
  // Ninguna variable se reparte entre celdas: eso inflaría la cobertura.
  const repartidas = cobertura.celdas.reduce((n, c) => n + c.variables.length, 0);
  assert.equal(repartidas, informe.variables_moduladoras.length);
});

prueba("una rejilla sin variables es 0 de 18, no un error", () => {
  const vacia = calcularCobertura([]);
  assert.equal(vacia.conDato, 0);
  assert.equal(vacia.porcentaje, 0);
  assert.equal(vacia.huecos.length, 18);
});

/* ── Priorización estimada ───────────────────────────────────────────────── */

prueba("la priorización cruza importancia con modificabilidad, no una sola", () => {
  // Es la idea clínica entera: el tratamiento rinde donde algo PESA y además
  // PUEDE MOVERSE. La misma conducta, con la misma importancia, tiene que
  // subir cuando la variable que la mantiene se vuelve más modificable.
  //
  // El ranking es de CONDUCTAS desde que se unificaron los dos que había (ver
  // lib/priorizacion.ts): la variable moduladora no es un blanco, es la palanca
  // por la que una conducta concreta se mueve.
  // Se sigue LA MISMA conducta en las tres corridas, buscándola por la palanca
  // que se está moviendo. Tomar "la primera con palanca" compararía conductas
  // distintas, porque cambiar la modificabilidad cambia el propio orden.
  const idPalanca = normalizarAnalisis(
    JSON.parse(JSON.stringify(fixture.analisis)),
    lineas
  ).variables_moduladoras[0].id;

  const conModificabilidad = (nivel) => {
    const crudo = JSON.parse(JSON.stringify(fixture.analisis));
    crudo.variables_moduladoras[0].modificabilidad = nivel;
    const analisis = normalizarAnalisis(crudo, lineas);
    const blanco = priorizarBlancos(analisis).find(
      (b) => b.palanca?.id === idPalanca
    );
    assert.ok(blanco, "ninguna conducta cuelga de esa variable moduladora");
    return blanco.rendimiento;
  };

  assert.ok(conModificabilidad("baja") < conModificabilidad("media"));
  assert.ok(conModificabilidad("media") < conModificabilidad("alta"));
});

prueba("la escala es geométrica: alta×baja empata con media×media", () => {
  // Consecuencia deliberada de 0,8 / 0,4 / 0,2 (cada nivel es el doble del
  // siguiente): un factor determinante pero rígido y uno intermedio en las dos
  // escalas rinden lo mismo. Es la lectura clínica que se quiere, y se fija
  // aquí para que nadie "arregle" el empate cambiando los números sin darse
  // cuenta de que con eso cambia el criterio.
  assert.equal(
    VALOR_CUALITATIVO.alta * VALOR_CUALITATIVO.baja,
    VALOR_CUALITATIVO.media * VALOR_CUALITATIVO.media
  );
});

prueba("una conducta sin palanca trazada no recibe un rendimiento inventado", () => {
  // La contrapartida de la prueba anterior, y la razón de que `rendimiento`
  // pueda ser null: si ninguna variable moduladora llega trazada hasta la
  // conducta, no se sabe por dónde moverla. Un cero se leería como "esto no
  // sirve de nada", cuando lo que pasa es que el informe no lo ha dicho — y esa
  // diferencia decide si el clínico descarta el blanco o lo pregunta.
  const blancos = priorizarBlancos(informe);

  // Toda conducta problema aparece: ninguna desaparece por no tener palanca.
  assert.equal(blancos.length, informe.conductas_problema.length);

  for (const b of blancos) {
    if (b.palanca === null) {
      assert.equal(b.rendimiento, null, "rendimiento inventado sin palanca");
    } else {
      assert.ok(b.rendimiento > 0, "una palanca trazada tiene que puntuar");
    }
  }

  // Y las que no tienen palanca van al final, nunca intercaladas.
  const sinPalanca = blancos.findIndex((b) => b.rendimiento === null);
  if (sinPalanca !== -1) {
    assert.ok(
      blancos.slice(sinPalanca).every((b) => b.rendimiento === null),
      "un blanco con rendimiento aparece detrás de uno sin palanca"
    );
  }
});

prueba("la conversión a números está en un solo sitio y ordena de mayor a menor", () => {
  assert.deepEqual(VALOR_CUALITATIVO, { alta: 0.8, media: 0.4, baja: 0.2 });
  // El salto de media a alta pesa más que el de baja a media: es la distancia
  // real entre las tres etiquetas en la práctica clínica.
  assert.ok(
    VALOR_CUALITATIVO.alta - VALOR_CUALITATIVO.media >
      VALOR_CUALITATIVO.media - VALOR_CUALITATIVO.baja
  );
  assert.equal(RENDIMIENTO_MAXIMO, 0.8 * 0.8);

  // Solo los que puntúan entran en la comprobación de orden: los que no tienen
  // palanca no llevan número y van al final (ver la prueba de arriba).
  const rendimientos = priorizarBlancos(informe)
    .map((b) => b.rendimiento)
    .filter((r) => r !== null);
  assert.deepEqual(rendimientos, [...rendimientos].sort((a, b) => b - a));
  // Ningún blanco puede salirse de la escala fija con la que se dibuja la barra.
  assert.ok(rendimientos.every((r) => r > 0 && r <= RENDIMIENTO_MAXIMO));
});

/* ── Red funcional ───────────────────────────────────────────────────────── */

prueba("la red funcional encuentra el bucle que la prosa esconde", () => {
  // Es lo único que el dibujo aporta sobre la lista de hipótesis: una relación
  // bidireccional es un ciclo cerrado, y un ciclo cerrado cambia el plan.
  const red = construirRedFuncional(informe);
  assert.equal(red.motivoVacio, null, "no se pudo construir la red");
  assert.ok(red.bucles.length > 0, "no detectó ningún bucle");
  assert.ok(
    red.aristas.some((a) => a.enBucle),
    "ninguna arista quedó marcada como parte de un bucle"
  );
});

prueba("el mismo informe da siempre el mismo dibujo", () => {
  // Sin esto, dos capturas del mismo caso no se podrían comparar y el
  // diagrama dejaría de servir como registro.
  const a = construirRedFuncional(informe);
  const b = construirRedFuncional(informe);
  assert.deepEqual(a.nodos, b.nodos);
  assert.deepEqual(a.aristas, b.aristas);
  assert.deepEqual(a.bucles, b.bucles);
});

prueba("sin relaciones suficientes no se dibuja nada, y se dice por qué", () => {
  // Degradar con dignidad: un hueco sin explicación se lee como un fallo de la
  // página, cuando lo que pasa es que el informe no declaró bastantes
  // relaciones.
  const unaSola = construirRedFuncional({
    ...informe,
    hipotesis_mantenimiento: informe.hipotesis_mantenimiento.slice(0, 1),
  });
  assert.deepEqual(unaSola.nodos, []);
  assert.ok(unaSola.motivoVacio && unaSola.motivoVacio.length > 20);

  // Hipótesis a las que les falta un extremo: tampoco se inventan aristas para
  // rellenar el dibujo.
  //
  // Desde la v2 el extremo es un id y no una frase. Esta prueba borraba el
  // `enunciado` —porque el origen se extraía de esa prosa en cada render— y eso
  // ya no quita la relación, con razón: lo que sostiene la arista es el dato,
  // no cómo esté redactada la hipótesis. Lo que hay que seguir garantizando, y
  // es lo que se comprueba, es que un extremo SIN RESOLVER no se rellene con la
  // entidad más parecida.
  const sinExtremos = construirRedFuncional({
    ...informe,
    hipotesis_mantenimiento: informe.hipotesis_mantenimiento.map((h) => ({
      ...h,
      origen_id: null,
      enunciado: "Mantenida por una contingencia no especificada.",
    })),
  });
  assert.deepEqual(sinExtremos.aristas, []);
  assert.ok(sinExtremos.motivoVacio);
  // Y se dice cuántas se quedaron fuera, en vez de desaparecer sin más.
  assert.equal(sinExtremos.sinResolver, informe.hipotesis_mantenimiento.length);
});

prueba("el tamaño del nodo sale de la importancia, no del orden", () => {
  const red = construirRedFuncional(informe);
  const conductas = red.nodos.filter((n) => n.tipo === "conducta");
  assert.ok(conductas.length > 0);
  for (const n of conductas) {
    const original = informe.conductas_problema.find(
      (c) => c.descripcion === n.etiqueta
    );
    assert.ok(original, `nodo sin conducta de origen: ${n.etiqueta}`);
    if (original.importancia === "alta") assert.equal(n.radio, 26);
    if (original.importancia === "baja") assert.equal(n.radio, 15);
  }
});

prueba("fuerza y confianza son escalas distintas y no se copian entre sí", () => {
  // La confianza mide cuánto respalda la nota lo afirmado; la fuerza, cuánto
  // pesa la relación en el mantenimiento. Si el parser rellenara una con la
  // otra, la red funcional dibujaría grosores que en realidad miden respaldo
  // documental, y la priorización ordenaría por lo mismo.
  const crudo = JSON.parse(JSON.stringify(fixture.analisis));
  crudo.hipotesis_mantenimiento[0].confianza = "alta";
  crudo.hipotesis_mantenimiento[0].fuerza = "baja";
  const normalizado = normalizarAnalisis(crudo, lineas);
  assert.equal(normalizado.hipotesis_mantenimiento[0].confianza, "alta");
  assert.equal(normalizado.hipotesis_mantenimiento[0].fuerza, "baja");
});

prueba("los coeficientes ausentes caen del lado que afirma menos", () => {
  // "bidireccional" declara un bucle y "moderadora"/"mediadora" declaran algo
  // sobre el mecanismo: ninguna de las tres puede salir de una clave que el
  // modelo omitió. Y una modificabilidad supuesta alta subiría la posición de
  // la variable en la priorización sin nada que lo sostenga.
  const crudo = JSON.parse(JSON.stringify(fixture.analisis));
  delete crudo.hipotesis_mantenimiento[0].fuerza;
  delete crudo.hipotesis_mantenimiento[0].direccion;
  delete crudo.hipotesis_mantenimiento[0].tipo_relacion;
  delete crudo.variables_moduladoras[0].modificabilidad;
  const normalizado = normalizarAnalisis(crudo, lineas);
  const h = normalizado.hipotesis_mantenimiento[0];
  assert.equal(h.fuerza, "baja");
  assert.equal(h.direccion, "unidireccional");
  assert.equal(h.tipo_relacion, "causal");
  assert.equal(normalizado.variables_moduladoras[0].modificabilidad, "baja");
});

prueba("un plan de monitorización vacío o ausente es una lista vacía, no un plan a medias", () => {
  // Un plan inventado sería peor que ninguno: el clínico lo seguiría. El
  // objeto vacío que a veces devuelve el modelo tiene que caer del lado de
  // "no hay plan", no del de "hay plan con los campos en blanco".
  const sinPlan = normalizarAnalisis(
    { ...fixture.analisis, plan_de_monitorizacion: undefined },
    lineas
  );
  assert.deepEqual(sinPlan.plan_de_monitorizacion, []);

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
  assert.deepEqual(vacio.plan_de_monitorizacion, []);
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
  assert.equal(parcial.plan_de_monitorizacion.length, 1);
  assert.equal(parcial.plan_de_monitorizacion[0].criterio_de_revision, "");
});

prueba("la razón de una intervención no dispara el aviso de conducta de seguridad", () => {
  // El porqué nombra a menudo el propio mantenedor para retirarlo: «se retira
  // la respiración porque funciona como conducta de seguridad». Si V3 mirara
  // el porqué, avisaría justo en la intervención que hace lo correcto. En la
  // intervención, en cambio, tiene que seguir avisando.
  const crudo = JSON.parse(JSON.stringify(fixture.analisis));
  crudo.conductas_alternativas = [];
  crudo.lineas_de_intervencion_tentativas = [
    {
      conducta: "Evita exponer resultados en reuniones",
      intervencion: "Exposición gradual a exponer en reuniones sin salir de la sala.",
      porque: "Se retira la respiración en el baño porque funciona como conducta de seguridad.",
      depende_de: null,
    },
    {
      conducta: "Evita exponer resultados en reuniones",
      intervencion: "Respiración diafragmática antes de exponer.",
      porque: "Para bajar la activación.",
      depende_de: null,
    },
  ];
  const a = validarAnalisis(normalizarAnalisis(crudo, lineas), nota);
  const rutas = a.alertas
    .filter((x) => x.codigo === "prescribe_conducta_seguridad")
    .map((x) => x.ruta);
  assert.ok(!rutas.includes("lineas_de_intervencion_tentativas[0]"), "salta por el porqué");
  assert.ok(rutas.includes("lineas_de_intervencion_tentativas[1]"), "no salta en la intervención");
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
