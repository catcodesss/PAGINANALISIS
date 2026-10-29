/** Mensajes en claro de Firebase Auth; sin revelar si un correo existe (salvo lo que Auth ya expone al registrar). */

/** Con la contraseña única, la misma contraseña abre la bóveda: pide el mínimo de la frase de paso. */
export const MINIMO_CONTRASENA = 12;

export function mensajeDeError(error: unknown): string {
  const codigo = (error as { code?: string } | null)?.code ?? "";
  switch (codigo) {
    case "auth/email-already-in-use":
    case "auth/credential-already-in-use":
      return "Ya hay una cuenta con ese correo. Prueba a iniciar sesión.";
    case "auth/weak-password":
      return `La contraseña es demasiado corta (mínimo ${MINIMO_CONTRASENA} caracteres).`;
    case "auth/invalid-email":
      return "El correo no es válido.";
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "Correo o contraseña incorrectos.";
    case "auth/too-many-requests":
      return "Demasiados intentos. Espera unos minutos e inténtalo de nuevo.";
    case "auth/network-request-failed":
      return "No hay conexión. Las cuentas necesitan internet para iniciar sesión.";
    case "auth/operation-not-allowed":
    case "auth/admin-restricted-operation":
      return "El modo invitado no está disponible todavía. Crea una cuenta para continuar.";
    default:
      return "No se pudo completar la operación. Inténtalo de nuevo.";
  }
}
