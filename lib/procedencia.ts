import type {
  AnalisisFuncional,
  EstadoProcedencia,
  Id,
  ProcedenciaElemento,
} from "./types";

/**
 * Procedencia por elemento: quién tiene la última palabra sobre cada nodo y
 * cada relación. Es el invariante 6 llevado de la sección al elemento.
 *
 * AUSENTE = PROPUESTA. Solo se guarda lo que el clínico tocó, como pasa con
 * `estados_plan`: así un informe recién generado no arrastra una entrada por
 * elemento, y un elemento nuevo del modelo nunca nace «confirmado» por olvido.
 *
 * CONFIRMAR NO ES EDITAR. Confirmar dice «lo revisé y lo doy por bueno»; el
 * texto sigue siendo el de la IA. Si se marcara como editado, un informe lleno
 * de revisiones parecería escrito a mano por el clínico, que es justo lo que el
 * invariante 6 prohíbe en el sentido contrario.
 *
 * LO QUE ESCRIBE EL CLÍNICO NO VUELVE A SER DE LA IA. Un elemento `creado` o
 * `editado` no regresa a otro estado por confirmarlo ni por editarlo de nuevo.
 */

const PROPUESTA: ProcedenciaElemento = { estado: "propuesta" };

export function procedenciaDe(
  analisis: Pick<AnalisisFuncional, "procedencia">,
  id: Id
): ProcedenciaElemento {
  return analisis.procedencia?.[id] ?? PROPUESTA;
}

/** Lo añadió el clínico a mano: la IA nunca lo propuso. */
export function marcarCreado(analisis: AnalisisFuncional, id: Id): void {
  analisis.procedencia[id] = { estado: "creado" };
}

/**
 * El clínico cambió el texto. `textoOriginal` es el que había justo antes: se
 * guarda solo la primera vez, para poder enseñar qué dijo la IA aunque se edite
 * tres veces.
 */
export function marcarEditado(
  analisis: AnalisisFuncional,
  id: Id,
  textoOriginal: string
): void {
  const actual = procedenciaDe(analisis, id);
  if (actual.estado === "creado") return;
  if (actual.estado === "editado") return;
  analisis.procedencia[id] = { estado: "editado", original: textoOriginal };
}

export function confirmarElemento(analisis: AnalisisFuncional, id: Id): void {
  const actual = procedenciaDe(analisis, id);
  if (actual.estado === "creado" || actual.estado === "editado") return;
  analisis.procedencia[id] = { estado: "confirmado" };
}

/** Al borrar un elemento no queda su rastro: un id no se reutiliza, pero tampoco se acumula. */
export function olvidarProcedencia(analisis: AnalisisFuncional, ids: readonly Id[]): void {
  for (const id of ids) delete analisis.procedencia[id];
}

export interface RotuloProcedencia {
  /** En la Ficha y en la insignia. */
  etiqueta: string;
  /** En el texto copiado, el impreso y el Word. */
  exportacion: string;
  /** Una frase para el tooltip. */
  frase: string;
}

export const ROTULOS_PROCEDENCIA: Record<EstadoProcedencia, RotuloProcedencia> = {
  propuesta: {
    etiqueta: "Propuesta de la IA",
    exportacion: "[Propuesta de la IA]",
    frase: "Lo propuso la IA y no lo has revisado.",
  },
  confirmado: {
    etiqueta: "Confirmado por ti",
    exportacion: "[Confirmado]",
    frase: "Lo revisaste y lo das por bueno. El texto sigue siendo el de la IA.",
  },
  editado: {
    etiqueta: "Editado por ti",
    exportacion: "[Editado]",
    frase: "Cambiaste el texto que propuso la IA.",
  },
  creado: {
    etiqueta: "Tuyo",
    exportacion: "[Del profesional]",
    frase: "Lo añadiste tú: la IA nunca lo propuso.",
  },
};

export function rotuloDe(
  analisis: Pick<AnalisisFuncional, "procedencia">,
  id: Id
): RotuloProcedencia {
  return ROTULOS_PROCEDENCIA[procedenciaDe(analisis, id).estado];
}

/**
 * Lo que el clínico escribió o tocó, en la exportación. Una propuesta sin
 * revisar lleva su marca igual: el documento se lee fuera de contexto y tiene
 * que decir por sí mismo qué es de la IA y qué no.
 */
export function marcaDeExportacion(
  analisis: Pick<AnalisisFuncional, "procedencia">,
  id: Id
): string {
  return rotuloDe(analisis, id).exportacion;
}
