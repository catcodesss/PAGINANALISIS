import type { AnalisisFuncional } from "./types";

/**
 * Reporte de un fallo del modelo, para que el clínico pueda comunicarlo.
 *
 * Qué se excluye por construcción: la nota clínica y las citas del informe,
 * que son recortes literales de ella (ver seccionParaReporte en ReportView).
 *
 * Qué NO se puede excluir: el texto que escribió el modelo describe el caso,
 * porque de eso trata. Comprobado en pruebas — una descripción generada podía
 * contener casi literalmente una frase de la nota. Por eso la interfaz muestra
 * el reporte completo y editable antes de copiarlo, en vez de prometer una
 * anonimización que no puede garantizar. El invariante 5 sigue intacto: aquí
 * nada se registra ni se transmite; es el clínico quien decide qué pega y
 * dónde.
 */
export function construirReporteFallo(
  analisis: AnalisisFuncional,
  seccionId: string,
  textoGenerado: string,
  comentario: string
): string {
  const lineas = [
    "Reporte de fallo — ACIA",
    "",
    `Fecha: ${new Date().toISOString()}`,
    `Modelo: ${analisis.meta.modelo || "(desconocido)"}`,
    `Versión de prompt: ${analisis.meta.version_prompt || "(desconocida)"}`,
    `Sección: ${seccionId}`,
    "",
    "Texto generado por la IA:",
    textoGenerado.trim() || "(vacío)",
  ];

  if (comentario.trim()) {
    lineas.push("", "Qué está mal, según el clínico:", comentario.trim());
  }

  if (analisis.alertas.length > 0) {
    lineas.push(
      "",
      "Alertas que el sistema ya había emitido sobre este informe:",
      ...analisis.alertas.map((a) => `- [${a.origen}/${a.codigo}] ${a.ruta}`)
    );
  }

  lineas.push(
    "",
    "---",
    "No incluye la nota clínica ni sus citas literales. El texto de la IA que",
    "aparece arriba sí describe el caso: revísalo antes de compartirlo."
  );

  return lineas.join("\n");
}
