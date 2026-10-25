"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  BookOpenText,
  ChevronDown,
  Lock,
  Moon,
  PenLine,
  Sparkles,
  SunMedium,
} from "lucide-react";
import type { AnalisisFuncional, DatoFaltante, PreguntaPrevia } from "@/lib/types";
import {
  contieneDatosIdentificables,
  enmascararDatosIdentificables,
} from "@/lib/pii";
import {
  formatearInformeTexto,
  ORDEN_BLOQUES_POR_DEFECTO,
} from "@/lib/formatearInforme";
import { leerOrdenGuardado } from "@/components/ordenBloques";
import { revalidarTrasEdicion, revalidarTrasReanalisis } from "@/lib/validadores";
import { descargarDocx } from "@/lib/exportarDocx";
import ReportView from "@/components/ReportView";
import GuiaCompleta from "@/components/GuiaCompleta";
import Configuracion from "@/components/Configuracion";
import SelectorBloques from "@/components/SelectorBloques";
import { IDS_POR_DEFECTO, IDS_TODOS } from "@/lib/bloques";
import EsqueletoInforme from "@/components/EsqueletoInforme";
import Sidebar, { type Vista } from "@/components/Sidebar";
import Evolucion from "@/components/Evolucion";
import PanelRecomendaciones from "@/components/PanelRecomendaciones";
import { usePreferencias } from "@/components/usePreferencias";
import { ausentesTrasReanalisis } from "@/lib/vacios";
import { calcularApoyoAristas } from "@/lib/apoyoAristas";
import { migrarAV8 } from "@/lib/identidad";
import { fusionarPreguntas } from "@/lib/preguntas";
import { cerrarEdicion } from "@/lib/procedenciaEdicion";
import Historial from "@/components/Historial";
import { ContextoCaso, type ValorCaso } from "@/components/contextoCaso";
import { repositorio } from "@/lib/repositorio";
import {
  anadirSesion,
  formulacionVigente,
  guardarVersion,
  obtenerVersion,
  registrarRevisiones,
  revisionesEntre,
  textoDeSesion,
  ultimaSesion,
  type AutorRevision,
  type Expediente,
} from "@/lib/casos";
import RevisarCambios from "@/components/RevisarCambios";
import {
  aplicarPropuestas,
  limpiarBlancosRevisados,
  type Aceptada,
  type ConjuntoCambios,
} from "@/lib/actualizacion";
import PreguntasDatosFaltantes, {
  type ResultadoPreguntas,
} from "@/components/PreguntasDatosFaltantes";

// El marcador de posición se mantiene corto a propósito. El ejemplo largo que
// había antes iba en viñetas telegráficas, justo lo que la guía desaconseja, y
// el cómo escribir la nota ya lo explican el texto de arriba y el panel de
// recomendaciones de al lado.
const MARCADOR_NOTA = "Pega aquí tu caso…";

type EstadoApp =
  | "inicial"
  | "detectando"
  | "preguntando"
  | "cargando"
  | "resultado"
  | "error";

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
  // La cadena DBT es opcional: solo entra en el análisis si se pide aquí.
  const [incluirCadenaDbt, setIncluirCadenaDbt] = useState(false);
  const bloquesDelFormulario = incluirCadenaDbt ? IDS_TODOS : IDS_POR_DEFECTO;
  // Preguntas del paso previo (ver lib/datosFaltantesPrevios.ts). null = no se
  // está preguntando nada; array = mostrando PreguntasDatosFaltantes.
  const [preguntas, setPreguntas] = useState<PreguntaPrevia[] | null>(null);
  // El texto tal como se decidió enviar (ya con PII resuelto), guardado
  // mientras dura el paso de preguntas para poder anexarle las respuestas
  // confirmadas al terminar.
  const [textoPendiente, setTextoPendiente] = useState("");
  const { preferencias, cambiar: cambiarPreferencias } = usePreferencias();

  /* ── Caso abierto (fase 7) ── */
  const [expediente, setExpediente] = useState<Expediente | null>(null);
  // Sesión anterior cuya formulación se está viendo, en solo lectura.
  const [sesionVista, setSesionVista] = useState<string | null>(null);
  const [nuevoCaso, setNuevoCaso] = useState(false);
  const [claveCasos, setClaveCasos] = useState(0);
  const [panelSesion, setPanelSesion] = useState(false);
  const [notaSesion, setNotaSesion] = useState("");
  const [registroSesion, setRegistroSesion] = useState("");
  const [avisoGuardado, setAvisoGuardado] = useState("");
  // Fase 8: el conjunto de cambios pendiente de la sesión recién añadida.
  const [revision, setRevision] = useState<{ conjunto: ConjuntoCambios; sesionId: string } | null>(null);
  const [actualizando, setActualizando] = useState(false);
  // Refs para los guardados asíncronos: leen el caso de ahora, no el del render
  // en que empezaron.
  const expedienteRef = useRef<Expediente | null>(null);
  const autorRef = useRef<AutorRevision>("clinico");

  async function persistir(siguiente: Expediente) {
    try {
      await repositorio.actualizarCaso(siguiente);
      expedienteRef.current = siguiente;
      setExpediente(siguiente);
      setAvisoGuardado("");
    } catch (e) {
      setAvisoGuardado(e instanceof Error ? e.message : "No se pudo guardar el caso.");
    }
  }

  /*
    Cada cambio del análisis dentro de un caso se guarda (con una pausa, para
    no cifrar en cada pulsación) como la formulación de la sesión actual, y
    deja una revisión por elemento cambiado con su autor (invariante 6). Las
    sesiones cerradas no se tocan: lo impide comprobarCambioExpediente.
  */
  useEffect(() => {
    if (!analisis || sesionVista) return;
    const temporizador = setTimeout(() => {
      const exp = expedienteRef.current;
      const ultima = exp ? ultimaSesion(exp) : null;
      if (!exp || !ultima || !repositorio.desbloqueado()) return;
      const guardado = obtenerVersion(exp, ultima.id);
      if (!guardado) return;
      const revisiones = revisionesEntre(guardado, analisis, {
        caso_id: exp.caso.id,
        sesion_id: ultima.id,
        autor: autorRef.current,
      });
      if (revisiones.length === 0) return;
      void persistir(guardarVersion(registrarRevisiones(exp, revisiones), ultima.id, analisis));
    }, 800);
    return () => clearTimeout(temporizador);
  }, [analisis, sesionVista]);

  function cambiarVista(v: Vista, nuevo?: boolean) {
    if (v === "analisis" && nuevo) manejarNuevoAnalisis();
    setVista(v);
    if (v === "casos") {
      setNuevoCaso(Boolean(nuevo));
      setClaveCasos((k) => k + 1);
    }
  }

  // Desde fuera (la página de ejemplo) se llega con `/?vista=casos`.
  useEffect(() => {
    const pedida = new URLSearchParams(window.location.search).get("vista");
    if (pedida === "casos" || pedida === "evolucion" || pedida === "guia" || pedida === "configuracion") {
      setVista(pedida);
    } else if (pedida === "nuevo") {
      cambiarVista("analisis", true);
    }
    if (pedida) window.history.replaceState(null, "", "/");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function abrirExpediente(exp: Expediente) {
    manejarNuevoAnalisis();
    expedienteRef.current = exp;
    setExpediente(exp);
    setReferenciaCaso(exp.caso.alias);
    setVista("analisis");
  }

  function manejarAbrirCaso(exp: Expediente) {
    abrirExpediente(exp);
    const vigente = formulacionVigente(exp);
    if (!vigente) return;
    // Las citas apuntan a la nota que se analizó: la de la primera sesión.
    const primera = [...exp.sesiones].sort((a, b) => a.n - b.n)[0];
    setUltimoTextoEnviado(textoDeSesion(exp, primera.id));
    setAnalisis(vigente.analisis);
    setFechaGeneracion(
      new Date(vigente.sesion.fecha).toLocaleString("es-PE", { dateStyle: "long", timeStyle: "short" })
    );
    setEstado("resultado");
  }

  /** La sesión 1 de un caso: la nota que se acaba de analizar y su formulación. */
  async function guardarSesionAnalizada(texto: string, resultado: AnalisisFuncional) {
    const exp = expedienteRef.current;
    if (!exp || exp.sesiones.length > 0 || !repositorio.desbloqueado()) return;
    const { expediente: conSesion, sesion } = anadirSesion(exp, { nota: texto });
    await persistir(guardarVersion(conSesion, sesion.id, resultado));
  }

  /**
   * «Añadir sesión» sin IA: guarda la nota y el registro, y la formulación
   * vigente pasa a ser la de la nueva sesión. No lanza un análisis
   * independiente, que daría dos formulaciones divergentes del mismo caso.
   */
  async function guardarNuevaSesion() {
    const exp = expedienteRef.current;
    if (!exp || !analisis) return;
    const { expediente: conSesion, sesion } = anadirSesion(exp, {
      nota: notaSesion,
      registro: registroSesion,
    });
    await persistir(guardarVersion(conSesion, sesion.id, analisis));
    setPanelSesion(false);
    setNotaSesion("");
    setRegistroSesion("");
    return { sesion, analisis };
  }

  /**
   * «Analizar sesión»: la nota se guarda primero (inmutable, aunque la
   * llamada falle) y luego el modelo propone cambios. Nada se aplica aquí.
   */
  async function analizarNuevaSesion() {
    const nota = notaSesion;
    setActualizando(true);
    const guardada = await guardarNuevaSesion();
    if (!guardada) {
      setActualizando(false);
      return;
    }
    try {
      const r = await fetch("/api/actualizar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nota, analisis: guardada.analisis, sesion: guardada.sesion.n }),
      });
      const datos = await r.json().catch(() => null);
      if (!r.ok || !datos?.conjunto) {
        setAvisoGuardado(
          `Sesión guardada sin análisis. ${typeof datos?.message === "string" ? datos.message : MENSAJE_ERROR_GENERICO}`
        );
        return;
      }
      setRevision({ conjunto: datos.conjunto as ConjuntoCambios, sesionId: guardada.sesion.id });
    } catch {
      setAvisoGuardado(`Sesión guardada sin análisis. ${MENSAJE_ERROR_GENERICO}`);
    } finally {
      setActualizando(false);
    }
  }

  /**
   * Aplica solo lo aceptado. Dos pasos para la autoría (invariante 6): lo
   * aceptado tal cual deja revisiones de la IA; lo editado, del clínico.
   */
  async function aplicarRevision(aceptadas: Aceptada[]) {
    const exp = expedienteRef.current;
    if (!revision || !exp || !analisis) return;
    const n = revision.conjunto.sesion;
    const editada = (x: Aceptada) =>
      x.valorEditado !== undefined && x.valorEditado.trim() !== "" && x.valorEditado !== x.propuesta.valor;
    const conIA = structuredClone(analisis);
    aplicarPropuestas(conIA, aceptadas.filter((x) => !editada(x)), n);
    const final = structuredClone(conIA);
    aplicarPropuestas(final, aceptadas.filter(editada), n);
    calcularApoyoAristas(final);
    final.alertas = revalidarTrasEdicion(final, ultimoTextoEnviado);
    const datos = { caso_id: exp.caso.id, sesion_id: revision.sesionId, motivo: `Sesión ${n}` };
    const revisiones = [
      ...revisionesEntre(analisis, conIA, { ...datos, autor: "ia" }),
      ...revisionesEntre(conIA, final, { ...datos, autor: "clinico" }),
    ];
    await persistir(guardarVersion(registrarRevisiones(exp, revisiones), revision.sesionId, final));
    setAnalisis(final);
    setRevision(null);
  }

  const ultima = expediente ? ultimaSesion(expediente) : null;
  const sesionMostrada =
    (sesionVista && expediente?.sesiones.find((s) => s.id === sesionVista)) || ultima;
  const analisisMostrado =
    sesionVista && expediente ? obtenerVersion(expediente, sesionVista) ?? analisis : analisis;
  const valorCaso: ValorCaso | null =
    expediente && sesionMostrada
      ? {
          expediente,
          sesion: sesionMostrada,
          soloLectura: sesionVista !== null,
          verVersion: setSesionVista,
          anadirSesion: () => setPanelSesion(true),
        }
      : null;

  // Con el tema en "sistema" no se sabe en el servidor cuál se ve; se lee lo
  // que el script de layout.tsx ya aplicó a <html>, que es lo que ve el usuario.
  function alternarTema() {
    const oscuroAhora = document.documentElement.dataset.tema === "oscuro";
    cambiarPreferencias({ tema: oscuroAhora ? "claro" : "oscuro" });
  }

  async function ejecutarAnalisis(
    texto: string,
    bloquesPedidos: string[] = bloquesDelFormulario,
    datosFaltantesDeclarados: DatoFaltante[] = []
  ) {
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
        body: JSON.stringify({
          nota: texto,
          bloques: bloquesPedidos,
          datosFaltantesDeclarados,
        }),
      });

      const datos = await respuesta.json().catch(() => null);

      if (!respuesta.ok || !datos?.analisis) {
        // La ruta ya redacta un mensaje distinto por causa (nota larga, cuota
        // del proveedor, respuesta truncada, clave rechazada) y son textos fijos
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
      void guardarSesionAnalizada(texto, datos.analisis as AnalisisFuncional);
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

  /**
   * Paso previo a ejecutarAnalisis: una llamada barata (ver
   * lib/datosFaltantesPrevios.ts) que revisa la nota antes de gastar la
   * llamada completa. Si encuentra vacíos importantes, los muestra como
   * preguntas antes de analizar; si no encuentra nada o la llamada falla, pasa
   * directo al análisis, exactamente como si este paso no existiera — nunca
   * bloquea por su cuenta.
   */
  async function iniciarFlujo(texto: string) {
    setSelectorAbierto(false);
    setAvisoPII(false);
    setMensajeValidacion("");
    setMensajeError("");
    setTextoPendiente(texto);
    setEstado("detectando");

    let detectadas: PreguntaPrevia[] = [];
    try {
      const respuesta = await fetch("/api/detectar-datos-faltantes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nota: texto }),
      });
      const datos = await respuesta.json().catch(() => null);
      if (Array.isArray(datos?.preguntas)) {
        // La ruta ya normaliza la forma (ver lib/datosFaltantesPrevios.ts);
        // aquí solo se descarta lo que llegue sin pregunta, que no se podría
        // ni enseñar.
        detectadas = (datos.preguntas as unknown[]).filter(
          (p): p is PreguntaPrevia =>
            typeof p === "object" &&
            p !== null &&
            typeof (p as PreguntaPrevia).pregunta === "string" &&
            (p as PreguntaPrevia).pregunta.trim().length > 0
        );
      }
    } catch {
      detectadas = [];
    }

    if (detectadas.length === 0) {
      void ejecutarAnalisis(texto);
      return;
    }

    setPreguntas(detectadas);
    setEstado("preguntando");
  }

  /**
   * Lo confirmado se suma a la nota como un apéndice, antes de analizar: así
   * el análisis completo ya lo tiene y no vuelve a marcarlo como faltante. Lo
   * omitido ("No sé") viaja aparte, para que el servidor lo declare en
   * datos_faltantes sin depender de que el modelo lo repita (ver
   * app/api/analizar/route.ts).
   */
  function manejarCompletarPreguntas({ confirmadas, omitidas }: ResultadoPreguntas) {
    let textoFinal = textoPendiente;
    if (confirmadas.length > 0) {
      const apendice = confirmadas
        .map((c) => `- ${c.pregunta}\n  Respuesta: ${c.respuesta}`)
        .join("\n");
      textoFinal = `${textoFinal}\n\n--- Información adicional confirmada por el terapeuta ---\n${apendice}`;
    }
    setPreguntas(null);
    void ejecutarAnalisis(textoFinal, bloquesDelFormulario, omitidas);
  }

  /** Cerrar la ventana de preguntas: no se analiza nada y la nota queda intacta. */
  function manejarCancelarPreguntas() {
    setPreguntas(null);
    setTextoPendiente("");
    setEstado("inicial");
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

    void iniciarFlujo(nota);
  }

  function manejarEnmascararYAnalizar() {
    const enmascarada = enmascararDatosIdentificables(nota);
    setNota(enmascarada);
    void iniciarFlujo(enmascarada);
  }

  function manejarAnalizarSinCambios() {
    void iniciarFlujo(nota);
  }

  function manejarReintentar() {
    void ejecutarAnalisis(ultimoTextoEnviado);
  }

  function manejarNuevoAnalisis() {
    expedienteRef.current = null;
    setExpediente(null);
    setSesionVista(null);
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
    setPreguntas(null);
    setTextoPendiente("");
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
    seccionId: string | null,
    mutar: (copia: AnalisisFuncional) => void
  ) {
    if (sesionVista) return; // versión anterior: solo lectura
    autorRef.current = "clinico";
    setAnalisis((previo) => {
      if (!previo) return previo;
      const copia = structuredClone(previo);
      mutar(copia);
      cerrarEdicion(previo, copia, seccionId === null);
      // Un blanco que el clínico toca deja de pedir revisión por la hipótesis.
      limpiarBlancosRevisados(previo, copia);
      // null = decisión sobre la propuesta (estado del plan), no texto propio.
      if (seccionId !== null && !previo.secciones_editadas.includes(seccionId)) {
        copia.secciones_editadas = [...previo.secciones_editadas, seccionId];
      }
      copia.alertas = revalidarTrasEdicion(copia, ultimoTextoEnviado);
      return copia;
    });
  }

  /**
   * Resultado de "+ Agregar nota y reanalizar esta sección" (BloqueReanalisis
   * en ReportView.tsx): el fragmento lo escribió la IA de nuevo, así que puede
   * traer el mismo tipo de error que el informe original (p. ej. prescribir de
   * nuevo una conducta de seguridad). Antes este fragmento se fusionaba sin
   * revisar; ahora se revalida igual que una edición manual, pero con
   * revalidarTrasReanalisis, que sí recalcula la confianza (ver
   * lib/validadores.ts) porque este contenido es tan nuevo como el original.
   */
  function manejarAnalisisActualizado(fragmento: Partial<AnalisisFuncional>) {
    if (sesionVista) return;
    autorRef.current = "ia";
    setAnalisis((previo) => {
      if (!previo) return previo;
      const actualizado = structuredClone(previo);
      // Reanalizar las preguntas no pisa lo que el clínico ya trabajó: se
      // conservan las respondidas, descartadas, suyas o del paso previo.
      if (fragmento.preguntas) {
        fragmento = {
          ...fragmento,
          preguntas: fusionarPreguntas(previo.preguntas, fragmento.preguntas),
        };
      }
      Object.assign(actualizado, fragmento);
      // El fragmento llega sin ids ni referencias resueltas: se completan con
      // el mismo paso idempotente que usa el análisis recién generado.
      migrarAV8(actualizado);
      actualizado.campos_ausentes = ausentesTrasReanalisis(previo, fragmento);
      // Las citas de los nodos pueden haber cambiado: el apoyo de las
      // relaciones se vuelve a calcular, no se arrastra el de antes.
      calcularApoyoAristas(actualizado);
      actualizado.alertas = revalidarTrasReanalisis(actualizado, ultimoTextoEnviado);
      return actualizado;
    });
  }

  // Guía y configuración ocultan el formulario y el informe: las tres vistas
  // comparten contenedor y cabecera, solo cambia el cuerpo.
  const enAnalisis = vista === "analisis";
  const TITULOS: Record<typeof vista, { titulo: string; bajada: string }> = {
    casos: {
      titulo: "Casos",
      bajada: "Cifrados en este dispositivo.",
    },
    evolucion: {
      titulo: "Evolución",
      bajada: "Una carpeta por paciente.",
    },
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
  const formularioDeshabilitado =
    estado === "cargando" || estado === "detectando" || estado === "preguntando";

  return (
    <div className="flex min-h-screen bg-canvas print:block">
      <Sidebar vista={vista} onCambiarVista={cambiarVista} />

      <div className="min-w-0 flex-1">
        <main
          // El informe ya generado necesita más aire que el formulario: es
          // donde viven la cadena dibujada, las tablas y el resto del
          // análisis, y max-w-6xl las apretaba a todas por igual, no solo a
          // la cadena.
          className={`mx-auto px-4 py-8 sm:px-6 sm:py-10 lg:px-10 print:max-w-none print:px-0 print:py-0 ${
            estado === "resultado" ? "max-w-none" : "max-w-6xl"
          }`}
        >
          <header className="mb-8 flex flex-wrap items-start justify-between gap-4 print:hidden">
            <div className="min-w-0">
              {enAnalisis && (
                <p className="mb-4 flex items-center gap-3 font-mono text-xs font-medium uppercase tracking-[0.25em] text-tierra">
                  <span aria-hidden="true" className="h-px w-9 bg-dorado" />
                  Bienvenida a ACIA
                </p>
              )}
              <h1 className="font-serif text-3xl font-semibold leading-tight tracking-tight text-ink sm:text-4xl xl:text-5xl">
                {cabecera.titulo}
              </h1>
              <p className="mt-3 text-base text-ink-muted sm:text-lg">
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
                onClick={alternarTema}
                title="Cambiar entre modo claro y oscuro"
                aria-label="Cambiar entre modo claro y oscuro"
                className="hidden h-12 w-12 items-center justify-center rounded-full border border-divider bg-surface text-tierra sm:flex shadow-sm transition-colors hover:bg-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30"
              >
                {preferencias.tema === "oscuro" ? (
                  <Moon className="h-5 w-5" aria-hidden="true" />
                ) : (
                  <SunMedium className="h-5 w-5" aria-hidden="true" />
                )}
              </button>
            </div>
          </header>

          {formularioVisible && (
            <section className="grid gap-7 print:hidden lg:grid-cols-[1fr_340px] xl:grid-cols-[1fr_400px]">
              <div className="min-w-0">
                <div className="rounded-3xl border border-divider bg-surface p-5 shadow-[0_2px_10px_rgba(60,45,25,0.06)] sm:p-8">
                  <div className="flex items-center gap-4">
                    <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-tierra-soft">
                      <PenLine className="h-6 w-6 text-tierra" aria-hidden="true" />
                    </span>
                    <p className="font-serif text-xl font-semibold text-ink sm:text-2xl">
                      Describe la situación
                    </p>
                  </div>
                  <p className="mt-4 text-sm leading-relaxed text-ink-muted sm:text-[15px]">
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
                    className="mt-5 w-full resize-y rounded-2xl border border-divider bg-surface px-5 py-4 text-[15px] leading-relaxed text-ink placeholder:text-ink-muted focus-visible:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30 disabled:cursor-not-allowed disabled:opacity-60"
                  />

                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                    <p className="font-mono text-xs text-ink-muted">
                      {nota.length} / {LONGITUD_MAXIMA}
                    </p>
                    <p className="text-xs text-ink-muted">
                      Consejo: escribe en prosa, luego la IA identificará patrones.
                    </p>
                  </div>

                  {/* No dice "de forma segura": sin DPA ni retención cero con
                      el proveedor del modelo no se puede sostener (ver CLAUDE.md, limitaciones).
                      Dice lo que pasa de verdad con el texto. */}
                  <div className="mt-5 flex items-start gap-3 border-t border-divider pt-5">
                    <Lock className="mt-0.5 h-4 w-4 shrink-0 text-tierra" aria-hidden="true" />
                    <p className="text-xs leading-relaxed text-ink-muted">
                      <span className="font-semibold text-ink">Privacidad:</span> el
                      ACIA no guarda el texto de tus notas. No incluyas nombres
                      reales ni datos identificables.
                    </p>
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
                    <div className="relative mt-6 flex rounded-2xl shadow-[0_6px_18px_rgba(15,90,67,0.22)]">
                      <button
                        type="button"
                        onClick={manejarGenerarClick}
                        disabled={formularioDeshabilitado}
                        className="group flex min-w-0 flex-1 items-center gap-4 rounded-l-2xl bg-accent px-6 py-5 text-left texto-sobre-acento transition-colors hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
                      >
                        <Sparkles className="h-7 w-7 shrink-0 text-dorado" strokeWidth={1.5} aria-hidden="true" />
                        <span className="min-w-0 flex-1">
                          <span className="block text-base font-semibold sm:text-lg">
                            Generar análisis funcional
                          </span>
                          <span className="mt-0.5 block text-xs text-white/75 sm:text-sm">
                            La IA analizará tu información y te entregará un análisis estructurado.
                          </span>
                        </span>
                        <ArrowRight
                          className="h-5 w-5 shrink-0 transition-transform group-hover:translate-x-1"
                          aria-hidden="true"
                        />
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectorAbierto((v) => !v)}
                        disabled={formularioDeshabilitado}
                        aria-expanded={selectorAbierto}
                        aria-label="Elegir qué partes del análisis generar"
                        title="Elegir qué partes generar"
                        className="flex w-14 shrink-0 items-center justify-center rounded-r-2xl border-l border-white/20 bg-accent texto-sobre-acento transition-colors hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
                      >
                        <ChevronDown
                          className={`h-5 w-5 transition-transform ${selectorAbierto ? "rotate-180" : ""}`}
                          aria-hidden="true"
                        />
                      </button>

                      {selectorAbierto && (
                        <SelectorBloques
                          onCerrar={() => setSelectorAbierto(false)}
                          incluirCadenaDbt={incluirCadenaDbt}
                          onIncluirCadenaDbt={setIncluirCadenaDbt}
                        />
                      )}
                    </div>
                  )}
                  {!avisoPII && incluirCadenaDbt && (
                    <p className="mt-2 inline-block rounded-full bg-accent/10 px-3 py-1 text-xs font-medium text-accent">
                      + Incluye análisis en cadena (DBT)
                    </p>
                  )}
                </div>

                {estado === "detectando" && (
                  <div className="mt-8 flex items-center gap-3 rounded-2xl border border-divider bg-surface p-5 shadow-sm sm:p-6">
                    <span
                      aria-hidden="true"
                      className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-accent border-t-transparent"
                    />
                    <p className="text-sm text-ink-muted">
                      Revisando la nota antes de generar el análisis…
                    </p>
                  </div>
                )}

                {estado === "preguntando" && preguntas && (
                  <PreguntasDatosFaltantes
                    preguntas={preguntas}
                    onCompletar={manejarCompletarPreguntas}
                    onCancelar={manejarCancelarPreguntas}
                  />
                )}

                {estado === "cargando" && (
                  <div className="mt-8">
                    <EsqueletoInforme />
                  </div>
                )}
              </div>

              <PanelRecomendaciones onAbrirGuia={() => setVista("guia")} />
            </section>
          )}

          {enAnalisis && estado === "resultado" && analisisMostrado && (
            <ContextoCaso.Provider value={valorCaso}>
            <div className="mt-2">
              <div className="sticky top-0 z-10 -mx-4 mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-divider bg-surface/95 px-4 py-3 backdrop-blur print:hidden sm:-mx-6 sm:px-6">
                <p className="min-w-0 truncate text-sm text-ink-muted">
                  {referenciaCaso.trim() && (
                    <span className="text-ink">{referenciaCaso.trim()} · </span>
                  )}
                  {fechaGeneracion}
                </p>
                <div className="flex flex-wrap gap-3">
                  {/* Copiar, Word e imprimir viven en «Exportar ▾» de la cabecera del informe. */}
                  <button
                    type="button"
                    onClick={manejarNuevoAnalisis}
                    className="rounded bg-accent px-4 py-2 text-sm font-medium texto-sobre-acento transition-colors hover:bg-accent/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
                  >
                    Nuevo análisis
                  </button>
                </div>
              </div>
              {sesionVista && sesionMostrada && (
                <p role="status" className="mb-4 flex flex-wrap items-center gap-3 rounded-md border border-divider bg-canvas px-4 py-2 text-sm text-ink print:hidden">
                  Viendo la formulación de la sesión {sesionMostrada.n}
                  <button type="button" onClick={() => setSesionVista(null)} className="font-medium text-accent hover:underline">
                    Volver a la vigente
                  </button>
                </p>
              )}
              {avisoGuardado && (
                <p role="alert" className="mb-4 text-sm text-warn print:hidden">
                  {avisoGuardado}
                </p>
              )}
              <ReportView
                key={sesionVista ?? "vigente"}
                analisis={analisisMostrado}
                referenciaCaso={referenciaCaso}
                onReferenciaCasoChange={setReferenciaCaso}
                fecha={fechaGeneracion}
                notaOriginal={ultimoTextoEnviado}
                onAnalisisActualizado={manejarAnalisisActualizado}
                onEditarSeccion={manejarEditarSeccion}
                acciones={{
                  onCopiar: manejarCopiarInforme,
                  copiado,
                  onWord: manejarDescargarDocx,
                }}
              />
            </div>
            </ContextoCaso.Provider>
          )}

          {panelSesion && expediente && (
            <div role="dialog" aria-modal="true" aria-label="Añadir sesión" className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 print:hidden">
              <div className="w-full max-w-lg rounded-xl border border-divider bg-surface p-5">
                <p className="font-serif text-lg font-semibold text-ink">
                  Sesión {(ultima?.n ?? 0) + 1}
                </p>
                <textarea
                  value={notaSesion}
                  onChange={(e) => setNotaSesion(e.target.value)}
                  rows={7}
                  maxLength={LONGITUD_MAXIMA}
                  placeholder="Nota de la sesión…"
                  autoFocus
                  className="mt-3 w-full resize-y rounded-lg border border-divider bg-canvas px-3 py-2 text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
                />
                <textarea
                  value={registroSesion}
                  onChange={(e) => setRegistroSesion(e.target.value)}
                  rows={2}
                  placeholder="Qué se hizo · tareas revisadas (opcional)"
                  className="mt-2 w-full resize-y rounded-lg border border-divider bg-canvas px-3 py-2 text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
                />
                {contieneDatosIdentificables(notaSesion) && (
                  <p role="alert" className="mt-2 text-xs text-warn">
                    La nota parece tener datos identificables.{" "}
                    <button type="button" onClick={() => setNotaSesion(enmascararDatosIdentificables(notaSesion))} className="font-medium underline">
                      Enmascarar
                    </button>
                  </p>
                )}
                <div className="mt-4 flex flex-wrap justify-end gap-2">
                  <button type="button" onClick={() => setPanelSesion(false)} className="rounded border border-divider px-4 py-1.5 text-sm font-medium text-ink transition-colors hover:bg-canvas">
                    Cancelar
                  </button>
                  <button type="button" onClick={() => void guardarNuevaSesion()} disabled={!notaSesion.trim() || actualizando} title="Guarda la nota sin IA; la formulación no cambia" className="rounded border border-divider px-4 py-1.5 text-sm font-medium text-ink transition-colors hover:bg-canvas disabled:opacity-50">
                    Solo guardar
                  </button>
                  <button type="button" onClick={() => void analizarNuevaSesion()} disabled={!notaSesion.trim() || actualizando} className="rounded bg-accent px-4 py-1.5 text-sm font-medium texto-sobre-acento transition-colors hover:bg-accent/90 disabled:opacity-50">
                    {actualizando ? "Analizando…" : "Analizar sesión · 1 crédito"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {revision && analisis && (
            <RevisarCambios
              analisis={analisis}
              conjunto={revision.conjunto}
              onAplicar={(aceptadas) => void aplicarRevision(aceptadas)}
              onCancelar={() => setRevision(null)}
            />
          )}

          {vista === "casos" && (
            <Historial
              key={claveCasos}
              nuevoAbierto={nuevoCaso}
              onAbrir={manejarAbrirCaso}
              onCreado={abrirExpediente}
            />
          )}
          {vista === "evolucion" && <Evolucion onAbrir={manejarAbrirCaso} />}
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
            <p className="mt-1 font-mono text-[11px] text-ink-muted">v1.4.0</p>
          </footer>
        </main>
      </div>
    </div>
  );
}
