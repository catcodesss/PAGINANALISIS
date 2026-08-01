# ACIA — manual de marca

Análisis conductual asistido por IA.

Este documento es normativo: si algo de la interfaz lo contradice, es la interfaz
la que está mal. Vive en el repositorio y no en un chat para que dentro de un año
siga existiendo.

---

## 1. El nombre

**ACIA**, siempre en mayúsculas. Nunca "Acia" ni "acia": es una sigla, y
escribirla como palabra la convierte en otra cosa.

Se despliega como **análisis conductual asistido por IA**, en minúsculas, la
primera vez que aparece en cualquier texto largo.

### La homofonía, que es un activo

ACIA suena igual que *hacia* en todo el mundo hispanohablante: /ˈaθja/ en el
norte de España, /ˈasja/ en América y el sur peninsular. No es un accidente que
haya que disimular, es el significado gratuito de la marca. Un análisis funcional
orienta: dice hacia dónde.

De ahí sale el lema, que además es la definición exacta de lo que hace la
herramienta:

> **De la topografía hacia la función.**

Un psicólogo con formación conductual entiende el producto entero con esa frase.
Para público general, usa el desplegado: *análisis conductual asistido por IA*.

En seseo, ACIA también roza *Asia*. El interletraje amplio del logotipo empuja la
lectura hacia la sigla y neutraliza el eco; por eso no es opcional.

---

## 2. El símbolo

Un corchete que encierra tres líneas de texto, la del medio marcada.

Es lo que ACIA hace y ningún competidor puede decir: **recortar la línea exacta
de la nota**. No es una metáfora del bienestar ni del cerebro — es la operación
del producto. Por eso reemplaza a la hoja del logo anterior, que decía
*mindfulness* y no *rigor*.

### Archivos

```
public/images/logo-acia.svg             lockup completo (símbolo + logotipo)
public/images/isotipo-acia.svg          solo el símbolo, tres líneas
public/images/isotipo-acia-minimo.svg   una sola línea, para 24 px o menos
```

Los tres usan `stroke="currentColor"`, así que heredan el color del contexto: se
tiñen con CSS sin duplicar archivos.

### Normas de uso

- El símbolo va **a la izquierda** del logotipo, nunca encima ni debajo.
- Espacio libre alrededor: el ancho de un corchete por cada lado.
- Tamaño mínimo del lockup completo: 90 px de ancho. Por debajo, solo el símbolo.
- Por debajo de 24 px, la versión mínima: las líneas finas se empastan.
- No lo encierres en un círculo, no le añadas sombra, no lo inclines.
- Sobre fondo oscuro, el mismo archivo en blanco. No hay versión invertida aparte.

### La regla que ata la marca al producto

**El corchete es verde cuando lo que encierra está verificado.** En la interfaz,
una cita resuelta se muestra en verde y una inferencia en gris; el logotipo
comparte esa lógica. Es lo que hace que la marca signifique algo en vez de
decorar.

---

## 3. Color

```
Verde        #2E5E4E   la marca, y lo verificado
Verde oscuro #1C3830   barra lateral, superficies profundas
Verde suave  #EEF3F0   fondos de acento
Ámbar        #8A6D3B   lo que hay que revisar
Tinta        #1F2A28   texto principal
Tinta suave  #5C6B67   texto secundario
Línea        #E3E7E5   divisores
Lienzo       #F7F8F7   fondo de página
```

El verde no es decorativo: **todo el sector de salud mental es azul y lavanda**.
El verde oscuro lee como institucional y clínico, no como app de meditación, y
te separa de un vistazo en una captura de pantalla compartida entre colegas.

### Significado, no paleta

Los tres colores de estado tienen función semántica y no se usan para nada más:

- **Verde** — lo verificado. Citas resueltas, confianza alta.
- **Ámbar** — lo que hay que mirar. Datos faltantes, revisiones sugeridas,
  confianza media.
- **Gris** — lo inferido, lo que no se sostiene en la nota.

**Nada de rojo.** El rojo comunica *error del usuario*, y las alertas de ACIA no
son errores del clínico: son advertencias metodológicas sobre el informe. Un
psicólogo que ve rojo cree que hizo algo mal, y no es eso lo que se le dice.

---

## 4. Tipografía

```
Source Serif 4    títulos y cuerpo del informe
Inter             interfaz: botones, menús, formularios
IBM Plex Mono     etiquetas técnicas y datos del sistema
```

Las tres son libres y están en Google Fonts.

La serif es lo que hace que un informe parezca un informe. La combinación
serif + mono comunica *documento clínico y académico*, que es exactamente lo
contrario de lo que hacen los competidores, todos en sans redondeada y morado.

### La regla que enseña a leer el informe

**La mono marca lo verificable.** Si un texto está en mono, procede de la nota o
del validador: `Ed`, `R−`, `CONFIANZA: ALTA`, `De la nota · línea 7`. Si está en
serif, es redacción. El usuario aprende esa distinción en dos minutos sin que
nadie se la explique, y a partir de ahí sabe de un vistazo qué puede verificar.

### El logotipo

**ACIA** en Source Serif 4, peso 600, interletraje de 0.2 em. El interletraje es
lo que lo hace leer como sigla; sin él, se lee como palabra y aparece el eco de
*Asia*.

El archivo SVG usa `<text>` con la fuente por nombre. **Antes de imprimir o
mandar el logo a terceros, hay que convertir el texto a trazados** — si no, en un
equipo sin Source Serif 4 instalada se sustituye por Georgia y cambia el
logotipo. Cualquier diseñador lo hace en un minuto.

---

## 5. Voz

Sobria, específica, sin promesas.

**Nunca prometas precisión clínica. Presume de honestidad.** "No inventamos
citas" es un mensaje más fuerte, más defendible y mucho más difícil de copiar que
"análisis preciso con IA". Es además lo único que puedes sostener: los
validadores garantizan que el informe no afirme más de lo que la nota respalda,
no que la hipótesis sea correcta.

**Habla a un colega.** El interlocutor tiene formación conductual y el informe ya
está escrito en registro técnico. La comunicación debe sonar igual.

**Evita el vocabulario de wellness** — *acompañar, cuidar, bienestar, tu espacio
seguro*. Suena a coaching y contradice el producto.

### Ejemplos

| Sí | No |
|---|---|
| No escribe tus notas: analiza las que ya escribiste | Tu asistente inteligente de bienestar |
| Cada afirmación indica de qué línea sale | Análisis preciso con IA de última generación |
| Hipótesis para contrastar en sesión | Diagnóstico asistido |
| Revisiones sugeridas | Errores detectados |

### Cuidado legal

En publicidad sanitaria, tanto en España como en Perú, hay límites sobre lo que
se puede afirmar. No prometas resultados clínicos ni des a entender que la
herramienta evalúa o diagnostica. El descargo del informe está bien redactado:
que la comunicación externa diga lo mismo.

---

## 6. Posicionamiento

ACIA **no compite con los scribes**. Mentalyc, Upheal, Blueprint, Eholo, Moodo y
Psypilot hacen documentación: transcriben la sesión y la convierten en una nota
SOAP o BIRP. Eso es un trabajo administrativo, y venden ahorro de tiempo.

ACIA hace formulación. Vende **pensar mejor el caso**. Un psicólogo puede pagar
las dos cosas porque resuelven problemas distintos.

Dos ventajas que conviene no perder de vista:

**El marco conceptual es el nativo del mercado.** En la formación de psicología
en español, el análisis funcional es el marco de formulación por defecto: se
enseña en el grado. SOAP y BIRP son formatos de aseguradora estadounidense que no
significan nada aquí. Las herramientas anglosajonas traducidas nunca van a tener
eso.

**El diferencial es verificable.** Ningún competidor comprueba sus propias citas.
Esa es la frase de portada:

> No escribe tus notas: analiza las que ya escribiste. Y cada afirmación indica
> de qué línea sale, o dice que no sale de ninguna.

---

## 7. Pendiente

- [ ] Comprobar disponibilidad de dominio: `acia.app`, `acia.pe`, `usaacia.com`.
- [ ] Comprobar handles. Con cuatro letras, prepararse para `@acia.psi` o
      `@aciapsi`.
- [ ] Búsqueda de marca registrada: INDECOPI para Perú, EUIPO para España. ACIA
      es una sigla usada por otras entidades; suele haber convivencia en clases
      distintas, pero hay que mirarlo antes de imprimir nada.
- [ ] Convertir el texto del logotipo a trazados.
- [ ] Sustituir el icono de la hoja por el isotipo en `components/Sidebar.tsx`.
