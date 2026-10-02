"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import { SECCIONES_INFORME, type IdSeccion } from "@/lib/secciones";

/**
 * Qué pestañas del informe se esconden en pantalla. Es una preferencia de
 * lectura, no contenido clínico: vive en localStorage y nunca toca el informe
 * copiado, impreso ni exportado (un panel oculto sigue en `print:block`).
 *
 * Guarda las ocultas y no las visibles: una pestaña nueva que se añada a
 * `SECCIONES_INFORME` aparece sola, en vez de quedar escondida para quien ya
 * había guardado una lista.
 */
export const CLAVE_PESTANAS_OCULTAS = "acia-pestanas-ocultas";

const suscriptores = new Set<() => void>();

function suscribir(alCambiar: () => void) {
  suscriptores.add(alCambiar);
  return () => {
    suscriptores.delete(alCambiar);
  };
}

function leerCrudo(): string {
  try {
    return localStorage.getItem(CLAVE_PESTANAS_OCULTAS) ?? "";
  } catch {
    return "";
  }
}

function leerCrudoEnServidor(): string {
  return "";
}

const IDS = SECCIONES_INFORME.map((s) => s.id) as IdSeccion[];

/** Tolerante: lo que no es un id conocido se descarta, y nunca se ocultan todas. */
function normalizar(crudo: string): IdSeccion[] {
  let valor: unknown;
  try {
    valor = JSON.parse(crudo);
  } catch {
    return [];
  }
  if (!Array.isArray(valor)) return [];
  const ocultas = IDS.filter((id) => valor.includes(id));
  return ocultas.length >= IDS.length ? [] : ocultas;
}

export function usePestanasOcultas() {
  const crudo = useSyncExternalStore(suscribir, leerCrudo, leerCrudoEnServidor);
  const ocultas = useMemo(() => normalizar(crudo), [crudo]);

  const guardar = useCallback((nuevas: IdSeccion[]) => {
    try {
      localStorage.setItem(CLAVE_PESTANAS_OCULTAS, JSON.stringify(normalizar(JSON.stringify(nuevas))));
    } catch {
      // Modo privado o almacenamiento lleno: la elección no se guarda y el
      // informe sigue mostrando todas las pestañas, que es el lado seguro.
    }
    for (const alCambiar of suscriptores) alCambiar();
  }, []);

  return { ocultas, guardar };
}
