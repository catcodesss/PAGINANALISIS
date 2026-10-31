"use client";

import { useEffect, useState } from "react";
import { Folder } from "lucide-react";
import { repositorio } from "@/lib/repositorio";
import type { Expediente, ResumenCaso } from "@/lib/casos";

/**
 * Sección «Evolución»: una carpeta por paciente, con el alias que puso el
 * terapeuta. De momento solo lista las carpetas y abre el caso; la matriz de
 * hipótesis y los indicadores por sesión se añaden aquí (fase 11).
 */

interface EvolucionProps {
  onAbrir: (expediente: Expediente) => void;
}

function formatearFecha(iso: string): string {
  return new Date(iso).toLocaleDateString("es", { day: "numeric", month: "short", year: "numeric" });
}

export default function Evolucion({ onAbrir }: EvolucionProps) {
  const [casos, setCasos] = useState<ResumenCaso[] | null>(null);
  const [bloqueado, setBloqueado] = useState(false);

  useEffect(() => {
    let vivo = true;
    (async () => {
      const abierto = repositorio.disponible() && repositorio.desbloqueado();
      const lista = abierto ? await repositorio.listarCasos() : [];
      if (!vivo) return;
      setBloqueado(!abierto);
      setCasos(lista.filter((c) => c.fase !== "archivado" && !c.eliminado_en));
    })();
    return () => {
      vivo = false;
    };
  }, []);

  async function abrir(id: string) {
    const expediente = await repositorio.obtenerCaso(id);
    if (expediente) onAbrir(expediente);
  }

  if (casos === null) return null;

  return (
    <section className="mt-6 rounded-xl border border-divider bg-surface p-5 print:hidden">
      <h2 className="mb-1 font-serif text-lg font-semibold text-ink">Evolución</h2>
      <p className="mb-4 text-sm text-ink-muted">
        Cómo cambia cada caso de una sesión a otra. Elige la carpeta de un paciente.
      </p>
      {bloqueado ? (
        <p className="text-sm text-ink-muted">
          Abre tus casos con tu contraseña (sección «Casos») para ver las carpetas.
        </p>
      ) : casos.length === 0 ? (
        <p className="text-sm text-ink-muted">Aún no hay pacientes.</p>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {casos.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => void abrir(c.id)}
                className="flex w-full items-center gap-3 rounded-lg border border-divider px-4 py-3 text-left transition-colors hover:bg-canvas"
              >
                <Folder className="h-5 w-5 shrink-0 text-ink-muted" aria-hidden="true" />
                <span className="min-w-0">
                  <span className="block text-[15px] font-medium text-ink">{c.alias}</span>
                  <span className="block font-mono text-[11px] uppercase tracking-wide text-ink-muted">
                    {c.fecha_ultima_sesion
                      ? `${c.ultima_sesion} sesion${c.ultima_sesion === 1 ? "" : "es"} · ${formatearFecha(c.fecha_ultima_sesion)}`
                      : "Sin sesiones"}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
