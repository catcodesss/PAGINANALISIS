import type { AnalisisFuncional } from "./types";

const SIN_HALLAZGOS = "Sin hallazgos suficientes en la nota.";
const DESCARGO =
  "Este análisis es una síntesis asistida de hipótesis funcionales generadas a partir de las notas proporcionadas. No constituye un diagnóstico ni sustituye el juicio clínico profesional. Toda hipótesis debe verificarse mediante evaluación directa.";

function seccion(titulo: string, cuerpo: string): string {
  return `${titulo}\n${"-".repeat(titulo.length)}\n${cuerpo || SIN_HALLAZGOS}\n`;
}

function listaOTexto(items: string[]): string {
  return items.length > 0 ? items.map((i) => `- ${i}`).join("\n") : SIN_HALLAZGOS;
}

/** Texto plano formateado para copiar al portapapeles, en el mismo orden que el informe visual. */
export function formatearInformeTexto(
  analisis: AnalisisFuncional,
  referenciaCaso: string,
  fecha: string
): string {
  const partes: string[] = [];
  partes.push("AFA — ANÁLISIS FUNCIONAL ASISTIDO");
  partes.push(`Fecha de generación: ${fecha}`);
  if (referenciaCaso.trim()) {
    partes.push(`Referencia del caso: ${referenciaCaso.trim()}`);
  }
  partes.push("");

  partes.push(seccion("RESUMEN CLÍNICO", analisis.resumen_clinico));

  partes.push(
    seccion(
      "CONDUCTAS PROBLEMA",
      analisis.conductas_problema
        .map((c) => `- [${c.tipo}] ${c.descripcion}\n  Evidencia: "${c.evidencia}"`)
        .join("\n")
    )
  );

  partes.push(
    seccion(
      `ANÁLISIS DE ANTECEDENTES (Confianza: ${analisis.antecedentes.confianza})`,
      [
        "Estímulos discriminativos y contexto situacional:",
        listaOTexto(
          analisis.antecedentes.estimulos_discriminativos.map(
            (e) => `${e.descripcion} — Evidencia: "${e.evidencia}"`
          )
        ),
        listaOTexto(
          analisis.antecedentes.contexto_situacional.map(
            (c) => `${c.descripcion} — Evidencia: "${c.evidencia}"`
          )
        ),
      ].join("\n")
    )
  );

  partes.push(
    seccion(
      "OPERACIONES MOTIVACIONALES",
      analisis.operaciones_motivacionales
        .map(
          (o) =>
            `- [${o.tipo === "establecedora" ? "OE" : "OA"}] ${o.descripcion}\n  Efecto hipotetizado: ${o.efecto_hipotetizado}\n  Evidencia: "${o.evidencia}"`
        )
        .join("\n")
    )
  );

  partes.push(
    seccion(
      `CONSECUENCIAS Y MANTENIMIENTO (Confianza: ${analisis.consecuencias_y_mantenimiento.confianza})`,
      analisis.consecuencias_y_mantenimiento.contingencias
        .map(
          (c) =>
            `- [${c.tipo}, ${c.inmediatez}] ${c.descripcion}\n  Evidencia: "${c.evidencia}"`
        )
        .join("\n")
    )
  );

  partes.push(
    seccion(
      `HIPÓTESIS FUNCIONAL PRINCIPAL (Confianza: ${analisis.hipotesis_funcional_principal.confianza})`,
      `${analisis.hipotesis_funcional_principal.enunciado}${
        analisis.hipotesis_funcional_principal.funcion
          ? `\nFunción: ${analisis.hipotesis_funcional_principal.funcion}`
          : ""
      }`
    )
  );

  partes.push(
    seccion(
      "HIPÓTESIS ALTERNATIVAS",
      analisis.hipotesis_alternativas
        .map((h) => `- ${h.enunciado}\n  Cómo descartarla: ${h.como_descartarla}`)
        .join("\n")
    )
  );

  partes.push(
    seccion(
      "REGLAS VERBALES",
      analisis.reglas_verbales
        .map(
          (r) =>
            `- [${r.clase}, rigidez ${r.rigidez}] "${r.regla}"\n  ${r.analisis}`
        )
        .join("\n")
    )
  );

  partes.push(
    seccion(
      "PROCESOS ACT IDENTIFICADOS",
      analisis.procesos_act
        .map((p) => `- ${p.proceso}: ${p.descripcion}\n  Evidencia: "${p.evidencia}"`)
        .join("\n")
    )
  );

  partes.push(seccion("PREGUNTAS PARA LA PRÓXIMA SESIÓN", listaOTexto(analisis.preguntas_para_sesion)));
  partes.push(
    seccion("LÍNEAS DE INTERVENCIÓN TENTATIVAS", listaOTexto(analisis.lineas_de_intervencion_tentativas))
  );
  partes.push(seccion("DATOS FALTANTES", listaOTexto(analisis.datos_faltantes)));

  partes.push(DESCARGO);

  return partes.join("\n");
}
