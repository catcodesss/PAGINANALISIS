import type { Expediente, Nota, Revision, Sesion, VersionFormulacion } from "../casos";
import type { AnalisisFuncional, Id } from "../types";

/**
 * Fusión de dos copias de un mismo caso editadas en dispositivos distintos
 * (fase 13, etapa 4; propuesta §7.2). Lógica pura, sin cifrado ni red.
 *
 * Tres copias: `base` (lo último que este dispositivo vio antes de editar),
 * `nuestro` (lo que quiere guardar) y `remoto` (lo que hay ahora en la nube).
 *
 *  - Sesiones, notas, versiones y revisiones: unión por id. Nada se pierde.
 *  - Dos sesiones con el mismo número `n` y distinto id: se renumera la más
 *    reciente (por fecha) y se avisa.
 *  - Un mismo dato editado en los dos lados: gana el más reciente, y el
 *    perdedor se guarda como una revisión recuperable. Nunca se descarta en silencio.
 *
 * Límite conocido: la formulación de una versión se fusiona por campo de primer
 * nivel (conductas, relaciones, preguntas…), no por elemento. Si los dos
 * dispositivos tocaron el mismo campo, gana el más reciente entero y el otro se
 * conserva como revisión.
 */

export type TipoAviso = "sesion_renumerada" | "dato_en_conflicto";

export interface AvisoFusion {
  tipo: TipoAviso;
  mensaje: string;
}

export interface ResultadoFusion {
  expediente: Expediente;
  avisos: AvisoFusion[];
}

const igual = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/**
 * Tres vías sobre un valor. `masNuestro`: en un empate real, ¿gana nuestra copia?
 * Devuelve el perdedor cuando hubo conflicto, para guardarlo.
 */
function tresVias<T>(
  base: T | undefined,
  nuestro: T,
  remoto: T,
  masNuestro: boolean
): { valor: T; perdedor?: T } {
  if (igual(nuestro, remoto)) return { valor: nuestro };
  if (igual(nuestro, base)) return { valor: remoto };
  if (igual(remoto, base)) return { valor: nuestro };
  return masNuestro ? { valor: nuestro, perdedor: remoto } : { valor: remoto, perdedor: nuestro };
}

function unirPorId<T extends { id: Id }>(a: readonly T[], b: readonly T[]): Map<Id, [T | undefined, T | undefined]> {
  const mapa = new Map<Id, [T | undefined, T | undefined]>();
  for (const x of a) mapa.set(x.id, [x, undefined]);
  for (const y of b) mapa.set(y.id, [mapa.get(y.id)?.[0], y]);
  return mapa;
}

export function fusionarExpedientes(
  base: Expediente | null,
  nuestro: Expediente,
  remoto: Expediente,
  idNuevo: () => Id = () => crypto.randomUUID()
): ResultadoFusion {
  const avisos: AvisoFusion[] = [];
  const perdidos: Revision[] = [];
  // El que se tocó más tarde gana un empate real.
  const masNuestro = nuestro.caso.actualizado >= remoto.caso.actualizado;
  const ahora = nuestro.caso.actualizado > remoto.caso.actualizado ? nuestro.caso.actualizado : remoto.caso.actualizado;

  const guardarPerdedor = (objetoId: Id, sesionId: Id, que: string, perdedor: unknown) => {
    perdidos.push({
      id: idNuevo(),
      caso_id: nuestro.caso.id,
      objeto_id: objetoId,
      sesion_id: sesionId,
      autor: "clinico",
      antes: JSON.stringify(perdedor),
      despues: null,
      motivo: `Conflicto entre dispositivos: se conservó la edición más reciente de ${que}; esta es la otra.`,
      fecha: ahora,
    });
    avisos.push({
      tipo: "dato_en_conflicto",
      mensaje: `Se editó ${que} en dos dispositivos a la vez. Se conservó la más reciente y la otra queda en las revisiones.`,
    });
  };
  const ultimaId = (xs: readonly Sesion[]) => [...xs].sort((a, b) => a.n - b.n).at(-1)?.id ?? "";

  // --- caso -----------------------------------------------------------------
  const caso = { ...nuestro.caso };
  for (const campo of ["alias", "motivo", "fase"] as const) {
    const r = tresVias(base?.caso[campo], nuestro.caso[campo], remoto.caso[campo], masNuestro);
    (caso[campo] as string) = r.valor;
    if (r.perdedor !== undefined) {
      guardarPerdedor(caso.id, ultimaId(nuestro.sesiones), `el campo «${campo}» del caso`, { [campo]: r.perdedor });
    }
  }
  caso.actualizado = ahora;
  caso.creado = nuestro.caso.creado < remoto.caso.creado ? nuestro.caso.creado : remoto.caso.creado;

  // --- sesiones -------------------------------------------------------------
  const baseSesiones = new Map((base?.sesiones ?? []).map((s) => [s.id, s]));
  const sesiones: Sesion[] = [];
  for (const [a, b] of unirPorId(nuestro.sesiones, remoto.sesiones).values()) {
    if (!a || !b) {
      sesiones.push(structuredClone((a ?? b)!));
      continue;
    }
    const previa = baseSesiones.get(a.id);
    const registro = tresVias(previa?.registro, a.registro, b.registro, masNuestro);
    if (registro.perdedor !== undefined) {
      guardarPerdedor(a.id, a.id, `el registro de la sesión ${a.n}`, { registro: registro.perdedor });
    }
    const version = tresVias(previa?.version_id, a.version_id, b.version_id, masNuestro);
    sesiones.push({
      ...a,
      registro: registro.valor,
      version_id: version.valor,
      nota_ids: [...new Set([...a.nota_ids, ...b.nota_ids])],
    });
  }
  // Dos sesiones con el mismo `n`: se renumera la creada después.
  sesiones.sort((x, y) => x.n - y.n || x.fecha.localeCompare(y.fecha) || x.id.localeCompare(y.id));
  let siguiente = 0;
  const vistos = new Set<number>();
  for (const s of sesiones) {
    if (vistos.has(s.n)) {
      const antes = s.n;
      s.n = Math.max(siguiente, ...sesiones.map((x) => x.n)) + 1;
      siguiente = s.n;
      avisos.push({
        tipo: "sesion_renumerada",
        mensaje: `Se crearon dos sesiones ${antes} a la vez en dispositivos distintos. Se conservaron las dos; una pasó a ser la sesión ${s.n}.`,
      });
    }
    vistos.add(s.n);
  }
  sesiones.sort((x, y) => x.n - y.n);

  // --- notas ----------------------------------------------------------------
  const notas: Nota[] = [];
  for (const [a, b] of unirPorId(nuestro.notas, remoto.notas).values()) {
    if (!a || !b) {
      notas.push(structuredClone((a ?? b)!));
      continue;
    }
    // El texto de una nota cerrada no cambia; las anotaciones se unen.
    const anotaciones = [...a.anotaciones];
    for (const x of b.anotaciones) if (!anotaciones.some((y) => igual(x, y))) anotaciones.push(x);
    anotaciones.sort((x, y) => x.fecha.localeCompare(y.fecha));
    notas.push({ ...a, anotaciones });
  }

  // --- versiones ------------------------------------------------------------
  const baseVersiones = new Map((base?.versiones ?? []).map((v) => [v.id, v]));
  const versiones: VersionFormulacion[] = [];
  for (const [a, b] of unirPorId(nuestro.versiones, remoto.versiones).values()) {
    if (!a || !b) {
      versiones.push(structuredClone((a ?? b)!));
      continue;
    }
    const previa = baseVersiones.get(a.id)?.analisis as unknown as Record<string, unknown> | undefined;
    const A = a.analisis as unknown as Record<string, unknown>;
    const B = b.analisis as unknown as Record<string, unknown>;
    const resultado: Record<string, unknown> = {};
    for (const campo of new Set([...Object.keys(A), ...Object.keys(B)])) {
      const r = tresVias(previa?.[campo], A[campo], B[campo], masNuestro);
      if (r.valor !== undefined) resultado[campo] = structuredClone(r.valor);
      if (r.perdedor !== undefined) {
        guardarPerdedor(a.id, a.sesion_id, `«${campo}» de la formulación`, { [campo]: r.perdedor });
      }
    }
    versiones.push({ ...a, analisis: resultado as unknown as AnalisisFuncional });
  }

  // --- revisiones: solo se añaden ----------------------------------------------
  const revisiones = [...unirPorId(nuestro.revisiones, remoto.revisiones).values()].map(([a, b]) =>
    structuredClone((a ?? b)!)
  );
  revisiones.push(...perdidos);

  return { expediente: { caso, sesiones, notas, versiones, revisiones }, avisos };
}
