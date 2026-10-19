"use client";

import { useEffect, useState, type FormEvent } from "react";
import { repositorioNube } from "@/lib/repositorio";
import { fraseAceptable } from "@/lib/boveda";

/**
 * Bóveda de claves (fase 13, propuesta §3). Tres pantallas:
 *  - crear: elegir la frase de paso (distinta de la contraseña de la cuenta);
 *  - clave de recuperación: se muestra una vez y hay que confirmar que se guardó;
 *  - desbloquear: frase, o clave de recuperación si se olvidó.
 * Nada de esto viaja al servidor: la frase y las claves viven solo en este navegador.
 */

type Fase = "comprobando" | "crear" | "recuperacion" | "desbloquear" | "olvido";

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
  const [frase, setFrase] = useState("");
  const [repetir, setRepetir] = useState("");
  const [clave, setClave] = useState("");
  const [claveMostrada, setClaveMostrada] = useState("");
  const [acepto, setAcepto] = useState(false);
  const [guardada, setGuardada] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const existe = (await repo?.yaConfigurado()) ?? false;
        if (vivo) setFase(existe ? "desbloquear" : "crear");
      } catch {
        if (vivo) {
          setError("No se pudo consultar tu bóveda. Comprueba la conexión.");
          setFase("desbloquear");
        }
      }
    })();
    return () => {
      vivo = false;
    };
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

  if (!repo || fase === "comprobando") {
    return (
      <main className={contenedor}>
        <p className="text-sm text-ink-muted">Preparando tu bóveda…</p>
      </main>
    );
  }

  function crear(e: FormEvent) {
    e.preventDefault();
    if (!fraseAceptable(frase)) return setError("Usa al menos 12 caracteres.");
    if (frase !== repetir) return setError("Las frases no coinciden.");
    if (!acepto) return setError("Debes confirmar que entiendes que no podemos recuperarla.");
    void ejecutar(async () => {
      await repo!.configurar(frase);
      setClaveMostrada(repo!.tomarClaveRecuperacion() ?? "");
      setFrase("");
      setRepetir("");
      setFase("recuperacion");
    });
  }

  function desbloquear(e: FormEvent) {
    e.preventDefault();
    void ejecutar(async () => {
      if (!(await repo!.desbloquear(frase))) {
        setError("Frase incorrecta.");
        return;
      }
      setFrase("");
      onListo();
    });
  }

  function recuperar(e: FormEvent) {
    e.preventDefault();
    if (!fraseAceptable(frase)) return setError("La frase nueva debe tener al menos 12 caracteres.");
    void ejecutar(async () => {
      if (!(await repo!.desbloquearConRecuperacion(clave, frase))) {
        setError("La clave de recuperación no es correcta.");
        return;
      }
      setFrase("");
      setClave("");
      onListo();
    });
  }

  if (fase === "recuperacion") {
    return (
      <main className={contenedor}>
        <div className={tarjeta}>
          <h1 className="font-serif text-xl">Tu clave de recuperación</h1>
          <p className="mt-2 text-sm text-ink-muted">
            Es la única forma de abrir tus casos si olvidas la frase. ACIA no la
            guarda y no puede generarla de nuevo. Guárdala fuera de este
            dispositivo (impresa, o en un gestor de contraseñas).
          </p>
          <p
            className="mt-4 select-all break-all rounded-md border border-divider bg-canvas p-3 text-center font-mono text-sm tracking-wide"
            aria-label="Clave de recuperación"
          >
            {claveMostrada}
          </p>
          <div className="mt-3 flex gap-3">
            <button type="button" className={enlace} onClick={() => navigator.clipboard?.writeText(claveMostrada)}>
              Copiar
            </button>
            <button type="button" className={enlace} onClick={() => window.print()}>
              Imprimir
            </button>
          </div>
          <label className="mt-4 flex items-start gap-2 text-sm">
            <input type="checkbox" checked={guardada} onChange={(e) => setGuardada(e.target.checked)} className="mt-1" />
            <span>Ya la guardé en un lugar seguro.</span>
          </label>
          <button
            type="button"
            className={`${boton} mt-4`}
            disabled={!guardada}
            onClick={() => {
              setClaveMostrada("");
              onListo();
            }}
          >
            Continuar
          </button>
        </div>
      </main>
    );
  }

  const cerrar = (
    <button type="button" className={enlace} onClick={() => void onCerrarSesion()}>
      Cerrar sesión
    </button>
  );

  if (fase === "crear") {
    return (
      <main className={contenedor}>
        <form className={tarjeta} onSubmit={crear}>
          <h1 className="font-serif text-xl">Protege tus casos</h1>
          <p className="mt-2 text-sm text-ink-muted">
            Elige una <strong>frase de paso</strong>. Con ella se cifran tus casos
            en este dispositivo antes de guardarse. Es distinta de la contraseña
            de tu cuenta.
          </p>
          <p className="mt-2 text-sm font-medium text-ink">
            Nadie en ACIA puede leer tus casos ni recuperar la frase. Si la pierdes
            y también pierdes la clave de recuperación, los datos no se pueden
            recuperar.
          </p>
          <label className="mt-4 block text-sm">
            Frase de paso (12 o más caracteres)
            <input type="password" autoComplete="new-password" className={campo} value={frase} onChange={(e) => setFrase(e.target.value)} />
          </label>
          <label className="mt-3 block text-sm">
            Repite la frase
            <input type="password" autoComplete="new-password" className={campo} value={repetir} onChange={(e) => setRepetir(e.target.value)} />
          </label>
          <label className="mt-3 flex items-start gap-2 text-sm">
            <input type="checkbox" checked={acepto} onChange={(e) => setAcepto(e.target.checked)} className="mt-1" />
            <span>Entiendo que ACIA no puede recuperar mis datos sin la frase o la clave de recuperación.</span>
          </label>
          {error && <p role="alert" className="mt-3 text-sm text-warn">{error}</p>}
          <button type="submit" className={`${boton} mt-4`} disabled={ocupado}>
            {ocupado ? "Creando…" : "Crear bóveda"}
          </button>
          <div className="mt-3">{cerrar}</div>
        </form>
      </main>
    );
  }

  if (fase === "olvido") {
    return (
      <main className={contenedor}>
        <form className={tarjeta} onSubmit={recuperar}>
          <h1 className="font-serif text-xl">Recuperar con tu clave</h1>
          <label className="mt-4 block text-sm">
            Clave de recuperación
            <input className={`${campo} font-mono`} value={clave} onChange={(e) => setClave(e.target.value)} autoComplete="off" />
          </label>
          <label className="mt-3 block text-sm">
            Frase de paso nueva (12 o más caracteres)
            <input type="password" autoComplete="new-password" className={campo} value={frase} onChange={(e) => setFrase(e.target.value)} />
          </label>
          {error && <p role="alert" className="mt-3 text-sm text-warn">{error}</p>}
          <button type="submit" className={`${boton} mt-4`} disabled={ocupado}>
            {ocupado ? "Comprobando…" : "Recuperar acceso"}
          </button>
          <div className="mt-3 flex gap-4">
            <button type="button" className={enlace} onClick={() => { setError(null); setFase("desbloquear"); }}>
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
      <form className={tarjeta} onSubmit={desbloquear}>
        <h1 className="font-serif text-xl">Desbloquea tus casos</h1>
        <label className="mt-4 block text-sm">
          Frase de paso
          <input type="password" autoComplete="current-password" className={campo} value={frase} onChange={(e) => setFrase(e.target.value)} autoFocus />
        </label>
        {error && <p role="alert" className="mt-3 text-sm text-warn">{error}</p>}
        <button type="submit" className={`${boton} mt-4`} disabled={ocupado}>
          {ocupado ? "Desbloqueando…" : "Desbloquear"}
        </button>
        <div className="mt-3 flex gap-4">
          <button type="button" className={enlace} onClick={() => { setError(null); setFase("olvido"); }}>
            Olvidé mi frase
          </button>
          {cerrar}
        </div>
      </form>
    </main>
  );
}
