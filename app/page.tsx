"use client";

import { useState } from "react";
import type { AnalisisFuncional } from "@/lib/types";
import {
  contieneDatosIdentificables,
  enmascararDatosIdentificables,
} from "@/lib/pii";
import { formatearInformeTexto } from "@/lib/formatearInforme";
import ReportView from "@/components/ReportView";
import EsqueletoInforme from "@/components/EsqueletoInforme";

type EstadoApp = "inicial" | "cargando" | "resultado" | "error";

const LONGITUD_MINIMA = 100;
const LONGITUD_MAXIMA = 15000;
const MENSAJE_NOTA_BREVE =
  "La nota es demasiado breve para un análisis funcional fiable. Incluye al menos la situación, la conducta y lo que ocurrió después.";
const MENSAJE_ERROR_GENERICO = "No se pudo completar el análisis. Intenta nuevamente.";

export default function Home() {
  const [nota, setNota] = useState("");
  const [referenciaCaso, setReferenciaCaso] = useState("");
  const [estado, setEstado] = useState<EstadoApp>("inicial");
  const [mensajeValidacion, setMensajeValidacion] = useState("");
  const [mensajeError, setMensajeError] = useState("");
  const [avisoPII, setAvisoPII] = useState(false);
  const [analisis, setAnalisis] = useState<AnalisisFuncional | null>(null);
  const [fechaGeneracion, setFechaGeneracion] = useState("");
  const [ultimoTextoEnviado, setUltimoTextoEnviado] = useState("");
  const [copiado, setCopiado] = useState(false);

  async function ejecutarAnalisis(texto: string) {
    setUltimoTextoEnviado(texto);
    setAvisoPII(false);
    setMensajeValidacion("");
    setMensajeError("");
    setEstado("cargando");

    try {
      const respuesta = await fetch("/api/analizar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nota: texto }),
      });

      const datos = await respuesta.json().catch(() => null);

      if (!respuesta.ok || !datos?.analisis) {
        if (datos?.error === "falta_api_key") {
          setMensajeError(
            "Falta configurar la clave de API. Revisa el archivo .env.local."
          );
        } else if (datos?.error === "nota_muy_breve") {
          setMensajeError(MENSAJE_NOTA_BREVE);
        } else {
          setMensajeError(MENSAJE_ERROR_GENERICO);
        }
        setEstado("error");
        return;
      }

      setAnalisis(datos.analisis as AnalisisFuncional);
      setFechaGeneracion(
        new Date().toLocaleString("es-PE", {
          dateStyle: "long",
          timeStyle: "short",
        })
      );
      setEstado("resultado");
    } catch {
      setMensajeError(MENSAJE_ERROR_GENERICO);
      setEstado("error");
    }
  }

  function manejarGenerarClick() {
    if (nota.trim().length < LONGITUD_MINIMA) {
      setMensajeValidacion(MENSAJE_NOTA_BREVE);
      return;
    }
    setMensajeValidacion("");

    if (contieneDatosIdentificables(nota)) {
      setAvisoPII(true);
      return;
    }

    void ejecutarAnalisis(nota);
  }

  function manejarEnmascararYAnalizar() {
    const enmascarada = enmascararDatosIdentificables(nota);
    setNota(enmascarada);
    void ejecutarAnalisis(enmascarada);
  }

  function manejarAnalizarSinCambios() {
    void ejecutarAnalisis(nota);
  }

  function manejarReintentar() {
    void ejecutarAnalisis(ultimoTextoEnviado);
  }

  function manejarNuevoAnalisis() {
    setNota("");
    setReferenciaCaso("");
    setEstado("inicial");
    setMensajeValidacion("");
    setMensajeError("");
    setAvisoPII(false);
    setAnalisis(null);
    setFechaGeneracion("");
    setUltimoTextoEnviado("");
    setCopiado(false);
  }

  async function manejarCopiarInforme() {
    if (!analisis) return;
    const texto = formatearInformeTexto(analisis, referenciaCaso, fechaGeneracion);
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      setMensajeError(
        "No se pudo copiar automáticamente. Selecciona y copia el informe manualmente."
      );
    }
  }

  const formularioVisible = estado !== "resultado";
  const formularioDeshabilitado = estado === "cargando";

  return (
    <main
      className={`mx-auto px-4 py-8 sm:px-6 sm:py-12 print:max-w-none print:px-0 print:py-0 ${
        estado === "resultado" ? "max-w-6xl" : "max-w-3xl"
      }`}
    >
      <header className="mb-8 print:hidden">
        <h1 className="font-serif text-2xl font-semibold text-ink sm:text-3xl">
          AFA — Análisis Funcional Asistido
        </h1>
        <p className="mt-2 text-sm text-ink-muted sm:text-base">
          Análisis funcional y formulación de casos para la práctica clínica asistida por IA
        </p>
      </header>

      {formularioVisible && (
        <section className="print:hidden">
          <div className="rounded-md border border-divider bg-surface p-5 shadow-sm sm:p-6">
            <label htmlFor="nota" className="sr-only">
              Notas clínicas
            </label>
            <textarea
              id="nota"
              value={nota}
              disabled={formularioDeshabilitado}
              onChange={(evento) => {
                setNota(evento.target.value);
                if (avisoPII) setAvisoPII(false);
                if (mensajeValidacion) setMensajeValidacion("");
              }}
              maxLength={LONGITUD_MAXIMA}
              rows={12}
              placeholder="Pega aquí tus notas de sesión, registros u observaciones. No necesitan estar ordenadas: describe situaciones, conductas, lo que la persona dice y lo que ocurre después. Evita nombres reales."
              className="w-full resize-y rounded border border-divider bg-white px-3 py-3 text-[15px] leading-relaxed text-ink placeholder:text-ink-muted/70 focus-visible:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30 disabled:cursor-not-allowed disabled:opacity-60"
            />

            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
              <p className="font-mono text-xs text-ink-muted">
                {nota.length} / {LONGITUD_MAXIMA}
              </p>
            </div>

            <p className="mt-3 text-xs leading-relaxed text-ink-muted">
              Privacidad: tus notas se procesan de forma efímera y no se almacenan en
              ningún servidor propio. Recomendación: usa iniciales o seudónimos.
            </p>

            {mensajeValidacion && (
              <p role="alert" className="mt-3 text-sm text-warn">
                {mensajeValidacion}
              </p>
            )}

            {estado === "error" && mensajeError && (
              <div
                role="alert"
                className="mt-4 rounded-md border border-warn/30 bg-warn/5 p-4"
              >
                <p className="text-sm text-ink">{mensajeError}</p>
                <button
                  type="button"
                  onClick={manejarReintentar}
                  className="mt-3 rounded border border-divider px-4 py-1.5 text-sm font-medium text-ink transition-colors hover:bg-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
                >
                  Reintentar
                </button>
              </div>
            )}

            {avisoPII && (
              <div
                role="alert"
                className="mt-4 rounded-md border border-warn/30 bg-warn/5 p-4"
              >
                <p className="text-sm text-ink">
                  Detectamos posibles datos identificables (correo, teléfono o
                  documento). ¿Deseas enmascararlos automáticamente antes de
                  analizar?
                </p>
                <div className="mt-3 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={manejarEnmascararYAnalizar}
                    className="rounded bg-accent px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-accent/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
                  >
                    Enmascarar y analizar
                  </button>
                  <button
                    type="button"
                    onClick={manejarAnalizarSinCambios}
                    className="rounded border border-divider px-4 py-1.5 text-sm font-medium text-ink transition-colors hover:bg-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
                  >
                    Analizar sin cambios
                  </button>
                </div>
              </div>
            )}

            {!avisoPII && (
              <div className="mt-5">
                <button
                  type="button"
                  onClick={manejarGenerarClick}
                  disabled={formularioDeshabilitado}
                  className="rounded bg-accent px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
                >
                  Generar análisis funcional
                </button>
              </div>
            )}
          </div>

          {estado === "cargando" && (
            <div className="mt-8">
              <EsqueletoInforme />
            </div>
          )}
        </section>
      )}

      {estado === "resultado" && analisis && (
        <div className="mt-2">
          <div className="sticky top-0 z-10 -mx-4 mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-divider bg-surface/95 px-4 py-3 backdrop-blur print:hidden sm:-mx-6 sm:px-6">
            <p className="min-w-0 truncate text-sm text-ink-muted">
              {referenciaCaso.trim() && (
                <span className="text-ink">{referenciaCaso.trim()} · </span>
              )}
              {fechaGeneracion}
            </p>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={manejarCopiarInforme}
                className="rounded border border-divider bg-surface px-4 py-2 text-sm font-medium text-ink transition-colors hover:bg-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
              >
                {copiado ? "Copiado" : "Copiar informe"}
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="rounded border border-divider bg-surface px-4 py-2 text-sm font-medium text-ink transition-colors hover:bg-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
              >
                Imprimir / Guardar como PDF
              </button>
              <button
                type="button"
                onClick={manejarNuevoAnalisis}
                className="rounded bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
              >
                Nuevo análisis
              </button>
            </div>
          </div>
          <ReportView
            analisis={analisis}
            referenciaCaso={referenciaCaso}
            onReferenciaCasoChange={setReferenciaCaso}
            fecha={fechaGeneracion}
            notaOriginal={ultimoTextoEnviado}
            onAnalisisActualizado={(fragmento) =>
              setAnalisis((previo) => (previo ? { ...previo, ...fragmento } : previo))
            }
          />
        </div>
      )}

      <footer className="mt-10 border-t border-divider pt-6 text-center text-xs text-ink-muted print:hidden">
        <p>
          Elaborado por{" "}
          <a
            href="https://catcodesss.github.io/catcode/"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-accent hover:underline"
          >
            CatCodes
          </a>
        </p>
        <p className="mt-1 font-mono text-[11px] text-ink-muted/70">v0.1.2</p>
      </footer>
    </main>
  );
}
