# Revisión clínica de los informes — cómo se pide y qué se hace con ella

Tres psicólogos van a revisar informes de ACIA para responder a la queja real de
los usuarios: que el análisis se queda básico. Este documento es el encargo que
se les manda y el destino de cada respuesta.

Lo importante no es recoger opiniones, sino recoger **el mismo tipo de dato de
los tres sobre los mismos casos**. Una corrección aislada mide desacuerdo entre
colegas, que es rutinario. Tres clínicos independientes señalando lo mismo mide
un defecto de la herramienta. Esa diferencia es toda la utilidad del ejercicio,
y se pierde si cada uno revisa un caso distinto.

---

## Sobre el material y el canal

El material va anonimizado y el canal es WhatsApp. Decisión del autor
(05/08/2026), que es psicólogo colegiado y trabaja con colegas sujetos al mismo
deber de confidencialidad.

Anonimizar de verdad es más que quitar el nombre: la combinación de edad,
profesión y ciudad identifica igual. Al reescribir, cambiar las tres. El
enmascarado de `lib/pii.ts` cubre lo que tiene forma fija (teléfonos, DNI,
correos) y no está pensado para esto.

Esto es independiente del DPA con OpenAI de `PENDIENTE.md` sección 1, que sigue
pendiente: aquello es sobre las notas que la herramienta manda a procesar, no
sobre el canal con los revisores.

**Aun así, los tres trabajan primero sobre las notas ficticias de
`evals/casos/`**, por una razón que no tiene que ver con privacidad: son los
mismos casos que mide el runner, así que cada comentario se convierte en una
comprobación de eval sin traducción de por medio. Si un revisor dice "aquí omite
las visitas a urgencias" sobre el caso 01, eso es literalmente un
`debe_aparecer` que se añade al archivo del caso y queda fijado para siempre.
Sobre una nota suya, ese mismo comentario es una anécdota que hay que recordar.

Con notas propias, después: sirven para lo que las ficticias no cubren, que es
el desorden real de una nota escrita con prisa.

---

## Mensaje 1 — el encargo

> Hola. Te paso el encargo concreto, es más corto de lo que parece.
>
> Te mando 3 notas clínicas de ejemplo (ficticias, no son de nadie). Las
> pasas por la herramienta y me dices qué le falta al informe que sale.
>
> Lo que necesito no es una valoración general, sino cosas puntuales: "en tal
> sección omitió esto", "aquí afirma más de lo que la nota dice", "esto que
> puso no me sirve para nada". Cuanto más concreto, más útil.
>
> Sobre lo que quiero que te fijes, por orden de importancia:
>
> 1. **¿Se dejó algo de la nota?** Alguna conducta, consecuencia o dato que
>    esté en la nota y no aparezca por ningún lado en el informe.
> 2. **¿Usó los contrastes?** Cuándo no ocurre, ante quién sí y ante quién no,
>    dónde se atenúa. Es lo que más nos interesa saber si detecta.
> 3. **¿Afirma más de lo que la nota sostiene?** Cualquier cosa que tú no te
>    atreverías a poner por escrito con esa nota delante.
> 4. **¿Se queda en la etiqueta?** Si pone "función de escape" y no explica por
>    qué es escape y no otra cosa, eso es lo que quiero saber.
> 5. **¿Qué sección borrarías entera?** El informe tiene 23 apartados y
>    sospecho que sobran varios. Dime cuáles no leerías.
> 6. **Déficit o interferencia.** Si dice que la persona no sabe hacer algo
>    cuando en realidad sabe y no lo hace (o al revés). Esto es lo que más me
>    preocupa clínicamente, porque de ahí sale exponer a alguien que no tiene
>    la conducta en su repertorio.
> 7. **¿Propone como intervención algo que en la nota ya era evitación?**
>    Respirar, ir acompañado, ensayar la frase.
> 8. **Riesgo.** Si la nota tiene algún indicador que el informe no recogió.
> 9. **Las preguntas para la próxima sesión.** Si alguna ya está respondida en
>    la nota, es ruido y quiero quitarla.
> 10. **Lo que sí está bien.** Esto también, en serio: si no sé qué funciona,
>     al arreglar una cosa rompo otra.
>
> No hace falta que cubras los diez. Con lo que te salte a la vista me vale.
>
> Empieza por las notas de ejemplo que te mando: son las mismas con las que
> mido la herramienta, así que lo que me digas sobre ellas lo puedo convertir
> en una prueba automática y queda fijado. Después, si quieres probar con una
> tuya, adelante — pero anonimízala bien antes: además del nombre, cámbiale la
> edad, la ciudad y la profesión, que las tres juntas identifican aunque no
> haya nombre.

## Mensaje 2 — el formato

> Para que pueda usarlo, cada sugerencia en un mensaje aparte, con la captura y
> debajo tres líneas:
>
> ```
> Caso 03 · Situaciones
> OMITE
> La nota dice que no le pasa los domingos y el informe no lo usa en ningún lado.
> ```
>
> La segunda línea es una de estas seis:
>
> - **OMITE** — está en la nota y no en el informe
> - **SOBRA** — está en el informe y no aporta nada
> - **SUPERFICIAL** — acierta, pero se queda en la etiqueta sin explicar
> - **SE PASA** — afirma más de lo que la nota sostiene
> - **ERROR** — está mal, clínicamente
> - **BIEN** — esto déjalo como está
>
> Una sugerencia por mensaje, aunque sean muchos. Si me juntas cinco en un
> mensaje largo se me pierden, y cada etiqueta lleva a un arreglo distinto en
> el código.

---

## Qué hago yo con cada etiqueta

No es burocracia: cada una tiene un destino técnico distinto, y aplicar el
arreglo de una a otra no hace nada.

| Etiqueta | Qué significa | Destino |
|---|---|---|
| OMITE | El modelo no recogió algo que estaba | Comprobación `debe_aparecer` en el caso, y refuerzo de cobertura en el principio 22 |
| SOBRA | El campo no aporta | Candidato a quitar del esquema: menos campos, más profundidad en los que quedan, menos tokens |
| SUPERFICIAL | Etiqueta en vez de razonamiento | Exigencia de razonamiento en ese campo concreto del esquema |
| SE PASA | Afirma sin respaldo | **Lo más grave.** Va a validador determinista (`lib/validadores.ts`), no a más prompt: toca el invariante 2 |
| ERROR | Fallo clínico | Regla nueva en el núcleo del prompt, o evidencia de que el modelo no da para eso |
| BIEN | Funciona | Comprobación de regresión, para que un cambio futuro no lo rompa |

**La señal se lee por coincidencia, no por volumen.** Lo que señalen los tres
sobre el mismo caso es un defecto y se arregla. Lo que señale uno solo es
criterio clínico legítimo y no se toca: si ajusto el prompt hacia la opinión de
quien más escribe, la herramienta acaba diciendo lo que los terapeutas quieren
leer, que es justo lo contrario de lo que vende (ver `MARCA.md`, sección 5).

## Qué preguntar al final, cuando ya hayan mandado sugerencias

Dos preguntas que valen más que todas las anteriores juntas, pero solo si se
hacen después de que hayan usado la herramienta de verdad:

- ¿Lo llevarías a una supervisión tal como sale, o lo reescribirías antes?
- ¿Qué te tendría que dar para que lo usaras cada semana?

---

## Registro

Anotar aquí, por caso, qué señaló cada uno y qué se hizo. Sin esto, en tres
semanas no se sabe si un cambio del prompt vino de una observación clínica o de
una corazonada.

| Fecha | Caso | Sección | Etiqueta | Quién | Qué se hizo |
|---|---|---|---|---|---|
| | | | | | |
