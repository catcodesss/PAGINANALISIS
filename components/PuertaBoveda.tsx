"use client";

import { useEffect, useState, type FormEvent } from "react";
import { repositorioNube } from "@/lib/repositorio";
import { autenticacion, normalizarCorreo } from "@/lib/firebaseCliente";
import { derivarCredenciales } from "@/lib/credenciales";
import { abrirConSecreto } from "@/lib/accesoBoveda";
import { obtenerSecretoBoveda, olvidarSecretoBoveda } from "@/lib/secretoSesion";

/**
 * Bóveda de claves (fase 13, propuesta §3). Con la contraseña única casi nunca
 * se ve: tras iniciar sesión se abre sola con la clave derivada de la
 * contraseña (lib/accesoBoveda.ts). Esta pantalla aparece solo cuando hace
 * falta algo más:
 *  - contrasena: se recargó la página (la clave solo vive en memoria), o la
 *    bóveda es de una cuenta anterior con una frase aparte;
 *  - olvido: la contraseña cambió; se abre con la clave de recuperación.
 * La clave de recuperación es opcional y se crea desde Configuración
 * (components/ClaveRecuperacion.tsx). Nada de esto viaja al servidor.
 */

type Fase = "comprobando" | "contrasena" | "olvido";

const contenedor = "grid min-h-screen place-items-center bg-canvas px-4";
const tarjeta = "w-full max-w-md rounded-lg border border-divider bg-surface p-6 shadow-sm";
const campo =
  "mt-1 w-full rounded-md border border-divider bg-canvas px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-accent";
const boton =
  "w-full rounded-md bg-accent px-3 py-2 text-sm font-medium text-white disabled:opacity-50";
const enlace = "text-sm text-accent underline underline-offset-2";

interface Props {
  onListo: () => void;
  onCerrarSesion: () => Promise<void>;
}

export default function PuertaBoveda({ onListo, onCerrarSesion }: Props) {
  const repo = repositorioNube();
  const [fase, setFase] = useState<Fase>("comprobando");
  const [existe, setExiste] = useState(true);
  const [tieneRecuperacion, setTieneRecuperacion] = useState(true);
  const [contrasena, setContrasena] = useState("");
  const [clave, setClave] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const hay = (await repo?.yaConfigurado()) ?? false;
        const conClave = hay ? ((await repo?.tieneRecuperacion()) ?? false) : true;
        if (!vivo) return;
        setExiste(hay);
        setTieneRecuperacion(conClave);
        const secreto = obtenerSecretoBoveda();
        if (secreto && repo && (await abrirConSecreto(repo, secreto)) === "abierta") {
          olvidarSecretoBoveda();
          if (vivo) onListo();
          return;
        }
        if (vivo) setFase("contrasena");
      } catch {
        if (vivo) {
          setError("No se pudo consultar tu bóveda. Comprueba la conexión.");
          setFase("contrasena");
        }
      }
    })();
    return () => {
      vivo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repo]);

  async function ejecutar(accion: () => Promise<void>) {
    setError(null);
    setOcupado(true);
    try {
      await accion();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo completar la operación.");
    } finally {
      setOcupado(false);
    }
  }

  async function secretoDe(texto: string): Promise<string> {
    const correo = autenticacion().currentUser?.email;
    if (!correo) throw new Error("Tu sesión no tiene correo. Cierra sesión y vuelve a entrar.");
    return (await derivarCredenciales(normalizarCorreo(correo), texto)).boveda;
  }

  if (!repo || fase === "comprobando") {
    return (
      <main className={contenedor}>
        <p className="text-sm text-ink-muted">Abriendo tus casos…</p>
      </main>
    );
  }

  function abrir(e: FormEvent) {
    e.preventDefault();
    void ejecutar(async () => {
      const secreto = await secretoDe(contrasena);
      if (!existe) {
        await repo!.configurar(secreto, { conRecuperacion: false });
      } else if (!(await repo!.desbloquear(secreto))) {
        // Cuentas anteriores: la bóveda tenía una frase aparte. Si es esa, se
        // une a la contraseña (si la tenemos en memoria) y no se vuelve a pedir.
        if (!(await repo!.desbloquear(contrasena))) {
          setError(
            "No es la contraseña de esta bóveda. Si tu cuenta es anterior y usabas una frase de paso aparte, escríbela aquí."
          );
          return;
        }
        const nuevo = obtenerSecretoBoveda();
        if (nuevo) await repo!.cambiarFrase(contrasena, nuevo);
      }
      olvidarSecretoBoveda();
      setContrasena("");
      onListo();
    });
  }

  function recuperar(e: FormEvent) {
    e.preventDefault();
    void ejecutar(async () => {
      const secreto = await secretoDe(contrasena);
      if (!(await repo!.desbloquearConRecuperacion(clave, secreto))) {
        setError("La clave de recuperación no es correcta.");
        return;
      }
      olvidarSecretoBoveda();
      setContrasena("");
      setClave("");
      onListo();
    });
  }

  const cerrar = (
    <button type="button" className={enlace} onClick={() => void onCerrarSesion()}>
      Cerrar sesión
    </button>
  );

  if (fase === "olvido") {
    return (
      <main className={contenedor}>
        <form className={tarjeta} onSubmit={recuperar}>
          <h1 className="font-serif text-xl">Abrir con tu clave de recuperación</h1>
          <p className="mt-2 text-sm text-ink-muted">
            Si cambiaste tu contraseña, tus casos siguen cifrados con la anterior.
            Tus 12 palabras los abren y los pasan a la contraseña actual.
          </p>
          {!tieneRecuperacion && (
            <p role="status" className="mt-3 rounded-md border border-divider bg-canvas p-3 text-sm text-ink-muted">
              Esta cuenta no tiene clave de recuperación, así que ACIA no puede
              abrir tus casos sin la contraseña con que se cifraron. Si la
              recuerdas, vuelve atrás e inténtalo de nuevo.
            </p>
          )}
          <label className="mt-4 block text-sm">
            Clave de recuperación (12 palabras)
            <input
              className={`${campo} font-mono`}
              value={clave}
              onChange={(e) => setClave(e.target.value)}
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
            />
          </label>
          <label className="mt-3 block text-sm">
            Tu contraseña actual
            <input
              type="password"
              autoComplete="current-password"
              className={campo}
              value={contrasena}
              onChange={(e) => setContrasena(e.target.value)}
            />
          </label>
          {error && <p role="alert" className="mt-3 text-sm text-warn">{error}</p>}
          <button type="submit" className={`${boton} mt-4`} disabled={ocupado || !clave || !contrasena}>
            {ocupado ? "Comprobando…" : "Abrir mis casos"}
          </button>
          <div className="mt-3 flex gap-4">
            <button type="button" className={enlace} onClick={() => { setError(null); setFase("contrasena"); }}>
              Volver
            </button>
            {cerrar}
          </div>
        </form>
      </main>
    );
  }

  return (
    <main className={contenedor}>
      <form className={tarjeta} onSubmit={abrir}>
        <h1 className="font-serif text-xl">{existe ? "Escribe tu contraseña" : "Prepara tus casos"}</h1>
        <p className="mt-2 text-sm text-ink-muted">
          {existe
            ? "Tu contraseña abre tus casos en este dispositivo. Si recargas la página, se vuelve a pedir."
            : "Escribe la contraseña de tu cuenta para cifrar tus casos en este dispositivo."}
        </p>
        <label className="mt-4 block text-sm">
          Contraseña
          <input
            type="password"
            autoComplete="current-password"
            className={campo}
            value={contrasena}
            onChange={(e) => setContrasena(e.target.value)}
            autoFocus
          />
        </label>
        {error && <p role="alert" className="mt-3 text-sm text-warn">{error}</p>}
        <button type="submit" className={`${boton} mt-4`} disabled={ocupado || !contrasena}>
          {ocupado ? "Abriendo…" : existe ? "Abrir" : "Continuar"}
        </button>
        <div className="mt-3 flex gap-4">
          {existe && (
            <button type="button" className={enlace} onClick={() => { setError(null); setFase("olvido"); }}>
              Cambié mi contraseña
            </button>
          )}
          {cerrar}
        </div>
      </form>
    </main>
  );
}
