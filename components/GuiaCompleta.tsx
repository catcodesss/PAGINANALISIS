"use client";

import {
  BookOpenCheck,
  FileText,
  GitBranch,
  Layers,
  Lock,
  MessageCircleQuestion,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import {
  Aviso,
  BloqueComoSeLee,
  BloqueElInforme,
  BloqueLosLimites,
  BloqueQueEscribir,
} from "./guiaContenido";

/**
 * Guía de uso: versión larga, en pantalla completa.
 *
 * Reutiliza los cuatro bloques de la guía rápida y añade glosario, privacidad y
 * preguntas frecuentes. La estructura visual es deliberadamente la misma que la
 * pantalla de análisis —tarjeta principal con cabecera de icono más columna
 * lateral— para que la aplicación se lea como una sola pieza.
 */

const SECCIONES = [
  { id: "escribir", titulo: "Qué escribir", icono: FileText },
  { id: "cadena", titulo: "Cómo se lee tu nota", icono: GitBranch },
  { id: "informe", titulo: "Cómo leer el informe", icono: Layers },
  { id: "limites", titulo: "Qué es y qué no es", icono: ShieldCheck },
  { id: "glosario", titulo: "Glosario", icono: BookOpenCheck },
  { id: "privacidad", titulo: "Privacidad", icono: Lock },
  { id: "preguntas", titulo: "Preguntas frecuentes", icono: MessageCircleQuestion },
];

const GLOSARIO = [
  ["Ed", "Estímulo discriminativo", "La señal que indica que la conducta tendrá consecuencias. No la causa: la anuncia."],
  ["OM", "Operación motivacional", "Lo que hace que una consecuencia importe más o menos en ese momento (mal dormir, hambre, malestar previo)."],
  ["RO", "Respuesta operante", "La conducta observable que emite la persona."],
  ["R+", "Refuerzo positivo", "La conducta aumenta porque aparece algo que la persona busca (atención, acceso, control)."],
  ["R−", "Refuerzo negativo", "La conducta aumenta porque retira o evita algo aversivo. Es el mecanismo de casi toda evitación."],
  ["C+ / C−", "Castigo", "La conducta disminuye, por aparición de algo aversivo o retirada de algo valioso."],
  ["CMLP", "Consecuencia a largo plazo", "El coste acumulado del patrón, distinto de lo que lo mantiene ahora."],
  ["EC / RC", "Condicionamiento clásico", "Estímulo y respuesta condicionados: la activación que aparece sin que la persona decida nada."],
];

const PREGUNTAS = [
  [
    "¿Puedo usar notas de pacientes reales?",
    "Usa siempre iniciales o seudónimos, nunca nombres ni datos de contacto. El texto se envía a la API de OpenAI para generar el análisis, así que trátalo como cualquier otra comunicación de datos clínicos a un tercero.",
  ],
  [
    "¿Por qué a veces dice «Inferido» en vez de mostrar una cita?",
    "Porque esa afirmación no tiene respaldo textual en tu nota. El sistema solo entrecomilla texto recortado literalmente de lo que escribiste; lo demás lo declara como inferencia en lugar de disfrazarlo de cita.",
  ],
  [
    "El informe propone algo que no me convence. ¿Qué hago?",
    "Es lo esperable: son hipótesis para contrastar, no indicaciones. Puedes añadir una nota y reanalizar solo esa sección con el botón que aparece al final de cada apartado.",
  ],
  [
    "¿Por qué el análisis tarda tanto?",
    "Por defecto genera el informe completo, incluidas las tres capas de modalidad (ACT, DBT y conductual), para que puedas alternar entre ellas después sin volver a consultar a la IA. Si solo necesitas una parte, usa la flecha del botón de generar y elige las secciones: es bastante más rápido y más barato.",
  ],
  [
    "¿Puedo pedir solo una parte del informe?",
    "Sí. La flecha a la derecha del botón de generar abre el selector de secciones. Las dependencias se resuelven solas: si pides la capa ACT, se genera también el análisis por situaciones en el que se apoya, porque sin él la capa saldría hueca. El resumen clínico y los datos faltantes se incluyen siempre.",
  ],
  [
    "¿Qué pasa si la nota es muy corta?",
    "El análisis se vuelve más inseguro y así lo indica: ninguna hipótesis obtendrá confianza alta y la sección de datos faltantes crecerá. Es preferible eso a inventar.",
  ],
  [
    "¿Se guardan mis análisis?",
    "Solo si activas el historial, y en ese caso se cifran en este dispositivo con una contraseña tuya. No salen de tu ordenador y nadie más puede abrirlos, ni siquiera nosotros.",
  ],
];

export default function GuiaCompleta() {
  return (
    <section className="grid gap-6 print:block lg:grid-cols-[1fr_320px] xl:grid-cols-[1fr_360px]">
      <div className="min-w-0 space-y-6">
        <Tarjeta id="escribir" titulo="Qué escribir" icono={FileText}>
          <BloqueQueEscribir />
        </Tarjeta>

        <Tarjeta id="cadena" titulo="Cómo se lee tu nota" icono={GitBranch}>
          <BloqueComoSeLee />
        </Tarjeta>

        <Tarjeta id="informe" titulo="Cómo leer el informe" icono={Layers}>
          <BloqueElInforme />
        </Tarjeta>

        <Tarjeta id="limites" titulo="Qué es y qué no es" icono={ShieldCheck}>
          <BloqueLosLimites />
        </Tarjeta>

        <Tarjeta id="glosario" titulo="Glosario" icono={BookOpenCheck}>
          <p className="mb-4 text-sm leading-relaxed text-ink-muted">
            El informe está escrito en registro técnico, dirigido a un colega con
            formación en análisis de conducta. Estas son las abreviaturas que
            aparecen.
          </p>
          <dl className="space-y-3">
            {GLOSARIO.map(([sigla, nombre, texto]) => (
              <div key={sigla} className="border-l-2 border-divider pl-3">
                <dt className="flex flex-wrap items-baseline gap-2">
                  <span className="font-mono text-[11px] uppercase tracking-wide text-accent">
                    {sigla}
                  </span>
                  <span className="text-sm font-semibold text-ink">{nombre}</span>
                </dt>
                <dd className="mt-0.5 text-sm leading-relaxed text-ink-muted">{texto}</dd>
              </div>
            ))}
          </dl>
        </Tarjeta>

        <Tarjeta id="privacidad" titulo="Privacidad" icono={Lock}>
          <div className="space-y-4">
            <p className="text-sm leading-relaxed text-ink-muted">
              Para generar el análisis, el texto de tus notas se envía a la API de
              OpenAI. ACIA no lo almacena en ningún servidor propio, pero OpenAI
              puede conservarlo temporalmente según su política de retención.
            </p>
            <p className="text-sm leading-relaxed text-ink-muted">
              Antes de enviar, la aplicación detecta correos, teléfonos,
              documentos, direcciones y algunos nombres propios, y te ofrece
              enmascararlos. Es una ayuda, no una anonimización: una combinación de
              datos aparentemente inocuos —edad exacta, profesión, ciudad— puede
              identificar a alguien igualmente, y eso ninguna detección automática
              lo evita.
            </p>
            <Aviso>
              La única medida que de verdad protege es escribir con iniciales o
              seudónimos desde el principio.
            </Aviso>
            <p className="text-sm leading-relaxed text-ink-muted">
              Si activas el historial, los análisis guardados se cifran en este
              dispositivo con una contraseña que eliges tú. No se envían a ningún
              servidor. Si pierdes esa contraseña no hay forma de recuperarlos: es
              la contrapartida de que nadie más pueda leerlos.
            </p>
          </div>
        </Tarjeta>

        <Tarjeta id="preguntas" titulo="Preguntas frecuentes" icono={MessageCircleQuestion}>
          <dl className="space-y-5">
            {PREGUNTAS.map(([pregunta, respuesta]) => (
              <div key={pregunta}>
                <dt className="font-serif text-base font-semibold text-ink">{pregunta}</dt>
                <dd className="mt-1 text-sm leading-relaxed text-ink-muted">{respuesta}</dd>
              </div>
            ))}
          </dl>
        </Tarjeta>
      </div>

      <aside className="print:hidden lg:sticky lg:top-8 lg:self-start">
        <div className="rounded-2xl border border-divider bg-surface p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent-soft">
              <Sparkles className="h-[18px] w-[18px] text-accent" aria-hidden="true" />
            </span>
            <h2 className="font-serif text-lg font-semibold text-ink">En esta guía</h2>
          </div>
          <nav aria-label="Índice de la guía">
            <ul className="space-y-1">
              {SECCIONES.map(({ id, titulo, icono: Icono }) => (
                <li key={id}>
                  <a
                    href={`#${id}`}
                    className="flex items-center gap-3 rounded-lg px-2 py-2 text-sm text-ink-muted transition-colors hover:bg-canvas hover:text-ink"
                  >
                    <Icono className="h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
                    {titulo}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </aside>
    </section>
  );
}

function Tarjeta({
  id,
  titulo,
  icono: Icono,
  children,
}: {
  id: string;
  titulo: string;
  icono: typeof FileText;
  children: React.ReactNode;
}) {
  return (
    <article
      id={id}
      className="scroll-mt-8 rounded-2xl border border-divider bg-surface p-5 shadow-sm sm:p-6"
    >
      <div className="mb-5 flex items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent-soft">
          <Icono className="h-[18px] w-[18px] text-accent" aria-hidden="true" />
        </span>
        <h2 className="font-serif text-xl font-semibold text-ink">{titulo}</h2>
      </div>
      {children}
    </article>
  );
}
