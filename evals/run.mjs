#!/usr/bin/env node
/**
 * Runner de evals para ANCIA
 * ------------------------------------------------------------
 * Envía cada nota de prueba a /api/analizar, recoge el JSON del informe
 * y comprueba: (a) las trampas definidas en cada caso y (b) que todas las
 * citas del campo `evidencia` sean texto literal de la nota original.
 *
 * Uso:
 *   node run.mjs --endpoint=http://localhost:3000/api/analizar
 *   node run.mjs --caso=01 --reps=3
 *   node run.mjs --caso=01 --fixture=fixtures/01-v0.1.2.json   (sin gastar API)
 */

import { readFileSync, readdirSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = dirname(fileURLToPath(import.meta.url));
const DIR_CASOS = join(AQUI, 'casos');
const DIR_RESULTADOS = join(AQUI, 'resultados');

const arg = (n, def) => {
  const p = process.argv.find((a) => a.startsWith(`--${n}=`));
  return p ? p.split('=').slice(1).join('=') : def;
};

const ENDPOINT = arg('endpoint', process.env.ANCIA_ENDPOINT || 'http://localhost:3000/api/analizar');
const CAMPO = arg('campo', process.env.ANCIA_CAMPO || 'nota'); // clave del body que espera tu API
const REPS = Number(arg('reps', 1));
const SOLO = arg('caso', null);
const FIXTURE = arg('fixture', null);
const PAUSA_MS = Number(arg('pausa', 1500));

// ── utilidades de texto ─────────────────────────────────────
const sinAcentos = (s) => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const norm = (s) => sinAcentos(s).toLowerCase().replace(/\s+/g, ' ').trim();

// ── parser de casos ─────────────────────────────────────────
function parseCaso(texto, archivo) {
  const titulo = (texto.match(/^#\s+(.+)$/m) || [])[1] || archivo;
  const trasNota = texto.split(/^##\s+NOTA\s*$/m)[1] || '';
  const nota = trasNota.split(/^##\s+COMPROBACIONES\s*$/m)[0].trim();
  const bloque = texto.split(/^##\s+COMPROBACIONES\s*$/m)[1] || '';
  const json = (bloque.match(/```json\s*([\s\S]*?)```/) || [])[1] || '[]';
  return { id: archivo.replace(/\.md$/, ''), titulo, nota, comprobaciones: JSON.parse(json) };
}

function cargarCasos() {
  return readdirSync(DIR_CASOS)
    .filter((f) => f.endsWith('.md'))
    .filter((f) => !SOLO || f.startsWith(SOLO))
    .map((f) => parseCaso(readFileSync(join(DIR_CASOS, f), 'utf8'), f));
}

// ── aplanado del informe ────────────────────────────────────
function aplanar(valor, ruta = '', salida = []) {
  if (valor === null || valor === undefined) return salida;
  if (typeof valor === 'string' || typeof valor === 'number' || typeof valor === 'boolean') {
    salida.push({ ruta, valor: String(valor) });
    return salida;
  }
  if (Array.isArray(valor)) {
    valor.forEach((v, i) => aplanar(v, `${ruta}[${i}]${discriminador(v)}`, salida));
    return salida;
  }
  for (const [k, v] of Object.entries(valor)) aplanar(v, ruta ? `${ruta}.${k}` : k, salida);
  return salida;
}

/**
 * Muchos arrays del informe se distinguen por un campo interno, no por su ruta:
 * variables_moduladoras[] usa `tipo: "biologica"`, habilidades_sugeridas[] usa
 * `modulo`, reglas_verbales[] usa `clase`. Sin esto, un `ambito` como "biologic"
 * no encontraría nada, porque la ruta solo dice variables_moduladoras[0].
 * Lo añadimos a la ruta como {biologica} para poder acotar por él.
 */
function discriminador(item) {
  if (!item || typeof item !== 'object' || Array.isArray(item)) return '';
  for (const campo of ['tipo', 'clase', 'modulo', 'proceso', 'nombre', 'situacion']) {
    const v = item[campo];
    if (typeof v === 'string' && v.length > 0 && v.length < 60) return `{${v}}`;
  }
  return '';
}

// ── comprobación de una trampa ──────────────────────────────
function comprobar(check, entradas) {
  const reAmbito = check.ambito ? new RegExp(check.ambito, 'i') : null;
  const candidatas = reAmbito ? entradas.filter((e) => reAmbito.test(sinAcentos(e.ruta))) : entradas;
  const rePatron = new RegExp(check.patron, 'i');
  // incluirRuta: el patrón se compara contra ruta+valor en vez de solo valor.
  // Sirve para comprobar una combinación (p. ej. "esta entrada está etiquetada
  // como biológica Y menciona el sueño") sin depender de que `ambito` acote a
  // una categoría que puede no existir — así "no aparece" se verifica sobre un
  // ámbito que casi siempre está poblado, en vez de pasar porque no hay nada
  // que mirar.
  const aciertos = candidatas.filter((e) =>
    rePatron.test(check.incluirRuta ? `${norm(e.ruta)} ${norm(e.valor)}` : norm(e.valor))
  );
  const encontrado = aciertos.length > 0;
  const pasa = check.tipo === 'debe_aparecer' ? encontrado : !encontrado;
  return {
    id: check.id,
    descripcion: check.descripcion,
    tipo: check.tipo,
    pasa,
    // aviso: si el ámbito no existe en la respuesta, un "no_debe_aparecer"
    // pasa sin mérito. Lo marcamos para no engañarnos.
    ambitoVacio: Boolean(reAmbito) && candidatas.length === 0,
    ejemplos: aciertos.slice(0, 2).map((e) => `${e.ruta} → ${e.valor.slice(0, 120)}`),
  };
}

// ── verificación de citas literales ─────────────────────────
/**
 * Cuenta cuántas afirmaciones del informe están respaldadas por texto que existe
 * de verdad en la nota.
 *
 * Formato nuevo: evidencia = { texto, verificada, linea_inicio, linea_fin } o
 * { texto: null, verificada: false, motivo }. Formato antiguo: evidencia = string.
 * En ambos casos se comprueba contra la nota, sin fiarse de la bandera: si el
 * servidor dice "verificada" pero el texto no está en la nota, es un fallo.
 */
function verificarCitas(entradas, nota) {
  const notaN = norm(nota);
  const limpiar = (s) =>
    norm(s).replace(/^[«»"'“”\s]+/, '').replace(/[«»"'“”\s.,;:]+$/, '');

  const textos = entradas.filter((e) => /\.evidencia\.texto$/.test(e.ruta));
  const noResueltas = entradas.filter(
    (e) => /\.evidencia\.verificada$/.test(e.ruta) && e.valor === 'false'
  );
  const antiguas = entradas.filter(
    (e) => /(^|\.)evidencia$/.test(e.ruta) && e.valor.trim().length > 8
  );

  const fallos = [];
  let verificadas = 0;

  for (const e of [...textos, ...antiguas]) {
    if (notaN.includes(limpiar(e.valor))) verificadas += 1;
    else fallos.push({ ruta: e.ruta, texto: e.valor });
  }
  for (const e of noResueltas) {
    fallos.push({ ruta: e.ruta, texto: '(sin cita literal — declarado por el servidor)' });
  }

  const total = textos.length + antiguas.length + noResueltas.length;
  return { total, verificadas, fallos };
}

// ── llamada a la API ────────────────────────────────────────
async function analizar(nota) {
  const r = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ [CAMPO]: nota }),
  });
  const txt = await r.text();
  if (!r.ok) throw new Error(`HTTP ${r.status} — ${txt.slice(0, 300)}`);
  try {
    return JSON.parse(txt);
  } catch {
    throw new Error('La respuesta no es JSON válido. Revisa --campo o el endpoint.');
  }
}

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

// ── ejecución ───────────────────────────────────────────────
async function main() {
  const casos = cargarCasos();
  if (!casos.length) {
    console.error('No hay casos que ejecutar.');
    process.exit(1);
  }

  console.log(`\nEndpoint: ${FIXTURE ? `(fixture) ${FIXTURE}` : ENDPOINT}`);
  console.log(`Casos: ${casos.length}   Repeticiones: ${REPS}\n`);

  const resultados = [];
  let totalChecks = 0;
  let totalPasados = 0;
  let citasTotales = 0;
  let citasOk = 0;

  for (const caso of casos) {
    console.log(`\n${'─'.repeat(70)}\n${caso.titulo}`);
    const porCheck = new Map(caso.comprobaciones.map((c) => [c.id, []]));
    const citasPorRep = [];
    const errores = [];

    for (let rep = 1; rep <= REPS; rep++) {
      let informe;
      try {
        informe = FIXTURE
          ? JSON.parse(readFileSync(join(AQUI, FIXTURE), 'utf8'))
          : await analizar(caso.nota);
      } catch (e) {
        errores.push(e.message);
        console.log(`  rep ${rep}: ERROR — ${e.message}`);
        continue;
      }
      // /api/analizar responde { analisis: {...} }; los fixtures pueden ir sin envolver.
      const entradas = aplanar(informe?.analisis ?? informe);
      for (const check of caso.comprobaciones) {
        porCheck.get(check.id).push(comprobar(check, entradas));
      }
      citasPorRep.push(verificarCitas(entradas, caso.nota));
      if (!FIXTURE && rep < REPS) await dormir(PAUSA_MS);
    }

    const detalle = [];
    for (const check of caso.comprobaciones) {
      const reps = porCheck.get(check.id);
      if (!reps.length) continue;
      const ok = reps.filter((r) => r.pasa).length;
      const simbolo = ok === reps.length ? 'PASA' : ok === 0 ? 'FALLA' : 'INESTABLE';
      const aviso = reps.some((r) => r.ambitoVacio) ? '  [ámbito vacío: revisa la ruta]' : '';
      console.log(`  [${simbolo}] ${ok}/${reps.length}  ${check.id}${aviso}`);
      if (simbolo !== 'PASA') console.log(`         ${check.descripcion}`);
      const ejemplo = reps.find((r) => r.ejemplos.length)?.ejemplos[0];
      if (ejemplo && check.tipo === 'no_debe_aparecer') console.log(`         encontrado: ${ejemplo}`);
      totalChecks += reps.length;
      totalPasados += ok;
      detalle.push({ id: check.id, descripcion: check.descripcion, pasa: ok, de: reps.length });
    }

    const cTot = citasPorRep.reduce((a, c) => a + c.total, 0);
    const cOk = citasPorRep.reduce((a, c) => a + c.verificadas, 0);
    citasTotales += cTot;
    citasOk += cOk;
    if (cTot) {
      const pct = Math.round((cOk / cTot) * 100);
      console.log(`  citas literales verificadas: ${cOk}/${cTot} (${pct}%)`);
      const primerFallo = citasPorRep.find((c) => c.fallos.length)?.fallos[0];
      if (primerFallo) console.log(`         no literal: "${primerFallo.texto.slice(0, 110)}"`);
    } else {
      console.log('  citas literales: ninguna encontrada (¿cambió el nombre del campo?)');
    }

    resultados.push({ caso: caso.id, titulo: caso.titulo, detalle, citas: { total: cTot, verificadas: cOk }, errores });
  }

  console.log(`\n${'═'.repeat(70)}`);
  console.log(`Comprobaciones superadas: ${totalPasados}/${totalChecks}`);
  console.log(
    `Integridad de citas:      ${citasOk}/${citasTotales}` +
      (citasTotales ? ` (${Math.round((citasOk / citasTotales) * 100)}%)` : '')
  );

  if (!existsSync(DIR_RESULTADOS)) mkdirSync(DIR_RESULTADOS, { recursive: true });
  const sello = new Date().toISOString().replace(/[:.]/g, '-');
  const destino = join(DIR_RESULTADOS, `${sello}.json`);
  writeFileSync(
    destino,
    JSON.stringify({ fecha: new Date().toISOString(), endpoint: FIXTURE || ENDPOINT, reps: REPS, totalChecks, totalPasados, citasTotales, citasOk, resultados }, null, 2)
  );
  console.log(`Resultados guardados en: ${destino}\n`);

  process.exit(totalPasados === totalChecks && citasOk === citasTotales ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
