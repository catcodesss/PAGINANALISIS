import type { AnalisisFuncional, Alerta } from "./types";
// Solo el tipo: no añade nada al JavaScript emitido.
import type { IdSeccion } from "./secciones";
import { normalizarTexto } from "./citas";

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
  a.lineas_de_intervencion_tentativas.forEach((l, i) => {
    salida.push({ ruta: `lineas_de_intervencion_tentativas[${i}]`, texto: l });
  });
  a.capa_dbt.habilidades_sugeridas.forEach((h, i) => {
    salida.push({
      ruta: `capa_dbt.habilidades_sugeridas[${i}]`,
      texto: `${h.habilidad} ${h.eslabon_objetivo}`,
    });
  });
  a.capa_mc.procedimientos_sugeridos.forEach((p, i) => {
    salida.push({
      ruta: `capa_mc.procedimientos_sugeridos[${i}]`,
      texto: `${p.procedimiento} ${p.contingencia_objetivo}`,
    });
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
 */
function validarDependenciaDeDatosFaltantes(a: AnalisisFuncional): Alerta[] {
  if (a.datos_faltantes.length === 0) return [];
  const alertas: Alerta[] = [];

  for (const falta of a.datos_faltantes) {
    const palabrasFalta = palabrasSignificativas(falta, 7);
    if (palabrasFalta.size === 0) continue;

    for (const intervencion of textosDeIntervencion(a)) {
      const comunes = interseccion(
        palabrasFalta,
        palabrasSignificativas(intervencion.texto, 7)
      );
      if (comunes.length === 0) continue;
      alertas.push({
        codigo: "intervencion_depende_de_dato_faltante",
        origen: "validador",
        gravedad: "media",
        ruta: intervencion.ruta,
        mensaje: `Depende de información que el informe declara faltante: "${falta}". Trátalo como condicional hasta confirmarlo.`,
        elemento: intervencion.texto.trim(),
      });
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
 * Devuelve el id de sección, no su título: el título sale de lib/secciones.ts,
 * que es la única lista. El tipo de retorno es `IdSeccion`, así que señalar una
 * sección que no existe no compila — antes habría sido un enlace roto en el
 * informe, visible solo si alguien lo pulsaba.
 */
export function seccionDeRuta(ruta: string): IdSeccion | null {
  const campo = ruta.split(/[[.]/)[0];
  switch (campo) {
    case "conductas_problema":
      return "conductas";
    case "variables_moduladoras":
      return "variables-moduladoras";
    case "situaciones":
      return "situaciones";
    case "conductas_alternativas":
      return "conductas-alternativas";
    case "lineas_de_intervencion_tentativas":
      return "intervencion";
    case "capa_act":
    case "capa_dbt":
    case "capa_mc":
      return "modalidad";
    case "hipotesis_alternativas":
      return "hipotesis-alternativas";
    case "preguntas_para_la_proxima_sesion":
      return "preguntas";
    case "datos_faltantes":
      return "datos-faltantes";
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
  secciones: IdSeccion[];
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

  return [...grupos.values()];
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
  ]);
}
