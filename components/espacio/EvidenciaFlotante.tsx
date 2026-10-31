"use client";

/**
 * La evidencia de un nodo o una relación, a petición: «Ver evidencia» del menú,
 * el puntito de color de la tarjeta o la pulsación larga abren esta tarjeta con
 * la frase literal de la nota. Se queda abierta hasta cerrarla con la ✕, con
 * Esc o pulsando fuera; el tablero ya no lleva la frase debajo de cada nodo.
 *
 * Solo enseña citas verificadas: lo que el modelo no pudo anclar a una línea de
 * la nota no se entrecomilla nunca (invariante 2). Va en un portal y con
 * posición fija porque el tablero hace scroll horizontal y la recortaría.
 */

import { useEffect, useMemo, useRef, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import type { AnalisisFuncional } from "@/lib/types";
import { construirNodosGrafo, numeroDeApoyoArista } from "@/lib/grafo";
import { etiquetaCita, type CitaVerificadaResuelta } from "@/lib/citas";
import { ETIQUETA_APOYO_ARISTA } from "@/lib/apoyoAristas";
import { etiquetaApoyo } from "../grafo/etiquetasNodo";
import { useEspacio } from "./contexto";
import s from "../grafo/afc.module.css";

const ANCHO = 320;

interface Fuente {
  cita: CitaVerificadaResuelta;
  tuya: boolean;
}

export default function EvidenciaFlotante({ analisis }: { analisis: AnalisisFuncional }) {
  const { evidencia, cerrarEvidencia, irACita, textoCita } = useEspacio();
  const raiz = useRef<HTMLDivElement>(null);

  const datos = useMemo(() => {
    if (!evidencia) return null;
    const tuyas = (analisis.citas_del_clinico?.[evidencia.id] ?? []).filter((c): c is CitaVerificadaResuelta => c.verificada);
    const nodo = construirNodosGrafo(analisis).find((n) => n.id === evidencia.id);
    if (nodo) {
      const fuentes: Fuente[] = [
        ...(nodo.evidencia?.verificada ? [{ cita: nodo.evidencia, tuya: false }] : []),
        ...(nodo.citas_clinico ?? []).map((cita) => ({ cita, tuya: true })),
      ];
      return { titulo: nodo.etiqueta, apoyo: etiquetaApoyo(nodo.apoyo), grado: nodo.apoyo, fuentes };
    }
    const arista = analisis.aristas.find((a) => a.id === evidencia.id);
    if (!arista) return null;
    const fuentes: Fuente[] = [
      ...arista.evidencia.filter((c): c is CitaVerificadaResuelta => c.verificada).map((cita) => ({ cita, tuya: false })),
      ...tuyas.map((cita) => ({ cita, tuya: true })),
    ];
    return { titulo: "Relación", apoyo: ETIQUETA_APOYO_ARISTA[arista.apoyo], grado: numeroDeApoyoArista(arista.apoyo), fuentes };
  }, [evidencia, analisis]);

  // Cierra con Esc, al pulsar fuera (ratón o dedo) y al cambiar el tamaño. Con
  // scroll no: la tarjeta es para leerla y el tablero se desplaza debajo.
  useEffect(() => {
    if (!evidencia) return;
    const fuera = (e: Event) => {
      if (raiz.current && e.target instanceof Node && raiz.current.contains(e.target)) return;
      cerrarEvidencia();
    };
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") cerrarEvidencia();
    };
    window.addEventListener("pointerdown", fuera, true);
    window.addEventListener("keydown", tecla);
    window.addEventListener("resize", cerrarEvidencia);
    return () => {
      window.removeEventListener("pointerdown", fuera, true);
      window.removeEventListener("keydown", tecla);
      window.removeEventListener("resize", cerrarEvidencia);
    };
  }, [evidencia, cerrarEvidencia]);

  if (!evidencia || !datos) return null;

  // Dentro de la pantalla sin medir: anclada por el lado con sitio.
  const posicion: CSSProperties = {
    width: Math.min(ANCHO, window.innerWidth - 16),
    left: Math.max(8, Math.min(evidencia.x, window.innerWidth - ANCHO - 8)),
    ...(evidencia.y > window.innerHeight * 0.55 ? { bottom: Math.max(8, window.innerHeight - evidencia.y) } : { top: evidencia.y }),
    maxHeight: "60vh",
  };

  return createPortal(
    <div
      key={`${evidencia.id}-${evidencia.x}-${evidencia.y}`}
      ref={raiz}
      role="dialog"
      aria-label="Evidencia"
      style={posicion}
      className="fixed z-50 flex flex-col overflow-hidden rounded-xl border border-divider bg-surface text-sm shadow-xl print:hidden"
    >
      <header className="flex items-center justify-between gap-2 border-b border-divider px-3.5 py-2.5">
        <p className="min-w-0 font-semibold leading-snug text-ink">{datos.titulo}</p>
        <button
          type="button"
          autoFocus
          onClick={cerrarEvidencia}
          aria-label="Cerrar la evidencia"
          className="-mr-1.5 shrink-0 rounded px-2 text-lg leading-none text-ink-muted hover:bg-canvas hover:text-ink"
        >
          ×
        </button>
      </header>
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3.5 py-3">
        <span className={s.evidenciaEtiqueta} data-apoyo={datos.grado}>
          {datos.apoyo}
        </span>
        {datos.fuentes.length === 0 ? (
          <p className="text-ink-muted">Sin frase de origen en la nota: lo propuso el modelo sin anclarlo a una línea.</p>
        ) : (
          datos.fuentes.map((f, i) => (
            <div key={i}>
              <blockquote className={s.evidenciaCita} data-apoyo={datos.grado}>«{textoCita(f.cita)}»</blockquote>
              <p className="mt-1.5 text-xs text-ink-muted">{f.tuya ? "Cita tuya" : "Fuente"} · {etiquetaCita(f.cita)}</p>
              <button
                type="button"
                onClick={() => {
                  cerrarEvidencia();
                  irACita(f.cita);
                }}
                className="mt-2 rounded-md border border-divider bg-surface px-2.5 py-1 text-xs text-ink hover:bg-canvas"
              >
                Ir a la nota
              </button>
            </div>
          ))
        )}
      </div>
    </div>,
    document.body
  );
}
