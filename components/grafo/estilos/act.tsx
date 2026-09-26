"use client";

import type { ReactNode } from "react";
import type { AnalisisFuncional } from "@/lib/types";
import type { NodoGrafo } from "@/lib/grafo";
import { clasificarMatrix } from "@/lib/matrixACT";
import { EtiquetasProcesoACT, ProcesosSinAnclar } from "../AnotacionesACT";

interface VistaACTProps {
  analisis: AnalisisFuncional;
  nodos: readonly NodoGrafo[];
  renderNodo: (nodo: NodoGrafo) => ReactNode;
}

function Cuadrante({ titulo, eje, children }: { titulo: string; eje: string; children: ReactNode }) {
  return <section className="min-h-44 rounded-xl border border-divider bg-canvas/40 p-3"><h4 className="font-serif text-base font-semibold text-ink">{titulo}<span className="mt-0.5 block font-mono text-[9px] uppercase tracking-wide text-ink-muted">{eje}</span></h4><div className="mt-3 grid gap-2 sm:grid-cols-2">{children}</div></section>;
}

export default function VistaACT({ analisis, nodos, renderNodo }: VistaACTProps) {
  // Qué va en cada cuadrante lo decide la función, no el tipo de nodo: ver lib/matrixACT.ts.
  const m = clasificarMatrix(analisis, nodos);
  const idsNodos = new Set(nodos.map((n) => n.id));
  const sinAnclar = analisis.capa_act.procesos_act.filter((p) => !p.nodo_id || !idsNodos.has(p.nodo_id));
  // Solo por nodo_id: un proceso se engancha a un elemento, nunca a toda su situación.
  const procesosDe = (nodo: NodoGrafo) => analisis.capa_act.procesos_act.filter((p) => p.nodo_id === nodo.id);
  const pintar = (lista: NodoGrafo[], hueco: string) => lista.length > 0 ? lista.map((n) => <div key={n.id}><EtiquetasProcesoACT procesos={procesosDe(n)} />{renderNodo(n)}</div>) : <p className="rounded border border-dashed border-divider p-3 text-xs text-ink-muted">{hueco}</p>;

  return <div className="space-y-4"><div className="flex justify-between text-[11px] text-ink-muted"><span>← Alejarse de lo que duele</span><span>Acercarse a lo importante →</span></div><div className="grid gap-3 md:grid-cols-2"><Cuadrante titulo="Conductas de alejamiento" eje="Observable · arriba izquierda · con base funcional">{pintar(m.alejamiento, "Ninguna conducta con función de alejamiento establecida (refuerzo negativo o evitación experiencial justificada).")}</Cuadrante><Cuadrante titulo="Conductas de acercamiento" eje="Observable · arriba derecha">{pintar(m.acercamiento, "Hueco: faltan alternativas o repertorio disponible.")}</Cuadrante><Cuadrante titulo="Malestar interior" eje="Experiencia · abajo izquierda · eventos privados">{pintar(m.interior, "No hay eventos privados (eslabones encubiertos o estímulos condicionados) registrados.")}</Cuadrante><Cuadrante titulo="Quién y qué importa" eje="Valores · abajo derecha">{pintar(m.valores, "Hueco: no hay valores o metas registrados.")}</Cuadrante></div>{m.sinFuncionEstablecida.length > 0 && <section className="rounded-xl border border-dashed border-divider bg-canvas/40 p-3"><h4 className="font-serif text-base font-semibold text-ink">Conductas sin función de alejamiento establecida</h4><p className="mt-1 text-xs text-ink-muted">Son conductas problema, pero el análisis no sostiene que funcionen para alejarse de lo que duele. No se clasifican por su forma.</p><div className="mt-3 grid gap-2 sm:grid-cols-2">{pintar(m.sinFuncionEstablecida, "")}</div></section>}<section className="rounded-xl border border-divider bg-surface p-3"><h4 className="font-serif text-base font-semibold text-ink">Reglas verbales que gobiernan la conducta</h4><p className="mt-1 text-xs text-ink-muted">Clase y rigidez muestran cuándo la conducta sigue la regla por encima de la contingencia.</p><div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{m.reglas.length > 0 ? m.reglas.map((n) => <div key={n.id}>{renderNodo(n)}</div>) : <p className="rounded border border-dashed border-divider p-3 text-xs text-ink-muted">Sin reglas verbales identificadas.</p>}</div></section><ProcesosSinAnclar procesos={sinAnclar} /></div>;
}
