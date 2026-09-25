"use client";

import { Fragment, type ReactNode } from "react";
import { ArrowRight } from "lucide-react";
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
}

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

export default function VistaAFC({ analisis, nodos, renderNodo, renderAgregar, onSeleccionar, onAgregarFuncion }: VistaAFCProps) {
  const globales = nodos.filter((n) => n.situacion_id === null);

  return (
    <div className={s.pila}>
      {globales.length > 0 && (
        <section className={s.globales}>
          <h4 className={s.globalesTitulo}>Entidades del caso fuera de una situación concreta</h4>
          <div className={s.globalesRejilla}>
            {globales.map((n) => (
              <div key={n.id} className={n.alternativa ? s.alt : s[COLUMNA_DE_CARRIL[n.carril]]}>{renderNodo(n)}</div>
            ))}
          </div>
        </section>
      )}

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
                <ArrowRight className={s.flecha} strokeWidth={2.25} aria-hidden="true" />
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
    </div>
  );
}
