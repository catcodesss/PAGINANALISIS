/**
 * Evals de varias sesiones (fase 8): `node evals/run.mjs --sesion`.
 *
 * Cada caso con `## NOTA SESIÓN 2` parte del informe guardado que nombra
 * `## FIXTURE` (no se gasta una llamada en regenerar la sesión 1), lo envía con
 * la nota nueva a /api/actualizar y comprueba las operaciones propuestas:
 *
 *   debe_proponer / no_debe_proponer   op (admite «a|b»), objetivo, estado, postura, patron
 *   no_toca_confirmados                ningún modificar ni cambio de estado sobre lo confirmado
 *   referencias_validas                el servidor no descartó referencias inventadas
 *   citas_validas                      ni frases inexistentes
 *
 * Antes de enviar se marca como confirmada la segunda conducta del caso, que
 * ninguna nota de sesión 2 toca: así `no_toca_confirmados` mide algo.
 */

import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';

const sinAcentos = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '');
const norm = (s) => sinAcentos(s).toLowerCase();

function seccion(texto, nombre) {
  return (texto.split(new RegExp(`^##\\s+${nombre}\\s*$`, 'm'))[1] ?? '').split(/^##\s+/m)[0].trim();
}

export function cargarCasosSesion(dirCasos, solo) {
  return readdirSync(dirCasos)
    .filter((f) => f.endsWith('.md') && (!solo || f.startsWith(solo)))
    .map((f) => ({ f, texto: readFileSync(join(dirCasos, f), 'utf8') }))
    .filter(({ texto }) => /^##\s+NOTA SESIÓN 2\s*$/m.test(texto))
    .map(({ f, texto }) => ({
      id: f.replace(/\.md$/, ''),
      titulo: (texto.match(/^#\s+(.+)$/m) || [])[1] || f,
      fixture: seccion(texto, 'FIXTURE'),
      nota: seccion(texto, 'NOTA SESIÓN 2'),
      comprobaciones: JSON.parse((seccion(texto, 'COMPROBACIONES SESIÓN 2').match(/```json\s*([\s\S]*?)```/) || [])[1] || '[]'),
    }));
}

/** El informe de la sesión 1, normalizado como lo tendría el cliente. */
export function prepararSesion1(raiz, fixture) {
  execFileSync(
    process.execPath,
    [join(raiz, 'node_modules/typescript/bin/tsc'), 'lib/citas.ts', 'lib/identidad.ts', 'lib/parseAnalisis.ts', 'lib/apoyoAristas.ts',
      '--outDir', '.tmp-evals', '--rootDir', 'lib', '--module', 'commonjs', '--moduleResolution', 'node', '--target', 'es2022', '--skipLibCheck'],
    { cwd: raiz, stdio: 'inherit' }
  );
  const require = createRequire(import.meta.url);
  const { numerarNota } = require(join(raiz, '.tmp-evals/citas.js'));
  const { normalizarAnalisis } = require(join(raiz, '.tmp-evals/parseAnalisis.js'));
  const { migrarAV8 } = require(join(raiz, '.tmp-evals/identidad.js'));
  const { calcularApoyoAristas } = require(join(raiz, '.tmp-evals/apoyoAristas.js'));
  const nota1 = seccion(readFileSync(join(raiz, 'evals/casos/01-ansiedad-social.md'), 'utf8'), 'NOTA');
  const crudo = JSON.parse(readFileSync(join(raiz, 'evals/fixtures', fixture), 'utf8'));
  const a = migrarAV8(normalizarAnalisis(crudo.analisis ?? crudo, numerarNota(nota1).lineas));
  calcularApoyoAristas(a);
  const confirmada = a.conductas_problema[1]?.id;
  if (confirmada) a.procedencia[confirmada] = { estado: 'confirmado' };
  return a;
}

function casa(valor, patron) {
  return !patron || new RegExp(patron, 'i').test(norm(valor));
}

export function comprobarSesion(check, conjunto) {
  const ps = conjunto.propuestas;
  switch (check.tipo) {
    case 'referencias_validas':
      return { pasa: !conjunto.descartadas.referencia_inexistente };
    case 'citas_validas':
      return { pasa: !conjunto.descartadas.sin_frase };
    case 'no_toca_confirmados':
      return { pasa: !ps.some((p) => p.toca_confirmado && (p.op === 'modificar' || p.op === 'proponer_estado')) };
    default: {
      const ops = check.op ? check.op.split('|') : null;
      const hallada = ps.some(
        (p) =>
          (!ops || ops.includes(p.op)) &&
          (!check.objetivo || p.objetivo?.tipo === check.objetivo || (p.op === 'crear' && check.objetivo === 'conducta')) &&
          (!check.estado || p.estado === check.estado) &&
          (!check.postura || (p.postura ?? (['debilitada', 'descartada'].includes(p.estado) ? 'en_contra' : p.op === 'marcar_contradiccion' ? 'en_contra' : 'a_favor')) === check.postura) &&
          casa(`${p.valor ?? ''} ${p.justificacion} ${p.citas.map((c) => c.texto).join(' ')}`, check.patron)
      );
      return { pasa: check.tipo === 'debe_proponer' ? hallada : !hallada };
    }
  }
}

export async function ejecutarSesiones({ raiz, dirCasos, endpoint, reps, solo, pausa }) {
  const casos = cargarCasosSesion(dirCasos, solo);
  console.log(`\nEndpoint: ${endpoint}\nCasos de varias sesiones: ${casos.length}   Repeticiones: ${reps}\n`);
  let total = 0;
  let pasadas = 0;
  const tokens = { entrada: 0, salida: 0, n: 0 };
  for (const caso of casos) {
    console.log(`\n${'─'.repeat(70)}\n${caso.titulo}`);
    const analisis = prepararSesion1(raiz, caso.fixture);
    const resultados = new Map(caso.comprobaciones.map((c) => [c.id, []]));
    for (let rep = 1; rep <= reps; rep++) {
      const r = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nota: caso.nota, analisis, sesion: 2 }),
      });
      const datos = await r.json().catch(() => null);
      if (!r.ok || !datos?.conjunto) {
        console.log(`  rep ${rep}: ERROR HTTP ${r.status} ${datos?.error ?? ''}`);
        continue;
      }
      if (datos.tokens) {
        tokens.entrada += datos.tokens.entrada;
        tokens.salida += datos.tokens.salida;
        tokens.n += 1;
      }
      for (const c of caso.comprobaciones) resultados.get(c.id).push(comprobarSesion(c, datos.conjunto).pasa);
      if (rep < reps) await new Promise((res) => setTimeout(res, pausa));
    }
    for (const c of caso.comprobaciones) {
      const rs = resultados.get(c.id);
      if (!rs.length) continue;
      const ok = rs.filter(Boolean).length;
      console.log(`  [${ok === rs.length ? 'PASA' : ok === 0 ? 'FALLA' : 'INESTABLE'}] ${ok}/${rs.length}  ${c.id}`);
      total += rs.length;
      pasadas += ok;
    }
  }
  console.log(`\n${'═'.repeat(70)}\nComprobaciones superadas: ${pasadas}/${total}`);
  if (tokens.n) {
    console.log(`Tokens medios: entrada ${Math.round(tokens.entrada / tokens.n)} · salida ${Math.round(tokens.salida / tokens.n)}`);
  }
  return pasadas === total;
}
