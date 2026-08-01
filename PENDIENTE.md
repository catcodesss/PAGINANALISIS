# Pendiente

Estado a 31/07/2026, tras las fases 1 a 4. Ordenado por lo que más importa.

Línea base actual (`node evals/run.mjs --endpoint=http://localhost:3000/api/analizar`):
caso 01 en 8/10, 28/30 comprobaciones, integridad de citas 100%.

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
- [ ] **Pasada crítica.** Segunda llamada, con modelo más barato, que recibe la
      nota numerada más el informe generado y solo busca fallos: contenido de la
      nota no recogido, confianza por encima de la evidencia, contradicciones.
      Sus observaciones se fusionan con `alertas`. Duplica el coste por análisis,
      así que debe poder desactivarse por configuración.
- [x] **`seed` fijo** en la llamada a OpenAI, si el modelo lo admite, para que las
      evals sean comparables entre ejecuciones. `OPENAI_SEED` (por defecto 42) en
      ambas rutas.

## 3. Carencias clínicas del análisis

- [ ] **Sección de riesgo como campo propio del esquema.** Hoy el principio 17 pide
      señalar riesgo, pero acaba en `datos_faltantes` o en la priorización, mezclado
      con todo lo demás. Debería ser un campo `riesgo` con `evaluado`, `indicadores[]`
      y su propio bloque en la interfaz: escalada de consumo, ideación, riesgo
      laboral o legal, menores implicados.
- [ ] **`acomodacion_entorno` como campo estructurado.** El principio 7 ya lo cubre
      en prosa, pero tenerlo como lista (quién, qué conducta de acomodación, qué
      función) permitiría validarlo y mostrarlo aparte.
- [ ] **`valores_y_metas` y `perdida_de_reforzadores` como campos.** Mismo caso:
      están en el prompt, no en el esquema.
- [ ] **Caso 02 de las evals.** La función se sigue etiquetando como escape en un
      caso diseñado como déficit puro. Es discutible —responder con monosílabos
      puede leerse como escape de la demanda— y lo importante lo acierta (propone
      adquisición, no exposición). Decidir si la comprobación es demasiado estricta
      o si hay que afinar el principio 15.

## 4. Producto

Lo que separa "generador de hipótesis" de "herramienta de seguimiento".

- [ ] **Edición manual del informe.** Hoy el clínico solo puede pedirle a la IA que
      rehaga una sección. Debería poder corregir, borrar y añadir a mano, y que
      quede marcado qué es generado y qué es suyo. Es la carencia que más limita
      el uso profesional: ahora mismo no hay forma de corregir una hipótesis
      errónea sin volver a tirar de la IA.
- [ ] **Persistencia y seguimiento longitudinal.** Guardar análisis por referencia
      de caso y poder compararlos en el tiempo. Un análisis funcional sin línea
      base ni medida de cambio es media herramienta. Cierras la pestaña y se pierde.
- [ ] **Exportación estructurada** (JSON y DOCX), además de copiar e imprimir.
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
- [ ] **Más casos.** Faltan al menos: un caso infantil con contingencias en el aula,
      un caso de pareja con contingencias entrelazadas, y uno con riesgo explícito
      para probar el principio 17.
- [ ] **Ejecutar con `--reps=3`** de vez en cuando. La ejecución de las 03:48
      demostró que una misma comprobación pasa y falla entre ejecuciones idénticas:
      medir con una sola repetición da una falsa sensación de estabilidad.
- [x] **Automatizar en CI.** `.github/workflows/evals.yml`: tsc --noEmit + citas +
      PII + validadores en cada push/PR a main.
