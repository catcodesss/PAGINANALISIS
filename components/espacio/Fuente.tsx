"use client";

/**
 * Cajón «Nota completa» (antes «Fuente»): la nota con sus frases numeradas.
 *
 * Cerrado no ocupa nada: se abre con el botón al pie de la pestaña Evidencia
 * del Inspector. Abierto, el 42 % del alto. Pulsar una cita en cualquier sitio
 * lo abre y resalta su frase. «Editar texto» deja corregir cada frase: la
 * corrección vive solo en la pantalla (contexto.tsx, `ediciones`), no toca el
 * análisis ni llama a la IA, y las citas se releen de ella. Pulsar
 * una frase enseña qué elementos del análisis la usan, y desde ahí se puede
 * seleccionar cada uno. La cobertura (fase 2) se ve aquí: las frases que nadie
 * cita van en ámbar.
 *
 * Desde la fase 5C la nota también es una fuente de evidencia del clínico: una
 * frase se arrastra a un nodo o a una relación (o, sin ratón, «Citar en» el
 * elemento elegido) y queda unida como cita tuya. Una frase que nada usa se
 * puede convertir en conducta, acomodación, valor o moduladora.
 *
 * Todo se calcula en el cliente a partir de la nota y el análisis que ya están
 * en pantalla: nada sale ni se registra (invariante 5).
 */

import { useEffect, useMemo, useRef, useState } from "react";
import type { AnalisisFuncional } from "@/lib/types";
import { citaCubreFrase, etiquetaCita, segmentarFrases } from "@/lib/citas";
import { calcularCoberturaNota } from "@/lib/coberturaNota";
import { construirNodosGrafo } from "@/lib/grafo";
import {
  citaDeFrase,
  convertirFrase,
  esCitable,
  ETIQUETA_TIPO_DESDE_FRASE,
  type TipoDesdeFrase,
} from "@/lib/edicionMapa";
import { etiquetaTipoNodo } from "../grafo/etiquetasNodo";
import { TIPO_ARRASTRE_FRASE, useEspacio } from "./contexto";

export default function Fuente({
  analisis,
  notaOriginal,
}: {
  analisis: AnalisisFuncional;
  notaOriginal: string;
}) {
  const {
    fuenteAbierta,
    abrirFuente,
    citaEnFuente,
    seleccionado,
    seleccionar,
    citarFrase,
    aplicar,
    lineasNota,
    setArrastrandoFrase,
    ediciones,
    editarFrase,
    restaurarNota,
    notaCorregida,
  } = useEspacio();
  const [fraseElegida, setFraseElegida] = useState<{ linea: number; frase: number } | null>(null);
  // Al editar, el texto de cada frase se congela al entrar: así lo que se
  // escribe no se repinta (y el cursor no salta) mientras se teclea.
  const [instantanea, setInstantanea] = useState<Record<string, string> | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const editando = instantanea !== null;
  const nEditadas = Object.keys(ediciones).length;
  const notaRef = useRef<HTMLDivElement>(null);

  const lineas = useMemo(() => notaOriginal.replace(/\r\n/g, "\n").split("\n"), [notaOriginal]);
  const frasesPorLinea = useMemo(() => lineas.map(segmentarFrases), [lineas]);
  const cobertura = useMemo(() => calcularCoberturaNota(lineas, analisis), [lineas, analisis]);
  const sinUsar = useMemo(() => new Set(cobertura.sinUsar.map((f) => `${f.linea}.${f.frase}`)), [cobertura]);
  const nodos = useMemo(() => construirNodosGrafo(analisis), [analisis]);

  // Lo que se resalta: la cita que se pulsó o, si no, la del elemento elegido.
  // Una relación también se elige en el Mapa, y su frase es la que la afirma.
  const nodoElegido = nodos.find((n) => n.id === seleccionado);
  const aristaElegida = analisis.aristas.find((a) => a.id === seleccionado);
  // Si el elemento no tiene cita del modelo, la primera que le uniste tú.
  const tuyaElegida = seleccionado ? (analisis.citas_del_clinico?.[seleccionado]?.[0] ?? null) : null;
  const cita =
    citaEnFuente ??
    (nodoElegido?.evidencia?.verificada
      ? nodoElegido.evidencia
      : (aristaElegida?.evidencia.find((c) => c.verificada) ?? tuyaElegida));

  // Llevar la nota a la frase resaltada. Solo mueve el scroll del cajón: no
  // toca estado, así que no provoca otro render.
  useEffect(() => {
    if (!fuenteAbierta || !cita) return;
    requestAnimationFrame(() => {
      const nota = notaRef.current;
      const el = nota?.querySelector<HTMLElement>(`#fuente-linea-${cita.linea_inicio}`);
      if (nota && el) nota.scrollTop = el.offsetTop - nota.clientHeight / 3;
    });
  }, [fuenteAbierta, cita]);

  // Qué usa la frase elegida: los nodos cuya cita la cubre y las relaciones
  // que la citan. Es la vuelta de «pulsar una cita abre la frase».
  const usan = useMemo(() => {
    if (!fraseElegida) return [];
    const { linea, frase } = fraseElegida;
    const total = frasesPorLinea[linea - 1]?.length ?? 0;
    const vistos = new Set<string>();
    const salida: { id: string; texto: string }[] = [];
    for (const n of nodos) {
      if (vistos.has(n.id) || !n.evidencia?.verificada) continue;
      if (citaCubreFrase(n.evidencia, linea, frase, total)) {
        vistos.add(n.id);
        salida.push({ id: n.id, texto: `${etiquetaTipoNodo(n)}: ${n.etiqueta}` });
      }
    }
    for (const a of analisis.aristas) {
      if (a.evidencia.some((c) => c.verificada && citaCubreFrase(c, linea, frase, total))) {
        const desde = nodos.find((n) => n.id === a.desde);
        const hasta = nodos.find((n) => n.id === a.hasta);
        salida.push({ id: a.id, texto: `Relación: ${desde?.etiqueta ?? "?"} → ${hasta?.etiqueta ?? "?"}` });
      }
    }
    // Lo que le uniste tú, marcado como tuyo.
    for (const [id, citas] of Object.entries(analisis.citas_del_clinico ?? {})) {
      if (vistos.has(id) || !citas.some((c) => citaCubreFrase(c, linea, frase, total))) continue;
      vistos.add(id);
      const n = nodos.find((x) => x.id === id);
      const a = analisis.aristas.find((x) => x.id === id);
      const texto = n
        ? `${etiquetaTipoNodo(n)}: ${n.etiqueta}`
        : a
          ? `Relación: ${nodos.find((x) => x.id === a.desde)?.etiqueta ?? "?"} → ${nodos.find((x) => x.id === a.hasta)?.etiqueta ?? "?"}`
          : id;
      salida.push({ id, texto: `${texto} (cita tuya)` });
    }
    return salida;
  }, [fraseElegida, frasesPorLinea, nodos, analisis.aristas, analisis.citas_del_clinico]);

  // «Citar en»: el elemento elegido, si admite una cita.
  const destino = seleccionado && esCitable(analisis, seleccionado) ? seleccionado : null;
  const nombreDestino = destino
    ? (() => {
        const n = nodos.find((x) => x.id === destino);
        return n ? `${etiquetaTipoNodo(n)}: ${n.etiqueta}` : "la relación elegida";
      })()
    : null;

  // Cuántos elementos se apoyan en frases que el clínico corrigió: para el aviso.
  const afectados = useMemo(() => {
    const ids = new Set<string>();
    for (const clave of Object.keys(ediciones)) {
      const [l, f] = clave.split(".").map(Number);
      const total = frasesPorLinea[l - 1]?.length ?? 0;
      for (const n of nodos) {
        if (n.evidencia?.verificada && citaCubreFrase(n.evidencia, l, f, total)) ids.add(n.id);
      }
      for (const a of analisis.aristas) {
        if (a.evidencia.some((c) => c.verificada && citaCubreFrase(c, l, f, total))) ids.add(a.id);
      }
    }
    return ids.size;
  }, [ediciones, frasesPorLinea, nodos, analisis.aristas]);

  const avisar = (texto: string) => {
    setAviso(texto);
    window.setTimeout(() => setAviso(null), 2400);
  };
  const descargar = () => {
    const url = URL.createObjectURL(new Blob([notaCorregida()], { type: "text/plain;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "nota-ordenada.txt";
    a.click();
    URL.revokeObjectURL(url);
    avisar("Nota descargada");
  };
  const copiar = () => {
    navigator.clipboard.writeText(notaCorregida()).then(
      () => avisar("Nota copiada"),
      () => avisar("No se pudo copiar; usa Descargar")
    );
  };

  if (!fuenteAbierta) return null;

  return (
    <section
      aria-label="Nota completa"
      className="fixed inset-x-0 bottom-0 z-30 flex h-[42vh] flex-col border-t border-divider bg-surface shadow-[0_-8px_24px_rgba(0,0,0,0.1)] print:hidden"
    >
      <div className="flex shrink-0 flex-wrap items-center gap-3 px-4 py-2.5 text-xs text-ink-muted">
        <h2 className="font-serif text-base font-semibold text-ink">Nota completa</h2>
        <span className="rounded-full bg-accent/10 px-2.5 py-0.5 text-accent">✓ Editar no llama a la IA ni cambia el análisis</span>
        {cita && <span className="font-mono text-[10px] uppercase tracking-wide text-accent">{etiquetaCita(cita)}</span>}
        <label className="ml-auto flex cursor-pointer items-center gap-1.5 text-ink">
          <input
            type="checkbox"
            checked={editando}
            onChange={(e) => {
              setInstantanea(e.target.checked ? { ...ediciones } : null);
              setFraseElegida(null);
            }}
            className="accent-[var(--color-accent)]"
          />
          Editar texto
        </label>
        <button type="button" onClick={() => abrirFuente(false)} className="rounded border border-divider px-2.5 py-1 text-ink hover:border-accent">
          Cerrar
        </button>
      </div>
      <p className="flex shrink-0 flex-wrap gap-x-4 px-4 pb-2 text-[11px] text-ink-muted" title="Frases de la nota (de cuatro palabras o más) que ningún elemento del análisis cita. Es una ayuda para revisar: no entra en la exportación.">
        <span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-accent/15 ring-1 ring-accent/30 align-[-1px]" />Ya está en el mapa</span>
        <span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-warn/10 align-[-1px]" />Aún no está en el mapa ({cobertura.sinUsar.length})</span>
        <span>{editando ? "Escribe sobre cualquier frase para corregirla." : "Pulsa una frase para ver qué la usa."}</span>
      </p>

      {fuenteAbierta && (
        <div className="flex min-h-0 flex-1 gap-4 px-4 pb-2">
          <div ref={notaRef} className="relative min-w-0 flex-1 overflow-y-auto rounded border border-divider bg-canvas p-2 font-mono text-[11px] leading-relaxed">
            {lineas.map((linea, indice) => {
              const n = indice + 1;
              const frases = frasesPorLinea[indice];
              return (
                <p id={`fuente-linea-${n}`} key={indice} className="rounded px-1 text-ink-muted">
                  <span className="mr-2 select-none text-ink-muted">L{n}</span>
                  {frases.length === 0
                    ? linea || " "
                    : frases.map((frase, j) => {
                        const citada = cita ? citaCubreFrase(cita, n, j + 1, frases.length) : false;
                        const olvidada = sinUsar.has(`${n}.${j + 1}`);
                        const elegida = fraseElegida?.linea === n && fraseElegida.frase === j + 1;
                        const clave = `${n}.${j + 1}`;
                        const texto = ediciones[clave] ?? frase;
                        const corregida = clave in ediciones;
                        if (editando) {
                          return (
                            <span key={j} id={`fuente-frase-${n}-${j + 1}`} className="inline">
                              <sup className="mr-0.5 select-none text-[9px] text-ink-muted">{j + 1}</sup>
                              <span
                                contentEditable
                                suppressContentEditableWarning
                                role="textbox"
                                aria-label={`Frase L${n}.${j + 1}`}
                                onInput={(e) => editarFrase(n, j + 1, e.currentTarget.textContent ?? "")}
                                className={`rounded px-0.5 outline-none ring-1 ring-divider focus:bg-warn/10 focus:ring-warn ${citada ? "bg-accent/15" : olvidada ? "bg-warn/10" : ""}`}
                              >
                                {instantanea?.[clave] ?? frase}
                              </span>{" "}
                            </span>
                          );
                        }
                        return (
                          <button
                            type="button"
                            key={j}
                            id={`fuente-frase-${n}-${j + 1}`}
                            // Se arrastra la POSICIÓN; el texto lo vuelve a
                            // sacar de la nota quien la recibe (contexto.tsx).
                            draggable
                            onDragStart={(e) => {
                              e.dataTransfer.setData(TIPO_ARRASTRE_FRASE, JSON.stringify({ linea: n, frase: j + 1 }));
                              e.dataTransfer.setData("text/plain", frase);
                              e.dataTransfer.effectAllowed = "copy";
                              setArrastrandoFrase(true);
                            }}
                            onDragEnd={() => setArrastrandoFrase(false)}
                            onClick={() => setFraseElegida(elegida ? null : { linea: n, frase: j + 1 })}
                            title={olvidada ? "Ningún elemento del análisis cita esta frase" : `L${n}.${j + 1}: ver qué la usa`}
                            className={`inline rounded text-left ${citada ? "bg-accent/15 text-ink ring-1 ring-accent/30" : olvidada ? "bg-warn/10" : ""} ${elegida ? "underline decoration-accent underline-offset-2" : ""} ${corregida ? "decoration-dotted underline decoration-warn underline-offset-2" : ""}`}
                          >
                            <sup className="mr-0.5 select-none text-[9px] text-ink-muted">{j + 1}</sup>
                            {texto}{" "}
                          </button>
                        );
                      })}
                </p>
              );
            })}
          </div>
          {fraseElegida && (
            <aside aria-label="Qué usa esta frase" className="hidden w-72 shrink-0 overflow-y-auto text-xs md:block">
              <p className="font-mono text-[10px] uppercase tracking-wide text-ink-muted">
                L{fraseElegida.linea}.{fraseElegida.frase} · la usan
              </p>
              {destino && (
                <button
                  type="button"
                  onClick={() => citarFrase(destino, fraseElegida.linea, fraseElegida.frase)}
                  className="mt-2 block w-full rounded border border-accent/50 px-2 py-1 text-left text-accent hover:bg-accent/5"
                  title="Une esta frase al elemento elegido como cita tuya. También puedes arrastrarla hasta un nodo o una relación."
                >
                  Citar en {nombreDestino}
                </button>
              )}
              {sinUsar.has(`${fraseElegida.linea}.${fraseElegida.frase}`) && (
                <ConvertirFrase
                  key={`${fraseElegida.linea}.${fraseElegida.frase}`}
                  situaciones={analisis.situaciones}
                  onConvertir={(tipo, situacionId) => {
                    const c = citaDeFrase(lineasNota, fraseElegida.linea, fraseElegida.frase);
                    if (!c) return;
                    // `aplicar` puede ejecutar la mutación más tarde (dentro de
                    // un setState): el id nuevo se averigua con un ensayo sobre
                    // una copia del estado actual, que es del que parte.
                    const nuevo = convertirFrase(structuredClone(analisis), c, tipo, situacionId);
                    aplicar((copia) => {
                      convertirFrase(copia, c, tipo, situacionId);
                    });
                    seleccionar(nuevo);
                  }}
                />
              )}
              {usan.length === 0 ? (
                <p className="mt-2 text-ink-muted">Ningún elemento del análisis cita esta frase.</p>
              ) : (
                <ul className="mt-2 space-y-1">
                  {usan.map((u, i) => (
                    <li key={i}>
                      <button type="button" onClick={() => seleccionar(u.id)} className="text-left text-ink hover:text-accent">
                        {u.texto}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </aside>
          )}
        </div>
      )}

      <div className="flex shrink-0 flex-wrap items-center gap-2 px-4 pb-3 text-xs text-ink-muted">
        <button type="button" onClick={descargar} className="rounded border border-accent bg-accent px-3 py-1 text-white hover:opacity-90">
          Descargar nota (.txt)
        </button>
        <button type="button" onClick={copiar} className="rounded border border-accent/60 px-3 py-1 text-accent hover:bg-accent/5">
          Copiar
        </button>
        {aviso && <span role="status" className="text-accent">{aviso}</span>}
        {nEditadas > 0 && (
          <>
            <span className="ml-auto">
              {nEditadas} frase{nEditadas > 1 ? "s" : ""} corregida{nEditadas > 1 ? "s" : ""} · solo en esta pantalla, sin llamar a la IA
            </span>
            <button
              type="button"
              onClick={() => {
                restaurarNota();
                if (editando) setInstantanea({});
              }}
              className="rounded border border-divider px-3 py-1 text-ink hover:border-accent"
            >
              Restaurar original
            </button>
          </>
        )}
      </div>
      {nEditadas > 0 && (
        <p role="note" className="mx-4 mb-3 rounded border border-warn/40 bg-warn/10 px-3 py-1.5 text-xs text-ink">
          ⚠ Si cambias el sentido de una frase
          {afectados > 0 && <> (hay {afectados} elemento{afectados > 1 ? "s" : ""} del mapa apoyado{afectados > 1 ? "s" : ""} en frases que corregiste)</>}
          , las cadenas pueden perder coherencia. Para cambios grandes se recomienda volver a analizar la sesión.
        </p>
      )}
    </section>
  );
}

/**
 * Una frase que nada usa, convertida en un elemento nuevo en el carril que
 * elijas. La conducta necesita su situación (o ninguna: queda sin situar, como
 * las conductas que el análisis no llegó a situar).
 */
function ConvertirFrase({
  situaciones,
  onConvertir,
}: {
  situaciones: readonly { id: string; nombre: string }[];
  onConvertir: (tipo: TipoDesdeFrase, situacionId: string | null) => void;
}) {
  const [tipo, setTipo] = useState<TipoDesdeFrase>("conducta");
  const [situacion, setSituacion] = useState<string>("");
  return (
    <div className="mt-3 space-y-1.5 rounded border border-dashed border-divider p-2">
      <p className="font-mono text-[10px] uppercase tracking-wide text-ink-muted">Convertir en</p>
      <select
        value={tipo}
        onChange={(e) => setTipo(e.target.value as TipoDesdeFrase)}
        aria-label="Tipo de elemento"
        className="w-full rounded border border-divider bg-surface px-1.5 py-1 text-ink"
      >
        {(Object.keys(ETIQUETA_TIPO_DESDE_FRASE) as TipoDesdeFrase[]).map((t) => (
          <option key={t} value={t}>
            {ETIQUETA_TIPO_DESDE_FRASE[t]}
          </option>
        ))}
      </select>
      {tipo === "conducta" && (
        <select
          value={situacion}
          onChange={(e) => setSituacion(e.target.value)}
          aria-label="Situación de la conducta"
          className="w-full rounded border border-divider bg-surface px-1.5 py-1 text-ink"
        >
          <option value="">Sin situación</option>
          {situaciones.map((s) => (
            <option key={s.id} value={s.id}>
              {s.nombre}
            </option>
          ))}
        </select>
      )}
      <button
        type="button"
        onClick={() => onConvertir(tipo, tipo === "conducta" && situacion ? situacion : null)}
        className="w-full rounded border border-accent/50 px-2 py-1 text-accent hover:bg-accent/5"
      >
        Crear con esta frase
      </button>
    </div>
  );
}
