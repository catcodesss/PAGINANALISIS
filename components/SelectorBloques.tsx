"use client";

import { useEffect, useRef } from "react";
import { SECCIONES_INFORME, type IdSeccion } from "@/lib/secciones";
import { usePestanasOcultas } from "./usePestanasOcultas";

/**
 * Panel para elegir qué pestañas del informe se ven.
 *
 * Antes también dejaba elegir qué bloques generar. Esa lista se quitó: no
 * correspondía a lo que el informe enseña desde la reorganización en pestañas,
 * y se genera siempre el informe completo. `lib/bloques.ts` y el parámetro
 * `bloques` de /api/analizar siguen ahí, sin cambios, para los reanálisis
 * parciales.
 *
 * Las pestañas se guardan al instante, sin pasar por «Generar»: son una
 * preferencia de lectura y el informe abierto las refleja en vivo.
 */

interface SelectorBloquesProps {
  onCerrar: () => void;
}

export default function SelectorBloques({ onCerrar }: SelectorBloquesProps) {
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fuera = (e: MouseEvent) => {
      if (panel.current && !panel.current.contains(e.target as Node)) onCerrar();
    };
    const escape = (e: KeyboardEvent) => e.key === "Escape" && onCerrar();
    document.addEventListener("mousedown", fuera);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("mousedown", fuera);
      document.removeEventListener("keydown", escape);
    };
  }, [onCerrar]);

  const { ocultas, guardar } = usePestanasOcultas();
  const total = SECCIONES_INFORME.length;

  const alternar = (id: IdSeccion) => {
    if (ocultas.includes(id)) return guardar(ocultas.filter((x) => x !== id));
    // Al menos una pestaña tiene que quedar a la vista.
    if (ocultas.length < total - 1) guardar([...ocultas, id]);
  };

  return (
    <div
      ref={panel}
      role="dialog"
      aria-label="Elegir qué pestañas mostrar"
      className="absolute bottom-full right-0 z-30 mb-2 w-[min(26rem,calc(100vw-2rem))] rounded-2xl border border-divider bg-surface p-5 shadow-xl"
    >
      <h3 className="font-serif text-lg font-semibold text-ink">Elige qué mostrar</h3>
      <p className="mb-4 mt-1 text-sm leading-relaxed text-ink-muted">
        Activa o desactiva las pestañas del informe. Solo cambia lo que ves: el
        informe impreso o copiado las incluye todas.
      </p>

      <ul className="space-y-1">
        {SECCIONES_INFORME.map((s) => {
          const activa = !ocultas.includes(s.id);
          return (
            <li key={s.id}>
              <button
                type="button"
                role="switch"
                aria-checked={activa}
                onClick={() => alternar(s.id)}
                className="flex w-full items-center justify-between gap-3 rounded-lg border border-transparent px-3 py-2.5 text-left transition-colors hover:bg-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
              >
                <span className="text-sm font-medium text-ink">{s.titulo}</span>
                <span
                  aria-hidden="true"
                  className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${
                    activa ? "bg-accent" : "bg-divider"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${
                      activa ? "left-[1.125rem]" : "left-0.5"
                    }`}
                  />
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <p className="mt-3 border-t border-divider pt-3 font-mono text-[11px] uppercase tracking-wide text-ink-muted">
        {total - ocultas.length} de {total} visibles
      </p>
    </div>
  );
}
