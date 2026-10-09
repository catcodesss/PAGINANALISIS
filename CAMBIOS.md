# CAMBIOS

## Rediseño · fase 3: apoyo en las relaciones y procedencia por elemento (esquema v5, sin cambio de prompt)

Hecho: 3A (esquema y cálculo) y 3C (interfaz mínima). **3B no se ha hecho**: toca
el prompt, exige medir con la API y el encargo pide preguntar antes. Medir y
subir `VERSION_PROMPT` queda pendiente (ver al final).

- **Apoyo en las aristas** (`lib/apoyoAristas.ts`, determinista, lo calcula el
  servidor). `Arista` gana `apoyo: "textual" | "parcial" | "inferido"` y
  `evidencia: Cita[]`. Una relación vale lo que valga la frase que la afirma, y
  como mucho su extremo más débil:

  | Relación | Techo | Cita que lleva |
  |---|---|---|
  | Sale de una hipótesis de mantenimiento | parcial | ninguna |
  | …con confianza baja | inferido | ninguna |
  | conducta → consecuencia inmediata (cadena operante) | textual | la de la cadena |
  | Otra de una cadena (OM→ED, ED→conducta, → consecuencia demorada, eslabones DBT, EC) | parcial | la de la cadena |
  | Cualquier otra | inferido | ninguna |
  | La creó el clínico | inferido | ninguna; se ve como «tuya» |

  Una relación «inferido» no lista citas. La consecuencia **demorada** queda en
  parcial aunque el encargo solo decía «conducta → consecuencia»: es lo que
  menos suele decir la nota (el encargo fija un máximo, no un mínimo).
- **Nodos.** La OM y la función hipotetizada dejan de heredar la cita de la
  cadena: sin cita propia son inferidas (`lib/grafo.ts`). ED, EC, consecuencias
  y eslabones DBT siguen heredándola: son sucesos del episodio que la cita
  describe; la OM y la función son construcciones del análisis.
- **Agregados.** `apoyoCadena(nodos, aristas)` toma el mínimo de las piezas y
  de sus relaciones, **sin contar la OM ni la función** (si contaran, toda
  situación con OM saldría «inferencia»). Consecuencia visible: casi ninguna
  situación sale ya «cita textual», porque sus relaciones están techadas en
  parcial. `gradoDeHipotesis` lee de la arista; la red (`AristaRed.apoyo`) y
  cada bucle (`apoyoDeBucles`) toman el tramo más débil.
- **La palanca NO cambia, a propósito.** El encargo decía «quita el parche de la
  fase 1 si queda redundante». No lo queda: una hipótesis sin cita propia llega
  a «parcial» (dorado), y con eso bastaría para que el sueño volviera a ordenar
  el plan. `relacionInferida(h)` sigue gobernando la marca y el orden hasta que
  haya 3B. Es la decisión más prudente y la más fácil de revertir.
- **Procedencia por elemento.** `AnalisisFuncional.procedencia:
  Record<Id, {estado: "propuesta"|"confirmado"|"editado"|"creado", original?}>`
  (`lib/procedencia.ts`). Ausente = propuesta, como `estados_plan`. La escribe
  solo la interfaz; no entra en el esquema del modelo ni en `normalizarAnalisis`
  (una respuesta del modelo con `procedencia` se descarta; lo fija una prueba).
  Confirmar no es editar y no marca la sección como editada (`onDecidir` →
  `onEditarSeccion(null, …)`). Lo `editado` o `creado` no vuelve a otro estado.
  Editar se detecta por diff antes/después (`lib/procedenciaEdicion.ts`), no en
  cada editor; los «valores» quedan fuera porque su id es la posición.
- **Migración `migrarAV5`** (`migrarAV4` pasa a interna). Calcula el apoyo de
  las aristas y crea `procedencia`. Los elementos de las secciones ya editadas
  pasan a «editado» **una sola vez**, al venir de una versión anterior, y sin
  texto original: dentro de una sección no se sabe qué se tocó, y marcar de más
  es el lado honesto del invariante 6.
- **Interfaz.** Relaciones inferidas **punteadas** (trazo `0.1 6` con extremos
  redondos) en la red funcional, en la lente ACT y en DBT; en AFC no se dibujan
  líneas (decisión de la 1B), así que ahí se ven en «Relaciones del nodo» de la
  Ficha, con muestra de trazo, apoyo y procedencia. En la red, el trazo
  discontinuo sigue siendo bucle; el punteado, relación inferida. Procedencia
  con borde (discontinuo = propuesta de la IA) y marca (IA, ✓, ✎), nunca color.
  Botón «Confirmar» en la Ficha (AFC/ACT) y en el detalle DBT.
- **Exportación** (texto, impreso y Word, que se construye sobre el texto):
  `[Propuesta de la IA]`, `[Confirmado]`, `[Editado]` o `[Del profesional]`
  junto a conductas, repertorio, variables, reglas, nodos de la cadena
  (OM, antecedente, consecuencias, eslabones, estímulo, función), hipótesis y
  alternativas; y «Apoyo de la relación» en cada hipótesis.
- **Pruebas** (`evals/migracion.test.mjs`, 42 → 53): v3→v5 sin pérdida e
  idempotente; la OM del caso 01 no es textual; sueño → evitar exponer y su
  bucle no son textuales; ninguna relación supera a sus extremos; solo
  conducta→consecuencia inmediata es textual; relación del clínico inferida y
  «creado»; sección editada → editado una vez; editado/confirmado/creado salen
  distintos en el exportado; la procedencia no entra desde el modelo.
- **Sin medir con la API** (no hay crédito): el prompt no cambia, así que no hay
  nada que medir de la fase.

Pendiente de esta fase: **3B** (cita propia por hipótesis, prompt; pedir permiso,
correr evals antes y después y contar cuántas hipótesis traen cita y cuántas
resuelven) y, cuando exista, retirar el parche de `relacionInferida`.

## Rediseño · fase 1B: verificar en la misma pantalla

- **Ficha y nota en panel lateral** (AFC y ACT; DBT ya lo tenía): desde
  1280 px, columna fija con scroll propio (20rem, 24rem desde 1536 px); por
  debajo, un cajón que sube desde abajo, con un botón «Ficha y nota» para
  abrirlo. Seleccionar un nodo o pulsar su cita resalta la línea en la nota del
  panel, sin mover la página. A 1280 px el tablero AFC hace scroll horizontal
  dentro de su columna.
- **Relaciones del nodo sin ids**: «Lleva a · secuencia: Consecuencia
  necesaria: …», nunca `alt_1 → alt_1_consecuencia`.
- **Huérfanas con blanco sugerido** (`identidad.ts#sugerirConducta`, misma
  regla de dos raíces): «¿Asignar a Blanco N?» con Asignar, Elegir otro y Dejar
  sin blanco. Nunca se asigna sola; asignar escribe `conducta_id` sin marcar la
  sección como editada, como `estados_plan`. «Dejar sin blanco» dura la sesión:
  recordarlo pediría un campo nuevo.

## Rediseño · fase 1A: seguridad clínica (esquema v4, sin cambio de prompt)

- **Relación inferida.** Ninguna relación entre extremos tiene cita propia, así
  que toda hipótesis cuenta como relación inferida hasta la fase 3
  (`gradoApoyo.ts#relacionInferida`). La palanca de un blanco se enseña como
  «Por dónde moverla (relación inferida)», con marca gris, y no puntúa: el
  ranking queda en el orden del análisis. Modificabilidad dice «estimada desde
  una relación inferida». Los bucles y la formulación derivada lo dicen.
- **Prosa derivada sin comillas** en etiquetas del modelo; un extremo vacío
  sale como «[origen no trazado]», nunca «».
- **Alertas en el nodo** (AFC, ACT, DBT y Ficha), resueltas por `ruta`
  (`lib/alertasNodo.ts`). ▲ rellena para alta, ◆ contorno para media.
- **Vacíos en dos estados** (`lib/vacios.ts`): «no se generó» y «la IA no
  encontró nada». Para distinguirlos, `campos_ausentes` (esquema v4,
  `migrarAV4`; los informes guardados reciben `[]`). Riesgo no evaluado: «El
  análisis no evaluó el riesgo. No significa que no lo haya.»
- **El eslabón «acción»** no es evento privado (`grafo.ts#esEventoPrivado`): no
  va a «Malestar interior» ni se rotula encubierto.
- Queda: la tarjeta de hipótesis sigue mostrando `gradoDeHipotesis` (dato
  parcial) junto a «relación inferida»; se resuelve con el apoyo en aristas.

## Unificar AFC, ACT y MC (esquema v3, prompt 1.8.0)

Hay un solo análisis funcional y es la fuente de verdad. ACT es una capa de
anotaciones sobre ese grafo, más la vista Matrix; MC no era una lente propia,
sino el AFC dibujado en tres columnas. DBT no cambia.

### Fase 1 · MC se funde en el Plan

- **Esquema v3**: fuera `capa_mc`, `CapaModalidadMC` y `ProcedimientoSugeridoMC`.
  `LineaIntervencion` gana `contingencia_objetivo` y `precauciones` (las dos
  `string | null`): era lo único que la capa MC añadía. En la maqueta salían
  dos listas de intervención para el mismo caso, con el mismo vocabulario
  operante.
- **Migración** (`migrarAV3`, en `lib/identidad.ts` junto a `migrarAV2`, que
  deja de exportarse): cada procedimiento pasa a ser una línea de intervención
  con `intervencion = procedimiento` y sus dos campos. **Sin blanco**, como
  toda intervención antigua (`lib/formaPlan.ts`): el procedimiento no nombraba
  conducta y deducirla de sus palabras es el emparejamiento por prosa que la
  v2 retiró. Salen en «Intervenciones sin blanco». No se descartan aunque se
  parezcan a una línea existente: un falso duplicado visible es mejor que un
  dato perdido. `normalizarAnalisis` pasa la `capa_mc` cruda a la migración,
  porque construir la salida clave por clave la perdería.
- **Interfaz**: fuera `estilos/mc.tsx`, `"mc"` de `EstiloGrafo` y el bloque
  `mc`. Una lente `"mc"` guardada cae a AFC (`useLente`, comprobado en el
  navegador). La tarjeta de cada intervención enseña contingencia objetivo y
  precauciones, editables.
- **Prompt 1.8.0**: fuera `BLOQUE_MC` y la clave `capa_mc`; «dos capas» (ACT y
  DBT); las líneas de intervención piden `contingencia_objetivo` y
  `precauciones` con la prohibición del principio 14 y el principio 15, y la
  nota que las llamaba «campo neutral» dice ahora que los procedimientos
  conductuales viven ahí.
- **Exportación**: fuera «CAPA CONDUCTUAL — PROCEDIMIENTOS SUGERIDOS»; los dos
  campos salen dentro de cada intervención del Plan.
- **V3** sigue revisando los procedimientos migrados, porque ahora son
  `intervencion`. No revisa `contingencia_objetivo` ni `precauciones`, por la
  misma razón que no revisa el `porque`: nombran lo que se quiere modificar, a
  menudo el propio mantenedor. V5 y `riesgo` no dependían de `capa_mc`.

**Medida** (0,2, 1 rep, 9 casos, 26/09/2026):

| Prompt | Comprobaciones | Citas | Procesos ACT (sin justificación funcional) |
|---|---|---|---|
| 1.7.0 (antes) | 42/47 | 58/58 (100%) | 7 (7) |
| 1.8.0, fase 1 | 41/47 | 56/56 (100%) | 6 (6) |

La única diferencia es `riesgo-detecta-ideacion` (caso 09), y no es de este
cambio: con `--reps=3` el 1.7.0 da `indicadores: []` en las tres, igual que el
1.8.0. Es un fallo intermitente previo (1 de 4 ejecuciones pasa con el 1.7.0).
V5 salta en todos esos casos. Queda anotado aparte: es grave y no es de este
encargo. Intervenciones en los 9 informes: 13 antes y 11 después; 8 declaran
contingencia objetivo y 7, precauciones.

### Fase 2 · Las reglas verbales suben al núcleo (prompt 1.9.0)

- **Esquema**: `capa_act.reglas_verbales` pasa a `AnalisisFuncional.reglas_verbales`;
  `ReglaVerbal` no cambia. `capa_act` queda con `procesos_act`.
- **Migración**: `migrarAV3` las sube con su id (`rvb_N`), de modo que las
  aristas que apuntaban a ellas siguen valiendo. El normalizador acepta reglas
  arriba y dentro de `capa_act`, y concatena las dos listas.
- **Código**: grafo (construir, editar, borrar, alta de nodos), identidad,
  ruta de alertas, campos de reanálisis del bloque 2 y bloques `situaciones` y
  `act` (la vista Matrix las enseña). En DBT, una línea de `dbt.tsx` cambia de
  ruta (`analisis.reglas_verbales`) con el mismo comportamiento; lo pidió la
  compilación y se aprobó antes de tocarla.
- **Exportación**: la sección «REGLAS VERBALES» sale con el análisis por
  situaciones, no en la capa ACT. Y **sin comillas**: antes cada regla iba
  entrecomillada aunque fuera `inferida`, y ninguna regla lleva cita
  (invariante 2).
- **Prompt**: la instrucción de conducta gobernada por reglas sale de
  `BLOQUE_ACT` y pasa al núcleo como principio 30, con el mismo texto.
- **Orden en el JSON**: `reglas_verbales` va **detrás de `situaciones`**, no
  junto a `variables_moduladoras`. Su campo `analisis` dice qué cadena altera la
  regla, y delante de las situaciones analizaba cadenas aún no escritas. Con
  esa colocación, el caso 08 con `--reps=3` perdió 2 citas en 4 ejecuciones
  (la 1.8.0, ninguna); detrás volvió a 18/18. Son pocas muestras para
  atribuírselo, pero el razonamiento se sostiene solo.

**Medida** (0,2, 1 rep, 9 casos):

| Prompt | Comprobaciones | Citas | Reglas verbales generadas |
|---|---|---|---|
| 1.7.0 | 42/47 | 58/58 | 7 |
| 1.8.0 | 41/47 | 56/56 | 5 |
| 1.9.0, reglas antes de situaciones | 42/47 | 58/59 (98%) | 3 |
| 1.9.0, reglas tras situaciones (la que queda) | 40/47 | 57/57 (100%) | 2 |

Los fallos nuevos de la última corrida (`explora-refuerzo-positivo` en el 01,
`riesgo-detecta-escalada-consumo` en el 09) pasaron en corridas anteriores
del mismo prompt o son el fallo de riesgo previo de la fase 1.
`ciclo-mutuo-no-solo-culpa-a-uno` (08) sale 2/3 en las dos colocaciones, y una
de las que falla describe un ciclo mutuo auténtico con otras palabras: la
comprobación exige «refuerza la evitación/retirada».

**Vigilar: la cobertura de reglas baja** (7 y 5 frente a 3 y 2). El caso 08
no emite ninguna en ninguna versión, así que no explica lo de arriba, pero la
tendencia encaja con el cambio: antes las reglas eran una de dos tareas de un
bloque ACT corto; ahora, el principio 30 de 30. Con una repetición no está
probado. El encargo pedía moverla sin cambiar su contenido, así que no se ha
compensado.

Con `--reps=3` (27 informes por versión) la caída se confirma:

| Prompt | Comprobaciones | Citas | Reglas | Informes con alguna regla |
|---|---|---|---|---|
| 1.8.0 | 123/141 | 171/171 (100%) | 14 | 14 de 27 |
| 1.9.0 | 119/141 | 174/175 (99%) | 7 | 7 de 27 |

**Prompt 1.10.0**: el principio 30 no cambia; la autoverificación del
principio 12 gana la pregunta «¿La nota contiene reglas ("debo", "tengo que",
"si hago X pasará Y", "no puedo") que controlan alguna conducta y NO registré
ninguna en "reglas_verbales"?», el mismo patrón que ya funciona con las
conductas encubiertas. **SIN MEDIR**: la cuenta de OpenAI se quedó sin crédito
(`429 You have no credits remaining`) al lanzar la corrida. Pendiente:
`--reps=3` contra la 1.9.0 de arriba.

### Fase 3 · Los procesos ACT pasan a ser anotaciones funcionales (prompt 1.11.0)

- **Esquema**: `ProcesoACT` = `proceso` (enum `fusion | evitacion_experiencial |
  presente | yo_conceptualizado | valores | accion`), `elemento_objetivo` (texto
  del modelo), `nodo_id` (lo resuelve el servidor), `justificacion_funcional` y
  `evidencia`. Fuera `situacion_id`, `eslabon_id` y `vinculo_con_cadena`: un
  proceso se engancha a un elemento, no a una situación entera. `capa_act`
  queda solo con `procesos_act`. Etiquetas y conversión en `lib/procesosACT.ts`.
- **Anclaje** (`resolverNodosDeProcesos`, en `lib/identidad.ts`): mejor
  coincidencia contra los nodos del grafo, menos los valores (su id es su
  posición). **Un `elemento_objetivo` que solo nombra una situación queda sin
  anclar**, aunque algún nodo de esa situación se le parezca: es lo que pasa
  con los dos procesos de la maqueta («Reuniones de equipo», «Interacciones con
  clientes»), que antes se pintaban en todos los nodos de su situación. Borrar
  un nodo deja su proceso sin anclar, no lo borra.
- **Migración**: el texto libre pasa al enum por palabras clave. Lo que no casa
  se conserva en `justificacion_funcional`, recibe `fusion` y
  `revisar_proceso: true`. El valor por defecto no es «evitación experiencial»
  a propósito: la vista Matrix clasifica con ella, y caer ahí por defecto
  afirmaría una función. `vinculo_con_cadena` → `elemento_objetivo`;
  `eslabon_id` → `nodo_id`.
- **Prompt** (`BLOQUE_ACT`): función, no topografía; el ejemplo de las dos
  personas que piensan «voy a quedarme en blanco»; `justificacion_funcional`
  dice qué controla el evento y qué dato lo sostiene, o que falta el contraste;
  redacción de hipótesis.
- **Interfaz**: en la vista AFC, etiqueta pequeña sobre su nodo con «posible»,
  el proceso y el grado de apoyo (cita / parcial / inferencia), y aviso si no
  hay justificación o hay que revisarlo. Los que no anclan se listan aparte,
  «Procesos ACT sin anclar». No se crean nodos. La vista ACT ya lee solo
  `nodo_id` (era imprescindible al cambiar el tipo; el resto de la vista es la
  fase 4).
- **Exportación**: cada proceso sale como «Posible patrón de …», con su
  elemento (o «sin anclar»), su justificación (o «no declarada») y su cita.

**Evals: PENDIENTES** (sin crédito). Comparar con `--reps=3` contra la 1.10.0,
y contar procesos ACT sin justificación funcional. Referencia de hoy: 7 de 7
(1.7.0) y 6 de 6 (1.8.0), todos sin ella porque el campo no existía.

### Fase 4 · La vista ACT (Matrix) clasifica por función

Qué va en cada cuadrante lo decide `lib/matrixACT.ts#clasificarMatrix`, una
función pura con pruebas; `estilos/act.tsx` solo pinta.

- **Malestar interior**: solo eventos privados (eslabones encubiertos y EC).
  Fuera la OM, que altera el valor de un reforzador y no es malestar.
- **Procesos**: solo por `nodo_id`, con la misma etiqueta que en AFC
  («posible», grado de apoyo). Nada de coincidir por situación. Los que no
  anclan, en «Procesos ACT sin anclar».
- **Alejamiento**: solo conductas con base funcional, es decir, una situación
  suya mantenida por refuerzo negativo o una anotación de evitación
  experiencial **con justificación funcional y sin marca de revisar**. Una
  anotación vacía o migrada de la v2 se enseña pero no clasifica. El resto de
  conductas problema van a «Conductas sin función de alejamiento
  establecida», no a un cuadrante por su tipo. Cada conducta sale una vez
  aunque esté en dos situaciones.
- **Reglas verbales**: la franja se queda, leyendo `analisis.reglas_verbales`.
- **Textos**: el selector de lente decía «las cuatro vistas», y la cabecera
  impresa, Configuración y la guía prometían una capa «conductual». Ahora
  dicen tres vistas y capas ACT y DBT.

Lo fija `evals/maqueta.test.mjs` (4 pruebas nuevas). Sin cambios en el prompt.

## Plan por blanco (fase A: solo interfaz, sin tocar el prompt)

El Plan eran tres listas por tipo de contenido —conductas alternativas, líneas
de intervención, monitorización— y el terapeuta tenía que reconstruir de cabeza
qué iba con qué. Ahora es **una tarjeta por conducta problema**, con la misma
secuencia siempre: blanco → por qué se prioriza → función hipotetizada (con su
grado de apoyo) → conducta alternativa → avisos.

- **Las conexiones salen de ids, no de prosa** (`lib/plan.ts`):
  `priorizacion.conducta_id`, `hipotesis.destino_id` y `alternativa.situacion_id
  → situacion.conductas_ids`. Cada alternativa va a UNA tarjeta (la primera
  conducta de su situación que no sea de seguridad); lo que no enlaza por id
  queda en «sin blanco asignado» y se dice. Una conducta de seguridad no recibe
  alternativa: es blanco de eliminación.
- **Los avisos del validador van dentro de la tarjeta**, junto a la propuesta
  que señalan (por su `ruta`), como «⚠ Requiere revisión». Siguen también en
  Revisión, que es la lista completa. Un blanco con avisos arranca en estado
  «Revisar», no «Propuesto por IA».
- **Dependencia de un dato faltante → condicional.** Si V4 señala una
  alternativa, lo primero que se lee es «Información insuficiente para darla
  por propuesta. Primero explorar: X», y debajo la propuesta rotulada como
  condicional. No se oculta: V4 empareja por palabras y ocultar contenido
  sería decidir por el clínico.
- **Estados por blanco**: Propuesto por IA / Revisar / Aprobado / En curso /
  Descartado, en `AnalisisFuncional.estados_plan` (por id de conducta). Es una
  decisión sobre la propuesta, no texto escrito: cambiarlo pasa `null` como
  `seccionId` y **no** marca la sección como editada (invariante 6). El modelo
  nunca lo envía; `migrarAV2` lo añade vacío a los informes guardados.
- **Menú «⋯»**: «Reportar fallo» y «Agregar nota y reanalizar» salen del pie de
  cada apartado a un menú en su encabezado (también en Riesgo y Verificación);
  «Borrar» de cada propuesta del plan, también.
- **El texto copiado y el Word** siguen la misma estructura por blanco, con el
  estado y los avisos junto a cada propuesta.

Lo fija `evals/plan.test.mjs` (13 pruebas, en CI): ninguna conducta sin tarjeta,
ninguna alternativa perdida ni repetida, el aviso de la respiración en su
tarjeta, todo aviso sobre el plan en el exportado, y los estados.

## Plan por blanco, fase B — intervención y monitorización en la tarjeta (prompt 1.7.0)

Cierra lo que la fase A dejó fuera de las tarjetas. Se mantienen los nombres de
campo (anclas, bloques y rutas de alertas no cambian) y cambia su forma:

- `lineas_de_intervencion_tentativas: LineaIntervencion[]` con `conducta`
  (resuelta a `conducta_id` en `lib/identidad.ts`, como la priorización),
  `intervencion`, `porque` y `depende_de`. El porqué es la razón visible:
  «se propone X porque la conducta parece mantenerse por Y».
- **Sin base, sin plan.** Si la función de un blanco no está sostenida, el
  modelo emite `intervencion: ""` con `depende_de`, y la tarjeta dice
  «Información insuficiente para proponer intervención. Primero explorar: X».
  Un `depende_de` declarado se suma a lo que detecta V4: el validador sigue
  existiendo porque no se puede depender de que el modelo lo declare.
- `plan_de_monitorizacion: PlanDeMonitorizacion[]`, uno por blanco, con su
  criterio de revisión.
- **Precisión.** El ejemplo del principio 27 ya no dice «tras seis ensayos»; una
  nota pide no fijar cifras que la nota no sostenga. Esa nota y las reglas del
  plan por blanco solo se envían cuando se piden estos campos.
- **Lo común al caso** (coordinación médica) va con `conducta: ""` y sale en
  «Intervenciones sin blanco». En la primera medida desapareció en el caso 04
  —organizar por blanco hizo que el modelo la omitiera—; se añadió una regla
  explícita y volvió (10/10 en dos repeticiones).
- **Informes guardados**: `lib/formaPlan.ts` lleva las cadenas y el objeto único
  a la forma nueva, sin blanco. No se adivina a qué conducta iba una
  intervención antigua. Se aplica en el normalizador y en `migrarAV2`.
- **V3 mira solo `intervencion`**, no el `porque`: el porqué nombra a menudo el
  mantenedor para retirarlo, y avisaría justo en la propuesta correcta.
- Las comprobaciones de evals que miraban `lineas_de_intervencion` se acotaron
  al texto de la intervención con una regex que casa igual la forma vieja y la
  nueva; así la referencia sigue siendo comparable.

### Medida (temperatura 0.2, 1 repetición, 9 casos)

| Prompt | Comprobaciones | Citas |
|---|---|---|
| 1.6.0 (antes) | 42/47 | 56/57 |
| 1.7.0 (después) | 39/47 | 58/58 (100%) |

La red dio varios `Connection error` con OpenAI; esos casos se repitieron sueltos
y se sumaron. Las tres diferencias no son del plan:

- `explora-refuerzo-positivo` (01): pasa 3/3 con `--reps=3`. Varianza.
- `no-escape-escolar` (03): falla también con el 1.6.0 (2/2). Previo; misma
  familia que `no-inventa-evitacion`: forzar refuerzo negativo sin evidencia.
- `no-inventa-evitacion` (02) y `cita-mueble` (05): intermitentes conocidos.

Las comprobaciones del plan (`respiracion-no-como-intervencion`,
`intervencion-por-adquisicion`, `no-exposicion`, `intervencion-sobre-el-entorno`,
`derivacion-medica`) quedan igual o mejor. `respiracion-no-como-intervencion`
sigue fallando como antes (en la capa DBT; V3 lo avisa).

### Pendiente

- En el caso 04 la coordinación médica salió con `depende_de` del mismo dato que
  sirve para obtener: la tarjeta la muestra como condicional, lo que es raro.
  Pedir que `depende_de` no se use en la acción que obtiene el dato es un cambio
  de prompt: medir antes y después.
- Las cifras arbitrarias no las vigila ningún validador; solo lo pide el prompt.

## Fase 4 — la prosa se deriva del grafo

`lib/formatearInforme.ts#derivarVistasProsa` genera las hipótesis de
mantenimiento y el destacado desde nodos y aristas. La regla que no se rompe:
**la prosa solo afirma lo TRAZADO**. Sin arista de por medio el texto escribe
`[Ed no trazado hasta la conducta]` en vez de afirmarlo, y la cascada funciona
—si el Ed no llega, la OM que pasaba por él tampoco—. Lo fija
`evals/migracion.test.mjs`.

El modelo deja de emitir `enunciado` y pasa a emitir `origen`, el otro extremo
de la relación (`VERSION_PROMPT` 1.6.0). Editar a mano sigue mandando sobre lo
derivado: invariante 6.

### El resumen clínico NO se deriva, y es deliberado

Llegó a derivarse y el resultado era un inventario —«El grafo funcional contiene
3 situación(es), 4 conducta(s) problema y 25 relación(es) trazada(s)»— justo
donde antes decía de quién es el caso y por qué consulta. El grafo no contiene
demografía, motivo ni historia: derivar el resumen de ahí no lo reescribe, **lo
pierde**. Se retiró esa derivación y hay una prueba que vigila que no vuelva.

La regla del refactor es borrar representaciones duplicadas, no funcionalidad.
El resumen no duplicaba nada.

### Un solo ranking, y es de conductas

Había dos, uno debajo del otro y con nombres casi iguales: «Priorización de
blancos de intervención» (conductas, prosa del modelo) y «Rendimiento esperado
de cada blanco» (variables moduladoras, `fuerza × modificabilidad`). Dos
unidades de análisis distintas presentadas como lo mismo.

`lib/priorizacion.ts` ordena ahora **conductas** por `importancia ×
modificabilidad de su palanca`. La variable moduladora no es un blanco: es la
palanca por la que una conducta se mueve, y sale colgando de ella. Una conducta
sin palanca trazada **no recibe un cero** —se leería como «esto no sirve»— sino
que se dice que no consta por dónde moverla, y va al final.

### Menos repeticiones del mismo dato

«Evitar exponer» pasó de 13 apariciones en el DOM a 9. Lo que se quitó eran
copias, no contenido: el rótulo de la conducta encima de un enunciado que ya la
nombra (en el destacado y en cada tarjeta de hipótesis), la priorización
repetida dentro del destacado, y el `<title>` de cada arista de la red, que
llevaba el enunciado entero pegado —tres líneas de nombre accesible por trazo,
cuando lo que el dibujo aporta es saber qué une cada flecha—.

### ReportView troceado de verdad

De **3.533 a 1.700 líneas**. Antes había cinco ficheros de bloque de *una línea*
que solo delegaban en `BloqueBase`: el contenido seguía entero en ReportView.

- `components/informe/seccion.tsx` — el andamiaje compartido: `Seccion`,
  `ReportarFallo`, `BloqueReanalisis`, `ListaAlertas`, el contexto de reanálisis
  y la visibilidad de anclas y bloques. **Vive fuera de ReportView porque si no
  hay ciclo de importación**: los cinco bloques necesitan `Seccion` y ReportView
  necesita los cinco. Ese ciclo es la razón de que el troceado se hubiera
  quedado a medias.
- `components/informe/Bloque{Sintesis,AnalisisFuncional,Mantenimiento,Plan,Pendientes}.tsx`
  — un fichero por bloque, con su contenido dentro.
- `components/informe/mantenimiento.tsx` — lo que solo usa el bloque 3
  (`RedFuncionalSVG`, `PriorizacionEstimada`, `SelloNoModificable`). Lo que usa
  un solo bloque va con su bloque; `primitivas.tsx` guarda lo que comparten
  todos.

`evals/coherencia.test.mjs` se adaptó y quedó **más estricta**: ya no basta con
que un ancla exista en algún sitio, tiene que estar en el fichero del bloque que
`ANCLAS_INFORME` declara. La comprobación de tamaños de texto pasó a leer
también `components/informe/`, porque mirando solo ReportView habría seguido en
verde sin vigilar casi nada.

## Fase 3 — un grafo, cuatro lecturas

El bloque funcional conserva una sola colección de entidades y relaciones,
pero ahora puede ordenarla como AFC, cadena DBT, matriz ACT o lectura
conductual MC. El cambio de estilo no llama al servidor ni crea copias de los
datos. El contador superior sale siempre de `construirNodosGrafo` y la edición
de etiquetas se refleja al instante al volver a cualquier otra vista.

AFC sigue siendo la vista inicial y la única que permite añadir, borrar o
conectar estructura. DBT, ACT y MC se habilitan cuando existe al menos una
conducta tocada por una relación; antes muestran un tooltip explicativo. La
preferencia se guarda por referencia local del caso. Pantalla puede usar las
cuatro lecturas, mientras impresión y exportación conservan AFC como base.

DBT muestra una conducta problema cada vez y alinea prevención, habilidades,
alternativa, consecuencia necesaria y reparación con las fases de la cadena.
ACT agrega todas las situaciones en una matriz 2×2 y deja que el trazador común
muestre solo las relaciones cuyos extremos están presentes. MC se conserva
como cuarta lectura de antecedentes, conductas y consecuencias, con sus
procedimientos sugeridos, sin convertirse en otro almacén clínico.

Las pruebas de coherencia fijan que las lecturas reciben la misma colección,
que no contienen `fetch` y que la preferencia queda separada por caso.

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
