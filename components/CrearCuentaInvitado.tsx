"use client";

import { useEffect, useState, type FormEvent } from "react";
import {
  EmailAuthProvider,
  linkWithCredential,
  sendEmailVerification,
  type User,
} from "firebase/auth";
import { Check } from "lucide-react";
import { nubeActivada, normalizarCorreo } from "@/lib/firebaseCliente";
import { derivarCredenciales } from "@/lib/credenciales";
import { abrirConSecreto } from "@/lib/accesoBoveda";
import { guardarSecretoBoveda, obtenerSecretoBoveda, olvidarSecretoBoveda } from "@/lib/secretoSesion";
import { MINIMO_CONTRASENA, mensajeDeError } from "@/lib/erroresCuenta";
import { repositorio, repositorioNube } from "@/lib/repositorio";

/**
 * Un invitado crea su cuenta sin salir de la pantalla en la que está: el
 * análisis que tiene abierto no se pierde. La cuenta se vincula a la sesión
 * anónima (mismo usuario, así que lo que hubiera comprado como invitado se
 * conserva); después se verifica el correo y se abre la bóveda con la clave
 * derivada de la contraseña. Quien llama guarda entonces el análisis abierto
 * (evento EVENTO_CUENTA_CREADA).
 */

type Paso = "formulario" | "verificar" | "abriendo";

interface Props {
  usuario: User;
  /** Por qué se pide ahora (p. ej. «Para ver tus casos necesitas una cuenta»). */
  motivo?: string;
  onCerrar: () => void;
  onCreada: (usuario: User) => void;
}

const campo =
  "mt-1 w-full rounded-md border border-divider bg-canvas px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-accent";
const boton =
  "w-full rounded-md bg-accent px-3 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50";
const enlace = "text-sm text-accent underline underline-offset-2";

export default function CrearCuentaInvitado({ usuario, motivo, onCerrar, onCreada }: Props) {
  // Si ya vinculó el correo y falta verificarlo, se retoma donde se quedó.
  const [paso, setPaso] = useState<Paso>(usuario.email ? "verificar" : "formulario");
  const [correo, setCorreo] = useState(usuario.email ?? "");
  const [contrasena, setContrasena] = useState("");
  const [repetir, setRepetir] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => e.key === "Escape" && !ocupado && onCerrar();
    window.addEventListener("keydown", alTeclear);
    return () => window.removeEventListener("keydown", alTeclear);
  }, [ocupado, onCerrar]);

  async function ejecutar(accion: () => Promise<void>) {
    setError(null);
    setAviso(null);
    setOcupado(true);
    try {
      await accion();
    } catch (e) {
      setError(e instanceof Error && !(e as { code?: string }).code ? e.message : mensajeDeError(e));
    } finally {
      setOcupado(false);
    }
  }

  function crear(e: FormEvent) {
    e.preventDefault();
    if (contrasena.length < MINIMO_CONTRASENA) return setError(mensajeDeError({ code: "auth/weak-password" }));
    if (contrasena !== repetir) return setError("Las contraseñas no coinciden.");
    void ejecutar(async () => {
      const email = normalizarCorreo(correo);
      const cred = await derivarCredenciales(email, contrasena);
      const { user } = await linkWithCredential(usuario, EmailAuthProvider.credential(email, cred.acceso));
      guardarSecretoBoveda(cred.boveda);
      await sendEmailVerification(user);
      setContrasena("");
      setRepetir("");
      setPaso("verificar");
    });
  }

  function yaVerifique() {
    void ejecutar(async () => {
      await usuario.reload();
      if (!usuario.emailVerified) {
        setError("Todavía no consta como verificado. Abre el enlace del correo.");
        return;
      }
      // El token anterior seguía marcado como anónimo: se renueva ya con la cuenta.
      await usuario.getIdToken(true);
      setPaso("abriendo");
      await repositorio.asociarCuenta(usuario.uid);
      const repo = repositorioNube();
      const secreto = obtenerSecretoBoveda();
      if (nubeActivada() && repo) {
        if (!secreto) {
          throw new Error("Por seguridad, la contraseña no se conserva. Cierra sesión y entra con tu cuenta.");
        }
        if ((await abrirConSecreto(repo, secreto)) !== "abierta") {
          throw new Error("No se pudo abrir tu bóveda. Cierra sesión y vuelve a entrar.");
        }
      }
      olvidarSecretoBoveda();
      onCreada(usuario);
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-ink/40 px-4 py-6 print:hidden"
      onMouseDown={(e) => e.target === e.currentTarget && !ocupado && onCerrar()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-cuenta"
        className="w-full max-w-md rounded-lg border border-divider bg-surface p-6 shadow-lg"
      >
        {paso === "formulario" && (
          <form onSubmit={crear}>
            <h2 id="titulo-cuenta" className="font-serif text-xl">
              Crea tu cuenta
            </h2>
            {motivo && <p className="mt-2 text-sm font-medium text-ink">{motivo}</p>}
            <ul className="mt-3 space-y-1.5 text-sm text-ink-muted">
              <li className="flex gap-2">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
                El análisis que tienes abierto se guarda en tu biblioteca cifrada.
              </li>
              <li className="flex gap-2">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
                Conservas las monedas que hayas comprado como invitado.
              </li>
            </ul>
            <p className="mt-3 rounded-md border border-divider bg-canvas p-3 text-xs leading-relaxed text-ink-muted">
              <strong className="text-ink">Si sigues como invitado y cierras la pestaña, el análisis se pierde.</strong>{" "}
              Esta contraseña también cifra tus casos: nadie en ACIA puede leerlos
              ni restablecerla por ti.
            </p>
            <label className="mt-4 block text-sm">
              Correo
              <input
                type="email"
                autoComplete="email"
                required
                autoFocus
                className={campo}
                value={correo}
                onChange={(e) => setCorreo(e.target.value)}
              />
            </label>
            <label className="mt-3 block text-sm">
              Contraseña ({MINIMO_CONTRASENA} o más caracteres)
              <input
                type="password"
                autoComplete="new-password"
                required
                minLength={MINIMO_CONTRASENA}
                className={campo}
                value={contrasena}
                onChange={(e) => setContrasena(e.target.value)}
              />
            </label>
            <label className="mt-3 block text-sm">
              Repite la contraseña
              <input
                type="password"
                autoComplete="new-password"
                required
                className={campo}
                value={repetir}
                onChange={(e) => setRepetir(e.target.value)}
              />
            </label>
            {error && <p role="alert" className="mt-3 text-sm text-warn">{error}</p>}
            <button type="submit" className={`${boton} mt-4`} disabled={ocupado}>
              {ocupado ? "Creando tu cuenta…" : "Crear cuenta"}
            </button>
            <button type="button" className={`${enlace} mt-3`} onClick={onCerrar} disabled={ocupado}>
              Seguir como invitado
            </button>
          </form>
        )}

        {paso === "verificar" && (
          <div>
            <h2 id="titulo-cuenta" className="font-serif text-xl">
              Verifica tu correo
            </h2>
            <p className="mt-2 text-sm text-ink-muted">
              Enviamos un enlace a <strong className="text-ink">{usuario.email ?? correo}</strong>.
              Ábrelo y vuelve aquí: tu análisis sigue en pantalla.
            </p>
            {error && <p role="alert" className="mt-3 text-sm text-warn">{error}</p>}
            {aviso && <p role="status" className="mt-3 text-sm text-accent">{aviso}</p>}
            <button type="button" className={`${boton} mt-4`} disabled={ocupado} onClick={yaVerifique}>
              {ocupado ? "Comprobando…" : "Ya lo verifiqué"}
            </button>
            <div className="mt-3 flex gap-4">
              <button
                type="button"
                className={enlace}
                disabled={ocupado}
                onClick={() =>
                  ejecutar(async () => {
                    await sendEmailVerification(usuario);
                    setAviso("Enlace reenviado.");
                  })
                }
              >
                Reenviar el correo
              </button>
              <button type="button" className={enlace} onClick={onCerrar} disabled={ocupado}>
                Después
              </button>
            </div>
          </div>
        )}

        {paso === "abriendo" && (
          <div role="status">
            <h2 id="titulo-cuenta" className="font-serif text-xl">
              Preparando tu biblioteca
            </h2>
            <p className="mt-2 text-sm text-ink-muted">
              Cifrando y guardando tu análisis…
            </p>
            {error && (
              <>
                <p role="alert" className="mt-3 text-sm text-warn">{error}</p>
                <button type="button" className={`${enlace} mt-3`} onClick={() => setPaso("verificar")}>
                  Volver a intentarlo
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
