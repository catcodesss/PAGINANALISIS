"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  BookOpenCheck,
  Eye,
  FilePenLine,
  FolderOpen,
  Heart,
  Leaf,
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
        className={`z-50 w-72 shrink-0 flex-col bg-sidebar px-5 py-7 text-white print:hidden lg:sticky lg:top-0 lg:flex lg:h-screen lg:self-start lg:overflow-y-auto ${
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
                className={`flex items-center gap-3.5 rounded-xl px-4 py-3 text-left text-[15px] transition-colors ${
                  activo
                    ? "bg-white/12 font-medium text-white shadow-sm"
                    : "text-white/70 hover:bg-white/5 hover:text-white/90"
                }`}
              >
                <Icono className="h-5 w-5 shrink-0" aria-hidden="true" />
                {etiqueta}
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
      </aside>
    </>
  );
}
