"use client";

/**
 * Bloque 2 · Análisis funcional.
 *
 * Aquí se fundieron las cuatro representaciones que antes contaban lo mismo por
 * separado —repertorio conductual, rejilla de variables, análisis por
 * situaciones y detalle por modelo terapéutico— en un solo grafo. Los ids de
 * aquellas secciones siguen existiendo como anclas vacías: un enlace guardado a
 * #conductas tiene que seguir llevando a donde ahora se ve esa información.
 */

import type { ReactNode } from "react";
import type { AnalisisFuncional } from "@/lib/types";
import type { EstiloGrafo } from "@/lib/preferencias";
import GrafoAFC from "../grafo/GrafoAFC";
import { SinHallazgos } from "./primitivas";
import { BloqueBase } from "./primitivas";
import { Seccion } from "./seccion";

export default function BloqueAnalisisFuncional({
  visible,
  analisis,
  notaOriginal,
  estilo,
  selectorEstilo,
  onEditarSeccion,
}: {
  visible: boolean;
  analisis: AnalisisFuncional;
  notaOriginal: string;
  estilo: EstiloGrafo;
  /** Las vistas AFC / DBT / ACT / conductual: solo tienen sentido aquí. */
  selectorEstilo: ReactNode;
  onEditarSeccion: (
    seccionId: string,
    mutar: (copia: AnalisisFuncional) => void
  ) => void;
}) {
  return (
    <BloqueBase id="que-pasa" visible={visible}>
      <Seccion
        id="situaciones"
        titulo="Situaciones y grafo"
        camposReanalisis={[
          "conductas_problema",
          "repertorio_disponible",
          "variables_moduladoras",
          "situaciones",
          "conductas_alternativas",
          "acomodacion_entorno",
          "capa_act",
          "capa_dbt",
        ]}
      >
        {/* Las anclas históricas siguen funcionando aunque las cuatro
            representaciones duplicadas se hayan fundido en un grafo. */}
        <span id="conductas" className="scroll-mt-24" />
        <span id="variables-moduladoras" className="scroll-mt-24" />
        <span id="modalidad" className="scroll-mt-24" />
        <div className="mb-5">{selectorEstilo}</div>
        {analisis.situaciones.length === 0 ? (
          <SinHallazgos />
        ) : (
          <GrafoAFC
            analisis={analisis}
            notaOriginal={notaOriginal}
            estilo={estilo}
            onEditar={(mutar) => onEditarSeccion("situaciones", mutar)}
          />
        )}
      </Seccion>
    </BloqueBase>
  );
}
