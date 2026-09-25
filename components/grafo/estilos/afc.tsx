"use client";

import { Fragment, useLayoutEffect, useRef, useState, type PointerEvent as EventoPuntero, type ReactNode } from "react";
import { GripVertical } from "lucide-react";
import type { AnalisisFuncional } from "@/lib/types";
import {
  apoyoCadena,
  huecosDeSituacion,
  type CarrilGrafo,
  type HuecoGrafo,
  type NodoGrafo,
} from "@/lib/grafo";
import s from "../afc.module.css";

interface VistaAFCProps {
  analisis: AnalisisFuncional;
  nodos: readonly NodoGrafo[];
  renderNodo: (nodo: NodoGrafo) => ReactNode;
  renderAgregar: (carril: CarrilGrafo, situacionId: string, alternativa: boolean) => ReactNode;
  onSeleccionar: (nodo: NodoGrafo) => void;
  onAgregarFuncion: (situacionId: string) => void;
  /** Tras mover algo a mano: las relaciones se trazan midiendo el DOM y no se enteran solas. */
  onReacomodo: () => void;
}

type Desplazamiento = { x: number; y: number };

/** Por debajo de esto un gesto es un clic (seleccionar, editar), no un arrastre. */
const UMBRAL_ARRASTRE = 4;

/**
 * Arrastre libre para colocar a mano. Es solo presentación: vive en el estado
 * de la vista y no toca el análisis, así que ni entra en Deshacer ni viaja al
 * informe. En táctil el arrastre de los cuadros cede al desplazamiento de la
 * página (sin touch-action: none); la tarjeta sí se arrastra por su cabecera.
 */
function useArrastre(onReacomodo: () => void) {
  const [posiciones, setPosiciones] = useState<Record<string, Desplazamiento>>({});
  const [arrastrando, setArrastrando] = useState<string | null>(null);
  const reacomodo = useRef(onReacomodo);

  useLayoutEffect(() => {
    reacomodo.current = onReacomodo;
  });
  useLayoutEffect(() => reacomodo.current(), [posiciones]);

  function iniciar(id: string, evento: EventoPuntero<HTMLElement>) {
    if (evento.button !== 0) return;
    if ((evento.target as HTMLElement).closest("input, textarea, [data-sin-arrastre]")) return;
    evento.stopPropagation();
    const inicio = { x: evento.clientX, y: evento.clientY };
    const base = posiciones[id] ?? { x: 0, y: 0 };
    let movido = false;

    const mover = (e: PointerEvent) => {
      const dx = e.clientX - inicio.x;
      const dy = e.clientY - inicio.y;
      if (!movido && Math.hypot(dx, dy) < UMBRAL_ARRASTRE) return;
      if (!movido) setArrastrando(id);
      movido = true;
      setPosiciones((p) => ({ ...p, [id]: { x: base.x + dx, y: base.y + dy } }));
    };
    const soltar = () => {
      window.removeEventListener("pointermove", mover);
      window.removeEventListener("pointerup", soltar);
      window.removeEventListener("pointercancel", soltar);
      setArrastrando(null);
      if (!movido) return;
      // El clic que sigue al soltar seleccionaría el nodo: se descarta ese solo.
      const tragar = (e: MouseEvent) => { e.stopPropagation(); e.preventDefault(); };
      window.addEventListener("click", tragar, { capture: true, once: true });
      setTimeout(() => window.removeEventListener("click", tragar, { capture: true }), 0);
    };
    window.addEventListener("pointermove", mover);
    window.addEventListener("pointerup", soltar);
    window.addEventListener("pointercancel", soltar);
  }

  const estilo = (id: string) => {
    const p = posiciones[id];
    return {
      position: "relative" as const,
      transform: p ? `translate(${p.x}px, ${p.y}px)` : undefined,
      zIndex: arrastrando === id ? 20 : p ? 2 : undefined,
    };
  };

  return {
    movidos: Object.keys(posiciones).length > 0,
    recolocar: () => setPosiciones({}),
    estilo,
    arrastrando,
    iniciar,
  };
}

const ID_TARJETA_GLOBALES = "__globales";

/** Clase de color de cada carril: las seis zonas del modelo en cuatro columnas. */
export const COLUMNA_DE_CARRIL: Record<CarrilGrafo, "om" | "ant" | "con" | "csq"> = {
  contexto: "om",
  antecedente: "ant",
  encubierto: "con",
  conducta: "con",
  inmediata: "csq",
  demorada: "csq",
};

function Columna({ clase, titulo, children }: { clase: string; titulo: string; children: ReactNode }) {
  return (
    <section className={`${s.columna} ${clase}`} aria-label={titulo}>
      <header className={s.columnaCabecera}><h5 className={s.columnaTitulo}>{titulo}</h5></header>
      <div className={s.columnaCuerpo}>{children}</div>
    </section>
  );
}

function Lista({ nodos, huecos, renderNodo }: { nodos: readonly NodoGrafo[]; huecos: readonly HuecoGrafo[]; renderNodo: (nodo: NodoGrafo) => ReactNode }) {
  if (nodos.length === 0 && huecos.length === 0) return null;
  return (
    <div className={s.lista}>
      {nodos.map((n) => <Fragment key={n.id}>{renderNodo(n)}</Fragment>)}
      {huecos.map((h) => <div key={h.id} className={s.hueco}>{h.etiqueta}</div>)}
    </div>
  );
}

export default function VistaAFC({ analisis, nodos, renderNodo, renderAgregar, onSeleccionar, onAgregarFuncion, onReacomodo }: VistaAFCProps) {
  const globales = nodos.filter((n) => n.situacion_id === null);
  const arrastre = useArrastre(onReacomodo);

  return (
    <div className={s.pila}>
      {analisis.situaciones.map((situacion) => {
        const deSituacion = nodos.filter((n) => n.situacion_id === situacion.id);
        const apoyo = apoyoCadena(deSituacion);
        const huecos = huecosDeSituacion(analisis, situacion, nodos);
        // La función y la conducta alternativa tienen su propia banda: fuera
        // de las columnas para que cada nodo se pinte una sola vez.
        const enCarril = (carril: CarrilGrafo) =>
          deSituacion.filter((n) => n.carril === carril && !n.alternativa && n.tipo !== "funcion");
        const huecosDe = (carril: CarrilGrafo) => huecos.filter((h) => h.carril === carril);
        const alternativas = deSituacion.filter((n) => n.alternativa && n.carril !== "inmediata");
        const necesarias = deSituacion.filter((n) => n.alternativa && n.carril === "inmediata");
        const funciones = deSituacion.filter((n) => n.tipo === "funcion");
        const agregarEncubierta = renderAgregar("encubierto", situacion.id, false);

        return (
          <section key={situacion.id} className={s.situacion} data-situacion-id={situacion.id}>
            <header className={s.situacionCabecera}>
              <h4 className={s.situacionTitulo}>{situacion.nombre}</h4>
              <span className={s.apoyo}>
                Apoyo de la cadena:
                <span className="inline-block h-1 bg-accent" style={{ width: apoyo === 3 ? 34 : apoyo === 2 ? 23 : 11, opacity: apoyo === 3 ? 1 : apoyo === 2 ? .66 : .42 }} />
                · lo marca el eslabón más débil
              </span>
            </header>

            <div className={s.tablero}>
              <Columna clase={s.om} titulo="Operador Motivador">
                <Lista nodos={enCarril("contexto")} huecos={huecosDe("contexto")} renderNodo={renderNodo} />
                {renderAgregar("contexto", situacion.id, false)}
              </Columna>

              <Columna clase={s.ant} titulo="Antecedente">
                <Lista nodos={enCarril("antecedente")} huecos={huecosDe("antecedente")} renderNodo={renderNodo} />
                {renderAgregar("antecedente", situacion.id, false)}
              </Columna>

              <Columna clase={s.con} titulo="Conducta">
                <section className={s.encubiertas} aria-label="Respuestas encubiertas">
                  <div className={s.subgrupoCabecera}>
                    <h6 className={s.subgrupoTitulo}>Respuestas encubiertas</h6>
                    {agregarEncubierta}
                  </div>
                  <Lista nodos={enCarril("encubierto")} huecos={huecosDe("encubierto")} renderNodo={renderNodo} />
                </section>
                <section className={s.manifiesta} aria-label="Conducta manifiesta">
                  <h6 className={s.subgrupoTitulo}>Conducta manifiesta</h6>
                  <Lista nodos={enCarril("conducta")} huecos={huecosDe("conducta")} renderNodo={renderNodo} />
                  {renderAgregar("conducta", situacion.id, false)}
                </section>
              </Columna>

              <Columna clase={s.csq} titulo="Consecuencias">
                {(["inmediata", "demorada"] as const).map((carril) => (
                  <div key={carril} className={s.consecuencias}>
                    <p className={s.subzonaTitulo}>{carril === "inmediata" ? "Consecuencia inmediata" : "Consecuencia demorada"}</p>
                    <Lista nodos={enCarril(carril)} huecos={huecosDe(carril)} renderNodo={renderNodo} />
                    {renderAgregar(carril, situacion.id, false)}
                  </div>
                ))}
              </Columna>
            </div>

            <div className={`${s.alternativa} ${s.alt}`}>
              <p className={s.alternativaCabecera}><strong>Conducta alternativa</strong> · compite por la misma contingencia</p>
              <div className={s.alternativaFila}>
                <div className={s.lista}>
                  {alternativas.map((n) => <Fragment key={n.id}>{renderNodo(n)}</Fragment>)}
                  {renderAgregar("conducta", situacion.id, true)}
                </div>
                <div className={s.lista}>
                  {necesarias.map((n) => <Fragment key={n.id}>{renderNodo(n)}</Fragment>)}
                  {renderAgregar("inmediata", situacion.id, true)}
                </div>
              </div>
            </div>

            <div className={s.funcionFila}>
              {funciones.map((n) => (
                <button key={n.id} type="button" data-nodo-id={n.id} onClick={() => onSeleccionar(n)} className={s.funcion}>
                  <span>Función</span><span>{n.etiqueta}</span>
                </button>
              ))}
              {funciones.length === 0 && (
                <button type="button" onClick={() => onAgregarFuncion(situacion.id)} className={s.agregarBoton}>+ función hipotetizada</button>
              )}
            </div>
          </section>
        );
      })}

      {/* Después de las situaciones: son el marco del caso, no un paso previo
          de la cadena, y delante empujaban el AFC fuera de la vista. */}
      {globales.length > 0 && (
        <section className={s.globales} style={arrastre.estilo(ID_TARJETA_GLOBALES)}>
          <header
            className={`${s.globalesCabecera} ${arrastre.arrastrando === ID_TARJETA_GLOBALES ? s.agarrado : ""}`}
            onPointerDown={(e) => arrastre.iniciar(ID_TARJETA_GLOBALES, e)}
            title="Arrastra para mover la tarjeta"
          >
            <GripVertical className={s.asa} aria-hidden="true" />
            <h4 className={s.globalesTitulo}>Entidades del caso fuera de una situación concreta</h4>
            {arrastre.movidos && (
              <button type="button" data-sin-arrastre onClick={arrastre.recolocar} className={s.recolocar}>
                Recolocar
              </button>
            )}
          </header>
          <div className={s.globalesRejilla}>
            {globales.map((n) => (
              <div
                key={n.id}
                className={`${n.alternativa ? s.alt : s[COLUMNA_DE_CARRIL[n.carril]]} ${s.movible} ${arrastre.arrastrando === n.id ? s.agarrado : ""}`}
                style={arrastre.estilo(n.id)}
                onPointerDown={(e) => arrastre.iniciar(n.id, e)}
              >
                {renderNodo(n)}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
