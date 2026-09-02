/**
 * Los tres niveles de confianza, en un solo sitio.
 *
 * Por qué existe: el mismo texto estaba escrito tres veces —el tooltip del
 * chip, el panel flotante y la guía de uso— y ahora aparece en una cuarta
 * superficie, la tarjeta «Niveles de confianza» del informe. Cuatro copias de
 * una definición clínica es una definición que se contradice a sí misma en
 * cuanto alguien retoca una.
 *
 * Dos reglas de redacción que este módulo fija para todas las superficies:
 *
 * 1. No se usa la palabra «evidencia» de cara al usuario. En contexto clínico
 *    se lee como «evidencia científica» (tratamiento basado en la evidencia),
 *    que es justo lo contrario de lo que mide esto. Se dice «respaldo».
 * 2. Los niveles se llaman Alta / Media / Baja y nada más. No miden gravedad
 *    ni tipo de afirmación: miden cuánto de lo afirmado está dicho en la nota.
 */

export interface NivelConfianzaDescrito {
  nivel: "alta" | "media" | "baja";
  etiqueta: string;
  /** Utilidad de fondo del punto. Los tres colores salen de aquí y de ningún otro sitio. */
  clase: string;
  /**
   * El mismo color como variable CSS, para lo que no puede ser una utilidad.
   * Tailwind v4 solo genera las clases que encuentra escritas literalmente en
   * el código: componer `border-l-${...}` daría una clase que nunca existe.
   */
  variable: string;
  /** Etiqueta corta: panel flotante y tooltip del chip. */
  corta: string;
  /** Primera frase de la definición completa; va en semibold en la tarjeta. */
  frase: string;
  /** El resto de la definición completa. */
  resto: string;
}

export const NIVELES_CONFIANZA: NivelConfianzaDescrito[] = [
  {
    nivel: "alta",
    etiqueta: "Alta",
    clase: "bg-accent",
    variable: "var(--color-accent)",
    corta: "Respaldo explícito.",
    frase: "Respaldo explícito.",
    resto:
      "La nota afirma el hallazgo directamente, con cita textual o un parafraseo cuidadoso de ella.",
  },
  {
    nivel: "media",
    etiqueta: "Media",
    clase: "bg-warn",
    variable: "var(--color-warn)",
    corta: "Respaldo parcial.",
    frase: "Respaldo parcial.",
    resto:
      "El hallazgo se infiere con relativa seguridad a partir de lo escrito, sin una afirmación explícita que lo confirme.",
  },
  {
    nivel: "baja",
    etiqueta: "Baja",
    // Terracota, no gris: el gris no se leía como parte de la escala —parecía
    // «desactivado» más que «bajo»—. Ver --color-inferido en app/globals.css.
    clase: "bg-inferido",
    variable: "var(--color-inferido)",
    corta: "Respaldo escaso.",
    frase: "Respaldo escaso o nulo.",
    resto: "El hallazgo se sostiene principalmente en la inferencia clínica del modelo.",
  },
];

const POR_NIVEL = new Map(NIVELES_CONFIANZA.map((n) => [n.nivel, n]));

/** El color de un nivel. Un valor desconocido cae en el más prudente. */
export function claseColorConfianza(nivel: string): string {
  return POR_NIVEL.get(nivel as NivelConfianzaDescrito["nivel"])?.clase ?? "bg-inferido";
}

/** Texto del tooltip del chip: «Alta: Respaldo explícito.» */
export function tooltipConfianza(nivel: string): string | undefined {
  const n = POR_NIVEL.get(nivel as NivelConfianzaDescrito["nivel"]);
  return n && `${n.etiqueta}: ${n.corta}`;
}

/**
 * Texto de apertura de la tarjeta. Aquí y no en el .tsx por la misma razón que
 * el resto: es redacción clínica, no maquetación.
 */
export const INTRO_NIVELES_CONFIANZA =
  "Cada hallazgo de este informe lleva una marca de confianza. Solo indica cuánto de eso está dicho en tu nota. Sirve para que sepas qué partes del análisis tienen más respaldo en lo que escribiste.";

/**
 * Nota al pie de la tarjeta. Describe lo que el validador V1 de
 * lib/validadores.ts garantiza de verdad, que es más estrecho de lo que
 * parece: la comprobación recorre `situaciones` y degrada a media cualquiera
 * marcada como alta sin una cita verificada en sus cadenas. Las hipótesis de
 * mantenimiento llevan confianza pero no pasan por ese control, así que el
 * texto no promete que ningún hallazgo del informe pueda hacerlo.
 */
export const NOTA_PIE_NIVELES_CONFIANZA =
  "El análisis de una situación sin ninguna línea de la nota que lo respalde nunca puede marcarse como confianza alta: el sistema lo degrada a media automáticamente. El nivel depende de la cita que lo sustenta, no de qué tan seguro suene el texto que lo acompaña.";
