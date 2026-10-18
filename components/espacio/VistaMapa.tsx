"use client";

/**
 * Vista Mapa: el grafo del análisis funcional leído en tres niveles —Situación,
 * Clínico y Evidencia— con capas que se encienden encima (Plan, Huecos, DBT y
 * ACT). La Matrix ACT queda como vista alternativa de los mismos nodos, y la
 * red funcional, plegada debajo, hace de vista general del caso hasta que
 * exista el nivel Caso (fase 10).
 *
 * El nivel se recuerda por caso (components/useLente.ts). Las capas no: son
 * algo que se enciende para mirar una cosa y se apaga después. Cambiar de nivel
 * o de capa solo vuelve a pintar; no hace ninguna petición.
 *
 * Teclado: 1, 2 y 3 cambian de nivel; F abre o cierra la Fuente; las flechas
 * recorren las relaciones del elemento elegido; Esc deshace la selección.
 *
 * Las anclas de los apartados que el grafo fundió (#conductas,
 * #variables-moduladoras, #modalidad, #situaciones) siguen aquí: un enlace o un
 * aviso que los nombre tiene que seguir llevando a donde se ve esa información.
 */

import { useEffect, useMemo, useState } from "react";
import type { AnalisisFuncional } from "@/lib/types";
import { NIVELES_MAPA, type NivelMapa } from "@/lib/preferencias";
import { construirNodosGrafo, huecosDeSituacion } from "@/lib/grafo";
import { destinoDeAlerta } from "@/lib/destinoAlerta";
import { siguientePorTeclado } from "@/lib/rutaMapa";
import { calcularCoberturaNota, PALABRAS_MINIMAS_FRASE, recogerCitas } from "@/lib/coberturaNota";
import { citaCubreFrase, segmentarFrases } from "@/lib/citas";
import { estaAbierta } from "@/lib/preguntas";
import { INTRO_GRADO_APOYO, NIVELES_APOYO, NOTA_PIE_GRADO_APOYO, traducirMensajeAlerta } from "@/lib/gradoApoyo";
import { estadoVacio } from "@/lib/vacios";
import GrafoAFC from "../grafo/GrafoAFC";
import type { CapasMapa } from "../grafo/TableroSituacion";
import { InsigniaAlerta } from "../grafo/InsigniaAlerta";
import { useNivelMapa } from "../useLente";
import { Plegable, SinHallazgos } from "../informe/primitivas";
import { RedFuncionalSVG } from "../informe/mantenimiento";
import { useAccionesSeccion } from "../informe/seccion";
import { useEspacio } from "./contexto";

const ETIQUETA_NIVEL: Record<NivelMapa, string> = {
  situacion: "Situación",
  clinico: "Clínico",
  evidencia: "Evidencia",
};

export default function VistaMapa({
  analisis,
  analisisConProsa,
  notaOriginal,
  referenciaCaso,
}: {
  analisis: AnalisisFuncional;
  analisisConProsa: AnalisisFuncional;
  notaOriginal: string;
  referenciaCaso: string;
}) {
  const { nivel, elegirNivel } = useNivelMapa(referenciaCaso);
  const { seleccionado, seleccionar, fuenteAbierta, abrirFuente } = useEspacio();
  const [capas, setCapas] = useState<CapasMapa>({ plan: true, huecos: true, dbt: false, act: false });
  const [matrix, setMatrix] = useState(false);
  const [leerComoTexto, setLeerComoTexto] = useState(false);
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

  const contadores = useMemo(() => {
    const nodos = construirNodosGrafo(analisis);
    const ids = new Set(nodos.map((n) => n.id));
    const huecos = analisis.situaciones.reduce((t, s) => t + huecosDeSituacion(analisis, s, nodos).length, 0);
    const anclados = analisis.capa_act.procesos_act.filter((p) => p.nodo_id && ids.has(p.nodo_id)).length;
    return {
      plan: analisis.conductas_alternativas.length,
      huecos: huecos + analisis.preguntas.filter((p) => estaAbierta(p) && p.pone_a_prueba).length,
      dbt: analisis.situaciones.reduce((t, s) => t + (s.cadena_dbt?.eslabones.length ?? 0), 0),
      act: anclados,
      actSinAnclar: analisis.capa_act.procesos_act.length - anclados,
    };
  }, [analisis]);

  // Teclado del Mapa. Es un manejador de evento: no corrige estado de React.
  useEffect(() => {
    const alPulsar = (e: KeyboardEvent) => {
      const destino = e.target;
      if (destino instanceof Element && destino.closest("input, textarea, select, [contenteditable]")) return;
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      if (e.key === "1" || e.key === "2" || e.key === "3") {
        elegirNivel(NIVELES_MAPA[Number(e.key) - 1]);
      } else if (e.key === "f" || e.key === "F") {
        abrirFuente(!fuenteAbierta);
      } else if ((e.key === "ArrowRight" || e.key === "ArrowLeft") && seleccionado) {
        const siguiente = siguientePorTeclado(analisis, seleccionado, e.key);
        if (siguiente) {
          e.preventDefault();
          seleccionar(siguiente);
        }
      }
    };
    window.addEventListener("keydown", alPulsar);
    return () => window.removeEventListener("keydown", alPulsar);
  }, [analisis, seleccionado, seleccionar, elegirNivel, fuenteAbierta, abrirFuente]);

  const alternar = (capa: keyof CapasMapa) => setCapas((c) => ({ ...c, [capa]: !c[capa] }));

  return (
    <section id="situaciones" aria-label="Mapa" className="scroll-mt-4">
      <span id="conductas" className="scroll-mt-24" />
      <span id="variables-moduladoras" className="scroll-mt-24" />
      <span id="modalidad" className="scroll-mt-24" />

      <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-2">
        <div role="group" aria-label="Nivel del Mapa" className="flex overflow-hidden rounded border border-divider">
          {NIVELES_MAPA.map((n, i) => (
            <button
              key={n}
              type="button"
              aria-pressed={nivel === n && !matrix}
              onClick={() => {
                setMatrix(false);
                elegirNivel(n);
              }}
              title={`Nivel ${ETIQUETA_NIVEL[n]} (tecla ${i + 1})`}
              className={`px-3 py-1 text-xs font-medium transition-colors ${nivel === n && !matrix ? "bg-accent texto-sobre-acento" : "bg-surface text-ink-muted hover:bg-canvas"}`}
            >
              {ETIQUETA_NIVEL[n]}
            </button>
          ))}
        </div>
        <button
          type="button"
          aria-pressed={matrix}
          onClick={() => setMatrix((v) => !v)}
          className={`rounded border px-2.5 py-1 text-xs ${matrix ? "border-accent text-accent" : "border-divider text-ink-muted hover:text-ink"}`}
        >
          Ver como Matrix
        </button>
        <LeyendaApoyo />
        <button
          type="button"
          aria-pressed={leerComoTexto}
          onClick={() => setLeerComoTexto((v) => !v)}
          className={`rounded border px-2.5 py-1 text-xs ${leerComoTexto ? "border-accent text-accent" : "border-divider text-ink-muted hover:text-ink"}`}
        >
          Leer como texto
        </button>
        <span className="ml-auto">{acciones.menu}</span>
      </div>

      {!matrix && (
        <div role="group" aria-label="Capas" className="mb-4 flex flex-wrap items-center gap-2 text-xs">
          <span className="font-mono text-[10px] uppercase tracking-wide text-ink-muted">Capas</span>
          <BotonCapa activa={capas.plan} contador={contadores.plan} onClick={() => alternar("plan")}>Plan</BotonCapa>
          <BotonCapa activa={capas.huecos} contador={contadores.huecos} onClick={() => alternar("huecos")}>Huecos</BotonCapa>
          <BotonCapa activa={capas.dbt} contador={contadores.dbt} onClick={() => alternar("dbt")} titulo="Numeración y puntos de solución sobre la cadena interna (nivel Clínico)">DBT</BotonCapa>
          {/* Cuenta los anclados; los sin anclar van aparte y también encienden
              la capa, que es donde se listan para colocarlos. */}
          <BotonCapa
            activa={capas.act}
            contador={contadores.act}
            habilitada={contadores.act + contadores.actSinAnclar > 0}
            onClick={() => alternar("act")}
            titulo="Procesos ACT anclados a un nodo, con su justificación funcional"
            extra={contadores.actSinAnclar > 0 ? `${contadores.actSinAnclar} sin anclar` : undefined}
          >
            ACT
          </BotonCapa>
        </div>
      )}
      {acciones.panel}

      <AvisosSinNodo analisis={analisis} />
      {nivel === "evidencia" && !matrix && <FranjaCobertura analisis={analisis} notaOriginal={notaOriginal} />}

      {analisis.situaciones.length === 0 ? (
        <SinHallazgos estado={estadoVacio(analisis, "situaciones")} />
      ) : (
        <GrafoAFC
          analisis={analisis}
          nivel={nivel}
          capas={capas}
          matrix={matrix}
          leerComoTexto={leerComoTexto}
          onIrANivel={elegirNivel}
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

function BotonCapa({
  activa,
  contador,
  habilitada,
  onClick,
  titulo,
  extra,
  children,
}: {
  activa: boolean;
  contador: number;
  /** Por defecto, habilitada si el contador no es cero. */
  habilitada?: boolean;
  onClick: () => void;
  titulo?: string;
  extra?: string;
  children: React.ReactNode;
}) {
  // Una capa sin nada que enseñar se desactiva: encenderla no cambiaría nada.
  const vacia = !(habilitada ?? contador > 0);
  return (
    <button
      type="button"
      aria-pressed={activa && !vacia}
      disabled={vacia}
      onClick={onClick}
      title={vacia ? "No hay nada en esta capa" : titulo}
      className={`rounded-full border px-2.5 py-1 disabled:cursor-not-allowed disabled:opacity-40 ${activa && !vacia ? "border-accent text-accent" : "border-divider text-ink-muted hover:text-ink"}`}
    >
      {children} <span className="font-mono">{contador}</span>
      {extra && <span className="text-ink-muted"> · {extra}</span>}
    </button>
  );
}

/**
 * La cobertura de la nota en una franja: un tramo por frase que cuenta, lleno
 * si algún elemento la cita y en ámbar si no. Pulsar un tramo abre la Fuente
 * en esa frase.
 */
function FranjaCobertura({ analisis, notaOriginal }: { analisis: AnalisisFuncional; notaOriginal: string }) {
  const { irACita } = useEspacio();
  const lineas = useMemo(() => notaOriginal.replace(/\r\n/g, "\n").split("\n"), [notaOriginal]);
  const tramos = useMemo(() => {
    const citas = recogerCitas(analisis);
    return lineas.flatMap((linea, i) => {
      const frases = segmentarFrases(linea);
      return frases.flatMap((texto, j) => {
        if (texto.split(/\s+/).filter(Boolean).length < PALABRAS_MINIMAS_FRASE) return [];
        const usada = citas.some((c) => citaCubreFrase(c, i + 1, j + 1, frases.length));
        return [{ linea: i + 1, frase: j + 1, texto, usada }];
      });
    });
  }, [analisis, lineas]);
  const cobertura = useMemo(() => calcularCoberturaNota(lineas, analisis), [analisis, lineas]);
  if (tramos.length === 0) return null;
  return (
    <section aria-label="Cobertura de la nota" className="mb-4">
      <p className="mb-1 text-xs text-ink-muted">
        Cobertura: {cobertura.usadas} de {cobertura.total} frases de la nota usadas por el análisis
      </p>
      <div className="flex h-3 gap-px overflow-hidden rounded">
        {tramos.map((t) => (
          <button
            key={`${t.linea}.${t.frase}`}
            type="button"
            title={`L${t.linea}.${t.frase}: ${t.texto}`}
            aria-label={`Frase L${t.linea}.${t.frase}, ${t.usada ? "usada" : "sin usar"}`}
            onClick={() =>
              irACita({ texto: t.texto, linea_inicio: t.linea, linea_fin: t.linea, frase_inicio: t.frase, frase_fin: t.frase, verificada: true })
            }
            className={`h-full flex-1 ${t.usada ? "bg-accent/60" : "bg-warn/40"}`}
          />
        ))}
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
 * La leyenda del grado de apoyo, como popover en la barra del Mapa. Antes era
 * una tarjeta en la pestaña Revisión y un botón flotante que llevaba a ella.
 */
function LeyendaApoyo() {
  return (
    <details id="niveles-confianza" className="relative print:hidden">
      <summary className="cursor-pointer list-none rounded border border-divider px-2.5 py-1 text-xs text-ink-muted hover:text-ink">
        Grado de apoyo ⓘ
      </summary>
      <div className="absolute left-0 z-40 mt-1 w-96 max-w-[90vw] rounded-md border border-divider bg-surface p-4 shadow-lg">
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
