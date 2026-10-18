# Fase 8 · Actualización por sesión

**Alta. Tamaño XL: empieza en modo plan.** Prompt nuevo; necesita crédito en
OpenAI. Requiere las fases 2, 3, 4 y 7. Es el núcleo de la ventaja frente a un
chat.

## Contexto

Lee `CLAUDE.md` (en `Desktop/`), `RELEVO.md` y `CAMBIOS.md`. Diseño:
`Claude outputs/mesa-clinica-acia.html` §J.2 (maqueta de «Revisar cambios»),
§P.4 (protocolo) y §Q (flujo con el caso M.).

Tras la fase 7, un caso tiene sesiones pero la IA no las conecta. Esta fase
añade la **actualización**: con la nota de la sesión N, el modelo propone un
conjunto de cambios sobre la formulación vigente, y el clínico los acepta,
rechaza o edita uno por uno. Nada se reescribe.

## Reglas

1. Sigue las reglas comunes de `Claude outputs/prompts-rediseno/00-orden-y-urgencia.md`.
2. **El invariante 1, generalizado.** El modelo no escribe citas ni ids. Recibe
   la formulación con **referencias cortas por llamada** (`C1`, `R7`, `H2`,
   `P3`) y la nota con frases numeradas. Devuelve operaciones que solo usan esas
   referencias. El servidor las traduce a ids, **rechaza las que no existen**,
   resuelve las citas y crea los ids nuevos.
3. **Nada se aplica sin el clínico.** El servidor devuelve un conjunto de
   cambios pendiente. Un elemento confirmado solo cambia si el clínico acepta esa
   propuesta concreta.
4. **Invariante 5.** Ni la nota ni la formulación serializada se registran en
   ningún log, error ni telemetría. El `razonamiento_previo`, si lo usas, no sale
   del servidor y se cae solo, como hoy (construcción clave por clave).
5. **Invariante 3.** Los validadores corren sobre el resultado de aplicar las
   propuestas, en el servidor y otra vez en el cliente tras la revisión.
6. Mismo modelo (`gpt-4o`). Pregunta antes de cambiarlo. Mismo límite de
   peticiones que `/api/analizar`.

## Sub-fase 8A · Primero, las evals de varias sesiones

Sin esto no se puede medir lo más importante del producto, así que va antes que
el código.

- **Formato**: amplía el de `evals/casos/` con secciones `## NOTA SESIÓN 2`
  (y siguientes) y comprobaciones sobre operaciones:
  - `debe_proponer`: una operación sobre una referencia, por ejemplo
    `proponer_estado(H rival, debilitada)`;
  - `no_debe_proponer`;
  - `no_toca_confirmados`;
  - `referencias_validas`: toda referencia existe;
  - `citas_validas`.

  Documéntalo en `evals/README.md`.
- **Casos mínimos:**
  - **01, sesión 2.** Nota de §J.2: trae el registro de dos reuniones; en la de
    tres personas expuso sin problema y la supervisora le dijo «bien hecho»; el
    lunes, en la grande, volvió a pedir ir al baño; el miércoles también durmió
    mal; su pareja le propuso que llamara al seguro y no lo hizo. Esperado:
    - evidencia a favor de la hipótesis de escape;
    - el antecedente pasa a depender del tamaño del grupo;
    - la rival de déficit de habilidad se debilita;
    - la pregunta de la supervisora queda respondida en parte;
    - una conducta nueva en la misma clase.
  - **Una contradicción**: una sesión que desmiente una hipótesis.
  - **Un control**: una sesión que no debería cambiar nada estructural.
- **`evals/run.mjs`**: soporta `--sesion` contra el nuevo endpoint y parte de un
  fixture de la sesión 1 guardado, para no gastar una llamada en regenerarla.

## Sub-fase 8B · Endpoint `/api/actualizar`

- **Entrada**: la formulación vigente y la nota nueva.
- **Serialización compacta**: el servidor construye el mapa de referencias, con
  solo lo que el modelo necesita (etiquetas, funciones, estados, preguntas
  abiertas), sin las notas anteriores. **Mide los tokens** con el caso 01 a lo
  largo de siete sesiones simuladas y dímelos.
- **Operaciones:**

  ```
  añadir_evidencia(ref, frases, postura: a_favor | en_contra)
  proponer_estado(ref_hipotesis, estado, frases)
  modificar(ref, campo, valor, frases)
  crear(tipo, ref_temporal, contenido, frases)
  responder(ref_pregunta, frases, estado)
  nueva_pregunta(...)
  marcar_contradiccion(ref, frases)
  ```

  Ajusta la lista si el código pide otra cosa y explícalo.
- **Validación en el servidor**: referencias, citas, ids nuevos, validadores. Las
  operaciones inválidas se descartan y se cuentan en la respuesta, sin texto
  clínico.
- **Salida**: un `ConjuntoCambios` con propuestas en estado pendiente, cada una
  con su frase y una justificación breve validada (campo `justificacion`).
- **Prompt nuevo**, separado del de `/api/analizar`, en un fichero propio, con su
  `VERSION_PROMPT_ACTUALIZACION`. Principios clave:
  - proponer, no reescribir;
  - cada propuesta con su frase;
  - no inventar referencias;
  - no proponer cambios de estado sin una frase que pueda desmentir o sostener;
  - lo no mencionado en la nota no cambia.

## Sub-fase 8C · Revisar cambios

- **Paso 2 del flujo de sesión** (`FlujoSesion`): «Analizar sesión · 1 crédito»
  (el coste es un rótulo hasta la fase 13), y luego la revisión.
- **Revisión agrupada por hipótesis o blanco**, no por campo, como en la maqueta
  de §J.2:
  - cada propuesta con su operación (+ − ~ ↑), su frase y ✓ ✕ ✎;
  - «Aceptar en lote» solo para evidencia nueva; los cambios de estado y de
    estructura se aceptan uno a uno;
  - las propuestas que tocan un elemento confirmado llevan una marca;
  - al pie: frases sin usar, elementos confirmados afectados y alertas nuevas.
- **Al terminar**: se aplican las aceptadas, se escriben las revisiones (autor
  IA para lo aceptado tal cual, clínico para lo editado), se guarda la versión
  de la sesión N y se recalculan apoyo y alertas.
- **Propagación**: si cambia una hipótesis, los blancos que la usan reciben ◆
  «La hipótesis cambió: revisa mecanismo y estrategia».
- **Apoyo «contradicho»**: la evidencia en contra aceptada marca ⊘ en el
  elemento o la relación y entra en el cálculo del mínimo.
- **«Cambios desde Sn»**: capa del Mapa que resalta lo nuevo con una píldora de
  sesión hasta que se visita.

## Fuera de alcance

Preparar (fase 9), la vista Evolución (fase 11), cobrar los créditos (fase 13),
la revisión profunda del caso completo (fase 11B o posterior).

## Verificación

- Las comprobaciones de las reglas comunes.
- **Evals de varias sesiones** (8A): resultado por caso y por comprobación, con
  `--reps=3`. Anota en el commit los números y los tokens medios de entrada y de
  salida.
- **`evals/razonamiento.test.mjs`** o una prueba nueva equivalente: ningún campo
  de razonamiento sale en la respuesta de `/api/actualizar`.
- **Prueba nueva**: una referencia inventada por el modelo (simulada) se
  rechaza y no llega al cliente.
- **Prueba nueva**: un elemento confirmado no cambia sin aceptación explícita.
- **Navegador**: el caso 01 con la sesión 2 de 8A, desde «Añadir sesión» hasta
  la versión 2, con un rechazo y una edición. Comprueba la propagación al
  blanco 1.
