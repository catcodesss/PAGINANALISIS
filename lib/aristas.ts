import type { AnalisisFuncional, Arista, Id, Situacion, TipoArista } from "./types";

/** Ids estables para los campos 1:1 que no son listas con id propio. */
export function idNodoSituacion(
  situacion: Pick<Situacion, "id">,
  campo: "om" | "ed" | "ec" | "funcion"
): Id {
  return `${situacion.id}_${campo}`;
}

export function idConsecuenciaAlternativa(idAlternativa: Id): Id {
  return `${idAlternativa}_consecuencia`;
}

function clave(desde: string, hasta: string, tipo: TipoArista) {
  return `${desde}\u0000${hasta}\u0000${tipo}`;
}

/**
 * Convierte la cadena implícita en relaciones persistidas una sola vez.
 *
 * A partir de este punto el grafo pertenece al clínico: una lista vacía es una
 * decisión válida y no se vuelve a completar en cada render. Por eso esta
 * función solo se usa al normalizar un análisis que todavía no trae `aristas`.
 */
export function materializarAristas(analisis: AnalisisFuncional): Arista[] {
  const pendientes: Omit<Arista, "id">[] = [];
  const vistas = new Set<string>();

  const agregar = (desde: string | null | undefined, hasta: string | null | undefined, tipo: TipoArista = "secuencial") => {
    if (!desde || !hasta || desde === hasta) return;
    const firma = clave(desde, hasta, tipo);
    if (vistas.has(firma)) return;
    vistas.add(firma);
    pendientes.push({ desde, hasta, tipo });
  };

  for (const situacion of analisis.situaciones) {
    const operante = situacion.cadena_operante;
    const respondiente = situacion.cadena_respondiente;
    const dbt = situacion.cadena_dbt;
    const om = operante?.operacion_motivacional
      ? idNodoSituacion(situacion, "om")
      : null;
    const ed = operante?.antecedente ? idNodoSituacion(situacion, "ed") : null;
    const ec = respondiente?.estimulo ? idNodoSituacion(situacion, "ec") : null;
    const eslabones = dbt?.eslabones.map((e) => e.id) ?? [];
    const conductas = situacion.conductas_ids.filter((id) =>
      analisis.conductas_problema.some((conducta) => conducta.id === id)
    );

    const previos = [om, ed, ec, ...eslabones].filter((id): id is string => Boolean(id));
    for (let i = 0; i < previos.length - 1; i += 1) {
      agregar(previos[i], previos[i + 1]);
    }
    const ultimoPrevio = previos.at(-1);
    for (const conducta of conductas) {
      agregar(ultimoPrevio, conducta);
      if (operante?.consecuencia.texto) agregar(conducta, operante.consecuencia.id);
      if (operante?.consecuencias_largo_plazo?.texto) {
        agregar(conducta, operante.consecuencias_largo_plazo.id);
      }
    }
    if (operante?.consecuencia.texto && situacion.funcion_hipotetizada) {
      agregar(
        operante.consecuencia.id,
        idNodoSituacion(situacion, "funcion")
      );
    }

    for (const alternativa of analisis.conductas_alternativas.filter(
      (c) => c.situacion_id === situacion.id
    )) {
      if (alternativa.consecuencia_necesaria) {
        agregar(alternativa.id, idConsecuenciaAlternativa(alternativa.id));
      }
    }
  }

  // Estas son las únicas conexiones de variables moduladoras que el análisis
  // declara de forma exacta. Conectar todas las variables a todas las OM
  // inventaría relaciones que el esquema actual no representa.
  for (const hipotesis of analisis.hipotesis_mantenimiento) {
    agregar(
      hipotesis.origen_id,
      hipotesis.destino_id,
      hipotesis.direccion === "bidireccional"
        ? "bucle"
        : hipotesis.tipo_relacion === "moderadora"
          ? "moderadora"
          : "secuencial"
    );
  }

  return pendientes.map((arista, indice) => ({
    id: `ari_${indice + 1}`,
    ...arista,
  }));
}

export function hayCamino(
  aristas: readonly Pick<Arista, "desde" | "hasta">[],
  desde: string,
  hasta: string
): boolean {
  const pendientes = [desde];
  const vistos = new Set<string>();
  while (pendientes.length > 0) {
    const actual = pendientes.shift()!;
    if (actual === hasta) return true;
    if (vistos.has(actual)) continue;
    vistos.add(actual);
    for (const arista of aristas) {
      if (arista.desde === actual && !vistos.has(arista.hasta)) {
        pendientes.push(arista.hasta);
      }
    }
  }
  return false;
}
