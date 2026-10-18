"use client";

/**
 * Menú de un nodo o una relación del Mapa: lo que antes eran botones sueltos
 * en cada línea (fase 5C). Se abre con el clic derecho, con la tecla Menú o
 * Shift+F10 sobre el elemento enfocado, o con «⋯» en la cabecera del
 * Inspector, que es el camino del teclado y de la pantalla táctil.
 *
 * Solo hay uno abierto a la vez y vive en el contexto del espacio, así que
 * cualquier pieza (tablero, Inspector) lo abre con `abrirMenu(id, x, y)`.
 */

import { useEffect, useMemo, useRef, type CSSProperties } from "react";
import type { AnalisisFuncional } from "@/lib/types";
import { borrarNodo, construirNodosGrafo } from "@/lib/grafo";
import { confirmarElemento, procedenciaDe } from "@/lib/procedencia";
import { convertirEnPregunta, destinosPosibles, ETIQUETA_DESTINO_CARRIL } from "@/lib/edicionMapa";
import { nuevoIdPregunta } from "@/lib/preguntas";
import type { EditarSeccion } from "../informe/PreguntasClinicas";
import { useEspacio } from "./contexto";

interface Accion {
  etiqueta: string;
  /** Por qué no se puede todavía; sin esto, la acción está disponible. */
  deshabilitada?: string;
  ejecutar: () => void;
}

export default function MenuElemento({
  analisis,
  onEditarSeccion,
}: {
  analisis: AnalisisFuncional;
  onEditarSeccion: EditarSeccion;
}) {
  const { menu, cerrarMenu, seleccionar, aplicar, abrirEvidencia, moverNodo } = useEspacio();
  const raiz = useRef<HTMLDivElement>(null);
  const nodos = useMemo(() => construirNodosGrafo(analisis), [analisis]);

  const acciones = useMemo<Accion[]>(() => {
    if (!menu) return [];
    const { id } = menu;
    const esNodo = nodos.some((n) => n.id === id);
    const esArista = analisis.aristas.some((a) => a.id === id);
    if (!esNodo && !esArista) return [];
    const estado = procedenciaDe(analisis, id).estado;
    const lista: Accion[] = [
      {
        etiqueta: "Confirmar",
        // Confirmar es decidir sobre una propuesta de la IA: lo tuyo o lo que
        // ya cambiaste no vuelve a ser «confirmado» (lib/procedencia.ts).
        deshabilitada:
          estado === "propuesta" ? undefined : estado === "confirmado" ? "Ya está confirmado" : "Es tuyo: no hay propuesta que confirmar",
        ejecutar: () => onEditarSeccion(null, (copia) => confirmarElemento(copia, id)),
      },
    ];
    if (esNodo) {
      lista.push({
        etiqueta: "Convertir en pregunta",
        ejecutar: () => {
          // El id se calcula sobre el estado actual, que es del que parte la
          // copia: `aplicar` puede ejecutar la mutación más tarde.
          const nueva = nuevoIdPregunta(analisis.preguntas);
          aplicar((copia) => {
            convertirEnPregunta(copia, id);
          });
          seleccionar(nueva);
        },
      });
    }
    // La frase sale en una tarjeta junto al sitio donde se abrió el menú.
    const { x, y } = menu;
    lista.push({
      etiqueta: "Ver evidencia",
      ejecutar: () => {
        seleccionar(id);
        abrirEvidencia(id, x, y);
      },
    });
    if (esNodo) {
      lista.push({ etiqueta: "Crear blanco", deshabilitada: "Llega en la fase 6", ejecutar: () => {} });
      // El camino sin ratón de arrastrar el nodo a otro carril.
      for (const destino of destinosPosibles(analisis, id)) {
        lista.push({ etiqueta: `Mover a: ${ETIQUETA_DESTINO_CARRIL[destino]}`, ejecutar: () => moverNodo(id, destino) });
      }
    }
    lista.push({
      etiqueta: "Borrar",
      ejecutar: () => {
        seleccionar(null);
        aplicar((copia) => {
          if (esNodo) borrarNodo(copia, id);
          else copia.aristas = copia.aristas.filter((a) => a.id !== id);
        });
      },
    });
    return lista;
  }, [menu, nodos, analisis, onEditarSeccion, aplicar, seleccionar, abrirEvidencia, moverNodo]);

  // Se cierra al pulsar fuera, al hacer scroll o con Esc. Son manejadores de
  // evento: no corrigen estado de React desde el efecto.
  useEffect(() => {
    if (!menu) return;
    const fuera = (e: Event) => {
      if (raiz.current && e.target instanceof Node && raiz.current.contains(e.target)) return;
      cerrarMenu();
    };
    window.addEventListener("pointerdown", fuera, true);
    window.addEventListener("scroll", cerrarMenu, true);
    window.addEventListener("resize", cerrarMenu);
    return () => {
      window.removeEventListener("pointerdown", fuera, true);
      window.removeEventListener("scroll", cerrarMenu, true);
      window.removeEventListener("resize", cerrarMenu);
    };
  }, [menu, cerrarMenu]);

  if (!menu || acciones.length === 0) return null;

  // Dentro de la pantalla sin medir nada: cerca del borde derecho o del de
  // abajo se ancla por ese lado. Calcularlo al pintar evita un efecto que
  // recoloque el menú y un fotograma con él cortado.
  const posicion: CSSProperties = {
    ...(menu.x > window.innerWidth - 224 ? { right: Math.max(8, window.innerWidth - menu.x) } : { left: menu.x }),
    ...(menu.y > window.innerHeight * 0.6 ? { bottom: Math.max(8, window.innerHeight - menu.y) } : { top: menu.y }),
  };
  const primera = acciones.findIndex((a) => !a.deshabilitada);

  const moverFoco = (paso: 1 | -1) => {
    const botones = [...(raiz.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)") ?? [])];
    const i = botones.indexOf(document.activeElement as HTMLButtonElement);
    botones[(i + paso + botones.length) % botones.length]?.focus();
  };

  return (
    <div
      // Una apertura, un montaje: así la primera acción recibe el foco.
      key={`${menu.id}-${menu.x}-${menu.y}`}
      ref={raiz}
      role="menu"
      aria-label="Acciones del elemento"
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          e.stopPropagation();
          cerrarMenu();
        } else if (e.key === "ArrowDown") {
          e.preventDefault();
          moverFoco(1);
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          moverFoco(-1);
        }
      }}
      style={posicion}
      className="fixed z-50 min-w-[12rem] rounded-md border border-divider bg-surface py-1 text-sm shadow-lg print:hidden"
    >
      {acciones.map((a, i) => (
        <button
          // Menú recién abierto: el foco va a su primera acción disponible.
          autoFocus={i === primera}
          key={a.etiqueta}
          type="button"
          role="menuitem"
          disabled={Boolean(a.deshabilitada)}
          title={a.deshabilitada}
          onClick={() => {
            cerrarMenu();
            a.ejecutar();
          }}
          className={`flex w-full items-baseline justify-between gap-3 px-3 py-1.5 text-left hover:bg-canvas focus-visible:bg-canvas focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 ${a.etiqueta === "Borrar" ? "text-warn" : "text-ink"}`}
        >
          {a.etiqueta}
          {a.deshabilitada && <span className="text-[11px] text-ink-muted">{a.deshabilitada}</span>}
        </button>
      ))}
    </div>
  );
}
