"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { Plus } from "lucide-react";

/**
 * Edición manual del informe.
 *
 * Por qué existe: hasta ahora, corregir una hipótesis errónea obligaba a pedirle
 * a la IA que rehiciera la sección entera. El clínico es quien sabe del caso;
 * debe poder escribir directamente.
 *
 * Reglas que sostienen las piezas de este archivo:
 *
 * - Solo texto libre. Las clasificaciones (tipo, importancia, confianza,
 *   contingencia) siguen siendo del análisis, no editables: cambiarlas a mano
 *   dejaría los chips diciendo algo que el resto del informe no sostiene.
 * - Por elemento, no por sección. Editas UNA conducta y las demás quedan
 *   intactas — así el informe sigue siendo datos estructurados y no un bloque
 *   de texto plano.
 * - Lo editado se marca a nivel de sección. Contrapartida del invariante 2 en
 *   el sentido inverso: igual que no se presenta como textual lo que redactó la
 *   IA, no se presenta como generado lo que escribió el profesional.
 */

/**
 * La presencia del contexto es lo que habilita la edición. Los cambios en sí
 * no pasan por aquí: cada campo recibe su propio callback ya enlazado a
 * ReportView#onEditarSeccion, que es quien muta el análisis y marca la sección.
 */
interface EdicionContextValor {
  seccionesEditadas: string[];
}

const EdicionContext = createContext<EdicionContextValor | null>(null);

export function ProveedorEdicion({
  valor,
  children,
}: {
  valor: EdicionContextValor;
  children: ReactNode;
}) {
  return (
    <EdicionContext.Provider value={valor}>{children}</EdicionContext.Provider>
  );
}

export function useEdicion(): EdicionContextValor | null {
  return useContext(EdicionContext);
}

/** Sección en la que el clínico ha escrito. Textual a propósito: sobrevive impreso y en blanco y negro. */
export function MarcaEditado() {
  return (
    <span className="marca-editado inline-flex items-center gap-1.5 rounded border border-accent/40 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide text-accent">
      <span aria-hidden="true">✎</span>
      Editado por ti
    </span>
  );
}

const CLASE_BOTON_SUTIL =
  "rounded px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-ink-muted transition-colors hover:bg-canvas hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40";

/**
 * Texto del informe que el clínico puede reescribir. Fuera del modo edición se
 * comporta exactamente como el texto de antes, para no cambiar la lectura del
 * informe a quien no vaya a editarlo.
 */
export function TextoEditable({
  valor,
  onCambio,
  seccionId,
  etiqueta,
  className = "text-[15px] leading-relaxed text-ink",
  multilinea = true,
  onBorrar,
}: {
  valor: string;
  onCambio: (nuevo: string) => void;
  seccionId: string;
  /** Para el lector de pantalla: qué se está editando. */
  etiqueta: string;
  className?: string;
  multilinea?: boolean;
  /**
   * Quitar el elemento entero. Vive dentro del editor abierto y no en la línea:
   * un botón por línea llenaba el informe de controles que casi nunca se usan.
   */
  onBorrar?: () => void;
}) {
  const edicion = useEdicion();
  const [editando, setEditando] = useState(false);
  const [borrador, setBorrador] = useState(valor);
  const [confirmandoBorrar, setConfirmandoBorrar] = useState(false);

  if (!edicion) return <p className={className}>{valor}</p>;

  // El lector de pantalla necesita saber en qué parte del informe está.
  const etiquetaCompleta = `${etiqueta} (sección ${seccionId})`;

  function abrir() {
    setBorrador(valor);
    setConfirmandoBorrar(false);
    setEditando(true);
  }

  function guardar() {
    const limpio = borrador.trim();
    // Un campo vaciado se descarta: para eliminar contenido está el botón de
    // borrar del elemento, que quita la entrada entera y no deja un hueco.
    if (limpio && limpio !== valor) onCambio(limpio);
    setEditando(false);
  }

  if (editando) {
    return (
      <div className="my-1">
        {multilinea ? (
          <textarea
            autoFocus
            value={borrador}
            onChange={(e) => setBorrador(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") setEditando(false);
            }}
            rows={Math.min(10, Math.max(2, Math.ceil(borrador.length / 70)))}
            aria-label={etiquetaCompleta}
            className="w-full rounded border border-accent bg-surface p-2 text-[15px] leading-relaxed text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
          />
        ) : (
          <input
            autoFocus
            type="text"
            value={borrador}
            onChange={(e) => setBorrador(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") setEditando(false);
              if (e.key === "Enter") guardar();
            }}
            aria-label={etiquetaCompleta}
            className="w-full rounded border border-accent bg-surface p-2 text-[15px] text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
          />
        )}
        <div className="mt-1 flex gap-2">
          <button type="button" onClick={guardar} className={CLASE_BOTON_SUTIL}>
            Guardar
          </button>
          <button
            type="button"
            onClick={() => setEditando(false)}
            className={CLASE_BOTON_SUTIL}
          >
            Cancelar
          </button>
          {onBorrar &&
            (confirmandoBorrar ? (
              <span className="ml-auto inline-flex items-center gap-2">
                <span className="font-mono text-[10px] uppercase tracking-wide text-ink-muted">¿Borrar?</span>
                <button
                  type="button"
                  onClick={() => {
                    setEditando(false);
                    onBorrar();
                  }}
                  className={CLASE_BOTON_SUTIL}
                >
                  Sí, borrar
                </button>
                <button type="button" onClick={() => setConfirmandoBorrar(false)} className={CLASE_BOTON_SUTIL}>
                  No
                </button>
              </span>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmandoBorrar(true)}
                aria-label={`Borrar: ${etiquetaCompleta}`}
                className={`${CLASE_BOTON_SUTIL} ml-auto`}
              >
                Borrar
              </button>
            ))}
        </div>
      </div>
    );
  }

  // El texto es el control: parece texto y se edita al hacer clic, sin un
  // botón «Editar» por línea (fase 5C).
  return (
    <p
      role="button"
      tabIndex={0}
      onClick={abrir}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          abrir();
        }
      }}
      aria-label={`${valor}. Editar ${etiquetaCompleta}`}
      title="Clic para editar"
      className={`${className} -mx-1 cursor-text rounded px-1 transition-colors hover:bg-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 print:mx-0 print:px-0`}
    >
      {valor}
    </p>
  );
}

/** Añade un elemento que la IA no recogió. */
export function BotonAgregar({
  onAgregar,
  etiqueta,
  claseBoton,
}: {
  onAgregar: (texto: string) => void;
  etiqueta: string;
  /** Sustituye el estilo del botón cerrado. */
  claseBoton?: string;
}) {
  const edicion = useEdicion();
  const [abierto, setAbierto] = useState(false);
  const [texto, setTexto] = useState("");

  if (!edicion) return null;

  function agregar() {
    const limpio = texto.trim();
    if (!limpio) return;
    onAgregar(limpio);
    setTexto("");
    setAbierto(false);
  }

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className={claseBoton ?? `${CLASE_BOTON_SUTIL} mt-3 print:hidden`}
      >
        {claseBoton ? <Plus className="h-4 w-4" aria-hidden="true" /> : "+ "}Agregar {etiqueta}
      </button>
    );
  }

  return (
    <div className="mt-3 print:hidden">
      <textarea
        autoFocus
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") setAbierto(false);
        }}
        rows={2}
        aria-label={`Agregar ${etiqueta}`}
        placeholder={`Escribe ${etiqueta} y guarda.`}
        className="w-full rounded border border-accent bg-surface p-2 text-[15px] leading-relaxed text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
      />
      <div className="mt-1 flex gap-2">
        <button type="button" onClick={agregar} className={CLASE_BOTON_SUTIL}>
          Guardar
        </button>
        <button
          type="button"
          onClick={() => setAbierto(false)}
          className={CLASE_BOTON_SUTIL}
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
