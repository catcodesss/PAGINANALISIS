"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { useEdicion } from "./edicionManual";

/**
 * Orden de los bloques del informe, a gusto del clínico.
 *
 * Cada quien lee un caso en un orden distinto: uno quiere el riesgo arriba del
 * todo, otro prefiere entrar por la formulación. En vez de imponer uno, el
 * profesional arrastra los bloques y el informe queda como le sirve.
 *
 * Se reordena con `order` de CSS, no moviendo el JSX: los bloques siguen
 * montados en el mismo sitio del árbol, así que reordenar no desmonta nada ni
 * pierde el estado de las secciones abiertas para editar o reanalizar. Y el
 * orden vale igual en pantalla y al imprimir, porque es el mismo DOM.
 *
 * El orden es una preferencia de lectura, no contenido clínico: se guarda en
 * localStorage sin rozar el invariante 5.
 */

const CLAVE_ALMACEN = "acia-orden-bloques";

/**
 * localStorage leído como almacén externo, que es lo que es. Con
 * useSyncExternalStore el servidor devuelve el orden de fábrica y el cliente el
 * guardado, sin el rodeo de escribir estado dentro de un efecto.
 */
const suscriptores = new Set<() => void>();

function suscribir(alCambiar: () => void) {
  suscriptores.add(alCambiar);
  return () => {
    suscriptores.delete(alCambiar);
  };
}

/** Devuelve el JSON crudo: una cadena, así que React la compara por valor. */
function leerCrudo(): string {
  try {
    return localStorage.getItem(CLAVE_ALMACEN) ?? "";
  } catch {
    return "";
  }
}

/** En el servidor no hay nada guardado: el orden de fábrica. */
function leerCrudoEnServidor(): string {
  return "";
}

/**
 * El orden guardado, sin hooks: lo necesita la exportación, que se dispara
 * desde un manejador de evento y no desde un render. Reconcilia igual que el
 * proveedor — descarta ids desconocidos y añade al final los que falten — para
 * que un orden viejo nunca haga desaparecer un bloque del documento.
 */
export function leerOrdenGuardado(idsPorDefecto: string[]): string[] {
  let guardado: unknown = null;
  try {
    const crudo = leerCrudo();
    guardado = crudo ? JSON.parse(crudo) : null;
  } catch {
    return idsPorDefecto;
  }
  if (!Array.isArray(guardado)) return idsPorDefecto;
  const conocidos = guardado.filter(
    (id): id is string => typeof id === "string" && idsPorDefecto.includes(id)
  );
  return [...conocidos, ...idsPorDefecto.filter((id) => !conocidos.includes(id))];
}

function escribirCrudo(valor: string) {
  try {
    localStorage.setItem(CLAVE_ALMACEN, valor);
  } catch {
    // Modo privado o almacenamiento lleno: el orden vale para esta sesión.
  }
  for (const alCambiar of suscriptores) alCambiar();
}

interface OrdenContextValor {
  /** Posición de un bloque, para el `order` de CSS. */
  posicion: (id: string) => number;
  /** Coloca `origen` en el sitio de `destino`, desplazando el resto. */
  soltarSobre: (origen: string, destino: string) => void;
  /** Sube (-1) o baja (+1) un bloque. La alternativa por teclado al arrastre. */
  desplazar: (id: string, salto: number) => void;
  ordenar: (ids: string[]) => string[];
  arrastrando: string | null;
  setArrastrando: (id: string | null) => void;
  restaurar: () => void;
  esPersonalizado: boolean;
}

const OrdenContext = createContext<OrdenContextValor | null>(null);

export function useOrden(): OrdenContextValor | null {
  return useContext(OrdenContext);
}

/**
 * Animación del reordenado, por la técnica FLIP.
 *
 * Reordenar con `order` de CSS es instantáneo: el bloque aparece de golpe en
 * su nuevo sitio y cuesta seguir qué se movió y adónde. FLIP resuelve eso sin
 * renunciar a `order`: se anota dónde estaba cada pieza ANTES del cambio, se
 * deja que el navegador la recoloque, y justo antes de pintar se la desplaza
 * de vuelta a su posición vieja para animarla desde ahí hasta la nueva. El
 * usuario ve el movimiento; el DOM nunca estuvo en un estado intermedio.
 *
 * Se usa la API de animaciones del navegador en vez de una transición CSS
 * porque el elemento no cambia de estilo —cambia de sitio—, y porque así la
 * animación se limpia sola al terminar.
 */
const DURACION_MS = 260;

function medirPosiciones(): Map<string, number> {
  const posiciones = new Map<string, number>();
  document.querySelectorAll<HTMLElement>("[data-bloque-id]").forEach((el) => {
    const id = el.dataset.bloqueId;
    if (id) posiciones.set(id, el.getBoundingClientRect().top);
  });
  return posiciones;
}

function animarDesde(previas: Map<string, number>) {
  // Respetar a quien pidió menos movimiento: la regla de globals.css no
  // alcanza a las animaciones lanzadas desde JavaScript.
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  document.querySelectorAll<HTMLElement>("[data-bloque-id]").forEach((el) => {
    const id = el.dataset.bloqueId;
    if (!id) return;
    const antes = previas.get(id);
    if (antes === undefined) return;
    const desplazamiento = antes - el.getBoundingClientRect().top;
    if (Math.abs(desplazamiento) < 1) return;
    el.animate(
      [
        { transform: `translateY(${desplazamiento}px)` },
        { transform: "translateY(0)" },
      ],
      { duration: DURACION_MS, easing: "cubic-bezier(0.2, 0, 0, 1)" }
    );
  });
}

/** useLayoutEffect avisa en el servidor; aquí solo hay DOM en el cliente. */
const useEfectoDeDisposicion =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

function mover(lista: string[], origen: string, destino: string): string[] {
  const desde = lista.indexOf(origen);
  const hasta = lista.indexOf(destino);
  if (desde === -1 || hasta === -1 || desde === hasta) return lista;
  const copia = [...lista];
  copia.splice(desde, 1);
  copia.splice(hasta, 0, origen);
  return copia;
}

export function ProveedorOrden({
  idsPorDefecto,
  children,
}: {
  idsPorDefecto: string[];
  children: ReactNode;
}) {
  const [arrastrando, setArrastrando] = useState<string | null>(null);
  const crudo = useSyncExternalStore(suscribir, leerCrudo, leerCrudoEnServidor);

  const orden = useMemo(() => {
    let guardado: unknown = null;
    try {
      guardado = crudo ? JSON.parse(crudo) : null;
    } catch {
      return idsPorDefecto;
    }
    if (!Array.isArray(guardado)) return idsPorDefecto;
    // Un orden guardado con otra versión de la app puede traer bloques que ya
    // no existen, o no traer los nuevos. Se reconcilia con los ids actuales.
    const conocidos = guardado.filter(
      (id): id is string => typeof id === "string" && idsPorDefecto.includes(id)
    );
    const nuevos = idsPorDefecto.filter((id) => !conocidos.includes(id));
    return [...conocidos, ...nuevos];
  }, [crudo, idsPorDefecto]);

  // Dónde estaba cada pieza justo antes del último cambio de orden.
  const posicionesPrevias = useRef<Map<string, number> | null>(null);

  const guardar = useCallback((nuevo: string[]) => {
    posicionesPrevias.current = medirPosiciones();
    escribirCrudo(JSON.stringify(nuevo));
  }, []);

  // Corre después de recolocar y antes de pintar: es la única ventana en la
  // que se puede devolver la pieza a su sitio viejo sin que se vea el salto.
  useEfectoDeDisposicion(() => {
    const previas = posicionesPrevias.current;
    if (!previas) return;
    posicionesPrevias.current = null;
    animarDesde(previas);
  }, [orden]);

  const valor = useMemo<OrdenContextValor>(() => {
    const posicion = (id: string) => {
      const i = orden.indexOf(id);
      return i === -1 ? orden.length : i;
    };
    return {
      posicion,
      soltarSobre: (origen, destino) => guardar(mover(orden, origen, destino)),
      desplazar: (id, salto) => {
        const destino = orden[orden.indexOf(id) + salto];
        if (destino) guardar(mover(orden, id, destino));
      },
      ordenar: (ids) => [...ids].sort((a, b) => posicion(a) - posicion(b)),
      arrastrando,
      setArrastrando,
      restaurar: () => guardar(idsPorDefecto),
      esPersonalizado: orden.join() !== idsPorDefecto.join(),
    };
  }, [orden, arrastrando, guardar, idsPorDefecto]);

  return <OrdenContext.Provider value={valor}>{children}</OrdenContext.Provider>;
}

/**
 * Envoltorio de un bloque del informe: le da su posición y el asa para
 * arrastrarlo. Sin el contexto se comporta como un div normal, así que los
 * bloques siguen funcionando aunque no haya ordenación.
 */
export function BloqueOrdenable({
  id,
  titulo,
  children,
}: {
  id: string;
  /** Para el lector de pantalla y el texto de los botones. */
  titulo: string;
  children: ReactNode;
}) {
  const ctx = useOrden();
  const edicion = useEdicion();
  const [encima, setEncima] = useState(false);

  if (!ctx) return <>{children}</>;

  const seEstaArrastrando = ctx.arrastrando === id;
  const editada = edicion?.seccionesEditadas.includes(id) ?? false;

  /**
   * El bloque entero se arrastra, pero no desde cualquier sitio: si el gesto
   * empieza sobre un control o sobre texto que el clínico está seleccionando,
   * se cancela. Sin esto, arrastrar para copiar una cita movería el bloque, y
   * escribir en un cuadro de texto sería imposible.
   */
  function empezarArrastre(e: React.DragEvent) {
    const destino = e.target as HTMLElement;
    if (destino.closest?.("input, textarea, select, button, a, [contenteditable='true']")) {
      e.preventDefault();
      return;
    }
    if (window.getSelection()?.toString()) {
      e.preventDefault();
      return;
    }
    e.dataTransfer.setData("text/plain", id);
    e.dataTransfer.effectAllowed = "move";
    ctx!.setArrastrando(id);
  }

  return (
    <div
      data-bloque-id={id}
      draggable
      onDragStart={empezarArrastre}
      onDragEnd={() => ctx.setArrastrando(null)}
      style={{ order: ctx.posicion(id) }}
      onDragOver={(e) => {
        if (!ctx.arrastrando || ctx.arrastrando === id) return;
        e.preventDefault();
        setEncima(true);
      }}
      onDragLeave={() => setEncima(false)}
      onDrop={(e) => {
        e.preventDefault();
        setEncima(false);
        const origen = e.dataTransfer.getData("text/plain") || ctx.arrastrando;
        if (origen && origen !== id) ctx.soltarSobre(origen, id);
      }}
      /*
        Cada bloque es una pieza con su propio borde: así se ve que se puede
        coger y recolocar, en vez de ser un tramo de una lista continua. El
        borde izquierdo en color de acento marca las que editó el clínico
        (invariante 6) y vive aquí, en la pieza, no dentro de ella.
      */
      /*
        La transición se limita a lo que se ve, y NUNCA a `order`: es un entero
        animable, así que `transition-all` lo interpolaba paso a paso. El bloque
        seguía en su sitio viejo cuando FLIP medía la posición nueva, el
        desplazamiento salía de cero y la animación no llegaba a lanzarse.
      */
      className={`bloque-informe group/bloque relative mb-4 cursor-grab rounded-xl border bg-surface p-5 transition-[border-color,box-shadow,opacity] duration-150 active:cursor-grabbing sm:p-6 ${
        seEstaArrastrando ? "opacity-40" : ""
      } ${
        encima
          ? "border-accent ring-2 ring-accent/30"
          : "border-divider hover:border-ink-muted/40"
      } ${editada ? "bloque-editado border-l-2 border-l-accent" : ""}`}
    >
      {/*
        Los controles viven fuera del flujo, a la izquierda, y solo aparecen al
        pasar por encima: el informe se lee igual que antes para quien no vaya a
        reordenarlo. Nunca se imprimen.
      */}
      {/*
        `controles-bloque` no es decoración: en una pantalla táctil no existe el
        hover, así que sin la regla de globals.css estos controles se quedarían
        invisibles para siempre y reordenar sería imposible desde el móvil.
      */}
      <div className="controles-bloque absolute -left-1 top-1 z-10 flex -translate-x-full flex-col items-center gap-0.5 opacity-0 transition-opacity group-hover/bloque:opacity-100 focus-within:opacity-100 print:hidden">
        <button
          type="button"
          onClick={() => ctx.desplazar(id, -1)}
          aria-label={`Subir «${titulo}»`}
          className="rounded px-1 text-ink-muted transition-colors hover:bg-canvas hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
        >
          <span aria-hidden="true" className="text-xs">▲</span>
        </button>
        {/*
          Ya no hay asa: se arrastra la pieza entera. Estos dos botones se
          quedan porque son la única forma de reordenar con el teclado, y
          porque en una pantalla táctil arrastrar compite con desplazar la
          página.
        */}
        <button
          type="button"
          onClick={() => ctx.desplazar(id, 1)}
          aria-label={`Bajar «${titulo}»`}
          className="rounded px-1 text-ink-muted transition-colors hover:bg-canvas hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
        >
          <span aria-hidden="true" className="text-xs">▼</span>
        </button>
      </div>
      {children}
    </div>
  );
}

/** Vuelve al orden de fábrica. Solo aparece si el clínico ha movido algo. */
export function BotonRestaurarOrden() {
  const ctx = useOrden();
  if (!ctx?.esPersonalizado) return null;
  return (
    <button
      type="button"
      onClick={ctx.restaurar}
      className="font-mono text-[10px] uppercase tracking-wide text-ink-muted transition-colors hover:text-accent print:hidden"
    >
      Restaurar el orden original
    </button>
  );
}
