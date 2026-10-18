# Fase 7 · Casos y sesiones

**Alta. Tamaño XL: empieza en modo plan.** Sin cambios de prompt. Requiere la
fase 3.

## Contexto

Lee `CLAUDE.md` (en `Desktop/`), `RELEVO.md`, `CAMBIOS.md` y
`Desktop/MONETIZACION.md` (sección 2: por qué el almacenamiento es local).
Diseño: `Claude outputs/mesa-clinica-acia.html` §C, §J.1 y §P.

Hoy cada análisis es un documento suelto. El historial (`lib/repositorio.ts`,
`lib/cifrado.ts`, `components/Historial.tsx`) guarda análisis cifrados en
IndexedDB, y la «referencia del caso» es un campo de texto libre. No hay
continuidad: una segunda sesión del mismo paciente es otro análisis
independiente.

Esta fase crea el **caso** como unidad de trabajo, con sus **sesiones**, sus
**notas inmutables**, un **historial de revisiones** por elemento y una
**versión de la formulación** por sesión. La IA todavía no actualiza nada: eso
es la fase 8. Aquí se construye el almacén y la navegación.

## Reglas

1. Sigue las reglas comunes de `Claude outputs/prompts-rediseno/00-orden-y-urgencia.md`.
2. **Local y cifrado.** Nada sale del navegador. El servidor no guarda nada.
   Mantén la interfaz de repositorio intercambiable (`MONETIZACION.md`: empezar
   por la opción A sin cerrar la B).
3. **El historial existente no se pierde.** Cada análisis guardado se convierte
   en un caso con una sesión. Si falla la migración de un análisis, ese análisis
   se conserva tal cual y se avisa.
4. **Sin datos identificables en el caso.** Solo alias y motivo. Si el alias
   parece un nombre completo o contiene datos que detecta `lib/pii.ts`, avisa.
5. **Una nota analizada es inmutable.** Las correcciones son anotaciones
   añadidas, con fecha.
6. **Invariante 6.** Cada revisión guarda su autor (IA o clínico). Lo que
   escribe el clínico sigue sin presentarse nunca como generado.
7. Pregúntame antes de añadir dependencias, por ejemplo `fake-indexeddb` para
   probar el repositorio.

## Sub-fase 7A · Modelo y almacén

- **Entidades:**

  ```
  Caso         { id, alias, motivo, fase: activo | en_pausa | archivado, creado, actualizado }
  Sesion       { id, caso_id, n, fecha, nota_ids, version_id | null, registro }
  Nota         { id, sesion_id, texto, anotaciones: { fecha, texto }[] }
  Revision     { id, caso_id, objeto_id, sesion_id, autor: ia | clinico, antes, despues, motivo, fecha }
  VersionFormulacion { id, caso_id, sesion_id, analisis }
  ```

  `VersionFormulacion.analisis` es la instantánea completa de
  `AnalisisFuncional` al cerrar la sesión.
- **Propón y justifica** la forma de guardar las versiones. La propuesta del
  diseño es una instantánea completa por sesión más un registro de revisiones
  por elemento. Es lo más simple y lo más robusto; la otra opción son
  instantáneas por punteros. Elige con números: tamaño de un análisis del
  caso 01 por siete sesiones.
- **Revisiones**: cada edición del clínico en el Mapa o en Blancos escribe una
  revisión. La pestaña Historial del Inspector las lista por sesión.
- **Repositorio**: amplía `lib/repositorio.ts` con `crearCaso`, `listarCasos`,
  `obtenerCaso`, `actualizarCaso`, `añadirSesion`, `guardarVersion`,
  `listarRevisiones(objeto_id)` y `obtenerVersion(sesion_id)`. Cifrado con
  `lib/cifrado.ts`, como hoy.
- **Respaldo**: exportar e importar incluyen casos, sesiones, notas, revisiones
  y versiones. Un respaldo antiguo se sigue pudiendo importar.
- **Migración** del historial, como se indica en la regla 3.

## Sub-fase 7B · Navegación

- **Navegación global** (`components/Sidebar.tsx`):
  - «Casos» sustituye a «Mis análisis»;
  - «Aprender» reúne «Guía de uso» y «Biblioteca clínica»;
  - «Cuenta» contiene Configuración, privacidad y respaldo;
  - acción primaria: «Nuevo caso».
- **Lista de casos**: alias, número de la última sesión y su fecha, blancos
  activos, preguntas abiertas y alertas. Filtros por fase. Orden por actividad
  reciente.
- **Nuevo caso**: alias y motivo opcional. Luego, el flujo de nota actual (PII,
  preguntas previas, analizar) como sesión 1.
- **Dentro del caso**: la cabecera de la fase 5 con el alias real, «Sesión N ·
  fecha» y el botón «Añadir sesión».
- **«Añadir sesión» en esta fase**:
  - guarda la nota y el registro (lo que se hizo, tareas revisadas) sin IA;
  - **no** lanza un análisis nuevo independiente, que crearía dos formulaciones
    divergentes del mismo caso. La actualización con IA llega en la fase 8.
  - Dilo en la interfaz.
- **Ver una versión anterior**: desde el Historial del Inspector, abre la
  formulación de la sesión N en modo lectura, con la franja «Viendo la
  formulación de la sesión N · Volver a la vigente».
- **Archivar un caso**: lo saca de la lista, sin borrarlo. Borrar pide
  confirmación en un modal y dice que no se puede deshacer.

## Fuera de alcance

La actualización con IA (fase 8), Preparar (fase 9), la vista Evolución
(fase 11), sincronización en servidor, cuentas.

## Verificación

- Las comprobaciones de las reglas comunes.
- **`evals/cifrado.test.mjs` entra en CI** (`RELEVO.md`, pendiente 5): en la
  lista de `CLAUDE.md`, en `RELEVO.md` y en `.github/workflows/evals.yml`.
- **Pruebas del repositorio**, o, si no hay forma de probar IndexedDB sin una
  dependencia, de la lógica pura que lo rodea:
  - migración del historial;
  - revisiones que solo se añaden;
  - la versión N se puede reabrir idéntica;
  - un respaldo antiguo importa;
  - una nota analizada no se puede editar.
- **Navegador**:
  - crear un caso, analizar la sesión 1, editar dos elementos, añadir la
    sesión 2 sin IA y ver las revisiones;
  - abrir la versión de la sesión 1 en modo lectura;
  - exportar e importar un respaldo y comprobar que todo vuelve.
