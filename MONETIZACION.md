# Almacenamiento y plan premium

Análisis de producto para convertir el guardado de notas en una función de pago.
No soy abogado: los puntos legales son señalamientos de riesgo, no asesoría.

---

## 1. Lo primero, porque cambia todo lo demás

Ahora mismo la propiedad más valiosa de ACIA es que **no guarda nada**. Es lo que
permite decir en la interfaz que las notas no se almacenan, y es lo que hace que
un psicólogo pueda probar la herramienta sin plantearse nada.

En el momento en que guardas notas clínicas dejas de ser un intermediario y pasas
a ser **responsable del tratamiento de datos de categoría especial** (salud, art. 9
del RGPD). Eso no es una casilla más: implica

- cifrado en reposo y en tránsito,
- política de retención escrita y aplicada,
- derecho de supresión efectivo (borrar de verdad, incluidas copias de seguridad),
- notificación de brechas en 72 horas,
- registro de actividades de tratamiento,
- y, si vendes a clínicas, contratos de encargado con cada una.

Un solo incidente con notas de pacientes reales no es un bug: es un problema
serio para ti y para los clínicos que confiaron. **Esta decisión es de negocio
antes que técnica**, y conviene tomarla con asesoría legal, no solo con criterio
de producto.

Dicho esto, guardar es lo correcto para el producto: un análisis funcional sin
línea base ni medida de cambio se queda a mitad de camino. La pregunta no es si
guardar, sino **dónde**.

## 2. Dos arquitecturas posibles

### Opción A · Local-first (el navegador del clínico)

Los análisis se guardan cifrados en el dispositivo del usuario (IndexedDB), con
una clave derivada de una contraseña que él elige. El servidor nunca ve una nota
guardada.

**A favor**

- No te conviertes en responsable del tratamiento de datos de salud. El riesgo
  legal se reduce drásticamente.
- Puedes lanzarlo en semanas, no en meses.
- Es un argumento de venta fuerte y honesto para este público: *"tu historial no
  sale de tu ordenador"*. A un psicólogo eso le dice mucho.
- Si el usuario pierde la clave, no puedes recuperar los datos — lo cual es
  incómodo, pero también es la garantía.

**En contra**

- No sincroniza entre dispositivos. El del portátil no está en el del consultorio.
- Se pierde si formatea o cambia de equipo, salvo que exportes/importes un fichero
  de respaldo (fácil de implementar, hay que educar al usuario).
- Cuesta más justificar una suscripción recurrente por algo que corre en su máquina.
  Se resuelve, pero el argumento es menos evidente.

### Opción B · Servidor (base de datos propia)

Cuentas, autenticación y almacenamiento cifrado en tu infraestructura.

**A favor**

- Sincronización entre dispositivos, cuentas de equipo, panel de clínica.
- Recuperación de contraseña, respaldo, continuidad.
- El modelo de suscripción se justifica solo.
- Es la única vía si algún día quieres vender a centros o gabinetes.

**En contra**

- Asumes todo lo del punto 1. Sin excepciones.
- Necesitas autenticación real, cifrado, respaldos, borrado verificable, y una
  política de privacidad escrita en serio.
- Coste fijo de infraestructura desde el primer usuario.
- Meses, no semanas.

### Camino intermedio recomendado

Empieza por **A** y deja la puerta abierta a **B**. Si diseñas el guardado con una
interfaz de repositorio (`guardarAnalisis`, `listarCasos`, `obtenerHistorial`)
puedes cambiar la implementación de IndexedDB a servidor sin tocar la interfaz de
usuario. Validas si la gente paga antes de asumir la carga regulatoria.

## 3. Qué NO debe ser nunca de pago

Esto es lo más importante de este documento.

**Las funciones de seguridad clínica no se cobran.** Concretamente: las citas
verificables, los validadores y sus alertas, la sección de datos faltantes y el
descargo de responsabilidad.

La razón es sencilla: si un usuario gratuito recibe un informe donde las citas no
están verificadas y nadie le avisa de que se le está proponiendo una conducta de
seguridad como intervención, le estás dando un producto clínicamente peor a quien
menos puede pagar. Y el daño no lo sufre él, lo sufre su paciente.

Además, comercialmente es un error: esas funciones son tu diferencial. Que las vea
todo el mundo es lo que hace que la herramienta se recomiende.

## 4. Reparto de funciones

### Gratis — suficiente para demostrar que funciona

- Análisis funcional completo, con las tres capas (ACT, DBT, MC)
- Citas verificables y validadores, **siempre**
- Copiar e imprimir el informe
- Un número limitado de análisis al mes (3–5). El límite es natural: cada análisis
  te cuesta tokens.
- Reanálisis por sección, limitado

### Premium — lo que convierte la herramienta en instrumento de trabajo

Ordenado por lo que más justifica una suscripción:

1. **Historial de casos.** Guardar por referencia, buscar, reabrir. Es la función
   que pediste y la que más se echa en falta: hoy cierras la pestaña y se pierde.

2. **Seguimiento longitudinal.** Varios análisis del mismo caso a lo largo del
   tiempo, con comparación: qué conductas problema siguen, cuáles desaparecieron,
   cómo cambió la función hipotetizada, qué datos faltantes se resolvieron. Esto
   es lo que ningún competidor genérico de "IA para psicólogos" hace, porque
   requiere entender que un análisis funcional es una medida repetida, no un
   documento. **Es tu mejor argumento de venta.**

3. **Edición manual con trazabilidad.** Corregir, borrar y añadir a mano, con
   marca de qué es generado y qué es del clínico. Sin esto, el profesional no
   puede hacer suyo el informe. Va en premium porque implica persistencia.

4. **Exportación profesional.** DOCX y PDF con membrete propio, nombre del
   profesional y número de colegiado. Un informe que se puede adjuntar a una
   derivación o llevar a supervisión vale dinero.

5. **Análisis ilimitados** y reanálisis sin tope.

6. **Informe de evolución entre sesiones.** Generado a partir del historial: qué
   ha cambiado desde el análisis anterior y qué hipótesis se confirmaron. Es un
   producto nuevo que solo existe si hay persistencia.

7. **Plantillas y preferencias.** Modalidad por defecto, formato de informe,
   vocabulario preferido.

### Plan clínica / equipo (más adelante)

- Varios profesionales con facturación conjunta
- Compartir un caso anonimizado con un supervisor
- Biblioteca de casos del centro para formación
- Panel de actividad

Este plan es el que tiene margen de verdad, pero exige la Opción B y todo lo del
punto 1.

## 5. Notas sobre el precio

No te digo cifras porque dependen de tu mercado, pero tres criterios:

- **Ancla al valor, no al coste.** Comparar con lo que cuesta una hora de
  supervisión, no con lo que cuestan los tokens.
- **Cobra por profesional, no por análisis.** Los créditos generan fricción
  justo cuando el clínico está trabajando, y le empujan a no analizar un caso
  dudoso, que es exactamente cuando más falta le hace.
- **Anual con descuento.** Los profesionales sanitarios presupuestan por año y la
  rotación mensual te mataría el flujo de caja.

Vigila el margen: cada análisis con `gpt-4o` tiene un coste real en tokens.
Antes de fijar precio, mide el coste medio por análisis de verdad y multiplícalo
por el uso esperado de un usuario intensivo, no del medio.

## 6. Lo que hay que construir, en orden

1. Interfaz de repositorio (`lib/repositorio.ts`) con implementación IndexedDB
   cifrada. Nada de esto toca las rutas de API.
2. Referencia de caso como entidad de verdad, no un campo suelto del informe.
3. Pantalla de historial: lista de casos, análisis por caso, reabrir.
4. Exportación e importación de respaldo (un fichero cifrado).
5. Comparación entre dos análisis del mismo caso.
6. Muro de pago y cuentas, cuando haya algo que valga la pena pagar.

Los pasos 1 a 5 se pueden hacer sin cuentas ni cobros: primero que la función
exista y demuestre valor, después el muro.
