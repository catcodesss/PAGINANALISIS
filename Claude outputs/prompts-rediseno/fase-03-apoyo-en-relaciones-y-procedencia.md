# Fase 3 · Apoyo en las relaciones y procedencia por elemento

**Alta.** Cambio de esquema. La sub-fase 3B toca el prompt y es opcional:
pregúntame antes de empezarla.

## Contexto

Lee `CLAUDE.md` (en `Desktop/`), `RELEVO.md` y `CAMBIOS.md`. Diseño:
`Claude outputs/mesa-clinica-acia.html` §A.4, §D.5 y §D.6.

Hoy el grado de apoyo existe solo en los nodos (`derivarApoyo` en
`lib/grafo.ts`), y además se hereda:

- **Nodos que heredan la cita de toda la cadena.** OM, Ed y consecuencias usan
  `evidenciaOperante`, la cita única de la cadena operante (`lib/grafo.ts`,
  ~líneas 83-96). La OM «OE de malestar condicionado por evaluación social» sale
  como «Cita textual» aunque ninguna frase la diga.
- **Relaciones sin apoyo propio.** Una arista entre dos nodos citados parece
  igual de sólida que ellos, aunque ninguna frase afirme la relación. Es el caso
  del sueño (§A.4). La fase 1 lo parcheó en la palanca; esta fase lo arregla en
  el modelo de datos.

La procedencia va por sección (`secciones_editadas`) y la revisión por pestaña
(«Propuesta de la IA · pendiente de revisar»), cuando el clínico revisa
elemento a elemento.

## Reglas

1. Sigue las reglas comunes de `Claude outputs/prompts-rediseno/00-orden-y-urgencia.md`.
2. **Invariante 6.** Esta fase lo lleva de la sección al elemento: lo amplía, no
   lo debilita. Lo que escribe el clínico sigue sin presentarse nunca como
   generado, también en el copiado, el impreso y el Word. Si algo te obliga a
   relajarlo, para y pregunta.
3. **Invariante 3.** El apoyo de una relación se calcula en el servidor y de
   forma determinista, no lo declara el modelo sin cita.
4. El color sigue significando solo apoyo en la nota (verde, dorado, gris). La
   procedencia usa borde y marcas.

## Sub-fase 3A · Esquema y cálculo (sin prompt)

- **`Arista`** gana `apoyo: "textual" | "parcial" | "inferido"` y
  `evidencia: Cita[]`. Se calcula una vez al normalizar o migrar, con estas reglas:
  - Una arista nunca tiene más apoyo que el más débil de sus dos extremos.
  - Una arista que sale de una `HipotesisMantenimiento` toma su `confianza`.
    Como la hipótesis no tiene cita propia, como mucho es «parcial».
  - Las aristas de la cadena operante toman la cita de la cadena, y solo la
    arista conducta → consecuencia puede ser textual. Que una frase cite la
    cadena no afirma la OM ni el papel de cada pieza.
  - Una arista creada por el clínico no tiene apoyo declarado: se ve como «tuya»
    hasta que se le añada una cita (fase 5).

  Propón las reglas finales en una tabla antes de implementarlas.
- **Nodos.** La OM deja de heredar la cita de la cadena: sin cita propia, es
  inferida. Revisa con el mismo criterio cualquier otro nodo que herede.
- **Agregados.** Ruta, hipótesis, bucle y situación toman el mínimo de sus
  aristas (hoy las situaciones ya usan `Math.min` sobre sus eslabones). La
  palanca de la priorización usa el apoyo de su arista; quita el parche de la
  fase 1 si queda redundante.
- **Procedencia por elemento.** `AnalisisFuncional.procedencia:
  Record<Id, { estado: "propuesta" | "confirmado" | "editado" | "creado";
  original?: string }>`.
  - Lo escribe solo la interfaz; el modelo nunca lo envía (como `alertas`,
    `meta` y `secciones_editadas`).
  - No entra en el esquema que se manda al modelo. Comprueba que
    `evals/razonamiento.test.mjs` sigue pasando.
  - `secciones_editadas` se conserva para compatibilidad.
- **Migración** (`migrarAV<n>`):
  - calcula el apoyo de las aristas existentes;
  - todo nace como «propuesta», salvo los elementos de secciones ya editadas,
    que pasan a «editado». No se puede saber qué elemento se editó dentro de
    una sección: márcalo así y dilo en el comentario.
- **`CAMPOS_ANALISIS_FUNCIONAL`**: añade lo nuevo. El chequeo de compilación
  tiene que fallar si falta.

## Sub-fase 3B · Cita propia de cada hipótesis (opcional, prompt)

Pregúntame antes de empezar.

- `HipotesisMantenimiento` pide `evidencia`: la frase que afirma la
  **relación**, no sus extremos. Por ejemplo, «al volver la reunión ya había
  pasado a otro punto… sintió un alivio inmediato» afirma que salir trae alivio.
- Con cita verificada y confianza alta o media, la arista puede ser textual.
- Sube `VERSION_PROMPT`. Evals antes y después; además de la puntuación, cuenta
  cuántas hipótesis traen cita y cuántas resuelven.

## Sub-fase 3C · Interfaz mínima

Lo justo para que se vea. La interfaz completa es la fase 5.

- Las aristas inferidas se dibujan discontinuas en el grafo y en la red funcional.
- «Relaciones del nodo», en la Ficha, enseña el apoyo de cada relación.
- Procedencia por elemento en la Ficha: «Propuesta de la IA», «Confirmado por
  ti», «Editado por ti» (al pasar el cursor, el texto original), «Tuyo».
- Botón «Confirmar» en la Ficha. Confirmar no es editar: no marca el elemento
  como texto del clínico.
- La exportación escribe [Propuesta de la IA], [Confirmado], [Editado] o
  [Del profesional] junto a cada elemento, y el apoyo de cada relación de las
  hipótesis.

## Fuera de alcance

Arrastrar frases para citar, el Inspector nuevo, el historial de revisiones por
sesión (fase 7).

## Verificación

- Las comprobaciones de las reglas comunes.
- **`evals/migracion.test.mjs`**:
  - v3 → nueva versión sin pérdida, e idempotente;
  - un informe v1 sigue abriendo;
  - con el fixture del caso 01, la arista sueño → evitar exponer no es textual,
    y el bucle que la usa tampoco;
  - la OM del caso 01 no es textual;
  - ninguna arista tiene más apoyo que sus extremos.
- **Prueba de invariante 6**: un elemento editado sale como editado en el texto
  copiado y en el Word; uno confirmado sale como confirmado, no como editado.
- **Navegador**: aristas discontinuas visibles en las tres vistas y en la red
  funcional.
