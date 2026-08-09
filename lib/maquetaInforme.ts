import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { AnalisisFuncional } from "./types";
import { numerarNota } from "./citas";
import { normalizarAnalisis } from "./parseAnalisis";
import { validarAnalisis } from "./validadores";

/**
 * Informe de ejemplo leído del disco. SOLO SERVIDOR: usa `node:fs`.
 *
 * Lo usan dos sitios con propósitos distintos:
 *
 * - `/api/analizar` en modo maqueta, para revisar la interfaz en local sin
 *   gastar llamadas al modelo (ver `npm run dev:maqueta`).
 * - la página `/maqueta`, que se prerenderiza en el build y por eso funciona en
 *   el sitio desplegado sin tocar el sistema de ficheros en producción.
 *
 * Lo que se sirve NO es un JSON pegado a la respuesta: pasa por la misma
 * tubería que un análisis real —`numerarNota`, `normalizarAnalisis`,
 * `validarAnalisis`—, así que las citas se resuelven contra líneas de verdad y
 * los validadores emiten sus alertas de verdad. Un informe de ejemplo que se
 * saltara eso enseñaría una interfaz que no es la que ve el clínico.
 *
 * Usa la nota que acompaña al informe guardado y no ninguna otra: las citas
 * apuntan a líneas concretas de ESA nota, y con cualquier otra se resolverían a
 * nada y todo el informe aparecería como "Inferido — sin cita literal en la
 * nota". Sería un ejemplo que miente sobre el aspecto normal de un informe.
 */

const FIXTURE = join("evals", "fixtures", "01-v0.1.2.json");
const CASO = join("evals", "casos", "01-ansiedad-social.md");

/** La nota del caso, sin la cabecera ni las comprobaciones del fichero de eval. */
function notaDelCaso(): string {
  const bruto = readFileSync(join(process.cwd(), CASO), "utf8");
  return bruto
    .split(/^##\s+NOTA\s*$/m)[1]
    .split(/^##\s+COMPROBACIONES\s*$/m)[0]
    .trim();
}

export function informeDeMaqueta(): { analisis: AnalisisFuncional; nota: string } {
  const nota = notaDelCaso();
  const guardado = JSON.parse(
    readFileSync(join(process.cwd(), FIXTURE), "utf8")
  );
  const { lineas } = numerarNota(nota);

  const analisis = validarAnalisis(
    normalizarAnalisis(guardado.analisis, lineas),
    nota
  );
  // Informe completo: la interfaz no debe ocultar ninguna sección.
  analisis.campos_generados = [];
  analisis.meta = { modelo: "maqueta (sin llamada a la API)", version_prompt: "—" };

  return { analisis, nota };
}
