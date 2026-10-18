"use client";

/**
 * Botón «de dónde sale esto»: abre una ventana con la frase literal de la nota
 * que sostiene un nodo o una relación, y un atajo para verla subrayada en la
 * Fuente. Solo recibe citas verificadas: lo que el modelo no pudo anclar a una
 * línea de la nota no se entrecomilla nunca (invariante 2).
 *
 * La ventana va en un portal y con posición fija: el tablero hace scroll
 * horizontal y recortaría un popover colocado dentro de la columna.
 */

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { etiquetaCita, type CitaVerificadaResuelta } from "@/lib/citas";

export interface FuenteCita {
  cita: CitaVerificadaResuelta;
  /** La unió el clínico a mano, no el modelo. */
  tuya?: boolean;
}

interface Posicion {
  indice: number;
  izquierda: number;
  arriba?: number;
  abajo?: number;
}

const ANCHO = 288;
const ALTO_ESTIMADO = 170;

export default function CitaEmergente({
  fuentes,
  onVerEnNota,
  className = "",
}: {
  fuentes: readonly FuenteCita[];
  onVerEnNota: (cita: CitaVerificadaResuelta) => void;
  className?: string;
}) {
  const [abierta, setAbierta] = useState<Posicion | null>(null);

  useEffect(() => {
    if (!abierta) return;
    const cerrar = () => setAbierta(null);
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") cerrar();
    };
    window.addEventListener("keydown", tecla);
    window.addEventListener("resize", cerrar);
    window.addEventListener("scroll", cerrar, true);
    return () => {
      window.removeEventListener("keydown", tecla);
      window.removeEventListener("resize", cerrar);
      window.removeEventListener("scroll", cerrar, true);
    };
  }, [abierta]);

  if (fuentes.length === 0) return null;

  const abrir = (indice: number, boton: HTMLElement) => {
    const r = boton.getBoundingClientRect();
    const izquierda = Math.max(8, Math.min(r.left, window.innerWidth - ANCHO - 8));
    // Si abajo no cabe, la ventana se abre hacia arriba del botón.
    if (window.innerHeight - r.bottom < ALTO_ESTIMADO + 12) {
      setAbierta({ indice, izquierda, abajo: window.innerHeight - r.top + 6 });
    } else {
      setAbierta({ indice, izquierda, arriba: r.bottom + 6 });
    }
  };

  const actual = abierta ? fuentes[abierta.indice] : undefined;

  return (
    <>
      {fuentes.map((f, i) => (
        <button
          key={i}
          type="button"
          aria-haspopup="dialog"
          aria-expanded={abierta?.indice === i}
          onClick={(e) => (abierta?.indice === i ? setAbierta(null) : abrir(i, e.currentTarget))}
          className={`rounded-full border border-divider px-2 py-0.5 text-xs text-ink-muted hover:border-accent hover:text-accent aria-expanded:border-accent aria-expanded:text-accent ${className}`}
        >
          {f.tuya ? "Tu cita" : "Fuente"} · {etiquetaCita(f.cita)}
        </button>
      ))}
      {abierta && actual &&
        createPortal(
          <>
            <button type="button" aria-label="Cerrar" tabIndex={-1} onClick={() => setAbierta(null)} className="fixed inset-0 z-40 cursor-default bg-transparent" />
            <div
              role="dialog"
              aria-label="Origen de la cita"
              style={{ left: abierta.izquierda, top: abierta.arriba, bottom: abierta.abajo, width: ANCHO }}
              className="fixed z-50 rounded-lg border border-divider bg-surface p-3 text-sm shadow-lg"
            >
              <p className="font-mono text-xs uppercase tracking-wide text-ink-muted">
                En la nota · {etiquetaCita(actual.cita)}{actual.tuya ? " · cita tuya" : ""}
              </p>
              <blockquote className="mt-1.5 leading-snug text-ink">«{actual.cita.texto}»</blockquote>
              <div className="mt-3 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const cita = actual.cita;
                    setAbierta(null);
                    onVerEnNota(cita);
                  }}
                  className="rounded border border-divider px-2.5 py-1 text-xs text-accent hover:bg-canvas"
                >
                  Ver en la nota
                </button>
                <button type="button" onClick={() => setAbierta(null)} className="text-xs text-ink-muted hover:text-ink">
                  Cerrar
                </button>
              </div>
            </div>
          </>,
          document.body
        )}
    </>
  );
}
