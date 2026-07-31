/**
 * Detección y enmascarado de datos identificables antes de enviar la nota.
 *
 * Alcance real, para no prometer de más: esto cubre lo que tiene forma fija
 * (correos, teléfonos, documentos, fechas de nacimiento, direcciones postales,
 * matrículas) y una heurística conservadora de nombres propios. NO es
 * anonimización: una combinación de datos aparentemente inocuos —edad exacta,
 * profesión, ciudad, afición— puede identificar a una persona igual, y eso
 * ninguna expresión regular lo detecta.
 *
 * Por eso la interfaz mantiene la recomendación de usar iniciales o seudónimos:
 * es la única medida que de verdad protege.
 */

const MASCARA = "[DATO OMITIDO]";
const MASCARA_NOMBRE = "[NOMBRE OMITIDO]";

const EMAIL_RE_G = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const NUMERO_RE_G = /\d[\d\s\-.()]*\d/g;

/** Vías urbanas seguidas de nombre y, opcionalmente, número. */
const DIRECCION_RE_G =
  /\b(calle|c\/|avenida|avda\.?|paseo|plaza|carrera|jir[oó]n|colonia|barrio|urbanizaci[oó]n)\s+[A-ZÁÉÍÓÚÑ][\wÁÉÍÓÚÑáéíóúñ.'-]*(\s+[\wÁÉÍÓÚÑáéíóúñ.'-]+){0,3}(\s*,?\s*n?[.º°]?\s*\d+)?/gi;

/** Matrículas: 1234ABC, ABC-1234 y variantes. */
const MATRICULA_RE_G = /\b(\d{4}\s?-?\s?[A-Z]{3}|[A-Z]{3}\s?-?\s?\d{3,4})\b/g;

/**
 * Nombres propios: dos o más palabras capitalizadas seguidas, precedidas de un
 * marcador que en una nota clínica casi siempre introduce a una persona.
 * Deliberadamente conservador: preferimos no marcar a marcar de más y destrozar
 * el texto clínico.
 */
const NOMBRE_RE_G =
  /\b(?:[Ss]e llama|[Ll]lamad[oa]|[Pp]aciente|[Cc]onsultante|[Ss]u (?:pareja|madre|padre|hij[oa]|hermano?a?|jefe|jefa|supervisora?|marido|mujer|espos[oa]|amig[oa]))\s+(?:es\s+)?([A-ZÁÉÍÓÚÑ][a-záéíóúñ]{2,}(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]{2,}){0,2})/g;

/** "Trabaja en Acme Corporation", "empleado de Fulanito S.L." */
const EMPRESA_RE_G =
  /\b(?:[Tt]rabaja en|[Ee]mplead[oa] de|[Ee]mpresa)\s+([A-ZÁÉÍÓÚÑ][\wÁÉÍÓÚÑáéíóúñ.'-]*(?:\s+[A-ZÁÉÍÓÚÑ][\wÁÉÍÓÚÑáéíóúñ.'-]*){0,3})/g;

function contarDigitos(fragmento: string): number {
  return (fragmento.match(/\d/g) ?? []).length;
}

/** Cada patrón con su reemplazo, para no duplicar la lista en dos funciones. */
const PATRONES: { re: RegExp; mascara: string; conGrupo?: boolean }[] = [
  { re: EMAIL_RE_G, mascara: MASCARA },
  { re: DIRECCION_RE_G, mascara: MASCARA },
  { re: MATRICULA_RE_G, mascara: MASCARA },
  { re: NOMBRE_RE_G, mascara: MASCARA_NOMBRE, conGrupo: true },
  { re: EMPRESA_RE_G, mascara: MASCARA, conGrupo: true },
];

export function contieneDatosIdentificables(texto: string): boolean {
  for (const { re } of PATRONES) {
    re.lastIndex = 0;
    if (re.test(texto)) return true;
  }
  const candidatos = texto.match(NUMERO_RE_G) ?? [];
  return candidatos.some((c) => contarDigitos(c) >= 7);
}

export function enmascararDatosIdentificables(texto: string): string {
  let resultado = texto;

  for (const { re, mascara, conGrupo } of PATRONES) {
    re.lastIndex = 0;
    resultado = resultado.replace(re, (coincidencia, capturado) =>
      // Con grupo: se conserva el marcador ("su pareja", "trabaja en") y solo se
      // tapa el nombre, para que la nota siga siendo legible como texto clínico.
      conGrupo && capturado
        ? coincidencia.replace(capturado, mascara)
        : mascara
    );
  }

  // Teléfonos y documentos: 7 dígitos o más en un mismo bloque.
  resultado = resultado.replace(NUMERO_RE_G, (coincidencia) =>
    contarDigitos(coincidencia) >= 7 ? MASCARA : coincidencia
  );

  return resultado;
}
