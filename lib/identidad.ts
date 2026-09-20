import { SIN_CITA } from "./citas";
import { raicesSignificativas } from "./validadores";
import {
  VERSION_ANALISIS,
  type AnalisisFuncional,
  type CadenaDBT,
  type Id,
  type Situacion,
} from "./types";
import { materializarAristas } from "./aristas";

/**
 * Identidad de las entidades del análisis: asignarla y resolver las referencias
 * que hasta ahora se adivinaban por prosa.
 *
 * POR QUÉ VIVE AQUÍ Y NO EN lib/parseAnalisis.ts. Ese módulo tiene un trabajo:
 * tolerar lo que devuelva el modelo y dejarlo con la forma del tipo. Esto es
 * otro: dar identidad, fundir lo que estaba duplicado y resolver referencias —y
 * tiene que poder correr también sobre un informe YA normalizado que llevaba
 * meses guardado en el historial, que no es parsear nada.
 *
 * LOS IDS LOS GENERA EL SERVIDOR, NUNCA EL MODELO. Al modelo no se le pide, no
 * se le menciona y no se le deja: un modelo no emite identificadores estables, y
 * un id repetido o inventado conectaría dos entidades que nadie relacionó.
 *
 * LA HEURÍSTICA DE PROSA NO DESAPARECE, SE MUEVE. Sigue siendo lo único capaz de
 * casar «Evitar exponer en reuniones» con «Evita exponer resultados en
 * reuniones, pidiendo ir al baño». Lo que cambia es que corría en tres sitios
 * (lib/redFuncional.ts, lib/priorizacion.ts y `yaEnRepertorio`), en cada render,
 * y cada uno podía concluir algo distinto sobre el mismo par. Ahora corre UNA
 * VEZ, aquí, y su resultado se guarda como id.
 *
 * Y LO QUE NO RESUELVE SE QUEDA SIN RESOLVER. Es la diferencia que importa:
 * antes, una hipótesis que no casaba con ninguna conducta desaparecía del dibujo
 * de la red sin dejar rastro. Ahora queda con `destino_id: null`, que es un
 * hueco que se puede enseñar, contar y corregir a mano.
 */

/** Cuántas raíces en común hacen falta para dar dos textos por emparejados. */
const COINCIDENCIAS_MINIMAS = 2;

/**
 * El id de una entidad, a partir de su posición.
 *
 * La posición es solo la SEMILLA de la primera asignación. Una vez puesto, el id
 * viaja con la entidad: `asignarIds` no toca los que ya existen, así que
 * reordenar o borrar no renumera lo demás.
 */
function idDe(prefijo: string, ...indices: number[]): Id {
  return [prefijo, ...indices.map((i) => i + 1)].join("_");
}

/** ¿Le falta id a esto? Un id vacío es lo que dejan los normalizadores. */
function sinId(entidad: { id?: unknown }): boolean {
  return typeof entidad.id !== "string" || entidad.id.length === 0;
}

function ponerId<T extends { id?: unknown }>(entidad: T, id: Id): void {
  if (sinId(entidad)) (entidad as { id: Id }).id = id;
}

/**
 * La mejor coincidencia por raíces de palabra, o null.
 *
 * Empate: gana el primero del arreglo. Es lo que mantiene estable el resultado
 * entre ejecuciones — con un desempate arbitrario, dos migraciones del mismo
 * informe podrían resolver la misma referencia a entidades distintas.
 */
function mejorCoincidencia(
  texto: string,
  candidatos: { id: Id; texto: string }[]
): Id | null {
  const raices = raicesSignificativas(texto);
  if (raices.size === 0) return null;

  let mejor: { id: Id; puntos: number } | null = null;
  for (const c of candidatos) {
    const puntos = [...raicesSignificativas(c.texto)].filter((r) =>
      raices.has(r)
    ).length;
    if (puntos >= COINCIDENCIAS_MINIMAS && (!mejor || puntos > mejor.puntos)) {
      mejor = { id: c.id, puntos };
    }
  }
  return mejor?.id ?? null;
}

/** Todas las coincidencias que superan el umbral, no solo la mejor. */
function todasLasCoincidencias(
  texto: string,
  candidatos: { id: Id; texto: string }[]
): Id[] {
  const raices = raicesSignificativas(texto);
  if (raices.size === 0) return [];
  return candidatos
    .filter(
      (c) =>
        [...raicesSignificativas(c.texto)].filter((r) => raices.has(r)).length >=
        COINCIDENCIAS_MINIMAS
    )
    .map((c) => c.id);
}

/**
 * Todo lo que una situación dice y de lo que se puede deducir qué conducta
 * analiza. Se mira la cadena entera porque el nombre de la situación suele ser
 * una etiqueta funcional («Demandas sociales evaluativas») que no repite la
 * topografía de la conducta.
 */
function textoDeSituacion(s: Situacion): string {
  return [
    s.nombre,
    s.funcion_hipotetizada,
    s.cadena_operante?.respuesta,
    s.cadena_dbt?.conducta_problema,
  ]
    .filter(Boolean)
    .join(" ");
}

function comoArreglo(valor: unknown): Record<string, unknown>[] {
  return Array.isArray(valor) ? (valor as Record<string, unknown>[]) : [];
}

/**
 * Funde `capa_dbt.analisis_en_cadena` en la situación que le corresponde.
 *
 * Era una copia literal de la `cadena_dbt` de una situación —comprobado campo
 * por campo contra evals/fixtures/01-v0.1.2.json—, así que en el caso normal no
 * se escribe nada: la cadena de la situación manda y solo se registra la
 * correspondencia para poder resolver después los eslabones.
 *
 * Los otros dos casos son los que evitan perder contenido:
 *
 * - La situación existe pero no tiene `cadena_dbt` (informe parcial: se pidió el
 *   bloque DBT sin las situaciones completas). Se escribe ahí.
 * - No casa con ninguna situación. Se crea una situación SUELTA, sin conductas
 *   implicadas. Eso dispara la alerta de cobertura, que es el comportamiento
 *   correcto: una cadena de la que no se sabe qué conducta analiza es un hueco,
 *   y el informe ya sabe enseñar huecos.
 */
function fundirAnalisisEnCadena(
  situaciones: Situacion[],
  heredado: unknown
): void {
  if (typeof heredado !== "object" || heredado === null) return;
  const c = heredado as Record<string, unknown>;

  const objetivo = typeof c.conducta_objetivo === "string" ? c.conducta_objetivo : "";
  const eslabones = comoArreglo(c.eslabones).map((e) => ({
    id: "",
    tipo: (typeof e.tipo === "string" ? e.tipo : "pensamiento") as CadenaDBT["eslabones"][number]["tipo"],
    descripcion: typeof e.descripcion === "string" ? e.descripcion : "",
  }));
  if (eslabones.length === 0 && objetivo.length === 0) return;

  const candidatas = situaciones.map((s, i) => ({
    id: String(i),
    texto: `${s.cadena_dbt?.conducta_problema ?? ""} ${textoDeSituacion(s)}`,
  }));
  const indice = objetivo ? mejorCoincidencia(objetivo, candidatas) : null;
  const situacion = indice === null ? null : situaciones[Number(indice)];

  // El caso normal: ya está analizado en su situación. No se escribe nada.
  if (situacion?.cadena_dbt) return;

  const textos = (clave: string) =>
    Array.isArray(c[clave])
      ? (c[clave] as unknown[]).filter((x): x is string => typeof x === "string")
      : [];

  const cadena: CadenaDBT = {
    factores_vulnerabilidad: textos("vulnerabilidades"),
    evento_precipitante:
      typeof c.evento_precipitante === "string" ? c.evento_precipitante : "",
    eslabones,
    conducta_problema: objetivo,
    // Las dos listas se juntan en una descripción, que es la forma que tiene
    // CadenaDBT. Separarlas otra vez sería inventar una estructura que el
    // informe guardado no distingue al mostrarlas.
    consecuencias: [...textos("consecuencias_corto_plazo"), ...textos("consecuencias_largo_plazo")]
      .filter(Boolean)
      .join(" "),
    evidencia: SIN_CITA("sin_referencia"),
  };

  if (situacion) {
    situacion.cadena_dbt = cadena;
    return;
  }

  situaciones.push({
    id: "",
    nombre: objetivo || "Cadena sin situación",
    conductas_ids: [],
    cadena_operante: null,
    cadena_respondiente: null,
    cadena_dbt: cadena,
    ciclo_interconductual: null,
    funcion_hipotetizada: "",
    confianza: "baja",
  });
}

/** Asigna id a toda entidad que no lo tenga, y devuelve el próximo libre. */
function asignarIds(a: AnalisisFuncional): number {
  a.conductas_problema.forEach((c, i) => ponerId(c, idDe("cnd", i)));
  a.repertorio_disponible.forEach((r, i) => ponerId(r, idDe("rep", i)));
  a.variables_moduladoras.forEach((v, i) => ponerId(v, idDe("vmd", i)));
  a.acomodacion_entorno.forEach((x, i) => ponerId(x, idDe("acm", i)));
  a.hipotesis_mantenimiento.forEach((h, i) => ponerId(h, idDe("hip", i)));
  a.conductas_alternativas.forEach((x, i) => ponerId(x, idDe("alt", i)));
  a.capa_act.reglas_verbales.forEach((r, i) => ponerId(r, idDe("rvb", i)));
  a.capa_act.procesos_act.forEach((p, i) => ponerId(p, idDe("pac", i)));
  a.capa_dbt.analisis_de_soluciones.forEach((s, i) => ponerId(s, idDe("sol", i)));

  a.situaciones.forEach((s, i) => {
    ponerId(s, idDe("sit", i));
    // Los eslabones llevan el índice de su situación: `esl_1_3` se lee «tercer
    // eslabón de la primera situación», y así un eslabón no puede confundirse
    // con el de otra cadena aunque describan lo mismo.
    s.cadena_dbt?.eslabones.forEach((e, j) => ponerId(e, idDe("esl", i, j)));
    if (s.cadena_operante) {
      ponerId(s.cadena_operante.consecuencia, `cns_${i + 1}_inm`);
      if (s.cadena_operante.consecuencias_largo_plazo) {
        ponerId(s.cadena_operante.consecuencias_largo_plazo, `cns_${i + 1}_dem`);
      }
    }
  });

  // El próximo libre sale del mayor número visto, no del recuento: si se borra
  // la conducta 2 de tres, el recuento diría 3 y reutilizaría un id vivo.
  let mayor = 0;
  for (const id of todosLosIds(a)) {
    for (const trozo of id.split("_")) {
      const n = Number(trozo);
      if (Number.isInteger(n) && n > mayor) mayor = n;
    }
  }
  return mayor + 1;
}

/** Todos los ids asignados, para calcular el próximo libre y para las pruebas. */
export function todosLosIds(a: AnalisisFuncional): Id[] {
  const ids: Id[] = [
    ...a.conductas_problema.map((c) => c.id),
    ...a.repertorio_disponible.map((r) => r.id),
    ...a.variables_moduladoras.map((v) => v.id),
    ...a.acomodacion_entorno.map((x) => x.id),
    ...a.hipotesis_mantenimiento.map((h) => h.id),
    ...a.conductas_alternativas.map((x) => x.id),
    ...a.capa_act.reglas_verbales.map((r) => r.id),
    ...a.capa_act.procesos_act.map((p) => p.id),
    ...a.capa_dbt.analisis_de_soluciones.map((s) => s.id),
    ...a.situaciones.map((s) => s.id),
  ];
  for (const s of a.situaciones) {
    for (const e of s.cadena_dbt?.eslabones ?? []) ids.push(e.id);
    if (s.cadena_operante) {
      ids.push(s.cadena_operante.consecuencia.id);
      const dem = s.cadena_operante.consecuencias_largo_plazo;
      if (dem) ids.push(dem.id);
    }
  }
  return ids.filter((id) => id.length > 0);
}

/**
 * Resuelve las referencias por prosa a referencias por id.
 *
 * Solo escribe donde aún no hay id: una referencia que el clínico corrigió a
 * mano no se vuelve a adivinar. Y no borra ningún texto — el original sigue ahí
 * para mostrarlo cuando el id no resuelva, que es justo cuando hace falta.
 */
function resolverReferencias(a: AnalisisFuncional): void {
  const conductas = a.conductas_problema.map((c) => ({
    id: c.id,
    texto: c.descripcion,
  }));
  const variables = a.variables_moduladoras.map((v) => ({
    id: v.id,
    texto: v.descripcion,
  }));
  const situaciones = a.situaciones.map((s) => ({
    id: s.id,
    texto: textoDeSituacion(s),
  }));
  const eslabones = a.situaciones.flatMap((s) =>
    (s.cadena_dbt?.eslabones ?? []).map((e) => ({
      id: e.id,
      texto: `${e.tipo} ${e.descripcion}`,
    }))
  );

  for (const s of a.situaciones) {
    if (s.conductas_ids.length > 0) continue;
    s.conductas_ids = todasLasCoincidencias(textoDeSituacion(s), conductas);
  }

  for (const h of a.hipotesis_mantenimiento) {
    // `origen` se añadió cuando la prosa pasó a derivarse del grafo. Los
    // informes anteriores conservan su enunciado y se resuelven igual.
    if (typeof h.origen !== "string") h.origen = "";
    if (h.destino_id === null) {
      h.destino_id = mejorCoincidencia(h.conducta, conductas);
    }
    if (h.origen_id === null) {
      // El origen se busca primero entre las variables moduladoras y después
      // entre las otras conductas: una hipótesis que relaciona dos conductas es
      // legítima (un bucle), pero es la lectura menos habitual, y probarla antes
      // emparejaría con la propia conducta de destino descrita otra vez.
      const contexto = `${h.origen || h.enunciado} ${h.funcion}`;
      h.origen_id =
        mejorCoincidencia(contexto, variables) ??
        mejorCoincidencia(
          contexto,
          conductas.filter((c) => c.id !== h.destino_id)
        );
      if (h.origen_id === h.destino_id) h.origen_id = null;
    }
  }

  for (const p of a.formulacion.priorizacion) {
    if (p.conducta_id === null) {
      p.conducta_id = mejorCoincidencia(p.blanco, conductas);
    }
  }

  for (const c of a.conductas_alternativas) {
    if (c.situacion_id === null) {
      c.situacion_id = mejorCoincidencia(c.situacion, situaciones);
    }
  }

  for (const h of a.capa_dbt.habilidades_sugeridas) {
    if (h.eslabon_id === null) {
      h.eslabon_id = mejorCoincidencia(h.eslabon_objetivo, eslabones);
    }
  }

  for (const s of a.capa_dbt.analisis_de_soluciones) {
    if (s.eslabon_id === null) {
      s.eslabon_id = mejorCoincidencia(s.eslabon_objetivo, eslabones);
    }
  }

  for (const p of a.capa_act.procesos_act) {
    if (p.eslabon_id === null) {
      p.eslabon_id = mejorCoincidencia(p.vinculo_con_cadena, eslabones);
    }
    if (p.situacion_id === null) {
      // Si el eslabón resolvió, la situación sale de él y no se vuelve a
      // adivinar: un eslabón pertenece a una sola situación, y deducirla del id
      // es exacto donde la prosa sería otra conjetura.
      p.situacion_id =
        a.situaciones.find((s) =>
          (s.cadena_dbt?.eslabones ?? []).some((e) => e.id === p.eslabon_id)
        )?.id ?? mejorCoincidencia(p.vinculo_con_cadena, situaciones);
    }
  }
}

/**
 * La situación cuya cadena DBT hace de «análisis en cadena» del caso.
 *
 * Sustituye al antiguo `capa_dbt.analisis_en_cadena`, que era una copia. El
 * análisis en cadena de DBT se hace sobre UNA conducta —la prioritaria—, así
 * que se busca la situación que declara la conducta de mayor importancia; si no
 * hay forma de decidir, la primera situación con cadena. Devuelve null cuando no
 * hay ninguna, que es un hallazgo y no un fallo: no hay cadena que enseñar.
 *
 * Ahora es exacto porque `conductas_ids` existe. Antes habría que haber
 * comparado la prosa de `conducta_objetivo` con la de cada situación, que es la
 * clase de adivinanza que la v2 retira.
 */
export function situacionDeLaCadenaDBT(
  a: Pick<AnalisisFuncional, "situaciones" | "conductas_problema">
): Situacion | null {
  const conCadena = a.situaciones.filter((s) => s.cadena_dbt);
  if (conCadena.length === 0) return null;

  const porImportancia: Record<string, number> = { alta: 0, media: 1, baja: 2 };
  const prioritaria = [...a.conductas_problema].sort(
    (x, y) => porImportancia[x.importancia] - porImportancia[y.importancia]
  )[0];

  if (prioritaria) {
    const suya = conCadena.find((s) => s.conductas_ids.includes(prioritaria.id));
    if (suya) return suya;
  }
  return conCadena[0];
}

/**
 * Lleva un análisis de cualquier versión anterior a la v2.
 *
 * Es idempotente y no destructivo: sobre un análisis que ya es v2 no cambia
 * nada, y sobre uno antiguo solo AÑADE —ids, referencias resueltas, la cadena
 * DBT fundida en su situación—. Ningún texto se borra.
 *
 * Se aplica en tres sitios: al normalizar la respuesta del modelo
 * (lib/parseAnalisis.ts), al leer del historial (lib/repositorio.ts) y al
 * cargar el informe de ejemplo (lib/maquetaInforme.ts). Un informe guardado
 * antes de la v2 se abre igual que siempre; lo fija evals/migracion.test.mjs.
 */
export function migrarAV2(analisis: AnalisisFuncional): AnalisisFuncional {
  const teniaAristas = Array.isArray(
    (analisis as unknown as Record<string, unknown>).aristas
  );
  // La cadena heredada se lee de la propia capa: un análisis guardado en v1 la
  // trae aunque el tipo ya no la declare.
  const capaDbt = analisis.capa_dbt as unknown as Record<string, unknown>;
  if (capaDbt && "analisis_en_cadena" in capaDbt) {
    fundirAnalisisEnCadena(analisis.situaciones, capaDbt.analisis_en_cadena);
    delete capaDbt.analisis_en_cadena;
  }

  analisis.siguiente_id = asignarIds(analisis);
  resolverReferencias(analisis);
  // Una lista existente, aunque esté vacía, ya es la decisión persistida del
  // clínico y no se regenera. Solo los informes anteriores al grafo carecen de
  // la propiedad por completo.
  if (!teniaAristas) analisis.aristas = materializarAristas(analisis);
  analisis.version = VERSION_ANALISIS;
  return analisis;
}
