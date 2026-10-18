# Fase 9 · Preparar y caso de ejemplo de tres sesiones

**Media.** Preparar no usa IA. El caso de ejemplo necesita unas pocas llamadas,
una sola vez, para generar sus fixtures. Requiere las fases 4 y 7; el delta
mejora con la 8.

## Contexto

Lee `CLAUDE.md` (en `Desktop/`), `RELEVO.md` y `CAMBIOS.md`. Diseño:
`Claude outputs/mesa-clinica-acia.html` §I (maqueta en teléfono, antes de la
sesión 4 de M.).

**Preparar** es la hoja de cinco minutos antes de atender, y la razón para
volver cada semana. Funciona solo si es gratis, instantánea y cabe en dos
pantallas de móvil.

**La maqueta** (`/maqueta`) es hoy el escaparate y enseña el informe v0.1.2, con
sus fallos. Para enseñar el producto nuevo hace falta un caso de ejemplo con
varias sesiones.

## Reglas

1. Sigue las reglas comunes de `Claude outputs/prompts-rediseno/00-orden-y-urgencia.md`.
2. **Preparar se deriva del estado del caso.** Ninguna llamada a la IA y ningún
   coste.
3. **Lo que el clínico anota en Preparar es texto suyo** (invariante 6): entra
   como evidencia en el siguiente análisis marcado como del clínico, y nunca se
   presenta como generado.
4. **El ejemplo nunca puede presentarse como el análisis de nadie.** Se conservan
   todas las garantías de `lib/maqueta.ts` y `evals/maqueta.test.mjs`: el doble
   candado, el aviso en la franja y la primera línea del texto copiado y del
   Word.

## Sub-fase 9A · Preparar

- **Vista por defecto** al abrir un caso con al menos una sesión.
- **Diseño primero para móvil**: una columna; en escritorio, centrada a unos 640 px.
- **Secciones, en este orden:**
  1. **Cabecera**: alias, número de sesión, fecha, días desde la última y riesgo.
  2. **En 30 segundos**: función principal (hipótesis de más peso y su estado);
     blancos activos con su último dato de indicador y una minigráfica si hay
     dos o más; tarea pendiente.
  3. **Al empezar**: tareas y exposiciones planificadas, con «Anotar datos» en
     línea.
  4. **Preguntar**: como mucho tres, ordenadas por valor de decisión. Cuenta
     más una pregunta que afecta a un blanco activo, la que desbloquea un plan
     que depende de ella y la que lleva sesiones sin respuesta. Cada una con
     «pone a prueba…» y «si responde X…». El clínico puede fijar y quitar.
     «Anotar respuesta» en línea.
  5. **Atención**: como mucho tres alertas ▲ o ◆, priorizando las de blancos
     activos.
  6. **Desde la última sesión**: el delta (+ − ~ ?) entre las dos últimas versiones.
- **Entidades mínimas nuevas**: `Tarea { id, blanco_id, descripcion,
  asignada_en, revisar_en, resultado }` y `Observacion { id, indicador_id,
  sesion_id, valor }`. Solo lo necesario para esta vista; las gráficas completas
  son de la fase 11.
- **Cada línea lleva a su sitio** en Mapa o Blancos.
- **Hoja imprimible** con CSS de impresión, en blanco y negro.

## Sub-fase 9B · Caso de ejemplo de tres sesiones

- **Notas**: la nota del caso 01 como sesión 1; la sesión 2 de la fase 8; y una
  sesión 3 coherente que puedes escribir tú. Enséñamela antes de usarla.
- **Fixtures generados por el producto real**:
  - sesión 1 con `/api/analizar`, a temperatura 0,2;
  - sesiones 2 y 3 con `/api/actualizar`;
  - aceptación de cambios guionizada en un script que deja constancia de qué se
    aceptó, qué se rechazó y qué se editó, con el clínico ficticio como autor de
    lo editado.
- **Si retocas algo a mano**, déjalo escrito en `nota_de_mantenimiento`, como el
  fixture actual.
- **`/maqueta`** pasa a mostrar el caso completo (Preparar, Mapa, Blancos y las
  versiones), estático y prerenderizado como hoy, sin leer del disco en
  producción y sin tocar OpenAI.
- **Antes de cambiar la ruta o borrar** `VistaEjemplo.tsx` o el bloque marcado de
  `Sidebar.tsx`, pregúntame: `CLAUDE.md` los describe como provisionales y tiene
  su plan para retirarlos.
- **Modo maqueta** (`npm run dev:maqueta`): `/api/analizar` y `/api/actualizar`
  devuelven los fixtures del ejemplo, con el mismo doble candado.

## Fuera de alcance

La vista Evolución (fase 11), la ayuda guiada (fase 12).

## Verificación

- Las comprobaciones de las reglas comunes.
- **Pruebas nuevas:**
  - orden de las preguntas por valor de decisión;
  - Preparar no importa nada que llame a la red (busca `fetch` en sus ficheros,
    como hace hoy `coherencia.test.mjs` con las lentes);
  - el delta entre dos versiones del fixture es el esperado.
- **`evals/maqueta.test.mjs`** ampliado: el aviso de ejemplo en las tres
  sesiones, en el texto copiado y en el Word; un informe normal no lo lleva.
- **Navegador** a 375 px: Preparar del ejemplo antes de la sesión 3 cabe en dos
  pantallas; anotar una respuesta la convierte en evidencia del clínico.
