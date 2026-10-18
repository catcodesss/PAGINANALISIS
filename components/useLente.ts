"use client";

import { useCallback, useSyncExternalStore } from "react";
import {
  ESTILO_GRAFO_POR_DEFECTO,
  claveEstiloGrafo,
  type EstiloGrafo,
} from "@/lib/preferencias";

/**
 * La lente terapéutica con la que se lee el informe entero.
 *
 * Por qué una sola y arriba: los botones de modalidad se repetían en cada
 * sección que tenía algo que enseñar por modelo, y eso invitaba a leer una
 * situación en ACT y la de al lado en DBT sin darse cuenta. El terapeuta
 * trabaja con un modelo por paciente: lo elige una vez, y el documento entero
 * se adapta. Repetir el mando en cada apartado no daba más control, daba más
 * ocasiones de desincronizarse.
 *
 * Se guarda igual que la preferencia de orden (ver components/ordenBloques.tsx)
 * y por la misma razón: es una preferencia de lectura, no contenido clínico.
 * La clave se acota a la referencia local del caso para que una vista elegida
 * para un análisis no cambie la presentación inicial de otro.
 *
 * En impresión no cambia nada: el documento sigue listando todas las capas
 * generadas, porque en papel no hay selector que pulsar.
 */

const suscriptores = new Set<() => void>();

function suscribir(alCambiar: () => void) {
  suscriptores.add(alCambiar);
  return () => {
    suscriptores.delete(alCambiar);
  };
}

function leerCrudo(clave: string): string {
  try {
    return localStorage.getItem(clave) ?? "";
  } catch {
    return "";
  }
}

/** En el servidor no hay preferencia guardada: la lente de fábrica. */
function leerCrudoEnServidor(): string {
  return "";
}

export const LENTE_POR_DEFECTO: EstiloGrafo = ESTILO_GRAFO_POR_DEFECTO;

/**
 * Un valor guardado por una versión anterior —o una capa que este análisis
 * parcial no generó— no puede dejar el informe enseñando una lente que no
 * existe. `disponibles` lo acota a lo que este informe puede mostrar.
 */
export function useLente(disponibles: EstiloGrafo[], referenciaCaso = ""): {
  lente: EstiloGrafo;
  elegirLente: (m: EstiloGrafo) => void;
} {
  const clave = claveEstiloGrafo(referenciaCaso);
  const crudo = useSyncExternalStore(
    suscribir,
    () => leerCrudo(clave),
    leerCrudoEnServidor
  );

  const guardada = disponibles.includes(crudo as EstiloGrafo)
    ? (crudo as EstiloGrafo)
    : null;

  // Se resuelve durante el render y no en un efecto: corregir el estado desde
  // un efecto obliga a un segundo render, y entre los dos hay un fotograma con
  // la lente que no existe.
  const lente =
    guardada ??
    (disponibles.includes(LENTE_POR_DEFECTO)
      ? LENTE_POR_DEFECTO
      : (disponibles[0] ?? LENTE_POR_DEFECTO));

  const elegirLente = useCallback((m: EstiloGrafo) => {
    try {
      localStorage.setItem(clave, m);
    } catch {
      // Modo privado o almacenamiento lleno: vale para esta sesión.
    }
    for (const alCambiar of suscriptores) alCambiar();
  }, [clave]);

  return { lente, elegirLente };
}
