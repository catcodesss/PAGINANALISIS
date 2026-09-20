"use client";

import {
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import type { AnalisisFuncional, TipoArista } from "@/lib/types";
import {
  CARRILES_GRAFO,
  agregarArista,
  agregarNodo,
  apoyoCadena,
  actualizarEtiquetaNodo,
  borrarNodo,
  construirNodosGrafo,
  huecosDeSituacion,
  type CarrilGrafo,
  type NodoGrafo,
  type TipoNodoGrafo,
} from "@/lib/grafo";

interface GrafoAFCProps {
  analisis: AnalisisFuncional;
  notaOriginal: string;
  onEditar: (mutar: (copia: AnalisisFuncional) => void) => void;
}

interface Trazo {
  id: string;
  d: string;
  tipo: TipoArista;
}

const ETIQUETA_TIPO: Record<TipoNodoGrafo, string> = {
  om: "OM",
  moduladora: "Moduladora",
  ed: "Ed",
  ec: "EC",
  regla_verbal: "Regla verbal",
  encubierta: "Encubierta",
  conducta: "Conducta",
  repertorio: "Repertorio activo",
  alternativa: "Conducta alternativa",
  consecuencia: "Consecuencia",
  consecuencia_alternativa: "Consecuencia necesaria",
  funcion: "Función",
  valor: "Valor",
};

const CLASE_TIPO: Record<TipoNodoGrafo, string> = {
  om: "border-l-sky-500",
  moduladora: "border-l-violet-500",
  ed: "border-l-amber-500",
  ec: "border-l-amber-500",
  regla_verbal: "border-l-fuchsia-500",
  encubierta: "border-l-indigo-500",
  conducta: "border-l-accent",
  repertorio: "border-l-emerald-500",
  alternativa: "border-l-emerald-500",
  consecuencia: "border-l-rose-500",
  consecuencia_alternativa: "border-l-emerald-500",
  funcion: "border-l-cyan-500",
  valor: "border-l-teal-500",
};

function etiquetaApoyo(apoyo: number) {
  return apoyo === 3
    ? "Apoyo completo: cita verificada"
    : apoyo === 2
      ? "Apoyo parcial"
      : "Inferencia sin cita";
}

function Nodo({
  nodo,
  seleccionado,
  atenuado,
  conectando,
  onSeleccionar,
  onEditar,
  onCita,
}: {
  nodo: NodoGrafo;
  seleccionado: boolean;
  atenuado: boolean;
  conectando: boolean;
  onSeleccionar: (nodo: NodoGrafo) => void;
  onEditar: (nodo: NodoGrafo, texto: string) => void;
  onCita: (nodo: NodoGrafo) => void;
}) {
  const [editando, setEditando] = useState(false);
  const [texto, setTexto] = useState(nodo.etiqueta);

  function guardar() {
    const limpio = texto.trim();
    setEditando(false);
    if (limpio && limpio !== nodo.etiqueta) onEditar(nodo, limpio);
  }

  function manejarTecla(evento: KeyboardEvent<HTMLElement>) {
    if (evento.key === "Enter" || evento.key === " ") {
      evento.preventDefault();
      onSeleccionar(nodo);
    }
  }

  return (
    <article
      data-nodo-id={nodo.id}
      role="button"
      tabIndex={0}
      aria-label={`${ETIQUETA_TIPO[nodo.tipo]}: ${nodo.etiqueta}${conectando ? ". Seleccionar para conectar" : ""}`}
      onClick={() => onSeleccionar(nodo)}
      onDoubleClick={() => {
        setTexto(nodo.etiqueta);
        setEditando(true);
      }}
      onKeyDown={manejarTecla}
      className={`relative min-w-0 rounded-lg border border-divider border-l-4 bg-surface p-2.5 shadow-sm transition ${CLASE_TIPO[nodo.tipo]} ${seleccionado ? "ring-2 ring-accent/50" : ""} ${atenuado ? "opacity-25" : ""} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent`}
    >
      <button
        type="button"
        className="absolute inset-x-0 top-0 h-3 cursor-pointer overflow-hidden rounded-t-lg"
        aria-label={`${etiquetaApoyo(nodo.apoyo)}. Ir a la línea citada`}
        onClick={(evento) => {
          evento.stopPropagation();
          onCita(nodo);
        }}
      >
        <span
          className="block h-1 bg-accent"
          style={{ width: `${nodo.apoyo === 3 ? 100 : nodo.apoyo === 2 ? 66 : 33}%`, opacity: nodo.apoyo === 3 ? 1 : nodo.apoyo === 2 ? 0.66 : 0.42 }}
        />
      </button>
      <p className="mt-1 font-mono text-[10px] uppercase tracking-wide text-ink-muted">
        {ETIQUETA_TIPO[nodo.tipo]}
      </p>
      {editando ? (
        <input
          autoFocus
          value={texto}
          aria-label={`Editar ${ETIQUETA_TIPO[nodo.tipo]}`}
          onClick={(evento) => evento.stopPropagation()}
          onChange={(evento) => setTexto(evento.target.value)}
          onBlur={guardar}
          onKeyDown={(evento) => {
            evento.stopPropagation();
            if (evento.key === "Enter") guardar();
            if (evento.key === "Escape") {
              setTexto(nodo.etiqueta);
              setEditando(false);
            }
          }}
          className="mt-1 w-full rounded border border-accent bg-canvas px-1.5 py-1 text-sm text-ink outline-none"
        />
      ) : (
        <p className="mt-1 break-words text-sm leading-snug text-ink">{nodo.etiqueta}</p>
      )}
      {nodo.detalle && <p className="mt-1 text-[11px] text-ink-muted">{nodo.detalle}</p>}
    </article>
  );
}

function BotonAgregarNodo({
  carril,
  situacionId,
  alternativa,
  nodos,
  onAgregar,
}: {
  carril: CarrilGrafo;
  situacionId: string;
  alternativa: boolean;
  nodos: readonly NodoGrafo[];
  onAgregar: (tipo: TipoNodoGrafo, texto: string) => void;
}) {
  const tipos: TipoNodoGrafo[] = alternativa
    ? carril === "conducta"
      ? ["alternativa"]
      : carril === "inmediata"
        ? ["consecuencia_alternativa"]
        : []
    : carril === "contexto"
      ? ["om", "moduladora"]
      : carril === "antecedente"
        ? ["ed", "ec", "regla_verbal"]
        : carril === "encubierto"
          ? ["encubierta"]
          : carril === "conducta"
            ? ["conducta"]
            : ["consecuencia"];

  const disponibles = tipos.filter((tipo) => {
    if (!["om", "ed", "ec"].includes(tipo)) return true;
    return !nodos.some((n) => n.situacion_id === situacionId && n.tipo === tipo);
  }).filter((tipo) => {
    if (tipo === "consecuencia") {
      return !nodos.some(
        (n) => n.situacion_id === situacionId && n.tipo === tipo && n.carril === carril
      );
    }
    if (tipo === "consecuencia_alternativa") {
      return !nodos.some(
        (n) => n.situacion_id === situacionId && n.tipo === tipo
      );
    }
    return true;
  });
  if (disponibles.length === 0) return null;

  return (
    <div className="mt-2 flex flex-wrap gap-1 print:hidden">
      {disponibles.map((tipo) => (
        <button
          key={tipo}
          type="button"
          onClick={() => {
            const texto = window.prompt(`Texto para ${ETIQUETA_TIPO[tipo]}`)?.trim();
            if (texto) onAgregar(tipo, texto);
          }}
          className="rounded border border-dashed border-divider px-2 py-1 text-[10px] text-ink-muted transition hover:border-accent hover:text-accent"
        >
          + {ETIQUETA_TIPO[tipo]}
        </button>
      ))}
    </div>
  );
}

export default function GrafoAFC({ analisis, notaOriginal, onEditar }: GrafoAFCProps) {
  const contenedorRef = useRef<HTMLDivElement>(null);
  const pila = useRef<AnalisisFuncional[]>([]);
  const rehacer = useRef<AnalisisFuncional[]>([]);
  const [seleccionado, setSeleccionado] = useState<string | null>(null);
  const [modoConectar, setModoConectar] = useState(false);
  const [origenConexion, setOrigenConexion] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<1 | 2 | 3 | null>(null);
  const [soloApoyado, setSoloApoyado] = useState(false);
  const [lineaActiva, setLineaActiva] = useState<number | null>(null);
  const [trazos, setTrazos] = useState<Trazo[]>([]);
  const [puedeDeshacer, setPuedeDeshacer] = useState(false);
  const [puedeRehacer, setPuedeRehacer] = useState(false);
  const nodos = useMemo(() => construirNodosGrafo(analisis), [analisis]);
  const nodoSeleccionado = nodos.find((n) => n.id === seleccionado) ?? null;
  const lineas = useMemo(() => notaOriginal.replace(/\r\n/g, "\n").split("\n"), [notaOriginal]);

  function aplicar(mutacion: (copia: AnalisisFuncional) => void) {
    pila.current.push(structuredClone(analisis));
    if (pila.current.length > 80) pila.current.shift();
    rehacer.current = [];
    setPuedeDeshacer(true);
    setPuedeRehacer(false);
    onEditar(mutacion);
  }

  function restaurar(estado: AnalisisFuncional) {
    onEditar((copia) => Object.assign(copia, structuredClone(estado)));
  }

  function deshacer() {
    const anterior = pila.current.pop();
    if (!anterior) return;
    rehacer.current.push(structuredClone(analisis));
    setPuedeDeshacer(pila.current.length > 0);
    setPuedeRehacer(true);
    setSeleccionado(null);
    restaurar(anterior);
  }

  function rehacerAccion() {
    const siguiente = rehacer.current.pop();
    if (!siguiente) return;
    pila.current.push(structuredClone(analisis));
    setPuedeDeshacer(true);
    setPuedeRehacer(rehacer.current.length > 0);
    setSeleccionado(null);
    restaurar(siguiente);
  }

  function seleccionarNodo(nodo: NodoGrafo) {
    if (!modoConectar) {
      setSeleccionado(nodo.id);
      return;
    }
    if (!origenConexion) {
      setOrigenConexion(nodo.id);
      setSeleccionado(nodo.id);
      return;
    }
    aplicar((copia) => agregarArista(copia, origenConexion, nodo.id));
    setOrigenConexion(null);
    setSeleccionado(nodo.id);
  }

  function irACita(nodo: NodoGrafo) {
    if (!nodo.evidencia?.verificada) return;
    setLineaActiva(nodo.evidencia.linea_inicio);
    requestAnimationFrame(() => {
      document.getElementById(`nota-linea-${nodo.evidencia?.verificada ? nodo.evidencia.linea_inicio : 0}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }

  useLayoutEffect(() => {
    const contenedor = contenedorRef.current;
    if (!contenedor) return;
    let fotograma = 0;
    const dibujar = () => {
      cancelAnimationFrame(fotograma);
      fotograma = requestAnimationFrame(() => {
        const raiz = contenedorRef.current;
        if (!raiz) return;
        const cajaRaiz = raiz.getBoundingClientRect();
        const caja = (id: string) => {
          const elemento = raiz.querySelector<HTMLElement>(`[data-nodo-id="${CSS.escape(id)}"]`);
          if (!elemento) return null;
          const rect = elemento.getBoundingClientRect();
          return { x: rect.left - cajaRaiz.left, y: rect.top - cajaRaiz.top, w: rect.width, h: rect.height };
        };
        setTrazos(analisis.aristas.flatMap((arista) => {
          const desde = caja(arista.desde);
          const hasta = caja(arista.hasta);
          if (!desde || !hasta) return [];
          const x1 = desde.x + desde.w;
          const y1 = desde.y + desde.h / 2;
          const x2 = hasta.x;
          const y2 = hasta.y + hasta.h / 2;
          const curva = Math.max(24, Math.abs(x2 - x1) / 2);
          return [{ id: arista.id, tipo: arista.tipo, d: `M ${x1} ${y1} C ${x1 + curva} ${y1}, ${x2 - curva} ${y2}, ${x2} ${y2}` }];
        }));
      });
    };
    dibujar();
    const observador = new ResizeObserver(dibujar);
    observador.observe(contenedor);
    window.addEventListener("resize", dibujar);
    window.addEventListener("scroll", dibujar, true);
    return () => {
      cancelAnimationFrame(fotograma);
      observador.disconnect();
      window.removeEventListener("resize", dibujar);
      window.removeEventListener("scroll", dibujar, true);
    };
  }, [analisis.aristas, nodos]);

  const globales = nodos.filter((n) => n.situacion_id === null);

  return (
    <div className="print:contents">
      <div className="mb-4 flex flex-wrap items-center gap-2 print:hidden">
        <button type="button" disabled={!puedeDeshacer} onClick={deshacer} className="rounded border border-divider px-3 py-1.5 text-xs text-ink disabled:opacity-40">Deshacer</button>
        <button type="button" disabled={!puedeRehacer} onClick={rehacerAccion} className="rounded border border-divider px-3 py-1.5 text-xs text-ink disabled:opacity-40">Rehacer</button>
        <button
          type="button"
          aria-pressed={modoConectar}
          onClick={() => { setModoConectar((v) => !v); setOrigenConexion(null); }}
          className={`rounded border px-3 py-1.5 text-xs ${modoConectar ? "border-accent bg-accent/10 text-accent" : "border-divider text-ink"}`}
        >
          {origenConexion ? "Elige el destino" : "Conectar"}
        </button>
        <span className="ml-auto text-xs text-ink-muted">{nodos.length} nodos · {analisis.aristas.length} relaciones</span>
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-2 text-xs print:hidden" aria-label="Filtro de apoyo en la nota">
        <span className="font-medium text-ink">Apoyo en la nota</span>
        {([3, 2, 1] as const).map((nivel) => (
          <button key={nivel} type="button" aria-pressed={filtro === nivel} onClick={() => setFiltro(filtro === nivel ? null : nivel)} className="rounded-full border border-divider px-2.5 py-1 text-ink-muted aria-pressed:border-accent aria-pressed:text-accent">
            <span className="mr-1 inline-block h-1 bg-accent align-middle" style={{ width: nivel === 3 ? 24 : nivel === 2 ? 16 : 8, opacity: nivel === 3 ? 1 : nivel === 2 ? .66 : .42 }} />
            {nivel === 3 ? "Con cita" : nivel === 2 ? "Parcial" : "Inferencia"}
          </button>
        ))}
        <label className="ml-2 flex items-center gap-1.5 text-ink-muted">
          <input type="checkbox" checked={soloApoyado} onChange={(e) => setSoloApoyado(e.target.checked)} />
          Ver solo lo apoyado por la nota
        </label>
      </div>

      <div className="grid min-w-0 gap-5 print:block">
        <div ref={contenedorRef} className="relative min-w-0 print:hidden">
          <svg className="pointer-events-none absolute inset-0 z-0 hidden h-full w-full overflow-visible md:block" aria-hidden="true">
            <defs><marker id="punta-afc" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto"><path d="M0,0 L7,3.5 L0,7 z" fill="currentColor" /></marker></defs>
            {trazos.map((trazo) => (
              <path key={trazo.id} d={trazo.d} fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray={trazo.tipo === "moderadora" ? "5 4" : undefined} className={trazo.tipo === "bucle" ? "text-warn" : "text-ink-muted/60"} markerEnd="url(#punta-afc)" />
            ))}
          </svg>

          <div className="relative z-10 hidden grid-cols-6 gap-2 px-2 md:grid">
            {CARRILES_GRAFO.map((carril) => <div key={carril.id} className="pb-2 font-mono text-[10px] uppercase tracking-wide text-ink-muted"><b className="block text-ink">{carril.titulo}</b>{carril.subtitulo}</div>)}
          </div>

          {globales.length > 0 && (
            <section className="relative z-10 mb-4 rounded-lg border border-divider bg-canvas/60 p-3">
              <h4 className="mb-2 font-serif text-sm font-semibold text-ink">Entidades del caso fuera de una situación concreta</h4>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {globales.map((n) => <Nodo key={n.id} nodo={n} seleccionado={seleccionado === n.id} atenuado={(filtro !== null && n.apoyo !== filtro) || (soloApoyado && n.apoyo < 3)} conectando={modoConectar} onSeleccionar={seleccionarNodo} onEditar={(actual, texto) => aplicar((copia) => actualizarEtiquetaNodo(copia, actual.id, texto))} onCita={irACita} />)}
              </div>
            </section>
          )}

          <div className="relative z-10 space-y-4">
            {analisis.situaciones.map((situacion) => {
              const deSituacion = nodos.filter((n) => n.situacion_id === situacion.id);
              const apoyo = apoyoCadena(deSituacion);
              const huecos = huecosDeSituacion(analisis, situacion, nodos);
              return (
                <section key={situacion.id} className="overflow-hidden rounded-xl border border-divider bg-canvas/40" data-situacion-id={situacion.id}>
                  <header className="flex flex-wrap items-center gap-2 border-b border-divider bg-surface px-3 py-2">
                    <h4 className="font-serif text-base font-semibold text-ink">{situacion.nombre}</h4>
                    <span className="ml-auto text-[11px] text-ink-muted">Apoyo de la cadena: <span className="inline-block h-1 bg-accent align-middle" style={{ width: apoyo === 3 ? 34 : apoyo === 2 ? 23 : 11, opacity: apoyo === 3 ? 1 : apoyo === 2 ? .66 : .42 }} /> · lo marca el eslabón más débil</span>
                  </header>
                  <div className="grid grid-cols-1 gap-2 p-2 md:grid-cols-6">
                    {CARRILES_GRAFO.map((carril) => {
                      const deCelda = deSituacion.filter((n) => n.carril === carril.id && !n.alternativa && n.tipo !== "funcion");
                      const huecosCelda = huecos.filter((h) => h.carril === carril.id);
                      return <div key={carril.id} className="min-w-0 rounded-md border border-divider/60 p-1.5" data-carril={carril.titulo}>
                        <p className="mb-1 font-mono text-[9px] uppercase tracking-wide text-ink-muted md:hidden">{carril.titulo}</p>
                        <div className="space-y-2">{deCelda.map((n) => <Nodo key={n.id} nodo={n} seleccionado={seleccionado === n.id} atenuado={(filtro !== null && n.apoyo !== filtro) || (soloApoyado && n.apoyo < 3)} conectando={modoConectar} onSeleccionar={seleccionarNodo} onEditar={(actual, texto) => aplicar((copia) => actualizarEtiquetaNodo(copia, actual.id, texto))} onCita={irACita} />)}
                          {huecosCelda.map((h) => <div key={h.id} className="rounded-lg border border-dashed border-divider p-2 text-xs text-ink-muted">{h.etiqueta}</div>)}
                        </div>
                        <BotonAgregarNodo carril={carril.id} situacionId={situacion.id} alternativa={false} nodos={nodos} onAgregar={(tipo, texto) => aplicar((copia) => agregarNodo(copia, situacion.id, tipo, texto))} />
                      </div>;
                    })}
                  </div>
                  <div className="border-t border-dashed border-divider bg-surface/60 p-2">
                    <p className="mb-2 text-[11px] font-medium text-ink-muted">Conducta alternativa · compite por la misma contingencia</p>
                    <div className="grid grid-cols-1 gap-2 md:grid-cols-6">
                      {CARRILES_GRAFO.map((carril) => <div key={carril.id} className="min-w-0 p-1">
                        {deSituacion.filter((n) => n.carril === carril.id && n.alternativa).map((n) => <Nodo key={n.id} nodo={n} seleccionado={seleccionado === n.id} atenuado={(filtro !== null && n.apoyo !== filtro) || (soloApoyado && n.apoyo < 3)} conectando={modoConectar} onSeleccionar={seleccionarNodo} onEditar={(actual, texto) => aplicar((copia) => actualizarEtiquetaNodo(copia, actual.id, texto))} onCita={irACita} />)}
                        <BotonAgregarNodo carril={carril.id} situacionId={situacion.id} alternativa nodos={nodos} onAgregar={(tipo, texto) => {
                          if (tipo === "consecuencia_alternativa") {
                            const alt = deSituacion.find((n) => n.tipo === "alternativa");
                            if (alt) aplicar((copia) => actualizarEtiquetaNodo(copia, `${alt.id}_consecuencia`, texto));
                          } else aplicar((copia) => agregarNodo(copia, situacion.id, tipo, texto));
                        }} />
                      </div>)}
                    </div>
                  </div>
                  <footer className="flex justify-end border-t border-divider px-3 py-2">
                    {deSituacion.filter((n) => n.tipo === "funcion").map((n) => <button key={n.id} type="button" data-nodo-id={n.id} onClick={() => seleccionarNodo(n)} className="rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-xs text-accent"><span className="font-mono uppercase">Función · </span>{n.etiqueta}</button>)}
                    {!deSituacion.some((n) => n.tipo === "funcion") && <button type="button" onClick={() => { const texto = window.prompt("Función hipotetizada")?.trim(); if (texto) aplicar((copia) => agregarNodo(copia, situacion.id, "funcion", texto)); }} className="text-xs text-ink-muted underline decoration-dashed">+ función hipotetizada</button>}
                  </footer>
                </section>
              );
            })}
          </div>
        </div>

        <aside className="grid min-w-0 gap-5 rounded-lg border border-divider bg-canvas p-3 md:grid-cols-2 print:hidden">
          <div>
          <h4 className="font-serif text-base font-semibold text-ink">Ficha</h4>
          {nodoSeleccionado ? <div className="mt-3 space-y-3">
            <label className="block text-xs text-ink-muted">Etiqueta
              <textarea key={nodoSeleccionado.id + nodoSeleccionado.etiqueta} defaultValue={nodoSeleccionado.etiqueta} onBlur={(e) => {
                const valor = e.target.value.trim();
                if (valor && valor !== nodoSeleccionado.etiqueta) aplicar((copia) => actualizarEtiquetaNodo(copia, nodoSeleccionado.id, valor));
              }} rows={3} className="mt-1 w-full rounded border border-divider bg-surface p-2 text-sm text-ink" />
            </label>
            <dl className="space-y-1 text-xs"><div><dt className="inline text-ink-muted">Tipo: </dt><dd className="inline text-ink">{ETIQUETA_TIPO[nodoSeleccionado.tipo]}</dd></div><div><dt className="inline text-ink-muted">Confianza: </dt><dd className="inline text-ink">{nodoSeleccionado.confianza}</dd></div><div><dt className="inline text-ink-muted">Apoyo: </dt><dd className="inline text-ink">{etiquetaApoyo(nodoSeleccionado.apoyo)}</dd></div></dl>
            <button type="button" onClick={() => aplicar((copia) => borrarNodo(copia, nodoSeleccionado.id))} className="rounded border border-warn/50 px-2 py-1 text-xs text-warn">Borrar nodo</button>
            <div className="border-t border-divider pt-3"><p className="mb-2 text-xs font-medium text-ink">Relaciones del nodo</p>{analisis.aristas.filter((a) => a.desde === nodoSeleccionado.id || a.hasta === nodoSeleccionado.id).map((a) => <div key={a.id} className="mb-1 flex items-center gap-2 text-[11px] text-ink-muted"><span className="min-w-0 flex-1 truncate">{a.desde} → {a.hasta}</span><button type="button" aria-label={`Borrar relación ${a.id}`} onClick={() => aplicar((copia) => { copia.aristas = copia.aristas.filter((actual) => actual.id !== a.id); })} className="text-warn">Borrar</button></div>)}</div>
          </div> : <p className="mt-3 text-sm text-ink-muted">Selecciona un nodo. Doble clic sobre su etiqueta para editarla en el grafo.</p>}
          </div>
          <div><h5 className="font-serif text-sm font-semibold text-ink">Nota en bruto</h5><div className="mt-2 max-h-80 overflow-y-auto rounded border border-divider bg-surface p-2 font-mono text-[11px] leading-relaxed">{lineas.map((linea, indice) => <p id={`nota-linea-${indice + 1}`} key={indice} className={`rounded px-1 ${lineaActiva === indice + 1 ? "bg-warn/20 text-ink ring-1 ring-warn/40" : "text-ink-muted"}`}><span className="mr-2 select-none text-ink-muted">L{indice + 1}</span>{linea || " "}</p>)}</div></div>
        </aside>
      </div>

      <div className="hidden print:block">
        {analisis.situaciones.map((situacion) => <table key={situacion.id} className="mb-5 w-full table-fixed border-collapse text-xs"><caption className="mb-2 text-left font-serif text-base font-semibold">{situacion.nombre}</caption><thead><tr>{["ED", "OM", "RO", "C", "CMLP"].map((h) => <th key={h} className="border border-divider p-2 text-left">{h}</th>)}</tr></thead><tbody><tr><td className="border border-divider p-2">{situacion.cadena_operante?.antecedente || "—"}</td><td className="border border-divider p-2">{situacion.cadena_operante?.operacion_motivacional || "—"}</td><td className="border border-divider p-2">{situacion.cadena_operante?.respuesta || "—"}</td><td className="border border-divider p-2">{situacion.cadena_operante?.consecuencia.texto || "—"}</td><td className="border border-divider p-2">{situacion.cadena_operante?.consecuencias_largo_plazo?.texto || "—"}</td></tr></tbody></table>)}
      </div>
    </div>
  );
}
