"use client";

import { useCallback, useSyncExternalStore } from "react";
import { claveEstiloGrafo, nivelDeGuardado, type NivelMapa } from "@/lib/preferencias";

/**
 * El nivel de lectura del Mapa (Situación, Clínico o Evidencia).
 *
 * Por qué uno solo y arriba: los botones de modalidad se repetían en cada
 * sección y eso invitaba a leer una situación de un modo y la de al lado de
 * otro sin darse cuenta. El terapeuta lo elige una vez y el Mapa entero se
 * adapta.
 *
 * Se guarda en el navegador, por referencia de caso, y en la misma clave que
 * el antiguo «estilo del grafo»: lib/preferencias.ts#nivelDeGuardado traduce
 * un valor viejo (afc, dbt, act) al nivel que le corresponde, y uno que no
 * reconoce cae al de fábrica. Es una preferencia de lectura, no contenido
 * clínico.
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

/** En el servidor no hay preferencia guardada: el nivel de fábrica. */
function leerCrudoEnServidor(): string {
  return "";
}

export function useNivelMapa(referenciaCaso = ""): {
  nivel: NivelMapa;
  elegirNivel: (n: NivelMapa) => void;
} {
  const clave = claveEstiloGrafo(referenciaCaso);
  const crudo = useSyncExternalStore(suscribir, () => leerCrudo(clave), leerCrudoEnServidor);
  // Se resuelve durante el render y no en un efecto: corregirlo desde un
  // efecto daría un fotograma con un nivel que no existe.
  const nivel = nivelDeGuardado(crudo);

  const elegirNivel = useCallback(
    (n: NivelMapa) => {
      try {
        localStorage.setItem(clave, n);
      } catch {
        // Modo privado o almacenamiento lleno: vale para esta sesión.
      }
      for (const alCambiar of suscriptores) alCambiar();
    },
    [clave]
  );

  return { nivel, elegirNivel };
}
