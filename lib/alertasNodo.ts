import type { Alerta, AnalisisFuncional, Id } from "./types";

/**
 * A qué nodo del grafo apunta una alerta, si apunta a alguno.
 *
 * Se resuelve por la RUTA, que es la posición exacta que el validador señaló,
 * y nunca por `elemento`: ese campo es el texto del fragmento, y casarlo con la
 * etiqueta de un nodo sería volver a emparejar por prosa, lo que la v2 retiró.
 *
 * Las intervenciones DBT (habilidades y análisis de soluciones) no son nodos,
 * pero cuelgan de un eslabón por id: la alerta va a ese eslabón, que es donde
 * la intervención se lee en la vista DBT. Una línea de intervención del Plan o
 * una situación entera no tienen nodo propio, y sus alertas siguen solo donde
 * estaban.
 */
export function nodoDeRuta(analisis: AnalisisFuncional, ruta: string): Id | null {
  const m = /^([a-z_.]+)\[(\d+)\]$/.exec(ruta);
  if (!m) return null;
  const i = Number(m[2]);
  switch (m[1]) {
    case "conductas_problema":
      return analisis.conductas_problema[i]?.id ?? null;
    case "conductas_alternativas":
      return analisis.conductas_alternativas[i]?.id ?? null;
    case "capa_dbt.habilidades_sugeridas":
      return analisis.capa_dbt.habilidades_sugeridas[i]?.eslabon_id ?? null;
    case "capa_dbt.analisis_de_soluciones":
      return analisis.capa_dbt.analisis_de_soluciones[i]?.eslabon_id ?? null;
    default:
      return null;
  }
}

/** Las alertas de cada nodo, por id. Un nodo sin alertas no aparece. */
export function alertasPorNodo(analisis: AnalisisFuncional): Map<Id, Alerta[]> {
  const salida = new Map<Id, Alerta[]>();
  for (const alerta of analisis.alertas) {
    const id = nodoDeRuta(analisis, alerta.ruta);
    if (!id) continue;
    salida.set(id, [...(salida.get(id) ?? []), alerta]);
  }
  return salida;
}

/** La gravedad que manda en un conjunto: basta una alta para que lo sea. */
export function gravedadMayor(alertas: readonly Alerta[]): Alerta["gravedad"] | null {
  if (alertas.length === 0) return null;
  return alertas.some((a) => a.gravedad === "alta") ? "alta" : "media";
}
