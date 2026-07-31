# 05 · Citas literales

Trampa: la nota contiene frases muy distintivas. Si el campo `evidencia` las devuelve alteradas, el modelo está parafraseando y presentándolo como cita.

## NOTA

J., varón de 35 años, acude por malestar en el trabajo. Al describir las reuniones de departamento dice textualmente que en ellas es un mueble que respira.

Cuenta que nunca pide ayuda a sus compañeros. Cuando se le pregunta por qué, responde que prefiere que le griten a tener que pedir algo. Explica que la última vez que pidió apoyo, hace dos años, su jefe de entonces le contestó delante de todos que para eso le pagaban.

Desde entonces asume tareas que no le corresponden y se queda hasta tarde. La semana pasada terminó un informe que era de otro compañero y no lo comentó con nadie. Dice que al entregarlo sintió que por fin respiraba, aunque al día siguiente le volvió el peso en el pecho.

Vive solo. No refiere consumo de sustancias. Duerme unas seis horas.

## COMPROBACIONES

```json
[
  {
    "id": "cita-mueble",
    "descripcion": "La expresión distintiva del paciente debe conservarse literal en alguna evidencia",
    "tipo": "debe_aparecer",
    "ambito": "evidencia|cita",
    "patron": "mueble que respira"
  },
  {
    "id": "cita-gritar",
    "descripcion": "La segunda expresión distintiva debe conservarse literal",
    "tipo": "debe_aparecer",
    "ambito": "evidencia|cita",
    "patron": "prefiero que me griten|que le griten"
  },
  {
    "id": "historia-de-aprendizaje",
    "descripcion": "El episodio con el jefe anterior debe aparecer como historia de aprendizaje",
    "tipo": "debe_aparecer",
    "ambito": "historia|aprendizaje|moduladoras|formulacion",
    "patron": "jefe|delante de todos|castigo"
  }
]
```
