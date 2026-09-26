"use client";

/**
 * Pestaña 3 · Formulación.
 *
 * Las hipótesis de mantenimiento, el origen, las relaciones entre problemas,
 * la priorización, las fortalezas y los valores. La prosa
 * de las hipótesis llega ya derivada del grafo: aquí no se vuelve a calcular,
 * porque dos derivaciones de lo mismo acaban diciendo cosas distintas.
 */

import { useMemo } from "react";
import type { AnalisisFuncional, HipotesisMantenimiento } from "@/lib/types";
import { construirNodosGrafo } from "@/lib/grafo";
import { gradoDeHipotesis, verboRelacion } from "@/lib/gradoApoyo";
import { Apoyo, BloqueBase, Chip, ListaEditable, SinHallazgos, SubSeccion, Termino } from "./primitivas";
import { Seccion } from "./seccion";
import { TextoEditable } from "../edicionManual";
import { PriorizacionEstimada, RedFuncionalSVG, SelloNoModificable } from "./mantenimiento";

export default function BloqueMantenimiento({
  visible,
  analisis,
  analisisConProsa,
  hipotesis,
  onEditarSeccion,
}: {
  visible: boolean;
  analisis: AnalisisFuncional;
  analisisConProsa: AnalisisFuncional;
  hipotesis: HipotesisMantenimiento[];
  onEditarSeccion: (
    seccionId: string,
    mutar: (copia: AnalisisFuncional) => void
  ) => void;
}) {
  const prosaDerivada = { hipotesis };
  const nodos = useMemo(() => construirNodosGrafo(analisis), [analisis]);
  return (
    <BloqueBase id="mantenimiento" visible={visible}>
      <Seccion
        id="hipotesis-mantenimiento"
        titulo="Hipótesis de mantenimiento"
        camposReanalisis={["hipotesis_mantenimiento"]}
      >
        {prosaDerivada.hipotesis.length === 0 ? (
          <SinHallazgos />
        ) : (
          <ul className="space-y-4">
            {prosaDerivada.hipotesis.map((h, i) => (
              <li key={i} className="hipotesis-card rounded border border-divider p-4">
                {/*
                  Sin rótulo con la conducta encima: el enunciado derivado
                  la nombra dentro («…se observa «X»…»), y tenerla también
                  aquí escribía el mismo dato dos veces por tarjeta. Con
                  cinco hipótesis sobre la misma conducta eso eran cinco
                  repeticiones que no añadían nada.
                */}
                <TextoEditable
                  valor={h.enunciado}
                  seccionId="hipotesis-mantenimiento"
                  etiqueta={`Hipótesis de mantenimiento ${i + 1}`}
                  className="mt-1 text-[15px] leading-relaxed text-ink"
                  onCambio={(v) =>
                    onEditarSeccion("hipotesis-mantenimiento", (copia) => {
                      copia.hipotesis_mantenimiento[i] = {
                        ...copia.hipotesis_mantenimiento[i],
                        enunciado: v,
                      };
                    })
                  }
                />
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  {h.funcion && (
                    <span className="flex flex-wrap items-center gap-2 text-sm text-ink-muted">
                      <Termino id="funcion" soloClaro />
                      <Chip>{h.funcion}</Chip>
                    </span>
                  )}
                  <Apoyo grado={gradoDeHipotesis(h, nodos)} />
                </div>
                {/*
                  La relación en dos verbos, «influye en» o «se relaciona
                  con». Causal / moderadora / mediadora y la fuerza se siguen
                  guardando, pero en pantalla sugerían un análisis de mediación
                  que nadie hizo (ver lib/gradoApoyo.ts#verboRelacion).
                */}
                {h.origen && h.conducta && (
                  <p className="mt-1.5 text-sm text-ink-muted">
                    «{h.origen}» {verboRelacion(h.direccion)} «{h.conducta}»
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}

        <RedFuncionalSVG analisis={analisisConProsa} />
      </Seccion>

      {/*
        Sección propia, no un apartado dentro del mantenimiento. Es la
        defensa estructural contra el error clínico más frecuente en una
        formulación: tratar el origen —lo que explica cómo se adquirió el
        problema— en vez de la función que lo sostiene hoy. Mientras el
        origen vivía debajo de las hipótesis de mantenimiento se leía como
        una continuación suya, y la distinción quedaba en manos de que el
        lector se fijara en el subtítulo.
      */}
      <Seccion
        id="hipotesis-origen"
        titulo="Hipótesis de origen"
        camposReanalisis={["hipotesis_origen"]}
      >
        <SelloNoModificable />
        <ListaEditable
          items={analisis.hipotesis_origen}
          seccionId="hipotesis-origen"
          etiqueta="hipótesis de origen"
          claseItem="text-sm italic leading-relaxed text-ink-muted"
          onCambiar={(nuevos) =>
            onEditarSeccion("hipotesis-origen", (c) => {
              c.hipotesis_origen = nuevos;
            })
          }
        />
      </Seccion>

      <Seccion
        id="formulacion"
        titulo="Formulación del caso"
        camposReanalisis={[
          "formulacion",
          "fortalezas_y_recursos",
          "valores_y_metas",
          "perdida_de_reforzadores",
        ]}
      >
        <div className="space-y-5">
          <SubSeccion titulo="Relaciones entre problemas">
            {analisis.formulacion.relaciones_entre_problemas.length === 0 ? (
              <SinHallazgos />
            ) : (
              <ul className="list-disc space-y-2 pl-5">
                {analisis.formulacion.relaciones_entre_problemas.map(
                  (r, i) => (
                    <li key={i} className="text-[15px] leading-relaxed text-ink">
                      {r}
                    </li>
                  )
                )}
              </ul>
            )}
          </SubSeccion>
          {/*
            UN SOLO RANKING, Y ES DE CONDUCTAS.

            Aquí había dos, uno debajo del otro: «Priorización de blancos de
            intervención», que ordenaba conductas con la prosa del modelo, y
            «Rendimiento esperado de cada blanco», que ordenaba variables
            moduladoras. Dos listas con nombres casi idénticos y unidades de
            análisis distintas — el lector no tenía cómo saber que no
            hablaban de lo mismo, y las dos decían llamarse «blancos».

            El blanco que se interviene es la conducta. La variable
            moduladora no es un blanco: es la palanca por la que esa
            conducta se mueve, y ahora sale colgando de ella. La
            justificación que escribió el modelo viaja con su conducta por
            `conducta_id`, así que no se pierde.
          */}
          <SubSeccion titulo="Priorización de blancos de intervención">
            <PriorizacionEstimada analisis={analisis} />
          </SubSeccion>
          {/* Se muestran aunque estén vacías: el clínico puede añadir lo que la IA no recogió. */}
          {/*
            Un informe que solo enumera déficits describe a una persona que
            no existe, y deja fuera el material con el que se construye la
            intervención. Vacío es una respuesta válida —la alternativa,
            inventar fortalezas que la nota no sostiene, es peor—, y por eso
            el texto de la lista vacía lo dice en vez de callarse.
          */}
          <SubSeccion titulo="Fortalezas y recursos">
            <ListaEditable
              items={analisis.fortalezas_y_recursos}
              seccionId="formulacion"
              etiqueta="fortaleza o recurso"
              onCambiar={(nuevos) =>
                onEditarSeccion("formulacion", (c) => {
                  c.fortalezas_y_recursos = nuevos;
                })
              }
              vacio={
                <p className="text-sm text-ink-muted">
                  La nota no sostiene ninguna fortaleza ni recurso concreto.
                  No significa que no los haya: significa que no están
                  escritos, y conviene preguntarlos en sesión.
                </p>
              }
            />
          </SubSeccion>
          <SubSeccion titulo="Valores y metas del consultante">
            <ListaEditable
              items={analisis.valores_y_metas}
              seccionId="formulacion"
              etiqueta="valor o meta"
              onCambiar={(nuevos) =>
                onEditarSeccion("formulacion", (c) => {
                  c.valores_y_metas = nuevos;
                })
              }
            />
          </SubSeccion>
          <SubSeccion titulo="Pérdida de reforzadores">
            <ListaEditable
              items={analisis.perdida_de_reforzadores}
              seccionId="formulacion"
              etiqueta="reforzador perdido"
              onCambiar={(nuevos) =>
                onEditarSeccion("formulacion", (c) => {
                  c.perdida_de_reforzadores = nuevos;
                })
              }
            />
          </SubSeccion>
        </div>
      </Seccion>
    </BloqueBase>
  );
}
