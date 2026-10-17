/**
 * Citas verificables.
 *
 * Problema que resuelve: si se le pide al modelo que "cite textualmente", devuelve
 * paráfrasis. La interfaz las mostraba entre comillas bajo el rótulo "De la nota",
 * de modo que el clínico creía estar verificando contra su propia nota cuando en
 * realidad leía texto generado.
 *
 * Solución: el modelo nunca escribe la cita. Recibe la nota con las líneas y las
 * frases numeradas y devuelve solo una referencia; el servidor corta el texto real.
 * Una cita que no se puede resolver se marca como no verificada y la interfaz
 * deja de presentarla entre comillas.
 */

/**
 * Lo que el modelo devuelve: un rango de la nota numerada. Las frases son
 * opcionales: sin ellas se toma la línea entera (citas antiguas y respuestas
 * que no las usan).
 */
export interface RefLinea {
  linea_inicio: number;
  frase_inicio?: number;
  linea_fin: number;
  frase_fin?: number;
}

export type MotivoSinCita =
  | "sin_referencia"
  | "rango_invalido"
  | "linea_vacia"
  | "no_literal";

/** Lo que se guarda en el análisis y se muestra en pantalla. */
export type Cita =
  | {
      texto: string;
      linea_inicio: number;
      linea_fin: number;
      /** Solo si la referencia las traía: sin ellas la cita cubre las líneas enteras. */
      frase_inicio?: number;
      frase_fin?: number;
      verificada: true;
    }
  | { texto: null; verificada: false; motivo: MotivoSinCita };

export type CitaVerificadaResuelta = Extract<Cita, { verificada: true }>;

export const SIN_CITA = (motivo: MotivoSinCita): Cita => ({
  texto: null,
  verificada: false,
  motivo,
});

export function normalizarTexto(valor: string): string {
  return valor
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/*
  Segmentación en frases. Es determinista y sin IA a propósito: la misma función
  numera la nota para el modelo y recorta la cita en el servidor, así que no
  pueden discrepar sobre dónde acaba una frase.
*/

/** Tras estas abreviaturas el punto no cierra la frase ("Dr. Pérez", "p. ej. Ana"). */
const ABREVIATURAS = new Set([
  "dr", "dra", "drs", "sr", "sra", "srs", "srta", "lic", "psic", "prof",
  "ej", "etc", "aprox", "num", "núm", "pag", "pág", "pags", "págs", "vs",
  "tel", "ud", "uds", "vd", "vds", "cf",
]);

// Fin de frase candidato: . ? ! … (más cierres de comilla o paréntesis) seguido
// de espacio y de algo que abre frase. Los decimales ("2.5") y "1.º" no llevan
// espacio detrás, así que ni se consideran.
const CANDIDATO_DE_CORTE = /[.?!…]+["”»)\]]*(?=\s+[A-ZÁÉÍÓÚÑÜ¿¡«“"(\[])/gu;

/** ¿Es el punto de una inicial ("M.") o de una abreviatura, y por tanto no cierra? */
function puntoDeAbreviatura(antes: string): boolean {
  const palabra = antes.match(/(\p{L}+)$/u)?.[1];
  if (!palabra) return false;
  if (palabra.length === 1 && /\p{Lu}/u.test(palabra)) return true;
  return ABREVIATURAS.has(palabra.toLowerCase());
}

/**
 * Divide una línea en frases. No corta en iniciales, abreviaturas, números ni
 * dentro de paréntesis o comillas que aún no cerraron. Una línea vacía no tiene
 * frases.
 */
export function segmentarFrases(linea: string): string[] {
  const texto = linea.replace(/\s+/g, " ").trim();
  if (texto.length === 0) return [];
  const frases: string[] = [];
  let desde = 0;
  for (const m of texto.matchAll(CANDIDATO_DE_CORTE)) {
    const fin = m.index + m[0].length;
    const soloPunto = /^\.["”»)\]]*$/.test(m[0]);
    if (soloPunto && puntoDeAbreviatura(texto.slice(desde, m.index))) continue;
    const previo = texto.slice(desde, fin);
    const abiertos =
      (previo.match(/[(«“]/g)?.length ?? 0) - (previo.match(/[)»”]/g)?.length ?? 0);
    const rectas = previo.match(/"/g)?.length ?? 0;
    if (abiertos > 0 || rectas % 2 === 1) continue;
    frases.push(previo.trim());
    desde = fin;
  }
  const resto = texto.slice(desde).trim();
  if (resto) frases.push(resto);
  return frases;
}

/**
 * Prepara la nota para el prompt. Las líneas en blanco se conservan para que la
 * numeración de líneas que ve el modelo coincida exactamente con el índice del
 * arreglo, y cada línea numera además sus frases: `[L3] [L3.1] … [L3.2] …`.
 */
export function numerarNota(nota: string): {
  lineas: string[];
  texto: string;
  frases: string[][];
} {
  const lineas = nota.replace(/\r\n/g, "\n").split("\n");
  const frases = lineas.map(segmentarFrases);
  const texto = lineas
    .map((linea, i) => {
      const fs = frases[i];
      const cuerpo =
        fs.length === 0
          ? linea
          : fs.map((f, j) => `[L${i + 1}.${j + 1}] ${f}`).join(" ");
      return `[L${i + 1}] ${cuerpo}`;
    })
    .join("\n");
  return { lineas, texto, frases };
}

const COMILLAS_INICIO = /^[«»"'“”\s]+/;
const COMILLAS_FIN = /[«»"'“”\s.,;:]+$/;

function numeroOpcional(valor: unknown): number | undefined {
  if (valor === null || valor === undefined) return undefined;
  const n = Number(valor);
  return Number.isFinite(n) ? Math.trunc(n) : undefined;
}

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
    // El texto literal cabe en una línea; si cabe en una sola frase, la cita se
    // estrecha a ella para que resalte y cuente en la cobertura solo lo citado.
    const objetivo = normalizarTexto(limpio);
    const frase =
      indice === -1
        ? -1
        : segmentarFrases(lineas[indice]).findIndex((f) =>
            normalizarTexto(f).includes(objetivo)
          );
    return frase === -1
      ? { texto: limpio, linea_inicio: linea, linea_fin: linea, verificada: true }
      : {
          texto: limpio,
          linea_inicio: linea,
          linea_fin: linea,
          frase_inicio: frase + 1,
          frase_fin: frase + 1,
          verificada: true,
        };
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

  const fraseInicio = numeroOpcional(ref.frase_inicio);
  const fraseFin = numeroOpcional(ref.frase_fin);
  if (fraseInicio === undefined && fraseFin === undefined) {
    const texto = lineas.slice(desde - 1, hasta).join(" ").replace(/\s+/g, " ").trim();
    if (texto.length === 0) return SIN_CITA("linea_vacia");
    return { texto, linea_inicio: desde, linea_fin: hasta, verificada: true };
  }

  // Con frases se recorta el texto de esas frases y nada más. Una frase que no
  // existe en su línea no se corrige por aproximación: la cita queda sin verificar.
  const porLinea = lineas.slice(desde - 1, hasta).map(segmentarFrases);
  const primera = fraseInicio ?? 1;
  const ultima = fraseFin ?? porLinea[porLinea.length - 1].length;
  if (primera < 1 || primera > porLinea[0].length) return SIN_CITA("rango_invalido");
  if (ultima < 1 || ultima > porLinea[porLinea.length - 1].length) {
    return SIN_CITA("rango_invalido");
  }
  if (desde === hasta && ultima < primera) return SIN_CITA("rango_invalido");

  const partes: string[] = [];
  porLinea.forEach((fs, i) => {
    const de = i === 0 ? primera : 1;
    const a = i === porLinea.length - 1 ? ultima : fs.length;
    partes.push(...fs.slice(de - 1, a));
  });
  const texto = partes.join(" ");
  if (texto.length === 0) return SIN_CITA("linea_vacia");

  return {
    texto,
    linea_inicio: desde,
    linea_fin: hasta,
    frase_inicio: primera,
    frase_fin: ultima,
    verificada: true,
  };
}

/** ¿Cubre esta cita la frase `frase` (1-based) de la línea `linea`, que tiene `total` frases? */
export function citaCubreFrase(
  cita: CitaVerificadaResuelta,
  linea: number,
  frase: number,
  total: number
): boolean {
  if (linea < cita.linea_inicio || linea > cita.linea_fin) return false;
  const de = linea === cita.linea_inicio ? (cita.frase_inicio ?? 1) : 1;
  const a = linea === cita.linea_fin ? (cita.frase_fin ?? total) : total;
  return frase >= de && frase <= a;
}

/** "L3.2", "L3.2–3", "L3.2–L4.1", o "L3" / "L3–L4" si la cita es de líneas enteras. */
export function etiquetaCita(cita: CitaVerificadaResuelta): string {
  const { linea_inicio: a, linea_fin: b, frase_inicio: fi, frase_fin: ff } = cita;
  if (fi === undefined && ff === undefined) return a === b ? `L${a}` : `L${a}–L${b}`;
  const inicio = `L${a}.${fi ?? 1}`;
  if (a === b) return fi === ff || ff === undefined ? inicio : `${inicio}–${ff}`;
  return `${inicio}–L${b}.${ff ?? "fin"}`;
}

/** Para el informe copiado y el Word: "línea 3, frase 2". */
export function referenciaEnTexto(cita: CitaVerificadaResuelta): string {
  const { linea_inicio: a, linea_fin: b, frase_inicio: fi, frase_fin: ff } = cita;
  if (fi === undefined && ff === undefined) {
    return a === b ? `línea ${a}` : `líneas ${a}–${b}`;
  }
  if (a === b) {
    if (fi === ff || ff === undefined) return `línea ${a}, frase ${fi ?? 1}`;
    return `línea ${a}, frases ${fi ?? 1}–${ff}`;
  }
  return `desde la línea ${a}, frase ${fi ?? 1}, hasta la línea ${b}, frase ${ff ?? "final"}`;
}
