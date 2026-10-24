/**
 * Identidad de quien llama a una ruta del servidor. El UID NUNCA viene del cuerpo
 * de la petición: sale del Firebase ID Token ya verificado.
 */

export interface TokenVerificado {
  uid: string;
  email_verified?: boolean;
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

export async function autenticar(
  peticion: Request,
  verificar: VerificadorToken
): Promise<{ uid: string }> {
  const cabecera = peticion.headers.get("authorization") ?? "";
  const m = /^Bearer\s+(\S+)$/i.exec(cabecera);
  if (!m) throw new ErrorHttp(401, "sin_sesion", "Inicia sesión para continuar.");

  let token: TokenVerificado;
  try {
    token = await verificar(m[1], true);
  } catch {
    throw new ErrorHttp(401, "sesion_invalida", "Tu sesión no es válida. Vuelve a iniciar sesión.");
  }
  if (!token.uid) throw new ErrorHttp(401, "sesion_invalida", "Tu sesión no es válida.");
  if (token.email_verified !== true) {
    throw new ErrorHttp(403, "correo_sin_verificar", "Verifica tu correo para gestionar tus casos.");
  }
  return { uid: token.uid };
}
