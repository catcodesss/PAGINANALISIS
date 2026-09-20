# Relevo — ACIA, refactor del informe

Eres la siguiente IA de código en este trabajo. **Las fases 0 y 1 están hechas y
commiteadas.** Te tocan las fases 2, 3 y 4. Lee esto entero antes de tocar nada.

Repo: `Desktop/ACIA` (Next.js 16, React 19, TypeScript, Tailwind v4).
Rama `main`, dos commits por delante de `origin/main`:

```
2724833 De diecisiete secciones a cinco bloques          ← fase 1
374487f Dar identidad estable a las entidades (v2)       ← fase 0
b2f3fc2 (origin/main)
```

Lee primero `CLAUDE.md` (está en `Desktop/`, no en el repo), `CAMBIOS.md` y
`PLAN.md`. Del `PLAN.md`, las secciones A y B ya son historia; las secciones C
(orden de commits), D (propuestas) y E (decisiones abiertas) siguen vigentes.

---

## Lo que ya está hecho — no lo repitas ni lo deshagas

### Fase 0 · Identidad estable (`374487f`)

El diagnóstico era: todo se referenciaba por prosa, y tres módulos
—`redFuncional`, `priorizacion` y `yaEnRepertorio`— emparejaban por raíces de
palabra **en cada render**. Cuando fallaban, la red funcional descartaba la
relación **en silencio**.

- **`lib/identidad.ts` (nuevo, 415 líneas).** Asigna ids y resuelve referencias.
  La heurística de prosa **no desapareció: se movió aquí y corre UNA vez**, al
  normalizar. Lo que no resuelve queda en `null` y se cuenta.
- Ids: `cnd_1`, `rep_1`, `vmd_1`, `sit_1`, `esl_1_3`, `alt_1`, `rvb_1`, `pac_1`,
  `hip_1`, `acm_1`, `sol_1`, `cns_1_inm`, `cns_1_dem`. **Los genera el servidor,
  nunca el modelo.** No se los pidas al modelo ni los menciones en el prompt.
- Referencias nuevas (el texto original **se conserva** para mostrar):
  `Situacion.conductas_ids`, `HipotesisMantenimiento.destino_id` + `origen_id`,
  `PriorizacionBlanco.conducta_id`, `ConductaAlternativa.situacion_id`,
  `HabilidadSugeridaDBT.eslabon_id`, `SolucionDBT.eslabon_id`,
  `ProcesoACT.situacion_id` + `eslabon_id`.
- `CadenaOperante.consecuencia` y `.consecuencias_largo_plazo` pasaron de
  `string` a `Consecuencia { id, texto }`. **El modelo sigue emitiendo string**
  y el parser envuelve — la misma asimetría que ya existía con `evidencia`.
- `AnalisisFuncional` tiene `version: 2` y `siguiente_id: number`.
- **`capa_dbt.analisis_en_cadena` eliminado.** Era una copia literal de la
  `cadena_dbt` de una situación. Usa `situacionDeLaCadenaDBT(analisis)`.
- `migrarAV2` es idempotente y solo añade. Corre al normalizar
  (`parseAnalisis`), al leer del historial (`repositorio.obtener`) y en la
  maqueta. `VERSION_PROMPT` 1.4.0 → **1.5.0**.

### Fase 1 · Cinco bloques (`2724833`)

- `lib/secciones.ts`: `SECCIONES_INFORME` son **5 bloques** (`sintesis`,
  `que-pasa`, `mantenimiento`, `plan`, `pendientes`) y `ANCLAS_INFORME` son las
  **17 anclas** de antes, cada una con su bloque. Tipos `IdSeccion` (bloque) e
  `IdAncla`.
- En `ReportView`: `<Bloque id>` es la unidad que se arrastra, se oculta y sale
  en el índice. `<Seccion id>` es un apartado y solo aporta ancla. **No le pases
  `titulo` a `<Bloque>`**: lo lee de `TITULO_DE_SECCION`, y hay una prueba que
  lo vigila.
- Dos fallos silenciosos corregidos en el camino; no los reintroduzcas:
  1. `formatearInforme` indexa su texto por ancla y recibía el orden en bloques,
     así que el bucle no encontraba ni una clave y todo caía en el repesque
     final: el documento salía completo pero en orden de inserción, ignorando el
     que eligió el clínico. Ahora recorre bloque → anclas y escribe el
     encabezado de cada bloque, que en un `.docx` no lo da la caja.
  2. `reconciliarOrden` ordenaba por grupo al final. Con el bloque siendo el
     grupo, eso devolvía siempre el orden de fábrica: el arrastre funcionaba en
     pantalla y no tenía ningún efecto al recargar. Ese paso se retiró y una
     prueba vigila que no vuelva.

### Verificación actual — toda en verde

```bash
npx tsc --noEmit
node --experimental-strip-types evals/citas.test.mjs        # 10
node --experimental-strip-types evals/pii.test.mjs          # 11
node --experimental-strip-types evals/razonamiento.test.mjs # 10
node evals/validadores.test.mjs                             # 46
node evals/reporteFallo.test.mjs                            #  7
node evals/coherencia.test.mjs                              # 18
node evals/maqueta.test.mjs                                 #  7
node evals/migracion.test.mjs                               # 14  ← ampliada, fase 2
npx eslint components lib app
```

`eslint` da 0 errores y 1 warning preexistente en `PanelRecomendaciones.tsx`.
Esta lista y `.github/workflows/evals.yml` **tienen que decir lo mismo**: al
añadir una suite, dala de alta en los dos sitios en el mismo commit.

---

## Lo que te toca

**Un commit por fase, en orden, sin paralelizar.** El prototipo visual está en
`Desktop/AFC MODELO (PARA PAGINANALISIS)/Claude outputs/acia-bloque2-prototipo.html`:
es la especificación de layout, interacción y notación, ya verificada en
navegador. **No lo copies**: es vanilla JS y aquí hay React + Tailwind.

### Fase 2 · El bloque 2 como grafo editable (AFC)

Sustituye el contenido del bloque `que-pasa` por un grafo. No negociable:

1. **SIN LIENZO.** Nada de pan, zoom, coordenadas ni arrastre libre. Autolayout
   determinista: la posición sale de (carril, situación, orden). La IA no puede
   devolver posiciones, y un caso generado con 50 nodos en x:0,y:0 es una
   mancha. CSS grid para los carriles; las flechas son un SVG superpuesto
   calculado con `getBoundingClientRect` **después** del layout, y recalculado
   en resize y scroll.
2. **Seis carriles:** Contexto/OM · Antecedente (Ed·EΔ·EC·regla) · Encadenamiento
   encubierto · Conducta · Consec. inmediata · Consec. demorada. Una banda por
   situación, y debajo la **fila alternativa** (conducta alternativa +
   consecuencia que la mantendría): es lo que convierte la formulación en plan
   sin una sección aparte, y deja ver que la alternativa compite por la misma
   contingencia. La función hipotetizada es un chip en el pie de la banda,
   alineado con el carril de consecuencia inmediata.
3. **Franja de apoyo** en el borde superior de cada nodo. **La longitud lleva el
   dato** (completa / dos tercios / un tercio) y el color solo refuerza: el
   color ya está tomado por el tipo de nodo, una rampa secuencial lee como
   «más/menos» y no como «bien/mal» (una inferencia clínica no es un error), y
   la longitud sobrevive a la impresión en gris y al daltonismo.

   El apoyo **se deriva, no se declara**:
   - con `Cita` verificada y confianza alta/media → completa
   - con `Cita` y confianza baja, o sin cita pero con evidencia declarada → dos tercios
   - inferencia sin cita → un tercio

   Y la regla se vuelve mecánica: **una franja no puede estar completa sin
   cita.** Reutiliza `lib/citas.ts` y `lib/nivelesConfianza.ts`; **no inventes
   una tercera escala.** Clic en la franja → salta a la línea citada de la nota
   en bruto, resaltada. Es la interacción que más valor da en un informe
   generado por IA y hoy no existe.
4. **La cadena hereda el eslabón más débil, no el promedio** (`Math.min` sobre
   los nodos de la cadena). Hoy el informe rotula «Reuniones de equipo ·
   confianza: alta» conteniendo tres inferencias. Es un fallo clínico, no
   estético.
5. **Edición completa**: añadir, borrar, trazar relaciones, reescribir etiquetas
   (doble clic, in situ) y campos (ficha lateral). Al editar un nodo generado
   por IA, su origen pasa de `ia` a `editado` y el id de sección entra en
   `secciones_editadas` (invariante 6). Conexión con **modo «Conectar» + clic en
   origen y clic en destino**; nada de puertos de arrastre, que quedan por
   debajo del mínimo táctil y no son descubribles. Deshacer/rehacer por
   instantáneas JSON, `commit()` al cierre de cada acción atómica, **nunca en
   pointermove**.
6. Nodos alcanzables por teclado: `tabindex`, `role` y `aria-label`. Hoy son
   `div` con `title`.
7. **Huecos visibles.** En un grafo, lo que falta es invisible, y el informe eso
   lo hacía bien. Los avisos de `lib/validadores.ts` generan **nodos fantasma**
   (borde discontinuo, «¿consecuencia?») donde hay hueco estructural. Sin esto
   se pierde la honestidad epistémica, que es lo mejor que tiene el informe.
8. **Móvil:** por debajo de 768 px la cadena se apila en vertical y las flechas
   se ocultan; al imprimir, degrada a la tabla ED/OM/RO/C/CMLP que ya existe. Un
   SVG con coordenadas no imprime ni cabe a 375 px.

**Las aristas son un campo nuevo y van aquí, no en la fase 0** (que ya pasó):

```ts
export type TipoArista = "secuencial" | "moderadora" | "bucle";
export interface Arista { id: string; desde: string; hasta: string; tipo: TipoArista; }
// AnalisisFuncional.aristas: Arista[]
```

El modelo **no** las emite: las materializa el servidor desde la cadena ya
implícita (`moduladora → om → ed → eslabones por orden → conducta →
consecuencia inmediata`, `conducta → consecuencia demorada`, `consecuencia
inmediata → función`, `alternativa → consecuencia necesaria`), más una por cada
`HipotesisMantenimiento` con sus dos `*_id` resueltos. A partir de ahí el
clínico añade y borra flechas, y lo que queda guardado son sus relaciones, no
las derivadas — por eso tienen que existir como campo y no recalcularse en cada
render.

**No confundas `TipoArista` con `TipoRelacion`** (`causal | moderadora |
mediadora`, ya en `lib/types.ts`): el primero es la estructura del grafo, el
segundo la lectura clínica de una hipótesis. Una arista `secuencial` puede
llevar una relación `mediadora`. El nombre invita a fundirlos; no lo hagas.

**Cada nodo del grafo es la proyección de una entidad que ya existe.** Añadir un
nodo es añadir un elemento a la lista que le corresponde; no hay un almacén de
nodos paralelo al análisis. El mapa completo está en la sección A.6 de
`PLAN.md`. Los campos 1:1 con su padre (OM, Ed, función hipotetizada) no se
pueden «añadir dos veces»: deshabilita el `+ añadir` de esa celda cuando el
campo ya tiene contenido.

**Reutiliza `lib/redFuncional.ts`**: ya tiene `detectarBucles`, layout
determinista y la redacción de los ciclos en palabras. No lo reescribas.

**Rompe `components/ReportView.tsx`** en el proceso: son **3.533 líneas** y es
el motivo por el que esto da miedo. Un componente por bloque en
`components/informe/`, el grafo en `components/grafo/`, y las primitivas
compartidas (`Chip`, `Cita`, `Confianza`, `SubSeccion`, `Seccion`,
`ListaEditable`) en un módulo propio.

### Fase 3 · Los tres estilos gráficos

Un solo grafo, tres lecturas. AFC por defecto; DBT y ACT se eligen después y
solo se habilitan cuando ya existe el primer gráfico (una conducta con alguna
relación trazada); hasta entonces, deshabilitados con tooltip que lo explica.

**CAMBIAR DE ESTILO ES PURO RENDER EN CLIENTE. Cero llamadas a la API, cero
tokens, cero mutación del análisis.** Si te ves escribiendo un `fetch` aquí, has
entendido mal la tarea. Los datos ya están: `Situacion.cadena_dbt` se genera
junto a `cadena_operante` precisamente para esto, y `capa_act` ya trae
`reglas_verbales` y `procesos_act`.

- **AFC** — carriles y contingencia. **Única vista donde se edita la
  ESTRUCTURA** (añadir, borrar, conectar). Fuera de ella, el botón Conectar se
  deshabilita.
- **DBT** — análisis en cadena, UNA conducta problema a la vez con selector,
  como el worksheet real. Espina vertical a la izquierda; a la derecha, columna
  de soluciones alineada por fase: prevención sobre la vulnerabilidad
  modificable, habilidad por eslabón (de `capa_dbt.habilidades_sugeridas` vía
  `eslabon_id`), conducta hábil frente a la problema, consecuencia necesaria.
  Fases: vulnerabilidad · precipitante · eslabones (por orden) · conducta
  problema · consecuencias (inmediatas | demoradas). Aprovecha
  `analisis_de_soluciones`, `plan_de_prevencion`, `plan_de_reparacion` y
  `eslabon_ausente`, que ya existen.
- **ACT** — matriz 2×2 **agregando TODAS las situaciones en un solo mapa**,
  porque la matriz es de la persona y no de la situación:
  - arriba-izq: conductas de alejamiento (observable)
  - arriba-der: conductas de acercamiento (alternativas + `repertorio_disponible`)
  - abajo-izq: malestar interior del que se aleja (OM, encubiertas, EC)
  - abajo-der: quién y qué le importa ← `valores_y_metas`

  Más una franja propia para `capa_act.reglas_verbales` con clase y rigidez: es
  lo único que muestra insensibilidad a las contingencias, y es el diferencial
  ACT. Las etiquetas de `procesos_act` van como tags en los nodos.

**Truco que sale gratis y debes conservar:** en la vista ACT no se pintan los Ed
ni las consecuencias, así que las únicas flechas que sobreviven del mismo
trazador son las que van del malestar interior a la conducta — que es
exactamente la evitación experiencial. **No escribas lógica nueva para eso.**

La edición de etiquetas y fichas funciona en los tres estilos (es el mismo
nodo). La franja de apoyo y el filtro de la leyenda —«ver solo lo apoyado por la
nota»— también, sobre la matriz y sobre la cadena, no solo sobre los carriles.

Persiste el estilo elegido por caso en `lib/preferencias.ts`; **reutiliza
`components/useLente.ts`**, que ya persiste la lente. La impresión y el `.docx`
salen SIEMPRE en AFC; DBT y ACT solo como páginas adicionales si se piden.

**Decisión que tienes que resolver o preguntar:** `capa_mc` existe
(`ModeloTerapeutico` es `"act" | "dbt" | "mc"`) y tiene su bloque en
`lib/bloques.ts`. Los tres estilos gráficos son AFC/DBT/ACT: decide qué haces
con MC —cuarto estilo, apartado dentro del bloque 2, o retirarlo—. `CAMBIOS.md`
ya lo tenía como pendiente nº 1, y avisa de que el validador V5
(`riesgo_posible_no_detectado`) depende del campo `riesgo`, que venía en el
mismo paquete de decisiones.

### Fase 4 · Vistas derivadas

Un solo generador de prosa. `lib/formatearInforme.ts` pasa a generar las
hipótesis de mantenimiento, el destacado y el resumen **desde el grafo**, y el
modelo deja de emitir esos textos (`enunciado` fuera del prompt →
`VERSION_PROMPT` 1.6.0). Editar una cadena en el bloque 2 tiene que actualizar
el bloque 3 **en el acto**.

**REGLA CLÍNICA QUE NO SE PUEDE ROMPER:** la prosa solo afirma lo que está
**TRAZADO**. Si no hay relación entre el Ed y la conducta, el texto dice
`[Ed no trazado hasta la conducta]` y no lo inventa. Estar en el mismo carril o
en la misma situación es una **clasificación, nunca una relación**; de ahí no se
deduce ninguna contingencia. Quien formula es el terapeuta y el informe va
firmado por él.

Esto además cierra el pendiente nº 4 de `CAMBIOS.md`: hoy `hipotesis-principal`
se ve en pantalla pero no viaja al texto copiado ni al Word. Derivado, viaja.

**Decisión pendiente:** cuando la prosa se derive, un informe v2 guardado
*antes* de la fase 4 tendrá el `enunciado` del modelo **y** uno derivable.
Propuesta: manda el derivado, salvo que la sección esté en `secciones_editadas`,
donde manda lo escrito a mano (invariante 6). Confírmalo con el autor, porque es
la decisión que más se nota.

---

## Invariantes — por encima de cualquier decisión de diseño

1. **Ningún análisis guardado se pierde ni se degrada.** `evals/migracion.test.mjs`
   lo fija contra un JSON v1 real. Si tocas el esquema, amplía esa prueba.
2. **Lo que escribe el profesional no se presenta como generado por IA, ni al
   revés.** Editar marca la sección; la marca viaja al informe copiado, impreso
   y exportado a Word.
3. **Reanalizar una sección NO puede sobreescribir el grafo editado.** El
   reanálisis recibe el JSON actual como contexto y devuelve un **parche** que
   referencia ids existentes, con vista de diferencias antes de aplicar. Sin ids
   estables no hay diff, y por eso la fase 0 fue primera.
4. **Ninguna confianza alta sin cita.** Ahora es comprobable por código.
5. **El entregable final sigue siendo un informe firmado en `.docx`.** El grafo
   es la superficie de trabajo, no el producto. **No mates `lib/exportarDocx.ts`**:
   conviértelo en la exportación del grafo.
6. **La nota no se registra en ningún log.** Ni servidor, ni telemetría, ni
   mensajes de error. El análisis generado y el razonamiento previo del modelo
   son contenido clínico igual: `lib/reporteFallo.ts` no lleva la nota, ni las
   citas, ni el análisis, ni los mensajes de alerta. Lo fijan
   `evals/reporteFallo.test.mjs` y `evals/razonamiento.test.mjs`.
7. **Nada de datos identificativos en ningún sitio nuevo.** Códigos de caso.

## Lo que NO debes hacer

- No añadas un lienzo con pan y zoom. Ya se probó; para datos generados no sirve.
- No crees una tercera escala de confianza. Deriva de `Cita` + `NivelConfianza`.
- No pidas al modelo que emita ids, posiciones ni los textos que ahora se derivan.
- No hagas que un estilo llame a la API.
- No inventes conceptos conductuales ni listas de opciones nuevas. Si crees que
  falta un concepto, ponlo en la sección «Propuestas» del `PLAN.md`, no en el
  código. Ya hay cuatro ahí: `ConductaProblema.modificabilidad`, `dimension` +
  `valor_basal`, `clase`, y los campos de ficha del prototipo (subtipo de OM,
  modalidad del Ed, rol/nivel de la moduladora, mediación).
- No borres funcionalidad para simplificar: borra **representaciones
  duplicadas**. Es otra cosa, y es la única simplificación que no cuesta nada
  clínicamente.
- No desactives los dos chequeos de compilación (`CAMPOS_ANALISIS_FUNCIONAL` en
  `lib/types.ts`, `IdSeccion`/`IdAncla` en `lib/secciones.ts`). Si algo te
  obliga a ensanchar un tipo a `string`, es señal de que falta declarar la
  entidad, no de que el tipo estorbe.

## Cómo trabajar aquí

- **Español en todo**: variables, funciones, comentarios y commits.
- **Los comentarios explican el porqué, no el qué.** El código ya dice qué hace.
- **Cambio mínimo que cumpla el objetivo.** No refactorices de paso — salvo el
  troceado de `ReportView.tsx`, que sí se pide.
- **Pregunta antes de** añadir dependencias, cambiar el modelo de OpenAI o tocar
  los invariantes.
- **Trampa de Tailwind v4, comprobada dos veces:** una regla escrita a mano cuyo
  selector se compone de nombres de utilidades suyas (`.bg-accent.text-white`)
  desaparece del CSS compilado. Y una que sí sobrevive (`.text-[15px]`) solo
  gana a la utilidad homónima porque está **fuera** de `@layer`. Por eso existe
  `.texto-sobre-acento` con nombre propio, y por eso hay una prueba que
  comprueba que esas anulaciones no acaben dentro de una capa.
- **PowerShell, no bash.** `OPENAI_TEMPERATURA=0.2 npm run dev` no funciona: la
  asignación falla pero el resto de la línea se ejecuta igual, así que las evals
  corren a la temperatura que no era y el resultado parece bueno. Ya pasó una vez.

### Ver la interfaz sin gastar API

```bash
npm run dev:maqueta
```

`/api/analizar` devuelve el informe guardado del caso 01. No es un JSON pegado a
la respuesta: pasa por `numerarNota`, `normalizarAnalisis`, `migrarAV2` y
`validarAnalisis`, así que las citas se resuelven y los validadores emiten sus
alertas de verdad. También está la página `/maqueta`, prerenderizada, que
funciona desde el móvil. Doble candado en `lib/maqueta.ts` para que no pueda
llegar a producción; `evals/maqueta.test.mjs` lo fija.

### Las evals que sí gastan

Nueve llamadas por corrida. **El prompt está en v1.5.0 y no se ha medido**; la
marca vigente (v1.2.0: 43/47, integridad de citas 100%) ya no es comparable,
porque desde entonces cambiaron las secciones y el esquema. Si tocas el prompt
—la fase 4 lo hace—, corre las evals y anota los dos números en el commit. Son
dos consolas:

```bash
npm run dev:evals                                                 # consola 1
node evals/run.mjs --endpoint=http://localhost:3000/api/analizar  # consola 2
```

La temperatura hay que fijarla o los números no se comparan: producción va a 0.5
y `dev:evals` fija 0.2, que es donde se midieron las marcas. **No uses
`npm run dev` para medir.**

### Criterios de aceptación — verifícalos de verdad

Al acabar la fase 4 tienen que cumplirse los once.

1. Un JSON v1 guardado se abre en v2 sin perder nada y sin avisos. ✅ **cumplido**
2. El informe muestra 5 bloques ✅ **cumplido**; y ningún dato aparece dos veces
   ❌ **pendiente**: hoy «evitar exponer» sale 10 veces en el DOM renderizado.
   Es justo lo que arreglan las fases 2–4.
3. Reescribir la etiqueta de una conducta en el bloque 2 cambia el texto del
   bloque 3 y del bloque 4 sin recargar y sin llamar a la API.
4. Borrar la flecha Ed→conducta hace que la prosa diga «no trazado» en vez de
   afirmarlo.
5. Clic en una franja de apoyo resalta la línea correcta de la nota en bruto.
6. Una situación con tres inferencias y un dato citado NO se rotula como
   confianza alta.
7. Cambiar AFC→DBT→ACT: **cero peticiones de red** (compruébalo interceptando
   `fetch`) y el mismo recuento de entidades en las tres.
8. Editar en la vista ACT y volver a AFC: el cambio está. Nunca hubo dos copias.
9. Un aviso del bloque 5 enlaza y hace scroll al nodo correcto del grafo.
10. Cero errores de consola. Sin desbordamiento horizontal a 375 px en los tres
    estilos. Tema oscuro correcto. Nodos alcanzables con Tab.
11. Export `.docx` y print siguen funcionando, en AFC.

**Playwright no está instalado** y es una dependencia nueva: pregunta antes de
añadirlo. Alternativa sin dependencia: 1, 3, 4, 6, 7 y 8 son lógica pura sobre
el análisis y se comprueban en Node; el resto a mano en el navegador, con
capturas.

Al terminar cada fase, actualiza `CAMBIOS.md`.
