"use client";

/**
 * Pestaña 5 · Revisión.
 *
 * Qué no sé y cómo podría estar equivocado: hipótesis alternativas, datos
 * faltantes, avisos del validador y las preguntas que se derivan de ellos. Es
 * el contrapeso, y por eso se lee al final, cuando ya hay una propuesta sobre
 * la mesa.
 */

import type { AnalisisFuncional } from "@/lib/types";
import { BloqueBase, SinHallazgos, SubSeccion } from "./primitivas";
import { BloqueReanalisis, ListaAlertas, ReportarFallo, Seccion } from "./seccion";
import { BotonAgregar, BotonBorrar, TextoEditable } from "../edicionManual";
import {
  INTRO_GRADO_APOYO,
  NIVELES_APOYO,
  NOTA_PIE_GRADO_APOYO,
} from "@/lib/gradoApoyo";

export default function BloquePendientes({
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
    <BloqueBase id="pendientes" visible={visible}>
      <Seccion id="hipotesis-alternativas" titulo="Hipótesis alternativas" camposReanalisis={["hipotesis_alternativas"]}>
        {analisis.hipotesis_alternativas.length === 0 ? (
          <SinHallazgos />
        ) : (
          <ul className="space-y-4">
            {analisis.hipotesis_alternativas.map((h, i) => (
              <li key={i}>
                <span className="flex flex-wrap items-baseline gap-x-2">
                  <TextoEditable
                    valor={h.enunciado}
                    seccionId="hipotesis-alternativas"
                    etiqueta={`Hipótesis alternativa ${i + 1}`}
                    onCambio={(v) =>
                      onEditarSeccion("hipotesis-alternativas", (copia) => {
                        copia.hipotesis_alternativas[i] = {
                          ...copia.hipotesis_alternativas[i],
                          enunciado: v,
                        };
                      })
                    }
                  />
                  <BotonBorrar
                    etiqueta={`hipótesis alternativa ${i + 1}`}
                    onBorrar={() =>
                      onEditarSeccion("hipotesis-alternativas", (copia) => {
                        copia.hipotesis_alternativas =
                          copia.hipotesis_alternativas.filter((_, j) => j !== i);
                      })
                    }
                  />
                </span>
                <p className="mt-1 text-sm text-ink-muted">Cómo descartarla:</p>
                <TextoEditable
                  valor={h.como_descartarla}
                  seccionId="hipotesis-alternativas"
                  etiqueta={`Cómo descartar la hipótesis ${i + 1}`}
                  className="text-sm text-ink-muted"
                  onCambio={(v) =>
                    onEditarSeccion("hipotesis-alternativas", (copia) => {
                      copia.hipotesis_alternativas[i] = {
                        ...copia.hipotesis_alternativas[i],
                        como_descartarla: v,
                      };
                    })
                  }
                />
              </li>
            ))}
          </ul>
        )}
      </Seccion>

      {/*
        Una sola sección para las dos listas: los huecos que el terapeuta
        reconoció al responder "No sé" (más los que el análisis detectó por
        su cuenta) y los avisos del validador. Estaban separadas y
        respondían a la misma pregunta —qué hay que comprobar antes de dar
        esto por bueno—, así que el clínico tenía que acordarse de mirar en
        dos sitios distintos del índice para saber de qué no fiarse.

        Va al final y no arriba: desde que existen las preguntas previas
        (ver components/PreguntasDatosFaltantes.tsx), esto no es una
        advertencia que haya que leer antes que el resto, sino el
        contrapeso que se lee cuando ya hay una propuesta sobre la mesa.
      */}
      {(analisis.datos_faltantes.length > 0 || analisis.alertas.length > 0) && (
        <section id="verificacion" className="scroll-mt-24">
          <div className="mb-3 flex items-center gap-3">
            <span aria-hidden="true" className="h-5 w-1 rounded-full bg-warn" />
            <h2 className="section-title font-serif text-lg font-semibold text-ink sm:text-xl">
              Datos faltantes y puntos a verificar
            </h2>
          </div>
          <p className="mb-5 text-sm text-ink-muted">
            Lo que hay que comprobar antes de dar este informe por bueno: lo
            que quedó sin saber de la nota, y lo que el propio análisis
            puede haber hecho mal.
          </p>

          <div className="space-y-8">
            {analisis.datos_faltantes.length > 0 && (
              <SubSeccion titulo="Datos faltantes">
                <p className="mb-3 text-sm text-ink-muted">
                  Lo que marcaste como &quot;No sé&quot; al empezar, más
                  cualquier otro vacío que el análisis haya detectado por su
                  cuenta. Confírmalo en la próxima sesión.
                </p>
                <ul className="space-y-3">
                  {analisis.datos_faltantes.map((d, i) => (
                    <li key={i}>
                      <span className="flex flex-wrap items-baseline gap-x-2">
                        <TextoEditable
                          valor={d.dato}
                          seccionId="verificacion"
                          etiqueta={`Dato faltante ${i + 1}`}
                          className="text-[15px] leading-relaxed text-ink"
                          onCambio={(v) =>
                            onEditarSeccion("verificacion", (c) => {
                              c.datos_faltantes[i] = {
                                ...c.datos_faltantes[i],
                                dato: v,
                              };
                            })
                          }
                        />
                        <BotonBorrar
                          etiqueta={`dato faltante ${i + 1}`}
                          onBorrar={() =>
                            onEditarSeccion("verificacion", (c) => {
                              c.datos_faltantes = c.datos_faltantes.filter(
                                (_, j) => j !== i
                              );
                            })
                          }
                        />
                      </span>
                      {/*
                        El porqué no es adorno: es lo que distingue un
                        matiz de un bloqueante. Cuando falta se dice, en vez
                        de dejar el hueco pareciendo completo — un informe
                        antiguo o un modelo que no obedeció el esquema
                        llegan aquí sin motivo declarado.
                      */}
                      {d.por_que_importa ? (
                        <TextoEditable
                          valor={d.por_que_importa}
                          seccionId="verificacion"
                          etiqueta={`Por qué importa el dato faltante ${i + 1}`}
                          className="mt-0.5 text-sm leading-relaxed text-ink-muted"
                          onCambio={(v) =>
                            onEditarSeccion("verificacion", (c) => {
                              c.datos_faltantes[i] = {
                                ...c.datos_faltantes[i],
                                por_que_importa: v,
                              };
                            })
                          }
                        />
                      ) : (
                        <p className="mt-0.5 text-sm italic text-ink-muted">
                          Sin motivo declarado: no consta qué parte del
                          análisis queda en el aire sin este dato.
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
                <BotonAgregar
                  etiqueta="dato faltante"
                  onAgregar={(texto) =>
                    onEditarSeccion("verificacion", (c) => {
                      c.datos_faltantes = [
                        ...c.datos_faltantes,
                        { dato: texto, por_que_importa: "" },
                      ];
                    })
                  }
                />
              </SubSeccion>
            )}

            {analisis.alertas.length > 0 && (
              <SubSeccion titulo="Puntos a verificar del análisis">
                <p className="mb-3 text-sm text-ink-muted">
                  Posibles errores o resultados no del todo precisos de la
                  IA, que conviene revisar a mano antes de dar el análisis
                  por bueno.
                </p>
                <ListaAlertas analisis={analisis} />
              </SubSeccion>
            )}
          </div>

          <ReportarFallo seccionId="verificacion" />
          <BloqueReanalisis
            campos={["datos_faltantes", "situaciones"]}
            seccionId="verificacion"
          />
        </section>
      )}

      {/* No usa <Seccion> a propósito: esta tarjeta no sale del análisis,
          así que no tiene nada que reanalizar ni ningún fallo del modelo
          que reportar. Solo necesita el envoltorio reordenable para
          aparecer en el índice y moverse con las demás. */}
      <section id="niveles-confianza" className="scroll-mt-24">
        <div className="mb-3 flex items-center gap-3">
          <span aria-hidden="true" className="h-5 w-1 rounded-full bg-accent" />
          <h2 className="section-title font-serif text-lg font-semibold text-ink sm:text-xl">
            Grado de apoyo en la nota
          </h2>
        </div>
        <p className="text-sm leading-relaxed text-ink-muted">
          {INTRO_GRADO_APOYO}
        </p>
        <ul className="mt-4 space-y-2">
          {NIVELES_APOYO.map(({ grado, etiqueta, clase, variable, frase, resto }) => (
            <li
              key={grado}
              style={{ borderLeft: `3px solid ${variable}` }}
              className="rounded-sm bg-canvas px-4 py-3"
            >
              {/* Dos columnas en pantalla ancha; apiladas en cuanto no
                  caben, que en un móvil es siempre. */}
              <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:gap-4">
                <p className="flex shrink-0 items-baseline gap-2 sm:w-32">
                  <span
                    aria-hidden="true"
                    className={`h-2 w-2 shrink-0 translate-y-[-1px] rounded-full ${clase}`}
                  />
                  <span className="text-sm font-semibold text-ink">{etiqueta}</span>
                </p>
                <p className="text-sm leading-relaxed text-ink-muted">
                  <span className="font-semibold text-ink">{frase}</span> {resto}
                </p>
              </div>
            </li>
          ))}
        </ul>
        <p className="mt-4 border-t border-divider pt-3 text-sm leading-relaxed text-ink-muted">
          {NOTA_PIE_GRADO_APOYO}
        </p>
      </section>
    </BloqueBase>
  );
}
