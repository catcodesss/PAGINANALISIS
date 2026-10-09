import { calcularApoyoAristas } from "./apoyoAristas";
import { construirNodosGrafo } from "./grafo";
import { marcarEditado } from "./procedencia";
import type { AnalisisFuncional } from "./types";

/**
 * Cierra una edición del clínico sobre la copia ya mutada: anota qué elementos
 * cambiaron de texto y recalcula el apoyo de las relaciones.
 *
 * POR QUÉ UN DIFF Y NO MARCAR EN CADA EDITOR. El texto de un elemento se puede
 * cambiar desde el grafo, la Ficha, las secciones del informe o un deshacer, y
 * cada camino es un sitio donde olvidar la marca; comparar antes y después lo
 * cubre todos. Es el invariante 6 por elemento: lo que el clínico escribe no
 * vuelve a presentarse como generado por la IA.
 *
 * `decision` es true cuando la edición es una decisión sobre la propuesta
 * (confirmar, asignar un blanco) y no texto del clínico. En ese caso no se
 * marca nada: confirmar no es editar.
 *
 * Los valores se dejan fuera: su id sale de la posición en la lista, así que
 * borrar uno desplaza a los demás y el diff atribuiría la edición al vecino.
 */
export function cerrarEdicion(
  previo: AnalisisFuncional,
  copia: AnalisisFuncional,
  decision: boolean
): void {
  if (!decision) {
    const antes = new Map(
      construirNodosGrafo(previo)
        .filter((n) => n.tipo !== "valor")
        .map((n) => [n.id, n.etiqueta] as const)
    );
    for (const n of construirNodosGrafo(copia)) {
      const original = antes.get(n.id);
      if (n.tipo !== "valor" && original !== undefined && original !== n.etiqueta) {
        marcarEditado(copia, n.id, original);
      }
    }
    for (const h of copia.hipotesis_mantenimiento) {
      const anterior = previo.hipotesis_mantenimiento.find((x) => x.id === h.id);
      if (anterior && anterior.enunciado !== h.enunciado) {
        marcarEditado(copia, h.id, anterior.enunciado);
      }
    }
  }
  calcularApoyoAristas(copia);
}
