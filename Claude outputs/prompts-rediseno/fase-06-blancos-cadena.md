# Fase 6 · Blancos: la cadena de ocho ranuras

**Alta.** Cambia el esquema y el prompt. Necesita crédito en OpenAI. Requiere la
fase 5.

## Contexto

Lee `CLAUDE.md` (en `Desktop/`), `RELEVO.md` y `CAMBIOS.md`. Diseño:
`Claude outputs/mesa-clinica-acia.html` §G y §H (maqueta de la cadena del
blanco 1, con la ranura de alternativa abierta).

El Plan por blanco (`lib/plan.ts`, `lib/formaPlan.ts`,
`components/informe/BloquePlan.tsx`) tiene la estructura correcta, pero en la
maqueta está lleno de vacíos («El análisis no propone intervención…») y de
huérfanos. Las conductas alternativas son genéricas («Negociar adecuadamente
sin ceder…»). Ninguna intervención declara sobre qué relación actúa, así que no
se puede comprobar contra la función.

Cada blanco pasa a ser una cadena de ocho ranuras:

1. evidencia (referencia);
2. hipótesis (referencia);
3. blanco operacionalizado;
4. mecanismo que se quiere modificar;
5. conducta alternativa;
6. estrategia, con «actúa sobre»;
7. indicador;
8. criterio de revisión, con la sesión en que se revisa.

## Reglas

1. Sigue las reglas comunes de `Claude outputs/prompts-rediseno/00-orden-y-urgencia.md`.
2. **El plan referencia; no copia.** Un blanco guarda ids y lo que es solo suyo.
   Hipótesis, evidencia y alternativas se muestran en vivo desde su fuente.
3. **Ninguna ranura «completa» se pinta en verde.** El verde es apoyo en la nota,
   y un plan no se apoya en la nota: se decide. Estados de ranura: ● completa,
   ⋯ hueco, ◆ conviene revisar, ▲ revisar antes de usar, y borde discontinuo
   para una propuesta.
4. **Invariante 3.** Los validadores nuevos son deterministas y van en
   `lib/validadores.ts`, con pruebas. Lo que no pueda comprobarse sin IA se
   marca como opinión (`origen: "ia"`), no como comprobación.
5. **Invariante 4.** Pedir propuestas a la IA por ranura no es una función de
   seguridad, pero sus alertas sí: regenerar una ranura que disparó ▲ nunca
   puede quedar detrás de un pago (fase 13).
6. Pregunta antes de cambiar el modelo de OpenAI.

## Sub-fase 6A · Esquema y migración

Lee primero `lib/plan.ts` y `lib/formaPlan.ts` y resume cómo se construye hoy el
plan por blanco.

- **`Blanco`**:

  ```
  id, conducta_ids, hipotesis_id, operacionalizacion, mecanismo,
  alternativa_ids, estrategia_ids, indicador_ids,
  revision, fase, prioridad, revisar_en_sesion: number | null
  ```

- **`LineaIntervencion`** gana `id` y `actua_sobre: Id | null` (la relación del
  mapa sobre la que actúa).
- **`PlanDeMonitorizacion`** gana `id`. Su `criterio_de_revision` es la ranura 8.
- **`ConductaAlternativa`** gana:

  ```
  sustituye_a: Id | null
  antecedente: string
  funcion_que_cumple: string
  la_mantendra: string[]        // consecuencias naturales, programadas o valores
  habilidades_necesarias: string
  recurso_ids: Id[]
  pregunta_ids: Id[]
  ```

- **Migración**: construye un blanco por conducta problema, con lo que hoy
  enlaza `conducta_id`. Lo que no enlaza va a la bandeja «Por asignar». Nada se
  descarta.

## Sub-fase 6B · Prompt

- La alternativa pide verbo observable, contexto, criterio mínimo, a qué conducta
  sustituye, bajo qué antecedente, qué función cumple y qué la mantendrá.
  Prohíbe las formulaciones del tipo «manejar mejor la ansiedad». Incluye el
  contraejemplo y el ejemplo de §G.
- Cada línea de intervención declara `actua_sobre` por texto. El servidor lo
  resuelve a id una vez; si no resuelve, queda en `null` y se ve.
- Pide `mecanismo` por blanco.
- Sube `VERSION_PROMPT`. Evals antes y después.
- **Comprobaciones nuevas en el caso 01:**
  - la alternativa de reuniones no contiene «manejar» ni «ansiedad» como objeto
    («manejar la ansiedad» y variantes);
  - la alternativa nombra la conducta a la que sustituye;
  - `respiracion-no-como-intervencion` sigue vigente.

## Sub-fase 6C · Interfaz

- **Vista Blancos**: lista ordenada por prioridad (arrastrar para reordenar; la
  procedencia lo marca como decisión del clínico). Cada blanco es una cadena de
  ocho ranuras en horizontal, que pasa a vertical por debajo de 1024 px.
- **Cabecera de cada blanco**: nombre, fase, «listo N de 8» y sesión de revisión.
- **Cada ranura se abre en línea**, debajo de la cadena, nunca en un modal.
  - Las ranuras 1 y 2 son referencias: «Ver en el Mapa» y «Abrir H1». Editar la
    hipótesis desde aquí avisa: «Esto cambia H1, que usan el blanco 1 y el
    blanco 3».
  - La ranura 5 abre el editor de la alternativa con todos sus campos, los
    recursos enlazables y las propuestas rechazadas tachadas.
- **«Pedir propuesta»** por ranura o para todas, reutilizando
  `/api/reanalizar-seccion` con el subconjunto de campos. Muestra el coste junto
  al botón, aunque todavía no se cobre (placeholder de la fase 13).
- **«Crear blanco»** desde el menú contextual del Mapa: rellena las ranuras 1 a 3.
- **Bandeja «Por asignar»**: sustituye a «Intervenciones sin blanco» y a
  «Monitorización sin blanco», con la sugerencia de la fase 1.
- **Activar un blanco con una alerta ▲** pide reconocerla con un motivo. El
  motivo viaja a la exportación.

## Sub-fase 6D · Validadores

Todos deterministas, con pruebas en `evals/validadores.test.mjs`:

- blanco activo sin hipótesis: ▲;
- alternativa sin nada en `la_mantendra`: ◆;
- alternativa con la misma topografía que la conducta a la que sustituye: ◆
  (decide la heurística y enséñamela);
- estrategia sin `actua_sobre`: ◆;
- blanco sin indicador o sin criterio de revisión: ◆;
- criterio de revisión que no puede salir mal: ◆ como opinión de la IA, si
  existe la pasada crítica; si no, fuera de esta fase.

`prescribe_conducta_seguridad` sigue revisando alternativas y estrategias.

## Fuera de alcance

Que la hipótesis cambiada entre sesiones avise al blanco (fase 8), los datos de
indicadores (fases 9 y 11), el cobro (fase 13).

## Verificación

- Las comprobaciones de las reglas comunes.
- **`evals/plan.test.mjs`** y **`evals/migracion.test.mjs`**: ningún plan antiguo
  pierde líneas ni monitorización; los huérfanos quedan en «Por asignar».
- **Evals del prompt** antes y después.
- **Navegador**: la cadena del blanco 1 del caso 01 se lee en una pantalla a
  1440 px; la alternativa con respiración aparece con ▲ y se puede rechazar;
  reordenar blancos funciona con teclado.
