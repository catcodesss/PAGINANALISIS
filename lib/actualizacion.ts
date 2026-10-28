import type {
  AnalisisFuncional,
  Blanco,
  ConductaProblema,
  EstadoHipotesis,
  EstadoPregunta,
  EvidenciaSesion,
  Id,
  PreguntaClinica,
} from "./types";
import { resolverCita, SIN_CITA, type CitaVerificadaResuelta } from "./citas";
import { procedenciaDe, marcarEditado } from "./procedencia";
import { construirNodosGrafo } from "./grafo";
import { claseDeConducta, moverConductaDeClase, nombreDeClase } from "./clases";

/**
 * Actualización por sesión (fase 8): la lógica pura, sin red ni modelo.
 *
 * EL INVARIANTE 1, GENERALIZADO. El modelo no ve ids ni escribe citas. Recibe
 * la formulación con referencias cortas por llamada (`C1`, `H2`, `P3`…) y la
 * nota nueva con frases numeradas, y devuelve operaciones que solo usan esas
 * referencias y números de frase. El servidor traduce, descarta lo que no
 * existe y corta las frases reales. Una referencia inventada no llega nunca al
 * cliente: se cuenta en `descartadas` y nada más.
 *
 * NADA SE APLICA SIN EL CLÍNICO. Esto produce un `ConjuntoCambios` pendiente;
 * `aplicarPropuestas` solo recibe las que el clínico aceptó.
 */

export type TipoRef = "conducta" | "hipotesis" | "rival" | "pregunta" | "situacion" | "blanco" | "relacion" | "clase";

const PREFIJO: Record<TipoRef, string> = {
  conducta: "C",
  hipotesis: "H",
  rival: "X",
  pregunta: "P",
  situacion: "S",
  blanco: "B",
  relacion: "R",
  clase: "K",
};

/** Lo que se puede `modificar` de cada tipo. Lo demás es estructura o es del clínico. */
const CAMPOS_EDITABLES: Partial<Record<TipoRef, readonly string[]>> = {
  conducta: ["descripcion"],
  hipotesis: ["funcion", "enunciado"],
  rival: ["enunciado"],
  pregunta: ["texto"],
  situacion: ["antecedente", "funcion_hipotetizada"],
  blanco: ["mecanismo", "operacionalizacion"],
};

export const OPERACIONES = [
  "añadir_evidencia",
  "proponer_estado",
  "modificar",
  "crear",
  "responder",
  "nueva_pregunta",
  "marcar_contradiccion",
  "mover_clase",
] as const;
export type TipoOperacion = (typeof OPERACIONES)[number];

const ESTADOS_HIPOTESIS: readonly EstadoHipotesis[] = ["en_prueba", "sostenida", "modificada", "debilitada", "descartada"];
const ESTADOS_RESPUESTA: readonly EstadoPregunta[] = ["respondida", "respondida_en_parte"];

export interface Objetivo {
  tipo: TipoRef;
  id: Id;
  ref: string;
}

export interface Propuesta {
  id: string;
  op: TipoOperacion;
  objetivo: Objetivo | null;
  /** Hipótesis o blanco bajo el que se revisa (la revisión no se agrupa por campo). */
  grupo: Id | null;
  postura?: "a_favor" | "en_contra";
  estado?: EstadoHipotesis | EstadoPregunta;
  campo?: string;
  /** El valor nuevo (modificar), la conducta (crear) o la pregunta (nueva_pregunta). */
  valor?: string;
  antes?: string;
  /** crear: la conducta de la misma clase funcional. */
  misma_clase_que?: Id | null;
  /** mover_clase: la clase funcional a la que pasa la conducta (`objetivo`). */
  destino_clase?: Id | null;
  citas: CitaVerificadaResuelta[];
  frases: string[];
  justificacion: string;
  toca_confirmado: boolean;
}

export type MotivoDescarte =
  | "operacion_desconocida"
  | "referencia_inexistente"
  | "sin_frase"
  | "campo_no_editable"
  | "estado_invalido"
  | "incompleta";

export interface ConjuntoCambios {
  sesion: number;
  propuestas: Propuesta[];
  descartadas: Partial<Record<MotivoDescarte, number>>;
  /** Frases de la nota nueva que ninguna propuesta usa («L3.2»). */
  frases_sin_usar: string[];
  /** Alertas que añadiría aceptarlo todo, por código. Solo códigos: sin texto clínico. */
  alertas_nuevas: string[];
  version_prompt: string;
}

// --- referencias cortas ----------------------------------------------------

export interface MapaReferencias {
  porRef: Map<string, Objetivo>;
  porId: Map<Id, string>;
  /** La formulación compacta que ve el modelo. Nunca se registra (invariante 5). */
  texto: string;
}

function recortar(t: string | null | undefined, max = 140): string {
  const s = (t ?? "").replace(/\s+/g, " ").trim();
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

/**
 * Solo lo que el modelo necesita para proponer: etiquetas, funciones, estados y
 * preguntas abiertas. Sin notas anteriores ni citas: el modelo no puede citar
 * lo que no ve, y el tamaño crece con la formulación, no con las sesiones.
 */
export function construirReferencias(a: AnalisisFuncional): MapaReferencias {
  const porRef = new Map<string, Objetivo>();
  const porId = new Map<Id, string>();
  const lineas: string[] = [];
  const contador: Record<string, number> = {};
  const registrar = (tipo: TipoRef, id: Id): string => {
    const p = PREFIJO[tipo];
    contador[p] = (contador[p] ?? 0) + 1;
    const ref = `${p}${contador[p]}`;
    porRef.set(ref, { tipo, id, ref });
    porId.set(id, ref);
    return ref;
  };
  const conf = (id: Id) => (procedenciaDe(a, id).estado === "propuesta" ? "" : " [confirmado]");

  lineas.push("# Conductas problema");
  for (const c of a.conductas_problema) {
    const r = registrar("conducta", c.id);
    lineas.push(`${r}: ${recortar(c.descripcion)}${c.es_conducta_seguridad ? " (seguridad)" : ""}${conf(c.id)}`);
  }
  // Las clases funcionales (fase 10): el modelo puede proponer mover una
  // conducta de una a otra, nombrándolas por referencia.
  if ((a.clases_funcionales ?? []).length > 0) {
    lineas.push("# Clases funcionales");
    for (const clase of a.clases_funcionales) {
      const r = registrar("clase", clase.id);
      const miembros = clase.miembros.map((m) => porId.get(m.conducta_id)).filter(Boolean).join(",");
      lineas.push(`${r}: ${clase.funcion === null ? "función por determinar" : recortar(clase.funcion, 100)} | conductas: ${miembros}`);
    }
  }
  lineas.push("# Situaciones");
  for (const s of a.situaciones) {
    const r = registrar("situacion", s.id);
    const conductas = s.conductas_ids.map((id) => porId.get(id)).filter(Boolean).join(",");
    lineas.push(
      `${r}: ${recortar(s.nombre, 80)} | antecedente: ${recortar(s.cadena_operante?.antecedente, 100)} | conductas: ${conductas} | función: ${recortar(s.funcion_hipotetizada, 100)}${conf(s.id)}`
    );
  }
  lineas.push("# Hipótesis de mantenimiento");
  for (const h of a.hipotesis_mantenimiento) {
    const r = registrar("hipotesis", h.id);
    const destino = h.destino_id ? porId.get(h.destino_id) ?? "" : "";
    lineas.push(`${r}: ${recortar(h.origen, 60)} → ${destino || recortar(h.conducta, 60)} | función: ${recortar(h.funcion, 100)} | estado: ${h.estado}${conf(h.id)}`);
  }
  lineas.push("# Hipótesis rivales");
  for (const x of a.hipotesis_alternativas) {
    const r = registrar("rival", x.id);
    const rival = x.rival_de ? porId.get(x.rival_de) ?? "" : "";
    lineas.push(`${r}: ${recortar(x.enunciado)} | compite con: ${rival} | estado: ${a.seguimiento?.estados_rivales?.[x.id] ?? "en_prueba"}`);
  }
  lineas.push("# Preguntas abiertas");
  for (const p of a.preguntas) {
    if (p.estado !== "abierta" && p.estado !== "respondida_en_parte") continue;
    const r = registrar("pregunta", p.id);
    const prueba = p.pone_a_prueba ? porId.get(p.pone_a_prueba) ?? "" : "";
    lineas.push(`${r}: ${recortar(p.texto)}${prueba ? ` | pone a prueba: ${prueba}` : ""} | estado: ${p.estado}`);
  }
  lineas.push("# Blancos");
  for (const b of a.blancos ?? []) {
    const r = registrar("blanco", b.id);
    const conductas = b.conducta_ids.map((id) => porId.get(id)).filter(Boolean).join(",");
    const h = b.hipotesis_id ? porId.get(b.hipotesis_id) ?? "" : "";
    lineas.push(`${r}: conductas ${conductas} | hipótesis ${h} | mecanismo: ${recortar(b.mecanismo, 100)}${conf(b.id)}`);
  }
  // Las relaciones al final y sin texto propio: son pares de referencias.
  const nodos = new Map(construirNodosGrafo(a).map((n) => [n.id, n]));
  const relaciones: string[] = [];
  for (const arista of a.aristas) {
    const d = nodos.get(arista.desde);
    const h = nodos.get(arista.hasta);
    if (!d || !h) continue;
    const r = registrar("relacion", arista.id);
    relaciones.push(`${r}: ${recortar(d.etiqueta, 50)} → ${recortar(h.etiqueta, 50)}`);
  }
  if (relaciones.length) lineas.push("# Relaciones", ...relaciones);

  return { porRef, porId, texto: lineas.join("\n") };
}

// --- normalizar lo que devuelve el modelo ----------------------------------

const FRASE_RE = /^L(\d+)(?:\.(\d+))?$/i;

function resolverFrase(lineas: string[], valor: unknown): { id: string; cita: CitaVerificadaResuelta } | null {
  // Nunca un texto: un string que no sea «Lx.y» sería una paráfrasis del modelo.
  if (typeof valor !== "string") return null;
  const m = valor.trim().match(FRASE_RE);
  if (!m) return null;
  const linea = Number(m[1]);
  const frase = m[2] ? Number(m[2]) : undefined;
  const cita = resolverCita(lineas, { linea_inicio: linea, linea_fin: linea, frase_inicio: frase, frase_fin: frase });
  return cita.verificada ? { id: frase ? `L${linea}.${frase}` : `L${linea}`, cita } : null;
}

/**
 * La justificación la escribe el modelo y se enseña como suya, nunca como
 * cita: se quita lo que vaya entre comillas (invariante 2) y se acorta.
 */
export function limpiarJustificacion(valor: unknown): string {
  if (typeof valor !== "string") return "";
  return recortar(valor.replace(/[«“"][^»”"]*[»”"]/g, "…"), 200);
}

function texto(v: unknown, max = 300): string {
  return typeof v === "string" ? recortar(v, max) : "";
}

function grupoDe(a: AnalisisFuncional, o: Objetivo | null): Id | null {
  if (!o) return null;
  switch (o.tipo) {
    case "hipotesis":
    case "blanco":
      return o.id;
    case "rival":
      return a.hipotesis_alternativas.find((x) => x.id === o.id)?.rival_de ?? null;
    case "pregunta":
      return a.preguntas.find((p) => p.id === o.id)?.pone_a_prueba ?? null;
    case "conducta":
      return (
        a.hipotesis_mantenimiento.find((h) => h.destino_id === o.id)?.id ??
        (a.blancos ?? []).find((b) => b.conducta_ids.includes(o.id))?.id ??
        null
      );
    default:
      return null;
  }
}

function valorActual(a: AnalisisFuncional, o: Objetivo, campo: string): string | undefined {
  const leer = (x: unknown) => {
    const v = (x as Record<string, unknown> | undefined)?.[campo];
    return typeof v === "string" ? v : undefined;
  };
  switch (o.tipo) {
    case "conducta":
      return leer(a.conductas_problema.find((c) => c.id === o.id));
    case "hipotesis":
      return leer(a.hipotesis_mantenimiento.find((h) => h.id === o.id));
    case "rival":
      return leer(a.hipotesis_alternativas.find((x) => x.id === o.id));
    case "pregunta":
      return leer(a.preguntas.find((p) => p.id === o.id));
    case "blanco":
      return leer((a.blancos ?? []).find((b) => b.id === o.id));
    case "situacion": {
      const s = a.situaciones.find((x) => x.id === o.id);
      if (campo === "antecedente") return s?.cadena_operante?.antecedente;
      return leer(s);
    }
    default:
      return undefined;
  }
}

/**
 * De la respuesta cruda del modelo a propuestas pendientes. Construye cada
 * propuesta campo a campo: cualquier clave ajena (el `razonamiento_previo`,
 * para empezar) se cae aquí sola (invariante 5).
 */
export function normalizarOperaciones(
  crudo: unknown,
  a: AnalisisFuncional,
  mapa: MapaReferencias,
  lineas: string[]
): { propuestas: Propuesta[]; descartadas: Partial<Record<MotivoDescarte, number>> } {
  const descartadas: Partial<Record<MotivoDescarte, number>> = {};
  const descartar = (m: MotivoDescarte) => {
    descartadas[m] = (descartadas[m] ?? 0) + 1;
  };
  const lista = Array.isArray((crudo as { operaciones?: unknown })?.operaciones)
    ? ((crudo as { operaciones: unknown[] }).operaciones)
    : [];
  const propuestas: Propuesta[] = [];

  for (const bruto of lista) {
    const d = (bruto ?? {}) as Record<string, unknown>;
    const opTexto = typeof d.op === "string" ? d.op.replace("anadir", "añadir") : "";
    if (!(OPERACIONES as readonly string[]).includes(opTexto)) {
      descartar("operacion_desconocida");
      continue;
    }
    const op = opTexto as TipoOperacion;

    const frases = (Array.isArray(d.frases) ? d.frases : []).map((f) => resolverFrase(lineas, f)).filter((f) => f !== null);
    if (frases.length === 0 || frases.length !== (d.frases as unknown[]).length) {
      // Una frase inventada invalida la propuesta entera: si una de sus
      // pruebas no existe, la propuesta no se sostiene como se presenta.
      descartar("sin_frase");
      continue;
    }

    let objetivo: Objetivo | null = null;
    if (op !== "nueva_pregunta" && op !== "crear") {
      const ref = typeof d.ref === "string" ? d.ref.trim().toUpperCase() : "";
      objetivo = mapa.porRef.get(ref) ?? null;
      if (!objetivo) {
        descartar("referencia_inexistente");
        continue;
      }
    }

    const base: Propuesta = {
      id: `p${propuestas.length + 1}`,
      op,
      objetivo,
      grupo: grupoDe(a, objetivo),
      citas: frases.map((f) => f.cita),
      frases: frases.map((f) => f.id),
      justificacion: limpiarJustificacion(d.justificacion),
      toca_confirmado: objetivo ? procedenciaDe(a, objetivo.id).estado !== "propuesta" : false,
    };

    if (op === "añadir_evidencia" || op === "marcar_contradiccion") {
      const postura = op === "marcar_contradiccion" || d.postura === "en_contra" ? "en_contra" : d.postura === "a_favor" ? "a_favor" : null;
      if (!postura) {
        descartar("incompleta");
        continue;
      }
      propuestas.push({ ...base, postura });
    } else if (op === "proponer_estado") {
      const estado = d.estado as EstadoHipotesis;
      if ((objetivo!.tipo !== "hipotesis" && objetivo!.tipo !== "rival") || !ESTADOS_HIPOTESIS.includes(estado)) {
        descartar("estado_invalido");
        continue;
      }
      const actual =
        objetivo!.tipo === "hipotesis"
          ? a.hipotesis_mantenimiento.find((h) => h.id === objetivo!.id)?.estado
          : a.seguimiento?.estados_rivales?.[objetivo!.id] ?? "en_prueba";
      if (actual === estado) {
        descartar("estado_invalido");
        continue;
      }
      propuestas.push({ ...base, estado, antes: actual });
    } else if (op === "modificar") {
      const campo = typeof d.campo === "string" ? d.campo : "";
      const valor = texto(d.valor);
      if (!CAMPOS_EDITABLES[objetivo!.tipo]?.includes(campo)) {
        descartar("campo_no_editable");
        continue;
      }
      const antes = valorActual(a, objetivo!, campo);
      if (!valor || antes === undefined || antes === valor) {
        descartar("incompleta");
        continue;
      }
      propuestas.push({ ...base, campo, valor, antes });
    } else if (op === "crear") {
      // Solo conductas: lo demás (hipótesis, blancos) lo crea el clínico o un análisis.
      const contenido = (d.contenido ?? {}) as Record<string, unknown>;
      const valor = texto(contenido.descripcion ?? d.valor);
      const clase = typeof contenido.misma_clase_que === "string" ? mapa.porRef.get(contenido.misma_clase_que.toUpperCase()) : undefined;
      if (d.tipo !== "conducta" || !valor) {
        descartar("incompleta");
        continue;
      }
      if (contenido.misma_clase_que && (!clase || clase.tipo !== "conducta")) {
        descartar("referencia_inexistente");
        continue;
      }
      const misma = clase?.id ?? null;
      propuestas.push({ ...base, valor, misma_clase_que: misma, grupo: misma ? grupoDe(a, clase!) : null });
    } else if (op === "mover_clase") {
      // Una conducta cambia de clase funcional: la clase destino ha de existir
      // y ser otra distinta de la actual.
      const destino = typeof d.a === "string" ? mapa.porRef.get(d.a.trim().toUpperCase()) : undefined;
      if (objetivo!.tipo !== "conducta" || !destino || destino.tipo !== "clase") {
        descartar("referencia_inexistente");
        continue;
      }
      if (claseDeConducta(a, objetivo!.id)?.id === destino.id) {
        descartar("incompleta");
        continue;
      }
      propuestas.push({ ...base, destino_clase: destino.id });
    } else if (op === "responder") {
      const estado = d.estado as EstadoPregunta;
      if (objetivo!.tipo !== "pregunta" || !ESTADOS_RESPUESTA.includes(estado)) {
        descartar("estado_invalido");
        continue;
      }
      propuestas.push({ ...base, estado });
    } else if (op === "nueva_pregunta") {
      const valor = texto(d.texto ?? d.valor);
      const ref = typeof d.ref_hipotesis === "string" ? mapa.porRef.get(d.ref_hipotesis.toUpperCase()) : undefined;
      if (!valor) {
        descartar("incompleta");
        continue;
      }
      if (d.ref_hipotesis && (!ref || ref.tipo !== "hipotesis")) {
        descartar("referencia_inexistente");
        continue;
      }
      propuestas.push({ ...base, valor, grupo: ref?.id ?? null, misma_clase_que: null, objetivo: null });
    }
  }
  return { propuestas, descartadas };
}

/** Frases de la nota que nada usa: el clínico decide si dicen algo. */
export function frasesSinUsar(frasesNota: string[][], propuestas: readonly Propuesta[]): string[] {
  const usadas = new Set(propuestas.flatMap((p) => p.frases));
  const libres: string[] = [];
  frasesNota.forEach((fs, i) =>
    fs.forEach((_, j) => {
      const id = `L${i + 1}.${j + 1}`;
      if (!usadas.has(id) && !usadas.has(`L${i + 1}`)) libres.push(id);
    })
  );
  return libres;
}

// --- aplicar ---------------------------------------------------------------

function nuevoIdCon(a: AnalisisFuncional, lista: readonly { id: string }[], defecto: string): Id {
  const prefijo = lista[0]?.id.match(/^([a-z]+)_\d+$/)?.[1] ?? defecto;
  const id = `${prefijo}_${a.siguiente_id}`;
  a.siguiente_id += 1;
  return id;
}

function anotarEvidencia(a: AnalisisFuncional, id: Id, p: Propuesta, sesion: number, autor: "ia" | "clinico", postura: "a_favor" | "en_contra") {
  const lista: EvidenciaSesion[] = a.seguimiento.evidencia[id] ?? [];
  for (const cita of p.citas) lista.push({ sesion, cita, postura, autor });
  a.seguimiento.evidencia[id] = lista;
}

function propagarHipotesis(a: AnalisisFuncional, hipotesisId: Id, sesion: number) {
  for (const b of a.blancos ?? []) {
    if (b.hipotesis_id === hipotesisId) a.seguimiento.blancos_a_revisar[b.id] = sesion;
  }
}

/** Una propuesta aceptada, con el valor que el clínico dejó si la editó. */
export interface Aceptada {
  propuesta: Propuesta;
  /** Solo si el clínico editó el valor antes de aceptar. */
  valorEditado?: string;
}

/**
 * Aplica SOLO las aceptadas sobre `a` (que debe ser una copia). Lo que no está
 * aquí no cambia, esté confirmado o no. El autor: «ia» si se aceptó tal cual,
 * «clinico» si se editó (invariante 6).
 */
export function aplicarPropuestas(a: AnalisisFuncional, aceptadas: readonly Aceptada[], sesion: number): void {
  for (const { propuesta: p, valorEditado } of aceptadas) {
    const editada = valorEditado !== undefined && valorEditado.trim() !== "" && valorEditado !== p.valor;
    const autor = editada ? "clinico" : "ia";
    const valor = editada ? valorEditado!.trim() : p.valor ?? "";
    const o = p.objetivo;

    switch (p.op) {
      case "añadir_evidencia":
      case "marcar_contradiccion":
        anotarEvidencia(a, o!.id, p, sesion, autor, p.postura ?? "a_favor");
        a.seguimiento.novedades[o!.id] = sesion;
        break;

      case "proponer_estado": {
        const estado = p.estado as EstadoHipotesis;
        const postura = estado === "debilitada" || estado === "descartada" ? "en_contra" : "a_favor";
        if (o!.tipo === "hipotesis") {
          const h = a.hipotesis_mantenimiento.find((x) => x.id === o!.id);
          if (!h) break;
          h.estado = estado;
          h.motivo_estado = `Sesión ${sesion}: ${p.justificacion}`;
          propagarHipotesis(a, h.id, sesion);
        } else {
          a.seguimiento.estados_rivales[o!.id] = estado;
        }
        anotarEvidencia(a, o!.id, p, sesion, autor, postura);
        a.seguimiento.novedades[o!.id] = sesion;
        break;
      }

      case "modificar": {
        const campo = p.campo!;
        const escribir = (obj: Record<string, unknown> | undefined) => {
          if (!obj) return;
          if (editada) marcarEditado(a, o!.id, String(obj[campo] ?? ""));
          obj[campo] = valor;
        };
        if (o!.tipo === "situacion" && campo === "antecedente") {
          const s = a.situaciones.find((x) => x.id === o!.id);
          if (s?.cadena_operante) {
            if (editada) marcarEditado(a, o!.id, s.cadena_operante.antecedente);
            s.cadena_operante.antecedente = valor;
          }
        } else {
          const lista: Record<TipoRef, readonly { id: string }[]> = {
            conducta: a.conductas_problema,
            hipotesis: a.hipotesis_mantenimiento,
            rival: a.hipotesis_alternativas,
            pregunta: a.preguntas,
            situacion: a.situaciones,
            blanco: a.blancos ?? [],
            relacion: a.aristas,
            clase: a.clases_funcionales,
          };
          escribir(lista[o!.tipo].find((x) => x.id === o!.id) as Record<string, unknown> | undefined);
        }
        if (o!.tipo === "hipotesis") propagarHipotesis(a, o!.id, sesion);
        anotarEvidencia(a, o!.id, p, sesion, autor, "a_favor");
        a.seguimiento.novedades[o!.id] = sesion;
        break;
      }

      case "crear": {
        const hermana = a.conductas_problema.find((c) => c.id === p.misma_clase_que);
        const id = nuevoIdCon(a, a.conductas_problema, "cp");
        const conducta: ConductaProblema = {
          id,
          descripcion: valor,
          tipo: hermana?.tipo ?? ("manifiesta" as ConductaProblema["tipo"]),
          importancia: "media",
          es_conducta_seguridad: hermana?.es_conducta_seguridad ?? false,
          deficit_o_interferencia: hermana?.deficit_o_interferencia ?? ("interferencia" as ConductaProblema["deficit_o_interferencia"]),
          justificacion_deficit: "",
          // Su frase es de la nota de la sesión N: va en `seguimiento`, no aquí.
          evidencia: SIN_CITA("sin_referencia"),
        };
        a.conductas_problema.push(conducta);
        if (hermana) {
          for (const s of a.situaciones) if (s.conductas_ids.includes(hermana.id)) s.conductas_ids.push(id);
          // Misma clase funcional, mismo blanco: si no, una conducta sin
          // situación no se vería en ninguna parte.
          for (const b of a.blancos ?? []) if (b.conducta_ids.includes(hermana.id)) b.conducta_ids.push(id);
        }
        // Misma clase que la hermana; sin hermana, a «por determinar».
        {
          const claseDeLaHermana = hermana
            ? a.clases_funcionales.find((c) => c.miembros.some((m) => m.conducta_id === hermana.id))
            : undefined;
          const destino = claseDeLaHermana ?? a.clases_funcionales.find((c) => c.funcion === null);
          const miembro = {
            conducta_id: id,
            conducta_texto: valor,
            justificacion: "",
            evidencia: SIN_CITA("sin_referencia"),
            apoyo: "inferencia" as const,
          };
          if (destino) destino.miembros.push(miembro);
          else a.clases_funcionales.push({ id: nuevoIdCon(a, a.clases_funcionales, "cls"), funcion: null, miembros: [miembro] });
        }
        if (editada) a.procedencia[id] = { estado: "creado" };
        anotarEvidencia(a, id, p, sesion, autor, "a_favor");
        a.seguimiento.novedades[id] = sesion;
        break;
      }

      case "mover_clase":
        // La pertenencia nueva no lleva cita de la nota 1: la frase de la
        // sesión queda como evidencia de la sesión, y el apoyo es «inferencia».
        if (p.destino_clase) moverConductaDeClase(a, o!.id, p.destino_clase);
        anotarEvidencia(a, o!.id, p, sesion, autor, "a_favor");
        a.seguimiento.novedades[o!.id] = sesion;
        break;

      case "responder": {
        const pr = a.preguntas.find((x) => x.id === o!.id);
        if (!pr) break;
        pr.estado = p.estado as EstadoPregunta;
        anotarEvidencia(a, pr.id, p, sesion, autor, "a_favor");
        a.seguimiento.novedades[pr.id] = sesion;
        break;
      }

      case "nueva_pregunta": {
        const id = nuevoIdCon(a, a.preguntas, "preg");
        const pregunta: PreguntaClinica = {
          id,
          texto: valor,
          hipotesis: "",
          pone_a_prueba: p.grupo,
          dato_faltante: "",
          decision: "",
          origen: editada ? "clinico" : "ia",
          estado: "abierta",
        };
        a.preguntas.push(pregunta);
        anotarEvidencia(a, id, p, sesion, autor, "a_favor");
        a.seguimiento.novedades[id] = sesion;
        break;
      }
    }
  }
}

/** Los blancos que el clínico tocó dejan de pedir revisión. */
export function limpiarBlancosRevisados(antes: AnalisisFuncional, despues: AnalisisFuncional): void {
  const pendientes = despues.seguimiento?.blancos_a_revisar ?? {};
  for (const id of Object.keys(pendientes)) {
    const a = (antes.blancos ?? []).find((b: Blanco) => b.id === id);
    const d = (despues.blancos ?? []).find((b: Blanco) => b.id === id);
    if (!d || JSON.stringify(a) !== JSON.stringify(d)) delete pendientes[id];
  }
}

export const SIMBOLO_OPERACION: Record<TipoOperacion, string> = {
  añadir_evidencia: "+",
  marcar_contradiccion: "−",
  proponer_estado: "↑",
  modificar: "~",
  crear: "+",
  responder: "✓",
  nueva_pregunta: "?",
  mover_clase: "⇄",
};

/** «Aceptar en lote» solo vale para evidencia; estado y estructura, uno a uno. */
export function aceptableEnLote(p: Propuesta): boolean {
  return p.op === "añadir_evidencia";
}
