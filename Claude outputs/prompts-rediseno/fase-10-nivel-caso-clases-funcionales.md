# Fase 10 · Nivel Caso: clases funcionales

**Media.** Cambia el esquema y el prompt. Necesita crédito en OpenAI. Requiere
la fase 5; si ya existe la fase 8, la actualización también debe poder mover
conductas entre clases.

## Contexto

Lee `CLAUDE.md` (en `Desktop/`), `RELEVO.md` y `CAMBIOS.md`. Diseño:
`Claude outputs/mesa-clinica-acia.html` §E.4 (maqueta del nivel Caso de M.).

El nivel Caso responde «¿cuántos patrones hay y qué los une?». Agrupa las
topografías por función: es el lema de la marca, *de la topografía hacia la
función*, hecho pantalla. En M., ocho topografías caen en dos funciones
probables y dos quedan por determinar. La implicación clínica, intervenir sobre
la clase y vigilar que al bloquear una salida no crezca otra, hoy no se ve en
ninguna parte.

Sustituye a la «Red funcional» (`RedFuncionalSVG` en
`components/informe/mantenimiento.tsx`), que hace de vista general desde la
fase 5.

## Reglas

1. Sigue las reglas comunes de `Claude outputs/prompts-rediseno/00-orden-y-urgencia.md`.
2. **Las clases no se deducen comparando texto de funciones.** Las propone el
   modelo referenciando conductas por texto; el servidor las resuelve una vez en
   `lib/identidad.ts`. Lo que no resuelve va a «Función por determinar».
3. **Mover una conducta de columna es cambiar su hipótesis**: queda en el
   historial de revisiones como decisión del clínico.
4. **Apoyo de la clase**: el de su pertenencia más débil, nunca más alto.

## Sub-fase 10A · Esquema y prompt

- **Entidad nueva**:

  ```
  ClaseFuncional {
    id, funcion,
    miembros: { conducta_id, apoyo, evidencia }[]
  }
  ```

- **Prompt**: pide agrupar las conductas problema por función hipotetizada.
  - Cada pertenencia con su justificación y su referencia a la nota.
  - Una conducta sin consecuencia conocida va a «por determinar», no a la clase
    más parecida.
  - Ejemplo del caso 01: comer, baile, beber y reuniones como posible clase de
    escape de evaluación social, con «comer» sin consecuencia conocida.
- **`CAMPOS_ANALISIS_FUNCIONAL`**, normalizador, migración (los informes
  antiguos no tienen clases: todo a «por determinar», sin inventar) y
  `lib/bloques.ts` (¿siempre, o solo con cierto bloque? Propón y justifica por
  coste de tokens).
- Sube `VERSION_PROMPT`. Evals antes y después.
- **Comprobación nueva en el caso 01**: al menos tres topografías de evitación
  comparten clase.

## Sub-fase 10B · Interfaz

- **Nivel «Caso» en el selector del Mapa**, a la izquierda de Situación.
- **Columnas por clase**: nombre de la función, recuento y apoyo de la clase.
  Las topografías como fichas, con su referencia. Columna «Función por
  determinar» en borde discontinuo.
- **Franja «Contexto y moduladoras»**: acomodación, moduladoras y relaciones sin
  apoyo como huecos.
- **Franja «Costos y valores».**
- **Bucles** marcados, con el apoyo de su relación más débil.
- **Arrastrar una ficha a otra columna** cambia su clase, con deshacer.
- **Clic en una ficha** abre el nivel Situación con esa conducta enfocada.
- **Validador nuevo** (◆, determinista): «Otra conducta de la misma clase
  funcional está aumentando», cuando dos indicadores de conductas de la misma
  clase van en sentidos opuestos. Necesita datos de indicadores: si la fase 9 no
  está hecha, déjalo preparado y sin activar.
- **Móvil**: columnas apiladas.
- **Exportación**: una sección «Clases funcionales» en texto.

## Fuera de alcance

Gráficas de indicadores (fase 11).

## Verificación

- Las comprobaciones de las reglas comunes.
- **`evals/migracion.test.mjs`**: un informe sin clases migra a «por
  determinar», sin pérdidas.
- **Prueba nueva**: el apoyo de la clase es el mínimo de sus pertenencias.
- **Evals del prompt** antes y después.
- **Navegador**: el nivel Caso del ejemplo se lee en una pantalla a 1440 px; mover
  una ficha cambia su clase y queda en el historial.
