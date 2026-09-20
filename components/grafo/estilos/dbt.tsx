"use client";

import { useState, type ReactNode } from "react";
import type { AnalisisFuncional } from "@/lib/types";
import type { NodoGrafo } from "@/lib/grafo";

interface VistaDBTProps {
  analisis: AnalisisFuncional;
  nodos: readonly NodoGrafo[];
  renderNodo: (nodo: NodoGrafo) => ReactNode;
}

function Solucion({ titulo, children }: { titulo: string; children?: ReactNode }) {
  return <div className={`rounded-lg border p-3 ${children ? "border-divider bg-surface" : "border-dashed border-divider text-ink-muted"}`}><h5 className="font-mono text-[10px] uppercase tracking-wide text-ink-muted">{titulo}</h5><div className="mt-1 text-sm leading-relaxed">{children ?? "Hueco: falta una solución vinculada a esta fase."}</div></div>;
}

export default function VistaDBT({ analisis, nodos, renderNodo }: VistaDBTProps) {
  const conductas = nodos.filter((n) => n.tipo === "conducta" && !n.alternativa);
  const [idElegido, setIdElegido] = useState<string | null>(null);
  const elegida = conductas.find((n) => n.id === idElegido) ?? conductas[0] ?? null;
  const situacion = analisis.situaciones.find((s) => s.id === elegida?.situacion_id) ?? null;
  const deSituacion = nodos.filter((n) => n.situacion_id === situacion?.id);
  const reglas = nodos.filter((n) => n.tipo === "regla_verbal");
  const idsModuladoras = new Set(
    elegida
      ? analisis.aristas
          .filter((a) => a.hasta === elegida.id && a.tipo === "moderadora")
          .map((a) => a.desde)
      : []
  );
  const moduladoras = nodos.filter(
    (n) => n.tipo === "moduladora" && idsModuladoras.has(n.id)
  );

  if (!elegida || !situacion) {
    return <p className="rounded border border-dashed border-divider p-4 text-sm text-ink-muted">DBT necesita una conducta problema vinculada a una situación.</p>;
  }

  const fases = [
    {
      clave: "vulnerabilidad",
      titulo: "Vulnerabilidad",
      descripcion: "Factores que hacen más probable que la cadena arranque.",
      nodos: [...moduladoras, ...deSituacion.filter((n) => n.tipo === "om")],
      soluciones: <Solucion titulo="Prevención">{analisis.capa_dbt.plan_de_prevencion.length > 0 ? <ul className="list-disc pl-4">{analisis.capa_dbt.plan_de_prevencion.map((p, i) => <li key={i}>{p}</li>)}</ul> : null}</Solucion>,
    },
    {
      clave: "precipitante",
      titulo: "Evento precipitante",
      descripcion: "Lo que ocurrió justo antes.",
      nodos: deSituacion.filter((n) => n.tipo === "ed" || n.tipo === "ec"),
      soluciones: <Solucion titulo="Cambio del antecedente" />,
    },
    {
      clave: "eslabones",
      titulo: "Eslabones",
      descripcion: "Sensación, pensamiento, emoción, impulso y acción, en orden.",
      nodos: [...deSituacion.filter((n) => n.tipo === "encubierta"), ...reglas],
      soluciones: null,
    },
    {
      clave: "conducta",
      titulo: "Conducta problema",
      descripcion: "La respuesta que se quiere sustituir.",
      nodos: [elegida],
      soluciones: <Solucion titulo="Conducta hábil">{deSituacion.filter((n) => n.tipo === "alternativa").map((n) => <div key={n.id}>{renderNodo(n)}</div>)}</Solucion>,
    },
    {
      clave: "consecuencias",
      titulo: "Consecuencias",
      descripcion: "Inmediatas y demoradas.",
      nodos: deSituacion.filter((n) => n.tipo === "consecuencia"),
      soluciones: <Solucion titulo="Consecuencia necesaria">{deSituacion.filter((n) => n.tipo === "consecuencia_alternativa").map((n) => <div key={n.id}>{renderNodo(n)}</div>)}</Solucion>,
    },
  ];

  return <div className="space-y-4">
    <div className="flex flex-wrap items-center gap-2 print:hidden"><span className="font-mono text-[10px] uppercase tracking-wide text-ink-muted">Conducta problema</span>{conductas.map((conducta) => <button key={conducta.id} type="button" aria-pressed={conducta.id === elegida.id} onClick={() => setIdElegido(conducta.id)} className="rounded-full border border-divider px-3 py-1 text-xs text-ink aria-pressed:border-accent aria-pressed:bg-accent/10 aria-pressed:text-accent">{conducta.etiqueta}</button>)}</div>
    <div className="rounded-xl border border-divider bg-canvas/40">
      {fases.map((fase) => <section key={fase.clave} className="grid gap-3 border-b border-divider p-3 last:border-b-0 md:grid-cols-[9rem_minmax(0,1fr)_minmax(0,1fr)]"><div><h4 className="font-serif text-base font-semibold text-ink">{fase.titulo}</h4><p className="mt-1 text-xs text-ink-muted">{fase.descripcion}</p></div><div className="relative space-y-2 border-l-2 border-accent/30 pl-4">{fase.nodos.length > 0 ? fase.nodos.map((n) => <div key={n.id}>{renderNodo(n)}{fase.clave === "eslabones" && <div className="mt-1">{analisis.capa_dbt.habilidades_sugeridas.filter((h) => h.eslabon_id === n.id).map((h, i) => <span key={i} className="mr-1 inline-block rounded-full bg-accent/10 px-2 py-0.5 text-[10px] text-accent">{h.habilidad}</span>)}</div>}</div>) : <p className="rounded border border-dashed border-divider p-3 text-xs text-ink-muted">Sin elementos registrados en esta fase.</p>}</div><div>{fase.soluciones ?? fase.nodos.map((n) => { const soluciones = analisis.capa_dbt.analisis_de_soluciones.filter((s) => s.eslabon_id === n.id); return <Solucion key={n.id} titulo={`Solución para ${n.etiqueta}`}>{soluciones.length > 0 ? soluciones.map((s) => s.alternativa_habil).join(" · ") : null}</Solucion>; })}</div></section>)}
    </div>
    {(analisis.capa_dbt.eslabon_ausente || analisis.capa_dbt.plan_de_reparacion) && <div className="grid gap-3 md:grid-cols-2">{analisis.capa_dbt.eslabon_ausente && <Solucion titulo="Eslabón ausente">{analisis.capa_dbt.eslabon_ausente}</Solucion>}{analisis.capa_dbt.plan_de_reparacion && <Solucion titulo="Plan de reparación">{analisis.capa_dbt.plan_de_reparacion}</Solucion>}</div>}
  </div>;
}
