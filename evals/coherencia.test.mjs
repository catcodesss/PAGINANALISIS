/**
 * Coherencia entre ficheros que ningún compilador vigila.
 *
 * Ejecutar:  node evals/coherencia.test.mjs
 *
 * Por qué existe: los fallos más caros de este proyecto no han sido errores de
 * lógica sino acuerdos tácitos entre dos ficheros que uno de los dos dejó de
 * cumplir — una escala de texto declarada en TypeScript y otra distinta en CSS,
 * una regla escrita a mano que Tailwind anula, un identificador de sección que
 * solo existe en una de las cuatro listas que lo usaban. Nada de eso da error:
 * da una preferencia que no hace nada, un enlace roto o un bloque que no se
 * imprime, y solo se ve mirándolo.
 *
 * Lo que se puede expresar en el sistema de tipos ya está allí (ver
 * `IdSeccion` en lib/secciones.ts). Aquí quedan los cruces que salen del
 * lenguaje: TypeScript contra CSS, y código contra la hoja de estilos.
 *
 * No gasta API.
 */

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = join(AQUI, "..");

// Mismo rodeo que evals/validadores.test.mjs: estos módulos se importan entre
// sí sin extensión, que Node no entiende en ESM.
execFileSync(
  process.execPath,
  [
    join(RAIZ, "node_modules/typescript/bin/tsc"),
    "lib/preferencias.ts",
    "lib/secciones.ts",
    "lib/ordenSecciones.ts",
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
const { ESCALA_TEXTO, claveEstiloGrafo } = require(
  join(RAIZ, ".tmp-evals/preferencias.js")
);
const { SECCIONES_INFORME, ANCLAS_INFORME } = require(
  join(RAIZ, ".tmp-evals/secciones.js")
);
const { reconciliarOrden } = require(join(RAIZ, ".tmp-evals/ordenSecciones.js"));

const css = readFileSync(join(RAIZ, "app/globals.css"), "utf8");
const reportView = readFileSync(join(RAIZ, "components/ReportView.tsx"), "utf8");
const grafoAFC = readFileSync(join(RAIZ, "components/grafo/GrafoAFC.tsx"), "utf8");
const estilosGrafo = ["dbt", "act", "mc"].map((estilo) =>
  readFileSync(join(RAIZ, `components/grafo/estilos/${estilo}.tsx`), "utf8")
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

console.log("\nCoherencia entre ficheros (TypeScript ↔ CSS ↔ componentes)\n");

/* ── Escala de texto ─────────────────────────────────────────────────────── */

prueba("cada tamaño de texto de TypeScript tiene su regla en CSS, con el mismo número", () => {
  for (const [nombre, escala] of Object.entries(ESCALA_TEXTO)) {
    if (escala === 1) continue; // "normal" es el valor base de html, sin regla propia
    const re = new RegExp(
      `html\\[data-texto="${nombre}"\\]\\s*\\{[^}]*--escala-texto:\\s*([\\d.]+)`
    );
    const m = css.match(re);
    assert.ok(m, `falta la regla CSS de "${nombre}" (lo declara ESCALA_TEXTO)`);
    assert.equal(
      Number(m[1]),
      escala,
      `"${nombre}": TypeScript dice ${escala} y el CSS dice ${m[1]}`
    );
  }
});

prueba("el CSS no define tamaños que TypeScript no ofrezca", () => {
  const enCss = [...css.matchAll(/html\[data-texto="([a-z]+)"\]/g)].map((m) => m[1]);
  const sobran = enCss.filter((n) => !(n in ESCALA_TEXTO));
  assert.deepEqual(sobran, [], "reglas CSS de tamaños que ya no existen");
});

/* ── Tamaños en píxeles literales ────────────────────────────────────────── */

prueba("todo text-[Npx] que se usa tiene su anulación escalada", () => {
  // Sin la anulación, esa clase se queda con el px fijo de Tailwind y deja de
  // obedecer a la preferencia de tamaño. No falla: simplemente no escala.
  const usados = new Set(
    [...reportView.matchAll(/\btext-\[(\d+)px\]/g)].map((m) => m[1])
  );
  const escalados = new Set(
    [...css.matchAll(/\.text-\\\[(\d+)px\\\]\s*\{[^}]*var\(--escala-texto\)/g)].map(
      (m) => m[1]
    )
  );
  const sinEscalar = [...usados].filter((px) => !escalados.has(px));
  assert.deepEqual(
    sinEscalar.sort(),
    [],
    `text-[Npx] sin regla en globals.css: ${sinEscalar.join(", ")}px`
  );
});

prueba("las anulaciones de tamaño están fuera de @layer, que es lo que las hace ganar", () => {
  // Tailwind emite su propia .text-[15px] dentro de @layer utilities. Lo no
  // encapsulado gana a lo encapsulado pase lo que pase con el orden; meter
  // estas reglas en una capa las volvería silenciosamente inertes.
  const dentroDeCapa = [];
  const re = /\.text-\\\[\d+px\\\]/g;
  let m;
  while ((m = re.exec(css)) !== null) {
    const antes = css.slice(0, m.index);
    const abiertas = (antes.match(/@layer[^;{]*\{/g) || []).length;
    // Cuenta llaves para saber si alguna capa sigue abierta en esa posición.
    if (abiertas > 0) {
      const cierres = (antes.match(/\}/g) || []).length;
      const aperturas = (antes.match(/\{/g) || []).length;
      if (aperturas > cierres) dentroDeCapa.push(m[0]);
    }
  }
  assert.deepEqual(dentroDeCapa, [], "hay anulaciones de tamaño dentro de @layer");
});

/* ── Bloques y anclas del informe ────────────────────────────────────────── */

const IDS = SECCIONES_INFORME.map((s) => s.id);
const IDS_ANCLA = ANCLAS_INFORME.map((a) => a.id);

/**
 * Los dos niveles del informe, que antes eran uno.
 *
 * `<Bloque>` es la unidad que se arrastra, se oculta y sale en el índice: son
 * cinco. `<Seccion>` es un apartado dentro de un bloque, y solo aporta un
 * ancla enlazable. Confundirlos es el fallo que estas pruebas cazan: un
 * apartado convertido en bloque volvería a meter diecisiete entradas en el
 * índice, y un bloque escrito como apartado desaparecería del orden sin dar
 * ningún error.
 */
function bloquesDibujados() {
  const componentes = {
    BloqueSintesis: "sintesis",
    BloqueAnalisisFuncional: "que-pasa",
    BloqueMantenimiento: "mantenimiento",
    BloquePlan: "plan",
    BloquePendientes: "pendientes",
  };
  return new Set(
    Object.entries(componentes)
      .filter(([nombre]) => new RegExp(`<${nombre}\\b`).test(reportView))
      .map(([, id]) => id)
  );
}

function anclasDibujadas() {
  const ids = [
    ...reportView.matchAll(/<Seccion\s+id="([^"]+)"/g),
    ...reportView.matchAll(/<Seccion\s*\n\s*id="([^"]+)"/g),
    // Las que no siguen el molde de <Seccion> pintan su <section id> a mano.
    ...reportView.matchAll(/<section\s+id="([^"]+)"/g),
    ...reportView.matchAll(/<span\s+id="([^"]+)"/g),
  ].map((m) => m[1]);
  return new Set(ids);
}

prueba("no hay identificadores repetidos, ni de bloque ni de ancla", () => {
  assert.equal(new Set(IDS).size, IDS.length);
  assert.equal(new Set(IDS_ANCLA).size, IDS_ANCLA.length);
  // Y un id no puede ser las dos cosas: el orden guardado no sabría cuál es.
  const ambos = IDS.filter((id) => IDS_ANCLA.includes(id));
  assert.deepEqual(ambos, [], "hay ids que son bloque y ancla a la vez");
});

prueba("los cinco bloques se dibujan, y no se dibuja ninguno de más", () => {
  const dibujados = bloquesDibujados();
  assert.deepEqual(
    IDS.filter((id) => !dibujados.has(id)),
    [],
    "bloques listados en el índice que nadie pinta"
  );
  assert.deepEqual(
    [...dibujados].filter((id) => !IDS.includes(id)),
    [],
    "bloques pintados que no están en lib/secciones.ts"
  );
});

prueba("toda ancla que se pinta está declarada, y toda la declarada se pinta", () => {
  // Un ancla sin declarar es un enlace que nadie puede alcanzar desde un aviso;
  // una declarada que nadie pinta es un enlace roto en el informe.
  const dibujadas = anclasDibujadas();
  assert.deepEqual(
    [...dibujadas].filter((id) => !IDS_ANCLA.includes(id)),
    [],
    "anclas pintadas que no están en ANCLAS_INFORME"
  );
  assert.deepEqual(
    IDS_ANCLA.filter((id) => !dibujadas.has(id)),
    [],
    "anclas declaradas que ReportView no pinta"
  );
});

prueba("cada ancla pertenece a un bloque que existe", () => {
  const huerfanas = ANCLAS_INFORME.filter((a) => !IDS.includes(a.bloque)).map(
    (a) => a.id
  );
  assert.deepEqual(huerfanas, [], "anclas con un bloque que no existe");
});

prueba("ningún bloque se queda sin anclas", () => {
  // Un bloque vacío ocupa una entrada del índice para no decir nada.
  const vacios = IDS.filter(
    (b) => !ANCLAS_INFORME.some((a) => a.bloque === b)
  );
  assert.deepEqual(vacios, []);
});

prueba("el título del índice y el del encabezado salen de la misma lista", () => {
  /*
    El índice saca el título de lib/secciones.ts y antes la tarjeta lo recibía
    como prop: eran dos sitios y nada los comparaba. Al renombrar «Variables
    moduladoras» se cambió solo uno, y el resultado fue un índice que enviaba a
    una sección con otro nombre — sin error, sin enlace roto, solo un documento
    que se contradice.

    Ahora <Bloque> no acepta `titulo`: lo lee de TITULO_DE_SECCION. Esta prueba
    fija esa decisión, porque volver a pasarlo como prop reabriría el fallo.
  */
  const conTitulo = [...reportView.matchAll(/<Bloque(?:Sintesis|AnalisisFuncional|Mantenimiento|Plan|Pendientes)\b[^>]*\btitulo=/g)];
  assert.deepEqual(
    conTitulo.map((m) => m[0]),
    [],
    "algún <Bloque> vuelve a recibir el título como prop"
  );
});

prueba("todo bloque y toda ancla tienen título, y ninguno se repite", () => {
  const titulos = [
    ...SECCIONES_INFORME.map((s) => s.titulo),
    ...ANCLAS_INFORME.map((a) => a.titulo),
  ];
  assert.ok(titulos.every((t) => t && t.trim().length > 0));
  assert.equal(new Set(titulos).size, titulos.length, "hay títulos duplicados");
});

/* ── Selector de lente ───────────────────────────────────────────────────── */

prueba("el selector de lente aparece una sola vez en el informe", () => {
  // Repetir el mando en cada sección no daba más control: daba ocasiones de
  // leer una situación en ACT y la de al lado en DBT sin darse cuenta. Si
  // alguien vuelve a colocar un <SelectorDeLente> dentro de una sección, esto
  // lo caza — no da error, solo devuelve el problema que se acaba de quitar.
  const usos = [...reportView.matchAll(/<SelectorDeLente\b/g)];
  assert.equal(
    usos.length,
    1,
    `el selector de lente se pinta ${usos.length} veces; tiene que ser una`
  );
});

prueba("la lente elegida no vive en el estado del componente", () => {
  // Es una preferencia del terapeuta, no del informe: se guarda como el orden
  // de los bloques (ver components/useLente.ts). Con useState volvería a ACT en
  // cada informe nuevo, que es justo lo que se quería dejar de pedirle.
  assert.ok(
    /useLente\(/.test(reportView),
    "ReportView ya no usa la preferencia persistida de lente"
  );
  assert.ok(
    !/useState<ModeloTerapeutico>/.test(reportView),
    "la lente volvió a un useState local"
  );
});

prueba("los estilos del grafo son proyecciones locales de una sola colección", () => {
  assert.equal(
    [...grafoAFC.matchAll(/construirNodosGrafo\(analisis\)/g)].length,
    1,
    "el contenedor dejó de construir una única colección de nodos"
  );
  for (const fuente of estilosGrafo) {
    assert.ok(/nodos:\s*readonly NodoGrafo\[\]/.test(fuente));
    assert.ok(/renderNodo/.test(fuente));
    assert.ok(!/\bfetch\s*\(/.test(fuente), "un cambio de estilo hace una petición de red");
  }
});

prueba("el estilo del grafo se guarda por referencia de caso", () => {
  assert.notEqual(claveEstiloGrafo("M.34"), claveEstiloGrafo("L.12"));
  assert.equal(claveEstiloGrafo(""), "acia-estilo-grafo:borrador");
});

/* ── Orden de fábrica de las anclas ──────────────────────────────────────── */

prueba("el orden de fábrica de las anclas no entremezcla bloques", () => {
  // Si un bloque aparece, se acaba y vuelve a aparecer más abajo, el informe se
  // lee como si dos tramos distintos fueran el mismo — y al montar el árbol de
  // React las anclas de ese bloque quedarían partidas en dos sitios.
  const posiciones = ANCLAS_INFORME.map((a) => IDS.indexOf(a.bloque));
  assert.deepEqual(
    posiciones,
    [...posiciones].sort((x, y) => x - y),
    `un bloque se interrumpe y vuelve: ${ANCLAS_INFORME.map((a) => a.bloque).join(" ")}`
  );
});

prueba("las anclas se pintan dentro del bloque que declaran", () => {
  /*
    El acuerdo que nada más comprueba: ANCLAS_INFORME dice a qué bloque
    pertenece cada apartado, y ReportView lo monta anidándolo en un <Bloque>.
    Si los dos dejan de coincidir no hay error — hay un apartado que se arrastra
    con el bloque equivocado y un índice que miente sobre dónde está.
  */
  const mal = [];
  const componentes = {
    sintesis: "BloqueSintesis",
    "que-pasa": "BloqueAnalisisFuncional",
    mantenimiento: "BloqueMantenimiento",
    plan: "BloquePlan",
    pendientes: "BloquePendientes",
  };
  for (const b of IDS) {
    const componente = componentes[b];
    const ini = reportView.indexOf(`<${componente}`);
    assert.notEqual(ini, -1, `no se pinta el bloque ${b}`);
    const fin = reportView.indexOf(`</${componente}>`, ini);
    const dentro = reportView.slice(ini, fin);
    for (const a of ANCLAS_INFORME.filter((x) => x.bloque === b)) {
      if (!dentro.includes(`id="${a.id}"`)) mal.push(`${a.id} debería estar en ${b}`);
    }
  }
  assert.deepEqual(mal, []);
});

/* ── Conciliación del orden guardado ─────────────────────────────────────── */

prueba("un orden guardado con ids que ya no existen se concilia sin romperse", () => {
  // Los ids viejos que queden en localStorage —una sección retirada, o dos que
  // se fusionaron en una— tienen que caerse solos, sin dejar el informe con
  // una sección de menos ni una entrada muerta en el índice.
  const conBasura = reconciliarOrden(
    ["seccion-que-ya-no-existe", "resumen", 42, null, "alertas", "datos-faltantes"],
    IDS
  );
  assert.deepEqual(
    conBasura.filter((id) => !IDS.includes(id)),
    [],
    "sobrevivió un id que no está en lib/secciones.ts"
  );
  assert.deepEqual(
    [...conBasura].sort(),
    [...IDS].sort(),
    "la conciliación perdió o duplicó alguna sección"
  );
});

prueba("el orden elegido sobrevive a la conciliación, sin reacomodos", () => {
  /*
    Esta prueba sustituye a «el grupo manda sobre la posición guardada», que
    fijaba lo contrario: que una sección no pudiera salirse de su grupo. Desde
    que el bloque ES el grupo no hay nada por encima que respetar, y el paso
    que reordenaba por grupo al final habría devuelto siempre el orden de
    fábrica — con el arrastre funcionando en pantalla y sin efecto ninguno al
    recargar. Se fue de lib/ordenSecciones.ts, y esto vigila que no vuelva.
  */
  const ultimo = IDS[IDS.length - 1];
  const movido = [ultimo, ...IDS.filter((id) => id !== ultimo)];
  assert.deepEqual(reconciliarOrden(movido, IDS), movido);
});

prueba("el orden elegido entre bloques se respeta entero", () => {
  // Cinco bloques y ninguna jerarquía por encima: lo que el clínico ordene es
  // lo que sale, sin que nada lo reacomode por detrás.
  const invertido = [...IDS].reverse();
  assert.deepEqual(reconciliarOrden(invertido, IDS), invertido);
});



console.log(`\n${pasadas} pruebas correctas\n`);
