"use client";

import { useMemo } from "react";
import type { AnalisisFuncional, MetaGeneracion } from "@/lib/types";
import { ProveedorEdicion } from "./edicionManual";
import { ReanalisisContext } from "./informe/seccion";
import { derivarVistasProsa } from "@/lib/formatearInforme";
import EspacioTrabajo from "./espacio/EspacioTrabajo";
import DocumentoImpreso from "./espacio/DocumentoImpreso";
import type { AccionesExportar } from "./espacio/Cabecera";

/**
 * El informe. Desde la fase 5 no es un documento con pestañas sino un espacio
 * de trabajo (components/espacio/): Mapa y Blancos, con cabecera, raíl,
 * Inspector y la nota en un cajón. Aquí quedan los proveedores que comparte
 * todo (reanálisis por sección y edición manual) y lo que solo existe en
 * papel: el encabezado, el pie, el descargo y el documento impreso, que sale
 * del mismo texto que «Copiar» y el Word.
 */

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
   * lib/validadores.ts#revalidarTrasEdicion). `seccionId` null: el cambio no
   * es texto escrito a mano (p. ej. el estado de un blanco) y no marca ninguna
   * sección como editada.
   */
  onEditarSeccion: (seccionId: string | null, mutar: (copia: AnalisisFuncional) => void) => void;
  /** Copiar, Word e imprimir: los ofrece la cabecera en «Exportar ▾». */
  acciones: AccionesExportar;
  /** El informe de /maqueta: el documento impreso lleva el aviso de ejemplo. */
  esEjemplo?: boolean;
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
          <span className="print-meta-value">AFC · ACT · DBT</span>
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

export default function ReportView({
  analisis,
  referenciaCaso,
  onReferenciaCasoChange,
  fecha,
  notaOriginal,
  onAnalisisActualizado,
  onEditarSeccion,
  acciones,
  esEjemplo = false,
}: ReportViewProps) {
  const prosaDerivada = useMemo(() => derivarVistasProsa(analisis), [analisis]);
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
    <ReanalisisContext.Provider value={{ notaOriginal, analisis, onAnalisisActualizado }}>
      <ProveedorEdicion valor={valorEdicion}>
        <div className="rounded-md border border-divider bg-surface shadow-sm print:rounded-none print:border-none print:shadow-none">
          <PrintOnlyHeader referenciaCaso={referenciaCaso} fecha={fecha} meta={analisis.meta} />
          <PrintOnlyFooter />

          <EspacioTrabajo
            analisis={analisis}
            analisisConProsa={analisisConProsa}
            notaOriginal={notaOriginal}
            referenciaCaso={referenciaCaso}
            onReferenciaCasoChange={onReferenciaCasoChange}
            fecha={fecha}
            acciones={acciones}
            onEditarSeccion={onEditarSeccion}
          />

          <DocumentoImpreso
            analisis={analisis}
            referenciaCaso={referenciaCaso}
            fecha={fecha}
            esEjemplo={esEjemplo}
          />

          <footer className="m-4 rounded-md border border-divider bg-canvas p-4 text-xs leading-relaxed text-ink-muted print:hidden">
            Este análisis es una síntesis asistida de hipótesis funcionales generadas a
            partir de las notas proporcionadas. No constituye un diagnóstico ni
            sustituye el juicio clínico profesional. Toda hipótesis debe verificarse
            mediante evaluación directa.
          </footer>

          <PrintOnlyDisclaimer fecha={fecha} meta={analisis.meta} />
        </div>
      </ProveedorEdicion>
    </ReanalisisContext.Provider>
  );
}
