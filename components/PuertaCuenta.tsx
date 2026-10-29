"use client";

import { useEffect, useState, type FormEvent } from "react";
import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInAnonymously,
  signInWithEmailAndPassword,
  updatePassword,
  updateProfile,
  type User,
} from "firebase/auth";
import { autenticacion, normalizarCorreo } from "@/lib/firebaseCliente";
import { derivarCredenciales } from "@/lib/credenciales";
import { guardarSecretoBoveda } from "@/lib/secretoSesion";
import { MINIMO_CONTRASENA, mensajeDeError } from "@/lib/erroresCuenta";
import { validarPerfil } from "@/lib/perfil";
import { guardarPerfilPendiente } from "@/lib/perfilCliente";
import CamposPerfil, { PERFIL_VACIO, type BorradorPerfil } from "./CamposPerfil";

type Modo = "entrar" | "registro" | "recuperar";

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
  const [repetir, setRepetir] = useState("");
  const [perfil, setPerfil] = useState<BorradorPerfil>(PERFIL_VACIO);
  const [aviso, setAviso] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  // Al volver del enlace del correo (otra pestaña), sigue solo sin pulsar nada.
  useEffect(() => {
    if (!pendiente) return;
    let vivo = true;
    const comprobar = async () => {
      await pendiente.reload().catch(() => {});
      if (vivo && pendiente.emailVerified) await onVerificado(pendiente);
    };
    window.addEventListener("focus", comprobar);
    return () => {
      vivo = false;
      window.removeEventListener("focus", comprobar);
    };
  }, [pendiente, onVerificado]);

  async function ejecutar(accion: () => Promise<void>) {
    setError(null);
    setAviso(null);
    setOcupado(true);
    try {
      await accion();
    } catch (e) {
      // Los errores propios (sin código de Firebase) ya vienen en claro.
      setError(e instanceof Error && !(e as { code?: string }).code ? e.message : mensajeDeError(e));
    } finally {
      setOcupado(false);
    }
  }

  /**
   * Una sola contraseña: de ella salen la clave que se envía a Firebase y la
   * que abre la bóveda (lib/credenciales.ts). Las cuentas anteriores tenían la
   * contraseña tal cual en Firebase: si la derivada no entra, se prueba la
   * antigua y, si sirve, la cuenta se pasa al sistema nuevo sin que el
   * terapeuta haga nada.
   */
  function enviar(e: FormEvent) {
    e.preventDefault();
    const auth = autenticacion();
    const email = normalizarCorreo(correo);
    void ejecutar(async () => {
      if (modo === "registro") {
        const datos = validarPerfil(perfil);
        if ("error" in datos) throw new Error(datos.error);
        if (contrasena.length < MINIMO_CONTRASENA) throw { code: "auth/weak-password" };
        if (contrasena !== repetir) throw new Error("Las contraseñas no coinciden.");
        const cred = await derivarCredenciales(email, contrasena);
        const { user } = await createUserWithEmailAndPassword(auth, email, cred.acceso);
        guardarSecretoBoveda(cred.boveda);
        guardarPerfilPendiente(datos.perfil);
        await updateProfile(user, { displayName: datos.perfil.nombre }).catch(() => {});
        await sendEmailVerification(user);
        setContrasena("");
        setRepetir("");
      } else if (modo === "entrar") {
        const cred = await derivarCredenciales(email, contrasena);
        try {
          await signInWithEmailAndPassword(auth, email, cred.acceso);
          guardarSecretoBoveda(cred.boveda);
        } catch (e) {
          if ((e as { code?: string }).code !== "auth/invalid-credential") throw e;
          const { user } = await signInWithEmailAndPassword(auth, email, contrasena);
          await updatePassword(user, cred.acceso).catch(() => {});
          guardarSecretoBoveda(cred.boveda, true);
        }
      } else {
        await sendPasswordResetEmail(auth, email);
        // Misma respuesta exista o no la cuenta.
        setAviso("Si hay una cuenta con ese correo, te hemos enviado un enlace para recuperarla.");
      }
    });
  }

  const contenedor = "grid min-h-screen place-items-center bg-canvas px-4";
  const tarjeta = "w-full max-w-sm rounded-lg border border-divider bg-surface p-6 shadow-sm";
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
      <div className="w-full max-w-sm">
        <form className={tarjeta} onSubmit={enviar}>
          <h1 className="font-serif text-xl">{titulo}</h1>
          <p className="mt-2 text-xs text-ink-muted">
            ACIA no guarda tus notas ni tus casos: viven cifrados en este
            dispositivo. La cuenta solo guarda tu correo, tu plan y un registro de
            consumo.
          </p>
          {modo === "registro" && (
            <div className="mt-4">
              <CamposPerfil valor={perfil} onCambio={setPerfil} autoFocus />
            </div>
          )}
          <label className={`${modo === "registro" ? "mt-3" : "mt-4"} block text-sm`}>
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
              {modo === "registro" ? `Contraseña (${MINIMO_CONTRASENA} o más caracteres)` : "Contraseña"}
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
          {modo === "registro" && (
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
          )}
          {modo === "registro" && (
            <p className="mt-3 rounded-md border border-divider bg-canvas p-3 text-xs leading-relaxed text-ink-muted">
              Esta misma contraseña protege tus casos.{" "}
              <strong className="text-ink">
                Nadie en ACIA puede leerlos ni restablecerla por ti.
              </strong>{" "}
              Más adelante, en Configuración, podrás crear una clave de
              recuperación por si la olvidas.
            </p>
          )}
          {error && <p role="alert" className="mt-3 text-sm text-warn">{error}</p>}
          {aviso && <p role="status" className="mt-3 text-sm text-accent">{aviso}</p>}
          <button type="submit" className={`${boton} mt-4`} disabled={ocupado}>
            {ocupado && modo !== "recuperar" ? "Un momento…" : titulo}
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
        </form>

        <div className="mt-3 rounded-lg border border-divider bg-surface p-4 shadow-sm">
          <p className="text-sm font-medium text-ink">¿Solo quieres probar?</p>
          <p className="mt-1 text-xs leading-relaxed text-ink-muted">
            Analiza sin cuenta. <strong className="text-ink">No se guarda nada</strong>:
            si cierras la pestaña, el análisis se pierde. Podrás crear tu cuenta
            después y conservarlo.
          </p>
          <button
            type="button"
            disabled={ocupado}
            onClick={() => ejecutar(async () => void (await signInAnonymously(autenticacion())))}
            className="mt-3 w-full rounded-md border border-accent px-3 py-2 text-sm font-medium text-accent transition-colors hover:bg-accent-soft disabled:opacity-50"
          >
            Probar como invitado
          </button>
        </div>
      </div>
    </main>
  );
}
