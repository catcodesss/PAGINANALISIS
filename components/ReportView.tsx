"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import type { AnalisisFuncional, NivelConfianza } from "@/lib/types";

interface ReportViewProps {
  analisis: AnalisisFuncional;
  referenciaCaso: string;
  onReferenciaCasoChange: (valor: string) => void;
  fecha: string;
}

const SECCIONES_INDICE = [
  { id: "hipotesis-principal", titulo: "Hipótesis principal" },
  { id: "resumen", titulo: "Resumen clínico" },
  { id: "conductas", titulo: "Conductas problema" },
  { id: "analisis-funcional", titulo: "Análisis funcional detallado" },
  { id: "alternativas", titulo: "Hipótesis alternativas" },
  { id: "habilidades", titulo: "Habilidades recomendadas" },
  { id: "reglas-procesos", titulo: "Reglas verbales y procesos ACT" },
  { id: "preguntas", titulo: "Preguntas para la próxima sesión" },
  { id: "intervencion", titulo: "Líneas de intervención" },
  { id: "datos-faltantes", titulo: "Datos faltantes" },
] as const;

function SinHallazgos() {
  return (
    <p className="text-sm text-ink-muted">Sin hallazgos suficientes en la nota.</p>
  );
}

/** Chip de clasificación técnica: informativo, discreto. */
function Chip({ children }: { children: ReactNode }) {
  return (
    <span className="inline-block whitespace-nowrap rounded border border-accent/40 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide text-accent">
      {children}
    </span>
  );
}

/** Chip de función hipotetizada: es una conclusión, va destacado. */
function ChipFuncion({ children }: { children: ReactNode }) {
  return (
    <span className="inline-block whitespace-nowrap rounded bg-accent px-2.5 py-1 font-mono text-[10px] uppercase tracking-wide text-white">
      {children}
    </span>
  );
}

function colorConfianza(nivel: string): string {
  if (nivel === "alta") return "bg-accent";
  if (nivel === "media") return "bg-warn";
  return "bg-ink-muted/50";
}

const EXPLICACION_CONFIANZA: Record<string, string> = {
  alta: "Alta: la evidencia está explícita y clara en la nota.",
  media: "Media: hay evidencia parcial, o se infiere con relativa seguridad.",
  baja: "Baja: la evidencia es escasa; se apoya principalmente en inferencia clínica.",
};

function Confianza({ nivel }: { nivel: NivelConfianza | string }) {
  return (
    <span
      title={EXPLICACION_CONFIANZA[nivel] ?? undefined}
      className="inline-flex cursor-help items-center gap-1.5 font-mono text-[11px] uppercase tracking-wide text-ink-muted"
    >
      <span
        aria-hidden="true"
        className={`h-1.5 w-1.5 rounded-full ${colorConfianza(nivel)}`}
      />
      Confianza: {nivel}
    </span>
  );
}

/** Cita textual de la nota original, distinguida como bloque, no como frase suelta. */
function Cita({ children }: { children: string }) {
  if (!children) return null;
  return (
    <blockquote className="mt-2 border-l-2 border-divider pl-3">
      <p className="font-mono text-[10px] uppercase tracking-wide text-ink-muted/70">
        De la nota
      </p>
      <p className="text-sm italic leading-relaxed text-ink-muted">
        &quot;{children}&quot;
      </p>
    </blockquote>
  );
}

function Seccion({
  id,
  titulo,
  extra,
  children,
}: {
  id: string;
  titulo: string;
  extra?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      data-seccion-indice={id}
      className="scroll-mt-24 border-b border-divider py-6 last:border-b-0"
    >
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="flex items-center gap-3 font-serif text-lg font-semibold text-ink sm:text-xl">
          <span aria-hidden="true" className="h-5 w-1 rounded-full bg-accent" />
          {titulo}
        </h2>
        {extra}
      </div>
      {children}
    </section>
  );
}

function SubSeccion({
  titulo,
  extra,
  children,
}: {
  titulo: string;
  extra?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <h3 className="font-mono text-xs uppercase tracking-wide text-ink-muted">
          {titulo}
        </h3>
        {extra}
      </div>
      {children}
    </div>
  );
}

function tipoOperacion(tipo: string): string {
  if (tipo === "establecedora") return "OE";
  if (tipo === "abolidora") return "OA";
  return tipo;
}

/** Índice de secciones con resaltado de la sección visible (scroll-spy). */
function useSeccionActiva() {
  const [activa, setActiva] = useState<string>(SECCIONES_INDICE[0].id);

  useEffect(() => {
    const elementos = SECCIONES_INDICE.map(({ id }) =>
      document.getElementById(id)
    ).filter((el): el is HTMLElement => el !== null);

    if (elementos.length === 0) return;

    const observer = new IntersectionObserver(
      (entradas) => {
        const visibles = entradas
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visibles.length > 0) {
          setActiva(visibles[0].target.id);
        }
      },
      { rootMargin: "-96px 0px -70% 0px", threshold: 0 }
    );

    elementos.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return activa;
}

function IndiceLateral({ activa }: { activa: string }) {
  return (
    <nav
      aria-label="Índice del informe"
      className="hidden shrink-0 lg:sticky lg:top-24 lg:block lg:h-fit lg:w-[190px]"
    >
      <ul className="space-y-1 border-l border-divider pl-3 text-sm">
        {SECCIONES_INDICE.map(({ id, titulo }) => (
          <li key={id}>
            <a
              href={`#${id}`}
              className={
                activa === id
                  ? "font-medium text-accent"
                  : "text-ink-muted transition-colors hover:text-ink"
              }
            >
              {titulo}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function IndiceMovil({ activa }: { activa: string }) {
  const [abierto, setAbierto] = useState(false);
  const contenedorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function manejarClickFuera(evento: MouseEvent) {
      if (
        contenedorRef.current &&
        !contenedorRef.current.contains(evento.target as Node)
      ) {
        setAbierto(false);
      }
    }
    document.addEventListener("mousedown", manejarClickFuera);
    return () => document.removeEventListener("mousedown", manejarClickFuera);
  }, []);

  const tituloActivo =
    SECCIONES_INDICE.find((s) => s.id === activa)?.titulo ?? "Ir a…";

  return (
    <div ref={contenedorRef} className="relative mb-4 lg:hidden">
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        aria-expanded={abierto}
        className="flex w-full items-center justify-between rounded border border-divider bg-surface px-3 py-2 text-sm text-ink"
      >
        <span>
          Ir a: <span className="text-ink-muted">{tituloActivo}</span>
        </span>
        <span aria-hidden="true" className="text-ink-muted">
          {abierto ? "▲" : "▼"}
        </span>
      </button>
      {abierto && (
        <ul className="absolute z-10 mt-1 w-full rounded border border-divider bg-surface py-1 shadow-md">
          {SECCIONES_INDICE.map(({ id, titulo }) => (
            <li key={id}>
              <a
                href={`#${id}`}
                onClick={() => setAbierto(false)}
                className={`block px-3 py-2 text-sm ${
                  activa === id ? "font-medium text-accent" : "text-ink"
                }`}
              >
                {titulo}
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function ReportView({
  analisis,
  referenciaCaso,
  onReferenciaCasoChange,
  fecha,
}: ReportViewProps) {
  const activa = useSeccionActiva();

  return (
    <div className="rounded-md border border-divider bg-surface px-5 py-6 shadow-sm sm:px-8 sm:py-8 lg:px-12 lg:py-10 print:rounded-none print:border-none print:px-0 print:py-0 print:shadow-none">
      <header className="mb-6 border-b border-divider pb-5">
        <p className="font-mono text-xs uppercase tracking-[0.15em] text-accent">
          Expediente · Análisis funcional
        </p>
        <h1 className="mt-1 font-serif text-2xl font-semibold text-ink sm:text-3xl">
          AFA — Análisis Funcional Asistido
        </h1>
        <div className="mt-4 flex flex-wrap items-center gap-x-8 gap-y-3 text-sm text-ink-muted">
          <p>
            Fecha de generación: <span className="text-ink">{fecha}</span>
          </p>
          <label className="flex items-center gap-2 print:hidden">
            <span>Referencia del caso (opcional):</span>
            <input
              type="text"
              value={referenciaCaso}
              onChange={(evento) => onReferenciaCasoChange(evento.target.value)}
              placeholder="p. ej. M.34"
              maxLength={60}
              className="border-b border-divider bg-transparent px-1 py-0.5 text-ink focus-visible:border-accent focus-visible:outline-none"
            />
          </label>
          {referenciaCaso.trim() && (
            <p className="hidden print:block">
              Referencia del caso: {referenciaCaso.trim()}
            </p>
          )}
        </div>
        <p className="mt-3 text-xs text-ink-muted">
          Los niveles de{" "}
          <span className="inline-flex items-center gap-1">
            confianza
            <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-accent" />
          </span>{" "}
          indican qué tan respaldada está cada hipótesis por evidencia
          explícita en la nota (alta, media o baja); pasa el cursor sobre
          ellos para el detalle.
        </p>
      </header>

      {/* Hipótesis funcional principal — el titular del informe. */}
      <section id="hipotesis-principal" className="scroll-mt-24 mb-8">
        {analisis.hipotesis_funcional_principal.enunciado ? (
          <div className="rounded-md border-l-4 border-accent bg-accent/[0.06] p-6 sm:p-8">
            <p className="font-mono text-[11px] uppercase tracking-[0.15em] text-accent">
              Hipótesis funcional principal
            </p>
            <p className="mt-3 font-serif text-xl leading-relaxed text-ink sm:text-2xl">
              {analisis.hipotesis_funcional_principal.enunciado}
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              {analisis.hipotesis_funcional_principal.funcion && (
                <ChipFuncion>
                  {analisis.hipotesis_funcional_principal.funcion}
                </ChipFuncion>
              )}
              <Confianza nivel={analisis.hipotesis_funcional_principal.confianza} />
            </div>
            <a
              href="#resumen"
              className="mt-5 inline-block text-sm text-ink-muted underline decoration-divider underline-offset-4 transition-colors hover:text-accent"
            >
              Ver análisis completo ↓
            </a>
          </div>
        ) : (
          <SinHallazgos />
        )}
      </section>

      <IndiceMovil activa={activa} />

      <div className="lg:flex lg:items-start lg:gap-10">
        <IndiceLateral activa={activa} />

        <div className="min-w-0 flex-1">
          <Seccion id="resumen" titulo="Resumen clínico">
            {analisis.resumen_clinico ? (
              <p className="text-[15px] leading-relaxed text-ink">
                {analisis.resumen_clinico}
              </p>
            ) : (
              <SinHallazgos />
            )}
          </Seccion>

          <Seccion id="conductas" titulo="Conductas problema">
            {analisis.conductas_problema.length === 0 ? (
              <SinHallazgos />
            ) : (
              <ul className="space-y-4">
                {analisis.conductas_problema.map((c, i) => (
                  <li key={i}>
                    <Chip>{c.tipo}</Chip>
                    <p className="mt-1 text-[15px] leading-relaxed text-ink">
                      {c.descripcion}
                    </p>
                    <Cita>{c.evidencia}</Cita>
                  </li>
                ))}
              </ul>
            )}
          </Seccion>

          <Seccion id="analisis-funcional" titulo="Análisis funcional detallado">
            <div className="space-y-6">
              <SubSeccion
                titulo="Antecedentes"
                extra={<Confianza nivel={analisis.antecedentes.confianza} />}
              >
                <div className="space-y-4">
                  <div>
                    <p className="mb-1.5 text-xs font-medium text-ink-muted">
                      Estímulos discriminativos
                    </p>
                    {analisis.antecedentes.estimulos_discriminativos.length === 0 ? (
                      <SinHallazgos />
                    ) : (
                      <ul className="space-y-3">
                        {analisis.antecedentes.estimulos_discriminativos.map(
                          (e, i) => (
                            <li key={i}>
                              <p className="text-[15px] leading-relaxed text-ink">
                                {e.descripcion}
                              </p>
                              <Cita>{e.evidencia}</Cita>
                            </li>
                          )
                        )}
                      </ul>
                    )}
                  </div>
                  <div>
                    <p className="mb-1.5 text-xs font-medium text-ink-muted">
                      Contexto situacional
                    </p>
                    {analisis.antecedentes.contexto_situacional.length === 0 ? (
                      <SinHallazgos />
                    ) : (
                      <ul className="space-y-3">
                        {analisis.antecedentes.contexto_situacional.map((c, i) => (
                          <li key={i}>
                            <p className="text-[15px] leading-relaxed text-ink">
                              {c.descripcion}
                            </p>
                            <Cita>{c.evidencia}</Cita>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </SubSeccion>

              <SubSeccion titulo="Operaciones motivacionales">
                {analisis.operaciones_motivacionales.length === 0 ? (
                  <SinHallazgos />
                ) : (
                  <ul className="space-y-4">
                    {analisis.operaciones_motivacionales.map((o, i) => (
                      <li key={i}>
                        <Chip>{tipoOperacion(o.tipo)}</Chip>
                        <p className="mt-1 text-[15px] leading-relaxed text-ink">
                          {o.descripcion}
                        </p>
                        {o.efecto_hipotetizado && (
                          <p className="mt-1 text-sm text-ink-muted">
                            Efecto hipotetizado: {o.efecto_hipotetizado}
                          </p>
                        )}
                        <Cita>{o.evidencia}</Cita>
                      </li>
                    ))}
                  </ul>
                )}
              </SubSeccion>

              <SubSeccion
                titulo="Consecuencias y contingencias de mantenimiento"
                extra={
                  <Confianza
                    nivel={analisis.consecuencias_y_mantenimiento.confianza}
                  />
                }
              >
                {analisis.consecuencias_y_mantenimiento.contingencias.length ===
                0 ? (
                  <SinHallazgos />
                ) : (
                  <ul className="space-y-4">
                    {analisis.consecuencias_y_mantenimiento.contingencias.map(
                      (c, i) => (
                        <li key={i}>
                          <div className="flex flex-wrap gap-2">
                            <Chip>{c.tipo}</Chip>
                            <Chip>{c.inmediatez}</Chip>
                          </div>
                          <p className="mt-1 text-[15px] leading-relaxed text-ink">
                            {c.descripcion}
                          </p>
                          <Cita>{c.evidencia}</Cita>
                        </li>
                      )
                    )}
                  </ul>
                )}
              </SubSeccion>
            </div>
          </Seccion>

          <Seccion id="alternativas" titulo="Hipótesis alternativas">
            {analisis.hipotesis_alternativas.length === 0 ? (
              <SinHallazgos />
            ) : (
              <ul className="space-y-4">
                {analisis.hipotesis_alternativas.map((h, i) => (
                  <li key={i}>
                    <p className="text-[15px] leading-relaxed text-ink">
                      {h.enunciado}
                    </p>
                    <p className="mt-1 text-sm text-ink-muted">
                      Cómo descartarla: {h.como_descartarla}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Seccion>

          <Seccion
            id="habilidades"
            titulo="Habilidades recomendadas"
            extra={
              <span className="font-mono text-[11px] uppercase tracking-wide text-ink-muted">
                Modelo: {analisis.modelo_terapeutico.toUpperCase()}
              </span>
            }
          >
            {analisis.habilidades_recomendadas.length === 0 ? (
              <SinHallazgos />
            ) : (
              <ul className="space-y-4">
                {analisis.habilidades_recomendadas.map((h, i) => (
                  <li key={i}>
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <p className="text-[15px] font-medium leading-relaxed text-ink">
                        {h.habilidad}
                      </p>
                      <Chip>{h.modulo}</Chip>
                    </div>
                    <p className="mt-1 text-sm text-ink-muted">
                      {h.justificacion}
                    </p>
                    <p className="mt-1 text-sm text-ink-muted">
                      <span className="font-medium text-ink">
                        Cómo practicarla:
                      </span>{" "}
                      {h.como_practicarla}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Seccion>

          <Seccion id="reglas-procesos" titulo="Reglas verbales y procesos ACT">
            <div className="space-y-6">
              <SubSeccion titulo="Reglas verbales">
                {analisis.reglas_verbales.length === 0 ? (
                  <SinHallazgos />
                ) : (
                  <ul className="space-y-4">
                    {analisis.reglas_verbales.map((r, i) => (
                      <li key={i}>
                        <div className="flex flex-wrap items-center gap-2">
                          <Chip>{r.clase}</Chip>
                          <span className="font-mono text-[11px] uppercase tracking-wide text-ink-muted">
                            Rigidez: {r.rigidez}
                          </span>
                        </div>
                        <p className="mt-1 text-[15px] italic leading-relaxed text-ink">
                          &quot;{r.regla}&quot;
                        </p>
                        <p className="mt-1 text-sm text-ink-muted">
                          {r.analisis}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </SubSeccion>

              <SubSeccion titulo="Procesos ACT identificados">
                {analisis.procesos_act.length === 0 ? (
                  <SinHallazgos />
                ) : (
                  <ul className="space-y-4">
                    {analisis.procesos_act.map((p, i) => (
                      <li key={i}>
                        <Chip>{p.proceso}</Chip>
                        <p className="mt-1 text-[15px] leading-relaxed text-ink">
                          {p.descripcion}
                        </p>
                        <Cita>{p.evidencia}</Cita>
                      </li>
                    ))}
                  </ul>
                )}
              </SubSeccion>
            </div>
          </Seccion>

          <Seccion id="preguntas" titulo="Preguntas para la próxima sesión">
            {analisis.preguntas_para_sesion.length === 0 ? (
              <SinHallazgos />
            ) : (
              <ul className="list-disc space-y-2 pl-5">
                {analisis.preguntas_para_sesion.map((p, i) => (
                  <li key={i} className="text-[15px] leading-relaxed text-ink">
                    {p}
                  </li>
                ))}
              </ul>
            )}
          </Seccion>

          <Seccion id="intervencion" titulo="Líneas de intervención tentativas">
            {analisis.lineas_de_intervencion_tentativas.length === 0 ? (
              <SinHallazgos />
            ) : (
              <ul className="list-disc space-y-2 pl-5">
                {analisis.lineas_de_intervencion_tentativas.map((l, i) => (
                  <li key={i} className="text-[15px] leading-relaxed text-ink">
                    {l}
                  </li>
                ))}
              </ul>
            )}
          </Seccion>

          <Seccion id="datos-faltantes" titulo="Datos faltantes">
            {analisis.datos_faltantes.length === 0 ? (
              <SinHallazgos />
            ) : (
              <ul className="list-disc space-y-2 pl-5">
                {analisis.datos_faltantes.map((d, i) => (
                  <li key={i} className="text-[15px] leading-relaxed text-ink">
                    {d}
                  </li>
                ))}
              </ul>
            )}
          </Seccion>
        </div>
      </div>

      <footer className="mt-6 rounded-md border border-divider bg-canvas p-4 text-xs leading-relaxed text-ink-muted print:bg-transparent">
        Este análisis es una síntesis asistida de hipótesis funcionales generadas a
        partir de las notas proporcionadas. No constituye un diagnóstico ni
        sustituye el juicio clínico profesional. Toda hipótesis debe verificarse
        mediante evaluación directa.
      </footer>
    </div>
  );
}
