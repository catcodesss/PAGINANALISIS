# Tarea: unificar AFC, ACT y MC en ACIA (DBT no se toca)

## Contexto

Repositorio de ACIA (Next.js, `Desktop/ACIA`). Lee primero `RELEVO.md`, `CAMBIOS.md` y `CLAUDE.md` (en `Desktop/`, fuera del repo).

La interfaz ya funciona como "un grafo, varias lentes": `lib/grafo.ts` construye los nodos una vez y `components/grafo/estilos/{afc,dbt,act,mc}.tsx` los reordenan. El problema está en el esquema (`lib/types.ts`) y en el prompt (`lib/systemPrompt.ts`), que siguen tratando ACT y MC como capas paralelas del AFC.

Principio conceptual de esta tarea: **hay un solo análisis funcional, que es la fuente de verdad.** ACT no es otro AFC. Es una capa de anotaciones funcionales sobre ese mismo grafo, más la vista Matrix. MC no aporta una lente propia: es el AFC dibujado en tres columnas.

## Hallazgos que motivan el cambio

1. `estilos/mc.tsx` reagrupa los mismos nodos del AFC en antecedentes, conductas y consecuencias. Su único dato propio, `capa_mc.procedimientos_sugeridos`, se solapa con `lineas_de_intervencion_tentativas`, porque el prompt pide a las dos el mismo vocabulario operante. En la maqueta salen dos listas de intervención para el mismo caso.
2. `capa_act.reglas_verbales` se dibujan como antecedentes del AFC (`construirNodosGrafo`). El análisis de conducta gobernada por reglas es análisis conductual general, no específico de ACT.
3. ACT infiere por topografía. En la maqueta (`evals/fixtures/01-v0.1.2.json`) se asigna "Fusión cognitiva" por el pensamiento "voy a quedarme en blanco", y `vinculo_con_cadena` es solo el nombre de la situación. El mismo pensamiento puede tener funciones distintas en dos personas.
4. Problemas de la vista ACT (`estilos/act.tsx`):
   - `procesosDe()` pinta un proceso con `situacion_id` en todos los nodos de esa situación;
   - la OM cae en "Malestar interior";
   - toda conducta problema va a "alejamiento" por su tipo, no por su función.

## Reglas

1. **DBT queda exactamente como está.** No toques ninguna de estas piezas:
   - `cadena_dbt`, `CadenaDBT`, `EslabonDBT` ni `capa_dbt`;
   - `components/grafo/estilos/dbt.tsx`;
   - `BLOQUE_DBT` ni `NOTA_CADENA_DBT_POR_SITUACION` en el prompt, aunque esa nota mencione las "pestañas ACT/MC";
   - la sección DBT de `formatearInforme.ts` ni las reglas DBT de los validadores.

   Si un cambio te obliga a tocar algo de DBT, para y pregunta.
2. **Antes de tocar nada,** resume en 5–10 líneas dónde aparecen `capa_act`, `capa_mc`, `reglas_verbales`, `procesos_act` y `procedimientos_sugeridos`. Mira como mínimo estos archivos: `types`, `grafo`, `identidad`, `parseAnalisis`, `validadores`, `formatearInforme`, `bloques`, `systemPrompt`, `plan`, `preferencias`, las vistas y los tests en `evals/`. Si algo de este encargo choca con el código, pregunta antes de improvisar.
3. **Nada se pierde.** Los informes guardados (v1 y v2) tienen que abrirse sin perder datos. El cambio de esquema sube `VERSION_ANALISIS` a 3 y añade una migración `migrarAV3` en `lib/parseAnalisis.ts`, siguiendo el patrón de `migrarAV2`.
4. **Los ids los genera el servidor, nunca el modelo** (ver el comentario de `Id` en `types.ts`). Si el modelo tiene que referirse a un nodo, lo hace por texto y el servidor lo resuelve una sola vez en `lib/identidad.ts`. Lo que no resuelva queda en `null` y se muestra como hueco, no como una relación inventada.
5. **La IA propone y el terapeuta decide.** Ningún texto nuevo transmite más certeza de la que da la nota.
6. **No añadas funciones fuera de esta lista.**
7. **Trabaja por fases, en commits pequeños.** Para al final de cada fase y enséñame el diff resumido y el resultado de las pruebas.

## Fase 1 · Quitar MC como vista y fundir sus procedimientos en el Plan

- **Esquema:** elimina `capa_mc`, `CapaModalidadMC` y `ProcedimientoSugeridoMC` del esquema v3. Añade a `LineaIntervencion` dos campos opcionales: `contingencia_objetivo: string | null` (qué contingencia concreta pretende modificar) y `precauciones: string | null`.
- **Migración:** cada `procedimiento` antiguo pasa a ser una línea de intervención, con `intervencion = procedimiento` y sus dos campos. Intenta resolver `conducta_id` con la heurística que ya existe en `identidad.ts`. Si no resuelve, déjalo en `null`. No descartes procedimientos aunque se parezcan a una línea existente: un falso duplicado visible es mejor que un dato perdido en silencio.
- **Interfaz:**
  - borra `estilos/mc.tsx` y quita `"mc"` de `EstiloGrafo` en `lib/preferencias.ts`; `useLente` ya cae a la lente por defecto si hay guardado un valor que no existe, así que compruébalo;
  - quita el bloque `mc` de `lib/bloques.ts`;
  - en `BloquePlan.tsx`, muestra `contingencia_objetivo` y `precauciones` en la tarjeta de cada intervención.
- **Prompt:**
  - elimina `BLOQUE_MC` y la clave `capa_mc` del formato;
  - en `lineas_de_intervencion_tentativas`, pide `contingencia_objetivo` y `precauciones`, con la misma prohibición de proponer conductas que ya cumplen función de evitación (principio 15 y la prohibición estricta);
  - ajusta la instrucción que hoy dice "Genera SIEMPRE las tres capas… ACT, DBT y Conductual" para que hable de dos capas (ACT y DBT);
  - el texto que describe `lineas_de_intervencion_tentativas` como "neutral… las orientaciones de cada modalidad van en su capa" debe dejar claro que los procedimientos conductuales viven ahora aquí.
- **Exportación:** quita la sección "CAPA CONDUCTUAL — PROCEDIMIENTOS SUGERIDOS" de `formatearInforme.ts`. Esos datos salen ya dentro del Plan.
- **Validadores:** lo que hoy revisa `capa_mc.procedimientos_sugeridos` pasa a revisar las líneas de intervención. No bajes la cobertura. Esto incluye V5 y el campo `riesgo`, que según `RELEVO.md` llegaron en el mismo paquete que `capa_mc`: revisa que sigan funcionando.

## Fase 2 · Reglas verbales al núcleo del AFC

- **Esquema:** mueve `capa_act.reglas_verbales` a `AnalisisFuncional.reglas_verbales`, al mismo nivel que `variables_moduladoras`. No cambies la forma de `ReglaVerbal`.
- **Migración:** mueve las reglas y conserva sus ids.
- **Código:** actualiza todas las referencias (`grafo.ts`: construcción, edición, borrado y alta de nodos; `identidad.ts`; `validadores.ts`; `formatearInforme.ts`; el orden de campos en `types.ts`; los campos de reanálisis de `BloqueAnalisisFuncional.tsx`).
- **Prompt:** saca la instrucción de conducta gobernada por reglas de `BLOQUE_ACT` y ponla en el núcleo de principios, sin cambiar su contenido: pliance / tracking / augmenting, rigidez y análisis de qué cadena altera.

## Fase 3 · Los procesos ACT pasan a ser anotaciones funcionales

- **Esquema:** `ProcesoACT` pasa a tener esta forma:
  - `proceso`: enum `fusion | evitacion_experiencial | presente | yo_conceptualizado | valores | accion`;
  - `elemento_objetivo: string`: el texto del nodo o de la relación, tal como lo escribe el modelo;
  - `nodo_id: Id | null`: lo resuelve el servidor;
  - `justificacion_funcional: string`;
  - `evidencia: Cita`.

  Quita `situacion_id` como forma de anclaje: un proceso se engancha a un elemento, no a una situación entera. `capa_act` queda solo con `procesos_act`.
- **Migración:**
  - mapea el texto libre de `proceso` al enum; si no casa, conserva el texto en `justificacion_funcional` y usa el valor más cercano, marcándolo como pendiente de revisar;
  - `vinculo_con_cadena` pasa a `elemento_objetivo`;
  - `nodo_id` se resuelve con la misma heurística y, si falla, queda en `null`.
- **Prompt (`BLOQUE_ACT`):**
  - un proceso solo se señala si la nota muestra su **función**, no solo su topografía. Por ejemplo, fusión es que la regla o el pensamiento domina la conducta frente a otras contingencias; evitación experiencial es que la conducta funciona para reducir experiencias internas y se mantiene pese a su coste. La **topografía** sola no basta: un pensamiento negativo no es fusión, e ir al baño no es evitación experiencial;
  - `justificacion_funcional` dice qué controla ese evento y qué dato de la nota lo sostiene. Si falta el contraste, lo dice;
  - incluye en el prompt el ejemplo de las dos personas que piensan "voy a quedarme en blanco": una abandona y la otra sigue exponiendo;
  - la redacción es siempre de hipótesis ("posible patrón de…").
- **Interfaz:**
  - en la vista AFC, el proceso aparece como una etiqueta pequeña sobre su nodo (`nodo_id`), con el grado de apoyo (cita / parcial / inferencia) y el texto "posible";
  - los procesos con `nodo_id` en `null` se listan aparte como "sin anclar";
  - no crees nodos nuevos para los procesos.
- **Exportación:** en `formatearInforme.ts`, cada proceso sale con su elemento, su justificación y su cita.

## Fase 4 · Corregir la vista ACT (Matrix)

En `estilos/act.tsx`:

- **"Malestar interior"** solo contiene eventos privados: eslabones encubiertos y EC. Quita `om`.
- **`procesosDe()`** usa solo `nodo_id`. Nada de coincidir por situación.
- **"Alejamiento"** solo contiene conductas con base funcional. Cuenta como alejamiento una conducta con una anotación `evitacion_experiencial`, o una conducta cuya situación tiene `tipo_contingencia` de refuerzo negativo. Las demás conductas problema van a una fila "Conductas sin función de alejamiento establecida", en vez de clasificarse por su tipo.
- **Reglas verbales:** la franja se queda (ahora lee `analisis.reglas_verbales`).

## Fuera de alcance

Todo lo de DBT. La reorganización en pestañas de `prompt-reorganizacion-interfaz-acia.md`, cuentas, backend, almacenamiento y el pendiente 3 de `hayCamino`.

## Verificación

- Al terminar cada fase:
  - `npx tsc --noEmit` sin errores;
  - todas las suites listadas en `RELEVO.md` en verde;
  - `npx eslint components lib app` sin errores nuevos.
- **`evals/migracion.test.mjs`:** añade casos v2 → v3 que comprueben:
  - ningún procedimiento MC se pierde;
  - las reglas conservan su id;
  - un proceso ACT sin nodo resoluble queda en `null` y no se ancla a un nodo cualquiera;
  - un informe v1 sigue abriendo.
- **`evals/maqueta.test.mjs`:** actualízalo. La maqueta debe mostrar las intervenciones con su contingencia objetivo, y ningún proceso ACT pintado en nodos que no le corresponden.
- **DBT:** comprueba con `git diff --stat` que ningún archivo o bloque de DBT cambió de comportamiento. Si tuviste que tocar un archivo compartido, explica por qué.
- **Evals del prompt:** el prompt cambia, así que corre las evals **antes y después** con `npm run dev:evals`, temperatura 0,2 (no uses `npm run dev`). Estamos en PowerShell: no uses la sintaxis `VAR=x comando`. Anota los dos números en el commit, como exige `CLAUDE.md`. Además de la puntuación global, compara el número de procesos ACT asignados sin justificación funcional.
- **Fuentes:** mantén `RELEVO.md`, `CAMBIOS.md` y `.github/workflows/evals.yml` diciendo lo mismo.
