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

import { useMemo, useState } from "react";
import { ArrowDownLeft, ArrowRight, ArrowUpRight, ChevronRight, Info, Repeat, SlidersHorizontal, type LucideIcon } from "lucide-react";
import type { TipoArista } from "@/lib/types";
import type { AnalisisFuncional, EstadoHipotesis } from "@/lib/types";
import { actualizarEtiquetaNodo, construirNodosGrafo, type NodoGrafo } from "@/lib/grafo";
import { alertasPorNodo } from "@/lib/alertasNodo";
import { calcularCoberturaNota } from "@/lib/coberturaNota";
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
  const { seleccionado, pestanaInspector: pestana, elegirPestanaInspector: setPestana, abrirMenu, menu, textoCita, fuenteAbierta, abrirFuente, lineasNota } = useEspacio();
  const cobertura = useMemo(() => calcularCoberturaNota([...lineasNota], analisis), [lineasNota, analisis]);
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
      <header className="flex items-center gap-1 border-b border-divider px-3 pt-1.5">
        <div role="tablist" aria-label="Pestañas del Inspector" className="flex min-w-0 gap-0.5">
          {PESTANAS.map((p) => (
            <button
              key={p.id}
              type="button"
              role="tab"
              aria-selected={pestana === p.id}
              onClick={() => setPestana(p.id)}
              className={`-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-[13px] leading-none transition-colors ${pestana === p.id ? "border-accent font-semibold text-ink" : "border-transparent text-ink-muted hover:text-ink"}`}
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
            className="ml-auto shrink-0 rounded px-2 py-0.5 text-sm text-ink-muted hover:bg-canvas hover:text-ink"
          >
            ⋯
          </button>
        )}
        {onCerrar && (
          <button type="button" onClick={onCerrar} aria-label="Cerrar el Inspector" className={`${nodo || arista ? "" : "ml-auto "}shrink-0 rounded px-2 py-0.5 text-sm text-ink-muted hover:text-ink`}>
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
              <p className="text-sm italic text-ink-muted">{etiquetaCita(conducta.evidencia)} · &quot;{textoCita(conducta.evidencia)}&quot;</p>
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

      {/* La nota completa ya no ocupa pantalla: se abre desde aquí, donde se lee su evidencia. */}
      {pestana === "evidencia" && (
        <div className="shrink-0 border-t border-divider p-3">
          <button
            type="button"
            aria-expanded={fuenteAbierta}
            onClick={() => abrirFuente(!fuenteAbierta)}
            className="flex w-full items-center justify-between gap-2 rounded-lg border border-accent/60 bg-surface px-3 py-2 text-left text-sm text-accent hover:bg-accent/5"
          >
            <span>{fuenteAbierta ? "Ocultar nota completa" : "Ver nota completa"}</span>
            <span className="text-xs text-ink-muted">
              {cobertura.usadas} de {cobertura.total} frases en el mapa {fuenteAbierta ? "▾" : "▴"}
            </span>
          </button>
        </div>
      )}
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
  const { aplicar, irACita, seleccionar, textoCita } = useEspacio();
  const avisos = useMemo(() => alertasPorNodo(analisis).get(nodo.id) ?? [], [analisis, nodo.id]);
  const cita = nodo.evidencia?.verificada ? nodo.evidencia : null;
  const relaciones = analisis.aristas
    .filter((a) => a.desde === nodo.id || a.hasta === nodo.id)
    .map((a) => {
      const sale = a.desde === nodo.id;
      const otro = nodos.find((n) => n.id === (sale ? a.hasta : a.desde));
      return {
        arista: a,
        sale,
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
            <p className="mt-1 italic leading-relaxed text-ink-muted">&quot;{textoCita(cita)}&quot;</p>
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
                    {etiquetaCita(c)} · &quot;{textoCita(c)}&quot;
                  </button>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  const sinCitaLiteral = !cita && (nodo.citas_clinico ?? []).length === 0;
  return (
    <div className="space-y-4">
      <div>
        {/* El tipo es metadato; la etiqueta es lo que se lee primero. */}
        <p className="font-mono text-[10px] uppercase tracking-wide text-ink-muted">{etiquetaTipoNodo(nodo)}</p>
        {/* Parece texto y se edita al hacer clic, como el resto del informe. */}
        <TextoEditable
          key={nodo.id + nodo.etiqueta}
          valor={nodo.etiqueta}
          seccionId="situaciones"
          etiqueta={`Etiqueta de ${etiquetaTipoNodo(nodo)}`}
          className="mt-1 break-words font-serif text-[17px] font-semibold leading-snug text-ink [overflow-wrap:anywhere]"
          onCambio={(valor) => aplicar((copia) => actualizarEtiquetaNodo(copia, nodo.id, valor))}
        />
      </div>

      <AvisosDelNodo alertas={avisos} />

      {/* Procedencia y validación: una propuesta de la IA no es una conclusión validada. */}
      <section aria-label="Procedencia y validación" className="space-y-2 rounded-md border border-divider bg-canvas p-2.5">
        <InsigniaProcedencia
          analisis={analisis}
          id={nodo.id}
          className="w-full justify-between gap-y-1.5"
          // Confirmar es una decisión sobre la propuesta, no texto del clínico:
          // no marca la sección como editada (invariante 6).
          onConfirmar={() => onEditarSeccion(null, (copia) => confirmarElemento(copia, nodo.id))}
        />
        <dl className="flex items-baseline justify-between gap-2 border-t border-divider pt-2 text-xs">
          <dt className="text-ink-muted">Apoyo en la nota</dt>
          <dd className="text-right font-medium text-ink">{etiquetaApoyo(nodo.apoyo)}</dd>
        </dl>
        {cita ? (
          <button type="button" onClick={() => irACita(cita)} className="text-xs text-accent underline underline-offset-2">
            Ver en la nota · {etiquetaCita(cita)}
          </button>
        ) : !sinCitaLiteral ? (
          <button type="button" onClick={() => irACita(nodo.citas_clinico![0])} className="text-xs text-accent underline underline-offset-2">
            Ver en la nota · {etiquetaCita(nodo.citas_clinico![0])} · cita tuya
          </button>
        ) : (
          <p className="flex items-start gap-1.5 rounded bg-warn/10 px-2 py-1.5 text-xs leading-snug text-ink">
            <Info aria-hidden="true" size={14} strokeWidth={2} className="mt-px shrink-0 text-warn" />
            Inferido — sin cita literal en la nota
          </p>
        )}
      </section>

      <RelacionesDelNodo analisis={analisis} relaciones={relaciones} seleccionar={seleccionar} />
    </div>
  );
}

const ICONO_RELACION: Record<TipoArista, LucideIcon> = {
  secuencial: ArrowRight,
  moderadora: SlidersHorizontal,
  bucle: Repeat,
};

/** Cuántas relaciones se ven de cada grupo antes de pedir «Ver más». */
const RELACIONES_VISIBLES = 4;

type RelacionDelNodo = {
  arista: AnalisisFuncional["aristas"][number];
  sale: boolean;
  tipo: string;
  otro: NodoGrafo | undefined;
  etiqueta: string;
};

/**
 * Las relaciones del nodo en dos grupos, entrantes y salientes, con el recuento
 * sacado de las aristas reales. Cada una es una fila de dos líneas: el nodo
 * relacionado y «Abrir» arriba; tipo, apoyo y procedencia abajo.
 */
function RelacionesDelNodo({
  analisis,
  relaciones,
  seleccionar,
}: {
  analisis: AnalisisFuncional;
  relaciones: RelacionDelNodo[];
  seleccionar: (id: string) => void;
}) {
  const entrantes = relaciones.filter((r) => !r.sale);
  const salientes = relaciones.filter((r) => r.sale);
  return (
    <section aria-label="Relaciones del nodo">
      <h3 className="mb-1 flex items-baseline justify-between text-xs font-semibold text-ink">
        Relaciones del nodo
        <span className="font-normal text-ink-muted">{relaciones.length}</span>
      </h3>
      {relaciones.length === 0 && <p className="text-[11px] text-ink-muted">Sin relaciones trazadas.</p>}
      <GrupoRelaciones titulo="Recibe de" icono={ArrowDownLeft} relaciones={entrantes} analisis={analisis} seleccionar={seleccionar} />
      <GrupoRelaciones titulo="Lleva a" icono={ArrowUpRight} relaciones={salientes} analisis={analisis} seleccionar={seleccionar} />
    </section>
  );
}

function GrupoRelaciones({
  titulo,
  icono: Icono,
  relaciones,
  analisis,
  seleccionar,
}: {
  titulo: string;
  icono: LucideIcon;
  relaciones: RelacionDelNodo[];
  analisis: AnalisisFuncional;
  seleccionar: (id: string) => void;
}) {
  const [todas, setTodas] = useState(false);
  if (relaciones.length === 0) return null;
  const visibles = todas ? relaciones : relaciones.slice(0, RELACIONES_VISIBLES);
  const ocultas = relaciones.length - visibles.length;
  return (
    <div className="mt-2">
      <p className="flex items-center gap-1.5 text-[11px] font-medium text-ink-muted">
        <Icono aria-hidden="true" size={13} strokeWidth={2} />
        {titulo} · {relaciones.length}
      </p>
      <ul className="mt-1 divide-y divide-divider/70">
        {visibles.map((r) => {
          const IconoTipo = ICONO_RELACION[r.arista.tipo];
          return (
            <li key={r.arista.id} className="py-1.5">
              <div className="flex items-start gap-2">
                <span className="min-w-0 flex-1">
                  {r.otro ? (
                    <button type="button" onClick={() => seleccionar(r.otro!.id)} className="block w-full break-words text-left text-[13px] leading-snug text-ink hover:text-accent [overflow-wrap:anywhere]">
                      {r.otro.etiqueta}
                    </button>
                  ) : (
                    <span className="block text-[13px] leading-snug text-ink">{r.etiqueta}</span>
                  )}
                  {r.otro && <span className="block text-[10px] uppercase tracking-wide text-ink-muted">{etiquetaTipoNodo(r.otro)}</span>}
                </span>
                {/* La relación se abre como un elemento más; sus acciones (también
                    borrar) están en su menú, no en un botón por línea. */}
                <button
                  type="button"
                  aria-label={`Abrir la relación con ${r.etiqueta}`}
                  title="Abrir la relación"
                  onClick={() => seleccionar(r.arista.id)}
                  className="-mr-1 flex shrink-0 items-center gap-0.5 rounded px-1 py-0.5 text-[11px] text-ink-muted hover:bg-canvas hover:text-accent"
                >
                  Abrir
                  <ChevronRight aria-hidden="true" size={13} strokeWidth={2} />
                </button>
              </div>
              <span className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] text-ink-muted">
                <span className="inline-flex items-center gap-1">
                  <IconoTipo aria-hidden="true" size={12} strokeWidth={2} />
                  {r.tipo}
                </span>
                <MuestraTrazo apoyo={r.arista.apoyo} />
                <ApoyoRelacion apoyo={r.arista.apoyo} />
                <InsigniaProcedencia analisis={analisis} id={r.arista.id} />
              </span>
            </li>
          );
        })}
      </ul>
      {relaciones.length > RELACIONES_VISIBLES && (
        <button type="button" aria-expanded={todas} onClick={() => setTodas((v) => !v)} className="mt-1 text-[11px] text-accent underline underline-offset-2">
          {todas ? "Ver menos" : `Ver ${ocultas} más`}
        </button>
      )}
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
  const { irACita, seleccionar, elegirVista, textoCita } = useEspacio();
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
                {etiquetaCita(c)} · &quot;{textoCita(c)}&quot;
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
  const { irACita, textoCita } = useEspacio();
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
                {etiquetaCita(c)} · &quot;{textoCita(c)}&quot;
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
    for (const k of ["etiqueta", "descripcion", "conducta_propuesta", "enunciado", "pregunta", "texto", "nombre", "funcion", "intervencion", "mecanismo"]) {
      if (typeof e[k] === "string" && (e[k] as string).trim()) return e[k] as string;
    }
    // Una clase funcional sin función: «Función por determinar».
    if (e.funcion === null && Array.isArray(e.miembros)) return "Función por determinar";
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
  const { irACita, aplicar, textoCita } = useEspacio();
  const citas = analisis.citas_del_clinico?.[id] ?? [];
  return (
    <section className="space-y-1">
      {citas.length > 0 && (
        <p className="font-mono text-[10px] uppercase tracking-wide text-ink-muted">Citas añadidas por ti</p>
      )}
      {citas.map((c, i) => (
        <div key={i} className="flex items-start gap-2">
          <button type="button" onClick={() => irACita(c)} className="min-w-0 flex-1 text-left italic text-ink-muted hover:text-accent">
            {etiquetaCita(c)} · &quot;{textoCita(c)}&quot;
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
