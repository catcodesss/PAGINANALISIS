import type { AnalisisFuncional, Id } from "./types";
import { borrarNodo, construirNodosGrafo } from "./grafo";
import { nuevoIdPregunta } from "./preguntas";

/**
 * Lo que el clínico hace con un elemento del Mapa desde su menú, la Fuente o
 * arrastrando. Lógica pura sobre una copia del análisis: la interfaz la llama
 * dentro de `aplicar` (components/espacio/contexto.tsx), que guarda el estado
 * anterior para deshacer, y `cerrarEdicion` (lib/procedenciaEdicion.ts)
 * recalcula después el apoyo de las relaciones.
 */

/**
 * Convierte un nodo en una pregunta abierta y lo quita del Mapa. Es lo que se
 * hace con algo que el análisis afirma y la nota no deja dar por bueno: deja
 * de estar en el grafo como hecho y pasa a ser lo que hay que averiguar.
 *
 * La pregunta es del clínico (`origen: "clinico"`) y pone a prueba la
 * hipótesis que pasaba por ese nodo, si había una. Devuelve su id, o null si
 * el id no es un nodo.
 */
export function convertirEnPregunta(analisis: AnalisisFuncional, id: Id): Id | null {
  const nodo = construirNodosGrafo(analisis).find((n) => n.id === id);
  if (!nodo) return null;
  const hipotesis = analisis.hipotesis_mantenimiento.find(
    (h) => h.destino_id === id || h.origen_id === id
  );
  const idPregunta = nuevoIdPregunta(analisis.preguntas);
  analisis.preguntas.push({
    id: idPregunta,
    // Sin el punto final de la etiqueta: «…confrontación.»? no se lee bien.
    texto: `¿Se sostiene «${nodo.etiqueta.trim().replace(/[.\s]+$/, "")}»?`,
    hipotesis: hipotesis?.enunciado ?? "",
    pone_a_prueba: hipotesis?.id ?? null,
    dato_faltante: nodo.etiqueta,
    decision: "",
    origen: "clinico",
    estado: "abierta",
  });
  borrarNodo(analisis, id);
  return idPregunta;
}
