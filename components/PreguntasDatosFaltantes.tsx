"use client";

import { useState } from "react";
import { HelpCircle } from "lucide-react";

export interface RespuestaConfirmada {
  pregunta: string;
  respuesta: string;
}

export interface ResultadoPreguntas {
  confirmadas: RespuestaConfirmada[];
  /** Preguntas a las que el terapeuta respondió "No sé" (o que se omitieron todas de golpe). */
  omitidas: string[];
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
 */
export default function PreguntasDatosFaltantes({
  preguntas,
  onCompletar,
}: {
  preguntas: string[];
  onCompletar: (resultado: ResultadoPreguntas) => void;
}) {
  const [indice, setIndice] = useState(0);
  const [texto, setTexto] = useState("");
  const [confirmadas, setConfirmadas] = useState<RespuestaConfirmada[]>([]);
  const [omitidas, setOmitidas] = useState<string[]>([]);

  const preguntaActual = preguntas[indice];

  function avanzar(
    siguientesConfirmadas: RespuestaConfirmada[],
    siguientesOmitidas: string[]
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
    const nuevas = [...confirmadas, { pregunta: preguntaActual, respuesta: texto.trim() }];
    setConfirmadas(nuevas);
    avanzar(nuevas, omitidas);
  }

  function noSe() {
    const nuevas = [...omitidas, preguntaActual];
    setOmitidas(nuevas);
    avanzar(confirmadas, nuevas);
  }

  function omitirResto() {
    onCompletar({ confirmadas, omitidas: [...omitidas, ...preguntas.slice(indice)] });
  }

  return (
    <div className="rounded-2xl border border-divider bg-surface p-5 shadow-sm sm:p-6">
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent-soft">
          <HelpCircle className="h-[18px] w-[18px] text-accent" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="font-serif text-base font-semibold text-ink sm:text-lg">
            Antes de generar el análisis
          </p>
          <p className="font-mono text-[11px] uppercase tracking-wide text-ink-muted">
            Pregunta {indice + 1} de {preguntas.length}
          </p>
        </div>
      </div>

      <p className="mt-2 text-sm leading-relaxed text-ink-muted">
        Tu nota no deja claro esto. Respóndelo de memoria si lo sabes: se suma
        a la nota antes de analizar, así el informe no lo marca como
        faltante ni hace falta reanalizar después para incorporarlo. Si no lo
        sabes, dilo — el análisis sigue igual y quedará anotado para
        confirmarlo en sesión.
      </p>

      {/* key={indice} remonta el bloque en cada pregunta nueva, que es lo que
          dispara la animación de entrada (ver app/globals.css). */}
      <div key={indice} className="pregunta-entra mt-5">
        <label
          htmlFor="respuesta-dato-faltante"
          className="block font-serif text-[17px] leading-relaxed text-ink"
        >
          {preguntaActual}
        </label>
        <textarea
          id="respuesta-dato-faltante"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          rows={3}
          placeholder="Escribe tu respuesta…"
          autoFocus
          className="mt-3 w-full resize-y rounded-lg border border-divider bg-surface px-3 py-2.5 text-[15px] leading-relaxed text-ink placeholder:text-ink-muted focus-visible:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30"
        />
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={confirmar}
            disabled={!texto.trim()}
            className="rounded bg-accent px-4 py-2 text-sm font-medium texto-sobre-acento transition-colors hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
          >
            Confirmar
          </button>
          <button
            type="button"
            onClick={noSe}
            className="rounded border border-divider px-4 py-2 text-sm font-medium text-ink transition-colors hover:bg-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
          >
            No sé
          </button>
          {preguntas.length > 1 && (
            <button
              type="button"
              onClick={omitirResto}
              className="ml-auto text-xs text-ink-muted underline-offset-2 transition-colors hover:text-ink hover:underline"
            >
              Omitir el resto y analizar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
