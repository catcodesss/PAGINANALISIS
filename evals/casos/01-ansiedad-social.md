# 01 · Ansiedad social con conducta encubierta y conducta de seguridad

Caso de referencia. Concentra la mayoría de fallos detectados en la v0.1.2.

## NOTA

M., mujer de 29 años, consulta derivada por su médico de cabecera tras varias visitas a urgencias por palpitaciones sin hallazgos orgánicos. Trabaja en atención al cliente desde hace tres años. Refiere que desde hace unos ocho meses experimenta episodios de ansiedad intensa, sobre todo los domingos por la tarde y antes de las reuniones de equipo de los lunes.

En la última semana describe dos episodios concretos. El martes, su supervisora le pidió que expusiera los resultados del mes delante de seis compañeros. Mientras esperaba su turno notó taquicardia, sudoración y un pensamiento recurrente de que iba a quedarse en blanco y todos se darían cuenta de que no sirve para el puesto. Pidió ir al baño, estuvo allí unos diez minutos respirando y al volver la reunión ya había pasado a otro punto, por lo que no tuvo que exponer. Cuenta que sintió un alivio inmediato muy fuerte, aunque después estuvo toda la tarde dándole vueltas a lo ocurrido y se acostó pensando que había vuelto a fallar.

El segundo episodio fue el jueves: un cliente le levantó la voz por teléfono. Ella respondió disculpándose repetidamente y aceptó una compensación que no le correspondía autorizar. El cliente colgó satisfecho. Después se lo ocultó a su supervisora por miedo a la reprimenda y estuvo revisando mentalmente la conversación durante horas.

Comenta que últimamente evita comer con los compañeros, dice que está ocupada y come en su mesa mirando el móvil. También ha dejado de ir a clases de baile a las que asistía desde hacía años, porque al final de la clase suele haber un momento en que cada persona improvisa sola delante del grupo. Los fines de semana bebe dos o tres copas de vino antes de quedar con amigos, dice que así se suelta. Duerme mal los domingos.

Su pareja tiende a llamar ella misma para hacer gestiones telefónicas y a responder por M. cuando están con gente nueva. M. lo agradece explícitamente.

En cuanto a antecedentes, describe un padre muy crítico con el rendimiento escolar y recuerda burlas en secundaria cuando leyó un trabajo en voz alta. No hay consumo de sustancias más allá del alcohol descrito, ni antecedentes psiquiátricos previos. Dice que quiere dejar de ser así y que le gustaría poder optar a un ascenso que implica coordinar un equipo pequeño.

## COMPROBACIONES

```json
[
  {
    "id": "rumiacion-como-conducta",
    "descripcion": "La rumiación post-evento debe registrarse como conducta problema, no ignorarse",
    "tipo": "debe_aparecer",
    "ambito": "conductas_problema",
    "patron": "rumia|dar(le)? vueltas|revisar mentalmente|repaso mental|post.?evento|anticipatori"
  },
  {
    "id": "etiqueta-encubierta",
    "descripcion": "Al menos una conducta debe estar clasificada como encubierta",
    "tipo": "debe_aparecer",
    "ambito": "conductas_problema",
    "patron": "encubiert"
  },
  {
    "id": "pareja-como-mantenedor",
    "descripcion": "La pareja que gestiona por ella debe aparecer en el análisis principal, no solo como hipótesis alternativa",
    "tipo": "debe_aparecer",
    "ambito": "variables_moduladoras|analisis_por_situaciones|situaciones|hipotesis_mantenimiento|formulacion",
    "patron": "pareja"
  },
  {
    "id": "urgencias-palpitaciones",
    "descripcion": "Las visitas a urgencias por palpitaciones no deben desaparecer del informe",
    "tipo": "debe_aparecer",
    "patron": "urgencias|palpitacion"
  },
  {
    "id": "respiracion-no-como-intervencion",
    "descripcion": "CRITICO: respirar en el baño es conducta de seguridad; no debe proponerse la respiración como intervención",
    "tipo": "no_debe_aparecer",
    "ambito": "conductas_alternativas|lineas_de_intervencion|habilidades_sugeridas|procedimientos_sugeridos",
    "patron": "respiraci"
  },
  {
    "id": "sueno-no-es-vulnerabilidad-biologica",
    "descripcion": "Dormir mal los domingos es consecuencia de la anticipación, no una vulnerabilidad biológica",
    "tipo": "no_debe_aparecer",
    "ambito": "variables_moduladoras",
    "incluirRuta": true,
    "patron": "(?=.*biologic)(?=.*(duerme|dormir|sueno|insomnio))"
  },
  {
    "id": "perdida-de-reforzadores",
    "descripcion": "El abandono de las clases de baile debe aparecer (pérdida de reforzadores)",
    "tipo": "debe_aparecer",
    "patron": "baile|danza"
  },
  {
    "id": "deficit-vs-interferencia",
    "descripcion": "Debe resolver si cada conducta es déficit de repertorio o interferencia (aquí lo correcto es interferencia)",
    "tipo": "debe_aparecer",
    "ambito": "deficit_o_interferencia",
    "patron": "^(deficit|interferencia|mixto)$"
  },
  {
    "id": "valores-y-meta",
    "descripcion": "El ascenso deseado debe recogerse como valor o meta orientadora",
    "tipo": "debe_aparecer",
    "patron": "ascenso|coordinar un equipo|valores personales|direccion valiosa"
  },
  {
    "id": "explora-refuerzo-positivo",
    "descripcion": "No todo puede cerrarse en refuerzo negativo: debe considerarse alguna contingencia de refuerzo positivo",
    "tipo": "debe_aparecer",
    "ambito": "hipotesis_alternativas|hipotesis_mantenimiento",
    "patron": "refuerzo positivo|reforzamiento positivo"
  }
]
```
