/**
 * La «frase» de la bóveda derivada de la contraseña, guardada solo en memoria
 * entre iniciar sesión y abrir la bóveda (y entre crear la cuenta y verificar
 * el correo). No toca disco, ni almacenamiento del navegador, ni la red: si se
 * recarga la página, desaparece y se vuelve a pedir la contraseña.
 */

let secreto: string | null = null;
let cuentaAntigua = false;

export function guardarSecretoBoveda(valor: string, antigua = false): void {
  secreto = valor;
  cuentaAntigua = antigua;
}

export function obtenerSecretoBoveda(): string | null {
  return secreto;
}

/** La cuenta se creó antes de la contraseña única: su bóveda puede tener una frase aparte. */
export function esCuentaAntigua(): boolean {
  return cuentaAntigua;
}

export function olvidarSecretoBoveda(): void {
  secreto = null;
  cuentaAntigua = false;
}
