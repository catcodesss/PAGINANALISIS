"use client";

/**
 * Bloque 4 · Plan.
 *
 * Conductas alternativas, líneas de intervención y plan de monitorización: qué
 * se hace, y qué habría que observar para concluir que la formulación estaba
 * equivocada.
 */

import type { AnalisisFuncional } from "@/lib/types";
import { BloqueBase, ListaEditable, SinHallazgos, TablaCadena } from "./primitivas";
import { Seccion } from "./seccion";
import { BotonBorrar, TextoEditable } from "../edicionManual";
import { yaEnRepertorio } from "@/lib/validadores";

export default function BloquePlan({
  visible,
  analisis,
  onEditarSeccion,
}: {
  visible: boolean;
  analisis: AnalisisFuncional;
  onEditarSeccion: (
    seccionId: string,
    mutar: (copia: AnalisisFuncional) => void
  ) => void;
}) {
  return (
    <BloqueBase id="plan" visible={visible}>
      <Seccion
        id="conductas-alternativas"
        titulo="Conductas alternativas propuestas"
        camposReanalisis={["conductas_alternativas"]}
      >
        {analisis.conductas_alternativas.length === 0 ? (
          <SinHallazgos />
        ) : (
          <ul className="space-y-4">
            {analisis.conductas_alternativas.map((c, i) => (
              <li key={i} className="rounded border border-divider p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-mono text-xs uppercase tracking-wide text-ink-muted">
                    {c.situacion}
                  </p>
                  <BotonBorrar
                    etiqueta={`conducta alternativa: ${c.conducta_propuesta}`}
                    onBorrar={() =>
                      onEditarSeccion("conductas-alternativas", (copia) => {
                        copia.conductas_alternativas =
                          copia.conductas_alternativas.filter((_, j) => j !== i);
                      })
                    }
                  />
                </div>
                <TextoEditable
                  valor={c.conducta_propuesta}
                  seccionId="conductas-alternativas"
                  etiqueta="Conducta propuesta"
                  className="mt-1 text-[15px] leading-relaxed text-ink"
                  onCambio={(v) =>
                    onEditarSeccion("conductas-alternativas", (copia) => {
                      copia.conductas_alternativas[i] = {
                        ...copia.conductas_alternativas[i],
                        conducta_propuesta: v,
                      };
                    })
                  }
                />
                {/*
                  Si la conducta propuesta ya figura en el repertorio
                  disponible, el trabajo no es enseñarla: es que ocurra
                  también aquí. Enseñar lo que la persona ya sabe hacer
                  gasta sesiones en un entrenamiento innecesario y deja sin
                  tocar el contexto, que es donde está el problema. El
                  emparejamiento es aproximado a propósito (ver
                  lib/validadores.ts#yaEnRepertorio), así que se presenta
                  como algo que comprobar, no como un hecho del análisis.
                */}
                {yaEnRepertorio(
                  c.conducta_propuesta,
                  analisis.repertorio_disponible
                ) && (
                  <p className="mt-2 rounded border border-divider bg-canvas px-3 py-2 text-sm leading-relaxed text-ink-muted print:border-black">
                    <span className="font-medium text-ink">
                      Puede que ya esté en su repertorio.
                    </span>{" "}
                    Algo parecido figura entre los activos: compruébalo
                    antes de plantearlo como adquisición. Si ya la emite en
                    otro contexto, el trabajo es de generalización —control
                    de estímulos y contingencias del contexto donde no
                    aparece—, no de entrenamiento en habilidades.
                  </p>
                )}
                <p className="mt-1 text-sm text-ink-muted">
                  <span className="font-medium text-ink">
                    Consecuencia necesaria para mantenerla:
                  </span>{" "}
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
            ))}
          </ul>
        )}
      </Seccion>

      <Seccion
        id="intervencion"
        titulo="Líneas de intervención tentativas"
        camposReanalisis={["lineas_de_intervencion_tentativas"]}
      >
        <ListaEditable
          items={analisis.lineas_de_intervencion_tentativas}
          seccionId="intervencion"
          etiqueta="línea de intervención"
          onCambiar={(nuevos) =>
            onEditarSeccion("intervencion", (c) => {
              c.lineas_de_intervencion_tentativas = nuevos;
            })
          }
        />
      </Seccion>

      <Seccion
        id="monitorizacion"
        titulo="Plan de monitorización"
        camposReanalisis={["plan_de_monitorizacion"]}
      >
        {analisis.plan_de_monitorizacion ? (
          <div className="space-y-5">
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
              campos de arriba, no como una cuarta fila de la tabla: es el
              que convierte la formulación en una hipótesis con fecha de
              revisión en lugar de un documento archivado. Cuando falta, se
              dice — callarlo dejaría el plan con aspecto de completo.
            */}
            <div className="rounded-md border border-divider bg-canvas p-4 print:border-black">
              <p className="font-mono text-[10px] uppercase tracking-wide text-ink-muted">
                Criterio de revisión · qué desmentiría esta formulación
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
