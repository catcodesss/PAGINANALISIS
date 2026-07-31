# 02 · Déficit de habilidad, no evitación

Trampa: no hay activación ansiosa ni evitación. Si el informe lo explica por refuerzo negativo, está forzando su hipótesis favorita.

## NOTA

R., varón de 23 años, acude derivado desde un programa de inserción laboral. Lleva ocho meses buscando su primer empleo y ha acudido a cinco entrevistas, a todas ellas puntual y sin haber cancelado ninguna.

Describe la última entrevista con detalle. Cuando le preguntaron por sus puntos fuertes se quedó callado unos segundos y dijo que no lo sabía. Ante la pregunta de por qué quería el puesto respondió que necesitaba trabajar. El entrevistador acortó la entrevista. R. cuenta que no notó taquicardia ni sudoración, que no le preocupaba especialmente lo que pensaran de él, y que su problema es que no sabe qué se supone que hay que decir en esas situaciones.

Cuando se le pide que ensaye una respuesta en consulta, produce frases muy breves y no distingue entre describir una tarea y describir una competencia. No ha recibido nunca formación ni orientación sobre entrevistas. En su casa nadie ha trabajado por cuenta ajena.

En el resto de contextos sociales se maneja con normalidad: tiene un grupo estable de amigos, participa en un equipo de fútbol sala y no evita hablar en grupo. Duerme bien y no hay consumo de sustancias.

Dice que seguirá presentándose a entrevistas y que le gustaría saber cómo prepararlas.

## COMPROBACIONES

```json
[
  {
    "id": "identifica-deficit",
    "descripcion": "Debe formularse como déficit de repertorio, no como evitación",
    "tipo": "debe_aparecer",
    "ambito": "hipotesis|formulacion|conductas_problema|resumen",
    "patron": "deficit|repertorio|no dispone|carece de"
  },
  {
    "id": "no-inventa-evitacion",
    "descripcion": "La función hipotetizada no debe ser escape ni evitación: el paciente acude a todas las entrevistas",
    "tipo": "no_debe_aparecer",
    "ambito": "funcion_hipotetizada",
    "patron": "evitacion|escape"
  },
  {
    "id": "intervencion-por-adquisicion",
    "descripcion": "La intervención debe ser de adquisición (modelado, ensayo, moldeamiento), no de exposición",
    "tipo": "debe_aparecer",
    "ambito": "lineas_de_intervencion|conductas_alternativas",
    "patron": "model|ensayo conductual|moldeamiento|instruccion|entrenamiento"
  },
  {
    "id": "no-exposicion",
    "descripcion": "No debe proponerse exposición para un problema que no es de ansiedad",
    "tipo": "no_debe_aparecer",
    "ambito": "lineas_de_intervencion",
    "patron": "exposicion"
  }
]
```
