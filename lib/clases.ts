/**
 * Clases funcionales (fase 10): lo que el nivel Caso del Mapa necesita saber de
 * ellas, sin tocar la interfaz.
 *
 * Una conducta está en exactamente una clase. La clase con `funcion: null` es
 * «Función por determinar»: ahí va lo que no se sabe, nunca a la clase más
 * parecida. El apoyo de una clase es el de su pertenencia más débil.
 */

import { SIN_CITA } from "./citas";
import { gradoMasDebil, type GradoApoyo } from "./gradoApoyo";
import type { AnalisisFuncional, ClaseFuncional, Id } from "./types";

/** Destino de un arrastre a la columna «Función por determinar». */
export const POR_DETERMINAR = "por_determinar";

export function apoyoDeClase(clase: ClaseFuncional): GradoApoyo {
  return gradoMasDebil(clase.miembros.map((m) => m.apoyo));
}

export function claseDeConducta(a: AnalisisFuncional, conductaId: Id): ClaseFuncional | undefined {
  return (a.clases_funcionales ?? []).find((c) => c.miembros.some((m) => m.conducta_id === conductaId));
}

/** El nombre de la clase tal como se lee: su función, o «Función por determinar». */
export function nombreDeClase(clase: ClaseFuncional): string {
  return clase.funcion ?? "Función por determinar";
}

/**
 * Crea una clase vacía con la función que escribe el clínico. Sin esto, un
 * informe anterior a la v9 (todo en «por determinar») no tendría a dónde
 * mover nada. Devuelve false si el nombre está vacío o ya existe.
 */
export function crearClase(a: AnalisisFuncional, funcion: string): boolean {
  const nombre = funcion.trim();
  const clases = a.clases_funcionales ?? [];
  if (!nombre || clases.some((c) => c.funcion?.trim().toLowerCase() === nombre.toLowerCase())) return false;
  const nueva: ClaseFuncional = { id: `cls_${a.siguiente_id}`, funcion: nombre, miembros: [] };
  a.siguiente_id += 1;
  // «Por determinar» siempre al final.
  const i = clases.findIndex((c) => c.funcion === null);
  if (i === -1) clases.push(nueva);
  else clases.splice(i, 0, nueva);
  a.clases_funcionales = clases;
  return true;
}

/**
 * Cambia una conducta de clase. Es una decisión del clínico, no una cita: la
 * pertenencia nueva llega sin justificación ni cita y, por tanto, como
 * «inferencia» hasta que el clínico la sostenga con una frase de la nota.
 * `destino` es el id de una clase o `POR_DETERMINAR`. Devuelve false si no hay
 * nada que mover (misma clase, conducta o clase inexistentes).
 */
export function moverConductaDeClase(a: AnalisisFuncional, conductaId: Id, destino: string): boolean {
  const clases = a.clases_funcionales ?? [];
  const origen = claseDeConducta(a, conductaId);
  const conducta = a.conductas_problema.find((c) => c.id === conductaId);
  if (!origen || !conducta) return false;

  let clase: ClaseFuncional | undefined;
  if (destino === POR_DETERMINAR) {
    clase = clases.find((c) => c.funcion === null);
    if (!clase) {
      clase = { id: `cls_${a.siguiente_id}`, funcion: null, miembros: [] };
      a.siguiente_id += 1;
      clases.push(clase);
    }
  } else {
    clase = clases.find((c) => c.id === destino);
  }
  if (!clase || clase.id === origen.id) return false;

  origen.miembros = origen.miembros.filter((m) => m.conducta_id !== conductaId);
  clase.miembros.push({
    conducta_id: conductaId,
    conducta_texto: conducta.descripcion,
    justificacion: "",
    evidencia: SIN_CITA("sin_referencia"),
    apoyo: "inferencia",
  });
  // «Por determinar» vacía no dice nada; una clase con función, aunque quede
  // vacía, es una decisión del clínico y se queda.
  if (origen.funcion === null && origen.miembros.length === 0) {
    a.clases_funcionales = clases.filter((c) => c.id !== origen.id);
  }
  return true;
}
