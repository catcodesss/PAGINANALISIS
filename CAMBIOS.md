# CAMBIOS

## Fase 2 — el bloque 2 es un grafo AFC editable

`AnalisisFuncional.aristas` conserva ahora las relaciones que ve y corrige el
profesional. El modelo no las emite: `lib/aristas.ts` materializa una sola vez
la cadena implícita después de asignar ids. Una lista existente —también una
lista vacía— nunca se regenera, porque borrar todas las flechas es una edición
válida y no puede deshacerse al reabrir el caso.

El bloque «Análisis funcional» dejó de repetir repertorio, rejilla, situaciones
y modalidad como cuatro representaciones. `components/grafo/GrafoAFC.tsx`
proyecta directamente las entidades del análisis en seis carriles, una banda
por situación y una fila alternativa. No existe un almacén paralelo de nodos.
Las posiciones salen del orden y del carril; las flechas se calculan sobre el
layout ya resuelto y se recalculan en resize y scroll. En móvil la cadena se
apila y el SVG se oculta; al imprimir se usa la tabla ED/OM/RO/C/CMLP.

La franja superior deriva su longitud de cita + confianza. Una franja completa
exige cita verificada, y el apoyo de la cadena es el mínimo de sus eslabones.
Al pulsarla se abre la línea correspondiente de la nota en bruto y se resalta.
Los huecos estructurales siguen visibles como nodos discontinuos.

La edición actúa sobre la entidad original: doble clic o ficha lateral para la
etiqueta, botones por carril para añadir, borrado con limpieza de relaciones y
modo Conectar con origen + destino. Deshacer/rehacer guarda una instantánea por
acción atómica. Los nodos tienen nombre accesible y recorrido por teclado.

`ReportView.tsx` empezó a dividirse: las primitivas compartidas viven en
`components/informe/primitivas.tsx`, hay un componente por bloque en
`components/informe/`, y el grafo está aislado en `components/grafo/`.

`evals/migracion.test.mjs` pasa de 10 a 14 pruebas para fijar la materialización
única de aristas, la regla de cita, el eslabón más débil y la ausencia de una
copia paralela al editar.


## v2 del análisis — identidad de las entidades

Cada entidad del análisis lleva ahora un `id` estable (`cnd_1`, `sit_2`,
`esl_1_3`…) que **genera el servidor al normalizar**, nunca el modelo. El
problema que resuelve: todo se referenciaba por prosa, y tres módulos
—`redFuncional`, `priorizacion` y `yaEnRepertorio`— emparejaban por raíces de
palabra **en cada render**, cada uno por su cuenta. Cuando el emparejamiento
fallaba, la red funcional descartaba la relación en silencio.

La heurística no desaparece: se mueve a `lib/identidad.ts` y corre **una vez**,
al normalizar. Lo que no resuelve queda en `null` y se cuenta
(`RedFuncional.sinResolver`), en vez de desaparecer.

| Antes | Ahora |
|---|---|
| *(no existía)* | `Situacion.conductas_ids` |
| `HipotesisMantenimiento.conducta` | `+ destino_id`, `+ origen_id` |
| `PriorizacionBlanco.blanco` | `+ conducta_id` |
| `ConductaAlternativa.situacion` | `+ situacion_id` |
| `HabilidadSugeridaDBT.eslabon_objetivo` | `+ eslabon_id` |
| `SolucionDBT.eslabon_objetivo` | `+ eslabon_id` |
| `ProcesoACT.vinculo_con_cadena` | `+ situacion_id`, `+ eslabon_id` |
| `CadenaOperante.consecuencia: string` | `Consecuencia { id, texto }` |

**Los textos no se borran.** El id se añade; la prosa original se queda para
mostrarla cuando el id no resuelva, que es justo cuando hace falta.

**`capa_dbt.analisis_en_cadena` se retiró.** Era una copia literal de la
`cadena_dbt` de una situación —comprobado campo por campo contra el fixture— y
se pintaba dos veces. El informe muestra ahora la cadena de la situación que
analiza la conducta prioritaria (`situacionDeLaCadenaDBT`). Un campo menos que
generar en cada llamada con capa DBT.

**Migración.** `migrarAV2` es idempotente y solo añade. Se aplica al normalizar
la respuesta del modelo, al leer del historial y al cargar la maqueta. Un
informe guardado en v1 se abre idéntico; lo fija `evals/migracion.test.mjs`
(10 pruebas), dado de alta en CI a la vez que aquí.

`VERSION_PROMPT`: 1.4.0 → 1.5.0.


Lo que cambió en el informe en esta tanda de trabajo, para quien retome esto sin
haber visto la conversación. No repite lo que el código ya dice: cuenta qué hay
de nuevo, dónde vive, qué se rompería si se toca, y qué quedó a medias.

La cadena que toca cada campo nuevo es siempre la misma —tipo, prompt, parser,
validadores, bloques, informe exportado, vista, secciones— y está descrita en el
README del proyecto. Si un campo se salta un eslabón no da error de compilación:
da un campo que el modelo nunca rellena, o que se rellena y no se pinta.

---

## Campos nuevos de `AnalisisFuncional`

| Campo | Forma | Dónde se ve |
|---|---|---|
| `repertorio_disponible` | `{ descripcion, contexto_en_que_ocurre, evidencia }[]` | «Repertorio conductual», columna *Activos* |
| `fortalezas_y_recursos` | `string[]` | «Formulación del caso» |
| `plan_de_monitorizacion` | `{ que_se_mide, con_que, cada_cuanto, criterio_de_revision } \| null` | Sección propia «Plan de monitorización» |

Campos nuevos dentro de estructuras que ya existían:

- `CadenaOperante.esquema_de_contingencia`: `"continua" | "intermitente" |
  "no_determinable"`. **No** es la tipología C+/C−/C/+/C/− (esa es
  `tipo_contingencia`): es con qué regularidad ocurre la consecuencia. Explica la
  resistencia a la extinción, y por tanto la dosis de exposición.
- `HipotesisMantenimiento.fuerza`, `.direccion`, `.tipo_relacion`. `fuerza` no es
  `confianza`: la confianza mide cuánto respalda la nota lo afirmado, la fuerza
  cuánto pesa la relación en el mantenimiento.
- `VariableModuladora.modificabilidad`: cuánto puede cambiar con intervención,
  **no** cuánto importa.
- `CapaModalidadDBT.analisis_de_soluciones`, `.plan_de_prevencion`,
  `.plan_de_reparacion`, `.eslabon_ausente`. Es la mitad terapéutica que le
  faltaba a la cadena DBT, que hasta ahora solo describía.

Cambios de forma en campos que ya existían:

- `datos_faltantes`: de `string[]` a `{ dato, por_que_importa }[]`. Un hueco sin
  la razón por la que importa no le dice al terapeuta si es un matiz o un
  bloqueante.
- `VariableModuladora`: se retiró `tipo` (`biologica | historia_de_aprendizaje |
  contextual`) y en su lugar hay tres ejes independientes —`nivel`, `dimension`,
  `momento`—. Ver «Rejilla de contexto y procesos», abajo.
- El paso previo de preguntas (`lib/datosFaltantesPrevios.ts`) devuelve ahora
  `PreguntaPrevia[]` (`{ pregunta, por_que_importa }`) en vez de `string[]`: el
  porqué del hueco viaja desde quien lo detectó hasta el informe, en vez de
  reconstruirse después.

---

## Secciones

**Nuevas**

- `hipotesis-origen` — «Hipótesis de origen». Sale de dentro de «Hipótesis de
  mantenimiento» y va marcada como no modificable. Separar origen de
  mantenimiento es la defensa estructural contra el error clínico más frecuente:
  tratar cómo se adquirió el problema en vez de qué lo sostiene hoy.
- `monitorizacion` — «Plan de monitorización», al final del grupo `plan`, con su
  propio bloque generable en `lib/bloques.ts`.

**Fusionadas**

- `alertas` + `datos-faltantes` → `verificacion` («Datos faltantes y puntos a
  verificar»). Respondían a la misma pregunta —qué hay que comprobar antes de dar
  el informe por bueno— desde dos sitios distintos del índice.

**Renombradas**

- `conductas`: «Conductas problema» → «Repertorio conductual». Tres columnas:
  Excesos · Déficits · Activos.
- `variables-moduladoras`: «Variables moduladoras» → «Contexto y variables
  moduladoras». Rejilla de 3 niveles × 6 dimensiones.

**Grupos**

`lib/secciones.ts` declara ahora `GRUPOS_INFORME` con cinco grupos (`apertura`,
`descripcion`, `mantenimiento`, `plan`, `pendientes`) y cada sección el suyo. El
grupo **manda sobre el orden guardado**: el clínico puede reordenar dentro de un
grupo y mover grupos enteros, pero un bloque no puede quedarse en mitad de un
grupo ajeno. La conciliación vive en `lib/ordenSecciones.ts` —fuera del
componente, para poder probarla— y el orden de fábrica no puede entremezclar
grupos (lo fija una prueba en `evals/coherencia.test.mjs`).

---

## Módulos nuevos

- `lib/ordenSecciones.ts` — concilia el orden guardado con las secciones de hoy.
- `lib/redFuncional.ts` — calcula nodos, aristas y posiciones de la red
  funcional. No dibuja: el SVG lo pinta `RedFuncionalSVG` en `ReportView`.
  Determinista a propósito (mismo informe, mismo dibujo).
- `lib/priorizacion.ts` — convierte alta/media/baja a 0,8/0,4/0,2 y ordena los
  blancos por `fuerza × modificabilidad`. **Orientación, nunca medida**: no hay
  unidades ni precisión, y la interfaz tiene la obligación de decirlo donde se
  pintan las barras.
- `lib/cobertura.ts` — cuántas de las 18 celdas de la rejilla tienen dato. Se
  llama **cobertura de datos** y nunca «confianza»: una rejilla llena de datos
  malos no vale más que una incompleta con datos buenos.
- `components/useLente.ts` — la lente terapéutica (ACT/DBT/…) como preferencia
  persistida, igual que el orden de los bloques.

---

## Rejilla de contexto y procesos

`VariableModuladora` se clasifica en tres ejes que antes estaban mezclados en un
solo campo:

- `nivel`: `biofisiologico | psicologico | sociocultural` — a qué nivel opera.
- `dimension`: `afecto | cognicion | atencion | self | motivacion | conducta` —
  qué clase de proceso modula.
- `momento`: `historico | actual` — cuándo se adquirió.

La historia de aprendizaje dejó de ser una categoría hermana de «biológica» y
«contextual» porque no es un tipo de variable: es un momento. Un patrón aprendido
en la infancia opera hoy a nivel psicológico o sociocultural, y con la lista
vieja había que elegir entre decir dónde opera o decir que viene de atrás.

Se pinta como tabla de 3×6, con las 18 celdas siempre a la vista. **Una celda
vacía es información sobre la evaluación, no sobre la persona**: se marca como
«Hueco» y enlaza con la sección de verificación. Puede que no haya nada que
registrar o puede que nadie lo haya preguntado, y eso se distingue preguntando.

---

## Selector único de lente

Los botones ACT/DBT/… se repetían en cada sección que tenía algo que enseñar por
modelo. Ahora hay **uno solo**, en la cabecera del informe, y se guarda en
`localStorage` (clave `acia-lente`) como el orden de los bloques. Persiste entre
casos a propósito: quien trabaja en DBT lo hace con todos sus pacientes.

En impresión no cambia nada: el documento sigue listando todas las capas
generadas, porque en papel no hay selector que pulsar. Dos pruebas de
`evals/coherencia.test.mjs` fijan que el selector se pinte una sola vez y que la
lente no vuelva a un `useState` local.

---

## Mapeos de compatibilidad para informes antiguos

Los informes guardados en el historial (`lib/repositorio.ts`) traen la forma
anterior de varios campos. Todo esto vive en `lib/parseAnalisis.ts`:

| Qué llega | Cómo se lee hoy |
|---|---|
| `datos_faltantes: ["texto"]` | `{ dato: "texto", por_que_importa: "" }`. La interfaz dice «Sin motivo declarado» en vez de aparentar que el hueco está completo. |
| `variables_moduladoras[].tipo: "biologica"` | `nivel: "biofisiologico"`, `momento: "actual"` |
| `variables_moduladoras[].tipo: "contextual"` | `nivel: "sociocultural"`, `momento: "actual"` |
| `variables_moduladoras[].tipo: "historia_de_aprendizaje"` | `nivel: "psicologico"`, `momento: "historico"` |
| Sin `dimension` | `"conducta"` — la dimensión que el resto del informe siempre describe |
| Sin `esquema_de_contingencia` | `"no_determinable"`, nunca `"continua"` |
| Sin `fuerza` / `direccion` / `tipo_relacion` | `"baja"` / `"unidireccional"` / `"causal"` — siempre el lado que afirma menos |
| Sin `modificabilidad` | `"baja"` |
| Ids de sección retirados (`alertas`, `datos-faltantes`) en el orden guardado | Se descartan en `reconciliarOrden` sin perder ninguna sección |
| Bloque `base` en `campos_generados` | Sigue mostrando «Repertorio conductual» y la rejilla |

El criterio, en todos los casos: **lo desconocido cae del lado que afirma menos**.
Un valor por defecto que declarara un esquema continuo, un bucle o una
modificabilidad alta cambiaría la dosis de exposición, el dibujo de la red o la
priorización apoyándose en una clave que el modelo simplemente omitió.

---

## Prompt

`VERSION_PROMPT` pasó de `1.2.0` a `1.4.0`. Principios nuevos o reescritos:

- **6** — reescrito entero: rejilla de contexto y procesos (nivel, dimensión,
  momento) en vez de las tres categorías anteriores.
- **8** — reforzado: la hipótesis de origen se formula como modelo
  vulnerabilidad-estrés, va en condicional sin excepción, y no genera blancos.
- **20** — fortalezas y recursos; un arreglo vacío es respuesta válida.
- **23** — cada dato faltante lleva por qué importa, en términos de este análisis.
- **25** — repertorio disponible: la tercera columna.
- **26** — esquema de contingencia; no se deduce del tipo ni se adivina.
- **27** — plan de monitorización con criterio de revisión (qué desmentiría la
  formulación).
- **28** — fuerza, dirección y tipo de relación; moderadora frente a mediadora.
  Incluye la exigencia de **nombrar los dos extremos** de cada relación, que es
  de lo que depende que la red funcional se pueda dibujar.
- **29** — modificabilidad: cuánto puede cambiar, no cuánto importa.

Los principios están numerados y varios se referencian entre sí por número
(«ver principio 24»). **Al añadir uno nuevo, añádelo al final** en vez de
insertarlo en medio: insertar obliga a renumerar y a revisar todas las
referencias cruzadas, incluidas las del esquema JSON y las de
`evals/razonamiento.test.mjs`.

---

## Qué queda pendiente

1. **La capa MC y la sección «Riesgo» siguen en el repo.** Las notas de trabajo
   las daban por retiradas —«solo existen dos lentes», «la sección Riesgo se
   retiró a propósito»—, pero en el código siguen existiendo: `ModeloTerapeutico`
   incluye `"mc"`, hay un bloque `mc` en `lib/bloques.ts`, una sección `riesgo` en
   `lib/secciones.ts` y el validador V5 (`riesgo_posible_no_detectado`) depende
   del campo `riesgo`. No se han tocado en esta tanda: retirar el campo `riesgo`
   dejaría a V5 sin nada contra lo que comparar, y esa comprobación es de
   seguridad clínica. Si la decisión sigue en pie, hay que decidir antes qué pasa
   con V5.

2. **La red funcional depende de que el enunciado nombre el otro extremo.** El
   principio 28 lo exige, pero un informe generado con un prompt anterior no lo
   cumple y el dibujo se omite con su explicación. Es la degradación prevista, no
   un fallo — pero conviene saberlo antes de concluir que «el diagrama no
   funciona».

3. **El emparejamiento por raíces de palabra es aproximado.** Lo usan tres sitios
   (`yaEnRepertorio`, `redFuncional`, `priorizacion`) y todos lo presentan como
   una pista para el clínico, nunca como un hecho del análisis. Si alguna vez se
   sustituye por algo mejor, hay que mantener esa presentación.

4. **`hipotesis-principal` («Formulación destacada») no tiene bloque en el
   informe exportado.** Es anterior a este trabajo: la sección se ve en pantalla
   pero no viaja al texto copiado ni al Word. Su contenido no se pierde —sale de
   `hipotesis_mantenimiento`, que sí viaja—, pero el destacado como tal no está.

5. **`evals/run.mjs` no está en la verificación de cada tarea.** Necesita un
   endpoint o un fixture, así que las comprobaciones por caso no corren con
   `node --test`. Las de `casos/01` y `casos/04` se actualizaron a la
   clasificación nueva (`biofisiolog`, `sociocultural`); el resto no se revisó
   campo por campo.

---

## Verificación

```
npx tsc --noEmit
npx eslint lib components app
node --test "evals/*.test.mjs"
```

Los tres quedan limpios. `eslint` mantiene un warning preexistente en
`PanelRecomendaciones.tsx` (`<img>` en vez de `next/image`).

`node --test` compila los módulos de `lib/` a `.tmp-evals/` desde dos ficheros de
prueba a la vez; si alguna vez falla una ejecución y la siguiente pasa sin tocar
nada, es esa carrera y no el código.

**No uses `next build` para validar**: puede fallar por el binario SWC según el
entorno, y no es señal de nada.
