"use client";

import { useState, type FormEvent } from "react";
import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  type User,
} from "firebase/auth";
import { autenticacion, normalizarCorreo } from "@/lib/firebaseCliente";

type Modo = "entrar" | "registro" | "recuperar";

const MINIMO_CONTRASENA = 8;

/** Mensajes en claro; sin revelar si un correo existe (salvo lo que Auth ya expone al registrar). */
function mensajeDeError(error: unknown): string {
  const codigo = (error as { code?: string } | null)?.code ?? "";
  switch (codigo) {
    case "auth/email-already-in-use":
      return "Ya hay una cuenta con ese correo. Prueba a iniciar sesión.";
    case "auth/weak-password":
      return `La contraseña es demasiado débil (mínimo ${MINIMO_CONTRASENA} caracteres).`;
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
    default:
      return "No se pudo completar la operación. Inténtalo de nuevo.";
  }
}

interface Props {
  /** Usuario con sesión pero sin correo verificado, si lo hay. */
  pendiente: User | null;
  onCerrarSesion: () => Promise<void>;
  onVerificado: (usuario: User) => Promise<void>;
}

export default function PuertaCuenta({ pendiente, onCerrarSesion, onVerificado }: Props) {
  const [modo, setModo] = useState<Modo>("entrar");
  const [correo, setCorreo] = useState("");
  const [contrasena, setContrasena] = useState("");
  const [aviso, setAviso] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  async function ejecutar(accion: () => Promise<void>) {
    setError(null);
    setAviso(null);
    setOcupado(true);
    try {
      await accion();
    } catch (e) {
      setError(mensajeDeError(e));
    } finally {
      setOcupado(false);
    }
  }

  function enviar(e: FormEvent) {
    e.preventDefault();
    const auth = autenticacion();
    const email = normalizarCorreo(correo);
    void ejecutar(async () => {
      if (modo === "registro") {
        if (contrasena.length < MINIMO_CONTRASENA) {
          throw { code: "auth/weak-password" };
        }
        const { user } = await createUserWithEmailAndPassword(auth, email, contrasena);
        await sendEmailVerification(user);
      } else if (modo === "entrar") {
        await signInWithEmailAndPassword(auth, email, contrasena);
      } else {
        await sendPasswordResetEmail(auth, email);
        // Misma respuesta exista o no la cuenta.
        setAviso("Si hay una cuenta con ese correo, te hemos enviado un enlace para recuperarla.");
      }
    });
  }

  const contenedor = "grid min-h-screen place-items-center bg-canvas px-4";
  const tarjeta =
    "w-full max-w-sm rounded-lg border border-divider bg-surface p-6 shadow-sm";
  const campo =
    "mt-1 w-full rounded-md border border-divider bg-canvas px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-accent";
  const boton =
    "w-full rounded-md bg-accent px-3 py-2 text-sm font-medium text-white disabled:opacity-50";
  const enlace = "text-sm text-accent underline underline-offset-2";

  if (pendiente) {
    return (
      <main className={contenedor}>
        <div className={tarjeta}>
          <h1 className="font-serif text-xl">Verifica tu correo</h1>
          <p className="mt-2 text-sm text-ink-muted">
            Enviamos un enlace a <strong>{pendiente.email}</strong>. Hasta que lo
            abras, la cuenta no puede usar el análisis con IA.
          </p>
          {error && <p role="alert" className="mt-3 text-sm text-warn">{error}</p>}
          {aviso && <p role="status" className="mt-3 text-sm text-accent">{aviso}</p>}
          <div className="mt-4 space-y-2">
            <button
              type="button"
              className={boton}
              disabled={ocupado}
              onClick={() =>
                ejecutar(async () => {
                  await pendiente.reload();
                  if (pendiente.emailVerified) await onVerificado(pendiente);
                  else setError("Todavía no consta como verificado. Abre el enlace del correo.");
                })
              }
            >
              Ya lo verifiqué
            </button>
            <button
              type="button"
              className={enlace}
              disabled={ocupado}
              onClick={() =>
                ejecutar(async () => {
                  await sendEmailVerification(pendiente);
                  setAviso("Enlace reenviado.");
                })
              }
            >
              Reenviar el correo
            </button>
            <div>
              <button type="button" className={enlace} onClick={() => void onCerrarSesion()}>
                Cerrar sesión
              </button>
            </div>
          </div>
        </div>
      </main>
    );
  }

  const titulo =
    modo === "registro" ? "Crear cuenta" : modo === "recuperar" ? "Recuperar acceso" : "Iniciar sesión";

  return (
    <main className={contenedor}>
      <form className={tarjeta} onSubmit={enviar}>
        <h1 className="font-serif text-xl">{titulo}</h1>
        <p className="mt-2 text-xs text-ink-muted">
          ACIA no guarda tus notas ni tus casos: viven cifrados en este
          dispositivo. La cuenta solo guarda tu correo, tu plan y un registro de
          consumo.
        </p>
        <label className="mt-4 block text-sm">
          Correo
          <input
            type="email"
            autoComplete="email"
            required
            className={campo}
            value={correo}
            onChange={(e) => setCorreo(e.target.value)}
          />
        </label>
        {modo !== "recuperar" && (
          <label className="mt-3 block text-sm">
            Contraseña de la cuenta
            <input
              type="password"
              autoComplete={modo === "registro" ? "new-password" : "current-password"}
              required
              minLength={modo === "registro" ? MINIMO_CONTRASENA : undefined}
              className={campo}
              value={contrasena}
              onChange={(e) => setContrasena(e.target.value)}
            />
          </label>
        )}
        {error && <p role="alert" className="mt-3 text-sm text-warn">{error}</p>}
        {aviso && <p role="status" className="mt-3 text-sm text-accent">{aviso}</p>}
        <button type="submit" className={`${boton} mt-4`} disabled={ocupado}>
          {titulo}
        </button>
        <div className="mt-4 flex flex-col gap-1">
          {modo !== "entrar" && (
            <button type="button" className={`${enlace} text-left`} onClick={() => setModo("entrar")}>
              Ya tengo cuenta
            </button>
          )}
          {modo !== "registro" && (
            <button type="button" className={`${enlace} text-left`} onClick={() => setModo("registro")}>
              Crear una cuenta
            </button>
          )}
          {modo === "entrar" && (
            <button type="button" className={`${enlace} text-left`} onClick={() => setModo("recuperar")}>
              Olvidé mi contraseña
            </button>
          )}
        </div>
        <p className="mt-4 text-xs text-ink-muted">
          Esta contraseña es distinta de la que cifra tu historial en el dispositivo.
        </p>
      </form>
    </main>
  );
}
