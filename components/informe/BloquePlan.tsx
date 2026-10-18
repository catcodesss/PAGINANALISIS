"use client";

/**
 * Bloque 4 · Plan.
 *
 * Una tarjeta por blanco clínico, con la misma secuencia en todas: blanco →
 * función → conducta alternativa → intervención (con su porqué) →
 * monitorización → revisar la hipótesis si… Antes eran tres listas por tipo de
 * contenido y el terapeuta tenía que reconstruir de cabeza qué iba con qué; ver
 * lib/plan.ts para cómo se hacen las conexiones (por id, nunca por prosa).
 *
 * Los avisos del validador van DENTRO de la tarjeta, junto a la propuesta que
 * señalan. Una propuesta problemática no puede leerse primero como
 * recomendación normal y, una pestaña después, como error. Siguen también en
 * Revisión, que es la lista completa: aquí se muestran, no se mueven.
 *
 * Debajo de las tarjetas queda lo que no tiene blanco: intervenciones comunes
 * al caso (una coordinación médica, por ejemplo) y todo lo de los informes
 * anteriores al prompt 1.7.0, que no decían a qué conducta se dirigían.
 */

import { useMemo, useState, type ReactNode } from "react";
import type {
  Alerta,
  AnalisisFuncional,
  EstadoBlanco,
  FaseBlanco,
  RevisionBlanco,
  LineaIntervencion,
  PlanDeMonitorizacion,
} from "@/lib/types";
import { construirNodosGrafo } from "@/lib/grafo";
import { gradoDeHipotesis, traducirMensajeAlerta } from "@/lib/gradoApoyo";
import {
  avisosDeTarjeta,
  construirPlanPorBlanco,
  datosFaltantesDe,
  datosFaltantesDeIntervencion,
  preguntaDeDato,
  estadoDeBlanco,
  FASES,
  REVISIONES,
  textoDeEstadoBlanco,
  type AlternativaDeBlanco,
  type IntervencionDeBlanco,
  type MonitorizacionDeBlanco,
  type TarjetaBlanco,
} from "@/lib/plan";
import { yaEnRepertorio } from "@/lib/validadores";
import { sugerirConducta } from "@/lib/identidad";
import { Apoyo, BloqueBase, MenuAcciones, TablaCadena } from "./primitivas";
import { Seccion } from "./seccion";
import { BotonAgregar, TextoEditable, useEdicion } from "../edicionManual";
import { EnlacePregunta } from "./PreguntasClinicas";
import CadenaBlanco, { hayAlertaAlta } from "./CadenaBlanco";
import { moverBlanco, ordenarBlancos } from "@/lib/plan";

type EditarSeccion = (
  seccionId: string | null,
  mutar: (copia: AnalisisFuncional) => void
) => void;

export default function BloquePlan({
  visible,
  analisis,
  onEditarSeccion,
}: {
  visible: boolean;
  analisis: AnalisisFuncional;
  onEditarSeccion: EditarSeccion;
}) {
  const plan = useMemo(() => {
    const p = construirPlanPorBlanco(analisis);
    // El orden lo da la prioridad del blanco, que el clínico puede cambiar.
    const orden = ordenarBlancos(analisis.blancos ?? []);
    const posicion = (conductaId: string) => {
      const i = orden.findIndex((b) => b.conducta_ids.includes(conductaId));
      return i < 0 ? Infinity : i;
    };
    return { ...p, tarjetas: [...p.tarjetas].sort((x, y) => posicion(x.conducta.id) - posicion(y.conducta.id)) };
  }, [analisis]);
  const nodos = useMemo(() => construirNodosGrafo(analisis), [analisis]);
  const blancos = plan.tarjetas.map((t, n) => ({ id: t.conducta.id, numero: n + 1, etiqueta: t.conducta.descripcion }));
  // Asignar un blanco es una decisión del clínico sobre a qué se dirige una
  // propuesta, no texto suyo: como los estados del plan, no marca la sección
  // como editada (invariante 6 habla de autoría del texto).
  const asignarIntervencion = (indice: number) => (conductaId: string) =>
    onEditarSeccion(null, (c) => {
      c.lineas_de_intervencion_tentativas[indice] = { ...c.lineas_de_intervencion_tentativas[indice], conducta_id: conductaId };
      const id = c.lineas_de_intervencion_tentativas[indice].id;
      const b = c.blancos.find((x) => x.conducta_ids.includes(conductaId));
      if (b && id && !b.estrategia_ids.includes(id)) b.estrategia_ids = [...b.estrategia_ids, id];
    });
  const asignarMonitorizacion = (indice: number) => (conductaId: string) =>
    onEditarSeccion(null, (c) => {
      c.plan_de_monitorizacion[indice] = { ...c.plan_de_monitorizacion[indice], conducta_id: conductaId };
      const id = c.plan_de_monitorizacion[indice].id;
      const b = c.blancos.find((x) => x.conducta_ids.includes(conductaId));
      if (b && id && !b.indicador_ids.includes(id)) b.indicador_ids = [...b.indicador_ids, id];
    });

  return (
    <BloqueBase id="plan" visible={visible}>
      <Seccion
        id="conductas-alternativas"
        titulo="Plan por blanco"
        camposReanalisis={[
          "conductas_alternativas",
          "lineas_de_intervencion_tentativas",
          "plan_de_monitorizacion",
        ]}
      >
        {plan.tarjetas.length === 0 ? (
          <p className="text-sm leading-relaxed text-ink-muted">
            El análisis no recoge conductas problema, así que no hay blancos
            sobre los que proponer un plan.
          </p>
        ) : (
          <ol className="space-y-5">
            {plan.tarjetas.map((t, n) => (
              <TarjetaDeBlanco
                key={t.conducta.id}
                numero={n + 1}
                total={plan.tarjetas.length}
                tarjeta={t}
                analisis={analisis}
                gradoFuncion={t.hipotesis.map((h) => gradoDeHipotesis(h, nodos, analisis.aristas))}
                onEditarSeccion={onEditarSeccion}
              />
            ))}
          </ol>
        )}

        {plan.alternativasSinBlanco.length > 0 && (
          <div className="mt-6 rounded-md border border-dashed border-divider p-4">
            <p className="font-mono text-[10px] uppercase tracking-wide text-ink-muted">
              Conductas alternativas sin blanco asignado
            </p>
            <p className="mt-1 text-sm leading-relaxed text-ink-muted">
              Su situación no se pudo enlazar con ninguna conducta problema que
              admita alternativa —o no se pudo enlazar en absoluto, o solo con
              conductas de seguridad, que son blanco de eliminación—, así que no
              se colocan en una tarjeta: asignarlas por parecido sería afirmar
              una relación que el análisis no traza.
            </p>
            <ul className="mt-3 space-y-4">
              {plan.alternativasSinBlanco.map((a) => (
                <Alternativa
                  key={a.indice}
                  item={a}
                  analisis={analisis}
                  onEditarSeccion={onEditarSeccion}
                  mostrarSituacion
                />
              ))}
            </ul>
          </div>
        )}
      </Seccion>

      <Seccion
        id="intervencion"
        titulo="Intervenciones sin blanco"
        camposReanalisis={["lineas_de_intervencion_tentativas"]}
      >
        {plan.intervencionesSinBlanco.length === 0 ? (
          <p className="text-sm leading-relaxed text-ink-muted">
            Todas las intervenciones propuestas están en la tarjeta de su
            blanco.
          </p>
        ) : (
          <>
            <p className="mb-3 text-sm leading-relaxed text-ink-muted">
              No dicen a qué conducta se dirigen, o la conducta que nombran no
              se pudo enlazar: pueden ser comunes a todo el caso (una
              coordinación médica, por ejemplo) o venir de un informe anterior
              a que el plan se organizara por blanco. Léelas contra la función
              de cada blanco antes de adoptarlas.
            </p>
            <ul className="space-y-4">
              {plan.intervencionesSinBlanco.map((x) => (
                <Intervencion
                  key={x.indice}
                  item={x}
                  analisis={analisis}
                  onEditarSeccion={onEditarSeccion}
                  sugerencia={
                    <SugerenciaBlanco
                      blancos={blancos}
                      sugerido={sugerirConducta(analisis, [x.linea.intervencion, x.linea.porque, x.linea.contingencia_objetivo, x.linea.precauciones, x.linea.depende_de])}
                      onAsignar={asignarIntervencion(x.indice)}
                    />
                  }
                />
              ))}
            </ul>
          </>
        )}
      </Seccion>

      <Seccion
        id="monitorizacion"
        titulo="Monitorización sin blanco"
        camposReanalisis={["plan_de_monitorizacion"]}
      >
        {plan.monitorizacionSinBlanco.length === 0 ? (
          <p className="text-sm leading-relaxed text-ink-muted">
            {analisis.plan_de_monitorizacion.length === 0
              ? "La nota no daba base para proponer ningún plan de medición. Conviene definirlo antes de aplicar la intervención: sin él no hay forma de saber si la formulación se sostiene."
              : "Toda la monitorización propuesta está en la tarjeta de su blanco."}
          </p>
        ) : (
          <>
            <p className="mb-3 text-sm leading-relaxed text-ink-muted">
              Sin blanco enlazado. Si mezcla indicadores de conductas
              distintas, conviene registrarlos por separado.
            </p>
            <div className="space-y-6">
              {plan.monitorizacionSinBlanco.map((m) => (
                <Monitorizacion
                  key={m.indice}
                  item={m}
                  onEditarSeccion={onEditarSeccion}
                  sugerencia={
                    <SugerenciaBlanco
                      blancos={blancos}
                      sugerido={sugerirConducta(analisis, [m.plan.que_se_mide, m.plan.criterio_de_revision])}
                      onAsignar={asignarMonitorizacion(m.indice)}
                    />
                  }
                />
              ))}
            </div>
          </>
        )}
      </Seccion>
    </BloqueBase>
  );
}

interface BlancoElegible {
  id: string;
  numero: number;
  etiqueta: string;
}

/**
 * «¿Asignar a Blanco N?» para lo que quedó sin blanco. La sugerencia sale de
 * lib/identidad.ts#sugerirConducta y NUNCA se aplica sola: es parecido de
 * palabras, y quien decide a qué se dirige una propuesta es el clínico.
 *
 * «Dejar sin blanco» solo oculta la sugerencia en esta sesión: recordarlo
 * pediría un campo nuevo en el esquema, y lo que se pierde al recargar es una
 * pregunta, no un dato.
 */
function SugerenciaBlanco({
  blancos,
  sugerido,
  onAsignar,
}: {
  blancos: readonly BlancoElegible[];
  sugerido: string | null;
  onAsignar: (conductaId: string) => void;
}) {
  const [modo, setModo] = useState<"sugerencia" | "elegir" | "descartada">("sugerencia");
  const candidato = blancos.find((b) => b.id === sugerido) ?? null;
  if (blancos.length === 0 || modo === "descartada") return null;
  const boton = "rounded border px-2.5 py-1 text-xs transition";

  if (modo === "elegir" || !candidato) {
    return (
      <div className="mb-3 flex flex-wrap items-center gap-2 rounded-md bg-canvas px-3 py-2 text-sm print:hidden">
        <label className="flex flex-wrap items-center gap-2 text-ink-muted">
          Asignar a
          <select
            defaultValue=""
            onChange={(e) => e.target.value && onAsignar(e.target.value)}
            className="max-w-full rounded border border-divider bg-surface px-2 py-1 text-xs text-ink"
          >
            <option value="" disabled>Elige un blanco…</option>
            {blancos.map((b) => (
              <option key={b.id} value={b.id}>Blanco {b.numero}: {b.etiqueta}</option>
            ))}
          </select>
        </label>
        {candidato && (
          <button type="button" onClick={() => setModo("sugerencia")} className={`${boton} border-divider text-ink-muted hover:text-ink`}>
            Volver a la sugerencia
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="mb-3 rounded-md bg-canvas px-3 py-2 text-sm print:hidden">
      <p className="text-ink">
        ¿Asignar a <strong>Blanco {candidato.numero}</strong>?{" "}
        <span className="text-ink-muted">{candidato.etiqueta}</span>
      </p>
      <p className="mt-0.5 text-xs text-ink-muted">Sugerido por parecido de palabras. No se asigna hasta que lo confirmes.</p>
      <div className="mt-2 flex flex-wrap gap-2">
        <button type="button" onClick={() => onAsignar(candidato.id)} className={`${boton} border-accent/50 bg-accent-soft font-medium text-accent hover:border-accent`}>
          Asignar
        </button>
        <button type="button" onClick={() => setModo("elegir")} className={`${boton} border-divider text-ink hover:border-ink-muted/60`}>
          Elegir otro
        </button>
        <button type="button" onClick={() => setModo("descartada")} className={`${boton} border-divider text-ink-muted hover:text-ink`}>
          Dejar sin blanco
        </button>
      </div>
    </div>
  );
}

/** Un paso de la secuencia fija de la tarjeta. */
function Paso({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-divider pt-3 print:border-black">
      <p className="font-mono text-[10px] uppercase tracking-wide text-ink-muted">{titulo}</p>
      <div className="mt-1">{children}</div>
    </div>
  );
}

/** Un aviso del validador en el sitio exacto al que apunta. */
function AvisoEnLinea({ alerta }: { alerta: Alerta }) {
  const alta = alerta.gravedad === "alta";
  return (
    <p
      className={`mt-2 rounded border-l-[3px] py-1.5 pl-3 pr-2 text-sm leading-relaxed ${
        alta ? "border-warn bg-warn/5 text-ink" : "border-divider bg-canvas text-ink-muted"
      }`}
    >
      <span className={`font-medium ${alta ? "text-warn" : "text-ink"}`}>
        <span aria-hidden="true">⚠ </span>
        {alta ? "Requiere revisión" : "Conviene revisar"}
        {alerta.origen === "ia" ? " (revisión con IA)" : ""}:
      </span>{" "}
      {traducirMensajeAlerta(alerta.mensaje)}
    </p>
  );
}

/** «Información insuficiente…»: encabeza una propuesta condicional. */
function Insuficiente({
  datos,
  que,
  analisis,
}: {
  datos: string[];
  que: string;
  analisis: AnalisisFuncional;
}) {
  return (
    <p className="mb-1.5 rounded border-l-[3px] border-warn bg-warn/5 py-1.5 pl-3 pr-2 text-sm leading-relaxed text-ink">
      <span className="font-medium text-warn">Información insuficiente para {que}.</span>{" "}
      Primero explorar:{" "}
      {datos.map((d, i) => (
        <span key={i}>
          {i > 0 && "; "}
          <EnlacePregunta pregunta={preguntaDeDato(analisis, d)}>
            {d.trim().replace(/\.+$/, "")}
          </EnlacePregunta>
        </span>
      ))}
      .
    </p>
  );
}

function TarjetaDeBlanco({
  numero,
  total,
  tarjeta,
  analisis,
  gradoFuncion,
  onEditarSeccion,
}: {
  numero: number;
  total: number;
  tarjeta: TarjetaBlanco;
  analisis: AnalisisFuncional;
  gradoFuncion: ReturnType<typeof gradoDeHipotesis>[];
  onEditarSeccion: EditarSeccion;
}) {
  const edicion = useEdicion();
  const { conducta, alternativas, intervenciones, monitorizacion } = tarjeta;
  const avisos = avisosDeTarjeta(tarjeta);
  const estado = estadoDeBlanco(analisis, conducta.id);
  const descartado = estado.revision === "rechazado";
  const sinFuncion =
    tarjeta.hipotesis.length === 0 && tarjeta.funcionesDeSituacion.length === 0;

  const indiceBlanco = (analisis.blancos ?? []).findIndex((b) => b.conducta_ids.includes(conducta.id));
  const blanco = indiceBlanco >= 0 ? analisis.blancos[indiceBlanco] : null;
  const [pendiente, setPendiente] = useState<Partial<EstadoBlanco> | null>(null);
  const [motivo, setMotivo] = useState("");
  // La cadena ya resume el blanco: el texto largo queda plegado (se imprime igual).
  const [verDetalle, setVerDetalle] = useState(false);

  // Reordenar es decisión del clínico: va con `null`. Alt+↑/↓ desde la tarjeta.
  const mover = (paso: -1 | 1) => {
    if (blanco) onEditarSeccion(null, (c) => moverBlanco(c, blanco.id, paso));
  };

  // Activar o confirmar un blanco con una alerta ▲ pide reconocerla con un motivo.
  function pedirCambio(nuevo: Partial<EstadoBlanco>) {
    const activa = nuevo.fase === "activo" || nuevo.revision === "confirmado" || nuevo.revision === "modificado";
    if (activa && indiceBlanco >= 0 && hayAlertaAlta(analisis, indiceBlanco) && !blanco?.motivo_alerta) {
      setPendiente(nuevo);
      return;
    }
    cambiarEstado(nuevo);
  }

  // Cambiar el estado es una decisión sobre la propuesta, no texto escrito a
  // mano: por eso va con `null` y no marca la sección como editada.
  function cambiarEstado(nuevo: Partial<EstadoBlanco>, motivoAlerta?: string) {
    onEditarSeccion(null, (c) => {
      if (motivoAlerta && indiceBlanco >= 0) c.blancos[indiceBlanco].motivo_alerta = motivoAlerta;
      const actual = estadoDeBlanco(c, conducta.id);
      const revision = nuevo.revision ?? actual.revision;
      // Un blanco rechazado no está en el tratamiento: no tiene fase. Al
      // reabrirlo vuelve a «activo», que es de donde parte cualquier propuesta.
      const fase: FaseBlanco | null =
        revision === "rechazado" ? null : (nuevo.fase ?? actual.fase ?? "activo");
      c.estados_plan = { ...c.estados_plan, [conducta.id]: { revision, fase } };
    });
  }

  // Lo que el clínico añade desde la tarjeta nace ya enlazado a este blanco.
  function agregarIntervencion(texto: string) {
    onEditarSeccion("intervencion", (c) => {
      c.lineas_de_intervencion_tentativas = [
        ...c.lineas_de_intervencion_tentativas,
        {
          id: `est_${c.siguiente_id++}`,
          actua_sobre: null,
          actua_sobre_texto: "",
          conducta: conducta.descripcion,
          conducta_id: conducta.id,
          intervencion: texto,
          porque: "",
          pregunta_id: null,
          depende_de: null,
          contingencia_objetivo: null,
          precauciones: null,
        },
      ];
    });
  }

  return (
    <li>
      <article
        aria-labelledby={`blanco-${conducta.id}`}
        onKeyDown={(e) => {
          if (!e.altKey || !edicion) return;
          if (e.key === "ArrowUp") { e.preventDefault(); mover(-1); }
          if (e.key === "ArrowDown") { e.preventDefault(); mover(1); }
        }}
        className={`rounded-md border p-4 sm:p-5 print:border-black ${
          avisos.some((a) => a.gravedad === "alta") && !descartado
            ? "border-warn/50"
            : "border-divider"
        } ${descartado ? "opacity-70" : ""}`}
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1">
            <p className="font-mono text-[10px] uppercase tracking-wide text-ink-muted">
              Blanco {numero}
              {" · "}
              {tarjeta.prioridad
                ? `Prioridad ${tarjeta.prioridad}`
                : `Sin priorizar · importancia ${conducta.importancia}`}
              {avisos.length > 0 && estado.revision === "propuesto" && (
                <span className="text-warn"> · Requiere revisión</span>
              )}
            </p>
            <h4
              id={`blanco-${conducta.id}`}
              className="mt-1 font-serif text-lg font-semibold leading-snug text-ink"
            >
              {conducta.descripcion}
            </h4>
          </div>
          <div className="shrink-0">
            {edicion ? (
              <div className="flex flex-wrap items-center gap-2 print:hidden">
                {blanco && total > 1 && (
                  <span className="flex gap-1">
                    <button type="button" onClick={() => mover(-1)} disabled={numero === 1} aria-label={`Subir el blanco ${numero}`} title="Subir (Alt+↑)" className="rounded border border-divider px-1.5 py-0.5 text-xs text-ink-muted hover:text-ink disabled:opacity-40">↑</button>
                    <button type="button" onClick={() => mover(1)} disabled={numero === total} aria-label={`Bajar el blanco ${numero}`} title="Bajar (Alt+↓)" className="rounded border border-divider px-1.5 py-0.5 text-xs text-ink-muted hover:text-ink disabled:opacity-40">↓</button>
                  </span>
                )}
                <label className="flex items-center gap-2">
                  <span className="sr-only">Revisión del blanco {numero}</span>
                  <select
                    value={estado.revision}
                    onChange={(e) => pedirCambio({ revision: e.target.value as RevisionBlanco })}
                    className="rounded border border-divider bg-surface px-2 py-1 text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
                  >
                    {REVISIONES.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.etiqueta}
                      </option>
                    ))}
                  </select>
                </label>
                {estado.fase !== null && (
                  <label className="flex items-center gap-2">
                    <span className="sr-only">Fase del blanco {numero}</span>
                    <select
                      value={estado.fase}
                      onChange={(e) => pedirCambio({ fase: e.target.value as FaseBlanco })}
                      className="rounded border border-divider bg-surface px-2 py-1 text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
                    >
                      {FASES.map((e) => (
                        <option key={e.id} value={e.id}>
                          {e.etiqueta}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              </div>
            ) : null}
            <span
              className={`${edicion ? "hidden print:inline" : "inline"} font-mono text-[10px] uppercase tracking-wide text-ink-muted`}
            >
              {textoDeEstadoBlanco(estado)}
            </span>
          </div>
        </div>

        {pendiente && (
          <div role="alert" className="mt-3 flex flex-wrap items-center gap-2 rounded border-l-[3px] border-warn bg-warn/5 py-1.5 pl-3 pr-2 text-sm print:hidden">
            <span className="font-medium text-warn">▲ Motivo para activarlo:</span>
            <input
              autoFocus
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              aria-label="Motivo para activar el blanco pese a la alerta"
              className="min-w-[12rem] flex-1 rounded border border-divider bg-surface px-2 py-1 text-sm text-ink"
            />
            <button
              type="button"
              disabled={!motivo.trim()}
              onClick={() => { cambiarEstado(pendiente, motivo.trim()); setPendiente(null); setMotivo(""); }}
              className="rounded border border-accent/50 bg-accent-soft px-2.5 py-1 text-xs font-medium text-accent disabled:opacity-50"
            >
              Reconocer
            </button>
            <button type="button" onClick={() => { setPendiente(null); setMotivo(""); }} className="rounded px-2 py-1 text-xs text-ink-muted hover:text-ink">
              Cancelar
            </button>
          </div>
        )}

        {!descartado && blanco && (
          <CadenaBlanco analisis={analisis} indiceBlanco={indiceBlanco} onEditarSeccion={onEditarSeccion} />
        )}

        {descartado ? (
          <p className="mt-3 text-sm text-ink-muted">
            Descartado por ti. El contenido sigue en el informe; cambia el
            estado para volver a verlo aquí.
          </p>
        ) : (
          <>
          {blanco && (
            <button type="button" onClick={() => setVerDetalle(!verDetalle)} aria-expanded={verDetalle} className="mt-3 text-xs text-ink-muted hover:text-ink print:hidden">
              {verDetalle ? "▾ Ocultar detalle" : "▸ Ver detalle"}
            </button>
          )}
          <div className={`mt-4 space-y-3 ${blanco && !verDetalle ? "hidden print:block" : ""}`}>
            {tarjeta.alertasConducta.map((a, i) => (
              <AvisoEnLinea key={i} alerta={a} />
            ))}

            {tarjeta.priorizacion?.justificacion && (
              <Paso titulo="Por qué se prioriza">
                <p className="text-[15px] leading-relaxed text-ink">
                  {tarjeta.priorizacion.justificacion}
                </p>
              </Paso>
            )}

            <Paso titulo="Función hipotetizada">
              {tarjeta.hipotesis.length > 0 ? (
                <ul className="space-y-1.5">
                  {tarjeta.hipotesis.map((h, i) => (
                    <li key={h.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      <span className="text-[15px] leading-relaxed text-ink">
                        {h.funcion || h.enunciado}
                      </span>
                      <Apoyo grado={gradoFuncion[i]} />
                    </li>
                  ))}
                </ul>
              ) : tarjeta.funcionesDeSituacion.length > 0 ? (
                <>
                  {tarjeta.funcionesDeSituacion.map((f) => (
                    <p key={f} className="text-[15px] leading-relaxed text-ink">
                      {f}
                    </p>
                  ))}
                  <p className="mt-1 text-xs text-ink-muted">
                    Tomada del análisis por situaciones: no hay hipótesis de
                    mantenimiento enlazada a esta conducta.
                  </p>
                </>
              ) : (
                <p className="text-sm leading-relaxed text-warn">
                  Sin función hipotetizada para esta conducta. Sin ella no hay
                  base para justificar ninguna intervención: primero hay que
                  explorar qué la mantiene.
                </p>
              )}
            </Paso>

            <Paso titulo="Conducta alternativa">
              {conducta.es_conducta_seguridad ? (
                <p className="text-sm leading-relaxed text-ink-muted">
                  Es una conducta de seguridad: blanco de eliminación, no de
                  prescripción. No lleva conducta alternativa propia.
                </p>
              ) : alternativas.length === 0 ? (
                <p className="text-sm leading-relaxed text-ink-muted">
                  El análisis no propone conducta alternativa para este blanco.
                </p>
              ) : (
                <ul className="space-y-4">
                  {alternativas.map((a) => (
                    <Alternativa
                      key={a.indice}
                      item={a}
                      analisis={analisis}
                      onEditarSeccion={onEditarSeccion}
                    />
                  ))}
                </ul>
              )}
            </Paso>

            <Paso titulo="Intervención propuesta">
              {intervenciones.length === 0 ? (
                <p className={`text-sm leading-relaxed ${sinFuncion ? "text-warn" : "text-ink-muted"}`}>
                  {sinFuncion
                    ? "Información insuficiente para proponer intervención: primero explorar qué mantiene esta conducta."
                    : "El análisis no propone intervención para este blanco."}
                </p>
              ) : (
                <ul className="space-y-4">
                  {intervenciones.map((x) => (
                    <Intervencion
                      key={x.indice}
                      item={x}
                      analisis={analisis}
                      onEditarSeccion={onEditarSeccion}
                    />
                  ))}
                </ul>
              )}
              <BotonAgregar etiqueta="intervención" onAgregar={agregarIntervencion} />
            </Paso>

            {monitorizacion.length === 0 ? (
              <Paso titulo="Monitorización · revisar la hipótesis si…">
                <p className="text-sm leading-relaxed text-ink-muted">
                  Sin monitorización propuesta para este blanco: sin ella no hay
                  forma de saber si su hipótesis se sostiene.
                </p>
              </Paso>
            ) : (
              monitorizacion.map((m) => (
                <Monitorizacion key={m.indice} item={m} onEditarSeccion={onEditarSeccion} enTarjeta />
              ))
            )}
          </div>
          </>
        )}
      </article>
    </li>
  );
}

/**
 * Una intervención con su razón funcional. El porqué es lo que la separa de
 * una etiqueta de tratamiento: «entrenamiento en afrontamiento» no dice sobre
 * qué actúa; «exposición porque el escape se mantiene por alivio inmediato» sí,
 * y es lo que el clínico contrasta con la función de la tarjeta.
 */
function Intervencion({
  item,
  analisis,
  onEditarSeccion,
  sugerencia,
}: {
  item: IntervencionDeBlanco;
  analisis: AnalisisFuncional;
  onEditarSeccion: EditarSeccion;
  sugerencia?: ReactNode;
}) {
  const edicion = useEdicion();
  const [confirmando, setConfirmando] = useState(false);
  const { indice: i, linea, alertas } = item;
  const faltan = datosFaltantesDeIntervencion(analisis, item);
  const otrosAvisos = alertas.filter(
    (a) => a.codigo !== "intervencion_depende_de_dato_faltante" || faltan.length === 0
  );
  const cambiar = (parcial: Partial<LineaIntervencion>) =>
    onEditarSeccion("intervencion", (c) => {
      c.lineas_de_intervencion_tentativas[i] = {
        ...c.lineas_de_intervencion_tentativas[i],
        ...parcial,
      };
    });
  const borrar = () =>
    onEditarSeccion("intervencion", (c) => {
      c.lineas_de_intervencion_tentativas = c.lineas_de_intervencion_tentativas.filter(
        (_, j) => j !== i
      );
    });

  return (
    <li>
      {sugerencia}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          {/*
            Sin intervención: el modelo declaró que no hay base para proponer
            ninguna hasta tener un dato (principio 29). Se dice eso y nada más,
            en vez de un plan completo apoyado en lo que falta.
          */}
          {!linea.intervencion ? (
            <Insuficiente datos={faltan.length > 0 ? faltan : ["qué mantiene esta conducta"]} que="proponer intervención" analisis={analisis} />
          ) : (
            <>
              {faltan.length > 0 && <Insuficiente datos={faltan} que="darla por propuesta" analisis={analisis} />}
              {faltan.length > 0 && (
                <p className="font-mono text-[10px] uppercase tracking-wide text-ink-muted">
                  Propuesta condicional
                </p>
              )}
              <TextoEditable
                valor={linea.intervencion}
                seccionId="intervencion"
                etiqueta="Intervención"
                className={`text-[15px] leading-relaxed ${faltan.length > 0 ? "text-ink-muted" : "text-ink"}`}
                onCambio={(v) => cambiar({ intervencion: v })}
              />
              {linea.porque ? (
                <>
                  <p className="mt-1.5 font-mono text-[10px] uppercase tracking-wide text-ink-muted">
                    Por qué
                  </p>
                  <TextoEditable
                    valor={linea.porque}
                    seccionId="intervencion"
                    etiqueta="Por qué se propone"
                    className="text-sm leading-relaxed text-ink-muted"
                    onCambio={(v) => cambiar({ porque: v })}
                  />
                </>
              ) : (
                <p className="mt-1 text-sm leading-relaxed text-warn">
                  Sin razón declarada: no consta sobre qué función actúa, así
                  que no se puede contrastar con la hipótesis del blanco.
                </p>
              )}
              {linea.contingencia_objetivo && (
                <>
                  <p className="mt-1.5 font-mono text-[10px] uppercase tracking-wide text-ink-muted">
                    Contingencia objetivo
                  </p>
                  <TextoEditable
                    valor={linea.contingencia_objetivo}
                    seccionId="intervencion"
                    etiqueta="Contingencia objetivo"
                    className="text-sm leading-relaxed text-ink-muted"
                    onCambio={(v) => cambiar({ contingencia_objetivo: v.trim() || null })}
                  />
                </>
              )}
              {linea.precauciones && (
                <>
                  <p className="mt-1.5 font-mono text-[10px] uppercase tracking-wide text-warn">
                    Precauciones
                  </p>
                  <TextoEditable
                    valor={linea.precauciones}
                    seccionId="intervencion"
                    etiqueta="Precauciones"
                    className="text-sm leading-relaxed text-ink-muted"
                    onCambio={(v) => cambiar({ precauciones: v.trim() || null })}
                  />
                </>
              )}
            </>
          )}
        </div>
        {edicion && (
          <MenuAcciones
            etiqueta={`intervención: ${linea.intervencion || "sin propuesta"}`}
            acciones={[{ etiqueta: "Borrar esta intervención", onElegir: () => setConfirmando(true) }]}
          />
        )}
      </div>
      {confirmando && (
        <ConfirmarBorrado
          pregunta="¿Borrar esta intervención?"
          onSi={borrar}
          onNo={() => setConfirmando(false)}
        />
      )}
      {otrosAvisos.map((a, j) => (
        <AvisoEnLinea key={j} alerta={a} />
      ))}
    </li>
  );
}

/**
 * Qué se mide y qué desmentiría la hipótesis. El criterio de revisión va
 * aparte y con más peso: es lo que convierte la formulación en una hipótesis
 * con fecha de revisión en lugar de un documento archivado. Cuando falta, se
 * dice — callarlo dejaría el plan con aspecto de completo.
 */
function Monitorizacion({
  item,
  onEditarSeccion,
  enTarjeta = false,
  sugerencia,
}: {
  item: MonitorizacionDeBlanco;
  onEditarSeccion: EditarSeccion;
  enTarjeta?: boolean;
  sugerencia?: ReactNode;
}) {
  const { indice: i, plan } = item;
  const cambiar = (parcial: Partial<PlanDeMonitorizacion>) =>
    onEditarSeccion("monitorizacion", (c) => {
      c.plan_de_monitorizacion[i] = { ...c.plan_de_monitorizacion[i], ...parcial };
    });

  const tabla = (
    <TablaCadena
      filas={[
        { elemento: "Qué se mide", valor: plan.que_se_mide || "—" },
        { elemento: "Con qué", valor: plan.con_que || "—" },
        { elemento: "Cada cuánto", valor: plan.cada_cuanto || "—" },
      ]}
    />
  );
  const criterio = plan.criterio_de_revision ? (
    <TextoEditable
      valor={plan.criterio_de_revision}
      seccionId="monitorizacion"
      etiqueta="Criterio de revisión"
      className="text-[15px] leading-relaxed text-ink"
      onCambio={(v) => cambiar({ criterio_de_revision: v })}
    />
  ) : (
    <p className="text-sm leading-relaxed text-warn">
      Sin criterio de revisión. Mientras no lo haya, nada de lo que se mida
      puede desmentir esta hipótesis: es un documento, no una hipótesis con
      fecha de revisión.
    </p>
  );

  if (enTarjeta) {
    return (
      <>
        <Paso titulo="Monitorización">{tabla}</Paso>
        <Paso titulo="Revisar la hipótesis si…">{criterio}</Paso>
      </>
    );
  }
  return (
    <div className="space-y-3">
      {sugerencia}
      {plan.conducta && (
        <p className="font-mono text-[10px] uppercase tracking-wide text-ink-muted">{plan.conducta}</p>
      )}
      {tabla}
      <div className="rounded-md border border-divider bg-canvas p-4 print:border-black">
        <p className="mb-2 font-mono text-[10px] uppercase tracking-wide text-ink-muted">
          Revisar la hipótesis si… · qué la desmentiría
        </p>
        {criterio}
      </div>
    </div>
  );
}

function Alternativa({
  item,
  analisis,
  onEditarSeccion,
  mostrarSituacion = false,
}: {
  item: AlternativaDeBlanco;
  analisis: AnalisisFuncional;
  onEditarSeccion: EditarSeccion;
  mostrarSituacion?: boolean;
}) {
  const edicion = useEdicion();
  const [confirmandoBorrado, setConfirmandoBorrado] = useState(false);
  const { indice: i, alternativa: c, alertas } = item;
  const faltan = datosFaltantesDe(analisis, alertas);
  // El aviso de dependencia se convierte en el encabezado de la propuesta: no
  // se repite además como aviso suelto debajo.
  const otrosAvisos = alertas.filter(
    (a) => a.codigo !== "intervencion_depende_de_dato_faltante" || faltan.length === 0
  );

  function borrar() {
    onEditarSeccion("conductas-alternativas", (copia) => {
      copia.conductas_alternativas = copia.conductas_alternativas.filter((_, j) => j !== i);
    });
  }

  return (
    <li>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          {mostrarSituacion && (
            <p className="font-mono text-[10px] uppercase tracking-wide text-ink-muted">
              {c.situacion}
            </p>
          )}
          {/*
            Si la propuesta depende de un dato que el informe declara faltante,
            lo primero que se lee es eso. La propuesta no se oculta —el
            validador empareja por palabras y puede equivocarse, y ocultar
            contenido del informe sería decidir por el clínico—, pero deja de
            leerse como plan y pasa a leerse como condicional.
          */}
          {faltan.length > 0 && (
            <Insuficiente datos={faltan} que="darla por propuesta" analisis={analisis} />
          )}
          {faltan.length > 0 && (
            <p className="font-mono text-[10px] uppercase tracking-wide text-ink-muted">
              Propuesta condicional
            </p>
          )}
          <TextoEditable
            valor={c.conducta_propuesta}
            seccionId="conductas-alternativas"
            etiqueta="Conducta propuesta"
            className={`text-[15px] leading-relaxed ${faltan.length > 0 ? "text-ink-muted" : "text-ink"}`}
            onCambio={(v) =>
              onEditarSeccion("conductas-alternativas", (copia) => {
                copia.conductas_alternativas[i] = {
                  ...copia.conductas_alternativas[i],
                  conducta_propuesta: v,
                };
              })
            }
          />
        </div>
        {edicion && (
          <MenuAcciones
            etiqueta={`conducta alternativa: ${c.conducta_propuesta}`}
            acciones={[
              { etiqueta: "Borrar esta propuesta", onElegir: () => setConfirmandoBorrado(true) },
            ]}
          />
        )}
      </div>

      {confirmandoBorrado && (
        <ConfirmarBorrado
          pregunta="¿Borrar esta propuesta?"
          onSi={borrar}
          onNo={() => setConfirmandoBorrado(false)}
        />
      )}

      {otrosAvisos.map((a, j) => (
        <AvisoEnLinea key={j} alerta={a} />
      ))}

      {/*
        Si la conducta propuesta ya figura en el repertorio disponible, el
        trabajo no es enseñarla: es que ocurra también aquí. El emparejamiento
        es aproximado a propósito (ver lib/validadores.ts#yaEnRepertorio), así
        que se presenta como algo que comprobar, no como un hecho del análisis.
      */}
      {yaEnRepertorio(c.conducta_propuesta, analisis.repertorio_disponible) && (
        <p className="mt-2 rounded border border-divider bg-canvas px-3 py-2 text-sm leading-relaxed text-ink-muted print:border-black">
          <span className="font-medium text-ink">Puede que ya esté en su repertorio.</span>{" "}
          Algo parecido figura entre los activos: compruébalo antes de
          plantearlo como adquisición. Si ya la emite en otro contexto, el
          trabajo es de generalización —control de estímulos y contingencias
          del contexto donde no aparece—, no de entrenamiento en habilidades.
        </p>
      )}

      <p className="mt-2 text-sm text-ink-muted">
        <span className="font-medium text-ink">Consecuencia necesaria para mantenerla:</span>
      </p>
      <TextoEditable
        valor={c.consecuencia_necesaria}
        seccionId="conductas-alternativas"
        etiqueta="Consecuencia necesaria"
        className="text-sm text-ink-muted"
        onCambio={(v) =>
          onEditarSeccion("conductas-alternativas", (copia) => {
            copia.conductas_alternativas[i] = {
              ...copia.conductas_alternativas[i],
              consecuencia_necesaria: v,
            };
          })
        }
      />
    </li>
  );
}

function ConfirmarBorrado({
  pregunta,
  onSi,
  onNo,
}: {
  pregunta: string;
  onSi: () => void;
  onNo: () => void;
}) {
  return (
    <p className="mt-1 flex flex-wrap items-center gap-2 text-sm print:hidden">
      <span className="text-ink-muted">{pregunta}</span>
      <button
        type="button"
        onClick={onSi}
        className="rounded border border-divider px-2 py-0.5 text-xs text-ink hover:bg-canvas"
      >
        Sí, borrar
      </button>
      <button
        type="button"
        onClick={onNo}
        className="rounded px-2 py-0.5 text-xs text-ink-muted hover:text-ink"
      >
        No
      </button>
    </p>
  );
}
