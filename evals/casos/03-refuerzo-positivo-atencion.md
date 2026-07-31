# 03 · Refuerzo positivo (atención), no escape

Trampa: el contexto escolar no es aversivo. La contingencia está en lo que ocurre en casa.

## NOTA

D., 9 años, acude con su madre por dolor abdominal recurrente. El pediatra ha descartado causa orgánica tras dos exploraciones.

El dolor aparece las mañanas de días lectivos, entre las siete y media y las ocho. La madre cuenta que cuando D. dice que le duele la tripa, ella le deja quedarse en casa, avisa al colegio y se toma el día libre. Pasan la mañana juntos en el sofá viendo series, ella le prepara caldo y le lee un rato. Describe estas mañanas como los ratos más tranquilos que tienen juntos.

El padre trabaja fuera entre semana y vuelve los viernes. La madre trabaja a turnos y refiere que normalmente apenas coincide con D. despierto más de una hora al día.

En el colegio le va bien: notas por encima de la media, dos amigos estables con los que queda por las tardes, y una tutora que no ha observado nada llamativo. No hay indicios de acoso ni de dificultades académicas. D. dice que el colegio le gusta y que su asignatura preferida es Educación Física, que tiene los martes.

Los fines de semana y en vacaciones no ha habido ningún episodio de dolor. Tampoco los aparece los días que el padre está en casa por la mañana.

## COMPROBACIONES

```json
[
  {
    "id": "funcion-refuerzo-positivo",
    "descripcion": "La función debe formularse como refuerzo positivo (atención materna)",
    "tipo": "debe_aparecer",
    "ambito": "hipotesis_mantenimiento|funcion_hipotetizada|resumen",
    "patron": "refuerzo positivo|reforzamiento positivo|atencion"
  },
  {
    "id": "no-escape-escolar",
    "descripcion": "No debe cerrarse como evitación escolar: el colegio no es aversivo en la nota",
    "tipo": "no_debe_aparecer",
    "ambito": "funcion_hipotetizada",
    "patron": "escape|evitacion"
  },
  {
    "id": "usa-la-discriminacion",
    "descripcion": "Debe usar el dato diferencial de fines de semana / presencia del padre como evidencia",
    "tipo": "debe_aparecer",
    "patron": "fin(es)? de semana|vacaciones|padre"
  },
  {
    "id": "intervencion-sobre-el-entorno",
    "descripcion": "La intervención debe incluir cambio de contingencias por parte de la madre",
    "tipo": "debe_aparecer",
    "ambito": "lineas_de_intervencion|conductas_alternativas|consecuencia_necesaria",
    "patron": "madre|contingencia|atencion"
  }
]
```
