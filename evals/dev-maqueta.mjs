/**
 * Levanta el servidor de desarrollo sirviendo un informe guardado, sin gastar
 * una sola llamada a OpenAI.
 *
 * Ejecutar:  npm run dev:maqueta
 *
 * Para qué: revisar cambios de interfaz. Pega cualquier cosa en el cuadro y
 * pulsa «Generar»: sale siempre el mismo informe, el del caso 01, con sus citas
 * resueltas y sus alertas de verdad (ver lib/maqueta.ts). Los cambios de
 * apariencia, orden de bloques, impresión o exportación se ven igual que con un
 * análisis real, porque es un análisis real — solo que ya generado.
 *
 * Para qué NO: medir el prompt. El informe está congelado, así que no dice nada
 * sobre lo que produce el modelo hoy. Para eso están `npm run dev:evals` y
 * `node evals/run.mjs`, que sí gastan.
 *
 * Existe como script y no como una variable escrita a mano porque la forma de
 * pasarla cambia según la consola: `VAR=x npm run dev` es sintaxis de bash y en
 * PowerShell —la consola de este proyecto— falla la asignación pero el resto de
 * la línea se ejecuta igual, así que el servidor arrancaría en modo normal y el
 * primer análisis costaría dinero sin avisar de nada.
 */

import { spawn } from "node:child_process";

process.env.ACIA_INFORME_DE_MAQUETA = "true";

console.log(
  "\nModo maqueta: /api/analizar devuelve el informe guardado del caso 01.\n" +
    "NO se llama a OpenAI y no cuenta para el límite de peticiones.\n" +
    "Para medir el prompt usa `npm run dev:evals`, que sí gasta.\n"
);

// shell: true porque en Windows `npm` es un .cmd y Node no lo lanza directo.
const proceso = spawn("npm", ["run", "dev"], { stdio: "inherit", shell: true });

proceso.on("exit", (codigo) => process.exit(codigo ?? 0));
