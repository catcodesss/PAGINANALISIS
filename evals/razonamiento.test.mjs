/**
 * Pruebas del espacio de razonamiento del modelo (lib/systemPrompt.ts,
 * CAMPO_RAZONAMIENTO).
 *
 * Ejecutar:  node --experimental-strip-types evals/razonamiento.test.mjs
 *
 * El modelo escribe "razonamiento_previo" como primera clave del JSON para
 * tener dónde hacer la autoverificación del principio 12. Ese texto es
 * contenido clínico igual que el resto del análisis (invariante 5 de
 * CLAUDE.md): describe el caso, y encima lo hace en borrador, sin las cautelas
 * del informe final. No puede llegar a la interfaz, ni al historial, ni al
 * reporte de fallo.
 *
 * No se descarta con una línea que alguien pueda borrar por descuido: se cae
 * solo, porque normalizarAnalisis construye la salida clave por clave desde
 * CAMPOS_ANALISIS_FUNCIONAL. Estas pruebas fijan esa garantía para que un
 * futuro normalizador permisivo (un `...json` de más) falle aquí y no en
 * producción.
 */

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = join(AQUI, "..");

// Mismo apaño que evals/validadores.test.mjs: estos módulos se importan entre
// sí sin extensión y Node no lo resuelve en ESM, así que se compilan a CommonJS.
execFileSync(
  process.execPath,
  [
    join(RAIZ, "node_modules/typescript/bin/tsc"),
    "lib/citas.ts",
    "lib/parseAnalisis.ts",
    "lib/systemPrompt.ts",
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
const { normalizarAnalisis, normalizarFragmento } = require(
  join(RAIZ, ".tmp-evals/parseAnalisis.js")
);
const { construirSystemPrompt, construirPromptReanalisisSeccion } = require(
  join(RAIZ, ".tmp-evals/systemPrompt.js")
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

// Un borrador plausible: nombra a la paciente y a su pareja, describe la
// conducta. Exactamente lo que no puede salir del servidor.
const RAZONAMIENTO = [
  "Diferenciales: no aparece los domingos en casa de su madre, sí cada lunes",
  "en la oficina. Marta evita las reuniones con Julián presente pero no con el",
  "resto del equipo, lo que apunta a control por audiencia evaluativa y no por",
  "la demanda. Descarto R- puro de escape de tarea.",
].join(" ");

const NOTA = [
  "Consulta por malestar ante reuniones de equipo.",
  "Refiere que el lunes pidió salir de la sala y estuvo diez minutos fuera.",
  "Su pareja llama por ella para cancelar las citas.",
].join("\n");

const { lineas } = numerarNota(NOTA);

const respuestaDelModelo = {
  razonamiento_previo: RAZONAMIENTO,
  resumen_clinico: "Mujer que consulta por evitación de reuniones de equipo.",
  conductas_problema: [
    {
      descripcion: "Sale de la sala de reuniones y permanece fuera unos minutos",
      tipo: "manifiesta",
      importancia: "alta",
      es_conducta_seguridad: false,
      deficit_o_interferencia: "interferencia",
      justificacion_deficit: "Emite la conducta en otros contextos sociales.",
      evidencia: { linea_inicio: 2, linea_fin: 2 },
    },
  ],
  situaciones: [],
  riesgo: { evaluado: false, indicadores: [] },
};

console.log("\nrazonamiento_previo: el análisis completo");

prueba("normalizarAnalisis no devuelve la clave razonamiento_previo", () => {
  const analisis = normalizarAnalisis(respuestaDelModelo, lineas);
  assert.ok(
    !("razonamiento_previo" in analisis),
    "la clave sobrevivió a la normalización"
  );
});

prueba("el texto del razonamiento no aparece serializado en el análisis", () => {
  const analisis = normalizarAnalisis(respuestaDelModelo, lineas);
  const serializado = JSON.stringify(analisis);
  assert.ok(
    !serializado.includes("Diferenciales"),
    "el borrador se coló en algún campo del informe"
  );
  assert.ok(
    !serializado.includes("Julián"),
    "un nombre propio del borrador se coló en el informe"
  );
});

prueba("las claves devueltas son exactamente las de AnalisisFuncional", () => {
  const analisis = normalizarAnalisis(respuestaDelModelo, lineas);
  const inesperadas = Object.keys(analisis).filter(
    (k) => k === "razonamiento_previo"
  );
  assert.deepEqual(inesperadas, []);
});

prueba("el resto del análisis sí se normaliza con normalidad", () => {
  const analisis = normalizarAnalisis(respuestaDelModelo, lineas);
  assert.equal(analisis.conductas_problema.length, 1);
  assert.equal(analisis.conductas_problema[0].evidencia.verificada, true);
});

console.log("\nrazonamiento_previo: el reanálisis de una sección");

prueba("normalizarFragmento ignora la clave aunque se pida el campo", () => {
  const fragmento = normalizarFragmento(
    ["conductas_problema"],
    respuestaDelModelo,
    lineas
  );
  assert.ok(!("razonamiento_previo" in fragmento));
  assert.equal(fragmento.conductas_problema.length, 1);
});

prueba("normalizarFragmento la ignora si se cuela en la lista de campos", () => {
  const fragmento = normalizarFragmento(
    ["razonamiento_previo", "conductas_problema"],
    respuestaDelModelo,
    lineas
  );
  assert.ok(
    !("razonamiento_previo" in fragmento),
    "esCampoDeAnalisis dejó pasar una clave ajena al tipo"
  );
});

console.log("\nrazonamiento_previo: el prompt lo pide de verdad");

prueba("va como primera clave del formato en el análisis completo", () => {
  const prompt = construirSystemPrompt();
  const inicioObjeto = prompt.indexOf("{\n  \"razonamiento_previo\"");
  assert.notEqual(inicioObjeto, -1, "no es la primera clave del objeto JSON");
});

prueba("también se pide en un análisis parcial", () => {
  const prompt = construirSystemPrompt(["resumen_clinico", "riesgo"]);
  assert.ok(prompt.includes("\"razonamiento_previo\""));
});

prueba("el prompt de reanálisis lo pide y no lo contradice", () => {
  const prompt = construirPromptReanalisisSeccion(["conductas_problema"]);
  assert.ok(prompt.includes("\"razonamiento_previo\""));
  // La cola del prompt dice "SOLO estas claves": si no menciona el
  // razonamiento, el modelo obedece a la cola y se queda sin espacio.
  const cola = prompt.slice(prompt.indexOf("FORMATO DE RESPUESTA PARA ESTA"));
  assert.ok(
    cola.includes("razonamiento_previo"),
    "la instrucción final excluye el campo que el formato pide"
  );
});

prueba("el principio de profundidad viaja en el núcleo", () => {
  const prompt = construirSystemPrompt(["resumen_clinico"]);
  assert.ok(prompt.includes("22. PROFUNDIDAD EXIGIBLE"));
  assert.ok(prompt.includes("PROFUNDIDAD NO ES LONGITUD"));
});

console.log(`\n${pasadas}/10 pruebas pasadas`);
if (process.exitCode) console.error("Hay pruebas fallidas.");
