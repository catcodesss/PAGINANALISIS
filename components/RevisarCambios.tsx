"use client";

/**
 * Revisar cambios (fase 8C): las propuestas de la sesión N, agrupadas por
 * hipótesis o blanco. Nada se aplica hasta «Aplicar», y solo lo aceptado.
 * La evidencia se puede aceptar en lote; los cambios de estado y de
 * estructura, uno a uno.
 */

import { useState } from "react";
import type { AnalisisFuncional } from "@/lib/types";
import {
  aceptableEnLote,
  SIMBOLO_OPERACION,
  type Aceptada,
  type ConjuntoCambios,
  type Objetivo,
  type Propuesta,
} from "@/lib/actualizacion";
import { ETIQUETA_ESTADO_HIPOTESIS } from "@/lib/preguntas";
import { construirNodosGrafo } from "@/lib/grafo";

/** Una hipótesis sin origen nombrado se lee por su función. */
function rotuloHipotesis(h: { origen: string; funcion: string; conducta: string }) {
  return `${h.origen.trim() || h.funcion} → ${h.conducta}`;
}

type Decision = "aceptar" | "rechazar";

function recorte(t: string | undefined, max = 70) {
  const s = (t ?? "").trim();
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

function etiquetaObjetivo(a: AnalisisFuncional, o: Objetivo | null): string {
  if (!o) return "";
  const buscar = <T extends { id: string }>(l: readonly T[]) => l.find((x) => x.id === o.id);
  switch (o.tipo) {
    case "conducta":
      return recorte(buscar(a.conductas_problema)?.descripcion);
    case "hipotesis": {
      const h = buscar(a.hipotesis_mantenimiento);
      return recorte(h ? rotuloHipotesis(h) : "");
    }
    case "rival":
      return recorte(buscar(a.hipotesis_alternativas)?.enunciado);
    case "pregunta":
      return recorte(buscar(a.preguntas)?.texto);
    case "situacion":
      return recorte(buscar(a.situaciones)?.nombre);
    case "blanco":
      return recorte(a.conductas_problema.find((c) => c.id === buscar(a.blancos ?? [])?.conducta_ids[0])?.descripcion);
    case "relacion": {
      const r = a.aristas.find((x) => x.id === o.id);
      const nodos = construirNodosGrafo(a);
      const nombre = (id?: string) => nodos.find((n) => n.id === id)?.etiqueta ?? "";
      return r ? recorte(`${nombre(r.desde)} → ${nombre(r.hasta)}`) : o.ref;
    }
    default:
      return o.ref;
  }
}

function estado(e: string | undefined) {
  return (ETIQUETA_ESTADO_HIPOTESIS as Record<string, string>)[e ?? ""] ?? (e ?? "").replace(/_/g, " ");
}

function resumen(a: AnalisisFuncional, p: Propuesta): string {
  const obj = etiquetaObjetivo(a, p.objetivo);
  switch (p.op) {
    case "añadir_evidencia":
      return `${p.postura === "en_contra" ? "En contra" : "A favor"} · ${obj}`;
    case "marcar_contradiccion":
      return `⊘ ${obj}`;
    case "proponer_estado":
      return `${obj} · ${estado(p.antes)} → ${estado(p.estado)}`;
    case "modificar":
      return `${obj} · ${p.campo?.replace(/_/g, " ")}`;
    case "crear":
      return "Conducta nueva";
    case "responder":
      return `${obj} · ${estado(p.estado)}`;
    case "nueva_pregunta":
      return "Pregunta nueva";
  }
}

function tituloGrupo(a: AnalisisFuncional, grupo: string | null): string {
  if (!grupo) return "Otros";
  const h = a.hipotesis_mantenimiento.find((x) => x.id === grupo);
  if (h) return recorte(rotuloHipotesis(h), 80);
  const b = (a.blancos ?? []).find((x) => x.id === grupo);
  if (b) return `Blanco · ${recorte(a.conductas_problema.find((c) => c.id === b.conducta_ids[0])?.descripcion, 70)}`;
  return "Otros";
}

const CLASE_ICONO =
  "flex h-7 w-7 items-center justify-center rounded border text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40";

export default function RevisarCambios({
  analisis,
  conjunto,
  onAplicar,
  onCancelar,
}: {
  analisis: AnalisisFuncional;
  conjunto: ConjuntoCambios;
  onAplicar: (aceptadas: Aceptada[]) => void;
  onCancelar: () => void;
}) {
  const [decisiones, setDecisiones] = useState<Record<string, Decision>>({});
  const [ediciones, setEdiciones] = useState<Record<string, string>>({});
  const [editando, setEditando] = useState<string | null>(null);

  const grupos = new Map<string | null, Propuesta[]>();
  for (const p of conjunto.propuestas) grupos.set(p.grupo, [...(grupos.get(p.grupo) ?? []), p]);

  // Pulsar otra vez la misma decisión la deshace: vuelve a pendiente.
  const decidir = (id: string, d: Decision) =>
    setDecisiones((x) => {
      const siguiente = { ...x };
      if (x[id] === d) delete siguiente[id];
      else siguiente[id] = d;
      return siguiente;
    });
  const loteEvidencia = conjunto.propuestas.filter((p) => aceptableEnLote(p) && !decisiones[p.id]);
  const aceptadas = conjunto.propuestas.filter((p) => decisiones[p.id] === "aceptar");
  const confirmadosAfectados = new Set(aceptadas.filter((p) => p.toca_confirmado).map((p) => p.objetivo?.id)).size;
  const descartadas = Object.values(conjunto.descartadas).reduce((s, n) => s + (n ?? 0), 0);

  return (
    <div role="dialog" aria-modal="true" aria-label="Revisar cambios" className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 print:hidden">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-xl border border-divider bg-surface">
        <header className="flex items-center gap-3 border-b border-divider px-5 py-3">
          <p className="font-serif text-lg font-semibold text-ink">Sesión {conjunto.sesion} · cambios</p>
          {loteEvidencia.length > 0 && (
            <button
              type="button"
              onClick={() => setDecisiones((x) => ({ ...x, ...Object.fromEntries(loteEvidencia.map((p) => [p.id, "aceptar"])) }))}
              className="ml-auto rounded border border-divider px-3 py-1 text-xs font-medium text-ink hover:bg-canvas"
            >
              ✓ Evidencia ({loteEvidencia.length})
            </button>
          )}
        </header>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {conjunto.propuestas.length === 0 && (
            <p className="text-sm text-ink-muted">Nada que cambiar con esta nota.</p>
          )}
          {[...grupos.entries()].map(([grupo, lista]) => (
            <section key={grupo ?? "otros"}>
              <p className="mb-1.5 font-mono text-[10px] uppercase tracking-wide text-ink-muted">{tituloGrupo(analisis, grupo)}</p>
              <ul className="space-y-1.5">
                {lista.map((p) => {
                  const d = decisiones[p.id];
                  const editable = p.valor !== undefined;
                  const valor = ediciones[p.id] ?? p.valor;
                  return (
                    <li
                      key={p.id}
                      className={`rounded border px-3 py-2 ${d === "aceptar" ? "border-accent bg-accent/5" : d === "rechazar" ? "border-divider opacity-50" : "border-divider"}`}
                    >
                      <div className="flex items-start gap-2">
                        <span aria-hidden="true" className="w-4 shrink-0 text-center font-mono text-ink">{SIMBOLO_OPERACION[p.op]}</span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm text-ink">
                            {resumen(analisis, p)}
                            {p.toca_confirmado && (
                              <span title="Toca un elemento confirmado" className="ml-1.5 text-warn">●</span>
                            )}
                          </p>
                          {editable &&
                            (editando === p.id ? (
                              <textarea
                                value={valor}
                                onChange={(e) => setEdiciones((x) => ({ ...x, [p.id]: e.target.value }))}
                                onBlur={() => setEditando(null)}
                                rows={2}
                                autoFocus
                                className="mt-1 w-full rounded border border-divider bg-canvas px-2 py-1 text-sm text-ink"
                              />
                            ) : (
                              <p className="mt-0.5 text-sm text-ink">
                                {valor}
                                {ediciones[p.id] !== undefined && ediciones[p.id] !== p.valor && (
                                  <span className="ml-1 font-mono text-[10px] uppercase text-ink-muted">tuyo</span>
                                )}
                              </p>
                            ))}
                          {p.citas.map((c, i) => (
                            <p key={i} className="mt-0.5 text-xs italic text-ink-muted">
                              {p.frases[i]} · &quot;{c.texto}&quot;
                            </p>
                          ))}
                          {p.justificacion && <p className="mt-0.5 text-xs text-ink-muted">{p.justificacion}</p>}
                        </div>
                        <div className="flex shrink-0 gap-1">
                          <button type="button" aria-label="Aceptar" aria-pressed={d === "aceptar"} onClick={() => decidir(p.id, "aceptar")} className={`${CLASE_ICONO} ${d === "aceptar" ? "border-accent text-accent" : "border-divider text-ink-muted hover:text-ink"}`}>✓</button>
                          <button type="button" aria-label="Rechazar" aria-pressed={d === "rechazar"} onClick={() => decidir(p.id, "rechazar")} className={`${CLASE_ICONO} ${d === "rechazar" ? "border-ink text-ink" : "border-divider text-ink-muted hover:text-ink"}`}>✕</button>
                          {editable && (
                            <button type="button" aria-label="Editar" onClick={() => setEditando(p.id)} className={`${CLASE_ICONO} border-divider text-ink-muted hover:text-ink`}>✎</button>
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>

        <footer className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-divider px-5 py-3">
          <p className="flex flex-wrap gap-3 font-mono text-[11px] text-ink-muted">
            <span title="Frases de la nota que ninguna propuesta usa">◌ {conjunto.frases_sin_usar.length} sin usar</span>
            <span title="Elementos confirmados que cambiarían">● {confirmadosAfectados}</span>
            {conjunto.alertas_nuevas.length > 0 && (
              <span title="Alertas nuevas si se acepta todo" className="text-warn">▲ {conjunto.alertas_nuevas.length}</span>
            )}
            {descartadas > 0 && <span title="Propuestas inválidas del modelo, descartadas">✕ {descartadas}</span>}
          </p>
          <div className="ml-auto flex gap-2">
            <button type="button" onClick={onCancelar} className="rounded border border-divider px-4 py-1.5 text-sm font-medium text-ink hover:bg-canvas">
              Cancelar
            </button>
            <button
              type="button"
              onClick={() =>
                onAplicar(aceptadas.map((propuesta) => ({ propuesta, valorEditado: ediciones[propuesta.id] })))
              }
              className="rounded bg-accent px-4 py-1.5 text-sm font-medium texto-sobre-acento hover:bg-accent/90"
            >
              Aplicar ({aceptadas.length})
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
