"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight, HelpCircle, X } from "lucide-react";
import type { DatoFaltante, PreguntaPrevia } from "@/lib/types";

export interface RespuestaConfirmada {
  pregunta: string;
  respuesta: string;
}

export interface ResultadoPreguntas {
  confirmadas: RespuestaConfirmada[];
  /**
   * Lo que el terapeuta respondió "No sé" (o se omitió de golpe), ya con la
   * forma que tendrá en el informe: el hueco y por qué importa. El porqué
   * viaja desde la detección y no se reconstruye después — quien encontró el
   * vacío es quien sabe qué parte del análisis deja en el aire.
   */
  omitidas: DatoFaltante[];
}

/**
 * Paso previo al análisis completo: antes de gastar la llamada cara, se le
 * pregunta al terapeuta por los vacíos que detectó una llamada barata (ver
 * lib/datosFaltantesPrevios.ts). Lo que confirma se suma a la nota antes de
 * analizar; lo que no sabe queda declarado como dato faltante sin bloquear
 * nada — es justo la información que antes solo aparecía DESPUÉS del informe,
 * obligando a un reanálisis para incorporarla.
 *
 * Una pregunta a la vez, no un formulario largo: entran de una en una con la
 * animación `.pregunta-entra` (ver app/globals.css) para que se lea como una
 * conversación breve y no como una encuesta antes de poder trabajar.
 *
 * Va en una ventana modal (<dialog> nativo con showModal) y no incrustada bajo
 * el formulario: es un paso aparte, no parte de la nota, y el <dialog> ya trae
 * el foco atrapado, el fondo inerte y Escape sin código propio. Cerrarla
 * cancela el análisis y deja la nota como estaba — no equivale a "No sé".
 */
export default function PreguntasDatosFaltantes({
  preguntas,
  onCompletar,
  onCancelar,
}: {
  preguntas: PreguntaPrevia[];
  onCompletar: (resultado: ResultadoPreguntas) => void;
  onCancelar: () => void;
}) {
  const ventana = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ventana.current;
    if (d && !d.open) d.showModal();
    return () => d?.close();
  }, []);

  const [indice, setIndice] = useState(0);
  const [texto, setTexto] = useState("");
  const [confirmadas, setConfirmadas] = useState<RespuestaConfirmada[]>([]);
  const [omitidas, setOmitidas] = useState<DatoFaltante[]>([]);

  const preguntaActual = preguntas[indice];

  /** El hueco tal como quedará en el informe si esta pregunta no se responde. */
  function comoDatoFaltante(p: PreguntaPrevia): DatoFaltante {
    return { dato: p.pregunta, por_que_importa: p.por_que_importa };
  }

  function avanzar(
    siguientesConfirmadas: RespuestaConfirmada[],
    siguientesOmitidas: DatoFaltante[]
  ) {
    if (indice + 1 >= preguntas.length) {
      onCompletar({ confirmadas: siguientesConfirmadas, omitidas: siguientesOmitidas });
      return;
    }
    setIndice((i) => i + 1);
    setTexto("");
  }

  function confirmar() {
    if (!texto.trim()) return;
    const nuevas = [
      ...confirmadas,
      { pregunta: preguntaActual.pregunta, respuesta: texto.trim() },
    ];
    setConfirmadas(nuevas);
    avanzar(nuevas, omitidas);
  }

  function noSe() {
    const nuevas = [...omitidas, comoDatoFaltante(preguntaActual)];
    setOmitidas(nuevas);
    avanzar(confirmadas, nuevas);
  }

  function omitirResto() {
    onCompletar({
      confirmadas,
      omitidas: [...omitidas, ...preguntas.slice(indice).map(comoDatoFaltante)],
    });
  }

  return (
    <dialog
      ref={ventana}
      aria-labelledby="titulo-preguntas-previas"
      // Escape dispara "cancel"; se intercepta para que el cierre pase por el
      // estado de la página y no deje el <dialog> cerrado con estado "preguntando".
      onCancel={(e) => {
        e.preventDefault();
        onCancelar();
      }}
      className="m-auto w-[min(44rem,calc(100vw-2rem))] max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-3xl border border-divider bg-surface p-6 text-ink shadow-2xl backdrop:bg-black/50 backdrop:backdrop-blur-md sm:p-9"
    >
      <div className="flex items-center gap-4">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-accent-soft">
          <HelpCircle className="h-7 w-7 text-accent" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <p className="font-sans text-xs font-medium uppercase tracking-[0.12em] text-ink-muted">
              Pregunta {indice + 1} de {preguntas.length}
            </p>
            <span className="flex items-center gap-1.5" aria-hidden="true">
              {preguntas.map((_, i) => (
                <span
                  key={i}
                  className={`h-2 w-2 rounded-full transition-colors ${
                    i === indice ? "bg-accent" : i < indice ? "bg-accent/50" : "bg-divider"
                  }`}
                />
              ))}
            </span>
          </div>
          <h2
            id="titulo-preguntas-previas"
            className="mt-1 font-serif text-2xl font-semibold leading-tight text-ink sm:text-[28px]"
          >
            Antes de generar el análisis
          </h2>
        </div>
        <button
          type="button"
          onClick={onCancelar}
          aria-label="Cerrar y volver a la nota"
          title="Cerrar y volver a la nota"
          className="ml-auto flex h-10 w-10 shrink-0 items-center justify-center self-start rounded-full text-ink-muted transition-colors hover:bg-canvas hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
        >
          <X className="h-6 w-6" aria-hidden="true" />
        </button>
      </div>

      <p className="mt-5 border-b border-divider pb-5 text-[15px] leading-relaxed text-ink-muted">
        Tu nota no deja claro esto. Respóndelo si lo sabes; si no, pulsa «No
        sé» y quedará anotado para la sesión.
      </p>

      {/* key={indice} remonta el bloque en cada pregunta nueva, que es lo que
          dispara la animación de entrada (ver app/globals.css). */}
      <div key={indice} className="pregunta-entra mt-6">
        <label
          htmlFor="respuesta-dato-faltante"
          className="block font-serif text-xl font-semibold leading-snug text-accent sm:text-[26px]"
        >
          {preguntaActual.pregunta}
        </label>
        {/* Por qué importa, no como adorno: es lo que distingue un matiz de un
            bloqueante antes de decidir si vale la pena buscar la respuesta, y
            es el mismo texto que acompañará al hueco en el informe si aquí se
            responde "No sé". */}
        {preguntaActual.por_que_importa && (
          <p className="mt-2 text-[15px] leading-relaxed text-ink-muted">
            {preguntaActual.por_que_importa}
          </p>
        )}
        <textarea
          id="respuesta-dato-faltante"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          rows={4}
          placeholder="Escribe tu respuesta…"
          autoFocus
          className="mt-5 w-full resize-y rounded-xl border border-divider bg-canvas px-4 py-3.5 text-base leading-relaxed text-ink placeholder:text-ink-muted focus-visible:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30"
        />
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={confirmar}
            disabled={!texto.trim()}
            className="inline-flex items-center gap-3 rounded-xl bg-accent px-6 py-3 text-base font-medium texto-sobre-acento shadow-sm transition-colors hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
          >
            Confirmar
            <ArrowRight className="h-5 w-5" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={noSe}
            className="rounded-xl border border-divider bg-surface px-6 py-3 text-base font-medium text-ink transition-colors hover:bg-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
          >
            No sé
          </button>
          {preguntas.length > 1 && (
            <button
              type="button"
              onClick={omitirResto}
              className="ml-auto text-sm text-ink underline underline-offset-4 decoration-ink-muted/60 transition-colors hover:decoration-ink"
            >
              Omitir el resto y analizar
            </button>
          )}
        </div>
      </div>
    </dialog>
  );
}
