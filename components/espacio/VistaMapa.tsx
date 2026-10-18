"use client";

/**
 * Vista Mapa: el grafo del análisis funcional y, plegada debajo, la vista
 * general del caso (la red funcional, que hace de nivel Caso hasta la fase 10).
 *
 * Por ahora conserva las tres lecturas del grafo (AFC, DBT, ACT) con un único
 * selector; la 5B las convierte en niveles y capas. La lectura se guarda por
 * caso (components/useLente.ts): es una preferencia del terapeuta, no del
 * informe.
 *
 * Las anclas de los apartados que el grafo fundió (#conductas,
 * #variables-moduladoras, #modalidad, #situaciones) siguen aquí: un enlace o
 * un aviso que los nombre tiene que seguir llevando a donde se ve esa
 * información.
 */

import type { AnalisisFuncional } from "@/lib/types";
import type { EstiloGrafo } from "@/lib/preferencias";
import { construirNodosGrafo, hayGrafoBase } from "@/lib/grafo";
import { destinoDeAlerta } from "@/lib/destinoAlerta";
import { INTRO_GRADO_APOYO, NIVELES_APOYO, NOTA_PIE_GRADO_APOYO, traducirMensajeAlerta } from "@/lib/gradoApoyo";
import { InsigniaAlerta } from "../grafo/InsigniaAlerta";
import { estadoVacio } from "@/lib/vacios";
import GrafoAFC from "../grafo/GrafoAFC";
import { useLente } from "../useLente";
import { Plegable, SinHallazgos } from "../informe/primitivas";
import { RedFuncionalSVG } from "../informe/mantenimiento";
import { useAccionesSeccion } from "../informe/seccion";
import type { EditarSeccion } from "../informe/PreguntasClinicas";

const ESTILOS_GRAFO: EstiloGrafo[] = ["afc", "dbt", "act"];
const ETIQUETA_ESTILO: Record<EstiloGrafo, string> = { afc: "AFC", dbt: "DBT", act: "ACT" };

export default function VistaMapa({
  analisis,
  analisisConProsa,
  notaOriginal,
  referenciaCaso,
  onEditarSeccion,
}: {
  analisis: AnalisisFuncional;
  analisisConProsa: AnalisisFuncional;
  notaOriginal: string;
  referenciaCaso: string;
  onEditarSeccion: EditarSeccion;
}) {
  const grafoBase = hayGrafoBase(analisis);
  const disponibles = grafoBase ? ESTILOS_GRAFO : (["afc"] as EstiloGrafo[]);
  const { lente, elegirLente } = useLente(disponibles, referenciaCaso);
  const acciones = useAccionesSeccion("situaciones", "Situaciones y grafo", [
    "conductas_problema",
    "repertorio_disponible",
    "variables_moduladoras",
    "reglas_verbales",
    "situaciones",
    "conductas_alternativas",
    "acomodacion_entorno",
    "capa_act",
    "capa_dbt",
  ]);

  return (
    <section id="situaciones" aria-label="Mapa" className="scroll-mt-4">
      <span id="conductas" className="scroll-mt-24" />
      <span id="variables-moduladoras" className="scroll-mt-24" />
      <span id="modalidad" className="scroll-mt-24" />

      <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2">
        <SelectorDeLente activa={lente} onChange={elegirLente} habilitaLecturas={grafoBase} />
        <LeyendaApoyo />
        <span className="ml-auto">{acciones.menu}</span>
      </div>
      {acciones.panel}

      <AvisosSinNodo analisis={analisis} />

      {analisis.situaciones.length === 0 ? (
        <SinHallazgos estado={estadoVacio(analisis, "situaciones")} />
      ) : (
        <GrafoAFC
          analisis={analisis}
          notaOriginal={notaOriginal}
          estilo={lente}
          onDecidir={(mutar) => onEditarSeccion(null, mutar)}
        />
      )}

      <div className="mt-8">
        <Plegable titulo="Vista general del caso">
          <RedFuncionalSVG analisis={analisisConProsa} />
        </Plegable>
      </div>
    </section>
  );
}

/**
 * Avisos sobre algo del Mapa que no tiene nodo propio: una habilidad DBT cuyo
 * eslabón no se resolvió, o una situación entera. Sin esta franja solo se
 * verían en la bandeja, y moverlos de pestaña no puede esconderlos.
 */
function AvisosSinNodo({ analisis }: { analisis: AnalisisFuncional }) {
  const ids = new Set(construirNodosGrafo(analisis).map((n) => n.id));
  const sueltos = analisis.alertas.filter((a) => {
    const destino = destinoDeAlerta(analisis, a);
    return destino?.vista === "mapa" && (destino.id === null || (!ids.has(destino.id) && analisis.situaciones.some((s) => s.id === destino.id)));
  });
  if (sueltos.length === 0) return null;
  return (
    <section aria-label="Avisos sin nodo" className="mb-4 rounded border border-divider p-3">
      <p className="mb-2 font-mono text-[10px] uppercase tracking-wide text-ink-muted">Avisos sin nodo en el grafo</p>
      <ul className="space-y-2">
        {sueltos.map((a, i) => (
          <li key={i} className="text-sm leading-relaxed text-ink">
            <InsigniaAlerta alertas={[a]} className="mr-2" />
            {traducirMensajeAlerta(a.mensaje)}
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * El selector de lectura: UNO, arriba del Mapa. Repetirlo por sección daba
 * ocasiones de leer una situación en ACT y la de al lado en DBT sin darse
 * cuenta. No se imprime: el documento lista todas las capas generadas.
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
    <div className="flex items-center gap-2 print:hidden">
      <p id="etiqueta-lente" className="font-mono text-[10px] uppercase tracking-wide text-ink-muted">
        Lectura
      </p>
      <div role="group" aria-labelledby="etiqueta-lente" className="flex overflow-hidden rounded border border-divider">
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
              className={`px-3 py-1 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${activa === m ? "bg-accent texto-sobre-acento" : "bg-surface text-ink-muted hover:bg-canvas"}`}
            >
              {ETIQUETA_ESTILO[m]}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * La leyenda del grado de apoyo, como popover en la barra del Mapa. Antes era
 * una tarjeta en la pestaña Revisión y un botón flotante que llevaba a ella.
 */
function LeyendaApoyo() {
  return (
    <details id="niveles-confianza" className="relative print:hidden">
      <summary className="cursor-pointer list-none rounded border border-divider px-2.5 py-1 text-xs text-ink-muted hover:text-ink">
        Grado de apoyo ⓘ
      </summary>
      <div className="absolute left-0 z-40 mt-1 w-96 rounded-md border border-divider bg-surface p-4 shadow-lg">
        <p className="text-sm leading-relaxed text-ink-muted">{INTRO_GRADO_APOYO}</p>
        <ul className="mt-3 space-y-2">
          {NIVELES_APOYO.map(({ grado, etiqueta, clase, frase, resto }) => (
            <li key={grado} className="flex items-baseline gap-2 text-sm leading-relaxed">
              <span aria-hidden="true" className={`h-2 w-2 shrink-0 translate-y-[-1px] rounded-full ${clase}`} />
              <span className="text-ink-muted">
                <span className="font-semibold text-ink">{etiqueta}.</span> {frase} {resto}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-3 border-t border-divider pt-2 text-xs leading-relaxed text-ink-muted">{NOTA_PIE_GRADO_APOYO}</p>
      </div>
    </details>
  );
}
