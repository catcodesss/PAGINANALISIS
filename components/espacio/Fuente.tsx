"use client";

/**
 * Cajón «Fuente»: la nota con sus frases numeradas, abajo y siempre a mano.
 *
 * Plegado ocupa 40 px y dice cuánta nota usa el análisis; abierto, el 35 % del
 * alto. Pulsar una cita en cualquier sitio lo abre y resalta su frase. Pulsar
 * una frase enseña qué elementos del análisis la usan, y desde ahí se puede
 * seleccionar cada uno. La cobertura (fase 2) se ve aquí: las frases que nadie
 * cita van en ámbar.
 *
 * Todo se calcula en el cliente a partir de la nota y el análisis que ya están
 * en pantalla: nada sale ni se registra (invariante 5).
 */

import { useEffect, useMemo, useRef, useState } from "react";
import type { AnalisisFuncional } from "@/lib/types";
import { citaCubreFrase, etiquetaCita, segmentarFrases } from "@/lib/citas";
import { calcularCoberturaNota } from "@/lib/coberturaNota";
import { construirNodosGrafo } from "@/lib/grafo";
import { etiquetaTipoNodo } from "../grafo/etiquetasNodo";
import { useEspacio } from "./contexto";

export default function Fuente({
  analisis,
  notaOriginal,
}: {
  analisis: AnalisisFuncional;
  notaOriginal: string;
}) {
  const { fuenteAbierta, abrirFuente, citaEnFuente, seleccionado, seleccionar } = useEspacio();
  const [fraseElegida, setFraseElegida] = useState<{ linea: number; frase: number } | null>(null);
  const notaRef = useRef<HTMLDivElement>(null);

  const lineas = useMemo(() => notaOriginal.replace(/\r\n/g, "\n").split("\n"), [notaOriginal]);
  const frasesPorLinea = useMemo(() => lineas.map(segmentarFrases), [lineas]);
  const cobertura = useMemo(() => calcularCoberturaNota(lineas, analisis), [lineas, analisis]);
  const sinUsar = useMemo(() => new Set(cobertura.sinUsar.map((f) => `${f.linea}.${f.frase}`)), [cobertura]);
  const nodos = useMemo(() => construirNodosGrafo(analisis), [analisis]);

  // Lo que se resalta: la cita que se pulsó o, si no, la del elemento elegido.
  const nodoElegido = nodos.find((n) => n.id === seleccionado);
  const cita =
    citaEnFuente ?? (nodoElegido?.evidencia?.verificada ? nodoElegido.evidencia : null);

  // Llevar la nota a la frase resaltada. Solo mueve el scroll del cajón: no
  // toca estado, así que no provoca otro render.
  useEffect(() => {
    if (!fuenteAbierta || !cita) return;
    requestAnimationFrame(() => {
      const nota = notaRef.current;
      const el = nota?.querySelector<HTMLElement>(`#fuente-linea-${cita.linea_inicio}`);
      if (nota && el) nota.scrollTop = el.offsetTop - nota.clientHeight / 3;
    });
  }, [fuenteAbierta, cita]);

  // Qué usa la frase elegida: los nodos cuya cita la cubre y las relaciones
  // que la citan. Es la vuelta de «pulsar una cita abre la frase».
  const usan = useMemo(() => {
    if (!fraseElegida) return [];
    const { linea, frase } = fraseElegida;
    const total = frasesPorLinea[linea - 1]?.length ?? 0;
    const vistos = new Set<string>();
    const salida: { id: string; texto: string }[] = [];
    for (const n of nodos) {
      if (vistos.has(n.id) || !n.evidencia?.verificada) continue;
      if (citaCubreFrase(n.evidencia, linea, frase, total)) {
        vistos.add(n.id);
        salida.push({ id: n.id, texto: `${etiquetaTipoNodo(n)}: ${n.etiqueta}` });
      }
    }
    for (const a of analisis.aristas) {
      if (a.evidencia.some((c) => c.verificada && citaCubreFrase(c, linea, frase, total))) {
        const desde = nodos.find((n) => n.id === a.desde);
        const hasta = nodos.find((n) => n.id === a.hasta);
        salida.push({ id: a.desde, texto: `Relación: ${desde?.etiqueta ?? "?"} → ${hasta?.etiqueta ?? "?"}` });
      }
    }
    return salida;
  }, [fraseElegida, frasesPorLinea, nodos, analisis.aristas]);

  return (
    <section
      aria-label="Fuente: la nota"
      className={`fixed inset-x-0 bottom-0 z-30 flex flex-col border-t border-divider bg-surface shadow-[0_-4px_12px_rgba(0,0,0,0.06)] print:hidden ${fuenteAbierta ? "h-[35vh]" : "h-10"}`}
    >
      <button
        type="button"
        aria-expanded={fuenteAbierta}
        onClick={() => abrirFuente(!fuenteAbierta)}
        className="flex h-10 shrink-0 items-center gap-3 px-4 text-left text-xs text-ink-muted hover:text-ink"
      >
        <span className="font-serif text-sm font-semibold text-ink">Fuente</span>
        <span title="Frases de la nota (de cuatro palabras o más) que ningún elemento del análisis cita. Es una ayuda para revisar: no entra en la exportación.">
          {cobertura.usadas} de {cobertura.total} frases usadas
          {cobertura.sinUsar.length > 0 && <> · {cobertura.sinUsar.length} sin usar, en ámbar</>}
        </span>
        {cita && <span className="font-mono text-[10px] uppercase tracking-wide text-accent">{etiquetaCita(cita)}</span>}
        <span aria-hidden="true" className="ml-auto">{fuenteAbierta ? "▾" : "▴"}</span>
      </button>

      {fuenteAbierta && (
        <div className="flex min-h-0 flex-1 gap-4 px-4 pb-3">
          <div ref={notaRef} className="relative min-w-0 flex-1 overflow-y-auto rounded border border-divider bg-canvas p-2 font-mono text-[11px] leading-relaxed">
            {lineas.map((linea, indice) => {
              const n = indice + 1;
              const frases = frasesPorLinea[indice];
              return (
                <p id={`fuente-linea-${n}`} key={indice} className="rounded px-1 text-ink-muted">
                  <span className="mr-2 select-none text-ink-muted">L{n}</span>
                  {frases.length === 0
                    ? linea || " "
                    : frases.map((frase, j) => {
                        const citada = cita ? citaCubreFrase(cita, n, j + 1, frases.length) : false;
                        const olvidada = sinUsar.has(`${n}.${j + 1}`);
                        const elegida = fraseElegida?.linea === n && fraseElegida.frase === j + 1;
                        return (
                          <button
                            type="button"
                            key={j}
                            id={`fuente-frase-${n}-${j + 1}`}
                            onClick={() => setFraseElegida(elegida ? null : { linea: n, frase: j + 1 })}
                            title={olvidada ? "Ningún elemento del análisis cita esta frase" : `L${n}.${j + 1}: ver qué la usa`}
                            className={`inline rounded text-left ${citada ? "bg-accent/15 text-ink ring-1 ring-accent/30" : olvidada ? "bg-warn/10" : ""} ${elegida ? "underline decoration-accent underline-offset-2" : ""}`}
                          >
                            <sup className="mr-0.5 select-none text-[9px] text-ink-muted">{j + 1}</sup>
                            {frase}{" "}
                          </button>
                        );
                      })}
                </p>
              );
            })}
          </div>
          {fraseElegida && (
            <aside aria-label="Qué usa esta frase" className="hidden w-72 shrink-0 overflow-y-auto text-xs md:block">
              <p className="font-mono text-[10px] uppercase tracking-wide text-ink-muted">
                L{fraseElegida.linea}.{fraseElegida.frase} · la usan
              </p>
              {usan.length === 0 ? (
                <p className="mt-2 text-ink-muted">Ningún elemento del análisis cita esta frase.</p>
              ) : (
                <ul className="mt-2 space-y-1">
                  {usan.map((u, i) => (
                    <li key={i}>
                      <button type="button" onClick={() => seleccionar(u.id)} className="text-left text-ink hover:text-accent">
                        {u.texto}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </aside>
          )}
        </div>
      )}
    </section>
  );
}
