/**
 * Pruebas del reporte de fallo (lib/reporteFallo.ts).
 *
 * Ejecutar:  node evals/reporteFallo.test.mjs
 *
 * Por qué existen: la primera versión del reporte incluía el análisis
 * generado y solo quitaba las citas (`evidencia`), creyendo que el texto del
 * modelo no era contenido clínico. Lo es: describe el caso, y las hipótesis
 * con confianza ALTA son justo las que más pegadas van a la nota, porque esa
 * confianza exige una línea que las sostenga (principio 11). Estas pruebas
 * fijan que ni la nota ni el análisis vuelvan a colarse. No gastan API.
 */

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = join(AQUI, "..");

execFileSync(
  process.execPath,
  [
    join(RAIZ, "node_modules/typescript/bin/tsc"),
    "lib/reporteFallo.ts",
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
const { construirReporteFallo } = require(join(RAIZ, ".tmp-evals/reporteFallo.js"));

// Análisis con contenido clínico en todos los sitios donde podría filtrarse.
const analisis = {
  meta: { modelo: "gpt-4o", version_prompt: "1.1.0" },
  resumen_clinico:
    "M. evita reuniones de trabajo y se ausenta al baño para no exponer.",
  conductas_problema: [
    {
      descripcion: "Pide ir al baño y se ausenta durante la reunión.",
      confianza: "alta",
      evidencia: {
        texto: "Pidió ir al baño, estuvo allí unos diez minutos respirando",
        verificada: true,
        linea_inicio: 3,
        linea_fin: 3,
      },
    },
  ],
  situaciones: [
    {
      nombre: "Exposición social evaluativa",
      confianza: "alta",
      cadena_operante: {
        respuesta: "Se ausenta de la sala.",
        consecuencia: "Alivio inmediato del malestar.",
        evidencia: { texto: "Sintió un alivio inmediato muy fuerte", verificada: true },
      },
    },
  ],
  alertas: [
    {
      codigo: "prescribe_conducta_seguridad",
      origen: "validador",
      gravedad: "alta",
      ruta: "capa_dbt.habilidades_sugeridas[0]",
      // El mensaje cita el texto generado: tampoco puede salir.
      mensaje:
        'Se propone "Respiración consciente", pero respirar en el baño ya aparece como conducta de seguridad.',
    },
  ],
};

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

console.log("\nReporte de fallo: no debe salir contenido clínico\n");

const reporte = construirReporteFallo(analisis, "situaciones", "");

prueba("no incluye ninguna cita literal de la nota", () => {
  for (const cita of [
    "Pidió ir al baño, estuvo allí unos diez minutos respirando",
    "Sintió un alivio inmediato muy fuerte",
  ]) {
    assert.ok(!reporte.includes(cita), `se coló la cita: "${cita}"`);
  }
});

prueba("no incluye el análisis generado (describe el caso)", () => {
  for (const generado of [
    "M. evita reuniones de trabajo",
    "Pide ir al baño y se ausenta durante la reunión",
    "Exposición social evaluativa",
    "Alivio inmediato del malestar",
  ]) {
    assert.ok(!reporte.includes(generado), `se coló texto generado: "${generado}"`);
  }
});

prueba("no incluye los MENSAJES de alerta, que citan el texto generado", () => {
  assert.ok(
    !reporte.includes("Respiración consciente"),
    "el mensaje de la alerta arrastró el texto generado"
  );
});

prueba("sí incluye los códigos y rutas de alerta, que no identifican a nadie", () => {
  assert.ok(reporte.includes("prescribe_conducta_seguridad"));
  assert.ok(reporte.includes("capa_dbt.habilidades_sugeridas[0]"));
});

prueba("sí incluye la trazabilidad necesaria para reproducir el fallo", () => {
  assert.ok(reporte.includes("gpt-4o"));
  assert.ok(reporte.includes("1.1.0"));
  assert.ok(reporte.includes("situaciones"));
});

prueba("el comentario del clínico se incluye tal cual lo escribió", () => {
  const conComentario = construirReporteFallo(
    analisis,
    "situaciones",
    "La función está mal: aquí no hay escape."
  );
  assert.ok(conComentario.includes("La función está mal: aquí no hay escape."));
});

prueba("avisa de que no lleva la nota ni el análisis", () => {
  assert.match(reporte, /NO incluye la nota clínica ni el análisis generado/);
});

console.log(`\n${pasadas} pruebas correctas\n`);
