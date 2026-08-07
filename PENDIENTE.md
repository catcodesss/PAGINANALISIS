# Pendiente

Estado a 03/08/2026. Ordenado por lo que más importa.

Línea base actual (`npm run dev:evals` + `node evals/run.mjs --endpoint=http://localhost:3000/api/analizar`):
9 casos, 43/47 comprobaciones, integridad de citas 61/61 (100%), con el prompt
v1.2.0 a temperatura 0.2. La anterior, con la v1.1.0: 42/47 y 75/77 (97%).
Ver la marca detallada por caso en CLAUDE.md.

---

## 1. Bloqueante para usar con notas de pacientes reales

No es trabajo de código. Mientras esto no esté, procesar datos clínicos reales
tiene un problema de base legal, no técnico.

- [ ] **Firmar el DPA con OpenAI.** El RGPD exige el acuerdo de encargado del
      tratamiento antes de enviar datos personales a un tercero.
      https://openai.com/policies/data-processing-addendum/
- [ ] **Solicitar Zero Data Retention.** Por defecto OpenAI puede retener entradas
      y salidas hasta 30 días para detección de abusos. Requiere solicitud y
      aprobación previa.
- [ ] **Valorar residencia de datos en Europa** si los usuarios son europeos.
- [ ] **Revisar que el texto de privacidad de `app/page.tsx`** siga describiendo
      la configuración real de la cuenta una vez hechos los puntos anteriores.

## 1 bis. Profundidad del análisis

Usuarios reportan (30/07/2026) que los informes se quedan básicos. Diagnóstico:
el prompt es casi todo prohibiciones — resultado de la auditoría de citas — y
ante una lista de prohibiciones la forma más segura de no violar ninguna es
decir poco. Hecho en la v1.2.0 del prompt: espacio de razonamiento previo,
principio 22 (profundidad exigible), exigencias de razonamiento en
`funcion_hipotetizada`, `enunciado`, `justificacion_deficit`,
`hipotesis_alternativas` y `reglas_verbales.analisis`, temperatura de producción
a 0.5 y techo de salida de 12 000 a 16 000. Queda:

- [x] **Medir si sirvió.** Hecho el 03/08/2026 con `npm run dev:evals` (fija la
      temperatura a 0.2). **No hay regresión: 43/47 frente a 42/47, y las citas
      pasan de 75/77 (97%) a 61/61 (100%).** Como estaba previsto, estas evals
      miden ausencia de fallos y no profundidad, así que el número no acredita
      que el informe sea mejor; lo que sí descarta es que la v1.2.0 rompiera algo.
      En el caso 09 el modelo pasó a detectar la ideación y la escalada de
      consumo, que era el fallo intermitente documentado.
- [ ] **Confirmar si la v1.2.0 perdió cobertura.** Efecto secundario detectado al
      medir: la v1.2.0 produce **61 entradas de evidencia frente a 77 (−21%)**, y
      los dos fallos nuevos de la corrida (`urgencias-palpitaciones` en el caso 01,
      `cita-mueble` en el 05) son de contenido que desaparece, no de contenido
      erróneo. En el caso 01 se comprobó en vivo que las visitas a urgencias no
      figuran en ninguna parte del informe. Hipótesis: el principio 22 pide
      profundidad y el modelo la paga en amplitud. `cita-mueble` ya se verificó
      intermitente —pasa al repetir la llamada—, así que hace falta `--reps=3`
      para separar varianza de efecto real antes de tocar el prompt. Si se
      confirma, el arreglo probable no es bajar la exigencia de profundidad sino
      hacer explícito en el principio 22 que la profundidad se añade a la
      cobertura y no la sustituye: ninguna conducta de la nota puede quedar fuera.
- [ ] **Conseguir informes reales que los usuarios calificaran de básicos.**
      Sin ellos se está optimizando a ciegas: "básico" puede ser obvio,
      genérico o corto, y cada causa tiene arreglo distinto.
- [ ] **Escribir a mano un análisis funcional patrón de oro** sobre un caso
      ficticio, del nivel objetivo. Sirve a la vez de ejemplo few-shot en el
      prompt y de rúbrica para una eval de profundidad. Hoy ninguna prueba mide
      si el informe es clínicamente profundo, y lo que no se mide no mejora.
      Solo lo puede escribir el autor.
- [ ] **Evaluar el cambio de modelo.** `gpt-4o` es de 2024, no razona antes de
      responder, y desde 2026 es además de los caros ($2,50/1M de entrada frente
      a $1,25 de GPT-5 o $0,20 de GPT-5.6 Luna). El análisis funcional es
      inferencia causal multipaso: es lo que hacen bien los modelos de
      razonamiento. Probablemente la palanca mayor y la más barata; requiere
      correr las evals con los dos modelos antes de decidir.

## 1 ter. Auditabilidad del código

Pedido por el autor (07/08/2026): que el código se pueda auditar desde fuera y
que los fallos se prevengan solos, sin cambiar nada visible ni operativo.
Verificado que no cambia nada: mismo orden de los 15 bloques, mismo índice, sin
enlaces rotos, mismos encabezados en el informe copiado y mismo comportamiento
de las pestañas de modalidad.

- [x] **Dos renders en cascada, arreglados.** Eran los dos errores de lint que
      arrastraba el proyecto, y los dos el mismo patrón: estado que se corrige
      a sí mismo dentro de un efecto.
      - `ReportView`: la pestaña de modalidad se deriva ahora durante el render.
        El efecto obligaba a un segundo render, y entre los dos había un
        fotograma con una pestaña que no se había generado.
      - `Historial`: el caso "no disponible" se decidía de forma síncrona en el
        cuerpo del efecto. Ahora los dos caminos salen ya asíncronos, con una
        bandera que evita tocar el estado de un componente desmontado.
- [x] **Una sola lista de secciones** (`lib/secciones.ts`). Los mismos quince
      identificadores estaban escritos en cuatro sitios sin nada que los
      comparase: el índice, el orden de fábrica del informe exportado, los
      títulos del informe copiado y el mapa de bloques. El tipo `IdSeccion` sale
      de la lista, así que **un identificador inventado ya no compila** — antes
      habría sido un enlace roto o un bloque que no se imprime. Al aplicarlo, el
      compilador encontró cuatro sitios que indexaban con un `string` cualquiera.
- [x] **Suite de coherencia** (`evals/coherencia.test.mjs`, 8 pruebas) para los
      cruces que salen del sistema de tipos: TypeScript contra CSS y código
      contra hoja de estilos. **Verificada con mutaciones**: se rompió cada
      invariante a propósito y las cuatro veces falló la prueba que debía.
- [x] **`razonamiento.test.mjs` no estaba en CI**, pese a guardar el invariante
      5. Añadida junto con la de coherencia y el lint. CLAUDE.md y el workflow
      llevan ahora una nota de que las dos listas tienen que decir lo mismo.
- [x] **Documentada la trampa de Tailwind v4** en CLAUDE.md, con una tabla de
      qué nivel atrapa qué fallo. Es lo primero que necesita alguien de fuera.

## 2. Robustez técnica

- [ ] **Rate limiting con almacén compartido.** El actual (`lib/limitePeticiones.ts`)
      guarda el contador en memoria del proceso: en Vercel cada invocación puede
      caer en una instancia distinta, así que el límite real es más laxo que el
      configurado. Frena el uso accidental, no un abuso decidido. Sustituir por
      Vercel KV o Upstash; la interfaz de `comprobarLimite` ya está pensada para
      cambiarse sin tocar las rutas.
- [ ] **Structured Outputs con `strict: true`.** Hoy la respuesta se parsea con
      `extraerJSON` + normalizadores tolerantes, que funciona pero no garantiza
      la forma. Con el esquema en modo estricto, un campo obligatorio no puede
      faltar. Requiere comprobar que el modelo en uso (`gpt-4o`) lo soporta.
- [x] **Pasada crítica.** `lib/pasadaCritica.ts`: segunda llamada con
      `gpt-4o-mini` (decisión del autor, 01/08/2026) que recibe la nota numerada
      más el informe generado y busca contenido no recogido, confianza por
      encima de la evidencia y contradicciones internas. Solo corre sobre el
      informe completo (no en análisis por partes). Sus hallazgos se fusionan
      con `alertas` marcados `origen: "ia"`, distinguibles en la interfaz de
      los 5 validadores deterministas (`origen: "validador"`). Desactivada por
      defecto (decisión del autor): se activa con `PASADA_CRITICA=true`, ver
      `.env.example`. Probada en vivo: sobre el caso 01, corroboró de forma
      independiente 4 de las 5 alertas deterministas y no rompió el análisis
      principal.
- [x] **`seed` fijo** en la llamada a OpenAI, si el modelo lo admite, para que las
      evals sean comparables entre ejecuciones. `OPENAI_SEED` (por defecto 42) en
      ambas rutas.

## 3. Carencias clínicas del análisis

- [x] **Sección de riesgo como campo propio del esquema.** Campo `riesgo` con
      `evaluado: boolean` e `indicadores: string[]` (lib/types.ts), siempre
      presente (CAMPOS_SIEMPRE en lib/bloques.ts) igual que datos_faltantes.
      Sección propia en la interfaz justo debajo de Datos faltantes. Probado en
      vivo: `evaluado: true, indicadores: []` en el caso 01 (sin indicadores
      reales de riesgo en la nota).
- [x] **`acomodacion_entorno` como campo estructurado.** `{ quien,
      conducta_acomodacion, funcion, evidencia }[]`, con cita verificable.
      Vive en el bloque "situaciones" y se muestra como subsección aparte de
      "Análisis por situaciones". Probado en vivo con el caso 01: resolvió la
      acomodación de la pareja con cita literal de la nota.
- [x] **`valores_y_metas` y `perdida_de_reforzadores` como campos.** `string[]`
      cada uno, en el bloque "formulación", mostrados como subsecciones de
      "Formulación del caso". Probado en vivo con el caso 01.
      `VERSION_PROMPT` subida a 1.1.0 por el cambio de esquema y principios
      7/17/18/19. Evals sin coste y con `--fixture` verificados tras el cambio;
      dos checks nuevos añadidos al caso 01 (`acomodacion-como-campo-propio`,
      `riesgo-evaluado`), ambos en verde.
- [ ] **Caso 02 de las evals — recomendación, pendiente de que el autor decida.**
      Revisado el 01/08/2026 con la corrida de `--reps=3`: `no-inventa-evitacion`
      es inestable (2/3), pero lo importante se acierta siempre (identifica
      déficit, propone adquisición, nunca exposición).
      Análisis: la nota no aporta ningún dato de R− (alivio, reducción de
      malestar) que sostenga una función de escape — es un déficit topográfico
      puro (nunca recibió formación, no distingue tarea de competencia, sigue
      presentándose motivado a más entrevistas). Etiquetar las respuestas breves
      como "escape de la demanda" sin esa evidencia es precisamente el sesgo que
      ya advierte el principio 16 (forzar refuerzo negativo como explicación
      por defecto). Mi lectura: la comprobación del eval está bien como está;
      el fallo intermitente es un fallo real del prompt, no un falso positivo
      del test. Si se quiere corregir, el cambio mínimo sería añadir al
      principio 15 o 16 una advertencia explícita: no atribuir función de
      escape a una respuesta breve/incompleta sin evidencia de una consecuencia
      de alivio (R−) en la nota. No lo he tocado — es un cambio al prompt
      clínico y el autor debe decidirlo.

## 4. Producto

Lo que separa "generador de hipótesis" de "herramienta de seguimiento".

- [x] **Edición manual del informe.** Decisiones del autor (01/08/2026): solo
      campos de texto libre (los chips de clasificación no se tocan), por
      elemento individual, con borrar y añadir. `components/edicionManual.tsx`
      tiene las primitivas; `secciones_editadas` en `AnalisisFuncional` registra
      qué tocó el clínico y produce la marca "Editado por ti" (chip textual, no
      solo color: sobrevive impreso y en blanco y negro).
      - Persistencia: solo en la sesión; va al historial si el usuario guarda.
      - Reanálisis sobre una sección editada: avisa y exige confirmar.
      - Revalidación: las comprobaciones deterministas se repiten en el
        navegador sobre lo editado (`revalidarTrasEdicion`) — avisan, nunca
        corrigen ni degradan lo que escribió el profesional.
      - Botón de reportar fallo de la IA por sección. **Corregido tras revisión
        del autor:** la primera versión incluía el análisis generado y solo
        quitaba las citas, con el argumento de que el texto era "del modelo".
        El autor señaló que no: el análisis describe el caso, y las hipótesis
        con confianza alta son justo las más pegadas a la nota, porque esa
        confianza exige una línea que las sostenga. Ahora el reporte solo lleva
        modelo, versión de prompt, sección y códigos de alerta — ni el
        análisis, ni las citas, ni los mensajes de alerta (que citan el texto
        generado). Medido: de ~1960 caracteres con el caso a ~655 de metadatos.
        Fijado con `evals/reporteFallo.test.mjs` (7 pruebas, en CI).
      Verificado en vivo: editar, borrar, marca en pantalla y en el Word
      exportado, aviso de sobrescritura, y que el reporte copia exactamente lo
      que el clínico dejó en el cuadro.
- [x] **Los avisos del validador decían qué, no dónde ni de qué.** Señalado por
      el autor (07/08/2026) sobre un caso de comprobación compulsiva. Dos
      problemas distintos en el mismo bloque:
      - El rótulo "Revisiones sugeridas" se leía como si fueran correcciones a
        la nota que pegó el clínico, cuando hablan del informe que escribió la
        IA. Renombrado a **"Puntos a verificar del análisis"**, con la primera
        línea diciéndolo explícitamente. MARCA.md queda actualizado: el
        contraste normativo sigue siendo frente a "Errores detectados", porque
        el aviso es tentativo, no un veredicto.
      - Seis avisos idénticos salvo por la intervención citada. Pasa cuando el
        núcleo detectado es el propio tema del caso: en comprobación
        compulsiva, *todas* las intervenciones mencionan comprobación y V3
        dispara una vez por cada una, así que el aviso real quedaba enterrado
        bajo su repetición. `Alerta` separa ahora el motivo (`mensaje`) del
        fragmento señalado (`elemento`), y `agruparAlertas` los junta por
        motivo. Es presentación, no detección: se emiten y se cuentan las
        mismas alertas. Medido sobre el caso: 9 avisos sueltos → 3 grupos.
      - Añadido con ello lo que pidió el autor a continuación: cada grupo dice
        **en qué sección del informe puede haberse reflejado el fallo**
        (`seccionDeRuta` traduce `capa_dbt.habilidades_sugeridas[1]` a
        "Detalle según modelo terapéutico"), enlazada en pantalla y escrita en
        el informe copiado, impreso y exportado a Word. Sirve para decidir qué
        apartado reanalizar en vez de desconfiar del informe entero. Sin
        sección conocida no se señala ninguna: mejor eso que la equivocada.
      Fijado con 6 pruebas nuevas en `evals/validadores.test.mjs` (9 → 15).
- [x] **La cadena, dibujada.** Pedido por el autor (07/08/2026): un círculo por
      eslabón, flecha al siguiente, y el detalle al mantener pulsado. Leída como
      tabla la cadena es una lista de filas y se pierde lo que la hace útil —
      que es una secuencia, y que entre dos eslabones es donde se interviene.
      - **No sustituye a la tabla, la precede.** Un gráfico que esconde el texto
        hasta que lo pulsas no sirve impreso ni con lector de pantalla, así que
        el dibujo no se imprime y cada círculo lleva su texto entero en
        `aria-label`.
      - **El color no distingue tipos de eslabón.** MARCA.md reserva el ámbar
        para "hay que mirarlo"; cinco colores nuevos para pensamiento/emoción/
        sensación/impulso/acción romperían ese código por una distinción
        decorativa. Van por inicial dentro del círculo, que además sobrevive en
        blanco y negro y a un daltonismo. El ámbar sí marca la conducta problema,
        que es el blanco y no un paso más.
      - Mantener pulsado enseña el eslabón mientras se mantiene; un toque corto
        lo deja fijo. La distinción existe por el móvil: sin ella el dedo tapa
        justo lo que quieres leer. Con teclado, enfocar muestra e Intro fija.
- [x] **El tamaño de letra pasa de tres pasos a cinco**, del 85% al 130%, con el
      porcentaje escrito y cada botón dibujado a su propio tamaño. Antes el
      salto mayor era del 15% y "Amplio" no decía cuánto. Los tres nombres
      viejos siguen siendo válidos como pasos centrales, así que una preferencia
      ya guardada no se pierde. **Sin verificar en vivo:** el panel de pruebas
      devuelve 16px para cualquier `font-size` — un `span` a 10px y a 32px mide
      lo mismo—, así que ahí no se puede medir el escalado. Sí está comprobado
      que las cinco reglas compilan y que `--escala-texto` resuelve a
      .85/.925/1/1.15/1.3.
- [ ] **Persistencia y seguimiento longitudinal.** Guardar análisis por referencia
      de caso y poder compararlos en el tiempo. Un análisis funcional sin línea
      base ni medida de cambio es media herramienta. Cierras la pestaña y se pierde.
- [x] **Exportación.** Las únicas salidas son **Word y PDF** (decisión del autor,
      01/08/2026). La exportación JSON que se había añadido antes se retiró: un
      terapeuta no tiene por qué querer un `.json`. No confundir con "Exportar
      respaldo" de `Historial.tsx`, que sigue siendo JSON **cifrado** y es la
      única forma de restaurar el historial en otro dispositivo.
      - Word: `lib/exportarDocx.ts`, HTML con namespace MSO, **sin dependencias**
        (decisión del autor: la opción más barata que no comprometa la
        velocidad). Se construye sobre `formatearInformeTexto` para que copiar,
        imprimir y exportar no puedan divergir.
      - PDF: sigue siendo `window.print()`.
- [ ] **Discutir a fondo la exportación DOCX** (pendiente explícito del autor).
      Para esa conversación: la vía que da fidelidad completa sin coste de carga
      es importar la librería `docx` de forma dinámica al pulsar el botón, en
      vez de meterla en el bundle. Lo actual es HTML-como-.doc: Word lo abre
      bien, pero no hay control fino de saltos de página ni estilos de documento.
- [x] **Hueco detectado al hacer el Word:** `formatearInforme.ts` no incluía los
      cuatro campos añadidos hoy (riesgo, acomodación, valores, reforzadores),
      así que el informe copiado e impreso los perdía. Corregido; ahora también
      lleva la trazabilidad del modelo y la marca de secciones editadas.
- [x] **Trazabilidad en el informe:** modelo, versión del prompt y fecha. Campo
      `meta` en `AnalisisFuncional` (lib/types.ts), fijado por el servidor tras
      generar; `VERSION_PROMPT` en lib/systemPrompt.ts. Visible junto a la fecha
      de generación y en el encabezado/descargo de impresión.

## 5. Deuda de las evals

- [x] **Dos comprobaciones pasan con `[ámbito vacío]`** (`sueno-no-es-vulnerabilidad-biologica`
      en el caso 01 y `no-inventa-antecedentes` en el 06). Arreglado: el caso 01
      ahora usa un ámbito casi siempre poblado (`variables_moduladoras`) más
      `incluirRuta` para comprobar la combinación etiqueta+contenido; el caso 06
      quitó el `ambito` sobrante (igual que su hermano `no-inventa-alcohol`, que
      ya escaneaba todo el informe).
- [x] **Más casos.** Añadidos los tres que faltaban: 07 infantil (doble función,
      no diagnostica), 08 pareja (ciclo interconductual, acomodación), 09 riesgo
      explícito (principio 17). Calibrados contra el endpoint real, no en frío:
      dos patrones de comprobación tuvieron que ampliarse porque el modelo
      escribió "desaparición"/"reforzando la evitación" en vez de las palabras
      que yo esperaba — no era el modelo, era mi regex.
      **Hallazgo de seguridad, no solo de evals:** probando el caso 09 en vivo (4
      llamadas), 1 de 4 devolvió `riesgo.evaluado: true` con `indicadores: []`
      pese a que la nota describía ideación explícita y escalada de consumo —
      peor que "no decir nada", porque afirma que sí se evaluó. Añadido un
      quinto validador determinista (`riesgo_posible_no_detectado` en
      lib/validadores.ts): escanea la nota en busca de lenguaje de riesgo vital
      y avisa si el campo `riesgo` no lo recogió. Ver el invariante 3 actualizado
      en CLAUDE.md. 3 pruebas nuevas en evals/validadores.test.mjs (9 en total).
- [x] **Ejecutar con `--reps=3`** de vez en cuando. Corrida del 01/08/2026: 86/90,
      citas 100%. Confirma la inestabilidad: `no-inventa-evitacion` (caso 02) en
      2/3. Ver también la marca actual en CLAUDE.md.
- [x] **Automatizar en CI.** `.github/workflows/evals.yml`: tsc --noEmit + citas +
      PII + validadores en cada push/PR a main.
