import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { AnalisisFuncional } from "./types";
import { numerarNota } from "./citas";
import { normalizarAnalisis } from "./parseAnalisis";
import { validarAnalisis } from "./validadores";

/**
 * Informe de ejemplo servido desde disco, sin llamar a OpenAI.
 *
 * Por qué existe: revisar un cambio de interfaz obligaba a generar un análisis
 * de verdad, y cada vistazo costaba una llamada al modelo. Trabajar así empuja
 * a mirar menos, que es exactamente lo contrario de lo que conviene en una
 * herramienta clínica.
 *
 * Lo que se sirve NO es un JSON pegado a la respuesta: pasa por la misma
 * tubería que un análisis real —`numerarNota`, `normalizarAnalisis`,
 * `validarAnalisis`—, así que las citas se resuelven contra líneas de verdad y
 * los validadores emiten sus alertas de verdad. Un informe de maqueta que se
 * saltara eso enseñaría una interfaz que no es la que ve el clínico.
 *
 * Usa la nota que acompaña al informe guardado y no la que se haya escrito en
 * el cuadro: las citas del informe apuntan a líneas concretas de ESA nota, y
 * con cualquier otra se resolverían a nada y todo el informe aparecería como
 * "Inferido — sin cita literal en la nota". Sería una maqueta que miente sobre
 * el aspecto normal de un informe.
 *
 * DOBLE CANDADO: hace falta que NODE_ENV no sea "production" Y que la variable
 * esté puesta. Ni un despliegue con la variable mal copiada ni un olvido en
 * desarrollo pueden servir un informe falso a un usuario real.
 */

export const CLAVE_MAQUETA = "ACIA_INFORME_DE_MAQUETA";

export function maquetaActivada(): boolean {
  return (
    process.env.NODE_ENV !== "production" &&
    process.env[CLAVE_MAQUETA] === "true"
  );
}

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
