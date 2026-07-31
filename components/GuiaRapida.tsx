"use client";

import { useEffect, useState } from "react";
import { ArrowRight, X } from "lucide-react";
import {
  BloqueComoSeLee,
  BloqueElInforme,
  BloqueLosLimites,
  BloqueQueEscribir,
} from "./guiaContenido";

/**
 * Guía rápida: los cuatro pasos en un modal, paso a paso.
 *
 * El contenido vive en guiaContenido.tsx y es el mismo que muestra la guía de
 * uso completa. Aquí solo cambia el envoltorio: allí se lee del tirón, aquí se
 * avanza de uno en uno sin salir de la pantalla de análisis.
 */

interface GuiaRapidaProps {
  onCerrar: () => void;
  onVerCompleta?: () => void;
}

const PASOS = [
  { titulo: "Qué escribir", Bloque: BloqueQueEscribir },
  { titulo: "Cómo se lee", Bloque: BloqueComoSeLee },
  { titulo: "El informe", Bloque: BloqueElInforme },
  { titulo: "Los límites", Bloque: BloqueLosLimites },
];

export default function GuiaRapida({ onCerrar, onVerCompleta }: GuiaRapidaProps) {
  const [paso, setPaso] = useState(0);
  const Actual = PASOS[paso].Bloque;

  useEffect(() => {
    const alPulsar = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCerrar();
      if (e.key === "ArrowRight") setPaso((p) => Math.min(p + 1, PASOS.length - 1));
      if (e.key === "ArrowLeft") setPaso((p) => Math.max(p - 1, 0));
    };
    document.addEventListener("keydown", alPulsar);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", alPulsar);
      document.body.style.overflow = "";
    };
  }, [onCerrar]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4 print:hidden"
      onClick={onCerrar}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Guía rápida"
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-divider bg-surface shadow-xl"
      >
        <header className="flex items-center justify-between border-b border-divider px-6 py-4">
          <h2 className="font-serif text-xl font-semibold text-ink">Guía rápida</h2>
          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-muted transition-colors hover:bg-canvas hover:text-ink"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </header>

        <nav className="flex flex-wrap gap-1 border-b border-divider px-6 py-3">
          {PASOS.map(({ titulo }, i) => (
            <button
              key={titulo}
              type="button"
              onClick={() => setPaso(i)}
              className={`rounded-lg px-3 py-1.5 font-mono text-[11px] uppercase tracking-wide transition-colors ${
                i === paso
                  ? "bg-accent text-white"
                  : "text-ink-muted hover:bg-canvas hover:text-ink"
              }`}
            >
              {i + 1}. {titulo}
            </button>
          ))}
        </nav>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
          <Actual />
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-divider px-6 py-4">
          <div className="flex items-center gap-4">
            <div className="flex gap-1.5" aria-hidden="true">
              {PASOS.map(({ titulo }, i) => (
                <span
                  key={titulo}
                  className={`h-1.5 w-1.5 rounded-full ${
                    i === paso ? "bg-accent" : "bg-divider"
                  }`}
                />
              ))}
            </div>
            {onVerCompleta && (
              <button
                type="button"
                onClick={onVerCompleta}
                className="text-sm text-accent hover:underline"
              >
                Ver guía completa
              </button>
            )}
          </div>
          {paso < PASOS.length - 1 ? (
            <button
              type="button"
              onClick={() => setPaso(paso + 1)}
              className="flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent/90"
            >
              Siguiente
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
          ) : (
            <button
              type="button"
              onClick={onCerrar}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent/90"
            >
              Empezar
            </button>
          )}
        </footer>
      </div>
    </div>
  );
}
