# Fase 5 · Del informe al espacio de trabajo: Mapa, Inspector y Fuente

**Alta. Tamaño XL: empieza en modo plan.** Solo interfaz: sin cambios de prompt.
Requiere las fases 1, 3 y 4.

## Contexto

Lee `CLAUDE.md` (en `Desktop/`), `RELEVO.md` y `CAMBIOS.md`. Diseño completo:
`Claude outputs/mesa-clinica-acia.html` §B, §C, §D y §E. Las maquetas de §D
(espacio de trabajo) y §E.5 (nivel Clínico) son la referencia visual.

Hoy el análisis se reparte en cinco pestañas (`components/informe/pestanas.tsx`):
Análisis funcional, Resumen, Formulación, Plan y Revisión. Una sola conducta
aparece en catorce sitios. Sumando las pestañas son unos 12.800 px de alto a
1600 px. La formulación principal es la hipótesis 1 copiada. Los controles
(Revisión) están lejos de lo que controlan.

Esta fase sustituye las pestañas por dos vistas, **Mapa** y **Blancos**, con una
cabecera, un raíl izquierdo, un Inspector derecho y un cajón «Fuente» con la
nota. Evolución llega en la fase 11; Preparar (fase 9) irá en otro apartado, no
como pestaña del análisis. Mientras no exista el
caso (fase 7), la cabecera muestra la referencia actual.

## Reglas

1. Sigue las reglas comunes de `Claude outputs/prompts-rediseno/00-orden-y-urgencia.md`.
2. **No desactives los chequeos de compilación.** `IdSeccion` y
   `CAMPOS_ANALISIS_FUNCIONAL` siguen mandando. Si las vistas nuevas no encajan
   en `lib/secciones.ts`, rehaz `lib/secciones.ts`; no ensanches el tipo a `string`.
3. **La exportación no pierde nada.** El Word, el texto copiado y el impreso
   siguen saliendo completos, ahora leyendo del estado, con AFC como base. La
   prosa de las hipótesis se genera solo al exportar.
4. **Las alertas, los grados de apoyo, los huecos y el riesgo siguen siempre
   visibles.** Moverlos no puede esconderlos.
5. **Trampa de Tailwind v4** (`CLAUDE.md`): no escribas reglas cuyo selector
   esté hecho de nombres de utilidades, y deja las anulaciones de tamaño fuera
   de `@layer`. `evals/coherencia.test.mjs` lo vigila.
6. **La maqueta (`/maqueta`, `VistaEjemplo.tsx`) usa la misma vista** y conserva
   el aviso de ejemplo en la franja, el texto copiado y el Word
   (`evals/maqueta.test.mjs`).

## Sub-fase 5A · Estructura

- **Vistas**: «Mapa» y «Blancos». El contenido actual del Plan pasa a Blancos
  tal cual; la fase 6 lo rehace.
- **Cabecera**: referencia del caso, chip de riesgo con tres estados, contador
  de alertas ▲ y ◆ (las sugerencias no cuentan) que abre una bandeja que salta
  de una a otra, y «Exportar ▾» con Copiar, Word e Imprimir. Fuera las tres
  acciones primarias de hoy.
- **Raíl izquierdo** (240 px, plegable): conductas con su apoyo; hipótesis con
  su estado; blancos con su fase; preguntas abiertas; recursos y valores;
  «Historia» (hipótesis de origen, con su sello de no modificable); «Contexto»
  (resumen clínico). Clic en un elemento: lo enfoca en el Mapa.
- **Inspector derecho** (380 px, fijo, con scroll propio), con tres pestañas:
  Detalle, Evidencia e Historial (la última vacía hasta la fase 7). Sustituye a
  la Ficha.
- **Cajón «Fuente»** abajo (40 px plegado, 35 % de alto abierto): la nota con
  frases numeradas y la cobertura de la fase 2. Pulsar una cita lo abre y
  resalta la frase. Pulsar una frase enseña qué elementos la usan.
- **Se retiran** Resumen y Revisión:
  - formulación principal y tres prioridades se eliminan (repetían);
  - riesgo a la cabecera;
  - preguntas al raíl y al Inspector;
  - puntos a verificar → insignias en los elementos y bandeja;
  - datos faltantes → nodos hueco y preguntas;
  - hipótesis alternativas → Inspector de su hipótesis;
  - la leyenda de apoyo → popover en la barra del Mapa.
- **Responsivo**: por debajo de 1440 px, el raíl se pliega a iconos. Por debajo
  de 1024, el Inspector pasa a cajón inferior. En móvil, el mapa se apila.

## Sub-fase 5B · El Mapa

- **Selector de nivel**: Situación · Clínico · Evidencia. El nivel Caso llega en
  la fase 10; mientras tanto, la red funcional actual (`RedFuncionalSVG`, en
  `components/informe/mantenimiento.tsx`) hace de vista general, con aristas
  inferidas discontinuas.
- **Situación** (por defecto, con una conducta enfocada):
  - Ed → conducta → consecuencia;
  - **la función va como etiqueta del arco conducta → consecuencia**, con tipo
    de contingencia, inmediatez y el apoyo de esa relación. No es una caja ni
    una fila final;
  - la OM en una banda encima, con trazo hacia el arco («aumenta el valor de…»);
  - el costo demorado debajo de la conducta;
  - los huecos (preguntas abiertas que afectan a la situación) como nodos
    punteados;
  - la capa Plan (alternativa → consecuencia que la mantendría) en una banda
    aparte, con otro fondo.
- **Clínico**:
  - EC → RC como subpista respondiente;
  - los eslabones DBT **dentro** del nodo conducta, como «cadena interna»
    numerada, no como tarjetas en la columna Conducta;
  - un eslabón «acción» que repite la conducta se funde con ella
    (`RELEVO.md`, pendiente 4). Propón el criterio antes de aplicarlo;
  - reglas verbales sin comillas cuando son inferidas, esquema de contingencia,
    moduladoras y acomodación.
- **Evidencia**: apoyo y frase de origen en cada nodo y cada arista; aristas
  inferidas discontinuas; franja de cobertura.
- **Capas** (no estilos), cada una con su contador y desactivada si es cero:
  - Plan y Huecos;
  - DBT: numeración y puntos de solución sobre la cadena interna;
  - ACT: solo procesos anclados y con justificación funcional, en un recuadro
    «Interpretación · ACT» del Inspector. Los procesos sin anclar pasan a un
    contador;
  - la Matrix ACT queda como vista alternativa (botón «Ver como Matrix»).

  `useLente.ts` y la preferencia por caso se adaptan; un valor guardado que ya
  no existe cae al valor por defecto.
- **Selección**: resalta la ruta del elemento y atenúa el resto al 35 %; el
  Inspector carga; el raíl lo marca; la Fuente salta a la frase; la URL cambia a
  `?foco=<id>`. `Esc` lo deshace.
- **Las aristas se pueden seleccionar.** Inspector de relación: tipo, función si
  es contingencia, apoyo, evidencia a favor y en contra, hipótesis y blancos que
  la usan.
- **Leer como texto**: lista lineal de la ruta seleccionada, para lectores de
  pantalla y para quien prefiera leer.
- **Teclado**: 1 a 3 cambian de nivel; las flechas recorren las aristas; F abre
  la Fuente.

## Sub-fase 5C · Edición y procedencia visibles

- **Fuera los botones EDITAR y BORRAR de cada línea.** Los campos del Inspector
  parecen texto y se editan al hacer clic. Doble clic en la etiqueta de un nodo,
  como hoy.
- **Menú contextual** del nodo: Confirmar, Convertir en pregunta, Ver evidencia,
  Crear blanco (deshabilitado hasta la fase 6) y Borrar.
- **Arrastrar una frase de la Fuente** a un nodo o una arista añade una cita
  verificada, porque el texto es de la nota. Recalcula el apoyo.
- **Desde la cobertura**, una frase sin usar se puede convertir en conducta,
  acomodación, valor o moduladora, en el carril que elija el clínico.
- **Arrastrar un nodo a otro carril** lo reclasifica, solo entre carriles
  compatibles, con deshacer.
- **Procedencia** (fase 3): borde discontinuo y marca «IA» para lo propuesto sin
  revisar; ✓ confirmado; ✎ editado (al pasar el cursor, el original); «tuya»
  para lo creado.

## Fuera de alcance

Casos y sesiones (fase 7), la cadena de ocho ranuras (fase 6), el nivel Caso
(fase 10), la ayuda guiada (fase 12), cambios de prompt.

## Verificación

- Las comprobaciones de las reglas comunes, al final de cada sub-fase.
- **`evals/coherencia.test.mjs`** al día con las vistas nuevas: ninguna vista en
  el índice que nadie pinte; ningún bloque fuera de la lista.
- **Prueba nueva**: cada alerta del fixture del caso 01 tiene un elemento
  visible donde se pinta su insignia.
- **Prueba nueva**: la exportación del fixture no pierde secciones respecto a la
  de antes de la fase. Compara las cabeceras del texto copiado.
- **Navegador**, con `npm run dev:maqueta` y `/maqueta`, a 1440, 1280, 1024 y
  375 px, en claro y oscuro, y con teclado:
  - responder «¿qué mantiene salir al baño?» sin cambiar de vista;
  - la alerta de la respiración en su nodo;
  - una cita que abre la Fuente en su frase;
  - una frase arrastrada que se convierte en cita;
  - cero errores de consola y cero peticiones de red al cambiar de nivel o de capa.
