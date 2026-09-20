# PLAN — de 17 secciones a 5 bloques, con identidad de entidades

Estado: **propuesta, sin código escrito**. Esperando visto bueno.

Base: `main` = `b2f3fc2`, idéntico a `origin/main`. El commit local `7611850`
(«Quitar la sección de riesgo») se descartó en el rebase y sigue recuperable en
el reflog (`7611850bce5303c5eef112d0a7f77181610f06ba`); el intento local de
agrupar en cinco quedó en `stash@{0}`. Base verificada: `tsc` limpio, 8 suites en
verde (46 pruebas en validadores, 17 en coherencia), `eslint` sin errores.

> **Este plan sustituye a la primera versión, que estaba escrita contra un árbol
> 17 commits anterior.** Tres cosas que allí figuraban como «no existe, lo dejo
> en Propuestas» —`modificabilidad`, la red funcional con sus bucles, y el
> ranking por rendimiento esperado— ya están implementadas. Y una que daba por
> existente, `Situacion.conductas_implicadas`, no existe aquí.

---

## 0 · El diagnóstico, confirmado en el código

Tu diagnóstico es exacto y ahora puedo señalar dónde duele. El emparejamiento
entre entidades se hace **por raíces de palabra, en tiempo de render, en tres
sitios distintos**, y el propio `CAMBIOS.md` lo tiene apuntado como pendiente
número 3:

| Dónde | Qué empareja | Qué pasa si falla |
|---|---|---|
| `lib/redFuncional.ts:202` | hipótesis → conducta, y enunciado → variable | **la arista no se dibuja** y nadie se entera |
| `lib/priorizacion.ts:98` | hipótesis → variable moduladora | la variable desaparece del ranking |
| `lib/validadores.ts:95` (`yaEnRepertorio`) | alternativa → repertorio disponible | falso negativo silencioso |

`redFuncional.ts` es el caso extremo y el argumento más claro a favor de la fase
0: ya calcula nodos, aristas, ciclos y posiciones deterministas —el 60% del
trabajo del bloque 2 está hecho— pero lo hace sobre coincidencias de prosa, y
cuando no resuelve **descarta la relación en silencio**. El comentario de la
línea 192 lo asume como mal menor («una arista inventada afirmaría algo que
nadie escribió»). Con ids no hay que elegir entre inventar y perder.

Y el ranking duplicado que describías existe, literalmente, con los dos nombres:

- `formulacion.priorizacion` → «Priorización de blancos», ordena **conductas**,
  lo escribe el modelo en prosa (`blanco: string`).
- `priorizarBlancos()` → «Rendimiento esperado de cada blanco»
  (`ReportView.tsx:3042`), ordena **variables moduladoras**, se calcula como
  `fuerza × modificabilidad`.

Dos rankings, dos unidades de análisis distintas, el mismo nombre en pantalla.

### Lo que NO está como decía el encargo

1. **`Situacion.conductas_implicadas` no existe.** En este árbol no hay *ninguna*
   referencia declarada entre situación y conducta: el vínculo se adivina entero.
   O sea, el problema es peor de lo que el encargo describe, no menor. Ver §A.4.
2. **Son 17 secciones, no 15.** Se añadieron `hipotesis-origen` y
   `monitorizacion`, y `alertas` + `datos-faltantes` se fusionaron en
   `verificacion`.
3. **Los grupos ya existen y encajan 1:1 con tus cinco bloques**, pero con otros
   ids y otros títulos (`apertura` / `descripcion` / `mantenimiento` / `plan` /
   `pendientes`, titulados «Punto de partida», «Lo observado», «Lo que se
   infiere», «Lo que se hace», «Contrapesos y pendientes»). Mantengo los ids de
   origin; los títulos, a decidir (§E.1).
4. **La sección de riesgo vive, y eso resuelve una duda del plan anterior.** Tu
   bloque 1 se llama «Cabecera: riesgo y síntesis» y el grupo `apertura` ya
   contiene `riesgo` + `resumen` + `hipotesis-principal`. Encaja sin tocar nada.
   El validador V5 (`riesgo_posible_no_detectado`) depende de ese campo.
5. **`capa_mc` existe** y `ModeloTerapeutico` es `"act" | "dbt" | "mc"`. Tu fase
   3 define tres estilos gráficos (AFC, DBT, ACT) y no dice qué pasa con MC. Ver
   §E.2.
6. **`PENDIENTE.md` no existe; su sitio lo ocupa `CAMBIOS.md`**, que es bueno y
   está al día. Ahí actualizo al cerrar cada fase, salvo que digas otra cosa.
7. **`esbozo-fusion-editor-informe.md` sigue sin aparecer** en ninguna rama. Me
   apoyo en tu resumen de §10 (longitud = dato, color = refuerzo), que es lo que
   el prototipo implementa.

---

## A · El esquema v2 y el migrador

### A.0 · Las dos reglas que generan todo lo demás

> **1. Un id se almacena solo donde la entidad es un elemento de una lista.**
> Lo 1:1 con su padre (la cadena operante de una situación, su función
> hipotetizada) se deriva del padre: `sit_1/fn`. Así el esquema crece lo mínimo.
>
> **2. La heurística de prosa se ejecuta UNA VEZ, en el borde, y lo que no
> resuelve queda en `null`.** Hoy corre tres veces por render y cada sitio puede
> concluir algo distinto sobre el mismo par. Pasa a correr una sola vez en
> `parseAnalisis`, su resultado se guarda como id, y de ahí en adelante todo el
> sistema compara ids. Lo que no resuelva se queda sin resolver y **se ve**: un
> hueco declarado, no una relación desaparecida.

Y el corolario que hace posible el bloque 2 sin duplicar nada: **cada nodo del
grafo es la proyección de una entidad que ya existe.** Añadir un nodo es añadir
un elemento a la lista que le corresponde. No hay almacén de nodos paralelo.
Tabla completa en §A.6.

### A.1 · Ids

Los genera el **servidor** en `lib/parseAnalisis.ts`. El modelo no los emite, no
los ve, y el prompt no los menciona.

| Entidad | Id | Semilla |
|---|---|---|
| `ConductaProblema` | `cnd_1…n` | índice |
| `RepertorioDisponible` | `rep_1…n` | índice |
| `VariableModuladora` | `vmd_1…n` | índice |
| `Situacion` | `sit_1…n` | índice |
| `EslabonDBT` | `esl_1_3` | situación 1, eslabón 3 |
| `ConductaAlternativa` | `alt_1…n` | índice |
| `ReglaVerbal` | `rvb_1…n` | índice |
| `ProcesoACT` | `pac_1…n` | índice |
| `HipotesisMantenimiento` | `hip_1…n` | índice |
| `Acomodacion` | `acm_1…n` | índice |
| `SolucionDBT` | `sol_1…n` | índice |
| Consecuencia inmediata / demorada | `cns_1_inm` / `cns_1_dem` | situación 1 |

Derivados, no almacenados: `sit_1/om`, `sit_1/ed`, `sit_1/ec`, `sit_1/fn`,
`val_1…n` (posición en `valores_y_metas`), `frt_1…n` (`fortalezas_y_recursos`).

El índice es solo la **semilla de la primera asignación**: una vez puesto, el id
viaja con la entidad y no se recalcula al reordenar ni al borrar. Lo que el
clínico cree después toma `siguiente_id`, que arranca en `max+1`, para no
reutilizar el id de algo borrado.

### A.2 · Consecuencias: de `string` a `{ id, texto }`

```ts
export interface Consecuencia { id: string; texto: string; }

export interface CadenaOperante {
  …
  consecuencia: Consecuencia;                      // era string
  consecuencias_largo_plazo: Consecuencia | null;  // era string | null
}
```

El modelo **sigue emitiendo strings** y el parser los envuelve. Es la misma
asimetría que ya existe con `evidencia` (el modelo manda `{linea_inicio,
linea_fin}`, se guarda una `Cita`): el contrato no cambia ni una palabra y el
informe gana dos entidades direccionables, que el grafo necesita para que la
flecha `conducta → consecuencia` tenga a dónde apuntar.

### A.3 · `AnalisisFuncional` v2: el diff

```ts
version: 2;            // NUEVO — lo fija el servidor
siguiente_id: number;  // NUEVO — contador para lo creado a mano
```

Los dos entran en `CAMPOS_ANALISIS_FUNCIONAL` (si no, el chequeo de compilación
de `types.ts:557` falla, que es justo lo que queremos), en
`NORMALIZADORES_POR_CAMPO` y en `CAMPOS_SIEMPRE` de `lib/bloques.ts`. **No**
entran en el esquema que se manda al modelo; hay que comprobar que
`evals/razonamiento.test.mjs:127` sigue pasando, porque compara las claves
devueltas contra esa lista. Es el mismo caso que `alertas`, `meta` y
`secciones_editadas`, que ya viven así.

### A.4 · Las referencias

| Hoy | v2 | Nota |
|---|---|---|
| *(no existe)* | `Situacion.conductas_ids: string[]` | **se resuelve en el parser**, no se le pide al modelo |
| `HipotesisMantenimiento.conducta: string` | `destino_id: string \| null` | el extremo que ya nombra |
| *(dentro de `enunciado`)* | `origen_id: string \| null` | el otro extremo de la relación |
| `HabilidadSugeridaDBT.eslabon_objetivo` | `eslabon_id: string \| null` | |
| `SolucionDBT.eslabon_objetivo` | `eslabon_id: string \| null` | |
| `ProcesoACT.vinculo_con_cadena` | `+ situacion_id`, `+ eslabon_id`, texto → `vinculo_texto` | el texto **se conserva** |
| `PriorizacionBlanco.blanco: string` | `conducta_id: string \| null` | |
| `ConductaAlternativa.situacion: string` | `situacion_id: string \| null` | |

**Por qué `vinculo_texto` sobrevive y los demás textos no.** Se borra el texto
cuando es redundante con la entidad apuntada (`hipotesis.conducta` repite la
`descripcion` de la conducta; `eslabon_objetivo` repite la del eslabón) y se
conserva cuando dice algo más: `vinculo_con_cadena` explica *cómo* el proceso ACT
se engancha a la cadena, y perderlo sería perder análisis. Ahí el id se **añade**,
no sustituye.

**`origen_id` es la pieza que arregla la red funcional.** El principio 28 ya
exige «nombrar los dos extremos de cada relación» y `redFuncional.ts` intenta
extraer el origen del `enunciado` por raíces. Con `origen_id` resuelto en el
parser, `mejorCoincidencia` desaparece de ese módulo y las aristas dejan de
perderse. `detectarBucles`, el cálculo de posiciones y la redacción de los ciclos
en palabras **se quedan como están y se reutilizan en la fase 2**.

**Qué pasa con lo que no resuelve.** Nada se inventa. Un `conducta_id` sin
resolver queda en `null`, y eso deja de ser invisible: pasa a ser un aviso de
`lib/validadores.ts` y, en la fase 2, un nodo fantasma en el grafo. Hoy ese mismo
caso es una arista que no se dibuja y un ranking al que le falta una fila, sin
que nada lo diga. Y a diferencia de hoy, el clínico puede **corregir el vínculo a
mano** trazando la relación: por eso congelar la heurística en el borde es
aceptable, y recalcularla en cada render no lo era.

### A.5 · `analisis_en_cadena`: fusión, no borrado

Verificado contra `evals/fixtures/01-v0.1.2.json`: `capa_dbt.analisis_en_cadena`
es, campo por campo, la `cadena_dbt` de la situación 1. Es la copia que
describes. **Ojo, aquí hay un matiz que no estaba en el encargo:**
`analisis_de_soluciones`, que es nuevo y es la mitad terapéutica de la capa DBT,
apunta con `eslabon_objetivo` a los eslabones *de esa copia*. Fundir sin
re-apuntar las soluciones las dejaría huérfanas.

Pasos del migrador, en este orden:

1. Buscar la situación cuya `cadena_dbt.conducta_problema` case con
   `analisis_en_cadena.conducta_objetivo`.
2. Si casa y la situación ya tiene `cadena_dbt`: no se escribe nada, la de la
   situación manda. Se registra la correspondencia de eslabones.
3. Si casa y no tiene `cadena_dbt` (informe parcial): se escribe ahí, juntando
   `consecuencias_corto_plazo` + `_largo_plazo` en el `consecuencias: string` de
   `CadenaDBT`.
4. Si no casa con ninguna: **situación suelta** con `conductas_ids: []`, para no
   perder contenido. Dispara la alerta de cobertura, que es el comportamiento
   correcto — una cadena que no se sabe de qué conducta es, es un hueco.
5. **Después**, y solo después, resolver `eslabon_id` de `habilidades_sugeridas`
   y de `analisis_de_soluciones` contra los eslabones de la situación resultante.

En el prompt: fuera `analisis_en_cadena` del esquema de `capa_dbt`
(`systemPrompt.ts:129`) y recorte del principio de la línea 93.
`NOTA_CADENA_DBT_POR_SITUACION` y `LINEA_CADENA_DBT` se quedan: son la cadena por
situación, que es la que sobrevive. Un campo menos por análisis con capa DBT.

### A.6 · Nodo del grafo → entidad

| Nodo (prototipo) | Entidad | Añadir un nodo = |
|---|---|---|
| `om` | `cadena_operante.operacion_motivacional` (1:1) | escribir el campo |
| `moduladora` | `VariableModuladora` | `push` + relación |
| `ed` | `cadena_operante.antecedente` (1:1) | escribir el campo |
| `ec` | `cadena_respondiente.estimulo` (1:1) | crear la respondiente |
| `regla_verbal` | `ReglaVerbal` | `push` a `capa_act.reglas_verbales` |
| `encubierta` | `EslabonDBT` | `push` a `cadena_dbt.eslabones` |
| `conducta` | `ConductaProblema` | `push` + su id a `conductas_ids` |
| `conducta` (activo) | `RepertorioDisponible` | `push` — es la columna *Activos* |
| `conducta` (alt) | `ConductaAlternativa` | `push` |
| `consecuencia` inm./dem. | `cadena_operante.consecuencia` / `_largo_plazo` | escribir |
| `consecuencia` (alt) | `ConductaAlternativa.consecuencia_necesaria` | escribir |
| `funcion` | `Situacion.funcion_hipotetizada` (1:1) | escribir |
| `valor` | `valores_y_metas[i]` | `push` |

Los 1:1 no se pueden añadir dos veces: el `+ añadir` de esa celda se deshabilita
cuando el campo ya tiene contenido. Diferencia deliberada con el prototipo, que
admite N nodos por carril porque no tiene esquema detrás.

### A.7 · Las aristas (fase 2, no fase 0)

```ts
export type TipoArista = "secuencial" | "moderadora" | "bucle";
export interface Arista { id: string; desde: string; hasta: string; tipo: TipoArista; }
// AnalisisFuncional.aristas: Arista[]
```

Campo nuevo, y por eso va en la fase 2: la fase 0 dice que no se añaden campos.
El modelo no las emite; las materializa el servidor desde la cadena ya implícita
(`moduladora → om → ed → eslabones por orden → conducta → consecuencia
inmediata`, `conducta → consecuencia demorada`, `consecuencia inmediata →
función`, `alternativa → consecuencia necesaria`), más una por cada
`HipotesisMantenimiento` con sus dos `*_id` resueltos. Es el trazado que
`casoEjemplo()` del prototipo escribe a mano, aquí derivado.

Cuidado con el solape: `TipoArista` (estructura del grafo) **no es**
`TipoRelacion` (`causal` / `moderadora` / `mediadora`, que es la lectura clínica
de una hipótesis y ya existe en `types.ts:226`). Son dos ejes distintos sobre el
mismo trazo y no hay que fundirlos: una arista `secuencial` puede llevar una
relación `mediadora`. Lo digo porque el nombre invita a confundirlos.

**Y de aquí sale la regla de la fase 4:** estar en la misma banda no afirma nada.
Solo la arista afirma. Borrar `ed → conducta` hace que la prosa diga «[Ed no
trazado hasta la conducta]», porque pregunta por el camino (`hayCamino`), no por
la pertenencia.

### A.8 · El migrador

`migrarAV2(analisis)` en `lib/parseAnalisis.ts`, como **pasada posterior** a la
normalización: los mapeos de compatibilidad que ya existen (la tabla de
`CAMBIOS.md`, inline en cada `normalizar*`) no se tocan, siguen entregando un v1
bien formado y el migrador trabaja sobre eso. Se aplica en `repositorio.ts#obtener`,
en `#listar` y en `lib/maquetaInforme.ts`, que lee justo el fixture v1.

1. Si `version === 2`, devolver tal cual.
2. Ids por posición a todas las listas. Fijar `siguiente_id`.
3. Envolver las consecuencias.
4. Fundir `analisis_en_cadena` (§A.5).
5. Resolver referencias con la heurística existente. Sin resolver → `null`.
6. `version = 2`.

**Prueba, en `evals/migracion.test.mjs`**, dada de alta a la vez en
`.github/workflows/evals.yml` y en `CAMBIOS.md` — el olvido que documenta CLAUDE.md
con `razonamiento.test.mjs` no se repite:

- El fixture real migra sin lanzar, y migrar dos veces da lo mismo.
- Recuento de entidades antes = después: nada se pierde.
- `analisis_en_cadena` se funde en `sit_1` y no crea situación suelta.
- Las 2 `habilidades_sugeridas` resuelven su `eslabon_id` contra `sit_1`.
- Ningún id repetido.
- **`formatearInformeTexto` da un texto idéntico antes y después.** Es el
  criterio de aceptación 1 en su forma comprobable sin navegador.
- `construirRedFuncional` sobre el informe migrado dibuja **al menos tantas
  aristas** como antes. Esta prueba es la que demuestra que la fase 0 no es solo
  fontanería.

---

## B · Mapa: sección vieja → bloque nuevo

Los cinco grupos existentes pasan de encabezado del índice a **bloque
renderizado**. Sus secciones dejan de ser unidades de orden y quedan como anclas.

| # | Bloque | Grupo actual | Qué absorbe |
|---|---|---|---|
| 1 | Cabecera: riesgo y síntesis | `apertura` | `riesgo`, `resumen`, `hipotesis-principal` |
| 2 | Análisis funcional (el grafo) | `descripcion` | `conductas`, `variables-moduladoras`, `situaciones`, `modalidad` |
| 3 | Formulación integrada | `mantenimiento` | `hipotesis-mantenimiento`, `hipotesis-origen`, `formulacion` |
| 4 | Plan | `plan` | `conductas-alternativas`, `intervencion`, `monitorizacion` |
| 5 | Control de calidad | `pendientes` | `hipotesis-alternativas`, `verificacion`, `preguntas`, `niveles-confianza` |

### Qué desaparece como contenido y reaparece derivado

| Sección | Destino | Qué pasa |
|---|---|---|
| `riesgo` | 1 | Se mantiene. V5 sigue dependiendo del campo. |
| `resumen` | 1 | Se mantiene. |
| `hipotesis-principal` | 3 | Deja de ser contenido: destacado derivado de `hipotesis_mantenimiento[0]` + priorización. **De paso arregla el pendiente 4 de `CAMBIOS.md`**: hoy se ve en pantalla y no viaja al Word; derivado, viaja. |
| `conductas` | 2 | Excesos = la respuesta de cada cadena, en su carril. Déficits y **activos** (`repertorio_disponible`) como nodos fuera de cadena. |
| `variables-moduladoras` | 2 | Cada moduladora cuelga por arista `moderadora` de la OM que modula. La rejilla 3×6 sobrevive como **botón de vista**, no como sección. |
| `situaciones` | 2 | Es el grafo. |
| `modalidad` | 2 | **Selector de estilo**. `useLente.ts` ya persiste la lente elegida: se reutiliza. |
| `hipotesis-mantenimiento` | 3 | Prosa derivada del grafo (fase 4). El modelo deja de emitir `enunciado`; sigue emitiendo `funcion`, `confianza`, `fuerza`, `direccion` y `tipo_relacion`. |
| `hipotesis-origen` | 3 | Se mantiene como destacado aparte, **y marcado como no modificable**: separarlo del mantenimiento es una defensa clínica deliberada y no se toca. |
| `formulacion` · relaciones | 3 | Derivadas de las `consecuencias_largo_plazo` compartidas y de los bucles que `detectarBucles` ya encuentra. |
| `formulacion` · priorización | 3 | **Un solo ranking.** Ver §B.1. |
| `conductas-alternativas` | 2 y 4 | Fila «alternativa» bajo cada banda, y columna de la tabla del plan. |
| `intervencion` + `monitorizacion` | 4 | Una tabla: blanco → alternativa → consecuencia que la mantendría → línea de intervención → qué se mide. `plan_de_monitorizacion` da las dos últimas columnas, **incluido `criterio_de_revision`**, que no puede perderse: es lo que convierte la formulación en hipótesis con fecha de revisión. |
| `verificacion` + `preguntas` + `hipotesis-alternativas` | 5 | Dos columnas: qué falta / cómo preguntarlo. `datos_faltantes` ya trae `por_que_importa`. Cada alerta enlaza al nodo del grafo por id. |
| `niveles-confianza` | — | Leyenda y tooltip. Ya está duplicada en el pie. |

### B.1 · El ranking duplicado

Hay que unificar, y la unificación tiene una trampa: `priorizarBlancos` puede
calcular `fuerza × modificabilidad` porque **las variables moduladoras tienen
`modificabilidad` y las conductas problema no**. Dos salidas:

- **(a) Ranking único de conductas** (lo que pide el encargo). Exige añadir
  `modificabilidad` a `ConductaProblema` — campo nuevo para el modelo. La fuerza
  de una conducta sale de las hipótesis que apuntan a ella (`destino_id`), que
  con la fase 0 es exacto.
- **(b) Ranking único de variables**, que es el que hoy está calculado de verdad;
  `formulacion.priorizacion` (prosa del modelo) se retira y el orden de conductas
  se deriva de `importancia` + número de relaciones entrantes.

Recomiendo **(a)**: el encargo dice «unifica en UN solo ranking de conductas», y
el blanco de una intervención es una conducta, no una variable. Pero es un campo
nuevo, así que va a §D y lo decides tú. Mientras no esté, **(b)** es lo honesto.

### B.2 · Anclas y orden guardado

```ts
// lib/secciones.ts
export const ANCLAS_POR_BLOQUE: Record<IdSeccion, readonly string[]>;
export const BLOQUE_DE_ANCLA: Record<string, IdSeccion>;
```

`<section id="hipotesis-principal">` se sigue emitiendo dentro del bloque 3. Un
enlace a un id viejo encuentra su ancla; si no está pintada, el scroll sube al
bloque por `BLOQUE_DE_ANCLA`. `seccionDeRuta` de `validadores.ts` devolverá
`IdSeccion` de bloque (5 valores), y su tipo de retorno sigue impidiendo señalar
una sección inexistente.

`reconciliarOrden` (`lib/ordenSecciones.ts:38`) **descarta** los ids que no están
en `idsPorDefecto`, no los conserva — ya lo hace hoy con `alertas` y
`datos-faltantes`, y está documentado como el comportamiento correcto. Un orden
guardado con los 17 ids se convierte en el de fábrica de los 5. Se pierde, no se
migra; con el alias se puede deduplicar y conservar si lo prefieres.

### B.3 · Secciones vacías

Colapsan solas, **salvo los huecos epistémicos**, que se pintan con nodo fantasma
o tarjeta de hueco. La diferencia: «no hay valores registrados» es un hallazgo;
«lista vacía» es ruido. La rejilla 3×6 ya trabaja así —una celda vacía es
información sobre la evaluación— y esa lectura hay que conservarla.

---

## C · Orden de commits

Uno por fase, la fase 0 sola.

**C0 — `Dar identidad estable a las entidades del analisis (esquema v2)`**
`types.ts`, `parseAnalisis.ts` (+ `migrarAV2`), `redFuncional.ts` (fuera
`mejorCoincidencia`), `priorizacion.ts`, `validadores.ts`, `systemPrompt.ts`
(fuera `analisis_en_cadena`; **v1.5.0**), `bloques.ts`, `repositorio.ts`,
`maquetaInforme.ts`, y los ajustes mecánicos de `ReportView`/`formatearInforme`/
`exportarDocx` por `Consecuencia`. Nuevo `evals/migracion.test.mjs`.
*Salida:* `tsc` limpio, 9 suites verdes, `eslint` limpio, informe v1 idéntico al
abrirse.

**C1 — `De diecisiete secciones a cinco bloques`**
`secciones.ts`, `ordenSecciones.ts`, `formatearInforme.ts`, `exportarDocx.ts`,
`coherencia.test.mjs`. **Aquí se rompe `ReportView.tsx`** (140 KB, 3.300 líneas):
un componente por bloque en `components/informe/`, más `primitivas.tsx` para
`Chip`, `Cita`, `Confianza`, `SubSeccion`, `Seccion`, `ListaEditable`. Todavía
sin grafo.

**C2 — `El bloque 2 como grafo editable (AFC)`**
`components/grafo/`. Añade `aristas` (§A.7). Autolayout determinista por CSS
grid, flechas SVG superpuestas con `getBoundingClientRect` tras el layout,
recalculadas en resize y scroll. Sin lienzo, sin pan, sin zoom. Deshacer/rehacer
por instantáneas, `commit()` al cierre de cada acción atómica.

**C3 — `Los tres estilos graficos`**
`components/grafo/estilos/{afc,dbt,act}.tsx`. Cero `fetch`, cero mutación.
Reutiliza `useLente.ts`. Impresión y `.docx` siempre en AFC.

**C4 — `La prosa se deriva del grafo`**
`formatearInforme.ts` genera hipótesis, destacado y resumen desde nodos y
aristas. El prompt deja de pedir `enunciado` (**v1.6.0**). Solo se afirma lo
trazado.

**C5 (condicional) — `Pruebas de aceptacion end-to-end`** · depende de §E.3.

**Evals:** C0 y C4 tocan el prompt → `npm run dev:evals` + `node evals/run.mjs`,
dos consolas, PowerShell (no sintaxis de bash), y los dos números en el commit.
La marca vigente (v1.2.0, 43/47) ya no es comparable; C0 es el momento de fijar
una válida. Aviso de coste: ~9 llamadas por corrida, y el prompt ya va por
v1.4.0 sin medir desde entonces.

---

## D · Propuestas — conceptos nuevos que NO meto en el código

1. **`ConductaProblema.modificabilidad`** (`alta|media|baja`). Es lo único que
   falta para el ranking único de conductas (§B.1). Las variables ya lo tienen.
2. **`ConductaProblema.dimension` + `valor_basal`**
   (`frecuencia|duracion|intensidad|latencia`). Alimentaría «qué se mide» de la
   tabla del bloque 4 por conducta; hoy `plan_de_monitorizacion` es **uno solo
   para todo el informe**, así que la tabla repetiría la misma celda en cada
   fila. *Mientras no esté: una sola fila de monitorización, dicho como tal.*
3. **`clase` en `ConductaProblema`** (`exceso|deficit|activo`). Hoy la columna
   Excesos/Déficits se deduce de `deficit_o_interferencia`, que **no es lo
   mismo**: ese campo dice si la persona no sabe o sabe pero no puede, no si la
   conducta sobra o falta. Los activos ya viven aparte en `repertorio_disponible`.
4. **Subtipo de OM, modalidad del Ed, rol/nivel de la moduladora, mediación.**
   Las fichas del prototipo los piden y no existen. Las fichas funcionarán sin
   ellos (etiqueta, tipo, carril, evidencia, confianza, cita, y lo que sí existe:
   `esquema_de_contingencia`, `tipo_contingencia`, `modificabilidad`,
   `nivel`/`dimension`/`momento`). No propongo añadirlos: ensancha mucho el
   contrato.

---

## E · Decisiones antes de empezar

1. **Títulos de los cinco bloques.** Origin dice «Punto de partida · Lo observado
   · Lo que se infiere · Lo que se hace · Contrapesos y pendientes». Tu encargo
   los llama «Cabecera: riesgo y síntesis · Análisis funcional · Formulación
   integrada · Plan · Control de calidad». Los ids no cambian; ¿qué títulos?

2. **`capa_mc`.** Tu fase 3 define AFC, DBT y ACT. MC existe como capa, con su
   bloque en `lib/bloques.ts` y su sitio en el selector de lente. ¿Cuarto estilo,
   se queda como sección dentro del bloque 2, o se retira? `CAMBIOS.md` ya lo
   tenía como pendiente número 1.

3. **Playwright.** Los criterios 2, 5, 9, 10 y 11 piden navegador (interceptar
   `fetch`, desbordamiento a 375 px, recuento de entidades entre estilos, Tab).
   Es dependencia nueva de desarrollo (~200 MB). Alternativa sin dependencia:
   1, 3, 4, 6, 7 y 8 son lógica pura y se comprueban en Node; el resto a mano con
   el navegador integrado y capturas. Recomiendo Playwright: «cero peticiones al
   cambiar de estilo» es exactamente lo que se rompe en silencio.

4. **`enunciado` y los informes ya guardados.** Cuando la fase 4 lo derive, un
   informe v2 anterior tendrá el `enunciado` del modelo *y* uno derivable.
   Propongo: manda el derivado, salvo que la sección esté en `secciones_editadas`,
   donde manda lo escrito a mano (invariante 6). Es la decisión que más se nota.

5. **`_to_delete/`.** Contiene dos `index.lock` obsoletos (uno lo aparté yo hoy
   para poder rebasar). ¿Lo borro?
