"use client";

/**
 * Pestaña 1 · Resumen.
 *
 * Lo que el terapeuta necesita antes de entrar al detalle: si hay riesgo, cuál
 * es la formulación que manda, por dónde empezar y qué preguntar en la próxima
 * sesión. El resumen clínico en prosa queda plegado debajo: describe el caso,
 * pero no decide nada que las cuatro piezas de arriba no digan ya.
 */

import { useMemo } from "react";
import type { AnalisisFuncional, HipotesisMantenimiento } from "@/lib/types";
import { construirNodosGrafo } from "@/lib/grafo";
import { gradoDeHipotesis } from "@/lib/gradoApoyo";
import { priorizarBlancos } from "@/lib/priorizacion";
import {
  Apoyo,
  BloqueBase,
  ChipDestacado,
  ListaEditable,
  Plegable,
  SinHallazgos,
  Termino,
} from "./primitivas";
import { Seccion, useAccionesSeccion } from "./seccion";
import { irAlAncla, usePestanas } from "./pestanas";
import { TextoEditable } from "../edicionManual";

/** Cuántas prioridades caben en el resumen. El resto vive en Formulación. */
const PRIORIDADES_EN_RESUMEN = 3;

export default function BloqueSintesis({
  visible,
  analisis,
  destacada,
  resumen,
  onEditarSeccion,
}: {
  visible: boolean;
  analisis: AnalisisFuncional;
  destacada: HipotesisMantenimiento | null;
  resumen: string;
  onEditarSeccion: (
    seccionId: string,
    mutar: (copia: AnalisisFuncional) => void
  ) => void;
}) {
  const pestanas = usePestanas();
  const accionesRiesgo = useAccionesSeccion("riesgo", "Riesgo", ["riesgo"]);
  const nodos = useMemo(() => construirNodosGrafo(analisis), [analisis]);
  const prioridades = useMemo(
    () => priorizarBlancos(analisis).slice(0, PRIORIDADES_EN_RESUMEN),
    [analisis]
  );

  return (
    <BloqueBase id="sintesis" visible={visible}>
      {/* Riesgo: lo primero, por su relevancia de seguridad clínica. */}
      <section id="riesgo" className="scroll-mt-24">
        <div className="mb-3 flex items-center gap-3">
          <span aria-hidden="true" className="h-5 w-1 rounded-full bg-warn" />
          <h2 className="section-title font-serif text-lg font-semibold text-ink sm:text-xl">
            Riesgo
          </h2>
          <span className="ml-auto">{accionesRiesgo.menu}</span>
        </div>
        {!analisis.riesgo.evaluado ? (
          <p className="text-sm text-ink-muted">
            La nota no da base para valorar el riesgo: no dice nada sobre
            consumo, ideación, riesgo laboral o legal, menores implicados u
            otros indicadores. No significa que no lo haya.
          </p>
        ) : (
          <ListaEditable
            items={analisis.riesgo.indicadores}
            seccionId="riesgo"
            etiqueta="indicador de riesgo"
            onCambiar={(nuevos) =>
              onEditarSeccion("riesgo", (c) => {
                c.riesgo = { ...c.riesgo, indicadores: nuevos };
              })
            }
            vacio={
              <p className="text-sm text-ink-muted">
                La nota no recoge indicadores de riesgo.
              </p>
            }
          />
        )}
        {accionesRiesgo.panel}
      </section>

      {/*
        La formulación que manda. Se escribe en prosa clara cuando el análisis
        la trae; los análisis que no la traen (todos los anteriores a que el
        prompt la pida) enseñan la versión técnica, que es la que hay, en vez
        de fallar o inventar una traducción.
      */}
      <section id="hipotesis-principal" className="scroll-mt-24">
        {destacada && destacada.enunciado ? (
          <div className="formulacion-destacada">
            <p className="font-mono text-[11px] uppercase tracking-[0.15em] text-accent">
              Formulación principal
            </p>
            <p className="mt-3 font-serif text-[21px] leading-relaxed text-ink">
              {destacada.enunciado}
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              {destacada.funcion && (
                <span className="flex flex-wrap items-center gap-2 text-sm text-ink-muted">
                  <Termino id="funcion" />
                  <ChipDestacado>{destacada.funcion}</ChipDestacado>
                </span>
              )}
              <Apoyo grado={gradoDeHipotesis(destacada, nodos)} />
            </div>
            <a
              href="#hipotesis-mantenimiento"
              onClick={(e) => {
                e.preventDefault();
                irAlAncla(pestanas, "hipotesis-mantenimiento");
              }}
              className="mt-5 inline-block text-sm text-ink-muted underline decoration-divider underline-offset-4 transition-colors hover:text-accent print:hidden"
            >
              Ver todas las hipótesis en Formulación →
            </a>
          </div>
        ) : (
          <SinHallazgos />
        )}
      </section>

      {/*
        Tres, sin números ni barras: el orden sale de la priorización de la
        pestaña Formulación, que es donde se ven los cuatro criterios. Aquí
        solo se dice por dónde empezar.
      */}
      <Seccion id="prioridades" titulo="Tres prioridades">
        {prioridades.length === 0 ? (
          <SinHallazgos />
        ) : (
          <>
            <ol className="list-decimal space-y-2 pl-5">
              {prioridades.map((p) => (
                <li key={p.id} className="text-[15px] leading-relaxed text-ink">
                  {p.etiqueta}
                </li>
              ))}
            </ol>
            <a
              href="#formulacion"
              onClick={(e) => {
                e.preventDefault();
                irAlAncla(pestanas, "formulacion");
              }}
              className="mt-3 block w-fit text-sm text-ink-muted underline decoration-divider underline-offset-4 transition-colors hover:text-accent print:hidden"
            >
              Ver por qué, criterio a criterio →
            </a>
          </>
        )}
      </Seccion>

      <Seccion
        id="preguntas"
        titulo="Preguntas para la próxima sesión"
        camposReanalisis={["preguntas_para_sesion"]}
      >
        <ListaEditable
          items={analisis.preguntas_para_sesion}
          seccionId="preguntas"
          etiqueta="pregunta"
          onCambiar={(nuevos) =>
            onEditarSeccion("preguntas", (c) => {
              c.preguntas_para_sesion = nuevos;
            })
          }
        />
      </Seccion>

      <Seccion id="resumen" titulo="Resumen clínico" camposReanalisis={["resumen_clinico"]}>
        {resumen ? (
          <Plegable titulo="Ver resumen clínico">
            <TextoEditable
              valor={resumen}
              seccionId="resumen"
              etiqueta="Resumen clínico"
              onCambio={(v) =>
                onEditarSeccion("resumen", (c) => {
                  c.resumen_clinico = v;
                })
              }
            />
          </Plegable>
        ) : (
          <SinHallazgos />
        )}
      </Seccion>
    </BloqueBase>
  );
}
