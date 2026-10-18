"use client";

/**
 * Estado compartido del espacio de trabajo: qué está seleccionado, qué vista se
 * mira, si la Fuente está abierta y qué frase resalta, y la pila de deshacer de
 * las ediciones del Mapa.
 *
 * Por qué sube aquí: la selección vivía dentro de components/grafo/GrafoAFC.tsx,
 * y con ella la Ficha y la nota. Desde la fase 5 el Inspector, el raíl, la
 * Fuente y la bandeja de avisos son hermanos del Mapa y tienen que leer y
 * cambiar la misma selección.
 *
 * LA SELECCIÓN Y LA VISTA VIVEN EN LA URL (`?foco=`, `?vista=`). Así un enlace
 * abre el mismo elemento, «atrás» no lo pierde y no hace falta ningún efecto
 * que copie la URL en el estado (lo que pediría un segundo render y un
 * fotograma con el valor equivocado: react-hooks/set-state-in-effect).
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import type { AnalisisFuncional, Cita } from "@/lib/types";
import type { IdVista } from "@/lib/secciones";
import { citaDeFrase, citarEnElemento } from "@/lib/edicionMapa";

/** El tipo del arrastre de una frase de la Fuente: solo lleva su posición. */
export const TIPO_ARRASTRE_FRASE = "application/x-acia-frase";

type CitaResuelta = Extract<Cita, { verificada: true }>;

export type PestanaInspector = "detalle" | "evidencia" | "historial";

/** El menú de un nodo o una relación, abierto en un punto de la pantalla. */
export interface MenuAbierto {
  id: string;
  x: number;
  y: number;
}

export interface EspacioValor {
  seleccionado: string | null;
  seleccionar: (id: string | null) => void;
  vista: IdVista;
  elegirVista: (vista: IdVista) => void;
  fuenteAbierta: boolean;
  abrirFuente: (abierta: boolean) => void;
  /** La cita que resalta la Fuente: la del elemento elegido o la que se pulsó. */
  citaEnFuente: CitaResuelta | null;
  irACita: (cita: CitaResuelta) => void;
  /** Mutaciones del Mapa con deshacer. Marcan la sección «situaciones». */
  aplicar: (mutacion: (copia: AnalisisFuncional) => void) => void;
  deshacer: () => void;
  rehacer: () => void;
  puedeDeshacer: boolean;
  puedeRehacer: boolean;
  /** Sube aquí para que «Ver evidencia» del menú pueda cambiarla. */
  pestanaInspector: PestanaInspector;
  elegirPestanaInspector: (p: PestanaInspector) => void;
  menu: MenuAbierto | null;
  abrirMenu: (id: string, x: number, y: number) => void;
  cerrarMenu: () => void;
  /** La nota partida en líneas: de aquí sale el texto de toda cita del clínico. */
  lineasNota: readonly string[];
  /**
   * Une la frase (línea, frase) a un nodo o una relación, con deshacer. El
   * texto se saca de la nota, nunca de lo que traiga el arrastre.
   */
  citarFrase: (id: string, linea: number, frase: number) => void;
  /** Hay una frase en el aire: los destinos donde se puede soltar se marcan. */
  arrastrandoFrase: boolean;
  setArrastrandoFrase: (v: boolean) => void;
  /** Lo que necesita un nodo o un arco para recibir una frase arrastrada. */
  propsSoltarFrase: (id: string) => {
    onDragOver: (e: React.DragEvent) => void;
    onDrop: (e: React.DragEvent) => void;
  };
}

const EspacioContext = createContext<EspacioValor | null>(null);

export function useEspacio(): EspacioValor {
  const valor = useContext(EspacioContext);
  if (!valor) throw new Error("useEspacio fuera de <ProveedorEspacio>");
  return valor;
}

/* ── La URL como almacén ───────────────────────────────────────────────── */

const EVENTO = "acia:url-espacio";

function suscribir(alCambiar: () => void) {
  window.addEventListener(EVENTO, alCambiar);
  window.addEventListener("popstate", alCambiar);
  return () => {
    window.removeEventListener(EVENTO, alCambiar);
    window.removeEventListener("popstate", alCambiar);
  };
}

function leerParametro(nombre: string): string | null {
  try {
    return new URLSearchParams(window.location.search).get(nombre);
  } catch {
    return null;
  }
}

function escribirParametro(nombre: string, valor: string | null) {
  try {
    const url = new URL(window.location.href);
    if (valor) url.searchParams.set(nombre, valor);
    else url.searchParams.delete(nombre);
    window.history.replaceState(window.history.state, "", url);
  } catch {
    // Sin History API (muy raro): la selección vale igual mientras dure la página.
  }
  window.dispatchEvent(new Event(EVENTO));
}

const sinValorEnServidor = () => null;

const VISTAS: readonly IdVista[] = ["mapa", "blancos"];

export function ProveedorEspacio({
  analisis,
  notaOriginal,
  onEditar,
  children,
}: {
  analisis: AnalisisFuncional;
  notaOriginal: string;
  /** Edición del Mapa: la página muta una copia y marca la sección. */
  onEditar: (mutacion: (copia: AnalisisFuncional) => void) => void;
  children: ReactNode;
}) {
  const seleccionado = useSyncExternalStore(
    suscribir,
    () => leerParametro("foco"),
    sinValorEnServidor
  );
  const vistaCruda = useSyncExternalStore(
    suscribir,
    () => leerParametro("vista"),
    sinValorEnServidor
  );
  // Un valor que no existe (un enlace viejo, una vista retirada) cae en el Mapa.
  const vista: IdVista = VISTAS.includes(vistaCruda as IdVista)
    ? (vistaCruda as IdVista)
    : "mapa";

  const [fuenteAbierta, abrirFuente] = useState(false);
  const [pestanaInspector, elegirPestanaInspector] = useState<PestanaInspector>("detalle");
  const [menu, setMenu] = useState<MenuAbierto | null>(null);
  const abrirMenu = useCallback((id: string, x: number, y: number) => setMenu({ id, x, y }), []);
  const cerrarMenu = useCallback(() => setMenu(null), []);
  const lineasNota = useMemo(() => notaOriginal.replace(/\r\n/g, "\n").split("\n"), [notaOriginal]);
  const [arrastrandoFrase, setArrastrandoFrase] = useState(false);
  const [citaPulsada, setCitaPulsada] = useState<CitaResuelta | null>(null);

  const seleccionar = useCallback((id: string | null) => {
    setCitaPulsada(null);
    escribirParametro("foco", id);
  }, []);
  const elegirVista = useCallback((v: IdVista) => {
    escribirParametro("vista", v === "mapa" ? null : v);
  }, []);
  const irACita = useCallback((cita: CitaResuelta) => {
    setCitaPulsada(cita);
    abrirFuente(true);
  }, []);

  // Esc deshace la selección. Es un manejador de evento, no un efecto que
  // corrija estado: el listener solo existe mientras hay algo seleccionado.
  useEffect(() => {
    if (!seleccionado) return;
    const alPulsar = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      // Dentro de un campo, Esc es del campo (cancelar la edición), no del espacio.
      const destino = e.target;
      if (destino instanceof Element && destino.closest("input, textarea, select, [contenteditable]")) return;
      seleccionar(null);
    };
    window.addEventListener("keydown", alPulsar);
    return () => window.removeEventListener("keydown", alPulsar);
  }, [seleccionado, seleccionar]);

  /* ── Deshacer y rehacer del Mapa ── */
  const pila = useRef<AnalisisFuncional[]>([]);
  const pilaRehacer = useRef<AnalisisFuncional[]>([]);
  const [puedeDeshacer, setPuedeDeshacer] = useState(false);
  const [puedeRehacer, setPuedeRehacer] = useState(false);

  const aplicar = useCallback(
    (mutacion: (copia: AnalisisFuncional) => void) => {
      pila.current.push(structuredClone(analisis));
      if (pila.current.length > 80) pila.current.shift();
      pilaRehacer.current = [];
      setPuedeDeshacer(true);
      setPuedeRehacer(false);
      onEditar(mutacion);
    },
    [analisis, onEditar]
  );

  const restaurar = useCallback(
    (estado: AnalisisFuncional) => {
      onEditar((copia) => Object.assign(copia, structuredClone(estado)));
    },
    [onEditar]
  );

  const deshacer = useCallback(() => {
    const anterior = pila.current.pop();
    if (!anterior) return;
    pilaRehacer.current.push(structuredClone(analisis));
    setPuedeDeshacer(pila.current.length > 0);
    setPuedeRehacer(true);
    escribirParametro("foco", null);
    restaurar(anterior);
  }, [analisis, restaurar]);

  const rehacer = useCallback(() => {
    const siguiente = pilaRehacer.current.pop();
    if (!siguiente) return;
    pila.current.push(structuredClone(analisis));
    setPuedeDeshacer(true);
    setPuedeRehacer(pilaRehacer.current.length > 0);
    escribirParametro("foco", null);
    restaurar(siguiente);
  }, [analisis, restaurar]);

  const citarFrase = useCallback(
    (id: string, linea: number, frase: number) => {
      const cita = citaDeFrase(lineasNota, linea, frase);
      if (!cita) return;
      aplicar((copia) => {
        citarEnElemento(copia, id, cita);
      });
    },
    [lineasNota, aplicar]
  );

  const propsSoltarFrase = useCallback(
    (id: string) => ({
      onDragOver: (e: React.DragEvent) => {
        if (!e.dataTransfer.types.includes(TIPO_ARRASTRE_FRASE)) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
      },
      onDrop: (e: React.DragEvent) => {
        const crudo = e.dataTransfer.getData(TIPO_ARRASTRE_FRASE);
        if (!crudo) return;
        e.preventDefault();
        e.stopPropagation();
        setArrastrandoFrase(false);
        try {
          const { linea, frase } = JSON.parse(crudo) as { linea: unknown; frase: unknown };
          if (typeof linea === "number" && typeof frase === "number") {
            citarFrase(id, linea, frase);
            escribirParametro("foco", id);
          }
        } catch {
          // Algo que no es una frase de la Fuente: se ignora.
        }
      },
    }),
    [citarFrase]
  );

  const valor = useMemo<EspacioValor>(
    () => ({
      seleccionado,
      seleccionar,
      vista,
      elegirVista,
      fuenteAbierta,
      abrirFuente,
      citaEnFuente: citaPulsada,
      irACita,
      aplicar,
      deshacer,
      rehacer,
      puedeDeshacer,
      puedeRehacer,
      pestanaInspector,
      elegirPestanaInspector,
      menu,
      abrirMenu,
      cerrarMenu,
      lineasNota,
      citarFrase,
      arrastrandoFrase,
      setArrastrandoFrase,
      propsSoltarFrase,
    }),
    [
      seleccionado,
      seleccionar,
      vista,
      elegirVista,
      fuenteAbierta,
      citaPulsada,
      irACita,
      aplicar,
      deshacer,
      rehacer,
      puedeDeshacer,
      puedeRehacer,
      pestanaInspector,
      menu,
      abrirMenu,
      cerrarMenu,
      lineasNota,
      citarFrase,
      arrastrandoFrase,
      propsSoltarFrase,
    ]
  );

  return <EspacioContext.Provider value={valor}>{children}</EspacioContext.Provider>;
}
