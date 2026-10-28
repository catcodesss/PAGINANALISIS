"use client";

/**
 * El nivel Clínico del Mapa: cada situación contada como análisis en cadena
 * (DBT), de arriba abajo y en el orden en que ocurrió.
 *
 *   Vulnerabilidad → Evento desencadenante → Eslabones → Conducta problema → Consecuencias
 *
 * con un punto de solución al lado de cada paso. El nivel Situación ya cuenta
 * el ABC por columnas; aquí la misma situación se lee como secuencia, así que
 * cada paso solo se une al siguiente y no hace falta dibujar flechas que
 * crucen el tablero.
 *
 * Los pasos son los mismos nodos del Mapa (se seleccionan, editan y citan
 * igual). Los eslabones salen de `cadena_dbt`, que es opcional: si el análisis
 * se generó sin ella, la cadena se lee con el ABC y un aviso ofrece generarla.
 */

import { Fragment, useContext, useState, type ReactNode } from "react";
import type { AnalisisFuncional, CadenaDBT, Situacion, TipoEslabonDBT } from "@/lib/types";
import { ETIQUETA_ESQUEMA } from "@/lib/types";
import { IDS_TODOS } from "@/lib/bloques";
import type { NodoGrafo } from "@/lib/grafo";
import { ReanalisisContext } from "../informe/seccion";
import { cabecerasIA, nuevaOperacionId } from "@/lib/nube/llamadaIA";

const ETIQUETA_ESLABON: Record<TipoEslabonDBT, string> = {
  sensacion: "Sensación",
  emocion: "Emoción",
  pensamiento: "Pensamiento",
  impulso: "Impulso",
  accion: "Acción",
};

/** Color de cada etapa y de cada tipo de eslabón (la etiqueta lo dice también). */
const COLOR: Record<string, string> = {
  vulnerabilidad: "#5f9a82",
  desencadenante: "#a07a2c",
  conducta: "var(--color-accent)",
  consecuencia: "#8a6b47",
  sensacion: "#b4603a",
  emocion: "#9a4f73",
  pensamiento: "#43508a",
  impulso: "#a07a2c",
  accion: "var(--color-accent)",
};

const COSTE_CADENA = "1 crédito";

export function tieneCadenaDbt(analisis: AnalisisFuncional): boolean {
  return analisis.situaciones.some((s) => s.cadena_dbt !== null);
}

interface CadenaClinicaProps {
  analisis: AnalisisFuncional;
  nodos: readonly NodoGrafo[];
  renderNodo: (n: NodoGrafo) => ReactNode;
}

export default function CadenaClinica({ analisis, nodos, renderNodo }: CadenaClinicaProps) {
  const prevencion = analisis.capa_dbt.plan_de_prevencion;
  return (
    <div className="space-y-6">
      {!tieneCadenaDbt(analisis) && <GenerarCadenaDbt />}
      {analisis.situaciones.map((s) => (
        <CadenaSituacion
          key={s.id}
          analisis={analisis}
          situacion={s}
          nodos={nodos.filter((n) => n.situacion_id === s.id)}
          renderNodo={renderNodo}
        />
      ))}
      {prevencion.length > 0 && (
        <section className="rounded-lg border border-divider bg-surface p-4">
          <h4 className="font-mono text-[11px] uppercase tracking-wide text-ink-muted">Prevención · antes de que haya cadena</h4>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-ink">
            {prevencion.map((p, i) => <li key={i}>{p}</li>)}
          </ul>
        </section>
      )}
    </div>
  );
}

function CadenaSituacion({
  analisis,
  situacion,
  nodos,
  renderNodo,
}: {
  analisis: AnalisisFuncional;
  situacion: Situacion;
  nodos: readonly NodoGrafo[];
  renderNodo: (n: NodoGrafo) => ReactNode;
}) {
  const deTipo = (tipo: NodoGrafo["tipo"]) => nodos.filter((n) => n.tipo === tipo && !n.alternativa);
  const cadena: CadenaDBT | null = situacion.cadena_dbt;
  const operante = situacion.cadena_operante;
  const eslabones = deTipo("encubierta");
  const conductas = deTipo("conducta");
  const inmediata = nodos.find((n) => n.tipo === "consecuencia" && n.carril === "inmediata");
  const demorada = nodos.find((n) => n.tipo === "consecuencia" && n.carril === "demorada");
  const alternativas = nodos.filter((n) => n.alternativa);
  const soluciones = (id: string) => analisis.capa_dbt.analisis_de_soluciones.filter((x) => x.eslabon_id === id);
  const habilidades = (id: string) => analisis.capa_dbt.habilidades_sugeridas.filter((x) => x.eslabon_id === id);

  const conClave = (n: NodoGrafo) => <Fragment key={n.id}>{renderNodo(n)}</Fragment>;
  let numero = 0;
  const paso = (props: Omit<PasoProps, "numero">) => <Paso key={props.clave} numero={++numero} {...props} />;

  return (
    <section data-situacion-id={situacion.id} className="rounded-xl border border-divider bg-surface p-4 sm:p-5">
      <header className="mb-4">
        <h3 className="font-serif text-xl font-semibold text-ink">{situacion.nombre}</h3>
        {situacion.funcion_hipotetizada && (
          <p className="mt-1 text-sm text-ink-muted">
            <span className="font-medium text-ink">Función:</span> {situacion.funcion_hipotetizada}
          </p>
        )}
      </header>

      <div className="mb-1 hidden grid-cols-[2.25rem_minmax(0,1.4fr)_minmax(0,1fr)] gap-x-4 font-mono text-[11px] uppercase tracking-wide text-ink-muted md:grid">
        <span />
        <span>Cadena</span>
        <span>Punto de solución</span>
      </div>

      <ol className="list-none">
        {(deTipo("om").length > 0 || (cadena?.factores_vulnerabilidad.length ?? 0) > 0) &&
          paso({
            clave: "vulnerabilidad",
            etapa: "Vulnerabilidad",
            color: COLOR.vulnerabilidad,
            cadena: (
              <>
                {deTipo("om").map(conClave)}
                {cadena && cadena.factores_vulnerabilidad.length > 0 && (
                  <ul className="mt-2 flex flex-wrap gap-1.5">
                    {cadena.factores_vulnerabilidad.map((f, i) => (
                      <li key={i} className="rounded-md bg-canvas px-2 py-0.5 text-xs text-ink">{f}</li>
                    ))}
                  </ul>
                )}
              </>
            ),
          })}

        {(deTipo("ed").length > 0 || deTipo("ec").length > 0) &&
          paso({
            clave: "desencadenante",
            etapa: "Evento desencadenante",
            color: COLOR.desencadenante,
            cadena: (
              <div className="space-y-2">
                {deTipo("ed").map(conClave)}
                {deTipo("ec").map((n) => (
                  <div key={n.id}>
                    <p className="mb-1 font-mono text-[10px] uppercase tracking-wide text-ink-muted">Respondiente · EC → RC</p>
                    {renderNodo(n)}
                  </div>
                ))}
              </div>
            ),
          })}

        <Grupo>Eslabones</Grupo>
        {eslabones.length > 0 ? (
          eslabones.map((n) => {
            const tipo = (n.detalle ?? "pensamiento") as TipoEslabonDBT;
            return paso({
              clave: n.id,
              etapa: ETIQUETA_ESLABON[tipo] ?? "Eslabón",
              nota: tipo === "accion" ? undefined : "privado",
              color: COLOR[tipo] ?? COLOR.pensamiento,
              cadena: renderNodo(n),
              solucion:
                soluciones(n.id).length + habilidades(n.id).length > 0 ? (
                  <div className="space-y-2">
                    {soluciones(n.id).map((x) => (
                      <Solucion key={x.id} titulo={x.tipo_estrategia === "antecedente" ? "Antes del eslabón" : "Cuando ya ocurre"}>
                        {x.alternativa_habil}
                      </Solucion>
                    ))}
                    {habilidades(n.id).map((h, i) => (
                      <Solucion key={i} titulo={`Habilidad · ${h.modulo.replace(/_/g, " ")}`}>{h.habilidad}</Solucion>
                    ))}
                  </div>
                ) : undefined,
            });
          })
        ) : (
          <li className="grid grid-cols-[2.25rem_minmax(0,1fr)] gap-x-4">
            <Riel color="#b8ad9e" texto="?" />
            <div className="mb-3 rounded-lg border border-dashed border-divider bg-canvas px-3 py-2.5 text-sm text-ink-muted">
              <span className="font-medium text-ink">Faltan eslabones.</span>{" "}
              {cadena
                ? "La nota no cuenta qué pensó o sintió entre el desencadenante y la conducta. Pregúntalo en la próxima sesión."
                : "Esta situación no tiene cadena DBT."}
            </div>
          </li>
        )}

        <Grupo>Conducta problema</Grupo>
        {conductas.map((n) =>
          paso({
            clave: n.id,
            etapa: "Conducta problema",
            color: COLOR.conducta,
            destacado: true,
            cadena: (
              <>
                {renderNodo(n)}
                {operante && (
                  <p className="mt-1.5 flex flex-wrap gap-1.5 text-xs text-ink-muted">
                    <span className="rounded-md bg-canvas px-2 py-0.5">{ETIQUETA_ESQUEMA[operante.esquema_de_contingencia]}</span>
                    <span className="rounded-md bg-canvas px-2 py-0.5">{operante.inmediatez}</span>
                  </p>
                )}
              </>
            ),
            solucion: alternativas.length > 0 ? <div className="space-y-2">{alternativas.map(conClave)}</div> : undefined,
          })
        )}

        {(inmediata || demorada) && <Grupo>Consecuencias</Grupo>}
        {inmediata &&
          paso({ clave: inmediata.id, etapa: "A corto plazo", color: COLOR.consecuencia, cadena: renderNodo(inmediata) })}
        {demorada &&
          paso({ clave: demorada.id, etapa: "A largo plazo", color: COLOR.consecuencia, cadena: renderNodo(demorada) })}
      </ol>
    </section>
  );
}

interface PasoProps {
  clave: string;
  numero: number;
  etapa: string;
  nota?: string;
  color: string;
  cadena: ReactNode;
  solucion?: ReactNode;
  destacado?: boolean;
}

function Paso({ numero, etapa, nota, color, cadena, solucion, destacado }: PasoProps) {
  return (
    <li className="grid grid-cols-[2.25rem_minmax(0,1fr)] gap-x-4 md:grid-cols-[2.25rem_minmax(0,1.4fr)_minmax(0,1fr)]">
      <Riel color={color} texto={String(numero)} lleno={destacado} />
      <div className={`mb-3 min-w-0 rounded-lg ${destacado ? "border-2 bg-accent/5 p-2" : ""}`} style={destacado ? { borderColor: color } : undefined}>
        <p className="mb-1 text-xs font-semibold uppercase tracking-wide" style={{ color }}>
          {etapa}
          {nota && <span className="ml-2 font-normal normal-case tracking-normal text-ink-muted">{nota}</span>}
        </p>
        {cadena}
      </div>
      <div className="col-start-2 mb-3 min-w-0 md:col-start-auto">{solucion}</div>
    </li>
  );
}

/** La línea vertical que une los pasos, con el número de cada uno. */
function Riel({ color, texto, lleno }: { color: string; texto: string; lleno?: boolean }) {
  return (
    <div className="relative flex justify-center" aria-hidden="true">
      <span className="absolute inset-y-0 w-0.5 bg-divider" />
      <span
        className="relative mt-1 grid h-7 w-7 place-items-center rounded-full border-2 bg-surface text-xs font-bold"
        style={lleno ? { borderColor: color, background: color, color: "white" } : { borderColor: color, color }}
      >
        {texto}
      </span>
    </div>
  );
}

function Grupo({ children }: { children: ReactNode }) {
  return (
    <li className="grid grid-cols-[2.25rem_minmax(0,1fr)] gap-x-4">
      <div className="relative flex justify-center" aria-hidden="true">
        <span className="absolute inset-y-0 w-0.5 bg-divider" />
      </div>
      <p className="mb-2 mt-1 font-mono text-[11px] uppercase tracking-wide text-ink-muted">{children}</p>
    </li>
  );
}

function Solucion({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-[#43508a]/40 bg-[#43508a]/5 px-3 py-2 text-sm text-ink">
      <p className="mb-0.5 text-[11px] font-semibold uppercase tracking-wide text-[#43508a]">{titulo}</p>
      {children}
    </div>
  );
}

/**
 * Aviso para un análisis generado sin la cadena: la genera sobre la nota
 * guardada en el caso (no hay que volver a pegarla) y la añade a cada
 * situación sin tocar nada más.
 */
function GenerarCadenaDbt() {
  const contexto = useContext(ReanalisisContext);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!contexto) return null;
  const { notaOriginal, analisis, onAnalisisActualizado } = contexto;

  async function generar() {
    setEnviando(true);
    setError(null);
    try {
      const respuesta = await fetch("/api/cadena-dbt", {
        method: "POST",
        headers: await cabecerasIA(),
        body: JSON.stringify({
          notaOriginal,
          situaciones: analisis.situaciones,
          operacion_id: nuevaOperacionId(),
        }),
      });
      const datos = await respuesta.json().catch(() => null);
      if (!respuesta.ok || !Array.isArray(datos?.cadenas)) {
        setError(datos?.message ?? "No se pudo generar la cadena DBT. Intenta nuevamente.");
        return;
      }
      const cadenas = datos.cadenas as (CadenaDBT | null)[];
      const generados = analisis.campos_generados.includes("dbt")
        ? analisis.campos_generados
        : [...analisis.campos_generados, "dbt"];
      onAnalisisActualizado({
        situaciones: analisis.situaciones.map((s, i) => (cadenas[i] ? { ...s, cadena_dbt: cadenas[i] } : s)),
        capa_dbt: datos.capa_dbt,
        campos_generados: IDS_TODOS.every((id) => generados.includes(id)) ? [] : generados,
      });
    } catch {
      setError("No se pudo generar la cadena DBT. Intenta nuevamente.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <section className="rounded-xl border-2 border-dashed border-divider bg-surface p-6 text-center">
      <h3 className="font-serif text-lg font-semibold text-ink">Este análisis no incluye la cadena DBT</h3>
      <p className="mx-auto mt-1 max-w-lg text-sm text-ink-muted">
        Puedes generarla ahora a partir de la nota guardada en el caso, sin volver a pegarla. Se añade a cada
        situación; el resto del informe no cambia.
      </p>
      <button
        type="button"
        onClick={generar}
        disabled={enviando}
        className="mt-4 rounded-lg bg-accent px-5 py-2 text-sm font-semibold texto-sobre-acento transition-colors hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {enviando ? "Generando la cadena…" : `Generar cadena DBT · ${COSTE_CADENA}`}
      </button>
      {error && <p role="alert" className="mt-2 text-xs text-warn">{error}</p>}
    </section>
  );
}
