# 07 · Infantil, contingencias en el aula (control multi-función)

Trampa: la conducta disruptiva tiene dos funciones simultáneas (escape de la
demanda académica Y atención del adulto). Si el informe se queda con una sola,
pierde la mitad del mantenimiento. Además, no debe convertir una hipótesis
funcional en una etiqueta diagnóstica.

## NOTA

D., niño de 8 años, es derivado por su tutora por conducta disruptiva en el
aula. Refiere que cuando reparte fichas de matemáticas, D. empieza a gritar,
tira el lápiz al suelo y empuja la mesa. En la mayoría de los casos, la
profesora lo saca del aula unos minutos "para que se calme", y él deja de
gritar en cuanto sale al pasillo. En otras ocasiones, en lugar de sacarlo,
la profesora se sienta a su lado y le explica el ejercicio paso a paso; D.
también se calma en esos casos y termina completando parte de la ficha.

La tutora cuenta que D. no tiene este comportamiento en las asignaturas que
le gustan, como educación física o dibujo. Tampoco ocurre cuando trabaja en
parejas con su mejor amigo, aunque la tarea sea de matemáticas.

En casa, según refieren los padres, cuando D. se frustra con la tarea y
empieza a gritar, le dan la tablet "para que se distraiga y no siga
escalando". D. ha aumentado la frecuencia con la que pide la tablet ante
cualquier tarea que le cuesta.

No hay antecedentes médicos relevantes ni preocupaciones de seguridad.

## COMPROBACIONES

```json
[
  {
    "id": "identifica-escape-academico",
    "descripcion": "Debe identificar que sacarlo del aula funciona como escape de la demanda académica",
    "tipo": "debe_aparecer",
    "ambito": "situaciones|hipotesis_mantenimiento",
    "patron": "escape|evitacion"
  },
  {
    "id": "identifica-atencion-adulto",
    "descripcion": "Debe identificar la atención individualizada de la profesora como función de refuerzo positivo, no solo escape",
    "tipo": "debe_aparecer",
    "ambito": "situaciones|hipotesis_mantenimiento|hipotesis_alternativas",
    "patron": "atencion (individual|del adulto|de la profesora)|refuerzo positivo"
  },
  {
    "id": "no-diagnostica",
    "descripcion": "CRITICO: no debe asignar una etiqueta diagnóstica (TDAH, trastorno negativista) como si fuera una conclusión",
    "tipo": "no_debe_aparecer",
    "patron": "tdah|trastorno negativista|trastorno de conducta|diagnostic"
  },
  {
    "id": "contingencia-en-casa",
    "descripcion": "La tablet como reforzador de la frustración en casa debe aparecer, no quedarse solo en el aula",
    "tipo": "debe_aparecer",
    "patron": "tablet"
  },
  {
    "id": "discriminacion-por-tarea",
    "descripcion": "Debe usar el dato diferencial (no ocurre en educación física, dibujo, ni trabajando con su amigo) para descartar una explicación puramente atencional o de habilidad",
    "tipo": "debe_aparecer",
    "patron": "educacion fisica|dibujo|con su amigo|en pareja"
  }
]
```
