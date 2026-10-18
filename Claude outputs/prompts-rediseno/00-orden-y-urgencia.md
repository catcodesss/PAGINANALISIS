# Rediseño de ACIA — orden de las fases y cómo usar los prompts

Fuente: `Claude outputs/mesa-clinica-acia.html` (auditoría y rediseño, 04/10/2026).
Cada fase tiene su prompt en esta carpeta. Las secciones citadas (§A.4, §D.6…)
son de ese documento.

## Cómo usarlos

1. **Una fase por sesión de Claude Code**, abierta en `Desktop/ACIA`. Pega el
   prompt entero o escribe: «Lee `Claude outputs/prompts-rediseno/fase-NN-….md`
   y ejecútalo».
2. **Las fases marcadas XL, empiézalas en modo plan** (Shift+Tab dos veces).
   Revisa el plan antes de dejarle escribir código.
3. **No empieces una fase sin cerrar la anterior**: pruebas en verde y commit
   hecho. Varias fases suben `VERSION_ANALISIS`. Si se solapan, las migraciones
   chocan.
4. **Las fases que tocan el prompt necesitan crédito en OpenAI**: hay que correr
   las evals antes y después. Hoy la cuenta está sin crédito (`RELEVO.md`,
   pendiente 0). Si en la fase 2 no hay crédito, se para ahí.

## Orden por urgencia

| Fase | Qué resuelve | Urgencia | Tamaño | Prompt de IA | Necesita API |
|---|---|---|---|---|---|
| 1 | Seguridad clínica y verificar en la misma pantalla | **Urgente** | M | No | No |
| 2 | Citas por frase y cobertura de la nota | Alta | M | Sí (formato) | Sí |
| 3 | Apoyo en las relaciones y procedencia por elemento | Alta | L | Opcional (3B) | Solo 3B |
| 4 | Preguntas clínicas, hipótesis rivales y estados | Alta | L | Sí | Sí |
| 5 | Del informe al espacio de trabajo: Mapa, Inspector y Fuente | Alta | XL | No | No |
| 6 | Blancos: la cadena de ocho ranuras | Alta | L | Sí | Sí |
| 7 | Casos y sesiones | Alta | XL | No | No |
| 8 | Actualización por sesión | Alta | XL | Sí (nuevo) | Sí |
| 9 | Preparar y caso de ejemplo de tres sesiones | Media | M | No | Sí (una vez, para el ejemplo) |
| 10 | Nivel Caso: clases funcionales | Media | L | Sí | Sí |
| 11 | Evolución | Media | L | No (11B sí) | Solo 11B |
| 12 | Ayuda de razonamiento y microexplicaciones | Baja | M | No | No |
| 13 | Créditos, planes y cobro | Condicionada | XL | No | No |

### Ficheros

| Fase | Prompt |
|---|---|
| 1 | `fase-01-seguridad-y-verificacion.md` |
| 2 | `fase-02-citas-por-frase-y-cobertura.md` |
| 3 | `fase-03-apoyo-en-relaciones-y-procedencia.md` |
| 4 | `fase-04-preguntas-rivales-y-estados.md` |
| 5 | `fase-05-mapa-inspector-fuente.md` |
| 6 | `fase-06-blancos-cadena.md` |
| 7 | `fase-07-casos-y-sesiones.md` |
| 8 | `fase-08-actualizacion-por-sesion.md` |
| 9 | `fase-09-preparar-y-caso-ejemplo.md` |
| 10 | `fase-10-nivel-caso-clases-funcionales.md` |
| 11 | `fase-11-evolucion.md` |
| 12 | `fase-12-ayuda-de-razonamiento.md` |
| 13 | `fase-13-creditos-y-planes.md` |

### Por qué este orden

- **Fase 1 es urgente porque la herramienta puede inducir a error hoy.** Una
  relación inferida (el sueño) acaba de «por dónde moverla» con aspecto de dato
  citado. La alerta de la respiración no está en el nodo que señala. Los vacíos
  dicen que la nota no contiene cosas que sí contiene. No toca esquema ni prompt,
  así que se puede hacer ya y sin crédito.
- **Fases 2 a 4 son cimientos.** Todo lo que viene después (el cajón Fuente, la
  cobertura, la actualización entre sesiones, Preparar) se apoya en citas por
  frase, apoyo por relación, procedencia por elemento y preguntas como entidad.
  Hacer la interfaz antes obligaría a rehacerla.
- **Fases 5 y 6 arreglan lo que el usuario sufre hoy**: catorce sitios para una
  conducta y un plan lleno de huecos y huérfanos.
- **Fases 7 y 8 son la ventaja frente a un chat**: el caso que recuerda y se
  actualiza. Van después de 5 y 6 porque envuelven esa interfaz; no al revés.
- **Fases 9 a 11** convierten la persistencia en hábito semanal.
- **Fase 12** pule la experiencia del principiante sobre una estructura ya estable.
- **Fase 13** depende de dos cosas que no son código: el DPA y la retención cero
  con OpenAI (`Desktop/PENDIENTE.md` §1) y decidir si hay
  cuentas (opción A o B de `Desktop/MONETIZACION.md`).

### Dependencias

| Fase | Depende de |
|---|---|
| 1 | — |
| 2 | — (pero mide antes el prompt vigente) |
| 3 | 2 recomendado (las aristas citan frases) |
| 4 | 3 (no solapar migraciones) |
| 5 | 1, 3, 4 |
| 6 | 5 |
| 7 | 3 (procedencia y revisiones) |
| 8 | 2, 3, 4, 7 |
| 9 | 4, 7; el delta mejora con 8 |
| 10 | 5 |
| 11 | 7, 8 |
| 12 | 5, 6 |
| 13 | 8, DPA y retención cero, decisión de cuentas |

## Reglas comunes (cada prompt las repite en corto)

- Lee primero `CLAUDE.md` (en `Desktop/`), `RELEVO.md` y `CAMBIOS.md`. Los seis
  invariantes de `CLAUDE.md` mandan sobre cualquier prompt.
- Antes de tocar nada: `git status`. Si hay cambios sin commitear que no son
  tuyos, no los toques y pregunta.
- Antes de escribir código, resume en 5 a 10 líneas dónde vive lo que vas a
  cambiar. Si el prompt choca con el código, pregunta antes de improvisar.
- Nada se pierde: todo cambio de esquema sube `VERSION_ANALISIS` en uno y añade
  `migrarAV<n>` siguiendo el patrón de `migrarAV2` y `migrarAV3`
  (`lib/identidad.ts`). Migrar dos veces da lo mismo.
- Los ids los genera el servidor, nunca el modelo. Lo que no se resuelve queda
  en `null` y se ve como hueco.
- La IA propone y el terapeuta decide. Ningún texto nuevo transmite más certeza
  de la que da la nota. Nada de rojo (`MARCA.md`): la gravedad se marca con
  forma, peso y texto.
- Español en el código, comentarios que explican el porqué, cambio mínimo, sin
  dependencias nuevas sin preguntar, sin funciones fuera del encargo.
- Trabaja en sub-fases con commits pequeños. Para al final de cada una y
  enséñame el diff resumido y el resultado de las pruebas.
- Verificación en cada sub-fase: `npx tsc --noEmit`, todas las suites de
  `CLAUDE.md` y `RELEVO.md`, `npx eslint components lib app`. La lista de
  suites y `.github/workflows/evals.yml` tienen que decir lo mismo.
- Si cambia el prompt: evals antes y después con `npm run dev:evals` en una
  consola y `node evals/run.mjs --endpoint=http://localhost:3000/api/analizar`
  en otra. Temperatura 0,2, nunca `npm run dev`. Es PowerShell: no uses
  `VAR=x comando`. Los dos números van en el mensaje del commit.
- Si la fase cambia algo visible, compruébalo en el navegador con
  `npm run dev:maqueta` a 1280, 1600 y 375 px, en claro y oscuro, y sin errores
  de consola.
