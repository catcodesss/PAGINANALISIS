"use client";

import {
  Fragment,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import type { Alerta, AnalisisFuncional, TipoArista } from "@/lib/types";
import type { NivelMapa } from "@/lib/preferencias";
import {
  agregarArista,
  agregarNodo,
  actualizarEtiquetaNodo,
  construirNodosGrafo,
  type CarrilGrafo,
  type NodoGrafo,
  type TipoNodoGrafo,
} from "@/lib/grafo";
import { EtiquetasProcesoACT, ProcesosSinAnclar } from "./AnotacionesACT";
import VistaACT from "./estilos/act";
import TableroColumnas, { type AgruparMapa, type CapasMapa } from "./TableroColumnas";
import { rutaDeSeleccion, textoDeRuta } from "@/lib/rutaMapa";
import { ETIQUETA_APOYO_ARISTA } from "@/lib/apoyoAristas";
import { repartirProcesosACT } from "@/lib/procesosACT";
import { destinosPosibles } from "@/lib/edicionMapa";
import { TIPO_ARRASTRE_NODO } from "../espacio/contexto";
import s from "./afc.module.css";
import { TERMINOS, terminoDeContingencia, type IdTermino } from "@/lib/terminos";
import { interAfc, poppinsAfc } from "./fuentesAfc";
import { ETIQUETA_TIPO, etiquetaApoyo, etiquetaTipoNodo } from "./etiquetasNodo";
import { useEspacio } from "../espacio/contexto";
import { alertasPorNodo } from "@/lib/alertasNodo";
import { InsigniaAlerta } from "./InsigniaAlerta";
import { procedenciaDe, ROTULOS_PROCEDENCIA } from "@/lib/procedencia";
import type { ProcedenciaElemento } from "@/lib/types";
import type { ApoyoArista } from "@/lib/types";

interface GrafoAFCProps {
  analisis: AnalisisFuncional;
  /** Situación, Clínico o Evidencia: la misma colección de nodos, leída a otra profundidad. */
  nivel: NivelMapa;
  capas: CapasMapa;
  /** La Matrix ACT como vista alternativa de los mismos nodos. */
  matrix: boolean;
  /** La ruta seleccionada como lista lineal, para lectores de pantalla. */
  leerComoTexto: boolean;
  onIrANivel: (nivel: NivelMapa) => void;
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

/** La marca escrita de la procedencia: sin color, porque el color ya es el apoyo. */
const MARCA_PROCEDENCIA: Record<ProcedenciaElemento["estado"], string> = {
  propuesta: "IA",
  confirmado: "✓",
  editado: "✎",
  creado: "Tuyo",
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
  procedencia,
  onMenu,
  onPulsacionLarga,
  soltarFrase,
  destinoCita = false,
  arrastre,
}: {
  nodo: NodoGrafo;
  seleccionado: boolean;
  atenuado: boolean;
  conectando: boolean;
  onSeleccionar: (nodo: NodoGrafo) => void;
  onEditar: (nodo: NodoGrafo, texto: string) => void;
  onCita: (nodo: NodoGrafo) => void;
  variante?: "afc";
  alertas?: readonly Alerta[];
  /** Quién tiene la última palabra sobre el nodo. Sin esto no se pinta marca. */
  procedencia?: ProcedenciaElemento;
  /** Abre el menú del nodo en un punto de la pantalla. */
  onMenu?: (x: number, y: number) => void;
  /** Pulsación larga con el dedo (~0,5 s): abre la evidencia donde equivale al clic derecho del ratón. */
  onPulsacionLarga?: (x: number, y: number) => void;
  /** Recibe una frase arrastrada desde la Fuente (contexto.tsx#propsSoltarFrase). */
  soltarFrase?: { onDragOver: (e: React.DragEvent) => void; onDrop: (e: React.DragEvent) => void };
  /** Hay una frase en el aire: se marca como sitio donde soltarla. */
  destinoCita?: boolean;
  /** Si el nodo se puede llevar a otro carril, cómo empieza y acaba el arrastre. */
  arrastre?: { onDragStart: (e: React.DragEvent) => void; onDragEnd: () => void };
}) {
  const [editando, setEditando] = useState(false);
  const [texto, setTexto] = useState(nodo.etiqueta);
  const detalle = textoDetalle(nodo);
  // Pulsación larga: el temporizador, de dónde partió el dedo y si el contacto
  // fue táctil (el navegador móvil dispara además un «clic derecho» propio).
  const pulsacion = useRef<{ t: ReturnType<typeof setTimeout>; x: number; y: number } | null>(null);
  const tactil = useRef(false);
  const soltarPulsacion = () => {
    if (pulsacion.current) clearTimeout(pulsacion.current.t);
    pulsacion.current = null;
  };
  useEffect(() => soltarPulsacion, []);

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
    // La tecla Menú y Shift+F10 son el clic derecho del teclado.
    if (onMenu && (evento.key === "ContextMenu" || (evento.key === "F10" && evento.shiftKey))) {
      evento.preventDefault();
      const r = evento.currentTarget.getBoundingClientRect();
      onSeleccionar(nodo);
      onMenu(r.left + 12, r.bottom - 8);
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
    onContextMenu: onMenu
      ? (evento: React.MouseEvent) => {
          evento.preventDefault();
          if (tactil.current) return;
          onSeleccionar(nodo);
          onMenu(evento.clientX, evento.clientY);
        }
      : undefined,
    ...(onPulsacionLarga
      ? {
          onTouchStart: (evento: React.TouchEvent) => {
            tactil.current = true;
            soltarPulsacion();
            const { clientX: x, clientY: y } = evento.touches[0];
            pulsacion.current = {
              x,
              y,
              t: setTimeout(() => {
                pulsacion.current = null;
                if (navigator.vibrate) navigator.vibrate(15);
                onSeleccionar(nodo);
                onPulsacionLarga(x, y);
              }, 500),
            };
          },
          // Si el dedo se desplaza es un scroll, no una pulsación.
          onTouchMove: (evento: React.TouchEvent) => {
            const p = pulsacion.current;
            const d = evento.touches[0];
            if (p && Math.hypot(d.clientX - p.x, d.clientY - p.y) > 10) soltarPulsacion();
          },
          onTouchEnd: () => {
            soltarPulsacion();
            setTimeout(() => (tactil.current = false), 800);
          },
          onTouchCancel: soltarPulsacion,
          style: { WebkitTouchCallout: "none" as const },
        }
      : {}),
    ...soltarFrase,
    ...(arrastre ? { draggable: true, ...arrastre } : {}),
  } as const;

  if (variante === "afc") {
    const clases = [
      s.nodo,
      nodo.tipo === "encubierta" ? s.encubierta : "",
      nodo.tipo === "conducta" ? s.conducta : "",
      seleccionado ? s.seleccionado : "",
      atenuado ? s.atenuado : "",
      procedencia?.estado === "propuesta" ? s.propuesta : "",
      destinoCita ? s.destinoCita : "",
    ].join(" ");
    const rotulo = procedencia ? ROTULOS_PROCEDENCIA[procedencia.estado] : null;
    return (
      <article {...comunes} aria-label={`${nodo.tipo === "encubierta" ? ETIQUETA_TIPO.conducta : ETIQUETA_TIPO[nodo.tipo]}: ${nodo.etiqueta}${conectando ? ". Seleccionar para conectar" : ""}`} className={clases}>
        {barraApoyo(s.barraApoyo)}
        {procedencia && rotulo && (
          <span
            className={s.marcaProcedencia}
            data-procedencia={procedencia.estado}
            title={`${rotulo.frase}${procedencia.estado === "editado" ? (procedencia.original ? ` Texto original de la IA: ${procedencia.original}` : " No se conserva el texto original de la IA.") : ""}`}
          >
            {MARCA_PROCEDENCIA[procedencia.estado]}
            <span className="sr-only"> {rotulo.etiqueta}</span>
          </span>
        )}
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

export default function GrafoAFC({ analisis, nivel, capas, matrix, leerComoTexto }: GrafoAFCProps) {
  const contenedorRef = useRef<HTMLDivElement>(null);
  const { seleccionado, seleccionar, aplicar, deshacer, rehacer, puedeDeshacer, puedeRehacer, irACita, abrirMenu, abrirEvidencia, propsSoltarFrase, arrastrandoFrase, setNodoEnElAire } = useEspacio();
  const [modoConectar, setModoConectar] = useState(false);
  const [origenConexion, setOrigenConexion] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<1 | 2 | 3 | null>(null);
  const [soloApoyado, setSoloApoyado] = useState(false);
  const [agrupar, setAgrupar] = useState<AgruparMapa>("episodio");
  const [trazos, setTrazos] = useState<Trazo[]>([]);
  const nodos = useMemo(() => construirNodosGrafo(analisis), [analisis]);
  const alertasDeNodo = useMemo(() => alertasPorNodo(analisis), [analisis]);
  const avisos = (id: string) => alertasDeNodo.get(id) ?? [];
  const ruta = useMemo(() => rutaDeSeleccion(analisis, nodos, seleccionado), [analisis, nodos, seleccionado]);

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

  function citaDeNodo(nodo: NodoGrafo) {
    if (nodo.evidencia?.verificada) irACita(nodo.evidencia);
  }

  // Las líneas curvas existen en la vista Matrix y en el nivel Clínico, donde
  // las flechas cuentan el orden de la cadena. En Situación y Evidencia no hay:
  // el tablero se lee por columnas y las relaciones se eligen desde el Inspector.
  const conFlechas = matrix || nivel === "clinico";
  useLayoutEffect(() => {
    if (!conFlechas) return;
    const contenedor = contenedorRef.current;
    if (!contenedor) return;
    let fotograma = 0;
    const dibujar = () => {
      cancelAnimationFrame(fotograma);
      fotograma = requestAnimationFrame(() => {
        const raiz = contenedorRef.current;
        if (!raiz) return;
        const cajaRaiz = raiz.getBoundingClientRect();
        const porId = (ambito: ParentNode, id: string) =>
          ambito.querySelector<HTMLElement>(`[data-nodo-id="${CSS.escape(id)}"]`);
        const aCaja = (elemento: HTMLElement) => {
          const rect = elemento.getBoundingClientRect();
          return { x: rect.left - cajaRaiz.left, y: rect.top - cajaRaiz.top, w: rect.width, h: rect.height };
        };
        setTrazos(analisis.aristas.flatMap((arista) => {
          const origen = porId(raiz, arista.desde);
          if (!origen) return [];
          // En los tableros una flecha no cruza de una situación a otra: se
          // busca el destino dentro de la misma situación que el origen.
          const destino = porId(matrix ? raiz : (origen.closest("[data-situacion-id]") ?? raiz), arista.hasta);
          if (!destino) return [];
          return [{ id: arista.id, tipo: arista.tipo, apoyo: arista.apoyo, desde: arista.desde, hasta: arista.hasta, d: trazadoAFC(aCaja(origen), aCaja(destino)) }];
        }));
      });
    };
    dibujar();
    const observador = new ResizeObserver(dibujar);
    observador.observe(contenedor);
    window.addEventListener("resize", dibujar);
    // El tablero se desplaza en horizontal dentro de su caja: las flechas
    // siguen a las tarjetas.
    contenedor.addEventListener("scroll", dibujar, true);
    return () => {
      cancelAnimationFrame(fotograma);
      observador.disconnect();
      window.removeEventListener("resize", dibujar);
      contenedor.removeEventListener("scroll", dibujar, true);
    };
  }, [analisis.aristas, nodos, conFlechas, matrix, nivel, capas, agrupar]);

  // Los procesos ACT se leen sobre su nodo, por id y solo por id, cuando la capa
  // ACT está encendida y tienen base funcional. Lo demás va a la lista aparte.
  const { interpretables: procesosACT, aparte: procesosSinAnclar } = repartirProcesosACT(
    analisis.capa_act.procesos_act,
    new Set(nodos.map((n) => n.id))
  );
  const atenuado = (n: NodoGrafo) =>
    (filtro !== null && n.apoyo !== filtro) ||
    (soloApoyado && n.apoyo < 3) ||
    (ruta.ids.size > 0 && !ruta.ids.has(n.id));

  // Un nodo con un carril compatible al que ir se puede arrastrar; mientras
  // vuela, el tablero enseña dónde se puede soltar (TableroSituacion).
  const arrastreDe = (n: NodoGrafo) => {
    const destinos = destinosPosibles(analisis, n.id);
    if (destinos.length === 0) return undefined;
    return {
      onDragStart: (e: React.DragEvent) => {
        e.dataTransfer.setData(TIPO_ARRASTRE_NODO, n.id);
        e.dataTransfer.effectAllowed = "move";
        setNodoEnElAire({ id: n.id, situacionId: n.situacion_id, destinos });
      },
      onDragEnd: () => setNodoEnElAire(null),
    };
  };

  const renderNodoMapa = (n: NodoGrafo) => {
    const nodo = (
      <Nodo
        variante="afc"
        nodo={n}
        seleccionado={seleccionado === n.id}
        atenuado={atenuado(n)}
        conectando={modoConectar}
        onSeleccionar={seleccionarNodo}
        onEditar={(actual, texto) => aplicar((copia) => actualizarEtiquetaNodo(copia, actual.id, texto))}
        onCita={citaDeNodo}
        alertas={avisos(n.id)}
        procedencia={procedenciaDe(analisis, n.id)}
        onMenu={(x, y) => abrirMenu(n.id, x, y)}
        onPulsacionLarga={(x, y) => abrirEvidencia(n.id, x, y)}
        soltarFrase={propsSoltarFrase(n.id)}
        destinoCita={arrastrandoFrase}
        arrastre={arrastreDe(n)}
      />
    );
    const suyos = capas.act ? procesosACT.filter((p) => p.nodo_id === n.id) : [];
    if (suyos.length === 0) return nodo;
    return <div><EtiquetasProcesoACT procesos={suyos} />{nodo}</div>;
  };
  const renderNodoMatrix = (n: NodoGrafo) => (
    <Nodo
      nodo={n}
      seleccionado={seleccionado === n.id}
      atenuado={atenuado(n)}
      conectando={false}
      onSeleccionar={seleccionarNodo}
      onEditar={(actual, texto) => aplicar((copia) => actualizarEtiquetaNodo(copia, actual.id, texto))}
      onCita={citaDeNodo}
      alertas={avisos(n.id)}
    />
  );
  const renderAgregar = (carril: CarrilGrafo, situacionId: string, alternativa: boolean) => (
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

  const lectura = leerComoTexto
    ? textoDeRuta(analisis, nodos, seleccionado, (n) => `${etiquetaTipoNodo(n)}: ${n.etiqueta}`, (a) => ETIQUETA_APOYO_ARISTA[a.apoyo])
    : [];

  return (
    <div className="print:contents">
      <div className="mb-4 flex flex-wrap items-center gap-2 print:hidden">
        <button type="button" disabled={!puedeDeshacer} onClick={deshacer} className="rounded border border-divider px-3 py-1.5 text-xs text-ink disabled:opacity-40">Deshacer</button>
        <button type="button" disabled={!puedeRehacer} onClick={rehacer} className="rounded border border-divider px-3 py-1.5 text-xs text-ink disabled:opacity-40">Rehacer</button>
        <button
          type="button"
          disabled={matrix}
          aria-pressed={modoConectar}
          onClick={() => { setModoConectar((v) => !v); setOrigenConexion(null); }}
          title={matrix ? "Las relaciones se editan en los tableros" : "Crear una relación entre dos nodos"}
          className={`rounded border px-3 py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-40 ${modoConectar ? "border-accent bg-accent/10 text-accent" : "border-divider text-ink"}`}
        >
          {origenConexion ? "Elige el destino" : "Conectar"}
        </button>
        {!matrix && (
          <div role="group" aria-label="Separar el Mapa por" className="ml-2 flex items-center gap-1 text-xs">
            <span className="text-ink-muted">Separar por</span>
            {(["episodio", "conducta"] as const).map((opcion) => (
              <button
                key={opcion}
                type="button"
                aria-pressed={agrupar === opcion}
                onClick={() => setAgrupar(opcion)}
                className="rounded-full border border-divider px-2.5 py-1 text-ink-muted aria-pressed:border-accent aria-pressed:text-accent"
              >
                {opcion === "episodio" ? "Episodio" : "Conducta"}
              </button>
            ))}
          </div>
        )}
        <span className="ml-auto text-xs text-ink-muted">{nodos.length} nodos · {analisis.aristas.length} relaciones</span>
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-2 text-xs print:hidden" aria-label="Filtro de apoyo en la nota">
        <span className="font-medium text-ink">Apoyo en la nota</span>
        {([3, 2, 1] as const).map((n) => (
          <button key={n} type="button" aria-pressed={filtro === n} onClick={() => setFiltro(filtro === n ? null : n)} className="rounded-full border border-divider px-2.5 py-1 text-ink-muted aria-pressed:border-accent aria-pressed:text-accent">
            <span className={`${s.marcaApoyo} mr-1 align-middle`} data-apoyo={n} aria-hidden="true" />
            {etiquetaApoyo(n)}
          </button>
        ))}
        <label className="ml-2 flex items-center gap-1.5 text-ink-muted">
          <input type="checkbox" checked={soloApoyado} onChange={(e) => setSoloApoyado(e.target.checked)} />
          Ver solo lo apoyado por la nota
        </label>
      </div>

      {leerComoTexto && (
        <section aria-label="La ruta como texto" aria-live="polite" className="mb-5 rounded border border-divider bg-canvas p-3">
          <p className="mb-1 font-mono text-[10px] uppercase tracking-wide text-ink-muted">
            {seleccionado ? "Ruta del elemento elegido" : "Cadena de cada situación"}
          </p>
          <ol className="list-decimal space-y-1 pl-5 text-sm leading-relaxed text-ink">
            {lectura.map((linea, i) => <li key={i}>{linea}</li>)}
          </ol>
        </section>
      )}

      <div ref={contenedorRef} className={`relative min-w-0 ${s.raiz} ${poppinsAfc.variable} ${interAfc.variable} print:hidden`}>
        {matrix ? (
          <>
            <svg className="pointer-events-none absolute inset-0 z-0 hidden h-full w-full overflow-visible md:block" aria-hidden="true">
              <defs><marker id="punta-afc" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto"><path d="M0,0 L7,3.5 L0,7 z" fill="currentColor" /></marker></defs>
              {trazos.map((trazo) => (
                <path key={trazo.id} d={trazo.d} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap={trazo.apoyo === "inferido" ? "round" : undefined} strokeDasharray={trazo.apoyo === "inferido" ? "0.1 5" : trazo.tipo === "moderadora" ? "5 4" : undefined} className={trazo.tipo === "bucle" ? "text-warn" : "text-ink-muted/60"} markerEnd="url(#punta-afc)" />
              ))}
            </svg>
            <div className="relative z-10">
              <VistaACT analisis={analisis} nodos={nodos} renderNodo={renderNodoMatrix} />
            </div>
          </>
        ) : (
          <div className="space-y-5">
            {nivel === "clinico" && (
              <svg className="pointer-events-none absolute inset-0 z-[5] hidden h-full w-full overflow-visible md:block" aria-hidden="true">
                <defs><marker id="punta-clinico" markerWidth="9" markerHeight="9" refX="8" refY="4.5" orient="auto"><path d="M0,0 L9,4.5 L0,9 z" fill="currentColor" /></marker></defs>
                {trazos.map((trazo) => (
                  <path key={trazo.id} d={trazo.d} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap={trazo.apoyo === "inferido" ? "round" : undefined} strokeDasharray={trazo.apoyo === "inferido" ? "0.1 5" : trazo.tipo === "moderadora" ? "5 4" : undefined} className={trazo.tipo === "bucle" ? "text-warn" : "text-ink/70"} markerEnd="url(#punta-clinico)" />
                ))}
              </svg>
            )}
            <TableroColumnas
              analisis={analisis}
              nodos={nodos}
              capas={capas}
              agrupar={agrupar}
              nivel={nivel}
              ruta={ruta.ids}
              renderNodo={renderNodoMapa}
              renderAgregar={renderAgregar}
              onSeleccionarId={seleccionar}
              onAgregarFuncion={(situacionId) => {
                const texto = window.prompt("Función hipotetizada")?.trim();
                if (texto) aplicar((copia) => agregarNodo(copia, situacionId, "funcion", texto));
              }}
            />
            <FueraDeSituacion
              analisis={analisis}
              nodos={nodos}
              nivel={nivel}
              renderNodo={renderNodoMapa}
              seleccionado={seleccionado}
              onSeleccionarId={seleccionar}
            />
            {capas.act && procesosSinAnclar.length > 0 && <ProcesosSinAnclar procesos={procesosSinAnclar} />}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Lo del caso que no pertenece a una situación concreta: moduladoras,
 * repertorio, reglas verbales, valores y acomodación del entorno. En el nivel
 * Situación va plegado (es el marco, no la cadena); en Clínico y Evidencia,
 * abierto y agrupado.
 */
function FueraDeSituacion({
  analisis,
  nodos,
  nivel,
  renderNodo,
  seleccionado,
  onSeleccionarId,
}: {
  analisis: AnalisisFuncional;
  nodos: readonly NodoGrafo[];
  nivel: NivelMapa;
  renderNodo: (n: NodoGrafo) => ReactNode;
  seleccionado: string | null;
  onSeleccionarId: (id: string) => void;
}) {
  const globales = nodos.filter((n) => n.situacion_id === null);
  const grupo = (tipo: NodoGrafo["tipo"]) => globales.filter((n) => n.tipo === tipo);
  const total = globales.length + analisis.acomodacion_entorno.length;
  if (total === 0) return null;
  const contenido = (
    <div className="grid gap-4 md:grid-cols-2">
      {grupo("moduladora").length > 0 && (
        <Grupito titulo="Variables moduladoras">{grupo("moduladora").map((n) => <Fragment key={n.id}>{renderNodo(n)}</Fragment>)}</Grupito>
      )}
      {analisis.reglas_verbales.length > 0 && (
        <Grupito titulo="Reglas verbales">
          {analisis.reglas_verbales.map((r) => (
            <button
              key={r.id}
              type="button"
              data-nodo-id={r.id}
              onClick={() => onSeleccionarId(r.id)}
              className={`block w-full rounded border border-divider bg-surface px-2 py-1.5 text-left text-sm text-ink ${seleccionado === r.id ? "ring-2 ring-accent/50" : ""}`}
            >
              {/* Entre comillas solo lo que la nota dice así: una regla inferida
                  la redactó el análisis y no se presenta como dicha. */}
              {r.textual_o_inferida === "textual" ? `«${r.regla}»` : r.regla}
              <span className="block text-[11px] text-ink-muted">
                {TERMINOS[r.clase].claro} · {r.textual_o_inferida === "textual" ? "textual" : "inferida"}
              </span>
            </button>
          ))}
        </Grupito>
      )}
      {analisis.acomodacion_entorno.length > 0 && (
        <Grupito titulo="Acomodación del entorno">
          {analisis.acomodacion_entorno.map((a) => (
            <p key={a.id} className="rounded border border-divider bg-surface px-2 py-1.5 text-sm text-ink">
              <span className="font-medium">{a.quien}:</span> {a.conducta_acomodacion}
              {a.funcion && <span className="block text-[11px] text-ink-muted">{a.funcion}</span>}
            </p>
          ))}
        </Grupito>
      )}
      {grupo("repertorio").length > 0 && (
        <Grupito titulo="Repertorio disponible">{grupo("repertorio").map((n) => <Fragment key={n.id}>{renderNodo(n)}</Fragment>)}</Grupito>
      )}
      {grupo("valor").length > 0 && (
        <Grupito titulo="Valores">{grupo("valor").map((n) => <Fragment key={n.id}>{renderNodo(n)}</Fragment>)}</Grupito>
      )}
    </div>
  );
  return (
    <section aria-label="Fuera de una situación" className="rounded-lg border border-divider bg-canvas p-4">
      {nivel === "situacion" ? (
        <details>
          <summary className="cursor-pointer font-serif text-sm font-semibold text-ink">Fuera de una situación concreta ({total})</summary>
          <div className="mt-3">{contenido}</div>
        </details>
      ) : (
        <>
          <h4 className="mb-3 font-serif text-sm font-semibold text-ink">Fuera de una situación concreta</h4>
          {contenido}
        </>
      )}
    </section>
  );
}

function Grupito({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <p className="font-mono text-[10px] uppercase tracking-wide text-ink-muted">{titulo}</p>
      {children}
    </div>
  );
}
