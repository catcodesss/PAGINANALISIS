# Pendiente

Estado a 01/08/2026. Ordenado por lo que más importa.

Línea base actual (`node evals/run.mjs --endpoint=http://localhost:3000/api/analizar`):
9 casos, 42/47 comprobaciones, integridad de citas 75/77 (97%). Ver la marca
detallada por caso en CLAUDE.md.

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

- [ ] **Edición manual del informe.** Hoy el clínico solo puede pedirle a la IA que
      rehaga una sección. Debería poder corregir, borrar y añadir a mano, y que
      quede marcado qué es generado y qué es suyo. Es la carencia que más limita
      el uso profesional: ahora mismo no hay forma de corregir una hipótesis
      errónea sin volver a tirar de la IA.
- [ ] **Persistencia y seguimiento longitudinal.** Guardar análisis por referencia
      de caso y poder compararlos en el tiempo. Un análisis funcional sin línea
      base ni medida de cambio es media herramienta. Cierras la pestaña y se pierde.
- [x] **Exportación JSON**, además de copiar e imprimir. Botón "Descargar JSON"
      junto a "Copiar informe"; genera el archivo en el navegador (la nota no
      vuelve a tocar el servidor). Probado en vivo.
- [ ] **Exportación DOCX.** Requiere una librería nueva (p. ej. `docx`) — pendiente
      de decidirlo con el autor antes de añadir la dependencia.
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
