# Fase 2 · Citas por frase y cobertura de la nota

**Alta.** Cambia el formato de numeración que ve el modelo, así que **toca el
prompt** y necesita crédito en OpenAI para las evals.

## Contexto

Lee `CLAUDE.md` (en `Desktop/`), `RELEVO.md` y `CAMBIOS.md`. Diseño:
`Claude outputs/mesa-clinica-acia.html` §A.7, §A.9 y §E.6.

`numerarNota` (`lib/citas.ts`) corta la nota por saltos de línea. Los clínicos
escriben en párrafos, así que una «línea» suele ser un párrafo entero. En el
caso 01, `L3` es el episodio del martes completo, unas 125 palabras. Una «Cita
textual» de «Supervisora pide exponer resultados» resalta el párrafo entero: la
verificación es real, pero cuesta leer.

Además, nada enseña qué partes de la nota no usa ningún elemento del análisis.
En el caso 01 quedan fuera las visitas a urgencias, la rumiación, ocultárselo a
la supervisora, la pareja que llama por ella y el ascenso. «¿Se dejó algo de la
nota?» es la primera pregunta de `COLABORACION-CLINICA.md` a los revisores.

## Reglas

1. Sigue las reglas comunes de `Claude outputs/prompts-rediseno/00-orden-y-urgencia.md`.
2. **Invariante 1 intacto.** El modelo sigue sin escribir citas: devuelve
   referencias y el servidor recorta el texto real.
3. **Compatibilidad hacia atrás.** Los informes guardados con citas por línea
   siguen abriéndose y resaltando lo mismo que hoy.
4. **Invariante 5.** La cobertura se calcula en el cliente o en el servidor sin
   registrar la nota en ningún sitio.

## Paso previo · Medir el prompt vigente

`RELEVO.md` (pendiente 0) dice que los prompts 1.10.0 y 1.11.0 están sin medir.
Antes de cambiar nada, mide `HEAD` con `--reps=3` y apunta la puntuación, la
integridad de citas, el número de reglas verbales y los procesos ACT sin
justificación funcional. **Si la cuenta no tiene crédito, para y avísame**: sin
esta medida no se puede atribuir nada al cambio de esta fase.

## Sub-fase 2A · Segmentar por frases

- `numerarNota` numera frases dentro de cada línea: `[L3.2]`. Una línea vacía
  sigue contando, para que la numeración de líneas no cambie.
- **El segmentador de frases tiene que aguantar el español clínico.** Corta en
  `.`, `?`, `!` y `…` seguidos de espacio y mayúscula, `¿`, `¡` o `«`. No corta
  en:
  - iniciales: «M., mujer de 29 años»;
  - abreviaturas: «Dr.», «Sra.», «p. ej.», «etc.», «aprox.», «núm.», «pág.»;
  - números: «2.5 mg», «1.º»;
  - puntos dentro de comillas o paréntesis que no cierran la frase.

  Pruébalo con frases de los nueve casos de `evals/casos/`.
- El modelo devuelve `{ linea_inicio, frase_inicio?, linea_fin, frase_fin? }`.
  Sin frase, se toma la línea entera, como hoy.
- `Cita` guarda `frase_inicio` y `frase_fin` opcionales. `resolverCita` valida
  que existan y recorta el texto de esas frases.

## Sub-fase 2B · Prompt

- Describe el nuevo formato de referencia en `lib/systemPrompt.ts`, con un
  ejemplo, y pide la frase más estrecha que contenga lo afirmado.
- Sube `VERSION_PROMPT`.
- Corre las evals después, en las mismas condiciones que el paso previo.
- **La integridad de citas tiene que seguir en el 100 %.** Si baja, se para y se
  analiza antes de seguir.

## Sub-fase 2C · Interfaz y exportación

- Al pulsar una cita se resalta solo la frase o frases citadas, dentro de su
  línea.
- La referencia visible pasa a «L3.2». En el texto exportado: «De la nota ·
  línea 3, frase 2».
- **Cobertura determinista.** Recorre todas las `Cita` del análisis (conductas,
  repertorio, moduladoras, situaciones, acomodación, reglas, procesos ACT) y
  calcula qué frases no cita nadie.
  - En el panel de la nota: frases sin usar con fondo ámbar suave y el recuento
    «14 de 16 frases usadas».
  - Solo se muestran. Crear un nodo a partir de una frase llega en la fase 5.
  - La cobertura no va a la exportación.
  - Las frases vacías y las de pocas palabras no cuentan como sin usar. Explica
    el umbral que elijas.

## Fuera de alcance

Arrastrar frases a nodos, proponer qué hacer con las frases sin usar con IA,
apoyo en las aristas (fase 3).

## Verificación

- Las comprobaciones de las reglas comunes.
- **`evals/citas.test.mjs`**: añade casos para la segmentación (iniciales,
  abreviaturas, decimales, comillas), rangos que cruzan líneas, citas antiguas
  sin frase y frases que no existen (cita no verificada).
- **Prueba nueva de cobertura** sobre la nota del caso 01: urgencias (L1),
  «se lo ocultó a su supervisora» (L5) y el ascenso (L11) salen como frases sin
  usar con el fixture actual.
- **Evals antes y después** (paso previo y 2B), con los números en el commit.
- **Navegador:** una cita resalta una sola frase; la cobertura se ve en la nota.
