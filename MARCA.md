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

Una lupa que examina una cadena funcional: dos anillos —antecedente y
consecuencia— unidos a la lente por sus conectores. La lupa ocupa el lugar de la
conducta, que es el término focal del análisis: el que se explica. Los otros dos
son lo que se mira alrededor.

Dentro de la lente, un arco de brillo concéntrico con el borde. Concéntrico
importa: la luz rebota siguiendo la curvatura del cristal, así que el destello va
paralelo al canto y no cruzándolo.

### Archivos

```
public/images/logo-acia.svg      marca completa, recortada al dibujo: barra lateral
public/images/isotipo-acia.svg   cuadrado, solo la lente: avatares y usos pequeños
app/icon.svg                     el isotipo, que Next.js sirve como favicon
```

Fondo transparente en los dos: la marca va igual sobre la barra lateral oscura
que sobre papel.

### Normas de uso

- La marca completa es horizontal. Para contenedores cuadrados —avatares de
  redes, icono de aplicación— se usa **siempre el isotipo**, nunca la completa
  reducida: a esos tamaños los anillos y los conectores se convierten en manchas.
- Espacio libre alrededor: el radio de un anillo por cada lado.
- Tamaño mínimo de la marca completa: 120 px de ancho. Por debajo, el isotipo.
- No la encierres en un círculo, no le añadas sombra, no la inclines.
- El brillo va siempre en blanco sobre la lente verde. No se recolorea.

### Geometría, por si hay que redibujarla

Lente de radio 119 centrada en el origen. Anillos de radio exterior 41 y grosor
17,5, a 178 unidades a los lados y 100 por debajo del centro. Conectores y mango
de 18 de ancho. Brillo: arco de radio 78 y grosor 34, de 300° a 345°.

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

Los SVG de `public/images/` son solo el símbolo: no llevan texto. En la
aplicación el nombre lo pone la interfaz con la fuente ya cargada, así que ahí no
hay nada que resolver. **El día que se monte un lockup —símbolo + palabra en un
único archivo— hay que convertir el texto a trazados antes de mandarlo a
imprenta o a terceros**: en un equipo sin Source Serif 4 instalada, el navegador
sustituye por Georgia y el logotipo cambia. Cualquier diseñador lo hace en un
minuto.

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
- [ ] Convertir a trazados el texto ACIA cuando se monte el lockup para imprenta.
