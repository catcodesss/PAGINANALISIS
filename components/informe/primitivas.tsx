"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import type { Cita as CitaVerificada } from "@/lib/types";
import {
  ANCLAS_DE_BLOQUE,
  TITULO_DE_ANCLA,
  TITULO_DE_SECCION,
  type IdSeccion,
} from "@/lib/secciones";
import { describirGrado, type GradoApoyo } from "@/lib/gradoApoyo";
import { TERMINOS, type IdTermino } from "@/lib/terminos";
import {
  BotonAgregar,
  BotonBorrar,
  TextoEditable,
  useEdicion,
} from "../edicionManual";
import { PanelPestana } from "./pestanas";

export function BloqueBase({ id, visible, children }: { id: IdSeccion; visible: boolean; children: ReactNode }) {
  if (!visible) return null;
  return <PanelPestana id={id}><div id={id} className="bloque-informe scroll-mt-24 space-y-10 print:mb-10"><div><h2 className="section-title flex items-center gap-3 font-serif text-xl font-semibold text-ink sm:text-2xl"><span aria-hidden="true" className="h-6 w-1.5 rounded-full bg-accent" />{TITULO_DE_SECCION[id]}</h2><EstadoRevision bloque={id} /></div>{children}</div></PanelPestana>;
}

/**
 * El ESTADO de lo que hay en la pestaña: propuesta de la IA sin revisar, o con
 * cambios del terapeuta. No es un grado de apoyo y no se mezcla con él (ver
 * lib/gradoApoyo.ts): revisar algo no lo hace estar mejor apoyado en la nota.
 * Nombra dónde hubo cambios para que la marca de edición (invariante 6) se lea
 * también desde arriba.
 */
function EstadoRevision({ bloque }: { bloque: IdSeccion }) {
  const edicion = useEdicion();
  const editadas = ANCLAS_DE_BLOQUE[bloque].filter((a) =>
    edicion?.seccionesEditadas.includes(a)
  );
  return (
    <p className="mt-1.5 pl-[18px] text-xs text-ink-muted">
      {editadas.length === 0
        ? "Propuesta de la IA · pendiente de revisar"
        : `Propuesta de la IA · con cambios tuyos en ${editadas.map((a) => TITULO_DE_ANCLA[a]).join(", ")}`}
    </p>
  );
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

/**
 * De dónde sale el dato: cita textual, dato parcial o inferencia. Sustituye al
 * antiguo «Confianza: alta/media/baja» (ver lib/gradoApoyo.ts).
 */
export function Apoyo({ grado }: { grado: GradoApoyo }) {
  const d = describirGrado(grado);
  return <span title={d.corta} className="conf-chip inline-flex cursor-help items-center gap-1.5 font-mono text-[11px] uppercase tracking-wide text-ink-muted"><span aria-hidden="true" className={`conf-dot h-1.5 w-1.5 rounded-full ${d.clase}`} />{d.etiqueta}</span>;
}

/**
 * Un concepto técnico en tres capas: la etiqueta clara, la sigla en pequeño al
 * lado y la definición al pasar el cursor. Ver lib/terminos.ts.
 */
export function Termino({ id, soloClaro = false }: { id: IdTermino; soloClaro?: boolean }) {
  const t = TERMINOS[id];
  return <span title={t.definicion} className="cursor-help">{t.claro}{!soloClaro && <> <abbr title={t.definicion} className="ml-0.5 rounded border border-divider px-1 font-mono text-[9px] uppercase tracking-wide text-ink-muted no-underline">{t.tecnico}</abbr></>}</span>;
}

export function Cita({ children }: { children: CitaVerificada | null | undefined }) {
  if (!children) return null;
  if (!children.verificada) return <p className="evidence-prefix mt-2 font-mono text-[10px] uppercase tracking-wide text-ink-muted">Inferido — sin cita literal en la nota</p>;
  const rango = children.linea_inicio === children.linea_fin
    ? `línea ${children.linea_inicio}`
    : `líneas ${children.linea_inicio}–${children.linea_fin}`;
  return <blockquote className="evidence-block mt-2 border-l-2 border-divider pl-3"><p className="evidence-prefix font-mono text-[10px] uppercase tracking-wide text-ink-muted">De la nota · {rango}</p><p className="evidence-text text-sm italic leading-relaxed text-ink-muted">&quot;{children.texto}&quot;</p></blockquote>;
}

/**
 * Lo secundario, plegado. No es un <details>: Chrome no imprime el contenido de
 * un <details> cerrado, y lo que se pliega en pantalla tiene que seguir en el
 * documento que se archiva. Aquí el contenido plegado es `hidden print:block`.
 */
export function Plegable({
  titulo,
  children,
  abiertoDeInicio = false,
}: {
  titulo: string;
  children: ReactNode;
  abiertoDeInicio?: boolean;
}) {
  const [abierto, setAbierto] = useState(abiertoDeInicio);
  return (
    <div className="mt-3">
      <button
        type="button"
        aria-expanded={abierto}
        onClick={() => setAbierto((v) => !v)}
        className="inline-flex items-center gap-1.5 text-sm text-accent transition-colors hover:text-accent/80 print:hidden"
      >
        <span aria-hidden="true" className="inline-block w-3 font-mono text-xs">{abierto ? "−" : "+"}</span>
        {titulo}
      </button>
      <p className="hidden font-mono text-[10px] uppercase tracking-wide text-ink-muted print:block">{titulo}</p>
      <div className={`${abierto ? "" : "hidden print:block"} mt-2`}>{children}</div>
    </div>
  );
}

export interface AccionMenu {
  etiqueta: string;
  onElegir: () => void;
}

/**
 * Las acciones secundarias de un apartado, detrás de un «⋯».
 *
 * «Reportar fallo», «Agregar nota y reanalizar» y «Borrar» se repetían debajo
 * de cada apartado y de cada elemento: en un informe de cinco pestañas eran
 * decenas de botones compitiendo con el contenido, que es lo que el terapeuta
 * viene a leer. Siguen a un clic; solo dejan de estar a la vista.
 */
export function MenuAcciones({ acciones, etiqueta }: { acciones: AccionMenu[]; etiqueta: string }) {
  const [abierto, setAbierto] = useState(false);
  const raiz = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!abierto) return;
    function fuera(e: MouseEvent) {
      if (raiz.current && !raiz.current.contains(e.target as Node)) setAbierto(false);
    }
    function escape(e: KeyboardEvent) {
      if (e.key === "Escape") setAbierto(false);
    }
    document.addEventListener("mousedown", fuera);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("mousedown", fuera);
      document.removeEventListener("keydown", escape);
    };
  }, [abierto]);

  if (acciones.length === 0) return null;

  return (
    <div ref={raiz} className="relative inline-block print:hidden">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={abierto}
        aria-label={`Más acciones: ${etiqueta}`}
        onClick={() => setAbierto((v) => !v)}
        className="rounded px-2 py-0.5 font-mono text-sm leading-none text-ink-muted transition-colors hover:bg-canvas hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
      >
        ⋯
      </button>
      {abierto && (
        <ul
          role="menu"
          className="absolute right-0 z-20 mt-1 min-w-[14rem] rounded-md border border-divider bg-surface py-1 shadow-lg"
        >
          {acciones.map((a) => (
            <li key={a.etiqueta} role="none">
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setAbierto(false);
                  a.onElegir();
                }}
                className="block w-full px-3 py-1.5 text-left text-sm text-ink transition-colors hover:bg-canvas focus-visible:bg-canvas focus-visible:outline-none"
              >
                {a.etiqueta}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
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

/** Tabla de dos columnas (Elemento / Análisis) para una cadena de contingencia. */
export interface FilaCadena {
  elemento: string;
  valor: string;
}

export function TablaCadena({ filas }: { filas: FilaCadena[] }) {
  return (
    <div className="w-full overflow-x-auto">
      <table className="chain-table w-full border-collapse text-sm">
        <tbody>
          {filas.map((f, i) => (
            <tr
              key={i}
              className="border-b border-divider last:border-b-0 print:border-black"
            >
              <td className="el-label w-[110px] py-3 pr-4 align-top font-mono text-xs font-bold text-ink">
                {f.elemento}
              </td>
              <td className="py-3 align-top leading-relaxed text-ink">
                {f.valor}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

