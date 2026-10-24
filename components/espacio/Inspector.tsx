"use client";

/**
 * Inspector derecho: el detalle de lo que esté seleccionado, venga del Mapa,
 * de la bandeja de avisos. Sustituye a la Ficha, que vivía dentro
 * del grafo y por eso no podía enseñar nada que no fuera un nodo.
 *
 * Tres pestañas. Detalle: qué es y qué se puede hacer con ello. Evidencia: qué
 * frase de la nota lo sostiene y cuánto. Historial: las sesiones del caso
 * (cada una abre su formulación) y las revisiones del elemento elegido.
 *
 * Lo que se selecciona puede ser un nodo del grafo, una hipótesis de
 * mantenimiento o una pregunta. Cualquier otro id se trata como «nada
 * seleccionado»: mejor un Inspector vacío que uno que adivina.
 */

import { useMemo } from "react";
import type { AnalisisFuncional, EstadoHipotesis } from "@/lib/types";
import { actualizarEtiquetaNodo, construirNodosGrafo, type NodoGrafo } from "@/lib/grafo";
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
import { TextoEditable, useEdicion } from "../edicionManual";
import { useEspacio, type PestanaInspector } from "./contexto";
import { useCaso } from "../contextoCaso";
import { listarRevisiones, type Revision } from "@/lib/casos";
import { quitarCitaDelClinico } from "@/lib/edicionMapa";

const esCitaVerificada = (c: Cita): c is CitaVerificadaResuelta => c.verificada;

type Pestana = PestanaInspector;

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
  const { seleccionado, pestanaInspector: pestana, elegirPestanaInspector: setPestana, abrirMenu, menu } = useEspacio();
  const nodos = useMemo(() => construirNodosGrafo(analisis), [analisis]);
  const nodo = nodos.find((n) => n.id === seleccionado) ?? null;
  const hipotesis =
    analisisConProsa.hipotesis_mantenimiento.find((h) => h.id === seleccionado) ?? null;
  const pregunta = analisis.preguntas.find((p) => p.id === seleccionado) ?? null;
  // Una conducta que ninguna situación analiza no es nodo del grafo, pero se
  // elige y sus avisos tienen que verse.
  const conducta = analisis.conductas_problema.find((c) => c.id === seleccionado) ?? null;
  const arista = analisis.aristas.find((a) => a.id === seleccionado) ?? null;

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
        {(nodo || arista) && seleccionado && (
          // El camino del teclado y la pantalla táctil al menú del elemento.
          <button
            type="button"
            aria-label="Acciones del elemento"
            aria-haspopup="menu"
            aria-expanded={menu?.id === seleccionado}
            onClick={(e) => {
              const r = e.currentTarget.getBoundingClientRect();
              abrirMenu(seleccionado, r.right - 192, r.bottom + 4);
            }}
            className="ml-auto rounded px-2 py-0.5 text-sm text-ink-muted hover:bg-canvas hover:text-ink"
          >
            ⋯
          </button>
        )}
        {onCerrar && (
          <button type="button" onClick={onCerrar} aria-label="Cerrar el Inspector" className={`${nodo || arista ? "" : "ml-auto "}rounded px-2 py-0.5 text-sm text-ink-muted hover:text-ink`}>
            ✕
          </button>
        )}
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {pestana === "historial" ? (
          <HistorialElemento objetoId={seleccionado} />
        ) : arista ? (
          <DetalleRelacion analisis={analisis} arista={arista} nodos={nodos} pestana={pestana} onEditarSeccion={onEditarSeccion} />
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
            Selecciona un elemento en el Mapa. Doble clic sobre la
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
        ) : (nodo.citas_clinico ?? []).length === 0 ? (
          <p className="font-mono text-[10px] uppercase tracking-wide text-ink-muted">Inferido — sin cita literal en la nota</p>
        ) : null}
        <CitasTuyas analisis={analisis} id={nodo.id} />
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
      <div>
        <p className="text-xs text-ink-muted">Etiqueta</p>
        {/* Parece texto y se edita al hacer clic, como el resto del informe. */}
        <TextoEditable
          key={nodo.id + nodo.etiqueta}
          valor={nodo.etiqueta}
          seccionId="situaciones"
          etiqueta={`Etiqueta de ${etiquetaTipoNodo(nodo)}`}
          className="text-sm leading-relaxed text-ink"
          onCambio={(valor) => aplicar((copia) => actualizarEtiquetaNodo(copia, nodo.id, valor))}
        />
      </div>
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
      ) : (nodo.citas_clinico ?? []).length > 0 ? (
        <button type="button" onClick={() => irACita(nodo.citas_clinico![0])} className="text-xs text-accent underline underline-offset-2">
          Ver en la nota · {etiquetaCita(nodo.citas_clinico![0])} · cita tuya
        </button>
      ) : (
        <p className="font-mono text-[10px] uppercase tracking-wide text-ink-muted">Inferido — sin cita literal en la nota</p>
      )}
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
            {/* La relación se abre como un elemento más; sus acciones (también
                borrar) están en su menú, no en un botón por línea. */}
            <button
              type="button"
              aria-label={`Abrir la relación con ${r.etiqueta}`}
              onClick={() => seleccionar(r.arista.id)}
              className="shrink-0 text-ink-muted hover:text-accent"
            >
              Abrir →
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Inspector de una relación: qué une, de qué tipo es, la función si es la
 * contingencia de una situación, cuánto la sostiene la nota, qué la apoya y qué
 * la contradice, y qué hipótesis y blancos se apoyan en ella.
 */
function DetalleRelacion({
  analisis,
  arista,
  nodos,
  pestana,
  onEditarSeccion,
}: {
  analisis: AnalisisFuncional;
  arista: AnalisisFuncional["aristas"][number];
  nodos: readonly NodoGrafo[];
  pestana: Pestana;
  onEditarSeccion: EditarSeccion;
}) {
  const { irACita, seleccionar, elegirVista } = useEspacio();
  const desde = nodos.find((n) => n.id === arista.desde);
  const hasta = nodos.find((n) => n.id === arista.hasta);
  const citas = arista.evidencia.filter(esCitaVerificada);
  // Si llega a la consecuencia inmediata de una situación, es su contingencia:
  // la función hipotetizada vive en esta relación.
  const situacion =
    hasta?.tipo === "consecuencia" && hasta.carril === "inmediata"
      ? analisis.situaciones.find((s) => s.id === hasta.situacion_id)
      : undefined;
  const operante = situacion?.cadena_operante;
  const funcion = situacion ? nodos.find((n) => n.tipo === "funcion" && n.situacion_id === situacion.id) : undefined;
  const hipotesis = analisis.hipotesis_mantenimiento.filter((h) => aristaDeHipotesis(analisis, h)?.id === arista.id);
  const blancos = analisis.conductas_problema.filter((c) => c.id === arista.desde || c.id === arista.hasta);
  const extremo = (n: NodoGrafo | undefined, id: string) =>
    n ? (
      <button type="button" onClick={() => seleccionar(n.id)} className="text-left text-ink hover:text-accent">
        {etiquetaTipoNodo(n)}: {n.etiqueta}
      </button>
    ) : (
      <span className="text-ink-muted">[{id}]</span>
    );

  if (pestana === "evidencia") {
    return (
      <div className="space-y-3 text-sm">
        <p className="text-ink-muted">Apoyo de la relación: <span className="text-ink">{ETIQUETA_APOYO_ARISTA[arista.apoyo]}</span></p>
        <section>
          <p className="font-mono text-[10px] uppercase tracking-wide text-ink-muted">A favor</p>
          {citas.length === 0 && (analisis.citas_del_clinico?.[arista.id] ?? []).length === 0 ? (
            <p className="text-ink-muted">Ninguna frase de la nota afirma esta relación: es inferida.</p>
          ) : (
            citas.map((c, i) => (
              <button key={i} type="button" onClick={() => irACita(c)} className="mt-1 block text-left italic text-ink-muted hover:text-accent">
                {etiquetaCita(c)} · &quot;{c.texto}&quot;
              </button>
            ))
          )}
          <CitasTuyas analisis={analisis} id={arista.id} />
        </section>
        <section>
          <p className="font-mono text-[10px] uppercase tracking-wide text-ink-muted">En contra</p>
          {/* No se inventa: la nota no trae evidencia en contra marcada, y el
              análisis no la busca. Lo que no cuadra se registra como hipótesis
              alternativa, que se lee en la hipótesis que use esta relación. */}
          <p className="text-ink-muted">El análisis no registra evidencia en contra de esta relación. Revisa las hipótesis rivales de las hipótesis que la usan.</p>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-3 text-sm">
      <p className="font-mono text-[10px] uppercase tracking-wide text-ink-muted">Relación · {TIPO_RELACION[arista.tipo]}</p>
      <div className="space-y-1">
        <p className="text-ink-muted">Desde: {extremo(desde, arista.desde)}</p>
        <p className="text-ink-muted">Hasta: {extremo(hasta, arista.hasta)}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <MuestraTrazo apoyo={arista.apoyo} />
        <ApoyoRelacion apoyo={arista.apoyo} />
      </div>
      <InsigniaProcedencia
        analisis={analisis}
        id={arista.id}
        onConfirmar={() => onEditarSeccion(null, (copia) => confirmarElemento(copia, arista.id))}
      />
      {situacion && operante && (
        <section className="rounded border border-divider p-2">
          <p className="font-mono text-[10px] uppercase tracking-wide text-ink-muted">Contingencia de «{situacion.nombre}»</p>
          {funcion ? (
            <p className="mt-1 text-ink">
              Función:{" "}
              <button type="button" onClick={() => seleccionar(funcion.id)} className="text-left underline decoration-divider underline-offset-2 hover:text-accent">
                {funcion.etiqueta}
              </button>
            </p>
          ) : (
            <p className="mt-1 text-ink-muted">Sin función hipotetizada.</p>
          )}
          <p className="text-ink-muted">{operante.tipo_contingencia} · {operante.inmediatez}</p>
        </section>
      )}
      {hipotesis.length > 0 && (
        <section>
          <p className="font-mono text-[10px] uppercase tracking-wide text-ink-muted">Hipótesis que la usan</p>
          {hipotesis.map((h) => (
            <button key={h.id} type="button" onClick={() => seleccionar(h.id)} className="mt-1 block text-left text-ink hover:text-accent">
              {rotuloHipotesis(h)}
            </button>
          ))}
        </section>
      )}
      {blancos.length > 0 && (
        <section>
          <p className="font-mono text-[10px] uppercase tracking-wide text-ink-muted">Blancos que la usan</p>
          {blancos.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => {
                elegirVista("blancos");
                requestAnimationFrame(() => requestAnimationFrame(() => document.getElementById(`blanco-${c.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" })));
              }}
              className="mt-1 block text-left text-ink hover:text-accent"
            >
              {c.descripcion}
            </button>
          ))}
        </section>
      )}
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

/** Lo legible de un elemento guardado en JSON: su primera etiqueta con texto. */
function textoDeRevision(json: string | null): string {
  if (!json) return "";
  try {
    const e = JSON.parse(json) as Record<string, unknown>;
    for (const k of ["etiqueta", "descripcion", "conducta_propuesta", "enunciado", "pregunta", "texto", "nombre", "intervencion", "mecanismo"]) {
      if (typeof e[k] === "string" && (e[k] as string).trim()) return e[k] as string;
    }
  } catch {
    /* JSON ajeno: no se enseña */
  }
  return "";
}

function marcaRevision(r: Revision): string {
  if (r.antes === null) return "+";
  if (r.despues === null) return "−";
  return "~";
}

function HistorialElemento({ objetoId }: { objetoId: string | null }) {
  const caso = useCaso();
  if (!caso) {
    return <p className="text-sm text-ink-muted">Abre o crea un caso para guardar sesiones y revisiones.</p>;
  }
  const { expediente, sesion: vista, verVersion } = caso;
  const sesiones = [...expediente.sesiones].sort((a, b) => a.n - b.n);
  const ultima = sesiones[sesiones.length - 1];
  const revisiones = objetoId ? listarRevisiones(expediente, objetoId) : [];
  const nDe = new Map(sesiones.map((s) => [s.id, s.n]));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5" aria-label="Sesiones del caso">
        {sesiones.map((s) => {
          const actual = s.id === vista.id;
          const conVersion = s.version_id !== null;
          return (
            <button
              key={s.id}
              type="button"
              disabled={!conVersion}
              aria-pressed={actual}
              title={conVersion ? `Ver la formulación de la sesión ${s.n}` : "Sin formulación guardada"}
              onClick={() => verVersion(s.id === ultima?.id ? null : s.id)}
              className={`rounded-full border px-2.5 py-0.5 font-mono text-[11px] ${actual ? "border-accent bg-accent/10 text-ink" : "border-divider text-ink-muted hover:text-ink"} disabled:opacity-40`}
            >
              S{s.n}
            </button>
          );
        })}
      </div>

      {!objetoId ? (
        <p className="text-sm text-ink-muted">Elige un elemento para ver sus cambios.</p>
      ) : revisiones.length === 0 ? (
        <p className="text-sm text-ink-muted">Sin cambios desde que se generó.</p>
      ) : (
        <ol className="space-y-2">
          {revisiones.map((r) => (
            <li key={r.id} className="rounded border border-divider px-2.5 py-1.5">
              <p className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-wide text-ink-muted">
                <span aria-hidden="true" className="text-ink">{marcaRevision(r)}</span>
                S{nDe.get(r.sesion_id) ?? "?"} · {r.autor === "ia" ? "IA" : "Clínico"} ·{" "}
                {new Date(r.fecha).toLocaleDateString("es", { day: "numeric", month: "short" })}
              </p>
              {textoDeRevision(r.despues ?? r.antes) && (
                <p className="mt-1 text-sm leading-snug text-ink">{textoDeRevision(r.despues ?? r.antes)}</p>
              )}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

/**
 * Las frases que uniste tú a un nodo o una relación: aparte de las del
 * modelo, cada una marcada como tuya y con «Quitar». Debajo, cómo añadir otra.
 */
function CitasTuyas({ analisis, id }: { analisis: AnalisisFuncional; id: string }) {
  const { irACita, aplicar } = useEspacio();
  const citas = analisis.citas_del_clinico?.[id] ?? [];
  return (
    <section className="space-y-1">
      {citas.length > 0 && (
        <p className="font-mono text-[10px] uppercase tracking-wide text-ink-muted">Citas añadidas por ti</p>
      )}
      {citas.map((c, i) => (
        <div key={i} className="flex items-start gap-2">
          <button type="button" onClick={() => irACita(c)} className="min-w-0 flex-1 text-left italic text-ink-muted hover:text-accent">
            {etiquetaCita(c)} · &quot;{c.texto}&quot;
          </button>
          <button
            type="button"
            onClick={() => aplicar((copia) => quitarCitaDelClinico(copia, id, i))}
            aria-label={`Quitar la cita ${etiquetaCita(c)}`}
            className="shrink-0 text-xs text-ink-muted hover:text-warn"
          >
            Quitar
          </button>
        </div>
      ))}
      <p className="text-[11px] leading-snug text-ink-muted">
        Arrastra una frase de la Fuente hasta aquí en el Mapa, o elígela en la Fuente y pulsa «Citar en».
      </p>
    </section>
  );
}
