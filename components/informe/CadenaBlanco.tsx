"use client";

/**
 * Fase 6C · La cadena de ocho ranuras de un blanco.
 *
 * Una fila de ranuras pulsables (vertical por debajo de 1024 px) y, debajo, la
 * ranura abierta: nunca un modal. Poco texto a la vista: el símbolo dice el
 * estado (● completa, ⋯ hueco, ◆ conviene revisar, ▲ revisar antes de usar) y el
 * detalle aparece solo al abrir la ranura.
 *
 * El blanco referencia, no copia: hipótesis, alternativas y estrategias se
 * editan en su propia entrada, que puede ser de otro blanco también.
 *
 * Elegir hipótesis, rechazar una alternativa o fijar la sesión de revisión son
 * decisiones, no texto: van con `null` y no marcan la sección como editada.
 */

import { useContext, useState, type ReactNode } from "react";
import { ChartNoAxesColumnIncreasing, ClipboardList, Play, Target, type LucideIcon } from "lucide-react";
import { InsigniaAlerta } from "../grafo/InsigniaAlerta";
import s from "../grafo/afc.module.css";
import type { AnalisisFuncional, Blanco, ConductaAlternativa, Id } from "@/lib/types";
import { construirNodosGrafo } from "@/lib/grafo";
import { traducirMensajeAlerta } from "@/lib/gradoApoyo";
import {
  ranurasDeBlanco,
  ranurasListas,
  type ClaveRanura,
  type Ranura,
} from "@/lib/plan";
import { useEdicion } from "../edicionManual";
import { BloqueReanalisis, ReanalisisContext } from "./seccion";
import { EspacioContexto } from "../espacio/contexto";
import { irADestino } from "../espacio/navegar";

type EditarSeccion = (seccionId: string | null, mutar: (copia: AnalisisFuncional) => void) => void;

/** Qué campos pide «Pedir propuesta» en cada ranura (subconjunto de /api/reanalizar-seccion). */
const CAMPOS_PROPUESTA: Partial<Record<ClaveRanura, (keyof AnalisisFuncional)[]>> = {
  mecanismo: ["formulacion"],
  alternativa: ["conductas_alternativas"],
  estrategia: ["lineas_de_intervencion_tentativas"],
  indicador: ["plan_de_monitorizacion"],
  revision: ["plan_de_monitorizacion"],
};
const TODOS_LOS_CAMPOS: (keyof AnalisisFuncional)[] = [
  "conductas_alternativas",
  "lineas_de_intervencion_tentativas",
  "plan_de_monitorizacion",
];
/** Placeholder de la fase 13: se muestra, todavía no se cobra. */
const COSTE_PROPUESTA = "1 crédito";

const boton = "rounded border px-2.5 py-1 text-xs transition";
const entrada =
  "w-full rounded border border-divider bg-surface px-2 py-1 text-sm text-ink placeholder:text-ink-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40";
const rotulo = "font-mono text-[10px] uppercase tracking-wide text-ink-muted";

export function hayAlertaAlta(analisis: AnalisisFuncional, indiceBlanco: number): boolean {
  return ranurasDeBlanco(analisis, indiceBlanco).some((r) => r.estado === "alta");
}

export default function CadenaBlanco({
  analisis,
  indiceBlanco,
  onEditarSeccion,
}: {
  analisis: AnalisisFuncional;
  indiceBlanco: number;
  onEditarSeccion: EditarSeccion;
}) {
  const blanco = analisis.blancos[indiceBlanco];
  const ranuras = ranurasDeBlanco(analisis, indiceBlanco);
  const [abierta, setAbierta] = useState<ClaveRanura | null>(null);
  const [pidiendo, setPidiendo] = useState<(keyof AnalisisFuncional)[] | null>(null);
  const reanalisis = useContext(ReanalisisContext);
  const propuesta = blanco.revision === "propuesto";

  const cambiarBlanco = (seccion: string | null, parcial: Partial<Blanco>) =>
    onEditarSeccion(seccion, (c) => {
      c.blancos[indiceBlanco] = { ...c.blancos[indiceBlanco], ...parcial };
    });

  const porClave = Object.fromEntries(ranuras.map((r) => [r.clave, r])) as Record<ClaveRanura, Ranura>;
  const tarjeta = (clave: ClaveRanura) => (
    <TarjetaRanura
      key={clave}
      ranura={porClave[clave]}
      resumen={resumenDe(clave, analisis, blanco)}
      abierta={abierta === clave}
      propuesta={propuesta}
      onAbrir={() => {
        setPidiendo(null);
        setAbierta(abierta === clave ? null : clave);
      }}
    />
  );

  return (
    <div className={`${s.raiz} mt-3 print:hidden`}>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className={s.chip}>
          Listo {ranurasListas(ranuras)} de 8
          {blanco.revisar_en_sesion !== null && ` · revisión en sesión ${blanco.revisar_en_sesion}`}
        </span>
        {reanalisis && (
          <button
            type="button"
            onClick={() => setPidiendo(pidiendo ? null : TODOS_LOS_CAMPOS)}
            className={`${s.agregarBoton} ml-auto`}
            title="Pedir propuesta para todas las ranuras"
          >
            + Pedir propuesta · {COSTE_PROPUESTA}
          </button>
        )}
      </div>

      <div className={s.scroll}>
        <div className={`${s.tablero} ${s.lienzo}`} aria-label="Cadena del blanco">
          <Columna clase={s.om} titulo="Por qué" icono={Target}>
            {tarjeta("evidencia")}
            {tarjeta("hipotesis")}
          </Columna>
          <Columna clase={s.ant} titulo="Blanco" icono={ClipboardList}>
            {tarjeta("blanco")}
            {tarjeta("mecanismo")}
          </Columna>
          <Columna clase={s.con} titulo="Cambio" icono={Play}>
            {tarjeta("alternativa")}
            {tarjeta("estrategia")}
          </Columna>
          <Columna clase={s.csq} titulo="Seguimiento" icono={ChartNoAxesColumnIncreasing}>
            {tarjeta("indicador")}
            {tarjeta("revision")}
          </Columna>
        </div>
      </div>

      {pidiendo && (
        <BloqueReanalisis
          key={pidiendo.join()}
          campos={pidiendo}
          seccionId="conductas-alternativas"
          abiertoDeEntrada
          onCerrar={() => setPidiendo(null)}
        />
      )}

      {abierta && (
        <div className="mt-2 rounded-md border border-divider bg-canvas p-3">
          {ranuras
            .find((r) => r.clave === abierta)!
            .alertas.map((a, i) => (
              <p key={i} title={traducirMensajeAlerta(a.mensaje)} className={`mb-1 truncate text-xs ${a.gravedad === "alta" ? "text-warn" : "text-ink-muted"}`}>
                {a.gravedad === "alta" ? "▲" : "◆"} {traducirMensajeAlerta(a.mensaje)}
              </p>
            ))}
          <PanelRanura
            clave={abierta}
            analisis={analisis}
            indiceBlanco={indiceBlanco}
            cambiarBlanco={cambiarBlanco}
            onEditarSeccion={onEditarSeccion}
          />
          {reanalisis && CAMPOS_PROPUESTA[abierta] && (
            <button
              type="button"
              onClick={() => setPidiendo(CAMPOS_PROPUESTA[abierta]!)}
              className={`${boton} mt-3 border-divider text-ink-muted hover:text-ink`}
            >
              Pedir propuesta · {COSTE_PROPUESTA}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/** Un campo de texto que guarda al salir. Vacío es un hueco válido. */
function Campo({
  valor,
  placeholder,
  etiqueta,
  onGuardar,
  multilinea = false,
}: {
  valor: string;
  placeholder: string;
  etiqueta: string;
  onGuardar: (v: string) => void;
  multilinea?: boolean;
}) {
  const edicion = useEdicion();
  const [borrador, setBorrador] = useState(valor);
  if (!edicion) return <p className="text-sm text-ink">{valor || "—"}</p>;
  const guardar = () => {
    if (borrador.trim() !== valor.trim()) onGuardar(borrador.trim());
  };
  return multilinea ? (
    <textarea
      aria-label={etiqueta}
      value={borrador}
      placeholder={placeholder}
      rows={2}
      onChange={(e) => setBorrador(e.target.value)}
      onBlur={guardar}
      className={entrada}
    />
  ) : (
    <input
      aria-label={etiqueta}
      value={borrador}
      placeholder={placeholder}
      onChange={(e) => setBorrador(e.target.value)}
      onBlur={guardar}
      onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
      className={entrada}
    />
  );
}

function useIrAlMapa() {
  const espacio = useContext(EspacioContexto);
  return espacio ? (id: Id | null) => irADestino({ vista: "mapa", id }, espacio) : null;
}

function PanelRanura({
  clave,
  analisis,
  indiceBlanco,
  cambiarBlanco,
  onEditarSeccion,
}: {
  clave: ClaveRanura;
  analisis: AnalisisFuncional;
  indiceBlanco: number;
  cambiarBlanco: (seccion: string | null, parcial: Partial<Blanco>) => void;
  onEditarSeccion: EditarSeccion;
}) {
  const edicion = useEdicion();
  const irAlMapa = useIrAlMapa();
  const blanco = analisis.blancos[indiceBlanco];
  const indiceH = analisis.hipotesis_mantenimiento.findIndex((h) => h.id === blanco.hipotesis_id);
  const hipotesis = analisis.hipotesis_mantenimiento[indiceH];
  const conductaId = blanco.conducta_ids[0] ?? null;

  if (clave === "evidencia") {
    return (
      <div className="space-y-2">
        {hipotesis?.evidencia.verificada ? (
          <blockquote className="border-l-[3px] border-divider pl-3 text-sm italic text-ink">
            {hipotesis.evidencia.texto}
          </blockquote>
        ) : (
          <p className="text-sm text-ink-muted">{hipotesis ? "Sin cita en la nota." : "Sin hipótesis: no hay evidencia que enlazar."}</p>
        )}
        {irAlMapa && (
          <button type="button" onClick={() => irAlMapa(conductaId)} className={`${boton} border-divider text-ink hover:border-ink-muted/60`}>
            Ver en el Mapa
          </button>
        )}
      </div>
    );
  }

  if (clave === "hipotesis") {
    const otros = analisis.blancos
      .map((b, n) => ({ b, n }))
      .filter(({ b, n }) => n !== indiceBlanco && b.hipotesis_id && b.hipotesis_id === blanco.hipotesis_id)
      .map(({ n }) => n + 1);
    return (
      <div className="space-y-2">
        {hipotesis && <p className="text-sm text-ink">{hipotesis.funcion || hipotesis.enunciado}</p>}
        {otros.length > 0 && (
          <p className="text-xs text-warn">
            Esto cambia H{indiceH + 1}, que usan este blanco y {otros.map((n) => `el blanco ${n}`).join(" y ")}.
          </p>
        )}
        <div className="flex flex-wrap items-center gap-2">
          {edicion && (
            <select
              aria-label="Hipótesis del blanco"
              value={blanco.hipotesis_id ?? ""}
              onChange={(e) => cambiarBlanco(null, { hipotesis_id: e.target.value || null })}
              className="max-w-full rounded border border-divider bg-surface px-2 py-1 text-xs text-ink"
            >
              <option value="">Sin hipótesis</option>
              {analisis.hipotesis_mantenimiento.map((h, n) => (
                <option key={h.id} value={h.id}>
                  H{n + 1}: {(h.funcion || h.enunciado).slice(0, 70)}
                </option>
              ))}
            </select>
          )}
          {hipotesis && irAlMapa && (
            <button type="button" onClick={() => irAlMapa(conductaId)} className={`${boton} border-divider text-ink hover:border-ink-muted/60`}>
              Abrir H{indiceH + 1}
            </button>
          )}
        </div>
      </div>
    );
  }

  if (clave === "blanco") {
    return (
      <Campo
        valor={blanco.operacionalizacion}
        etiqueta="Blanco operacionalizado"
        placeholder="Qué se observa, dónde y con qué criterio"
        onGuardar={(v) => cambiarBlanco("conductas-alternativas", { operacionalizacion: v })}
      />
    );
  }

  if (clave === "mecanismo") {
    return (
      <Campo
        valor={blanco.mecanismo}
        etiqueta="Mecanismo que se quiere modificar"
        placeholder="Qué relación del mantenimiento se quiere cambiar"
        onGuardar={(v) => cambiarBlanco("conductas-alternativas", { mecanismo: v })}
      />
    );
  }

  if (clave === "alternativa") {
    return <PanelAlternativas analisis={analisis} indiceBlanco={indiceBlanco} cambiarBlanco={cambiarBlanco} onEditarSeccion={onEditarSeccion} />;
  }

  if (clave === "estrategia") {
    return <PanelEstrategias analisis={analisis} indiceBlanco={indiceBlanco} cambiarBlanco={cambiarBlanco} onEditarSeccion={onEditarSeccion} />;
  }

  const indicadores = analisis.plan_de_monitorizacion
    .map((p, i) => ({ p, i }))
    .filter(({ p }) => blanco.indicador_ids.includes(p.id));

  if (clave === "indicador") {
    const libres = analisis.plan_de_monitorizacion.filter(
      (p) => !analisis.blancos.some((b) => b.indicador_ids.includes(p.id))
    );
    return (
      <div className="space-y-2">
        {indicadores.length === 0 && <p className="text-sm text-ink-muted">Sin indicador.</p>}
        {indicadores.map(({ p }) => (
          <div key={p.id} className="flex items-start justify-between gap-2">
            <p className="text-sm text-ink">
              {p.que_se_mide || "—"}
              <span className="text-ink-muted">{[p.con_que, p.cada_cuanto].filter(Boolean).map((x) => ` · ${x}`).join("")}</span>
            </p>
            {edicion && (
              <button
                type="button"
                onClick={() => cambiarBlanco(null, { indicador_ids: blanco.indicador_ids.filter((x) => x !== p.id) })}
                className={`${boton} shrink-0 border-divider text-ink-muted hover:text-ink`}
                aria-label="Quitar indicador del blanco"
              >
                Quitar
              </button>
            )}
          </div>
        ))}
        {edicion && libres.length > 0 && (
          <select
            aria-label="Enlazar indicador"
            value=""
            onChange={(e) => e.target.value && cambiarBlanco(null, { indicador_ids: [...blanco.indicador_ids, e.target.value] })}
            className="max-w-full rounded border border-divider bg-surface px-2 py-1 text-xs text-ink"
          >
            <option value="">+ Enlazar indicador por asignar…</option>
            {libres.map((p) => (
              <option key={p.id} value={p.id}>{p.que_se_mide.slice(0, 80) || p.id}</option>
            ))}
          </select>
        )}
      </div>
    );
  }

  // Revisión: criterio de cada indicador y la sesión en que se revisa.
  return (
    <div className="space-y-2">
      {indicadores.length === 0 && <p className="text-sm text-ink-muted">Enlaza un indicador para fijar su criterio.</p>}
      {indicadores.map(({ p, i }) => (
        <div key={p.id}>
          <p className={rotulo}>Revisar si…</p>
          <Campo
            valor={p.criterio_de_revision}
            etiqueta="Criterio de revisión"
            placeholder="Qué observación obligaría a rehacer la hipótesis"
            multilinea
            onGuardar={(v) =>
              onEditarSeccion("monitorizacion", (c) => {
                c.plan_de_monitorizacion[i] = { ...c.plan_de_monitorizacion[i], criterio_de_revision: v };
              })
            }
          />
        </div>
      ))}
      <label className="flex items-center gap-2 text-sm text-ink-muted">
        Sesión
        {edicion ? (
          <input
            type="number"
            min={1}
            value={blanco.revisar_en_sesion ?? ""}
            onChange={(e) => {
              const n = Number.parseInt(e.target.value, 10);
              cambiarBlanco(null, { revisar_en_sesion: Number.isFinite(n) && n > 0 ? n : null });
            }}
            className="w-20 rounded border border-divider bg-surface px-2 py-1 text-sm text-ink"
          />
        ) : (
          <span className="text-ink">{blanco.revisar_en_sesion ?? "—"}</span>
        )}
      </label>
    </div>
  );
}

type PropsPanel = {
  analisis: AnalisisFuncional;
  indiceBlanco: number;
  cambiarBlanco: (seccion: string | null, parcial: Partial<Blanco>) => void;
  onEditarSeccion: EditarSeccion;
};

function PanelAlternativas({ analisis, indiceBlanco, cambiarBlanco, onEditarSeccion }: PropsPanel) {
  const edicion = useEdicion();
  const blanco = analisis.blancos[indiceBlanco];
  const rechazadas = blanco.alternativas_rechazadas ?? [];
  const [abierta, setAbierta] = useState<Id | null>(null);
  const lista = analisis.conductas_alternativas
    .map((alt, i) => ({ alt, i, rechazada: rechazadas.includes(alt.id) }))
    .filter(({ alt, rechazada }) => rechazada || blanco.alternativa_ids.includes(alt.id));
  const alertaAlta = (i: number) =>
    (analisis.alertas ?? []).some((a) => a.gravedad === "alta" && a.ruta.startsWith(`conductas_alternativas[${i}]`));

  const cambiarAlt = (i: number, parcial: Partial<ConductaAlternativa>) =>
    onEditarSeccion("conductas-alternativas", (c) => {
      c.conductas_alternativas[i] = { ...c.conductas_alternativas[i], ...parcial };
    });
  const rechazar = (id: Id) =>
    cambiarBlanco(null, {
      alternativa_ids: blanco.alternativa_ids.filter((x) => x !== id),
      alternativas_rechazadas: [...rechazadas, id],
    });
  const recuperar = (id: Id) =>
    cambiarBlanco(null, {
      alternativa_ids: [...blanco.alternativa_ids, id],
      alternativas_rechazadas: rechazadas.filter((x) => x !== id),
    });

  if (lista.length === 0) return <p className="text-sm text-ink-muted">Sin alternativa.</p>;

  return (
    <ul className="space-y-2">
      {lista.map(({ alt, i, rechazada }) => (
        <li key={alt.id} className="rounded border border-divider bg-surface p-2">
          <div className="flex items-start justify-between gap-2">
            <button
              type="button"
              onClick={() => setAbierta(abierta === alt.id ? null : alt.id)}
              aria-expanded={abierta === alt.id}
              className={`min-w-0 flex-1 text-left text-sm ${rechazada ? "text-ink-muted line-through" : "text-ink"}`}
            >
              {!rechazada && alertaAlta(i) && <span className="text-warn">▲ </span>}
              {alt.conducta_propuesta || "—"}
            </button>
            {edicion && (
              <button
                type="button"
                onClick={() => (rechazada ? recuperar(alt.id) : rechazar(alt.id))}
                className={`${boton} shrink-0 border-divider text-ink-muted hover:text-ink`}
              >
                {rechazada ? "Recuperar" : "Rechazar"}
              </button>
            )}
          </div>
          {abierta === alt.id && !rechazada && (
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <label className="space-y-1">
                <span className={rotulo}>Sustituye a</span>
                {edicion ? (
                  <select
                    value={alt.sustituye_a ?? ""}
                    onChange={(e) => cambiarAlt(i, { sustituye_a: e.target.value || null })}
                    className={entrada}
                  >
                    <option value="">—</option>
                    {analisis.conductas_problema.map((c) => (
                      <option key={c.id} value={c.id}>{c.descripcion.slice(0, 70)}</option>
                    ))}
                  </select>
                ) : (
                  <p className="text-sm text-ink">
                    {analisis.conductas_problema.find((c) => c.id === alt.sustituye_a)?.descripcion ?? "—"}
                  </p>
                )}
              </label>
              <CampoRotulado rotuloTexto="Antecedente" valor={alt.antecedente} placeholder="Cuándo debe emitirse" onGuardar={(v) => cambiarAlt(i, { antecedente: v })} />
              <CampoRotulado rotuloTexto="Función" valor={alt.funcion_que_cumple} placeholder="La misma que cumplía la conducta" onGuardar={(v) => cambiarAlt(i, { funcion_que_cumple: v })} />
              <CampoRotulado
                rotuloTexto="La mantendrá"
                valor={alt.la_mantendra.join("; ")}
                placeholder="Consecuencias o valores, separados por ;"
                onGuardar={(v) => cambiarAlt(i, { la_mantendra: v.split(";").map((x) => x.trim()).filter(Boolean) })}
              />
              <CampoRotulado rotuloTexto="Habilidades" valor={alt.habilidades_necesarias} placeholder="Qué necesita saber hacer" onGuardar={(v) => cambiarAlt(i, { habilidades_necesarias: v })} />
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

function CampoRotulado({
  rotuloTexto,
  ...props
}: { rotuloTexto: string; valor: string; placeholder: string; onGuardar: (v: string) => void }) {
  return (
    <div className="space-y-1">
      <span className={rotulo}>{rotuloTexto}</span>
      <Campo etiqueta={rotuloTexto} {...props} />
    </div>
  );
}

function PanelEstrategias({ analisis, indiceBlanco, onEditarSeccion }: PropsPanel) {
  const edicion = useEdicion();
  const blanco = analisis.blancos[indiceBlanco];
  const etiqueta = new Map<Id, string>();
  for (const n of construirNodosGrafo(analisis)) if (!etiqueta.has(n.id)) etiqueta.set(n.id, n.etiqueta);
  const relacion = (id: Id) => {
    const r = analisis.aristas.find((x) => x.id === id);
    return r ? `${etiqueta.get(r.desde) ?? "?"} → ${etiqueta.get(r.hasta) ?? "?"}` : "—";
  };
  const lista = analisis.lineas_de_intervencion_tentativas
    .map((l, i) => ({ l, i }))
    .filter(({ l }) => blanco.estrategia_ids.includes(l.id));

  if (lista.length === 0) return <p className="text-sm text-ink-muted">Sin estrategia.</p>;

  return (
    <ul className="space-y-2">
      {lista.map(({ l, i }) => (
        <li key={l.id} className="rounded border border-divider bg-surface p-2">
          <p className="text-sm text-ink">{l.intervencion || "Sin propuesta todavía"}</p>
          <label className="mt-1.5 flex flex-wrap items-center gap-2">
            <span className={rotulo}>Actúa sobre</span>
            {edicion ? (
              <select
                value={l.actua_sobre ?? ""}
                onChange={(e) =>
                  onEditarSeccion("intervencion", (c) => {
                    c.lineas_de_intervencion_tentativas[i] = {
                      ...c.lineas_de_intervencion_tentativas[i],
                      actua_sobre: e.target.value || null,
                    };
                  })
                }
                className={`max-w-full rounded border bg-surface px-2 py-1 text-xs text-ink ${l.actua_sobre ? "border-divider" : "border-dashed border-ink-muted/60"}`}
              >
                <option value="">⋯ Elige una relación del mapa</option>
                {analisis.aristas.map((r) => (
                  <option key={r.id} value={r.id}>{relacion(r.id).slice(0, 90)}</option>
                ))}
              </select>
            ) : (
              <span className="text-sm text-ink">{l.actua_sobre ? relacion(l.actua_sobre) : "—"}</span>
            )}
          </label>
        </li>
      ))}
    </ul>
  );
}

/* ── El tablero: las mismas columnas y tarjetas que el Mapa ─────────────── */

function Columna({ clase, titulo, icono: Icono, children }: { clase: string; titulo: string; icono: LucideIcon; children: ReactNode }) {
  return (
    <section className={`${s.columna} ${clase}`} aria-label={titulo}>
      <header className={s.columnaCabecera}>
        <Icono className={s.columnaIcono} strokeWidth={1.8} aria-hidden="true" />
        <h5 className={s.columnaTitulo}>{titulo}</h5>
      </header>
      <div className={`${s.columnaCuerpo} ${s.lista}`}>{children}</div>
    </section>
  );
}

/** Lo que se lee en la tarjeta: una línea, y como mucho un detalle corto. */
interface Resumen {
  texto: string | null;
  detalle?: string;
  /** Qué ofrece la tarjeta cuando está vacía. */
  vacio: string;
}

function resumenDe(clave: ClaveRanura, a: AnalisisFuncional, b: Blanco): Resumen {
  const h = a.hipotesis_mantenimiento.find((x) => x.id === b.hipotesis_id);
  const rechazadas = new Set(b.alternativas_rechazadas ?? []);
  const mas = (n: number) => (n > 1 ? `+${n - 1} más` : undefined);
  switch (clave) {
    case "evidencia":
      return { texto: h?.evidencia.verificada ? `«${h.evidencia.texto}»` : null, vacio: "Sin cita" };
    case "hipotesis":
      return { texto: h ? h.funcion || h.enunciado : null, vacio: "+ Elegir hipótesis" };
    case "blanco":
      return { texto: b.operacionalizacion || null, vacio: "+ Qué se observa" };
    case "mecanismo":
      return { texto: b.mecanismo || null, vacio: "+ Qué se quiere cambiar" };
    case "alternativa": {
      const alts = a.conductas_alternativas.filter((x) => b.alternativa_ids.includes(x.id) && !rechazadas.has(x.id));
      return { texto: alts[0]?.conducta_propuesta || null, detalle: mas(alts.length), vacio: "Sin alternativa" };
    }
    case "estrategia": {
      const est = a.lineas_de_intervencion_tentativas.filter((x) => b.estrategia_ids.includes(x.id));
      const sinRelacion = est.some((x) => !x.actua_sobre);
      return {
        texto: est[0]?.intervencion || null,
        detalle: [mas(est.length), sinRelacion ? "⋯ actúa sobre" : undefined].filter(Boolean).join(" · ") || undefined,
        vacio: "Sin estrategia",
      };
    }
    case "indicador": {
      const ind = a.plan_de_monitorizacion.filter((x) => b.indicador_ids.includes(x.id));
      return { texto: ind[0]?.que_se_mide || null, detalle: ind[0]?.cada_cuanto || mas(ind.length), vacio: "+ Enlazar indicador" };
    }
    case "revision": {
      const criterio = a.plan_de_monitorizacion.find((x) => b.indicador_ids.includes(x.id) && x.criterio_de_revision.trim());
      return {
        texto: criterio?.criterio_de_revision ?? null,
        detalle: b.revisar_en_sesion !== null ? `Sesión ${b.revisar_en_sesion}` : "⋯ sin sesión",
        vacio: "+ Criterio de revisión",
      };
    }
  }
}

function TarjetaRanura({
  ranura,
  resumen,
  abierta,
  propuesta,
  onAbrir,
}: {
  ranura: Ranura;
  resumen: Resumen;
  abierta: boolean;
  propuesta: boolean;
  onAbrir: () => void;
}) {
  if (!resumen.texto && ranura.alertas.length === 0) {
    return (
      <button type="button" onClick={onAbrir} aria-expanded={abierta} className={`${s.hueco} text-left ${abierta ? s.seleccionado : ""}`}>
        <span className="block text-[10px] opacity-70">{ranura.etiqueta}</span>
        {resumen.vacio}
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={onAbrir}
      aria-expanded={abierta}
      className={`${s.nodo} text-left ${abierta ? s.seleccionado : ""} ${propuesta ? "border-dashed" : ""}`}
    >
      {propuesta && <span className="absolute right-3 top-2 text-[10px] text-ink-muted">IA</span>}
      <span className={s.chip}>{ranura.etiqueta}</span>
      {ranura.alertas.length > 0 && <InsigniaAlerta alertas={ranura.alertas} className="mt-1 ml-1" />}
      <p className={`${s.etiqueta} line-clamp-3`}>{resumen.texto ?? resumen.vacio}</p>
      {resumen.detalle && <p className={s.detalle}>{resumen.detalle}</p>}
    </button>
  );
}
