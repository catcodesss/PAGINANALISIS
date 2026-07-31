# 04 · Dirección causal y vulnerabilidad biológica real

Trampa: hay una vulnerabilidad biológica auténtica (tiroides) y varios productos del problema que no deben clasificarse como causas.

## NOTA

L., mujer de 41 años, con diagnóstico de hipotiroidismo desde hace cinco años, en tratamiento con levotiroxina. En la última analítica, hace tres semanas, su endocrinóloga encontró la TSH alterada y ajustó la dosis; la revisión es en dos meses.

Acude por bajo estado de ánimo. Sitúa el inicio hace tres meses, en la semana en que su empresa comunicó una reestructuración que afecta a su departamento. Desde entonces duerme entre cuatro y cinco horas, se despierta sobre las cuatro de la madrugada y ya no vuelve a dormirse. Ha perdido unos cuatro kilos porque, según dice, se le ha cerrado el estómago desde el anuncio.

Ha dejado de salir a caminar con una amiga los sábados, actividad que mantenía desde hacía dos años y que describe como lo único que la desconectaba. Dice que no le apetece y que prefiere quedarse en casa revisando el correo del trabajo por si hay novedades sobre la reestructuración. Comprueba el correo corporativo unas quince veces al día, también los fines de semana.

Su marido está en paro desde enero y ella refiere que ahora todo depende de su sueldo. No hay antecedentes psiquiátricos ni consumo de sustancias.

## COMPROBACIONES

```json
[
  {
    "id": "tiroides-como-biologica",
    "descripcion": "El hipotiroidismo con TSH alterada sí es una variable biológica y debe recogerse",
    "tipo": "debe_aparecer",
    "ambito": "biologic",
    "patron": "tiroid|levotiroxina|tsh"
  },
  {
    "id": "insomnio-no-es-causa",
    "descripcion": "El insomnio y la pérdida de peso son productos del cuadro, no vulnerabilidades biológicas",
    "tipo": "no_debe_aparecer",
    "ambito": "biologic",
    "patron": "insomnio|duerme|dormir|peso|apetito"
  },
  {
    "id": "precipitante-contextual",
    "descripcion": "La reestructuración laboral debe aparecer como contextual o precipitante",
    "tipo": "debe_aparecer",
    "ambito": "contextual|precipitante|moduladoras|situaciones",
    "patron": "reestructuracion|empresa|laboral|despido|trabajo"
  },
  {
    "id": "comprobacion-como-conducta",
    "descripcion": "Comprobar el correo quince veces al día es una conducta problema con función propia",
    "tipo": "debe_aparecer",
    "ambito": "conductas_problema",
    "patron": "correo|comprob|revis"
  },
  {
    "id": "derivacion-medica",
    "descripcion": "Debe señalarse la necesidad de coordinar con endocrinología antes de atribuir el cuadro solo a lo psicológico",
    "tipo": "debe_aparecer",
    "ambito": "datos_faltantes|lineas_de_intervencion|hipotesis_alternativas",
    "patron": "endocrin|medic|analitic|tiroid|derivac"
  }
]
```
