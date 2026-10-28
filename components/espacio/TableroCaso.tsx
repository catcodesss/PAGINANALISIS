"use client";

/**
 * Nivel Caso del Mapa (fase 10): «¿cuántos patrones hay y qué los une?».
 *
 * Una columna por clase funcional, con las topografías como fichas; la última
 * es «Función por determinar», con borde discontinuo: ahí va lo que no se sabe.
 * Debajo, el contexto que modula el caso, sus costos y valores, y los bucles
 * con el apoyo de su relación más débil.
 *
 * Mover una ficha a otra columna es una decisión del clínico (cambia la clase
 * de la conducta): se puede deshacer y queda en el historial del elemento. La
 * pertenencia nueva llega sin cita, como «inferencia», hasta que se sostenga
 * con una frase de la nota. Esto nunca se presenta como generado por la IA.
 */

import { useMemo, useState } from "react";
import type { AnalisisFuncional, ClaseFuncional, MiembroClase } from "@/lib/types";
import type { NivelMapa } from "@/lib/preferencias";
import { apoyoDeClase, crearClase, moverConductaDeClase, nombreDeClase, POR_DETERMINAR } from "@/lib/clases";
import { describirGrado, gradoDeApoyoArista } from "@/lib/gradoApoyo";
import { construirNodosGrafo } from "@/lib/grafo";
import { construirRedFuncional } from "@/lib/redFuncional";
import { useEspacio } from "./contexto";

const TIPO_ARRASTRE_CONDUCTA = "application/x-acia-conducta";

export default function TableroCaso({
  analisis,
  analisisConProsa,
  onIrANivel,
}: {
  analisis: AnalisisFuncional;
  analisisConProsa: AnalisisFuncional;
  onIrANivel: (nivel: NivelMapa) => void;
}) {
  const { seleccionar, aplicarDecision, deshacer, rehacer, puedeDeshacer, puedeRehacer } = useEspacio();
  const [nombreNueva, setNombreNueva] = useState("");
  const clases = analisis.clases_funcionales ?? [];
  const conConocida = clases.filter((c) => c.funcion !== null);
  const porDeterminar = clases.find((c) => c.funcion === null);
  const sinClases = analisis.campos_ausentes.includes("clases_funcionales");

  const conductas = useMemo(() => new Map(analisis.conductas_problema.map((c) => [c.id, c])), [analisis.conductas_problema]);
  const red = useMemo(() => construirRedFuncional(analisisConProsa), [analisisConProsa]);
  const relacionesSinApoyo = useMemo(() => {
    const etiqueta = new Map(construirNodosGrafo(analisis).map((n) => [n.id, n.etiqueta]));
    const nombre = (id: string) => etiqueta.get(id) || textoDeEntidad(analisis, id) || "elemento sin etiqueta";
    return analisis.aristas
      .filter((r) => r.apoyo === "inferido")
      .map((r) => `${nombre(r.desde)} → ${nombre(r.hasta)}`);
  }, [analisis]);

  const mover = (conductaId: string, destino: string) => {
    aplicarDecision((copia) => {
      moverConductaDeClase(copia, conductaId, destino);
    });
  };
  const crear = () => {
    const nombre = nombreNueva.trim();
    if (!nombre) return;
    aplicarDecision((copia) => {
      crearClase(copia, nombre);
    });
    setNombreNueva("");
  };
  const abrirConducta = (id: string) => {
    onIrANivel("situacion");
    seleccionar(id);
  };

  if (analisis.conductas_problema.length === 0) {
    return <p className="text-sm text-ink-muted">Sin conductas problema no hay clases que agrupar.</p>;
  }

  const opcionesDestino = [
    ...conConocida.map((c) => ({ valor: c.id, etiqueta: nombreDeClase(c) })),
    { valor: POR_DETERMINAR, etiqueta: "Función por determinar" },
  ];

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm text-ink">
          {conConocida.length === 0
            ? "Ninguna clase con función conocida todavía."
            : `${conConocida.length} ${conConocida.length === 1 ? "clase funcional" : "clases funcionales"}`}
          {porDeterminar && ` · ${porDeterminar.miembros.length} por determinar`}
        </p>
        <p className="mt-1 text-xs text-ink-muted">
          Las conductas se agrupan por la función que se hipotetiza para ellas, no por su forma. Arrastra una ficha a otra
          columna, o usa «Mover a», para cambiar su clase: es una decisión tuya y se puede deshacer.
          {sinClases && " Esta formulación no trae clases funcionales: todas las conductas están por determinar."}
        </p>
      </header>

      <form
        className="flex flex-wrap items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          crear();
        }}
      >
        <input
          value={nombreNueva}
          onChange={(e) => setNombreNueva(e.target.value)}
          maxLength={120}
          placeholder="Nueva clase: la función, p. ej. escape de la evaluación social"
          aria-label="Función de la clase nueva"
          className="min-w-0 flex-1 rounded border border-divider bg-surface px-2 py-1 text-sm text-ink"
        />
        <button type="submit" disabled={!nombreNueva.trim()} className="rounded border border-divider px-3 py-1 text-xs text-ink-muted hover:text-ink disabled:opacity-40">
          Crear clase
        </button>
        <button type="button" disabled={!puedeDeshacer} onClick={deshacer} className="rounded border border-divider px-3 py-1 text-xs text-ink disabled:opacity-40">
          Deshacer
        </button>
        <button type="button" disabled={!puedeRehacer} onClick={rehacer} className="rounded border border-divider px-3 py-1 text-xs text-ink disabled:opacity-40">
          Rehacer
        </button>
      </form>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(15rem,1fr))] gap-3" aria-label="Clases funcionales">
        {[...conConocida, ...(porDeterminar ? [porDeterminar] : [])].map((clase) => (
          <Columna
            key={clase.id}
            clase={clase}
            conductas={conductas}
            opcionesDestino={opcionesDestino}
            onSoltar={(id) => mover(id, clase.funcion === null ? POR_DETERMINAR : clase.id)}
            onMover={mover}
            onAbrir={abrirConducta}
          />
        ))}
      </div>

      <Franja titulo="Contexto y moduladoras">
        <Lista
          vacio="Sin acomodación del entorno ni variables moduladoras en el análisis."
          items={[
            ...analisis.acomodacion_entorno.map((a) => `${a.quien}: ${a.conducta_acomodacion}`),
            ...analisis.variables_moduladoras.map((v) => v.descripcion),
          ]}
        />
        {relacionesSinApoyo.length > 0 && (
          <div className="mt-3 rounded border border-dashed border-divider p-2">
            <p className="font-mono text-[10px] uppercase tracking-wide text-ink-muted">Relaciones sin apoyo en la nota (hueco)</p>
            <ul className="mt-1 space-y-1 text-sm text-ink-muted">
              {relacionesSinApoyo.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          </div>
        )}
      </Franja>

      <Franja titulo="Costos y valores">
        <Lista
          vacio="El análisis no recoge costos ni valores."
          items={[
            ...analisis.situaciones.flatMap((s) => (s.cadena_operante?.consecuencias_largo_plazo?.texto ? [`Costo: ${s.cadena_operante.consecuencias_largo_plazo.texto}`] : [])),
            ...analisis.perdida_de_reforzadores.map((p) => `Pérdida: ${p}`),
            ...analisis.valores_y_metas.map((v) => `Valor o meta: ${v}`),
          ]}
        />
      </Franja>

      {red.bucles.length > 0 && (
        <Franja titulo="Bucles">
          <ul className="space-y-1 text-sm text-ink">
            {red.bucles.map((b, i) => (
              <li key={i}>
                {b}{" "}
                <span className="text-xs text-ink-muted">
                  · apoyo del tramo más débil: {describirGrado(gradoDeApoyoArista(red.apoyoDeBucles[i])).etiqueta}
                </span>
              </li>
            ))}
          </ul>
        </Franja>
      )}
    </div>
  );
}

/**
 * El texto de una entidad por su id, para los extremos de una relación que no
 * son nodos del grafo (p. ej. una hipótesis o una situación). Sin esto la
 * relación se pintaba como «→ …».
 */
function textoDeEntidad(analisis: AnalisisFuncional, id: string): string {
  const pila: unknown[] = [analisis];
  while (pila.length > 0) {
    const v = pila.pop();
    if (Array.isArray(v)) {
      pila.push(...v);
    } else if (v && typeof v === "object") {
      const o = v as Record<string, unknown>;
      if (o.id === id) {
        for (const k of ["etiqueta", "descripcion", "nombre", "enunciado", "texto", "funcion", "conducta_propuesta", "intervencion"]) {
          if (typeof o[k] === "string" && (o[k] as string).trim()) return o[k] as string;
        }
      }
      pila.push(...Object.values(o));
    }
  }
  return "";
}

function Columna({
  clase,
  conductas,
  opcionesDestino,
  onSoltar,
  onMover,
  onAbrir,
}: {
  clase: ClaseFuncional;
  conductas: Map<string, AnalisisFuncional["conductas_problema"][number]>;
  opcionesDestino: { valor: string; etiqueta: string }[];
  onSoltar: (conductaId: string) => void;
  onMover: (conductaId: string, destino: string) => void;
  onAbrir: (conductaId: string) => void;
}) {
  const indeterminada = clase.funcion === null;
  const apoyo = describirGrado(apoyoDeClase(clase));
  return (
    <section
      aria-label={nombreDeClase(clase)}
      onDragOver={(e) => {
        if (!e.dataTransfer.types.includes(TIPO_ARRASTRE_CONDUCTA)) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
      }}
      onDrop={(e) => {
        const id = e.dataTransfer.getData(TIPO_ARRASTRE_CONDUCTA);
        if (!id) return;
        e.preventDefault();
        onSoltar(id);
      }}
      className={`min-w-0 rounded-md border bg-surface p-3 ${indeterminada ? "border-dashed border-divider" : "border-divider"}`}
    >
      <h3 className="text-sm font-semibold text-ink">{nombreDeClase(clase)}</h3>
      <p className="mt-0.5 flex items-center gap-2 text-xs text-ink-muted">
        <span>
          {clase.miembros.length} {clase.miembros.length === 1 ? "conducta" : "conductas"}
        </span>
        {!indeterminada && clase.miembros.length > 0 && (
          <span className="flex items-center gap-1" title={apoyo.corta}>
            <span aria-hidden="true" className={`h-2 w-2 rounded-full ${apoyo.clase}`} />
            {apoyo.etiqueta}
          </span>
        )}
      </p>
      <ul className="mt-2 space-y-2">
        {clase.miembros.map((m) => (
          <Ficha
            key={m.conducta_id}
            miembro={m}
            descripcion={conductas.get(m.conducta_id)?.descripcion ?? m.conducta_texto}
            claseActual={indeterminada ? POR_DETERMINAR : clase.id}
            opcionesDestino={opcionesDestino}
            onMover={onMover}
            onAbrir={onAbrir}
          />
        ))}
        {clase.miembros.length === 0 && <li className="text-xs text-ink-muted">Sin conductas. Suelta una ficha aquí.</li>}
      </ul>
    </section>
  );
}

function Ficha({
  miembro,
  descripcion,
  claseActual,
  opcionesDestino,
  onMover,
  onAbrir,
}: {
  miembro: MiembroClase;
  descripcion: string;
  claseActual: string;
  opcionesDestino: { valor: string; etiqueta: string }[];
  onMover: (conductaId: string, destino: string) => void;
  onAbrir: (conductaId: string) => void;
}) {
  const apoyo = describirGrado(miembro.apoyo);
  const cita = miembro.evidencia.verificada ? miembro.evidencia : null;
  return (
    <li
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData(TIPO_ARRASTRE_CONDUCTA, miembro.conducta_id);
        e.dataTransfer.effectAllowed = "move";
      }}
      className="cursor-grab rounded border border-divider bg-canvas p-2 active:cursor-grabbing"
    >
      <button type="button" onClick={() => onAbrir(miembro.conducta_id)} className="block w-full text-left text-sm text-ink hover:underline">
        {descripcion}
      </button>
      {miembro.justificacion && <p className="mt-1 text-xs text-ink-muted">{miembro.justificacion}</p>}
      <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-muted">
        <span className="flex items-center gap-1" title={apoyo.corta}>
          <span aria-hidden="true" className={`h-2 w-2 rounded-full ${apoyo.clase}`} />
          {apoyo.etiqueta}
        </span>
        {cita && (
          <span title={cita.texto}>
            Línea {cita.linea_inicio}
            {cita.linea_fin !== cita.linea_inicio ? `–${cita.linea_fin}` : ""}
          </span>
        )}
        <select
          aria-label={`Mover «${descripcion}» a otra clase`}
          value={claseActual}
          onChange={(e) => onMover(miembro.conducta_id, e.target.value)}
          className="ml-auto max-w-[9rem] rounded border border-divider bg-surface px-1 py-0.5 text-xs text-ink-muted"
        >
          {opcionesDestino.map((o) => (
            <option key={o.valor} value={o.valor}>
              {o.etiqueta}
            </option>
          ))}
        </select>
      </p>
    </li>
  );
}

function Franja({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section aria-label={titulo} className="rounded-md border border-divider bg-surface p-3">
      <h3 className="font-mono text-[10px] uppercase tracking-wide text-ink-muted">{titulo}</h3>
      <div className="mt-2">{children}</div>
    </section>
  );
}

function Lista({ items, vacio }: { items: string[]; vacio: string }) {
  if (items.length === 0) return <p className="text-sm text-ink-muted">{vacio}</p>;
  return (
    <ul className="space-y-1 text-sm text-ink">
      {items.map((t, i) => (
        <li key={i}>{t}</li>
      ))}
    </ul>
  );
}
