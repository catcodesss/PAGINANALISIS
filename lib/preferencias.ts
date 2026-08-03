/**
 * Preferencias de presentación del clínico.
 *
 * Son ajustes de cómo se ve la herramienta, no contenido clínico: viven en
 * localStorage sin rozar el invariante 5. Se aplican poniendo atributos en
 * <html>, y el CSS de app/globals.css hace el resto — así el tema y el acento
 * cambian sin volver a renderizar nada.
 *
 * Este módulo no importa React a propósito: lo usan tanto el componente de
 * ajustes como el script que corre antes de pintar (ver app/layout.tsx), que
 * no puede depender del árbol de React.
 */

export const CLAVE_PREFERENCIAS = "acia-preferencias";

export type Tema = "sistema" | "claro" | "oscuro";
export type TamanoTexto = "compacto" | "normal" | "amplio";
export type Acento = "verde" | "indigo" | "lavanda" | "teal" | "arena";
export type Idioma = "es";

export interface Preferencias {
  tema: Tema;
  tamanoTexto: TamanoTexto;
  acento: Acento;
  idioma: Idioma;
}

export const PREFERENCIAS_POR_DEFECTO: Preferencias = {
  tema: "sistema",
  tamanoTexto: "normal",
  acento: "verde",
  idioma: "es",
};

const TEMAS: Tema[] = ["sistema", "claro", "oscuro"];
const TAMANOS: TamanoTexto[] = ["compacto", "normal", "amplio"];
const ACENTOS: Acento[] = ["verde", "indigo", "lavanda", "teal", "arena"];

/**
 * Tolerante a propósito: un valor guardado por una versión anterior, o
 * manipulado a mano, no debe dejar la interfaz en un estado imposible. Lo que
 * no se reconoce vuelve al valor de fábrica.
 */
export function normalizarPreferencias(crudo: unknown): Preferencias {
  const d = (typeof crudo === "object" && crudo !== null ? crudo : {}) as Record<
    string,
    unknown
  >;
  const elegir = <T extends string>(valor: unknown, validos: T[], porDefecto: T): T =>
    validos.includes(valor as T) ? (valor as T) : porDefecto;

  return {
    tema: elegir(d.tema, TEMAS, PREFERENCIAS_POR_DEFECTO.tema),
    tamanoTexto: elegir(d.tamanoTexto, TAMANOS, PREFERENCIAS_POR_DEFECTO.tamanoTexto),
    acento: elegir(d.acento, ACENTOS, PREFERENCIAS_POR_DEFECTO.acento),
    // Solo hay un idioma de verdad; el selector deja claro cuál falta.
    idioma: "es",
  };
}

export function leerPreferencias(): Preferencias {
  try {
    const crudo = localStorage.getItem(CLAVE_PREFERENCIAS);
    return normalizarPreferencias(crudo ? JSON.parse(crudo) : null);
  } catch {
    return PREFERENCIAS_POR_DEFECTO;
  }
}

/**
 * Escribe los atributos que lee el CSS. El tema "sistema" se resuelve aquí
 * contra la preferencia del sistema operativo, para que el CSS solo tenga que
 * mirar un valor concreto y no duplicar cada regla dentro de una media query.
 */
export function aplicarPreferencias(p: Preferencias, raiz: HTMLElement): void {
  const oscuro =
    p.tema === "oscuro" ||
    (p.tema === "sistema" &&
      typeof matchMedia === "function" &&
      matchMedia("(prefers-color-scheme: dark)").matches);

  raiz.dataset.tema = oscuro ? "oscuro" : "claro";
  raiz.dataset.acento = p.acento;
  raiz.dataset.texto = p.tamanoTexto;
  raiz.style.colorScheme = oscuro ? "dark" : "light";
}
