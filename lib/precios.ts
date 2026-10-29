/**
 * Política de precio de los análisis, separada del cobro (que llega con las
 * Coins, etapa 9 de la fase 13). Un invitado paga más que quien tiene cuenta;
 * quien cree cuenta conserva las monedas que haya comprado como invitado.
 *
 * Todavía no hay nada que cobre: cuando exista, el servidor sabe si la llamada
 * es de invitado (`Llamada.invitado`) y debe usar `precioEnCoins`.
 */

export const FACTOR_PRECIO_INVITADO = 1.5;

/** Los invitados no reciben monedas de prueba: solo las compran. */
export const MONEDAS_DE_PRUEBA_INVITADO = 0;

export function precioEnCoins(base: number, invitado: boolean): number {
  return invitado ? Math.ceil(base * FACTOR_PRECIO_INVITADO) : base;
}
