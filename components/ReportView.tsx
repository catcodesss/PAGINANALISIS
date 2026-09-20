"use client";

import {
  Children,
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
  ConductaProblema,
  MetaGeneracion,
  ModeloTerapeutico,
  Situacion,
  TipoEslabonDBT,
  VariableModuladora,
} from "@/lib/types";
import { ETIQUETA_ESQUEMA } from "@/lib/types";
import {
} from "@/lib/pii";
import {
  ProveedorEdicion,
} from "./edicionManual";
import { situacionDeLaCadenaDBT } from "@/lib/identidad";
import {
  calcularCobertura,
  DIMENSIONES,
  ETIQUETA_DIMENSION,
  ETIQUETA_NIVEL,
  NIVELES,
} from "@/lib/cobertura";
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
  Chip,
  Cita,
  Confianza,
  SinHallazgos,
  SubSeccion,
  TablaCadena,
  type FilaCadena,
} from "./informe/primitivas";
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




/**
 * Una columna del repertorio conductual. El título va arriba con su definición
 * en una línea: sin ella, "Excesos / Déficits / Activos" son tres etiquetas que
 * cada clínico interpreta a su manera, y la distinción que sostiene la columna
 * —adquisición frente a generalización— se pierde justo donde tenía que
 * decidirse.
 *
 * Una columna vacía dice por qué lo está en vez de quedarse en blanco: que la
 * nota no recoja ningún activo es un dato sobre la nota, no sobre la persona.
 */
export function ColumnaRepertorio({
  titulo,
  descripcion,
  vacio,
  children,
}: {
  titulo: string;
  descripcion: string;
  vacio: string;
  children: ReactNode;
}) {
  const items = Children.toArray(children);
  return (
    <div className="min-w-0">
      <h3 className="font-mono text-xs uppercase tracking-wide text-ink-muted">
        {titulo}
      </h3>
      <p className="mt-1 border-b border-divider pb-2 text-sm leading-relaxed text-ink-muted">
        {descripcion}
      </p>
      {items.length === 0 ? (
        <p className="mt-3 text-sm italic text-ink-muted">{vacio}</p>
      ) : (
        <ul className="mt-3 space-y-4">{items}</ul>
      )}
    </div>
  );
}

/** Una conducta problema dentro de su columna (exceso o déficit). */
export function ConductaProblemaItem({ conducta }: { conducta: ConductaProblema }) {
  return (
    <li>
      <div className="flex flex-wrap gap-2">
        <Chip>{conducta.tipo}</Chip>
        <Chip>importancia {conducta.importancia}</Chip>
        {conducta.es_conducta_seguridad && <Chip>conducta de seguridad</Chip>}
      </div>
      <p className="mt-1 text-[15px] leading-relaxed text-ink">
        {conducta.descripcion}
      </p>
      {conducta.justificacion_deficit && (
        <p className="mt-1 text-sm leading-relaxed text-ink-muted">
          {conducta.justificacion_deficit}
        </p>
      )}
      <Cita>{conducta.evidencia}</Cita>
    </li>
  );
}



/**
 * La rejilla de contexto y procesos: 3 niveles × 6 dimensiones.
 *
 * Por qué una rejilla y no una lista agrupada: con la clasificación anterior
 * —biológica / historia de aprendizaje / contextual— las categorías que el
 * informe no usaba simplemente no aparecían, y no aparecer se lee como "aquí no
 * había nada que decir". Cruzando los dos ejes, las 18 combinaciones están
 * siempre a la vista y una celda vacía se ve como lo que es: una intersección
 * sobre la que nadie ha registrado nada.
 *
 * UNA CELDA VACÍA ES INFORMACIÓN SOBRE LA EVALUACIÓN, NO SOBRE LA PERSONA.
 * Puede que no haya nada que registrar, o puede que nadie lo haya preguntado, y
 * esas dos cosas no se distinguen mirando la rejilla: se distinguen
 * preguntando. Por eso el hueco enlaza con la sección de verificación en vez de
 * presentarse como un resultado del análisis.
 *
 * El indicador de arriba se llama COBERTURA DE DATOS y nunca "confianza": una
 * rejilla llena de datos malos no vale más que una incompleta con datos buenos.
 * Ver lib/cobertura.ts.
 *
 * El momento (histórico / actual) va como etiqueta dentro de la celda y no como
 * un tercer eje de la tabla: una rejilla de tres dimensiones no se lee en una
 * pantalla, y el momento es un matiz de cada variable, no un sitio donde
 * buscarla.
 */
export function RejillaContexto({ variables }: { variables: VariableModuladora[] }) {
  const cobertura = useMemo(() => calcularCobertura(variables), [variables]);

  return (
    <div>
      <div className="mb-4 rounded-md border border-divider bg-canvas px-4 py-3 print:border-black">
        <p className="font-mono text-[10px] uppercase tracking-wide text-ink-muted">
          Cobertura de datos · {cobertura.conDato} de {cobertura.totales} celdas
        </p>
        <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">
          Cuenta casillas con algo escrito, nada más. No mide la calidad del
          análisis: una rejilla llena de datos flojos no vale más que una
          incompleta con datos buenos. Una celda vacía dice que en esa
          intersección no se ha registrado nada — puede que no haya nada, o puede
          que no se haya preguntado, y eso se resuelve preguntando.
        </p>
      </div>

      {/* En un móvil no caben seis columnas: la tabla se desplaza dentro de su
          propio contenedor, sin arrastrar de lado al resto del informe. */}
      <div className="w-full overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse text-left">
          <caption className="sr-only">
            Variables moduladoras cruzadas por nivel (filas) y dimensión de
            proceso (columnas). Las celdas sin variables se marcan como huecos.
          </caption>
          <thead>
            <tr>
              <th className="border-b border-divider px-2 py-2 font-mono text-[10px] uppercase tracking-wide text-ink-muted">
                Nivel / Dimensión
              </th>
              {DIMENSIONES.map((d) => (
                <th
                  key={d}
                  scope="col"
                  className="border-b border-divider px-2 py-2 font-mono text-[10px] uppercase tracking-wide text-ink-muted"
                >
                  {ETIQUETA_DIMENSION[d]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {NIVELES.map((nivel) => (
              <tr key={nivel} className="align-top">
                <th
                  scope="row"
                  className="w-[110px] border-b border-divider px-2 py-3 font-mono text-[10px] uppercase tracking-wide text-ink"
                >
                  {ETIQUETA_NIVEL[nivel]}
                </th>
                {DIMENSIONES.map((dimension) => {
                  const celda = cobertura.celdas.find(
                    (c) => c.nivel === nivel && c.dimension === dimension
                  );
                  const vacia = !celda || celda.variables.length === 0;
                  return (
                    <td
                      key={dimension}
                      className="border-b border-divider px-2 py-3"
                    >
                      {vacia ? (
                        /*
                          El hueco se marca, no se deja en blanco: una casilla
                          en blanco se lee como "aquí no hay nada que decir", y
                          lo que dice de verdad es que nadie ha registrado nada.
                          La palabra "hueco" lleva el significado, no el color:
                          en blanco y negro y con lector de pantalla se lee
                          igual.
                        */
                        <a
                          href="#verificacion"
                          className="font-mono text-[10px] uppercase tracking-wide text-ink-muted underline decoration-dotted underline-offset-2 transition-colors hover:text-warn print:no-underline"
                        >
                          Hueco
                        </a>
                      ) : (
                        <ul className="space-y-2">
                          {celda.variables.map((v, i) => (
                            <li key={i}>
                              <p className="text-sm leading-relaxed text-ink">
                                {v.descripcion}
                              </p>
                              <p className="mt-0.5 font-mono text-[10px] uppercase tracking-wide text-ink-muted">
                                {v.momento === "historico"
                                  ? "histórica"
                                  : "actual"}{" "}
                                · modificabilidad {v.modificabilidad}
                              </p>
                              <Cita>{v.evidencia}</Cita>
                            </li>
                          ))}
                        </ul>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {cobertura.huecos.length > 0 && (
        <p className="mt-3 text-sm leading-relaxed text-ink-muted">
          Hay {cobertura.huecos.length} celdas sin dato. Si alguna de esas
          intersecciones importa en este caso, la pregunta va a{" "}
          <a
            href="#verificacion"
            className="text-accent underline underline-offset-2 print:no-underline"
          >
            Datos faltantes y puntos a verificar
          </a>
          .
        </p>
      )}
    </div>
  );
}

/** Una caja de la cadena visual (antecedente / respuesta / consecuencia / estímulo). */

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
  filas.push({ elemento: "C", valor: cadena.consecuencia.texto });
  /*
    El esquema va en la misma fila que la contingencia, no en una propia: son
    las dos mitades del mismo dato —qué pasa tras la respuesta y cada cuánto
    pasa— y separarlas invitaría a leer solo la primera, que es justo el
    descuido que este campo existe para evitar.
  */
  filas.push({
    elemento: "Consecuencia",
    valor: `${codigo} (${cadena.tipo_contingencia}, ${cadena.inmediatez}, ${ETIQUETA_ESQUEMA[cadena.esquema_de_contingencia]})`,
  });
  /*
    La consecuencia clínica del esquema intermitente se escribe, no se deja a
    que el lector la recuerde: es lo que decide cuánta exposición hace falta, y
    va donde se toma esa decisión. Con "continua" y "no_determinable" no se
    dice nada — una nota que repita lo obvio o que rellene un hueco donde no
    hay dato le resta peso a la que sí importa.
  */
  if (cadena.esquema_de_contingencia === "intermitente") {
    filas.push({
      elemento: "Resistencia",
      valor:
        "El refuerzo intermitente sostiene el patrón mucho más que uno continuo: cuenta con más resistencia a la extinción y, por tanto, con más dosis de exposición de la que pediría esta misma cadena en esquema continuo.",
    });
  }
  if (cadena.consecuencias_largo_plazo) {
    filas.push({
      elemento: "CMLP",
      valor: cadena.consecuencias_largo_plazo.texto,
    });
  }

  return (
    <div>
      <p className="mb-2 font-serif text-[15px] font-bold text-ink">
        Cadena operante (CO)
      </p>
      <TablaCadena filas={filas} />
      <NotacionCadena
        formula={`ED → RO → ${codigo}`}
        natural={`${cadena.antecedente} → ${cadena.respuesta} → ${cadena.consecuencia.texto}`}
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

/**
 * La cadena, dibujada: un círculo por eslabón y una flecha al siguiente.
 *
 * Por qué existe: leída como tabla, la cadena es una lista de filas y se
 * pierde justo lo que la hace útil — que es una secuencia, que cada eslabón
 * lleva al siguiente y que ahí, entre dos círculos, es donde se puede
 * intervenir. El dibujo lo enseña de un vistazo.
 *
 * NO sustituye a la tabla, la precede. La tabla es el texto completo y es lo
 * que viaja al papel: un gráfico que esconde el detalle hasta que lo pulsas no
 * sirve impreso, ni para quien lea con lector de pantalla. Por eso cada
 * círculo lleva su texto entero en `aria-label` y el gráfico no se imprime.
 *
 * El color no distingue tipos de eslabón. MARCA.md reserva el ámbar para "hay
 * que mirarlo" y el gris para "es inferencia"; inventar cinco colores para
 * pensamiento/emoción/sensación/impulso/acción rompería ese código por una
 * distinción decorativa. Los tipos se distinguen por la inicial dentro del
 * círculo, que además sobrevive en blanco y negro y a un daltonismo.
 */
const INICIAL_ESLABON: Record<TipoEslabonDBT, string> = {
  pensamiento: "P",
  emocion: "E",
  sensacion: "S",
  impulso: "I",
  accion: "A",
};

interface NodoCadena {
  rol: string;
  texto: string;
  /** Lo que va dentro del círculo. */
  simbolo: string;
  /** El eslabón problema se marca en ámbar: es el blanco, no un paso más. */
  destacado?: boolean;
}

function CadenaVisual({ nodos }: { nodos: NodoCadena[] }) {
  // Antes solo el eslabón activo mostraba su texto (había que mantener
  // pulsado cada círculo, uno por uno, para leerlos todos) y la cadena
  // corría en horizontal con scroll, así que nunca se veía entera. Ahora se
  // lee de arriba abajo, con el texto de cada eslabón siempre a la vista:
  // "activo" ya no decide qué se muestra, solo cuál queda resaltado.
  const [activo, setActivo] = useState<number | null>(null);

  return (
    <ol className="cadena-visual mb-4 flex flex-col print:hidden">
      {nodos.map((n, i) => (
        <li key={i} className="flex gap-3">
          <div className="flex flex-col items-center">
            <button
              type="button"
              // El nombre accesible es solo el rol: el texto ya está en el
              // párrafo de al lado, en el orden natural de lectura, así que
              // repetirlo aquí duplicaría todo para quien use lector de
              // pantalla.
              aria-label={`Resaltar «${n.rol}»`}
              aria-pressed={activo === i}
              onClick={() => setActivo((a) => (a === i ? null : i))}
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 font-mono text-sm font-bold outline-none transition-all focus-visible:ring-2 focus-visible:ring-accent/40 ${
                activo === i
                  ? "texto-sobre-acento scale-110 border-accent bg-accent"
                  : n.destacado
                    ? "border-warn bg-canvas text-warn"
                    : "border-divider bg-canvas text-ink-muted hover:border-accent hover:text-accent"
              }`}
            >
              {n.simbolo}
            </button>
            {/*
              El "eslabón" entre dos círculos: una barra ancha y redondeada,
              no una línea fina con una flecha encima. Se mete un poco por
              detrás del círculo de arriba y del de abajo (-mt-1/-mb-1) para
              que parezca ensartada en el aro, no solo pegada a su borde —
              el mismo efecto de "encaje" que en la referencia, sin sombras
              ni degradados. La flecha ya no hace falta: el orden lo da la
              lectura de arriba abajo y el número delante de cada rol.
            */}
            {i < nodos.length - 1 && (
              <span
                aria-hidden="true"
                className="-mt-1 -mb-1 w-1.5 flex-1 rounded-full bg-divider"
              />
            )}
          </div>
          <div className={`min-w-0 flex-1 ${i < nodos.length - 1 ? "pb-6" : ""}`}>
            <p
              className={`pt-2 font-mono text-[10px] uppercase tracking-wide ${
                activo === i ? "text-accent" : "text-ink-muted"
              }`}
            >
              {n.rol}
            </p>
            <p className="mt-0.5 text-sm leading-relaxed text-ink">{n.texto}</p>
          </div>
        </li>
      ))}
    </ol>
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
      <CadenaVisual
        nodos={[
          {
            rol: "Precipitante",
            texto: cadena.evento_precipitante,
            simbolo: "◆",
          },
          ...cadena.eslabones.map((e, i) => ({
            rol: `${i + 1}. ${e.tipo}`,
            texto: e.descripcion,
            simbolo: INICIAL_ESLABON[e.tipo] ?? "·",
          })),
          {
            rol: "Conducta",
            texto: cadena.conducta_problema,
            simbolo: "✱",
            destacado: true,
          },
          { rol: "Consecuencias", texto: cadena.consecuencias, simbolo: "▸" },
        ]}
      />
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
      className="cycle-box mt-4 rounded-md border border-divider bg-canvas p-4"
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
export function DetalleModalidad({ children }: { children: ReactNode }) {
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

/**
 * Análisis en cadena + habilidades sugeridas (capa DBT).
 *
 * La cadena ya no es un campo propio de la capa. Era `analisis_en_cadena`, una
 * copia literal de la `cadena_dbt` de una de las situaciones, y se pintaba aquí
 * otra vez: el mismo precipitante, los mismos eslabones y las mismas
 * consecuencias que el lector acababa de ver en «Análisis por situaciones», sin
 * nada que obligara a las dos versiones a decir lo mismo. Ahora se muestra la
 * cadena de la situación que analiza la conducta prioritaria, con el mismo
 * componente que la pinta allí.
 */
function DetalleDBT({ analisis }: { analisis: AnalisisFuncional }) {
  const capa = analisis.capa_dbt;
  const situacion = situacionDeLaCadenaDBT(analisis);

  return (
    <div className="space-y-6">
      <SubSeccion titulo="Análisis en cadena">
        {!situacion?.cadena_dbt ? (
          <SinHallazgos />
        ) : (
          <div className="rounded border border-divider p-4">
            <p className="mb-3 text-sm text-ink-muted">
              Cadena de <span className="text-ink">{situacion.nombre}</span>. Es
              la misma que aparece en «Análisis por situaciones»: la capa DBT no
              tiene una cadena propia, sino una lectura de la que ya hay.
            </p>
            <CadenaDBTView cadena={situacion.cadena_dbt} />
          </div>
        )}
      </SubSeccion>

      {/*
        El eslabón ausente va justo después de la cadena y antes de las
        soluciones: si lo relevante es una conducta que NO se emitió, todo lo
        que venga después se lee distinto — la alternativa hábil deja de ser
        "otra cosa que hacer" y pasa a ser "lo que ya sabía hacer y no hizo".
      */}
      {capa.eslabon_ausente && (
        <SubSeccion titulo="Eslabón ausente">
          <p className="text-[15px] leading-relaxed text-ink">
            {capa.eslabon_ausente}
          </p>
        </SubSeccion>
      )}

      {/*
        La mitad terapéutica de la cadena. Sin esto, el análisis en cadena solo
        describe cómo se llegó a la conducta problema — que es exactamente lo
        que el consultante ya sabe.
      */}
      <SubSeccion titulo="Análisis de soluciones">
        {capa.analisis_de_soluciones.length === 0 ? (
          <SinHallazgos />
        ) : (
          <ul className="space-y-4">
            {capa.analisis_de_soluciones.map((s, i) => (
              <li key={i}>
                <div className="flex flex-wrap items-baseline gap-2">
                  {/*
                    El tipo de estrategia no es decorativo: "antecedente" actúa
                    antes de que el eslabón ocurra y "respuesta" cuando ya está
                    ocurriendo. Un plan hecho solo de estrategias de respuesta
                    únicamente sirve cuando ya es tarde, y eso solo se ve si
                    cada solución dice de cuál de las dos es.
                  */}
                  <Chip>
                    {s.tipo_estrategia === "antecedente"
                      ? "antes del eslabón"
                      : "durante el eslabón"}
                  </Chip>
                  <p className="font-mono text-xs uppercase tracking-wide text-ink-muted">
                    {s.eslabon_objetivo}
                  </p>
                </div>
                <p className="mt-1 text-[15px] leading-relaxed text-ink">
                  {s.alternativa_habil}
                </p>
              </li>
            ))}
          </ul>
        )}
      </SubSeccion>

      <SubSeccion titulo="Plan de prevención">
        {capa.plan_de_prevencion.length === 0 ? (
          <SinHallazgos />
        ) : (
          <>
            <p className="mb-2 text-sm leading-relaxed text-ink-muted">
              Actúa sobre las vulnerabilidades que abren la cadena, antes de que
              haya cadena: baja la probabilidad de que el precipitante encuentre
              a la persona en disposición de reaccionar así.
            </p>
            <ul className="list-disc space-y-2 pl-5">
              {capa.plan_de_prevencion.map((p, i) => (
                <li key={i} className="text-[15px] leading-relaxed text-ink">
                  {p}
                </li>
              ))}
            </ul>
          </>
        )}
      </SubSeccion>

      {/*
        Solo aparece si hubo daño real a un tercero. Que la ausencia sea lo
        normal es el punto: un apartado de reparación que siempre está invita a
        rellenarlo, y lo que se rellena por rellenar son disculpas de trámite —
        el gesto superficial que alivia la culpa de quien lo hace y no repara
        nada.
      */}
      {capa.plan_de_reparacion && (
        <SubSeccion titulo="Plan de reparación">
          <p className="text-[15px] leading-relaxed text-ink">
            {capa.plan_de_reparacion}
          </p>
        </SubSeccion>
      )}

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
 * lista todas las capas generadas en vez de una — ver SelectorCapaModalidad.
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

/** Detalle de la capa elegida; en impresión no hay selector, así que se listan todas. */
export function SelectorCapaModalidad({
  analisis,
  pestanaActiva,
}: {
  analisis: AnalisisFuncional;
  pestanaActiva: ModeloTerapeutico;
}) {
  return (
    <div>
      {/* Sin botones aquí: la lente se elige una sola vez, arriba del informe
          (ver SelectorDeLente). */}
      <div className="print:hidden">
        {pestanaActiva === "act" && <DetalleACT capa={analisis.capa_act} />}
        {pestanaActiva === "dbt" && <DetalleDBT analisis={analisis} />}
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
          <DetalleDBT analisis={analisis} />
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

export function SituacionCard({
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
