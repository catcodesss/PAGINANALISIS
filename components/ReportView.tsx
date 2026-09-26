"use client";

import { useMemo, useState } from "react";
import type {
  AnalisisFuncional,
  MetaGeneracion,
} from "@/lib/types";
import {
  ProveedorEdicion,
} from "./edicionManual";
import {
  SECCIONES_INFORME,
  type IdSeccion,
} from "@/lib/secciones";
import { NIVELES_APOYO } from "@/lib/gradoApoyo";
import FranjaDocumento from "./FranjaDocumento";
import { useLente } from "./useLente";
import {
  BarraPestanas,
  irAlAncla,
  PestanasContext,
  usePestanas,
} from "./informe/pestanas";
import { hayGrafoBase } from "@/lib/grafo";
import type { EstiloGrafo } from "@/lib/preferencias";
import {
  bloqueVisible,
  ReanalisisContext,
} from "./informe/seccion";
import BloqueSintesis from "./informe/BloqueSintesis";
import BloqueAnalisisFuncional from "./informe/BloqueAnalisisFuncional";
import BloqueMantenimiento from "./informe/BloqueMantenimiento";
import BloquePlan from "./informe/BloquePlan";
import BloquePendientes from "./informe/BloquePendientes";
import { derivarVistasProsa } from "@/lib/formatearInforme";

interface ReportViewProps {
  analisis: AnalisisFuncional;
  referenciaCaso: string;
  onReferenciaCasoChange: (valor: string) => void;
  fecha: string;
  notaOriginal: string;
  onAnalisisActualizado: (fragmento: Partial<AnalisisFuncional>) => void;
  /**
   * Edición manual: recibe una función que muta una copia del análisis. La
   * página es la dueña del estado y quien decide revalidar (ver
   * lib/validadores.ts#revalidarTrasEdicion).
   */
  onEditarSeccion: (seccionId: string, mutar: (copia: AnalisisFuncional) => void) => void;
}

interface SeccionIndice {
  id: IdSeccion;
  titulo: string;
}

const ETIQUETA_ESTILO: Record<EstiloGrafo, string> = {
  afc: "AFC",
  dbt: "DBT",
  act: "ACT",
  mc: "Conductual (MC)",
};

/**
 * El índice sale de lib/secciones.ts, que es la única lista: así el orden del
 * índice, el del informe exportado y el nombre de cada bloque no pueden
 * separarse. Antes eran cuatro listas sueltas y nada las comparaba.
 */
const SECCIONES: readonly SeccionIndice[] = SECCIONES_INFORME;


const ESTILOS_GRAFO: EstiloGrafo[] = ["afc", "dbt", "act", "mc"];

/**
 * El selector de lente: UNO, arriba del informe.
 *
 * Antes eran los mismos botones repetidos en cada sección que tenía algo que
 * enseñar por modelo. Repetir el mando no daba más control: daba más ocasiones
 * de leer una situación en ACT y la de al lado en DBT sin darse cuenta. El
 * terapeuta trabaja con un modelo por paciente, lo elige una vez y el documento
 * entero se adapta.
 *
 * No se imprime. En papel no hay nada que pulsar, y el documento exportado
 * lista todas las capas generadas en vez de una.
 */
function SelectorDeLente({
  activa,
  onChange,
  habilitaLecturas,
}: {
  activa: EstiloGrafo;
  onChange: (m: EstiloGrafo) => void;
  habilitaLecturas: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 print:hidden">
      <p
        id="etiqueta-lente"
        className="font-mono text-[10px] uppercase tracking-wide text-ink-muted"
      >
        Estilo del grafo
      </p>
      {/* role=group con su etiqueta: sin esto, un lector de pantalla anuncia
          tres botones sueltos sin decir de qué son las opciones. */}
      <div
        role="group"
        aria-labelledby="etiqueta-lente"
        className="flex overflow-hidden rounded border border-divider"
      >
        {ESTILOS_GRAFO.map((m) => {
          const deshabilitada = m !== "afc" && !habilitaLecturas;
          return (
          <button
            key={m}
            type="button"
            disabled={deshabilitada}
            onClick={() => onChange(m)}
            aria-pressed={activa === m}
            title={deshabilitada ? "Añade una relación que toque una conducta para habilitar esta lectura" : undefined}
            className={`px-4 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 disabled:cursor-not-allowed disabled:opacity-40 ${
              activa === m
                ? "bg-accent texto-sobre-acento"
                : "bg-surface text-ink-muted hover:bg-canvas"
            }`}
          >
            {ETIQUETA_ESTILO[m]}
          </button>
          );
        })}
      </div>
      <p className="text-xs text-ink-muted">
        Las cuatro vistas leen las mismas entidades y relaciones. La preferencia
        se recuerda por caso; la exportación siempre usa AFC.
      </p>
    </div>
  );
}

/** Encabezado de expediente clínico, visible solo al imprimir/exportar a PDF. */
function PrintOnlyHeader({
  referenciaCaso,
  fecha,
  meta,
}: {
  referenciaCaso: string;
  fecha: string;
  meta: MetaGeneracion;
}) {
  return (
    <div className="print-only-header hidden print:block">
      <div className="print-header-top">
        <div className="print-logo-area">
          <span className="print-logo-text">ACIA</span>
          <span className="print-logo-sub">análisis conductual asistido por IA</span>
        </div>
        <div className="print-doc-type">EXPEDIENTE · ANÁLISIS FUNCIONAL</div>
      </div>
      <div className="print-separator" />
      <div className="print-meta-grid">
        <div className="print-meta-item">
          <span className="print-meta-label">Referencia del caso</span>
          <span className="print-meta-value">
            {referenciaCaso.trim() || "Sin referencia"}
          </span>
        </div>
        <div className="print-meta-item">
          <span className="print-meta-label">Fecha de generación</span>
          <span className="print-meta-value">{fecha}</span>
        </div>
        <div className="print-meta-item">
          <span className="print-meta-label">Modalidades incluidas</span>
          <span className="print-meta-value">ACT · DBT · Conductual</span>
        </div>
        <div className="print-meta-item">
          <span className="print-meta-label">Páginas</span>
          <span className="print-meta-value">Ver pie de página</span>
        </div>
        <div className="print-meta-item">
          <span className="print-meta-label">Generado con</span>
          <span className="print-meta-value">
            {meta.modelo || "—"} · prompt v{meta.version_prompt || "—"}
          </span>
        </div>
      </div>
      <div className="print-separator" />
      <div className="print-confidential">
        DOCUMENTO CONFIDENCIAL — Solo para uso del profesional tratante
      </div>
    </div>
  );
}

/** Pie de página fijo, visible solo al imprimir/exportar a PDF. */
function PrintOnlyFooter() {
  return (
    <div className="print-only-footer hidden print:flex">
      <div className="print-footer-left">ACIA — análisis conductual asistido por IA</div>
      <div className="print-footer-center">
        Documento confidencial · Solo para uso clínico
      </div>
      <div className="print-footer-right" />
    </div>
  );
}

/** Descargo metodológico final, visible solo al imprimir/exportar a PDF. */
function PrintOnlyDisclaimer({
  fecha,
  meta,
}: {
  fecha: string;
  meta: MetaGeneracion;
}) {
  return (
    <div className="print-only-disclaimer hidden print:block">
      <div className="print-disclaimer-title">Nota metodológica</div>
      <p>
        Este análisis funcional fue generado mediante síntesis asistida por
        inteligencia artificial a partir de las notas clínicas proporcionadas
        por el profesional. Todas las hipótesis funcionales, clasificaciones y
        líneas de intervención sugeridas constituyen aproximaciones que
        requieren verificación mediante evaluación clínica directa.
      </p>
      <p>
        Este documento no constituye un diagnóstico, no sustituye el juicio
        clínico profesional, y no debe utilizarse como único fundamento para
        decisiones terapéuticas. El profesional tratante es el único
        responsable de la interpretación y aplicación de la información
        contenida en este expediente.
      </p>
      <p className="print-disclaimer-tool">
        Generado con ACIA — análisis conductual asistido por IA · {fecha}
        {meta.modelo ? ` · ${meta.modelo} · prompt v${meta.version_prompt}` : ""}
      </p>
    </div>
  );
}

/**
 * Leyenda flotante del grado de apoyo. Arranca plegada: es un recordatorio que
 * se abre cuando hace falta, no un panel que tape el informe mientras se lee.
 * La definición completa vive en la pestaña Revisión.
 */
function LeyendaApoyoFlotante() {
  const [abierta, setAbierta] = useState(false);
  const pestanas = usePestanas();

  return (
    <div className="fixed bottom-4 right-4 z-30 print:hidden">
      {abierta ? (
        <div className="w-64 rounded-md border border-divider bg-surface p-4 shadow-lg">
          <div className="mb-2 flex items-center justify-between">
            <p className="font-mono text-[10px] uppercase tracking-wide text-ink-muted">
              Grado de apoyo en la nota
            </p>
            <button
              type="button"
              onClick={() => setAbierta(false)}
              aria-label="Cerrar la leyenda del grado de apoyo"
              className="rounded p-1 text-ink-muted transition-colors hover:bg-canvas hover:text-ink"
            >
              ✕
            </button>
          </div>
          <ul className="space-y-1.5">
            {NIVELES_APOYO.map(({ grado, etiqueta, clase, corta }) => (
              <li key={grado} className="flex items-baseline gap-2">
                <span
                  aria-hidden="true"
                  className={`h-2 w-2 shrink-0 translate-y-[-1px] rounded-full ${clase}`}
                />
                <p className="text-xs leading-relaxed text-ink-muted">
                  <span className="font-semibold text-ink">{etiqueta}: </span>
                  {corta}
                </p>
              </li>
            ))}
          </ul>
          <div className="mt-3 border-t border-divider pt-2">
            <a
              href="#niveles-confianza"
              onClick={(evento) => {
                evento.preventDefault();
                irAlAncla(pestanas, "niveles-confianza");
              }}
              className="text-xs text-accent transition-colors hover:underline"
            >
              Ver definición completa →
            </a>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAbierta(true)}
          aria-label="Mostrar la leyenda del grado de apoyo"
          title="Grado de apoyo en la nota"
          className="flex h-10 w-10 items-center justify-center rounded-full border border-divider bg-surface text-accent shadow-lg transition-colors hover:bg-canvas"
        >
          <span aria-hidden="true" className="font-serif text-base font-semibold">
            i
          </span>
        </button>
      )}
    </div>
  );
}

export default function ReportView({
  analisis,
  referenciaCaso,
  onReferenciaCasoChange,
  fecha,
  notaOriginal,
  onAnalisisActualizado,
  onEditarSeccion,
}: ReportViewProps) {
  // En un análisis parcial, una pestaña sin nada que enseñar no aparece.
  const seccionesVisibles = useMemo(
    () => SECCIONES.filter((s) => bloqueVisible(analisis, s.id)),
    [analisis]
  );
  const [pestanaElegida, setPestanaElegida] = useState<IdSeccion>("sintesis");
  // Si la elegida deja de existir (un reanálisis parcial), se cae en la primera.
  const pestana = seccionesVisibles.some((s) => s.id === pestanaElegida)
    ? pestanaElegida
    : (seccionesVisibles[0]?.id ?? "sintesis");
  const valorPestanas = useMemo(
    () => ({ activa: pestana, elegir: setPestanaElegida }),
    [pestana]
  );

  /*
    La lente vive en localStorage y no en el estado del componente: es una
    preferencia de lectura del terapeuta, no del informe. useLente ya la acota a
    las capas que este análisis generó, así que una preferencia guardada que
    aquí no exista cae en la primera disponible sin pasar por un fotograma con
    la pestaña que no está.
  */
  const grafoBaseDisponible = hayGrafoBase(analisis);
  const estilosDisponibles = grafoBaseDisponible ? ESTILOS_GRAFO : ["afc" as const];
  const { lente: pestanaActiva, elegirLente } = useLente(
    estilosDisponibles as EstiloGrafo[],
    referenciaCaso
  );

  const prosaDerivada = useMemo(() => derivarVistasProsa(analisis), [analisis]);
  const hipotesisDestacada = prosaDerivada.destacada;
  const analisisConProsa = useMemo(
    () => ({
      ...analisis,
      resumen_clinico: prosaDerivada.resumen,
      hipotesis_mantenimiento: prosaDerivada.hipotesis,
    }),
    [analisis, prosaDerivada]
  );

  const valorEdicion = useMemo(
    () => ({ seccionesEditadas: analisis.secciones_editadas }),
    [analisis.secciones_editadas]
  );

  return (
    <ReanalisisContext.Provider
      value={{ notaOriginal, analisis, onAnalisisActualizado }}
    >
    <PestanasContext.Provider value={valorPestanas}>
    <ProveedorEdicion valor={valorEdicion}>
    <div className="rounded-md border border-divider bg-surface px-5 py-6 shadow-sm sm:px-8 sm:py-8 lg:px-12 lg:py-10 print:rounded-none print:border-none print:px-0 print:py-0 print:shadow-none">
      <PrintOnlyHeader referenciaCaso={referenciaCaso} fecha={fecha} meta={analisis.meta} />
      <PrintOnlyFooter />

      {/* Va dentro del informe y no en la página que lo envuelve para que
          acompañe a todo informe, sea el real o el de ejemplo, sin depender de
          que quien monte una pantalla nueva se acuerde de ponerlo. Los
          márgenes negativos lo sacan del acolchado de la tarjeta: la franja
          llega de borde a borde, como la de ejemplo. */}
      <div className="-mx-5 -mt-6 mb-6 sm:-mx-8 sm:-mt-8 lg:-mx-12 lg:-mt-10 print:mx-0 print:mt-0">
        <FranjaDocumento rotulo="ACIA — documento generado con IA">
          Documento de apoyo a la formulación clínica, generado con asistencia
          de IA a partir de la información registrada por el profesional. No
          constituye un diagnóstico ni sustituye el juicio clínico: requiere
          validación profesional antes de cualquier uso terapéutico.
        </FranjaDocumento>
      </div>

      <header className="mb-6 border-b border-divider pb-5 print:hidden">
        <p className="font-mono text-xs uppercase tracking-[0.15em] text-accent">
          Expediente · Análisis funcional
        </p>
        <h1 className="mt-1 font-serif text-2xl font-semibold text-ink sm:text-3xl">
          ACIA — análisis conductual asistido por IA
        </h1>
        <div className="mt-4 flex flex-wrap items-center gap-x-8 gap-y-3 text-sm text-ink-muted">
          <p>
            Fecha de generación: <span className="text-ink">{fecha}</span>
          </p>
          {analisis.meta.modelo && (
            <p className="print:hidden">
              Generado con:{" "}
              <span className="text-ink">
                {analisis.meta.modelo} · prompt v{analisis.meta.version_prompt}
              </span>
            </p>
          )}
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

      <BarraPestanas pestanas={seccionesVisibles} />

      <div className="min-w-0">
          <BloqueSintesis
            visible={bloqueVisible(analisis, "sintesis")}
            analisis={analisis}
            destacada={hipotesisDestacada}
            resumen={prosaDerivada.resumen}
            onEditarSeccion={onEditarSeccion}
          />

          <BloqueAnalisisFuncional
            visible={bloqueVisible(analisis, "que-pasa")}
            analisis={analisis}
            notaOriginal={notaOriginal}
            estilo={pestanaActiva}
            selectorEstilo={
              <SelectorDeLente
                activa={pestanaActiva}
                onChange={elegirLente}
                habilitaLecturas={grafoBaseDisponible}
              />
            }
            onEditarSeccion={onEditarSeccion}
          />

          <BloqueMantenimiento
            visible={bloqueVisible(analisis, "mantenimiento")}
            analisis={analisis}
            analisisConProsa={analisisConProsa}
            hipotesis={prosaDerivada.hipotesis}
            onEditarSeccion={onEditarSeccion}
          />

          <BloquePlan
            visible={bloqueVisible(analisis, "plan")}
            analisis={analisis}
            onEditarSeccion={onEditarSeccion}
          />

          <BloquePendientes
            visible={bloqueVisible(analisis, "pendientes")}
            analisis={analisis}
            onEditarSeccion={onEditarSeccion}
          />
      </div>

      <footer className="mt-6 rounded-md border border-divider bg-canvas p-4 text-xs leading-relaxed text-ink-muted print:hidden">
        Este análisis es una síntesis asistida de hipótesis funcionales generadas a
        partir de las notas proporcionadas. No constituye un diagnóstico ni
        sustituye el juicio clínico profesional. Toda hipótesis debe verificarse
        mediante evaluación directa.
      </footer>

      <PrintOnlyDisclaimer fecha={fecha} meta={analisis.meta} />
      <LeyendaApoyoFlotante />
    </div>
    </ProveedorEdicion>
    </PestanasContext.Provider>
    </ReanalisisContext.Provider>
  );
}
