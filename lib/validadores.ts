import type { AnalisisFuncional, Alerta } from "./types";
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
        gravedad: "alta",
        ruta: intervencion.ruta,
        mensaje: `Se propone "${intervencion.texto.trim()}", pero ${nucleo.etiqueta} ya aparece en el caso cumpliendo función de alivio. Revisa si es una conducta de seguridad: de serlo, es blanco de eliminación, no de prescripción.`,
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
          gravedad: "alta",
          ruta: intervencion.ruta,
          mensaje: `"${intervencion.texto.trim()}" se parece a una conducta marcada como de seguridad ("${c.descripcion}").`,
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
        gravedad: "media",
        ruta: intervencion.ruta,
        mensaje: `"${intervencion.texto.trim()}" depende de información que el informe declara faltante: "${falta}". Trátala como condicional hasta confirmarlo.`,
      });
    }
  }

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
  ];

  // Una misma intervención puede disparar la misma alerta por dos caminos.
  const vistas = new Set<string>();
  analisis.alertas = alertas.filter((a) => {
    const clave = `${a.codigo}|${a.ruta}`;
    if (vistas.has(clave)) return false;
    vistas.add(clave);
    return true;
  });

  return analisis;
}
