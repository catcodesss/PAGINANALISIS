"use client";

import { procedenciaDe, ROTULOS_PROCEDENCIA } from "@/lib/procedencia";
import { numeroDeApoyoArista } from "@/lib/grafo";
import { ETIQUETA_APOYO_ARISTA } from "@/lib/apoyoAristas";
import type { AnalisisFuncional, ApoyoArista, EstadoProcedencia, Id } from "@/lib/types";
import s from "./afc.module.css";

/**
 * Procedencia y apoyo de una relación, en el vocabulario de la Ficha.
 *
 * LA PROCEDENCIA NO USA COLOR. El color ya significa apoyo en la nota (verde,
 * dorado, gris), así que quién tiene la última palabra se dice con borde y
 * marca: discontinuo y «IA» para lo que propuso la IA y nadie revisó; continuo
 * con ✓ para lo confirmado; continuo con ✎ para lo que escribió o cambió el
 * clínico. Un lector sin color distingue los cuatro por el texto.
 */

const MARCA: Record<EstadoProcedencia, string> = {
  propuesta: "IA",
  confirmado: "✓",
  editado: "✎",
  creado: "✎",
};

/** Muestra del trazo de una relación: punteado si es inferida, continuo si no. */
export function MuestraTrazo({ apoyo }: { apoyo: ApoyoArista }) {
  return (
    <svg width="22" height="8" viewBox="0 0 22 8" aria-hidden="true" className="inline-block flex-none align-middle text-ink-muted">
      <line
        x1="1"
        y1="4"
        x2="21"
        y2="4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap={apoyo === "inferido" ? "round" : "butt"}
        strokeDasharray={apoyo === "inferido" ? "0.1 4" : undefined}
      />
    </svg>
  );
}

/** El grado de apoyo de una relación, con su marca de color y su trazo. */
export function ApoyoRelacion({ apoyo }: { apoyo: ApoyoArista }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-ink">
      <span aria-hidden="true" data-apoyo={numeroDeApoyoArista(apoyo)} className={`${s.marcaApoyo} !h-1.5 !w-1.5 rounded-full`} />
      {ETIQUETA_APOYO_ARISTA[apoyo]}
    </span>
  );
}

export function InsigniaProcedencia({
  analisis,
  id,
  onConfirmar,
  className = "",
}: {
  analisis: Pick<AnalisisFuncional, "procedencia">;
  id: Id;
  /** Sin esto no hay botón: la vista de solo lectura enseña el estado y nada más. */
  onConfirmar?: () => void;
  className?: string;
}) {
  const p = procedenciaDe(analisis, id);
  const rotulo = ROTULOS_PROCEDENCIA[p.estado];
  const original =
    p.estado === "editado"
      ? p.original
        ? ` Texto original de la IA: ${p.original}`
        : " No se conserva el texto original de la IA."
      : "";
  return (
    <span className={`inline-flex flex-wrap items-center gap-2 ${className}`}>
      <span
        title={`${rotulo.frase}${original}`}
        data-procedencia={p.estado}
        className={`inline-flex items-center gap-1.5 rounded-full border bg-canvas px-2 py-0.5 text-[11px] text-ink-muted ${p.estado === "propuesta" ? "border-dashed border-ink-muted/60" : "border-solid border-ink-muted/60"}`}
      >
        <span aria-hidden="true" className="font-mono text-[10px] text-ink">{MARCA[p.estado]}</span>
        {rotulo.etiqueta}
      </span>
      {onConfirmar && (p.estado === "propuesta") && (
        <button
          type="button"
          onClick={onConfirmar}
          title="Lo revisaste y lo das por bueno. No cuenta como texto tuyo."
          className="rounded border border-divider px-2 py-0.5 text-[11px] text-ink hover:border-accent hover:text-accent"
        >
          Confirmar
        </button>
      )}
    </span>
  );
}
