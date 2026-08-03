# ACIA — contexto para Claude Code

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

   **El análisis generado también es contenido clínico.** No es "texto del
   modelo" separable de la nota: describe el caso. Donde la nota dice "pidió ir
   al baño", el informe escribe "pide ir al baño y se ausenta"; y una hipótesis
   con confianza ALTA lo es, por el principio 11, *precisamente porque* hay una
   línea de la nota que la sostiene explícitamente — son las más pegadas al
   original. Por eso el reporte de fallo (`lib/reporteFallo.ts`) no lleva ni la
   nota, ni las citas, ni el análisis, ni los mensajes de alerta (que citan el
   texto generado): solo modelo, versión de prompt, sección y códigos. Lo
   clínico lo escribe el profesional a mano, con datos ficticios, y lo ve antes
   de copiar. `evals/reporteFallo.test.mjs` lo fija.

   **El razonamiento previo del modelo es lo mismo, y más crudo.** El formato
   pide `razonamiento_previo` como PRIMERA clave del JSON: es donde el modelo
   resuelve los diferenciales y descarta funciones antes de escribir el informe
   (sin ese espacio, el principio 12 pide una autoverificación que no tiene
   dónde ocurrir, porque el primer token emitido ya es la conclusión). Ese
   borrador nombra a la persona y describe el caso sin las cautelas del informe
   final, así que no sale del servidor. No se descarta con una línea: se cae
   solo, porque `normalizarAnalisis` construye la salida clave por clave desde
   `CAMPOS_ANALISIS_FUNCIONAL` y cualquier clave ajena se pierde ahí. No añadas
   `razonamiento_previo` a `AnalisisFuncional` ni hagas el normalizador
   permisivo con un `...json`: es justo lo que lo publicaría.
   `evals/razonamiento.test.mjs` lo fija.

6. **Lo que escribe el clínico no se presenta como generado por la IA.** Es el
   invariante 2 en el sentido inverso. Editar a mano marca la sección
   (`secciones_editadas`), y la marca viaja al informe copiado, impreso y
   exportado a Word. Un reanálisis que fuera a sobrescribir texto propio avisa
   antes.

---

## Mapa del código

```
app/api/analizar/route.ts        genera el informe; límite por IP; valida entrada
app/api/reanalizar-seccion/…     actualiza solo unos campos con una nota añadida
lib/systemPrompt.ts              21 principios + esquema JSON troceado por campo
lib/bloques.ts                   qué se puede pedir por separado y sus dependencias
lib/citas.ts                     numerar la nota y resolver citas por línea
lib/validadores.ts               comprobaciones deterministas → alertas
lib/pasadaCritica.ts             2ª llamada opt-in (gpt-4o-mini) que revisa el informe ya generado
lib/exportarDocx.ts              informe a Word (HTML con namespace MSO, sin dependencias)
lib/reporteFallo.ts              reporte de fallo del modelo, sin la nota ni sus citas
lib/parseAnalisis.ts             normalizadores tolerantes de la respuesta
lib/types.ts                     tipos + CAMPOS_ANALISIS_FUNCIONAL (chequeo en compilación)
lib/cifrado.ts / repositorio.ts  historial local cifrado (WebCrypto + IndexedDB)
lib/pii.ts                       enmascarado de datos identificables
lib/limitePeticiones.ts          rate limiting (en memoria: ver limitación abajo)
components/ReportView.tsx        el informe (el más delicado)
components/edicionManual.tsx     primitivas de edición manual del informe
components/Historial.tsx         guardar, listar, reabrir, respaldo
components/SelectorBloques.tsx   elegir qué partes generar
components/guiaContenido.tsx     bloques de contenido de la guía de uso
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
node evals/reporteFallo.test.mjs                        # 7 pruebas
node --experimental-strip-types evals/razonamiento.test.mjs  # 10 pruebas
```

Las evals completas sí gastan (9 llamadas, una por caso). Ejecuta antes y
después de tocar el prompt, y anota los dos números en el commit:

Son **dos consolas**: la primera se queda ocupada con el servidor.

```bash
npm run dev:evals                                          # consola 1
node evals/run.mjs --endpoint=http://localhost:3000/api/analizar   # consola 2
```

**La temperatura hay que fijarla o los números no se comparan.** Producción va
a 0.5 desde la v1.2.0 del prompt: a 0.2 el modelo toma siempre el camino más
típico y el informe salía correcto pero obvio, que es la queja real de los
usuarios. Las marcas de abajo se midieron a 0.2, así que `dev:evals` la fija
ahí (`evals/dev-evals.mjs`). **No uses `npm run dev` para medir**: arranca a
0.5 y los números salen incomparables sin avisar de nada.

No escribas `OPENAI_TEMPERATURA=0.2 npm run dev`: eso es sintaxis de bash, y en
PowerShell —que es la consola de este proyecto— falla la asignación pero el
resto de la línea se ejecuta igual, así que las evals corren a la temperatura
que no era y el resultado parece bueno. Ya pasó una vez.

**Marca actual (03/08/2026, prompt v1.2.0): 9 casos, 43/47 comprobaciones
(1 rep), integridad de citas 61/61 (100%).** Si baja, algo se rompió.
Marca anterior, con el prompt v1.1.0 (01/08/2026): 42/47 y 75/77 (97%).
Con `--reps=3` sobre los 6 primeros casos, en la v1.1.0: 86/90, citas 100%.

**Vigilar la cobertura, que no la mide ninguna comprobación.** La v1.2.0
subió el acierto pero produjo menos material: 61 entradas de evidencia frente
a 77 (−21%), y en el caso 01 tres conductas problema donde antes se recogían
más. Los dos fallos nuevos de esta corrida son de ese tipo — contenido que
desaparece, no contenido erróneo. Es coherente con el cambio: el principio 22
pide profundidad y el modelo parece pagarla en amplitud. Antes de tocar nada
hace falta separar varianza de efecto real con `--reps=3`.

Fallos conocidos, no regresiones — fallos reales del modelo, intermitentes,
verificados en vivo, no fallos de calibración del test:
- `respiracion-no-como-intervencion` (caso 01): el modelo a veces sugiere
  "Respiración consciente/profunda" en `capa_dbt.habilidades_sugeridas`,
  saltándose la prohibición del principio 14 para ese campo concreto. El
  validador `prescribe_conducta_seguridad` ya lo detecta y emite alerta.
- `no-inventa-evitacion` (caso 02): inestable (2/3 con `--reps=3`). Ver el
  análisis completo en PENDIENTE.md — es un fallo real del prompt (forzar
  refuerzo negativo sin evidencia de R−), no un falso positivo del test.
- Caso 09 (riesgo explícito): en pruebas repetidas, 1 de 4 llamadas idénticas
  devolvió `riesgo.evaluado: true` con `indicadores: []` pese a que la nota
  describía ideación explícita. Por eso existe el validador 5 de
  `lib/validadores.ts` (`riesgo_posible_no_detectado`): no depende de que el
  modelo acierte, escanea la nota directamente. En la corrida de la v1.2.0
  este acertó: detectó ideación y escalada de consumo, y falló en cambio
  `no-omite-derivacion`.
- `cita-mueble` (caso 05): intermitente. Falló en la corrida y pasó en una
  llamada idéntica inmediatamente después — el modelo elige a veces un rango
  de líneas que deja fuera la expresión textual del paciente. La comprobación
  exige que esté dentro de `evidencia`, no en cualquier parte del informe.
- `urgencias-palpitaciones` (caso 01): las visitas a urgencias desaparecieron
  del informe entero. Verificado en vivo sobre la respuesta real. Es el fallo
  de cobertura descrito arriba, no un problema de la comprobación.

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
- `MARCA.md` — nombre, símbolo, color, tipografía y voz; normativo
- `evals/README.md` — cómo funcionan los casos de prueba

Al terminar algo, actualiza `PENDIENTE.md`.
