"use client";

/**
 * El nivel Situación del Mapa en cuatro columnas: Operador motivador ·
 * Antecedente · Conducta · Consecuencias, con la conducta alternativa y la
 * función debajo. Es el tablero de antes de la fase 5B (estilos/afc.tsx),
 * recuperado porque se lee de un vistazo; Clínico y Evidencia siguen en
 * TableroSituacion, que es donde está el detalle.
 *
 * Los nodos llegan ya pintados por GrafoAFC (renderNodo), así que procedencia,
 * alertas, menú, citas soltadas desde la Fuente y arrastre entre carriles son
 * los mismos que en los otros niveles. Aquí solo se colocan.
 *
 * El clínico elige cómo se separan los tableros: por episodio (una situación
 * cada uno) o por conducta (cada conducta problema con las situaciones en que
 * se analiza). Una situación con varias conductas aparece bajo cada una.
 */

import { Fragment, type ReactNode } from "react";
import { ArrowLeftRight, ChartNoAxesColumnIncreasing, ClipboardList, Play, Target, type LucideIcon } from "lucide-react";
import type { AnalisisFuncional, Id, Situacion } from "@/lib/types";
import { huecosDeSituacion, type CarrilGrafo, type HuecoGrafo, type NodoGrafo } from "@/lib/grafo";
import { TERMINOS, type IdTermino } from "@/lib/terminos";
import { ETIQUETA_DESTINO_CARRIL, type DestinoCarril } from "@/lib/edicionMapa";
import { TIPO_ARRASTRE_NODO, useEspacio } from "../espacio/contexto";
import type { CapasMapa } from "./TableroSituacion";
import s from "./afc.module.css";

export type AgruparMapa = "episodio" | "conducta";

interface TableroColumnasProps {
  analisis: AnalisisFuncional;
  nodos: readonly NodoGrafo[];
  capas: CapasMapa;
  agrupar: AgruparMapa;
  ruta: Set<Id>;
  renderNodo: (nodo: NodoGrafo) => ReactNode;
  renderAgregar: (carril: CarrilGrafo, situacionId: string, alternativa: boolean) => ReactNode;
  onSeleccionarId: (id: Id) => void;
  onAgregarFuncion: (situacionId: Id) => void;
}

export default function TableroColumnas({ analisis, agrupar, ...resto }: TableroColumnasProps) {
  if (agrupar === "episodio") {
    return (
      <div className={s.pila}>
        {analisis.situaciones.map((situacion) => (
          <Episodio key={situacion.id} analisis={analisis} situacion={situacion} titulo={situacion.nombre} {...resto} />
        ))}
      </div>
    );
  }

  const sinConducta = analisis.situaciones.filter((sit) => sit.conductas_ids.length === 0);
  return (
    <div className={s.pila}>
      {analisis.conductas_problema.map((conducta) => {
        const suyas = analisis.situaciones.filter((sit) => sit.conductas_ids.includes(conducta.id));
        return (
          <section key={conducta.id} aria-label={`Conducta: ${conducta.descripcion}`} className="space-y-3">
            <h4 className="font-serif text-base font-semibold text-ink">{conducta.descripcion}</h4>
            {suyas.length === 0 ? (
              <p className="text-sm text-ink-muted">Ninguna situación analiza esta conducta.</p>
            ) : (
              suyas.map((situacion) => (
                <Episodio key={situacion.id} analisis={analisis} situacion={situacion} titulo={situacion.nombre} {...resto} />
              ))
            )}
          </section>
        );
      })}
      {sinConducta.length > 0 && (
        <section aria-label="Situaciones sin conducta asignada" className="space-y-3">
          <h4 className="font-serif text-base font-semibold text-ink">Sin conducta asignada</h4>
          {sinConducta.map((situacion) => (
            <Episodio key={situacion.id} analisis={analisis} situacion={situacion} titulo={situacion.nombre} {...resto} />
          ))}
        </section>
      )}
    </div>
  );
}

/** Los iconos viven solo en las cabeceras: las tarjetas son texto puro, porque las entidades clínicas no tienen pictograma. */
function Columna({ clase, titulo, icono: Icono, termino, children }: { clase: string; titulo: string; icono: LucideIcon; termino?: IdTermino; children: ReactNode }) {
  return (
    <section className={`${s.columna} ${clase}`} aria-label={titulo}>
      <header className={s.columnaCabecera}>
        <Icono className={s.columnaIcono} strokeWidth={1.8} aria-hidden="true" />
        <h5 className={s.columnaTitulo} title={termino ? TERMINOS[termino].definicion : undefined}>{titulo}</h5>
      </header>
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

function Episodio({
  analisis,
  situacion,
  titulo,
  nodos,
  capas,
  ruta,
  renderNodo,
  renderAgregar,
  onSeleccionarId,
  onAgregarFuncion,
}: Omit<TableroColumnasProps, "agrupar"> & { situacion: Situacion; titulo: string }) {
  const { nodoEnElAire, moverNodo } = useEspacio();
  // Dónde se puede soltar el nodo que vuela: solo en su situación y en un
  // carril compatible (lib/edicionMapa.ts#destinosPosibles), como en Clínico.
  const zona = (destino: DestinoCarril) =>
    nodoEnElAire && nodoEnElAire.situacionId === situacion.id && nodoEnElAire.destinos.includes(destino) ? (
      <div
        onDragOver={(e) => {
          if (!e.dataTransfer.types.includes(TIPO_ARRASTRE_NODO)) return;
          e.preventDefault();
          e.dataTransfer.dropEffect = "move";
        }}
        onDrop={(e) => {
          e.preventDefault();
          moverNodo(nodoEnElAire.id, destino);
        }}
        className={s.hueco}
      >
        Soltar aquí: {ETIQUETA_DESTINO_CARRIL[destino]}
      </div>
    ) : null;

  const deSituacion = nodos.filter((n) => n.situacion_id === situacion.id);
  const huecos = capas.huecos ? huecosDeSituacion(analisis, situacion, nodos) : [];
  // La función y la conducta alternativa tienen su propia banda: fuera de las
  // columnas para que cada nodo se pinte una sola vez.
  const enCarril = (carril: CarrilGrafo) =>
    deSituacion.filter((n) => n.carril === carril && !n.alternativa && n.tipo !== "funcion");
  const huecosDe = (carril: CarrilGrafo) => huecos.filter((h) => h.carril === carril);
  const alternativas = deSituacion.filter((n) => n.alternativa && n.carril !== "inmediata");
  const necesarias = deSituacion.filter((n) => n.alternativa && n.carril === "inmediata");
  const funciones = deSituacion.filter((n) => n.tipo === "funcion");

  return (
    <section className={s.situacion} data-situacion-id={situacion.id}>
      <header className={s.situacionCabecera}>
        <h4 className={s.situacionTitulo}>{titulo}</h4>
      </header>

      {/* Por debajo del ancho mínimo, el tablero se desplaza en horizontal
          dentro de su caja: la página no. */}
      <div className={`${s.scroll} ${s.contenedorColumnas}`}>
        <div className={`${s.tablero} ${s.lienzoColumnas}`}>
          <Columna clase={s.om} titulo={TERMINOS.om.claro} icono={Target} termino="om">
            <Lista nodos={enCarril("contexto")} huecos={huecosDe("contexto")} renderNodo={renderNodo} />
            {renderAgregar("contexto", situacion.id, false)}
          </Columna>

          <Columna clase={s.ant} titulo="Antecedente" icono={ClipboardList}>
            {zona("ed")}
            {zona("ec")}
            <Lista nodos={enCarril("antecedente")} huecos={huecosDe("antecedente")} renderNodo={renderNodo} />
            {renderAgregar("antecedente", situacion.id, false)}
          </Columna>

          <Columna clase={s.con} titulo="Conducta" icono={Play}>
            {/* Sin rótulo encubierta/manifiesta: la descripción de cada conducta ya lo dice. */}
            <div className={s.manifiesta}>
              <Lista nodos={[...enCarril("encubierto"), ...enCarril("conducta")]} huecos={[...huecosDe("encubierto"), ...huecosDe("conducta")]} renderNodo={renderNodo} />
              {renderAgregar("conducta", situacion.id, false)}
            </div>
          </Columna>

          <Columna clase={s.csq} titulo="Consecuencias" icono={ChartNoAxesColumnIncreasing}>
            {(["inmediata", "demorada"] as const).map((carril) => (
              <div key={carril} className={s.consecuencias}>
                <p className={s.subzonaTitulo}>{carril === "inmediata" ? "Consecuencia inmediata" : "Consecuencia demorada"}</p>
                {zona(carril)}
                <Lista nodos={enCarril(carril)} huecos={huecosDe(carril)} renderNodo={renderNodo} />
                {renderAgregar(carril, situacion.id, false)}
              </div>
            ))}
          </Columna>
        </div>
      </div>

      {capas.plan && (
        <div className={`${s.alternativa} ${s.alt}`}>
          <p className={s.alternativaCabecera}><ArrowLeftRight className={s.alternativaIcono} strokeWidth={1.8} aria-hidden="true" /><strong>Conducta alternativa</strong></p>
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
      )}

      <div className={s.funcionFila}>
        {funciones.map((n) => (
          <button
            key={n.id}
            type="button"
            data-nodo-id={n.id}
            onClick={() => onSeleccionarId(n.id)}
            className={`${s.funcion} ${ruta.size > 0 && !ruta.has(n.id) ? "opacity-35" : ""}`}
          >
            <span title={TERMINOS.funcion.definicion}>{TERMINOS.funcion.claro}</span><span className={s.funcionTexto}>{n.etiqueta}</span>
          </button>
        ))}
        {funciones.length === 0 && (
          <button type="button" onClick={() => onAgregarFuncion(situacion.id)} className={s.agregarBoton}>+ función hipotetizada</button>
        )}
      </div>
    </section>
  );
}
