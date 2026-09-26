"use client";

/**
 * El andamiaje de un apartado del informe: su ancla, su marca de edición, el
 * reporte de fallo y el reanálisis de esa sola sección.
 *
 * POR QUÉ ESTÁ FUERA DE ReportView. No es una preferencia de organización: los
 * cinco componentes de bloque (components/informe/Bloque*.tsx) necesitan
 * `Seccion`, y ReportView necesita a los cinco. Con todo en el mismo fichero
 * eso era un ciclo de importación, y por eso el troceado se había quedado en
 * cinco envoltorios de una línea mientras las tres mil líneas seguían juntas.
 *
 * Aquí viven las piezas que comparten todos los bloques y nada más. Lo que solo
 * usa un bloque vive con su bloque.
 */

import {
  createContext,
  useContext,
  useState,
  type ReactNode,
} from "react";
import type { AnalisisFuncional } from "@/lib/types";
import {
  ANCLAS_DE_BLOQUE,
  TITULO_DE_ANCLA,
  type IdAncla,
  type IdSeccion,
} from "@/lib/secciones";
import { agruparAlertas } from "@/lib/validadores";
import { traducirMensajeAlerta } from "@/lib/gradoApoyo";
import { construirReporteFallo } from "@/lib/reporteFallo";
import {
  contieneDatosIdentificables,
  enmascararDatosIdentificables,
} from "@/lib/pii";
import { irAlAncla, usePestanas } from "./pestanas";
import { MarcaEditado, useEdicion } from "../edicionManual";
import { MenuAcciones, SeccionInforme, type AccionMenu } from "./primitivas";

/**
 * Qué bloque(s) de lib/bloques.ts hacen falta para que cada sección tenga
 * contenido. Sin bloque asociado, la sección se muestra siempre (resumen,
 * datos faltantes, alertas). Se usa para ocultar lo que no se pidió en un
 * análisis parcial, en vez de enseñar media docena de apartados vacíos.
 *
 * "conductas" y "variables-moduladoras" listan dos ids porque "conductas" y
 * "moduladoras" se fusionaron en el bloque "base": un análisis guardado antes
 * de la fusión todavía trae el id viejo en campos_generados, y sin el alias
 * esa sección se ocultaría en un informe que sí la generó.
 */
const BLOQUE_DE_SECCION: Partial<Record<IdAncla, string[]>> = {
  conductas: ["base", "conductas"],
  "variables-moduladoras": ["base", "moduladoras"],
  situaciones: ["situaciones"],
  "hipotesis-mantenimiento": ["mantenimiento"],
  "hipotesis-origen": ["mantenimiento"],
  "hipotesis-principal": ["mantenimiento"],
  formulacion: ["formulacion"],
  "conductas-alternativas": ["alternativas"],
  "hipotesis-alternativas": ["hipotesis_alternativas"],
  preguntas: ["preguntas"],
  intervencion: ["intervencion"],
  monitorizacion: ["monitorizacion"],
};

/**
 * campos_generados vacío = informe completo (y también los análisis guardados
 * antes de que existiera el análisis por partes).
 */
export function anclaVisible(analisis: AnalisisFuncional, id: IdAncla): boolean {
  if (analisis.campos_generados.length === 0) return true;
  if (id === "modalidad") {
    return ["act", "dbt", "mc"].some((m) => analisis.campos_generados.includes(m));
  }
  const bloques = BLOQUE_DE_SECCION[id];
  return !bloques || bloques.some((b) => analisis.campos_generados.includes(b));
}

/**
 * Un bloque se pinta si alguno de sus apartados tiene algo que enseñar. Un
 * bloque entero vacío en un análisis parcial es ruido: ocupa una entrada del
 * índice para no decir nada.
 */
export function bloqueVisible(analisis: AnalisisFuncional, id: IdSeccion): boolean {
  if (analisis.campos_generados.length === 0) return true;
  return ANCLAS_DE_BLOQUE[id].some((a) => anclaVisible(analisis, a));
}

export interface ReanalisisContextValor {
  notaOriginal: string;
  analisis: AnalisisFuncional;
  onAnalisisActualizado: (fragmento: Partial<AnalisisFuncional>) => void;
}

export const ReanalisisContext = createContext<ReanalisisContextValor | null>(null);

/** Botón + cuadro de texto para agregar una nota y reanalizar solo esta sección. */
export function BloqueReanalisis({
  campos,
  seccionId,
  abiertoDeEntrada = false,
  onCerrar,
}: {
  campos: (keyof AnalisisFuncional)[];
  seccionId: string;
  /** Abierto al montar: lo usa el menú «⋯», que monta el panel al elegirlo. */
  abiertoDeEntrada?: boolean;
  /** Si llega, el panel no pinta su propio botón: lo abre el menú. */
  onCerrar?: () => void;
}) {
  const contexto = useContext(ReanalisisContext);
  const [abierto, setAbierto] = useState(abiertoDeEntrada);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmandoSobrescritura, setConfirmandoSobrescritura] = useState(false);
  const [fragmentoPendiente, setFragmentoPendiente] = useState<Partial<AnalisisFuncional> | null>(null);

  if (!contexto) return null;
  if (!abierto && onCerrar) return null;
  const { notaOriginal, analisis, onAnalisisActualizado } = contexto;

  const contieneDatos = texto.trim().length > 0 && contieneDatosIdentificables(texto);
  // El reanálisis reemplaza los campos que devuelve la IA: si el clínico ya
  // escribió aquí, su texto se perdería sin avisar.
  const tieneEdiciones = analisis.secciones_editadas.includes(seccionId);

  async function reanalizar() {
    if (!texto.trim() || enviando) return;
    if (seccionId === "situaciones" && tieneEdiciones) {
      setError(
        "Este grafo ya contiene cambios manuales y no se sobrescribirá con una respuesta de la IA. Incorpora la nota editando sus nodos y relaciones."
      );
      return;
    }
    if (tieneEdiciones && !confirmandoSobrescritura) {
      setConfirmandoSobrescritura(true);
      return;
    }
    setConfirmandoSobrescritura(false);
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

      setFragmentoPendiente(datos.fragmento as Partial<AnalisisFuncional>);
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
            className="w-full resize-y rounded border border-divider bg-surface px-2.5 py-1.5 text-sm text-ink placeholder:text-ink-muted focus-visible:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30 disabled:cursor-not-allowed disabled:opacity-60"
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
          {confirmandoSobrescritura && (
            <p role="alert" className="rounded border border-warn/40 bg-canvas p-2 text-xs text-warn">
              Has editado esta sección a mano. Si reanalizas, la IA reescribirá
              tus cambios y no se podrán recuperar. Pulsa otra vez
              &quot;Reanalizar&quot; para continuar, o cancela.
            </p>
          )}
          {fragmentoPendiente && (
            <div className="space-y-2 rounded border border-accent/30 bg-canvas p-3">
              <p className="text-xs font-medium text-ink">
                Vista previa de diferencias · todavía no se ha aplicado nada
              </p>
              {Object.entries(fragmentoPendiente).map(([campo, despues]) => (
                <details key={campo} className="rounded border border-divider bg-surface p-2 text-xs">
                  <summary className="cursor-pointer font-medium text-ink">{campo}</summary>
                  <div className="mt-2 grid gap-2 md:grid-cols-2">
                    <div><p className="mb-1 text-ink-muted">Antes</p><pre className="max-h-40 overflow-auto whitespace-pre-wrap text-ink">{JSON.stringify(analisis[campo as keyof AnalisisFuncional], null, 2)}</pre></div>
                    <div><p className="mb-1 text-ink-muted">Después</p><pre className="max-h-40 overflow-auto whitespace-pre-wrap text-ink">{JSON.stringify(despues, null, 2)}</pre></div>
                  </div>
                </details>
              ))}
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => {
                  onAnalisisActualizado(fragmentoPendiente);
                  setFragmentoPendiente(null);
                  setTexto("");
                  setAbierto(false);
                  onCerrar?.();
                }} className="rounded bg-accent px-3 py-1.5 text-xs font-medium texto-sobre-acento">Aplicar cambios</button>
                <button type="button" onClick={() => setFragmentoPendiente(null)} className="rounded border border-divider px-3 py-1.5 text-xs text-ink">Descartar</button>
              </div>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={reanalizar}
              disabled={enviando || !texto.trim() || fragmentoPendiente !== null}
              className="rounded bg-accent px-3 py-1.5 text-xs font-medium texto-sobre-acento transition-colors hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {enviando
                ? "Reanalizando…"
                : confirmandoSobrescritura
                  ? "Sí, reescribir mis cambios"
                  : "Reanalizar esta sección"}
            </button>
            <button
              type="button"
              onClick={() => {
                setAbierto(false);
                setTexto("");
                setError(null);
                setConfirmandoSobrescritura(false);
                setFragmentoPendiente(null);
                onCerrar?.();
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

/**
 * Los avisos del validador, agrupados por motivo.
 *
 * Vive en su propio componente desde que comparte sección con los datos
 * faltantes: las dos listas responden a la misma pregunta —qué hay que
 * comprobar antes de dar el informe por bueno— y estaban en dos secciones
 * distintas del índice, a veces separadas por medio documento. Lo que cambia
 * es dónde se leen, no qué dicen.
 */
export function ListaAlertas({ analisis }: { analisis: AnalisisFuncional }) {
  const orden = usePestanas();
  return (
      <ul className="space-y-5">
        {agruparAlertas(analisis.alertas).map((g, i) => {
          const alta = g.gravedad === "alta";
          return (
            <li
              key={i}
              className={`rounded-r-md border-l-[3px] py-1.5 pl-4 ${
                alta ? "border-warn bg-warn/5" : "border-divider"
              }`}
            >
              {/*
                La etiqueta de gravedad era el mismo gris apagado que
                todo lo demás: una insignia (con su punto de color) la
                separa de un vistazo de las etiquetas secundarias
                (origen, número de propuestas), que van aparte y sin
                el mismo peso. Ámbar solo para "alta": es el color que
                MARCA.md reserva para "hay que mirarlo", no uno nuevo.
              */}
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wide ${
                    alta ? "bg-warn/15 text-warn" : "bg-ink-muted/10 text-ink-muted"
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className={`h-1.5 w-1.5 rounded-full ${alta ? "bg-warn" : "bg-ink-muted/50"}`}
                  />
                  {alta ? "Revisar antes de usar" : "Conviene revisar"}
                </span>
                {g.origen === "ia" && (
                  <span className="font-mono text-[10px] uppercase tracking-wide text-ink-muted">
                    Revisión con IA
                  </span>
                )}
                {g.elementos.length > 1 && (
                  <span className="font-mono text-[10px] uppercase tracking-wide text-ink-muted">
                    {g.elementos.length} propuestas
                  </span>
                )}
              </div>
              {/* El mensaje es el titular del aviso: en negrita para
                  que se lea antes que las propuestas y el enlace de
                  abajo, que son apoyo, no la conclusión. */}
              <p className="mt-2 text-[15px] font-medium leading-relaxed text-ink">
                {traducirMensajeAlerta(g.mensaje)}
              </p>
              {/* El motivo va arriba una vez; debajo, a qué alcanza. */}
              {g.elementos.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {g.elementos.map((e, j) => (
                    <li
                      key={j}
                      className="text-[15px] leading-relaxed text-ink-muted before:mr-1.5 before:content-['—']"
                    >
                      {e}
                    </li>
                  ))}
                </ul>
              )}
              {/*
                Dónde aterriza el fallo. Sin esto el aviso dice que algo
                puede estar mal pero no qué apartado releer, que es
                justo lo que decide si hay que reanalizar una sección.
                Va enlazado porque el informe es largo y la sección
                señalada puede estar muy lejos.
              */}
              {g.secciones.length > 0 && (
                <p className="mt-2 text-sm text-ink-muted">
                  Puede haberse reflejado en{" "}
                  {g.secciones.map((id, j) => (
                    <span key={id}>
                      {j > 0 && (j === g.secciones.length - 1 ? " y " : ", ")}
                      <a
                        href={`#${id}`}
                        onClick={(e) => {
                          e.preventDefault();
                          irAlAncla(orden, id);
                        }}
                        className="text-accent underline underline-offset-2 print:no-underline"
                      >
                        {TITULO_DE_ANCLA[id] ?? id}
                      </a>
                    </span>
                  ))}
                  . Reanaliza o corrige ahí si lo das por bueno.
                </p>
              )}
            </li>
          );
        })}
      </ul>
  );
}

/**
 * El menú «⋯» de un apartado y el panel que abre. Lo devuelve por separado
 * porque el menú va en el encabezado y el panel debajo del contenido, que es
 * donde se lee lo que se va a reportar o reanalizar.
 */
export function useAccionesSeccion(
  seccionId: string,
  titulo: string,
  camposReanalisis?: (keyof AnalisisFuncional)[]
): { menu: ReactNode; panel: ReactNode } {
  const contexto = useContext(ReanalisisContext);
  const [panel, setPanel] = useState<"fallo" | "reanalisis" | null>(null);
  if (!contexto) return { menu: null, panel: null };

  const acciones: AccionMenu[] = [
    ...(camposReanalisis
      ? [{ etiqueta: "Agregar nota y reanalizar", onElegir: () => setPanel("reanalisis" as const) }]
      : []),
    { etiqueta: "Reportar fallo de la IA", onElegir: () => setPanel("fallo" as const) },
  ];
  const cerrar = () => setPanel(null);

  return {
    menu: <MenuAcciones etiqueta={titulo} acciones={acciones} />,
    panel:
      panel === "fallo" ? (
        <ReportarFallo seccionId={seccionId} abiertoDeEntrada onCerrar={cerrar} />
      ) : panel === "reanalisis" && camposReanalisis ? (
        <BloqueReanalisis
          campos={camposReanalisis}
          seccionId={seccionId}
          abiertoDeEntrada
          onCerrar={cerrar}
        />
      ) : null,
  };
}

/**
 * Un apartado dentro de un bloque. Conserva su id de siempre como ancla, así
 * que `#hipotesis-principal` y los enlaces guardados siguen llevando donde
 * llevaban, y `secciones_editadas` sigue hablando el mismo idioma (invariante
 * 6: lo que escribe el clínico no se presenta como generado por IA).
 *
 * Ya no envuelve un BloqueOrdenable: el apartado no es una unidad de orden.
 */
export function Seccion({
  id,
  titulo,
  extra,
  children,
  camposReanalisis,
}: {
  /* No es un `string` cualquiera: cada apartado tiene que estar en
     lib/secciones.ts, o el enlace que lo señale apuntaría a la nada. */
  id: IdAncla;
  titulo: string;
  extra?: ReactNode;
  children: ReactNode;
  camposReanalisis?: (keyof AnalisisFuncional)[];
}) {
  const contexto = useContext(ReanalisisContext);
  const edicion = useEdicion();
  const { menu, panel } = useAccionesSeccion(id, titulo, camposReanalisis);
  // En un análisis parcial, los apartados no pedidos no se pintan vacíos.
  if (contexto && !anclaVisible(contexto.analisis, id)) return null;

  const editada = edicion?.seccionesEditadas.includes(id) ?? false;

  return (
    <SeccionInforme
      id={id}
      titulo={titulo}
      editada={editada}
      marcaEditada={<MarcaEditado />}
      extra={
        <span className="inline-flex items-center gap-2">
          {extra}
          {menu}
        </span>
      }
      pie={panel}
    >
      {children}
    </SeccionInforme>
  );
}

/**
 * Reporta un fallo del modelo. Copia al portapapeles un informe técnico que
 * NO incluye la nota clínica (ver lib/reporteFallo.ts): el clínico decide a
 * quién se lo manda.
 */
export function ReportarFallo({
  seccionId,
  abiertoDeEntrada = false,
  onCerrar,
}: {
  seccionId: string;
  abiertoDeEntrada?: boolean;
  onCerrar?: () => void;
}) {
  const contexto = useContext(ReanalisisContext);
  const [abierto, setAbierto] = useState(abiertoDeEntrada);
  const [borrador, setBorrador] = useState(() =>
    abiertoDeEntrada && contexto
      ? construirReporteFallo(contexto.analisis, seccionId, "")
      : ""
  );
  const [copiado, setCopiado] = useState(false);

  if (!contexto) return null;

  function cerrar() {
    setAbierto(false);
    onCerrar?.();
  }

  function abrir() {
    setBorrador(construirReporteFallo(contexto!.analisis, seccionId, ""));
    setAbierto(true);
  }

  async function copiar() {
    try {
      await navigator.clipboard.writeText(borrador);
      setCopiado(true);
      setTimeout(() => {
        setCopiado(false);
        cerrar();
      }, 1800);
    } catch {
      setCopiado(false);
    }
  }

  if (!abierto) {
    if (onCerrar) return null;
    return (
      <button
        type="button"
        onClick={abrir}
        className="mt-3 font-mono text-[10px] uppercase tracking-wide text-ink-muted transition-colors hover:text-warn focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 print:hidden"
      >
        Reportar fallo de la IA en esta sección
      </button>
    );
  }

  return (
    <div className="mt-3 rounded border border-divider bg-canvas p-3 print:hidden">
      {/*
        El reporte se muestra entero y editable ANTES de copiarlo, y no incluye
        el análisis generado: describe el caso, así que es contenido clínico
        (ver lib/reporteFallo.ts). Lo que el clínico añada a mano es cosa suya,
        pero lo ve delante antes de que salga del dispositivo.
      */}
      <p className="mb-2 text-sm text-ink-muted">
        Esto es exactamente lo que se copiará.{" "}
        <span className="text-ink">
          No lleva tu nota ni el análisis generado
        </span>{" "}
        — solo el modelo, la versión del prompt y la sección. Si para explicar el
        fallo hace falta el texto, escríbelo tú con datos ficticios.
      </p>
      <textarea
        value={borrador}
        onChange={(e) => setBorrador(e.target.value)}
        rows={10}
        aria-label="Contenido del reporte, editable antes de copiar"
        className="w-full rounded border border-divider bg-surface p-2 font-mono text-xs leading-relaxed text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
      />
      <div className="mt-2 flex gap-3">
        <button
          type="button"
          onClick={copiar}
          className="rounded border border-divider bg-surface px-3 py-1 text-xs font-medium text-ink transition-colors hover:bg-canvas"
        >
          {copiado ? "Copiado" : "Copiar reporte"}
        </button>
        <button
          type="button"
          onClick={cerrar}
          className="rounded px-3 py-1 text-xs text-ink-muted transition-colors hover:text-ink"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
