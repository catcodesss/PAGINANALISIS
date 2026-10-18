import type { AnalisisFuncional, Arista, Id } from "./types";
import type { NodoGrafo } from "./grafo";
import { aristaDeHipotesis } from "./apoyoAristas";

/**
 * La ruta de lo seleccionado en el Mapa: qué se resalta y qué se atenúa, y su
 * lectura como texto (para lectores de pantalla y para quien prefiera leer).
 *
 * Es lógica pura sobre el análisis: no mira el DOM, así que se puede probar sin
 * navegador y no hace ninguna petición al cambiar de nivel o de capa.
 */

export interface RutaMapa {
  /** Nodos y aristas que se resaltan. Vacío si no hay nada del Mapa elegido. */
  ids: Set<Id>;
  /** Las aristas de la ruta, en el orden en que se leen. */
  aristas: Arista[];
}

const VACIA: RutaMapa = { ids: new Set(), aristas: [] };

/**
 * Seleccionar un nodo resalta el nodo, sus relaciones directas y los nodos al
 * otro lado: lo que se necesita para responder «¿qué mantiene esto?» sin cambiar
 * de vista. Seleccionar una relación resalta la relación y sus dos extremos.
 * Una hipótesis resalta la relación que traza en el grafo, si la traza.
 */
export function rutaDeSeleccion(
  analisis: Pick<AnalisisFuncional, "aristas" | "hipotesis_mantenimiento">,
  nodos: readonly NodoGrafo[],
  seleccionado: Id | null
): RutaMapa {
  if (!seleccionado) return VACIA;
  const arista = analisis.aristas.find((a) => a.id === seleccionado);
  if (arista) {
    return { ids: new Set([arista.id, arista.desde, arista.hasta]), aristas: [arista] };
  }
  const hipotesis = analisis.hipotesis_mantenimiento.find((h) => h.id === seleccionado);
  if (hipotesis) {
    const suya = aristaDeHipotesis(analisis as AnalisisFuncional, hipotesis);
    return suya
      ? { ids: new Set([suya.id, suya.desde, suya.hasta]), aristas: [suya] }
      : VACIA;
  }
  if (!nodos.some((n) => n.id === seleccionado)) return VACIA;
  // Los eslabones de la cadena interna y el estímulo condicionado se
  // atraviesan: con la cadena DBT el antecedente no llega a la conducta
  // directamente sino por el EC y los eslabones, y cortar ahí atenuaría justo
  // el Ed de la situación.
  const encubiertos = new Set(
    nodos.filter((n) => n.tipo === "encubierta" || n.tipo === "ec").map((n) => n.id)
  );
  const vistas = new Set<Id>();
  const recorrer = (id: Id, sentido: "entra" | "sale", salida: Arista[]) => {
    for (const a of analisis.aristas) {
      if (vistas.has(a.id) || (sentido === "entra" ? a.hasta : a.desde) !== id) continue;
      vistas.add(a.id);
      salida.push(a);
      const otro = sentido === "entra" ? a.desde : a.hasta;
      if (encubiertos.has(otro) && otro !== seleccionado) recorrer(otro, sentido, salida);
    }
  };
  const entrantes: Arista[] = [];
  const salientes: Arista[] = [];
  recorrer(seleccionado, "entra", entrantes);
  recorrer(seleccionado, "sale", salientes);
  // Hacia atrás se recoge del final al principio: se invierte para leerla en orden.
  const aristas = [...entrantes.reverse(), ...salientes];
  const ids = new Set<Id>([seleccionado]);
  for (const a of aristas) {
    ids.add(a.id);
    ids.add(a.desde);
    ids.add(a.hasta);
  }
  return { ids, aristas };
}

/** «Ed: …», «Conducta: …», con el tipo en palabras. */
export type RotularNodo = (nodo: NodoGrafo) => string;

/**
 * La ruta como lista lineal de frases. Si no hay nada elegido, la cadena de
 * cada situación en orden (antecedente → conducta → consecuencia).
 */
export function textoDeRuta(
  analisis: Pick<AnalisisFuncional, "aristas" | "hipotesis_mantenimiento" | "situaciones">,
  nodos: readonly NodoGrafo[],
  seleccionado: Id | null,
  rotular: RotularNodo,
  describirApoyo: (a: Arista) => string
): string[] {
  const porId = new Map(nodos.map((n) => [n.id, n]));
  const nombre = (id: Id) => {
    const n = porId.get(id);
    return n ? rotular(n) : "[elemento sin etiqueta]";
  };
  const ruta = rutaDeSeleccion(analisis, nodos, seleccionado);
  if (ruta.aristas.length > 0) {
    return ruta.aristas.map(
      (a) => `${nombre(a.desde)} → ${nombre(a.hasta)} (${describirApoyo(a)})`
    );
  }
  if (seleccionado && porId.has(seleccionado)) {
    return [`${nombre(seleccionado)}: sin relaciones trazadas.`];
  }
  return analisis.situaciones.map((s) => {
    const deSituacion = nodos.filter((n) => n.situacion_id === s.id && !n.alternativa);
    const orden = ["ed", "ec", "conducta", "consecuencia"] as const;
    const pasos = orden.flatMap((tipo) =>
      deSituacion
        .filter((n) => n.tipo === tipo && (tipo !== "consecuencia" || n.carril === "inmediata"))
        .map(rotular)
    );
    const funcion = deSituacion.find((n) => n.tipo === "funcion");
    return `${s.nombre}: ${pasos.join(" → ") || "sin cadena trazada"}${funcion ? ` (función: ${funcion.etiqueta})` : ""}.`;
  });
}

/**
 * La arista siguiente al pulsar una flecha, para recorrer el Mapa con el
 * teclado. Sobre un nodo: → la primera relación que sale, ← la primera que
 * entra. Sobre una relación: → su destino, ← su origen.
 */
export function siguientePorTeclado(
  analisis: Pick<AnalisisFuncional, "aristas">,
  seleccionado: Id | null,
  tecla: "ArrowRight" | "ArrowLeft"
): Id | null {
  if (!seleccionado) return null;
  const arista = analisis.aristas.find((a) => a.id === seleccionado);
  if (arista) return tecla === "ArrowRight" ? arista.hasta : arista.desde;
  const candidata =
    tecla === "ArrowRight"
      ? analisis.aristas.find((a) => a.desde === seleccionado)
      : analisis.aristas.find((a) => a.hasta === seleccionado);
  return candidata?.id ?? null;
}
