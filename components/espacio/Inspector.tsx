"use client";

/**
 * Inspector derecho: el detalle de lo que esté seleccionado, venga del Mapa,
 * del raíl o de la bandeja de avisos. Sustituye a la Ficha, que vivía dentro
 * del grafo y por eso no podía enseñar nada que no fuera un nodo.
 *
 * Tres pestañas. Detalle: qué es y qué se puede hacer con ello. Evidencia: qué
 * frase de la nota lo sostiene y cuánto. Historial: vacía hasta que existan
 * casos y sesiones (fase 7); se enseña igual para que su sitio no cambie.
 *
 * Lo que se selecciona puede ser un nodo del grafo, una hipótesis de
 * mantenimiento o una pregunta. Cualquier otro id se trata como «nada
 * seleccionado»: mejor un Inspector vacío que uno que adivina.
 */

import { useMemo, useState } from "react";
import type { AnalisisFuncional, EstadoHipotesis } from "@/lib/types";
import { actualizarEtiquetaNodo, borrarNodo, construirNodosGrafo, type NodoGrafo } from "@/lib/grafo";
import { alertasPorNodo } from "@/lib/alertasNodo";
import { etiquetaCita, type CitaVerificadaResuelta } from "@/lib/citas";
import type { Cita } from "@/lib/types";
import { confirmarElemento } from "@/lib/procedencia";
import { aristaDeHipotesis, ETIQUETA_APOYO_ARISTA } from "@/lib/apoyoAristas";
import { gradoDeHipotesis, relacionInferida, verboRelacion } from "@/lib/gradoApoyo";
import {
  ESTADOS_HIPOTESIS,
  ETIQUETA_ESTADO_HIPOTESIS,
  rotuloHipotesis,
} from "@/lib/preguntas";
import { AvisosDelNodo, InsigniaAlerta } from "../grafo/InsigniaAlerta";
import { ApoyoRelacion, InsigniaProcedencia, MuestraTrazo } from "../grafo/ProcedenciaElemento";
import { etiquetaApoyo, etiquetaTipoNodo, TIPO_RELACION } from "../grafo/etiquetasNodo";
import { Apoyo, Chip, Termino } from "../informe/primitivas";
import { TarjetaPregunta, type EditarSeccion } from "../informe/PreguntasClinicas";
import { useEdicion } from "../edicionManual";
import { useEspacio } from "./contexto";

const esCitaVerificada = (c: Cita): c is CitaVerificadaResuelta => c.verificada;

type Pestana = "detalle" | "evidencia" | "historial";

const PESTANAS: { id: Pestana; titulo: string }[] = [
  { id: "detalle", titulo: "Detalle" },
  { id: "evidencia", titulo: "Evidencia" },
  { id: "historial", titulo: "Historial" },
];

export default function Inspector({
  analisis,
  analisisConProsa,
  onEditarSeccion,
  onCerrar,
}: {
  analisis: AnalisisFuncional;
  /** Con la prosa de las hipótesis ya derivada del grafo (lib/formatearInforme.ts). */
  analisisConProsa: AnalisisFuncional;
  onEditarSeccion: EditarSeccion;
  /** En pantallas estrechas el Inspector es un cajón: esto lo cierra. */
  onCerrar?: () => void;
}) {
  const { seleccionado } = useEspacio();
  const [pestana, setPestana] = useState<Pestana>("detalle");
  const nodos = useMemo(() => construirNodosGrafo(analisis), [analisis]);
  const nodo = nodos.find((n) => n.id === seleccionado) ?? null;
  const hipotesis =
    analisisConProsa.hipotesis_mantenimiento.find((h) => h.id === seleccionado) ?? null;
  const pregunta = analisis.preguntas.find((p) => p.id === seleccionado) ?? null;
  // Una conducta que ninguna situación analiza no es nodo del grafo, pero se
  // elige desde el raíl y sus avisos tienen que verse.
  const conducta = analisis.conductas_problema.find((c) => c.id === seleccionado) ?? null;

  return (
    <aside aria-label="Inspector" className="flex h-full min-h-0 flex-col">
      <header className="flex items-center gap-1 border-b border-divider px-3 pt-2">
        <div role="tablist" aria-label="Pestañas del Inspector" className="flex gap-1">
          {PESTANAS.map((p) => (
            <button
              key={p.id}
              type="button"
              role="tab"
              aria-selected={pestana === p.id}
              onClick={() => setPestana(p.id)}
              className={`-mb-px border-b-2 px-2.5 py-1.5 text-xs ${pestana === p.id ? "border-accent font-medium text-ink" : "border-transparent text-ink-muted hover:text-ink"}`}
            >
              {p.titulo}
            </button>
          ))}
        </div>
        {onCerrar && (
          <button type="button" onClick={onCerrar} aria-label="Cerrar el Inspector" className="ml-auto rounded px-2 py-0.5 text-sm text-ink-muted hover:text-ink">
            ✕
          </button>
        )}
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {pestana === "historial" ? (
          <p className="text-sm text-ink-muted">
            El historial de cada elemento llegará con los casos y las sesiones.
          </p>
        ) : nodo ? (
          <DetalleNodo analisis={analisis} nodo={nodo} nodos={nodos} pestana={pestana} onEditarSeccion={onEditarSeccion} />
        ) : hipotesis ? (
          <DetalleHipotesis
            analisis={analisis}
            hipotesis={hipotesis}
            nodos={nodos}
            pestana={pestana}
            onEditarSeccion={onEditarSeccion}
          />
        ) : conducta ? (
          <div className="space-y-3">
            <AvisosDelNodo alertas={alertasPorNodo(analisis).get(conducta.id) ?? []} />
            <p className="font-mono text-[10px] uppercase tracking-wide text-ink-muted">Conducta problema · sin situación en el grafo</p>
            <p className="text-[15px] leading-relaxed text-ink">{conducta.descripcion}</p>
            {conducta.evidencia.verificada ? (
              <p className="text-sm italic text-ink-muted">{etiquetaCita(conducta.evidencia)} · &quot;{conducta.evidencia.texto}&quot;</p>
            ) : (
              <p className="font-mono text-[10px] uppercase tracking-wide text-ink-muted">Inferido — sin cita literal en la nota</p>
            )}
          </div>
        ) : pregunta ? (
          <ul>
            <TarjetaPregunta pregunta={pregunta} analisis={analisis} onEditarSeccion={onEditarSeccion} />
          </ul>
        ) : (
          <p className="text-sm text-ink-muted">
            Selecciona un elemento en el Mapa o en el raíl. Doble clic sobre la
            etiqueta de un nodo para editarla en el grafo.
          </p>
        )}
      </div>
    </aside>
  );
}

function DetalleNodo({
  analisis,
  nodo,
  nodos,
  pestana,
  onEditarSeccion,
}: {
  analisis: AnalisisFuncional;
  nodo: NodoGrafo;
  nodos: readonly NodoGrafo[];
  pestana: Pestana;
  onEditarSeccion: EditarSeccion;
}) {
  const { aplicar, irACita, seleccionar } = useEspacio();
  const avisos = useMemo(() => alertasPorNodo(analisis).get(nodo.id) ?? [], [analisis, nodo.id]);
  const cita = nodo.evidencia?.verificada ? nodo.evidencia : null;
  const relaciones = analisis.aristas
    .filter((a) => a.desde === nodo.id || a.hasta === nodo.id)
    .map((a) => {
      const sale = a.desde === nodo.id;
      const otro = nodos.find((n) => n.id === (sale ? a.hasta : a.desde));
      return {
        arista: a,
        sentido: sale ? "Lleva a" : "Recibe de",
        tipo: TIPO_RELACION[a.tipo],
        otro,
        etiqueta: otro ? `${etiquetaTipoNodo(otro)}: ${otro.etiqueta}` : "[elemento sin etiqueta]",
      };
    });
  const procesos = analisis.capa_act.procesos_act.filter((p) => p.nodo_id === nodo.id);

  if (pestana === "evidencia") {
    return (
      <div className="space-y-3 text-sm">
        <p className="text-ink-muted">
          Apoyo en la nota: <span className="text-ink">{etiquetaApoyo(nodo.apoyo)}</span>
        </p>
        {cita ? (
          <blockquote className="border-l-2 border-divider pl-3">
            <button type="button" onClick={() => irACita(cita)} className="font-mono text-[10px] uppercase tracking-wide text-accent underline underline-offset-2">
              De la nota · {etiquetaCita(cita)}
            </button>
            <p className="mt-1 italic leading-relaxed text-ink-muted">&quot;{cita.texto}&quot;</p>
          </blockquote>
        ) : (
          <p className="font-mono text-[10px] uppercase tracking-wide text-ink-muted">Inferido — sin cita literal en la nota</p>
        )}
        {relaciones.length > 0 && (
          <div className="border-t border-divider pt-3">
            <p className="mb-2 text-xs font-medium text-ink">Apoyo de sus relaciones</p>
            <p className="mb-2 text-[11px] leading-snug text-ink-muted">
              El apoyo de una relación no es el de sus extremos: que dos datos estén en la nota no significa que la nota diga que uno lleva al otro.
            </p>
            {relaciones.map((r) => (
              <div key={r.arista.id} className="mb-2 text-[11px] text-ink-muted">
                {r.sentido} · {r.tipo}: <span className="text-ink">{r.etiqueta}</span>
                <span className="mt-0.5 flex flex-wrap items-center gap-x-2">
                  <MuestraTrazo apoyo={r.arista.apoyo} />
                  <ApoyoRelacion apoyo={r.arista.apoyo} />
                </span>
                {r.arista.evidencia.filter(esCitaVerificada).map((c, i) => (
                  <button key={i} type="button" onClick={() => irACita(c)} className="mt-0.5 block text-left italic text-ink-muted hover:text-accent">
                    {etiquetaCita(c)} · &quot;{c.texto}&quot;
                  </button>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <AvisosDelNodo alertas={avisos} />
      <label className="block text-xs text-ink-muted">
        Etiqueta
        <textarea
          key={nodo.id + nodo.etiqueta}
          defaultValue={nodo.etiqueta}
          onBlur={(e) => {
            const valor = e.target.value.trim();
            if (valor && valor !== nodo.etiqueta) aplicar((copia) => actualizarEtiquetaNodo(copia, nodo.id, valor));
          }}
          rows={3}
          className="mt-1 w-full rounded border border-divider bg-surface p-2 text-sm text-ink"
        />
      </label>
      <InsigniaProcedencia
        analisis={analisis}
        id={nodo.id}
        // Confirmar es una decisión sobre la propuesta, no texto del clínico:
        // no marca la sección como editada (invariante 6).
        onConfirmar={() => onEditarSeccion(null, (copia) => confirmarElemento(copia, nodo.id))}
      />
      <dl className="space-y-1 text-xs">
        <div><dt className="inline text-ink-muted">Tipo: </dt><dd className="inline text-ink">{etiquetaTipoNodo(nodo)}</dd></div>
        <div><dt className="inline text-ink-muted">Apoyo en la nota: </dt><dd className="inline text-ink">{etiquetaApoyo(nodo.apoyo)}</dd></div>
      </dl>
      {cita ? (
        <button type="button" onClick={() => irACita(cita)} className="text-xs text-accent underline underline-offset-2">
          Ver en la nota · {etiquetaCita(cita)}
        </button>
      ) : (
        <p className="font-mono text-[10px] uppercase tracking-wide text-ink-muted">Inferido — sin cita literal en la nota</p>
      )}
      {procesos.length > 0 && (
        <section className="rounded border border-divider p-2">
          <p className="font-mono text-[10px] uppercase tracking-wide text-ink-muted">Interpretación · ACT</p>
          {procesos.map((p) => (
            <p key={p.id} className="mt-1 text-sm leading-relaxed text-ink">
              {p.proceso}: {p.justificacion_funcional || "sin justificación funcional declarada"}
            </p>
          ))}
        </section>
      )}
      <button
        type="button"
        onClick={() => {
          seleccionar(null);
          aplicar((copia) => borrarNodo(copia, nodo.id));
        }}
        className="block rounded border border-warn/50 px-2 py-1 text-xs text-warn"
      >
        Borrar nodo
      </button>
      <div className="border-t border-divider pt-3">
        <p className="mb-2 text-xs font-medium text-ink">Relaciones del nodo</p>
        {relaciones.length === 0 && <p className="text-[11px] text-ink-muted">Sin relaciones trazadas.</p>}
        {relaciones.map((r) => (
          <div key={r.arista.id} className="mb-2 flex items-start gap-2 text-[11px] text-ink-muted">
            <span className="min-w-0 flex-1">
              {r.sentido} · {r.tipo}:{" "}
              {r.otro ? (
                <button type="button" onClick={() => seleccionar(r.otro!.id)} className="text-left text-ink hover:text-accent">
                  {r.etiqueta}
                </button>
              ) : (
                <span className="text-ink">{r.etiqueta}</span>
              )}
              <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                <MuestraTrazo apoyo={r.arista.apoyo} />
                <ApoyoRelacion apoyo={r.arista.apoyo} />
                <InsigniaProcedencia analisis={analisis} id={r.arista.id} />
              </span>
            </span>
            <button
              type="button"
              aria-label={`Borrar la relación con ${r.etiqueta}`}
              onClick={() =>
                aplicar((copia) => {
                  copia.aristas = copia.aristas.filter((actual) => actual.id !== r.arista.id);
                })
              }
              className="text-warn"
            >
              Borrar
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function DetalleHipotesis({
  analisis,
  hipotesis: h,
  nodos,
  pestana,
  onEditarSeccion,
}: {
  analisis: AnalisisFuncional;
  hipotesis: AnalisisFuncional["hipotesis_mantenimiento"][number];
  nodos: readonly NodoGrafo[];
  pestana: Pestana;
  onEditarSeccion: EditarSeccion;
}) {
  const edicion = useEdicion();
  const { irACita } = useEspacio();
  const arista = aristaDeHipotesis(analisis, h);
  const rivales = analisis.hipotesis_alternativas.filter((alt) => alt.rival_de === h.id);
  const preguntas = analisis.preguntas.filter((p) => p.pone_a_prueba === h.id);
  const indice = analisis.hipotesis_mantenimiento.findIndex((x) => x.id === h.id);
  const avisos = analisis.alertas.filter((a) => a.ruta === `hipotesis_mantenimiento[${indice}]`);

  if (pestana === "evidencia") {
    return (
      <div className="space-y-3 text-sm">
        <div className="flex items-center gap-2">
          <Apoyo grado={gradoDeHipotesis(h, nodos as NodoGrafo[], analisis.aristas)} />
        </div>
        {arista ? (
          <>
            <p className="text-ink-muted">
              Apoyo de la relación: <span className="text-ink">{ETIQUETA_APOYO_ARISTA[arista.apoyo]}</span>
            </p>
            {arista.evidencia.length === 0 && (
              <p className="font-mono text-[10px] uppercase tracking-wide text-ink-muted">Inferido — sin cita literal en la nota</p>
            )}
            {arista.evidencia.filter(esCitaVerificada).map((c, i) => (
              <button key={i} type="button" onClick={() => irACita(c)} className="block text-left text-sm italic text-ink-muted hover:text-accent">
                {etiquetaCita(c)} · &quot;{c.texto}&quot;
              </button>
            ))}
          </>
        ) : (
          <p className="text-ink-muted">Sin relación trazada en el grafo.</p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {avisos.length > 0 && <InsigniaAlerta alertas={avisos} />}
      <p className="font-mono text-[10px] uppercase tracking-wide text-ink-muted">Hipótesis de mantenimiento</p>
      <p className="text-[15px] leading-relaxed text-ink">{h.enunciado || rotuloHipotesis(h)}</p>
      <div className="flex flex-wrap items-center gap-2 text-sm text-ink-muted">
        {h.funcion && (
          <span className="flex flex-wrap items-center gap-2">
            <Termino id="funcion" soloClaro />
            <Chip>{h.funcion}</Chip>
          </span>
        )}
        <Apoyo grado={gradoDeHipotesis(h, nodos as NodoGrafo[], analisis.aristas)} />
      </div>
      {h.origen && h.conducta && (
        <p className="text-sm text-ink-muted">
          {h.origen} {verboRelacion(h.direccion)} {h.conducta}
          {relacionInferida(h) && " · relación inferida"}
        </p>
      )}
      {/* El estado es cosa del clínico; no hay «confirmada». No marca edición. */}
      <label className="flex items-center gap-2 text-xs text-ink-muted">
        Estado
        {edicion ? (
          <select
            value={h.estado}
            onChange={(e) =>
              onEditarSeccion(null, (copia) => {
                const real = copia.hipotesis_mantenimiento.find((x) => x.id === h.id);
                if (real) real.estado = e.target.value as EstadoHipotesis;
              })
            }
            className="rounded border border-divider bg-surface px-1 py-0.5 text-xs text-ink"
          >
            {ESTADOS_HIPOTESIS.map((e) => (
              <option key={e} value={e}>
                {ETIQUETA_ESTADO_HIPOTESIS[e]}
              </option>
            ))}
          </select>
        ) : (
          <span className="text-ink">{ETIQUETA_ESTADO_HIPOTESIS[h.estado]}</span>
        )}
      </label>
      {h.motivo_estado && <p className="text-sm text-ink">{h.motivo_estado}</p>}

      {rivales.length > 0 && (
        <section className="space-y-2">
          <p className="font-mono text-[10px] uppercase tracking-wide text-ink-muted">Hipótesis rivales</p>
          {rivales.map((alt) => {
            const pregunta = analisis.preguntas.find((p) => p.id === alt.pregunta_id);
            return (
              <div key={alt.id} className="rounded border-l-[3px] border-divider bg-canvas py-2 pl-3 pr-2 text-sm leading-relaxed">
                <p className="text-ink">{alt.enunciado}</p>
                {alt.la_favoreceria && <p className="text-ink-muted">La favorecería: <span className="text-ink">{alt.la_favoreceria}</span></p>}
                {alt.favorece_principal && <p className="text-ink-muted">Favorecería a esta: <span className="text-ink">{alt.favorece_principal}</span></p>}
                {pregunta && <p className="text-ink-muted">Para separarlas: <span className="text-ink">{pregunta.texto}</span></p>}
              </div>
            );
          })}
        </section>
      )}

      {preguntas.length > 0 && (
        <section>
          <p className="mb-2 font-mono text-[10px] uppercase tracking-wide text-ink-muted">Preguntas que la ponen a prueba</p>
          <ul className="space-y-2">
            {preguntas.map((p) => (
              <TarjetaPregunta key={p.id} pregunta={p} analisis={analisis} onEditarSeccion={onEditarSeccion} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
