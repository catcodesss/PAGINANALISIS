"use client";

/**
 * Lo que sale al imprimir: el mismo texto que «Copiar informe» y el Word
 * (lib/formatearInforme.ts), con formato de documento. Una sola fuente para
 * los tres: el espacio de trabajo es para trabajar y no se imprime, y así
 * nada de lo que viaja en el texto puede faltar en el papel.
 *
 * Solo se pinta en el cliente: el orden de los bloques es una preferencia
 * guardada en el navegador, y pintarla en el servidor daría un texto distinto
 * al de la hidratación.
 */

import { useMemo, useSyncExternalStore } from "react";
import type { AnalisisFuncional } from "@/lib/types";
import { formatearInformeTexto, ORDEN_BLOQUES_POR_DEFECTO } from "@/lib/formatearInforme";
import { leerOrdenGuardado } from "../ordenBloques";

const nada = () => () => {};

export default function DocumentoImpreso({
  analisis,
  referenciaCaso,
  fecha,
  esEjemplo = false,
}: {
  analisis: AnalisisFuncional;
  referenciaCaso: string;
  fecha: string;
  esEjemplo?: boolean;
}) {
  const enCliente = useSyncExternalStore(nada, () => true, () => false);
  const lineas = useMemo(() => {
    if (!enCliente) return [];
    return formatearInformeTexto(
      analisis,
      referenciaCaso,
      fecha,
      leerOrdenGuardado(ORDEN_BLOQUES_POR_DEFECTO),
      esEjemplo
    ).split("\n");
  }, [enCliente, analisis, referenciaCaso, fecha, esEjemplo]);

  if (!enCliente) return null;

  // Un título es la línea que va seguida de una fila de guiones; los guiones
  // no se imprimen. Un «## » es un subtítulo dentro de una sección.
  const piezas: React.ReactNode[] = [];
  for (let i = 0; i < lineas.length; i++) {
    const linea = lineas[i];
    if (/^-{3,}$/.test(linea)) continue;
    if (/^-{3,}$/.test(lineas[i + 1] ?? "")) {
      piezas.push(<h2 key={i} className="mt-6 font-serif text-[13pt] font-semibold">{linea}</h2>);
    } else if (linea.startsWith("## ")) {
      piezas.push(<h3 key={i} className="mt-3 font-serif text-[11pt] font-semibold">{linea.slice(3)}</h3>);
    } else if (linea.trim() === "") {
      piezas.push(<div key={i} className="h-2" />);
    } else {
      piezas.push(<p key={i} className="whitespace-pre-wrap text-[10pt] leading-snug">{linea}</p>);
    }
  }

  return <div className="documento-impreso hidden print:block">{piezas}</div>;
}
