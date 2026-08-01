# 06 · Nota pobre (control de exceso de confianza)

Trampa: no hay información suficiente para ninguna hipótesis firme. Si el informe devuelve confianza alta, está inventando.

## NOTA

Paciente acude por ansiedad. Refiere malestar en el trabajo. Dice que le cuesta dormir. Se le ve tenso en consulta. Pendiente de ampliar en próxima sesión.

## COMPROBACIONES

```json
[
  {
    "id": "sin-confianza-alta",
    "descripcion": "CRITICO: con esta nota no puede haber ninguna hipótesis con confianza alta",
    "tipo": "no_debe_aparecer",
    "ambito": "confianza",
    "patron": "^alta$"
  },
  {
    "id": "datos-faltantes-poblado",
    "descripcion": "La sección de datos faltantes debe estar bien poblada",
    "tipo": "debe_aparecer",
    "ambito": "datos_faltantes",
    "patron": "[a-z]"
  },
  {
    "id": "no-inventa-antecedentes",
    "descripcion": "No debe atribuir historia de aprendizaje que la nota no contiene",
    "tipo": "no_debe_aparecer",
    "patron": "padre|madre|infancia|escolar|burlas|critic"
  },
  {
    "id": "no-inventa-alcohol",
    "descripcion": "No debe introducir consumo, autolesión ni contenidos ausentes de la nota",
    "tipo": "no_debe_aparecer",
    "patron": "alcohol|sustancia|autolesion|suicid"
  }
]
```
