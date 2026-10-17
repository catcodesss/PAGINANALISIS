"use client";

import {
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import type { Alerta, AnalisisFuncional, TipoArista } from "@/lib/types";
import type { EstiloGrafo } from "@/lib/preferencias";
import {
  agregarArista,
  agregarNodo,
  actualizarEtiquetaNodo,
  construirNodosGrafo,
  type CarrilGrafo,
  type NodoGrafo,
  type TipoNodoGrafo,
} from "@/lib/grafo";
import VistaAFC from "./estilos/afc";
import { EtiquetasProcesoACT, ProcesosSinAnclar } from "./AnotacionesACT";
import VistaACT from "./estilos/act";
import VistaDBT, { IconoNodo, subtipoDeNodo } from "./estilos/dbt";
import s from "./afc.module.css";
import { TERMINOS, terminoDeContingencia, terminoEnTexto, type IdTermino } from "@/lib/terminos";
import { describirGrado, gradoDeNumero } from "@/lib/gradoApoyo";
import { interAfc, poppinsAfc } from "./fuentesAfc";
import { ChevronRight } from "lucide-react";
import { ETIQUETA_TIPO, etiquetaApoyo, etiquetaTipoNodo } from "./etiquetasNodo";
import { useEspacio } from "../espacio/contexto";
import { alertasPorNodo } from "@/lib/alertasNodo";
import { InsigniaAlerta } from "./InsigniaAlerta";
import type { ApoyoArista } from "@/lib/types";

interface GrafoAFCProps {
  analisis: AnalisisFuncional;
  notaOriginal: string;
  estilo: EstiloGrafo;
  /**
   * Una decisión sobre la propuesta de la IA (confirmar), no texto del clínico:
   * no marca la sección como editada. Confirmar no es editar (invariante 6).
   */
  onDecidir: (mutar: (copia: AnalisisFuncional) => void) => void;
}

interface Trazo {
  id: string;
  d: string;
  tipo: TipoArista;
  apoyo: ApoyoArista;
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

const TERMINO_DE_TIPO: Partial<Record<TipoNodoGrafo, IdTermino>> = {
  om: "om",
  ed: "ed",
  ec: "ec",
  funcion: "funcion",
};

/** La sigla técnica al lado de la etiqueta clara, con su definición. */
function SiglaTipo({ tipo }: { tipo: TipoNodoGrafo }) {
  const id = TERMINO_DE_TIPO[tipo];
  if (!id) return null;
  return (
    <abbr title={TERMINOS[id].definicion} className="ml-1 cursor-help font-mono text-[9px] no-underline opacity-70">
      {TERMINOS[id].tecnico}
    </abbr>
  );
}

/**
 * El detalle de un nodo, traducido donde hay traducción: el tipo de
 * contingencia de una consecuencia («refuerzo negativo» → «Alivio: qué deja de
 * pasar · R−») y la clase de una regla verbal (pliance, tracking, augmenting).
 */
function textoDetalle(nodo: NodoGrafo): { texto: string; definicion?: string } | null {
  if (!nodo.detalle) return null;
  if (nodo.tipo === "consecuencia") {
    const id = terminoDeContingencia(nodo.detalle);
    if (id) return { texto: `${TERMINOS[id].claro} · ${TERMINOS[id].tecnico}`, definicion: TERMINOS[id].definicion };
  }
  if (nodo.tipo === "regla_verbal") {
    const [clase, ...resto] = nodo.detalle.split(" · ");
    if (clase === "pliance" || clase === "tracking" || clase === "augmenting") {
      const t = TERMINOS[clase];
      return { texto: [`${t.claro} · ${t.tecnico}`, ...resto].join(" · "), definicion: t.definicion };
    }
  }
  return { texto: nodo.detalle };
}

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

function Nodo({
  nodo,
  seleccionado,
  atenuado,
  conectando,
  onSeleccionar,
  onEditar,
  onCita,
  variante,
  alertas = [],
}: {
  nodo: NodoGrafo;
  seleccionado: boolean;
  atenuado: boolean;
  conectando: boolean;
  onSeleccionar: (nodo: NodoGrafo) => void;
  onEditar: (nodo: NodoGrafo, texto: string) => void;
  onCita: (nodo: NodoGrafo) => void;
  variante?: "afc" | "dbt";
  alertas?: readonly Alerta[];
}) {
  const [editando, setEditando] = useState(false);
  const [texto, setTexto] = useState(nodo.etiqueta);
  const detalle = textoDetalle(nodo);

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
      <span className={s.bandaApoyo} data-apoyo={nodo.apoyo} />
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
      <article {...comunes} aria-label={`${nodo.tipo === "encubierta" ? ETIQUETA_TIPO.conducta : ETIQUETA_TIPO[nodo.tipo]}: ${nodo.etiqueta}${conectando ? ". Seleccionar para conectar" : ""}`} className={clases}>
        {barraApoyo(s.barraApoyo)}
        <div className={s.nodoCuerpo}>
          <div className={s.nodoTexto}>
            <span className={s.chip}>{nodo.tipo === "encubierta" ? ETIQUETA_TIPO.conducta : ETIQUETA_TIPO[nodo.tipo]}<SiglaTipo tipo={nodo.tipo} /></span>
            {alertas.length > 0 && <InsigniaAlerta alertas={alertas} className="mt-1 self-start" />}
            {editando ? editor(s.editor) : <p className={s.etiqueta}>{nodo.etiqueta}</p>}
            {detalle && <p className={s.detalle} title={detalle.definicion}>{detalle.texto}</p>}
          </div>
        </div>
      </article>
    );
  }

  if (variante === "dbt") {
    // Sin color por tipo: lo dicen el icono y el subtipo. El color queda para
    // el grado de apoyo, y la selección es solo borde y un fondo muy tenue.
    const grado = describirGrado(gradoDeNumero(nodo.apoyo));
    const conducta = nodo.tipo === "conducta";
    // En una columna estrecha (reglas verbales) la píldora baja bajo el texto:
    // a su lado, dejaba al texto sin anchura.
    const pildora = (clase: string) => (
      <button
        type="button"
        title={grado.corta}
        aria-label={`${grado.etiqueta}. Ir a la línea citada`}
        onClick={(evento) => {
          evento.stopPropagation();
          onCita(nodo);
        }}
        className={`${clase} items-center gap-1.5 whitespace-nowrap rounded-full border border-divider bg-canvas px-2 py-0.5 text-[11px] text-ink-muted`}
      >
        <span aria-hidden="true" data-apoyo={nodo.apoyo} className={`${s.marcaApoyo} !h-1.5 !w-1.5 rounded-full`} />
        {grado.etiqueta}
      </button>
    );
    return (
      <article
        {...comunes}
        className={`@container/tarjeta relative flex min-w-0 cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 ${seleccionado ? "border-accent bg-accent-soft ring-1 ring-accent" : conducta ? "border-ink-muted/35 bg-canvas hover:border-ink-muted/60" : "border-divider bg-surface hover:border-ink-muted/40"} ${atenuado ? "opacity-25" : ""}`}
      >
        <IconoNodo nodo={nodo} className={`h-5 w-5 flex-none ${seleccionado ? "text-accent" : "text-ink-muted"}`} />
        <div className="min-w-0 flex-1">
          {alertas.length > 0 && <InsigniaAlerta alertas={alertas} className="mb-1" />}
          {editando
            ? editor("w-full rounded border border-accent bg-canvas px-1.5 py-1 text-sm text-ink outline-none")
            : <p className={`break-words text-sm leading-snug text-ink ${conducta ? "font-medium" : ""}`}>{nodo.etiqueta}</p>}
          <p className="mt-0.5 text-[11px] text-ink-muted">{subtipoDeNodo(nodo) ?? ETIQUETA_TIPO[nodo.tipo]}<SiglaTipo tipo={nodo.tipo} /></p>
          {detalle && nodo.tipo !== "encubierta" && <p className="mt-0.5 text-[11px] text-ink-muted" title={detalle.definicion}>{detalle.texto}</p>}
          {pildora("mt-1.5 inline-flex @xs/tarjeta:hidden")}
        </div>
        {pildora("hidden flex-none @xs/tarjeta:inline-flex")}
        <ChevronRight className="hidden h-4 w-4 flex-none text-ink-muted/60 @xs/tarjeta:block" aria-hidden="true" />
      </article>
    );
  }

  return (
    <article
      data-nodo-id={nodo.id}
      role="button"
      tabIndex={0}
      aria-label={`${etiquetaTipoNodo(nodo)}: ${nodo.etiqueta}${conectando ? ". Seleccionar para conectar" : ""}`}
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
          className={`${s.marcaApoyo} !block !w-full`}
          data-apoyo={nodo.apoyo}
        />
      </button>
      <p className="mt-1 font-mono text-[10px] uppercase tracking-wide text-ink-muted">
        {etiquetaTipoNodo(nodo)}<SiglaTipo tipo={nodo.tipo} />
      </p>
      {alertas.length > 0 && <InsigniaAlerta alertas={alertas} className="mt-1" />}
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
      {detalle && <p className="mt-1 text-[11px] text-ink-muted" title={detalle.definicion}>{detalle.texto}</p>}
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

export default function GrafoAFC({ analisis, notaOriginal, estilo, onDecidir }: GrafoAFCProps) {
  const contenedorRef = useRef<HTMLDivElement>(null);
  const redibujar = useRef<() => void>(() => {});
  const { seleccionado, seleccionar, aplicar, deshacer, rehacer, puedeDeshacer, puedeRehacer, irACita: abrirCita, citaEnFuente } = useEspacio();
  const [modoConectar, setModoConectar] = useState(false);
  const [origenConexion, setOrigenConexion] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<1 | 2 | 3 | null>(null);
  const [soloApoyado, setSoloApoyado] = useState(false);
  const [trazos, setTrazos] = useState<Trazo[]>([]);
  const nodos = useMemo(() => construirNodosGrafo(analisis), [analisis]);
  const alertasDeNodo = useMemo(() => alertasPorNodo(analisis), [analisis]);
  const avisos = (id: string) => alertasDeNodo.get(id) ?? [];
  // La vista DBT sigue pintando su propio panel de detalle hasta la 5B: le
  // basta con las líneas de la nota y la que resalta la Fuente.
  const lineas = useMemo(() => notaOriginal.replace(/\r\n/g, "\n").split("\n"), [notaOriginal]);
  const lineaActiva = citaEnFuente?.linea_inicio ?? null;

  function seleccionarNodo(nodo: NodoGrafo) {
    if (!modoConectar) {
      seleccionar(nodo.id);
      return;
    }
    if (!origenConexion) {
      setOrigenConexion(nodo.id);
      seleccionar(nodo.id);
      return;
    }
    aplicar((copia) => agregarArista(copia, origenConexion, nodo.id));
    setOrigenConexion(null);
    seleccionar(nodo.id);
  }

  function irACita(nodo: NodoGrafo) {
    if (nodo.evidencia?.verificada) abrirCita(nodo.evidencia);
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
            return [{ id: arista.id, tipo: arista.tipo, apoyo: arista.apoyo, desde: arista.desde, hasta: arista.hasta, lejana, d: trazadoAFC(desde, hasta) }];
          }
          const x1 = desde.x + desde.w;
          const y1 = desde.y + desde.h / 2;
          const x2 = hasta.x;
          const y2 = hasta.y + hasta.h / 2;
          const curva = Math.max(24, Math.abs(x2 - x1) / 2);
          return [{ id: arista.id, tipo: arista.tipo, apoyo: arista.apoyo, desde: arista.desde, hasta: arista.hasta, d: `M ${x1} ${y1} C ${x1 + curva} ${y1}, ${x2 - curva} ${y2}, ${x2} ${y2}` }];
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
      alertas={avisos(n.id)}
    />
  );

  // Los procesos ACT se leen sobre su nodo, por id y solo por id. Lo que no
  // ancla (o apunta a un nodo que ya no está) va a la lista «sin anclar».
  const idsNodos = new Set(nodos.map((n) => n.id));
  const procesosACT = analisis.capa_act.procesos_act;
  const procesosSinAnclar = procesosACT.filter((p) => !p.nodo_id || !idsNodos.has(p.nodo_id));
  const renderNodoAFC = (n: NodoGrafo) => {
    const nodoAFC = (
      <Nodo
        variante="afc"
        nodo={n}
        seleccionado={seleccionado === n.id}
        atenuado={(filtro !== null && n.apoyo !== filtro) || (soloApoyado && n.apoyo < 3)}
        conectando={modoConectar}
        onSeleccionar={seleccionarNodo}
        onEditar={(actual, texto) => aplicar((copia) => actualizarEtiquetaNodo(copia, actual.id, texto))}
        onCita={irACita}
        alertas={avisos(n.id)}
      />
    );
    const suyos = procesosACT.filter((p) => p.nodo_id === n.id);
    if (suyos.length === 0) return nodoAFC;
    return <div><EtiquetasProcesoACT procesos={suyos} />{nodoAFC}</div>;
  };
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

  const esAFC = estilo === "afc";
  // DBT pinta sus propias relaciones y su propio panel de detalle.
  const esDBT = estilo === "dbt";
  const conectable = esAFC || esDBT;

  const renderNodoDBT = (n: NodoGrafo) => (
    <Nodo
      variante="dbt"
      nodo={n}
      seleccionado={seleccionado === n.id}
      atenuado={(filtro !== null && n.apoyo !== filtro) || (soloApoyado && n.apoyo < 3)}
      conectando={modoConectar}
      onSeleccionar={seleccionarNodo}
      onEditar={(actual, texto) => aplicar((copia) => actualizarEtiquetaNodo(copia, actual.id, texto))}
      onCita={irACita}
      alertas={avisos(n.id)}
    />
  );

  return (
    <div className="print:contents">
      <div className="mb-4 flex flex-wrap items-center gap-2 print:hidden">
        <button type="button" disabled={!puedeDeshacer} onClick={deshacer} className="rounded border border-divider px-3 py-1.5 text-xs text-ink disabled:opacity-40">Deshacer</button>
        <button type="button" disabled={!puedeRehacer} onClick={rehacer} className="rounded border border-divider px-3 py-1.5 text-xs text-ink disabled:opacity-40">Rehacer</button>
        <button
          type="button"
          disabled={!conectable}
          aria-pressed={modoConectar}
          onClick={() => { setModoConectar((v) => !v); setOrigenConexion(null); }}
          title={conectable ? "Crear una relación entre dos nodos" : "Las relaciones se editan en la vista AFC o DBT"}
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
            <span className={`${s.marcaApoyo} mr-1 align-middle`} data-apoyo={nivel} aria-hidden="true" />
            {etiquetaApoyo(nivel)}
          </button>
        ))}
        <label className="ml-2 flex items-center gap-1.5 text-ink-muted">
          <input type="checkbox" checked={soloApoyado} onChange={(e) => setSoloApoyado(e.target.checked)} />
          Ver solo lo apoyado por la nota
        </label>
      </div>

      <div className="min-w-0 print:block">
        <div className={esAFC ? `${s.scroll} min-w-0 print:hidden` : "contents"}>
        <div
          ref={contenedorRef}
          className={esAFC ? `relative ${s.raiz} ${s.lienzo} ${poppinsAfc.variable} ${interAfc.variable}` : "relative min-w-0 print:hidden"}
        >
          {/* En la vista AFC las relaciones ya se leen en las columnas y en la
              Ficha ("Relaciones del nodo"); las líneas curvas encima del
              tablero sobraban como trazo visual y no se dibujan aquí. */}
          {!esAFC && !esDBT && (
            <svg className="pointer-events-none absolute inset-0 z-0 hidden h-full w-full overflow-visible md:block" aria-hidden="true">
              <defs><marker id="punta-afc" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto"><path d="M0,0 L7,3.5 L0,7 z" fill="currentColor" /></marker></defs>
              {trazos.map((trazo) => (
                <path key={trazo.id} d={trazo.d} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap={trazo.apoyo === "inferido" ? "round" : undefined} strokeDasharray={trazo.apoyo === "inferido" ? "0.1 5" : trazo.tipo === "moderadora" ? "5 4" : undefined} className={trazo.tipo === "bucle" ? "text-warn" : "text-ink-muted/60"} markerEnd="url(#punta-afc)" />
              ))}
            </svg>
          )}

          {estilo !== "afc" ? (
            <div className={esDBT ? "relative" : "relative z-10"}>
              {esDBT && (
                <VistaDBT
                  analisis={analisis}
                  nodos={nodos}
                  renderNodo={renderNodoDBT}
                  seleccionado={seleccionado}
                  onSeleccionar={seleccionarNodo}
                  onCerrar={() => seleccionar(null)}
                  describirTipo={(n) => ETIQUETA_TIPO[n.tipo]}
                  lineas={lineas}
                  lineaActiva={lineaActiva}
                  onEditar={aplicar}
                  onDecidir={onDecidir}
                />
              )}
              {estilo === "act" && <VistaACT analisis={analisis} nodos={nodos} renderNodo={renderNodo} />}
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
          {esAFC && procesosSinAnclar.length > 0 && (
            <div className="mt-5"><ProcesosSinAnclar procesos={procesosSinAnclar} /></div>
          )}
        </div>
        </div>

      </div>

      <div className="hidden print:block">
        {analisis.situaciones.map((situacion) => <table key={situacion.id} className="mb-5 w-full table-fixed border-collapse text-xs"><caption className="mb-2 text-left font-serif text-base font-semibold">{situacion.nombre}</caption><thead><tr>{[terminoEnTexto("ed"), terminoEnTexto("om"), "Conducta", "Consecuencia", terminoEnTexto("consecuencia_demorada")].map((h) => <th key={h} className="border border-divider p-2 text-left">{h}</th>)}</tr></thead><tbody><tr><td className="border border-divider p-2">{situacion.cadena_operante?.antecedente || "—"}</td><td className="border border-divider p-2">{situacion.cadena_operante?.operacion_motivacional || "—"}</td><td className="border border-divider p-2">{situacion.cadena_operante?.respuesta || "—"}</td><td className="border border-divider p-2">{situacion.cadena_operante?.consecuencia.texto || "—"}</td><td className="border border-divider p-2">{situacion.cadena_operante?.consecuencias_largo_plazo?.texto || "—"}</td></tr></tbody></table>)}
      </div>
    </div>
  );
}
