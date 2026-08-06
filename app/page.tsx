"use client";

import { useState } from "react";
import { BookOpenText, ChevronDown, Lock, Sparkles, SunMedium } from "lucide-react";
import type { AnalisisFuncional } from "@/lib/types";
import {
  contieneDatosIdentificables,
  enmascararDatosIdentificables,
} from "@/lib/pii";
import {
  formatearInformeTexto,
  ORDEN_BLOQUES_POR_DEFECTO,
} from "@/lib/formatearInforme";
import { leerOrdenGuardado } from "@/components/ordenBloques";
import { revalidarTrasEdicion } from "@/lib/validadores";
import { descargarDocx } from "@/lib/exportarDocx";
import ReportView from "@/components/ReportView";
import GuiaCompleta from "@/components/GuiaCompleta";
import Configuracion from "@/components/Configuracion";
import SelectorBloques from "@/components/SelectorBloques";
import { IDS_TODOS } from "@/lib/bloques";
import EsqueletoInforme from "@/components/EsqueletoInforme";
import Sidebar, { type Vista } from "@/components/Sidebar";
import PanelRecomendaciones from "@/components/PanelRecomendaciones";

// El marcador de posición se mantiene corto a propósito. El ejemplo largo que
// había antes iba en viñetas telegráficas, justo lo que la guía desaconseja, y
// el cómo escribir la nota ya lo explican el texto de arriba y el panel de
// recomendaciones de al lado.
const MARCADOR_NOTA = "Pega aquí tu caso…";

type EstadoApp = "inicial" | "cargando" | "resultado" | "error";

const LONGITUD_MINIMA = 100;
// Debe coincidir con LONGITUD_MAXIMA_NOTA de app/api/analizar/route.ts.
const LONGITUD_MAXIMA = 40000;
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
  const [vista, setVista] = useState<Vista>("analisis");
  const [selectorAbierto, setSelectorAbierto] = useState(false);
  // Vacío en la práctica significa "todos": se manda la lista completa.
  const [bloques, setBloques] = useState<string[]>(IDS_TODOS);

  async function ejecutarAnalisis(texto: string, bloquesPedidos: string[] = bloques) {
    setUltimoTextoEnviado(texto);
    setSelectorAbierto(false);
    setAvisoPII(false);
    setMensajeValidacion("");
    setMensajeError("");
    setEstado("cargando");

    try {
      const respuesta = await fetch("/api/analizar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nota: texto, bloques: bloquesPedidos }),
      });

      const datos = await respuesta.json().catch(() => null);

      if (!respuesta.ok || !datos?.analisis) {
        // La ruta ya redacta un mensaje distinto por causa (nota larga, cuota
        // de OpenAI, respuesta truncada, clave rechazada) y son textos fijos
        // sin nada de la nota. Se muestran tal cual: antes se descartaban
        // todos y el usuario veía "intenta nuevamente" pasara lo que pasara,
        // incluso cuando reintentar no podía funcionar.
        if (datos?.error === "nota_muy_breve") {
          setMensajeError(MENSAJE_NOTA_BREVE);
        } else {
          setMensajeError(
            typeof datos?.message === "string" && datos.message.trim()
              ? datos.message
              : MENSAJE_ERROR_GENERICO
          );
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
    const texto = formatearInformeTexto(
      analisis,
      referenciaCaso,
      fechaGeneracion,
      leerOrdenGuardado(ORDEN_BLOQUES_POR_DEFECTO)
    );
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

  function manejarDescargarDocx() {
    if (!analisis) return;
    descargarDocx(
      analisis,
      referenciaCaso,
      fechaGeneracion,
      leerOrdenGuardado(ORDEN_BLOQUES_POR_DEFECTO)
    );
  }

  /**
   * Edición manual de una sección. Trabaja sobre una copia (el informe es
   * estado de React) y vuelve a pasar las comprobaciones deterministas sobre
   * el resultado: son sin IA y sin red, así que revalidar no cuesta nada.
   * Ver lib/validadores.ts#revalidarTrasEdicion — avisa, nunca corrige.
   */
  function manejarEditarSeccion(
    seccionId: string,
    mutar: (copia: AnalisisFuncional) => void
  ) {
    setAnalisis((previo) => {
      if (!previo) return previo;
      const copia = structuredClone(previo);
      mutar(copia);
      copia.secciones_editadas = previo.secciones_editadas.includes(seccionId)
        ? previo.secciones_editadas
        : [...previo.secciones_editadas, seccionId];
      copia.alertas = revalidarTrasEdicion(copia, ultimoTextoEnviado);
      return copia;
    });
  }

  // Guía y configuración ocultan el formulario y el informe: las tres vistas
  // comparten contenedor y cabecera, solo cambia el cuerpo.
  const enAnalisis = vista === "analisis";
  const TITULOS: Record<typeof vista, { titulo: string; bajada: string }> = {
    analisis: {
      titulo: "ACIA — análisis conductual asistido por IA",
      bajada:
        "Herramienta clínica para formular casos con claridad, precisión y enfoque funcional.",
    },
    guia: {
      titulo: "Guía de uso",
      bajada:
        "Cómo escribir la nota, cómo se convierte en análisis funcional y cómo leer el informe sin darle más crédito del que tiene.",
    },
    configuracion: {
      titulo: "Configuración",
      bajada:
        "Cómo se ve la herramienta. Nada de lo que hay aquí cambia cómo analiza.",
    },
  };
  const cabecera = TITULOS[vista];
  const formularioVisible = enAnalisis && estado !== "resultado";
  const formularioDeshabilitado = estado === "cargando";

  return (
    <div className="min-h-screen bg-canvas lg:flex print:block">
      <Sidebar vista={vista} onCambiarVista={setVista} />

      <div className="min-w-0 flex-1">
        <main
          className={`mx-auto px-4 py-8 sm:px-6 sm:py-10 lg:px-10 print:max-w-none print:px-0 print:py-0 ${
            estado === "resultado" ? "max-w-6xl" : "max-w-6xl"
          }`}
        >
          <header className="mb-6 flex flex-wrap items-start justify-between gap-4 print:hidden">
            <div>
              <h1 className="font-serif text-2xl font-semibold text-ink sm:text-3xl">
{cabecera.titulo}
              </h1>
              <p className="mt-2 text-sm text-ink-muted sm:text-base">
{cabecera.bajada}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {/* La guía se abre desde la barra lateral ("Guía de uso"). Aquí
                  solo queda la vuelta, cuando ya estás dentro de ella. */}
              {!enAnalisis && (
                <button
                  type="button"
                  onClick={() => setVista("analisis")}
                  className="flex items-center gap-2 rounded-lg border border-divider bg-surface px-4 py-2 text-sm font-medium text-ink transition-colors hover:bg-canvas"
                >
                  <BookOpenText className="h-4 w-4 text-accent" aria-hidden="true" />
                  Volver al análisis
                </button>
              )}
              <button
                type="button"
                title="Próximamente"
                aria-label="Cambiar tema"
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-divider bg-surface text-ink-muted transition-colors hover:bg-canvas"
              >
                <SunMedium className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </header>

          {formularioVisible && (
            <section className="grid gap-6 print:hidden lg:grid-cols-[1fr_320px] xl:grid-cols-[1fr_360px]">
              <div className="min-w-0">
                <div className="rounded-2xl border border-divider bg-surface p-5 shadow-sm sm:p-6">
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent-soft">
                      <Sparkles className="h-[18px] w-[18px] text-accent" aria-hidden="true" />
                    </span>
                    <div>
                      <p className="font-serif text-base font-semibold text-ink sm:text-lg">
                        Describe la situación
                      </p>
                    </div>
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-ink-muted">
                    Pega aquí tus notas de sesión, registros u observaciones. No necesitan
                    estar ordenadas: describe situaciones, conductas, lo que la persona dice
                    y lo que ocurre después. Evita nombres reales.
                  </p>

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
                    rows={11}
                    placeholder={MARCADOR_NOTA}
                    className="mt-4 w-full resize-y rounded-lg border border-divider bg-surface px-3 py-3 text-[15px] leading-relaxed text-ink placeholder:text-ink-muted/70 focus-visible:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30 disabled:cursor-not-allowed disabled:opacity-60"
                  />

                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                    <p className="font-mono text-xs text-ink-muted">
                      {nota.length} / {LONGITUD_MAXIMA}
                    </p>
                    <p className="text-xs text-ink-muted">
                      Consejo: escribe en prosa, luego la IA identificará patrones.
                    </p>
                  </div>

                  <div className="mt-4 flex items-start gap-3 rounded-xl border border-accent/20 bg-accent-soft p-4">
                    <Lock className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
                    <div>
                      <p className="text-sm font-semibold text-ink">Privacidad</p>
                      <p className="mt-0.5 text-xs leading-relaxed text-ink-muted">
                        Para generar el análisis, el texto de tus notas se envía a la
                        API de OpenAI. ACIA no lo almacena en ningún servidor propio,
                        pero OpenAI puede conservarlo temporalmente según su política
                        de retención. No introduzcas nombres reales ni datos de
                        contacto: usa iniciales o seudónimos.
                      </p>
                    </div>
                  </div>

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
                          className="rounded bg-accent px-4 py-1.5 text-sm font-medium texto-sobre-acento transition-colors hover:bg-accent/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
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

                  {/* Botón partido: la acción principal a la izquierda y, a la
                      derecha, el desplegable para elegir qué partes generar. */}
                  {!avisoPII && (
                    <div className="relative mt-5 flex">
                      <button
                        type="button"
                        onClick={manejarGenerarClick}
                        disabled={formularioDeshabilitado}
                        className="flex min-w-0 flex-1 items-center gap-3 rounded-l-xl bg-accent px-5 py-3.5 text-left texto-sobre-acento transition-colors hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
                      >
                        <Sparkles className="h-5 w-5 shrink-0" aria-hidden="true" />
                        <span className="min-w-0">
                          <span className="block text-sm font-semibold">
                            {bloques.length === IDS_TODOS.length
                              ? "Generar análisis funcional"
                              : `Generar ${bloques.length} ${bloques.length === 1 ? "sección" : "secciones"}`}
                          </span>
                          <span className="block text-xs text-white/75">
                            {bloques.length === IDS_TODOS.length
                              ? "La IA analizará tu información y te entregará un análisis estructurado."
                              : "Solo las partes que has elegido: más rápido y más barato."}
                          </span>
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectorAbierto((v) => !v)}
                        disabled={formularioDeshabilitado}
                        aria-expanded={selectorAbierto}
                        aria-label="Elegir qué partes del análisis generar"
                        title="Elegir qué partes generar"
                        className="flex w-12 shrink-0 items-center justify-center rounded-r-xl border-l border-white/20 bg-accent texto-sobre-acento transition-colors hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
                      >
                        <ChevronDown
                          className={`h-5 w-5 transition-transform ${selectorAbierto ? "rotate-180" : ""}`}
                          aria-hidden="true"
                        />
                      </button>

                      {selectorAbierto && (
                        <SelectorBloques
                          seleccion={bloques}
                          onCambiar={setBloques}
                          onGenerar={manejarGenerarClick}
                          onCerrar={() => setSelectorAbierto(false)}
                          deshabilitado={formularioDeshabilitado}
                        />
                      )}
                    </div>
                  )}
                </div>

                {estado === "cargando" && (
                  <div className="mt-8">
                    <EsqueletoInforme />
                  </div>
                )}
              </div>

              <PanelRecomendaciones />
            </section>
          )}

          {enAnalisis && estado === "resultado" && analisis && (
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
                    onClick={manejarDescargarDocx}
                    className="rounded border border-divider bg-surface px-4 py-2 text-sm font-medium text-ink transition-colors hover:bg-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
                  >
                    Descargar Word
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
                    className="rounded bg-accent px-4 py-2 text-sm font-medium texto-sobre-acento transition-colors hover:bg-accent/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
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
                onEditarSeccion={manejarEditarSeccion}
              />
            </div>
          )}

          {vista === "guia" && <GuiaCompleta />}
          {vista === "configuracion" && <Configuracion />}

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
            <p className="mt-1 font-mono text-[11px] text-ink-muted/70">v1.4.0</p>
          </footer>
        </main>
      </div>
    </div>
  );
}
