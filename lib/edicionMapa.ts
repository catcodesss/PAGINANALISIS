import type { AnalisisFuncional, Cita, Id } from "./types";
import { borrarNodo, construirNodosGrafo, reservarId } from "./grafo";
import { nuevoIdPregunta } from "./preguntas";
import { segmentarFrases, SIN_CITA } from "./citas";
import { marcarCreado } from "./procedencia";

export type CitaDeLaNota = Extract<Cita, { verificada: true }>;

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

/* ── Citas del clínico ─────────────────────────────────────────────────── */

/**
 * La cita de UNA frase de la nota, con su texto sacado de la nota misma. Se
 * construye a partir de la posición y nunca del texto que llegue de fuera (un
 * arrastre, un botón): así es verificada por construcción (invariante 1).
 * Null si esa frase no existe.
 */
export function citaDeFrase(
  lineas: readonly string[],
  linea: number,
  frase: number
): CitaDeLaNota | null {
  const texto = segmentarFrases(lineas[linea - 1] ?? "")[frase - 1]?.trim();
  if (!texto) return null;
  return { texto, linea_inicio: linea, linea_fin: linea, frase_inicio: frase, frase_fin: frase, verificada: true };
}

/** Si a este id se le puede unir una cita: un nodo del Mapa o una relación. */
export function esCitable(analisis: AnalisisFuncional, id: Id): boolean {
  return (
    analisis.aristas.some((a) => a.id === id) ||
    construirNodosGrafo(analisis).some((n) => n.id === id)
  );
}

const mismaFrase = (a: CitaDeLaNota, b: CitaDeLaNota) =>
  a.linea_inicio === b.linea_inicio &&
  a.linea_fin === b.linea_fin &&
  (a.frase_inicio ?? 0) === (b.frase_inicio ?? 0) &&
  (a.frase_fin ?? 0) === (b.frase_fin ?? 0);

/**
 * Une una frase de la nota a un nodo o una relación. No cambia la procedencia
 * del elemento —lo que dijo la IA sigue siendo de la IA—: la cita va aparte y
 * se ve como tuya. La misma frase dos veces en el mismo elemento no se repite.
 * Devuelve si la unió.
 */
export function citarEnElemento(analisis: AnalisisFuncional, id: Id, cita: CitaDeLaNota): boolean {
  if (!esCitable(analisis, id)) return false;
  analisis.citas_del_clinico ??= {};
  const actuales = analisis.citas_del_clinico[id] ?? [];
  if (actuales.some((c) => mismaFrase(c, cita))) return false;
  analisis.citas_del_clinico[id] = [...actuales, cita];
  return true;
}

export function quitarCitaDelClinico(analisis: AnalisisFuncional, id: Id, indice: number): void {
  const actuales = analisis.citas_del_clinico?.[id];
  if (!actuales) return;
  const quedan = actuales.filter((_, i) => i !== indice);
  if (quedan.length > 0) analisis.citas_del_clinico[id] = quedan;
  else delete analisis.citas_del_clinico[id];
}

/* ── Frases sin usar ───────────────────────────────────────────────────── */

export type TipoDesdeFrase = "conducta" | "acomodacion" | "valor" | "moduladora";

export const ETIQUETA_TIPO_DESDE_FRASE: Record<TipoDesdeFrase, string> = {
  conducta: "Conducta problema",
  acomodacion: "Acomodación del entorno",
  valor: "Valor o meta",
  moduladora: "Variable moduladora",
};

/**
 * Convierte una frase que nada usaba en un elemento nuevo, con la frase como
 * su texto y como su cita. Es tuyo («creado»): la IA no lo propuso. Las
 * clasificaciones que exige cada tipo arrancan en el valor más prudente
 * (importancia baja, déficit no determinable…), igual que al añadirlo a mano.
 * Una conducta se pone en la situación que elijas, o en ninguna.
 * Devuelve el id nuevo.
 */
export function convertirFrase(
  analisis: AnalisisFuncional,
  cita: CitaDeLaNota,
  tipo: TipoDesdeFrase,
  situacionId: Id | null = null
): Id {
  const texto = cita.texto;
  const sinCita = SIN_CITA("sin_referencia");
  let id: Id;
  if (tipo === "conducta") {
    id = reservarId(analisis, "cnd");
    analisis.conductas_problema.push({
      id,
      descripcion: texto,
      tipo: "manifiesta",
      importancia: "baja",
      es_conducta_seguridad: false,
      deficit_o_interferencia: "no_determinable",
      justificacion_deficit: "",
      evidencia: sinCita,
    });
    analisis.situaciones.find((s) => s.id === situacionId)?.conductas_ids.push(id);
  } else if (tipo === "moduladora") {
    id = reservarId(analisis, "vmd");
    analisis.variables_moduladoras.push({
      id,
      nivel: "psicologico",
      dimension: "conducta",
      momento: "actual",
      descripcion: texto,
      modificabilidad: "baja",
      evidencia: sinCita,
    });
  } else if (tipo === "acomodacion") {
    id = reservarId(analisis, "acm");
    // Quién acomoda y para qué no lo dice la frase: quedan vacíos, a la vista,
    // en vez de adivinarlos.
    analisis.acomodacion_entorno.push({ id, quien: "", conducta_acomodacion: texto, funcion: "", evidencia: sinCita });
  } else {
    analisis.valores_y_metas.push(texto);
    id = `valor_${analisis.valores_y_metas.length}`;
  }
  marcarCreado(analisis, id);
  analisis.citas_del_clinico ??= {};
  analisis.citas_del_clinico[id] = [cita];
  return id;
}

/* ── En la exportación ─────────────────────────────────────────────────── */

const NOMBRE_TIPO: Record<string, string> = {
  om: "Operación motivadora",
  moduladora: "Variable moduladora",
  ed: "Antecedente (Ed)",
  ec: "Estímulo condicionado",
  regla_verbal: "Regla verbal",
  encubierta: "Eslabón",
  conducta: "Conducta",
  repertorio: "Repertorio",
  alternativa: "Alternativa",
  consecuencia: "Consecuencia",
  consecuencia_alternativa: "Consecuencia que la mantendría",
  funcion: "Función",
  valor: "Valor",
};

/**
 * Las citas que uniste tú, una línea por cita y con el elemento al que van.
 * Salen en un apartado propio del texto copiado, el impreso y el Word, y
 * cada una dice que la añadió el profesional (invariante 6): el documento se
 * lee fuera de contexto. Vacío si no hay ninguna.
 */
export function citasDelClinicoEnTexto(
  analisis: AnalisisFuncional,
  referencia: (cita: CitaDeLaNota) => string
): string[] {
  const nodos = new Map(construirNodosGrafo(analisis).map((n) => [n.id, n]));
  const nombre = (id: Id): string => {
    const n = nodos.get(id);
    if (n) return `${NOMBRE_TIPO[n.tipo] ?? "Elemento"}: ${n.etiqueta}`;
    const arista = analisis.aristas.find((a) => a.id === id);
    if (arista) {
      const desde = nodos.get(arista.desde)?.etiqueta ?? "[elemento sin etiqueta]";
      const hasta = nodos.get(arista.hasta)?.etiqueta ?? "[elemento sin etiqueta]";
      return `Relación: ${desde} → ${hasta}`;
    }
    const acomodacion = analisis.acomodacion_entorno.find((a) => a.id === id);
    if (acomodacion) return `Acomodación del entorno: ${acomodacion.conducta_acomodacion}`;
    const conducta = analisis.conductas_problema.find((c) => c.id === id);
    if (conducta) return `Conducta: ${conducta.descripcion}`;
    return `[${id}]`;
  };
  return Object.entries(analisis.citas_del_clinico ?? {}).flatMap(([id, citas]) => [
    `- ${nombre(id)}`,
    ...citas.map((c) => `  De la nota (cita añadida por el profesional): "${c.texto}" (${referencia(c)})`),
  ]);
}
