import type { Alerta } from "@/lib/types";
import { gravedadMayor } from "@/lib/alertasNodo";
import { traducirMensajeAlerta } from "@/lib/gradoApoyo";

/*
  El aviso, sobre el elemento al que se refiere. Antes la alerta más grave del
  caso de ejemplo —la alternativa que prescribe respirar, que en esa nota es la
  conducta de seguridad— solo se leía en Plan y en Revisión, y el nodo se veía
  limpio en las tres vistas del grafo.

  Sin rojo (MARCA.md): la gravedad va en la forma, el relleno y el texto, y el
  color es el mismo ámbar en las dos. Alta: insignia rellena con ▲. Media:
  contorno con ◆. El texto se lee sin color.
*/

const ROTULO = {
  alta: { marca: "▲", texto: "Revisar antes de usar" },
  media: { marca: "◆", texto: "Conviene revisar" },
} as const;

export function InsigniaAlerta({ alertas, className = "" }: { alertas: readonly Alerta[]; className?: string }) {
  const gravedad = gravedadMayor(alertas);
  if (!gravedad) return null;
  const { marca, texto } = ROTULO[gravedad];
  const resto = alertas.length > 1 ? ` · ${alertas.length} avisos` : "";
  return (
    <span
      title={alertas.map((a) => traducirMensajeAlerta(a.mensaje)).join("\n\n")}
      className={`inline-flex max-w-full items-center gap-1 rounded-full px-2 py-0.5 font-sans text-[10px] font-semibold leading-tight ${
        gravedad === "alta" ? "bg-warn text-surface" : "border border-warn text-warn"
      } ${className}`}
    >
      <span aria-hidden="true">{marca}</span>
      {texto}{resto}
    </span>
  );
}

/** Los avisos completos del nodo seleccionado, para la Ficha. */
export function AvisosDelNodo({ alertas }: { alertas: readonly Alerta[] }) {
  if (alertas.length === 0) return null;
  const ordenadas = [...alertas].sort((a, b) => (a.gravedad === b.gravedad ? 0 : a.gravedad === "alta" ? -1 : 1));
  return (
    <section aria-label="Avisos sobre este elemento" className="space-y-2">
      {ordenadas.map((a, i) => (
        <div key={i} className={`rounded-md border-l-[3px] py-1.5 pl-3 ${a.gravedad === "alta" ? "border-warn bg-warn/5" : "border-warn/50"}`}>
          <InsigniaAlerta alertas={[a]} />
          {a.origen === "ia" && <span className="ml-2 font-mono text-[10px] uppercase tracking-wide text-ink-muted">Revisión con IA</span>}
          <p className="mt-1 text-sm leading-relaxed text-ink">{traducirMensajeAlerta(a.mensaje)}</p>
        </div>
      ))}
    </section>
  );
}
