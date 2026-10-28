import type { AnalisisFuncional, Alerta } from "./types";
// Solo el tipo: no añade nada al JavaScript emitido.
import type { IdAncla } from "./secciones";
import { normalizarTexto } from "./citas";
import { estaAbierta } from "./preguntas";
import { estadoEfectivoDeBlanco, estaVigente } from "./plan";

/**
 * Comprobaciones deterministas sobre el informe ya generado. No usan IA: son
 * reglas que siempre dan el mismo resultado.
 *
 * Por qué existen: el system prompt puede pedirle al modelo que no cometa un
 * error, pero no lo garantiza. En dos ejecuciones consecutivas con el mismo
 * prompt, el informe propuso primero "exponer sin conductas de seguridad" y
 * después "Respiración consciente" para el mismo caso, en el que respirar en el
 * baño ERA la conducta de seguridad. Lo que el prompt pide, esto lo verifica.
 * La misma lógica motivó V5: en pruebas repetidas con una nota de riesgo
 * explícito, el modelo marcó "riesgo.evaluado": true con "indicadores": []
 * pese a que la nota describía ideación.
 */

/**
 * Conductas que alivian el malestar dentro de la situación temida. Si una de
 * ellas ya aparece en la nota como parte del problema, proponerla como
 * intervención refuerza el mantenedor en lugar de tratarlo.
 */
const NUCLEOS_SEGURIDAD: { id: string; patron: RegExp; etiqueta: string }[] = [
  { id: "respiracion", patron: /respiraci|respirar|respirand|respiro/, etiqueta: "técnicas de respiración" },
  { id: "relajacion", patron: /relajaci|relajarse|relajarme/, etiqueta: "relajación como control del malestar" },
  { id: "distraccion", patron: /distracci|distraer/, etiqueta: "distracción" },
  { id: "tranquilizacion", patron: /tranquiliz|reasegur|buscar confirmaci/, etiqueta: "búsqueda de tranquilización" },
  { id: "acompanamiento", patron: /acompanad|acompanamiento|que la acompane|que lo acompane/, etiqueta: "ir acompañado" },
  { id: "comprobacion", patron: /comprobar|comprobaci|chequear|revisar el pulso/, etiqueta: "comprobación" },
  { id: "consumo", patron: /alcohol|ansiolitic|copas de/, etiqueta: "consumo para afrontar la situación" },
  { id: "ensayo_mental", patron: /ensayar mentalmente|repasar mentalmente|ensayo mental/, etiqueta: "ensayo mental" },
];

/**
 * Lenguaje asociado a riesgo vital (ideación, autolesión). Deliberadamente
 * amplio: es un aviso de "revisa esto", no una detección clínica exhaustiva,
 * así que una alerta de más cuesta poco y una de menos puede costar mucho.
 */
const PATRON_RIESGO_VITAL =
  /suicid|autolesion|quitarse la vida|acabar con (su|mi) vida|no quiero vivir|no quiere vivir|mejor (estaria|estuviera) (muert[oa]|sin vivir)|desaparec|desaparici/;

const VACIAS = new Set([
  "ante", "para", "porque", "cuando", "sobre", "desde", "entre", "hacia",
  "durante", "mediante", "conducta", "conductas", "situacion", "situaciones",
  "paciente", "persona", "consultante", "clinico", "sesion", "analisis",
  "problema", "problemas", "mismo", "misma", "sus", "este", "esta", "estos",
]);

function palabrasSignificativas(texto: string, minimo = 6): Set<string> {
  return new Set(
    normalizarTexto(texto)
      .split(/[^a-z0-9]+/)
      .filter((p) => p.length >= minimo && !VACIAS.has(p))
      .map((p) => p.slice(0, 8))
  );
}

function interseccion(a: Set<string>, b: Set<string>): string[] {
  return [...a].filter((x) => b.has(x));
}

/**
 * Si una conducta propuesta ya figura en el repertorio disponible.
 *
 * Vive aquí, junto al resto de comparaciones entre partes del informe, y usa el
 * mismo emparejamiento por palabras significativas: es deliberadamente
 * aproximado. Un falso positivo dice "revisa si esto ya lo hace" —que es
 * exactamente lo que hay que revisar— y un falso negativo deja la propuesta
 * como estaba. Ninguno de los dos afirma nada por su cuenta: la interfaz lo
 * presenta como una pista para el clínico, no como un hecho del análisis.
 *
 * Importa porque cambia el tratamiento: proponer como habilidad nueva algo que
 * la persona ya emite en otro contexto convierte un problema de generalización
 * en un entrenamiento innecesario.
 */
/**
 * Raíz de 6 y no de 8 como en `palabrasSignificativas`: aquí se comparan dos
 * redacciones de la MISMA cosa escritas desde puntos de vista distintos —"expone
 * su criterio" en el repertorio, "exponer su criterio" en la propuesta—, y a
 * ocho caracteres esas dos formas no se reconocen. Lo usan también los nodos de
 * la red funcional (ver lib/redFuncional.ts), que emparejan el enunciado de una
 * hipótesis con la descripción de una conducta o una variable.
 */
export function raicesSignificativas(texto: string): Set<string> {
  return new Set(
    normalizarTexto(texto)
      .split(/[^a-z0-9]+/)
      .filter((p) => p.length >= 6 && !VACIAS.has(p))
      .map((p) => p.slice(0, 6))
  );
}

export function yaEnRepertorio(
  propuesta: string,
  repertorio: { descripcion: string }[]
): boolean {
  const palabras = raicesSignificativas(propuesta);
  if (palabras.size === 0) return false;
  return repertorio.some(
    (r) => interseccion(palabras, raicesSignificativas(r.descripcion)).length >= 2
  );
}

/** Todos los textos del informe que proponen algo que hacer. */
function textosDeIntervencion(
  a: AnalisisFuncional
): { ruta: string; texto: string }[] {
  const salida: { ruta: string; texto: string }[] = [];

  a.conductas_alternativas.forEach((c, i) => {
    salida.push({
      ruta: `conductas_alternativas[${i}]`,
      texto: `${c.conducta_propuesta} ${c.consecuencia_necesaria}`,
    });
  });
  // Solo la intervención, no su `porque`: el porqué nombra la función sobre la
  // que actúa, y a menudo el propio mantenedor («se retira la respiración
  // porque funciona como conducta de seguridad»). Compararlo haría saltar V3
  // justo en la intervención que hace lo correcto. Lo mismo vale para
  // `contingencia_objetivo` y `precauciones`, que desde la v3 recogen lo que
  // era la capa MC: nombran lo que se quiere modificar, no lo que se propone.
  // Los procedimientos MC migrados siguen revisados: son `intervencion` aquí.
  // Una entrada sin intervención (principio 29: no hay base todavía) no
  // propone nada.
  a.lineas_de_intervencion_tentativas.forEach((l, i) => {
    if (!l.intervencion.trim()) return;
    salida.push({ ruta: `lineas_de_intervencion_tentativas[${i}]`, texto: l.intervencion });
  });
  a.capa_dbt.habilidades_sugeridas.forEach((h, i) => {
    salida.push({
      ruta: `capa_dbt.habilidades_sugeridas[${i}]`,
      texto: `${h.habilidad} ${h.eslabon_objetivo}`,
    });
  });
  // El análisis de soluciones propone conductas alternativas para cada
  // eslabón: es tan susceptible de prescribir el propio mantenedor como
  // cualquier otra propuesta del informe, y sin esto se quedaba fuera de la
  // comprobación V3.
  a.capa_dbt.analisis_de_soluciones.forEach((s, i) => {
    salida.push({
      ruta: `capa_dbt.analisis_de_soluciones[${i}]`,
      texto: `${s.alternativa_habil} ${s.eslabon_objetivo}`,
    });
  });
  a.capa_dbt.plan_de_prevencion.forEach((p, i) => {
    salida.push({ ruta: `capa_dbt.plan_de_prevencion[${i}]`, texto: p });
  });

  return salida;
}

/**
 * V1 · Una hipótesis con confianza alta necesita una cita resuelta que la
 * sostenga. Si no la hay, se degrada a media: la etiqueta de confianza no puede
 * afirmar más de lo que la nota respalda.
 */
function validarConfianzaSinCita(a: AnalisisFuncional): Alerta[] {
  const alertas: Alerta[] = [];

  a.situaciones.forEach((s, i) => {
    if (s.confianza !== "alta") return;
    const sostenida = [s.cadena_operante, s.cadena_respondiente, s.cadena_dbt].some(
      (c) => c?.evidencia.verificada
    );
    if (sostenida) return;
    s.confianza = "media";
    alertas.push({
      codigo: "confianza_sin_cita",
      origen: "validador",
      gravedad: "media",
      ruta: `situaciones[${i}]`,
      mensaje: `La situación "${s.nombre}" se presentaba con confianza alta sin ninguna cita verificable en la nota. Se ha degradado a media.`,
    });
  });

  return alertas;
}

/**
 * V2 · Toda conducta problema debería analizarse en alguna situación. Una
 * conducta listada y nunca analizada es una hipótesis huérfana.
 */
function validarCobertura(a: AnalisisFuncional): Alerta[] {
  if (a.situaciones.length === 0) return [];

  const textoSituaciones = normalizarTexto(
    a.situaciones
      .map((s) =>
        [
          s.nombre,
          s.funcion_hipotetizada,
          s.cadena_operante?.respuesta,
          s.cadena_dbt?.conducta_problema,
        ]
          .filter(Boolean)
          .join(" ")
      )
      .join(" ")
  );
  const palabrasSituaciones = palabrasSignificativas(textoSituaciones);

  return a.conductas_problema.flatMap((c, i) => {
    const palabras = palabrasSignificativas(c.descripcion);
    if (palabras.size === 0) return [];
    if (interseccion(palabras, palabrasSituaciones).length > 0) return [];
    return [
      {
        codigo: "conducta_sin_analisis",
        origen: "validador" as const,
        gravedad: "media" as const,
        ruta: `conductas_problema[${i}]`,
        mensaje: `La conducta "${c.descripcion}" no aparece analizada en ninguna situación.`,
      },
    ];
  });
}

/**
 * V3 · El fallo más grave y el más inestable: proponer como intervención una
 * conducta que en la nota ya funciona como evitación o conducta de seguridad.
 */
function validarConductasSeguridad(a: AnalisisFuncional, nota: string): Alerta[] {
  const alertas: Alerta[] = [];
  const intervenciones = textosDeIntervencion(a);

  // Se busca en la NOTA además de en el informe: el análisis suele comprimir la
  // conducta de seguridad al resumirla ("estuvo allí respirando" se convierte en
  // "pide ir al baño"), y entonces el mantenedor solo es visible en el original.
  const textoProblema = normalizarTexto(
    nota + " " + a.conductas_problema
      .map((c) => `${c.descripcion} ${c.evidencia.verificada ? c.evidencia.texto : ""}`)
      .join(" ") +
      " " +
      a.situaciones
        .map((s) =>
          [
            s.cadena_operante?.respuesta,
            s.cadena_operante?.evidencia.verificada ? s.cadena_operante.evidencia.texto : "",
            ...(s.cadena_dbt?.eslabones.map((e) => e.descripcion) ?? []),
          ]
            .filter(Boolean)
            .join(" ")
        )
        .join(" ")
  );

  for (const nucleo of NUCLEOS_SEGURIDAD) {
    if (!nucleo.patron.test(textoProblema)) continue;
    for (const intervencion of intervenciones) {
      if (!nucleo.patron.test(normalizarTexto(intervencion.texto))) continue;
      alertas.push({
        codigo: "prescribe_conducta_seguridad",
        origen: "validador",
        gravedad: "alta",
        ruta: intervencion.ruta,
        mensaje: `${nucleo.etiqueta[0].toUpperCase()}${nucleo.etiqueta.slice(1)} ya aparece en el caso cumpliendo función de alivio. Revisa si es una conducta de seguridad: de serlo, es blanco de eliminación, no de prescripción.`,
        elemento: intervencion.texto.trim(),
      });
    }
  }

  // Cualquier conducta que el propio modelo marcó como de seguridad.
  a.conductas_problema
    .filter((c) => c.es_conducta_seguridad)
    .forEach((c) => {
      const palabras = palabrasSignificativas(c.descripcion);
      for (const intervencion of intervenciones) {
        const comunes = interseccion(palabras, palabrasSignificativas(intervencion.texto));
        if (comunes.length < 2) continue;
        alertas.push({
          codigo: "prescribe_conducta_seguridad",
          origen: "validador",
          gravedad: "alta",
          ruta: intervencion.ruta,
          mensaje: `Se parece a una conducta que el propio análisis marcó como de seguridad ("${c.descripcion}").`,
          elemento: intervencion.texto.trim(),
        });
      }
    });

  return alertas;
}

/**
 * V4 · Una intervención que depende de un dato que el propio informe declara
 * faltante debe presentarse como condicional, no como plan.
 *
 * Dos vías, y se suman: la dependencia que el modelo declaró (la intervención
 * apunta a su pregunta por id) y la que el validador encuentra por su cuenta
 * comparando palabras (invariante 3: no depende de que el modelo la declare).
 * Una pregunta respondida o descartada ya no condiciona nada.
 */
function validarDependenciaDeDatosFaltantes(a: AnalisisFuncional): Alerta[] {
  const abiertas = a.preguntas.filter((p) => estaAbierta(p) && p.dato_faltante.trim());
  if (abiertas.length === 0) return [];
  const alertas: Alerta[] = [];
  const intervenciones = textosDeIntervencion(a);
  // Una intervención no se señala dos veces por la misma pregunta aunque la
  // encuentren las dos vías.
  const vistas = new Set<string>();

  const avisar = (
    falta: (typeof abiertas)[number],
    intervencion: { ruta: string; texto: string }
  ) => {
    const clave = `${falta.id}|${intervencion.ruta}`;
    if (vistas.has(clave)) return;
    vistas.add(clave);
    alertas.push({
      codigo: "intervencion_depende_de_dato_faltante",
      origen: "validador",
      gravedad: "media",
      ruta: intervencion.ruta,
      mensaje: `Depende de información que el informe declara faltante: "${falta.dato_faltante}".${
        falta.decision ? ` ${falta.decision}` : ""
      } Trátalo como condicional hasta confirmarlo.`,
      elemento: intervencion.texto.trim(),
    });
  };

  for (const falta of abiertas) {
    // Por id: la intervención que el modelo ató a esta pregunta.
    a.lineas_de_intervencion_tentativas.forEach((l, i) => {
      if (l.pregunta_id === falta.id && l.intervencion.trim()) {
        avisar(falta, { ruta: `lineas_de_intervencion_tentativas[${i}]`, texto: l.intervencion });
      }
    });

    // Por palabras: solo el hueco entra en la comparación, no la decisión: la
    // decisión habla del análisis ("deja sin decidir la priorización") y sus
    // palabras coinciden con las de cualquier intervención, así que emparejar
    // por ella dispararía la alerta en propuestas que no dependen del dato.
    const palabrasFalta = palabrasSignificativas(falta.dato_faltante, 7);
    if (palabrasFalta.size === 0) continue;
    for (const intervencion of intervenciones) {
      const comunes = interseccion(
        palabrasFalta,
        palabrasSignificativas(intervencion.texto, 7)
      );
      if (comunes.length === 0) continue;
      avisar(falta, intervencion);
    }
  }

  return alertas;
}

/**
 * V5 · La nota contiene lenguaje de riesgo vital que el campo "riesgo" no
 * recoge. Existe porque en pruebas repetidas con la misma nota (evals/casos/
 * 09-riesgo-explicito.md), el modelo devolvió "evaluado": true con
 * "indicadores": [] pese a que la nota describía ideación explícita: el
 * principio 17 pide revisarlo, esto comprueba que de verdad quedó recogido.
 */
function validarRiesgoNoDetectado(a: AnalisisFuncional, nota: string): Alerta[] {
  if (!PATRON_RIESGO_VITAL.test(normalizarTexto(nota))) return [];
  if (PATRON_RIESGO_VITAL.test(normalizarTexto(a.riesgo.indicadores.join(" ")))) {
    return [];
  }
  return [
    {
      codigo: "riesgo_posible_no_detectado",
      origen: "validador",
      gravedad: "alta",
      ruta: "riesgo",
      mensaje:
        "La nota contiene lenguaje asociado a riesgo vital (ideación, autolesión) que no aparece reflejado en los indicadores de riesgo del informe. Revisa la nota directamente antes de descartarlo.",
    },
  ];
}

/**
 * Fase 6D · La cadena de ocho ranuras de cada blanco.
 *
 * Todo determinista (invariante 3) y todo con el mismo propósito: que una
 * ranura vacía o incoherente se vea, en vez de que el plan parezca completo
 * porque tiene texto. ▲ = gravedad «alta» (revisar antes de usar) y ◆ =
 * «media» (conviene revisar). Lo que no puede comprobarse sin IA no está aquí:
 * eso es opinión y, si se hace, va por la pasada crítica con `origen: "ia"`.
 *
 * Los avisos de ítem (alternativa, estrategia) miran todo lo que no es solo de
 * blancos rechazados: una entrada «Por asignar» también se puede usar. Los de
 * blanco miran los activos: uno en pausa o resuelto no necesita hoy su cadena.
 */

/** Marcas de evitación o negación al inicio de una conducta: cambian su topografía. */
const MARCA_EVITACION = /(^|\s)(evit|escap|huy|huir|rehu|aplaz|posterg|abandon|dej(a|o|ar|e)\s+de|no\s)/;

/**
 * Palabras de una conducta, para compararla con su alternativa: de cuatro
 * letras en adelante y recortadas a cinco, que reconoce «pedir» y «pedirle» pero
 * deja pasar el resto de la conjugación. Más corto que `raicesSignificativas`
 * porque las conductas son frases cortas («Pedir ir al baño») y a seis letras
 * casi no queda nada que comparar.
 */
function palabrasDeConducta(texto: string): Set<string> {
  return new Set(
    normalizarTexto(texto)
      .split(/[^a-z0-9]+/)
      .filter((p) => p.length >= 4 && !VACIAS.has(p) && !RELLENO_DE_CONDUCTA.has(p))
      .map((p) => p.slice(0, 5))
  );
}
const RELLENO_DE_CONDUCTA = new Set(["como", "tras", "pero", "cada", "sino", "mucho", "poco", "tambien"]);

/**
 * ¿La alternativa es, en la práctica, la misma conducta que la que sustituye?
 *
 * La heurística, entera: (1) si una de las dos es una evitación o una negación
 * («evita exponer», «no ceder») y la otra no, son topografías distintas aunque
 * compartan palabras — «Exponer resultados» sustituye bien a «Evita exponer
 * resultados», y comparar solo palabras la daría por repetida; (2) si ninguna o
 * las dos lo son, se mira cuánto de la alternativa ya estaba en la conducta
 * problema: palabras de cinco letras, al menos dos en común y al menos el 60 %
 * de las de la alternativa. Es aproximada a propósito, como el resto de
 * comparaciones por palabras de este fichero: un falso aviso dice «revisa si
 * esto es otra conducta», que es justo lo que hay que mirar, y no afirma nada.
 */
export function mismaTopografia(propuesta: string, problema: string): boolean {
  if (MARCA_EVITACION.test(normalizarTexto(propuesta)) !== MARCA_EVITACION.test(normalizarTexto(problema))) {
    return false;
  }
  const deLaAlternativa = palabrasDeConducta(propuesta);
  if (deLaAlternativa.size < 2) return false;
  const comunes = interseccion(deLaAlternativa, palabrasDeConducta(problema));
  return comunes.length >= 2 && comunes.length / deLaAlternativa.size >= 0.6;
}

function validarPlanPorBlanco(a: AnalisisFuncional): Alerta[] {
  const alertas: Alerta[] = [];
  const blancos = a.blancos ?? [];
  const nombreDe = (conductaIds: string[]) =>
    a.conductas_problema.find((c) => c.id === conductaIds[0])?.descripcion ?? "Blanco sin conducta";

  const vigentes = blancos
    .map((blanco, indice) => ({ blanco, indice, estado: estadoEfectivoDeBlanco(a, blanco) }))
    .filter((x) => estaVigente(x.estado));
  const rechazados = blancos.filter((b) => !vigentes.some((v) => v.blanco === b));

  for (const { blanco, indice, estado } of vigentes) {
    if (estado.fase !== "activo") continue;
    const ruta = `blancos[${indice}]`;
    const elemento = nombreDe(blanco.conducta_ids);

    if (!blanco.hipotesis_id || !a.hipotesis_mantenimiento.some((h) => h.id === blanco.hipotesis_id)) {
      alertas.push({
        codigo: "blanco_activo_sin_hipotesis",
        origen: "validador",
        gravedad: "alta",
        ruta,
        elemento,
        mensaje:
          "Blanco activo sin hipótesis de mantenimiento: el resto de la cadena no tiene una función en la que apoyarse. Revísalo antes de usarlo.",
      });
    }

    const indicadores = a.plan_de_monitorizacion.filter((p) => blanco.indicador_ids.includes(p.id));
    if (indicadores.length === 0) {
      alertas.push({
        codigo: "blanco_sin_indicador_o_revision",
        origen: "validador",
        gravedad: "media",
        ruta,
        elemento,
        mensaje: "Blanco sin indicador: no hay nada con lo que saber si la intervención está funcionando.",
      });
    } else if (!indicadores.some((p) => p.criterio_de_revision.trim())) {
      alertas.push({
        codigo: "blanco_sin_indicador_o_revision",
        origen: "validador",
        gravedad: "media",
        ruta,
        elemento,
        mensaje:
          "Blanco sin criterio de revisión: nada dice qué observación obligaría a rehacer el análisis.",
      });
    }
  }

  // Una entrada que solo pertenece a blancos rechazados ya no se usa.
  const soloDeRechazados = (clave: "alternativa_ids" | "estrategia_ids", id: string) =>
    rechazados.some((b) => b[clave].includes(id)) &&
    !vigentes.some((v) => v.blanco[clave].includes(id));

  const rechazadaEnSuBlanco = (id: string) =>
    blancos.some((b) => (b.alternativas_rechazadas ?? []).includes(id)) &&
    !vigentes.some((v) => v.blanco.alternativa_ids.includes(id));

  a.conductas_alternativas.forEach((alt, i) => {
    if (soloDeRechazados("alternativa_ids", alt.id) || rechazadaEnSuBlanco(alt.id)) return;
    const ruta = `conductas_alternativas[${i}]`;
    const elemento = alt.conducta_propuesta.trim();
    if (alt.la_mantendra.every((m) => !m.trim())) {
      alertas.push({
        codigo: "alternativa_sin_mantenimiento",
        origen: "validador",
        gravedad: "media",
        ruta,
        elemento,
        mensaje:
          "La alternativa no dice qué la mantendrá (consecuencia natural, programada o un valor). Sin eso es fácil que se extinga fuera de consulta.",
      });
    }
    const sustituida = alt.sustituye_a
      ? a.conductas_problema.find((c) => c.id === alt.sustituye_a)
      : undefined;
    if (sustituida && mismaTopografia(alt.conducta_propuesta, sustituida.descripcion)) {
      alertas.push({
        codigo: "alternativa_misma_topografia",
        origen: "validador",
        gravedad: "media",
        ruta,
        elemento,
        mensaje:
          "La alternativa se parece demasiado a la conducta a la que sustituye (comparación por palabras, puede ser un falso aviso). Una alternativa es otra conducta que cumple la misma función, no la misma con mejor calidad.",
      });
    }
  });

  const idsDeRelaciones = new Set(a.aristas.map((r) => r.id));
  a.lineas_de_intervencion_tentativas.forEach((linea, i) => {
    // Sin intervención (principio 29) no hay estrategia que situar en el mapa.
    if (!linea.intervencion.trim()) return;
    if (soloDeRechazados("estrategia_ids", linea.id)) return;
    if (linea.actua_sobre && idsDeRelaciones.has(linea.actua_sobre)) return;
    alertas.push({
      codigo: "estrategia_sin_actua_sobre",
      origen: "validador",
      gravedad: "media",
      ruta: `lineas_de_intervencion_tentativas[${i}]`,
      elemento: linea.intervencion.trim(),
      mensaje: linea.actua_sobre
        ? "La relación sobre la que actúa la estrategia ya no existe en el mapa."
        : "La estrategia no declara sobre qué relación del mapa actúa, así que no puede comprobarse contra la función.",
    });
  });

  return alertas;
}

/**
 * Propagación de la fase 8: si la hipótesis de un blanco cambió con una sesión
 * posterior, el blanco avisa hasta que el clínico lo revise (lo toque).
 */
function validarHipotesisCambiada(a: AnalisisFuncional): Alerta[] {
  const pendientes = a.seguimiento?.blancos_a_revisar ?? {};
  const alertas: Alerta[] = [];
  (a.blancos ?? []).forEach((b, indice) => {
    const sesion = pendientes[b.id];
    if (sesion === undefined) return;
    alertas.push({
      codigo: "hipotesis_cambiada",
      origen: "validador",
      gravedad: "media",
      ruta: `blancos[${indice}]`,
      elemento: a.conductas_problema.find((c) => c.id === b.conducta_ids[0])?.descripcion ?? "Blanco",
      mensaje: `La hipótesis cambió en la sesión ${sesion}: revisa mecanismo y estrategia.`,
    });
  });
  return alertas;
}

/**
 * Fase 10: «otra conducta de la misma clase funcional está aumentando». Si dos
 * conductas de una clase con función conocida van en sentidos opuestos, quizá
 * la intervención no quitó la función: movió la salida a otra topografía.
 *
 * LISTO PERO SIN ACTIVAR. Necesita la tendencia de cada indicador por sesión, y
 * esos datos no existen hasta la fase 9 (observaciones). Por eso no está en
 * `validarAnalisis` ni en las revalidaciones: se llama con las tendencias cuando
 * haya de dónde sacarlas. Determinista, sin IA (invariante 3).
 */
export interface TendenciaDeConducta {
  conducta_id: string;
  sentido: "aumenta" | "disminuye";
}

export function validarClaseEnConflicto(a: AnalisisFuncional, tendencias: readonly TendenciaDeConducta[]): Alerta[] {
  const sentido = new Map(tendencias.map((t) => [t.conducta_id, t.sentido]));
  const alertas: Alerta[] = [];
  (a.clases_funcionales ?? []).forEach((clase, indice) => {
    if (clase.funcion === null) return;
    const sentidos = new Set(clase.miembros.map((m) => sentido.get(m.conducta_id)).filter(Boolean));
    if (!sentidos.has("aumenta") || !sentidos.has("disminuye")) return;
    alertas.push({
      codigo: "clase_en_conflicto",
      origen: "validador",
      gravedad: "media",
      ruta: `clases_funcionales[${indice}]`,
      elemento: clase.funcion,
      mensaje: "Otra conducta de la misma clase funcional está aumentando mientras otra disminuye: puede que la función se haya desplazado a otra topografía.",
    });
  });
  return alertas;
}

/**
 * Ejecuta todas las comprobaciones y devuelve el análisis con sus alertas.
 * Modifica confianzas cuando la evidencia no las sostiene (ver V1).
 */
export function validarAnalisis(
  analisis: AnalisisFuncional,
  nota: string
): AnalisisFuncional {
  const alertas = [
    ...validarConfianzaSinCita(analisis),
    ...validarCobertura(analisis),
    ...validarConductasSeguridad(analisis, nota),
    ...validarDependenciaDeDatosFaltantes(analisis),
    ...validarRiesgoNoDetectado(analisis, nota),
    ...validarPlanPorBlanco(analisis),
    ...validarHipotesisCambiada(analisis),
  ];

  analisis.alertas = sinDuplicados(alertas);
  return analisis;
}

/**
 * De qué parte del informe salió la alerta, traducido a la sección que el
 * clínico ve. `ruta` apunta al campo del JSON (`capa_dbt.habilidades_sugeridas[1]`);
 * eso no le dice a nadie qué apartado releer. Saber que el fallo aterriza en
 * "Conductas problema" y no en "Líneas de intervención" es lo que decide si
 * hay que reanalizar esa sección o el informe entero.
 *
 * Devuelve el id del ANCLA, no el del bloque que la contiene: el aviso señala
 * un apartado concreto, y decir «Análisis funcional» cuando se puede decir
 * «Repertorio conductual» pierde justo lo que hace útil al aviso. Quien necesite
 * el bloque lo obtiene con `bloqueDeAncla`.
 *
 * El título sale de lib/secciones.ts, que es la única lista. El tipo de retorno
 * es `IdAncla`, así que señalar un apartado que no existe no compila — antes
 * habría sido un enlace roto, visible solo si alguien lo pulsaba.
 */
export function seccionDeRuta(ruta: string): IdAncla | null {
  const campo = ruta.split(/[[.]/)[0];
  switch (campo) {
    case "conductas_problema":
    case "repertorio_disponible":
      return "conductas";
    case "variables_moduladoras":
      return "variables-moduladoras";
    case "reglas_verbales":
      return "situaciones";
    case "situaciones":
      return "situaciones";
    case "formulacion":
    case "fortalezas_y_recursos":
      return "formulacion";
    case "hipotesis_origen":
      return "hipotesis-origen";
    case "conductas_alternativas":
      return "conductas-alternativas";
    case "lineas_de_intervencion_tentativas":
      return "intervencion";
    case "plan_de_monitorizacion":
      return "monitorizacion";
    case "blancos":
      return "conductas-alternativas";
    case "capa_dbt":
      return "modalidad";
    case "hipotesis_alternativas":
      return "hipotesis-alternativas";
    case "preguntas_para_la_proxima_sesion":
      return "preguntas";
    // Los huecos de la nota y los avisos del validador respondían a la misma
    // pregunta —qué hay que comprobar antes de dar el informe por bueno— desde
    // dos secciones distintas. Ahora comparten una.
    case "datos_faltantes":
    case "preguntas":
      return "verificacion";
    case "riesgo":
      return "riesgo";
    case "resumen_clinico":
      return "resumen";
    default:
      // "general" de la pasada crítica, o un campo que aún no está mapeado: sin
      // sección es correcto — mejor no señalar ninguna que señalar la que no es.
      return null;
  }
}

/** Un motivo y todos los fragmentos del informe a los que alcanza. */
export interface GrupoAlertas {
  codigo: Alerta["codigo"];
  gravedad: Alerta["gravedad"];
  origen: Alerta["origen"];
  mensaje: string;
  /** Vacío cuando la alerta señala el informe entero y no un fragmento. */
  elementos: string[];
  /** Secciones del informe donde puede haberse reflejado el fallo. */
  secciones: IdAncla[];
}

/**
 * Junta las alertas que comparten motivo. Es presentación, no detección: se
 * emiten y se cuentan exactamente las mismas; solo se muestran una vez.
 *
 * Sin esto, un caso de comprobación compulsiva producía seis avisos idénticos
 * salvo por la intervención citada — el aviso real ("estás prescribiendo el
 * propio mantenedor") quedaba enterrado bajo su repetición y el bloque parecía
 * ruido. La gravedad del grupo es la peor de las suyas: si una sola pide
 * revisarse antes de usar, el grupo entero también.
 *
 * El orden de salida es por gravedad, "alta" primero: es el mismo orden en
 * pantalla, en el informe copiado y en el exportado a Word, porque los tres
 * llaman a esta función en vez de ordenar cada uno por su cuenta. Dentro de
 * cada gravedad se conserva el orden en que llegaron las alertas (Array.sort
 * es estable), así que dos alertas "media" no se reordenan entre sí sin razón.
 */
export function agruparAlertas(alertas: Alerta[]): GrupoAlertas[] {
  const grupos = new Map<string, GrupoAlertas>();

  for (const a of alertas) {
    // El origen entra en la clave: una comprobación determinista y una opinión
    // de la pasada crítica no pueden presentarse como el mismo aviso aunque
    // coincida el texto.
    const clave = `${a.codigo}|${a.origen}|${a.mensaje}`;
    const seccion = seccionDeRuta(a.ruta);
    const grupo = grupos.get(clave);
    if (!grupo) {
      grupos.set(clave, {
        codigo: a.codigo,
        gravedad: a.gravedad,
        origen: a.origen,
        mensaje: a.mensaje,
        elementos: a.elemento ? [a.elemento] : [],
        secciones: seccion ? [seccion] : [],
      });
      continue;
    }
    if (a.gravedad === "alta") grupo.gravedad = "alta";
    if (a.elemento && !grupo.elementos.includes(a.elemento)) {
      grupo.elementos.push(a.elemento);
    }
    if (seccion && !grupo.secciones.includes(seccion)) {
      grupo.secciones.push(seccion);
    }
  }

  const PESO_GRAVEDAD: Record<GrupoAlertas["gravedad"], number> = { alta: 0, media: 1 };
  return [...grupos.values()].sort(
    (a, b) => PESO_GRAVEDAD[a.gravedad] - PESO_GRAVEDAD[b.gravedad]
  );
}

/** Una misma intervención puede disparar la misma alerta por dos caminos. */
function sinDuplicados(alertas: Alerta[]): Alerta[] {
  const vistas = new Set<string>();
  return alertas.filter((a) => {
    const clave = `${a.codigo}|${a.ruta}`;
    if (vistas.has(clave)) return false;
    vistas.add(clave);
    return true;
  });
}

/**
 * Vuelve a pasar las comprobaciones sobre un informe que el clínico ha editado
 * a mano. Corre en el navegador: son deterministas, sin IA y sin llamada de
 * red, así que no cuestan nada.
 *
 * Dos diferencias deliberadas con validarAnalisis:
 *
 * 1. NO MUTA. La edición manual es criterio profesional; el sistema avisa, no
 *    corrige. Por eso se omite V1 (degradar confianza alta→media), que además
 *    es irrelevante aquí: los niveles de confianza no son editables.
 * 2. CONSERVA las alertas que no puede recalcular — las de V1, ya aplicadas en
 *    el servidor, y las de la pasada crítica (origen "ia"), que vienen de una
 *    llamada que no vamos a repetir gratis.
 *
 * Que una alerta desaparezca al editar es correcto: significa que el clínico
 * arregló el problema que la motivaba.
 */
export function revalidarTrasEdicion(
  analisis: AnalisisFuncional,
  nota: string
): Alerta[] {
  const conservadas = analisis.alertas.filter(
    (a) => a.origen === "ia" || a.codigo === "confianza_sin_cita"
  );

  return sinDuplicados([
    ...conservadas,
    ...validarCobertura(analisis),
    ...validarConductasSeguridad(analisis, nota),
    ...validarDependenciaDeDatosFaltantes(analisis),
    ...validarRiesgoNoDetectado(analisis, nota),
    ...validarPlanPorBlanco(analisis),
    ...validarHipotesisCambiada(analisis),
  ]);
}

/**
 * Vuelve a pasar las comprobaciones tras un reanálisis con IA (ver
 * BloqueReanalisis en components/ReportView.tsx y app/api/reanalizar-seccion):
 * el clínico pidió que el modelo rehiciera una sección, y ese resultado nuevo
 * puede introducir el mismo tipo de error que el informe original — nada lo
 * garantiza libre de eso solo por ser una respuesta más reciente.
 *
 * A diferencia de revalidarTrasEdicion, aquí SÍ se recalcula V1 (confianza sin
 * cita) y SÍ se muta la confianza si hace falta: el contenido reanalizado es
 * tan nuevo como el de la primera generación —lo escribió el modelo, no el
 * clínico—, así que su confianza debe revisarse igual que entonces, no
 * conservarse como en una edición manual (donde la confianza no se toca).
 *
 * Se conservan las alertas de la pasada crítica (origen "ia"): vienen de una
 * llamada que no se repite gratis, y perderlas al reanalizar una sola sección
 * descartaría hallazgos válidos sobre el resto del informe, que no cambió.
 *
 * Corre en el navegador, sin coste: son las mismas comprobaciones
 * deterministas de siempre, no una llamada nueva.
 */
export function revalidarTrasReanalisis(
  analisis: AnalisisFuncional,
  nota: string
): Alerta[] {
  const conservadas = analisis.alertas.filter((a) => a.origen === "ia");

  return sinDuplicados([
    ...conservadas,
    ...validarConfianzaSinCita(analisis),
    ...validarCobertura(analisis),
    ...validarConductasSeguridad(analisis, nota),
    ...validarDependenciaDeDatosFaltantes(analisis),
    ...validarRiesgoNoDetectado(analisis, nota),
    ...validarPlanPorBlanco(analisis),
    ...validarHipotesisCambiada(analisis),
  ]);
}
