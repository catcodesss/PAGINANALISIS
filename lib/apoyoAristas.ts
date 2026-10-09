import {
  apoyoAristaDeNumero,
  construirNodosGrafo,
  numeroDeApoyoArista,
  type NodoGrafo,
} from "./grafo";
import { procedenciaDe } from "./procedencia";
import type {
  AnalisisFuncional,
  ApoyoArista,
  Arista,
  Cita,
  HipotesisMantenimiento,
  Situacion,
} from "./types";

/**
 * Apoyo de las RELACIONES en la nota.
 *
 * EL PROBLEMA (mesa-clínica §A.4). Un nodo está «citado» cuando una línea de la
 * nota lo dice. Una relación entre dos nodos citados parecía igual de sólida
 * que ellos aunque ninguna frase afirmara la relación: «duerme mal los
 * domingos» respalda el DATO del sueño, no que el sueño mantenga la evitación.
 * Cada capa derivada (bucle, palanca, formulación) heredaba el verde y añadía
 * certeza.
 *
 * LA REGLA, EN UNA FRASE. Una relación vale lo que valga la frase que la
 * AFIRMA, y como mucho lo que valga su extremo más débil. Que dos extremos
 * estén citados no cita la relación.
 *
 * | Relación                                         | Techo     | Cita que lleva                   |
 * |--------------------------------------------------|-----------|----------------------------------|
 * | Sale de una hipótesis de mantenimiento           | parcial   | ninguna (la hipótesis no tiene)  |
 * |   …con confianza baja                            | inferido  | ninguna                          |
 * | conducta → consecuencia inmediata (cadena        | textual   | la de la cadena operante         |
 * |   operante)                                      |           |                                  |
 * | Otra de una cadena (OM→ED, ED→conducta,          | parcial   | la de la cadena que la contiene  |
 * |   conducta→consecuencia demorada, eslabones DBT, |           |                                  |
 * |   estímulo condicionado…)                        |           |                                  |
 * | Cualquier otra (sin cadena ni hipótesis)         | inferido  | ninguna                          |
 * | La creó el clínico                               | inferido  | ninguna; se ve como «tuya»       |
 *
 * Después de aplicar el techo, el apoyo baja al del extremo más débil. Una
 * relación «inferido» no lista citas: si las listara, diría que una frase la
 * sostiene.
 *
 * POR QUÉ SOLO conducta → consecuencia puede ser textual. Una frase que cita la
 * cadena («al volver ya habían pasado a otro punto… sintió un alivio
 * inmediato») afirma que tras la conducta vino esa consecuencia. No afirma la
 * operación motivacional ni el papel de cada pieza. La consecuencia demorada
 * queda en parcial por lo mismo: es lo que menos suele decir la nota.
 *
 * CUANDO UNA HIPÓTESIS TENGA CITA PROPIA (sub-fase 3B, pendiente): con cita
 * verificada y confianza alta o media, el techo de las aristas que salen de
 * ella sube a textual, y su cita pasa a `evidencia`. Es el único punto que
 * cambia: `techoDeHipotesis` y `citasDeArista`.
 *
 * LO CALCULA EL SERVIDOR (invariante 3), no el modelo, y es determinista: el
 * mismo informe da siempre los mismos apoyos.
 */

type Resultado = { apoyo: ApoyoArista; evidencia: Cita[] };

const NUMERO_INFERIDO = numeroDeApoyoArista("inferido");
const NUMERO_PARCIAL = numeroDeApoyoArista("parcial");
const NUMERO_TEXTUAL = numeroDeApoyoArista("textual");

/** Las hipótesis que declaran esta relación, en cualquiera de sus sentidos. */
export function hipotesisDeArista(
  analisis: Pick<AnalisisFuncional, "hipotesis_mantenimiento">,
  desde: string,
  hasta: string
): HipotesisMantenimiento[] {
  return analisis.hipotesis_mantenimiento.filter(
    (h) =>
      (h.origen_id === desde && h.destino_id === hasta) ||
      (h.direccion === "bidireccional" && h.origen_id === hasta && h.destino_id === desde)
  );
}

/** La arista que dibuja una hipótesis, si existe (sentido directo o contrario). */
export function aristaDeHipotesis(
  analisis: Pick<AnalisisFuncional, "aristas">,
  h: Pick<HipotesisMantenimiento, "origen_id" | "destino_id" | "direccion">
): Arista | undefined {
  if (!h.origen_id || !h.destino_id) return undefined;
  const { origen_id: o, destino_id: d } = h;
  return analisis.aristas.find(
    (a) =>
      (a.desde === o && a.hasta === d) ||
      (h.direccion === "bidireccional" && a.desde === d && a.hasta === o)
  );
}

/**
 * Hasta dónde puede llegar una relación que declara una hipótesis. Sin cita
 * propia, como mucho «parcial»; con confianza baja, «inferido». Si hay varias
 * hipótesis sobre el mismo par, vale la mejor apoyada.
 */
function techoDeHipotesis(hipotesis: readonly HipotesisMantenimiento[]): 1 | 2 | 3 {
  return Math.max(
    ...hipotesis.map((h) => (h.confianza === "baja" ? NUMERO_INFERIDO : NUMERO_PARCIAL))
  ) as 1 | 2 | 3;
}

function citaVerificada(cita: Cita | null | undefined): cita is Extract<Cita, { verificada: true }> {
  return Boolean(cita && cita.verificada);
}

function sinRepetir(citas: readonly Cita[]): Cita[] {
  const vistas = new Set<string>();
  return citas.filter((c) => {
    if (!c.verificada) return false;
    const clave = `${c.linea_inicio}-${c.linea_fin}`;
    if (vistas.has(clave)) return false;
    vistas.add(clave);
    return true;
  });
}

/** La cita de la cadena a la que pertenece un nodo, o null si no hereda ninguna. */
function citaDeCadena(situacion: Situacion, nodo: NodoGrafo): Cita | null {
  switch (nodo.tipo) {
    case "ed":
    case "consecuencia":
      return situacion.cadena_operante?.evidencia ?? null;
    case "ec":
      return situacion.cadena_respondiente?.evidencia ?? null;
    case "encubierta":
      return situacion.cadena_dbt?.evidencia ?? null;
    default:
      return null;
  }
}

function calcular(
  analisis: AnalisisFuncional,
  arista: Arista,
  nodos: ReadonlyMap<string, NodoGrafo>
): Resultado {
  const origen = nodos.get(arista.desde);
  const destino = nodos.get(arista.hasta);
  // Un extremo que ya no resuelve a un nodo es una relación sin dato: no se
  // puede decir que algo la sostenga.
  if (!origen || !destino) return { apoyo: "inferido", evidencia: [] };

  let techo: number = NUMERO_INFERIDO;
  let citas: Cita[] = [];

  const hipotesis = hipotesisDeArista(analisis, arista.desde, arista.hasta);
  if (hipotesis.length > 0) {
    techo = techoDeHipotesis(hipotesis);
  } else if (origen.situacion_id && origen.situacion_id === destino.situacion_id) {
    const situacion = analisis.situaciones.find((s) => s.id === origen.situacion_id);
    if (situacion) {
      techo = NUMERO_PARCIAL;
      const operante = situacion.cadena_operante;
      const esContingencia =
        origen.tipo === "conducta" &&
        destino.tipo === "consecuencia" &&
        operante?.consecuencia.id === destino.id;
      if (esContingencia) techo = NUMERO_TEXTUAL;
      citas = [origen, destino]
        .map((n) => (n.tipo === "conducta" ? null : citaDeCadena(situacion, n)))
        .filter(citaVerificada);
    }
  }

  const extremos = Math.min(origen.apoyo, destino.apoyo);
  const numero = Math.min(techo, extremos) as 1 | 2 | 3;
  return {
    apoyo: apoyoAristaDeNumero(numero),
    evidencia: numero === NUMERO_INFERIDO ? [] : sinRepetir(citas),
  };
}

/**
 * Calcula `apoyo` y `evidencia` de todas las aristas. Idempotente y
 * determinista, así que se puede volver a llamar tras un reanálisis sin
 * miedo. Las que creó el clínico no se tocan: no tienen apoyo declarado y no
 * lo heredan de sus extremos.
 */
export function calcularApoyoAristas(analisis: AnalisisFuncional): void {
  const nodos = new Map<string, NodoGrafo>();
  for (const n of construirNodosGrafo(analisis)) if (!nodos.has(n.id)) nodos.set(n.id, n);

  for (const arista of analisis.aristas) {
    if (procedenciaDe(analisis, arista.id).estado === "creado") {
      arista.apoyo = "inferido";
      arista.evidencia = [];
      continue;
    }
    const { apoyo, evidencia } = calcular(analisis, arista, nodos);
    arista.apoyo = apoyo;
    arista.evidencia = evidencia;
  }
}

/** El más débil de varios apoyos de relación. Vacío = sin relaciones = inferido. */
export function apoyoMasDebil(apoyos: readonly ApoyoArista[]): ApoyoArista {
  if (apoyos.length === 0) return "inferido";
  return apoyoAristaDeNumero(
    Math.min(...apoyos.map(numeroDeApoyoArista)) as 1 | 2 | 3
  );
}

/**
 * Lo que dicen la Ficha, la leyenda y el texto exportado de una relación. La
 * misma escala que los nodos, con «textual / parcial / inferido» como nombres.
 */
export const ETIQUETA_APOYO_ARISTA: Record<ApoyoArista, string> = {
  textual: "Cita textual",
  parcial: "Dato parcial",
  inferido: "Inferencia",
};
