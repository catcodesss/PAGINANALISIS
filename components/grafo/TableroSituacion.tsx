"use client";

/**
 * Una situación en el Mapa, en el nivel elegido.
 *
 * SITUACIÓN (por defecto): antecedente → conducta → consecuencia. La función no
 * es una caja ni una fila final: va como etiqueta del arco conducta →
 * consecuencia, con el tipo de contingencia, la inmediatez y el apoyo de esa
 * relación. La operación motivacional va en una banda debajo del ABC, con su
 * trazo hacia ese arco («aumenta el valor de…»); el costo demorado, debajo de la
 * conducta. Los huecos —lo que falta en la cadena y las preguntas abiertas que
 * la afectan— son nodos punteados. El plan (alternativa → consecuencia que la
 * mantendría) va en su propia banda, con otro fondo.
 *
 * CLÍNICO: además, la subpista respondiente (EC → RC), la cadena DBT DENTRO del
 * nodo conducta como «cadena interna» (un eslabón «acción» que repite la
 * conducta se funde con ella: lib/grafo.ts#eslabonRepiteConducta) y el esquema
 * de contingencia en el arco.
 *
 * EVIDENCIA: cada nodo y cada arco enseñan su apoyo y su frase de origen.
 *
 * Los arcos son botones: una relación se selecciona y se inspecciona como un
 * nodo. Nada aquí hace peticiones; cambiar de nivel o de capa es solo pintar.
 */

import { Fragment, type ReactNode } from "react";
import type { AnalisisFuncional, Arista, Cita, Id, Situacion } from "@/lib/types";
import { ETIQUETA_ESQUEMA } from "@/lib/types";
import type { NivelMapa } from "@/lib/preferencias";
import {
  eslabonRepiteConducta,
  huecosDeSituacion,
  type CarrilGrafo,
  type NodoGrafo,
} from "@/lib/grafo";
import { etiquetaCita, type CitaVerificadaResuelta } from "@/lib/citas";
import { estaAbierta } from "@/lib/preguntas";
import { TERMINOS, terminoDeContingencia } from "@/lib/terminos";
import { ETIQUETA_APOYO_ARISTA } from "@/lib/apoyoAristas";
import type { Alerta } from "@/lib/types";
import { InsigniaAlerta } from "./InsigniaAlerta";
import { etiquetaApoyo } from "./etiquetasNodo";
import { TIPO_ARRASTRE_NODO, useEspacio } from "../espacio/contexto";
import { ETIQUETA_DESTINO_CARRIL, type DestinoCarril } from "@/lib/edicionMapa";

export interface CapasMapa {
  plan: boolean;
  huecos: boolean;
  dbt: boolean;
}

const esVerificada = (c: Cita): c is CitaVerificadaResuelta => c.verificada;

export interface TableroSituacionProps {
  analisis: AnalisisFuncional;
  situacion: Situacion;
  nodos: readonly NodoGrafo[];
  nivel: NivelMapa;
  capas: CapasMapa;
  /** Lo resaltado por la selección; vacío si no hay nada del Mapa elegido. */
  ruta: Set<Id>;
  seleccionado: Id | null;
  renderNodo: (nodo: NodoGrafo) => ReactNode;
  renderAgregar: (carril: CarrilGrafo, situacionId: string, alternativa: boolean) => ReactNode;
  avisos: (id: Id) => readonly Alerta[];
  onSeleccionarId: (id: Id) => void;
  onAgregarFuncion: (situacionId: Id) => void;
  onCita: (cita: CitaVerificadaResuelta) => void;
  onIrANivel: (nivel: NivelMapa) => void;
  /** Abre el menú de un nodo o una relación (clic derecho, tecla Menú). */
  onMenu: (id: Id, x: number, y: number) => void;
}

export default function TableroSituacion({
  analisis,
  situacion,
  nodos,
  nivel,
  capas,
  ruta,
  seleccionado,
  renderNodo,
  renderAgregar,
  avisos,
  onSeleccionarId,
  onAgregarFuncion,
  onCita,
  onIrANivel,
  onMenu,
}: TableroSituacionProps) {
  // Clic derecho y teclado (tecla Menú, Shift+F10) para lo que no es un Nodo
  // —los arcos y los eslabones de la cadena interna—, y soltar ahí una frase
  // de la Fuente para citarla.
  const { propsSoltarFrase, arrastrandoFrase, nodoEnElAire, moverNodo } = useEspacio();
  // Dónde se puede soltar el nodo que vuela: solo en su situación, solo en un
  // carril compatible y vacío (lib/edicionMapa.ts#destinosPosibles).
  const zona = (destino: DestinoCarril) =>
    nodoEnElAire && nodoEnElAire.situacionId === situacion.id && nodoEnElAire.destinos.includes(destino) ? (
      <div
        onDragOver={(e) => {
          if (!e.dataTransfer.types.includes(TIPO_ARRASTRE_NODO)) return;
          e.preventDefault();
          e.dataTransfer.dropEffect = "move";
        }}
        onDrop={(e) => {
          e.preventDefault();
          moverNodo(nodoEnElAire.id, destino);
        }}
        className="rounded border-2 border-dashed border-accent/60 px-2 py-3 text-center text-xs text-accent"
      >
        Soltar aquí: {ETIQUETA_DESTINO_CARRIL[destino]}
      </div>
    ) : null;
  const marcaDestino = arrastrandoFrase ? "outline-dashed outline-1 outline-offset-2 outline-accent" : "";
  const menuDe = (id: Id) => ({
    ...propsSoltarFrase(id),
    onContextMenu: (e: React.MouseEvent) => {
      e.preventDefault();
      onSeleccionarId(id);
      onMenu(id, e.clientX, e.clientY);
    },
    onKeyDown: (e: React.KeyboardEvent<HTMLElement>) => {
      if (e.key === "ContextMenu" || (e.key === "F10" && e.shiftKey)) {
        e.preventDefault();
        const r = e.currentTarget.getBoundingClientRect();
        onSeleccionarId(id);
        onMenu(id, r.left + 12, r.bottom - 8);
      }
    },
  });
  const deSituacion = nodos.filter((n) => n.situacion_id === situacion.id);
  const ids = new Set(deSituacion.map((n) => n.id));
  const deTipo = (tipo: NodoGrafo["tipo"]) => deSituacion.filter((n) => n.tipo === tipo && !n.alternativa);
  const om = deTipo("om")[0];
  const ed = deTipo("ed")[0];
  const ec = deTipo("ec")[0];
  const conductas = deTipo("conducta");
  // Una conducta enfocada: la elegida si es de esta situación, si no la primera.
  const enfocada = conductas.find((c) => c.id === seleccionado) ?? conductas[0];
  const otras = conductas.filter((c) => c !== enfocada);
  const inmediata = deSituacion.find((n) => n.tipo === "consecuencia" && n.carril === "inmediata");
  const demorada = deSituacion.find((n) => n.tipo === "consecuencia" && n.carril === "demorada");
  const funcion = deTipo("funcion")[0];
  const eslabones = deTipo("encubierta");
  const alternativas = deSituacion.filter((n) => n.alternativa && n.carril !== "inmediata");
  const necesarias = deSituacion.filter((n) => n.alternativa && n.carril === "inmediata");
  const operante = situacion.cadena_operante;
  const enRuta = (id: Id | undefined) => ruta.size === 0 || (id !== undefined && ruta.has(id));

  const aristaEntre = (desde?: NodoGrafo, hasta?: NodoGrafo): Arista | undefined =>
    desde && hasta ? analisis.aristas.find((a) => a.desde === desde.id && a.hasta === hasta.id) : undefined;
  // Lo que lleva a la conducta: el antecedente o el último eslabón de la
  // cadena, según lo que el grafo tenga trazado.
  const aristaAConducta = enfocada
    ? analisis.aristas.find((a) => a.hasta === enfocada.id && ids.has(a.desde))
    : undefined;
  const aristaFuncion = aristaEntre(enfocada, inmediata);
  const aristaDemorada = aristaEntre(enfocada, demorada);

  // Cadena interna: los eslabones, sin el «acción» que repite la conducta.
  const conductaDatos = enfocada
    ? analisis.conductas_problema.find((c) => c.id === enfocada.id)
    : undefined;
  const cadena = situacion.cadena_dbt?.eslabones ?? [];
  const fundidos = new Set(
    conductaDatos ? cadena.filter((e) => eslabonRepiteConducta(e, conductaDatos)).map((e) => e.id) : []
  );
  const internos = eslabones.filter((e) => !fundidos.has(e.id));
  const avisosCadena = eslabones.flatMap((e) => avisos(e.id));
  // Fundir es de presentación: lo que colgaba del eslabón fundido (avisos,
  // soluciones, habilidades) se lee junto a la nota de la fusión, no se pierde.
  const avisosFundidos = [...fundidos].flatMap((id) => avisos(id));
  const solucionesFundidas = capas.dbt
    ? analisis.capa_dbt.analisis_de_soluciones.filter((x) => x.eslabon_id && fundidos.has(x.eslabon_id))
    : [];
  const habilidadesFundidas = capas.dbt
    ? analisis.capa_dbt.habilidades_sugeridas.filter((x) => x.eslabon_id && fundidos.has(x.eslabon_id))
    : [];

  // Huecos: lo que falta en la cadena y las preguntas abiertas que la afectan.
  const huecos = huecosDeSituacion(analisis, situacion, nodos);
  const hipotesisDeAqui = new Set(
    analisis.hipotesis_mantenimiento
      .filter((h) => h.destino_id && situacion.conductas_ids.includes(h.destino_id))
      .map((h) => h.id)
  );
  const preguntas = analisis.preguntas.filter(
    (p) => estaAbierta(p) && p.pone_a_prueba && hipotesisDeAqui.has(p.pone_a_prueba)
  );
  const huecosEn = (carril: CarrilGrafo) =>
    capas.huecos ? huecos.filter((h) => h.carril === carril) : [];

  const conEvidencia = (n: NodoGrafo) => (
    <Fragment key={n.id}>{renderNodo(n)}</Fragment>
  );

  const contingencia = operante?.tipo_contingencia ? terminoDeContingencia(operante.tipo_contingencia) : null;

  return (
    <section data-situacion-id={situacion.id} className="@container rounded-lg border border-divider bg-surface p-4">
      <header className="mb-3 flex flex-wrap items-baseline gap-x-3">
        <h4 className="font-serif text-base font-semibold text-ink">{situacion.nombre}</h4>
        {otras.length > 0 && (
          <span className="text-xs text-ink-muted">
            También aquí:{" "}
            {otras.map((c, i) => (
              <Fragment key={c.id}>
                {i > 0 && ", "}
                <button type="button" onClick={() => onSeleccionarId(c.id)} className="underline decoration-divider underline-offset-2 hover:text-accent">
                  {c.etiqueta}
                </button>
              </Fragment>
            ))}
          </span>
        )}
      </header>

      <div className="grid gap-3 @2xl:grid-cols-[minmax(0,1fr)_4.5rem_minmax(0,1.3fr)_minmax(7rem,9rem)_minmax(0,1fr)] @2xl:items-start">
        {/* Antecedente (y, en Clínico, la subpista respondiente) */}
        <div className="space-y-2">
          <RotuloABC letra="A">Antecedente</RotuloABC>
          {zona("ed")}
          {ed && conEvidencia(ed)}
          {zona("ec")}
          {nivel !== "situacion" && ec && (
            <div className="rounded border-l-2 border-divider pl-2">
              <Rotulo>Respondiente · EC → RC</Rotulo>
              {conEvidencia(ec)}
              {ec.detalle && <p className="mt-1 text-xs text-ink-muted">→ {ec.detalle}</p>}
            </div>
          )}
          {huecosEn("antecedente").map((h) => <Hueco key={h.id} texto={h.etiqueta} />)}
          {renderAgregar("antecedente", situacion.id, false)}
        </div>

        <Arco arista={aristaAConducta} nivel={nivel} atenuado={!enRuta(aristaAConducta?.id)} seleccionado={seleccionado === aristaAConducta?.id} onElegir={onSeleccionarId} onCita={onCita} menuDe={menuDe} citasTuyas={aristaAConducta ? analisis.citas_del_clinico?.[aristaAConducta.id] : undefined} marcaDestino={marcaDestino} />

        {/* Conducta, con la cadena interna en Clínico y el costo demorado debajo */}
        <div className="space-y-2">
          <RotuloABC letra="B">Conducta</RotuloABC>
          {enfocada ? conEvidencia(enfocada) : null}
          {huecosEn("conducta").map((h) => <Hueco key={h.id} texto={h.etiqueta} />)}

          {nivel === "situacion" && avisosCadena.length > 0 && (
            <button type="button" onClick={() => onIrANivel("clinico")} className="flex flex-wrap items-center gap-2 text-left text-xs text-ink-muted hover:text-accent">
              Cadena interna: <InsigniaAlerta alertas={avisosCadena} /> ver en Clínico
            </button>
          )}

          {nivel !== "situacion" && eslabones.length > 0 && (
            <div className="rounded border border-divider bg-canvas p-2">
              <Rotulo>Cadena interna</Rotulo>
              <ol className="mt-1 space-y-1">
                {internos.map((e, i) => {
                  const soluciones = capas.dbt
                    ? analisis.capa_dbt.analisis_de_soluciones.filter((s) => s.eslabon_id === e.id)
                    : [];
                  const habilidades = capas.dbt
                    ? analisis.capa_dbt.habilidades_sugeridas.filter((h) => h.eslabon_id === e.id)
                    : [];
                  const suyos = avisos(e.id);
                  return (
                    <li key={e.id} className={enRuta(e.id) ? "" : "opacity-35"}>
                      <button
                        type="button"
                        data-nodo-id={e.id}
                        onClick={() => onSeleccionarId(e.id)}
                        {...menuDe(e.id)}
                        className={`flex w-full items-start gap-1.5 rounded px-1 py-0.5 text-left text-xs leading-snug text-ink hover:bg-surface ${seleccionado === e.id ? "ring-1 ring-accent" : ""} ${marcaDestino}`}
                      >
                        {capas.dbt && <span className="font-mono text-[10px] text-ink-muted">{i + 1}.</span>}
                        <span className="font-mono text-[10px] uppercase text-ink-muted">{e.detalle}</span>
                        <span className="min-w-0 flex-1">{e.etiqueta}</span>
                      </button>
                      {suyos.length > 0 && <InsigniaAlerta alertas={suyos} className="ml-5 mt-0.5" />}
                      {soluciones.map((s) => (
                        <p key={s.id} className="ml-5 text-[11px] text-ink-muted">◇ Solución: {s.alternativa_habil}</p>
                      ))}
                      {habilidades.map((h, j) => (
                        <p key={j} className="ml-5 text-[11px] text-ink-muted">◇ Habilidad: {h.habilidad}</p>
                      ))}
                    </li>
                  );
                })}
              </ol>
              {fundidos.size > 0 && (
                <div className="mt-1">
                  <p className="text-[11px] italic text-ink-muted">El último eslabón es la propia conducta y se lee en ella.</p>
                  {avisosFundidos.length > 0 && <InsigniaAlerta alertas={avisosFundidos} className="mt-0.5" />}
                  {solucionesFundidas.map((x) => (
                    <p key={x.id} className="text-[11px] text-ink-muted">◇ Solución: {x.alternativa_habil}</p>
                  ))}
                  {habilidadesFundidas.map((h, j) => (
                    <p key={j} className="text-[11px] text-ink-muted">◇ Habilidad: {h.habilidad}</p>
                  ))}
                </div>
              )}
            </div>
          )}

          {zona("demorada")}
          {(demorada || huecosEn("demorada").length > 0) && (
            <div className={`mt-3 border-t border-dashed border-divider pt-2 ${enRuta(demorada?.id) ? "" : "opacity-35"}`}>
              <Rotulo>
                {aristaDemorada ? (
                  <button type="button" onClick={() => onSeleccionarId(aristaDemorada.id)} className="hover:text-accent">
                    ↓ Costo demorado
                  </button>
                ) : (
                  "↓ Costo demorado"
                )}
              </Rotulo>
              {demorada && conEvidencia(demorada)}
              {huecosEn("demorada").map((h) => <Hueco key={h.id} texto={h.etiqueta} />)}
            </div>
          )}
          {renderAgregar("conducta", situacion.id, false)}
        </div>

        {/* El arco de la función: aquí va la función, no en una caja aparte. */}
        <Arco
          arista={aristaFuncion}
          nivel={nivel}
          atenuado={!enRuta(aristaFuncion?.id)}
          seleccionado={seleccionado === aristaFuncion?.id}
          onElegir={onSeleccionarId}
          onCita={onCita}
          menuDe={menuDe}
          citasTuyas={aristaFuncion ? analisis.citas_del_clinico?.[aristaFuncion.id] : undefined}
          marcaDestino={marcaDestino}
          destacado
        >
          {funcion ? (
            <span className="block font-medium text-ink" data-nodo-id={funcion.id}>
              {funcion.etiqueta}
            </span>
          ) : (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                onAgregarFuncion(situacion.id);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") onAgregarFuncion(situacion.id);
              }}
              className="block text-ink-muted underline decoration-dotted"
            >
              + función hipotetizada
            </span>
          )}
          {contingencia && (
            <span className="block text-ink-muted" title={TERMINOS[contingencia].definicion}>
              {TERMINOS[contingencia].claro} · {TERMINOS[contingencia].tecnico}
            </span>
          )}
          {operante && <span className="block text-ink-muted">{operante.inmediatez}</span>}
          {nivel !== "situacion" && operante && (
            <span className="block text-ink-muted">{ETIQUETA_ESQUEMA[operante.esquema_de_contingencia]}</span>
          )}
        </Arco>

        <div className="space-y-2">
          <RotuloABC letra="C">Consecuencia</RotuloABC>
          {zona("inmediata")}
          {inmediata && conEvidencia(inmediata)}
          {huecosEn("inmediata").map((h) => <Hueco key={h.id} texto={h.etiqueta} />)}
          {renderAgregar("inmediata", situacion.id, false)}
        </div>
      </div>

      {/* La operación motivacional, debajo del ABC: lo modula, no lo encabeza. */}
      {om && (
        <div className={`mt-3 flex flex-wrap items-center gap-2 rounded border border-dashed border-divider bg-canvas px-3 py-2 text-xs text-ink-muted ${enRuta(om.id) ? "" : "opacity-35"}`}>
          <span className="font-mono text-[10px] uppercase tracking-wide" title={TERMINOS.om.definicion}>{TERMINOS.om.claro}</span>
          <div className="min-w-0 max-w-sm">{conEvidencia(om)}</div>
          <span aria-hidden="true">┈┈▸</span>
          <span>aumenta el valor de</span>
          {aristaFuncion ? (
            <button type="button" onClick={() => onSeleccionarId(aristaFuncion.id)} className="underline decoration-dotted underline-offset-2 hover:text-accent">
              {inmediata ? `«${recortar(inmediata.etiqueta, 50)}»` : "la consecuencia"}
            </button>
          ) : (
            <span>{inmediata ? `«${recortar(inmediata.etiqueta, 50)}»` : "la consecuencia"}</span>
          )}
        </div>
      )}

      {capas.huecos && (huecosEn("contexto").length > 0 || preguntas.length > 0) && (
        <div className="mt-3 flex flex-wrap gap-2">
          {huecosEn("contexto").map((h) => <Hueco key={h.id} texto={h.etiqueta} />)}
          {preguntas.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => onSeleccionarId(p.id)}
              className={`rounded border border-dashed border-ink-muted/50 px-2 py-1 text-left text-xs text-ink-muted hover:border-accent hover:text-accent ${seleccionado === p.id ? "ring-1 ring-accent" : ""}`}
            >
              ? {p.texto}
            </button>
          ))}
        </div>
      )}

      {capas.plan && (
        <div className="mt-4 rounded-md bg-accent/5 p-3">
          <Rotulo>Plan · alternativa → consecuencia que la mantendría</Rotulo>
          <div className="mt-2 grid gap-3 @2xl:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] @2xl:items-start">
            <div className="space-y-2">
              {alternativas.map(conEvidencia)}
              {renderAgregar("conducta", situacion.id, true)}
            </div>
            <span aria-hidden="true" className="hidden text-ink-muted @2xl:block">→</span>
            <div className="space-y-2">
              {necesarias.map(conEvidencia)}
              {renderAgregar("inmediata", situacion.id, true)}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function recortar(texto: string, max: number) {
  return texto.length > max ? `${texto.slice(0, max - 1)}…` : texto;
}

function Rotulo({ children }: { children: ReactNode }) {
  return <p className="font-mono text-[10px] uppercase tracking-wide text-ink-muted">{children}</p>;
}

/** La cabecera de una columna del ABC: la letra primero, que es lo que se busca con la vista. */
function RotuloABC({ letra, children }: { letra: string; children: ReactNode }) {
  return (
    <p className="flex items-center gap-2 border-b border-divider pb-1.5 text-sm font-semibold text-ink">
      <span aria-hidden="true" className="flex h-6 w-6 items-center justify-center rounded-full bg-accent font-mono text-xs texto-sobre-acento">{letra}</span>
      {children}
    </p>
  );
}

function Hueco({ texto }: { texto: string }) {
  return (
    <div className="rounded border border-dashed border-ink-muted/50 px-2 py-1.5 text-xs italic text-ink-muted">
      {texto}
    </div>
  );
}

/**
 * Una relación del Mapa. Trazo continuo si la nota la sostiene, punteado si es
 * inferida: la forma dice el apoyo, no el color. Seleccionable como un nodo.
 */
function Arco({
  arista,
  nivel,
  atenuado,
  seleccionado,
  onElegir,
  onCita,
  destacado = false,
  menuDe,
  citasTuyas = [],
  marcaDestino = "",
  children,
}: {
  arista: Arista | undefined;
  nivel: NivelMapa;
  atenuado: boolean;
  seleccionado: boolean;
  onElegir: (id: Id) => void;
  onCita: (cita: CitaVerificadaResuelta) => void;
  destacado?: boolean;
  menuDe?: (id: Id) => Pick<React.HTMLAttributes<HTMLElement>, "onContextMenu" | "onKeyDown" | "onDragOver" | "onDrop">;
  /** Las frases que uniste tú a esta relación: van aparte de las del modelo. */
  citasTuyas?: readonly CitaVerificadaResuelta[];
  marcaDestino?: string;
  children?: ReactNode;
}) {
  if (!arista) {
    return (
      <div className="flex flex-col items-center justify-center gap-1 self-center px-1 text-center text-[11px] text-ink-muted">
        {children}
        <span aria-hidden="true" className="hidden w-full border-t border-dashed border-divider @2xl:block" />
        <span>relación no trazada</span>
      </div>
    );
  }
  const inferida = arista.apoyo === "inferido";
  const citas = arista.evidencia.filter(esVerificada);
  return (
    <div className={`flex flex-col items-stretch self-center ${atenuado ? "opacity-35" : ""}`}>
      <button
        type="button"
        data-arista-id={arista.id}
        onClick={() => onElegir(arista.id)}
        {...menuDe?.(arista.id)}
        aria-label={`Relación: ${ETIQUETA_APOYO_ARISTA[arista.apoyo]}`}
        className={`flex flex-col items-center gap-1 rounded px-1.5 py-1 text-center text-[11px] leading-snug transition-colors hover:bg-canvas ${seleccionado ? "ring-2 ring-accent/60" : ""} ${destacado ? "w-full" : ""} ${marcaDestino}`}
      >
        {children}
        <span className="flex w-full items-center gap-1 text-ink-muted" aria-hidden="true">
          <span className={`h-0 flex-1 border-t-2 ${inferida ? "border-dotted" : "border-solid"} border-current`} />
          <span className="hidden @2xl:inline">▸</span>
          <span className="@2xl:hidden">▾</span>
        </span>
        <span className="text-ink-muted">{ETIQUETA_APOYO_ARISTA[arista.apoyo]}</span>
      </button>
    </div>
  );
}
