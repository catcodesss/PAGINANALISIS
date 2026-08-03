"use client";

import {
  BadgeCheck,
  Languages,
  Palette,
  ShieldCheck,
  Sparkles,
  Type,
} from "lucide-react";
import { usePreferencias } from "./usePreferencias";
import type { Acento, TamanoTexto, Tema } from "@/lib/preferencias";

/**
 * Ajustes de presentación y el sitio donde vivirá el plan.
 *
 * Lo que se puede cambiar aquí es cómo se ve la herramienta, nunca cómo
 * analiza: no hay ningún control que afecte al prompt, a los validadores ni a
 * las citas. Esa separación es deliberada — un ajuste que pudiera rebajar las
 * comprobaciones de seguridad clínica sería una forma indirecta de romper el
 * invariante 4.
 */

const TEMAS: { valor: Tema; etiqueta: string; pista: string }[] = [
  { valor: "sistema", etiqueta: "Automático", pista: "Sigue al sistema" },
  { valor: "claro", etiqueta: "Claro", pista: "Como el papel" },
  { valor: "oscuro", etiqueta: "Oscuro", pista: "Para consultas largas" },
];

const TAMANOS: { valor: TamanoTexto; etiqueta: string; muestra: string }[] = [
  { valor: "compacto", etiqueta: "Compacto", muestra: "Aa" },
  { valor: "normal", etiqueta: "Normal", muestra: "Aa" },
  { valor: "amplio", etiqueta: "Amplio", muestra: "Aa" },
];

const ACENTOS: { valor: Acento; etiqueta: string; muestra: string }[] = [
  { valor: "verde", etiqueta: "Verde", muestra: "#2e5e4e" },
  { valor: "indigo", etiqueta: "Índigo", muestra: "#43508a" },
  { valor: "lavanda", etiqueta: "Lavanda", muestra: "#6b5b8f" },
  { valor: "teal", etiqueta: "Turquesa", muestra: "#2c5f66" },
  { valor: "arena", etiqueta: "Arena", muestra: "#6e5843" },
];

const PLAN_GRATIS = [
  "Análisis funcional completo, con las tres capas (ACT, DBT y conductual)",
  "Citas verificables, validadores y datos faltantes",
  "Copiar, imprimir y exportar a Word",
  "Editar el informe a mano y reordenar sus bloques",
];

const PLAN_PREMIUM = [
  "Historial de casos: guardar por referencia, buscar y reabrir",
  "Seguimiento longitudinal: comparar varios análisis del mismo caso",
  "Exportación con membrete, nombre y número de colegiado",
  "Análisis y reanálisis sin tope",
  "Informe de evolución entre sesiones",
];

export default function Configuracion() {
  const { preferencias, cambiar } = usePreferencias();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Tarjeta titulo="Apariencia" icono={Palette}>
        <Campo
          etiqueta="Tema"
          descripcion="«Automático» sigue lo que tengas puesto en el sistema."
        >
          <Opciones
            nombre="tema"
            opciones={TEMAS.map((t) => ({
              valor: t.valor,
              etiqueta: t.etiqueta,
              pista: t.pista,
            }))}
            elegida={preferencias.tema}
            onElegir={(v) => cambiar({ tema: v as Tema })}
          />
        </Campo>

        <Campo
          etiqueta="Color de acento"
          descripcion="Cambia la marca, no el código de colores del informe: el ámbar sigue señalando lo que hay que revisar y el gris lo que es inferencia."
        >
          <div className="flex flex-wrap gap-2">
            {ACENTOS.map((a) => {
              const activo = preferencias.acento === a.valor;
              return (
                <button
                  key={a.valor}
                  type="button"
                  onClick={() => cambiar({ acento: a.valor })}
                  aria-pressed={activo}
                  className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors ${
                    activo
                      ? "border-accent bg-accent-soft font-medium text-ink"
                      : "border-divider text-ink-muted hover:bg-canvas hover:text-ink"
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className="h-4 w-4 shrink-0 rounded-full border border-black/10"
                    style={{ backgroundColor: a.muestra }}
                  />
                  {a.etiqueta}
                </button>
              );
            })}
          </div>
        </Campo>
      </Tarjeta>

      <Tarjeta titulo="Texto" icono={Type}>
        <Campo
          etiqueta="Tamaño"
          descripcion="Afecta a toda la interfaz y al informe en pantalla. Lo impreso mantiene siempre su tamaño, porque es un documento con medidas propias."
        >
          <div className="flex flex-wrap gap-2">
            {TAMANOS.map((t) => {
              const activo = preferencias.tamanoTexto === t.valor;
              return (
                <button
                  key={t.valor}
                  type="button"
                  onClick={() => cambiar({ tamanoTexto: t.valor })}
                  aria-pressed={activo}
                  className={`flex items-baseline gap-2 rounded-lg border px-3 py-2 transition-colors ${
                    activo
                      ? "border-accent bg-accent-soft font-medium text-ink"
                      : "border-divider text-ink-muted hover:bg-canvas hover:text-ink"
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className="font-serif"
                    style={{
                      fontSize:
                        t.valor === "compacto"
                          ? "13px"
                          : t.valor === "amplio"
                            ? "20px"
                            : "16px",
                    }}
                  >
                    {t.muestra}
                  </span>
                  <span className="text-sm">{t.etiqueta}</span>
                </button>
              );
            })}
          </div>
        </Campo>
      </Tarjeta>

      <Tarjeta titulo="Idioma" icono={Languages}>
        <Campo
          etiqueta="Idioma de la interfaz"
          descripcion="El análisis se genera en español porque el prompt clínico lo está: traducir el informe no es cambiar rótulos, es reescribir el prompt y volver a medirlo con las evals."
        >
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              aria-pressed
              className="rounded-lg border border-accent bg-accent-soft px-3 py-2 text-sm font-medium text-ink"
            >
              Español
            </button>
            <span className="flex items-center gap-2 rounded-lg border border-dashed border-divider px-3 py-2 text-sm text-ink-muted/70">
              English
              <Proximamente />
            </span>
          </div>
        </Campo>
      </Tarjeta>

      <Tarjeta titulo="Plan" icono={BadgeCheck}>
        <p className="mb-4 text-sm leading-relaxed text-ink-muted">
          Ahora mismo todo lo que ves está disponible sin coste. Este es el
          reparto previsto cuando exista el plan de pago.
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-accent bg-accent-soft p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 className="font-serif text-base font-semibold text-ink">Gratuito</h3>
              <span className="rounded bg-accent px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide texto-sobre-acento">
                Tu plan
              </span>
            </div>
            <ul className="space-y-2">
              {PLAN_GRATIS.map((t) => (
                <li key={t} className="flex gap-2 text-sm leading-relaxed text-ink-muted">
                  <span aria-hidden="true" className="text-accent">
                    ·
                  </span>
                  {t}
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-xl border border-dashed border-divider p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 className="font-serif text-base font-semibold text-ink">Premium</h3>
              <Proximamente />
            </div>
            <ul className="space-y-2">
              {PLAN_PREMIUM.map((t) => (
                <li key={t} className="flex gap-2 text-sm leading-relaxed text-ink-muted">
                  <span aria-hidden="true" className="text-ink-muted/50">
                    ·
                  </span>
                  {t}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Invariante 4 de CLAUDE.md, dicho donde el usuario decide si paga. */}
        <div className="mt-4 flex gap-3 rounded-xl border-l-4 border-warn bg-canvas p-4">
          <ShieldCheck
            className="h-5 w-5 shrink-0 text-warn"
            aria-hidden="true"
          />
          <p className="text-sm leading-relaxed text-ink-muted">
            <span className="font-medium text-ink">
              Las funciones de seguridad clínica no se cobran nunca.
            </span>{" "}
            Las citas verificables, los validadores y sus alertas, los datos
            faltantes y el descargo están en el plan gratuito y seguirán
            estándolo. Un informe de pago no puede ser clínicamente mejor que uno
            gratuito: el daño de un análisis peor no lo sufre quien no paga, lo
            sufre su paciente.
          </p>
        </div>
      </Tarjeta>
    </div>
  );
}

function Proximamente() {
  return (
    <span className="rounded border border-divider px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide text-ink-muted/70">
      Próximamente
    </span>
  );
}

function Tarjeta({
  titulo,
  icono: Icono,
  children,
}: {
  titulo: string;
  icono: typeof Sparkles;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-divider bg-surface p-5 shadow-sm sm:p-6">
      <div className="mb-5 flex items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent-soft">
          <Icono className="h-[18px] w-[18px] text-accent" aria-hidden="true" />
        </span>
        <h2 className="font-serif text-xl font-semibold text-ink">{titulo}</h2>
      </div>
      <div className="space-y-6">{children}</div>
    </section>
  );
}

function Campo({
  etiqueta,
  descripcion,
  children,
}: {
  etiqueta: string;
  descripcion?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="font-medium text-ink">{etiqueta}</p>
      {descripcion && (
        <p className="mb-3 mt-0.5 text-sm leading-relaxed text-ink-muted">
          {descripcion}
        </p>
      )}
      {children}
    </div>
  );
}

function Opciones({
  nombre,
  opciones,
  elegida,
  onElegir,
}: {
  nombre: string;
  opciones: { valor: string; etiqueta: string; pista?: string }[];
  elegida: string;
  onElegir: (valor: string) => void;
}) {
  return (
    <div role="radiogroup" aria-label={nombre} className="flex flex-wrap gap-2">
      {opciones.map((o) => {
        const activo = elegida === o.valor;
        return (
          <button
            key={o.valor}
            type="button"
            role="radio"
            aria-checked={activo}
            onClick={() => onElegir(o.valor)}
            className={`rounded-lg border px-3 py-2 text-left transition-colors ${
              activo
                ? "border-accent bg-accent-soft text-ink"
                : "border-divider text-ink-muted hover:bg-canvas hover:text-ink"
            }`}
          >
            <span className={`block text-sm ${activo ? "font-medium" : ""}`}>
              {o.etiqueta}
            </span>
            {o.pista && (
              <span className="block text-xs text-ink-muted/80">{o.pista}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
