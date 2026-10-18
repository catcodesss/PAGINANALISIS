/**
 * El Plan organizado por blanco clínico, no por categoría de contenido.
 *
 * QUÉ SUSTITUYE. El bloque Plan eran tres listas —conductas alternativas,
 * líneas de intervención, monitorización— y el terapeuta tenía que emparejar
 * de cabeza qué alternativa iba con qué conducta, qué función la justificaba y
 * qué aviso del validador le afectaba, que además se leía en otra pestaña. La
 * información era correcta; las conexiones las ponía el lector.
 *
 * Aquí cada conducta problema es una tarjeta con la misma secuencia siempre:
 * blanco → función → alternativa → intervención → monitorización → revisar si.
 * Las conexiones salen de ids, NUNCA de comparar prosa en el render:
 * `priorizacion.conducta_id`, `hipotesis.destino_id`,
 * `alternativa.situacion_id → situacion.conductas_ids`, y desde el prompt
 * 1.7.0 `linea.conducta_id` y `monitorizacion.conducta_id`, que el servidor
 * resuelve una sola vez al normalizar (lib/identidad.ts).
 *
 * Lo que no resuelve por id no se asigna «a la más parecida»: se queda en los
 * apartados «sin blanco» y la interfaz lo dice. Es el caso de todo informe
 * anterior al 1.7.0, cuyas intervenciones eran textos sueltos sin conducta.
 */

import { normalizarTexto } from "./citas";
import { estaAbierta } from "./preguntas";
import type {
  Alerta,
  AnalisisFuncional,
  Blanco,
  ConductaAlternativa,
  ConductaProblema,
  EstadoBlanco,
  EstadoPlan,
  FaseBlanco,
  HipotesisMantenimiento,
  PreguntaClinica,
  Id,
  LineaIntervencion,
  PlanDeMonitorizacion,
  PriorizacionBlanco,
  RevisionBlanco,
} from "./types";

/** Las revisiones, en el orden en que se recorren. La primera es la de fábrica. */
export const REVISIONES = [
  { id: "propuesto", etiqueta: "Propuesto por IA" },
  { id: "confirmado", etiqueta: "Confirmado" },
  { id: "modificado", etiqueta: "Modificado" },
  { id: "rechazado", etiqueta: "Rechazado" },
] as const satisfies readonly { id: RevisionBlanco; etiqueta: string }[];

export const ETIQUETA_REVISION = Object.fromEntries(
  REVISIONES.map((e) => [e.id, e.etiqueta])
) as Record<RevisionBlanco, string>;

export const FASES = [
  { id: "activo", etiqueta: "Activo" },
  { id: "en_pausa", etiqueta: "En pausa" },
  { id: "resuelto", etiqueta: "Resuelto" },
] as const satisfies readonly { id: FaseBlanco; etiqueta: string }[];

export const ETIQUETA_FASE = Object.fromEntries(
  FASES.map((e) => [e.id, e.etiqueta])
) as Record<FaseBlanco, string>;

export const ESTADO_DE_FABRICA: EstadoBlanco = { revision: "propuesto", fase: "activo" };

export function esEstadoBlanco(valor: unknown): valor is EstadoBlanco {
  if (typeof valor !== "object" || valor === null) return false;
  const v = valor as Record<string, unknown>;
  return (
    REVISIONES.some((r) => r.id === v.revision) &&
    (v.fase === null || FASES.some((f) => f.id === v.fase))
  );
}

/**
 * La correspondencia de los cinco estados antiguos, revisada con el clínico:
 *
 * | antes       | revisión   | fase   |
 * |-------------|------------|--------|
 * | propuesto   | propuesto  | activo |
 * | revisar     | propuesto  | activo |
 * | aprobado    | confirmado | activo |
 * | en_curso    | confirmado | activo |
 * | descartado  | rechazado  | —      |
 *
 * «Revisar» era un estado derivado de los avisos del validador (y a veces
 * elegido a mano): sigue habiendo avisos y se siguen viendo en la tarjeta, pero
 * ya no hace falta un estado para decir «mira esto». `aprobado` y `en_curso`
 * caen en el mismo par: se pierde esa distinción, y es lo único que se pierde.
 * Un valor que no es ninguno de los cinco devuelve null y se descarta.
 */
export function estadoBlancoDeLegado(valor: unknown): EstadoBlanco | null {
  switch (valor as EstadoPlan) {
    case "propuesto":
    case "revisar":
      return { revision: "propuesto", fase: "activo" };
    case "aprobado":
    case "en_curso":
      return { revision: "confirmado", fase: "activo" };
    case "descartado":
      return { revision: "rechazado", fase: null };
    default:
      return null;
  }
}

/** Un valor guardado, sea de la v6 o de una anterior, como estado actual; o null. */
export function estadoBlancoGuardado(valor: unknown): EstadoBlanco | null {
  return esEstadoBlanco(valor) ? valor : estadoBlancoDeLegado(valor);
}

/**
 * El estado de un blanco. Sin decisión del clínico es una propuesta de la IA,
 * activa. Los avisos del validador no cambian el estado: se ven en la tarjeta
 * como lo que son, y una decisión explícita del clínico gana siempre porque es
 * criterio profesional.
 */
export function estadoDeBlanco(analisis: AnalisisFuncional, conductaId: Id): EstadoBlanco {
  const elegido = estadoBlancoGuardado(analisis.estados_plan?.[conductaId]);
  return elegido ?? { ...ESTADO_DE_FABRICA };
}

/** «Confirmado · En pausa», o solo la revisión si no hay fase. */
export function textoDeEstadoBlanco(estado: EstadoBlanco): string {
  return estado.fase
    ? `${ETIQUETA_REVISION[estado.revision]} · ${ETIQUETA_FASE[estado.fase]}`
    : ETIQUETA_REVISION[estado.revision];
}

export interface AlternativaDeBlanco {
  /** Posición en `conductas_alternativas`: es la que usan la edición y la ruta de las alertas. */
  indice: number;
  alternativa: ConductaAlternativa;
  alertas: Alerta[];
}

export interface IntervencionDeBlanco {
  /** Posición en `lineas_de_intervencion_tentativas`. */
  indice: number;
  linea: LineaIntervencion;
  alertas: Alerta[];
}

export interface MonitorizacionDeBlanco {
  /** Posición en `plan_de_monitorizacion`. */
  indice: number;
  plan: PlanDeMonitorizacion;
}

export interface TarjetaBlanco {
  conducta: ConductaProblema;
  /** 1, 2… si el modelo la priorizó; null si no figura en la priorización. */
  prioridad: number | null;
  priorizacion: PriorizacionBlanco | null;
  hipotesis: HipotesisMantenimiento[];
  /**
   * Función de las situaciones donde aparece la conducta. Se usa cuando no hay
   * hipótesis de mantenimiento resuelta a esta conducta, para no dejar la
   * tarjeta sin función cuando el análisis sí la da.
   */
  funcionesDeSituacion: string[];
  alternativas: AlternativaDeBlanco[];
  intervenciones: IntervencionDeBlanco[];
  monitorizacion: MonitorizacionDeBlanco[];
  /** Avisos sobre la propia conducta (p. ej. «sin cadena ni hipótesis»). */
  alertasConducta: Alerta[];
}

export interface PlanPorBlanco {
  tarjetas: TarjetaBlanco[];
  alternativasSinBlanco: AlternativaDeBlanco[];
  intervencionesSinBlanco: IntervencionDeBlanco[];
  monitorizacionSinBlanco: MonitorizacionDeBlanco[];
}

/** Alertas cuya ruta apunta exactamente a ese elemento. */
export function alertasDeRuta(alertas: readonly Alerta[], ruta: string): Alerta[] {
  return alertas.filter((a) => a.ruta === ruta);
}

/** Todos los avisos que caen dentro de una tarjeta: deciden su estado de partida. */
export function avisosDeTarjeta(t: TarjetaBlanco): Alerta[] {
  return [
    ...t.alertasConducta,
    ...t.alternativas.flatMap((a) => a.alertas),
    ...t.intervenciones.flatMap((i) => i.alertas),
  ];
}

const PESO_IMPORTANCIA = { alta: 0, media: 1, baja: 2 } as const;

export function construirPlanPorBlanco(analisis: AnalisisFuncional): PlanPorBlanco {
  const priorizadas = analisis.formulacion.priorizacion;
  const idsConducta = new Set(analisis.conductas_problema.map((c) => c.id));

  const ordenadas = analisis.conductas_problema
    .map((conducta, indice) => ({ conducta, indice }))
    .sort((x, y) => {
      // Primero lo que el análisis priorizó, en su orden; después el resto por
      // importancia, conservando el orden original en los empates.
      const px = priorizadas.findIndex((p) => p.conducta_id === x.conducta.id);
      const py = priorizadas.findIndex((p) => p.conducta_id === y.conducta.id);
      const rx = px === -1 ? Infinity : px;
      const ry = py === -1 ? Infinity : py;
      if (rx !== ry) return rx - ry;
      const ix = PESO_IMPORTANCIA[x.conducta.importancia] ?? 1;
      const iy = PESO_IMPORTANCIA[y.conducta.importancia] ?? 1;
      if (ix !== iy) return ix - iy;
      return x.indice - y.indice;
    });

  // Cada alternativa va a UNA tarjeta: la primera conducta de su situación, en
  // el orden de arriba, que no sea de seguridad. Si fuera a todas, la misma
  // propuesta aparecería repetida con dos textos que nada obliga a mantener
  // iguales — el problema que llevó a reorganizar el informe. Una conducta de
  // seguridad es blanco de eliminación: no recibe conducta alternativa.
  const duenoDeAlternativa = new Map<number, Id>();
  analisis.conductas_alternativas.forEach((alt, i) => {
    if (!alt.situacion_id) return;
    const situacion = analisis.situaciones.find((s) => s.id === alt.situacion_id);
    if (!situacion) return;
    const dueno = ordenadas.find(
      ({ conducta }) =>
        !conducta.es_conducta_seguridad && situacion.conductas_ids.includes(conducta.id)
    );
    if (dueno) duenoDeAlternativa.set(i, dueno.conducta.id);
  });

  const alternativaConAlertas = (i: number): AlternativaDeBlanco => ({
    indice: i,
    alternativa: analisis.conductas_alternativas[i],
    alertas: alertasDeRuta(analisis.alertas, `conductas_alternativas[${i}]`),
  });

  const intervenciones = analisis.lineas_de_intervencion_tentativas.map(
    (linea, i): IntervencionDeBlanco => ({
      indice: i,
      linea,
      alertas: alertasDeRuta(analisis.alertas, `lineas_de_intervencion_tentativas[${i}]`),
    })
  );
  const monitorizacion = analisis.plan_de_monitorizacion.map(
    (plan, i): MonitorizacionDeBlanco => ({ indice: i, plan })
  );
  // Un id que ya no existe (la conducta se borró a mano) cuenta como sin blanco:
  // la entrada no desaparece del informe por haber perdido su tarjeta.
  const tieneBlanco = (id: Id | null) => id !== null && idsConducta.has(id);

  const tarjetas = ordenadas.map(({ conducta, indice }): TarjetaBlanco => {
    const p = priorizadas.findIndex((x) => x.conducta_id === conducta.id);
    return {
      conducta,
      prioridad: p === -1 ? null : p + 1,
      priorizacion: p === -1 ? null : priorizadas[p],
      hipotesis: analisis.hipotesis_mantenimiento.filter(
        (h) => h.destino_id === conducta.id
      ),
      funcionesDeSituacion: [
        ...new Set(
          analisis.situaciones
            .filter((s) => s.conductas_ids.includes(conducta.id) && s.funcion_hipotetizada)
            .map((s) => s.funcion_hipotetizada)
        ),
      ],
      alternativas: analisis.conductas_alternativas
        .map((_, i) => i)
        .filter((i) => duenoDeAlternativa.get(i) === conducta.id)
        .map(alternativaConAlertas),
      intervenciones: intervenciones.filter((x) => x.linea.conducta_id === conducta.id),
      monitorizacion: monitorizacion.filter((x) => x.plan.conducta_id === conducta.id),
      // Incluye los avisos de la cadena de ocho ranuras (`blancos[j]`) cuyo blanco
      // abarca esta conducta: hasta que la vista de blancos los pinte por ranura,
      // la tarjeta es donde se ven.
      alertasConducta: [
        ...alertasDeRuta(analisis.alertas, `conductas_problema[${indice}]`),
        ...(analisis.blancos ?? []).flatMap((b, j) =>
          b.conducta_ids.includes(conducta.id) ? alertasDeRuta(analisis.alertas, `blancos[${j}]`) : []
        ),
      ],
    };
  });

  return {
    tarjetas,
    alternativasSinBlanco: analisis.conductas_alternativas
      .map((_, i) => i)
      .filter((i) => !duenoDeAlternativa.has(i))
      .map(alternativaConAlertas),
    intervencionesSinBlanco: intervenciones.filter((x) => !tieneBlanco(x.linea.conducta_id)),
    monitorizacionSinBlanco: monitorizacion.filter((x) => !tieneBlanco(x.plan.conducta_id)),
  };
}

/**
 * El dato faltante del que depende una propuesta, si un validador lo señaló.
 *
 * Sale de las alertas `intervencion_depende_de_dato_faltante` y se busca en las
 * preguntas por su dato exacto: el mensaje lo compone lib/validadores.ts con el
 * dato entre comillas, así que no se interpreta prosa del modelo, solo se
 * relee lo que escribió el propio validador.
 */
export function datosFaltantesDe(
  analisis: AnalisisFuncional,
  alertas: readonly Alerta[]
): string[] {
  const datos = alertas
    .filter((a) => a.codigo === "intervencion_depende_de_dato_faltante")
    .map(
      (a) =>
        analisis.preguntas.find(
          (p) => p.dato_faltante && a.mensaje.includes(`"${p.dato_faltante}"`)
        )?.dato_faltante
    )
    .filter((d): d is string => Boolean(d));
  return [...new Set(datos)];
}

/**
 * De qué datos depende una intervención: la pregunta a la que el modelo la
 * ató (`pregunta_id`, o `depende_de` si no llegó a resolverse) y lo que detectó
 * el validador V4 por su cuenta. Las dos fuentes se suman a propósito: el
 * validador existe para no depender de que el modelo lo declare (invariante 3),
 * y el modelo puede ver una dependencia que el emparejamiento por palabras del
 * validador no ve.
 *
 * Una pregunta ya respondida o descartada deja de condicionar la propuesta.
 */
export function datosFaltantesDeIntervencion(
  analisis: AnalisisFuncional,
  item: IntervencionDeBlanco
): string[] {
  const pregunta = item.linea.pregunta_id
    ? analisis.preguntas.find((p) => p.id === item.linea.pregunta_id)
    : undefined;
  const declarado = pregunta
    ? estaAbierta(pregunta)
      ? pregunta.dato_faltante || pregunta.texto
      : undefined
    : item.linea.depende_de?.trim();
  return [
    ...new Set([...(declarado ? [declarado] : []), ...datosFaltantesDe(analisis, item.alertas)]),
  ];
}

/** La pregunta que declara este dato, para enlazar «Primero explorar» con ella. */
export function preguntaDeDato(
  analisis: AnalisisFuncional,
  dato: string
): PreguntaClinica | undefined {
  const clave = normalizarTexto(dato);
  return analisis.preguntas.find(
    (p) => normalizarTexto(p.dato_faltante) === clave || normalizarTexto(p.texto) === clave
  );
}

/** «Primero explorar: …». Los datos suelen traer su punto final; no se duplica. */
export function enumerarDatosFaltantes(datos: readonly string[]): string {
  return `${datos.map((d) => d.trim().replace(/\.+$/, "")).join("; ")}.`;
}

/**
 * Los blancos de un informe que aún no los tiene (esquema v8): uno por conducta
 * problema, con lo que hoy se enlaza a ella.
 *
 * Reutiliza `construirPlanPorBlanco` a propósito: el blanco de la v8 reúne lo
 * mismo que ya mostraba la tarjeta, con los mismos criterios (la alternativa va
 * a la primera conducta no de seguridad de su situación; intervenciones y
 * monitorización por `conducta_id`). Ninguna entrada cambia de dueño al migrar,
 * y lo que no tenía dueño queda fuera de todo blanco —«Por asignar»— en vez de
 * asignarse a la más parecida.
 *
 * La hipótesis del blanco es la primera que apunta a su conducta. Si hay varias,
 * las demás siguen en el análisis y el Mapa las enseña; el blanco solo señala
 * la que organiza su cadena, y el clínico puede cambiarla.
 *
 * `operacionalizacion` nace vacía: copiarla de la descripción de la conducta la
 * presentaría como decidida cuando nadie la ha decidido. `mecanismo` sí lo
 * trae el modelo (6B) en la priorización del blanco, y se copia UNA vez: desde
 * entonces es del blanco.
 *
 * Los ids de estrategias e indicadores deben existir ya (los da `asignarIds`).
 */
export function blancosDeLegado(analisis: AnalisisFuncional): Blanco[] {
  const plan = construirPlanPorBlanco(analisis);
  return plan.tarjetas.map((t, i): Blanco => {
    const estado = estadoDeBlanco(analisis, t.conducta.id);
    return {
      id: `bln_${i + 1}`,
      conducta_ids: [t.conducta.id],
      hipotesis_id: t.hipotesis[0]?.id ?? null,
      operacionalizacion: "",
      mecanismo: t.priorizacion?.mecanismo ?? "",
      alternativa_ids: t.alternativas.map((x) => x.alternativa.id),
      estrategia_ids: t.intervenciones.map((x) => x.linea.id),
      indicador_ids: t.monitorizacion.map((x) => x.plan.id),
      revision: estado.revision,
      fase: estado.fase,
      prioridad: t.prioridad,
      revisar_en_sesion: null,
      alternativas_rechazadas: [],
      motivo_alerta: null,
    };
  });
}

/**
 * Revisión y fase de un blanco tal como valen HOY. Hasta que la interfaz de la
 * fase 6C escriba el estado en el propio blanco, el clínico lo sigue decidiendo
 * en `estados_plan` (por id de conducta), y esa decisión gana: si no, rechazar
 * un blanco en pantalla no lo sacaría de las comprobaciones. Sin decisión
 * explícita vale lo que guarda el blanco.
 */
export function estadoEfectivoDeBlanco(
  analisis: AnalisisFuncional,
  blanco: Blanco
): EstadoBlanco {
  for (const id of blanco.conducta_ids) {
    const decidido = estadoBlancoGuardado(analisis.estados_plan?.[id]);
    if (decidido) return decidido;
  }
  return { revision: blanco.revision, fase: blanco.fase };
}

/** ¿Cuenta este blanco para las comprobaciones? Uno rechazado ya no está en el tratamiento. */
export function estaVigente(estado: EstadoBlanco): boolean {
  return estado.revision !== "rechazado";
}

export interface PorAsignar {
  alternativas: AlternativaDeBlanco[];
  estrategias: IntervencionDeBlanco[];
  indicadores: MonitorizacionDeBlanco[];
}

/**
 * La bandeja «Por asignar»: alternativas, estrategias e indicadores que ningún
 * blanco referencia. Sustituye a las tres listas «sin blanco» de la tarjeta
 * (que seguían la conducta, no el blanco), y es lo que garantiza que ninguna
 * entrada desaparece al pasar a blancos: lo que no está en uno está aquí.
 *
 * Un id guardado en un blanco que ya no existe (se borró la entrada) no cuenta
 * como asignación de nada.
 */
export function porAsignar(analisis: AnalisisFuncional): PorAsignar {
  const usados = (extraer: (b: Blanco) => Id[]) =>
    new Set((analisis.blancos ?? []).flatMap(extraer));
  // Una alternativa rechazada sigue siendo de su blanco (tachada), no vuelve a la bandeja.
  const alternativas = usados((b) => [...b.alternativa_ids, ...(b.alternativas_rechazadas ?? [])]);
  const estrategias = usados((b) => b.estrategia_ids);
  const indicadores = usados((b) => b.indicador_ids);
  return {
    alternativas: analisis.conductas_alternativas
      .map((a, indice): AlternativaDeBlanco => ({
        indice,
        alternativa: a,
        alertas: alertasDeRuta(analisis.alertas, `conductas_alternativas[${indice}]`),
      }))
      .filter((x) => !alternativas.has(x.alternativa.id)),
    estrategias: analisis.lineas_de_intervencion_tentativas
      .map((linea, indice): IntervencionDeBlanco => ({
        indice,
        linea,
        alertas: alertasDeRuta(analisis.alertas, `lineas_de_intervencion_tentativas[${indice}]`),
      }))
      .filter((x) => !estrategias.has(x.linea.id)),
    indicadores: analisis.plan_de_monitorizacion
      .map((plan, indice): MonitorizacionDeBlanco => ({ indice, plan }))
      .filter((x) => !indicadores.has(x.plan.id)),
  };
}

/* ── Fase 6C · La cadena de ocho ranuras ───────────────────────────────── */

/**
 * ● completa · ⋯ hueco · ◆ conviene revisar · ▲ revisar antes de usar. Ninguna
 * se pinta en verde: un plan no se apoya en la nota, se decide.
 */
export type EstadoRanura = "completa" | "hueco" | "revisar" | "alta";

export type ClaveRanura =
  | "evidencia"
  | "hipotesis"
  | "blanco"
  | "mecanismo"
  | "alternativa"
  | "estrategia"
  | "indicador"
  | "revision";

export interface Ranura {
  clave: ClaveRanura;
  etiqueta: string;
  estado: EstadoRanura;
  alertas: Alerta[];
}

export const SIMBOLO_RANURA: Record<EstadoRanura, string> = {
  completa: "●",
  hueco: "⋯",
  revisar: "◆",
  alta: "▲",
};

const ETIQUETA_RANURA: Record<ClaveRanura, string> = {
  evidencia: "Evidencia",
  hipotesis: "Hipótesis",
  blanco: "Blanco",
  mecanismo: "Mecanismo",
  alternativa: "Alternativa",
  estrategia: "Estrategia",
  indicador: "Indicador",
  revision: "Revisión",
};

/** Las alertas cuya ruta es esa entrada o un campo suyo. */
function alertasDeEntrada(alertas: readonly Alerta[], ruta: string): Alerta[] {
  return alertas.filter((a) => a.ruta === ruta || a.ruta?.startsWith(`${ruta}.`));
}

function estadoPorAlertas(lleno: boolean, alertas: readonly Alerta[]): EstadoRanura {
  if (alertas.some((a) => a.gravedad === "alta")) return "alta";
  if (alertas.length > 0) return "revisar";
  return lleno ? "completa" : "hueco";
}

/**
 * El estado de cada ranura de un blanco, en el orden fijo de la cadena. Todo
 * sale de lo que el blanco referencia y de las alertas ya calculadas por los
 * validadores: aquí no se decide nada nuevo, solo se reparte.
 */
export function ranurasDeBlanco(analisis: AnalisisFuncional, indiceBlanco: number): Ranura[] {
  const blanco = analisis.blancos[indiceBlanco];
  const alertas = analisis.alertas ?? [];
  const deBlanco = alertasDeEntrada(alertas, `blancos[${indiceBlanco}]`);
  const hipotesis = analisis.hipotesis_mantenimiento.find((h) => h.id === blanco.hipotesis_id);
  const rechazadas = new Set(blanco.alternativas_rechazadas ?? []);

  const entradas = <T extends { id: string }>(lista: readonly T[], ids: readonly string[], campo: string) =>
    lista
      .map((x, i) => ({ x, ruta: `${campo}[${i}]` }))
      .filter(({ x }) => ids.includes(x.id) && !rechazadas.has(x.id));
  const alternativas = entradas(analisis.conductas_alternativas, blanco.alternativa_ids, "conductas_alternativas");
  const estrategias = entradas(analisis.lineas_de_intervencion_tentativas, blanco.estrategia_ids, "lineas_de_intervencion_tentativas");
  const indicadores = analisis.plan_de_monitorizacion.filter((p) => blanco.indicador_ids.includes(p.id));

  const r = (clave: ClaveRanura, estado: EstadoRanura, propias: Alerta[] = []): Ranura => ({
    clave,
    etiqueta: ETIQUETA_RANURA[clave],
    estado,
    alertas: propias,
  });
  const sinHipotesis = deBlanco.filter((a) => a.codigo === "blanco_activo_sin_hipotesis");
  const sinIndicador = deBlanco.filter((a) => a.codigo === "blanco_sin_indicador_o_revision");
  const deAlternativas = alternativas.flatMap(({ ruta }) => alertasDeEntrada(alertas, ruta));
  const deEstrategias = estrategias.flatMap(({ ruta }) => alertasDeEntrada(alertas, ruta));
  const criterio = indicadores.some((p) => p.criterio_de_revision.trim());

  return [
    r("evidencia", hipotesis ? (hipotesis.evidencia.verificada ? "completa" : "revisar") : "hueco"),
    r("hipotesis", estadoPorAlertas(Boolean(hipotesis), sinHipotesis), sinHipotesis),
    r("blanco", blanco.operacionalizacion.trim() ? "completa" : "hueco"),
    r("mecanismo", blanco.mecanismo.trim() ? "completa" : "hueco"),
    r("alternativa", estadoPorAlertas(alternativas.length > 0, deAlternativas), deAlternativas),
    r("estrategia", estadoPorAlertas(estrategias.length > 0, deEstrategias), deEstrategias),
    r(
      "indicador",
      indicadores.length === 0 ? (sinIndicador.length ? "revisar" : "hueco") : "completa",
      indicadores.length === 0 ? sinIndicador : []
    ),
    r(
      "revision",
      criterio && blanco.revisar_en_sesion !== null ? "completa" : criterio || blanco.revisar_en_sesion !== null ? "revisar" : "hueco",
      indicadores.length > 0 ? sinIndicador : []
    ),
  ];
}

/** «Listo N de 8»: solo cuentan las ranuras completas, sin avisos. */
export function ranurasListas(ranuras: readonly Ranura[]): number {
  return ranuras.filter((r) => r.estado === "completa").length;
}

/**
 * Mueve un blanco en la lista y renumera la prioridad de todos (1 = el primero).
 * Ordenar es decisión del clínico: quien llama lo aplica sin marcar texto editado.
 */
export function moverBlanco(analisis: AnalisisFuncional, id: Id, paso: -1 | 1): void {
  const orden = ordenarBlancos(analisis.blancos);
  const i = orden.findIndex((b) => b.id === id);
  const j = i + paso;
  if (i < 0 || j < 0 || j >= orden.length) return;
  [orden[i], orden[j]] = [orden[j], orden[i]];
  orden.forEach((b, n) => {
    b.prioridad = n + 1;
  });
}

/** Por prioridad; los que no la tienen, detrás y en su orden de siempre. */
export function ordenarBlancos<T extends Pick<Blanco, "prioridad">>(blancos: readonly T[]): T[] {
  return blancos
    .map((b, i) => ({ b, i }))
    .sort((x, y) => (x.b.prioridad ?? Infinity) - (y.b.prioridad ?? Infinity) || x.i - y.i)
    .map((x) => x.b);
}
