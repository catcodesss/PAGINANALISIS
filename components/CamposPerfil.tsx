"use client";

import { PAISES, type Perfil } from "@/lib/perfil";

/** Nombre, fecha de nacimiento y país: lo básico que se pide al crear la cuenta. */

export type BorradorPerfil = { [K in keyof Perfil]: string };
export const PERFIL_VACIO: BorradorPerfil = { nombre: "", nacimiento: "", pais: "" };

const campo =
  "mt-1 w-full rounded-md border border-divider bg-canvas px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-accent";

interface Props {
  valor: BorradorPerfil;
  onCambio: (valor: BorradorPerfil) => void;
  autoFocus?: boolean;
}

export default function CamposPerfil({ valor, onCambio, autoFocus }: Props) {
  const cambiar = (parcial: Partial<BorradorPerfil>) => onCambio({ ...valor, ...parcial });
  const hoy = new Date().toISOString().slice(0, 10);
  return (
    <>
      <label className="block text-sm">
        Nombre
        <input
          type="text"
          autoComplete="name"
          required
          maxLength={80}
          autoFocus={autoFocus}
          className={campo}
          value={valor.nombre}
          onChange={(e) => cambiar({ nombre: e.target.value })}
        />
      </label>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          Fecha de nacimiento
          <input
            type="date"
            autoComplete="bday"
            required
            min="1900-01-01"
            max={hoy}
            className={campo}
            value={valor.nacimiento}
            onChange={(e) => cambiar({ nacimiento: e.target.value })}
          />
        </label>
        <label className="block text-sm">
          País
          <select
            required
            autoComplete="country"
            className={campo}
            value={valor.pais}
            onChange={(e) => cambiar({ pais: e.target.value })}
          >
            <option value="" disabled>
              Elige tu país
            </option>
            {PAISES.map((p) => (
              <option key={p.codigo} value={p.codigo}>
                {p.nombre}
              </option>
            ))}
          </select>
        </label>
      </div>
    </>
  );
}
