import type { User } from "firebase/auth";
import type { Perfil } from "./perfil";

/**
 * El perfil se escribe en el servidor, que solo acepta cuentas con el correo
 * verificado. Entre crear la cuenta y verificarla queda en `sessionStorage`
 * (como el secreto de la bóveda) y se envía en cuanto la cuenta entra. Si el
 * envío falla, se reintenta en la siguiente entrada: no bloquea nada.
 */

const CLAVE = "acia.perfil-pendiente";

function almacen(): Storage | null {
  try {
    return typeof sessionStorage === "undefined" ? null : sessionStorage;
  } catch {
    return null;
  }
}

export function guardarPerfilPendiente(perfil: Perfil): void {
  try {
    almacen()?.setItem(CLAVE, JSON.stringify(perfil));
  } catch {
    // Sin sessionStorage el perfil no se envía: no es un dato imprescindible.
  }
}

export async function enviarPerfilPendiente(usuario: User): Promise<void> {
  try {
    const crudo = almacen()?.getItem(CLAVE);
    if (!crudo) return;
    const respuesta = await fetch("/api/perfil", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${await usuario.getIdToken()}` },
      body: crudo,
    });
    if (respuesta.ok) almacen()?.removeItem(CLAVE);
  } catch {
    // Se reintenta en la próxima entrada.
  }
}
