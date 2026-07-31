import {
  Clock,
  EyeOff,
  ListChecks,
  Quote,
  Scissors,
  ShieldCheck,
  SpellCheck2,
  Target,
  type LucideIcon,
} from "lucide-react";

interface Recomendacion {
  icono: LucideIcon;
  titulo: string;
  descripcion: string;
}

const RECOMENDACIONES: Recomendacion[] = [
  {
    icono: SpellCheck2,
    titulo: "Escribe en prosa",
    descripcion: "Oraciones completas, no en frases sueltas o telegráficas.",
  },
  {
    icono: Quote,
    titulo: "Cuida la claridad",
    descripcion: "La ortografía y puntuación ayudan a que la IA interprete mejor.",
  },
  {
    icono: Scissors,
    titulo: "Sé directo y evita relleno",
    descripcion: "Repeticiones o rodeos innecesarios pueden diluir la información clave.",
  },
  {
    icono: ListChecks,
    titulo: "Usa abreviaturas con moderación",
    descripcion: "Solo si son estándar (ej. TCC, TOC) y explica las demás.",
  },
  {
    icono: Clock,
    titulo: "Incluye lo esencial de cada episodio",
    descripcion: "Situación, conducta y consecuencia inmediata.",
  },
  {
    icono: EyeOff,
    titulo: "Evita párrafos extensos",
    descripcion: "Transcripciones completas o notas de varias sesiones pueden sesgar el análisis.",
  },
  {
    icono: EyeOff,
    titulo: "No incluyas nombres reales",
    descripcion: "Direcciones ni otros datos identificables.",
  },
];

export default function PanelRecomendaciones() {
  return (
    <aside className="print:hidden">
      <div className="rounded-2xl border border-divider bg-surface p-5 shadow-sm">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-soft">
            <Target className="h-4 w-4 text-accent" aria-hidden="true" />
          </span>
          <p className="font-serif text-base font-semibold text-ink">
            Para un análisis más preciso
          </p>
        </div>

        <ul className="mt-4 space-y-4">
          {RECOMENDACIONES.map(({ icono: Icono, titulo, descripcion }) => (
            <li key={titulo} className="flex gap-3">
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent-soft">
                <Icono className="h-[15px] w-[15px] text-accent" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-ink">{titulo}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-ink-muted">
                  {descripcion}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-5 flex justify-center rounded-2xl bg-accent-soft p-6">
        {/* Ilustración "A moment to relax" — unDraw (MIT), recoloreada al verde de marca. */}
        <img
          src="/images/ilustracion-relax.svg"
          alt="Ilustración de un espacio de lectura tranquilo, en tonos verdes"
          className="h-auto w-full max-w-[220px]"
        />
      </div>

      <p className="mt-4 flex items-start gap-2 text-xs leading-relaxed text-ink-muted">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
        Herramienta diseñada para profesionales de la salud mental. No
        reemplaza el juicio clínico.
      </p>
    </aside>
  );
}
