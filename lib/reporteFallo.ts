import type { AnalisisFuncional } from "./types";

/**
 * Reporte de un fallo del modelo, para que el clínico pueda comunicarlo.
 *
 * NO INCLUYE LO QUE ESCRIBIÓ LA IA. Es deliberado, y costó una iteración
 * entenderlo: la primera versión sí lo incluía y solo quitaba las citas
 * (`evidencia`), bajo la idea de que el texto generado era "del modelo" y no
 * "de la nota". Es falso. El análisis funcional describe el caso, así que su
 * texto ES contenido clínico: donde la nota decía "pidió ir al baño", el
 * informe escribía "pide ir al baño y se ausenta". Y una hipótesis con
 * confianza ALTA lo es, por el principio 11, precisamente porque hay una línea
 * de la nota que la sostiene explícitamente — esas son las más pegadas al
 * original.
 *
 * Aquí solo va lo que no puede identificar a nadie: qué modelo, qué versión del
 * prompt, qué sección falló y qué códigos de alerta se emitieron (los códigos,
 * no sus mensajes: los mensajes citan el texto generado). Lo clínico lo añade
 * el profesional a mano si lo cree necesario, con datos ficticios, y viéndolo
 * antes de copiar.
 */
export function construirReporteFallo(
  analisis: AnalisisFuncional,
  seccionId: string,
  comentario: string
): string {
  const lineas = [
    "Reporte de fallo — ACIA",
    "",
    `Fecha: ${new Date().toISOString()}`,
    `Modelo: ${analisis.meta.modelo || "(desconocido)"}`,
    `Versión de prompt: ${analisis.meta.version_prompt || "(desconocida)"}`,
    `Sección: ${seccionId}`,
  ];

  // Solo códigos y rutas: los mensajes de alerta citan el texto generado.
  if (analisis.alertas.length > 0) {
    lineas.push(
      "",
      "Alertas que el sistema ya había emitido sobre este informe:",
      ...analisis.alertas.map((a) => `- [${a.origen}/${a.codigo}] ${a.ruta}`)
    );
  }

  lineas.push(
    "",
    "Qué está mal, según el clínico:",
    comentario.trim() || "(descríbelo aquí)"
  );

  lineas.push(
    "",
    "---",
    "Este reporte NO incluye la nota clínica ni el análisis generado: el",
    "análisis describe el caso y por tanto es contenido clínico. Si para",
    "explicar el fallo hace falta el texto, escríbelo tú con datos ficticios."
  );

  return lineas.join("\n");
}
