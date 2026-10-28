"use client";

import { useState } from "react";
import { repositorio } from "@/lib/repositorio";
import {
  anadirSesion,
  avisoAlias,
  crearExpediente,
  guardarVersion,
  type Expediente,
} from "@/lib/casos";
import type { AnalisisFuncional } from "@/lib/types";

/**
 * Guarda en la biblioteca un análisis que se hizo sin caso: crea el caso, le
 * añade la nota como sesión 1 y guarda su formulación. Si la biblioteca está
 * bloqueada pide la contraseña (o la crea, la primera vez).
 */

interface Props {
  nota: string;
  analisis: AnalisisFuncional;
  aliasInicial: string;
  onGuardado: (expediente: Expediente) => void;
}

const CAMPO =
  "rounded border border-divider bg-canvas px-3 py-2 text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40";

export default function GuardarEnBiblioteca({ nota, analisis, aliasInicial, onGuardado }: Props) {
  const [abierto, setAbierto] = useState(false);
  const [alias, setAlias] = useState(aliasInicial);
  const [motivo, setMotivo] = useState("");
  const [contrasena, setContrasena] = useState("");
  const [repetir, setRepetir] = useState("");
  const [primeraVez, setPrimeraVez] = useState(false);
  const [bloqueada, setBloqueada] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [mensaje, setMensaje] = useState("");

  async function abrir() {
    setMensaje("");
    try {
      if (!repositorio.disponible()) {
        setMensaje("Este navegador no permite guardar casos.");
      } else if (!repositorio.desbloqueado()) {
        setBloqueada(true);
        setPrimeraVez(!(await repositorio.yaConfigurado()));
      }
      setAbierto(true);
    } catch {
      setMensaje("No se pudo abrir la biblioteca.");
    }
  }

  async function guardar() {
    setMensaje("");
    if (bloqueada && primeraVez) {
      if (contrasena.length < 8) return setMensaje("Usa al menos 8 caracteres.");
      if (contrasena !== repetir) return setMensaje("Las contraseñas no coinciden.");
    }
    setOcupado(true);
    try {
      if (bloqueada) {
        if (primeraVez) {
          await repositorio.configurar(contrasena);
        } else if (!(await repositorio.desbloquear(contrasena))) {
          setMensaje("Contraseña incorrecta.");
          return;
        }
        await repositorio.migrarHistorial();
        setBloqueada(false);
        setContrasena("");
        setRepetir("");
      }
      const vacio = crearExpediente({ alias, motivo });
      const { expediente: conSesion, sesion } = anadirSesion(vacio, { nota });
      const completo = guardarVersion(conSesion, sesion.id, analisis);
      await repositorio.crearCaso(completo);
      onGuardado(completo);
    } catch (e) {
      setMensaje(e instanceof Error ? e.message : "No se pudo guardar el análisis.");
    } finally {
      setOcupado(false);
    }
  }

  if (!abierto) {
    return (
      <>
        <button
          type="button"
          onClick={abrir}
          className="rounded border border-divider bg-surface px-4 py-2 text-sm font-medium text-ink transition-colors hover:bg-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
        >
          Guardar en mi biblioteca
        </button>
        {mensaje && (
          <p role="alert" className="w-full text-xs text-warn">
            {mensaje}
          </p>
        )}
      </>
    );
  }

  const aviso = avisoAlias(alias);
  return (
    <div className="flex w-full flex-wrap gap-2 rounded border border-divider bg-canvas p-3">
      <input
        value={alias}
        onChange={(e) => setAlias(e.target.value)}
        placeholder="Alias (p. ej. M.34)"
        maxLength={40}
        aria-label="Alias del caso"
        className={`${CAMPO} min-w-[10rem] flex-1`}
      />
      <input
        value={motivo}
        onChange={(e) => setMotivo(e.target.value)}
        placeholder="Motivo (opcional)"
        maxLength={120}
        aria-label="Motivo de consulta"
        className={`${CAMPO} min-w-[12rem] flex-[2]`}
      />
      {bloqueada && (
        <>
          <input
            type="password"
            value={contrasena}
            onChange={(e) => setContrasena(e.target.value)}
            placeholder={primeraVez ? "Crea una contraseña para tu biblioteca" : "Contraseña de tu biblioteca"}
            aria-label="Contraseña de la biblioteca"
            autoComplete={primeraVez ? "new-password" : "current-password"}
            className={`${CAMPO} min-w-[14rem] flex-1`}
          />
          {primeraVez && (
            <input
              type="password"
              value={repetir}
              onChange={(e) => setRepetir(e.target.value)}
              placeholder="Repítela"
              aria-label="Repetir contraseña"
              autoComplete="new-password"
              className={`${CAMPO} min-w-[10rem] flex-1`}
            />
          )}
        </>
      )}
      <button
        type="button"
        onClick={guardar}
        disabled={ocupado || !alias.trim() || (bloqueada && !contrasena)}
        className="rounded bg-accent px-4 py-2 text-sm font-medium texto-sobre-acento transition-colors hover:bg-accent/90 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
      >
        Guardar
      </button>
      <button
        type="button"
        onClick={() => setAbierto(false)}
        disabled={ocupado}
        className="rounded border border-divider px-4 py-2 text-sm text-ink-muted hover:text-ink"
      >
        Cancelar
      </button>
      {primeraVez && bloqueada && (
        <p className="w-full text-xs text-ink-muted">
          Esta contraseña cifra tus casos en este navegador. Si la pierdes no se pueden recuperar.
        </p>
      )}
      {aviso && <p className="w-full text-xs text-warn">{aviso}</p>}
      {mensaje && (
        <p role="alert" className="w-full text-xs text-warn">
          {mensaje}
        </p>
      )}
    </div>
  );
}
