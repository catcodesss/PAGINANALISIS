"use client";

import Link from "next/link";
import {
  BookOpenCheck,
  Eye,
  FilePenLine,
  FolderOpen,
  Heart,
  Leaf,
  Settings,
  TrendingUp,
  AlertTriangle,
  Lock,
} from "lucide-react";

/** Vistas que hoy existen de verdad. El resto de ítems son mapa del producto. */
export type Vista = "analisis" | "casos" | "evolucion" | "guia" | "configuracion";

interface ItemNav {
  icono: typeof FilePenLine;
  etiqueta: string;
  vista?: Vista;
  /** Abre «Análisis» con el formulario en blanco para un caso nuevo. */
  nuevo?: boolean;
}

const ITEMS_NAV: ItemNav[] = [
  { icono: FilePenLine, etiqueta: "Nuevo caso", vista: "analisis", nuevo: true },
  { icono: FolderOpen, etiqueta: "Casos", vista: "casos" },
  { icono: TrendingUp, etiqueta: "Evolución", vista: "evolucion" },
  // «Aprender» reúne la guía de uso y la biblioteca clínica.
  { icono: BookOpenCheck, etiqueta: "Aprender", vista: "guia" },
  // «Cuenta»: configuración, privacidad y respaldo.
  { icono: Settings, etiqueta: "Cuenta", vista: "configuracion" },
];

interface SidebarProps {
  /** Sin vista activa (p. ej. en la página de ejemplo) ningún ítem se marca. */
  vista?: Vista;
  onCambiarVista: (vista: Vista, nuevo?: boolean) => void;
  /** Muestra un ⚠ en «Cuenta»: hay algo de seguridad pendiente (clave de recuperación). */
  avisoCuenta?: boolean;
  /** Modo invitado: «Casos» y «Evolución» piden cuenta; se marcan con un candado. */
  invitado?: boolean;
}

/**
 * Navegación principal: siempre a la izquierda y siempre desplegada.
 *
 * Los ítems sin `vista` son de próxima disponibilidad: se muestran para
 * comunicar el mapa del producto, pero no navegan a ninguna parte.
 */
export default function Sidebar({ vista, onCambiarVista, avisoCuenta, invitado }: SidebarProps) {
  function navegar(destino?: Vista, nuevo?: boolean) {
    if (!destino) return;
    onCambiarVista(destino, nuevo);
  }

  return (
    <aside
      id="menu-lateral"
      className={`sticky top-0 z-30 flex h-screen shrink-0 flex-col self-start overflow-x-hidden overflow-y-auto bg-sidebar py-7 text-white transition-[width] duration-200 print:hidden w-72 px-5`}
    >
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => navegar("analisis")}
          className="flex min-w-0 items-center gap-3 rounded-lg px-2 text-left transition-opacity hover:opacity-90"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/logo-acia-blanco.svg"
            alt=""
            aria-hidden="true"
            className="h-10 w-auto shrink-0"
          />
          <div className="min-w-0">
            <p className="font-serif text-xl font-semibold leading-tight tracking-[0.2em]">
              ACIA
            </p>
            <p className="text-xs leading-snug text-white/65">
              Análisis de Conducta
              <br />
              asistido por IA
            </p>
          </div>
        </button>
      </div>

      <>
          <nav aria-label="Navegación principal" className="mt-8 flex flex-1 flex-col gap-1">
            {ITEMS_NAV.map(({ icono: Icono, etiqueta, vista: destino, nuevo }) => {
              const activo = destino !== undefined && destino === vista;
              return (
                <button
                  key={etiqueta}
                  type="button"
                  onClick={() => navegar(destino, nuevo)}
                  aria-current={activo ? "page" : undefined}
                  title={destino ? undefined : "Próximamente"}
                  className={`flex items-center gap-3.5 rounded-xl px-4 py-3 text-left text-[15px] transition-colors ${
                    activo
                      ? "bg-white/12 font-medium text-white shadow-sm"
                      : "text-white/70 hover:bg-white/5 hover:text-white/90"
                  }`}
                >
                  <Icono className="h-5 w-5 shrink-0" aria-hidden="true" />
                  {etiqueta}
                  {invitado && (destino === "casos" || destino === "evolucion") && (
                    <span className="ml-auto flex items-center text-white/50" title="Necesitas una cuenta">
                      <Lock className="h-4 w-4" aria-hidden="true" />
                      <span className="sr-only">Requiere cuenta</span>
                    </span>
                  )}
                  {avisoCuenta && destino === "configuracion" && (
                    <span
                      className="ml-auto flex items-center text-dorado"
                      title="Tienes una recomendación de seguridad pendiente"
                    >
                      <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                      <span className="sr-only">Seguridad pendiente</span>
                    </span>
                  )}
                </button>
              );
            })}

            {/*
              PROVISIONAL — enlace a la página de ejemplo. Existe para poder
              revisar el formato del informe desde el móvil sin gastar una llamada
              al modelo. Va aparte de ITEMS_NAV y no en la lista porque no es una
              función del producto: cuando deje de hacer falta, se borra este
              bloque y la carpeta app/maqueta y no queda rastro.
            */}
            <Link
              href="/maqueta"
              className="mt-2 flex items-center gap-3 rounded-lg border border-dashed border-white/25 px-3 py-2.5 text-left text-sm text-white/65 transition-colors hover:bg-white/5 hover:text-white/90"
            >
              <Eye className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
              <span className="min-w-0">
                Ver informe de ejemplo
                <span className="block text-xs text-white/45">
                  Sin gastar análisis
                </span>
              </span>
            </Link>
          </nav>

          <div className="relative mt-6 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.07] p-5">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-dorado">
              <Heart className="h-[18px] w-[18px] text-white" aria-hidden="true" />
            </span>
            <p className="relative mt-4 max-w-[11rem] font-serif text-base font-semibold leading-snug">
              Tu trabajo tiene impacto cada día
            </p>
            <p className="relative mt-2 max-w-[10rem] text-xs leading-relaxed text-white/65">
              Gracias por acompañar procesos de cambio.
            </p>
            <Leaf
              className="pointer-events-none absolute -bottom-3 -right-3 h-24 w-24 -rotate-12 text-white/[0.08]"
              strokeWidth={1.25}
              aria-hidden="true"
            />
          </div>
      </>
    </aside>
  );
}
