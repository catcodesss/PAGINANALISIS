"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import {
  aplicarPreferencias,
  CLAVE_PREFERENCIAS,
  normalizarPreferencias,
  PREFERENCIAS_POR_DEFECTO,
  type Preferencias,
} from "@/lib/preferencias";

/**
 * localStorage leído como el almacén externo que es. Igual que en
 * components/ordenBloques.tsx: useSyncExternalStore evita escribir estado
 * dentro de un efecto y da un valor coherente en el servidor.
 */
const suscriptores = new Set<() => void>();

function suscribir(alCambiar: () => void) {
  suscriptores.add(alCambiar);
  return () => {
    suscriptores.delete(alCambiar);
  };
}

function leerCrudo(): string {
  try {
    return localStorage.getItem(CLAVE_PREFERENCIAS) ?? "";
  } catch {
    return "";
  }
}

/** En el servidor no hay preferencias: los valores de fábrica. */
function leerCrudoEnServidor(): string {
  return "";
}

export function usePreferencias() {
  const crudo = useSyncExternalStore(suscribir, leerCrudo, leerCrudoEnServidor);

  const preferencias: Preferencias = crudo
    ? normalizarPreferencias(safeParse(crudo))
    : PREFERENCIAS_POR_DEFECTO;

  const cambiar = useCallback((parcial: Partial<Preferencias>) => {
    const actual = normalizarPreferencias(safeParse(leerCrudo()));
    const nuevo = normalizarPreferencias({ ...actual, ...parcial });
    try {
      localStorage.setItem(CLAVE_PREFERENCIAS, JSON.stringify(nuevo));
    } catch {
      // Modo privado o almacenamiento lleno: vale para esta sesión.
    }
    aplicarPreferencias(nuevo, document.documentElement);
    for (const alCambiar of suscriptores) alCambiar();
  }, []);

  // Con el tema en "sistema", seguir al sistema operativo mientras la pestaña
  // está abierta: si oscurece a las siete de la tarde, la app oscurece con él.
  useEffect(() => {
    if (preferencias.tema !== "sistema") return;
    const consulta = matchMedia("(prefers-color-scheme: dark)");
    const alCambiar = () =>
      aplicarPreferencias(preferencias, document.documentElement);
    consulta.addEventListener("change", alCambiar);
    return () => consulta.removeEventListener("change", alCambiar);
  }, [preferencias]);

  return { preferencias, cambiar };
}

function safeParse(crudo: string): unknown {
  try {
    return JSON.parse(crudo);
  } catch {
    return null;
  }
}
