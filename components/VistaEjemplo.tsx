"use client";

import { useState } from "react";
import Link from "next/link";
import ReportView from "./ReportView";
import { AVISO_EJEMPLO } from "@/lib/maqueta";
import {
  formatearInformeTexto,
  ORDEN_BLOQUES_POR_DEFECTO,
} from "@/lib/formatearInforme";
import { descargarDocx } from "@/lib/exportarDocx";
import { leerOrdenGuardado } from "./ordenBloques";
import { revalidarTrasEdicion } from "@/lib/validadores";
import type { AnalisisFuncional } from "@/lib/types";

/**
 * El informe de ejemplo, tal y como se ve en la herramienta.
 *
 * Para qué: revisar el formato del informe desde cualquier dispositivo —un
 * móvil, la tableta de otra persona— sin gastar una llamada al modelo. Antes
 * eso solo se podía hacer en local con `npm run dev:maqueta`.
 *
 * Por qué es una página aparte y no un botón dentro del análisis: aquí no hay
 * cuadro de nota y no se llama a `/api/analizar`. Así este informe no puede
 * presentarse nunca como el análisis de la nota de nadie, que es el fallo grave
 * que hay que evitar. La ruta real de análisis se queda exactamente igual, con
 * su candado de producción intacto.
 *
 * El aviso de que es un ejemplo va en tres sitios y ninguno se puede quitar: la
 * franja de arriba, el encabezado de impresión y la primera línea del texto
 * copiado y del Word exportado. Un documento se lee fuera de contexto, así que
 * tiene que decir por sí mismo lo que es.
 */
export default function VistaEjemplo({
  analisisInicial,
  nota,
  fecha,
}: {
  analisisInicial: AnalisisFuncional;
  nota: string;
  fecha: string;
}) {
  const [analisis, setAnalisis] = useState(analisisInicial);
  const [referenciaCaso, setReferenciaCaso] = useState("");
  const [copiado, setCopiado] = useState(false);

  const orden = () => leerOrdenGuardado(ORDEN_BLOQUES_POR_DEFECTO);

  async function copiar() {
    const texto = formatearInformeTexto(
      analisis,
      referenciaCaso,
      fecha,
      orden(),
      true
    );
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      // Sin portapapeles (contexto no seguro o permiso denegado) queda el
      // recurso de siempre: seleccionar el informe a mano.
    }
  }

  /* Edición manual, igual que en la herramienta: se trabaja sobre una copia y
     se vuelven a pasar las comprobaciones deterministas, que no cuestan nada.
     Existe aquí para poder revisar también el aspecto de una sección editada. */
  function editarSeccion(
    seccionId: string,
    mutar: (copia: AnalisisFuncional) => void
  ) {
    setAnalisis((previo) => {
      const copia: AnalisisFuncional = JSON.parse(JSON.stringify(previo));
      mutar(copia);
      if (!copia.secciones_editadas.includes(seccionId)) {
        copia.secciones_editadas = [...copia.secciones_editadas, seccionId];
      }
      copia.alertas = revalidarTrasEdicion(copia, nota);
      return copia;
    });
  }

  return (
    <div className="min-h-screen bg-canvas">
      <FranjaEjemplo />

      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <div className="mb-6 flex flex-wrap gap-2 print:hidden">
          <button
            type="button"
            onClick={copiar}
            className="rounded border border-divider bg-surface px-3 py-2 text-sm text-ink transition-colors hover:border-accent hover:text-accent"
          >
            {copiado ? "Copiado" : "Copiar informe"}
          </button>
          <button
            type="button"
            onClick={() =>
              descargarDocx(analisis, referenciaCaso, fecha, orden(), true)
            }
            className="rounded border border-divider bg-surface px-3 py-2 text-sm text-ink transition-colors hover:border-accent hover:text-accent"
          >
            Descargar Word
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="rounded border border-divider bg-surface px-3 py-2 text-sm text-ink transition-colors hover:border-accent hover:text-accent"
          >
            Imprimir / Guardar como PDF
          </button>
          <Link
            href="/"
            className="rounded bg-accent px-3 py-2 text-sm font-medium texto-sobre-acento transition-colors hover:bg-accent/90"
          >
            Ir a la herramienta
          </Link>
        </div>

        <ReportView
          analisis={analisis}
          referenciaCaso={referenciaCaso}
          onReferenciaCasoChange={setReferenciaCaso}
          fecha={fecha}
          notaOriginal={nota}
          onAnalisisActualizado={(fragmento) =>
            setAnalisis((previo) => ({ ...previo, ...fragmento }))
          }
          onEditarSeccion={editarSeccion}
        />
      </div>
    </div>
  );
}

/** Franja fija, sin botón de cerrar, visible también al imprimir. */
function FranjaEjemplo() {
  return (
    <div className="border-b-2 border-warn bg-warn/15 px-4 py-3 text-center">
      <p className="mx-auto max-w-4xl text-sm font-medium leading-relaxed text-ink">
        <span className="font-mono text-xs uppercase tracking-wide text-warn">
          Informe de ejemplo ·{" "}
        </span>
        {AVISO_EJEMPLO.replace("INFORME DE EJEMPLO — ", "")}
      </p>
    </div>
  );
}
