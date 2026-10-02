"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Check,
  FileText,
  Lightbulb,
  ListChecks,
  RefreshCw,
  SlidersHorizontal,
  X,
  type LucideIcon,
} from "lucide-react";
import { SECCIONES_INFORME, type IdSeccion } from "@/lib/secciones";

const ICONOS: Record<IdSeccion, LucideIcon> = {
  "que-pasa": FileText,
  sintesis: ListChecks,
  mantenimiento: Lightbulb,
  plan: SlidersHorizontal,
  pendientes: RefreshCw,
};

/**
 * Elegir qué pestañas se ven. Es solo de lectura: lo oculto sigue en el informe
 * impreso, copiado y exportado. Por eso el modal lo dice con una línea corta y
 * no solo con el título.
 */
export function ElegirPestanas({
  ocultas,
  onGuardar,
}: {
  ocultas: IdSeccion[];
  onGuardar: (ocultas: IdSeccion[]) => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const [borrador, setBorrador] = useState<IdSeccion[]>(ocultas);
  const boton = useRef<HTMLButtonElement>(null);
  const cerrar = useRef<HTMLButtonElement>(null);

  function abrir() {
    setBorrador(ocultas);
    setAbierto(true);
  }

  function cerrarModal() {
    setAbierto(false);
    boton.current?.focus();
  }

  useEffect(() => {
    if (!abierto) return;
    cerrar.current?.focus();
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === "Escape") cerrarModal();
    };
    document.addEventListener("keydown", alTeclear);
    return () => document.removeEventListener("keydown", alTeclear);
  }, [abierto]);

  const total = SECCIONES_INFORME.length;
  const visibles = total - borrador.length;

  function alternar(id: IdSeccion) {
    setBorrador((actual) => {
      if (actual.includes(id)) return actual.filter((x) => x !== id);
      // Al menos una pestaña tiene que quedar a la vista.
      return actual.length >= total - 1 ? actual : [...actual, id];
    });
  }

  return (
    <>
      <button
        ref={boton}
        type="button"
        onClick={abrir}
        aria-haspopup="dialog"
        className="my-1 flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm text-ink-muted transition-colors hover:bg-canvas hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
      >
        <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
        Elegir pestañas
        {ocultas.length > 0 && (
          <span className="rounded-full bg-accent-soft px-1.5 py-0.5 font-mono text-[10px] font-bold text-accent">
            {total - ocultas.length}/{total}
          </span>
        )}
      </button>

      {abierto &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4 print:hidden"
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) cerrarModal();
            }}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="titulo-elegir-pestanas"
              className="w-full max-w-lg rounded-2xl border border-divider bg-surface p-6 shadow-xl"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2
                    id="titulo-elegir-pestanas"
                    className="font-serif text-2xl font-semibold text-ink"
                  >
                    Elige qué mostrar
                  </h2>
                  <p className="mt-1 text-sm text-ink-muted">
                    Activa o desactiva las pestañas que deseas mostrar.
                  </p>
                </div>
                <button
                  ref={cerrar}
                  type="button"
                  onClick={cerrarModal}
                  aria-label="Cerrar"
                  className="rounded-lg p-1.5 text-ink-muted transition-colors hover:bg-canvas hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
                >
                  <X className="h-5 w-5" aria-hidden="true" />
                </button>
              </div>

              <ul className="mt-5 space-y-2">
                {SECCIONES_INFORME.map((s) => {
                  const Icono = ICONOS[s.id];
                  const activa = !borrador.includes(s.id);
                  return (
                    <li key={s.id}>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={activa}
                        onClick={() => alternar(s.id)}
                        className="flex w-full items-center gap-3 rounded-xl border border-divider bg-canvas px-4 py-3 text-left transition-colors hover:border-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
                      >
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
                          <Icono className="h-4 w-4" aria-hidden="true" />
                        </span>
                        <span className="flex-1 font-serif text-base font-semibold text-ink">
                          {s.titulo}
                        </span>
                        <span
                          aria-hidden="true"
                          className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
                            activa ? "bg-accent" : "bg-divider"
                          }`}
                        >
                          <span
                            className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
                              activa ? "left-[1.375rem]" : "left-0.5"
                            }`}
                          />
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>

              <p className="mt-3 text-xs text-ink-muted">
                Solo cambia lo que ves: el informe impreso o copiado las incluye todas.
              </p>

              <div className="mt-4 flex items-center justify-between gap-4">
                <p className="text-sm text-ink-muted" aria-live="polite">
                  {visibles} de {total} visibles
                </p>
                <button
                  type="button"
                  onClick={() => {
                    onGuardar(borrador);
                    cerrarModal();
                  }}
                  className="flex items-center gap-2 rounded-lg bg-accent px-5 py-2.5 text-sm font-medium texto-sobre-acento transition-colors hover:bg-accent/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
                >
                  <Check className="h-4 w-4" aria-hidden="true" />
                  Guardar cambios
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
