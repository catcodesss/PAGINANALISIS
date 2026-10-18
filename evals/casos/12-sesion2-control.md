# 12 · Sesión 2 del caso 01: control sin cambios estructurales

Varias sesiones (fase 8). Una sesión de encuadre sin datos nuevos sobre las
conductas ni sus consecuencias. Esperado: ningún cambio de estado, ninguna
modificación ni creación. Como mucho, evidencia o preguntas.

## FIXTURE

01-v0.1.2.json

## NOTA SESIÓN 2

Sesión dedicada a explicar el modelo de trabajo y acordar los registros. Se revisó la hoja de registro y se resolvieron dudas sobre cómo rellenarla.
Acordamos vernos cada semana a la misma hora. No hubo incidencias que comentar.

## COMPROBACIONES SESIÓN 2

```json
[
  { "id": "sin-cambios-de-estado", "tipo": "no_debe_proponer", "op": "proponer_estado" },
  { "id": "sin-modificar", "tipo": "no_debe_proponer", "op": "modificar" },
  { "id": "sin-crear", "tipo": "no_debe_proponer", "op": "crear|marcar_contradiccion" },
  { "id": "confirmados-intactos", "tipo": "no_toca_confirmados" },
  { "id": "referencias", "tipo": "referencias_validas" },
  { "id": "citas", "tipo": "citas_validas" }
]
```
