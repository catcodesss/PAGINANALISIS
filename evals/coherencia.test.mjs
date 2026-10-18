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
import { readFileSync, readdirSync } from "node:fs";
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
const { SECCIONES_INFORME, ANCLAS_INFORME, VISTAS_ESPACIO, DONDE_SE_VE } = require(
  join(RAIZ, ".tmp-evals/secciones.js")
);
const { reconciliarOrden } = require(join(RAIZ, ".tmp-evals/ordenSecciones.js"));

const css = readFileSync(join(RAIZ, "app/globals.css"), "utf8");
const reportView = readFileSync(join(RAIZ, "components/ReportView.tsx"), "utf8");

/*
  Todo el código del informe, no solo ReportView.

  Las clases de tamaño se repartieron por components/informe/ al trocear el
  fichero, y una comprobación que siguiera mirando solo ReportView habría
  seguido en verde sin vigilar ya casi nada: el caso exacto de acuerdo tácito
  que esta suite existe para cazar.
*/
const leerCarpeta = (carpeta) =>
  readdirSync(join(RAIZ, carpeta))
    .filter((f) => f.endsWith(".tsx"))
    .map((f) => readFileSync(join(RAIZ, carpeta, f), "utf8"));
// Desde la fase 5 el informe es el espacio de trabajo: sus piezas viven en
// components/espacio/, y sus clases de tamaño también tienen que obedecer.
const fuentesInforme = [...leerCarpeta("components/informe"), ...leerCarpeta("components/espacio")];
const fuente = (ruta) => readFileSync(join(RAIZ, ruta), "utf8");
const codigoInforme = [reportView, ...fuentesInforme].join("\n");
const grafoAFC = readFileSync(join(RAIZ, "components/grafo/GrafoAFC.tsx"), "utf8");
const tablero = readFileSync(join(RAIZ, "components/grafo/TableroSituacion.tsx"), "utf8");
const estilosGrafo = ["act"].map((estilo) =>
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

/* ── Bloques, anclas y vistas del espacio ────────────────────────────────── */

const IDS = SECCIONES_INFORME.map((s) => s.id);
const IDS_ANCLA = ANCLAS_INFORME.map((a) => a.id);
const IDS_VISTA = VISTAS_ESPACIO.map((v) => v.id);

/*
  Dos estructuras desde la fase 5, y no se pueden confundir:

  - Los cinco BLOQUES y sus ANCLAS son el documento exportado (texto, Word,
    impresión) y los ids que guardan `secciones_editadas` y los avisos.
  - Las VISTAS (Mapa, Blancos) y los LUGARES (raíl, Inspector, cabecera,
    bandeja) son dónde se ve cada cosa en pantalla.

  `DONDE_SE_VE` (lib/secciones.ts) une las dos. Estas pruebas cazan lo que el
  compilador no ve: un lugar nombrado que nadie pinta, o un ancla que dice
  vivir en un sitio donde no está. Ninguno de los dos da error: dan un aviso
  que no lleva a ninguna parte.
*/
const espacio = fuente("components/espacio/EspacioTrabajo.tsx");
const FUENTE_DE_LUGAR = {
  mapa: fuente("components/espacio/VistaMapa.tsx"),
  blancos: espacio + fuente("components/informe/BloquePlan.tsx"),
  "raíl": fuente("components/espacio/Rail.tsx"),
  cabecera: fuente("components/espacio/Cabecera.tsx"),
  bandeja: fuente("components/espacio/Cabecera.tsx"),
  inspector: fuente("components/espacio/Inspector.tsx"),
};

/**
 * Lo que el Inspector enseña no tiene ancla propia (depende de lo
 * seleccionado). Para esas anclas se comprueba que el Inspector pinta el
 * concepto, por el rótulo con que lo presenta.
 */
const ROTULO_EN_INSPECTOR = {
  "hipotesis-principal": "Hipótesis de mantenimiento",
  "hipotesis-alternativas": "Hipótesis rivales",
};

function idsPintados(codigo) {
  // `id="x"` o, en el raíl, `id={ancla("x")}` (que lo omite en su copia del móvil).
  return new Set(
    [...codigo.matchAll(/\bid="([^"]+)"/g), ...codigo.matchAll(/\bid=\{ancla\("([^"]+)"\)\}/g)].map((m) => m[1])
  );
}

prueba("no hay identificadores repetidos, ni de bloque, ni de ancla, ni de vista", () => {
  assert.equal(new Set(IDS).size, IDS.length);
  assert.equal(new Set(IDS_ANCLA).size, IDS_ANCLA.length);
  assert.equal(new Set(IDS_VISTA).size, IDS_VISTA.length);
  // Y un id no puede ser las dos cosas: el orden guardado no sabría cuál es.
  const ambos = IDS.filter((id) => IDS_ANCLA.includes(id));
  assert.deepEqual(ambos, [], "hay ids que son bloque y ancla a la vez");
});

prueba("las vistas del espacio se pintan, y no se pinta ninguna de más", () => {
  // EspacioTrabajo elige por `vista === "<id>"`: toda vista declarada tiene su
  // rama, y no hay ramas para vistas que no estén en lib/secciones.ts.
  const ramas = new Set([...espacio.matchAll(/vista === "([a-z]+)"/g)].map((m) => m[1]));
  const sinPintar = IDS_VISTA.filter((id) => !ramas.has(id) && id !== "blancos");
  assert.deepEqual(sinPintar, [], "vistas listadas que nadie pinta");
  assert.deepEqual([...ramas].filter((id) => !IDS_VISTA.includes(id)), [], "vistas pintadas que no están en VISTAS_ESPACIO");
  // Blancos es la rama del «si no»: tiene que pintar el plan.
  assert.match(espacio, /<BloquePlan\b/);
  assert.match(espacio, /<VistaMapa\b/);
});

prueba("toda ancla del documento tiene un sitio donde verse en pantalla", () => {
  assert.deepEqual(
    IDS_ANCLA.filter((id) => !(id in DONDE_SE_VE)),
    [],
    "anclas sin lugar en DONDE_SE_VE"
  );
  assert.deepEqual(
    Object.keys(DONDE_SE_VE).filter((id) => !IDS_ANCLA.includes(id)),
    [],
    "DONDE_SE_VE nombra anclas que no existen"
  );
});

prueba("cada ancla se pinta en el lugar que DONDE_SE_VE declara", () => {
  const mal = [];
  for (const [ancla, lugar] of Object.entries(DONDE_SE_VE)) {
    const codigo = FUENTE_DE_LUGAR[lugar];
    if (!codigo) {
      mal.push(`${ancla}: el lugar «${lugar}» no tiene componente`);
      continue;
    }
    if (lugar === "inspector") {
      const rotulo = ROTULO_EN_INSPECTOR[ancla];
      if (!rotulo || !codigo.includes(rotulo)) mal.push(`${ancla}: el Inspector no lo enseña`);
      continue;
    }
    if (!idsPintados(codigo).has(ancla)) mal.push(`${ancla} debería pintarse en ${lugar}`);
  }
  assert.deepEqual(mal, []);
});

prueba("cada ancla pertenece a un bloque que existe", () => {
  const huerfanas = ANCLAS_INFORME.filter((a) => !IDS.includes(a.bloque)).map((a) => a.id);
  assert.deepEqual(huerfanas, [], "anclas con un bloque que no existe");
});

prueba("ningún bloque se queda sin anclas", () => {
  // Un bloque vacío ocupa un apartado del documento para no decir nada.
  const vacios = IDS.filter((b) => !ANCLAS_INFORME.some((a) => a.bloque === b));
  assert.deepEqual(vacios, []);
});

prueba("todo bloque, toda ancla y toda vista tienen título, y ninguno se repite", () => {
  const titulos = [
    ...SECCIONES_INFORME.map((s) => s.titulo),
    ...ANCLAS_INFORME.map((a) => a.titulo),
  ];
  assert.ok(titulos.every((t) => t && t.trim().length > 0));
  assert.equal(new Set(titulos).size, titulos.length, "hay títulos duplicados");
  assert.ok(VISTAS_ESPACIO.every((v) => v.titulo.trim().length > 0));
});

prueba("ya no hay pestañas en el informe", () => {
  // Las cinco pestañas se sustituyeron por el espacio de trabajo. Volver a
  // montarlas reabriría el informe de 12.800 px con la misma conducta en
  // catorce sitios.
  assert.doesNotMatch(reportView, /<BarraPestanas\b/);
  assert.match(reportView, /<EspacioTrabajo\b/);
});

prueba("lo impreso sale del mismo texto que el Word y el portapapeles", () => {
  const impreso = fuente("components/espacio/DocumentoImpreso.tsx");
  assert.match(impreso, /formatearInformeTexto\(/);
  assert.match(reportView, /<DocumentoImpreso\b/);
  // El espacio de trabajo no se imprime.
  assert.match(espacio, /print:hidden/);
});

/* ── Niveles del Mapa ────────────────────────────────────────────────────── */

const vistaMapa = FUENTE_DE_LUGAR.mapa;

prueba("el selector de nivel aparece una sola vez en el informe", () => {
  // Repetir el mando en cada sección no daba más control: daba ocasiones de
  // leer una situación a un nivel y la de al lado a otro sin darse cuenta.
  const usos = [...codigoInforme.matchAll(/aria-label="Nivel del Mapa"/g)].length;
  assert.equal(usos, 1, `el selector de nivel se pinta ${usos} veces; tiene que ser una`);
});

prueba("el nivel elegido no vive en el estado del componente", () => {
  // Es una preferencia del terapeuta, por caso (components/useLente.ts).
  assert.ok(/useNivelMapa\(/.test(vistaMapa), "el Mapa ya no usa la preferencia persistida de nivel");
  assert.ok(!/useState<NivelMapa>/.test(vistaMapa), "el nivel volvió a un useState local");
});

prueba("los niveles y las capas son proyecciones locales de una sola colección", () => {
  assert.equal(
    [...grafoAFC.matchAll(/construirNodosGrafo\(analisis\)/g)].length,
    1,
    "el contenedor dejó de construir una única colección de nodos"
  );
  for (const fuente of [...estilosGrafo, tablero]) {
    assert.ok(/nodos:\s*readonly NodoGrafo\[\]/.test(fuente));
    assert.ok(/renderNodo/.test(fuente));
    assert.ok(!/\bfetch\s*\(/.test(fuente), "cambiar de nivel o de capa hace una petición de red");
  }
  for (const fuente of [grafoAFC, vistaMapa]) {
    assert.ok(!/\bfetch\s*\(/.test(fuente), "cambiar de nivel o de capa hace una petición de red");
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
