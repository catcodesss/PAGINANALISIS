"use client";

import type { ReactNode } from "react";
import type { Cita as CitaVerificada, NivelConfianza } from "@/lib/types";
import { TITULO_DE_SECCION, type IdSeccion } from "@/lib/secciones";
import {
  claseColorConfianza,
  tooltipConfianza,
} from "@/lib/nivelesConfianza";
import {
  BotonAgregar,
  BotonBorrar,
  TextoEditable,
  useEdicion,
} from "../edicionManual";
import { BloqueOrdenable } from "../ordenBloques";

export function BloqueBase({ id, visible, children }: { id: IdSeccion; visible: boolean; children: ReactNode }) {
  if (!visible) return null;
  return <BloqueOrdenable id={id} titulo={TITULO_DE_SECCION[id]}><div id={id} className="scroll-mt-24 space-y-10"><h2 className="section-title flex items-center gap-3 font-serif text-xl font-semibold text-ink sm:text-2xl"><span aria-hidden="true" className="h-6 w-1.5 rounded-full bg-accent" />{TITULO_DE_SECCION[id]}</h2>{children}</div></BloqueOrdenable>;
}

export function SinHallazgos() {
  return <p className="text-sm text-ink-muted">Sin hallazgos suficientes en la nota.</p>;
}

export function Chip({ children }: { children: ReactNode }) {
  return <span className="clasificacion-chip inline-block max-w-full break-words rounded border border-accent/40 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide text-accent">{children}</span>;
}

export function ChipDestacado({ children }: { children: ReactNode }) {
  return <span className="funcion-chip inline-block max-w-full break-words rounded bg-accent px-2.5 py-1 font-mono text-[10px] uppercase tracking-wide texto-sobre-acento">{children}</span>;
}

export function Confianza({ nivel }: { nivel: NivelConfianza | string }) {
  return <span title={tooltipConfianza(nivel)} className="conf-chip inline-flex cursor-help items-center gap-1.5 font-mono text-[11px] uppercase tracking-wide text-ink-muted"><span aria-hidden="true" className={`conf-dot h-1.5 w-1.5 rounded-full ${claseColorConfianza(nivel)}`} />Confianza: {nivel}</span>;
}

export function Cita({ children }: { children: CitaVerificada | null | undefined }) {
  if (!children) return null;
  if (!children.verificada) return <p className="evidence-prefix mt-2 font-mono text-[10px] uppercase tracking-wide text-ink-muted">Inferido — sin cita literal en la nota</p>;
  const rango = children.linea_inicio === children.linea_fin
    ? `línea ${children.linea_inicio}`
    : `líneas ${children.linea_inicio}–${children.linea_fin}`;
  return <blockquote className="evidence-block mt-2 border-l-2 border-divider pl-3"><p className="evidence-prefix font-mono text-[10px] uppercase tracking-wide text-ink-muted">De la nota · {rango}</p><p className="evidence-text text-sm italic leading-relaxed text-ink-muted">&quot;{children.texto}&quot;</p></blockquote>;
}

export function SubSeccion({ titulo, children }: { titulo: string; children: ReactNode }) {
  return <div><h3 className="section-title mb-2 font-mono text-xs uppercase tracking-wide text-ink-muted">{titulo}</h3>{children}</div>;
}

export function ListaEditable({
  items,
  seccionId,
  etiqueta,
  onCambiar,
  claseItem = "text-[15px] leading-relaxed text-ink",
  vacio,
}: {
  items: string[];
  seccionId: string;
  etiqueta: string;
  onCambiar: (nuevos: string[]) => void;
  claseItem?: string;
  vacio?: ReactNode;
}) {
  const edicion = useEdicion();
  if (items.length === 0 && !edicion) return <>{vacio ?? <SinHallazgos />}</>;
  return <>{items.length === 0 ? (vacio ?? <SinHallazgos />) : <ul className="list-disc space-y-2 pl-5">{items.map((item, i) => <li key={i} className={claseItem}><span className="flex flex-wrap items-baseline gap-x-2"><TextoEditable valor={item} seccionId={seccionId} etiqueta={`${etiqueta} ${i + 1}`} className={claseItem} onCambio={(valor) => onCambiar(items.map((actual, j) => j === i ? valor : actual))} /><BotonBorrar etiqueta={`${etiqueta} ${i + 1}`} onBorrar={() => onCambiar(items.filter((_, j) => j !== i))} /></span></li>)}</ul>}<BotonAgregar etiqueta={etiqueta} onAgregar={(texto) => onCambiar([...items, texto])} /></>;
}

export function SeccionInforme({
  id,
  titulo,
  editada,
  marcaEditada,
  extra,
  children,
  pie,
}: {
  id: string;
  titulo: string;
  editada: boolean;
  marcaEditada?: ReactNode;
  extra?: ReactNode;
  children: ReactNode;
  pie?: ReactNode;
}) {
  return <section id={id} className={`scroll-mt-24 ${editada ? "seccion-editada" : ""}`}><div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1"><h3 className="section-title flex items-center gap-3 font-serif text-lg font-semibold text-ink">{titulo}{editada && marcaEditada}</h3>{extra}</div>{children}{pie}</section>;
}
