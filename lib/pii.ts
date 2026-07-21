const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
const EMAIL_RE_G = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const NUMERO_RE_G = /\d[\d\s\-.()]*\d/g;
const MASCARA = "[DATO OMITIDO]";

function contarDigitos(fragmento: string): number {
  return (fragmento.match(/\d/g) ?? []).length;
}

/**
 * Detecta posibles correos, teléfonos (7+ dígitos) o documentos (8+ dígitos)
 * mediante heurísticas simples. No detecta nombres propios (genera demasiados
 * falsos positivos): eso se comunica al usuario como recomendación aparte.
 */
export function contieneDatosIdentificables(texto: string): boolean {
  if (EMAIL_RE.test(texto)) return true;
  const candidatos = texto.match(NUMERO_RE_G) ?? [];
  return candidatos.some((c) => contarDigitos(c) >= 7);
}

export function enmascararDatosIdentificables(texto: string): string {
  let resultado = texto.replace(EMAIL_RE_G, MASCARA);
  resultado = resultado.replace(NUMERO_RE_G, (coincidencia) =>
    contarDigitos(coincidencia) >= 7 ? MASCARA : coincidencia
  );
  return resultado;
}
