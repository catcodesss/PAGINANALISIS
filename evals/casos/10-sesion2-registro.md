# 10 · Sesión 2 del caso 01: registro de dos reuniones

Varias sesiones (fase 8). Parte del informe guardado del caso 01
(`fixtures/01-v0.1.2.json`) y prueba `/api/actualizar` con la nota de la
sesión 2 (mesa clínica §J.2). Esperado: evidencia a favor del escape, el
antecedente pasa a depender del tamaño del grupo, la rival de déficit de
habilidad se debilita, la pregunta de la supervisora queda respondida en parte
y aparece una conducta nueva de la misma clase.

## FIXTURE

01-v0.1.2.json

## NOTA SESIÓN 2

Trae el registro de dos reuniones de la semana. En la primera, con tres personas, expuso los resultados sin problema. La supervisora le dijo «bien hecho» al terminar.
El lunes, en la reunión grande del equipo, volvió a pedir ir al baño antes de su turno. Al volver ya habían pasado a otro punto.
El miércoles también durmió mal.
Su pareja le propuso que llamara ella al seguro para resolver un trámite y no lo hizo; al final llamó él.

## COMPROBACIONES SESIÓN 2

```json
[
  { "id": "evidencia-escape", "tipo": "debe_proponer", "op": "añadir_evidencia", "objetivo": "hipotesis", "patron": "escape|evita|baño|alivio", "postura": "a_favor" },
  { "id": "antecedente-tamano-grupo", "tipo": "debe_proponer", "op": "modificar", "objetivo": "situacion", "patron": "grupo|grande|tamaño|personas" },
  { "id": "rival-deficit-debilitada", "tipo": "debe_proponer", "op": "proponer_estado", "objetivo": "rival", "estado": "debilitada" },
  { "id": "pregunta-respondida-en-parte", "tipo": "debe_proponer", "op": "responder", "objetivo": "pregunta" },
  { "id": "conducta-nueva-misma-clase", "tipo": "debe_proponer", "op": "crear", "patron": "seguro|llam|tel[eé]fono" },
  { "id": "no-descarta-escape", "tipo": "no_debe_proponer", "op": "proponer_estado", "objetivo": "hipotesis", "estado": "descartada" },
  { "id": "confirmados-intactos", "tipo": "no_toca_confirmados" },
  { "id": "referencias", "tipo": "referencias_validas" },
  { "id": "citas", "tipo": "citas_validas" }
]
```
