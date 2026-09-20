/**
 * Levanta el servidor de desarrollo con la temperatura fijada para las evals.
 *
 * Ejecutar:  npm run dev:evals
 *
 * Existe porque la forma de pasar una variable de entorno cambia según la
 * consola: `OPENAI_TEMPERATURA=0.2 npm run dev` es sintaxis de bash y en
 * PowerShell falla con "no se reconoce como nombre de un cmdlet" — pero el
 * comando siguiente sí se ejecuta, así que las evals corren igual con la
 * temperatura de producción y devuelven números que parecen válidos y no lo
 * son. Esto es lo bastante barato como para no depender de acordarse.
 *
 * Si la variable ya viene puesta desde fuera, se respeta: así se puede medir a
 * otra temperatura sin tocar este archivo.
 *
 * TAMBIÉN SUBE EL LÍMITE DE PETICIONES, por el mismo motivo que fija la
 * temperatura: porque olvidarlo produce números que parecen válidos y no lo
 * son. En producción son 5 análisis por ventana de 10 minutos, que es lo
 * correcto para una ruta pública sin autenticación. Una corrida de evals son
 * nueve llamadas seguidas, así que con el límite de producción los cuatro
 * últimos casos devuelven HTTP 429 y el informe final los cuenta como fallados:
 * sale «25/28 comprobaciones» con cuatro casos que nunca se llegaron a medir, y
 * eso se lee como un prompt que falla, no como un banco de pruebas que se
 * quedó corto. Pasó la primera vez que se midió el prompt v1.6.0.
 *
 * No toca el límite de producción: es una variable de entorno de ESTE proceso.
 */

import { spawn } from "node:child_process";

const TEMPERATURA_EVALS = "0.2";

/** Nueve casos con margen para `--reps=3`, que es el otro uso habitual. */
const LIMITE_EVALS = "60";

process.env.OPENAI_TEMPERATURA ??= TEMPERATURA_EVALS;
process.env.LIMITE_ANALISIS_POR_VENTANA ??= LIMITE_EVALS;

console.log(
  `Servidor de desarrollo con OPENAI_TEMPERATURA=${process.env.OPENAI_TEMPERATURA} ` +
    "(las marcas históricas se midieron a 0.2).\n" +
    `Límite de peticiones subido a ${process.env.LIMITE_ANALISIS_POR_VENTANA} por ventana: ` +
    "una corrida son nueve llamadas seguidas y el límite de producción (5) las corta a la mitad.\n"
);

// shell: true porque en Windows `npm` es un .cmd y Node no lo lanza directo.
const proceso = spawn("npm", ["run", "dev"], { stdio: "inherit", shell: true });

proceso.on("exit", (codigo) => process.exit(codigo ?? 0));
