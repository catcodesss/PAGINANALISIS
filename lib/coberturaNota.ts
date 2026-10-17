import { citaCubreFrase, segmentarFrases, type CitaVerificadaResuelta } from "./citas";

/**
 * Cobertura de la nota: qué frases no cita ningún elemento del análisis.
 *
 * Se calcula en el cliente a partir del propio análisis y de la nota que ya está
 * en pantalla: no se envía ni se registra en ningún sitio (invariante 5) y no va
 * a la exportación, es una ayuda para revisar y no parte del informe.
 *
 * Recorre el análisis entero en vez de enumerar campos: cualquier objeto con
 * forma de cita verificada cuenta, así una cita nueva (conductas, repertorio,
 * moduladoras, situaciones, acomodación, reglas, procesos ACT, aristas) entra
 * sin tocar este fichero.
 */

/**
 * Las frases de menos palabras que esto (saludos, "Sí.", "Ya.", encabezados) no
 * cuentan como sin usar: marcarlas como olvido sería ruido, no una omisión.
 * Cuatro palabras deja dentro cualquier frase que afirme algo ("Duerme mal los
 * domingos" son cuatro) y fuera las interjecciones y las etiquetas.
 */
export const PALABRAS_MINIMAS_FRASE = 4;

export interface FraseSinUsar {
  linea: number;
  /** Posición dentro de su línea, empezando en 1. */
  frase: number;
  texto: string;
}

export interface CoberturaNota {
  /** Frases que cuentan (con al menos PALABRAS_MINIMAS_FRASE palabras). */
  total: number;
  usadas: number;
  sinUsar: FraseSinUsar[];
}

function esCitaVerificada(valor: unknown): valor is CitaVerificadaResuelta {
  if (typeof valor !== "object" || valor === null) return false;
  const v = valor as Record<string, unknown>;
  return (
    v.verificada === true &&
    typeof v.linea_inicio === "number" &&
    typeof v.linea_fin === "number"
  );
}

export function recogerCitas(
  valor: unknown,
  salida: CitaVerificadaResuelta[] = []
): CitaVerificadaResuelta[] {
  if (Array.isArray(valor)) {
    for (const v of valor) recogerCitas(v, salida);
  } else if (typeof valor === "object" && valor !== null) {
    if (esCitaVerificada(valor)) {
      salida.push(valor);
    } else {
      for (const v of Object.values(valor)) recogerCitas(v, salida);
    }
  }
  return salida;
}

function contarPalabras(texto: string): number {
  return texto.split(/\s+/).filter(Boolean).length;
}

export function calcularCoberturaNota(
  lineas: string[],
  analisis: unknown
): CoberturaNota {
  const citas = recogerCitas(analisis);
  const sinUsar: FraseSinUsar[] = [];
  let total = 0;
  let usadas = 0;

  lineas.forEach((linea, i) => {
    const frases = segmentarFrases(linea);
    frases.forEach((texto, j) => {
      if (contarPalabras(texto) < PALABRAS_MINIMAS_FRASE) return;
      total += 1;
      const citada = citas.some((c) =>
        citaCubreFrase(c, i + 1, j + 1, frases.length)
      );
      if (citada) usadas += 1;
      else sinUsar.push({ linea: i + 1, frase: j + 1, texto });
    });
  });

  return { total, usadas, sinUsar };
}
