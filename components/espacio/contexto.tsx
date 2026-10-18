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

type CitaResuelta = Extract<Cita, { verificada: true }>;

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
  onEditar,
  children,
}: {
  analisis: AnalisisFuncional;
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
    ]
  );

  return <EspacioContext.Provider value={valor}>{children}</EspacioContext.Provider>;
}
