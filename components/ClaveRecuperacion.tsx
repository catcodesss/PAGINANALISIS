"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { repositorioNube } from "@/lib/repositorio";
import { EVENTO_RECUPERACION } from "./useRecuperacionPendiente";
import { autenticacion, normalizarCorreo } from "@/lib/firebaseCliente";
import { derivarCredenciales } from "@/lib/credenciales";

/**
 * Clave de recuperación (opcional). Vive en Configuración: el terapeuta decide
 * cuándo crearla. Son 12 palabras; se comprueba que las guardó pidiéndole tres.
 * Nada de esto sale del navegador.
 */

type Paso = "estado" | "frase" | "mostrar" | "comprobar";

const campo =
  "mt-1 w-full rounded-md border border-divider bg-canvas px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-accent";
const boton =
  "rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50";
const enlace = "text-sm text-accent underline underline-offset-2";

/** Tres posiciones al azar, en orden, para comprobar que guardó la clave. */
function elegirPosiciones(): number[] {
  const todas = Array.from({ length: 12 }, (_, i) => i);
  for (let i = todas.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [todas[i], todas[j]] = [todas[j], todas[i]];
  }
  return todas.slice(0, 3).sort((a, b) => a - b);
}

function imprimir(palabras: string[]) {
  const marco = document.createElement("iframe");
  marco.style.cssText = "position:fixed;width:0;height:0;border:0;opacity:0";
  document.body.appendChild(marco);
  const doc = marco.contentDocument;
  if (!doc) return marco.remove();
  const lista = palabras
    .map((p, i) => `<li><span>${i + 1}</span>${p}</li>`)
    .join("");
  doc.open();
  doc.write(`<!doctype html><meta charset="utf-8"><title>Clave de recuperación · ACIA</title>
<style>body{font:16px/1.5 Georgia,serif;margin:48px;color:#1f2a28}h1{font-size:22px}
ol{list-style:none;padding:0;display:grid;grid-template-columns:repeat(3,1fr);gap:10px;max-width:520px}
li{border:1px solid #ccc;border-radius:6px;padding:10px 12px;font:600 18px ui-monospace,Consolas,monospace}
li span{font:12px system-ui;color:#777;margin-right:8px}p{max-width:520px;color:#444}</style>
<h1>Clave de recuperación de ACIA</h1>
<p>Si olvidas tu contraseña, estas 12 palabras, en este orden, son la única forma de volver a abrir tus casos. ACIA no las guarda y no puede generarlas de nuevo. Guárdala fuera de tu ordenador y no la compartas.</p>
<ol>${lista}</ol><p>Guardada en: ______________________ &nbsp; Fecha: ____________</p>`);
  doc.close();
  marco.contentWindow?.focus();
  marco.contentWindow?.print();
  setTimeout(() => marco.remove(), 2000);
}

/** Lo que este componente necesita de la bóveda; `RepositorioNube` lo cumple. */
export interface GestorRecuperacion {
  tieneRecuperacion(): Promise<boolean>;
  crearRecuperacion(contrasena: string): Promise<string | null>;
}

export default function ClaveRecuperacion({ gestor }: { gestor?: GestorRecuperacion }) {
  const repo = gestor ?? repositorioNube();
  const [tiene, setTiene] = useState<boolean | null>(null);
  const [paso, setPaso] = useState<Paso>("estado");
  const [contrasena, setContrasena] = useState("");
  const [clave, setClave] = useState("");
  const [posiciones, setPosiciones] = useState<number[]>([]);
  const [escritas, setEscritas] = useState(["", "", ""]);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [copiada, setCopiada] = useState<"si" | "no" | null>(null);
  const [vecesCopiada, setVecesCopiada] = useState(0);
  const temporizador = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    let vivo = true;
    repo
      ?.tieneRecuperacion()
      .then((t) => vivo && setTiene(t))
      .catch(() => vivo && setTiene(null));
    return () => {
      vivo = false;
      clearTimeout(temporizador.current);
    };
  }, [repo]);

  if (!repo) return null;
  const palabras = clave ? clave.split(" ") : [];

  async function copiar() {
    let ok = false;
    try {
      await navigator.clipboard.writeText(clave);
      ok = true;
    } catch {
      const area = document.createElement("textarea");
      area.value = clave;
      area.style.cssText = "position:fixed;opacity:0";
      document.body.appendChild(area);
      area.select();
      try {
        ok = document.execCommand("copy");
      } catch {
        ok = false;
      }
      area.remove();
    }
    setCopiada(ok ? "si" : "no");
    setVecesCopiada((n) => n + 1);
    clearTimeout(temporizador.current);
    if (ok) temporizador.current = setTimeout(() => setCopiada(null), 2500);
  }

  async function crear(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setOcupado(true);
    try {
      // La bóveda se abre con la clave derivada de la contraseña; las cuentas
      // anteriores, con una frase aparte (se prueba también tal cual).
      let correo: string | null | undefined;
      try {
        correo = autenticacion().currentUser?.email;
      } catch {
        correo = null;
      }
      const secreto = correo
        ? (await derivarCredenciales(normalizarCorreo(correo), contrasena)).boveda
        : contrasena;
      const nueva =
        (await repo!.crearRecuperacion(secreto)) ??
        (secreto !== contrasena ? await repo!.crearRecuperacion(contrasena) : null);
      if (!nueva) {
        setError("La contraseña no es correcta.");
        return;
      }
      setContrasena("");
      setClave(nueva);
      setPosiciones(elegirPosiciones());
      setEscritas(["", "", ""]);
      setPaso("mostrar");
      // La clave ya está activa en la bóveda: el aviso ⚠ se apaga desde aquí.
      window.dispatchEvent(new Event(EVENTO_RECUPERACION));
    } catch {
      setError("No se pudo crear la clave. Comprueba la conexión e inténtalo de nuevo.");
    } finally {
      setOcupado(false);
    }
  }

  const coinciden = posiciones.every(
    (p, i) => escritas[i].trim().toLowerCase() === palabras[p]
  );

  function terminar() {
    setClave("");
    setTiene(true);
    setPaso("estado");
    window.dispatchEvent(new Event(EVENTO_RECUPERACION));
  }

  if (paso === "estado") {
    return (
      <div>
        <div className="flex items-start gap-3">
          {tiene ? (
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-accent" aria-hidden="true" />
          ) : (
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-warn" aria-hidden="true" />
          )}
          <div>
            <p className="text-sm font-medium text-ink">
              Clave de recuperación{" "}
              <span className={tiene ? "text-accent" : "text-warn"}>
                {tiene === null ? "" : tiene ? "· creada" : "· pendiente"}
              </span>
            </p>
            <p className="mt-1 text-sm leading-relaxed text-ink-muted">
              {tiene
                ? "Si olvidas tu contraseña, tus 12 palabras abren tus casos. Si crees que alguien las vio, crea una nueva: la anterior dejará de servir."
                : "Es opcional, pero sin ella, si olvidas tu contraseña, tus casos no se podrán abrir nunca más. ACIA no puede recuperarlos por ti."}
            </p>
          </div>
        </div>
        <button
          type="button"
          className={`${tiene ? "mt-3 rounded-lg border border-divider px-3 py-2 text-sm text-ink-muted hover:bg-canvas hover:text-ink" : `${boton} mt-3`}`}
          onClick={() => {
            setError(null);
            setPaso("frase");
          }}
        >
          {tiene ? "Crear una nueva" : "Crear mi clave de recuperación"}
        </button>
      </div>
    );
  }

  if (paso === "frase") {
    return (
      <form onSubmit={crear}>
        <p className="text-sm leading-relaxed text-ink-muted">
          Son <strong className="text-ink">12 palabras</strong>. Escribe tu contraseña
          para confirmar que eres tú.
        </p>
        <label className="mt-3 block text-sm">
          Contraseña
          <input
            type="password"
            autoComplete="current-password"
            autoFocus
            className={campo}
            value={contrasena}
            onChange={(e) => setContrasena(e.target.value)}
          />
        </label>
        {error && <p role="alert" className="mt-2 text-sm text-warn">{error}</p>}
        <div className="mt-3 flex items-center gap-4">
          <button type="submit" className={boton} disabled={ocupado || !contrasena}>
            {ocupado ? "Creando…" : "Continuar"}
          </button>
          <button type="button" className={enlace} onClick={() => setPaso("estado")}>
            Cancelar
          </button>
        </div>
      </form>
    );
  }

  if (paso === "mostrar") {
    return (
      <div>
        <p className="text-sm leading-relaxed text-ink-muted">
          Guarda estas palabras <strong className="text-ink">en este orden</strong> y
          fuera de este dispositivo: impresas o en un gestor de contraseñas. No se
          volverán a mostrar.
        </p>
        <ol
          key={vecesCopiada}
          className={`mt-3 grid grid-cols-2 gap-2 rounded-lg border border-divider bg-canvas p-3 sm:grid-cols-3 ${
            copiada === "si" ? "clave-copiada" : ""
          }`}
          aria-label="Clave de recuperación"
        >
          {palabras.map((p, i) => (
            <li
              key={i}
              className="select-all rounded-md border border-divider bg-surface px-2.5 py-1.5 font-mono text-sm"
            >
              <span className="mr-1.5 text-xs text-ink-muted">{i + 1}</span>
              {p}
            </li>
          ))}
        </ol>
        <div className="mt-3 flex flex-wrap items-center gap-4">
          <button type="button" className={enlace} onClick={copiar}>
            {copiada === "si" ? "✓ Copiada" : "Copiar"}
          </button>
          <button type="button" className={enlace} onClick={() => imprimir(palabras)}>
            Imprimir
          </button>
          <span role="status" className="min-h-5 text-sm text-ink-muted">
            {copiada === "si" && "Copiada al portapapeles."}
            {copiada === "no" && "No se pudo copiar. Selecciona las palabras y usa Ctrl+C."}
          </span>
        </div>
        <button type="button" className={`${boton} mt-4`} onClick={() => setPaso("comprobar")}>
          Ya la guardé, comprobar
        </button>
      </div>
    );
  }

  return (
    <div>
      <p className="text-sm leading-relaxed text-ink-muted">
        Comprobemos que la guardaste bien. Escribe estas tres palabras de tu copia.
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        {posiciones.map((p, i) => (
          <label key={p} className="block text-sm">
            Palabra n.º {p + 1}
            <input
              className={`${campo} font-mono`}
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              value={escritas[i]}
              onChange={(e) =>
                setEscritas((prev) => prev.map((v, k) => (k === i ? e.target.value : v)))
              }
            />
          </label>
        ))}
      </div>
      {escritas.every(Boolean) && !coinciden && (
        <p role="alert" className="mt-2 text-sm text-warn">
          Alguna palabra no coincide. Revisa tu copia.
        </p>
      )}
      <div className="mt-4 flex items-center gap-4">
        <button type="button" className={boton} disabled={!coinciden} onClick={terminar}>
          Terminar
        </button>
        <button type="button" className={enlace} onClick={() => setPaso("mostrar")}>
          Ver las palabras otra vez
        </button>
      </div>
    </div>
  );
}
