"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type {
  AnalisisFuncional,
  CadenaDBT,
  CadenaOperante,
  CadenaRespondiente,
  Cita as CitaVerificada,
  ModeloTerapeutico,
  NivelConfianza,
  Situacion,
} from "@/lib/types";
import {
  contieneDatosIdentificables,
  enmascararDatosIdentificables,
} from "@/lib/pii";

interface ReportViewProps {
  analisis: AnalisisFuncional;
  referenciaCaso: string;
  onReferenciaCasoChange: (valor: string) => void;
  fecha: string;
  notaOriginal: string;
  onAnalisisActualizado: (fragmento: Partial<AnalisisFuncional>) => void;
}

interface SeccionIndice {
  id: string;
  titulo: string;
}

const ETIQUETA_MODELO: Record<ModeloTerapeutico, string> = {
  act: "ACT",
  dbt: "DBT",
  mc: "Conductual (MC)",
};

/**
 * Qué campo de AnalisisFuncional corresponde a la capa de cada modalidad.
 * Tipado como Record<ModeloTerapeutico, keyof AnalisisFuncional> para que el
 * compilador avise si algún nombre de campo cambia, en vez de construirlo
 * con un template literal + "as" que no se vuelve a chequear.
 */
const CAMPO_CAPA_POR_MODELO: Record<ModeloTerapeutico, keyof AnalisisFuncional> = {
  act: "capa_act",
  dbt: "capa_dbt",
  mc: "capa_mc",
};

const SECCIONES: SeccionIndice[] = [
  { id: "datos-faltantes", titulo: "Datos faltantes" },
  { id: "alertas", titulo: "Revisiones sugeridas" },
  { id: "hipotesis-principal", titulo: "Formulación destacada" },
  { id: "resumen", titulo: "Resumen clínico" },
  { id: "conductas", titulo: "Conductas problema" },
  { id: "variables-moduladoras", titulo: "Variables moduladoras" },
  { id: "situaciones", titulo: "Análisis por situaciones" },
  { id: "hipotesis-mantenimiento", titulo: "Hipótesis de mantenimiento" },
  { id: "formulacion", titulo: "Formulación del caso" },
  { id: "conductas-alternativas", titulo: "Conductas alternativas" },
  { id: "modalidad", titulo: "Detalle según modelo terapéutico" },
  { id: "hipotesis-alternativas", titulo: "Hipótesis alternativas" },
  { id: "preguntas", titulo: "Preguntas para la próxima sesión" },
  { id: "intervencion", titulo: "Líneas de intervención" },
];

function SinHallazgos() {
  return (
    <p className="text-sm text-ink-muted">Sin hallazgos suficientes en la nota.</p>
  );
}

/** Chip de clasificación técnica: informativo, discreto. */
function Chip({ children }: { children: ReactNode }) {
  return (
    <span className="clasificacion-chip inline-block whitespace-nowrap rounded border border-accent/40 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide text-accent">
      {children}
    </span>
  );
}

/** Chip destacado: función hipotetizada o estado que es una conclusión. */
function ChipDestacado({ children }: { children: ReactNode }) {
  return (
    <span className="funcion-chip inline-block whitespace-nowrap rounded bg-accent px-2.5 py-1 font-mono text-[10px] uppercase tracking-wide text-white">
      {children}
    </span>
  );
}

function colorConfianza(nivel: string): string {
  if (nivel === "alta") return "bg-accent";
  if (nivel === "media") return "bg-warn";
  return "bg-ink-muted/50";
}

const EXPLICACION_CONFIANZA: Record<string, string> = {
  alta: "Alta: la evidencia está explícita y clara en la nota.",
  media: "Media: hay evidencia parcial, o se infiere con relativa seguridad.",
  baja: "Baja: la evidencia es escasa; se apoya principalmente en inferencia clínica.",
};

function Confianza({ nivel }: { nivel: NivelConfianza | string }) {
  return (
    <span
      title={EXPLICACION_CONFIANZA[nivel] ?? undefined}
      className="conf-chip inline-flex cursor-help items-center gap-1.5 font-mono text-[11px] uppercase tracking-wide text-ink-muted"
    >
      <span
        aria-hidden="true"
        className={`conf-dot h-1.5 w-1.5 rounded-full ${colorConfianza(nivel)}`}
      />
      Confianza: {nivel}
    </span>
  );
}

/** Cita textual de la nota original, distinguida como bloque. */
/**
 * Solo se muestra entre comillas bajo el rótulo "De la nota" el texto que el
 * servidor recortó de la propia nota (ver lib/citas.ts). Si la cita no se pudo
 * verificar, se dice explícitamente que es una inferencia: nunca se presenta
 * como textual algo que el modelo redactó.
 */
function Cita({ children }: { children: CitaVerificada | null | undefined }) {
  if (!children) return null;

  if (!children.verificada) {
    return (
      <p className="evidence-prefix mt-2 font-mono text-[10px] uppercase tracking-wide text-ink-muted/70">
        Inferido — sin cita literal en la nota
      </p>
    );
  }

  const rango =
    children.linea_inicio === children.linea_fin
      ? `línea ${children.linea_inicio}`
      : `líneas ${children.linea_inicio}–${children.linea_fin}`;

  return (
    <blockquote className="evidence-block mt-2 border-l-2 border-divider pl-3">
      <p className="evidence-prefix font-mono text-[10px] uppercase tracking-wide text-ink-muted/70">
        De la nota · {rango}
      </p>
      <p className="evidence-text text-sm italic leading-relaxed text-ink-muted">
        &quot;{children.texto}&quot;
      </p>
    </blockquote>
  );
}

interface ReanalisisContextValor {
  notaOriginal: string;
  analisis: AnalisisFuncional;
  onAnalisisActualizado: (fragmento: Partial<AnalisisFuncional>) => void;
}

const ReanalisisContext = createContext<ReanalisisContextValor | null>(null);

/** Botón + cuadro de texto para agregar una nota y reanalizar solo esta sección. */
function BloqueReanalisis({
  campos,
  seccionId,
}: {
  campos: (keyof AnalisisFuncional)[];
  seccionId: string;
}) {
  const contexto = useContext(ReanalisisContext);
  const [abierto, setAbierto] = useState(false);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!contexto) return null;
  const { notaOriginal, analisis, onAnalisisActualizado } = contexto;

  const contieneDatos = texto.trim().length > 0 && contieneDatosIdentificables(texto);

  async function reanalizar() {
    if (!texto.trim() || enviando) return;
    setEnviando(true);
    setError(null);

    const notaAdicional = contieneDatosIdentificables(texto)
      ? enmascararDatosIdentificables(texto)
      : texto;

    try {
      const respuesta = await fetch("/api/reanalizar-seccion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notaOriginal,
          notaAdicional,
          campos,
          analisisActual: analisis,
        }),
      });

      const datos = await respuesta.json().catch(() => null);

      if (!respuesta.ok || !datos?.fragmento) {
        setError(
          datos?.message ?? "No se pudo reanalizar esta sección. Intenta nuevamente."
        );
        return;
      }

      onAnalisisActualizado(datos.fragmento as Partial<AnalisisFuncional>);
      setTexto("");
      setAbierto(false);
    } catch {
      setError("No se pudo reanalizar esta sección. Intenta nuevamente.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="mt-4 border-t border-divider pt-3 print:hidden">
      {!abierto ? (
        <button
          type="button"
          onClick={() => setAbierto(true)}
          className="text-sm font-medium text-accent transition-colors hover:text-accent/80"
        >
          + Agregar nota y reanalizar esta sección
        </button>
      ) : (
        <div className="space-y-2">
          <label
            htmlFor={`nota-reanalisis-${seccionId}`}
            className="block text-xs font-medium text-ink-muted"
          >
            Nota adicional para esta sección
          </label>
          <textarea
            id={`nota-reanalisis-${seccionId}`}
            value={texto}
            onChange={(evento) => setTexto(evento.target.value)}
            disabled={enviando}
            rows={3}
            placeholder="Agrega información nueva u observaciones para esta sección…"
            className="w-full resize-y rounded border border-divider bg-white px-2.5 py-1.5 text-sm text-ink placeholder:text-ink-muted/70 focus-visible:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30 disabled:cursor-not-allowed disabled:opacity-60"
          />
          {contieneDatos && (
            <p className="text-xs text-warn">
              Se detectaron posibles datos identificables; se enmascararán
              automáticamente antes de enviarse.
            </p>
          )}
          {error && (
            <p role="alert" className="text-xs text-warn">
              {error}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={reanalizar}
              disabled={enviando || !texto.trim()}
              className="rounded bg-accent px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {enviando ? "Reanalizando…" : "Reanalizar esta sección"}
            </button>
            <button
              type="button"
              onClick={() => {
                setAbierto(false);
                setTexto("");
                setError(null);
              }}
              disabled={enviando}
              className="rounded border border-divider px-3 py-1.5 text-xs font-medium text-ink transition-colors hover:bg-canvas disabled:cursor-not-allowed disabled:opacity-50"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Seccion({
  id,
  titulo,
  extra,
  children,
  camposReanalisis,
}: {
  id: string;
  titulo: string;
  extra?: ReactNode;
  children: ReactNode;
  camposReanalisis?: (keyof AnalisisFuncional)[];
}) {
  return (
    <section
      id={id}
      className="scroll-mt-24 border-b border-divider py-6 last:border-b-0"
    >
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="section-title flex items-center gap-3 font-serif text-lg font-semibold text-ink sm:text-xl">
          <span aria-hidden="true" className="h-5 w-1 rounded-full bg-accent" />
          {titulo}
        </h2>
        {extra}
      </div>
      {children}
      {camposReanalisis && (
        <BloqueReanalisis campos={camposReanalisis} seccionId={id} />
      )}
    </section>
  );
}

function SubSeccion({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div>
      <h3 className="mb-2 font-mono text-xs uppercase tracking-wide text-ink-muted">
        {titulo}
      </h3>
      {children}
    </div>
  );
}

/** Una caja de la cadena visual (antecedente / respuesta / consecuencia / estímulo). */
interface FilaCadena {
  elemento: string;
  valor: string;
}

/** Tabla de dos columnas (Elemento / Análisis) para una cadena de contingencia. */
function TablaCadena({ filas }: { filas: FilaCadena[] }) {
  return (
    <div className="w-full overflow-x-auto">
      <table className="chain-table w-full border-collapse text-sm">
        <tbody>
          {filas.map((f, i) => (
            <tr
              key={i}
              className="border-b border-divider last:border-b-0 print:border-black"
            >
              <td className="el-label w-[110px] py-3 pr-4 align-top font-mono text-xs font-bold text-ink">
                {f.elemento}
              </td>
              <td className="py-3 align-top leading-relaxed text-ink">
                {f.valor}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Notación de flechas de la cadena: fórmula en código + paráfrasis en lenguaje natural. */
function NotacionCadena({ formula, natural }: { formula: string; natural: string }) {
  return (
    <div className="chain-arrow-block mt-3">
      <p className="chain-formula font-mono text-sm font-bold text-ink">{formula}</p>
      <p className="chain-natural mt-1 text-sm italic leading-relaxed text-ink-muted">
        {natural}
      </p>
    </div>
  );
}

const CODIGO_CONTINGENCIA: Record<string, string> = {
  "refuerzo positivo": "R+",
  "refuerzo negativo": "R−",
  "castigo positivo": "C+",
  "castigo negativo": "C−",
  extincion: "Ext.",
};

function CadenaOperanteView({ cadena }: { cadena: CadenaOperante }) {
  const codigo = CODIGO_CONTINGENCIA[cadena.tipo_contingencia] ?? "?";
  const filas: FilaCadena[] = [{ elemento: "ED", valor: cadena.antecedente }];
  if (cadena.operacion_motivacional) {
    filas.push({ elemento: "OM", valor: cadena.operacion_motivacional });
  }
  filas.push({ elemento: "RO", valor: cadena.respuesta });
  filas.push({ elemento: "C", valor: cadena.consecuencia });
  filas.push({
    elemento: "Consecuencia",
    valor: `${codigo} (${cadena.tipo_contingencia}, ${cadena.inmediatez})`,
  });
  if (cadena.consecuencias_largo_plazo) {
    filas.push({ elemento: "CMLP", valor: cadena.consecuencias_largo_plazo });
  }

  return (
    <div>
      <p className="mb-2 font-serif text-[15px] font-bold text-ink">
        Cadena operante (CO)
      </p>
      <TablaCadena filas={filas} />
      <NotacionCadena
        formula={`ED → RO → ${codigo}`}
        natural={`${cadena.antecedente} → ${cadena.respuesta} → ${cadena.consecuencia}`}
      />
      <Cita>{cadena.evidencia}</Cita>
    </div>
  );
}

function CadenaRespondienteView({ cadena }: { cadena: CadenaRespondiente }) {
  return (
    <div>
      <p className="mb-2 font-serif text-[15px] font-bold text-ink">
        Cadena respondiente (CC)
      </p>
      <TablaCadena
        filas={[
          { elemento: "EC", valor: cadena.estimulo },
          { elemento: "RC", valor: cadena.respuesta_condicionada },
        ]}
      />
      <NotacionCadena
        formula="EC → RC"
        natural={`${cadena.estimulo} → ${cadena.respuesta_condicionada}`}
      />
      <Cita>{cadena.evidencia}</Cita>
    </div>
  );
}

/** Cadena de eslabones DBT: misma situación que cadena_operante, conceptualizada con vocabulario DBT. */
function CadenaDBTView({ cadena }: { cadena: CadenaDBT }) {
  const filas: FilaCadena[] = [
    { elemento: "Precipitante", valor: cadena.evento_precipitante },
    ...cadena.eslabones.map((e, i) => ({
      elemento: `Eslabón ${i + 1}`,
      valor: `[${e.tipo}] ${e.descripcion}`,
    })),
    { elemento: "Conducta", valor: cadena.conducta_problema },
    { elemento: "Consecuencias", valor: cadena.consecuencias },
  ];

  return (
    <div>
      <p className="mb-2 font-serif text-[15px] font-bold text-ink">
        Cadena de eslabones (DBT)
      </p>
      {cadena.factores_vulnerabilidad.length > 0 && (
        <div className="mb-3">
          <p className="mb-1 font-mono text-[10px] uppercase tracking-wide text-ink-muted">
            Factores de vulnerabilidad
          </p>
          <ul className="list-disc space-y-1 pl-5">
            {cadena.factores_vulnerabilidad.map((v, i) => (
              <li key={i} className="text-sm text-ink">
                {v}
              </li>
            ))}
          </ul>
        </div>
      )}
      <TablaCadena filas={filas} />
      <NotacionCadena
        formula="Precipitante → Eslabones → Conducta → Consecuencias"
        natural={`${cadena.evento_precipitante} → ${cadena.conducta_problema} → ${cadena.consecuencias}`}
      />
      <Cita>{cadena.evidencia}</Cita>
    </div>
  );
}

function CicloInterconductual({ texto }: { texto: string }) {
  return (
    <div
      className="cycle-box mt-4 rounded-md border border-divider p-4"
      style={{ backgroundColor: "#FAFAF8" }}
    >
      <p className="cycle-label font-mono text-[10px] uppercase tracking-wide text-ink-muted">
        Ciclo interconductual
      </p>
      <p className="mt-2 text-sm leading-relaxed text-ink">{texto}</p>
      <p className="mt-2 text-sm italic text-ink-muted">
        Ambas conductas se refuerzan mutuamente, sosteniendo el patrón.
      </p>
    </div>
  );
}

/** Detalle específico del modelo terapéutico: colapsado por defecto para que el informe se lea rápido. */
function DetalleModalidad({ children }: { children: ReactNode }) {
  const [abierto, setAbierto] = useState(false);
  return (
    <div>
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        aria-expanded={abierto}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-accent transition-colors hover:text-accent/80 print:hidden"
      >
        {abierto
          ? "Ocultar detalles del modelo terapéutico"
          : "Mostrar más detalles según el modelo terapéutico"}
        <span aria-hidden="true" className="text-xs">
          {abierto ? "▲" : "▼"}
        </span>
      </button>
      <div className={`mt-4 ${abierto ? "block" : "hidden print:block"}`}>
        {children}
      </div>
    </div>
  );
}

/** Reglas verbales + procesos de inflexibilidad (capa ACT). */
function DetalleACT({ capa }: { capa: AnalisisFuncional["capa_act"] }) {
  return (
    <div className="space-y-6">
      <SubSeccion titulo="Reglas verbales">
        {capa.reglas_verbales.length === 0 ? (
          <SinHallazgos />
        ) : (
          <ul className="space-y-4">
            {capa.reglas_verbales.map((r, i) => (
              <li key={i}>
                <div className="flex flex-wrap items-center gap-2">
                  <Chip>{r.clase}</Chip>
                  <Chip>{r.textual_o_inferida}</Chip>
                  <span className="font-mono text-[11px] uppercase tracking-wide text-ink-muted">
                    Rigidez: {r.rigidez}
                  </span>
                </div>
                <p className="mt-1 text-[15px] italic leading-relaxed text-ink">
                  &quot;{r.regla}&quot;
                </p>
                <p className="mt-1 text-sm text-ink-muted">{r.analisis}</p>
              </li>
            ))}
          </ul>
        )}
      </SubSeccion>
      <SubSeccion titulo="Procesos de inflexibilidad">
        {capa.procesos_act.length === 0 ? (
          <SinHallazgos />
        ) : (
          <ul className="space-y-4">
            {capa.procesos_act.map((p, i) => (
              <li key={i}>
                <Chip>{p.proceso}</Chip>
                <p className="mt-1 text-[15px] leading-relaxed text-ink">
                  {p.vinculo_con_cadena}
                </p>
                <Cita>{p.evidencia}</Cita>
              </li>
            ))}
          </ul>
        )}
      </SubSeccion>
    </div>
  );
}

/** Análisis en cadena + habilidades sugeridas (capa DBT). */
function DetalleDBT({ capa }: { capa: AnalisisFuncional["capa_dbt"] }) {
  const cadena = capa.analisis_en_cadena;
  return (
    <div className="space-y-6">
      <SubSeccion titulo="Análisis en cadena">
        <div className="rounded border border-divider p-4">
          <p className="font-mono text-xs uppercase tracking-wide text-ink-muted">
            Conducta objetivo
          </p>
          <p className="mt-1 text-[15px] leading-relaxed text-ink">
            {cadena.conducta_objetivo || "—"}
          </p>

          <ol className="mt-4 space-y-3 border-l-2 border-divider pl-4">
            <li>
              <p className="font-mono text-[10px] uppercase tracking-wide text-ink-muted">
                Vulnerabilidades
              </p>
              {cadena.vulnerabilidades.length === 0 ? (
                <SinHallazgos />
              ) : (
                <ul className="list-disc space-y-1 pl-5">
                  {cadena.vulnerabilidades.map((v, i) => (
                    <li key={i} className="text-sm text-ink">
                      {v}
                    </li>
                  ))}
                </ul>
              )}
            </li>
            <li>
              <p className="font-mono text-[10px] uppercase tracking-wide text-ink-muted">
                Evento precipitante
              </p>
              <p className="text-sm text-ink">
                {cadena.evento_precipitante || "—"}
              </p>
            </li>
            {cadena.eslabones.map((e, i) => (
              <li key={i}>
                <Chip>{e.tipo}</Chip>
                <p className="mt-1 text-sm text-ink">{e.descripcion}</p>
              </li>
            ))}
          </ol>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-wide text-ink-muted">
                Consecuencias corto plazo
              </p>
              <ul className="mt-1 list-disc space-y-1 pl-5">
                {cadena.consecuencias_corto_plazo.map((c, i) => (
                  <li key={i} className="text-sm text-ink">
                    {c}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="font-mono text-[10px] uppercase tracking-wide text-ink-muted">
                Consecuencias largo plazo
              </p>
              <ul className="mt-1 list-disc space-y-1 pl-5">
                {cadena.consecuencias_largo_plazo.map((c, i) => (
                  <li key={i} className="text-sm text-ink">
                    {c}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </SubSeccion>

      <SubSeccion titulo="Habilidades sugeridas">
        {capa.habilidades_sugeridas.length === 0 ? (
          <SinHallazgos />
        ) : (
          <ul className="space-y-4">
            {capa.habilidades_sugeridas.map((h, i) => (
              <li key={i}>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-[15px] font-medium leading-relaxed text-ink">
                    {h.habilidad}
                  </p>
                  <Chip>{h.modulo.replace(/_/g, " ")}</Chip>
                </div>
                <p className="mt-1 text-sm text-ink-muted">
                  <span className="font-medium text-ink">
                    Eslabón objetivo:
                  </span>{" "}
                  {h.eslabon_objetivo}
                </p>
              </li>
            ))}
          </ul>
        )}
      </SubSeccion>
    </div>
  );
}

/** Procedimientos sugeridos de manejo de contingencias (capa Conductual/MC). */
function DetalleMC({ capa }: { capa: AnalisisFuncional["capa_mc"] }) {
  if (capa.procedimientos_sugeridos.length === 0) return <SinHallazgos />;
  return (
    <ul className="space-y-4">
      {capa.procedimientos_sugeridos.map((p, i) => (
        <li key={i} className="rounded border border-divider p-4">
          <p className="text-[15px] font-medium leading-relaxed text-ink">
            {p.procedimiento}
          </p>
          <p className="mt-1 text-sm text-ink-muted">
            <span className="font-medium text-ink">
              Contingencia objetivo:
            </span>{" "}
            {p.contingencia_objetivo}
          </p>
          <p className="mt-1 text-sm text-warn">
            <span className="font-medium">Precauciones:</span>{" "}
            {p.precauciones}
          </p>
        </li>
      ))}
    </ul>
  );
}

const MODELOS: ModeloTerapeutico[] = ["act", "dbt", "mc"];

/**
 * Botones de pestaña reutilizables: se usan tanto arriba de "Análisis por
 * situaciones" (donde cambian qué cadena se ve) como en "Detalle según
 * modelo terapéutico" (donde cambian qué capa se ve), ambos ligados al mismo
 * estado para que no se desincronicen.
 */
function BotonesModalidad({
  activa,
  onChange,
}: {
  activa: ModeloTerapeutico;
  onChange: (m: ModeloTerapeutico) => void;
}) {
  return (
    <div className="flex w-full overflow-hidden rounded border border-divider print:hidden sm:inline-flex sm:w-auto">
      {MODELOS.map((m) => (
        <button
          key={m}
          type="button"
          onClick={() => onChange(m)}
          aria-pressed={activa === m}
          className={`flex-1 px-4 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 sm:flex-none ${
            activa === m
              ? "bg-accent text-white"
              : "bg-surface text-ink-muted hover:bg-canvas"
          }`}
        >
          {ETIQUETA_MODELO[m]}
        </button>
      ))}
    </div>
  );
}

/** Detalle de capa según la pestaña activa; en impresión no hay pestañas interactivas, así que se listan las tres. */
function SelectorCapaModalidad({
  analisis,
  pestanaActiva,
  onCambiarPestana,
}: {
  analisis: AnalisisFuncional;
  pestanaActiva: ModeloTerapeutico;
  onCambiarPestana: (m: ModeloTerapeutico) => void;
}) {
  return (
    <div>
      <div className="mb-4">
        <BotonesModalidad activa={pestanaActiva} onChange={onCambiarPestana} />
      </div>

      <div className="print:hidden">
        {pestanaActiva === "act" && <DetalleACT capa={analisis.capa_act} />}
        {pestanaActiva === "dbt" && <DetalleDBT capa={analisis.capa_dbt} />}
        {pestanaActiva === "mc" && <DetalleMC capa={analisis.capa_mc} />}
      </div>

      {/* Impresión: no hay pestañas interactivas en papel, así que se listan las tres. */}
      <div className="hidden space-y-8 print:block">
        <div>
          <p className="section-title mb-3 font-serif text-base font-semibold text-ink">
            ACT
          </p>
          <DetalleACT capa={analisis.capa_act} />
        </div>
        <div>
          <p className="section-title mb-3 font-serif text-base font-semibold text-ink">
            DBT
          </p>
          <DetalleDBT capa={analisis.capa_dbt} />
        </div>
        <div>
          <p className="section-title mb-3 font-serif text-base font-semibold text-ink">
            Conductual (MC)
          </p>
          <DetalleMC capa={analisis.capa_mc} />
        </div>
      </div>
    </div>
  );
}

function SituacionCard({
  situacion,
  pestanaActiva,
}: {
  situacion: Situacion;
  pestanaActiva: ModeloTerapeutico;
}) {
  const tieneAmbas = Boolean(
    situacion.cadena_respondiente &&
      (situacion.cadena_operante || situacion.cadena_dbt)
  );

  return (
    <div className="sit-card rounded-md border border-divider p-5 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-3 font-serif text-base font-semibold text-ink sm:text-lg">
          <span aria-hidden="true" className="h-4 w-1 rounded-full bg-accent" />
          {situacion.nombre}
        </h3>
        <Confianza nivel={situacion.confianza} />
      </div>

      {tieneAmbas && (
        <p className="mb-4 text-sm italic text-ink-muted">
          En esta situación aparecen dos procesos simultáneos.
        </p>
      )}

      <div className="space-y-4">
        {situacion.cadena_respondiente && (
          <CadenaRespondienteView cadena={situacion.cadena_respondiente} />
        )}

        {tieneAmbas && situacion.cadena_respondiente?.conexion_con_operante && (
          <p className="text-sm italic text-ink-muted">Posteriormente</p>
        )}

        {/* En pantalla se muestra solo la cadena de la pestaña activa; en impresión, ambas (no hay pestañas en papel). */}
        {situacion.cadena_operante && (
          <div className={pestanaActiva === "dbt" ? "hidden print:block" : "block"}>
            <CadenaOperanteView cadena={situacion.cadena_operante} />
          </div>
        )}

        {situacion.cadena_dbt && (
          <div className={pestanaActiva === "dbt" ? "block" : "hidden print:block"}>
            <CadenaDBTView cadena={situacion.cadena_dbt} />
          </div>
        )}

        {!situacion.cadena_operante &&
          !situacion.cadena_respondiente &&
          !situacion.cadena_dbt && <SinHallazgos />}
      </div>

      {situacion.ciclo_interconductual && (
        <CicloInterconductual texto={situacion.ciclo_interconductual} />
      )}

      {situacion.funcion_hipotetizada && (
        <p className="mt-4 text-sm text-ink-muted">
          <span className="font-medium text-ink">Función hipotetizada:</span>{" "}
          {situacion.funcion_hipotetizada}
        </p>
      )}
    </div>
  );
}

function useSeccionActiva(ids: string[]) {
  const [activa, setActiva] = useState<string>(ids[0] ?? "");

  useEffect(() => {
    const elementos = ids
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el !== null);

    if (elementos.length === 0) return;

    const observer = new IntersectionObserver(
      (entradas) => {
        const visibles = entradas
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visibles.length > 0) {
          setActiva(visibles[0].target.id);
        }
      },
      { rootMargin: "-96px 0px -70% 0px", threshold: 0 }
    );

    elementos.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [ids]);

  return activa;
}

function IndiceLateral({
  secciones,
  activa,
}: {
  secciones: SeccionIndice[];
  activa: string;
}) {
  return (
    <nav
      aria-label="Índice del informe"
      className="hidden shrink-0 print:hidden lg:sticky lg:top-24 lg:block lg:h-fit lg:w-[210px]"
    >
      <ul className="space-y-3.5 text-sm">
        {secciones.map(({ id, titulo }) => (
          <li key={id}>
            <a
              href={`#${id}`}
              aria-current={activa === id ? "true" : undefined}
              className={`block border-l-2 py-0.5 pl-3 transition-colors ${
                activa === id
                  ? "border-accent font-semibold text-accent"
                  : "border-divider text-ink-muted hover:border-ink-muted hover:text-ink"
              }`}
            >
              {titulo}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function IndiceMovil({
  secciones,
  activa,
}: {
  secciones: SeccionIndice[];
  activa: string;
}) {
  const [abierto, setAbierto] = useState(false);
  const contenedorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function manejarClickFuera(evento: MouseEvent) {
      if (
        contenedorRef.current &&
        !contenedorRef.current.contains(evento.target as Node)
      ) {
        setAbierto(false);
      }
    }
    document.addEventListener("mousedown", manejarClickFuera);
    return () => document.removeEventListener("mousedown", manejarClickFuera);
  }, []);

  const tituloActivo =
    secciones.find((s) => s.id === activa)?.titulo ?? "Ir a…";

  return (
    <div ref={contenedorRef} className="relative mb-4 print:hidden lg:hidden">
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        aria-expanded={abierto}
        className="flex w-full items-center justify-between rounded border border-divider bg-surface px-3 py-2 text-sm text-ink"
      >
        <span>
          Ir a: <span className="text-ink-muted">{tituloActivo}</span>
        </span>
        <span aria-hidden="true" className="text-ink-muted">
          {abierto ? "▲" : "▼"}
        </span>
      </button>
      {abierto && (
        <ul className="absolute z-10 mt-1 w-full rounded border border-divider bg-surface py-1 shadow-md">
          {secciones.map(({ id, titulo }) => (
            <li key={id}>
              <a
                href={`#${id}`}
                onClick={() => setAbierto(false)}
                className={`block px-3 py-2 text-sm ${
                  activa === id ? "font-medium text-accent" : "text-ink"
                }`}
              >
                {titulo}
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Encabezado de expediente clínico, visible solo al imprimir/exportar a PDF. */
function PrintOnlyHeader({
  referenciaCaso,
  fecha,
}: {
  referenciaCaso: string;
  fecha: string;
}) {
  return (
    <div className="print-only-header hidden print:block">
      <div className="print-header-top">
        <div className="print-logo-area">
          <span className="print-logo-text">ANIA</span>
          <span className="print-logo-sub">Análisis de conducta asistido por IA</span>
        </div>
        <div className="print-doc-type">EXPEDIENTE · ANÁLISIS FUNCIONAL</div>
      </div>
      <div className="print-separator" />
      <div className="print-meta-grid">
        <div className="print-meta-item">
          <span className="print-meta-label">Referencia del caso</span>
          <span className="print-meta-value">
            {referenciaCaso.trim() || "Sin referencia"}
          </span>
        </div>
        <div className="print-meta-item">
          <span className="print-meta-label">Fecha de generación</span>
          <span className="print-meta-value">{fecha}</span>
        </div>
        <div className="print-meta-item">
          <span className="print-meta-label">Modalidades incluidas</span>
          <span className="print-meta-value">ACT · DBT · Conductual</span>
        </div>
        <div className="print-meta-item">
          <span className="print-meta-label">Páginas</span>
          <span className="print-meta-value">Ver pie de página</span>
        </div>
      </div>
      <div className="print-separator" />
      <div className="print-confidential">
        DOCUMENTO CONFIDENCIAL — Solo para uso del profesional tratante
      </div>
    </div>
  );
}

/** Pie de página fijo, visible solo al imprimir/exportar a PDF. */
function PrintOnlyFooter() {
  return (
    <div className="print-only-footer hidden print:flex">
      <div className="print-footer-left">ANIA — Análisis de conducta asistido por IA</div>
      <div className="print-footer-center">
        Documento confidencial · Solo para uso clínico
      </div>
      <div className="print-footer-right" />
    </div>
  );
}

/** Descargo metodológico final, visible solo al imprimir/exportar a PDF. */
function PrintOnlyDisclaimer({ fecha }: { fecha: string }) {
  return (
    <div className="print-only-disclaimer hidden print:block">
      <div className="print-disclaimer-title">Nota metodológica</div>
      <p>
        Este análisis funcional fue generado mediante síntesis asistida por
        inteligencia artificial a partir de las notas clínicas proporcionadas
        por el profesional. Todas las hipótesis funcionales, clasificaciones y
        líneas de intervención sugeridas constituyen aproximaciones que
        requieren verificación mediante evaluación clínica directa.
      </p>
      <p>
        Este documento no constituye un diagnóstico, no sustituye el juicio
        clínico profesional, y no debe utilizarse como único fundamento para
        decisiones terapéuticas. El profesional tratante es el único
        responsable de la interpretación y aplicación de la información
        contenida en este expediente.
      </p>
      <p className="print-disclaimer-tool">
        Generado con ANIA — Análisis de conducta asistido por IA · {fecha}
      </p>
    </div>
  );
}

const NIVELES_CONFIANZA: { nivel: string; etiqueta: string }[] = [
  { nivel: "alta", etiqueta: "Alta" },
  { nivel: "media", etiqueta: "Media" },
  { nivel: "baja", etiqueta: "Baja" },
];

/**
 * Leyenda de confianza flotante: se queda fija en pantalla mientras el
 * usuario scrollea el informe, para que siempre pueda consultar qué
 * significa cada nivel. Se puede minimizar/reabrir con el ícono.
 */
function LeyendaConfianzaFlotante() {
  const [abierta, setAbierta] = useState(true);

  return (
    <div className="fixed bottom-4 right-4 z-30 print:hidden">
      {abierta ? (
        <div className="w-64 rounded-md border border-divider bg-surface p-4 shadow-lg">
          <div className="mb-2 flex items-center justify-between">
            <p className="font-mono text-[10px] uppercase tracking-wide text-ink-muted">
              Niveles de confianza
            </p>
            <button
              type="button"
              onClick={() => setAbierta(false)}
              aria-label="Minimizar leyenda de confianza"
              className="rounded p-1 text-ink-muted transition-colors hover:bg-canvas hover:text-ink"
            >
              ✕
            </button>
          </div>
          <ul className="space-y-2">
            {NIVELES_CONFIANZA.map(({ nivel, etiqueta }) => (
              <li key={nivel} className="flex items-start gap-2">
                <span
                  aria-hidden="true"
                  className={`mt-1 h-2 w-2 shrink-0 rounded-full ${colorConfianza(nivel)}`}
                />
                <p className="text-xs leading-relaxed text-ink-muted">
                  <span className="font-medium text-ink">{etiqueta}: </span>
                  {EXPLICACION_CONFIANZA[nivel]?.replace(/^\w+:\s*/, "")}
                </p>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAbierta(true)}
          aria-label="Mostrar leyenda de niveles de confianza"
          title="Niveles de confianza"
          className="flex h-10 w-10 items-center justify-center rounded-full border border-divider bg-surface text-accent shadow-lg transition-colors hover:bg-canvas"
        >
          <span aria-hidden="true" className="font-serif text-base font-semibold">
            i
          </span>
        </button>
      )}
    </div>
  );
}

export default function ReportView({
  analisis,
  referenciaCaso,
  onReferenciaCasoChange,
  fecha,
  notaOriginal,
  onAnalisisActualizado,
}: ReportViewProps) {
  const ids = useMemo(() => SECCIONES.map((s) => s.id), []);
  const activa = useSeccionActiva(ids);
  const [pestanaActiva, setPestanaActiva] = useState<ModeloTerapeutico>("act");

  const hipotesisDestacada = useMemo(() => {
    const conductaAlta = analisis.conductas_problema.find(
      (c) => c.importancia === "alta"
    );
    const porConducta = conductaAlta
      ? analisis.hipotesis_mantenimiento.find(
          (h) => h.conducta === conductaAlta.descripcion
        )
      : undefined;
    return porConducta ?? analisis.hipotesis_mantenimiento[0] ?? null;
  }, [analisis.conductas_problema, analisis.hipotesis_mantenimiento]);

  return (
    <ReanalisisContext.Provider
      value={{ notaOriginal, analisis, onAnalisisActualizado }}
    >
    <div className="rounded-md border border-divider bg-surface px-5 py-6 shadow-sm sm:px-8 sm:py-8 lg:px-12 lg:py-10 print:rounded-none print:border-none print:px-0 print:py-0 print:shadow-none">
      <PrintOnlyHeader referenciaCaso={referenciaCaso} fecha={fecha} />
      <PrintOnlyFooter />

      <header className="mb-6 border-b border-divider pb-5 print:hidden">
        <p className="font-mono text-xs uppercase tracking-[0.15em] text-accent">
          Expediente · Análisis funcional
        </p>
        <h1 className="mt-1 font-serif text-2xl font-semibold text-ink sm:text-3xl">
          ANIA — Análisis de conducta asistido por IA
        </h1>
        <div className="mt-4 flex flex-wrap items-center gap-x-8 gap-y-3 text-sm text-ink-muted">
          <p>
            Fecha de generación: <span className="text-ink">{fecha}</span>
          </p>
          <label className="flex items-center gap-2 print:hidden">
            <span>Referencia del caso (opcional):</span>
            <input
              type="text"
              value={referenciaCaso}
              onChange={(evento) => onReferenciaCasoChange(evento.target.value)}
              placeholder="p. ej. M.34"
              maxLength={60}
              className="border-b border-divider bg-transparent px-1 py-0.5 text-ink focus-visible:border-accent focus-visible:outline-none"
            />
          </label>
          {referenciaCaso.trim() && (
            <p className="hidden print:block">
              Referencia del caso: {referenciaCaso.trim()}
            </p>
          )}
        </div>
        <p className="mt-3 text-xs text-ink-muted">
          Los niveles de confianza indican qué tan respaldada está cada
          hipótesis por evidencia explícita en la nota (alta, media o baja).
        </p>
      </header>

      <IndiceMovil secciones={SECCIONES} activa={activa} />

      <div className="lg:flex lg:items-start lg:gap-10">
        <IndiceLateral secciones={SECCIONES} activa={activa} />

        <div className="min-w-0 flex-1">
          {/* Datos faltantes: lo primero que debe revisar el terapeuta, antes de confiar en el resto del análisis. */}
          <section id="datos-faltantes" className="scroll-mt-24 mb-8">
            <div className="mb-3 flex items-center gap-3">
              <span aria-hidden="true" className="h-5 w-1 rounded-full bg-warn" />
              <h2 className="section-title font-serif text-lg font-semibold text-ink sm:text-xl">
                Datos faltantes
              </h2>
            </div>
            <p className="mb-3 text-sm text-ink-muted">
              Revisa esto antes que el resto del informe: es la información que la
              nota no incluyó y que conviene confirmar o completar en sesión.
            </p>
            {analisis.datos_faltantes.length === 0 ? (
              <SinHallazgos />
            ) : (
              <ul className="list-disc space-y-2 pl-5">
                {analisis.datos_faltantes.map((d, i) => (
                  <li key={i} className="text-[15px] leading-relaxed text-ink">
                    {d}
                  </li>
                ))}
              </ul>
            )}
            <BloqueReanalisis
              campos={["datos_faltantes", "situaciones"]}
              seccionId="datos-faltantes"
            />
          </section>

          {/*
            Avisos metodológicos del validador del servidor, no del modelo.
            Van aquí arriba, junto a los datos faltantes, porque son la misma
            clase de información: lo que hay que mirar con cautela antes de
            confiar en el resto. Deliberadamente sobrios: son advertencias
            para revisar, no errores.
          */}
          {analisis.alertas.length > 0 && (
            <section id="alertas" className="scroll-mt-24 mb-8">
              <div className="mb-3 flex items-center gap-3">
                <span aria-hidden="true" className="h-5 w-1 rounded-full bg-warn" />
                <h2 className="section-title font-serif text-lg font-semibold text-ink sm:text-xl">
                  Revisiones sugeridas
                </h2>
              </div>
              <p className="mb-3 text-sm text-ink-muted">
                Comprobaciones automáticas sobre la coherencia del informe. No las
                genera la IA: las emite el sistema al contrastar el análisis con tu
                nota.
              </p>
              <ul className="space-y-3">
                {analisis.alertas.map((a, i) => (
                  <li key={i} className="border-l-2 border-divider pl-3">
                    <p className="font-mono text-[10px] uppercase tracking-wide text-ink-muted/70">
                      {a.gravedad === "alta" ? "Revisar antes de usar" : "Conviene revisar"}
                    </p>
                    <p className="text-[15px] leading-relaxed text-ink">{a.mensaje}</p>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Formulación funcional destacada — el titular del informe. */}
          <section id="hipotesis-principal" className="scroll-mt-24 mb-8">
            {hipotesisDestacada && hipotesisDestacada.enunciado ? (
              <div
                className="formulacion-destacada rounded-md border-l-4 border-accent p-8"
                style={{ backgroundColor: "#F0F4F2" }}
              >
                <p className="font-mono text-[11px] uppercase tracking-[0.15em] text-accent">
                  Formulación funcional destacada · {hipotesisDestacada.conducta}
                </p>
                <p className="mt-3 font-serif text-[21px] leading-relaxed text-ink">
                  {hipotesisDestacada.enunciado}
                </p>
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  {hipotesisDestacada.funcion && (
                    <ChipDestacado>{hipotesisDestacada.funcion}</ChipDestacado>
                  )}
                  <Confianza nivel={hipotesisDestacada.confianza} />
                </div>
                {analisis.hipotesis_mantenimiento.length > 1 &&
                  analisis.formulacion.priorizacion.length > 0 && (
                    <div className="mt-4 space-y-1 border-t border-accent/20 pt-3">
                      {analisis.formulacion.priorizacion.map((p, i) => (
                        <p key={i} className="text-sm text-ink-muted">
                          <span className="font-medium text-ink">
                            {i + 1}. {p.blanco}:
                          </span>{" "}
                          {p.justificacion}
                        </p>
                      ))}
                    </div>
                  )}
                <a
                  href="#resumen"
                  className="mt-5 inline-block text-sm text-ink-muted underline decoration-divider underline-offset-4 transition-colors hover:text-accent print:hidden"
                >
                  Ver análisis completo ↓
                </a>
              </div>
            ) : (
              <SinHallazgos />
            )}
          </section>

          <Seccion id="resumen" titulo="Resumen clínico" camposReanalisis={["resumen_clinico"]}>
            {analisis.resumen_clinico ? (
              <p className="text-[15px] leading-relaxed text-ink">
                {analisis.resumen_clinico}
              </p>
            ) : (
              <SinHallazgos />
            )}
          </Seccion>

          <Seccion id="conductas" titulo="Conductas problema" camposReanalisis={["conductas_problema"]}>
            {analisis.conductas_problema.length === 0 ? (
              <SinHallazgos />
            ) : (
              <ul className="space-y-4">
                {analisis.conductas_problema.map((c, i) => (
                  <li key={i}>
                    <div className="flex flex-wrap gap-2">
                      <Chip>{c.tipo}</Chip>
                      <Chip>importancia {c.importancia}</Chip>
                      {c.es_conducta_seguridad && <Chip>conducta de seguridad</Chip>}
                      {c.deficit_o_interferencia !== "no_determinable" && (
                        <Chip>{c.deficit_o_interferencia}</Chip>
                      )}
                    </div>
                    <p className="mt-1 text-[15px] leading-relaxed text-ink">
                      {c.descripcion}
                    </p>
                    {c.justificacion_deficit && (
                      <p className="mt-1 text-sm leading-relaxed text-ink-muted">
                        {c.justificacion_deficit}
                      </p>
                    )}
                    <Cita>{c.evidencia}</Cita>
                  </li>
                ))}
              </ul>
            )}
          </Seccion>

          <Seccion id="variables-moduladoras" titulo="Variables moduladoras" camposReanalisis={["variables_moduladoras"]}>
            {analisis.variables_moduladoras.length === 0 ? (
              <SinHallazgos />
            ) : (
              <div className="space-y-5">
                {(
                  [
                    ["biologica", "Biológicas"],
                    ["historia_de_aprendizaje", "Historia de aprendizaje"],
                    ["contextual", "Contextuales"],
                  ] as const
                ).map(([tipo, titulo]) => {
                  const items = analisis.variables_moduladoras.filter(
                    (v) => v.tipo === tipo
                  );
                  if (items.length === 0) return null;
                  return (
                    <SubSeccion key={tipo} titulo={titulo}>
                      <ul className="space-y-3">
                        {items.map((v, i) => (
                          <li key={i}>
                            <p className="text-[15px] leading-relaxed text-ink">
                              {v.descripcion}
                            </p>
                            <Cita>{v.evidencia}</Cita>
                          </li>
                        ))}
                      </ul>
                    </SubSeccion>
                  );
                })}
              </div>
            )}
          </Seccion>

          <Seccion
            id="situaciones"
            titulo="Análisis por situaciones"
            camposReanalisis={["situaciones"]}
            extra={
              <BotonesModalidad activa={pestanaActiva} onChange={setPestanaActiva} />
            }
          >
            {analisis.situaciones.length === 0 ? (
              <SinHallazgos />
            ) : (
              <div className="space-y-6">
                {analisis.situaciones.map((s, i) => (
                  <SituacionCard key={i} situacion={s} pestanaActiva={pestanaActiva} />
                ))}
              </div>
            )}
          </Seccion>

          <Seccion
            id="hipotesis-mantenimiento"
            titulo="Hipótesis de mantenimiento"
            camposReanalisis={["hipotesis_mantenimiento", "hipotesis_origen"]}
          >
            {analisis.hipotesis_mantenimiento.length === 0 ? (
              <SinHallazgos />
            ) : (
              <ul className="space-y-4">
                {analisis.hipotesis_mantenimiento.map((h, i) => (
                  <li key={i} className="hipotesis-card rounded border border-divider p-4">
                    <p className="font-mono text-xs uppercase tracking-wide text-ink-muted">
                      {h.conducta}
                    </p>
                    <p className="mt-1 text-[15px] leading-relaxed text-ink">
                      {h.enunciado}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-3">
                      {h.funcion && <Chip>{h.funcion}</Chip>}
                      <Confianza nivel={h.confianza} />
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {analisis.hipotesis_origen.length > 0 && (
              <div className="mt-6">
                <SubSeccion titulo="Hipótesis de origen (tentativas)">
                  <ul className="list-disc space-y-2 pl-5">
                    {analisis.hipotesis_origen.map((h, i) => (
                      <li key={i} className="text-sm italic leading-relaxed text-ink-muted">
                        {h}
                      </li>
                    ))}
                  </ul>
                </SubSeccion>
              </div>
            )}
          </Seccion>

          <Seccion id="formulacion" titulo="Formulación del caso" camposReanalisis={["formulacion"]}>
            <div className="space-y-5">
              <SubSeccion titulo="Relaciones entre problemas">
                {analisis.formulacion.relaciones_entre_problemas.length === 0 ? (
                  <SinHallazgos />
                ) : (
                  <ul className="list-disc space-y-2 pl-5">
                    {analisis.formulacion.relaciones_entre_problemas.map(
                      (r, i) => (
                        <li key={i} className="text-[15px] leading-relaxed text-ink">
                          {r}
                        </li>
                      )
                    )}
                  </ul>
                )}
              </SubSeccion>
              <SubSeccion titulo="Priorización de blancos de intervención">
                {analisis.formulacion.priorizacion.length === 0 ? (
                  <SinHallazgos />
                ) : (
                  <ul className="space-y-3">
                    {analisis.formulacion.priorizacion.map((p, i) => (
                      <li key={i}>
                        <p className="text-[15px] font-medium leading-relaxed text-ink">
                          {i + 1}. {p.blanco}
                        </p>
                        <p className="mt-0.5 text-sm text-ink-muted">
                          {p.justificacion}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </SubSeccion>
            </div>
          </Seccion>

          <Seccion
            id="conductas-alternativas"
            titulo="Conductas alternativas propuestas"
            camposReanalisis={["conductas_alternativas"]}
          >
            {analisis.conductas_alternativas.length === 0 ? (
              <SinHallazgos />
            ) : (
              <ul className="space-y-4">
                {analisis.conductas_alternativas.map((c, i) => (
                  <li key={i} className="rounded border border-divider p-4">
                    <p className="font-mono text-xs uppercase tracking-wide text-ink-muted">
                      {c.situacion}
                    </p>
                    <p className="mt-1 text-[15px] leading-relaxed text-ink">
                      {c.conducta_propuesta}
                    </p>
                    <p className="mt-1 text-sm text-ink-muted">
                      <span className="font-medium text-ink">
                        Consecuencia necesaria para mantenerla:
                      </span>{" "}
                      {c.consecuencia_necesaria}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Seccion>

          <Seccion
            id="modalidad"
            titulo="Detalle según modelo terapéutico"
            camposReanalisis={[CAMPO_CAPA_POR_MODELO[pestanaActiva]]}
          >
            <DetalleModalidad>
              <SelectorCapaModalidad
                analisis={analisis}
                pestanaActiva={pestanaActiva}
                onCambiarPestana={setPestanaActiva}
              />
            </DetalleModalidad>
          </Seccion>

          <Seccion id="hipotesis-alternativas" titulo="Hipótesis alternativas" camposReanalisis={["hipotesis_alternativas"]}>
            {analisis.hipotesis_alternativas.length === 0 ? (
              <SinHallazgos />
            ) : (
              <ul className="space-y-4">
                {analisis.hipotesis_alternativas.map((h, i) => (
                  <li key={i}>
                    <p className="text-[15px] leading-relaxed text-ink">
                      {h.enunciado}
                    </p>
                    <p className="mt-1 text-sm text-ink-muted">
                      Cómo descartarla: {h.como_descartarla}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Seccion>

          <Seccion id="preguntas" titulo="Preguntas para la próxima sesión" camposReanalisis={["preguntas_para_sesion"]}>
            {analisis.preguntas_para_sesion.length === 0 ? (
              <SinHallazgos />
            ) : (
              <ul className="list-disc space-y-2 pl-5">
                {analisis.preguntas_para_sesion.map((p, i) => (
                  <li key={i} className="text-[15px] leading-relaxed text-ink">
                    {p}
                  </li>
                ))}
              </ul>
            )}
          </Seccion>

          <Seccion
            id="intervencion"
            titulo="Líneas de intervención tentativas"
            camposReanalisis={["lineas_de_intervencion_tentativas"]}
          >
            {analisis.lineas_de_intervencion_tentativas.length === 0 ? (
              <SinHallazgos />
            ) : (
              <ul className="list-disc space-y-2 pl-5">
                {analisis.lineas_de_intervencion_tentativas.map((l, i) => (
                  <li key={i} className="text-[15px] leading-relaxed text-ink">
                    {l}
                  </li>
                ))}
              </ul>
            )}
          </Seccion>

        </div>
      </div>

      <footer className="mt-6 rounded-md border border-divider bg-canvas p-4 text-xs leading-relaxed text-ink-muted print:hidden">
        Este análisis es una síntesis asistida de hipótesis funcionales generadas a
        partir de las notas proporcionadas. No constituye un diagnóstico ni
        sustituye el juicio clínico profesional. Toda hipótesis debe verificarse
        mediante evaluación directa.
      </footer>

      <PrintOnlyDisclaimer fecha={fecha} />
      <LeyendaConfianzaFlotante />
    </div>
    </ReanalisisContext.Provider>
  );
}
