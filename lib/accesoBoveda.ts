import type { RepositorioNube } from "./repositorioNube";

/**
 * Abre la bóveda con la clave derivada de la contraseña, o la crea si la
 * cuenta aún no tiene. Sin pantallas: es lo que ocurre tras iniciar sesión.
 *
 * `necesita_contrasena`: la bóveda existe pero esa clave no la abre (la
 * contraseña cambió, o es una cuenta anterior con una frase aparte). La
 * interfaz lo resuelve pidiendo la contraseña, la frase antigua o la clave de
 * recuperación.
 */
export async function abrirConSecreto(
  repo: RepositorioNube,
  secreto: string
): Promise<"abierta" | "necesita_contrasena"> {
  if (!(await repo.yaConfigurado())) {
    await repo.configurar(secreto, { conRecuperacion: false });
    return "abierta";
  }
  return (await repo.desbloquear(secreto)) ? "abierta" : "necesita_contrasena";
}
