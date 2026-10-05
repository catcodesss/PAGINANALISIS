/**
 * Qué va en cada cuadrante de la vista ACT (Matrix). Es una función pura para
 * poder fijarla en una prueba: la vista solo pinta lo que sale de aquí.
 *
 * El criterio es la FUNCIÓN, no el tipo de nodo. Antes toda conducta problema
 * caía en «alejamiento» por ser conducta problema, y la operación motivacional
 * en «malestar interior» por ser contexto. Ahora:
 *
 * - Malestar interior: solo eventos privados (eslabones encubiertos y estímulos
 *   condicionados). La OM altera el valor de un reforzador; no es malestar. Un
 *   eslabón de tipo «acción» tampoco: es conducta observable. No va a ningún
 *   cuadrante, porque la Matrix clasifica por función y el eslabón no la
 *   tiene; la conducta problema que describe ya está en su fila.
 * - Alejamiento: una conducta cuya función de alejarse está establecida, por
 *   una anotación de evitación experiencial con justificación funcional o por
 *   una situación suya mantenida por refuerzo negativo.
 * - El resto de conductas problema van a su propia fila, sin clasificar: no
 *   saber su función es un dato, no una razón para darla por evitación.
 */

import { esEventoPrivado, type NodoGrafo } from "./grafo";
import { tieneBaseFuncional } from "./procesosACT";
import type { AnalisisFuncional, Id } from "./types";

export interface CuadrantesMatrix {
  alejamiento: NodoGrafo[];
  sinFuncionEstablecida: NodoGrafo[];
  acercamiento: NodoGrafo[];
  interior: NodoGrafo[];
  valores: NodoGrafo[];
  reglas: NodoGrafo[];
}

/** Un nodo por id: la misma conducta aparece una vez por cada situación suya. */
function unicos(nodos: readonly NodoGrafo[]): NodoGrafo[] {
  const vistos = new Set<Id>();
  return nodos.filter((n) => (vistos.has(n.id) ? false : (vistos.add(n.id), true)));
}

export function esAlejamiento(analisis: AnalisisFuncional, conductaId: Id): boolean {
  const porAnotacion = analisis.capa_act.procesos_act.some(
    (p) =>
      p.nodo_id === conductaId &&
      p.proceso === "evitacion_experiencial" &&
      tieneBaseFuncional(p)
  );
  if (porAnotacion) return true;
  return analisis.situaciones.some(
    (s) =>
      s.conductas_ids.includes(conductaId) &&
      s.cadena_operante?.tipo_contingencia === "refuerzo negativo"
  );
}

export function clasificarMatrix(
  analisis: AnalisisFuncional,
  nodos: readonly NodoGrafo[]
): CuadrantesMatrix {
  const conductas = unicos(nodos.filter((n) => n.tipo === "conducta" && !n.alternativa));
  return {
    alejamiento: conductas.filter((n) => esAlejamiento(analisis, n.id)),
    sinFuncionEstablecida: conductas.filter((n) => !esAlejamiento(analisis, n.id)),
    acercamiento: unicos(nodos.filter((n) => n.tipo === "alternativa" || n.tipo === "repertorio")),
    interior: unicos(nodos.filter(esEventoPrivado)),
    valores: unicos(nodos.filter((n) => n.tipo === "valor")),
    reglas: unicos(nodos.filter((n) => n.tipo === "regla_verbal")),
  };
}
