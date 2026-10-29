"use client";

import { useEffect, useState } from "react";
import { repositorioNube } from "@/lib/repositorio";

/** Se dispara cuando se crea o se regenera la clave de recuperación. */
export const EVENTO_RECUPERACION = "acia:recuperacion";

/**
 * `true` si la bóveda de esta cuenta aún no tiene clave de recuperación. La
 * clave es opcional: esto solo alimenta el aviso ⚠ de Configuración. Sin nube
 * activa nunca hay nada pendiente.
 */
export function useRecuperacionPendiente(): boolean {
  const [pendiente, setPendiente] = useState(false);

  useEffect(() => {
    const repo = repositorioNube();
    if (!repo) return;
    let vivo = true;
    const leer = () => {
      repo
        .tieneRecuperacion()
        .then((tiene) => vivo && setPendiente(!tiene))
        .catch(() => {});
    };
    leer();
    window.addEventListener(EVENTO_RECUPERACION, leer);
    return () => {
      vivo = false;
      window.removeEventListener(EVENTO_RECUPERACION, leer);
    };
  }, []);

  return pendiente;
}
