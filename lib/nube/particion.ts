import type { Expediente, Nota, Revision, Sesion, VersionFormulacion } from "../casos";

/**
 * Un expediente se parte en documentos pequeños para Firestore (límite de
 * 1 MiB por documento; ver propuesta §4.2). Una parte por sesión (con sus notas
 * y versiones), un tramo de revisiones por sesión y una cabecera con el caso.
 * Lo que no encaja en ninguna sesión (no debería pasar) viaja en la cabecera
 * para no perderlo.
 */

export type TipoParte = "cabecera" | "sesion" | "revisiones";

export interface Parte {
  parte_id: string;
  tipo: TipoParte;
  /** JSON del contenido: es lo que se comprime y se cifra. */
  contenido: string;
}

interface Cabecera {
  caso: Expediente["caso"];
  huerfanos: { notas: Nota[]; versiones: VersionFormulacion[]; revisiones: Revision[] };
}
interface ContenidoSesion {
  sesion: Sesion;
  notas: Nota[];
  versiones: VersionFormulacion[];
}

export const ID_CABECERA = "cabecera";
export const idSesion = (id: string) => `s-${id}`;
export const idRevisiones = (sesionId: string) => `r-${sesionId}`;

export function partirExpediente(exp: Expediente): Parte[] {
  const sesiones = new Set(exp.sesiones.map((s) => s.id));
  const partes: Parte[] = [];

  const cabecera: Cabecera = {
    caso: exp.caso,
    huerfanos: {
      notas: exp.notas.filter((n) => !sesiones.has(n.sesion_id)),
      versiones: exp.versiones.filter((v) => !sesiones.has(v.sesion_id)),
      revisiones: exp.revisiones.filter((r) => !sesiones.has(r.sesion_id)),
    },
  };
  partes.push({ parte_id: ID_CABECERA, tipo: "cabecera", contenido: JSON.stringify(cabecera) });

  for (const sesion of exp.sesiones) {
    const contenido: ContenidoSesion = {
      sesion,
      notas: exp.notas.filter((n) => n.sesion_id === sesion.id),
      versiones: exp.versiones.filter((v) => v.sesion_id === sesion.id),
    };
    partes.push({ parte_id: idSesion(sesion.id), tipo: "sesion", contenido: JSON.stringify(contenido) });

    const revisiones = exp.revisiones.filter((r) => r.sesion_id === sesion.id);
    if (revisiones.length > 0) {
      partes.push({
        parte_id: idRevisiones(sesion.id),
        tipo: "revisiones",
        contenido: JSON.stringify(revisiones),
      });
    }
  }
  return partes;
}

/** Inversa de `partirExpediente`. null si falta la cabecera. */
export function unirExpediente(partes: Parte[]): Expediente | null {
  const cab = partes.find((p) => p.tipo === "cabecera");
  if (!cab) return null;
  const cabecera = JSON.parse(cab.contenido) as Cabecera;

  const sesiones: Sesion[] = [];
  const notas = [...cabecera.huerfanos.notas];
  const versiones = [...cabecera.huerfanos.versiones];
  const revisiones = [...cabecera.huerfanos.revisiones];

  for (const p of partes) {
    if (p.tipo === "sesion") {
      const c = JSON.parse(p.contenido) as ContenidoSesion;
      sesiones.push(c.sesion);
      notas.push(...c.notas);
      versiones.push(...c.versiones);
    } else if (p.tipo === "revisiones") {
      revisiones.push(...(JSON.parse(p.contenido) as Revision[]));
    }
  }
  sesiones.sort((a, b) => a.n - b.n);
  return { caso: cabecera.caso, sesiones, notas, revisiones, versiones };
}
