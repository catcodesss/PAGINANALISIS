# Fase 11 · Evolución

**Media.** 11A no usa IA. 11B (resumen para supervisión) toca un prompt nuevo y
es opcional. Requiere las fases 7 y 8.

## Contexto

Lee `CLAUDE.md` (en `Desktop/`), `RELEVO.md` y `CAMBIOS.md`. Diseño:
`Claude outputs/mesa-clinica-acia.html` §J.3 (matriz de hipótesis por sesiones
e indicadores con minigráfica).

Con casos, versiones y actualizaciones, ya se puede responder «¿qué pensábamos
en la sesión 2 y qué sabemos en la 7?». Esta fase lo hace visible sin abrir
nada.

## Reglas

1. Sigue las reglas comunes de `Claude outputs/prompts-rediseno/00-orden-y-urgencia.md`.
2. **Todo se deriva de versiones y revisiones.** Nada se recalcula con IA en 11A.
3. **Las gráficas, a escala**: un solo eje por gráfica, etiquetas que nombran
   valores reales, colores de los tokens del tema. Sin rojo.
4. **Los estados son los de la fase 4.** Nada de «confirmada».

## Sub-fase 11A · Vista Evolución

- **Cuarta vista del caso**, junto a Preparar, Mapa y Blancos.
- **Matriz de hipótesis por sesiones**:
  - una fila por hipótesis, incluidas las rivales y las descartadas (atenuadas);
  - en cada celda, el estado en esa sesión y el cambio de evidencia (+1, −1);
  - al final, el estado actual;
  - clic en una celda: abre esa versión en modo lectura (fase 7).
- **Indicadores**:
  - una fila por blanco, con los valores por sesión y una minigráfica;
  - línea de fase (línea base, intervención) cuando el clínico la marca;
  - marcar una fase es una decisión del clínico, con revisión;
  - entrada de datos por sesión, si la fase 9 no la dejó completa.
- **Comparar dos versiones**: elegir dos sesiones y superponerlas en el Mapa:
  - lo añadido, con contorno y píldora de sesión;
  - lo retirado, como fantasma tachado;
  - lo cambiado, con ✎ y el antes y el después en el Inspector.

  Funciona en los niveles Caso y Situación.
- **El delta de sesión** (+ − ~ ?) se convierte en componente compartido con
  Preparar.
- **Activa el validador de la fase 10** («otra conducta de la misma clase
  funcional está aumentando») si quedó preparado.
- **Exportación**: una sección «Evolución» con la matriz en texto y los valores
  de los indicadores.

## Sub-fase 11B · Resumen para supervisión (opcional, prompt)

Pregúntame antes de empezar.

- **Contenido**: la evolución del caso en una página (hipótesis, cambios, datos y
  dudas abiertas).
- **Entrada**: solo el estado del caso (versiones, revisiones, indicadores), no
  las notas en bruto. Así no puede afirmar nada que no esté en la formulación.
- **Toda frase lleva su referencia** a una revisión o a una cita existente. El
  servidor descarta lo que no la tenga.
- **Endpoint y prompt propios**, con su versión. Coste rotulado (1 crédito)
  hasta la fase 13.
- **El texto generado se marca como generado** y es editable. Lo editado se marca
  como del clínico.

## Fuera de alcance

Revisión profunda del caso completo desde las notas en bruto (decidir aparte),
el cobro.

## Verificación

- Las comprobaciones de las reglas comunes.
- **Pruebas nuevas:**
  - con el ejemplo de tres sesiones, la matriz da los estados esperados;
  - la comparación de las sesiones 1 y 3 lista exactamente lo añadido, lo
    retirado y lo cambiado;
  - la minigráfica no se dibuja con menos de dos datos.
- **Navegador**: la Evolución del ejemplo en claro y oscuro, a 1440 y a 375 px
  (la matriz con scroll horizontal propio, nunca la página).
