import type { AnalisisFuncional } from "./types";
import { formatearInformeTexto } from "./formatearInforme";

/**
 * Exportación a Word sin dependencias.
 *
 * Word abre HTML con las declaraciones de espacio de nombres de Office y lo
 * trata como documento propio, respetando encabezados, listas y márgenes. No
 * es OOXML de verdad: no hay control fino de saltos de página ni estilos de
 * documento. Se eligió así para no añadir una librería al bundle (~500KB) por
 * una función que se usa al final del flujo. Si más adelante hace falta más
 * fidelidad, la vía es importar `docx` dinámicamente al pulsar el botón, para
 * que no pese en la carga inicial.
 *
 * Se construye sobre formatearInformeTexto para no tener dos versiones del
 * informe que puedan divergir: lo que se copia, se imprime y se exporta dice
 * exactamente lo mismo — incluidas las citas no verificadas, que aquí también
 * se declaran como inferencia (invariante 2).
 */

function escaparHtml(texto: string): string {
  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * El texto plano del informe usa tres marcas: una línea de guiones convierte la
 * anterior en título, "## " abre un subtítulo y "- " abre un elemento de lista.
 */
function cuerpoHtml(texto: string): string {
  const lineas = texto.split("\n");
  const salida: string[] = [];
  let enLista = false;

  const cerrarLista = () => {
    if (enLista) {
      salida.push("</ul>");
      enLista = false;
    }
  };

  for (let i = 0; i < lineas.length; i++) {
    const linea = lineas[i];
    const siguiente = lineas[i + 1] ?? "";

    // Título: la línea siguiente son solo guiones.
    if (linea.trim() && /^-{3,}$/.test(siguiente.trim())) {
      cerrarLista();
      salida.push(`<h2>${escaparHtml(linea.trim())}</h2>`);
      i++;
      continue;
    }

    if (linea.startsWith("## ")) {
      cerrarLista();
      salida.push(`<h3>${escaparHtml(linea.slice(3).trim())}</h3>`);
      continue;
    }

    if (linea.startsWith("- ")) {
      if (!enLista) {
        salida.push("<ul>");
        enLista = true;
      }
      salida.push(`<li>${escaparHtml(linea.slice(2))}</li>`);
      continue;
    }

    if (!linea.trim()) {
      cerrarLista();
      continue;
    }

    // Las líneas sangradas son continuación del punto anterior.
    if (enLista && /^\s{2,}/.test(linea)) {
      salida.push(`<li style="list-style:none">${escaparHtml(linea.trim())}</li>`);
      continue;
    }

    cerrarLista();
    salida.push(`<p>${escaparHtml(linea)}</p>`);
  }

  cerrarLista();
  return salida.join("\n");
}

function documentoWord(titulo: string, cuerpo: string): string {
  return `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta charset="utf-8">
<title>${escaparHtml(titulo)}</title>
<style>
  body { font-family: Georgia, serif; font-size: 11pt; color: #1f2a28; }
  h1 { font-size: 16pt; }
  h2 { font-size: 13pt; color: #2e5e4e; margin-top: 18pt; }
  h3 { font-size: 11pt; font-variant: small-caps; }
  li { margin-bottom: 4pt; }
  .descargo { font-size: 9pt; color: #5c6b67; border-top: 1px solid #e3e7e5; padding-top: 8pt; }
</style>
</head>
<body>
${cuerpo}
</body>
</html>`;
}

/** Descarga el informe como documento de Word. Se genera en el navegador: la nota no vuelve al servidor. */
export function descargarDocx(
  analisis: AnalisisFuncional,
  referenciaCaso: string,
  fecha: string
): void {
  const texto = formatearInformeTexto(analisis, referenciaCaso, fecha);
  const html = documentoWord(
    `ANCIA — ${referenciaCaso.trim() || "Análisis funcional"}`,
    cuerpoHtml(texto)
  );

  const nombreBase = referenciaCaso.trim()
    ? referenciaCaso.trim().replace(/[^a-zA-Z0-9-_]+/g, "_")
    : "analisis-funcional";

  // El BOM hace que Word respete los acentos sin preguntar por la codificación.
  const blob = new Blob(["﻿", html], { type: "application/msword" });
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement("a");
  enlace.href = url;
  enlace.download = `${nombreBase}.doc`;
  enlace.click();
  URL.revokeObjectURL(url);
}
