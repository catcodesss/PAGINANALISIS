"use client";

import type { ReactNode } from "react";
import type { AnalisisFuncional } from "@/lib/types";
import type { NodoGrafo } from "@/lib/grafo";

interface VistaACTProps {
  analisis: AnalisisFuncional;
  nodos: readonly NodoGrafo[];
  renderNodo: (nodo: NodoGrafo) => ReactNode;
}

function Cuadrante({ titulo, eje, children }: { titulo: string; eje: string; children: ReactNode }) {
  return <section className="min-h-44 rounded-xl border border-divider bg-canvas/40 p-3"><h4 className="font-serif text-base font-semibold text-ink">{titulo}<span className="mt-0.5 block font-mono text-[9px] uppercase tracking-wide text-ink-muted">{eje}</span></h4><div className="mt-3 grid gap-2 sm:grid-cols-2">{children}</div></section>;
}

export default function VistaACT({ analisis, nodos, renderNodo }: VistaACTProps) {
  const alejamiento = nodos.filter((n) => n.tipo === "conducta" && !n.alternativa);
  const acercamiento = nodos.filter((n) => n.tipo === "alternativa" || n.tipo === "repertorio");
  const interior = nodos.filter((n) => n.tipo === "om" || n.tipo === "encubierta" || n.tipo === "ec");
  const valores = nodos.filter((n) => n.tipo === "valor");
  const reglas = nodos.filter((n) => n.tipo === "regla_verbal");
  const procesosDe = (nodo: NodoGrafo) => analisis.capa_act.procesos_act.filter((p) => p.eslabon_id === nodo.id || (p.situacion_id && p.situacion_id === nodo.situacion_id));
  const pintar = (lista: NodoGrafo[], hueco: string) => lista.length > 0 ? lista.map((n) => <div key={n.id}>{renderNodo(n)}<div className="mt-1">{procesosDe(n).map((p) => <span key={p.id} className="mr-1 inline-block rounded-full bg-accent/10 px-2 py-0.5 text-[10px] text-accent">{p.proceso}</span>)}</div></div>) : <p className="rounded border border-dashed border-divider p-3 text-xs text-ink-muted">{hueco}</p>;

  return <div className="space-y-4"><div className="flex justify-between text-[11px] text-ink-muted"><span>← Alejarse de lo que duele</span><span>Acercarse a lo importante →</span></div><div className="grid gap-3 md:grid-cols-2"><Cuadrante titulo="Conductas de alejamiento" eje="Observable · arriba izquierda">{pintar(alejamiento, "No hay conductas de alejamiento registradas.")}</Cuadrante><Cuadrante titulo="Conductas de acercamiento" eje="Observable · arriba derecha">{pintar(acercamiento, "Hueco: faltan alternativas o repertorio disponible.")}</Cuadrante><Cuadrante titulo="Malestar interior" eje="Experiencia · abajo izquierda">{pintar(interior, "No hay experiencia interior vinculada a las situaciones.")}</Cuadrante><Cuadrante titulo="Quién y qué importa" eje="Valores · abajo derecha">{pintar(valores, "Hueco: no hay valores o metas registrados.")}</Cuadrante></div><section className="rounded-xl border border-divider bg-surface p-3"><h4 className="font-serif text-base font-semibold text-ink">Reglas verbales que gobiernan la conducta</h4><p className="mt-1 text-xs text-ink-muted">Clase y rigidez muestran cuándo la conducta sigue la regla por encima de la contingencia.</p><div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{reglas.length > 0 ? reglas.map((n) => <div key={n.id}>{renderNodo(n)}</div>) : <p className="rounded border border-dashed border-divider p-3 text-xs text-ink-muted">Sin reglas verbales identificadas.</p>}</div></section></div>;
}
