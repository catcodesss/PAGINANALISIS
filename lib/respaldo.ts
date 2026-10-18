import type { SobreCifrado } from "./cifrado";

/**
 * Forma del fichero de respaldo, sin IndexedDB, para poder probar que un
 * respaldo antiguo se sigue importando.
 *
 * v1: solo `registros` (análisis sueltos). v2 (fase 7): además `casos`, un
 * sobre cifrado por expediente. Los registros de un v1 entran como estaban y
 * se convierten en casos con la siguiente `migrarHistorial`.
 */

export const FORMATO_RESPALDO_V1 = "acia-respaldo-v1";
export const FORMATO_RESPALDO = "acia-respaldo-v2";

export interface CrudoCifrado {
  id: string;
  fecha: string;
  sobre: SobreCifrado;
}

export interface Respaldo {
  sal: number[];
  testigo: SobreCifrado;
  registros: CrudoCifrado[];
  casos: CrudoCifrado[];
}

export function leerRespaldo(contenido: string): Respaldo {
  let datos: Record<string, unknown>;
  try {
    datos = JSON.parse(contenido);
  } catch {
    throw new Error("El archivo no es un respaldo de ACIA.");
  }
  if (datos?.formato !== FORMATO_RESPALDO && datos?.formato !== FORMATO_RESPALDO_V1) {
    throw new Error("El archivo no es un respaldo de ACIA.");
  }
  const lista = (v: unknown) => (Array.isArray(v) ? (v as CrudoCifrado[]) : []);
  return {
    sal: datos.sal as number[],
    testigo: datos.testigo as SobreCifrado,
    registros: lista(datos.registros),
    casos: lista(datos.casos),
  };
}
