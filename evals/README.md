# Set de evals para ACIA

Batería de casos de prueba para medir si el análisis funcional mejora o empeora
cuando tocas el prompt. Sin esto, cada cambio es a ciegas.

## Instalación

Copia esta carpeta `evals/` a la raíz de tu proyecto. No necesita dependencias:
solo Node 18 o superior (usa `fetch` nativo).

## Uso

```bash
# contra tu app en local
node evals/run.mjs --endpoint=http://localhost:3000/api/analizar

# un solo caso, tres veces, para ver si el resultado es estable
node evals/run.mjs --caso=01 --reps=3

# sin gastar llamadas a OpenAI: puntúa un informe ya guardado
node evals/run.mjs --caso=01 --fixture=fixtures/01-v0.1.2.json
```

Opciones: `--endpoint`, `--campo` (clave del body, por defecto `nota`),
`--caso`, `--reps`, `--fixture`, `--pausa`.

Cada ejecución deja un JSON en `resultados/` para comparar antes y después.

## Qué mide

**1. Trampas por caso.** Cada nota lleva fallos plantados a propósito y una lista
de comprobaciones en su propio archivo. Dos tipos:

- `debe_aparecer` — el informe tiene que recoger algo (la rumiación, la pareja
  que gestiona por ella, el hipotiroidismo).
- `no_debe_aparecer` — el informe no debe cometer un error (proponer la
  respiración que ya era conducta de seguridad, meter el insomnio en variables
  biológicas, dar confianza alta a una nota de cuatro líneas).

El campo `ambito` limita la búsqueda a una parte del informe: es una expresión
regular sobre la ruta del dato, por ejemplo `conductas_problema` o `biologic`.
Sin `ambito`, busca en todo el informe.

Los patrones se comparan sin acentos y en minúsculas, así que escribe
`deficit` y encontrará `déficit`.

Con `"incluirRuta": true` el patrón se compara contra `ruta + valor` en vez de
solo `valor`. Sirve para comprobar una combinación (p. ej. "esta entrada está
etiquetada como biológica Y menciona el sueño") usando un ámbito amplio que
casi siempre está poblado — así un `no_debe_aparecer` verifica la ausencia de
verdad, en vez de pasar porque `ambito` no encontró nada que mirar.

**2. Integridad de citas.** Comprobación automática en todos los casos: cada
campo `evidencia` debe ser texto literal presente en la nota original. Es el
fallo más grave de la v0.1.2 y aquí queda cuantificado.

## Línea base (v0.1.2, caso 01)

```
Comprobaciones superadas: 2/10
Integridad de citas:      7/13 (54%)
```

Casi la mitad de lo que la interfaz muestra entre comillas como cita textual
no está en la nota. Ese es el número a mover primero.

## Los casos

| Caso | Qué pone a prueba |
|---|---|
| 01 ansiedad social | Caso de referencia: conducta encubierta, conducta de seguridad, refuerzo del entorno, dirección causal |
| 02 déficit de habilidad | Que no explique por evitación algo que es falta de repertorio |
| 03 refuerzo positivo | Que detecte atención materna como función, no escape escolar |
| 04 dirección causal | Que distinga vulnerabilidad biológica real (tiroides) de productos del cuadro (insomnio) |
| 05 citas literales | Que conserve las expresiones textuales del paciente sin parafrasear |
| 06 nota pobre | Control de exceso de confianza: no inventar con información insuficiente |
| 07 infantil, aula | Conducta con doble función (escape + atención) sin caer en una etiqueta diagnóstica |
| 08 pareja, contingencias entrelazadas | Ciclo interconductual demanda-retirada; acomodación de uno de los dos |
| 09 riesgo explícito | Campo `riesgo` poblado con los indicadores reales, sin inventar los que no están (principio 17) |

## Añadir un caso

Crea `casos/07-loquesea.md` con esta estructura:

```markdown
# 07 · Título

## NOTA

Texto de la nota clínica ficticia, en prosa.

## COMPROBACIONES

​```json
[
  {
    "id": "nombre-corto",
    "descripcion": "Qué debería hacer el informe",
    "tipo": "debe_aparecer",
    "ambito": "conductas_problema",
    "patron": "rumia|dar vueltas"
  }
]
​```
```

## Aviso sobre `[ámbito vacío]`

Si el runner marca `[ámbito vacío: revisa la ruta]`, significa que ninguna parte
del informe coincide con ese `ambito`. Un `no_debe_aparecer` con ámbito vacío
pasa sin mérito: probablemente el campo se llama de otra forma en tu respuesta.

## Coste

Cada ejecución completa son 6 llamadas a OpenAI (más si usas `--reps`). Usa
`--fixture` para probar cambios en las comprobaciones sin gastar nada.

**No uses notas de pacientes reales en esta carpeta.** Todos los casos son
ficticios y están pensados para vivir en el repositorio.
