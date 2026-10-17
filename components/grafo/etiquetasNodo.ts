import type { TipoArista } from "@/lib/types";
import type { NodoGrafo, TipoNodoGrafo } from "@/lib/grafo";
import { TERMINOS } from "@/lib/terminos";
import { describirGrado, gradoDeNumero } from "@/lib/gradoApoyo";

/**
 * Cómo se nombra cada cosa del grafo de cara al clínico. Vive fuera de
 * GrafoAFC.tsx porque desde la fase 5 lo leen también el Inspector, la Fuente
 * y el raíl, que ya no están dentro del grafo.
 *
 * La etiqueta clara de cada tipo de nodo. Los que tienen sigla técnica la
 * llevan al lado en pequeño (lib/terminos.ts). Ed y EC no comparten palabra:
 * uno indica que la conducta funciona ahí y el otro provoca la reacción.
 */
export const ETIQUETA_TIPO: Record<TipoNodoGrafo, string> = {
  om: TERMINOS.om.claro,
  moduladora: "Moduladora",
  ed: TERMINOS.ed.claro,
  ec: TERMINOS.ec.claro,
  regla_verbal: "Regla verbal",
  encubierta: "Encubierta",
  conducta: "Conducta",
  repertorio: "Repertorio activo",
  alternativa: "Conducta alternativa",
  consecuencia: "Consecuencia",
  consecuencia_alternativa: "Consecuencia necesaria",
  funcion: TERMINOS.funcion.claro,
  valor: "Valor",
};

/** El tipo de relación en palabras. */
export const TIPO_RELACION: Record<TipoArista, string> = {
  secuencial: "secuencia",
  moderadora: "modula",
  bucle: "bucle",
};

/** Un eslabón «acción» no se rotula como encubierto: es conducta observable. */
export function etiquetaTipoNodo(nodo: NodoGrafo): string {
  return nodo.tipo === "encubierta" && nodo.detalle === "accion"
    ? "Eslabón · acción"
    : ETIQUETA_TIPO[nodo.tipo];
}

export function etiquetaApoyo(apoyo: 1 | 2 | 3): string {
  return describirGrado(gradoDeNumero(apoyo)).etiqueta;
}
