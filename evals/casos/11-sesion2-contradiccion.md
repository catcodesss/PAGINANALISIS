# 11 · Sesión 2 del caso 01: una contradicción

Varias sesiones (fase 8). La nota desmiente que pedir ir al baño se mantenga
por escapar de exponer: esta semana salió igual cuando no le tocaba hablar, y
expuso en la reunión grande sin salir. Esperado: evidencia en contra o
contradicción sobre la hipótesis de escape, y ningún «sostenida» para ella.

## FIXTURE

01-v0.1.2.json

## NOTA SESIÓN 2

Esta semana expuso en la reunión grande del lunes sin salir de la sala y sin pedir ir al baño.
En cambio, el jueves pidió ir al baño en una reunión en la que no le tocaba hablar y nadie le iba a preguntar nada. Dice que fue porque le dolía el estómago desde la mañana.
Cuenta que la exposición del lunes le salió bien y que no le dio más vueltas por la tarde.

## COMPROBACIONES SESIÓN 2

```json
[
  { "id": "evidencia-en-contra-escape", "tipo": "debe_proponer", "op": "añadir_evidencia|marcar_contradiccion|proponer_estado", "objetivo": "hipotesis", "postura": "en_contra" },
  { "id": "no-sostiene-escape", "tipo": "no_debe_proponer", "op": "proponer_estado", "objetivo": "hipotesis", "estado": "sostenida" },
  { "id": "confirmados-intactos", "tipo": "no_toca_confirmados" },
  { "id": "referencias", "tipo": "referencias_validas" },
  { "id": "citas", "tipo": "citas_validas" }
]
```
