"use client";

import {
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import type { AnalisisFuncional, TipoArista } from "@/lib/types";
import type { EstiloGrafo } from "@/lib/preferencias";
import {
  agregarArista,
  agregarNodo,
  actualizarEtiquetaNodo,
  borrarNodo,
  construirNodosGrafo,
  type CarrilGrafo,
  type NodoGrafo,
  type TipoNodoGrafo,
} from "@/lib/grafo";
import {
  Activity,
  ArrowBigRightDash,
  Brain,
  CircleDot,
  Clock3,
  Cloud,
  Compass,
  Footprints,
  HeartPulse,
  MessageSquareQuote,
  PersonStanding,
  Signpost,
  SlidersHorizontal,
  Smile,
  Sprout,
  Target,
  TrendingDown,
  Wrench,
  Zap,
} from "lucide-react";
import VistaAFC from "./estilos/afc";
import VistaACT from "./estilos/act";
import VistaDBT from "./estilos/dbt";
import VistaMC from "./estilos/mc";
import s from "./afc.module.css";
import { interAfc, poppinsAfc } from "./fuentesAfc";

interface GrafoAFCProps {
  analisis: AnalisisFuncional;
  notaOriginal: string;
  estilo: EstiloGrafo;
  onEditar: (mutar: (copia: AnalisisFuncional) => void) => void;
}

interface Trazo {
  id: string;
  d: string;
  tipo: TipoArista;
  desde: string;
  hasta: string;
  /** Une nodos de tableros distintos (o uno global): cruzaría otras situaciones. */
  lejana?: boolean;
}

interface Caja { x: number; y: number; w: number; h: number }

/**
 * En AFC hay nodos apilados en la misma columna (encubiertas y conducta), así
 * que la curva lateral de siempre los cruzaría por encima: si los nodos se
 * solapan en horizontal, la relación sale por abajo y entra por arriba.
 */
function trazadoAFC(desde: Caja, hasta: Caja): string {
  if (hasta.x >= desde.x + desde.w - 4) {
    const x1 = desde.x + desde.w, y1 = desde.y + desde.h / 2;
    const x2 = hasta.x, y2 = hasta.y + hasta.h / 2;
    const curva = Math.max(18, (x2 - x1) / 2);
    return `M ${x1} ${y1} C ${x1 + curva} ${y1}, ${x2 - curva} ${y2}, ${x2} ${y2}`;
  }
  if (hasta.x + hasta.w <= desde.x + 4) {
    const x1 = desde.x, y1 = desde.y + desde.h / 2;
    const x2 = hasta.x + hasta.w, y2 = hasta.y + hasta.h / 2;
    const curva = Math.max(18, (x1 - x2) / 2);
    return `M ${x1} ${y1} C ${x1 - curva} ${y1}, ${x2 + curva} ${y2}, ${x2} ${y2}`;
  }
  const x1 = desde.x + desde.w / 2, x2 = hasta.x + hasta.w / 2;
  const abajo = hasta.y >= desde.y;
  const y1 = abajo ? desde.y + desde.h : desde.y;
  const y2 = abajo ? hasta.y : hasta.y + hasta.h;
  const curva = Math.max(10, Math.abs(y2 - y1) / 2) * (abajo ? 1 : -1);
  return `M ${x1} ${y1} C ${x1} ${y1 + curva}, ${x2} ${y2 - curva}, ${x2} ${y2}`;
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

/** Solo apoyo visual para escanear: el texto del nodo dice lo que es. */
function IconoNodo({ nodo }: { nodo: NodoGrafo }) {
  const props = { className: s.icono, strokeWidth: 2.25, "aria-hidden": true } as const;
  switch (nodo.tipo) {
    case "om": return <Activity {...props} />;
    case "moduladora": return <SlidersHorizontal {...props} />;
    case "ed": return <Signpost {...props} />;
    case "ec": return <Zap {...props} />;
    case "regla_verbal": return <MessageSquareQuote {...props} />;
    case "encubierta":
      switch (nodo.detalle) {
        case "sensacion": return <HeartPulse {...props} />;
        case "pensamiento": return <Cloud {...props} />;
        case "emocion": return <Smile {...props} />;
        case "impulso": return <ArrowBigRightDash {...props} />;
        case "accion": return <Footprints {...props} />;
        default: return <Brain {...props} />;
      }
    case "conducta": return <PersonStanding {...props} />;
    case "repertorio": return <Wrench {...props} />;
    case "alternativa": return <Sprout {...props} />;
    case "consecuencia": return nodo.carril === "demorada" ? <TrendingDown {...props} /> : <Clock3 {...props} />;
    case "consecuencia_alternativa": return <Target {...props} />;
    case "valor": return <Compass {...props} />;
    default: return <CircleDot {...props} />;
  }
}

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
  variante,
}: {
  nodo: NodoGrafo;
  seleccionado: boolean;
  atenuado: boolean;
  conectando: boolean;
  onSeleccionar: (nodo: NodoGrafo) => void;
  onEditar: (nodo: NodoGrafo, texto: string) => void;
  onCita: (nodo: NodoGrafo) => void;
  variante?: "afc";
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

  const editor = (clase: string) => (
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
      className={clase}
    />
  );

  const barraApoyo = (clase: string) => (
    <button
      type="button"
      className={clase}
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
  );

  const comunes = {
    "data-nodo-id": nodo.id,
    role: "button",
    tabIndex: 0,
    "aria-label": `${ETIQUETA_TIPO[nodo.tipo]}: ${nodo.etiqueta}${conectando ? ". Seleccionar para conectar" : ""}`,
    onClick: () => onSeleccionar(nodo),
    onDoubleClick: () => {
      setTexto(nodo.etiqueta);
      setEditando(true);
    },
    onKeyDown: manejarTecla,
  } as const;

  if (variante === "afc") {
    const clases = [
      s.nodo,
      nodo.tipo === "encubierta" ? s.encubierta : "",
      nodo.tipo === "conducta" ? s.conducta : "",
      seleccionado ? s.seleccionado : "",
      atenuado ? s.atenuado : "",
    ].join(" ");
    return (
      <article {...comunes} className={clases}>
        {barraApoyo(s.barraApoyo)}
        <div className={s.nodoCuerpo}>
          <IconoNodo nodo={nodo} />
          <div className={s.nodoTexto}>
            <span className={s.chip}>{ETIQUETA_TIPO[nodo.tipo]}</span>
            {editando ? editor(s.editor) : <p className={s.etiqueta}>{nodo.etiqueta}</p>}
            {nodo.detalle && <p className={s.detalle}>{nodo.detalle}</p>}
          </div>
        </div>
      </article>
    );
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
  variante,
}: {
  carril: CarrilGrafo;
  situacionId: string;
  alternativa: boolean;
  nodos: readonly NodoGrafo[];
  onAgregar: (tipo: TipoNodoGrafo, texto: string) => void;
  variante?: "afc";
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

  const afc = variante === "afc";
  return (
    <div className={afc ? `${s.agregar} print:hidden` : "mt-2 flex flex-wrap gap-1 print:hidden"}>
      {disponibles.map((tipo) => (
        <button
          key={tipo}
          type="button"
          onClick={() => {
            const texto = window.prompt(`Texto para ${ETIQUETA_TIPO[tipo]}`)?.trim();
            if (texto) onAgregar(tipo, texto);
          }}
          className={afc ? s.agregarBoton : "rounded border border-dashed border-divider px-2 py-1 text-[10px] text-ink-muted transition hover:border-accent hover:text-accent"}
        >
          + {ETIQUETA_TIPO[tipo]}
        </button>
      ))}
    </div>
  );
}

export default function GrafoAFC({ analisis, notaOriginal, estilo, onEditar }: GrafoAFCProps) {
  const contenedorRef = useRef<HTMLDivElement>(null);
  const redibujar = useRef<() => void>(() => {});
  const pila =useRef<AnalisisFuncional[]>([]);
  const rehacer = useRef<AnalisisFuncional[]>([]);
  const [seleccionado, setSeleccionado] = useState<string | null>(null);
  const [modoConectar, setModoConectar] = useState(false);
  const [origenConexion, setOrigenConexion] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<1 | 2 | 3 | null>(null);
  const [soloApoyado, setSoloApoyado] = useState(false);
  const [lineaActiva, setLineaActiva] = useState<number | null>(null);
  const [bajoPuntero, setBajoPuntero] = useState<string | null>(null);
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
        const situacionDe = (id: string) =>
          raiz.querySelector<HTMLElement>(`[data-nodo-id="${CSS.escape(id)}"]`)?.closest<HTMLElement>("[data-situacion-id]")?.dataset.situacionId ?? null;
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
          if (estilo === "afc") {
            const origen = situacionDe(arista.desde);
            const lejana = origen === null || origen !== situacionDe(arista.hasta);
            return [{ id: arista.id, tipo: arista.tipo, desde: arista.desde, hasta: arista.hasta, lejana, d: trazadoAFC(desde, hasta) }];
          }
          const x1 = desde.x + desde.w;
          const y1 = desde.y + desde.h / 2;
          const x2 = hasta.x;
          const y2 = hasta.y + hasta.h / 2;
          const curva = Math.max(24, Math.abs(x2 - x1) / 2);
          return [{ id: arista.id, tipo: arista.tipo, desde: arista.desde, hasta: arista.hasta, d: `M ${x1} ${y1} C ${x1 + curva} ${y1}, ${x2 - curva} ${y2}, ${x2} ${y2}` }];
        }));
      });
    };
    redibujar.current = dibujar;
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
  }, [analisis.aristas, nodos, estilo]);

  const renderNodo = (n: NodoGrafo) => (
    <Nodo
      nodo={n}
      seleccionado={seleccionado === n.id}
      atenuado={(filtro !== null && n.apoyo !== filtro) || (soloApoyado && n.apoyo < 3)}
      conectando={estilo === "afc" && modoConectar}
      onSeleccionar={seleccionarNodo}
      onEditar={(actual, texto) => aplicar((copia) => actualizarEtiquetaNodo(copia, actual.id, texto))}
      onCita={irACita}
    />
  );

  const renderNodoAFC = (n: NodoGrafo) => (
    <Nodo
      variante="afc"
      nodo={n}
      seleccionado={seleccionado === n.id}
      atenuado={(filtro !== null && n.apoyo !== filtro) || (soloApoyado && n.apoyo < 3)}
      conectando={modoConectar}
      onSeleccionar={seleccionarNodo}
      onEditar={(actual, texto) => aplicar((copia) => actualizarEtiquetaNodo(copia, actual.id, texto))}
      onCita={irACita}
    />
  );
  const renderAgregarAFC = (carril: CarrilGrafo, situacionId: string, alternativa: boolean) => (
    <BotonAgregarNodo
      variante="afc"
      carril={carril}
      situacionId={situacionId}
      alternativa={alternativa}
      nodos={nodos}
      onAgregar={(tipo, texto) => {
        if (tipo === "consecuencia_alternativa") {
          const alt = nodos.find((n) => n.situacion_id === situacionId && n.tipo === "alternativa");
          if (alt) aplicar((copia) => actualizarEtiquetaNodo(copia, `${alt.id}_consecuencia`, texto));
        } else aplicar((copia) => agregarNodo(copia, situacionId, tipo, texto));
      }}
    />
  );

  // Las relaciones quedan tenues por defecto y se encienden las del nodo que
  // se señala o se selecciona: así no dominan el tablero.
  const enFoco = bajoPuntero ?? origenConexion ?? seleccionado;
  const esAFC = estilo === "afc";

  return (
    <div className="print:contents">
      <div className="mb-4 flex flex-wrap items-center gap-2 print:hidden">
        <button type="button" disabled={!puedeDeshacer} onClick={deshacer} className="rounded border border-divider px-3 py-1.5 text-xs text-ink disabled:opacity-40">Deshacer</button>
        <button type="button" disabled={!puedeRehacer} onClick={rehacerAccion} className="rounded border border-divider px-3 py-1.5 text-xs text-ink disabled:opacity-40">Rehacer</button>
        <button
          type="button"
          disabled={estilo !== "afc"}
          aria-pressed={modoConectar}
          onClick={() => { setModoConectar((v) => !v); setOrigenConexion(null); }}
          title={estilo === "afc" ? "Crear una relación entre dos nodos" : "Las relaciones se editan en la vista AFC"}
          className={`rounded border px-3 py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-40 ${modoConectar ? "border-accent bg-accent/10 text-accent" : "border-divider text-ink"}`}
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
        <div className={esAFC ? `${s.scroll} min-w-0 print:hidden` : "contents"}>
        <div
          ref={contenedorRef}
          className={esAFC ? `relative ${s.raiz} ${s.lienzo} ${poppinsAfc.variable} ${interAfc.variable}` : "relative min-w-0 print:hidden"}
          onMouseOver={esAFC ? (evento) => {
            const id = (evento.target as HTMLElement).closest<HTMLElement>("[data-nodo-id]")?.dataset.nodoId ?? null;
            if (id !== bajoPuntero) setBajoPuntero(id);
          } : undefined}
          onMouseLeave={esAFC ? () => setBajoPuntero(null) : undefined}
        >
          <svg className={`pointer-events-none absolute inset-0 h-full w-full overflow-visible ${esAFC ? "block" : "z-0 hidden md:block"}`} style={esAFC ? { zIndex: 1 } : undefined} aria-hidden="true">
            <defs><marker id="punta-afc" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto"><path d="M0,0 L7,3.5 L0,7 z" fill="currentColor" /></marker></defs>
            {trazos.map((trazo) => {
              if (!esAFC) {
                return <path key={trazo.id} d={trazo.d} fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray={trazo.tipo === "moderadora" ? "5 4" : undefined} className={trazo.tipo === "bucle" ? "text-warn" : "text-ink-muted/60"} markerEnd="url(#punta-afc)" />;
              }
              const activa = enFoco !== null && (trazo.desde === enFoco || trazo.hasta === enFoco);
              // Las que cruzan tableros siguen en el modelo y en la ficha; en
              // el lienzo solo aparecen con uno de sus extremos en foco.
              if (trazo.lejana && !activa) return null;
              return (
                <path
                  key={trazo.id}
                  d={trazo.d}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={activa ? 2.5 : 1.75}
                  strokeDasharray={trazo.tipo === "moderadora" ? "5 4" : undefined}
                  className={trazo.tipo === "bucle" ? "text-warn" : undefined}
                  style={{ color: trazo.tipo === "bucle" ? undefined : "var(--afc-line)", opacity: activa ? 0.95 : modoConectar ? 0.55 : 0.26, transition: "opacity 150ms ease" }}
                  markerEnd="url(#punta-afc)"
                />
              );
            })}
          </svg>

          {estilo !== "afc" ? (
            <div className="relative z-10">
              {estilo === "dbt" && <VistaDBT analisis={analisis} nodos={nodos} renderNodo={renderNodo} />}
              {estilo === "act" && <VistaACT analisis={analisis} nodos={nodos} renderNodo={renderNodo} />}
              {estilo === "mc" && <VistaMC analisis={analisis} nodos={nodos} renderNodo={renderNodo} />}
            </div>
          ) : (
            <VistaAFC
              analisis={analisis}
              nodos={nodos}
              renderNodo={renderNodoAFC}
              renderAgregar={renderAgregarAFC}
              onSeleccionar={seleccionarNodo}
              onReacomodo={() => redibujar.current()}
              onAgregarFuncion={(situacionId) => {
                const texto = window.prompt("Función hipotetizada")?.trim();
                if (texto) aplicar((copia) => agregarNodo(copia, situacionId, "funcion", texto));
              }}
            />
          )}
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
            <button type="button" disabled={estilo !== "afc"} title={estilo === "afc" ? "Borrar nodo" : "La estructura se edita en la vista AFC"} onClick={() => aplicar((copia) => borrarNodo(copia, nodoSeleccionado.id))} className="rounded border border-warn/50 px-2 py-1 text-xs text-warn disabled:cursor-not-allowed disabled:opacity-40">Borrar nodo</button>
            <div className="border-t border-divider pt-3"><p className="mb-2 text-xs font-medium text-ink">Relaciones del nodo</p>{analisis.aristas.filter((a) => a.desde === nodoSeleccionado.id || a.hasta === nodoSeleccionado.id).map((a) => <div key={a.id} className="mb-1 flex items-center gap-2 text-[11px] text-ink-muted"><span className="min-w-0 flex-1 truncate">{a.desde} → {a.hasta}</span><button type="button" disabled={estilo !== "afc"} title={estilo === "afc" ? "Borrar relación" : "Las relaciones se editan en la vista AFC"} aria-label={`Borrar relación ${a.id}`} onClick={() => aplicar((copia) => { copia.aristas = copia.aristas.filter((actual) => actual.id !== a.id); })} className="text-warn disabled:cursor-not-allowed disabled:opacity-40">Borrar</button></div>)}</div>
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
