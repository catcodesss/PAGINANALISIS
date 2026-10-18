"use client";

/**
 * El puntito de color de una tarjeta del nivel Evidencia: su color dice cuánto
 * apoya la nota al elemento (cita, dato parcial, inferencia) y al pulsarlo se
 * abre la tarjeta con la frase. Es el camino visible a lo que también hace el
 * clic derecho o la pulsación larga, que no se descubren solos.
 */

import type { Id } from "@/lib/types";
import { useEspacio } from "../espacio/contexto";
import { etiquetaApoyo } from "./etiquetasNodo";
import s from "./afc.module.css";

export default function PuntoEvidencia({ id, apoyo, enLinea = false }: { id: Id; apoyo: 1 | 2 | 3; enLinea?: boolean }) {
  const { abrirEvidencia } = useEspacio();
  return (
    <button
      type="button"
      aria-label={`${etiquetaApoyo(apoyo)}. Ver evidencia`}
      title={`${etiquetaApoyo(apoyo)} · Ver evidencia`}
      onClick={(e) => {
        e.stopPropagation();
        const r = e.currentTarget.getBoundingClientRect();
        abrirEvidencia(id, r.left, r.bottom + 6);
      }}
      className={enLinea ? s.puntoEvidenciaEnLinea : s.puntoEvidencia}
    >
      <span aria-hidden="true" data-apoyo={apoyo} className={s.puntoEvidenciaPunto} />
    </button>
  );
}
