# Fase 4 · Preguntas clínicas, hipótesis rivales y estados

**Alta.** Cambia el esquema y el prompt. Necesita crédito en OpenAI.

## Contexto

Lee `CLAUDE.md` (en `Desktop/`), `RELEVO.md` y `CAMBIOS.md`. Diseño:
`Claude outputs/mesa-clinica-acia.html` §A.10, §A.11, §F y §G.

**Preguntas.** Hoy hay cuatro formas de la misma cosa, sin conexión entre sí:

- `preguntas_para_sesion`: cadenas sueltas y genéricas («¿Cómo se siente
  después de ceder…?»);
- `datos_faltantes`: con `por_que_importa`, son las buenas, pero están en la
  última pestaña;
- `hipotesis_alternativas[].como_descartarla`;
- `LineaIntervencion.depende_de`, que se ve como «Primero explorar: …».

Además, los «No sé» del paso previo (`lib/datosFaltantesPrevios.ts`,
`components/PreguntasDatosFaltantes.tsx`) acaban como datos faltantes.

**Hipótesis.** Las alternativas no dicen contra qué hipótesis compiten ni qué
observación las separa. Las hipótesis de mantenimiento no tienen estado.

**Plan.** `EstadoPlan` (`propuesto · revisar · aprobado · en_curso ·
descartado`) mezcla «¿revisé la propuesta?» con «¿en qué fase del tratamiento
está?».

## Reglas

1. Sigue las reglas comunes de `Claude outputs/prompts-rediseno/00-orden-y-urgencia.md`.
2. **Los estados de hipótesis y de blanco los cambia solo el clínico.** El
   modelo nunca los envía. En la fase 8 podrá proponerlos, con su frase.
3. **Nada de «confirmada».** Una nota no confirma una hipótesis funcional.
   Estados: `en_prueba · sostenida · modificada · debilitada · descartada`.
4. **No subas la longitud del prompt sin control.** Mide los tokens de salida
   antes y después y dímelos.
5. El validador `intervencion_depende_de_dato_faltante` tiene que seguir
   detectando lo mismo, ahora por id.

## Sub-fase 4A · Esquema y migración

- **`PreguntaClinica`**:

  ```
  id, texto,
  pone_a_prueba: Id | null    // hipótesis; la resuelve el servidor
  dato_faltante: string
  decision: string            // qué cambia según la respuesta
  origen: "ia" | "clinico" | "previa"
  estado: "abierta" | "respondida" | "respondida_en_parte" | "descartada"
  respuesta?: { texto, autor: "clinico" }
  ```

  Sustituye a `preguntas_para_sesion` y `datos_faltantes`.
  `LineaIntervencion.depende_de` pasa a ser `pregunta_id`.
- **Migración:**
  - cada dato faltante → pregunta con `dato_faltante = dato` y
    `decision = por_que_importa`;
  - cada pregunta suelta → pregunta sin hipótesis ni decisión, marcada para
    revisar;
  - `como_descartarla` → pregunta enlazada a su hipótesis alternativa;
  - `depende_de` → `pregunta_id`, por igualdad de texto con el dato faltante
    (hoy son la misma cadena; compruébalo). Si no casa, `null` y aviso visible.
- **Paso previo**: un «No sé» crea una pregunta con `origen: "previa"`.
- **`HipotesisAlternativa`**: gana `id`, `rival_de: Id | null` (el servidor la
  resuelve una vez en `lib/identidad.ts`), `la_favoreceria`, `favorece_principal`
  y `pregunta_id`.
- **`HipotesisMantenimiento`**: gana `estado` (por defecto `en_prueba`) y
  `motivo_estado`.
- **Blancos**: `estados_plan` se separa en `revision` (`propuesto · confirmado ·
  modificado · rechazado`) y `fase` (`activo · en_pausa · resuelto`). **Antes de
  migrar, enséñame la tabla de correspondencia** de los cinco estados actuales,
  sobre todo `revisar`.
- `CAMPOS_ANALISIS_FUNCIONAL`, normalizadores, `lib/bloques.ts` y reanálisis por
  sección al día.

## Sub-fase 4B · Prompt

- `preguntas_para_sesion` pasa a objetos `{ pregunta, hipotesis, dato,
  decision }`. Como mucho cinco. Cada pregunta tiene que discriminar entre
  hipótesis o desbloquear algo de lo que depende el plan. Prohíbe preguntas
  sobre sentimientos que no discriminan nada.
- Cada hipótesis alternativa nombra la principal con la que compite, qué
  observación favorecería a cada una y qué preguntar para separarlas.
- Sube `VERSION_PROMPT`. Evals antes y después.
- **Comprobaciones nuevas en el caso 01:**
  - alguna pregunta sobre la reacción de la supervisora o los compañeros que
    nombre la hipótesis de escape;
  - la alternativa de refuerzo positivo apunta a una hipótesis principal.

## Sub-fase 4C · Interfaz provisional

Con las pestañas actuales; se reorganiza en la fase 5.

- **Revisión**: una sola lista, «Preguntas abiertas». Cada tarjeta enseña la
  hipótesis que pone a prueba, el dato que falta, la decisión que cambia, su
  estado y «Anotar respuesta». Lo anotado es texto del clínico (invariante 6).
- **Resumen**: las tres preguntas con más valor de decisión (afecta a un blanco,
  desbloquea un plan, lleva tiempo abierta).
- **Formulación**: cada hipótesis enseña su estado con un selector y, debajo,
  su rival con la observación que las separa.
- **Plan**: «Primero explorar» enlaza a su pregunta. Cada blanco enseña
  revisión y fase por separado.
- La exportación refleja todo lo anterior.

## Fuera de alcance

Que la IA proponga cambios de estado (fase 8), la vista Preparar (fase 9).

## Verificación

- Las comprobaciones de las reglas comunes.
- **`evals/migracion.test.mjs`**: ningún dato faltante, pregunta ni
  `como_descartarla` se pierde; `depende_de` resuelve en el fixture; idempotente.
- **`evals/validadores.test.mjs`**: el validador de dependencia sigue dando lo
  mismo con ids.
- **`evals/plan.test.mjs`**: la correspondencia de estados del blanco.
- **Evals del prompt** antes y después, con los números en el commit.
