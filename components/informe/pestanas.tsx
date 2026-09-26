"use client";

/**
 * Las cinco pestañas del informe: Resumen | Análisis funcional | Formulación |
 * Plan | Revisión.
 *
 * QUÉ SUSTITUYEN. El informe era un documento continuo con un índice lateral y
 * bloques que se arrastraban y se ocultaban. Todo aparecía a la vez, y el
 * terapeuta tenía que atravesar el grafo entero para llegar al plan. Con
 * pestañas cada pantalla enseña una pregunta, y el orden deja de ser algo que
 * haya que gestionar: por eso desaparecen el arrastre y el ocultado.
 *
 * LAS PESTAÑAS SON LOS BLOQUES DE SIEMPRE. Mismos ids (lib/secciones.ts), así
 * que las anclas, `secciones_editadas` y los enlaces guardados siguen hablando
 * el mismo idioma. Lo que cambia es que solo uno se ve en pantalla.
 *
 * AL IMPRIMIR SE VEN TODOS. Un panel inactivo lleva `hidden print:block`: la
 * pestaña es una forma de leer, no un recorte del documento que se archiva.
 */

import { createContext, useContext, type ReactNode } from "react";
import { bloqueDeAncla, type IdSeccion } from "@/lib/secciones";

export interface PestanasValor {
  activa: IdSeccion;
  elegir: (id: IdSeccion) => void;
}

export const PestanasContext = createContext<PestanasValor | null>(null);

export function usePestanas(): PestanasValor | null {
  return useContext(PestanasContext);
}

/**
 * Lleva a un ancla, cambiando antes de pestaña si hace falta. Un aviso de la
 * Revisión que señala una hipótesis de la Formulación tiene que llevar a ella,
 * no hacer scroll dentro de un panel oculto.
 */
export function irAlAncla(ctx: PestanasValor | null, ancla: string) {
  const bloque = bloqueDeAncla(ancla);
  if (bloque && ctx && ctx.activa !== bloque) ctx.elegir(bloque);
  requestAnimationFrame(() => {
    document
      .getElementById(ancla)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

/** El panel de una pestaña. Sin proveedor (no debería pasar) se ve siempre. */
export function PanelPestana({ id, children }: { id: IdSeccion; children: ReactNode }) {
  const ctx = usePestanas();
  const activa = !ctx || ctx.activa === id;
  return (
    <div
      role="tabpanel"
      id={`panel-${id}`}
      aria-labelledby={`pestana-${id}`}
      className={activa ? "" : "hidden print:block"}
    >
      {children}
    </div>
  );
}

export function BarraPestanas({
  pestanas,
}: {
  pestanas: { id: IdSeccion; titulo: string; contador?: number }[];
}) {
  const ctx = usePestanas();
  if (!ctx) return null;

  // Flechas izquierda/derecha entre pestañas: el patrón de ARIA para un
  // tablist, sin el cual el teclado tendría que recorrer los cinco botones.
  function mover(desde: number, paso: number) {
    const siguiente = pestanas[(desde + paso + pestanas.length) % pestanas.length];
    ctx!.elegir(siguiente.id);
    requestAnimationFrame(() => document.getElementById(`pestana-${siguiente.id}`)?.focus());
  }

  return (
    // overflow-x-auto dentro de la barra, no en la página: a 400 px las cinco
    // pestañas no caben, y el informe no puede desplazarse de lado por eso.
    <div className="sticky top-0 z-20 -mx-5 mb-6 overflow-x-auto border-b border-divider bg-surface px-5 sm:-mx-8 sm:px-8 lg:-mx-12 lg:px-12 print:hidden">
      <div role="tablist" aria-label="Partes del análisis" className="flex min-w-max gap-1">
        {pestanas.map((p, i) => {
          const activa = ctx.activa === p.id;
          return (
            <button
              key={p.id}
              id={`pestana-${p.id}`}
              type="button"
              role="tab"
              aria-selected={activa}
              aria-controls={`panel-${p.id}`}
              tabIndex={activa ? 0 : -1}
              onClick={() => ctx.elegir(p.id)}
              onKeyDown={(e) => {
                if (e.key === "ArrowRight") { e.preventDefault(); mover(i, 1); }
                if (e.key === "ArrowLeft") { e.preventDefault(); mover(i, -1); }
              }}
              className={`-mb-px flex items-center gap-2 whitespace-nowrap border-b-2 px-3 py-3 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 ${
                activa
                  ? "border-accent font-semibold text-accent"
                  : "border-transparent text-ink-muted hover:text-ink"
              }`}
            >
              {p.titulo}
              {p.contador !== undefined && p.contador > 0 && (
                <span className="rounded-full bg-warn/15 px-1.5 py-0.5 font-mono text-[10px] font-bold text-warn">
                  {p.contador}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
