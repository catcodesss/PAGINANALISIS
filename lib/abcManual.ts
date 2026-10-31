import type { AnalisisFuncional } from "./types";
import { normalizarAnalisis } from "./parseAnalisis";
import { agregarNodo, reservarId } from "./grafo";
import { marcarCreado } from "./procedencia";
import { revalidarTrasEdicion } from "./validadores";

/**
 * El ABC escrito a mano en una sesión vacía, sin nota ni IA: un texto por cuadro
 * del Mapa. Cada cuadro vacío se queda en blanco.
 */
export interface ABCManual {
  contexto: string;
  antecedente: string;
  conducta: string;
  inmediata: string;
  demorada: string;
}

export const ABC_EN_BLANCO: ABCManual = { contexto: "", antecedente: "", conducta: "", inmediata: "", demorada: "" };

export function hayABC(abc: ABCManual): boolean {
  return Object.values(abc).some((t) => t.trim() !== "");
}

/**
 * Una formulación con una sola situación y lo que el clínico escribió. Todo
 * queda como «creado» por él: la IA no propuso nada. Pasa por el mismo
 * normalizador que un análisis generado, así que tiene la forma completa y el
 * resto del informe (Mapa, edición, versiones) funciona sin casos especiales.
 */
export function analisisDesdeABC(abc: ABCManual): AnalisisFuncional {
  const a = normalizarAnalisis({ situaciones: [{ nombre: "Situación 1", cadena_operante: {} }] }, []);
  // Un análisis hecho a mano no «dejó de generar» nada: no hay claves ausentes.
  a.campos_ausentes = [];
  const situacion = a.situaciones[0];
  const texto = (t: string) => t.trim();

  if (texto(abc.contexto)) agregarNodo(a, situacion.id, "om", texto(abc.contexto));
  if (texto(abc.antecedente)) agregarNodo(a, situacion.id, "ed", texto(abc.antecedente));
  if (texto(abc.conducta)) agregarNodo(a, situacion.id, "conducta", texto(abc.conducta));
  if (texto(abc.inmediata)) agregarNodo(a, situacion.id, "consecuencia", texto(abc.inmediata));
  if (texto(abc.demorada)) {
    if (texto(abc.inmediata)) {
      // agregarNodo llena primero la inmediata y después la demorada.
      agregarNodo(a, situacion.id, "consecuencia", texto(abc.demorada));
    } else if (situacion.cadena_operante) {
      const id = reservarId(a, "cns");
      situacion.cadena_operante.consecuencias_largo_plazo = { id, texto: texto(abc.demorada) };
      marcarCreado(a, id);
    }
  }
  a.alertas = revalidarTrasEdicion(a, "");
  return a;
}
