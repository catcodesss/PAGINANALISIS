"use client";

import type { ProcesoACT } from "@/lib/types";
import { describirGrado, gradoDeCita } from "@/lib/gradoApoyo";
import { ETIQUETA_PROCESO_ACT } from "@/lib/procesosACT";

/*
  Los procesos ACT se pintan como anotaciones sobre el nodo al que se refieren,
  no como nodos propios: no añaden nada al análisis funcional, lo leen. Cada
  etiqueta dice «posible» y su grado de apoyo, porque es una hipótesis sobre la
  función de ese elemento y no un hallazgo.
*/

/** La confianza no se declara en un proceso: la cita sola decide el grado. */
function gradoDe(p: ProcesoACT) {
  return describirGrado(gradoDeCita(p.evidencia, "media")).etiqueta.toLowerCase();
}

function titulo(p: ProcesoACT): string {
  return [
    `Posible ${ETIQUETA_PROCESO_ACT[p.proceso].toLowerCase()}`,
    p.justificacion_funcional || "Sin justificación funcional declarada.",
    p.revisar_proceso ? "Pendiente de revisar: asignado al migrar un informe anterior." : "",
  ]
    .filter(Boolean)
    .join(" — ");
}

export function EtiquetasProcesoACT({ procesos }: { procesos: readonly ProcesoACT[] }) {
  if (procesos.length === 0) return null;
  return (
    <div className="mb-1 flex flex-wrap gap-1" aria-label="Procesos ACT anotados">
      {procesos.map((p) => (
        <span
          key={p.id}
          title={titulo(p)}
          className="inline-flex items-center gap-1 rounded-full border border-accent/30 bg-accent/5 px-2 py-0.5 text-[10px] leading-tight text-accent"
        >
          <span className="text-ink-muted">posible</span>
          {ETIQUETA_PROCESO_ACT[p.proceso]}
          <span className="text-ink-muted">· {gradoDe(p)}</span>
          {!p.justificacion_funcional && <span className="text-warn">· sin justificación</span>}
          {p.revisar_proceso && <span className="text-warn">· revisar</span>}
        </span>
      ))}
    </div>
  );
}

/**
 * Lo que no ancló a ningún nodo se dice, con las palabras del modelo. Es un
 * hueco que el clínico puede leer y colocar, no una relación que se inventa.
 */
export function ProcesosSinAnclar({ procesos }: { procesos: readonly ProcesoACT[] }) {
  if (procesos.length === 0) return null;
  return (
    <section className="rounded-xl border border-dashed border-divider bg-surface p-3">
      <h4 className="font-serif text-base font-semibold text-ink">Procesos ACT sin anclar</h4>
      <p className="mt-1 text-xs text-ink-muted">
        No se pudieron enganchar a un elemento concreto del análisis. Se muestran aparte en vez de
        repartirlos por una situación entera.
      </p>
      <ul className="mt-3 space-y-2">
        {procesos.map((p) => (
          <li key={p.id} className="rounded-lg border border-divider bg-canvas p-3 text-sm">
            <p className="text-ink">
              <span className="text-ink-muted">Posible </span>
              {ETIQUETA_PROCESO_ACT[p.proceso].toLowerCase()}
              <span className="text-ink-muted"> · {gradoDe(p)}</span>
              {p.revisar_proceso && <span className="text-warn"> · revisar</span>}
            </p>
            <p className="mt-1 text-xs text-ink-muted">
              Sobre: {p.elemento_objetivo || "elemento no indicado"}
            </p>
            <p className={`mt-1 text-xs ${p.justificacion_funcional ? "text-ink-muted" : "text-warn"}`}>
              {p.justificacion_funcional || "Sin justificación funcional declarada: la etiqueta sola no establece qué controla la conducta."}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
