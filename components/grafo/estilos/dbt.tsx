"use client";

import { createElement, Fragment, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import {
  ArrowDown,
  ChevronDown,
  Circle,
  Clock,
  CloudRain,
  Crosshair,
  Footprints,
  HeartPulse,
  Link2,
  MessageCircle,
  Moon,
  Plus,
  Radio,
  Signpost,
  SlidersHorizontal,
  Sprout,
  Target,
  TrendingUp,
  X,
  Zap,
  type LucideIcon,
} from "lucide-react";
import type { AnalisisFuncional, TipoEslabonDBT } from "@/lib/types";
import { apoyoCadena, type NodoGrafo } from "@/lib/grafo";
import { describirGrado, gradoDeNumero } from "@/lib/gradoApoyo";
import { Cita } from "@/components/informe/primitivas";

/*
  Vista DBT: análisis en cadena de arriba abajo, con el detalle del eslabón
  aparte. La cadena lleva solo lo imprescindible para leerla; evidencia,
  función e intervención se abren al seleccionar. Es solo presentación: no
  añade campos al análisis y todo lo que edita pasa por el mismo Deshacer.

  Sin un color por categoría: el tipo lo dicen el icono y el texto, y el color
  queda reservado para el grado de apoyo, que es lo que significa algo.
*/

const SUBTIPO_ESLABON: Record<TipoEslabonDBT, string> = {
  sensacion: "Sensación",
  pensamiento: "Pensamiento",
  emocion: "Emoción",
  impulso: "Impulso",
  accion: "Acción",
};

const ICONO_ESLABON: Record<TipoEslabonDBT, LucideIcon> = {
  sensacion: HeartPulse,
  pensamiento: MessageCircle,
  emocion: CloudRain,
  impulso: Zap,
  accion: Footprints,
};

function esTipoEslabon(valor: string | undefined): valor is TipoEslabonDBT {
  return Boolean(valor && valor in SUBTIPO_ESLABON);
}

/** El icono discreto de la tarjeta. Los eslabones lo toman de su subtipo. */
export function iconoDeNodo(nodo: NodoGrafo): LucideIcon {
  if (nodo.tipo === "encubierta") return esTipoEslabon(nodo.detalle) ? ICONO_ESLABON[nodo.detalle] : MessageCircle;
  if (nodo.tipo === "consecuencia") return nodo.carril === "demorada" ? Clock : TrendingUp;
  const iconos: Partial<Record<NodoGrafo["tipo"], LucideIcon>> = {
    om: Moon,
    moduladora: SlidersHorizontal,
    ed: Signpost,
    ec: Radio,
    regla_verbal: Link2,
    conducta: Target,
    alternativa: Sprout,
    consecuencia_alternativa: Sprout,
    repertorio: Sprout,
  };
  return iconos[nodo.tipo] ?? Circle;
}

/** El icono como elemento: el componente sale de una tabla fija, no se crea al pintar. */
export function IconoNodo({ nodo, className }: { nodo: NodoGrafo; className: string }) {
  return createElement(iconoDeNodo(nodo), { className, strokeWidth: 1.6, "aria-hidden": true });
}

/** El subtipo en palabras: en un eslabón pesa más «Pensamiento» que «Encubierta». */
export function subtipoDeNodo(nodo: NodoGrafo): string | null {
  if (nodo.tipo === "encubierta") return esTipoEslabon(nodo.detalle) ? SUBTIPO_ESLABON[nodo.detalle] : "Eslabón";
  if (nodo.tipo === "consecuencia") return nodo.carril === "demorada" ? "Consecuencia demorada" : "Consecuencia inmediata";
  return null;
}

interface Intervencion {
  clave: string;
  texto: string;
  /** Cuándo actúa: antes del eslabón o mientras ocurre. Ver SolucionDBT. */
  momento?: string;
}

interface Fase {
  clave: string;
  titulo: string;
  descripcion: string;
  nodos: NodoGrafo[];
}

interface VistaDBTProps {
  analisis: AnalisisFuncional;
  nodos: readonly NodoGrafo[];
  renderNodo: (nodo: NodoGrafo) => ReactNode;
  seleccionado: string | null;
  onSeleccionar: (nodo: NodoGrafo) => void;
  onCerrar: () => void;
  describirTipo: (nodo: NodoGrafo) => string;
  lineas: readonly string[];
  lineaActiva: number | null;
  onEditar: (mutar: (copia: AnalisisFuncional) => void) => void;
}

interface Trazo {
  id: string;
  d: string;
  clase: string;
}

function Bloque({ titulo, children }: { titulo: string; children: ReactNode }) {
  return <div className="rounded-lg border border-divider bg-surface p-3"><h5 className="font-serif text-sm font-semibold text-ink">{titulo}</h5><div className="mt-1 text-sm leading-relaxed text-ink">{children}</div></div>;
}

function PildoraApoyo({ apoyo }: { apoyo: 1 | 2 | 3 }) {
  const d = describirGrado(gradoDeNumero(apoyo));
  return <span title={d.corta} className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-divider bg-canvas px-2 py-0.5 text-[11px] text-ink-muted"><span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${d.clase}`} />{d.etiqueta}</span>;
}

/**
 * El paso de un eslabón al siguiente. La intervención se dibuja aquí, entre los
 * dos, porque eso es lo que intenta cambiar: qué pasa después de este eslabón.
 */
function Enlace({ total, flecha, onAbrir }: { total: number; flecha: boolean; onAbrir: () => void }) {
  return (
    <div className="flex min-h-8 items-stretch gap-2.5 pl-5">
      {flecha && (
        <span aria-hidden="true" className="flex w-3 flex-col items-center text-ink-muted/55">
          <span className="w-px flex-1 bg-current" />
          <ArrowDown className="-mt-1 h-3 w-3" strokeWidth={1.8} />
        </span>
      )}
      <span className="flex items-center py-1">
        {total > 0 ? (
          <button type="button" onClick={onAbrir} className="inline-flex items-center gap-1.5 rounded-full border border-accent/25 bg-accent-soft px-2.5 py-0.5 text-[11px] font-medium text-accent transition hover:border-accent/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50">
            <Crosshair className="h-3 w-3" strokeWidth={2} aria-hidden="true" />
            Punto de intervención{total > 1 ? ` · ${total}` : ""}
          </button>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-[11px] text-ink-muted/80">
            <Circle className="h-2.5 w-2.5" strokeWidth={1.8} aria-hidden="true" />
            Sin intervención
          </span>
        )}
      </span>
    </div>
  );
}

export default function VistaDBT({
  analisis,
  nodos,
  renderNodo,
  seleccionado,
  onSeleccionar,
  onCerrar,
  describirTipo,
  lineas,
  lineaActiva,
  onEditar,
}: VistaDBTProps) {
  const cadenaRef = useRef<HTMLDivElement>(null);
  const notaRef = useRef<HTMLDivElement>(null);
  const [trazos, setTrazos] = useState<Trazo[]>([]);
  const [abierta, setAbierta] = useState(true);
  const conductas = nodos.filter((n) => n.tipo === "conducta" && !n.alternativa);
  const [idElegido, setIdElegido] = useState<string | null>(null);
  const elegida = conductas.find((n) => n.id === idElegido) ?? conductas[0] ?? null;
  const situacion = analisis.situaciones.find((s) => s.id === elegida?.situacion_id) ?? null;
  const deSituacion = nodos.filter((n) => n.situacion_id === situacion?.id);
  const idsModuladoras = new Set(
    elegida
      ? analisis.aristas
          .filter((a) => a.hasta === elegida.id && a.tipo === "moderadora")
          .map((a) => a.desde)
      : []
  );
  const moduladoras = nodos.filter(
    (n) => n.tipo === "moduladora" && idsModuladoras.has(n.id)
  );

  const fases: Fase[] = [
    { clave: "vulnerabilidad", titulo: "Vulnerabilidad", descripcion: "Factores que hacen más probable que la cadena arranque.", nodos: [...moduladoras, ...deSituacion.filter((n) => n.tipo === "om")] },
    { clave: "precipitante", titulo: "Evento precipitante", descripcion: "Lo que ocurrió justo antes.", nodos: deSituacion.filter((n) => n.tipo === "ed" || n.tipo === "ec") },
    { clave: "eslabones", titulo: "Eslabones", descripcion: "Sensaciones, pensamientos, emociones, impulsos y acciones que aparecen en secuencia.", nodos: deSituacion.filter((n) => n.tipo === "encubierta") },
    { clave: "conducta", titulo: "Conducta problema", descripcion: "La conducta que se quiere comprender o reducir.", nodos: elegida ? [elegida] : [] },
    { clave: "inmediata", titulo: "Consecuencia inmediata", descripcion: "Qué ocurre inmediatamente después de la conducta.", nodos: deSituacion.filter((n) => n.tipo === "consecuencia" && n.carril === "inmediata") },
    { clave: "demorada", titulo: "Consecuencia demorada", descripcion: "Efectos que aparecen a medio o largo plazo.", nodos: deSituacion.filter((n) => n.tipo === "consecuencia" && n.carril === "demorada") },
  ];
  const orden = fases.flatMap((f) => f.nodos);
  const faseDe = new Map(fases.flatMap((f, i) => f.nodos.map((n) => [n.id, i] as const)));
  const enCadena = new Set(orden.map((n) => n.id));

  // Una regla no ocurre en un momento de la cadena: modula eslabones. Por eso va
  // aparte, y primero las que tienen una relación con esta cadena.
  const reglas = nodos.filter((n) => n.tipo === "regla_verbal");
  const reglaVinculada = (id: string) =>
    analisis.aristas.some((a) => (a.desde === id && enCadena.has(a.hasta)) || (a.hasta === id && enCadena.has(a.desde)));
  const reglasVinculadas = reglas.filter((r) => reglaVinculada(r.id));
  const reglasSueltas = reglas.filter((r) => !reglaVinculada(r.id));

  const alternativas = deSituacion.filter((n) => n.tipo === "alternativa");
  const necesarias = deSituacion.filter((n) => n.tipo === "consecuencia_alternativa");
  const idsConNodo = new Set(nodos.map((n) => n.id));

  function intervencionesDe(nodo: NodoGrafo): Intervencion[] {
    const salida: Intervencion[] = [];
    for (const s of analisis.capa_dbt.analisis_de_soluciones) {
      if (s.eslabon_id === nodo.id) salida.push({ clave: s.id, texto: s.alternativa_habil, momento: s.tipo_estrategia === "antecedente" ? "Antes de que ocurra" : "Cuando ya está ocurriendo" });
    }
    analisis.capa_dbt.habilidades_sugeridas.forEach((h, i) => {
      if (h.eslabon_id === nodo.id) salida.push({ clave: `hab_${i}`, texto: h.habilidad, momento: `Habilidad · ${h.modulo.replace(/_/g, " ")}` });
    });
    if (faseDe.get(nodo.id) === 0) {
      analisis.capa_dbt.plan_de_prevencion.forEach((p, i) => salida.push({ clave: `prev_${i}`, texto: p, momento: "Prevención" }));
    }
    return salida;
  }

  /** Cuántos puntos de intervención hay tras el nodo, contando los que son nodos propios. */
  function totalIntervenciones(nodo: NodoGrafo): number {
    const fase = faseDe.get(nodo.id);
    return intervencionesDe(nodo).length
      + (fase === 3 ? alternativas.length : 0)
      + (fase === 4 ? necesarias.length : 0);
  }

  // Lo que el modelo ligó a un eslabón que no resuelve se perdería en la
  // cadena: se enseña al final con el nombre que le dio.
  const sinEslabon = [
    ...analisis.capa_dbt.analisis_de_soluciones.filter((s) => !s.eslabon_id || !idsConNodo.has(s.eslabon_id)).map((s) => ({ clave: s.id, objetivo: s.eslabon_objetivo, texto: s.alternativa_habil })),
    ...analisis.capa_dbt.habilidades_sugeridas.flatMap((h, i) => (!h.eslabon_id || !idsConNodo.has(h.eslabon_id)) ? [{ clave: `hab_${i}`, objetivo: h.eslabon_objetivo, texto: h.habilidad }] : []),
  ];

  const clavesTrazado = `${situacion?.id}|${orden.map((n) => n.id).join(",")}|${reglas.map((n) => n.id).join(",")}|${analisis.aristas.map((a) => a.id).join(",")}|${abierta}`;
  const aristasRef = useRef(analisis.aristas);
  const faseRef = useRef(faseDe);
  const ordenRef = useRef(orden);
  useLayoutEffect(() => {
    aristasRef.current = analisis.aristas;
    faseRef.current = faseDe;
    ordenRef.current = orden;
  });

  useLayoutEffect(() => {
    const contenedor = cadenaRef.current;
    if (!contenedor) return;
    let fotograma = 0;
    const dibujar = () => {
      cancelAnimationFrame(fotograma);
      fotograma = requestAnimationFrame(() => {
        const raiz = cadenaRef.current;
        if (!raiz) return;
        const base = raiz.getBoundingClientRect();
        const caja = (id: string) => {
          const el = raiz.querySelector<HTMLElement>(`[data-nodo-id="${CSS.escape(id)}"]`);
          if (!el) return null;
          const r = el.getBoundingClientRect();
          return { x: r.left - base.left, y: r.top - base.top, w: r.width, h: r.height };
        };
        const posicion = new Map(ordenRef.current.map((n, i) => [n.id, i]));
        const fase = faseRef.current;
        const nuevos: Trazo[] = [];
        let desvio = 0;
        for (const a of aristasRef.current) {
          const desde = caja(a.desde);
          const hasta = caja(a.hasta);
          if (!desde || !hasta) continue;
          const pd = posicion.get(a.desde);
          const ph = posicion.get(a.hasta);
          const clase = a.tipo === "bucle" ? "text-warn" : "text-ink-muted/70";
          if (pd === undefined || ph === undefined) {
            // Regla verbal ↔ eslabón: de la tarjeta lateral a la cadena, solo
            // si de verdad está al lado; apilada debajo, la línea cruzaría texto.
            const [regla, nodo] = pd === undefined ? [desde, hasta] : [hasta, desde];
            if (regla.x < nodo.x + nodo.w + 12) continue;
            const x1 = regla.x, y1 = regla.y + regla.h / 2;
            const x2 = nodo.x + nodo.w, y2 = nodo.y + nodo.h / 2;
            const curva = Math.max(16, (x1 - x2) / 2);
            nuevos.push({ id: a.id, clase, d: `M ${x1} ${y1} C ${x1 - curva} ${y1}, ${x2 + curva} ${y2}, ${x2} ${y2}` });
            continue;
          }
          // La secuencia principal ya la dicen las flechas: solo se traza lo
          // que salta pasos, modera o vuelve atrás.
          const principal = a.tipo === "secuencial" && (ph - pd === 1 || (fase.get(a.desde) === 3 && (fase.get(a.hasta) ?? 0) > 3));
          if (principal) continue;
          const x = Math.max(desde.x + desde.w, hasta.x + hasta.w);
          const g = 14 + (desvio++ % 3) * 7;
          const y1 = desde.y + desde.h / 2, y2 = hasta.y + hasta.h / 2;
          nuevos.push({ id: a.id, clase, d: `M ${x} ${y1} C ${x + g} ${y1}, ${x + g} ${y2}, ${x} ${y2}` });
        }
        setTrazos(nuevos);
      });
    };
    dibujar();
    const observador = new ResizeObserver(dibujar);
    observador.observe(contenedor);
    window.addEventListener("resize", dibujar);
    return () => {
      cancelAnimationFrame(fotograma);
      observador.disconnect();
      window.removeEventListener("resize", dibujar);
    };
  }, [clavesTrazado]);

  const nodoSel = nodos.find((n) => n.id === seleccionado) ?? null;
  const evidenciaSel = nodoSel?.evidencia?.verificada ? nodoSel.evidencia : null;

  // Al abrir un eslabón, la nota en bruto del panel baja sola hasta su cita.
  useEffect(() => {
    const linea = evidenciaSel?.linea_inicio ?? lineaActiva;
    const nota = notaRef.current;
    if (!linea || !nota) return;
    const el = nota.querySelector<HTMLElement>(`#nota-linea-${linea}`);
    if (el) nota.scrollTop = el.offsetTop - nota.offsetTop - 24;
  }, [seleccionado, lineaActiva, evidenciaSel?.linea_inicio]);

  if (!elegida || !situacion) {
    return <p className="rounded border border-dashed border-divider p-4 text-sm text-ink-muted">DBT necesita una conducta problema vinculada a una situación.</p>;
  }

  function agregarIntervencion(nodo: NodoGrafo) {
    const texto = window.prompt(`Intervención para «${nodo.etiqueta}»`)?.trim();
    if (!texto) return;
    const antes = (faseDe.get(nodo.id) ?? 2) <= 1;
    onEditar((copia) => {
      copia.capa_dbt.analisis_de_soluciones.push({
        id: `sol_${copia.siguiente_id}`,
        eslabon_objetivo: nodo.etiqueta,
        eslabon_id: nodo.id,
        alternativa_habil: texto,
        tipo_estrategia: antes ? "antecedente" : "respuesta",
      });
      copia.siguiente_id += 1;
    });
  }

  const apoyoSituacion = apoyoCadena(deSituacion);

  const cadena = (
    <div className="min-w-0 space-y-4">
      {conductas.length > 1 && (
        <div className="flex flex-wrap items-center gap-2 print:hidden">
          <span className="font-mono text-[10px] uppercase tracking-wide text-ink-muted">Conducta problema</span>
          {conductas.map((conducta) => <button key={conducta.id} type="button" aria-pressed={conducta.id === elegida.id} onClick={() => setIdElegido(conducta.id)} className="rounded-full border border-divider px-3 py-1 text-xs text-ink aria-pressed:border-accent aria-pressed:bg-accent/10 aria-pressed:text-accent">{conducta.etiqueta}</button>)}
        </div>
      )}

      <section className="rounded-xl border border-divider bg-surface" data-situacion-id={situacion.id}>
        <header className="flex items-start gap-2 border-b border-divider px-4 py-3">
          <button type="button" onClick={() => setAbierta((v) => !v)} aria-expanded={abierta} aria-label={abierta ? "Plegar la cadena" : "Desplegar la cadena"} className="mt-0.5 rounded p-0.5 text-ink-muted hover:text-ink">
            <ChevronDown className={`h-4 w-4 transition ${abierta ? "" : "-rotate-90"}`} aria-hidden="true" />
          </button>
          <div className="min-w-0">
            <h4 className="font-serif text-base font-semibold text-ink">{situacion.nombre}</h4>
            <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-ink-muted">Apoyo de la situación: <PildoraApoyo apoyo={apoyoSituacion} /></p>
          </div>
        </header>

        {abierta && (
          <div ref={cadenaRef} className="@container relative px-4 pb-2">
            <svg className="pointer-events-none absolute inset-0 z-0 h-full w-full overflow-visible" aria-hidden="true">
              <defs><marker id="punta-dbt" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto"><path d="M0,0 L7,3.5 L0,7 z" fill="currentColor" /></marker></defs>
              {trazos.map((t) => <path key={t.id} d={t.d} fill="none" stroke="currentColor" strokeWidth="1.2" strokeDasharray="4 4" className={t.clase} markerEnd="url(#punta-dbt)" />)}
            </svg>

            <div className="relative z-10 grid gap-x-10 @3xl:grid-cols-[minmax(0,1fr)_14rem]">
              <div className="min-w-0">
                {fases.map((fase, indiceFase) => (
                  <section key={fase.clave} aria-label={fase.titulo} className="grid gap-3 border-t border-divider py-4 first:border-t-0 @xl:grid-cols-[10rem_minmax(0,1fr)]">
                    <header className="flex gap-3 @xl:border-r @xl:border-divider @xl:pr-3">
                      <span aria-hidden="true" className="grid h-7 w-7 flex-none place-items-center rounded-full border border-divider bg-canvas font-serif text-sm text-ink">{indiceFase + 1}</span>
                      <div className="min-w-0">
                        <h5 className="font-serif text-[15px] font-semibold leading-tight text-ink">{fase.titulo}</h5>
                        <p className="mt-1 text-xs leading-snug text-ink-muted">{fase.descripcion}</p>
                      </div>
                    </header>
                    <div className="min-w-0">
                      {fase.nodos.length === 0 && <p className="rounded-lg border border-dashed border-divider px-3 py-2 text-xs text-ink-muted">Sin elementos registrados en esta fase.</p>}
                      {fase.nodos.map((n) => {
                        const ultimo = orden.at(-1)?.id === n.id;
                        const total = totalIntervenciones(n);
                        return (
                          <Fragment key={n.id}>
                            {renderNodo(n)}
                            {(!ultimo || total > 0) && <Enlace total={total} flecha={!ultimo} onAbrir={() => onSeleccionar(n)} />}
                          </Fragment>
                        );
                      })}
                    </div>
                  </section>
                ))}
              </div>

              {reglas.length > 0 && (
                <aside aria-label="Reglas verbales" className="self-start border-t border-divider py-4 @3xl:mt-4 @3xl:rounded-xl @3xl:border @3xl:bg-canvas/60 @3xl:p-3">
                  <h5 className="flex items-center gap-2 font-serif text-sm font-semibold text-ink"><Link2 className="h-4 w-4 text-ink-muted" aria-hidden="true" />Reglas verbales</h5>
                  <div className="mt-3 space-y-2">{reglasVinculadas.map((n) => <Fragment key={n.id}>{renderNodo(n)}</Fragment>)}</div>
                  {reglasSueltas.length > 0 && (
                    <>
                      {reglasVinculadas.length > 0 && <p className="mt-3 text-[11px] text-ink-muted">Sin relación trazada con esta cadena</p>}
                      <div className="mt-2 space-y-2">{reglasSueltas.map((n) => <Fragment key={n.id}>{renderNodo(n)}</Fragment>)}</div>
                    </>
                  )}
                </aside>
              )}
            </div>
          </div>
        )}
      </section>

      {(analisis.capa_dbt.eslabon_ausente || analisis.capa_dbt.plan_de_reparacion || sinEslabon.length > 0 || (fases[0].nodos.length === 0 && analisis.capa_dbt.plan_de_prevencion.length > 0)) && (
        <div className="grid gap-3 md:grid-cols-2">
          {analisis.capa_dbt.eslabon_ausente && <Bloque titulo="Eslabón ausente">{analisis.capa_dbt.eslabon_ausente}</Bloque>}
          {analisis.capa_dbt.plan_de_reparacion && <Bloque titulo="Plan de reparación">{analisis.capa_dbt.plan_de_reparacion}</Bloque>}
          {fases[0].nodos.length === 0 && analisis.capa_dbt.plan_de_prevencion.length > 0 && <Bloque titulo="Prevención"><ul className="list-disc pl-4">{analisis.capa_dbt.plan_de_prevencion.map((p, i) => <li key={i}>{p}</li>)}</ul></Bloque>}
          {sinEslabon.length > 0 && <Bloque titulo="Intervenciones sin eslabón identificado"><ul className="space-y-1.5">{sinEslabon.map((x) => <li key={x.clave}>{x.texto}<span className="block text-xs text-ink-muted">Para: {x.objetivo}</span></li>)}</ul></Bloque>}
        </div>
      )}
    </div>
  );

  const aristasSel = nodoSel ? analisis.aristas.filter((a) => a.desde === nodoSel.id || a.hasta === nodoSel.id) : [];
  const fila = (id: string, aristaId: string) => {
    const otro = nodos.find((n) => n.id === id);
    if (!otro) return null;
    return (
      <div key={aristaId} className="flex items-center gap-2">
        <button type="button" onClick={() => onSeleccionar(otro)} className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg border border-divider bg-surface px-2.5 py-2 text-left hover:border-ink-muted/40">
          <IconoNodo nodo={otro} className="h-4 w-4 flex-none text-ink-muted" />
          <span className="min-w-0"><span className="block truncate text-sm text-ink">{otro.etiqueta}</span><span className="block text-[11px] text-ink-muted">{subtipoDeNodo(otro) ?? describirTipo(otro)}</span></span>
        </button>
        <button type="button" onClick={() => onEditar((copia) => { copia.aristas = copia.aristas.filter((a) => a.id !== aristaId); })} aria-label={`Quitar la relación con ${otro.etiqueta}`} title="Quitar relación" className="rounded p-1 text-ink-muted hover:text-warn"><X className="h-3.5 w-3.5" aria-hidden="true" /></button>
      </div>
    );
  };

  const faseSel = nodoSel ? faseDe.get(nodoSel.id) : undefined;
  const reglaSel = nodoSel?.tipo === "regla_verbal" ? analisis.capa_act.reglas_verbales.find((r) => r.id === nodoSel.id) : null;
  const intervencionesSel = nodoSel ? intervencionesDe(nodoSel) : [];
  const nodosIntervencion = faseSel === 3 ? alternativas : faseSel === 4 ? necesarias : [];

  const detalle = nodoSel ? (
    <div className="space-y-5">
      <div className="flex items-start gap-3">
        <IconoNodo nodo={nodoSel} className="mt-0.5 h-5 w-5 flex-none text-accent" />
        <div className="min-w-0 flex-1">
          <p className="break-words text-[15px] leading-snug text-ink">{nodoSel.etiqueta}</p>
          <p className="mt-0.5 text-xs text-ink-muted">{subtipoDeNodo(nodoSel) ?? describirTipo(nodoSel)}</p>
        </div>
        <PildoraApoyo apoyo={nodoSel.apoyo} />
      </div>

      <section>
        <h5 className="font-serif text-sm font-semibold text-ink">Evidencia en la nota</h5>
        <p className="mt-1 text-xs text-ink-muted">{describirGrado(gradoDeNumero(nodoSel.apoyo)).frase}</p>
        {nodoSel.evidencia
          ? <Cita>{nodoSel.evidencia}</Cita>
          : <p className="mt-2 font-mono text-[10px] uppercase tracking-wide text-ink-muted">Inferido — sin cita literal en la nota</p>}
        {nodoSel.tipo === "encubierta" && evidenciaSel && <p className="mt-1 text-[11px] text-ink-muted">La cita respalda la cadena de la situación, no solo este eslabón.</p>}
      </section>

      <section>
        <h5 className="font-serif text-sm font-semibold text-ink">Función en la cadena</h5>
        <div className="mt-1 space-y-1.5 text-sm leading-relaxed text-ink">
          {faseSel !== undefined && <p><span className="text-ink-muted">{fases[faseSel].titulo}:</span> {fases[faseSel].descripcion.toLowerCase()}</p>}
          {reglaSel?.analisis && <p>{reglaSel.analisis}</p>}
          {nodoSel.tipo === "regla_verbal" && !reglaSel?.analisis && <p className="text-ink-muted">Modula la cadena sin ser un paso de ella.</p>}
          {faseSel !== undefined && faseSel >= 3 && situacion.funcion_hipotetizada && <p><span className="text-ink-muted">Función hipotetizada de la situación:</span> {situacion.funcion_hipotetizada}</p>}
        </div>
      </section>

      <section>
        <h5 className="font-serif text-sm font-semibold text-ink">Intervención sugerida</h5>
        {intervencionesSel.length === 0 && nodosIntervencion.length === 0 && (
          <p className="mt-1 inline-flex items-center gap-1.5 text-xs text-ink-muted"><Circle className="h-2.5 w-2.5" aria-hidden="true" />Sin intervención vinculada</p>
        )}
        <div className="mt-2 space-y-2">
          {intervencionesSel.map((x) => (
            <div key={x.clave} className="rounded-lg bg-accent-soft px-3 py-2 text-sm leading-relaxed text-ink">
              {x.texto}
              {x.momento && <span className="mt-0.5 block text-[11px] text-ink-muted">{x.momento}</span>}
            </div>
          ))}
          {nodosIntervencion.map((n) => <Fragment key={n.id}>{renderNodo(n)}</Fragment>)}
        </div>
        {nodoSel.tipo !== "regla_verbal" && !nodoSel.alternativa && (
          <button type="button" onClick={() => agregarIntervencion(nodoSel)} className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-accent/40 px-3 py-1.5 text-xs font-medium text-accent transition hover:bg-accent-soft">
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />Añadir intervención
          </button>
        )}
      </section>

      {aristasSel.length > 0 && (
        <section>
          <h5 className="font-serif text-sm font-semibold text-ink">Conexiones</h5>
          <div className="mt-2 grid gap-2 text-xs text-ink-muted">
            {aristasSel.some((a) => a.hasta === nodoSel.id) && <div className="grid grid-cols-[4.5rem_minmax(0,1fr)] items-start gap-2"><span className="pt-2.5">Recibe de</span><div className="space-y-1.5">{aristasSel.filter((a) => a.hasta === nodoSel.id).map((a) => fila(a.desde, a.id))}</div></div>}
            {aristasSel.some((a) => a.desde === nodoSel.id) && <div className="grid grid-cols-[4.5rem_minmax(0,1fr)] items-start gap-2"><span className="pt-2.5">Lleva a</span><div className="space-y-1.5">{aristasSel.filter((a) => a.desde === nodoSel.id).map((a) => fila(a.hasta, a.id))}</div></div>}
          </div>
        </section>
      )}

      <section>
        <h5 className="font-serif text-sm font-semibold text-ink">Nota en bruto relacionada</h5>
        <div ref={notaRef} className="relative mt-2 max-h-56 overflow-y-auto rounded-lg border border-divider bg-canvas p-2 font-mono text-[11px] leading-relaxed">
          {lineas.map((linea, indice) => {
            const n = indice + 1;
            const citada = evidenciaSel && n >= evidenciaSel.linea_inicio && n <= evidenciaSel.linea_fin;
            return <p id={`nota-linea-${n}`} key={indice} className={`rounded px-1 ${lineaActiva === n || citada ? "bg-warn/15 text-ink" : "text-ink-muted"}`}><span className="mr-2 select-none text-ink-muted">L{n}</span>{linea || " "}</p>;
          })}
        </div>
      </section>
    </div>
  ) : (
    <p className="text-sm text-ink-muted">Selecciona un eslabón para ver su detalle. Doble clic sobre una tarjeta para editar su texto.</p>
  );

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      {cadena}
      {nodoSel && <div className="fixed inset-0 z-40 bg-ink/20 xl:hidden print:hidden" onClick={onCerrar} aria-hidden="true" />}
      <aside
        aria-label="Detalle del eslabón"
        className={`${nodoSel ? "fixed inset-x-0 bottom-0 z-50 max-h-[85vh] overflow-y-auto rounded-t-2xl border-t shadow-xl md:inset-y-0 md:left-auto md:w-[26rem] md:max-h-none md:rounded-none md:border-l md:border-t-0" : "hidden"} border-divider bg-surface p-4 print:hidden xl:sticky xl:inset-auto xl:top-4 xl:z-auto xl:block xl:max-h-[calc(100vh-2rem)] xl:w-auto xl:self-start xl:rounded-xl xl:border xl:shadow-none`}
      >
        <header className="mb-4 flex items-center justify-between gap-2">
          <h4 className="font-serif text-base font-semibold text-ink">Detalle del eslabón</h4>
          {nodoSel && <button type="button" onClick={onCerrar} aria-label="Cerrar el detalle" className="rounded p-1 text-ink-muted hover:text-ink"><X className="h-4 w-4" aria-hidden="true" /></button>}
        </header>
        {detalle}
      </aside>
    </div>
  );
}
