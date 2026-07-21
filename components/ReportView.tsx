import type { ReactNode } from "react";
import type { AnalisisFuncional } from "@/lib/types";

interface ReportViewProps {
  analisis: AnalisisFuncional;
  referenciaCaso: string;
  onReferenciaCasoChange: (valor: string) => void;
  fecha: string;
}

function SinHallazgos() {
  return (
    <p className="text-sm text-ink-muted">Sin hallazgos suficientes en la nota.</p>
  );
}

function Etiqueta({ children }: { children: ReactNode }) {
  return (
    <span className="inline-block whitespace-nowrap rounded border border-divider px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide text-ink-muted">
      {children}
    </span>
  );
}

function Cita({ children }: { children: string }) {
  if (!children) return null;
  return <p className="mt-1 text-sm italic text-ink-muted">&quot;{children}&quot;</p>;
}

function Confianza({ nivel }: { nivel: string }) {
  return (
    <span className="font-mono text-[11px] uppercase tracking-wide text-ink-muted">
      Confianza: {nivel}
    </span>
  );
}

function Seccion({
  etiqueta,
  titulo,
  extra,
  children,
}: {
  etiqueta: string;
  titulo: string;
  extra?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="relative border-b border-divider py-6 pl-9 last:border-b-0 sm:pl-11">
      <span
        aria-hidden="true"
        className="absolute left-0 top-6 bottom-6 w-[3px] rounded-full bg-accent"
      />
      <span
        aria-hidden="true"
        className="absolute left-[10px] top-6 font-mono text-[10px] uppercase tracking-[0.15em] text-accent sm:left-3"
        style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
      >
        {etiqueta}
      </span>
      <div className="min-w-0">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h2 className="font-serif text-lg font-semibold text-ink sm:text-xl">
            {titulo}
          </h2>
          {extra}
        </div>
        {children}
      </div>
    </section>
  );
}

function tipoOperacion(tipo: string): string {
  if (tipo === "establecedora") return "OE";
  if (tipo === "abolidora") return "OA";
  return tipo;
}

export default function ReportView({
  analisis,
  referenciaCaso,
  onReferenciaCasoChange,
  fecha,
}: ReportViewProps) {
  return (
    <div className="rounded-md border border-divider bg-surface px-5 py-6 shadow-sm sm:px-8 sm:py-8 print:rounded-none print:border-none print:px-0 print:py-0 print:shadow-none">
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
      </header>

      <Seccion etiqueta="RESUMEN" titulo="Resumen clínico">
        {analisis.resumen_clinico ? (
          <p className="text-[15px] leading-relaxed text-ink">
            {analisis.resumen_clinico}
          </p>
        ) : (
          <SinHallazgos />
        )}
      </Seccion>

      <Seccion etiqueta="CONDUCTAS" titulo="Conductas problema">
        {analisis.conductas_problema.length === 0 ? (
          <SinHallazgos />
        ) : (
          <ul className="space-y-4">
            {analisis.conductas_problema.map((c, i) => (
              <li key={i}>
                <Etiqueta>{c.tipo}</Etiqueta>
                <p className="mt-1 text-[15px] leading-relaxed text-ink">
                  {c.descripcion}
                </p>
                <Cita>{c.evidencia}</Cita>
              </li>
            ))}
          </ul>
        )}
      </Seccion>

      <Seccion
        etiqueta="ANTECEDENTES · Ed"
        titulo="Análisis de antecedentes"
        extra={<Confianza nivel={analisis.antecedentes.confianza} />}
      >
        <div className="space-y-5">
          <div>
            <h3 className="mb-2 font-mono text-xs uppercase tracking-wide text-ink-muted">
              Estímulos discriminativos
            </h3>
            {analisis.antecedentes.estimulos_discriminativos.length === 0 ? (
              <SinHallazgos />
            ) : (
              <ul className="space-y-3">
                {analisis.antecedentes.estimulos_discriminativos.map((e, i) => (
                  <li key={i}>
                    <p className="text-[15px] leading-relaxed text-ink">
                      {e.descripcion}
                    </p>
                    <Cita>{e.evidencia}</Cita>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <h3 className="mb-2 font-mono text-xs uppercase tracking-wide text-ink-muted">
              Contexto situacional
            </h3>
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
      </Seccion>

      <Seccion etiqueta="OPERACIONES · OE/OA" titulo="Operaciones motivacionales">
        {analisis.operaciones_motivacionales.length === 0 ? (
          <SinHallazgos />
        ) : (
          <ul className="space-y-4">
            {analisis.operaciones_motivacionales.map((o, i) => (
              <li key={i}>
                <Etiqueta>{tipoOperacion(o.tipo)}</Etiqueta>
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
      </Seccion>

      <Seccion
        etiqueta="CONSECUENCIAS"
        titulo="Consecuencias y contingencias de mantenimiento"
        extra={
          <Confianza nivel={analisis.consecuencias_y_mantenimiento.confianza} />
        }
      >
        {analisis.consecuencias_y_mantenimiento.contingencias.length === 0 ? (
          <SinHallazgos />
        ) : (
          <ul className="space-y-4">
            {analisis.consecuencias_y_mantenimiento.contingencias.map((c, i) => (
              <li key={i}>
                <div className="flex flex-wrap gap-2">
                  <Etiqueta>{c.tipo}</Etiqueta>
                  <Etiqueta>{c.inmediatez}</Etiqueta>
                </div>
                <p className="mt-1 text-[15px] leading-relaxed text-ink">
                  {c.descripcion}
                </p>
                <Cita>{c.evidencia}</Cita>
              </li>
            ))}
          </ul>
        )}
      </Seccion>

      <Seccion
        etiqueta="HIPÓTESIS · PRINCIPAL"
        titulo="Hipótesis funcional principal"
        extra={
          <Confianza nivel={analisis.hipotesis_funcional_principal.confianza} />
        }
      >
        {analisis.hipotesis_funcional_principal.enunciado ? (
          <div className="rounded-md border border-accent/30 bg-accent/5 p-4 sm:p-5">
            <p className="font-serif text-lg leading-relaxed text-ink sm:text-xl">
              {analisis.hipotesis_funcional_principal.enunciado}
            </p>
            {analisis.hipotesis_funcional_principal.funcion && (
              <p className="mt-3 font-mono text-xs uppercase tracking-wide text-accent">
                Función: {analisis.hipotesis_funcional_principal.funcion}
              </p>
            )}
          </div>
        ) : (
          <SinHallazgos />
        )}
      </Seccion>

      <Seccion etiqueta="ALTERNATIVAS" titulo="Hipótesis alternativas">
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

      <Seccion etiqueta="REGLAS · RFT" titulo="Reglas verbales">
        {analisis.reglas_verbales.length === 0 ? (
          <SinHallazgos />
        ) : (
          <ul className="space-y-4">
            {analisis.reglas_verbales.map((r, i) => (
              <li key={i}>
                <div className="flex flex-wrap items-center gap-2">
                  <Etiqueta>{r.clase}</Etiqueta>
                  <span className="font-mono text-[11px] uppercase tracking-wide text-ink-muted">
                    Rigidez: {r.rigidez}
                  </span>
                </div>
                <p className="mt-1 text-[15px] italic leading-relaxed text-ink">
                  &quot;{r.regla}&quot;
                </p>
                <p className="mt-1 text-sm text-ink-muted">{r.analisis}</p>
              </li>
            ))}
          </ul>
        )}
      </Seccion>

      <Seccion etiqueta="PROCESOS · ACT" titulo="Procesos ACT identificados">
        {analisis.procesos_act.length === 0 ? (
          <SinHallazgos />
        ) : (
          <ul className="space-y-4">
            {analisis.procesos_act.map((p, i) => (
              <li key={i}>
                <Etiqueta>{p.proceso}</Etiqueta>
                <p className="mt-1 text-[15px] leading-relaxed text-ink">
                  {p.descripcion}
                </p>
                <Cita>{p.evidencia}</Cita>
              </li>
            ))}
          </ul>
        )}
      </Seccion>

      <Seccion etiqueta="PREGUNTAS" titulo="Preguntas para la próxima sesión">
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

      <Seccion etiqueta="INTERVENCIÓN" titulo="Líneas de intervención tentativas">
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

      <Seccion etiqueta="DATOS FALTANTES" titulo="Datos faltantes">
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

      <footer className="mt-6 rounded-md border border-divider bg-canvas p-4 text-xs leading-relaxed text-ink-muted print:bg-transparent">
        Este análisis es una síntesis asistida de hipótesis funcionales generadas a
        partir de las notas proporcionadas. No constituye un diagnóstico ni
        sustituye el juicio clínico profesional. Toda hipótesis debe verificarse
        mediante evaluación directa.
      </footer>
    </div>
  );
}
