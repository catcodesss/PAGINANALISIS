import {
  ChevronRight,
  EyeOff,
  FileText,
  Lightbulb,
  ListChecks,
  Quote,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";

interface Recomendacion {
  icono: LucideIcon;
  titulo: string;
  descripcion: string;
}

// Cuatro y no siete: de un vistazo solo se retiene un puñado. Los tres que
// salieron (abreviaturas, notas de varias sesiones, relleno) tienen que pasar
// a la guía, que es adonde lleva cada fila — pendiente en PENDIENTE.md.
const RECOMENDACIONES: Recomendacion[] = [
  {
    icono: FileText,
    titulo: "Escribe en prosa",
    descripcion: "Oraciones completas, no en frases sueltas o telegráficas.",
  },
  {
    icono: Quote,
    titulo: "Cuida la claridad",
    descripcion: "La ortografía y puntuación ayudan a que la IA interprete mejor.",
  },
  {
    icono: ListChecks,
    titulo: "Incluye lo esencial",
    descripcion: "Situación, conducta y consecuencia inmediata.",
  },
  {
    icono: EyeOff,
    titulo: "Evita nombres reales",
    descripcion: "Usa iniciales o seudónimos.",
  },
];

interface PanelRecomendacionesProps {
  onAbrirGuia: () => void;
}

export default function PanelRecomendaciones({ onAbrirGuia }: PanelRecomendacionesProps) {
  return (
    <aside className="flex flex-col gap-5 print:hidden">
      <div className="rounded-3xl border border-divider bg-surface p-5 shadow-[0_1px_3px_rgba(60,45,25,0.06)]">
        <div className="flex items-start gap-3 px-1">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-tierra-soft">
            <Lightbulb className="h-5 w-5 text-dorado" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="font-serif text-lg font-semibold leading-snug text-ink">
              Consejos para un mejor análisis
            </p>
            <p className="mt-1 text-xs leading-relaxed text-ink-muted">
              Estas recomendaciones ayudan a que la IA genere un análisis más
              preciso y útil.
            </p>
          </div>
        </div>

        <ul className="mt-4 divide-y divide-divider">
          {RECOMENDACIONES.map(({ icono: Icono, titulo, descripcion }) => (
            <li key={titulo}>
              <button
                type="button"
                onClick={onAbrirGuia}
                title="Ver en la guía de uso"
                className="group flex w-full items-center gap-3.5 rounded-xl px-1 py-3.5 text-left transition-colors hover:bg-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-tierra-soft">
                  <Icono className="h-[18px] w-[18px] text-tierra" aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-serif text-[15px] font-semibold text-ink">
                    {titulo}
                  </span>
                  <span className="mt-0.5 block text-xs leading-relaxed text-ink-muted">
                    {descripcion}
                  </span>
                </span>
                <ChevronRight
                  className="h-4 w-4 shrink-0 text-ink-muted transition-transform group-hover:translate-x-0.5"
                  aria-hidden="true"
                />
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="relative flex items-end gap-2 overflow-hidden rounded-3xl bg-tierra-soft py-5 pl-6 pr-2">
        <div className="relative z-10 min-w-0 flex-1 self-center">
          <p className="font-serif text-xl font-semibold leading-tight text-ink">
            Un apoyo para tu práctica clínica
          </p>
          <p className="mt-3 text-xs leading-relaxed text-ink-muted">
            Más tiempo para lo importante: comprender, intervenir y generar
            cambios reales.
          </p>
        </div>
        {/* Dibujada a mano para esta tarjeta, con la paleta de la marca: un
            unDraw recoloreado no casaba con el crema. Es decorativa. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/images/ilustracion-consulta.svg"
          alt=""
          aria-hidden="true"
          className="h-auto w-[52%] max-w-[210px] shrink-0"
        />
      </div>

      <p className="flex items-start gap-2 px-1 text-xs leading-relaxed text-ink-muted">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
        Herramienta diseñada para profesionales de la salud mental. No
        reemplaza el juicio clínico.
      </p>
    </aside>
  );
}
