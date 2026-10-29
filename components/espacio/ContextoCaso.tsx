"use client";

/**
 * Recuadro «Contexto del caso», arriba del nivel Caso del Mapa.
 *
 * Reúne lo que el análisis trae y que no es un nodo del grafo: el resumen
 * clínico, la hipótesis de origen, las fortalezas y las relaciones entre
 * problemas. Antes vivían en el raíl izquierdo («Historia» y «Contexto»); al
 * quitarlo solo salían al exportar. Aquí se leen; no se editan.
 *
 * Plegable y abierto por defecto. Si no hay nada que enseñar, no se pinta.
 */

import type { AnalisisFuncional } from "@/lib/types";

export default function ContextoCaso({ analisis }: { analisis: AnalisisFuncional }) {
  const resumen = analisis.resumen_clinico?.trim() ?? "";
  const origen = limpiar(analisis.hipotesis_origen);
  const fortalezas = limpiar(analisis.fortalezas_y_recursos);
  const relaciones = limpiar(analisis.formulacion?.relaciones_entre_problemas);

  if (!resumen && origen.length === 0 && fortalezas.length === 0 && relaciones.length === 0) return null;

  return (
    <details open className="group rounded-md border border-divider bg-surface" aria-label="Contexto del caso">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2 [&::-webkit-details-marker]:hidden">
        <span aria-hidden="true" className="text-xs text-ink-muted transition-transform group-open:rotate-90">
          ▸
        </span>
        <h3 className="font-mono text-[10px] uppercase tracking-wide text-ink-muted">Contexto del caso</h3>
      </summary>

      <div className="grid gap-4 border-t border-divider px-3 pb-3 pt-3 md:grid-cols-2">
        <div className="min-w-0 space-y-4">
          {resumen && (
            <Apartado titulo="Resumen clínico">
              <p className="text-sm leading-relaxed text-ink">{resumen}</p>
            </Apartado>
          )}
          {relaciones.length > 0 && (
            <Apartado titulo="Cómo se relacionan los problemas">
              <Lista items={relaciones} />
            </Apartado>
          )}
        </div>

        <div className="min-w-0 space-y-4">
          {origen.length > 0 && (
            <Apartado
              titulo="Cómo empezó (hipótesis de origen)"
              nota="No modificable · no genera blancos"
              ayuda="El origen explica cómo se adquirió el problema, no qué lo mantiene hoy. Los blancos salen de las hipótesis de mantenimiento."
            >
              <Lista items={origen} />
            </Apartado>
          )}
          {fortalezas.length > 0 && (
            <Apartado titulo="Fortalezas y recursos">
              <Lista items={fortalezas} />
            </Apartado>
          )}
        </div>
      </div>
    </details>
  );
}

function limpiar(lista: readonly string[] | undefined): string[] {
  return (lista ?? []).map((t) => t.trim()).filter(Boolean);
}

function Apartado({
  titulo,
  nota,
  ayuda,
  children,
}: {
  titulo: string;
  nota?: string;
  ayuda?: string;
  children: React.ReactNode;
}) {
  return (
    <section aria-label={titulo}>
      <h4 className="flex flex-wrap items-center gap-2 text-xs font-semibold text-ink">
        {titulo}
        {nota && (
          <span title={ayuda} className="rounded-full border border-divider bg-canvas px-2 py-0.5 font-mono text-[10px] font-normal uppercase tracking-wide text-ink-muted">
            {nota}
          </span>
        )}
      </h4>
      <div className="mt-1.5">{children}</div>
    </section>
  );
}

function Lista({ items }: { items: string[] }) {
  if (items.length === 1) return <p className="text-sm leading-relaxed text-ink">{items[0]}</p>;
  return (
    <ul className="list-disc space-y-1 pl-5 text-sm leading-relaxed text-ink">
      {items.map((t, i) => (
        <li key={i}>{t}</li>
      ))}
    </ul>
  );
}
