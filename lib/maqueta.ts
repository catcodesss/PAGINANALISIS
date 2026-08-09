/**
 * Constantes del informe de ejemplo.
 *
 * Este módulo NO lee del disco a propósito: lo importa `lib/formatearInforme.ts`,
 * que corre también en el navegador, y arrastrar `node:fs` hasta ahí rompería el
 * build del cliente. Lo que toca el sistema de ficheros vive en
 * `lib/maquetaInforme.ts`, que solo se usa desde el servidor.
 */

export const CLAVE_MAQUETA = "ACIA_INFORME_DE_MAQUETA";

/**
 * El aviso que acompaña al informe de ejemplo allá donde vaya: en pantalla, al
 * imprimir, en el texto copiado y en el Word exportado.
 *
 * Va dentro del texto y no solo en la pantalla porque un documento exportado se
 * lee fuera de contexto. Un Word descargado desde la página de ejemplo, abierto
 * una semana después, tiene que decir por sí mismo que no es de nadie. Es el
 * mismo razonamiento que la marca «Editado por ti» del invariante 6.
 */
export const AVISO_EJEMPLO =
  "INFORME DE EJEMPLO — generado a partir de un caso ficticio para mostrar la herramienta. No es el análisis de ninguna nota real ni de ningún paciente.";

/**
 * Modo maqueta de `/api/analizar`, para revisar la interfaz en local sin gastar
 * llamadas al modelo (ver `npm run dev:maqueta`).
 *
 * DOBLE CANDADO: hace falta que NODE_ENV no sea "production" Y que la variable
 * esté puesta. Ni un despliegue con la variable mal copiada ni un olvido en
 * desarrollo pueden hacer que la ruta de análisis devuelva un informe inventado
 * a un usuario real. La página pública `/maqueta` es otra cosa: no pasa por esta
 * ruta, no acepta ninguna nota y va marcada como ejemplo de principio a fin.
 */
export function maquetaActivada(): boolean {
  return (
    process.env.NODE_ENV !== "production" &&
    process.env[CLAVE_MAQUETA] === "true"
  );
}
