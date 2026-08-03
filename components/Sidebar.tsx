"use client";

import { useEffect, useState } from "react";
import {
  BookOpenCheck,
  FilePenLine,
  FolderOpen,
  Heart,
  Layers,
  Library,
  Menu,
  Settings,
  X,
} from "lucide-react";

/** Vistas que hoy existen de verdad. El resto de ítems son mapa del producto. */
export type Vista = "analisis" | "guia" | "configuracion";

interface ItemNav {
  icono: typeof FilePenLine;
  etiqueta: string;
  vista?: Vista;
}

const ITEMS_NAV: ItemNav[] = [
  { icono: FilePenLine, etiqueta: "Nuevo análisis", vista: "analisis" },
  { icono: FolderOpen, etiqueta: "Mis análisis" },
  { icono: Library, etiqueta: "Biblioteca clínica" },
  { icono: BookOpenCheck, etiqueta: "Guía de uso", vista: "guia" },
  { icono: Settings, etiqueta: "Configuración", vista: "configuracion" },
];

interface SidebarProps {
  vista: Vista;
  onCambiarVista: (vista: Vista) => void;
}

/**
 * Navegación principal, en dos formas según el ancho.
 *
 * En escritorio es una columna fija. En móvil era, sencillamente, invisible:
 * estaba `hidden` por debajo de `lg`, así que desde el teléfono no había manera
 * de llegar a la guía ni a los ajustes. Ahora es un cajón que se abre con el
 * botón de hamburguesa.
 *
 * Los ítems sin `vista` son de próxima disponibilidad: se muestran para
 * comunicar el mapa del producto, pero no navegan a ninguna parte.
 */
export default function Sidebar({ vista, onCambiarVista }: SidebarProps) {
  const [abierto, setAbierto] = useState(false);

  // Con el cajón abierto, el fondo no debe desplazarse detrás.
  useEffect(() => {
    if (!abierto) return;
    const previo = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previo;
    };
  }, [abierto]);

  // Escape cierra: es lo que espera cualquiera que abra una capa encima.
  useEffect(() => {
    if (!abierto) return;
    const alPulsar = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAbierto(false);
    };
    document.addEventListener("keydown", alPulsar);
    return () => document.removeEventListener("keydown", alPulsar);
  }, [abierto]);

  function navegar(destino?: Vista) {
    if (!destino) return;
    onCambiarVista(destino);
    setAbierto(false);
  }

  return (
    <>
      {/* Barra superior del móvil: el único punto de entrada al menú por debajo
          de lg, así que va fija para no perderse al desplazar el informe. */}
      <div className="sticky top-0 z-30 flex items-center gap-3 border-b border-divider bg-sidebar px-4 py-3 text-white lg:hidden print:hidden">
        <button
          type="button"
          onClick={() => setAbierto(true)}
          aria-label="Abrir el menú"
          aria-expanded={abierto}
          aria-controls="menu-lateral"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
        >
          <Menu className="h-5 w-5" aria-hidden="true" />
        </button>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/images/logo-acia-blanco.svg"
          alt=""
          aria-hidden="true"
          className="h-8 w-auto shrink-0"
        />
        <p className="font-serif text-base font-semibold leading-none">ACIA</p>
      </div>

      {abierto && (
        <div
          onClick={() => setAbierto(false)}
          aria-hidden="true"
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
        />
      )}

      <aside
        id="menu-lateral"
        className={`z-50 w-64 shrink-0 flex-col bg-sidebar px-4 py-6 text-white print:hidden lg:sticky lg:top-0 lg:flex lg:h-screen lg:self-start lg:overflow-y-auto ${
          abierto
            ? "fixed inset-y-0 left-0 flex overflow-y-auto"
            : "hidden"
        }`}
      >
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => navegar("analisis")}
            className="flex min-w-0 items-center gap-3 rounded-lg px-2 text-left transition-opacity hover:opacity-90"
          >
            {/* Sin recuadro: la marca en blanco va directa sobre el verde de la
                barra, que es lo que le da presencia. Variante blanca aparte porque
                el brillo de la lente va recortado, no pintado — ver MARCA.md.
                <img> en vez de next/image: es un SVG estático, no hay que
                optimizar nada y así no arrastra el runtime del componente. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/images/logo-acia-blanco.svg"
              alt=""
              aria-hidden="true"
              className="h-10 w-auto shrink-0"
            />
            <div className="min-w-0">
              <p className="font-serif text-lg font-semibold leading-tight">ACIA</p>
              <p className="truncate text-xs text-white/60">
                Análisis de Conducta con IA
              </p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setAbierto(false)}
            aria-label="Cerrar el menú"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors hover:bg-white/10 lg:hidden"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <nav aria-label="Navegación principal" className="mt-8 flex flex-1 flex-col gap-1">
          {ITEMS_NAV.map(({ icono: Icono, etiqueta, vista: destino }) => {
            const activo = destino !== undefined && destino === vista;
            return (
              <button
                key={etiqueta}
                type="button"
                onClick={() => navegar(destino)}
                aria-current={activo ? "page" : undefined}
                title={destino ? undefined : "Próximamente"}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors ${
                  activo
                    ? "bg-white/15 font-medium text-white"
                    : "text-white/65 hover:bg-white/5 hover:text-white/90"
                }`}
              >
                <Icono className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
                {etiqueta}
              </button>
            );
          })}
        </nav>

        <div className="relative mt-6 overflow-hidden rounded-2xl bg-white/10 p-4">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15">
            <Heart className="h-4 w-4 text-white" aria-hidden="true" />
          </span>
          <p className="mt-3 text-sm font-semibold leading-snug">
            Tu trabajo tiene impacto cada día
          </p>
          <p className="mt-1 text-xs leading-relaxed text-white/60">
            Gracias por acompañar procesos de cambio.
          </p>
          <Layers
            className="pointer-events-none absolute -bottom-2 -right-2 h-16 w-16 text-white/10"
            aria-hidden="true"
          />
        </div>
      </aside>
    </>
  );
}
