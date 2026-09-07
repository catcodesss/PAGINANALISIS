import type { AnalisisFuncional, NivelConfianza, TipoRelacion } from "./types";
import { raicesSignificativas } from "./validadores";

/**
 * La red funcional del caso: qué está conectado con qué, calculado a partir de
 * las hipótesis de mantenimiento.
 *
 * Por qué existe: la prosa esconde los bucles. Un informe puede decir en la
 * hipótesis 1 que el aislamiento alimenta la evitación y en la hipótesis 4 que
 * la evitación aumenta el aislamiento, y las dos frases se leen por separado
 * como dos observaciones razonables. Dibujadas, son un ciclo cerrado — y un
 * ciclo cerrado cambia el plan: hay que romperlo por algún punto, no tratar sus
 * dos mitades como problemas independientes.
 *
 * Este módulo NO dibuja: calcula nodos, aristas y posiciones. El SVG lo pinta
 * components/ReportView.tsx. Separarlo es lo que permite probar lo único que
 * puede salir mal en silencio —el emparejamiento y la detección de ciclos— sin
 * montar un componente.
 *
 * DETERMINISTA: todo sale del orden de los arreglos del informe. El mismo
 * informe da el mismo dibujo, siempre; un diseño con posiciones aleatorias o
 * relajación física haría que dos capturas del mismo caso no se pudieran
 * comparar.
 */

export type TipoNodoRed = "conducta" | "variable";

export interface NodoRed {
  id: string;
  /** Texto completo, para el `title` y el nombre accesible. */
  etiqueta: string;
  tipo: TipoNodoRed;
  x: number;
  y: number;
  /** Radio en unidades del viewBox. Sale de la importancia; las variables son fijas. */
  radio: number;
  /** Si participa en algún bucle cerrado. */
  enBucle: boolean;
}

export interface AristaRed {
  desde: string;
  hasta: string;
  fuerza: NivelConfianza;
  bidireccional: boolean;
  tipo_relacion: TipoRelacion;
  /** Si esta arista forma parte de un ciclo cerrado del grafo. */
  enBucle: boolean;
  /** La hipótesis que la originó, para el nombre accesible. */
  enunciado: string;
}

export interface RedFuncional {
  nodos: NodoRed[];
  aristas: AristaRed[];
  ancho: number;
  alto: number;
  /** Los ciclos encontrados, ya en palabras: "A → B → A". */
  bucles: string[];
  /**
   * Por qué no hay dibujo. `null` cuando sí lo hay. Se dice en vez de dejar un
   * hueco: un diagrama ausente sin explicación se lee como un fallo de la
   * página, y aquí casi siempre significa que el informe no declaró suficientes
   * relaciones — que es información sobre el informe.
   */
  motivoVacio: string | null;
}

/** Mínimo para que un dibujo diga algo que la lista de hipótesis no diga ya. */
const MINIMO_ARISTAS = 2;

const RADIO_POR_IMPORTANCIA: Record<NivelConfianza, number> = {
  alta: 26,
  media: 20,
  baja: 15,
};

/** Las variables no llevan importancia: van todas del mismo tamaño y con otra forma. */
const RADIO_VARIABLE = 14;

/*
  El ancho no es estético: las etiquetas van FUERA del nodo, alineadas hacia
  afuera, y a 760 se salían del viewBox por los dos lados — el texto quedaba
  cortado justo en las descripciones largas, que son las que más falta hace
  leer. Con 1000 y las columnas a 254/640 caben 30 caracteres a cada lado sin
  tocar el borde, y la curva de las aristas de la misma columna (110 de desvío)
  tampoco se sale.
*/
const ANCHO = 1000;
const X_VARIABLES = 254;
const X_CONDUCTAS = 640;
const SEPARACION_VERTICAL = 92;
const MARGEN_SUPERIOR = 46;

/** Cuántas raíces en común hacen falta para dar dos textos por emparejados. */
const COINCIDENCIAS_MINIMAS = 2;

function mejorCoincidencia(
  texto: string,
  candidatos: { id: string; texto: string }[]
): string | null {
  const raices = raicesSignificativas(texto);
  if (raices.size === 0) return null;

  let mejor: { id: string; puntos: number } | null = null;
  for (const c of candidatos) {
    const puntos = [...raicesSignificativas(c.texto)].filter((r) =>
      raices.has(r)
    ).length;
    // Estrictamente mayor: ante un empate gana el primero del arreglo, que es
    // lo que mantiene el dibujo estable entre ejecuciones.
    if (puntos >= COINCIDENCIAS_MINIMAS && (!mejor || puntos > mejor.puntos)) {
      mejor = { id: c.id, puntos };
    }
  }
  return mejor?.id ?? null;
}

/**
 * Ciclos del grafo dirigido, por búsqueda en profundidad con pila de camino.
 * Una arista bidireccional cuenta como ciclo por sí sola: es lo que declara.
 *
 * No busca TODOS los ciclos (eso es exponencial y aquí sobra): basta con saber
 * qué aristas participan en alguno y poder nombrarlos.
 */
function detectarBucles(
  nodos: string[],
  aristas: AristaRed[]
): { aristasEnBucle: Set<number>; ciclos: string[][] } {
  const salientes = new Map<string, { indice: number; hasta: string }[]>();
  for (const id of nodos) salientes.set(id, []);
  aristas.forEach((a, indice) => {
    salientes.get(a.desde)?.push({ indice, hasta: a.hasta });
    if (a.bidireccional) salientes.get(a.hasta)?.push({ indice, hasta: a.desde });
  });

  const aristasEnBucle = new Set<number>();
  const ciclos: string[][] = [];
  const vistos = new Set<string>();

  function explorar(actual: string, camino: string[], aristasCamino: number[]) {
    const yaEnCamino = camino.indexOf(actual);
    if (yaEnCamino !== -1) {
      const ciclo = [...camino.slice(yaEnCamino), actual];
      // Una firma ordenada evita registrar el mismo ciclo una vez por cada
      // nodo desde el que se entra en él.
      const firma = [...new Set(ciclo)].sort().join("|");
      if (!vistos.has(firma)) {
        vistos.add(firma);
        ciclos.push(ciclo);
        for (const i of aristasCamino.slice(yaEnCamino)) aristasEnBucle.add(i);
      }
      return;
    }
    // El camino acota la profundidad: sin esto, un grafo denso explotaría.
    if (camino.length > nodos.length) return;
    for (const { indice, hasta } of salientes.get(actual) ?? []) {
      explorar(hasta, [...camino, actual], [...aristasCamino, indice]);
    }
  }

  for (const id of nodos) explorar(id, [], []);
  return { aristasEnBucle, ciclos };
}

export function construirRedFuncional(analisis: AnalisisFuncional): RedFuncional {
  const conductas = analisis.conductas_problema.map((c, i) => ({
    id: `c${i}`,
    texto: c.descripcion,
    radio: RADIO_POR_IMPORTANCIA[c.importancia] ?? RADIO_POR_IMPORTANCIA.baja,
  }));
  const variables = analisis.variables_moduladoras.map((v, i) => ({
    id: `v${i}`,
    texto: v.descripcion,
  }));

  const vacia = (motivo: string): RedFuncional => ({
    nodos: [],
    aristas: [],
    ancho: ANCHO,
    alto: 0,
    bucles: [],
    motivoVacio: motivo,
  });

  if (analisis.hipotesis_mantenimiento.length < MINIMO_ARISTAS) {
    return vacia(
      "El informe declara menos de dos hipótesis de mantenimiento. Con una sola relación no hay red que dibujar: la frase ya la cuenta entera."
    );
  }

  /*
    Cada hipótesis nombra su destino en "conducta" y describe el origen dentro
    del enunciado. El emparejamiento por raíces es aproximado y puede no
    resolver una hipótesis; cuando eso pasa, esa hipótesis NO se dibuja. Es
    deliberado: una arista inventada entre dos nodos que el informe no relaciona
    afirmaría algo que nadie escribió, y en un dibujo eso se lee como un
    hallazgo.
  */
  const aristas: AristaRed[] = [];
  for (const h of analisis.hipotesis_mantenimiento) {
    const hasta = mejorCoincidencia(h.conducta, conductas);
    if (!hasta) continue;

    const contexto = `${h.enunciado} ${h.funcion}`;
    const desde =
      mejorCoincidencia(contexto, variables) ??
      mejorCoincidencia(
        contexto,
        conductas.filter((c) => c.id !== hasta)
      );
    if (!desde || desde === hasta) continue;

    aristas.push({
      desde,
      hasta,
      fuerza: h.fuerza,
      bidireccional: h.direccion === "bidireccional",
      tipo_relacion: h.tipo_relacion,
      enBucle: false,
      enunciado: h.enunciado,
    });
  }

  if (aristas.length < MINIMO_ARISTAS) {
    return vacia(
      "Menos de dos hipótesis de mantenimiento se pueden situar en la red: no nombran una conducta problema y una variable reconocibles del propio informe. El dibujo se omite en vez de inventar conexiones que el análisis no declara."
    );
  }

  // Solo se pintan los nodos que participan en alguna relación: un nodo suelto
  // no aporta nada al dibujo y aleja los que sí están conectados.
  const usados = new Set(aristas.flatMap((a) => [a.desde, a.hasta]));

  const columnaVariables = variables.filter((v) => usados.has(v.id));
  const columnaConductas = conductas.filter((c) => usados.has(c.id));

  const { aristasEnBucle, ciclos } = detectarBucles(
    [...usados],
    aristas
  );
  aristas.forEach((a, i) => {
    a.enBucle = aristasEnBucle.has(i);
  });

  const nodosEnBucle = new Set(ciclos.flat());
  const alto =
    MARGEN_SUPERIOR * 2 +
    Math.max(columnaVariables.length, columnaConductas.length, 1) *
      SEPARACION_VERTICAL;

  /** Centra cada columna verticalmente, para que no cuelguen desde arriba. */
  const posicionY = (indice: number, total: number) =>
    alto / 2 + (indice - (total - 1) / 2) * SEPARACION_VERTICAL;

  const nodos: NodoRed[] = [
    ...columnaVariables.map((v, i) => ({
      id: v.id,
      etiqueta: v.texto,
      tipo: "variable" as const,
      x: X_VARIABLES,
      y: posicionY(i, columnaVariables.length),
      radio: RADIO_VARIABLE,
      enBucle: nodosEnBucle.has(v.id),
    })),
    ...columnaConductas.map((c, i) => ({
      id: c.id,
      etiqueta: c.texto,
      tipo: "conducta" as const,
      x: X_CONDUCTAS,
      y: posicionY(i, columnaConductas.length),
      radio: c.radio,
      enBucle: nodosEnBucle.has(c.id),
    })),
  ];

  const etiquetaDe = new Map(nodos.map((n) => [n.id, n.etiqueta]));

  return {
    nodos,
    aristas,
    ancho: ANCHO,
    alto,
    // En palabras además de en el dibujo: un bucle señalado solo con un trazo
    // distinto no llega a quien lee con lector de pantalla ni al informe
    // impreso en blanco y negro.
    bucles: ciclos.map((ciclo) =>
      ciclo.map((id) => etiquetaDe.get(id) ?? id).join(" → ")
    ),
    motivoVacio: null,
  };
}
