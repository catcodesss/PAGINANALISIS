# 08 · Pareja, contingencias entrelazadas (demanda-retirada)

Trampa: el patrón de retirada de él y el patrón de acomodación de ella se
refuerzan mutuamente. Si el informe analiza solo a uno de los dos como "el
problema", pierde el ciclo interconductual completo.

## NOTA

R., varón de 35 años, consulta por conflictos de pareja. Cuenta que cuando su
esposa le reprocha que no ayuda con las tareas del hogar, él se queda callado
y sale de la habitación. Ella, al principio, sube el tono y lo sigue
reclamando, pero tras unos minutos deja de insistir. R. dice que salir de la
habitación "hace que la cosa se calme más rápido".

Con el tiempo, su esposa ha dejado de pedirle ayuda directamente: ahora hace
ella misma la mayoría de las tareas domésticas "para evitar la pelea",
aunque cuenta a R. que se siente cada vez más resentida y sola en la
relación. R. reconoce que discuten menos que antes, pero que últimamente
ella le habla menos en general, no solo cuando hay un reclamo pendiente.

R. dice que quiere que la relación mejore y que le gustaría poder hablar de
estos temas sin que "todo se vuelva una pelea".

## COMPROBACIONES

```json
[
  {
    "id": "identifica-retirada-como-escape",
    "descripcion": "Salir de la habitación debe analizarse como escape del reproche (refuerzo negativo para R.)",
    "tipo": "debe_aparecer",
    "ambito": "situaciones|hipotesis_mantenimiento",
    "patron": "escape|evitacion"
  },
  {
    "id": "acomodacion-de-la-esposa",
    "descripcion": "Que la esposa haga las tareas ella misma para evitar el conflicto debe registrarse como acomodación del entorno",
    "tipo": "debe_aparecer",
    "ambito": "acomodacion_entorno",
    "patron": "esposa|pareja"
  },
  {
    "id": "ciclo-mutuo-no-solo-culpa-a-uno",
    "descripcion": "Debe describirse como ciclo interconductual (la conducta de uno refuerza la del otro), no como un problema unilateral de R.",
    "tipo": "debe_aparecer",
    "ambito": "situaciones",
    "patron": "ciclo|mutu|ambos|reciproc|reforzando la (evitacion|retirada)|refuerza la (evitacion|retirada)"
  },
  {
    "id": "resentimiento-como-costo-largo-plazo",
    "descripcion": "El resentimiento y distanciamiento de la esposa debe aparecer como consecuencia a largo plazo, no perderse",
    "tipo": "debe_aparecer",
    "patron": "resentimiento|distanciamiento|distancia|habla menos"
  },
  {
    "id": "valores-relacion",
    "descripcion": "El deseo de R. de mejorar la relación y hablar sin pelear debe recogerse como valor o meta",
    "tipo": "debe_aparecer",
    "ambito": "valores_y_metas",
    "patron": "relacion|hablar|mejor"
  }
]
```
