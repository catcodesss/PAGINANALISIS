/**
 * Los conceptos técnicos del análisis, en tres capas: la etiqueta clara, la
 * sigla técnica al lado y una definición de una línea al pasar el cursor.
 *
 * Por qué en tres capas y no solo la clara: quien lee es terapeuta, y la sigla
 * es la que va a buscar en un manual o a usar con un colega. Quitarla haría el
 * informe más amable y menos útil. Ponerla sola es lo que había, y obligaba a
 * traducir cada casilla antes de pensar en el caso.
 *
 * Ed y EC NO comparten palabra. Los dos son «lo que va antes», pero uno indica
 * que la conducta funciona ahí (operante) y el otro provoca la reacción
 * (respondiente). Llamarlos igual en pantalla borraría la distinción que decide
 * si se trabaja con contingencias o con exposición.
 *
 * Vive en lib/ y no en el componente porque la exportación escribe lo mismo:
 * dos redacciones del mismo término acabarían diciendo cosas distintas.
 */

export interface Termino {
  claro: string;
  tecnico: string;
  definicion: string;
}

export const TERMINOS = {
  ed: {
    claro: "Señal",
    tecnico: "Ed",
    definicion:
      "Indica que la conducta «funciona» aquí: en su presencia, la conducta ya tuvo antes esa consecuencia.",
  },
  ec: {
    claro: "Desencadenante",
    tecnico: "EC",
    definicion: "Provoca la reacción de forma automática, por asociación aprendida.",
  },
  om: {
    claro: "Qué lo hace más probable hoy",
    tecnico: "OM / OE",
    definicion:
      "Estado o contexto que, por un tiempo, cambia cuánto importa la consecuencia y con ello la probabilidad de la conducta.",
  },
  refuerzo_negativo: {
    claro: "Alivio: qué deja de pasar",
    tecnico: "R−",
    definicion:
      "La conducta se mantiene porque retira, reduce o evita algo desagradable.",
  },
  refuerzo_positivo: {
    claro: "Lo que consigue",
    tecnico: "R+",
    definicion: "La conducta se mantiene porque le sigue algo que la persona valora.",
  },
  funcion: {
    claro: "Para qué le sirve",
    tecnico: "Función",
    definicion: "La consecuencia que mantiene la conducta, no la forma que tiene.",
  },
  pliance: {
    claro: "Sigue la regla por aprobación",
    tecnico: "Pliance",
    definicion: "La cumple por lo que otros aprueban o desaprueban, no por lo que produce.",
  },
  tracking: {
    claro: "Sigue la regla porque le funciona",
    tecnico: "Tracking",
    definicion: "La cumple porque describe bien lo que pasa en su entorno.",
  },
  augmenting: {
    claro: "Sigue la regla porque cambia lo que le importa",
    tecnico: "Augmenting",
    definicion: "La regla altera cuánto valen para la persona ciertas consecuencias.",
  },
  consecuencia_demorada: {
    claro: "Qué cuesta a la larga",
    tecnico: "CMLP",
    definicion: "Efecto a medio y largo plazo del patrón, distinto del alivio inmediato.",
  },
} as const satisfies Record<string, Termino>;

export type IdTermino = keyof typeof TERMINOS;

/** El término que corresponde a un tipo de contingencia, si tiene etiqueta clara. */
export function terminoDeContingencia(tipo: string): IdTermino | null {
  if (tipo === "refuerzo negativo") return "refuerzo_negativo";
  if (tipo === "refuerzo positivo") return "refuerzo_positivo";
  return null;
}

/** «Señal (Ed)»: para texto plano, donde no hay tooltip. */
export function terminoEnTexto(id: IdTermino): string {
  const t = TERMINOS[id];
  return `${t.claro} (${t.tecnico})`;
}
