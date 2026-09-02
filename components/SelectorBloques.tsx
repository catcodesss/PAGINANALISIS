"use client";

import { useEffect, useRef } from "react";
import { Check } from "lucide-react";
import { BLOQUES, IDS_TODOS, pesoDe, type CategoriaBloque } from "@/lib/bloques";

/** Orden fijo de categorías en el panel; no depende del orden de BLOQUES. */
const ORDEN_CATEGORIAS: CategoriaBloque[] = [
  "Descripción",
  "Análisis funcional",
  "Formulación y plan",
  "Capas de modalidad",
];

/**
 * Panel para elegir qué partes del informe generar.
 *
 * Por qué existe: generar el informe completo cuesta tokens y tiempo. Si el
 * clínico solo quiere las conductas problema o la lectura ACT de un caso, no
 * tiene sentido producir las tres capas de modalidad.
 *
 * Las dependencias entre secciones las resuelve lib/bloques.ts, no esta
 * interfaz: aquí solo se marcan bloques con sentido clínico, no campos sueltos.
 */

interface SelectorBloquesProps {
  seleccion: string[];
  onCambiar: (ids: string[]) => void;
  onGenerar: () => void;
  onCerrar: () => void;
  deshabilitado: boolean;
}

export default function SelectorBloques({
  seleccion,
  onCambiar,
  onGenerar,
  onCerrar,
  deshabilitado,
}: SelectorBloquesProps) {
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

  const alternar = (id: string) =>
    onCambiar(
      seleccion.includes(id) ? seleccion.filter((x) => x !== id) : [...seleccion, id]
    );

  const todos = seleccion.length === IDS_TODOS.length;
  const peso = pesoDe(seleccion);

  return (
    <div
      ref={panel}
      role="dialog"
      aria-label="Elegir partes del análisis"
      className="absolute bottom-full right-0 z-30 mb-2 w-[min(34rem,calc(100vw-2rem))] rounded-2xl border border-divider bg-surface p-5 shadow-xl"
    >
      <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-serif text-lg font-semibold text-ink">
          Elige qué generar
        </h3>
        <button
          type="button"
          onClick={() => onCambiar(todos ? [] : IDS_TODOS)}
          className="text-sm text-accent hover:underline"
        >
          {todos ? "Quitar todo" : "Seleccionar todo"}
        </button>
      </div>
      <p className="mb-4 text-sm leading-relaxed text-ink-muted">
        Generar menos secciones es más rápido y más barato. El resumen clínico y
        los datos faltantes se incluyen siempre.
      </p>

      <div className="mb-4 max-h-[50vh] space-y-3 overflow-y-auto">
        {ORDEN_CATEGORIAS.map((categoria) => {
          const bloquesCategoria = BLOQUES.filter((b) => b.categoria === categoria);
          if (bloquesCategoria.length === 0) return null;
          return (
            <div key={categoria}>
              <h4 className="mb-1 font-mono text-[11px] uppercase tracking-wide text-ink-muted">
                {categoria}
              </h4>
              <ul className="grid gap-1 sm:grid-cols-2">
                {bloquesCategoria.map((bloque) => {
                  const marcado = seleccion.includes(bloque.id);
                  return (
                    <li key={bloque.id}>
                      <button
                        type="button"
                        onClick={() => alternar(bloque.id)}
                        aria-pressed={marcado}
                        className={`flex w-full items-start gap-2.5 rounded-lg border p-2.5 text-left transition-colors ${
                          marcado
                            ? "border-accent/40 bg-accent-soft"
                            : "border-transparent hover:bg-canvas"
                        }`}
                      >
                        <span
                          aria-hidden="true"
                          className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                            marcado ? "border-accent bg-accent" : "border-divider bg-canvas"
                          }`}
                        >
                          {marcado && <Check className="h-3 w-3 text-white" />}
                        </span>
                        <span className="min-w-0">
                          <span className="block text-sm font-medium text-ink">
                            {bloque.etiqueta}
                          </span>
                          <span className="block text-xs leading-snug text-ink-muted">
                            {bloque.descripcion}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-divider pt-4">
        <p className="font-mono text-[11px] uppercase tracking-wide text-ink-muted">
          {seleccion.length === 0
            ? "Nada seleccionado"
            : `${seleccion.length} de ${IDS_TODOS.length} · ~${peso}% del informe`}
        </p>
        <button
          type="button"
          onClick={onGenerar}
          disabled={deshabilitado || seleccion.length === 0}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium texto-sobre-acento transition-colors hover:bg-accent/90 disabled:opacity-50"
        >
          Generar lo seleccionado
        </button>
      </div>
    </div>
  );
}
