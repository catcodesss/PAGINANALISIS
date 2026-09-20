"use client";

import type { ReactNode } from "react";
import type { AnalisisFuncional } from "@/lib/types";
import type { NodoGrafo } from "@/lib/grafo";

export default function VistaMC({
  analisis,
  nodos,
  renderNodo,
}: {
  analisis: AnalisisFuncional;
  nodos: readonly NodoGrafo[];
  renderNodo: (nodo: NodoGrafo) => ReactNode;
}) {
  const antecedentes = nodos.filter((n) => ["om", "moduladora", "ed", "ec", "regla_verbal"].includes(n.tipo));
  const conductas = nodos.filter((n) => ["conducta", "alternativa", "repertorio"].includes(n.tipo));
  const consecuencias = nodos.filter((n) => ["consecuencia", "consecuencia_alternativa", "funcion"].includes(n.tipo));
  const columna = (titulo: string, lista: NodoGrafo[]) => (
    <section className="rounded-xl border border-divider bg-canvas/40 p-3">
      <h4 className="font-serif text-base font-semibold text-ink">{titulo}</h4>
      <div className="mt-3 space-y-2">
        {lista.length > 0
          ? lista.map((n) => <div key={n.id}>{renderNodo(n)}</div>)
          : <p className="rounded border border-dashed border-divider p-3 text-xs text-ink-muted">Sin elementos registrados.</p>}
      </div>
    </section>
  );

  return <div className="space-y-4">
    <div className="grid gap-3 md:grid-cols-3">
      {columna("Antecedentes y contexto", antecedentes)}
      {columna("Conductas", conductas)}
      {columna("Consecuencias y función", consecuencias)}
    </div>
    <section className="rounded-xl border border-divider bg-surface p-3">
      <h4 className="font-serif text-base font-semibold text-ink">Procedimientos sugeridos · MC</h4>
      <p className="mt-1 text-xs text-ink-muted">Se muestran como lectura de las contingencias existentes; no crean nodos ni relaciones nuevas.</p>
      {analisis.capa_mc.procedimientos_sugeridos.length > 0 ? (
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {analisis.capa_mc.procedimientos_sugeridos.map((procedimiento, indice) => (
            <article key={indice} className="rounded-lg border border-divider bg-canvas p-3">
              <h5 className="font-medium text-ink">{procedimiento.procedimiento}</h5>
              <p className="mt-1 text-sm text-ink-muted"><span className="font-medium text-ink">Contingencia objetivo:</span> {procedimiento.contingencia_objetivo}</p>
              {procedimiento.precauciones && <p className="mt-2 text-xs text-warn"><span className="font-medium">Precauciones:</span> {procedimiento.precauciones}</p>}
            </article>
          ))}
        </div>
      ) : <p className="mt-3 rounded border border-dashed border-divider p-3 text-sm text-ink-muted">Sin procedimientos MC registrados.</p>}
    </section>
  </div>;
}
