# ANCIA — contexto para Claude Code

Herramienta clínica que convierte notas de sesión en un análisis funcional
estructurado. Next.js 16 + React 19 + Tailwind v4, desplegada en Vercel. El
análisis lo genera la API de OpenAI (`gpt-4o`) desde el servidor.

**Esto es software clínico.** Un error aquí no es un bug cosmético: puede
orientar mal una intervención con una persona real. Ante la duda entre "el
informe dice algo" y "el informe no dice nada", lo correcto es no decir nada y
mandarlo a datos faltantes.

---

## Invariantes: no romper esto

Son el resultado de una auditoría que encontró fallos reales. Cada uno tiene su
razón; si algo obliga a tocarlos, avisa antes.

1. **El modelo nunca escribe una cita.** Recibe la nota con las líneas numeradas
   y devuelve `{linea_inicio, linea_fin}`; el servidor recorta el texto real
   (`lib/citas.ts`). Antes se le pedía "una cita textual breve de máximo 15
   palabras" y eso *forzaba* la paráfrasis: el informe mostraba texto inventado
   entre comillas bajo el rótulo "De la nota". Integridad de citas: 57% → 100%.

2. **Lo no verificado no se entrecomilla.** Si una cita no resuelve, la interfaz
   dice "Inferido — sin cita literal en la nota". Nunca se presenta como textual
   algo que redactó el modelo. Aplica igual al informe copiado e impreso.

3. **Los validadores no dependen de que el modelo obedezca.** `lib/validadores.ts`
   comprueba en el servidor, sin IA, cinco cosas: que no se prescriba una
   conducta de seguridad como intervención, que no haya confianza alta sin cita,
   que toda conducta listada se analice, que ninguna intervención dependa de un
   dato declarado faltante, y que el campo `riesgo` no deje fuera lenguaje de
   riesgo vital que la propia nota contiene. Los dos primeros ejemplos existen
   porque en dos ejecuciones seguidas con el mismo prompt el informe propuso
   "Respiración consciente" en un caso donde respirar en el baño *era* la
   conducta de seguridad; el quinto porque, en pruebas repetidas con una nota de
   riesgo explícito, el modelo marcó `riesgo.evaluado: true` con
   `indicadores: []` pese a que la nota describía ideación. El prompt pide;
   esto verifica.

4. **Las funciones de seguridad clínica no se cobran nunca.** Citas verificables,
   validadores y alertas, datos faltantes y el descargo. Un usuario gratuito no
   puede recibir un informe clínicamente peor. Ver `MONETIZACION.md`.

5. **La nota no se registra en ningún log.** Ni servidor, ni telemetría, ni
   mensajes de error.

---

## Mapa del código

```
app/api/analizar/route.ts        genera el informe; límite por IP; valida entrada
app/api/reanalizar-seccion/…     actualiza solo unos campos con una nota añadida
lib/systemPrompt.ts              21 principios + esquema JSON troceado por campo
lib/bloques.ts                   qué se puede pedir por separado y sus dependencias
lib/citas.ts                     numerar la nota y resolver citas por línea
lib/validadores.ts               comprobaciones deterministas → alertas
lib/parseAnalisis.ts             normalizadores tolerantes de la respuesta
lib/types.ts                     tipos + CAMPOS_ANALISIS_FUNCIONAL (chequeo en compilación)
lib/cifrado.ts / repositorio.ts  historial local cifrado (WebCrypto + IndexedDB)
lib/pii.ts                       enmascarado de datos identificables
lib/limitePeticiones.ts          rate limiting (en memoria: ver limitación abajo)
components/ReportView.tsx        el informe (1500 líneas; el más delicado)
components/Historial.tsx         guardar, listar, reabrir, respaldo
components/SelectorBloques.tsx   elegir qué partes generar
components/guiaContenido.tsx     contenido compartido por las dos guías
evals/                           casos de prueba y pruebas que no gastan API
```

`lib/types.ts` tiene un chequeo en tiempo de compilación: si añades un campo a
`AnalisisFuncional` y olvidas registrarlo en `CAMPOS_ANALISIS_FUNCIONAL` y en el
normalizador, el build falla. Es deliberado, no lo desactives.

---

## Cómo trabajar aquí

- **Español en todo**: nombres de variables, funciones, comentarios y commits.
- **Los comentarios explican el porqué, no el qué.** El código ya dice qué hace.
- **Cambio mínimo que cumpla el objetivo.** No refactorices de paso.
- **Pregunta antes de** añadir dependencias, cambiar el modelo de OpenAI o tocar
  los invariantes de arriba.
- **Coste en tokens**: el prompt se construye según lo que se pide. Al añadir
  algo al system prompt, piensa si debe ir siempre o solo con ciertos bloques.

### Verificación

Estas no gastan API y deben pasar siempre. Corren en cada push/PR a `main` vía
`.github/workflows/evals.yml`:

```bash
npx tsc --noEmit
node --experimental-strip-types evals/citas.test.mjs    # 10 pruebas
node --experimental-strip-types evals/pii.test.mjs      # 11 pruebas
node evals/validadores.test.mjs                         # 9 pruebas
```

Las evals completas sí gastan (6 llamadas). Ejecuta antes y después de tocar el
prompt, y anota los dos números en el commit:

```bash
npm run dev
node evals/run.mjs --endpoint=http://localhost:3000/api/analizar
```

**Marca actual (01/08/2026, `--reps=3`): caso 01 en 9/10, 86/90 comprobaciones,
integridad de citas 100%.** Si baja, algo se rompió. Dos cosas conocidas, no
regresiones:
- `respiracion-no-como-intervencion` (caso 01) falla de forma consistente: el
  modelo sigue sugiriendo "Respiración consciente/profunda" en
  `capa_dbt.habilidades_sugeridas`, saltándose la prohibición del principio 14
  para ese campo concreto. El validador `prescribe_conducta_seguridad` ya lo
  detecta y emite alerta, así que no llega sin avisar a la interfaz.
- `no-inventa-evitacion` (caso 02) es inestable (2/3): confirma el aviso de
  abajo sobre medir con una sola repetición.

Lo que no cubre ninguna prueba: que el informe sea *clínicamente útil*. Eso solo
lo juzga el autor, que es psicólogo.

---

## Limitaciones conocidas, ya asumidas

- **Rate limiting en memoria.** En Vercel cada invocación puede caer en otra
  instancia, así que frena el uso accidental pero no un abuso decidido. Para algo
  fiable hace falta Vercel KV o Upstash; la interfaz de `comprobarLimite` está
  pensada para sustituirse sin tocar las rutas.
- **El enmascarado no es anonimización.** Cubre lo que tiene forma fija. Una
  combinación de edad, profesión y ciudad identifica igual.
- **Sin DPA ni Zero Data Retention con OpenAI.** Hasta que estén, la herramienta
  no debería procesar notas de pacientes reales. No es un problema técnico.
- **El historial es local.** Si el usuario pierde la contraseña, no hay
  recuperación. Es la contrapartida de que nadie más pueda leerlo.

---

## Otros documentos

- `PENDIENTE.md` — lo que falta, por prioridad
- `MONETIZACION.md` — plan premium y por qué el almacenamiento es local
- `evals/README.md` — cómo funcionan los casos de prueba
- `BRIEF-ANIA.md` — la auditoría original (nombre antiguo del producto)

Al terminar algo, actualiza `PENDIENTE.md`.
