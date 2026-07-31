"use client";

import { Check, X } from "lucide-react";

/**
 * Contenido y piezas visuales compartidas por la guía rápida (modal) y la guía
 * de uso (pantalla completa). Vive aquí para que las dos digan exactamente lo
 * mismo: si el texto se duplicara, acabarían divergiendo.
 *
 * La versión larga añade secciones propias; el núcleo de los cuatro pasos es
 * idéntico en ambas.
 */

// --- piezas comunes ------------------------------------------------------

export function Intro({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <div>
      <h3 className="font-serif text-lg font-semibold text-ink">{titulo}</h3>
      <p className="mt-1 text-sm leading-relaxed text-ink-muted">{texto}</p>
    </div>
  );
}

export function Aviso({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-xl border border-accent/20 bg-accent-soft p-4 text-sm leading-relaxed text-ink-muted">
      {children}
    </p>
  );
}

export function Marca({
  titulo,
  children,
}: {
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-divider bg-canvas p-5">
      <h3 className="mb-3 font-serif text-base font-semibold text-ink">{titulo}</h3>
      {children}
    </div>
  );
}

export function Ejemplo({
  bien,
  titulo,
  texto,
  nota,
}: {
  bien: boolean;
  titulo: string;
  texto: string;
  nota: string;
}) {
  return (
    <div
      className={`rounded-xl border bg-canvas p-4 ${
        bien ? "border-accent/40" : "border-divider"
      }`}
    >
      <p className="mb-2 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wide text-ink-muted">
        {bien ? (
          <Check className="h-3 w-3 text-accent" aria-hidden="true" />
        ) : (
          <X className="h-3 w-3" aria-hidden="true" />
        )}
        {titulo}
      </p>
      <p className="text-sm italic leading-relaxed text-ink">{texto}</p>
      <p className="mt-2 text-xs leading-relaxed text-ink-muted">{nota}</p>
    </div>
  );
}

export function Lista({
  titulo,
  items,
  positiva,
}: {
  titulo: string;
  items: string[];
  positiva?: boolean;
}) {
  return (
    <div className="rounded-xl border border-divider bg-canvas p-5">
      <h3 className="mb-3 font-serif text-base font-semibold text-ink">{titulo}</h3>
      <ul className="space-y-2">
        {items.map((item) => (
          <li key={item} className="flex items-start gap-2 text-sm text-ink-muted">
            <span
              aria-hidden="true"
              className={`mt-0.5 shrink-0 font-mono text-xs ${
                positiva ? "text-accent" : "text-ink-muted"
              }`}
            >
              {positiva ? "+" : "−"}
            </span>
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Fila({
  sigla,
  nombre,
  valor,
  destacado,
}: {
  sigla: string;
  nombre: string;
  valor: string;
  destacado?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
      <dt
        className={`w-14 shrink-0 font-mono text-[11px] uppercase tracking-wide ${
          destacado ? "text-accent" : "text-ink-muted"
        }`}
      >
        {sigla}
      </dt>
      <dd className="min-w-0 flex-1">
        <span className="text-[15px] text-ink">{valor}</span>
        <span className="ml-2 text-xs text-ink-muted">{nombre}</span>
      </dd>
    </div>
  );
}

export function DiagramaABC() {
  return (
    <svg
      viewBox="0 0 700 150"
      className="w-full"
      role="img"
      aria-label="Antecedente, conducta y consecuencia"
    >
      <defs>
        <marker id="flecha-guia" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
          <path d="M0,0 L8,4 L0,8 z" className="fill-accent" />
        </marker>
      </defs>

      {[
        {
          x: 10,
          etiqueta: "1 · ANTECEDENTE",
          titulo: "¿Qué pasaba antes?",
          ej: "«Su supervisora le pidió exponer»",
        },
        {
          x: 245,
          etiqueta: "2 · CONDUCTA",
          titulo: "¿Qué hizo?",
          ej: "«Pidió ir al baño»",
        },
        {
          x: 480,
          etiqueta: "3 · CONSECUENCIA",
          titulo: "¿Qué pasó después?",
          ej: "«Ya no tuvo que exponer»",
        },
      ].map((caja) => (
        <g key={caja.x}>
          <rect
            x={caja.x}
            y="10"
            width="210"
            height="105"
            rx="10"
            className="fill-canvas stroke-divider"
            strokeWidth="1"
          />
          <text
            x={caja.x + 16}
            y="36"
            className="fill-accent font-mono"
            fontSize="10"
            letterSpacing="1"
          >
            {caja.etiqueta}
          </text>
          <text x={caja.x + 16} y="62" className="fill-ink" fontSize="15" fontWeight="600">
            {caja.titulo}
          </text>
          <text x={caja.x + 16} y="88" className="fill-ink-muted" fontSize="12">
            {caja.ej}
          </text>
        </g>
      ))}

      <line
        x1="224"
        y1="62"
        x2="240"
        y2="62"
        className="stroke-accent"
        strokeWidth="2"
        markerEnd="url(#flecha-guia)"
      />
      <line
        x1="459"
        y1="62"
        x2="475"
        y2="62"
        className="stroke-accent"
        strokeWidth="2"
        markerEnd="url(#flecha-guia)"
      />

      <text x="350" y="140" textAnchor="middle" className="fill-ink-muted" fontSize="12">
        La consecuencia inmediata es la que explica por qué la conducta se repite.
      </text>
    </svg>
  );
}

// --- los cuatro bloques --------------------------------------------------

export function BloqueQueEscribir() {
  return (
    <div className="space-y-6">
      <Intro
        titulo="Tres piezas por cada episodio"
        texto="Un análisis funcional necesita saber qué pasaba antes, qué hizo la persona y qué ocurrió justo después. Si falta la tercera, no hay función que analizar: es lo que más se olvida."
      />

      <DiagramaABC />

      <div className="grid gap-4 sm:grid-cols-2">
        <Ejemplo
          bien={false}
          titulo="Poco útil"
          texto="El paciente tiene ansiedad social y evita situaciones. Está muy bloqueado últimamente."
          nota="Son etiquetas, no conductas. No hay situación concreta ni consecuencia."
        />
        <Ejemplo
          bien
          titulo="Analizable"
          texto="El martes su supervisora le pidió exponer. Notó taquicardia, pidió ir al baño y al volver ya no tuvo que hacerlo. Sintió alivio inmediato."
          nota="Situación, conducta observable y consecuencia. Con esto sí hay contingencia."
        />
      </div>

      <Aviso>
        Escribe en prosa, no en viñetas sueltas. Y usa iniciales o seudónimos: el
        texto se envía a la API de OpenAI para generar el análisis.
      </Aviso>
    </div>
  );
}

export function BloqueComoSeLee() {
  return (
    <div className="space-y-6">
      <Intro
        titulo="De tu nota a la cadena funcional"
        texto="ANIA agrupa la nota en situaciones y reconstruye la contingencia de cada una. Este es el resultado del ejemplo anterior."
      />

      <div className="rounded-xl border border-divider bg-canvas p-5">
        <p className="mb-4 font-mono text-[10px] uppercase tracking-wide text-accent">
          Cadena operante
        </p>
        <dl className="space-y-3">
          <Fila sigla="Ed" nombre="Estímulo discriminativo" valor="Supervisora pide exponer resultados" />
          <Fila sigla="OM" nombre="Operación motivacional" valor="Malestar condicionado ante evaluación social" />
          <Fila sigla="RO" nombre="Respuesta operante" valor="Pide ir al baño y evita exponer" />
          <Fila sigla="C" nombre="Consecuencia inmediata" valor="Alivio al evitar la exposición" />
          <Fila
            sigla="R−"
            nombre="Contingencia"
            valor="Refuerzo negativo: la conducta se fortalece porque retira algo aversivo"
            destacado
          />
          <Fila sigla="CMLP" nombre="Consecuencia a largo plazo" valor="Erosión de la confianza en sus habilidades" />
        </dl>
      </div>

      <Aviso>
        <strong className="font-semibold text-ink">Refuerzo negativo no es castigo.</strong>{" "}
        Significa que la conducta aumenta porque retira algo desagradable. Es el
        mecanismo que mantiene casi toda evitación.
      </Aviso>
    </div>
  );
}

export function BloqueElInforme() {
  return (
    <div className="space-y-5">
      <Intro
        titulo="Tres señales que conviene mirar"
        texto="El informe distingue lo que está en tu nota de lo que es inferencia. Aprender a leer estas tres marcas es lo que evita darle más crédito del que tiene."
      />

      <Marca titulo="Citas: literal o inferido">
        <div className="space-y-3">
          <div className="border-l-2 border-divider pl-3">
            <p className="font-mono text-[10px] uppercase tracking-wide text-ink-muted">
              De la nota · línea 7
            </p>
            <p className="text-sm italic text-ink-muted">
              &quot;Sintió un alivio inmediato muy fuerte&quot;
            </p>
          </div>
          <p className="text-sm text-ink-muted">
            Este texto está recortado de tu nota, palabra por palabra. Puedes
            verificarlo en la línea que indica.
          </p>
          <p className="font-mono text-[10px] uppercase tracking-wide text-ink-muted">
            Inferido — sin cita literal en la nota
          </p>
          <p className="text-sm text-ink-muted">
            Aquí no hay respaldo textual: es una hipótesis del análisis. Trátala
            como tal.
          </p>
        </div>
      </Marca>

      <Marca titulo="Confianza: cuánto respalda la nota">
        <ul className="space-y-2">
          {[
            ["alta", "bg-accent", "La evidencia está explícita en la nota."],
            ["media", "bg-warn", "Evidencia parcial o inferencia razonable."],
            ["baja", "bg-ink-muted/50", "Se apoya sobre todo en inferencia clínica."],
          ].map(([nivel, color, texto]) => (
            <li key={nivel} className="flex items-baseline gap-2">
              <span className={`h-1.5 w-1.5 shrink-0 translate-y-[-2px] rounded-full ${color}`} />
              <span className="font-mono text-[11px] uppercase tracking-wide text-ink-muted">
                {nivel}
              </span>
              <span className="text-sm text-ink-muted">{texto}</span>
            </li>
          ))}
        </ul>
      </Marca>

      <Marca titulo="Revisiones sugeridas: lo comprueba el sistema, no la IA">
        <p className="text-sm leading-relaxed text-ink-muted">
          Avisos automáticos sobre la coherencia del informe. El más importante
          detecta que se esté proponiendo como intervención una conducta que en tu
          nota ya funcionaba como evitación — por ejemplo, sugerir respiración
          cuando la persona ya respiraba en el baño para no exponer. Si aparece
          uno, revísalo antes de usar el informe.
        </p>
      </Marca>
    </div>
  );
}

export function BloqueLosLimites() {
  return (
    <div className="space-y-5">
      <Intro
        titulo="Qué es y qué no es"
        texto="ANIA genera hipótesis funcionales para contrastar en sesión. No sustituye tu juicio clínico ni evalúa a nadie."
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Lista
          titulo="Sí sirve para"
          items={[
            "Ordenar una nota desordenada en contingencias",
            "Ver hipótesis alternativas que no habías considerado",
            "Detectar qué información falta antes de la próxima sesión",
            "Preparar un caso para supervisión",
          ]}
          positiva
        />
        <Lista
          titulo="No sirve para"
          items={[
            "Diagnosticar",
            "Sustituir la evaluación directa",
            "Decidir un tratamiento sin contrastarlo",
            "Documentar una historia clínica sin revisarlo",
          ]}
        />
      </div>

      <div className="rounded-xl border-l-4 border-warn bg-canvas p-5">
        <h3 className="mb-2 font-serif text-base font-semibold text-ink">
          Empieza siempre por &quot;Datos faltantes&quot;
        </h3>
        <p className="text-sm leading-relaxed text-ink-muted">
          Es la primera sección del informe a propósito: recoge lo que tu nota no
          incluía. Leerla antes que las conclusiones evita tomar por establecido
          algo que solo era una inferencia sobre información incompleta.
        </p>
      </div>
    </div>
  );
}
