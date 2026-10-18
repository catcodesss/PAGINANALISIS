import type { DestinoAlerta } from "@/lib/destinoAlerta";
import type { IdVista } from "@/lib/secciones";

/**
 * Llevar la vista a un elemento: cambiar de vista si hace falta, seleccionarlo
 * y hacer scroll hasta él. Lo usan el raíl y la bandeja de avisos.
 *
 * El scroll espera dos fotogramas: el primero pinta la vista nueva, el segundo
 * ya tiene el elemento en el DOM.
 */
export function irADestino(
  destino: DestinoAlerta,
  espacio: {
    elegirVista: (v: IdVista) => void;
    seleccionar: (id: string | null) => void;
  }
) {
  espacio.elegirVista(destino.vista);
  // En el Mapa, un aviso sin nodo no deja seleccionado el elemento anterior:
  // se lee en la franja «Avisos sin nodo».
  if (destino.vista === "mapa") espacio.seleccionar(destino.id);
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      const selector =
        destino.vista === "blancos"
          ? destino.id
            ? `#blanco-${CSS.escape(destino.id)}`
            : "#intervencion"
          : destino.id
            ? `[data-nodo-id="${CSS.escape(destino.id)}"], [data-situacion-id="${CSS.escape(destino.id)}"]`
            : 'section[aria-label="Avisos sin nodo"]';
      if (!selector) return;
      const elemento = document.querySelector(selector);
      // La franja va plegada en una línea; quien llega desde un aviso viene a leerlo.
      if (destino.vista === "mapa" && !destino.id) elemento?.querySelector("details")?.setAttribute("open", "");
      elemento?.scrollIntoView({ behavior: "smooth", block: "center" });
    })
  );
}
