import { nodoDeRuta } from "./alertasNodo";
import type { Alerta, AnalisisFuncional, Id } from "./types";
import type { IdVista } from "./secciones";

/**
 * Adónde lleva un aviso dentro del espacio de trabajo: qué vista y qué elemento.
 *
 * La bandeja de la cabecera salta de un aviso a otro con esto, y la prueba de
 * la fase 5 lo usa para comprobar que ningún aviso se queda sin un elemento
 * visible donde pintar su insignia. Se resuelve por la ruta que escribió el
 * validador, nunca por el texto (mismo criterio que lib/alertasNodo.ts).
 *
 * `id` null en Blancos significa «intervenciones o mediciones sin blanco», que
 * es un apartado propio de esa vista. `id` null en el Mapa es un aviso sobre
 * algo que no tiene nodo (una habilidad DBT cuyo eslabón no se resolvió): el
 * Mapa los enseña en su franja «Avisos sin nodo». Un aviso sin destino
 * (`null`) es uno general —de la pasada crítica, por ejemplo— y se ve solo en
 * la bandeja.
 */
export interface DestinoAlerta {
  vista: IdVista;
  id: Id | null;
}

export function destinoDeAlerta(
  analisis: AnalisisFuncional,
  alerta: Pick<Alerta, "ruta">
): DestinoAlerta | null {
  const nodo = nodoDeRuta(analisis, alerta.ruta);
  if (nodo) return { vista: "mapa", id: nodo };

  const m = /^([a-z_.]+)\[(\d+)\]/.exec(alerta.ruta);
  if (!m) return null;
  const i = Number(m[2]);
  switch (m[1]) {
    case "lineas_de_intervencion_tentativas": {
      const linea = analisis.lineas_de_intervencion_tentativas[i];
      return linea ? { vista: "blancos", id: linea.conducta_id } : null;
    }
    case "plan_de_monitorizacion": {
      const plan = analisis.plan_de_monitorizacion[i];
      return plan ? { vista: "blancos", id: plan.conducta_id } : null;
    }
    case "hipotesis_mantenimiento": {
      const h = analisis.hipotesis_mantenimiento[i];
      return h ? { vista: "mapa", id: h.id } : null;
    }
    case "preguntas": {
      const p = analisis.preguntas[i];
      return p ? { vista: "mapa", id: p.id } : null;
    }
    case "situaciones": {
      const s = analisis.situaciones[i];
      return s ? { vista: "mapa", id: s.id } : null;
    }
    // Intervención DBT cuyo eslabón no se resolvió: no hay nodo que la lleve.
    case "capa_dbt.habilidades_sugeridas":
    case "capa_dbt.analisis_de_soluciones":
      return { vista: "mapa", id: null };
    case "hipotesis_alternativas": {
      const h = analisis.hipotesis_alternativas[i];
      return h?.rival_de ? { vista: "mapa", id: h.rival_de } : null;
    }
    default:
      return null;
  }
}
