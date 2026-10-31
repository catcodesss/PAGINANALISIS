"use client";

/**
 * La sesión vacía: creada con «+ Sesión → Sesión vacía», sin nota ni análisis.
 * Muestra el Mapa con sus cuadros en blanco y la leyenda apagada, esperando a
 * que se le agregue la nota y se analice. Usa las mismas columnas que el Mapa
 * (afc.module.css) para que al analizar se llene lo mismo que se ve aquí.
 */

import { useState, type ReactNode } from "react";
import { ABC_EN_BLANCO, hayABC, type ABCManual } from "@/lib/abcManual";
import { ChartNoAxesColumnIncreasing, ClipboardList, Play, Target, type LucideIcon } from "lucide-react";
import type { Sesion } from "@/lib/casos";
import { NIVELES_APOYO } from "@/lib/gradoApoyo";
import { TERMINOS } from "@/lib/terminos";
import { interAfc, poppinsAfc } from "../grafo/fuentesAfc";
import s from "../grafo/afc.module.css";

const CLASE_BOTON =
  "inline-flex items-center gap-1.5 rounded border border-divider bg-surface px-3 py-1.5 text-sm font-medium text-ink transition-colors hover:bg-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40";

export default function SesionEnEspera({
  alias,
  sesion,
  anterior,
  onAnalizar,
  onVerAnterior,
  onBorrar,
  onGuardarABC,
}: {
  alias: string;
  /** null: el caso aún no tiene ninguna sesión. */
  sesion: Sesion | null;
  /** La sesión anterior con formulación, si la hay. */
  anterior: Sesion | null;
  onAnalizar: () => void;
  onVerAnterior: (sesionId: string) => void;
  onBorrar: () => Promise<void>;
  /** Guarda lo escrito a mano en los cuadros como la formulación de la sesión. */
  onGuardarABC: (abc: ABCManual) => Promise<void>;
}) {
  const [confirmarBorrar, setConfirmarBorrar] = useState(false);
  const [abc, setAbc] = useState<ABCManual>(ABC_EN_BLANCO);
  const [guardando, setGuardando] = useState(false);
  const cambiar = (campo: keyof ABCManual) => (valor: string) => setAbc((previo) => ({ ...previo, [campo]: valor }));
  async function guardarABC() {
    setGuardando(true);
    try {
      await onGuardarABC(abc);
    } finally {
      setGuardando(false);
    }
  }
  const fecha = sesion ? new Date(sesion.fecha).toLocaleDateString("es", { day: "numeric", month: "short" }) : "";

  return (
    <div className="rounded-lg border border-divider bg-surface">
      <header className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-divider px-4 py-2.5">
        <p className="flex min-w-0 items-center gap-2">
          <span className="truncate font-serif text-base text-ink">{alias}</span>
          {sesion && (
            <span className="font-mono text-[11px] uppercase tracking-wide text-ink-muted">
              Sesión {sesion.n} · {fecha}
            </span>
          )}
        </p>
        <p className="text-xs text-ink-muted">
          {sesion ? "Sesión vacía · sin nota ni análisis" : "Caso sin sesiones · sin nota ni análisis"}
        </p>
      </header>

      <div className="p-4">
        <div role="status" className="mb-4 flex flex-wrap items-center gap-3 rounded-md border border-divider bg-canvas px-4 py-3">
          <p className="min-w-0 flex-1 text-sm text-ink">
            <b className="font-serif font-semibold">{sesion ? "Esta sesión aún no tiene análisis." : "Este caso aún no tiene análisis."}</b>{" "}
            <span className="text-ink-muted">Los cuadros se llenarán cuando agregues la nota y la analices, o puedes escribirlos tú.</span>
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onAnalizar}
              className="rounded bg-accent px-4 py-1.5 text-sm font-medium texto-sobre-acento transition-colors hover:bg-accent/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
            >
              Agregar nota y analizar
            </button>
            {hayABC(abc) && (
              <button type="button" onClick={() => void guardarABC()} disabled={guardando} className={`${CLASE_BOTON} border-accent text-accent`}>
                {guardando ? "Guardando…" : "Guardar lo que escribí"}
              </button>
            )}
            {anterior && (
              <button type="button" onClick={() => onVerAnterior(anterior.id)} className={CLASE_BOTON}>
                Ver la sesión anterior
              </button>
            )}
            {sesion && (
              <button type="button" onClick={() => setConfirmarBorrar(true)} className={CLASE_BOTON}>
                Borrar esta sesión
              </button>
            )}
          </div>
        </div>

        {/* Barra del Mapa, apagada: no hay nada que filtrar todavía. */}
        <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-2" aria-hidden="true">
          <span className="rounded border border-dashed border-divider px-2.5 py-1 text-xs text-ink-muted/70">Grado de apoyo ⓘ</span>
          <span className="rounded border border-dashed border-divider px-2.5 py-1 text-xs text-ink-muted/70">Conductas alternativas: —</span>
          <span className="rounded border border-dashed border-divider px-2.5 py-1 text-xs text-ink-muted/70">Huecos: —</span>
        </div>

        <div className={`relative min-w-0 ${s.raiz} ${poppinsAfc.variable} ${interAfc.variable}`}>
          <section className={s.situacion} aria-label="Mapa en espera">
            <header className={s.situacionCabecera}>
              <h4 className={s.situacionTitulo}>Mapa de la sesión · en espera</h4>
            </header>
            <div className={`${s.scroll} ${s.contenedorColumnas}`}>
              <div className={`${s.tablero} ${s.lienzoColumnas}`}>
                <Columna clase={s.om} titulo={TERMINOS.om.claro} icono={Target}>
                  <Escribir valor={abc.contexto} onCambio={cambiar("contexto")} etiqueta={TERMINOS.om.claro} marcador="Contexto · escríbelo aquí o espera el análisis" />
                </Columna>
                <Columna clase={s.ant} titulo="Antecedente" icono={ClipboardList}>
                  <Escribir valor={abc.antecedente} onCambio={cambiar("antecedente")} etiqueta="Antecedente" marcador="Qué pasó antes · escríbelo aquí o espera el análisis" />
                </Columna>
                <Columna clase={s.con} titulo="Conducta" icono={Play}>
                  <Escribir valor={abc.conducta} onCambio={cambiar("conducta")} etiqueta="Conducta" marcador="Qué hizo, pensó o sintió · escríbelo aquí o espera el análisis" />
                </Columna>
                <Columna clase={s.csq} titulo="Consecuencias" icono={ChartNoAxesColumnIncreasing}>
                  {([["Consecuencia inmediata", "inmediata"], ["Consecuencia demorada", "demorada"]] as const).map(([t, campo]) => (
                    <div key={t} className={s.consecuencias}>
                      <p className={s.subzonaTitulo}>{t}</p>
                      <Escribir valor={abc[campo]} onCambio={cambiar(campo)} etiqueta={t} marcador="Escríbela aquí o espera el análisis" />
                    </div>
                  ))}
                </Columna>
              </div>
            </div>
          </section>
        </div>

        {/* Leyenda del grado de apoyo, en gris hasta que haya análisis. */}
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-muted/70">
          {NIVELES_APOYO.map(({ grado, etiqueta }) => (
            <span key={grado} className="inline-flex items-center gap-1.5">
              <span aria-hidden="true" className="h-2 w-2 rounded-full border border-dashed border-ink-muted/50" />
              {etiqueta}
            </span>
          ))}
          <span className="ml-auto italic">La leyenda se activa al analizar</span>
        </div>
      </div>

      {confirmarBorrar && sesion && (
        <div role="dialog" aria-modal="true" aria-label="Borrar esta sesión" className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl border border-divider bg-surface p-5">
            <p className="font-serif text-lg font-semibold text-ink">¿Borrar la sesión {sesion.n}?</p>
            <p className="mt-2 text-sm text-ink-muted">Está vacía: no tiene nota ni análisis. No se pierde nada más del caso.</p>
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <button type="button" onClick={() => setConfirmarBorrar(false)} className={CLASE_BOTON}>
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirmarBorrar(false);
                  void onBorrar();
                }}
                className="rounded bg-accent px-4 py-1.5 text-sm font-medium texto-sobre-acento transition-colors hover:bg-accent/90"
              >
                Borrar esta sesión
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Columna({ clase, titulo, icono: Icono, children }: { clase: string; titulo: string; icono: LucideIcon; children: ReactNode }) {
  return (
    <section className={`${s.columna} ${clase}`} aria-label={titulo}>
      <header className={s.columnaCabecera}>
        <Icono className={s.columnaIcono} strokeWidth={1.8} aria-hidden="true" />
        <h5 className={s.columnaTitulo}>{titulo}</h5>
      </header>
      <div className={s.columnaCuerpo}>{children}</div>
    </section>
  );
}

function Escribir({ valor, onCambio, etiqueta, marcador }: { valor: string; onCambio: (v: string) => void; etiqueta: string; marcador: string }) {
  return (
    <textarea
      value={valor}
      onChange={(e) => onCambio(e.target.value)}
      aria-label={etiqueta}
      placeholder={marcador}
      rows={3}
      className={`${s.hueco} w-full resize-y bg-transparent text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40`}
    />
  );
}
