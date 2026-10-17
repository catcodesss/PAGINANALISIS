"use client";

/**
 * Raíl izquierdo: el índice vivo del caso. Conductas con su apoyo, hipótesis
 * con su estado, blancos con revisión y fase, preguntas abiertas, recursos y
 * valores, la historia (hipótesis de origen) y el contexto (resumen clínico).
 *
 * Pulsar un elemento lo enfoca: una conducta, en el Mapa; una hipótesis o una
 * pregunta, en el Inspector; un blanco, en la vista Blancos. Absorbe lo que
 * antes repartían Resumen, Formulación y Revisión, sin copiarlo: cada cosa sale
 * una vez y lleva a su sitio.
 *
 * Por debajo de 1440 px se pliega a iconos; el botón de arriba lo fuerza.
 * Las anclas de los apartados (`preguntas`, `hipotesis-mantenimiento`…) viven
 * aquí: son los ids que guardan `secciones_editadas` y que nombran los avisos
 * (lib/secciones.ts#DONDE_SE_VE).
 */

import { useMemo, useState, type ReactNode } from "react";
import {
  Activity,
  BookOpen,
  GitBranch,
  Hourglass,
  PanelLeftClose,
  PanelLeftOpen,
  ScrollText,
  Sprout,
  Target,
  type LucideIcon,
} from "lucide-react";
import type { AnalisisFuncional } from "@/lib/types";
import { construirNodosGrafo } from "@/lib/grafo";
import { alertasPorNodo } from "@/lib/alertasNodo";
import { estaAbierta, ETIQUETA_ESTADO_HIPOTESIS, nuevoIdPregunta, rotuloHipotesis } from "@/lib/preguntas";
import { estadoDeBlanco, textoDeEstadoBlanco } from "@/lib/plan";
import { InsigniaAlerta } from "../grafo/InsigniaAlerta";
import { etiquetaApoyo } from "../grafo/etiquetasNodo";
import { ListaEditable } from "../informe/primitivas";
import { SelloNoModificable } from "../informe/mantenimiento";
import { useAccionesSeccion } from "../informe/seccion";
import { BotonAgregar, TextoEditable } from "../edicionManual";
import type { EditarSeccion } from "../informe/PreguntasClinicas";
import s from "../grafo/afc.module.css";
import { useEspacio } from "./contexto";
import { irADestino } from "./navegar";

export default function Rail({
  analisis,
  analisisConProsa,
  onEditarSeccion,
  apilado = false,
}: {
  analisis: AnalisisFuncional;
  analisisConProsa: AnalisisFuncional;
  onEditarSeccion: EditarSeccion;
  /** En el móvil va apilado encima de la vista, a todo el ancho y sin plegar. */
  apilado?: boolean;
}) {
  const espacio = useEspacio();
  // null: lo decide el ancho de pantalla; true/false: lo forzó el clínico.
  const [abierto, setAbierto] = useState<boolean | null>(null);
  const nodos = useMemo(() => construirNodosGrafo(analisis), [analisis]);
  const avisosNodo = useMemo(() => alertasPorNodo(analisis), [analisis]);
  const preguntasAbiertas = analisis.preguntas.filter(estaAbierta);

  const ancho = apilado
    ? "w-full"
    : abierto === null ? "w-14 min-[1440px]:w-60" : abierto ? "w-60" : "w-14";
  // Las etiquetas se esconden cuando el raíl está plegado a iconos.
  const texto = apilado
    ? "block"
    : abierto === null ? "hidden min-[1440px]:block" : abierto ? "block" : "hidden";

  const accionesHipotesis = useAccionesSeccion("hipotesis-mantenimiento", "Hipótesis de mantenimiento", ["hipotesis_mantenimiento", "hipotesis_alternativas"]);
  const accionesPreguntas = useAccionesSeccion("verificacion", "Preguntas abiertas", ["preguntas"]);
  const accionesOrigen = useAccionesSeccion("hipotesis-origen", "Hipótesis de origen", ["hipotesis_origen"]);
  const accionesFormulacion = useAccionesSeccion("formulacion", "Recursos y valores", ["fortalezas_y_recursos", "valores_y_metas", "perdida_de_reforzadores", "formulacion"]);
  const accionesResumen = useAccionesSeccion("resumen", "Resumen clínico", ["resumen_clinico"]);

  // Apilado (móvil) hay otro raíl en el DOM: las anclas solo van en uno, o
  // habría ids repetidos y un enlace no sabría a cuál llevar.
  const ancla = (id: string) => (apilado ? undefined : id);
  const ir = (vista: "mapa" | "blancos", id: string) => irADestino({ vista, id }, espacio);

  return (
    <nav
      aria-label="Raíl del caso"
      className={`${ancho} flex shrink-0 flex-col bg-canvas transition-[width] duration-150 print:hidden ${apilado ? "" : "h-full border-r border-divider"}`}
    >
      <div className={`${apilado ? "hidden" : "flex"} justify-end p-1.5`}>
        <button
          type="button"
          onClick={() => setAbierto((v) => !(v ?? false))}
          aria-label={abierto ? "Plegar el raíl" : "Desplegar el raíl"}
          className="rounded p-1 text-ink-muted hover:bg-surface hover:text-ink"
        >
          {abierto ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
        </button>
      </div>

      <div className={`min-h-0 flex-1 space-y-1 overflow-y-auto ${apilado ? "pb-2" : "pb-12"}`}>
        <Grupo id={ancla("conductas-rail")} icono={Activity} titulo="Conductas" contador={analisis.conductas_problema.length} texto={texto}>
          {analisis.conductas_problema.map((c) => {
            const nodo = nodos.find((n) => n.id === c.id);
            const avisos = avisosNodo.get(c.id) ?? [];
            return (
              <Elemento key={c.id} activo={espacio.seleccionado === c.id} onElegir={() => ir("mapa", c.id)}>
                <span className="flex items-baseline gap-1.5">
                  {nodo && <span aria-hidden="true" data-apoyo={nodo.apoyo} className={`${s.marcaApoyo} !h-1.5 !w-1.5 shrink-0 rounded-full`} title={etiquetaApoyo(nodo.apoyo)} />}
                  <span className="min-w-0">{c.descripcion}</span>
                </span>
                {avisos.length > 0 && <InsigniaAlerta alertas={avisos} className="mt-1" />}
              </Elemento>
            );
          })}
        </Grupo>

        <Grupo id={ancla("hipotesis-mantenimiento")} icono={GitBranch} titulo="Hipótesis" contador={analisis.hipotesis_mantenimiento.length} texto={texto} menu={accionesHipotesis.menu} panel={accionesHipotesis.panel}>
          {analisisConProsa.hipotesis_mantenimiento.map((h, i) => {
            const avisos = analisis.alertas.filter((a) => a.ruta === `hipotesis_mantenimiento[${i}]`);
            return (
              <Elemento key={h.id} activo={espacio.seleccionado === h.id} onElegir={() => espacio.seleccionar(h.id)}>
                <span className="block">{rotuloHipotesis(h)}</span>
                <span className="font-mono text-[10px] uppercase tracking-wide text-ink-muted">{ETIQUETA_ESTADO_HIPOTESIS[h.estado]}</span>
                {avisos.length > 0 && <InsigniaAlerta alertas={avisos} className="mt-1" />}
              </Elemento>
            );
          })}
        </Grupo>

        <Grupo id={ancla("blancos-rail")} icono={Target} titulo="Blancos" contador={analisis.conductas_problema.length} texto={texto}>
          {analisis.conductas_problema.map((c) => (
            <Elemento key={c.id} activo={false} onElegir={() => ir("blancos", c.id)}>
              <span className="block">{c.descripcion}</span>
              <span className="font-mono text-[10px] uppercase tracking-wide text-ink-muted">{textoDeEstadoBlanco(estadoDeBlanco(analisis, c.id))}</span>
            </Elemento>
          ))}
        </Grupo>

        <Grupo id={ancla("preguntas")} icono={Hourglass} titulo="Preguntas abiertas" contador={preguntasAbiertas.length} texto={texto} menu={accionesPreguntas.menu} panel={accionesPreguntas.panel}>
          {preguntasAbiertas.map((p) => (
            <Elemento key={p.id} activo={espacio.seleccionado === p.id} onElegir={() => espacio.seleccionar(p.id)}>
              {p.texto}
            </Elemento>
          ))}
          <div className="px-3">
            <BotonAgregar
              etiqueta="pregunta"
              onAgregar={(t) =>
                onEditarSeccion("verificacion", (c) => {
                  c.preguntas = [
                    ...c.preguntas,
                    { id: nuevoIdPregunta(c.preguntas), texto: t, hipotesis: "", pone_a_prueba: null, dato_faltante: "", decision: "", origen: "clinico", estado: "abierta" },
                  ];
                })
              }
            />
          </div>
        </Grupo>

        <Grupo id={ancla("formulacion")} icono={Sprout} titulo="Recursos y valores" contador={analisis.fortalezas_y_recursos.length + analisis.valores_y_metas.length} texto={texto} menu={accionesFormulacion.menu} panel={accionesFormulacion.panel} plegadoDeInicio>
          <Lista titulo="Fortalezas y recursos">
            <ListaEditable items={analisis.fortalezas_y_recursos} seccionId="formulacion" etiqueta="fortaleza o recurso" claseItem="text-xs leading-relaxed text-ink" onCambiar={(n) => onEditarSeccion("formulacion", (c) => { c.fortalezas_y_recursos = n; })} />
          </Lista>
          <Lista titulo="Valores y metas">
            <ListaEditable items={analisis.valores_y_metas} seccionId="formulacion" etiqueta="valor o meta" claseItem="text-xs leading-relaxed text-ink" onCambiar={(n) => onEditarSeccion("formulacion", (c) => { c.valores_y_metas = n; })} />
          </Lista>
        </Grupo>

        <Grupo id={ancla("hipotesis-origen")} icono={ScrollText} titulo="Historia" contador={analisis.hipotesis_origen.length} texto={texto} menu={accionesOrigen.menu} panel={accionesOrigen.panel} plegadoDeInicio>
          <div className="px-3">
            <SelloNoModificable />
            <ListaEditable items={analisis.hipotesis_origen} seccionId="hipotesis-origen" etiqueta="hipótesis de origen" claseItem="text-xs italic leading-relaxed text-ink-muted" onCambiar={(n) => onEditarSeccion("hipotesis-origen", (c) => { c.hipotesis_origen = n; })} />
          </div>
        </Grupo>

        <Grupo id={ancla("resumen")} icono={BookOpen} titulo="Contexto" texto={texto} menu={accionesResumen.menu} panel={accionesResumen.panel} plegadoDeInicio>
          <div className="space-y-3 px-3">
            {analisisConProsa.resumen_clinico && (
              <TextoEditable valor={analisisConProsa.resumen_clinico} seccionId="resumen" etiqueta="Resumen clínico" className="text-xs leading-relaxed text-ink" onCambio={(v) => onEditarSeccion("resumen", (c) => { c.resumen_clinico = v; })} />
            )}
            {analisis.formulacion.relaciones_entre_problemas.length > 0 && (
              <Lista titulo="Relaciones entre problemas">
                <ul className="list-disc space-y-1 pl-4 text-xs leading-relaxed text-ink">
                  {analisis.formulacion.relaciones_entre_problemas.map((r, i) => <li key={i}>{r}</li>)}
                </ul>
              </Lista>
            )}
            <Lista titulo="Pérdida de reforzadores">
              <ListaEditable items={analisis.perdida_de_reforzadores} seccionId="formulacion" etiqueta="reforzador perdido" claseItem="text-xs leading-relaxed text-ink" onCambiar={(n) => onEditarSeccion("formulacion", (c) => { c.perdida_de_reforzadores = n; })} />
            </Lista>
          </div>
        </Grupo>
      </div>
    </nav>
  );
}

function Grupo({
  id,
  icono: Icono,
  titulo,
  contador,
  texto,
  menu,
  panel,
  plegadoDeInicio = false,
  children,
}: {
  id: string | undefined;
  icono: LucideIcon;
  titulo: string;
  contador?: number;
  /** Clases que esconden el texto cuando el raíl está plegado. */
  texto: string;
  menu?: ReactNode;
  panel?: ReactNode;
  plegadoDeInicio?: boolean;
  children: ReactNode;
}) {
  const [abierto, setAbierto] = useState(!plegadoDeInicio);
  return (
    <section id={id} className="scroll-mt-4">
      <div className="flex items-center gap-1 px-1.5">
        <button
          type="button"
          aria-expanded={abierto}
          onClick={() => setAbierto((v) => !v)}
          title={titulo}
          className="flex min-w-0 flex-1 items-center gap-2 rounded px-1.5 py-1.5 text-left text-xs font-medium text-ink hover:bg-surface"
        >
          <Icono className="h-4 w-4 shrink-0 text-ink-muted" aria-hidden="true" />
          <span className={`${texto} min-w-0 flex-1 truncate`}>{titulo}</span>
          {contador !== undefined && <span className={`${texto} font-mono text-[10px] text-ink-muted`}>{contador}</span>}
        </button>
        {menu && <span className={texto}>{menu}</span>}
      </div>
      {abierto && <div className={`${texto} space-y-0.5 pb-2`}>{children}</div>}
      {panel && <div className={`${texto} px-3`}>{panel}</div>}
    </section>
  );
}

function Elemento({
  activo,
  onElegir,
  children,
}: {
  activo: boolean;
  onElegir: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onElegir}
      aria-current={activo ? "true" : undefined}
      className={`block w-full px-3 py-1.5 text-left text-xs leading-snug text-ink transition-colors hover:bg-surface ${activo ? "border-l-2 border-accent bg-surface" : "border-l-2 border-transparent"}`}
    >
      {children}
    </button>
  );
}

function Lista({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div className="px-3">
      <p className="mb-1 font-mono text-[10px] uppercase tracking-wide text-ink-muted">{titulo}</p>
      {children}
    </div>
  );
}
