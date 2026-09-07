"use client";

import { useCallback, useSyncExternalStore } from "react";
import type { ModeloTerapeutico } from "@/lib/types";

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
 * y por la misma razón: es una preferencia de lectura, no contenido clínico, así
 * que vive en localStorage sin rozar el invariante 5. Persiste entre casos a
 * propósito — quien trabaja en DBT lo hace con todos sus pacientes, y volver a
 * ACT en cada informe nuevo sería pedirle lo mismo cada vez.
 *
 * En impresión no cambia nada: el documento sigue listando todas las capas
 * generadas, porque en papel no hay selector que pulsar.
 */

const CLAVE_ALMACEN = "acia-lente";

const suscriptores = new Set<() => void>();

function suscribir(alCambiar: () => void) {
  suscriptores.add(alCambiar);
  return () => {
    suscriptores.delete(alCambiar);
  };
}

function leerCrudo(): string {
  try {
    return localStorage.getItem(CLAVE_ALMACEN) ?? "";
  } catch {
    return "";
  }
}

/** En el servidor no hay preferencia guardada: la lente de fábrica. */
function leerCrudoEnServidor(): string {
  return "";
}

export const LENTE_POR_DEFECTO: ModeloTerapeutico = "act";

/**
 * Un valor guardado por una versión anterior —o una capa que este análisis
 * parcial no generó— no puede dejar el informe enseñando una lente que no
 * existe. `disponibles` lo acota a lo que este informe puede mostrar.
 */
export function useLente(disponibles: ModeloTerapeutico[]): {
  lente: ModeloTerapeutico;
  elegirLente: (m: ModeloTerapeutico) => void;
} {
  const crudo = useSyncExternalStore(suscribir, leerCrudo, leerCrudoEnServidor);

  const guardada = disponibles.includes(crudo as ModeloTerapeutico)
    ? (crudo as ModeloTerapeutico)
    : null;

  // Se resuelve durante el render y no en un efecto: corregir el estado desde
  // un efecto obliga a un segundo render, y entre los dos hay un fotograma con
  // la lente que no existe.
  const lente =
    guardada ??
    (disponibles.includes(LENTE_POR_DEFECTO)
      ? LENTE_POR_DEFECTO
      : (disponibles[0] ?? LENTE_POR_DEFECTO));

  const elegirLente = useCallback((m: ModeloTerapeutico) => {
    try {
      localStorage.setItem(CLAVE_ALMACEN, m);
    } catch {
      // Modo privado o almacenamiento lleno: vale para esta sesión.
    }
    for (const alCambiar of suscriptores) alCambiar();
  }, []);

  return { lente, elegirLente };
}
