/**
 * Citas verificables.
 *
 * Problema que resuelve: si se le pide al modelo que "cite textualmente", devuelve
 * paráfrasis. La interfaz las mostraba entre comillas bajo el rótulo "De la nota",
 * de modo que el clínico creía estar verificando contra su propia nota cuando en
 * realidad leía texto generado.
 *
 * Solución: el modelo nunca escribe la cita. Recibe la nota con las líneas
 * numeradas y devuelve solo un rango de líneas; el servidor corta el texto real.
 * Una cita que no se puede resolver se marca como no verificada y la interfaz
 * deja de presentarla entre comillas.
 */

/** Lo que el modelo devuelve: un rango de líneas de la nota numerada. */
export interface RefLinea {
  linea_inicio: number;
  linea_fin: number;
}

export type MotivoSinCita =
  | "sin_referencia"
  | "rango_invalido"
  | "linea_vacia"
  | "no_literal";

/** Lo que se guarda en el análisis y se muestra en pantalla. */
export type Cita =
  | { texto: string; linea_inicio: number; linea_fin: number; verificada: true }
  | { texto: null; verificada: false; motivo: MotivoSinCita };

export const SIN_CITA = (motivo: MotivoSinCita): Cita => ({
  texto: null,
  verificada: false,
  motivo,
});

export function normalizarTexto(valor: string): string {
  return valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Prepara la nota para el prompt. Las líneas en blanco se conservan para que la
 * numeración que ve el modelo coincida exactamente con el índice del arreglo.
 */
export function numerarNota(nota: string): { lineas: string[]; texto: string } {
  const lineas = nota.replace(/\r\n/g, "\n").split("\n");
  const texto = lineas.map((linea, i) => `[L${i + 1}] ${linea}`).join("\n");
  return { lineas, texto };
}

const COMILLAS_INICIO = /^[«»"'“”\s]+/;
const COMILLAS_FIN = /[«»"'“”\s.,;:]+$/;

/**
 * Convierte lo que devolvió el modelo en una cita verificada.
 *
 * Acepta también un string por compatibilidad: análisis generados antes de este
 * cambio, y respuestas en las que el modelo ignora el formato pedido. En ese caso
 * la cita solo se da por buena si aparece literal en la nota.
 */
export function resolverCita(lineas: string[], valor: unknown): Cita {
  if (valor === null || valor === undefined) return SIN_CITA("sin_referencia");

  if (typeof valor === "string") {
    const limpio = valor.replace(COMILLAS_INICIO, "").replace(COMILLAS_FIN, "");
    if (limpio.length === 0) return SIN_CITA("sin_referencia");
    const notaNormalizada = normalizarTexto(lineas.join("\n"));
    if (!notaNormalizada.includes(normalizarTexto(limpio))) {
      return SIN_CITA("no_literal");
    }
    const indice = lineas.findIndex((l) =>
      normalizarTexto(l).includes(normalizarTexto(limpio))
    );
    const linea = indice === -1 ? 0 : indice + 1;
    return { texto: limpio, linea_inicio: linea, linea_fin: linea, verificada: true };
  }

  if (typeof valor !== "object") return SIN_CITA("sin_referencia");

  const ref = valor as Partial<RefLinea>;
  const inicio = Number(ref.linea_inicio);
  const fin = Number(ref.linea_fin);
  if (!Number.isFinite(inicio) || !Number.isFinite(fin)) {
    return SIN_CITA("sin_referencia");
  }

  const desde = Math.max(1, Math.trunc(inicio));
  const hasta = Math.min(lineas.length, Math.trunc(fin));
  if (hasta < desde) return SIN_CITA("rango_invalido");

  const texto = lineas.slice(desde - 1, hasta).join(" ").replace(/\s+/g, " ").trim();
  if (texto.length === 0) return SIN_CITA("linea_vacia");

  return { texto, linea_inicio: desde, linea_fin: hasta, verificada: true };
}

/** Para la degradación de confianza en el validador: ¿esta cita sostiene una afirmación? */
export function citaSostiene(cita: Cita): boolean {
  return cita.verificada && cita.texto.trim().length > 0;
}
