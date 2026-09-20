"use client";

/**
 * Bloque 1 · Cabecera: riesgo y síntesis.
 *
 * Lo que obliga a actuar hoy, de quién hablamos y la formulación que manda. El
 * destacado no repite la conducta en su rótulo ni arrastra la priorización: la
 * primera la nombra el enunciado derivado y la segunda vive en el bloque 3.
 */

import type { AnalisisFuncional, HipotesisMantenimiento } from "@/lib/types";
import { BloqueBase, ChipDestacado, Confianza, ListaEditable, SinHallazgos } from "./primitivas";
import { BloqueReanalisis, ReportarFallo, Seccion } from "./seccion";
import { TextoEditable } from "../edicionManual";

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
  const hipotesisDestacada = destacada;
  return (
    <BloqueBase id="sintesis" visible={visible}>
      {/* Riesgo: lo primero de fábrica, por su relevancia de seguridad clínica. */}
      <section id="riesgo" className="scroll-mt-24">
        <div className="mb-3 flex items-center gap-3">
          <span aria-hidden="true" className="h-5 w-1 rounded-full bg-warn" />
          <h2 className="section-title font-serif text-lg font-semibold text-ink sm:text-xl">
            Riesgo
          </h2>
        </div>
        {!analisis.riesgo.evaluado ? (
          <p className="text-sm text-ink-muted">
            No se ha evaluado el riesgo en esta nota: falta información para
            pronunciarse sobre escalada de consumo, ideación, riesgo laboral o
            legal, menores implicados u otros indicadores.
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
                Sin indicadores de riesgo detectados en la nota.
              </p>
            }
          />
        )}
        <ReportarFallo seccionId="riesgo" />
        <BloqueReanalisis campos={["riesgo"]} seccionId="riesgo" />
      </section>

      <Seccion id="resumen" titulo="Resumen clínico" camposReanalisis={["resumen_clinico"]}>
        {resumen ? (
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
        ) : (
          <SinHallazgos />
        )}
      </Seccion>

      {/*
        Formulación funcional destacada — el titular del informe. El verde
        va en la tarjeta entera (prop `destacado` de BloqueOrdenable), no
        en una caja aparte metida dentro de una blanca: esa doble caja
        dejaba un marco blanco visible alrededor del color.
      */}
      <section id="hipotesis-principal" className="scroll-mt-24">
        {hipotesisDestacada && hipotesisDestacada.enunciado ? (
          <div className="formulacion-destacada">
            {/*
              El rótulo ya no repite la conducta. El enunciado de abajo la
              nombra entera, así que ponerla también aquí escribía el mismo
              dato dos veces en la misma tarjeta — y era, junto con la
              priorización, la razón de que «evitar exponer» apareciera tres
              veces en un bloque que solo tiene una idea.
            */}
            <p className="font-mono text-[11px] uppercase tracking-[0.15em] text-accent">
              Formulación funcional destacada
            </p>
            <p className="mt-3 font-serif text-[21px] leading-relaxed text-ink">
              {hipotesisDestacada.enunciado}
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              {hipotesisDestacada.funcion && (
                <ChipDestacado>{hipotesisDestacada.funcion}</ChipDestacado>
              )}
              <Confianza nivel={hipotesisDestacada.confianza} />
            </div>
            {/*
              La priorización de blancos vive en «Formulación del caso», que
              es su sitio, y no se repite aquí. Estaba en los dos, y el
              destacado es un resaltado de una sola idea: la formulación que
              manda. Un ranking completo debajo lo convertía en un segundo
              índice del bloque 3, con los mismos blancos escritos otra vez.
            */}
            <a
              href="#resumen"
              className="mt-5 inline-block text-sm text-ink-muted underline decoration-divider underline-offset-4 transition-colors hover:text-accent print:hidden"
            >
              Ver análisis completo ↓
            </a>
          </div>
        ) : (
          <SinHallazgos />
        )}
      </section>
    </BloqueBase>
  );
}
