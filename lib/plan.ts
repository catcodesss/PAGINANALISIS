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

import type {
  Alerta,
  AnalisisFuncional,
  ConductaAlternativa,
  ConductaProblema,
  EstadoPlan,
  HipotesisMantenimiento,
  Id,
  LineaIntervencion,
  PlanDeMonitorizacion,
  PriorizacionBlanco,
} from "./types";

/** Los estados, en el orden en que se recorren. El primero es el de fábrica. */
export const ESTADOS_PLAN = [
  { id: "propuesto", etiqueta: "Propuesto por IA" },
  { id: "revisar", etiqueta: "Revisar" },
  { id: "aprobado", etiqueta: "Aprobado" },
  { id: "en_curso", etiqueta: "En curso" },
  { id: "descartado", etiqueta: "Descartado" },
] as const satisfies readonly { id: EstadoPlan; etiqueta: string }[];

export const ETIQUETA_ESTADO_PLAN = Object.fromEntries(
  ESTADOS_PLAN.map((e) => [e.id, e.etiqueta])
) as Record<EstadoPlan, string>;

export function esEstadoPlan(valor: unknown): valor is EstadoPlan {
  return ESTADOS_PLAN.some((e) => e.id === valor);
}

/**
 * El estado de un blanco. Sin decisión del clínico, lo que hay es una
 * propuesta de la IA — salvo que un validador haya señalado algo en esa
 * tarjeta: entonces el estado de partida es «Revisar». No se puede presentar
 * como propuesta normal algo que el propio sistema ya sabe que hay que mirar.
 * Una decisión explícita del clínico gana siempre: es criterio profesional.
 */
export function estadoDeBlanco(
  analisis: AnalisisFuncional,
  conductaId: Id,
  tieneAvisos: boolean
): EstadoPlan {
  const elegido = analisis.estados_plan?.[conductaId];
  if (esEstadoPlan(elegido)) return elegido;
  return tieneAvisos ? "revisar" : "propuesto";
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
      alertasConducta: alertasDeRuta(analisis.alertas, `conductas_problema[${indice}]`),
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
 * Sale de las alertas `intervencion_depende_de_dato_faltante` y se busca en
 * `datos_faltantes` por su texto exacto: el mensaje lo compone
 * lib/validadores.ts con el `dato` entre comillas, así que no se interpreta
 * prosa del modelo, solo se relee lo que escribió el propio validador.
 */
export function datosFaltantesDe(
  analisis: AnalisisFuncional,
  alertas: readonly Alerta[]
): string[] {
  const datos = alertas
    .filter((a) => a.codigo === "intervencion_depende_de_dato_faltante")
    .map((a) => analisis.datos_faltantes.find((d) => a.mensaje.includes(`"${d.dato}"`))?.dato)
    .filter((d): d is string => Boolean(d));
  return [...new Set(datos)];
}

/**
 * De qué datos depende una intervención: lo que el modelo declaró en
 * `depende_de` y lo que detectó el validador V4 por su cuenta. Las dos fuentes
 * se suman a propósito: el validador existe para no depender de que el modelo
 * lo declare (invariante 3), y el modelo puede ver una dependencia que el
 * emparejamiento por palabras del validador no ve.
 */
export function datosFaltantesDeIntervencion(
  analisis: AnalisisFuncional,
  item: IntervencionDeBlanco
): string[] {
  const declarado = item.linea.depende_de?.trim();
  return [
    ...new Set([...(declarado ? [declarado] : []), ...datosFaltantesDe(analisis, item.alertas)]),
  ];
}

/** «Primero explorar: …». Los datos suelen traer su punto final; no se duplica. */
export function enumerarDatosFaltantes(datos: readonly string[]): string {
  return `${datos.map((d) => d.trim().replace(/\.+$/, "")).join("; ")}.`;
}
