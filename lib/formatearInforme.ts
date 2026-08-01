import type { AnalisisFuncional, Cita, Situacion } from "./types";

const SIN_HALLAZGOS = "Sin hallazgos suficientes en la nota.";
const DESCARGO =
  "Este análisis es una síntesis asistida de hipótesis funcionales generadas a partir de las notas proporcionadas. No constituye un diagnóstico ni sustituye el juicio clínico profesional. Toda hipótesis debe verificarse mediante evaluación directa.";

/**
 * Mismo criterio que el componente Cita de la interfaz: solo se entrecomilla el
 * texto recortado de la nota. Lo no verificado se declara como inferencia, para
 * que el informe copiado o impreso no afirme más de lo que sostiene la nota.
 */
function textoCita(cita: Cita): string {
  if (!cita.verificada) return "inferido — sin cita literal en la nota";
  const rango =
    cita.linea_inicio === cita.linea_fin
      ? `línea ${cita.linea_inicio}`
      : `líneas ${cita.linea_inicio}–${cita.linea_fin}`;
  return `"${cita.texto}" (${rango})`;
}

function seccion(titulo: string, cuerpo: string): string {
  return `${titulo}\n${"-".repeat(titulo.length)}\n${cuerpo || SIN_HALLAZGOS}\n`;
}

function listaOTexto(items: string[]): string {
  return items.length > 0 ? items.map((i) => `- ${i}`).join("\n") : SIN_HALLAZGOS;
}

function formatearSituacion(s: Situacion): string {
  const lineas: string[] = [`## ${s.nombre} (Confianza: ${s.confianza})`];

  if (s.cadena_operante) {
    const c = s.cadena_operante;
    lineas.push("Cadena operante:");
    if (c.operacion_motivacional) {
      lineas.push(`  OM: ${c.operacion_motivacional}`);
    }
    lineas.push(`  Antecedente: ${c.antecedente}`);
    lineas.push(`  Respuesta: ${c.respuesta}`);
    lineas.push(
      `  Consecuencia [${c.tipo_contingencia}, ${c.inmediatez}]: ${c.consecuencia}`
    );
    if (c.consecuencias_largo_plazo) {
      lineas.push(`  Consecuencias a largo plazo: ${c.consecuencias_largo_plazo}`);
    }
    lineas.push(`  Evidencia: ${textoCita(c.evidencia)}`);
  }

  if (s.cadena_dbt) {
    const c = s.cadena_dbt;
    lineas.push("Cadena de eslabones (DBT):");
    lineas.push(
      `  Factores de vulnerabilidad: ${c.factores_vulnerabilidad.join("; ") || "—"}`
    );
    lineas.push(`  Evento precipitante: ${c.evento_precipitante}`);
    c.eslabones.forEach((e, i) => {
      lineas.push(`  Eslabón ${i + 1} [${e.tipo}]: ${e.descripcion}`);
    });
    lineas.push(`  Conducta problema: ${c.conducta_problema}`);
    lineas.push(`  Consecuencias: ${c.consecuencias}`);
    lineas.push(`  Evidencia: ${textoCita(c.evidencia)}`);
  }

  if (s.cadena_respondiente) {
    const c = s.cadena_respondiente;
    lineas.push("Cadena respondiente:");
    lineas.push(`  Estímulo: ${c.estimulo}`);
    lineas.push(`  Respuesta condicionada: ${c.respuesta_condicionada}`);
    if (c.conexion_con_operante) {
      lineas.push(`  Conexión con la cadena operante: ${c.conexion_con_operante}`);
    }
    lineas.push(`  Evidencia: ${textoCita(c.evidencia)}`);
  }

  if (s.ciclo_interconductual) {
    lineas.push(`Ciclo interconductual: ${s.ciclo_interconductual}`);
  }

  lineas.push(`Función hipotetizada: ${s.funcion_hipotetizada}`);

  return lineas.join("\n");
}

/** Texto plano formateado para copiar al portapapeles, en el mismo orden que el informe visual. */
export function formatearInformeTexto(
  analisis: AnalisisFuncional,
  referenciaCaso: string,
  fecha: string
): string {
  const partes: string[] = [];
  partes.push("ANCIA — ANÁLISIS DE CONDUCTA ASISTIDO POR IA");
  partes.push(`Fecha de generación: ${fecha}`);
  if (referenciaCaso.trim()) {
    partes.push(`Referencia del caso: ${referenciaCaso.trim()}`);
  }
  partes.push("");

  partes.push(seccion("DATOS FALTANTES", listaOTexto(analisis.datos_faltantes)));

  // Las revisiones del validador acompañan al informe exportado: si se imprime o
  // se pega en una historia clínica, las advertencias viajan con él.
  if (analisis.alertas.length > 0) {
    partes.push(
      seccion(
        "REVISIONES SUGERIDAS",
        analisis.alertas
          .map(
            (a) =>
              `- [${a.gravedad === "alta" ? "revisar antes de usar" : "conviene revisar"}] ${a.mensaje}`
          )
          .join("\n")
      )
    );
  }

  partes.push(seccion("RESUMEN CLÍNICO", analisis.resumen_clinico));

  partes.push(
    seccion(
      "CONDUCTAS PROBLEMA",
      analisis.conductas_problema
        .map(
          (c) =>
            `- [${c.tipo}, importancia ${c.importancia}${c.es_conducta_seguridad ? ", CONDUCTA DE SEGURIDAD" : ""}${c.deficit_o_interferencia !== "no_determinable" ? `, ${c.deficit_o_interferencia}` : ""}] ${c.descripcion}${c.justificacion_deficit ? `\n  ${c.justificacion_deficit}` : ""}\n  Evidencia: ${textoCita(c.evidencia)}`
        )
        .join("\n")
    )
  );

  partes.push(
    seccion(
      "VARIABLES MODULADORAS",
      analisis.variables_moduladoras
        .map((v) => `- [${v.tipo}] ${v.descripcion} — Evidencia: ${textoCita(v.evidencia)}`)
        .join("\n")
    )
  );

  partes.push(
    seccion(
      "ANÁLISIS POR SITUACIONES",
      analisis.situaciones.map(formatearSituacion).join("\n\n")
    )
  );

  partes.push(
    seccion(
      "HIPÓTESIS DE MANTENIMIENTO",
      analisis.hipotesis_mantenimiento
        .map(
          (h) =>
            `- [${h.conducta}] (Confianza: ${h.confianza}) ${h.enunciado}\n  Función: ${h.funcion}`
        )
        .join("\n")
    )
  );

  partes.push(
    seccion("HIPÓTESIS DE ORIGEN (TENTATIVAS)", listaOTexto(analisis.hipotesis_origen))
  );

  partes.push(
    seccion(
      "FORMULACIÓN DEL CASO",
      [
        "Relaciones entre problemas:",
        listaOTexto(analisis.formulacion.relaciones_entre_problemas),
        "",
        "Priorización de blancos de intervención:",
        analisis.formulacion.priorizacion
          .map((p, i) => `${i + 1}. ${p.blanco}: ${p.justificacion}`)
          .join("\n"),
      ].join("\n")
    )
  );

  partes.push(
    seccion(
      "CONDUCTAS ALTERNATIVAS PROPUESTAS",
      analisis.conductas_alternativas
        .map(
          (c) =>
            `- [${c.situacion}] ${c.conducta_propuesta}\n  Consecuencia necesaria: ${c.consecuencia_necesaria}`
        )
        .join("\n")
    )
  );

  partes.push(
    seccion(
      "CAPA ACT — REGLAS VERBALES",
      analisis.capa_act.reglas_verbales
        .map(
          (r) =>
            `- [${r.clase}, ${r.textual_o_inferida}, rigidez ${r.rigidez}] "${r.regla}"\n  ${r.analisis}`
        )
        .join("\n")
    )
  );
  partes.push(
    seccion(
      "CAPA ACT — PROCESOS DE INFLEXIBILIDAD",
      analisis.capa_act.procesos_act
        .map(
          (p) =>
            `- ${p.proceso}: ${p.vinculo_con_cadena}\n  Evidencia: ${textoCita(p.evidencia)}`
        )
        .join("\n")
    )
  );

  const cadenaDbt = analisis.capa_dbt.analisis_en_cadena;
  partes.push(
    seccion(
      "CAPA DBT — ANÁLISIS EN CADENA",
      [
        `Conducta objetivo: ${cadenaDbt.conducta_objetivo}`,
        "Vulnerabilidades:",
        listaOTexto(cadenaDbt.vulnerabilidades),
        `Evento precipitante: ${cadenaDbt.evento_precipitante}`,
        "Eslabones:",
        listaOTexto(
          cadenaDbt.eslabones.map((e) => `[${e.tipo}] ${e.descripcion}`)
        ),
        "Consecuencias corto plazo:",
        listaOTexto(cadenaDbt.consecuencias_corto_plazo),
        "Consecuencias largo plazo:",
        listaOTexto(cadenaDbt.consecuencias_largo_plazo),
      ].join("\n")
    )
  );
  partes.push(
    seccion(
      "CAPA DBT — HABILIDADES SUGERIDAS",
      analisis.capa_dbt.habilidades_sugeridas
        .map(
          (h) =>
            `- [${h.modulo}] ${h.habilidad}\n  Eslabón objetivo: ${h.eslabon_objetivo}`
        )
        .join("\n")
    )
  );

  partes.push(
    seccion(
      "CAPA CONDUCTUAL — PROCEDIMIENTOS SUGERIDOS",
      analisis.capa_mc.procedimientos_sugeridos
        .map(
          (p) =>
            `- ${p.procedimiento}\n  Contingencia objetivo: ${p.contingencia_objetivo}\n  Precauciones: ${p.precauciones}`
        )
        .join("\n")
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

  partes.push(seccion("PREGUNTAS PARA LA PRÓXIMA SESIÓN", listaOTexto(analisis.preguntas_para_sesion)));
  partes.push(
    seccion("LÍNEAS DE INTERVENCIÓN TENTATIVAS", listaOTexto(analisis.lineas_de_intervencion_tentativas))
  );

  partes.push(DESCARGO);

  return partes.join("\n");
}
