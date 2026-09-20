import type { AnalisisFuncional, NivelConfianza, TipoRelacion } from "./types";

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
 * components/ReportView.tsx. Separarlo es lo que permite probar sin montar un
 * componente lo que puede salir mal en silencio: la detección de ciclos.
 *
 * Tampoco EMPAREJA ya. Desde la v2, cada hipótesis trae sus dos extremos
 * resueltos a id (ver lib/identidad.ts) y aquí solo se leen. Antes se buscaban
 * aquí por raíces de palabra, en cada render: una hipótesis que no casara
 * desaparecía del dibujo sin dejar rastro, y el caso se leía más simple de lo
 * que era.
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
   * Cuántas hipótesis de mantenimiento no se pudieron situar en la red porque
   * les falta uno de los dos extremos. Antes desaparecían sin dejar rastro; se
   * cuentan para poder decirlo, porque una red con menos relaciones de las que
   * el informe declara se lee como un caso más simple de lo que es.
   */
  sinResolver: number;
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
  // Los ids son los del propio análisis (cnd_1, vmd_2…), no unos inventados
  // aquí: así el nodo del dibujo y la entidad del informe son la misma cosa, y
  // un aviso puede enlazar con su nodo.
  const conductas = analisis.conductas_problema.map((c) => ({
    id: c.id,
    texto: c.descripcion,
    radio: RADIO_POR_IMPORTANCIA[c.importancia] ?? RADIO_POR_IMPORTANCIA.baja,
  }));
  const variables = analisis.variables_moduladoras.map((v) => ({
    id: v.id,
    texto: v.descripcion,
  }));

  const vacia = (motivo: string, sinResolver = 0): RedFuncional => ({
    nodos: [],
    aristas: [],
    ancho: ANCHO,
    alto: 0,
    bucles: [],
    sinResolver,
    motivoVacio: motivo,
  });

  if (analisis.hipotesis_mantenimiento.length < MINIMO_ARISTAS) {
    return vacia(
      "El informe declara menos de dos hipótesis de mantenimiento. Con una sola relación no hay red que dibujar: la frase ya la cuenta entera."
    );
  }

  /*
    Cada hipótesis trae sus dos extremos ya resueltos a id (ver lib/identidad.ts):
    `destino_id` es la conducta que mantiene y `origen_id` lo que la mantiene.
    Este módulo ya no empareja nada.

    Hasta la v2 los buscaba aquí por raíces de palabra, en cada render, y una
    hipótesis que no casara se saltaba EN SILENCIO: el dibujo salía con menos
    relaciones de las que el informe declaraba y nada lo decía. Ahora una
    relación sin resolver se cuenta y se nombra abajo, que es lo que permite al
    clínico ir a arreglarla.
  */
  const aristas: AristaRed[] = [];
  let sinResolver = 0;
  const existe = new Set([...conductas, ...variables].map((n) => n.id));

  for (const h of analisis.hipotesis_mantenimiento) {
    const hasta = h.destino_id;
    const desde = h.origen_id;
    if (!hasta || !desde || desde === hasta || !existe.has(hasta) || !existe.has(desde)) {
      sinResolver += 1;
      continue;
    }

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
      `Menos de dos hipótesis de mantenimiento tienen sus dos extremos identificados${
        sinResolver > 0 ? ` (${sinResolver} sin resolver)` : ""
      }: no nombran una conducta problema y una variable reconocibles del propio informe. El dibujo se omite en vez de inventar conexiones que el análisis no declara.`,
      sinResolver
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
    sinResolver,
    motivoVacio: null,
  };
}
