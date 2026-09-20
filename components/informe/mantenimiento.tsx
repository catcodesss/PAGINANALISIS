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
import { priorizarBlancos, RENDIMIENTO_MAXIMO } from "@/lib/priorizacion";

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
 * fuerza va en el grosor Y en el texto. En blanco y negro, con daltonismo o con
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
  const GROSOR: Record<string, number> = { alta: 3.4, media: 2.1, baja: 1.2 };

  /** Recorta la etiqueta para que quepa al lado del nodo; el texto entero va en el <title>. */
  const corta = (texto: string) =>
    texto.length > 30 ? `${texto.slice(0, 29)}…` : texto;

  return (
    <div className="mt-6">
      <h3 className="font-mono text-xs uppercase tracking-wide text-ink-muted">
        Red funcional
      </h3>
      <p className="mt-1 text-sm leading-relaxed text-ink-muted">
        Las mismas hipótesis de arriba, dibujadas. El tamaño del círculo es la
        importancia de la conducta; el grosor de la línea, la fuerza de la
        relación. Los trazos discontinuos son bucles cerrados: se alimentan a sí
        mismos, así que hay que romperlos por algún punto.
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
                strokeWidth={GROSOR[a.fuerza] ?? 1.2}
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
                  {`De «${desde.etiqueta}» a «${hasta.etiqueta}». Relación ${a.tipo_relacion}, fuerza ${a.fuerza}, ${a.bidireccional ? "bidireccional" : "unidireccional"}${a.enBucle ? ", en bucle cerrado" : ""}.`}
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
 * Los blancos de intervención ordenados por rendimiento esperado, en barras.
 *
 * La advertencia de arriba no es un descargo de responsabilidad de trámite: es
 * la parte más importante del componente. Una barra tiene aspecto de medida, y
 * esto no mide nada — son "alta/media/baja" dichas por un modelo, convertidas a
 * números para poder ordenarlas. Sin ese aviso, un dibujo que solo sostiene
 * "esto probablemente antes que aquello" se leería como una cuantificación del
 * caso.
 *
 * Va junto a `formulacion.priorizacion` y no en su lugar: la priorización
 * razonada del informe dice POR QUÉ, y esto solo dice en qué orden salen las
 * variables al cruzar cuánto pesan con cuánto pueden moverse. El porqué manda.
 */
export function PriorizacionEstimada({ analisis }: { analisis: AnalisisFuncional }) {
  const blancos = useMemo(() => priorizarBlancos(analisis), [analisis]);

  if (blancos.length === 0) {
    return (
      <p className="text-sm leading-relaxed text-ink-muted">
        Ninguna variable moduladora aparece nombrada en las hipótesis de
        mantenimiento, así que no hay nada que ordenar. Una variable sin relación
        declarada es contexto, no un blanco de intervención.
      </p>
    );
  }

  return (
    <div>
      {/*
        Antes de las barras, no después: quien mira un gráfico decide qué está
        viendo en el primer segundo, y a esas alturas una nota al pie llega
        tarde.
      */}
      <p className="mb-4 rounded-md border border-divider bg-canvas px-4 py-3 text-sm leading-relaxed text-ink-muted print:border-black">
        <span className="font-medium text-ink">
          Orientación, no medida.
        </span>{" "}
        Estas barras son estimaciones cualitativas —alta, media y baja— pasadas
        a números con el único fin de poder ordenarlas. No hay unidades ni
        precisión: lo único que sostienen es «esto probablemente antes que
        aquello». Cada valor es la importancia de la conducta multiplicada por
        cuánto puede moverse la variable que la mantiene, que es donde el
        tratamiento rinde.
      </p>

      <ul className="space-y-3">
        {blancos.map((b, i) => (
          <li key={i}>
            <div className="flex flex-wrap items-baseline justify-between gap-x-3">
              <p className="min-w-0 flex-1 text-[15px] leading-relaxed text-ink">
                {i + 1}. {b.etiqueta}
              </p>
              {/*
                El valor escrito acompaña siempre a la barra: la longitud sola
                no se puede leer en una impresión en blanco y negro estrecha, ni
                con un lector de pantalla.
              */}
              <p className="font-mono text-[10px] uppercase tracking-wide text-ink-muted">
                {b.palanca
                  ? `importancia ${b.importancia} × modificabilidad ${b.palanca.modificabilidad}`
                  : "sin palanca trazada"}
              </p>
            </div>
            {/*
              Escala fija (0 a 0,64, el producto máximo posible) y no relativa
              al mayor de este informe: con escala relativa, el primer blanco
              siempre llenaría la barra entera y un caso sin ningún blanco
              prometedor se vería igual que uno con uno excelente.
            */}
            {b.rendimiento === null ? (
              /*
                Sin barra, y dicho con palabras. Pintar una barra vacía se
                leería como «esta conducta no rinde», cuando lo que pasa es que
                ninguna variable moduladora se ha trazado hasta ella: es un
                hueco de la formulación, no un veredicto sobre la conducta.
              */
              <p className="mt-1 text-sm italic text-ink-muted">
                Ninguna variable moduladora llega trazada hasta esta conducta:
                no consta por dónde moverla. Trázala en el grafo o pregúntalo en
                la próxima sesión.
              </p>
            ) : (
              <>
                <div
                  role="img"
                  aria-label={`Rendimiento estimado ${Math.round((b.rendimiento / RENDIMIENTO_MAXIMO) * 100)} de 100, en una escala cualitativa`}
                  className="mt-1 h-2 w-full overflow-hidden rounded-full bg-divider"
                >
                  <div
                    className="h-full rounded-full bg-accent"
                    style={{
                      width: `${(b.rendimiento / RENDIMIENTO_MAXIMO) * 100}%`,
                    }}
                  />
                </div>
                {/* La palanca es el «por dónde»: sin ella el orden no acciona nada. */}
                <p className="mt-1 text-sm text-ink-muted">
                  Palanca: {b.palanca?.etiqueta}
                </p>
              </>
            )}
            {b.justificacion && (
              <p className="mt-0.5 text-sm text-ink-muted">{b.justificacion}</p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

