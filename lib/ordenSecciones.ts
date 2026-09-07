import { posicionDeGrupo } from "./secciones";

/**
 * Conciliar un orden de bloques guardado con el que existe hoy.
 *
 * Vive en lib/ y no dentro de components/ordenBloques.tsx —que es quien lo
 * usa— por una razón concreta: es la única parte de la ordenación que puede
 * dar un resultado incorrecto en silencio, y aquí sí se puede probar. Un
 * componente con React, localStorage y arrastre no se prueba en `node --test`;
 * una función pura sí.
 */

/**
 * Tres cosas que puede traer un orden guardado por otra versión de la app:
 * bloques que ya no existen —se descartan, y por eso un id retirado o fusionado
 * que siga en localStorage no rompe nada—, bloques nuevos que no menciona, y un
 * reparto de grupos que ya no es el de hoy.
 *
 * Los nuevos NO van al final. Iban, y eso convertía "no desaparece del
 * documento" en "aparece donde nadie lo lee": una sección añadida arriba del
 * informe caía debajo de "Datos faltantes" para cualquiera que hubiera
 * arrastrado un bloque alguna vez, sin dar ningún error. Cada id que falta se
 * coloca detrás de su vecino de fábrica más cercano que sí esté presente, así
 * que el orden que eligió el clínico se respeta entero y el bloque nuevo
 * aterriza donde su lista dice que va.
 *
 * El último paso es una ordenación ESTABLE por grupo: dentro de un grupo se
 * respeta entero lo que el clínico eligió, pero un bloque no puede quedarse en
 * mitad de un grupo ajeno. Sin esto, un orden guardado antes de que existieran
 * los grupos —o antes de que una sección cambiara de grupo— dejaría los
 * contrapesos intercalados entre lo descriptivo, que no se lee como una
 * preferencia sino como un documento roto.
 */
export function reconciliarOrden(
  guardado: unknown[],
  idsPorDefecto: string[]
): string[] {
  const orden = guardado.filter(
    (id): id is string => typeof id === "string" && idsPorDefecto.includes(id)
  );
  // Un mismo id repetido en el orden guardado se pintaría dos veces en el
  // índice con la misma clave de React; se queda solo la primera aparición.
  const unicos = [...new Set(orden)];

  idsPorDefecto.forEach((id, i) => {
    if (unicos.includes(id)) return;
    let destino = 0;
    for (let j = i - 1; j >= 0; j -= 1) {
      const posicion = unicos.indexOf(idsPorDefecto[j]);
      if (posicion !== -1) {
        destino = posicion + 1;
        break;
      }
    }
    unicos.splice(destino, 0, id);
  });

  // Array.prototype.sort es estable desde ES2019: el orden elegido dentro de
  // cada grupo sobrevive intacto.
  return unicos.sort((a, b) => posicionDeGrupo(a) - posicionDeGrupo(b));
}
