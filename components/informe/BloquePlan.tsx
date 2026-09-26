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

import { useMemo, useState } from "react";
import type {
  Alerta,
  AnalisisFuncional,
  EstadoPlan,
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
  enumerarDatosFaltantes,
  estadoDeBlanco,
  ESTADOS_PLAN,
  ETIQUETA_ESTADO_PLAN,
  type AlternativaDeBlanco,
  type IntervencionDeBlanco,
  type MonitorizacionDeBlanco,
  type TarjetaBlanco,
} from "@/lib/plan";
import { yaEnRepertorio } from "@/lib/validadores";
import { Apoyo, BloqueBase, MenuAcciones, TablaCadena } from "./primitivas";
import { Seccion } from "./seccion";
import { BotonAgregar, TextoEditable, useEdicion } from "../edicionManual";

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
  const plan = useMemo(() => construirPlanPorBlanco(analisis), [analisis]);
  const nodos = useMemo(() => construirNodosGrafo(analisis), [analisis]);

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
                tarjeta={t}
                analisis={analisis}
                gradoFuncion={t.hipotesis.map((h) => gradoDeHipotesis(h, nodos))}
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
                />
              ))}
            </div>
          </>
        )}
      </Seccion>
    </BloqueBase>
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
function Insuficiente({ datos, que }: { datos: string[]; que: string }) {
  return (
    <p className="mb-1.5 rounded border-l-[3px] border-warn bg-warn/5 py-1.5 pl-3 pr-2 text-sm leading-relaxed text-ink">
      <span className="font-medium text-warn">Información insuficiente para {que}.</span>{" "}
      Primero explorar: {enumerarDatosFaltantes(datos)}
    </p>
  );
}

function TarjetaDeBlanco({
  numero,
  tarjeta,
  analisis,
  gradoFuncion,
  onEditarSeccion,
}: {
  numero: number;
  tarjeta: TarjetaBlanco;
  analisis: AnalisisFuncional;
  gradoFuncion: ReturnType<typeof gradoDeHipotesis>[];
  onEditarSeccion: EditarSeccion;
}) {
  const edicion = useEdicion();
  const { conducta, alternativas, intervenciones, monitorizacion } = tarjeta;
  const avisos = avisosDeTarjeta(tarjeta);
  const estado = estadoDeBlanco(analisis, conducta.id, avisos.length > 0);
  const descartado = estado === "descartado";
  const sinFuncion =
    tarjeta.hipotesis.length === 0 && tarjeta.funcionesDeSituacion.length === 0;

  // Cambiar el estado es una decisión sobre la propuesta, no texto escrito a
  // mano: por eso va con `null` y no marca la sección como editada.
  function cambiarEstado(nuevo: EstadoPlan) {
    onEditarSeccion(null, (c) => {
      c.estados_plan = { ...c.estados_plan, [conducta.id]: nuevo };
    });
  }

  // Lo que el clínico añade desde la tarjeta nace ya enlazado a este blanco.
  function agregarIntervencion(texto: string) {
    onEditarSeccion("intervencion", (c) => {
      c.lineas_de_intervencion_tentativas = [
        ...c.lineas_de_intervencion_tentativas,
        {
          conducta: conducta.descripcion,
          conducta_id: conducta.id,
          intervencion: texto,
          porque: "",
          depende_de: null,
        },
      ];
    });
  }

  return (
    <li>
      <article
        aria-labelledby={`blanco-${conducta.id}`}
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
              {avisos.length > 0 && (estado === "propuesto" || estado === "revisar") && (
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
              <label className="flex items-center gap-2 print:hidden">
                <span className="sr-only">Estado del blanco {numero}</span>
                <select
                  value={estado}
                  onChange={(e) => cambiarEstado(e.target.value as EstadoPlan)}
                  className="rounded border border-divider bg-surface px-2 py-1 text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
                >
                  {ESTADOS_PLAN.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.etiqueta}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <span
              className={`${edicion ? "hidden print:inline" : "inline"} font-mono text-[10px] uppercase tracking-wide text-ink-muted`}
            >
              {ETIQUETA_ESTADO_PLAN[estado]}
            </span>
          </div>
        </div>

        {descartado ? (
          <p className="mt-3 text-sm text-ink-muted">
            Descartado por ti. El contenido sigue en el informe; cambia el
            estado para volver a verlo aquí.
          </p>
        ) : (
          <div className="mt-4 space-y-3">
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
}: {
  item: IntervencionDeBlanco;
  analisis: AnalisisFuncional;
  onEditarSeccion: EditarSeccion;
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
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          {/*
            Sin intervención: el modelo declaró que no hay base para proponer
            ninguna hasta tener un dato (principio 29). Se dice eso y nada más,
            en vez de un plan completo apoyado en lo que falta.
          */}
          {!linea.intervencion ? (
            <Insuficiente datos={faltan.length > 0 ? faltan : ["qué mantiene esta conducta"]} que="proponer intervención" />
          ) : (
            <>
              {faltan.length > 0 && <Insuficiente datos={faltan} que="darla por propuesta" />}
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
}: {
  item: MonitorizacionDeBlanco;
  onEditarSeccion: EditarSeccion;
  enTarjeta?: boolean;
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
            <p className="mb-1.5 rounded border-l-[3px] border-warn bg-warn/5 py-1.5 pl-3 pr-2 text-sm leading-relaxed text-ink">
              <span className="font-medium text-warn">
                Información insuficiente para darla por propuesta.
              </span>{" "}
              Primero explorar: {enumerarDatosFaltantes(faltan)}
            </p>
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
