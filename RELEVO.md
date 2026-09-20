# Estado del refactor del informe

**Las cuatro fases están hechas.** Este documento era el relevo para quien
siguiera con las fases 2 a 4; ahora es el estado, y lo que queda pendiente.

```
78feb42 La prosa se deriva del grafo, y solo afirma lo trazado   ← fase 4 + arreglos
f720029 Anadir lecturas DBT ACT y MC al grafo                     ← fase 3
10243c1 Convertir el bloque 2 en un grafo AFC editable            ← fase 2
2724833 De diecisiete secciones a cinco bloques                   ← fase 1
374487f Dar identidad estable a las entidades (esquema v2)        ← fase 0
```

El detalle de cada una está en `CAMBIOS.md`, que es el documento vivo. Lee
también `CLAUDE.md` (en `Desktop/`, no en el repo) antes de tocar nada.

## Verificación

```bash
npx tsc --noEmit
node --experimental-strip-types evals/citas.test.mjs        # 10
node --experimental-strip-types evals/pii.test.mjs          # 11
node --experimental-strip-types evals/razonamiento.test.mjs # 11
node evals/validadores.test.mjs                             # 46
node evals/reporteFallo.test.mjs                            #  7
node evals/coherencia.test.mjs                              # 20
node evals/maqueta.test.mjs                                 #  7
node evals/migracion.test.mjs                               # 19
npx eslint components lib app
```

131 pruebas. `eslint` da 0 errores y 1 warning preexistente en
`PanelRecomendaciones.tsx`. Esta lista y `.github/workflows/evals.yml` **tienen
que decir lo mismo**.

## Criterios de aceptación

| # | Criterio | Estado |
|---|---|---|
| 1 | Un JSON v1 se abre en v2 sin perder nada | ✅ |
| 2 | 5 bloques, ningún dato repetido | ⚠️ 5 bloques sí; «evitar exponer» bajó de 13 a 9 |
| 3 | Editar en el bloque 2 actualiza 3 y 4 sin API | ✅ |
| 4 | Borrar la flecha Ed→conducta ⇒ «no trazado» | ✅ verificado, con cascada a la OM |
| 5 | Clic en la franja resalta la línea de la nota | ✅ |
| 6 | Tres inferencias y un dato citado ⇒ no es confianza alta | ✅ `Math.min` |
| 7 | Cambiar de estilo: cero peticiones de red | ✅ verificado interceptando `fetch` |
| 8 | Editar en ACT y volver a AFC conserva el cambio | ✅ una sola copia |
| 9 | Un aviso del bloque 5 enlaza al nodo | ✅ |
| 10 | Cero errores de consola, 375 px, teclado | ✅ verificado en los tres estilos |
| 11 | `.docx` y print siguen funcionando, en AFC | ✅ |

Sobre el criterio 2: las 9 apariciones que quedan tienen cada una su propósito
—el nodo del grafo, el enunciado de la hipótesis, el destacado, la etiqueta del
dibujo, el ciclo escrito en palabras, el ranking y una pregunta que la
menciona—. Lo que se quitó eran copias literales del mismo dato.

## Lo que queda pendiente

1. **El prompt está en v1.6.0 y NO se ha medido.** Es lo más importante de esta
   lista. `CLAUDE.md` exige correr las evals al tocar el prompt y anotar los dos
   números en el commit; las fases 0 y 4 lo tocaron y no se hizo. La marca
   vigente (v1.2.0: 43/47, integridad de citas 100%) ya no es comparable.

   ```bash
   npm run dev:evals                                                 # consola 1
   node evals/run.mjs --endpoint=http://localhost:3000/api/analizar  # consola 2
   ```

   Nueve llamadas por corrida. La temperatura hay que fijarla o los números no
   se comparan: `dev:evals` la deja en 0,2, que es donde se midieron las marcas.
   **No uses `npm run dev` para medir**, que arranca a 0,5. Y es PowerShell: la
   sintaxis `VAR=x comando` de bash falla la asignación y ejecuta el resto
   igual, así que las evals correrían a la temperatura que no era.

2. **`capa_mc` se añadió como cuarto estilo sin consultarlo.** El encargo pedía
   preguntar. La decisión parece razonable —MC es una lectura más sobre las
   mismas entidades— pero conviene confirmarla, porque arrastra al validador V5
   y al campo `riesgo`, que venían en el mismo paquete (`CAMBIOS.md`, pendiente
   nº 1 histórico).

3. **`hayCamino` recorre también las aristas de tipo `bucle`.** El prototipo las
   excluía del cálculo de caminos. Podría hacer que la prosa derivada afirme una
   ruta que solo existe atravesando un bucle de realimentación. No hay un caso
   que lo demuestre; está sin verificar, no dado por roto.

4. **El eslabón DBT de tipo «acción» duplica la conducta.** En el grafo se
   pintan los dos («Pide ir al baño y evita exponer» sale dos veces en el bloque
   2). Es duplicación en los datos que genera el modelo, no en la interfaz.
   Resolverlo pide decidir si un eslabón «acción» que coincide con la conducta
   se deja de pintar, y eso es una heurística nueva.

5. **`evals/cifrado.test.mjs` no está en CI.** Precede a todo este trabajo, pero
   es la misma clase de fallo que `CLAUDE.md` documenta: una suite que existe y
   nadie ejecuta.

## Propuestas, no código

Siguen en `PLAN.md`: `ConductaProblema.modificabilidad` (hoy la priorización usa
la modificabilidad de la palanca, no la de la conducta), `dimension` +
`valor_basal` para «qué se mide» por conducta, `clase`
(`exceso|deficit|activo`), y los campos de ficha del prototipo.
