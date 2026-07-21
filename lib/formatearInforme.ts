import type { AnalisisFuncional, EslabonCadena } from "./types";

const SIN_HALLAZGOS = "Sin hallazgos suficientes en la nota.";
const DESCARGO =
  "Este análisis es una síntesis asistida de hipótesis funcionales generadas a partir de las notas proporcionadas. No constituye un diagnóstico ni sustituye el juicio clínico profesional. Toda hipótesis debe verificarse mediante evaluación directa.";

function seccion(titulo: string, cuerpo: string): string {
  return `${titulo}\n${"-".repeat(titulo.length)}\n${cuerpo || SIN_HALLAZGOS}\n`;
}

function listaOTexto(items: string[]): string {
  return items.length > 0 ? items.map((i) => `- ${i}`).join("\n") : SIN_HALLAZGOS;
}

function formatearEslabon(e: EslabonCadena): string {
  const lineas: string[] = [];
  lineas.push(`  Antecedente: ${e.antecedente.descripcion} — Evidencia: "${e.antecedente.evidencia}"`);
  if (e.operacion_motivacional) {
    const tipo = e.operacion_motivacional.tipo === "establecedora" ? "OE" : "OA";
    lineas.push(
      `  Operación motivacional [${tipo}]: ${e.operacion_motivacional.descripcion} — Evidencia: "${e.operacion_motivacional.evidencia}"`
    );
  }
  lineas.push(
    `  Conducta [${e.conducta.tipo_respuesta}, ${e.conducta.tipo_manifestacion}]: ${e.conducta.descripcion} — Evidencia: "${e.conducta.evidencia}"`
  );
  if (e.consecuencia) {
    lineas.push(
      `  Consecuencia [${e.consecuencia.tipo}, ${e.consecuencia.inmediatez}]: ${e.consecuencia.descripcion} — Evidencia: "${e.consecuencia.evidencia}"`
    );
  } else {
    lineas.push("  Consecuencia: no aplica (respuesta respondiente, no mantenida por consecuencia).");
  }
  return lineas.join("\n");
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
      "VARIABLES MODULADORAS",
      analisis.variables_moduladoras
        .map((v) => `- [${v.categoria}] ${v.descripcion} — Evidencia: "${v.evidencia}"`)
        .join("\n")
    )
  );

  const situacional = analisis.analisis_situacional
    .map((s) => {
      const encabezado = `${s.contexto}${s.patron_central ? " (PATRÓN CENTRAL)" : ""}`;
      const cadena = s.cadena.map(formatearEslabon).join("\n\n");
      const hipotesis = `Hipótesis (Confianza: ${s.hipotesis.confianza}): ${s.hipotesis.enunciado}\nFunción: ${s.hipotesis.funcion}`;
      const alternativas = s.hipotesis_alternativas.length
        ? s.hipotesis_alternativas
            .map((h) => `  - ${h.enunciado}\n    Cómo descartarla: ${h.como_descartarla}`)
            .join("\n")
        : "  Ninguna registrada.";
      const cmlp = s.consecuencias_mantenimiento_largo_plazo
        ? `Mantenimiento a largo plazo: ${s.consecuencias_mantenimiento_largo_plazo.descripcion} — Evidencia: "${s.consecuencias_mantenimiento_largo_plazo.evidencia}"`
        : "";
      return [
        `## ${encabezado}`,
        cadena,
        hipotesis,
        "Hipótesis alternativas:",
        alternativas,
        cmlp,
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n\n");

  partes.push(seccion("ANÁLISIS FUNCIONAL POR SITUACIÓN", situacional));

  partes.push(
    seccion(
      "ANÁLISIS DE LA CONDUCTA DEL CUIDADOR",
      analisis.analisis_cuidador
        .map((c) => `- [${c.patron}] ${c.descripcion} — Evidencia: "${c.evidencia}"`)
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

  partes.push(
    seccion(
      `HABILIDADES RECOMENDADAS (${analisis.modelo_terapeutico.toUpperCase()})`,
      analisis.habilidades_recomendadas
        .map(
          (h) =>
            `- [${h.modulo}] ${h.habilidad}\n  Justificación: ${h.justificacion}\n  Cómo practicarla: ${h.como_practicarla}`
        )
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
