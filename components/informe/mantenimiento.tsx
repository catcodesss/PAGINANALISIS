"use client";

/**
 * Las piezas que solo usa el bloque 3: el sello de «no modificable» de la
 * hipótesis de origen, el dibujo de la red funcional y el ranking de blancos.
 *
 * Viven aquí y no en primitivas.tsx porque no las comparte nadie más. Lo que
 * usa un solo bloque va con su bloque; primitivas guarda lo que comparten
 * todos, que es lo único que justifica un módulo común.
 */

import { useMemo } from "react";
import type { AnalisisFuncional } from "@/lib/types";
import { construirRedFuncional } from "@/lib/redFuncional";
import { verboRelacion } from "@/lib/gradoApoyo";
import { construirNodosGrafo } from "@/lib/grafo";
import {
  criteriosDeBlanco,
  ORIGEN_DE_CRITERIO,
  priorizarBlancos,
  type CriteriosBlanco,
} from "@/lib/priorizacion";

/**
 * Franja de "esto no se toca" para las hipótesis de origen.
 *
 * No usa el ámbar de los avisos: no hay nada que revisar ni que corregir aquí,
 * y gastar el color de "hay que mirarlo" en algo que solo hay que leer una vez
 * lo devaluaría para cuando de verdad haga falta (ver MARCA.md). Es una franja
 * gris, con el rótulo en versalitas del resto del informe, y sobrevive a la
 * impresión: el texto está escrito, no dibujado, así que dice lo mismo en
 * papel — y el papel es lo que acaba en la historia clínica.
 */
export function SelloNoModificable() {
  return (
    <div className="mb-4 rounded-md border border-divider bg-canvas px-4 py-3 print:border-black">
      <p className="font-mono text-[10px] font-bold uppercase tracking-wide text-ink-muted">
        No modificable · no genera blancos de intervención
      </p>
      <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">
        El origen explica cómo se adquirió el problema, no qué lo mantiene hoy;
        por eso no se interviene sobre él. Los blancos de intervención salen de
        las hipótesis de mantenimiento, no de aquí.
      </p>
    </div>
  );
}

/**
 * La red funcional, dibujada.
 *
 * Por qué un dibujo y no otra lista: la prosa esconde los bucles. Un informe
 * puede decir en una hipótesis que el aislamiento alimenta la evitación y en
 * otra que la evitación aumenta el aislamiento, y las dos frases se leen por
 * separado como observaciones razonables. Juntas son un ciclo cerrado, y un
 * ciclo cerrado cambia el plan: hay que romperlo por un punto, no tratar sus
 * dos mitades como problemas independientes.
 *
 * NO SUSTITUYE A LA LISTA de hipótesis que tiene encima, igual que la cadena
 * dibujada no sustituye a su tabla: el dibujo enseña la forma, el texto dice
 * qué. Por eso cada nodo lleva su etiqueta escrita al lado y su texto completo
 * en el `title`, los bucles se listan además en palabras debajo, y el grosor de
 * una arista viene acompañado del nivel escrito en su nombre accesible.
 *
 * EL COLOR NO ES EL ÚNICO PORTADOR. Los nodos se distinguen por FORMA
 * (círculo = conducta problema, rombo = variable moduladora), no por color; los
 * bucles llevan trazo discontinuo Y aparecen escritos en la lista de abajo; la
 * dirección va en las puntas Y en el texto. En blanco y negro, con daltonismo o con
 * lector de pantalla se sigue leyendo lo mismo.
 *
 * Sin librerías y con posiciones calculadas en lib/redFuncional.ts: el mismo
 * informe da siempre el mismo dibujo, así que dos capturas del mismo caso se
 * pueden comparar.
 */
export function RedFuncionalSVG({ analisis }: { analisis: AnalisisFuncional }) {
  const red = useMemo(() => construirRedFuncional(analisis), [analisis]);

  // Degradar con dignidad: se explica por qué no hay dibujo en vez de dejar un
  // hueco, que se leería como un fallo de la página.
  if (red.motivoVacio) {
    return (
      <div className="mt-6 rounded-md border border-divider bg-canvas p-4 print:border-black">
        <p className="font-mono text-[10px] uppercase tracking-wide text-ink-muted">
          Red funcional · sin dibujo
        </p>
        <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">
          {red.motivoVacio}
        </p>
      </div>
    );
  }

  const posicion = new Map(red.nodos.map((n) => [n.id, n]));

  /** Recorta la etiqueta para que quepa al lado del nodo; el texto entero va en el <title>. */
  const corta = (texto: string) =>
    texto.length > 30 ? `${texto.slice(0, 29)}…` : texto;

  return (
    <div className="mt-6">
      <h3 className="font-mono text-xs uppercase tracking-wide text-ink-muted">
        Red funcional
      </h3>
      <p className="mt-1 text-sm leading-relaxed text-ink-muted">
        Las mismas hipótesis de arriba, dibujadas. Una flecha dice que un
        elemento influye en otro; con punta en los dos extremos, que se
        relacionan entre sí. Los trazos discontinuos son bucles cerrados: se
        alimentan a sí mismos, así que hay que romperlos por algún punto.
      </p>

      {/* overflow-x: en un móvil el diagrama no cabe, y el resto del informe no
          puede desplazarse de lado por su culpa. */}
      <div className="mt-3 w-full overflow-x-auto">
        <svg
          viewBox={`0 0 ${red.ancho} ${red.alto}`}
          role="img"
          aria-label={`Red funcional del caso: ${red.nodos.length} elementos y ${red.aristas.length} relaciones${red.bucles.length > 0 ? `, con ${red.bucles.length} bucle(s) cerrado(s)` : ""}. El detalle se lee en la lista de hipótesis de esta misma sección.`}
          className="h-auto w-full min-w-[720px]"
        >
          <defs>
            {/* Dos marcadores: la punta normal y la de las aristas en bucle,
                que no pueden compartir uno porque el color se hereda del
                marcador y no del trazo. */}
            <marker
              id="red-punta"
              viewBox="0 0 10 10"
              refX="9"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--color-ink-muted)" />
            </marker>
            <marker
              id="red-punta-bucle"
              viewBox="0 0 10 10"
              refX="9"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--color-warn)" />
            </marker>
          </defs>

          {red.aristas.map((a, i) => {
            const desde = posicion.get(a.desde);
            const hasta = posicion.get(a.hasta);
            if (!desde || !hasta) return null;

            // Dos nodos de la misma columna se unen con una curva que sale por
            // fuera: una recta entre ellos pasaría por encima de los que hay
            // en medio y no se sabría de dónde a dónde va.
            const mismaColumna = desde.x === hasta.x;
            const desvio = desde.x > red.ancho / 2 ? 110 : -110;
            const d = mismaColumna
              ? `M ${desde.x} ${desde.y} Q ${desde.x + desvio} ${(desde.y + hasta.y) / 2} ${hasta.x} ${hasta.y}`
              : `M ${desde.x} ${desde.y} L ${hasta.x} ${hasta.y}`;

            return (
              <path
                key={i}
                d={d}
                fill="none"
                stroke={a.enBucle ? "var(--color-warn)" : "var(--color-ink-muted)"}
                // Grosor fijo: la fuerza de la relación ya no se enseña en
                // pantalla (ver lib/gradoApoyo.ts#verboRelacion).
                strokeWidth={2}
                strokeDasharray={a.enBucle ? "7 4" : undefined}
                markerEnd={`url(#${a.enBucle ? "red-punta-bucle" : "red-punta"})`}
                markerStart={
                  a.bidireccional
                    ? `url(#${a.enBucle ? "red-punta-bucle" : "red-punta"})`
                    : undefined
                }
                opacity={0.85}
              >
                {/*
                  El título nombra los DOS EXTREMOS y las propiedades de la
                  relación, no el enunciado entero.

                  Llevaba el enunciado completo pegado detrás, y eso hacía dos
                  cosas malas a la vez: repetía en el dibujo un párrafo que la
                  lista de hipótesis ya tiene justo encima, y le daba a un trazo
                  un nombre accesible de tres líneas. Un lector de pantalla que
                  recorre ocho aristas leía ocho veces la formulación completa
                  en vez de saber qué une cada flecha, que es lo que el dibujo
                  aporta y la prosa no.
                */}
                <title>
                  {`«${desde.etiqueta}» ${verboRelacion(a.bidireccional ? "bidireccional" : "unidireccional")} «${hasta.etiqueta}»${a.enBucle ? ", en bucle cerrado" : ""}.`}
                </title>
              </path>
            );
          })}

          {red.nodos.map((n) => {
            const alaIzquierda = n.x < red.ancho / 2;
            return (
              <g key={n.id}>
                {/* Forma, no color: círculo para la conducta problema y rombo
                    (el mismo cuadrado, girado) para la variable moduladora. */}
                {n.tipo === "conducta" ? (
                  <circle
                    cx={n.x}
                    cy={n.y}
                    r={n.radio}
                    fill="var(--color-surface)"
                    stroke={n.enBucle ? "var(--color-warn)" : "var(--color-accent)"}
                    strokeWidth={n.enBucle ? 3 : 2}
                  />
                ) : (
                  <rect
                    x={n.x - n.radio}
                    y={n.y - n.radio}
                    width={n.radio * 2}
                    height={n.radio * 2}
                    transform={`rotate(45 ${n.x} ${n.y})`}
                    fill="var(--color-surface)"
                    stroke={n.enBucle ? "var(--color-warn)" : "var(--color-ink-muted)"}
                    strokeWidth={n.enBucle ? 3 : 2}
                  />
                )}
                <text
                  x={alaIzquierda ? n.x - n.radio - 10 : n.x + n.radio + 10}
                  y={n.y + 4}
                  textAnchor={alaIzquierda ? "end" : "start"}
                  fill="var(--color-ink)"
                  fontSize="13"
                >
                  {corta(n.etiqueta)}
                  <title>{n.etiqueta}</title>
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      <p className="mt-2 font-mono text-[10px] uppercase tracking-wide text-ink-muted">
        Círculo: conducta problema · Rombo: variable moduladora · Trazo
        discontinuo: bucle cerrado
      </p>

      {/*
        Los bucles, escritos. El trazo discontinuo no llega a quien lee con
        lector de pantalla ni sobrevive a una fotocopia en blanco y negro, y es
        justo lo que el dibujo existe para enseñar.
      */}
      {red.bucles.length > 0 && (
        <div className="mt-3 rounded-md border border-divider bg-canvas p-4 print:border-black">
          <p className="font-mono text-[10px] uppercase tracking-wide text-ink-muted">
            Bucles cerrados
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {red.bucles.map((b, i) => (
              <li key={i} className="text-sm leading-relaxed text-ink">
                {b}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-sm leading-relaxed text-ink-muted">
            Cada uno se alimenta a sí mismo: intervenir sobre una de sus partes
            sin tocar el resto lo deja funcionando. El plan tiene que romperlo
            por algún punto.
          </p>
        </div>
      )}
    </div>
  );
}


/**
 * Los blancos de intervención, en orden, con cuatro criterios en categorías.
 *
 * Antes eran barras de «rendimiento esperado». Una barra tiene aspecto de
 * medida y esto no mide nada: son alta/media/baja estimadas, que solo sostienen
 * «esto probablemente antes que aquello». Ahora se dicen como lo que son, y
 * cada criterio explica en su tooltip de dónde sale. Ver
 * lib/priorizacion.ts#criteriosDeBlanco.
 */
export function PriorizacionEstimada({ analisis }: { analisis: AnalisisFuncional }) {
  const blancos = useMemo(() => priorizarBlancos(analisis), [analisis]);
  const nodos = useMemo(() => construirNodosGrafo(analisis), [analisis]);

  if (blancos.length === 0) {
    return (
      <p className="text-sm leading-relaxed text-ink-muted">
        No hay conductas problema que ordenar.
      </p>
    );
  }

  const apoyoDe = (id: string): 1 | 2 | 3 =>
    nodos.find((n) => n.id === id)?.apoyo ?? 1;

  return (
    <div>
      <p className="mb-4 text-sm leading-relaxed text-ink-muted">
        Orientación, no medida: cada criterio está estimado a partir de lo que
        el análisis ya dice (pasa el cursor para ver de dónde). Donde no hay de
        dónde estimarlo pone «sin datos», que no es lo mismo que «baja».
      </p>

      <ol className="space-y-4">
        {blancos.map((b, i) => {
          const criterios = criteriosDeBlanco(analisis, b, apoyoDe(b.id));
          return (
            <li key={b.id} className="rounded border border-divider p-4 print:border-black">
              <p className="text-[15px] leading-relaxed text-ink">
                {i + 1}. {b.etiqueta}
              </p>
              <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
                {(Object.keys(ORIGEN_DE_CRITERIO) as (keyof CriteriosBlanco)[]).map((clave) => {
                  const valor = criterios[clave];
                  return (
                    <div key={clave} className="flex items-baseline justify-between gap-3 border-b border-divider/60 pb-1">
                      <dt title={ORIGEN_DE_CRITERIO[clave].origen} className="cursor-help text-ink-muted">
                        {ORIGEN_DE_CRITERIO[clave].titulo}
                      </dt>
                      <dd className={`font-mono text-[11px] uppercase tracking-wide ${valor ? "text-ink" : "italic text-ink-muted"}`}>
                        {valor ?? "sin datos"}
                      </dd>
                    </div>
                  );
                })}
              </dl>
              {b.palanca ? (
                <p className="mt-2 text-sm text-ink-muted">
                  Por dónde moverla: {b.palanca.etiqueta}
                </p>
              ) : (
                <p className="mt-2 text-sm italic text-ink-muted">
                  Ninguna variable llega trazada hasta esta conducta: no consta
                  por dónde moverla. Trázala en el grafo o pregúntalo en sesión.
                </p>
              )}
              {b.justificacion && (
                <p className="mt-1 text-sm text-ink-muted">{b.justificacion}</p>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
