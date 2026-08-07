import type { AnalisisFuncional, Cita, Situacion } from "./types";
import { agruparAlertas } from "./validadores";

/**
 * Nombre legible de cada sección, para decir dónde puede haberse reflejado un
 * fallo. Son los mismos rótulos que emite este archivo más abajo en las
 * llamadas a `seccion()`, en minúscula: aquí se leen dentro de una frase, no
 * como encabezado.
 */
const TITULOS_SECCION: Record<string, string> = {
  "datos-faltantes": "Datos faltantes",
  riesgo: "Riesgo",
  resumen: "Resumen clínico",
  conductas: "Conductas problema",
  "variables-moduladoras": "Variables moduladoras",
  situaciones: "Análisis por situaciones",
  "conductas-alternativas": "Conductas alternativas",
  modalidad: "Detalle según modelo terapéutico",
  "hipotesis-alternativas": "Hipótesis alternativas",
  preguntas: "Preguntas para la próxima sesión",
  intervencion: "Líneas de intervención",
};

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

/** Separador entre dos apartados que comparten un mismo bloque reordenable. */
const SALTO = "\n";

/**
 * Orden de fábrica de los bloques. Usa los mismos ids que
 * components/ReportView.tsx#SECCIONES: es lo que permite que el informe
 * exportado salga en el orden que el clínico dejó en pantalla.
 *
 * Algunos bloques agrupan varios apartados del texto —«situaciones» arrastra
 * la acomodación del entorno, «modalidad» las tres capas— porque en pantalla
 * también se mueven juntos.
 */
export const ORDEN_BLOQUES_POR_DEFECTO = [
  "datos-faltantes",
  "riesgo",
  "alertas",
  "hipotesis-principal",
  "resumen",
  "conductas",
  "variables-moduladoras",
  "situaciones",
  "hipotesis-mantenimiento",
  "formulacion",
  "conductas-alternativas",
  "modalidad",
  "hipotesis-alternativas",
  "preguntas",
  "intervencion",
];

export function formatearInformeTexto(
  analisis: AnalisisFuncional,
  referenciaCaso: string,
  fecha: string,
  /** Orden elegido por el clínico. Sin él, el de fábrica. */
  orden: string[] = ORDEN_BLOQUES_POR_DEFECTO
): string {
  const partes: string[] = [];
  partes.push("ACIA — ANÁLISIS DE CONDUCTA ASISTIDO POR IA");
  partes.push(`Fecha de generación: ${fecha}`);
  if (referenciaCaso.trim()) {
    partes.push(`Referencia del caso: ${referenciaCaso.trim()}`);
  }
  partes.push("");

  if (analisis.meta.modelo) {
    partes.push(
      `Generado con: ${analisis.meta.modelo} · prompt v${analisis.meta.version_prompt}`
    );
  }
  // Igual que en pantalla: quien lea este informe debe poder distinguir lo que
  // escribió el profesional de lo que generó la IA.
  if (analisis.secciones_editadas.length > 0) {
    partes.push(
      `Secciones editadas a mano por el profesional: ${analisis.secciones_editadas.join(", ")}`
    );
  }
  partes.push("");

  // Cada bloque se indexa por su id de seccion; se emiten al final en el
  // orden que pida el clinico (ver ORDEN_BLOQUES_POR_DEFECTO).
  const bloques: Record<string, string> = {};

  bloques["datos-faltantes"] = (seccion("DATOS FALTANTES", listaOTexto(analisis.datos_faltantes)));

  bloques["riesgo"] = (
    seccion(
      "RIESGO",
      analisis.riesgo.evaluado
        ? listaOTexto(analisis.riesgo.indicadores) === SIN_HALLAZGOS
          ? "Sin indicadores de riesgo detectados en la nota."
          : listaOTexto(analisis.riesgo.indicadores)
        : "No se ha evaluado el riesgo en esta nota: falta información para pronunciarse."
    )
  );

  // Los avisos del validador acompañan al informe exportado: si se imprime o
  // se pega en una historia clínica, las advertencias viajan con él. Agrupados
  // igual que en pantalla, y con la sección afectada: quien lea esto en papel
  // no puede pinchar un enlace, así que el nombre del apartado tiene que estar
  // escrito.
  if (analisis.alertas.length > 0) {
    bloques["alertas"] = (
      seccion(
        "PUNTOS A VERIFICAR DEL ANÁLISIS",
        agruparAlertas(analisis.alertas)
          .map((g) => {
            const cabecera = `- [${g.gravedad === "alta" ? "revisar antes de usar" : "conviene revisar"}] ${g.mensaje}`;
            const elementos = g.elementos.map((e) => `    — ${e}`);
            const secciones = g.secciones
              .map((id) => TITULOS_SECCION[id])
              .filter(Boolean);
            const donde = secciones.length
              ? [`    Puede haberse reflejado en: ${secciones.join(", ")}.`]
              : [];
            return [cabecera, ...elementos, ...donde].join("\n");
          })
          .join("\n")
      )
    );
  }

  bloques["resumen"] = seccion("RESUMEN CLÍNICO", analisis.resumen_clinico);

  bloques["conductas"] = (
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

  bloques["variables-moduladoras"] = (
    seccion(
      "VARIABLES MODULADORAS",
      analisis.variables_moduladoras
        .map((v) => `- [${v.tipo}] ${v.descripcion} — Evidencia: ${textoCita(v.evidencia)}`)
        .join("\n")
    )
  );

  bloques["situaciones"] = (
    seccion(
      "ANÁLISIS POR SITUACIONES",
      analisis.situaciones.map(formatearSituacion).join("\n\n")
    )
  );

  bloques["situaciones"] += SALTO + (
    seccion(
      "ACOMODACIÓN DEL ENTORNO",
      analisis.acomodacion_entorno
        .map(
          (a) =>
            `- [${a.quien}] ${a.conducta_acomodacion}${a.funcion ? `\n  Función: ${a.funcion}` : ""}\n  Evidencia: ${textoCita(a.evidencia)}`
        )
        .join("\n")
    )
  );

  bloques["hipotesis-mantenimiento"] = (
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

  bloques["hipotesis-mantenimiento"] += SALTO + (
    seccion("HIPÓTESIS DE ORIGEN (TENTATIVAS)", listaOTexto(analisis.hipotesis_origen))
  );

  bloques["formulacion"] = (
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
        "",
        "Valores y metas del consultante:",
        listaOTexto(analisis.valores_y_metas),
        "",
        "Pérdida de reforzadores:",
        listaOTexto(analisis.perdida_de_reforzadores),
      ].join("\n")
    )
  );

  bloques["conductas-alternativas"] = (
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

  bloques["modalidad"] = (
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
  bloques["modalidad"] += SALTO + (
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
  bloques["modalidad"] += SALTO + (
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
  bloques["modalidad"] += SALTO + (
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

  bloques["modalidad"] += SALTO + (
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

  bloques["hipotesis-alternativas"] = (
    seccion(
      "HIPÓTESIS ALTERNATIVAS",
      analisis.hipotesis_alternativas
        .map((h) => `- ${h.enunciado}\n  Cómo descartarla: ${h.como_descartarla}`)
        .join("\n")
    )
  );

  bloques["preguntas"] = seccion("PREGUNTAS PARA LA PRÓXIMA SESIÓN", listaOTexto(analisis.preguntas_para_sesion));
  bloques["intervencion"] = (
    seccion("LÍNEAS DE INTERVENCIÓN TENTATIVAS", listaOTexto(analisis.lineas_de_intervencion_tentativas))
  );

  for (const id of orden) {
    if (bloques[id]) partes.push(bloques[id]);
  }
  // Un bloque que el orden guardado no mencione —porque se añadió después de
  // guardarlo— no puede desaparecer del informe: se emite al final.
  for (const [id, texto] of Object.entries(bloques)) {
    if (!orden.includes(id) && texto) partes.push(texto);
  }

  partes.push(DESCARGO);

  return partes.join("\n");
}
