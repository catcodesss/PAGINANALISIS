/**
 * La «frase» de la bóveda derivada de la contraseña. Hace falta solo entre
 * iniciar sesión y abrir la bóveda, y entre crear la cuenta y verificar el
 * correo (hasta entonces Firestore no deja crear la bóveda).
 *
 * Vive en memoria y, para ese hueco de la verificación, también en
 * `sessionStorage`: sobrevive a recargar la pestaña o a volver del correo, pero
 * no a cerrarla, y se borra en cuanto la bóveda se abre. Nunca va a la red.
 * Después de abrirla, lo que se recuerda es la clave maestra no extraíble
 * (lib/sesionLocal.ts), no este secreto.
 */

const CLAVE = "acia.secreto-boveda";
let secreto: string | null = null;
let cuentaAntigua = false;

function almacen(): Storage | null {
  try {
    return typeof sessionStorage === "undefined" ? null : sessionStorage;
  } catch {
    return null;
  }
}

export function guardarSecretoBoveda(valor: string, antigua = false): void {
  secreto = valor;
  cuentaAntigua = antigua;
  try {
    almacen()?.setItem(CLAVE, JSON.stringify({ valor, antigua }));
  } catch {
    // Sin sessionStorage solo se pierde la comodidad de recargar.
  }
}

function recuperar(): void {
  if (secreto !== null) return;
  try {
    const crudo = almacen()?.getItem(CLAVE);
    if (!crudo) return;
    const { valor, antigua } = JSON.parse(crudo) as { valor?: unknown; antigua?: unknown };
    if (typeof valor === "string") {
      secreto = valor;
      cuentaAntigua = antigua === true;
    }
  } catch {
    // Dato ilegible: se ignora.
  }
}

export function obtenerSecretoBoveda(): string | null {
  recuperar();
  return secreto;
}

/** La cuenta se creó antes de la contraseña única: su bóveda puede tener una frase aparte. */
export function esCuentaAntigua(): boolean {
  recuperar();
  return cuentaAntigua;
}

export function olvidarSecretoBoveda(): void {
  secreto = null;
  cuentaAntigua = false;
  try {
    almacen()?.removeItem(CLAVE);
  } catch {
    // nada
  }
}
