"use client";

/**
 * El espacio de trabajo: cabecera, raíl, la vista (Mapa o Blancos), el
 * Inspector y la Fuente. Sustituye a las cinco pestañas del informe.
 *
 * Disposición: el raíl a la izquierda (240 px, a iconos por debajo de 1440), la
 * vista en el centro, el Inspector a la derecha (380 px, con scroll propio) y
 * la Fuente como cajón abajo. Por debajo de 1024 px el Inspector pasa a cajón
 * inferior y aparece al seleccionar algo; en el móvil todo se apila.
 *
 * Nada de esto se imprime: lo que sale en papel es DocumentoImpreso, el mismo
 * texto que el Word y el portapapeles.
 */

import type { AnalisisFuncional } from "@/lib/types";
import { VISTAS_ESPACIO } from "@/lib/secciones";
import BloquePlan from "../informe/BloquePlan";
import { Plegable } from "../informe/primitivas";
import { PriorizacionEstimada } from "../informe/mantenimiento";
import type { EditarSeccion } from "../informe/PreguntasClinicas";
import { ProveedorEspacio, useEspacio } from "./contexto";
import Cabecera, { type AccionesExportar } from "./Cabecera";
import Rail from "./Rail";
import Inspector from "./Inspector";
import Fuente from "./Fuente";
import VistaMapa from "./VistaMapa";
import MenuElemento from "./MenuElemento";
import EvidenciaFlotante from "./EvidenciaFlotante";

export interface EspacioTrabajoProps {
  analisis: AnalisisFuncional;
  analisisConProsa: AnalisisFuncional;
  notaOriginal: string;
  referenciaCaso: string;
  onReferenciaCasoChange: (valor: string) => void;
  fecha: string;
  acciones: AccionesExportar;
  onEditarSeccion: EditarSeccion;
}

export default function EspacioTrabajo(props: EspacioTrabajoProps) {
  return (
    <ProveedorEspacio
      analisis={props.analisis}
      notaOriginal={props.notaOriginal}
      onEditar={(mutar) => props.onEditarSeccion("situaciones", mutar)}
    >
      <Contenido {...props} />
    </ProveedorEspacio>
  );
}

function Contenido({
  analisis,
  analisisConProsa,
  notaOriginal,
  referenciaCaso,
  onReferenciaCasoChange,
  fecha,
  acciones,
  onEditarSeccion,
}: EspacioTrabajoProps) {
  const { vista, elegirVista, seleccionado, seleccionar } = useEspacio();

  return (
    <div className="print:hidden">
      <Cabecera
        analisis={analisis}
        referenciaCaso={referenciaCaso}
        onReferenciaCasoChange={onReferenciaCasoChange}
        fecha={fecha}
        acciones={acciones}
        onEditarSeccion={onEditarSeccion}
      />

      <div className="flex min-h-[calc(100vh-8rem)] flex-col md:flex-row">
        <div className="hidden md:block">
          <div className="sticky top-0 h-[calc(100vh-2.5rem)]">
            <Rail analisis={analisis} analisisConProsa={analisisConProsa} onEditarSeccion={onEditarSeccion} />
          </div>
        </div>

        {/* En el móvil el raíl va apilado y plegado encima de la vista. */}
        <details className="border-b border-divider md:hidden">
          <summary className="cursor-pointer px-4 py-2 text-sm font-medium text-ink">Índice del caso</summary>
          <Rail analisis={analisis} analisisConProsa={analisisConProsa} onEditarSeccion={onEditarSeccion} apilado />
        </details>

        <div className="min-w-0 flex-1 px-4 pb-16 pt-3">
          <div role="tablist" aria-label="Vistas" className="mb-4 flex gap-1 border-b border-divider">
            {VISTAS_ESPACIO.map((v) => (
              <button
                key={v.id}
                type="button"
                role="tab"
                aria-selected={vista === v.id}
                onClick={() => elegirVista(v.id)}
                className={`-mb-px border-b-2 px-3 py-1.5 text-sm ${vista === v.id ? "border-accent font-medium text-ink" : "border-transparent text-ink-muted hover:text-ink"}`}
              >
                {v.titulo}
              </button>
            ))}
          </div>

          {vista === "mapa" ? (
            <VistaMapa
              analisis={analisis}
              analisisConProsa={analisisConProsa}
              referenciaCaso={referenciaCaso}
            />
          ) : (
            <div className="space-y-6">
              {/* La priorización estimada vivía en Formulación; es lo que
                  ordena los blancos, así que se lee encima de ellos. */}
              <section id="prioridades" className="scroll-mt-4">
                <Plegable titulo="Priorización de blancos, criterio a criterio">
                  <PriorizacionEstimada analisis={analisis} />
                </Plegable>
              </section>
              <BloquePlan visible analisis={analisis} onEditarSeccion={onEditarSeccion} />
            </div>
          )}
        </div>

        {/* Inspector fijo desde 1024 px. */}
        <div className="hidden w-[380px] shrink-0 border-l border-divider bg-canvas lg:block">
          <div className="sticky top-0 h-[calc(100vh-2.5rem)]">
            <Inspector analisis={analisis} analisisConProsa={analisisConProsa} onEditarSeccion={onEditarSeccion} />
          </div>
        </div>
      </div>

      {/* Por debajo de 1024 px: cajón inferior que aparece al seleccionar. */}
      {seleccionado && (
        <div className="fixed inset-x-0 bottom-10 z-40 max-h-[60vh] rounded-t-2xl border-t border-divider bg-canvas shadow-xl lg:hidden">
          <Inspector
            analisis={analisis}
            analisisConProsa={analisisConProsa}
            onEditarSeccion={onEditarSeccion}
            onCerrar={() => seleccionar(null)}
          />
        </div>
      )}

      <Fuente analisis={analisis} notaOriginal={notaOriginal} />
      <MenuElemento analisis={analisis} onEditarSeccion={onEditarSeccion} />
      <EvidenciaFlotante analisis={analisis} />
    </div>
  );
}
