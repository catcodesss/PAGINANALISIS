"use client";

import {
  BookOpenCheck,
  FilePenLine,
  FolderOpen,
  Heart,
  Layers,
  LayoutTemplate,
  Library,
  Settings,
} from "lucide-react";

/** Vistas que hoy existen de verdad. El resto de ítems son mapa del producto. */
export type Vista = "analisis" | "guia";

interface ItemNav {
  icono: typeof FilePenLine;
  etiqueta: string;
  vista?: Vista;
}

const ITEMS_NAV: ItemNav[] = [
  { icono: FilePenLine, etiqueta: "Nuevo análisis", vista: "analisis" },
  { icono: FolderOpen, etiqueta: "Mis análisis" },
  { icono: LayoutTemplate, etiqueta: "Plantillas" },
  { icono: Library, etiqueta: "Biblioteca clínica" },
  { icono: BookOpenCheck, etiqueta: "Guía de uso", vista: "guia" },
  { icono: Settings, etiqueta: "Configuración" },
];

interface SidebarProps {
  vista: Vista;
  onCambiarVista: (vista: Vista) => void;
}

/**
 * Los ítems sin `vista` son de próxima disponibilidad: se muestran para
 * comunicar el mapa del producto, pero no navegan a ninguna parte.
 *
 * La barra queda anclada al desplazar el informe: un análisis ocupa varias
 * pantallas y volver arriba solo para cambiar de vista era una fricción real.
 * `self-start` es imprescindible — sin él, el estirado por defecto del flex
 * padre le da la altura de todo el contenido y `sticky` se queda sin recorrido
 * donde actuar. El scroll propio cubre las ventanas bajas, donde el menú no
 * cabría entero.
 */
export default function Sidebar({ vista, onCambiarVista }: SidebarProps) {
  return (
    <aside className="hidden w-64 shrink-0 flex-col bg-sidebar px-4 py-6 text-white lg:flex print:hidden lg:sticky lg:top-0 lg:h-screen lg:self-start lg:overflow-y-auto">
      <button
        type="button"
        onClick={() => onCambiarVista("analisis")}
        className="flex items-center gap-3 rounded-lg px-2 text-left transition-opacity hover:opacity-90"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white">
          {/* Marca en SVG estático: <img> en vez de next/image porque no hay que
              optimizar nada y así no arrastra el runtime del componente. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/isotipo-acia.svg"
            alt=""
            aria-hidden="true"
            className="h-7 w-7"
          />
        </span>
        <div className="min-w-0">
          <p className="font-serif text-lg font-semibold leading-tight">ACIA</p>
          <p className="truncate text-xs text-white/60">
            Análisis de Conducta con IA
          </p>
        </div>
      </button>

      <nav aria-label="Navegación principal" className="mt-8 flex flex-1 flex-col gap-1">
        {ITEMS_NAV.map(({ icono: Icono, etiqueta, vista: destino }) => {
          const activo = destino !== undefined && destino === vista;
          return (
            <button
              key={etiqueta}
              type="button"
              onClick={() => destino && onCambiarVista(destino)}
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
  );
}
