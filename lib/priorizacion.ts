import type { AnalisisFuncional, NivelConfianza } from "./types";
import { raicesSignificativas } from "./validadores";

/**
 * Ordena los blancos de intervención por rendimiento esperado.
 *
 * QUÉ ES Y QUÉ NO ES. Los números de este módulo NO miden nada. Son
 * estimaciones cualitativas —alta, media, baja, dichas por un modelo a partir
 * de una nota clínica— convertidas a números con el único fin de poder
 * ordenarlas. No hay unidades, no hay escala, no hay precisión: 0,32 no es "el
 * doble de bueno" que 0,16, y la diferencia entre 0,32 y 0,16 no significa lo
 * mismo en dos informes distintos. Todo lo que este cálculo sostiene es "esto
 * probablemente antes que aquello", y ni siquiera eso sin que el clínico lo
 * mire.
 *
 * POR QUÉ AUN ASÍ EXISTE. Con seis variables y ocho relaciones, el orden en que
 * conviene atacarlas no se ve leyendo. La multiplicación fuerza × modificabilidad
 * captura una idea clínica sencilla y correcta: el tratamiento rinde donde algo
 * PESA en el mantenimiento y además PUEDE MOVERSE. Una variable determinante e
 * inamovible y una trivial y muy modificable dan las dos un rendimiento bajo,
 * por motivos opuestos, y eso es exactamente lo que se quiere que salte a la
 * vista.
 *
 * POR QUÉ ESTOS NÚMEROS. 0,8 / 0,4 / 0,2 y no 3 / 2 / 1: el salto de "media" a
 * "alta" tiene que pesar más que el de "baja" a "media", porque en la práctica
 * clínica esa es la distancia real entre las tres etiquetas. Cualquier terna
 * decreciente con esa propiedad daría el mismo orden en casi todos los casos —
 * lo que confirma que el valor concreto no es el punto.
 *
 * La escala es geométrica (cada nivel es el doble del siguiente), y de ahí sale
 * una consecuencia que conviene conocer: alta × baja empata exactamente con
 * media × media. Un factor determinante pero rígido y uno intermedio en las dos
 * escalas rinden lo mismo, que es la lectura clínica que se busca. No es un
 * defecto del cálculo que haya que corregir subiendo un número.
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

export interface BlancoPriorizado {
  /** La descripción de la variable moduladora, tal cual la escribió el informe. */
  etiqueta: string;
  /** La mayor fuerza entre las relaciones que la nombran. */
  fuerza: NivelConfianza;
  modificabilidad: NivelConfianza;
  /** fuerza × modificabilidad. Sin unidades: solo sirve para ordenar. */
  rendimiento: number;
  /** Cuántas hipótesis de mantenimiento la nombran. */
  relaciones: number;
}

/** Cuántas raíces en común hacen falta para dar por nombrada a una variable. */
const COINCIDENCIAS_MINIMAS = 2;

const ORDEN_NIVEL: NivelConfianza[] = ["baja", "media", "alta"];

function laMayor(a: NivelConfianza, b: NivelConfianza): NivelConfianza {
  return ORDEN_NIVEL.indexOf(a) >= ORDEN_NIVEL.indexOf(b) ? a : b;
}

/**
 * Una variable causal es una variable moduladora que alguna hipótesis de
 * mantenimiento nombra: sin relación declarada no es un blanco, es un dato de
 * contexto. Se queda fuera en vez de aparecer con rendimiento cero, que se
 * leería como "esto no sirve de nada" cuando lo que pasa es que el informe no
 * dijo qué papel juega.
 *
 * La fuerza de la variable es la MAYOR de las relaciones que la nombran, no su
 * media: si participa en una relación fuerte, es un blanco fuerte, aunque
 * también aparezca en dos débiles. Promediar la castigaría por estar bien
 * descrita.
 */
export function priorizarBlancos(analisis: AnalisisFuncional): BlancoPriorizado[] {
  const blancos: BlancoPriorizado[] = [];

  for (const variable of analisis.variables_moduladoras) {
    const raicesVariable = raicesSignificativas(variable.descripcion);
    if (raicesVariable.size === 0) continue;

    let fuerza: NivelConfianza | null = null;
    let relaciones = 0;

    for (const h of analisis.hipotesis_mantenimiento) {
      const raicesHipotesis = raicesSignificativas(`${h.enunciado} ${h.funcion}`);
      const comunes = [...raicesVariable].filter((r) => raicesHipotesis.has(r));
      if (comunes.length < COINCIDENCIAS_MINIMAS) continue;
      relaciones += 1;
      fuerza = fuerza === null ? h.fuerza : laMayor(fuerza, h.fuerza);
    }

    if (fuerza === null) continue;

    blancos.push({
      etiqueta: variable.descripcion,
      fuerza,
      modificabilidad: variable.modificabilidad,
      rendimiento:
        VALOR_CUALITATIVO[fuerza] * VALOR_CUALITATIVO[variable.modificabilidad],
      relaciones,
    });
  }

  // Array.prototype.sort es estable: dos blancos con el mismo rendimiento
  // conservan el orden del informe en vez de reordenarse sin motivo entre
  // renders.
  return blancos.sort((a, b) => b.rendimiento - a.rendimiento);
}
