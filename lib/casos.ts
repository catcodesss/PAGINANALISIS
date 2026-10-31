import type { AnalisisFuncional, Id } from "./types";
import { contieneDatosIdentificables } from "./pii";

/**
 * Casos y sesiones (fase 7): la lógica pura, sin IndexedDB ni cifrado, para
 * poder probarla en Node. `lib/repositorio.ts` guarda cada expediente como un
 * único sobre cifrado.
 *
 * POR QUÉ UN SOBRE POR CASO Y UNA INSTANTÁNEA COMPLETA POR SESIÓN. El análisis
 * migrado del caso 01 ocupa ~23 KB en JSON; siete sesiones son ~176 KB por
 * caso (`evals/casos.test.mjs` lo mide). Es poco para IndexedDB, y a cambio la
 * versión N se reabre tal cual se cerró, sin reconstruirla desde punteros: un
 * fallo en la reconstrucción daría una formulación pasada que nunca existió,
 * que es peor que gastar disco. Los punteros se plantearían si un caso típico
 * pasara de cientos de sesiones.
 *
 * Dos acuerdos que `comprobarCambioExpediente` hace cumplir antes de guardar,
 * en vez de confiar en que nadie llame a la función equivocada:
 *   - una nota analizada no cambia de texto; se corrige con anotaciones;
 *   - las revisiones solo se añaden, y las versiones de sesiones ya cerradas
 *     no se tocan.
 */

export type FaseCaso = "activo" | "en_pausa" | "archivado";
export type AutorRevision = "ia" | "clinico";

export interface Caso {
  id: Id;
  /** Alias, nunca el nombre. `avisoAlias` avisa si lo parece. */
  alias: string;
  motivo: string;
  fase: FaseCaso;
  creado: string;
  actualizado: string;
  /** Fecha en que se eliminó (modo local). Pasados 30 días se borra para siempre. */
  eliminado_en?: string | null;
}

export interface Sesion {
  id: Id;
  caso_id: Id;
  n: number;
  fecha: string;
  nota_ids: Id[];
  version_id: Id | null;
  /** Lo que se hizo y las tareas revisadas, en palabras del clínico. */
  registro: string;
}

export interface AnotacionNota {
  fecha: string;
  texto: string;
}

export interface Nota {
  id: Id;
  sesion_id: Id;
  texto: string;
  anotaciones: AnotacionNota[];
}

export interface Revision {
  id: Id;
  caso_id: Id;
  objeto_id: Id;
  sesion_id: Id;
  autor: AutorRevision;
  /** JSON del elemento antes y después; null si se creó o se borró. */
  antes: string | null;
  despues: string | null;
  motivo: string;
  fecha: string;
}

export interface VersionFormulacion {
  id: Id;
  caso_id: Id;
  sesion_id: Id;
  analisis: AnalisisFuncional;
}

/** Todo lo de un caso. Es la unidad que se cifra y se guarda. */
export interface Expediente {
  caso: Caso;
  sesiones: Sesion[];
  notas: Nota[];
  revisiones: Revision[];
  versiones: VersionFormulacion[];
}

export interface ResumenCaso {
  id: Id;
  alias: string;
  fase: FaseCaso;
  actualizado: string;
  ultima_sesion: number;
  fecha_ultima_sesion: string | null;
  blancos_activos: number;
  preguntas_abiertas: number;
  alertas: number;
  /** Eliminado y a la espera del borrado definitivo; null o ausente si no. */
  eliminado_en?: string | null;
}

/** Días que un caso eliminado espera antes del borrado definitivo. */
export const DIAS_PARA_BORRAR = 30;

/** Fecha del borrado definitivo de un caso eliminado. */
export function fechaDeBorrado(eliminadoEn: string): Date {
  return new Date(new Date(eliminadoEn).getTime() + DIAS_PARA_BORRAR * 24 * 60 * 60 * 1000);
}

/** Días que faltan para el borrado definitivo (0 = hoy). */
export function diasParaBorrar(eliminadoEn: string, ahora = new Date()): number {
  return Math.max(0, Math.ceil((fechaDeBorrado(eliminadoEn).getTime() - ahora.getTime()) / (24 * 60 * 60 * 1000)));
}

type GeneradorId = () => string;

const idPorDefecto: GeneradorId = () =>
  globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;

export function crearExpediente(
  datos: { alias: string; motivo?: string },
  ahora = new Date().toISOString(),
  nuevoId: GeneradorId = idPorDefecto
): Expediente {
  return {
    caso: {
      id: nuevoId(),
      alias: datos.alias.trim() || "Sin alias",
      motivo: (datos.motivo ?? "").trim(),
      fase: "activo",
      creado: ahora,
      actualizado: ahora,
    },
    sesiones: [],
    notas: [],
    revisiones: [],
    versiones: [],
  };
}

/**
 * Añade la sesión N+1 con su nota. No analiza nada: en la fase 7 una sesión
 * nueva no puede lanzar un análisis independiente, que daría dos
 * formulaciones divergentes del mismo caso.
 */
export function anadirSesion(
  exp: Expediente,
  datos: { nota: string; registro?: string },
  ahora = new Date().toISOString(),
  nuevoId: GeneradorId = idPorDefecto
): { expediente: Expediente; sesion: Sesion } {
  const sesion: Sesion = {
    id: nuevoId(),
    caso_id: exp.caso.id,
    n: exp.sesiones.reduce((m, s) => Math.max(m, s.n), 0) + 1,
    fecha: ahora,
    nota_ids: [],
    version_id: null,
    registro: (datos.registro ?? "").trim(),
  };
  const notas = [...exp.notas];
  if (datos.nota.trim()) {
    const nota: Nota = { id: nuevoId(), sesion_id: sesion.id, texto: datos.nota, anotaciones: [] };
    notas.push(nota);
    sesion.nota_ids.push(nota.id);
  }
  return {
    expediente: {
      ...exp,
      caso: { ...exp.caso, actualizado: ahora },
      sesiones: [...exp.sesiones, sesion],
      notas,
    },
    sesion,
  };
}

/** La única forma de corregir una nota: añadirle una anotación fechada. */
export function anotarNota(
  exp: Expediente,
  notaId: Id,
  texto: string,
  ahora = new Date().toISOString()
): Expediente {
  if (!texto.trim()) return exp;
  return {
    ...exp,
    caso: { ...exp.caso, actualizado: ahora },
    notas: exp.notas.map((n) =>
      n.id === notaId ? { ...n, anotaciones: [...n.anotaciones, { fecha: ahora, texto: texto.trim() }] } : n
    ),
  };
}

export function ultimaSesion(exp: Expediente): Sesion | null {
  return exp.sesiones.reduce<Sesion | null>((u, s) => (!u || s.n > u.n ? s : u), null);
}

/**
 * Guarda la formulación de la sesión actual (la última). Mientras sea la
 * última se reemplaza al guardar; en cuanto hay otra después, queda cerrada.
 */
export function guardarVersion(
  exp: Expediente,
  sesionId: Id,
  analisis: AnalisisFuncional,
  nuevoId: GeneradorId = idPorDefecto
): Expediente {
  const ultima = ultimaSesion(exp);
  if (!ultima || ultima.id !== sesionId) {
    throw new Error("Solo se puede guardar la formulación de la sesión actual.");
  }
  const previa = exp.versiones.find((v) => v.sesion_id === sesionId);
  const version: VersionFormulacion = {
    id: previa?.id ?? nuevoId(),
    caso_id: exp.caso.id,
    sesion_id: sesionId,
    analisis: structuredClone(analisis),
  };
  return {
    ...exp,
    versiones: [...exp.versiones.filter((v) => v.sesion_id !== sesionId), version],
    sesiones: exp.sesiones.map((s) => (s.id === sesionId ? { ...s, version_id: version.id } : s)),
  };
}

export function obtenerVersion(exp: Expediente, sesionId: Id): AnalisisFuncional | null {
  const v = exp.versiones.find((x) => x.sesion_id === sesionId);
  return v ? structuredClone(v.analisis) : null;
}

/** La formulación vigente: la de la sesión más reciente que tenga una. */
export function formulacionVigente(exp: Expediente): { sesion: Sesion; analisis: AnalisisFuncional } | null {
  const ordenadas = [...exp.sesiones].sort((a, b) => b.n - a.n);
  for (const s of ordenadas) {
    const analisis = obtenerVersion(exp, s.id);
    if (analisis) return { sesion: s, analisis };
  }
  return null;
}

/**
 * Una sesión vacía: creada con «Sesión vacía», sin nota ni formulación. Sus
 * cuadros esperan a que se le agregue la nota y se analice.
 */
export function esSesionVacia(exp: Expediente, sesion: Sesion): boolean {
  return (
    sesion.version_id === null &&
    !exp.versiones.some((v) => v.sesion_id === sesion.id) &&
    !exp.notas.some((n) => n.sesion_id === sesion.id)
  );
}

/**
 * Le pone la nota (y el registro) a la sesión vacía, que tiene que ser la
 * última. La nota queda tan inmutable como cualquier otra.
 */
export function completarSesion(
  exp: Expediente,
  sesionId: Id,
  datos: { nota: string; registro?: string },
  ahora = new Date().toISOString(),
  nuevoId: GeneradorId = idPorDefecto
): { expediente: Expediente; sesion: Sesion } {
  const sesion = exp.sesiones.find((s) => s.id === sesionId);
  if (!sesion || ultimaSesion(exp)?.id !== sesionId || !esSesionVacia(exp, sesion)) {
    throw new Error("Solo se puede completar la sesión vacía más reciente.");
  }
  const notas = [...exp.notas];
  const completa: Sesion = { ...sesion, nota_ids: [], registro: (datos.registro ?? "").trim() };
  if (datos.nota.trim()) {
    const nota: Nota = { id: nuevoId(), sesion_id: sesionId, texto: datos.nota, anotaciones: [] };
    notas.push(nota);
    completa.nota_ids.push(nota.id);
  }
  return {
    expediente: {
      ...exp,
      caso: { ...exp.caso, actualizado: ahora },
      sesiones: exp.sesiones.map((s) => (s.id === sesionId ? completa : s)),
      notas,
    },
    sesion: completa,
  };
}

/** Quita una sesión vacía. Una sesión con nota o formulación no se borra. */
export function quitarSesionVacia(exp: Expediente, sesionId: Id, ahora = new Date().toISOString()): Expediente {
  const sesion = exp.sesiones.find((s) => s.id === sesionId);
  if (!sesion || !esSesionVacia(exp, sesion)) {
    throw new Error("Solo se puede borrar una sesión vacía.");
  }
  return {
    ...exp,
    caso: { ...exp.caso, actualizado: ahora },
    sesiones: exp.sesiones.filter((s) => s.id !== sesionId),
  };
}

/** El texto de la nota con sus anotaciones, para el analizador y la Fuente. */
export function textoDeSesion(exp: Expediente, sesionId: Id): string {
  return exp.notas
    .filter((n) => n.sesion_id === sesionId)
    .map((n) => n.texto)
    .join("\n\n");
}

// --- revisiones ----------------------------------------------------------

/** Cada elemento con id del análisis, en JSON estable, para comparar. */
export function elementosPorId(a: AnalisisFuncional): Map<Id, string> {
  const m = new Map<Id, string>();
  const poner = (lista: readonly { id?: unknown }[] | undefined) => {
    for (const e of lista ?? []) if (typeof e.id === "string" && e.id) m.set(e.id, JSON.stringify(e));
  };
  poner(a.conductas_problema);
  poner(a.repertorio_disponible);
  poner(a.variables_moduladoras);
  poner(a.acomodacion_entorno);
  poner(a.hipotesis_mantenimiento);
  poner(a.conductas_alternativas);
  poner(a.reglas_verbales);
  poner(a.capa_dbt?.analisis_de_soluciones);
  poner(a.hipotesis_alternativas);
  poner(a.preguntas);
  poner(a.lineas_de_intervencion_tentativas);
  poner(a.plan_de_monitorizacion);
  poner(a.blancos);
  poner(a.clases_funcionales);
  poner(a.aristas);
  for (const s of a.situaciones ?? []) {
    // La situación sin sus eslabones: un cambio en un eslabón es del eslabón.
    const { cadena_dbt, cadena_operante, ...resto } = s;
    m.set(s.id, JSON.stringify(resto));
    poner(cadena_dbt?.eslabones);
    if (cadena_operante) {
      poner([cadena_operante.consecuencia]);
      if (cadena_operante.consecuencias_largo_plazo) poner([cadena_operante.consecuencias_largo_plazo]);
      const { consecuencia, consecuencias_largo_plazo, ...antecedentes } = cadena_operante;
      void consecuencia;
      void consecuencias_largo_plazo;
      m.set(`${s.id}#cadena`, JSON.stringify(antecedentes));
    }
  }
  return m;
}

/** Una revisión por elemento que cambió, se creó o se borró entre dos estados. */
export function revisionesEntre(
  antes: AnalisisFuncional,
  despues: AnalisisFuncional,
  datos: { caso_id: Id; sesion_id: Id; autor: AutorRevision; motivo?: string },
  ahora = new Date().toISOString(),
  nuevoId: GeneradorId = idPorDefecto
): Revision[] {
  const a = elementosPorId(antes);
  const d = elementosPorId(despues);
  const ids = new Set([...a.keys(), ...d.keys()]);
  const revisiones: Revision[] = [];
  for (const objeto_id of ids) {
    const va = a.get(objeto_id) ?? null;
    const vd = d.get(objeto_id) ?? null;
    if (va === vd) continue;
    revisiones.push({
      id: nuevoId(),
      caso_id: datos.caso_id,
      objeto_id,
      sesion_id: datos.sesion_id,
      autor: datos.autor,
      antes: va,
      despues: vd,
      motivo: datos.motivo ?? "",
      fecha: ahora,
    });
  }
  return revisiones;
}

export function registrarRevisiones(exp: Expediente, revisiones: readonly Revision[]): Expediente {
  if (revisiones.length === 0) return exp;
  return { ...exp, revisiones: [...exp.revisiones, ...revisiones] };
}

/** Las de un elemento, de la más reciente a la más antigua. */
export function listarRevisiones(exp: Expediente, objetoId: Id): Revision[] {
  return exp.revisiones
    .filter((r) => r.objeto_id === objetoId || r.objeto_id === `${objetoId}#cadena`)
    .sort((x, y) => y.fecha.localeCompare(x.fecha));
}

// --- guardas -------------------------------------------------------------

/**
 * Lo que un guardado no puede hacer, sea quien sea quien lo pida. Devuelve el
 * motivo o null. El repositorio lo llama antes de escribir.
 */
export function comprobarCambioExpediente(previo: Expediente | null, siguiente: Expediente): string | null {
  if (!previo) return null;
  for (const n of previo.notas) {
    const s = siguiente.notas.find((x) => x.id === n.id);
    if (!s) return "Una nota analizada no se puede borrar.";
    if (s.texto !== n.texto) return "Una nota analizada no se puede editar: añade una anotación.";
    if (s.anotaciones.length < n.anotaciones.length) return "Las anotaciones de una nota no se borran.";
  }
  const nuevas = new Map(siguiente.revisiones.map((r) => [r.id, JSON.stringify(r)]));
  for (const r of previo.revisiones) {
    if (nuevas.get(r.id) !== JSON.stringify(r)) return "Las revisiones solo se añaden.";
  }
  const ultima = ultimaSesion(previo);
  for (const v of previo.versiones) {
    if (v.sesion_id === ultima?.id) continue;
    const s = siguiente.versiones.find((x) => x.id === v.id);
    if (!s || JSON.stringify(s.analisis) !== JSON.stringify(v.analisis)) {
      return "La formulación de una sesión cerrada no se modifica.";
    }
  }
  return null;
}

// --- lista, migración y avisos ------------------------------------------

export function resumirExpediente(exp: Expediente): ResumenCaso {
  const ultima = ultimaSesion(exp);
  const vigente = formulacionVigente(exp)?.analisis ?? null;
  return {
    id: exp.caso.id,
    alias: exp.caso.alias,
    fase: exp.caso.fase,
    actualizado: exp.caso.actualizado,
    ultima_sesion: ultima?.n ?? 0,
    fecha_ultima_sesion: ultima?.fecha ?? null,
    blancos_activos: (vigente?.blancos ?? []).filter((b) => b.fase !== "en_pausa" && b.fase !== "resuelto").length,
    preguntas_abiertas: (vigente?.preguntas ?? []).filter((p) => p.estado === "abierta").length,
    alertas: vigente?.alertas.length ?? 0,
    eliminado_en: exp.caso.eliminado_en ?? null,
  };
}

/** Un análisis suelto del historial anterior pasa a ser un caso con una sesión. */
export function expedienteDesdeAnalisis(
  registro: { referencia: string; nota: string; analisis: AnalisisFuncional; fecha: string },
  nuevoId: GeneradorId = idPorDefecto
): Expediente {
  const base = crearExpediente({ alias: registro.referencia }, registro.fecha, nuevoId);
  const { expediente, sesion } = anadirSesion(base, { nota: registro.nota }, registro.fecha, nuevoId);
  return guardarVersion(expediente, sesion.id, registro.analisis, nuevoId);
}

/**
 * El caso solo lleva alias y motivo. Avisa (no impide) si el alias trae datos
 * de contacto o parece un nombre completo: dos palabras con mayúscula inicial
 * de tres letras o más («Marta Ríos»), y no una inicial («M.34», «M. R.»).
 */
export function avisoAlias(alias: string): string | null {
  if (contieneDatosIdentificables(alias)) return "El alias parece contener datos de contacto o un documento.";
  const palabras = alias.trim().split(/\s+/).filter((p) => /^\p{Lu}\p{Ll}{2,}$/u.test(p));
  if (palabras.length >= 2) return "El alias parece un nombre completo. Usa iniciales o un código.";
  return null;
}

export const ETIQUETA_FASE_CASO: Record<FaseCaso, string> = {
  activo: "Activo",
  en_pausa: "En pausa",
  archivado: "Archivado",
};
