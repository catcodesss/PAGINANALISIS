"use client";

/**
 * Bloque 4 · Plan.
 *
 * Una tarjeta por blanco clínico, con la misma secuencia en todas: blanco →
 * función → conducta alternativa → avisos. Antes eran tres listas por tipo de
 * contenido y el terapeuta tenía que reconstruir de cabeza qué iba con qué; ver
 * lib/plan.ts para cómo se hacen las conexiones (por id, nunca por prosa).
 *
 * Los avisos del validador van DENTRO de la tarjeta, junto a la propuesta que
 * señalan. Una propuesta problemática no puede leerse primero como
 * recomendación normal y, una pestaña después, como error. Siguen también en
 * Revisión, que es la lista completa: aquí se muestran, no se mueven.
 *
 * Intervenciones y monitorización quedan debajo, comunes al caso, porque el
 * esquema todavía no dice a qué blanco pertenecen. Se rotulan así en vez de
 * repartirlas por parecido de palabras.
 */

import { useMemo, useState } from "react";
import type { Alerta, AnalisisFuncional, EstadoPlan } from "@/lib/types";
import { construirNodosGrafo } from "@/lib/grafo";
import { gradoDeHipotesis, traducirMensajeAlerta } from "@/lib/gradoApoyo";
import {
  alertasDeRuta,
  construirPlanPorBlanco,
  datosFaltantesDe,
  enumerarDatosFaltantes,
  estadoDeBlanco,
  ESTADOS_PLAN,
  ETIQUETA_ESTADO_PLAN,
  type AlternativaDeBlanco,
  type TarjetaBlanco,
} from "@/lib/plan";
import { yaEnRepertorio } from "@/lib/validadores";
import { Apoyo, BloqueBase, MenuAcciones, SinHallazgos, TablaCadena } from "./primitivas";
import { Seccion } from "./seccion";
import { irAlAncla, usePestanas } from "./pestanas";
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
  const orden = usePestanas();

  const irA = (ancla: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    irAlAncla(orden, ancla);
  };

  return (
    <BloqueBase id="plan" visible={visible}>
      <Seccion
        id="conductas-alternativas"
        titulo="Plan por blanco"
        camposReanalisis={["conductas_alternativas"]}
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
                irA={irA}
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
              Su situación no se pudo enlazar con ninguna conducta problema, así
              que no se colocan en una tarjeta: asignarlas por parecido sería
              afirmar una relación que el análisis no traza.
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
        titulo="Líneas de intervención sin asignar"
        camposReanalisis={["lineas_de_intervencion_tentativas"]}
      >
        <p className="mb-3 text-sm leading-relaxed text-ink-muted">
          Todavía no indican a qué blanco se dirigen ni por qué, así que no se
          reparten entre las tarjetas de arriba. Léelas contra la función de
          cada blanco antes de adoptarlas.
        </p>
        <ListaIntervenciones analisis={analisis} onEditarSeccion={onEditarSeccion} />
      </Seccion>

      <Seccion
        id="monitorizacion"
        titulo="Monitorización del caso"
        camposReanalisis={["plan_de_monitorizacion"]}
      >
        {analisis.plan_de_monitorizacion ? (
          <div className="space-y-5">
            <p className="text-sm leading-relaxed text-ink-muted">
              Una sola para todo el caso: el análisis aún no la separa por
              blanco. Si mezcla indicadores de blancos distintos, conviene
              registrarlos por separado.
            </p>
            <TablaCadena
              filas={[
                {
                  elemento: "Qué se mide",
                  valor: analisis.plan_de_monitorizacion.que_se_mide || "—",
                },
                {
                  elemento: "Con qué",
                  valor: analisis.plan_de_monitorizacion.con_que || "—",
                },
                {
                  elemento: "Cada cuánto",
                  valor: analisis.plan_de_monitorizacion.cada_cuanto || "—",
                },
              ]}
            />
            {/*
              El criterio de revisión va aparte y con más peso que los tres
              campos de arriba: es el que convierte la formulación en una
              hipótesis con fecha de revisión en lugar de un documento
              archivado. Cuando falta, se dice — callarlo dejaría el plan con
              aspecto de completo.
            */}
            <div className="rounded-md border border-divider bg-canvas p-4 print:border-black">
              <p className="font-mono text-[10px] uppercase tracking-wide text-ink-muted">
                Revisar la hipótesis si… · qué desmentiría esta formulación
              </p>
              {analisis.plan_de_monitorizacion.criterio_de_revision ? (
                <TextoEditable
                  valor={analisis.plan_de_monitorizacion.criterio_de_revision}
                  seccionId="monitorizacion"
                  etiqueta="Criterio de revisión"
                  className="mt-2 text-[15px] leading-relaxed text-ink"
                  onCambio={(v) =>
                    onEditarSeccion("monitorizacion", (c) => {
                      if (!c.plan_de_monitorizacion) return;
                      c.plan_de_monitorizacion = {
                        ...c.plan_de_monitorizacion,
                        criterio_de_revision: v,
                      };
                    })
                  }
                />
              ) : (
                <p className="mt-2 text-sm leading-relaxed text-warn">
                  Sin criterio de revisión. Mientras no lo haya, nada de lo
                  que se mida puede desmentir esta formulación: es un
                  documento, no una hipótesis con fecha de revisión.
                </p>
              )}
            </div>
          </div>
        ) : (
          <p className="text-sm leading-relaxed text-ink-muted">
            La nota no daba base para proponer un plan de medición. Conviene
            definir uno antes de aplicar el plan de intervención: sin él no
            hay forma de saber si esta formulación se sostiene.
          </p>
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

function TarjetaDeBlanco({
  numero,
  tarjeta,
  analisis,
  gradoFuncion,
  onEditarSeccion,
  irA,
}: {
  numero: number;
  tarjeta: TarjetaBlanco;
  analisis: AnalisisFuncional;
  gradoFuncion: ReturnType<typeof gradoDeHipotesis>[];
  onEditarSeccion: EditarSeccion;
  irA: (ancla: string) => (e: React.MouseEvent) => void;
}) {
  const edicion = useEdicion();
  const { conducta, alternativas } = tarjeta;
  const avisos = [...tarjeta.alertasConducta, ...alternativas.flatMap((a) => a.alertas)];
  const estado = estadoDeBlanco(analisis, conducta.id, avisos.length > 0);
  const descartado = estado === "descartado";

  // Cambiar el estado es una decisión sobre la propuesta, no texto escrito a
  // mano: por eso va con `null` y no marca la sección como editada.
  function cambiarEstado(nuevo: EstadoPlan) {
    onEditarSeccion(null, (c) => {
      c.estados_plan = { ...c.estados_plan, [conducta.id]: nuevo };
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

            {/*
              Lo que el esquema aún no ata a este blanco se nombra en la
              tarjeta —la secuencia tiene que leerse entera— pero se remite a
              su sitio en vez de copiarlo aquí.
            */}
            <Paso titulo="Intervención · monitorización · revisar si…">
              <p className="text-sm leading-relaxed text-ink-muted">
                Aún comunes a todo el caso: ver{" "}
                <a
                  href="#intervencion"
                  onClick={irA("intervencion")}
                  className="text-accent underline underline-offset-2 print:no-underline"
                >
                  líneas de intervención
                </a>{" "}
                y{" "}
                <a
                  href="#monitorizacion"
                  onClick={irA("monitorizacion")}
                  className="text-accent underline underline-offset-2 print:no-underline"
                >
                  monitorización
                </a>
                .
              </p>
            </Paso>
          </div>
        )}
      </article>
    </li>
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

/**
 * Las líneas de intervención, cada una con sus avisos justo debajo.
 * ListaEditable no sabe de rutas, por eso esta lista es propia.
 */
function ListaIntervenciones({
  analisis,
  onEditarSeccion,
}: {
  analisis: AnalisisFuncional;
  onEditarSeccion: EditarSeccion;
}) {
  const lineas = analisis.lineas_de_intervencion_tentativas;
  const cambiar = (nuevos: string[]) =>
    onEditarSeccion("intervencion", (c) => {
      c.lineas_de_intervencion_tentativas = nuevos;
    });

  return (
    <>
      {lineas.length === 0 ? (
        <SinHallazgos />
      ) : (
        <ul className="list-disc space-y-3 pl-5">
          {lineas.map((texto, i) => (
            <LineaIntervencion
              key={i}
              texto={texto}
              numero={i + 1}
              alertas={alertasDeRuta(analisis.alertas, `lineas_de_intervencion_tentativas[${i}]`)}
              onCambio={(v) => cambiar(lineas.map((l, j) => (j === i ? v : l)))}
              onBorrar={() => cambiar(lineas.filter((_, j) => j !== i))}
            />
          ))}
        </ul>
      )}
      <BotonAgregar etiqueta="línea de intervención" onAgregar={(t) => cambiar([...lineas, t])} />
    </>
  );
}

function LineaIntervencion({
  texto,
  numero,
  alertas,
  onCambio,
  onBorrar,
}: {
  texto: string;
  numero: number;
  alertas: Alerta[];
  onCambio: (v: string) => void;
  onBorrar: () => void;
}) {
  const edicion = useEdicion();
  const [confirmando, setConfirmando] = useState(false);
  return (
    <li>
      <div className="flex items-start justify-between gap-2">
        <TextoEditable
          valor={texto}
          seccionId="intervencion"
          etiqueta={`línea de intervención ${numero}`}
          className="min-w-0 flex-1 text-[15px] leading-relaxed text-ink"
          onCambio={onCambio}
        />
        {edicion && (
          <MenuAcciones
            etiqueta={`línea de intervención ${numero}`}
            acciones={[{ etiqueta: "Borrar esta línea", onElegir: () => setConfirmando(true) }]}
          />
        )}
      </div>
      {confirmando && (
        <ConfirmarBorrado
          pregunta="¿Borrar esta línea?"
          onSi={onBorrar}
          onNo={() => setConfirmando(false)}
        />
      )}
      {alertas.map((a, j) => (
        <AvisoEnLinea key={j} alerta={a} />
      ))}
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
