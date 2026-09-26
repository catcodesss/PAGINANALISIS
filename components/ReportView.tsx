"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type {
  AnalisisFuncional,
  MetaGeneracion,
} from "@/lib/types";
import {
  ProveedorEdicion,
} from "./edicionManual";
import {
  SECCIONES_INFORME,
  type IdSeccion,
} from "@/lib/secciones";
import {
  NIVELES_CONFIANZA,
} from "@/lib/nivelesConfianza";
import FranjaDocumento from "./FranjaDocumento";
import { useLente } from "./useLente";
import {
  BotonRestaurarOrden,
  ProveedorOrden,
  useOrden,
} from "./ordenBloques";
import { hayGrafoBase } from "@/lib/grafo";
import type { EstiloGrafo } from "@/lib/preferencias";
import {
  bloqueVisible,
  ReanalisisContext,
} from "./informe/seccion";
import BloqueSintesis from "./informe/BloqueSintesis";
import BloqueAnalisisFuncional from "./informe/BloqueAnalisisFuncional";
import BloqueMantenimiento from "./informe/BloqueMantenimiento";
import BloquePlan from "./informe/BloquePlan";
import BloquePendientes from "./informe/BloquePendientes";
import { derivarVistasProsa } from "@/lib/formatearInforme";

interface ReportViewProps {
  analisis: AnalisisFuncional;
  referenciaCaso: string;
  onReferenciaCasoChange: (valor: string) => void;
  fecha: string;
  notaOriginal: string;
  onAnalisisActualizado: (fragmento: Partial<AnalisisFuncional>) => void;
  /**
   * Edición manual: recibe una función que muta una copia del análisis. La
   * página es la dueña del estado y quien decide revalidar (ver
   * lib/validadores.ts#revalidarTrasEdicion).
   */
  onEditarSeccion: (seccionId: string, mutar: (copia: AnalisisFuncional) => void) => void;
}

interface SeccionIndice {
  id: IdSeccion;
  titulo: string;
}

const ETIQUETA_ESTILO: Record<EstiloGrafo, string> = {
  afc: "AFC",
  dbt: "DBT",
  act: "ACT",
  mc: "Conductual (MC)",
};

/**
 * El índice sale de lib/secciones.ts, que es la única lista: así el orden del
 * índice, el del informe exportado y el nombre de cada bloque no pueden
 * separarse. Antes eran cuatro listas sueltas y nada las comparaba.
 */
const SECCIONES: readonly SeccionIndice[] = SECCIONES_INFORME;

/** Orden de fábrica, el punto de partida antes de que el clínico mueva nada. */
const IDS_SECCIONES = SECCIONES.map((s) => s.id);

const ESTILOS_GRAFO: EstiloGrafo[] = ["afc", "dbt", "act", "mc"];

/**
 * El selector de lente: UNO, arriba del informe.
 *
 * Antes eran los mismos botones repetidos en cada sección que tenía algo que
 * enseñar por modelo. Repetir el mando no daba más control: daba más ocasiones
 * de leer una situación en ACT y la de al lado en DBT sin darse cuenta. El
 * terapeuta trabaja con un modelo por paciente, lo elige una vez y el documento
 * entero se adapta.
 *
 * No se imprime. En papel no hay nada que pulsar, y el documento exportado
 * lista todas las capas generadas en vez de una.
 */
function SelectorDeLente({
  activa,
  onChange,
  habilitaLecturas,
}: {
  activa: EstiloGrafo;
  onChange: (m: EstiloGrafo) => void;
  habilitaLecturas: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 print:hidden">
      <p
        id="etiqueta-lente"
        className="font-mono text-[10px] uppercase tracking-wide text-ink-muted"
      >
        Estilo del grafo
      </p>
      {/* role=group con su etiqueta: sin esto, un lector de pantalla anuncia
          tres botones sueltos sin decir de qué son las opciones. */}
      <div
        role="group"
        aria-labelledby="etiqueta-lente"
        className="flex overflow-hidden rounded border border-divider"
      >
        {ESTILOS_GRAFO.map((m) => {
          const deshabilitada = m !== "afc" && !habilitaLecturas;
          return (
          <button
            key={m}
            type="button"
            disabled={deshabilitada}
            onClick={() => onChange(m)}
            aria-pressed={activa === m}
            title={deshabilitada ? "Añade una relación que toque una conducta para habilitar esta lectura" : undefined}
            className={`px-4 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 disabled:cursor-not-allowed disabled:opacity-40 ${
              activa === m
                ? "bg-accent texto-sobre-acento"
                : "bg-surface text-ink-muted hover:bg-canvas"
            }`}
          >
            {ETIQUETA_ESTILO[m]}
          </button>
          );
        })}
      </div>
      <p className="text-xs text-ink-muted">
        Las cuatro vistas leen las mismas entidades y relaciones. La preferencia
        se recuerda por caso; la exportación siempre usa AFC.
      </p>
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

/**
 * El índice consume el mismo OrdenContext que las tarjetas (ver
 * components/ordenBloques.tsx#BloqueOrdenable): arrastrar un título aquí
 * llama a la misma `soltarSobre` que arrastrar una tarjeta, así que reordena
 * exactamente lo mismo y desde cualquiera de los dos sitios se ve el mismo
 * resultado. A diferencia de las tarjetas, aquí no hace falta la animación
 * FLIP ni el truco de `order` de CSS: `secciones` ya llega reordenado (ver
 * seccionesVisibles en InformeOrdenable), así que basta con dejar que la
 * lista se vuelva a pintar en su nuevo orden.
 *
 * `draggable={false}` en el enlace es necesario: un <a> es arrastrable de
 * fábrica en el navegador (arrastra el enlace, no reordena nada), y eso
 * gana al `draggable` del <li> si no se desactiva explícitamente.
 */

/**
 * Reabrir una tarjeta oculta desde cualquiera de los dos índices (el lateral
 * y el desplegable móvil). La tarjeta sigue en el DOM (display:none, ver
 * BloqueOrdenable en components/ordenBloques.tsx), así que basta con
 * quitarle la marca; no ocupa espacio hasta que React repinta, y eso pasa un
 * frame después de esta llamada — de ahí el requestAnimationFrame antes de
 * desplazarse.
 */
function reabrirSeccion(ctx: ReturnType<typeof useOrden>, id: string) {
  ctx?.mostrar(id);
  requestAnimationFrame(() => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

function IndiceLateral({
  secciones,
  activa,
}: {
  secciones: SeccionIndice[];
  activa: string;
}) {
  const ctx = useOrden();
  const [encimaDe, setEncimaDe] = useState<string | null>(null);

  // Un clic navega, como siempre; ocultar necesita una intención más clara
  // (doble clic, o mantener pulsado) para no confundir "quiero leer esto" con
  // "quiero quitarlo de en medio". Solo puede haber una pulsación mantenida a
  // la vez, así que un único ref alcanza para toda la lista.
  const PULSACION_MS = 3000;
  const pulsacionRef = useRef<{
    id: string;
    timer: ReturnType<typeof setTimeout>;
    disparada: boolean;
  } | null>(null);

  function iniciarPulsacion(id: string) {
    const timer = setTimeout(() => {
      ctx?.ocultar(id);
      if (pulsacionRef.current?.id === id) pulsacionRef.current.disparada = true;
    }, PULSACION_MS);
    pulsacionRef.current = { id, timer, disparada: false };
  }

  /** Al soltar antes de tiempo, o si el ratón se va, se cancela el temporizador. */
  function soltarPulsacion() {
    if (pulsacionRef.current) clearTimeout(pulsacionRef.current.timer);
  }

  /**
   * El clic llega SIEMPRE después del mousedown/mouseup que lo originan, así
   * que si la pulsación mantenida ya ocultó la tarjeta, `disparada` ya está en
   * true para cuando esto se ejecuta: se ignora, porque ya hizo su trabajo.
   * Si no está disparada y la sección está oculta, es un clic normal sobre
   * "+ Título": reabre. Si está visible, es un clic normal: navega (el <a>
   * ya tiene su href, no hace falta nada más).
   */
  function alHacerClic(ctx: ReturnType<typeof useOrden>, id: string, oculto: boolean, e: React.MouseEvent) {
    const yaDisparada = pulsacionRef.current?.id === id && pulsacionRef.current.disparada;
    pulsacionRef.current = null;
    if (yaDisparada) {
      e.preventDefault();
      return;
    }
    if (oculto) {
      e.preventDefault();
      reabrirSeccion(ctx, id);
    }
  }

  return (
    <nav
      aria-label="Índice del informe"
      className="hidden shrink-0 print:hidden lg:sticky lg:top-24 lg:block lg:h-fit lg:w-[210px]"
    >
      <ul className="space-y-3.5 text-sm">
        {secciones.map(({ id, titulo }) => {
          const oculto = ctx?.oculta(id) ?? false;
          // Un solo clic vuelve a ser navegación pura, así que el hover
          // vuelve a su tono neutro de siempre: el ámbar de "esto oculta" ya
          // no pertenece al primer pase del ratón, solo al doble clic o a
          // mantener pulsado (sin hover propio: no hay forma de anticiparlo
          // con un pase de ratón, tiene que descubrirse o enseñarse aparte).
          const claseComun = `block w-full rounded-r border-l-2 py-0.5 pl-3 text-left transition-colors ${
            ctx?.arrastrando === id ? "opacity-40" : ""
          } ${
            encimaDe === id
              ? "border-accent bg-accent-soft ring-1 ring-accent/30"
              : oculto
                ? "border-divider text-ink-muted/60 hover:text-ink-muted"
                : activa === id
                  ? "border-accent font-semibold text-accent"
                  : "border-divider text-ink-muted hover:border-ink-muted hover:text-ink"
          }`;

          return (
            <li
              key={id}
              draggable={Boolean(ctx)}
              onDragStart={(e) => {
                if (!ctx) return;
                // Si el arrastre empieza durante los 3 segundos de pulsación
                // mantenida, es que la intención era reordenar, no ocultar.
                soltarPulsacion();
                e.dataTransfer.setData("text/plain", id);
                e.dataTransfer.effectAllowed = "move";
                ctx.setArrastrando(id);
              }}
              onDragEnd={() => ctx?.setArrastrando(null)}
              onDragOver={(e) => {
                if (!ctx?.arrastrando || ctx.arrastrando === id) return;
                e.preventDefault();
                setEncimaDe(id);
              }}
              onDragLeave={() => setEncimaDe((actual) => (actual === id ? null : actual))}
              onDrop={(e) => {
                e.preventDefault();
                setEncimaDe(null);
                const origen = e.dataTransfer.getData("text/plain") || ctx?.arrastrando;
                if (ctx && origen && origen !== id) ctx.soltarSobre(origen, id);
              }}
              className={ctx ? "cursor-grab active:cursor-grabbing" : ""}
            >
              {/*
                Siempre el mismo <a>, oculta o no — nunca un <button> que la
                sustituya. Si el elemento cambiara de tipo justo cuando la
                pulsación mantenida dispara el ocultado, React lo desmonta y
                monta uno nuevo en su lugar; el mouseup que sigue (el usuario
                todavía no soltó) cae entonces sobre ESE elemento nuevo — el
                "+ Título" que acaba de aparecer — y su clic la reabriría en
                el acto, deshaciendo lo que la pulsación logró. Con un único
                nodo estable, el clic que cierra el gesto siempre golpea el
                mismo elemento cuyo estado (disparada) ya se conoce.

                Oculta: un clic navega a un href que ya no lleva a ningún
                sitio visible, así que se intercepta y reabre. Visible: un
                clic navega de verdad; ocultarla pide una intención más clara
                (doble clic o mantener pulsado 3 segundos), para no confundir
                "quiero leerla" con "quiero quitarla de en medio". El prefijo
                "+" repite el idioma que ya usan los "+ Agregar…" del informe.
              */}
              <a
                href={`#${id}`}
                draggable={false}
                aria-current={!oculto && activa === id ? "true" : undefined}
                aria-label={
                  oculto
                    ? `Mostrar «${titulo}», oculta actualmente`
                    : `${titulo} — doble clic o mantener pulsado para ocultar`
                }
                onMouseDown={() => {
                  if (!oculto) iniciarPulsacion(id);
                }}
                onMouseUp={soltarPulsacion}
                onMouseLeave={soltarPulsacion}
                onDoubleClick={(e) => {
                  if (oculto) return;
                  e.preventDefault();
                  ctx?.ocultar(id);
                }}
                onClick={(e) => alHacerClic(ctx, id, oculto, e)}
                className={claseComun}
              >
                {oculto ? `+ ${titulo}` : titulo}
              </a>
            </li>
          );
        })}
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
  const ctx = useOrden();
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
          {secciones.map(({ id, titulo }) => {
            const oculto = ctx?.oculta(id) ?? false;
            return (
              <li key={id}>
                {oculto ? (
                  <button
                    type="button"
                    onClick={() => {
                      reabrirSeccion(ctx, id);
                      setAbierto(false);
                    }}
                    className="block w-full px-3 py-2 text-left text-sm text-ink-muted"
                  >
                    + {titulo}
                  </button>
                ) : (
                  // Aquí el clic vuelve a ser solo navegación: el doble
                  // clic / mantener pulsado del índice lateral no tiene un
                  // equivalente táctil fiable, y en móvil el "✕" de la
                  // tarjeta ya está siempre visible (ver globals.css,
                  // @media (hover: none)), así que no hace falta un atajo
                  // más aquí.
                  <a
                    href={`#${id}`}
                    onClick={() => setAbierto(false)}
                    className={`block px-3 py-2 text-sm ${
                      activa === id ? "font-medium text-accent" : "text-ink"
                    }`}
                  >
                    {titulo}
                  </a>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/** Encabezado de expediente clínico, visible solo al imprimir/exportar a PDF. */
function PrintOnlyHeader({
  referenciaCaso,
  fecha,
  meta,
}: {
  referenciaCaso: string;
  fecha: string;
  meta: MetaGeneracion;
}) {
  return (
    <div className="print-only-header hidden print:block">
      <div className="print-header-top">
        <div className="print-logo-area">
          <span className="print-logo-text">ACIA</span>
          <span className="print-logo-sub">análisis conductual asistido por IA</span>
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
        <div className="print-meta-item">
          <span className="print-meta-label">Generado con</span>
          <span className="print-meta-value">
            {meta.modelo || "—"} · prompt v{meta.version_prompt || "—"}
          </span>
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
      <div className="print-footer-left">ACIA — análisis conductual asistido por IA</div>
      <div className="print-footer-center">
        Documento confidencial · Solo para uso clínico
      </div>
      <div className="print-footer-right" />
    </div>
  );
}

/** Descargo metodológico final, visible solo al imprimir/exportar a PDF. */
function PrintOnlyDisclaimer({
  fecha,
  meta,
}: {
  fecha: string;
  meta: MetaGeneracion;
}) {
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
        Generado con ACIA — análisis conductual asistido por IA · {fecha}
        {meta.modelo ? ` · ${meta.modelo} · prompt v${meta.version_prompt}` : ""}
      </p>
    </div>
  );
}

/**
 * Leyenda de confianza flotante: se queda fija en pantalla mientras el
 * usuario scrollea el informe. Se puede minimizar/reabrir con el ícono.
 *
 * Es un recordatorio, no la definición: una línea por nivel y un enlace a la
 * tarjeta «Niveles de confianza», que es donde vive el texto completo. Antes
 * repetía las definiciones largas aquí, y un panel flotante con tres párrafos
 * tapa el informe justo cuando se está leyendo.
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
          <ul className="space-y-1.5">
            {NIVELES_CONFIANZA.map(({ nivel, etiqueta, clase, corta }) => (
              <li key={nivel} className="flex items-baseline gap-2">
                <span
                  aria-hidden="true"
                  className={`h-2 w-2 shrink-0 translate-y-[-1px] rounded-full ${clase}`}
                />
                <p className="text-xs leading-relaxed text-ink-muted">
                  <span className="font-semibold text-ink">{etiqueta}: </span>
                  {corta}
                </p>
              </li>
            ))}
          </ul>
          <div className="mt-3 border-t border-divider pt-2">
            <a
              href="#niveles-confianza"
              onClick={(evento) => {
                evento.preventDefault();
                document
                  .getElementById("niveles-confianza")
                  ?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
              className="text-xs text-accent transition-colors hover:underline"
            >
              Ver definición completa →
            </a>
          </div>
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

/**
 * El proveedor va fuera del cuerpo del informe para que tanto los bloques como
 * el índice lean el mismo orden: el índice lo necesita desde arriba, y un
 * componente no puede consumir un contexto que él mismo abre.
 */
export default function ReportView(props: ReportViewProps) {
  return (
    <ProveedorOrden idsPorDefecto={IDS_SECCIONES}>
      <InformeOrdenable {...props} />
    </ProveedorOrden>
  );
}

function InformeOrdenable({
  analisis,
  referenciaCaso,
  onReferenciaCasoChange,
  fecha,
  notaOriginal,
  onAnalisisActualizado,
  onEditarSeccion,
}: ReportViewProps) {
  const orden = useOrden();

  // El índice enseña los bloques en el orden en que están en pantalla, no en el
  // de fábrica: si el clínico sube «Riesgo», también sube en el índice.
  const seccionesVisibles = useMemo(() => {
    const visibles = SECCIONES.filter((s) => bloqueVisible(analisis, s.id));
    if (!orden) return visibles;
    return orden
      .ordenar(visibles.map((s) => s.id))
      .map((id) => visibles.find((s) => s.id === id))
      .filter((s): s is SeccionIndice => s !== undefined);
  }, [analisis, orden]);
  const ids = useMemo(() => seccionesVisibles.map((s) => s.id), [seccionesVisibles]);
  const activa = useSeccionActiva(ids);

  /*
    La lente vive en localStorage y no en el estado del componente: es una
    preferencia de lectura del terapeuta, no del informe. useLente ya la acota a
    las capas que este análisis generó, así que una preferencia guardada que
    aquí no exista cae en la primera disponible sin pasar por un fotograma con
    la pestaña que no está.
  */
  const grafoBaseDisponible = hayGrafoBase(analisis);
  const estilosDisponibles = grafoBaseDisponible ? ESTILOS_GRAFO : ["afc" as const];
  const { lente: pestanaActiva, elegirLente } = useLente(
    estilosDisponibles as EstiloGrafo[],
    referenciaCaso
  );

  const prosaDerivada = useMemo(() => derivarVistasProsa(analisis), [analisis]);
  const hipotesisDestacada = prosaDerivada.destacada;
  const analisisConProsa = useMemo(
    () => ({
      ...analisis,
      resumen_clinico: prosaDerivada.resumen,
      hipotesis_mantenimiento: prosaDerivada.hipotesis,
    }),
    [analisis, prosaDerivada]
  );

  const valorEdicion = useMemo(
    () => ({ seccionesEditadas: analisis.secciones_editadas }),
    [analisis.secciones_editadas]
  );

  return (
    <ReanalisisContext.Provider
      value={{ notaOriginal, analisis, onAnalisisActualizado }}
    >
    <ProveedorEdicion valor={valorEdicion}>
    <div className="rounded-md border border-divider bg-surface px-5 py-6 shadow-sm sm:px-8 sm:py-8 lg:px-12 lg:py-10 print:rounded-none print:border-none print:px-0 print:py-0 print:shadow-none">
      <PrintOnlyHeader referenciaCaso={referenciaCaso} fecha={fecha} meta={analisis.meta} />
      <PrintOnlyFooter />

      {/* Va dentro del informe y no en la página que lo envuelve para que
          acompañe a todo informe, sea el real o el de ejemplo, sin depender de
          que quien monte una pantalla nueva se acuerde de ponerlo. Los
          márgenes negativos lo sacan del acolchado de la tarjeta: la franja
          llega de borde a borde, como la de ejemplo. */}
      <div className="-mx-5 -mt-6 mb-6 sm:-mx-8 sm:-mt-8 lg:-mx-12 lg:-mt-10 print:mx-0 print:mt-0">
        <FranjaDocumento rotulo="ACIA — documento generado con IA">
          Documento de apoyo a la formulación clínica, generado con asistencia
          de IA a partir de la información registrada por el profesional. No
          constituye un diagnóstico ni sustituye el juicio clínico: requiere
          validación profesional antes de cualquier uso terapéutico.
        </FranjaDocumento>
      </div>

      <header className="mb-6 border-b border-divider pb-5 print:hidden">
        <p className="font-mono text-xs uppercase tracking-[0.15em] text-accent">
          Expediente · Análisis funcional
        </p>
        <h1 className="mt-1 font-serif text-2xl font-semibold text-ink sm:text-3xl">
          ACIA — análisis conductual asistido por IA
        </h1>
        <div className="mt-4 flex flex-wrap items-center gap-x-8 gap-y-3 text-sm text-ink-muted">
          <p>
            Fecha de generación: <span className="text-ink">{fecha}</span>
          </p>
          {analisis.meta.modelo && (
            <p className="print:hidden">
              Generado con:{" "}
              <span className="text-ink">
                {analisis.meta.modelo} · prompt v{analisis.meta.version_prompt}
              </span>
            </p>
          )}
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
        <div className="mt-4 border-t border-divider pt-4">
          <SelectorDeLente
            activa={pestanaActiva}
            onChange={elegirLente}
            habilitaLecturas={grafoBaseDisponible}
          />
        </div>
        <div className="mt-3 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
          <p className="text-xs text-ink-muted">
            Puedes arrastrar los bloques para ordenarlos a tu gusto.
          </p>
          <BotonRestaurarOrden />
        </div>
      </header>

      <IndiceMovil secciones={seccionesVisibles} activa={activa} />

      <div className="lg:flex lg:items-start lg:gap-10">
        <IndiceLateral secciones={seccionesVisibles} activa={activa} />

        {/* flex-col: los bloques se reordenan con `order` de CSS, sin moverse
            del árbol de React. Ver components/ordenBloques.tsx. */}
        <div className="flex min-w-0 flex-1 flex-col">
          <BloqueSintesis
            visible={bloqueVisible(analisis, "sintesis")}
            analisis={analisis}
            destacada={hipotesisDestacada}
            resumen={prosaDerivada.resumen}
            onEditarSeccion={onEditarSeccion}
          />

          <BloqueAnalisisFuncional
            visible={bloqueVisible(analisis, "que-pasa")}
            analisis={analisis}
            notaOriginal={notaOriginal}
            estilo={pestanaActiva}
            onEditarSeccion={onEditarSeccion}
          />

          <BloqueMantenimiento
            visible={bloqueVisible(analisis, "mantenimiento")}
            analisis={analisis}
            analisisConProsa={analisisConProsa}
            hipotesis={prosaDerivada.hipotesis}
            onEditarSeccion={onEditarSeccion}
          />

          <BloquePlan
            visible={bloqueVisible(analisis, "plan")}
            analisis={analisis}
            onEditarSeccion={onEditarSeccion}
          />

          <BloquePendientes
            visible={bloqueVisible(analisis, "pendientes")}
            analisis={analisis}
            onEditarSeccion={onEditarSeccion}
          />

        </div>
      </div>

      <footer className="mt-6 rounded-md border border-divider bg-canvas p-4 text-xs leading-relaxed text-ink-muted print:hidden">
        Este análisis es una síntesis asistida de hipótesis funcionales generadas a
        partir de las notas proporcionadas. No constituye un diagnóstico ni
        sustituye el juicio clínico profesional. Toda hipótesis debe verificarse
        mediante evaluación directa.
      </footer>

      <PrintOnlyDisclaimer fecha={fecha} meta={analisis.meta} />
      <LeyendaConfianzaFlotante />
    </div>
    </ProveedorEdicion>
    </ReanalisisContext.Provider>
  );
}
