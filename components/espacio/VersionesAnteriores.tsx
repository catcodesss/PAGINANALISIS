"use client";

/**
 * «Versiones anteriores» del caso: un panel lateral para volver atrás.
 *
 * Cada vez que se sobrescribe una sesión, la versión anterior se conserva 30
 * días (lib/nube/almacenFirestore.ts). Aquí se ven con las palabras del
 * terapeuta (sesiones y fechas, no «partes») y se restaura con confirmación.
 * Restaurar no borra nada: lo que se sustituye también queda en la lista.
 */

import { useEffect, useState } from "react";
import { repositorioNube } from "@/lib/repositorio";
import type { GrupoVersiones, VersionAnterior } from "@/lib/repositorioNube";
import { dispositivoId } from "@/lib/nube/almacenFirestore";
import type { Expediente } from "@/lib/casos";

const CLASE_BOTON =
  "rounded border border-divider bg-surface px-3 py-1.5 text-sm text-ink transition-colors hover:bg-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 disabled:opacity-50";
const CLASE_PRINCIPAL =
  "rounded bg-accent px-3 py-1.5 text-sm font-medium texto-sobre-acento transition-colors hover:bg-accent/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 disabled:opacity-50";

function cuando(iso: string | null): string {
  if (!iso) return "Hace un momento";
  const d = new Date(iso);
  const dias = Math.round((new Date().setHours(0, 0, 0, 0) - new Date(iso).setHours(0, 0, 0, 0)) / 86_400_000);
  const hora = d.toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" });
  if (dias === 0) return `Hoy, ${hora}`;
  if (dias === 1) return `Ayer, ${hora}`;
  return `${d.toLocaleDateString("es", { day: "numeric", month: "short" })}, ${hora}`;
}

function fechaCorta(iso: string): string {
  return new Date(iso).toLocaleDateString("es", { day: "numeric", month: "short" });
}

export default function VersionesAnteriores({
  casoId,
  onCerrar,
  onRestaurado,
}: {
  casoId: string;
  onCerrar: () => void;
  onRestaurado: (expediente: Expediente) => void;
}) {
  const [grupos, setGrupos] = useState<GrupoVersiones[] | null>(null);
  const [abierto, setAbierto] = useState<string | null>(null);
  const [elegida, setElegida] = useState<{ grupo: GrupoVersiones; version: VersionAnterior } | null>(null);
  const [confirmando, setConfirmando] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState("");
  const [hecho, setHecho] = useState("");
  const [recarga, setRecarga] = useState(0);
  const propio = dispositivoId();

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const lista = (await repositorioNube()?.versionesAnteriores(casoId)) ?? [];
        if (!vivo) return;
        setGrupos(lista);
        // Lo más urgente (una sesión que no se lee) ya sale desplegado.
        setAbierto((previo) => previo ?? lista.find((g) => g.ilegible)?.parte_id ?? lista[0]?.parte_id ?? null);
      } catch (e) {
        if (vivo) {
          setGrupos([]);
          setError(e instanceof Error ? e.message : "No se pudieron cargar las versiones anteriores.");
        }
      }
    })();
    return () => {
      vivo = false;
    };
  }, [casoId, recarga]);

  useEffect(() => {
    function escape(e: KeyboardEvent) {
      if (e.key === "Escape" && !ocupado) onCerrar();
    }
    document.addEventListener("keydown", escape);
    return () => document.removeEventListener("keydown", escape);
  }, [onCerrar, ocupado]);

  async function restaurar() {
    if (!elegida) return;
    setOcupado(true);
    setError("");
    try {
      const expediente = await repositorioNube()!.restaurarParte(casoId, elegida.grupo.parte_id, elegida.version.historial_id);
      if (expediente) onRestaurado(expediente);
      setHecho(`${elegida.grupo.etiqueta} restaurada. La versión anterior sigue en esta lista.`);
      setElegida(null);
      setConfirmando(false);
      setRecarga((n) => n + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo restaurar esta versión.");
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 print:hidden">
      <div className="absolute inset-0 bg-ink/20" onClick={() => !ocupado && onCerrar()} aria-hidden="true" />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Versiones anteriores"
        className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col border-l border-divider bg-surface shadow-xl"
      >
        <header className="flex items-center justify-between border-b border-divider px-5 py-3.5">
          <h2 className="font-serif text-lg font-semibold text-ink">Versiones anteriores</h2>
          <button
            type="button"
            onClick={onCerrar}
            disabled={ocupado}
            aria-label="Cerrar"
            className="rounded px-2 text-xl leading-none text-ink-muted hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
          >
            ×
          </button>
        </header>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <p className="text-sm text-ink-muted">
            Cada vez que se sobrescribe una sesión, la versión anterior se conserva <b className="font-medium text-ink">30 días</b>.
            Restaurar no borra nada: la versión actual también queda aquí.
          </p>

          {hecho && (
            <p role="status" className="rounded-md border border-divider bg-canvas px-3 py-2 text-sm text-ink">
              ✓ {hecho}
            </p>
          )}
          {error && (
            <p role="alert" className="text-sm text-warn">
              {error}
            </p>
          )}

          {grupos === null && <p className="text-sm text-ink-muted">Cargando…</p>}
          {grupos?.length === 0 && !error && (
            <p className="rounded-md border border-dashed border-divider px-4 py-6 text-center text-sm text-ink-muted">
              Todavía no hay versiones anteriores. Aparecerán cuando se edite una sesión ya guardada.
            </p>
          )}

          {grupos && grupos.length > 0 && (
            <>
              <p className="font-mono text-[10px] uppercase tracking-wide text-ink-muted">Qué se puede recuperar</p>
              <ul className="space-y-2.5">
                {grupos.map((g) => {
                  const desplegado = abierto === g.parte_id;
                  return (
                    <li key={g.parte_id} className="overflow-hidden rounded-lg border border-divider">
                      <button
                        type="button"
                        aria-expanded={desplegado}
                        onClick={() => setAbierto(desplegado ? null : g.parte_id)}
                        className="flex w-full items-center justify-between gap-3 bg-canvas px-3.5 py-2.5 text-left hover:bg-canvas/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent/40"
                      >
                        <span className="min-w-0 text-sm text-ink">
                          <span className="font-medium">{g.etiqueta}</span>
                          {g.fecha && <span className="text-ink-muted"> · {fechaCorta(g.fecha)}</span>}
                          {g.ilegible && (
                            <span className="ml-2 rounded-full border border-warn px-2 py-0.5 text-[11px] text-warn">
                              ▲ No se puede leer
                            </span>
                          )}
                        </span>
                        <span className="shrink-0 text-xs text-ink-muted">
                          {g.versiones.length} {g.versiones.length === 1 ? "versión" : "versiones"} {desplegado ? "▴" : "▾"}
                        </span>
                      </button>
                      {desplegado && (
                        <ul className="divide-y divide-divider border-t border-divider">
                          {g.versiones.length === 0 && (
                            <li className="px-3.5 py-3 text-sm text-ink-muted">
                              No hay una versión anterior guardada de esta parte.
                            </li>
                          )}
                          {g.versiones.map((v) => {
                            const marcada = elegida?.version.historial_id === v.historial_id;
                            return (
                              <li key={v.historial_id}>
                                <label className="flex cursor-pointer items-center gap-3 px-3.5 py-2.5 hover:bg-canvas">
                                  <input
                                    type="radio"
                                    name="version"
                                    checked={marcada}
                                    onChange={() => {
                                      setElegida({ grupo: g, version: v });
                                      setConfirmando(false);
                                      setHecho("");
                                    }}
                                    className="accent-accent"
                                  />
                                  <span className="text-sm text-ink">
                                    {cuando(v.archivado_en)}
                                    <small className="block text-xs text-ink-muted">
                                      {v.dispositivo_id && v.dispositivo_id !== propio ? "Desde otro dispositivo" : "Desde este dispositivo"}
                                    </small>
                                  </span>
                                </label>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </li>
                  );
                })}
              </ul>
            </>
          )}

          {confirmando && elegida && (
            <div role="alertdialog" aria-label="Confirmar restauración" className="rounded-lg border border-accent/40 bg-accent/5 p-3.5">
              <p className="mb-3 text-sm text-ink">
                <b className="font-medium">¿Volver a la versión de {cuando(elegida.version.archivado_en).toLowerCase()}?</b>
                <br />
                {elegida.grupo.etiqueta} quedará como estaba entonces. La versión actual se guarda en esta lista durante
                30 días, así que puedes deshacerlo.
              </p>
              <div className="flex gap-2">
                <button type="button" onClick={restaurar} disabled={ocupado} className={CLASE_PRINCIPAL}>
                  {ocupado ? "Restaurando…" : "Sí, restaurar"}
                </button>
                <button type="button" onClick={() => setConfirmando(false)} disabled={ocupado} className={CLASE_BOTON}>
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>

        <footer className="flex justify-end gap-2 border-t border-divider px-5 py-3">
          <button type="button" onClick={onCerrar} disabled={ocupado} className={CLASE_BOTON}>
            Cerrar
          </button>
          <button
            type="button"
            onClick={() => setConfirmando(true)}
            disabled={!elegida || confirmando || ocupado}
            className={CLASE_PRINCIPAL}
          >
            Restaurar esta versión…
          </button>
        </footer>
      </aside>
    </div>
  );
}
