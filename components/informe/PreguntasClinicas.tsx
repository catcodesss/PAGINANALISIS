"use client";

/**
 * Las preguntas clínicas: una sola lista, en vez de cuatro formas sueltas de lo
 * mismo. Cada tarjeta dice qué hipótesis pone a prueba, qué dato falta, qué
 * decisión cambia, en qué estado está y deja anotar la respuesta.
 *
 * Lo que se anota es texto del clínico: marca la sección como editada
 * (invariante 6). El estado, en cambio, es una decisión sobre la pregunta y no
 * texto escrito a mano, así que no la marca.
 */

import { useState } from "react";
import type { AnalisisFuncional, EstadoPregunta, PreguntaClinica } from "@/lib/types";
import {
  ESTADOS_PREGUNTA,
  ETIQUETA_ESTADO_PREGUNTA,
  estaAbierta,
  rotuloHipotesis,
} from "@/lib/preguntas";
import { TextoEditable, useEdicion } from "../edicionManual";
import { useEspacio } from "../espacio/contexto";

export type EditarSeccion = (
  seccionId: string | null,
  mutar: (copia: AnalisisFuncional) => void
) => void;

const SECCION = "verificacion";

const CLASE_BOTON =
  "rounded px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-ink-muted transition-colors hover:bg-canvas hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 print:hidden";

function Campo({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <p className="mt-1 text-sm leading-relaxed text-ink-muted">
      <span className="font-mono text-[10px] uppercase tracking-wide">{rotulo}</span>{" "}
      <span className="text-ink">{children}</span>
    </p>
  );
}

export function TarjetaPregunta({
  pregunta,
  analisis,
  onEditarSeccion,
  compacta = false,
}: {
  pregunta: PreguntaClinica;
  analisis: AnalisisFuncional;
  onEditarSeccion: EditarSeccion;
  /** En el Resumen: sin los controles de edición, solo lo que decide. */
  compacta?: boolean;
}) {
  const edicion = useEdicion();
  const [anotando, setAnotando] = useState(false);
  const [borrador, setBorrador] = useState(pregunta.respuesta?.texto ?? "");
  const hipotesis = pregunta.pone_a_prueba
    ? analisis.hipotesis_mantenimiento.find((h) => h.id === pregunta.pone_a_prueba)
    : undefined;
  const dependientes = analisis.lineas_de_intervencion_tentativas.filter(
    (l) => l.pregunta_id === pregunta.id
  );

  const cambiar = (seccion: string | null, parcial: Partial<PreguntaClinica>) =>
    onEditarSeccion(seccion, (c) => {
      const i = c.preguntas.findIndex((p) => p.id === pregunta.id);
      if (i >= 0) c.preguntas[i] = { ...c.preguntas[i], ...parcial };
    });

  function guardarRespuesta() {
    const limpio = borrador.trim();
    setAnotando(false);
    if (!limpio || limpio === pregunta.respuesta?.texto) return;
    onEditarSeccion(SECCION, (c) => {
      const i = c.preguntas.findIndex((p) => p.id === pregunta.id);
      if (i < 0) return;
      c.preguntas[i] = {
        ...c.preguntas[i],
        respuesta: { texto: limpio, autor: "clinico" },
        // Anotar una respuesta sobre una pregunta abierta la da por respondida;
        // si el clínico ya la había dejado «en parte» o descartada, se respeta.
        estado: c.preguntas[i].estado === "abierta" ? "respondida" : c.preguntas[i].estado,
      };
    });
  }

  return (
    <li
      id={`pregunta-${pregunta.id}`}
      className={`rounded border p-3 ${estaAbierta(pregunta) ? "border-divider" : "border-divider bg-canvas"}`}
    >
      <div className="flex flex-wrap items-baseline gap-x-2">
        <TextoEditable
          valor={pregunta.texto}
          seccionId={SECCION}
          etiqueta={`Pregunta ${pregunta.id}`}
          className="text-[15px] leading-relaxed text-ink"
          onCambio={(v) => cambiar(SECCION, { texto: v })}
          onBorrar={
            compacta
              ? undefined
              : () =>
                  onEditarSeccion(SECCION, (c) => {
                    c.preguntas = c.preguntas.filter((p) => p.id !== pregunta.id);
                    // Una intervención atada a una pregunta borrada no pierde la
                    // dependencia: pasa a texto, que es como llega sin resolver.
                    for (const l of c.lineas_de_intervencion_tentativas) {
                      if (l.pregunta_id === pregunta.id) {
                        l.pregunta_id = null;
                        l.depende_de = pregunta.dato_faltante || pregunta.texto;
                      }
                    }
                    for (const alt of c.hipotesis_alternativas) {
                      if (alt.pregunta_id === pregunta.id) alt.pregunta_id = null;
                    }
                  })
          }
        />
      </div>

      {pregunta.revisar && (
        <p className="mt-1 text-sm italic text-ink-muted">
          Pregunta heredada sin hipótesis ni decisión: revisa qué pone a prueba
          o descártala.
        </p>
      )}
      {(hipotesis || pregunta.hipotesis) && (
        <Campo rotulo="Pone a prueba">
          {hipotesis ? rotuloHipotesis(hipotesis) : pregunta.hipotesis}
          {!hipotesis && (
            <span className="ml-1 text-ink-muted">(no se pudo enlazar con ninguna hipótesis)</span>
          )}
        </Campo>
      )}
      {pregunta.dato_faltante && pregunta.dato_faltante !== pregunta.texto && (
        <Campo rotulo="Dato que falta">{pregunta.dato_faltante}</Campo>
      )}
      {pregunta.decision && <Campo rotulo="Qué cambia">{pregunta.decision}</Campo>}
      {dependientes.length > 0 && (
        <Campo rotulo="Condiciona">
          {dependientes
            .map((l) => l.conducta || l.intervencion || "una intervención")
            .join("; ")}
        </Campo>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="font-mono text-[10px] uppercase tracking-wide text-ink-muted">
          {ETIQUETA_ESTADO_PREGUNTA[pregunta.estado]}
          {pregunta.origen === "previa" && " · del paso previo"}
          {pregunta.origen === "clinico" && " · tuya"}
        </span>
        {!compacta && edicion && (
          <label className="flex items-center gap-1 text-[11px] text-ink-muted print:hidden">
            Estado
            <select
              value={pregunta.estado}
              onChange={(e) => cambiar(null, { estado: e.target.value as EstadoPregunta })}
              className="rounded border border-divider bg-surface px-1 py-0.5 text-[11px] text-ink"
            >
              {ESTADOS_PREGUNTA.map((e) => (
                <option key={e} value={e}>
                  {ETIQUETA_ESTADO_PREGUNTA[e]}
                </option>
              ))}
            </select>
          </label>
        )}
        {!compacta && edicion && !anotando && (
          <button
            type="button"
            onClick={() => {
              setBorrador(pregunta.respuesta?.texto ?? "");
              setAnotando(true);
            }}
            className={CLASE_BOTON}
          >
            {pregunta.respuesta ? "Editar respuesta" : "Anotar respuesta"}
          </button>
        )}
      </div>

      {pregunta.respuesta && !anotando && (
        <blockquote className="mt-2 border-l-2 border-accent/50 pl-3 text-sm leading-relaxed text-ink">
          <span className="block font-mono text-[10px] uppercase tracking-wide text-accent">
            ✎ Respuesta del clínico
          </span>
          {pregunta.respuesta.texto}
        </blockquote>
      )}

      {anotando && (
        <div className="mt-2 print:hidden">
          <textarea
            autoFocus
            value={borrador}
            onChange={(e) => setBorrador(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") setAnotando(false);
            }}
            rows={3}
            aria-label={`Respuesta a la pregunta ${pregunta.id}`}
            className="w-full rounded border border-accent bg-surface p-2 text-[15px] leading-relaxed text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
          />
          <div className="mt-1 flex gap-2">
            <button type="button" onClick={guardarRespuesta} className={CLASE_BOTON}>
              Guardar
            </button>
            <button type="button" onClick={() => setAnotando(false)} className={CLASE_BOTON}>
              Cancelar
            </button>
          </div>
        </div>
      )}
    </li>
  );
}

/** Enlace de «Primero explorar» a la tarjeta de su pregunta, o texto plano si no hay. */
export function EnlacePregunta({
  pregunta,
  children,
}: {
  pregunta: PreguntaClinica | undefined;
  children: React.ReactNode;
}) {
  const { seleccionar } = useEspacio();
  if (!pregunta) return <>{children}</>;
  return (
    <a
      href={`#pregunta-${pregunta.id}`}
      onClick={(e) => {
        e.preventDefault();
        // La pregunta se abre en el Inspector, sin salir de la vista.
        seleccionar(pregunta.id);
      }}
      className="underline decoration-divider underline-offset-4 hover:text-accent"
    >
      {children}
    </a>
  );
}
