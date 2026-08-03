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
 */

import { spawn } from "node:child_process";

const TEMPERATURA_EVALS = "0.2";

process.env.OPENAI_TEMPERATURA ??= TEMPERATURA_EVALS;

console.log(
  `Servidor de desarrollo con OPENAI_TEMPERATURA=${process.env.OPENAI_TEMPERATURA} ` +
    "(las marcas históricas se midieron a 0.2).\n"
);

// shell: true porque en Windows `npm` es un .cmd y Node no lo lanza directo.
const proceso = spawn("npm", ["run", "dev"], { stdio: "inherit", shell: true });

proceso.on("exit", (codigo) => process.exit(codigo ?? 0));
