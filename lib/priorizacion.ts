import type { AnalisisFuncional, Id, NivelConfianza } from "./types";

/**
 * UN SOLO RANKING, Y ES DE CONDUCTAS.
 *
 * Había dos, y los dos se llamaban casi igual en pantalla: «Priorización de
 * blancos de intervención», que ordenaba CONDUCTAS a partir de la prosa del
 * modelo, y «Rendimiento esperado de cada blanco», que ordenaba VARIABLES
 * MODULADORAS por fuerza × modificabilidad. Dos listas, dos unidades de
 * análisis distintas, el mismo nombre y ninguna relación declarada entre ellas:
 * el lector no tenía forma de saber que hablaban de cosas diferentes.
 *
 * Se unifican en el blanco que de verdad se interviene: la conducta. Una
 * variable moduladora no es un blanco por sí misma —nadie trata «el sueño
 * deficiente» en abstracto—: es la PALANCA por la que una conducta concreta se
 * puede mover, y aquí aparece como eso, colgando de la conducta que mantiene.
 *
 * QUÉ ES Y QUÉ NO ES. Los números NO miden nada. Son estimaciones cualitativas
 * —alta, media, baja, dichas por un modelo a partir de una nota clínica—
 * convertidas a números con el único fin de poder ordenarlas. No hay unidades,
 * no hay escala, no hay precisión: 0,32 no es «el doble de bueno» que 0,16, y
 * la diferencia entre 0,32 y 0,16 no significa lo mismo en dos informes
 * distintos. Todo lo que sostiene este cálculo es «esto probablemente antes que
 * aquello», y ni siquiera eso sin que el clínico lo mire.
 *
 * POR QUÉ AUN ASÍ EXISTE. La multiplicación importancia × modificabilidad
 * captura una idea clínica sencilla y correcta: el tratamiento rinde donde algo
 * PESA y además PUEDE MOVERSE. Una conducta central pero sin palanca conocida y
 * una trivial muy modificable dan las dos un rendimiento bajo, por motivos
 * opuestos, y eso es exactamente lo que se quiere que salte a la vista.
 *
 * POR QUÉ ESTOS NÚMEROS. 0,8 / 0,4 / 0,2 y no 3 / 2 / 1: el salto de «media» a
 * «alta» tiene que pesar más que el de «baja» a «media». La escala es
 * geométrica, y de ahí sale una consecuencia que conviene conocer: alta × baja
 * empata exactamente con media × media. No es un defecto que haya que corregir
 * subiendo un número: es la lectura clínica que se busca.
 *
 * La interfaz tiene la obligación de decir todo esto donde se pinten las
 * barras. Ver PriorizacionEstimada en components/ReportView.tsx.
 */

/**
 * La conversión. Deliberadamente en un solo sitio: si algún día se afina, se
 * afina aquí y no en cinco cálculos repartidos.
 */
export const VALOR_CUALITATIVO: Record<NivelConfianza, number> = {
  alta: 0.8,
  media: 0.4,
  baja: 0.2,
};

/** El producto más alto posible: sirve para dar a las barras una escala fija. */
export const RENDIMIENTO_MAXIMO =
  VALOR_CUALITATIVO.alta * VALOR_CUALITATIVO.alta;

/** La variable moduladora por la que una conducta se puede mover. */
export interface PalancaBlanco {
  id: Id;
  etiqueta: string;
  modificabilidad: NivelConfianza;
  /** Cuánto pesa la relación de esa variable con esta conducta. */
  fuerza: NivelConfianza;
}

export interface BlancoPriorizado {
  /** El id de la conducta problema, para enlazar con su nodo del grafo. */
  id: Id;
  etiqueta: string;
  importancia: NivelConfianza;
  /**
   * La mejor palanca conocida, o null si ninguna variable moduladora se ha
   * trazado hasta esta conducta. `null` NO es modificabilidad baja: es que no
   * consta por dónde moverla, y son dos cosas distintas que el informe no puede
   * presentar igual.
   */
  palanca: PalancaBlanco | null;
  /** importancia × modificabilidad de la palanca. null si no hay palanca. */
  rendimiento: number | null;
  /** Cuántas hipótesis de mantenimiento apuntan a esta conducta. */
  relaciones: number;
  /** La justificación que escribió el modelo, si nombró este blanco. */
  justificacion: string;
}

const ORDEN_NIVEL: NivelConfianza[] = ["baja", "media", "alta"];

function laMayor(a: NivelConfianza, b: NivelConfianza): NivelConfianza {
  return ORDEN_NIVEL.indexOf(a) >= ORDEN_NIVEL.indexOf(b) ? a : b;
}

/**
 * Ordena las conductas problema por rendimiento esperado.
 *
 * La palanca de una conducta es la variable moduladora MÁS MODIFICABLE de entre
 * las que alguna hipótesis traza hasta ella (`origen_id` → `destino_id`). Se
 * toma la más modificable y no la más fuerte porque lo que decide por dónde
 * empezar es qué se puede mover: una variable determinante e inamovible explica
 * el caso, pero no abre ninguna puerta.
 *
 * Todo esto es exacto desde la v2. Antes se emparejaban las raíces de palabra
 * del enunciado con la descripción de la variable, en cada render, así que la
 * misma variable entraba o salía del ranking según cómo estuviera redactada la
 * hipótesis.
 */
export function priorizarBlancos(analisis: AnalisisFuncional): BlancoPriorizado[] {
  const variables = new Map(
    analisis.variables_moduladoras.map((v) => [v.id, v] as const)
  );
  const justificaciones = new Map(
    analisis.formulacion.priorizacion
      .filter((p) => p.conducta_id)
      .map((p) => [p.conducta_id!, p.justificacion] as const)
  );

  const blancos = analisis.conductas_problema.map((conducta) => {
    let palanca: PalancaBlanco | null = null;
    let relaciones = 0;

    for (const h of analisis.hipotesis_mantenimiento) {
      if (h.destino_id !== conducta.id) continue;
      relaciones += 1;
      const variable = h.origen_id ? variables.get(h.origen_id) : undefined;
      if (!variable) continue;
      if (
        !palanca ||
        laMayor(palanca.modificabilidad, variable.modificabilidad) ===
          variable.modificabilidad
      ) {
        palanca = {
          id: variable.id,
          etiqueta: variable.descripcion,
          modificabilidad: variable.modificabilidad,
          fuerza: h.fuerza,
        };
      }
    }

    return {
      id: conducta.id,
      etiqueta: conducta.descripcion,
      importancia: conducta.importancia,
      palanca,
      rendimiento: palanca
        ? VALOR_CUALITATIVO[conducta.importancia] *
          VALOR_CUALITATIVO[palanca.modificabilidad]
        : null,
      relaciones,
      justificacion: justificaciones.get(conducta.id) ?? "",
    };
  });

  /*
    Las que no tienen palanca van al final, pero NO con rendimiento cero: cero
    se leería como «esto no sirve de nada», y lo que pasa es que el informe no
    ha trazado todavía por dónde se mueve. Es un hueco de la formulación, no un
    veredicto sobre la conducta, y la interfaz tiene que decirlo así.

    Array.prototype.sort es estable: dos blancos con el mismo rendimiento
    conservan el orden del informe en vez de reordenarse entre renders.
  */
  return blancos.sort((a, b) => {
    if (a.rendimiento === null && b.rendimiento === null) return 0;
    if (a.rendimiento === null) return 1;
    if (b.rendimiento === null) return -1;
    return b.rendimiento - a.rendimiento;
  });
}
