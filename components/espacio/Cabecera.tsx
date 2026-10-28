"use client";

/**
 * Cabecera del espacio de trabajo: qué caso es, el riesgo, los avisos y
 * exportar. Sustituye a las tres acciones primarias que había encima del
 * informe y a la sección de riesgo del Resumen.
 *
 * EL RIESGO SIEMPRE SE VE. Tres estados, y ninguno dice «sin riesgo»: no
 * evaluado, evaluado sin indicadores recogidos, o con indicadores. Sin rojo
 * (MARCA.md): la gravedad va en la forma (◌, ○, ▲), el peso y el texto.
 *
 * LOS AVISOS SE CUENTAN POR GRAVEDAD: ▲ revisar antes de usar, ◆ conviene
 * revisar. El contador abre una bandeja que salta de uno a otro; cada salto
 * lleva a la vista y al elemento donde el aviso se pinta (lib/destinoAlerta.ts).
 */

import { useState } from "react";
import { repositorio } from "@/lib/repositorio";
import { useCaso } from "../contextoCaso";
import type { AnalisisFuncional, Alerta } from "@/lib/types";
import { destinoDeAlerta } from "@/lib/destinoAlerta";
import { traducirMensajeAlerta } from "@/lib/gradoApoyo";
import { TEXTO_RIESGO_NO_EVALUADO, TEXTO_RIESGO_SIN_INDICADORES } from "@/lib/vacios";
import { ListaEditable } from "../informe/primitivas";
import { useAccionesSeccion } from "../informe/seccion";
import type { EditarSeccion } from "../informe/PreguntasClinicas";
import { useEspacio } from "./contexto";
import { irADestino } from "./navegar";

export interface AccionesExportar {
  onCopiar: () => void;
  copiado: boolean;
  onWord: () => void;
  /** Crea un caso con este análisis. Ausente si ya está en un caso o no aplica (ejemplo). */
  onGuardarBiblioteca?: () => Promise<void>;
}

const CLASE_BOTON =
  "inline-flex items-center gap-1.5 rounded border border-divider bg-surface px-2.5 py-1 text-xs text-ink transition-colors hover:bg-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40";

export default function Cabecera({
  analisis,
  referenciaCaso,
  onReferenciaCasoChange,
  fecha,
  acciones,
  onEditarSeccion,
}: {
  analisis: AnalisisFuncional;
  referenciaCaso: string;
  onReferenciaCasoChange: (valor: string) => void;
  fecha: string;
  acciones: AccionesExportar;
  onEditarSeccion: EditarSeccion;
}) {
  const caso = useCaso();
  return (
    <header className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-divider px-4 py-2.5 print:hidden">
      {caso ? (
        <p className="flex min-w-0 items-center gap-2">
          <span className="truncate font-serif text-base text-ink">{caso.expediente.caso.alias}</span>
          <span className="font-mono text-[11px] uppercase tracking-wide text-ink-muted">
            Sesión {caso.sesion.n} · {new Date(caso.sesion.fecha).toLocaleDateString("es", { day: "numeric", month: "short" })}
          </span>
          {!caso.soloLectura && (
            <button type="button" onClick={caso.anadirSesion} className={CLASE_BOTON} title="Guarda la nota de una nueva sesión">
              + Sesión
            </button>
          )}
        </p>
      ) : (
      <label className="flex min-w-0 items-center gap-2 text-sm text-ink-muted">
        <span className="sr-only">Referencia del caso</span>
        <input
          type="text"
          value={referenciaCaso}
          onChange={(e) => onReferenciaCasoChange(e.target.value)}
          placeholder="Referencia del caso (p. ej. M.34)"
          maxLength={60}
          className="w-48 border-b border-divider bg-transparent px-1 py-0.5 font-serif text-base text-ink focus-visible:border-accent focus-visible:outline-none"
        />
      </label>
      )}
      <p className="text-xs text-ink-muted">
        {fecha}
        {analisis.meta.modelo && ` · ${analisis.meta.modelo} · prompt v${analisis.meta.version_prompt}`}
      </p>
      <div className="ml-auto flex flex-wrap items-center gap-2">
        <ChipRiesgo analisis={analisis} onEditarSeccion={onEditarSeccion} />
        <ContadorAvisos analisis={analisis} />
        {acciones.onGuardarBiblioteca && <BotonGuardarBiblioteca guardar={acciones.onGuardarBiblioteca} />}
        <MenuExportar acciones={acciones} />
      </div>
    </header>
  );
}

function ChipRiesgo({
  analisis,
  onEditarSeccion,
}: {
  analisis: AnalisisFuncional;
  onEditarSeccion: EditarSeccion;
}) {
  const [abierto, setAbierto] = useState(false);
  const acciones = useAccionesSeccion("riesgo", "Riesgo", ["riesgo"]);
  const { evaluado, indicadores } = analisis.riesgo;
  const estado = !evaluado ? "no_evaluado" : indicadores.length === 0 ? "sin_indicadores" : "con_indicadores";
  const rotulo =
    estado === "no_evaluado"
      ? { marca: "◌", texto: "Riesgo no evaluado" }
      : estado === "sin_indicadores"
        ? { marca: "○", texto: "Riesgo evaluado · sin indicadores" }
        : { marca: "▲", texto: `Riesgo · ${indicadores.length} indicador${indicadores.length === 1 ? "" : "es"}` };

  return (
    <div className="relative">
      <button
        type="button"
        aria-expanded={abierto}
        onClick={() => setAbierto((v) => !v)}
        className={`${CLASE_BOTON} ${estado === "con_indicadores" ? "border-warn font-semibold text-warn" : ""}`}
      >
        <span aria-hidden="true">{rotulo.marca}</span>
        {rotulo.texto}
      </button>
      {abierto && (
        <div id="riesgo" className="absolute right-0 z-40 mt-1 w-80 rounded-md border border-divider bg-surface p-3 shadow-lg">
          <div className="mb-2 flex items-center gap-2">
            <p className="font-mono text-[10px] uppercase tracking-wide text-ink-muted">Riesgo</p>
            <span className="ml-auto">{acciones.menu}</span>
          </div>
          {!evaluado ? (
            <p className="text-sm text-ink-muted">{TEXTO_RIESGO_NO_EVALUADO}</p>
          ) : (
            <ListaEditable
              items={indicadores}
              seccionId="riesgo"
              etiqueta="indicador de riesgo"
              claseItem="text-sm leading-relaxed text-ink"
              vacio={<p className="text-sm text-ink-muted">{TEXTO_RIESGO_SIN_INDICADORES}</p>}
              onCambiar={(nuevos) =>
                onEditarSeccion("riesgo", (c) => {
                  c.riesgo.indicadores = nuevos;
                })
              }
            />
          )}
          {acciones.panel}
        </div>
      )}
    </div>
  );
}

function ContadorAvisos({ analisis }: { analisis: AnalisisFuncional }) {
  const espacio = useEspacio();
  const [abierta, setAbierta] = useState(false);
  const [indice, setIndice] = useState(0);
  // Las graves primero: es el orden en que conviene recorrerlas.
  const avisos = [...analisis.alertas].sort((a, b) =>
    a.gravedad === b.gravedad ? 0 : a.gravedad === "alta" ? -1 : 1
  );
  const altas = avisos.filter((a) => a.gravedad === "alta").length;
  const medias = avisos.length - altas;
  const actual = Math.min(indice, Math.max(0, avisos.length - 1));

  function ir(i: number, alerta: Alerta) {
    setIndice(i);
    const destino = destinoDeAlerta(analisis, alerta);
    if (destino) irADestino(destino, espacio);
  }

  if (avisos.length === 0) {
    return <span className="text-xs text-ink-muted">Sin avisos del validador</span>;
  }

  return (
    <div className="relative">
      <button
        type="button"
        aria-expanded={abierta}
        onClick={() => setAbierta((v) => !v)}
        className={CLASE_BOTON}
        title="Avisos del análisis: ▲ revisar antes de usar · ◆ conviene revisar"
      >
        {altas > 0 && <span className="font-semibold text-warn">▲ {altas}</span>}
        {medias > 0 && <span className="text-warn">◆ {medias}</span>}
        <span className="sr-only">avisos</span>
      </button>
      {abierta && (
        <div id="verificacion" className="absolute right-0 z-40 mt-1 max-h-[60vh] w-96 overflow-y-auto rounded-md border border-divider bg-surface p-3 shadow-lg">
          <div className="mb-2 flex items-center gap-2">
            <p className="font-mono text-[10px] uppercase tracking-wide text-ink-muted">
              Puntos a verificar · {actual + 1} de {avisos.length}
            </p>
            <div className="ml-auto flex gap-1">
              <button type="button" disabled={actual === 0} onClick={() => ir(actual - 1, avisos[actual - 1])} className={CLASE_BOTON} aria-label="Aviso anterior">
                ←
              </button>
              <button type="button" disabled={actual >= avisos.length - 1} onClick={() => ir(actual + 1, avisos[actual + 1])} className={CLASE_BOTON} aria-label="Aviso siguiente">
                →
              </button>
            </div>
          </div>
          <ol className="space-y-2">
            {avisos.map((a, i) => {
              const destino = destinoDeAlerta(analisis, a);
              return (
                <li key={i}>
                  <button
                    type="button"
                    onClick={() => ir(i, a)}
                    disabled={!destino}
                    className={`block w-full rounded border-l-[3px] py-1.5 pl-3 pr-2 text-left text-sm leading-relaxed ${a.gravedad === "alta" ? "border-warn bg-warn/5" : "border-warn/50"} ${i === actual ? "ring-1 ring-accent/40" : ""}`}
                  >
                    <span className={`font-semibold ${a.gravedad === "alta" ? "text-warn" : "text-ink"}`}>
                      {a.gravedad === "alta" ? "▲ Revisar antes de usar" : "◆ Conviene revisar"}
                    </span>
                    {a.origen === "ia" && <span className="ml-2 font-mono text-[10px] uppercase text-ink-muted">Revisión con IA</span>}
                    <span className="mt-0.5 block text-ink">{traducirMensajeAlerta(a.mensaje)}</span>
                    {!destino && <span className="mt-0.5 block text-[11px] text-ink-muted">Aviso general: no señala un elemento concreto.</span>}
                  </button>
                </li>
              );
            })}
          </ol>
        </div>
      )}
    </div>
  );
}

/**
 * Guarda en la biblioteca (cifrada en este dispositivo) un análisis hecho sin
 * caso. Si la biblioteca está cerrada, pide aquí mismo la frase de paso —o la
 * crea, si es la primera vez— para no tener que ir a «Casos», que perdería el
 * análisis en pantalla.
 */
function BotonGuardarBiblioteca({ guardar }: { guardar: () => Promise<void> }) {
  const [abierto, setAbierto] = useState(false);
  const [configurada, setConfigurada] = useState<boolean | null>(null);
  const [frase, setFrase] = useState("");
  const [repetir, setRepetir] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [ocupado, setOcupado] = useState(false);

  async function conManejo(accion: () => Promise<void>) {
    setOcupado(true);
    setMensaje("");
    try {
      await accion();
    } catch (e) {
      setMensaje(e instanceof Error ? e.message : "No se pudo guardar.");
      setAbierto(true);
    } finally {
      setOcupado(false);
    }
  }

  function pulsar() {
    if (!repositorio.disponible()) {
      setAbierto(true);
      setMensaje("Este navegador no permite guardar casos (hace falta HTTPS o localhost, y no en modo privado).");
      return;
    }
    if (repositorio.desbloqueado()) {
      void conManejo(guardar);
      return;
    }
    setAbierto(true);
    void conManejo(async () => setConfigurada(await repositorio.yaConfigurado()));
  }

  function abrirYGuardar() {
    void conManejo(async () => {
      if (configurada) {
        if (!(await repositorio.desbloquear(frase))) {
          setMensaje("Frase de paso incorrecta.");
          return;
        }
      } else {
        if (frase.length < 8) {
          setMensaje("Usa al menos 8 caracteres.");
          return;
        }
        if (frase !== repetir) {
          setMensaje("Las frases no coinciden.");
          return;
        }
        await repositorio.configurar(frase);
      }
      setFrase("");
      setRepetir("");
      await guardar();
      setAbierto(false);
    });
  }

  const campo = "w-full rounded border border-divider bg-canvas px-2 py-1 text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40";
  return (
    <div className="relative">
      <button type="button" onClick={pulsar} disabled={ocupado} className={CLASE_BOTON} title="Crea un caso en tu biblioteca con este análisis">
        {ocupado ? "Guardando…" : "Guardar en biblioteca"}
      </button>
      {abierto && (
        <div className="absolute right-0 z-40 mt-1 w-80 rounded-md border border-divider bg-surface p-3 shadow-lg">
          {configurada === null ? null : configurada ? (
            <p className="mb-2 text-sm text-ink-muted">Escribe la frase de paso de tu biblioteca para guardar este análisis como un caso nuevo.</p>
          ) : (
            <p className="mb-2 text-sm text-ink-muted">
              Elige una frase de paso para tu biblioteca. Cifra tus casos en este dispositivo.{" "}
              <strong className="text-ink">Si la pierdes, no se pueden recuperar.</strong>
            </p>
          )}
          {configurada !== null && (
            <form
              className="space-y-2"
              onSubmit={(e) => {
                e.preventDefault();
                abrirYGuardar();
              }}
            >
              <input type="password" autoFocus value={frase} onChange={(e) => setFrase(e.target.value)} placeholder="Frase de paso" aria-label="Frase de paso" className={campo} />
              {!configurada && (
                <input type="password" value={repetir} onChange={(e) => setRepetir(e.target.value)} placeholder="Repite la frase de paso" aria-label="Repite la frase de paso" className={campo} />
              )}
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setAbierto(false)} className={CLASE_BOTON}>
                  Cancelar
                </button>
                <button type="submit" disabled={ocupado || !frase} className={`${CLASE_BOTON} border-accent text-accent`}>
                  Abrir y guardar
                </button>
              </div>
            </form>
          )}
          {mensaje && <p role="alert" className="mt-2 text-sm text-warn">{mensaje}</p>}
        </div>
      )}
    </div>
  );
}

function MenuExportar({ acciones }: { acciones: AccionesExportar }) {
  const [abierto, setAbierto] = useState(false);
  const elegir = (accion: () => void) => {
    setAbierto(false);
    accion();
  };
  return (
    <div className="relative">
      <button type="button" aria-expanded={abierto} aria-haspopup="menu" onClick={() => setAbierto((v) => !v)} className={CLASE_BOTON}>
        {acciones.copiado ? "Copiado" : "Exportar ▾"}
      </button>
      {abierto && (
        <div role="menu" className="absolute right-0 z-40 mt-1 w-48 rounded-md border border-divider bg-surface py-1 shadow-lg">
          <button role="menuitem" type="button" onClick={() => elegir(acciones.onCopiar)} className="block w-full px-3 py-1.5 text-left text-sm text-ink hover:bg-canvas">
            Copiar informe
          </button>
          <button role="menuitem" type="button" onClick={() => elegir(acciones.onWord)} className="block w-full px-3 py-1.5 text-left text-sm text-ink hover:bg-canvas">
            Descargar Word
          </button>
          <button role="menuitem" type="button" onClick={() => elegir(() => window.print())} className="block w-full px-3 py-1.5 text-left text-sm text-ink hover:bg-canvas">
            Imprimir / PDF
          </button>
        </div>
      )}
    </div>
  );
}
