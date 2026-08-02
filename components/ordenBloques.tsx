"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";

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

  const guardar = useCallback((nuevo: string[]) => {
    escribirCrudo(JSON.stringify(nuevo));
  }, []);

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
  const [encima, setEncima] = useState(false);

  if (!ctx) return <>{children}</>;

  const seEstaArrastrando = ctx.arrastrando === id;

  return (
    <div
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
      className={`group/bloque relative transition-opacity ${
        seEstaArrastrando ? "opacity-40" : ""
      } ${encima ? "before:absolute before:-top-2 before:left-0 before:h-0.5 before:w-full before:rounded before:bg-accent" : ""}`}
    >
      {/*
        Los controles viven fuera del flujo, a la izquierda, y solo aparecen al
        pasar por encima: el informe se lee igual que antes para quien no vaya a
        reordenarlo. Nunca se imprimen.
      */}
      <div className="absolute -left-1 top-1 z-10 flex -translate-x-full flex-col items-center gap-0.5 opacity-0 transition-opacity group-hover/bloque:opacity-100 focus-within:opacity-100 print:hidden">
        <button
          type="button"
          onClick={() => ctx.desplazar(id, -1)}
          aria-label={`Subir «${titulo}»`}
          className="rounded px-1 text-ink-muted/60 transition-colors hover:bg-canvas hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
        >
          <span aria-hidden="true" className="text-xs">▲</span>
        </button>
        <span
          draggable
          onDragStart={(e) => {
            e.dataTransfer.setData("text/plain", id);
            e.dataTransfer.effectAllowed = "move";
            ctx.setArrastrando(id);
          }}
          onDragEnd={() => ctx.setArrastrando(null)}
          role="button"
          tabIndex={-1}
          aria-label={`Arrastrar «${titulo}» para reordenar`}
          title="Arrastra para mover este bloque"
          className="cursor-grab select-none rounded px-1 text-ink-muted/60 transition-colors hover:bg-canvas hover:text-accent active:cursor-grabbing"
        >
          <span aria-hidden="true" className="text-sm leading-none">⠿</span>
        </span>
        <button
          type="button"
          onClick={() => ctx.desplazar(id, 1)}
          aria-label={`Bajar «${titulo}»`}
          className="rounded px-1 text-ink-muted/60 transition-colors hover:bg-canvas hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
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
      className="font-mono text-[10px] uppercase tracking-wide text-ink-muted/70 transition-colors hover:text-accent print:hidden"
    >
      Restaurar el orden original
    </button>
  );
}
