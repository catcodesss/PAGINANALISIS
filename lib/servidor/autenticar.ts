/**
 * Identidad de quien llama a una ruta del servidor. El UID NUNCA viene del cuerpo
 * de la petición: sale del Firebase ID Token ya verificado.
 */

export interface TokenVerificado {
  uid: string;
  email_verified?: boolean;
  /** Presente en los ID Token de Firebase; `anonymous` es un invitado. */
  firebase?: { sign_in_provider?: string };
}

/** `revocados` = comprobar también que la sesión no fue revocada (una consulta más). */
export type VerificadorToken = (token: string, revocados: boolean) => Promise<TokenVerificado>;

export class ErrorHttp extends Error {
  constructor(
    public readonly estado: number,
    public readonly codigo: string,
    mensaje: string
  ) {
    super(mensaje);
    this.name = "ErrorHttp";
  }
}

/**
 * `permitirInvitado`: las rutas de IA aceptan invitados (sesión anónima, sin
 * correo); las que tocan casos o ranuras no, porque un invitado no tiene bóveda.
 */
export async function autenticar(
  peticion: Request,
  verificar: VerificadorToken,
  { permitirInvitado = false }: { permitirInvitado?: boolean } = {}
): Promise<{ uid: string; invitado: boolean }> {
  const cabecera = peticion.headers.get("authorization") ?? "";
  const m = /^Bearer\s+(\S+)$/i.exec(cabecera);
  if (!m) throw new ErrorHttp(401, "sin_sesion", "Inicia sesión para continuar.");

  let token: TokenVerificado;
  try {
    token = await verificar(m[1], true);
  } catch (error) {
    // Solo el código y el mensaje de Firebase (nunca el token): sin esto, un fallo
    // de credenciales del servidor se ve igual que una sesión caducada.
    const e = error as { code?: unknown; message?: unknown };
    console.error(
      "Token rechazado:",
      typeof e?.code === "string" ? e.code : "sin_codigo",
      typeof e?.message === "string" ? e.message.slice(0, 300) : ""
    );
    throw new ErrorHttp(401, "sesion_invalida", "Tu sesión no es válida. Vuelve a iniciar sesión.");
  }
  if (!token.uid) throw new ErrorHttp(401, "sesion_invalida", "Tu sesión no es válida.");
  if (token.firebase?.sign_in_provider === "anonymous") {
    if (!permitirInvitado) {
      throw new ErrorHttp(403, "cuenta_requerida", "Crea una cuenta para guardar y gestionar tus casos.");
    }
    return { uid: token.uid, invitado: true };
  }
  if (token.email_verified !== true) {
    throw new ErrorHttp(403, "correo_sin_verificar", "Verifica tu correo para gestionar tus casos.");
  }
  return { uid: token.uid, invitado: false };
}
