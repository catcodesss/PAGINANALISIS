import { ETIQUETA_ESQUEMA, type AnalisisFuncional, type Cita, type Situacion } from "./types";
import { agruparAlertas } from "./validadores";
import { ORDEN_SECCIONES_POR_DEFECTO, TITULO_DE_SECCION } from "./secciones";
import { AVISO_EJEMPLO } from "./maqueta";
import {
  NIVELES_CONFIANZA,
  INTRO_NIVELES_CONFIANZA,
  NOTA_PIE_NIVELES_CONFIANZA,
} from "./nivelesConfianza";

const SIN_HALLAZGOS = "Sin hallazgos suficientes en la nota.";

/**
 * Lo que la sección "Hipótesis de origen" advierte de sí misma, en pantalla y
 * en el documento exportado. Vive aquí y no en el componente porque es
 * redacción clínica que tiene que decir lo mismo en las dos superficies: si el
 * sello de la pantalla y la advertencia del papel divergen, el informe impreso
 * —que es el que acaba en una historia clínica— sería el que se queda sin
 * ella.
 */
export const AVISO_ORIGEN_NO_MODIFICABLE =
  "No modificable · no genera blancos de intervención. El origen explica cómo se adquirió el problema, no qué lo mantiene hoy; por eso no se interviene sobre él. Los blancos salen de las hipótesis de mantenimiento.";
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
      `  Consecuencia [${c.tipo_contingencia}, ${c.inmediatez}, ${ETIQUETA_ESQUEMA[c.esquema_de_contingencia]}]: ${c.consecuencia}`
    );
    if (c.esquema_de_contingencia === "intermitente") {
      lineas.push(
        "    El refuerzo intermitente sostiene el patrón mucho más que uno continuo: cuenta con más resistencia a la extinción y más dosis de exposición."
      );
    }
    if (c.consecuencias_largo_plazo) {
      lineas.push(`  Consecuencias a largo plazo: ${c.consecuencias_largo_plazo}`);
    }
    lineas.push(`  De la nota: ${textoCita(c.evidencia)}`);
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
    lineas.push(`  De la nota: ${textoCita(c.evidencia)}`);
  }

  if (s.cadena_respondiente) {
    const c = s.cadena_respondiente;
    lineas.push("Cadena respondiente:");
    lineas.push(`  Estímulo: ${c.estimulo}`);
    lineas.push(`  Respuesta condicionada: ${c.respuesta_condicionada}`);
    if (c.conexion_con_operante) {
      lineas.push(`  Conexión con la cadena operante: ${c.conexion_con_operante}`);
    }
    lineas.push(`  De la nota: ${textoCita(c.evidencia)}`);
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
/** Se conserva el nombre porque lo importan la exportación a Word y el reordenado. */
export const ORDEN_BLOQUES_POR_DEFECTO: string[] = ORDEN_SECCIONES_POR_DEFECTO;

export function formatearInformeTexto(
  analisis: AnalisisFuncional,
  referenciaCaso: string,
  fecha: string,
  /** Orden elegido por el clínico. Sin él, el de fábrica. */
  orden: string[] = ORDEN_BLOQUES_POR_DEFECTO,
  /** Informe de demostración: lo marca antes que nada. Ver lib/maqueta.ts. */
  esEjemplo = false
): string {
  const partes: string[] = [];
  // Lo primero de todo y separado: un documento exportado se lee fuera de
  // contexto, y esto tiene que verse antes que el contenido clínico.
  if (esEjemplo) {
    partes.push(AVISO_EJEMPLO);
    partes.push("=".repeat(72));
    partes.push("");
  }
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

  // Los huecos de la nota y los avisos del validador responden a la misma
  // pregunta —qué hay que comprobar antes de dar el informe por bueno— y por
  // eso comparten sección, cada uno con su subtítulo. Se emite si hay
  // cualquiera de las dos cosas; si no hay ninguna, no hay nada que verificar
  // y la sección no viaja con el documento.
  const apartadosVerificacion: string[] = [];

  if (analisis.datos_faltantes.length > 0) {
    apartadosVerificacion.push(
      "## Datos faltantes",
      analisis.datos_faltantes
        .map(
          (d) =>
            `- ${d.dato}${d.por_que_importa ? `\n  Por qué importa: ${d.por_que_importa}` : "\n  Sin motivo declarado."}`
        )
        .join("\n")
    );
  }

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
    apartadosVerificacion.push(
      "## Puntos a verificar del análisis",
      agruparAlertas(analisis.alertas)
        .map((g) => {
          const cabecera = `- [${g.gravedad === "alta" ? "revisar antes de usar" : "conviene revisar"}] ${g.mensaje}`;
          const elementos = g.elementos.map((e) => `    — ${e}`);
          const secciones = g.secciones
            .map((id) => TITULO_DE_SECCION[id])
            .filter(Boolean);
          const donde = secciones.length
            ? [`    Puede haberse reflejado en: ${secciones.join(", ")}.`]
            : [];
          return [cabecera, ...elementos, ...donde].join("\n");
        })
        .join("\n")
    );
  }

  if (apartadosVerificacion.length > 0) {
    bloques["verificacion"] = seccion(
      "DATOS FALTANTES Y PUNTOS A VERIFICAR",
      apartadosVerificacion.join("\n\n")
    );
  }

  // Texto fijo, no salida del modelo: no depende del análisis y por eso se
  // emite siempre, igual en un informe parcial que en uno completo. Va aquí
  // porque el documento exportado escribe "(Confianza: alta)" en cada
  // situación y en cada hipótesis, y sin la leyenda esas palabras llegan al
  // papel —o a una historia clínica— sin nada que diga qué miden. En pantalla
  // hay una tarjeta; fuera de la pantalla no había nada.
  bloques["niveles-confianza"] = seccion(
    "NIVELES DE CONFIANZA",
    [
      INTRO_NIVELES_CONFIANZA,
      "",
      ...NIVELES_CONFIANZA.map(
        ({ etiqueta, frase, resto }) => `- ${etiqueta}: ${frase} ${resto}`
      ),
      "",
      NOTA_PIE_NIVELES_CONFIANZA,
    ].join("\n")
  );

  bloques["resumen"] = seccion("RESUMEN CLÍNICO", analisis.resumen_clinico);

  // Las tres columnas de la pantalla, en el papel, como tres apartados: los
  // excesos y los déficits salen del mismo campo (los reparte
  // deficit_o_interferencia) y los activos de repertorio_disponible. En un
  // documento no hay columnas que quepan, pero la separación tiene que llegar
  // igual: es la que distingue un problema de adquisición de uno de
  // generalización.
  const conducta = (c: AnalisisFuncional["conductas_problema"][number]) =>
    `- [${c.tipo}, importancia ${c.importancia}${c.es_conducta_seguridad ? ", CONDUCTA DE SEGURIDAD" : ""}${c.deficit_o_interferencia !== "no_determinable" ? `, ${c.deficit_o_interferencia}` : ""}] ${c.descripcion}${c.justificacion_deficit ? `\n  ${c.justificacion_deficit}` : ""}\n  De la nota: ${textoCita(c.evidencia)}`;

  const esDeficit = (c: AnalisisFuncional["conductas_problema"][number]) =>
    c.deficit_o_interferencia === "deficit";

  bloques["conductas"] = (
    seccion(
      "REPERTORIO CONDUCTUAL",
      [
        "## Excesos",
        analisis.conductas_problema.filter((c) => !esDeficit(c)).map(conducta).join("\n") ||
          "Ninguna conducta clasificada como exceso.",
        "",
        "## Déficits",
        analisis.conductas_problema.filter(esDeficit).map(conducta).join("\n") ||
          "Ninguna conducta clasificada como déficit.",
        "",
        "## Activos (repertorio disponible)",
        analisis.repertorio_disponible
          .map(
            (r) =>
              `- ${r.descripcion}${r.contexto_en_que_ocurre ? `\n  Ocurre en: ${r.contexto_en_que_ocurre}` : ""}${r.evidencia ? `\n  De la nota: ${textoCita(r.evidencia)}` : ""}`
          )
          .join("\n") ||
          "La nota no recoge ningún contexto en que la conducta adecuada sí ocurra.",
      ].join("\n")
    )
  );

  bloques["variables-moduladoras"] = (
    seccion(
      "VARIABLES MODULADORAS",
      analisis.variables_moduladoras
        .map((v) => `- [${v.tipo}] ${v.descripcion} — De la nota: ${textoCita(v.evidencia)}`)
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
            `- [${a.quien}] ${a.conducta_acomodacion}${a.funcion ? `\n  Función: ${a.funcion}` : ""}\n  De la nota: ${textoCita(a.evidencia)}`
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

  // Bloque propio, no un apartado dentro del mantenimiento. Separar origen de
  // mantenimiento es la defensa estructural contra el error clínico más
  // frecuente —tratar cómo se adquirió el problema en vez de qué lo sostiene
  // hoy—, y esa separación tiene que sobrevivir al papel: en el documento
  // exportado, un subtítulo dentro de otra sección se lee como una
  // continuación suya. La advertencia va escrita, no solo dibujada, porque el
  // informe impreso no tiene sellos.
  bloques["hipotesis-origen"] = (
    seccion(
      "HIPÓTESIS DE ORIGEN (TENTATIVAS)",
      [
        AVISO_ORIGEN_NO_MODIFICABLE,
        "",
        listaOTexto(analisis.hipotesis_origen),
      ].join("\n")
    )
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
        "Fortalezas y recursos:",
        listaOTexto(analisis.fortalezas_y_recursos),
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
            `- ${p.proceso}: ${p.vinculo_con_cadena}\n  De la nota: ${textoCita(p.evidencia)}`
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
  if (analisis.capa_dbt.eslabon_ausente) {
    bloques["modalidad"] += SALTO + (
      seccion("CAPA DBT — ESLABÓN AUSENTE", analisis.capa_dbt.eslabon_ausente)
    );
  }

  bloques["modalidad"] += SALTO + (
    seccion(
      "CAPA DBT — ANÁLISIS DE SOLUCIONES",
      analisis.capa_dbt.analisis_de_soluciones
        .map(
          (s) =>
            `- [${s.tipo_estrategia === "antecedente" ? "antes del eslabón" : "durante el eslabón"}] ${s.eslabon_objetivo}\n  ${s.alternativa_habil}`
        )
        .join("\n")
    )
  );

  bloques["modalidad"] += SALTO + (
    seccion(
      "CAPA DBT — PLAN DE PREVENCIÓN",
      listaOTexto(analisis.capa_dbt.plan_de_prevencion)
    )
  );

  // Solo si hubo daño real a un tercero: un apartado que siempre aparece
  // invita a rellenarlo, y lo que se rellena por rellenar son disculpas de
  // trámite.
  if (analisis.capa_dbt.plan_de_reparacion) {
    bloques["modalidad"] += SALTO + (
      seccion("CAPA DBT — PLAN DE REPARACIÓN", analisis.capa_dbt.plan_de_reparacion)
    );
  }

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

  // El criterio de revisión es lo que convierte la formulación en una
  // hipótesis con fecha en vez de un documento: si el plan llega sin él, el
  // informe lo dice en vez de callarlo.
  const monitorizacion = analisis.plan_de_monitorizacion;
  bloques["monitorizacion"] = seccion(
    "PLAN DE MONITORIZACIÓN",
    monitorizacion
      ? [
          `Qué se mide: ${monitorizacion.que_se_mide || "—"}`,
          `Con qué: ${monitorizacion.con_que || "—"}`,
          `Cada cuánto: ${monitorizacion.cada_cuanto || "—"}`,
          "",
          "Criterio de revisión (qué desmentiría esta formulación):",
          monitorizacion.criterio_de_revision ||
            "Sin criterio de revisión. Mientras no lo haya, esta formulación no se puede desmentir con lo que se mida: es un documento, no una hipótesis con fecha de revisión.",
        ].join("\n")
      : "La nota no daba base para proponer un plan de medición. Definir uno antes de aplicar el plan de intervención: sin él no hay forma de saber si la formulación se sostiene."
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
