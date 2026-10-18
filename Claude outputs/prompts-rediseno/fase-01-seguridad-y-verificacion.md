# Fase 1 · Seguridad clínica y verificar en la misma pantalla

**Urgente.** Sin cambios de esquema ni de prompt. No necesita crédito en OpenAI.

## Contexto

Repositorio de ACIA (Next.js, `Desktop/ACIA`). Lee primero `CLAUDE.md` (en
`Desktop/`, fuera del repo), `RELEVO.md` y `CAMBIOS.md`. El diagnóstico completo
está en `Claude outputs/mesa-clinica-acia.html`, secciones §A.4 a §A.12.

La auditoría encontró fallos que pueden inducir a error a un clínico **hoy**, con
la interfaz actual. Esta fase los corrige sin reorganizar nada: la
reorganización llega en la fase 5.

## Hallazgos que motivan el cambio

1. **Una relación inferida acaba de recomendación (§A.4).** La nota dice «Duerme
   mal los domingos». Esa variable moduladora sale con «Cita textual». Una
   hipótesis la une a «Evita exponer…», y de ahí salen un bucle cerrado,
   «Modificabilidad ALTA», «Por dónde moverla: Sueño deficiente los domingos» y
   la frase «La relación de mantenimiento trazada parte de «Sueño deficiente…»».
   La cita respalda el **dato**, no la **relación**. `priorizarBlancos`
   (`lib/priorizacion.ts`, ~línea 118) elige la palanca por `modificabilidad` e
   ignora `h.confianza`, que es justo el apoyo de la relación.
2. **La alerta más grave no está en el nodo (§A.5).** La alternativa «Exponer
   resultados utilizando técnicas de respiración…» se ve sin aviso en el grafo
   AFC y, en la Matrix ACT, como conducta de acercamiento. La Ficha solo dice
   «Apoyo en la nota: Inferencia». El aviso está en Plan y, dos veces, en Revisión.
3. **Los vacíos culpan a la nota (§A.6).** «Sin hallazgos suficientes en la
   nota» (`components/informe/primitivas.tsx:48`, `lib/formatearInforme.ts:53`)
   sale para valores y para reforzadores perdidos, aunque la nota menciona el
   ascenso y el baile. El riesgo con `evaluado: false`
   (`components/informe/BloqueSintesis.tsx:70`) afirma que la nota «no dice nada
   sobre consumo», y sí habla de alcohol. En la maqueta pasa porque el fixture
   v0.1.2 no tiene esos campos, pero la interfaz no distingue entre «no se
   generó», «la IA no encontró nada» y «la nota no lo contiene».
4. **Prosa derivada con comillas (§A.3).** `lib/formatearInforme.ts:153` y
   alrededores escriben etiquetas del modelo entre comillas latinas, con la misma
   marca que una cita de la nota (choca con el espíritu del invariante 2). Con
   `origen` vacío imprime «parte de «»».
5. **Un eslabón «acción» se trata como evento privado (§A.8).** `lib/grafo.ts`
   (~línea 107) convierte todo eslabón DBT en nodo `tipo: "encubierta"`. En la
   Matrix, «Pide ir al baño y evita exponer · acción» cae en «Malestar interior»
   rotulado ENCUBIERTA.
6. **La Ficha está fuera de la pantalla (§A.5).** A 1600 px empieza en y≈3.600,
   y los nodos van de y≈700 a y≈3.000. Al seleccionar un nodo se actualiza un
   panel que no se ve. Además enseña ids internos («alt_1 → alt_1_consecuencia»,
   `components/grafo/GrafoAFC.tsx` ~línea 723).
7. **Intervenciones huérfanas que tienen dueño (§A.5).** El blanco 1 dice «El
   análisis no propone intervención», y la exposición graduada y el
   reforzamiento diferencial dirigidos a «la evitación en reuniones» están en
   «Intervenciones sin blanco».

## Reglas

1. Sigue las reglas comunes de `Claude outputs/prompts-rediseno/00-orden-y-urgencia.md`.
2. **No cambies el esquema ni el prompt.** Si un punto lo exige, para y pregunta.
3. **No reorganices pestañas ni secciones.** Eso es la fase 5.
4. **No añadas rojo.** Gravedad alta: insignia ámbar rellena «▲ Revisar antes de
   usar». Media: contorno ámbar «◆ Conviene revisar». Siempre texto y forma, no
   solo color.
5. Todo lo que cambies en pantalla cambia igual en el texto copiado, el impreso
   y el Word (`formatearInformeTexto`, `exportarDocx`).

## Sub-fase 1A · Seguridad

- **Apoyo de la relación en lo derivado.**
  - `PalancaBlanco` lleva también el apoyo de la relación que la trae
    (`h.confianza` de la hipótesis que une la variable con la conducta).
  - Si esa relación es de confianza baja, la palanca se muestra como
    «Por dónde moverla (relación inferida): …», con la marca gris, y el criterio
    de modificabilidad de ese blanco dice «estimada desde una relación inferida».
  - Si la única palanca de una conducta viene de una relación inferida, trátala
    como hoy se tratan las conductas sin palanca (no consta por dónde moverla).
    **Esto puede cambiar el orden del ranking: enséñamelo antes del commit.**
  - Los bucles cerrados (`lib/redFuncional.ts`, `components/informe/mantenimiento.tsx`)
    dicen si alguno de sus tramos es una relación inferida.
  - La formulación derivada no puede presentar como trazada desde un origen una
    relación de confianza baja sin decirlo.
- **Alertas en el elemento.** Toda alerta cuyo `elemento` o `ruta` resuelve a un
  nodo pinta una insignia en ese nodo, en las tres vistas (AFC, DBT y Matrix
  ACT), y aparece en la Ficha cuando el nodo está seleccionado. Reutiliza el
  enlace alerta → nodo que ya existe (criterio 9 de `RELEVO.md`). Las alertas
  siguen también donde están hoy.
- **Vacíos en tres estados.** Sustituye el mensaje único por:
  - *No se generó*: el bloque no se pidió (`campos_generados`) o el informe es
    anterior al campo. Texto: «Este análisis no incluye este apartado».
  - *La IA no encontró nada*: «El análisis no recoge ninguno. Revisa la nota:
    puede haberlo».
  - *La nota no lo contiene*: no se usa en esta fase, porque nada lo comprueba.

  Averigua cómo distinguir el primer estado con lo que ya hay (por ejemplo, si
  el normalizador recibió `null` o la clave no existía). Si no se puede sin un
  campo nuevo, para y propón el campo mínimo.
- **Riesgo con `evaluado: false`**: «El análisis no evaluó el riesgo. No
  significa que no lo haya.» Quita la enumeración de lo que la nota «no dice».
- **Prosa derivada sin comillas.** En pantalla, las etiquetas del modelo van
  como chip o con un estilo distinto de las citas. En el texto exportado van sin
  comillas («Ed: Supervisora pide exponer resultados»). Un extremo vacío no
  imprime «» vacío: usa el patrón que ya existe, «[origen no trazado]». Las citas
  verificadas siguen igual.
- **El eslabón «acción» no es encubierto.** Un eslabón de tipo `accion` no se
  rotula ENCUBIERTA ni va a «Malestar interior» en `lib/matrixACT.ts`. Decide si
  necesita un tipo de nodo propio o basta con excluirlo por `detalle`; explícame
  la opción. La duplicación con la conducta de la situación (`RELEVO.md`,
  pendiente 4) **no** se resuelve aquí.

## Sub-fase 1B · Verificar en la misma pantalla

- **Ficha y nota en panel lateral fijo.** A partir de 1280 px, la Ficha y la
  nota numerada van en una columna fija a la derecha del grafo, con scroll
  propio. Al seleccionar un nodo, el panel se actualiza a la vista. Por debajo
  de 1280 px, un cajón que sube desde abajo. Pulsar una cita resalta su línea en
  el panel.
- **Sin ids internos.** «Relaciones del nodo» enseña la etiqueta del otro
  extremo y el tipo de relación, nunca `alt_1 → alt_1_consecuencia`.
- **Sugerir blanco a las huérfanas.** Cada intervención de «Intervenciones sin
  blanco» y cada plan de «Monitorización sin blanco» muestra «¿Asignar a Blanco
  N?» cuando la heurística de `lib/identidad.ts` encuentra candidato, con los
  botones Asignar, Elegir otro y Dejar sin blanco. **Nunca se asigna sola.**
  Asignar escribe `conducta_id`; es una decisión del clínico, no texto suyo, así
  que sigue el precedente de `estados_plan` y no marca la sección como editada.
  Si dudas, pregunta.

## Fuera de alcance

Cambios de esquema y de prompt, reorganizar pestañas, apoyo en las aristas
(fase 3), citas por frase (fase 2), la duplicación del eslabón acción.

## Verificación

- Las comprobaciones de las reglas comunes, al final de 1A y de 1B.
- **Pruebas nuevas:**
  - con el fixture `evals/fixtures/01-v0.1.2.json`, «por dónde moverla» del
    blanco 1 ya no presenta el sueño como palanca sin marca de relación inferida;
  - ninguna prosa derivada contiene «» vacío;
  - `clasificarMatrix` no pone un eslabón de acción en `interior`;
  - los tres estados de vacío salen según el caso.
- **Navegador** (`npm run dev:maqueta` y `/maqueta`): la insignia ▲ en la
  alternativa con respiración en las tres vistas; la Ficha visible al
  seleccionar a 1600 px; la Ficha accesible a 375 px; sin errores de consola.
- **`evals/maqueta.test.mjs`** sigue en verde: el aviso de ejemplo sigue en la
  franja, en el texto copiado y en el Word.
