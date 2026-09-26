/**
 * Grado de apoyo en la nota: cita textual, dato parcial o inferencia.
 *
 * QUÉ SUSTITUYE. Antes cada hallazgo llevaba «Confianza: alta / media / baja».
 * La palabra decía más de lo que medía: «confianza alta» se lee como «esto es
 * cierto», y lo único que sostenía era que una línea de la nota lo menciona. El
 * grado de apoyo nombra el ORIGEN del dato y nada más, que es lo que el
 * terapeuta necesita para decidir de qué fiarse.
 *
 * NO SE TOCA EL ESQUEMA. El modelo sigue emitiendo `confianza` y el validador V1
 * sigue comprobándola (invariante 3). Esto es una traducción al mostrar, así que
 * un informe guardado con el formato antiguo se ve igual que uno nuevo.
 *
 * «Propuesta de IA pendiente de revisar» NO es un grado de apoyo: es un estado
 * del informe, y vive aparte (ver EstadoRevision en components/informe).
 * Mezclarlos daría a entender que revisar algo lo hace mejor apoyado.
 *
 * Dos reglas de redacción que se heredan de la versión anterior: no se dice
 * «evidencia» (en clínica se lee como evidencia científica), y la escala mide
 * de dónde sale el dato, no su gravedad.
 */

import { derivarApoyo, type NodoGrafo } from "./grafo";
import type { Cita, HipotesisMantenimiento, NivelConfianza } from "./types";

export type GradoApoyo = "cita" | "parcial" | "inferencia";

export interface GradoApoyoDescrito {
  grado: GradoApoyo;
  etiqueta: string;
  /** Utilidad de fondo del punto. Los tres colores salen de aquí. */
  clase: string;
  /**
   * El mismo color como variable CSS. Tailwind v4 solo genera las clases que
   * encuentra escritas literalmente: componer `border-l-${...}` no existiría.
   */
  variable: string;
  /** Una línea: leyenda flotante y tooltip del chip. */
  corta: string;
  frase: string;
  resto: string;
}

export const NIVELES_APOYO: GradoApoyoDescrito[] = [
  {
    grado: "cita",
    etiqueta: "Cita textual",
    clase: "bg-accent",
    variable: "var(--color-accent)",
    corta: "Una línea de la nota lo dice.",
    frase: "Una línea de la nota lo dice.",
    resto: "Pulsa la cita para ver la frase original resaltada.",
  },
  {
    grado: "parcial",
    etiqueta: "Dato parcial",
    clase: "bg-warn",
    variable: "var(--color-warn)",
    corta: "La nota lo apoya en parte.",
    frase: "La nota lo apoya en parte.",
    resto:
      "Hay una referencia, pero no afirma el hallazgo entero, o la IA lo completó a partir de ella.",
  },
  {
    grado: "inferencia",
    etiqueta: "Inferencia",
    // Terracota, no gris: el gris se leía como «desactivado» más que como el
    // extremo de la escala. Ver --color-inferido en app/globals.css.
    clase: "bg-inferido",
    variable: "var(--color-inferido)",
    corta: "Lo deduce la IA; la nota no lo dice.",
    frase: "Lo deduce la IA; la nota no lo dice.",
    resto: "Trátalo como una hipótesis que confirmar en sesión.",
  },
];

const POR_GRADO = new Map(NIVELES_APOYO.map((n) => [n.grado, n]));

export function describirGrado(grado: GradoApoyo): GradoApoyoDescrito {
  return POR_GRADO.get(grado)!;
}

const GRADO_DE_NUMERO: Record<1 | 2 | 3, GradoApoyo> = {
  3: "cita",
  2: "parcial",
  1: "inferencia",
};

const NUMERO_DE_GRADO: Record<GradoApoyo, 1 | 2 | 3> = {
  cita: 3,
  parcial: 2,
  inferencia: 1,
};

/** La escala 1–3 del grafo (longitud de la barra) en palabras. */
export function gradoDeNumero(apoyo: 1 | 2 | 3): GradoApoyo {
  return GRADO_DE_NUMERO[apoyo];
}

/** Un hallazgo con su cita: la misma regla que usa el grafo para la barra. */
export function gradoDeCita(cita: Cita | null, confianza: NivelConfianza): GradoApoyo {
  return gradoDeNumero(derivarApoyo(cita, confianza));
}

/**
 * Un conjunto (una situación, una cadena) vale lo que su elemento peor
 * apoyado. No un promedio: tres citas y una inferencia siguen sosteniendo una
 * cadena que se rompe por la inferencia.
 */
export function gradoMasDebil(grados: readonly GradoApoyo[]): GradoApoyo {
  if (grados.length === 0) return "inferencia";
  return gradoDeNumero(
    Math.min(...grados.map((g) => NUMERO_DE_GRADO[g])) as 1 | 2 | 3
  );
}

/**
 * Una hipótesis de mantenimiento nunca llega a «cita textual».
 *
 * No trae cita propia: afirma una RELACIÓN, y aunque sus dos extremos estén
 * citados, que la nota diga A y diga B no es que diga «A mantiene B». Así que
 * el techo es «dato parcial», y baja con el extremo peor apoyado o con una
 * confianza baja declarada por el modelo. Los informes anteriores a la v2, sin
 * extremos resueltos, caen en lo que diga su confianza con ese mismo techo.
 */
export function gradoDeHipotesis(
  h: HipotesisMantenimiento,
  nodos: readonly NodoGrafo[]
): GradoApoyo {
  if (h.confianza === "baja") return "inferencia";
  const extremos = nodos
    .filter((n) => n.id === h.origen_id || n.id === h.destino_id)
    .map((n) => gradoDeNumero(n.apoyo));
  return gradoMasDebil(["parcial", ...extremos]);
}

/**
 * El vocabulario de relaciones en pantalla: dos verbos y nada más.
 *
 * «Causal», «mediadora», «moderadora» y la fuerza son distinciones que el
 * modelo emite con más seguridad de la que la nota le da: presentarlas tal
 * cual sugiere un análisis de mediación que nadie ha hecho. Se siguen
 * guardando y alimentan la priorización; en pantalla una relación dice si va
 * en un sentido o en los dos.
 */
export function verboRelacion(direccion: "unidireccional" | "bidireccional"): string {
  return direccion === "bidireccional" ? "se relaciona con" : "influye en";
}

export const INTRO_GRADO_APOYO =
  "Cada hallazgo indica de dónde sale: de una frase de tu nota, de un dato que la nota apoya solo en parte, o de una inferencia de la IA. No mide si es cierto; mide cuánto de ello escribiste tú.";

/**
 * Lo que garantiza de verdad el validador V1 (lib/validadores.ts): recorre
 * `situaciones` y degrada cualquier análisis sin cita verificada. No se promete
 * más que eso.
 */
export const NOTA_PIE_GRADO_APOYO =
  "Una situación toma el grado de su elemento peor apoyado, y ninguna situación sin una línea de la nota que la respalde puede aparecer como cita textual: el sistema lo comprueba sin IA.";

/**
 * El aviso del validador V1 habla el idioma antiguo («confianza alta… se ha
 * degradado a media»), y está guardado así en todos los informes existentes.
 * Se traduce al mostrarlo, igual que el resto de valores antiguos: el
 * validador no cambia (invariante 3), cambia cómo se lee.
 */
export function traducirMensajeAlerta(mensaje: string): string {
  return mensaje.replace(
    /se presentaba con confianza alta sin ninguna cita verificable en la nota\. Se ha degradado a media\./,
    "se presentaba como respaldada por la nota sin ninguna cita verificable. Se muestra como dato parcial."
  );
}
