# Fase 12 · Ayuda de razonamiento y microexplicaciones

**Baja en urgencia, alta en diferenciación para quien empieza.** Sin IA. Requiere
las fases 5 y 6.

## Contexto

Lee `CLAUDE.md` (en `Desktop/`), `RELEVO.md` y `CAMBIOS.md`. Diseño:
`Claude outputs/mesa-clinica-acia.html` §K.

La decisión de diseño es **un ajuste de ayuda, no dos modos**. «Principiante» y
«experto» etiquetarían a la persona, y acabarían siendo dos productos que
mantener. El ajuste se llama «Ayuda de razonamiento», con dos valores:
**Con explicaciones** y **Compacto**. Cambia la densidad y el andamiaje, nunca
la seguridad.

## Reglas

1. Sigue las reglas comunes de `Claude outputs/prompts-rediseno/00-orden-y-urgencia.md`.
2. **No cambian nunca con el ajuste**: alertas, grados de apoyo, huecos, riesgo,
   marcas de procedencia y exportación. Es el invariante 4 aplicado a la ayuda.
   Fíjalo con una prueba.
3. **El «¿Por qué?» de cada elemento existe con los dos valores.**
4. **Un popover a la vez.** Cada explicación automática aparece una sola vez por
   concepto, y todas tienen «No volver a mostrar». Lo recordado vive en
   `localStorage`, con `try/catch`, y su ausencia no rompe nada.
5. Los textos siguen la voz de `MARCA.md`: a un colega, sobrios, con el dato del
   caso, sin vocabulario de wellness.

## Sub-fase 12A · El ajuste

- **Preferencia** `ayudaRazonamiento: "explicaciones" | "compacto"` en
  `lib/preferencias.ts`, con su control en `components/Configuracion.tsx`. Por
  defecto, «Con explicaciones».
- **Diferencias:**

  | | Con explicaciones | Compacto |
  |---|---|---|
  | Revisión de la primera formulación | Cola paso a paso: una hipótesis por pantalla, su evidencia y «¿la confirmas?» | Lista con aceptación en lote, salvo las alertas ▲ |
  | Etiquetas | «Señal (Ed)», «Consecuencia inmediata» | «Ed», «C inm.», «R−» |
  | Nivel inicial del Mapa | Situación, con una conducta enfocada | Caso |
  | Huecos | Con la frase: «Falta: qué hace la supervisora cuando no expone» | Icono y texto al pasar el cursor |
  | Ranuras del blanco | Con pregunta guía: «¿Qué consecuencia mantendrá esta conducta?» | Solo el título |
  | Alertas | Mensaje, explicación y ejemplo mínimo | Mensaje |
  | «¿Por qué?» | Icono junto a cada término técnico | Al pasar el cursor o con la tecla ? |
  | Atajos de teclado | Se enseñan en los tooltips | Activos |

- **Una sola vez**, tras varias formulaciones aceptadas con pocas correcciones,
  ofrece pasar a Compacto. Si se rechaza, no vuelve a ofrecerse.

## Sub-fase 12B · Microexplicaciones

Un catálogo en un solo fichero (`lib/explicaciones.ts` o similar), con su
disparador y su texto. Cada texto usa datos del caso cuando los hay.

| Pregunta | Disparador |
|---|---|
| ¿Por qué es consecuencia y no antecedente? | Arrastrar un nodo entre carriles, o pasar por la etiqueta del carril |
| ¿Por qué esta intervención contradice la función? | Una alerta ▲ en una estrategia o alternativa |
| ¿Qué significa dato parcial? | Primer clic en una marca de apoyo |
| Esto es topografía; ¿cuál es la función? | El texto de una función coincide con el de una conducta |
| ¿Sobre qué relación actúa? | Crear una estrategia sin `actua_sobre` |
| ¿Déficit o interferencia? | La alternativa exige una habilidad que ya aparece en el repertorio activo |

Ejemplo del primero con M.: «Ocurre después de salir y depende de ello: *al
volver, la reunión ya había pasado a otro punto* (L3.4). Si ocurriera antes y la
hiciera más probable, sería antecedente.»

## Sub-fase 12C · Predecir antes de ver (opcional)

Solo con explicaciones, y desactivado por defecto. Antes de revelar la función
que propone la IA para una situación, pregunta «¿Qué función crees que tiene?»
con las opciones de `TipoContingencia` y «No lo sé». Luego muestra la propuesta
con su evidencia. No puntúa ni guarda aciertos.

Pregúntame si se construye antes de empezar.

## Fuera de alcance

Contenidos largos de formación (van a «Aprender»), cobro.

## Verificación

- Las comprobaciones de las reglas comunes.
- **Prueba de la regla 2**: los componentes que pintan alertas, apoyo, huecos,
  riesgo y procedencia no leen `ayudaRazonamiento`.
- **`evals/coherencia.test.mjs`**: los textos nuevos con `text-[Npx]` obedecen al
  tamaño de texto elegido.
- **Navegador**: los dos valores sobre el ejemplo; cada microexplicación salta
  con su disparador una sola vez; «No volver a mostrar» persiste.
