"use client";

/**
 * El caso abierto, para quien lo necesita lejos de la página: la cabecera
 * (alias, «Sesión N», «Añadir sesión») y el Inspector (revisiones y versiones).
 * Fuera de un caso vale null y esas piezas se comportan como antes de la fase 7:
 * un análisis suelto sigue funcionando sin historial.
 */

import { createContext, useContext } from "react";
import type { Expediente, Sesion } from "@/lib/casos";

export interface ValorCaso {
  expediente: Expediente;
  /** La sesión cuya formulación se ve; la última si no se está viendo una anterior. */
  sesion: Sesion;
  /** true al ver la formulación de una sesión anterior: no se edita. */
  soloLectura: boolean;
  verVersion: (sesionId: string | null) => void;
  anadirSesion: () => void;
}

export const ContextoCaso = createContext<ValorCaso | null>(null);

export function useCaso(): ValorCaso | null {
  return useContext(ContextoCaso);
}
