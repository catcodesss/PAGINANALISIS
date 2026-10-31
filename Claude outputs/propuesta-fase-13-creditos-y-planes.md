# Fase 13A · Documento de decisión: cuentas, Coins y planes

**Fecha:** 18/10/2026 (revisada con Firebase) · **Estado:** propuesta para aprobar. No hay código de la 13B.
Sustituye al borrador anterior de este mismo archivo. Las reglas actualizadas
están en `prompts-rediseno/fase-13-creditos-y-planes.md` (sección «Decisiones del
18/10/2026»).

---

## 0. Lo que encontré en el proyecto

| Punto | Estado real | Consecuencia |
|---|---|---|
| Autenticación, base de datos, pagos | **No existen** (ni `firebase` en `package.json`). Todo es local: IndexedDB cifrado (`lib/repositorio.ts`, `lib/cifrado.ts`) | Hay que añadir servidor de identidad y saldo desde cero |
| Fase 8 (requisito) | Hecha (commits `a22b44b`, `f96428b`) | Se puede plantear la 13 |
| Fases 9–12 | No aparecen en el historial de git | No bloquean la 13, pero sus botones de IA tendrán que llevar coste cuando existan |
| Estados de un caso | `FaseCaso = "activo" \| "en_pausa" \| "archivado"` (`lib/casos.ts`) | **Decidir si «en pausa» ocupa ranura** (propongo que sí: solo libera el archivado) |
| **Pasada crítica** | **Desactivada por defecto** (`PASADA_CRITICA=true` en `app/api/analizar/route.ts:25`); usa `gpt-4o-mini` | Contradice la regla «va incluida en cada análisis». **Hay que activarla siempre antes de cobrar** |
| Límite de peticiones | En memoria y por IP (`lib/limitePeticiones.ts`) | Se mantiene aparte, como protección |
| Logs de tokens | Las rutas solo escriben cifras (`[tokens] … entrada=… salida=…`) | Ya cumplen el invariante 5; sirven para medir |
| `Desktop/MONETIZACION.md`, `RELEVO.md`, `CAMBIOS.md` | No existen (los dos últimos se borraron en `490a826`) | Trabajo con el diseño §N |
| DPA y retención cero con OpenAI | **Sin verificar**: no hay rastro en el proyecto | **Bloquea** el procesamiento de datos clínicos reales y el cobro real |

---

## 1. Cuentas (decisión tomada: cuenta individual por correo)

- **Identidad:** id interno `usuario_id` (el `uid` de Firebase, inmutable); el correo es el dato de
  acceso, se guarda **normalizado** (minúsculas, sin espacios) con índice único.
  No se quitan puntos ni `+etiqueta`, porque en muchos dominios son buzones distintos.
- **Flujo:** registro → correo de verificación → la cuenta no puede usar IA ni
  ocupar ranuras hasta verificarse → inicio y cierre de sesión → recuperación por
  enlace de un solo uso con caducidad.
- **Proveedor decidido:** **Firebase Auth + Cloud Firestore** (proyecto Google
  Cloud). Auth da verificación, recuperación y unicidad de correo ya hechas.
  Firestore guarda plan, ranuras y Coins; las escrituras sensibles pasan por
  transacciones del **Admin SDK** en rutas de Next.js (sin Cloud Functions, así
  se evita exigir el plan Blaze solo por eso). `usuario_id` = `uid` de Firebase.
  Región: se elige al crear la base y **no se puede cambiar**; propongo
  `southamerica-east1` (São Paulo), la más cercana a Perú.
- **Separación:** el servidor solo guarda identidad, plan, ranuras y Coins. Los
  casos siguen en el dispositivo, cifrados. La biblioteca local queda **asociada a
  la cuenta** porque el sobre cifrado guarda el `usuario_id`: otra cuenta en el
  mismo navegador no ve esos casos.

### Ranuras de casos entre dispositivos

Cada caso local recibe un **`caso_uid` opaco** (UUID aleatorio, sin alias ni motivo).
El servidor guarda solo `(usuario_id, caso_uid, estado, activado_en, archivado_en)`.

- **Crear o reactivar** = reclamar una ranura en el servidor, en una **transacción de
  Firestore** que lee `usuarios/{uid}` (con el contador `casos_activos`), rechaza
  si se llega al tope del plan y escribe la ranura y el contador a la vez.
  Firestore reintenta una transacción si otra tocó el mismo documento, así que
  dos dispositivos a la vez no pueden pasarse: el segundo se reintenta y recibe
  el rechazo. El contador evita contar documentos dentro de la transacción.
- **Toda llamada de IA lleva `caso_uid`**, y el servidor comprueba que esa ranura
  está activa. Es el control fuerte: aunque alguien manipule el cliente, sin
  ranura activa no hay IA.
- **Archivar** pide confirmación explícita, libera la ranura y no toca los datos.
- **Nunca se archiva ni se elimina nada de forma automática**, ni por inactividad,
  ni por falta de Coins, ni por cancelación.
- **Bajar de plan:** los casos activos que sobren **siguen activos y legibles**; lo
  único que no se puede es crear o reactivar otro hasta quedar por debajo del tope.
  Propuesta para que decidas: mientras se esté por encima del tope, ¿se permite IA
  en esos casos? (Recomiendo que **sí**, para no castigar al paciente en curso).
- **Sin conexión:** se puede leer, editar, archivar en local y exportar. Crear un
  caso sin conexión lo deja como «pendiente de ranura»: se trabaja a mano y la IA
  se activa cuando se reclame la ranura. La IA requiere conexión de todos modos.
- **Dispositivo perdido:** los casos se pierden con él salvo respaldo
  (`exportarRespaldo`). Las ranuras se pueden liberar desde «Mi cuenta», que lista
  los `caso_uid` con su fecha de alta y de última IA, nunca su contenido.
  Conviene recordar el respaldo cifrado al configurar la cuenta.

---

## 2. Coins

**Cadena:** Cuenta → Plan → Ranuras activas → Saldo de Coins → Consumo de IA.
Los Coins son unidades internas, enteras, no transferibles y sin valor monetario.

### Qué se cobra (decisión del 18/10)

**Cada nueva llamada a GPT que el usuario pide voluntariamente se cobra**, aunque
sea para rehacer una sección de un caso ya analizado. **No se cobra:**

- reintentos por errores técnicos;
- validaciones internas y subllamadas ocultas (la pasada crítica, la detección de
  datos faltantes con `gpt-4o-mini`);
- regeneraciones correctivas que exige un error del modelo (propuesta con ▲ de
  origen IA, JSON roto, respuesta truncada).

El precio que se ve corresponde a la **operación completa**, con todas sus
subllamadas. Es la mejor forma de controlar el coste: el usuario entiende «una
sesión = 4», y el riesgo de que una operación salga cara lo absorbe el margen y
los techos de salida (`max_tokens`) del servidor, no el usuario.

### Tabla de Coins contrastada con tokens reales

**Medición real** del 18/10/2026: evals del proyecto contra una copia compilada
(`next start`, temperatura 0,2, `gpt-4o`), 9 análisis y 3 actualizaciones.
Resultado: 42/50 comprobaciones y 67/67 citas íntegras.

| Llamada | Entrada media | Salida media (mín.–máx.) | Coste medio | Coste en el peor caso |
|---|---:|---:|---:|---:|
| `/api/analizar` (prompt 1.15.0) | 14 110 | 2 661 (1 130–3 547) | **0,062 USD** | 0,195 USD (techo de 16 000 de salida) |
| `/api/actualizar` (prompt 1.0.0) | 1 828 | 263 (81–427) | **0,007 USD** | 0,045 USD (techo de 4 000) |
| Pasada crítica (`gpt-4o-mini`) | ~5 000 *estimada* | ≤ 1 500 | ~0,002 USD *estimado* | 0,002 USD |
| `/api/reanalizar-seccion` | *no medido* | techo de 8 000 | *estimado 0,03–0,05* | ~0,12 USD |

Precios usados (**verifícalos** en la página de OpenAI, son de memoria):
`gpt-4o` 2,50 USD por millón de tokens de entrada y 10 de salida; `gpt-4o-mini`
0,15 y 0,60.

**Cuidado:** las actualizaciones de las evals parten de casos pequeños. En un
caso real con muchas sesiones, la entrada de `/api/actualizar` crece con la
formulación vigente. La pasada crítica y el reanálisis de sección **no tienen
medición**: hace falta añadirles el log de tokens y una eval antes de fijar precios.

| Operación | Coins propuestos | Coste medio de IA | Nota |
|---|---:|---:|---|
| Analizar una sesión por primera vez (con pasada crítica) | 4 | 0,064 USD | 1 Coin ≈ 0,016 USD de coste medio |
| Analizar o actualizar una sesión existente | 4 | ~0,01 USD | Hoy cuesta 9 veces menos que la primera. Mantengo 4: la unidad de valor es la sesión |
| Reanalizar una sección o hipótesis | 1 | 0,03–0,05 *est.* | **Es la única que puede salir por encima de lo cobrado.** Propongo bajar su techo de 8 000 a 3 000 de salida, o cobrar 2 |
| Preguntas adicionales | 1 | *por medir* | |
| Propuesta puntual o breve de redacción | 1 | *por medir* | |
| Rehacer una propuesta por decisión del terapeuta | 1 | *por medir* | Si la propuesta tenía ▲ de origen IA: 0 |
| Resumen para supervisión | 4 | *no existe aún* | |
| Revisión profunda del caso | 12 | *no existe aún* | Necesita un techo de entrada (p. ej., las últimas N sesiones) |
| Validadores, alertas, citas, apoyo, riesgo, descargo | 0 | 0 | Invariante 4 |
| Editar, conectar, citar, aceptar, archivar, reactivar, consultar, exportar | 0 | 0 | |

### Flujo de cobro (reservar → confirmar o devolver)

1. El cliente envía `operacion_id` (UUID generado por él) junto con `caso_uid`.
2. En una transacción del Admin SDK: se lee `operaciones/{operacion_id}`; si ya
   existe, se devuelve su estado y **no se cobra otra vez** (idempotencia: el id
   del documento es el `operacion_id`). Si no, se leen los lotes vigentes
   ordenados por `vence_en`, se comprueba que alcanzan (**nunca saldo negativo**,
   comprobado en código y con prueba, porque Firestore no tiene `CHECK`), se
   **reserva** el coste restando de los lotes y se crea la operación `reservada`.
   Todas las lecturas van antes de las escrituras (regla de Firestore).
3. Se llama al modelo. Los reintentos técnicos ocurren **dentro** de la misma
   operación.
4. Si responde y valida, la operación pasa a `confirmada`. Si falla, se trunca o
   no valida, se devuelve el crédito (`devuelta`) en el mismo lote.
5. Una reserva que pasa de 5 minutos sin cerrarse se devuelve de forma automática
   (tarea programada), para cubrir un proceso que se cae a mitad.
6. **Regeneración correctiva gratuita:** el servidor ejecuta los validadores
   deterministas sobre la propuesta devuelta. Si alguno da ▲ de origen IA, emite
   un **vale** de un solo uso ligado a `(operacion_id, ranura)`. La regeneración
   que trae ese vale cuesta 0.

---

## 3. Planes

La diferencia entre niveles es **solo capacidad**: casos activos y Coins. Los
validadores, las alertas, la pasada crítica y el modelo son los mismos en todos.

| Plan | Casos activos | Coins al mes | Equivale a | Precio propuesto (IGV incl.) |
|---|---:|---:|---|---:|
| Gratuito | **3** | 20 | 5 sesiones analizadas | S/ 0 |
| Profesional | 15 | 160 | 40 sesiones | **S/ 49 al mes** |
| Intensivo | 50 | 480 | 120 sesiones | **S/ 129 al mes** |

**Los casos archivados son ilimitados** en todos los planes, mientras el
almacenamiento sea local. Los Coins mensuales se renuevan con cada ciclo y **no se
acumulan**; en el plan gratuito, cada mes desde la fecha de alta.

### Paquetes de Coins (sin necesidad de suscribirse; caducan a los 12 meses)

| Paquete | Coins | Precio propuesto | S/ por Coin |
|---|---:|---:|---:|
| Recarga pequeña | 40 | S/ 19 | 0,48 |
| Recarga mediana | 120 | S/ 49 | 0,41 |
| Recarga grande | 400 | S/ 139 | 0,35 |

El Coin suelto sale más caro que el del Profesional (0,31) para que la suscripción
convenga a quien la usa de forma habitual.

**Orden de consumo:** primero el lote que caduca antes. En la práctica, los
mensuales van primero y después los comprados, del más antiguo al más reciente.

### Sostenibilidad

Tipo de cambio supuesto: 3,70 S/ por USD (verificar). IGV del 18 %. Pasarela
≈ 4,2 % más IGV (verificar con el proveedor).

| Plan | Ingreso neto de IGV | Pasarela | IA, uso medio | IA, peor caso (todo al techo) | Infraestructura | Margen medio | Margen en el peor caso |
|---|---:|---:|---:|---:|---:|---:|---:|
| Gratuito | 0 | 0 | S/ 1,2 | S/ 3,6 | ~S/ 0,1 | −S/ 1,3 | −S/ 3,7 |
| Profesional | S/ 41,5 | S/ 2,4 | S/ 9,5 | S/ 28,9 | ~S/ 0,5 | **S/ 29** | S/ 9,7 |
| Intensivo | S/ 109,3 | S/ 6,1 | S/ 28,4 | S/ 86,6 | ~S/ 0,5 | **S/ 74** | S/ 16 |

El riesgo real está en el plan gratuito: cuentas falsas para conseguir más Coins
gratis. Mitigación: verificación de correo obligatoria, bloqueo de dominios de
correo desechable y límite por IP en el registro. Si pasara de 1 000 usuarios
gratuitos activos, el coste sería ~S/ 1 300 al mes: hay que vigilarlo.

Infraestructura: Firebase Auth y Firestore tienen cuota gratuita; después se paga por
lecturas, escrituras y almacenamiento (céntimos a esta escala). Con Vercel
(~20 USD al mes) bastan hasta varios miles de usuarios. **Verifica precios y
cuotas vigentes** y pon un presupuesto con alertas en Google Cloud.

---

## 4. Proveedor de pago para Perú

Stripe **no** admite comerciantes con sede en Perú, así que queda descartado.
Las comisiones son orientativas: **confírmalas en cada contrato**.

| | Culqi | Mercado Pago | Niubiz | Izipay | Paddle / Lemon Squeezy |
|---|---|---|---|---|---|
| Cobro en soles | Sí | Sí | Sí | Sí | No (USD) |
| Suscripciones | Sí (planes y suscripciones por API) | Sí (preaprobaciones) | Recurrente bajo contrato | Limitado | Sí |
| Pago único | Sí | Sí | Sí | Sí | Sí |
| Yape / billeteras | Yape (pago único) | Billetera de MP | Pago con QR | Yape | No |
| Webhooks firmados | Sí | Sí | Sí | Sí | Sí |
| Integración con Next.js | API REST y Checkout JS sencillos | SDK de Node maduro | Más pesada, orientada a empresas | Media | Muy sencilla |
| Comisión orientativa | ~3,4–4,2 % + IGV | ~3,8–4,5 % + IGV | Negociada | ~3,4–4 % | ~5 % + 0,5 USD |

**Recomendación: Culqi** para suscripciones y paquetes, con Yape para los
paquetes (pago único). **Mercado Pago** como alternativa si buscas más alcance
regional. Paddle o Lemon Squeezy solo si vendes en dólares fuera de Perú.

**Reembolsos, cancelaciones, contracargos y caducidades:**

- **Cancelar la renovación:** el plan sigue hasta el final del ciclo pagado y
  después pasa a Gratuito. Los casos activos que sobren quedan activos y legibles
  (ver la sección 1).
- **Reembolso de un paquete:** se retiran del lote los Coins que queden. Si ya se
  gastaron, se registra un movimiento de ajuste y se bloquean nuevas compras hasta
  regularizar. **Nunca** se bloquea la lectura ni la exportación de casos.
- **Contracargo:** igual que el reembolso, además de suspender la IA de pago y
  avisar por correo.
- **Fallo de pago de la renovación:** tres reintentos en 7 días (los gestiona el
  proveedor); mientras tanto no se cargan los Coins del nuevo ciclo, y al
  terminar el plazo se pasa a Gratuito.
- **Caducidad:** una tarea diaria registra un movimiento `caducado` por el
  restante de cada lote vencido.
- **Webhooks:** se guarda cada evento con su id del proveedor y un índice único.
  Si llega repetido, no hace nada. Se verifica la firma y se consulta el pago en
  la API del proveedor antes de dar Coins.

---

## 5. Modelo de datos (Firestore)

Todo cuelga del usuario; los ids de documento son los identificadores naturales.

```
usuarios/{uid}                       correo_normalizado, verificado_en, creado_en,
                                     plan_id, casos_activos (contador), periodo_inicio,
                                     periodo_fin, cancelar_al_final, id_proveedor
  ranuras/{caso_uid}                 estado activo|archivado|eliminado, activado_en,
                                     archivado_en, ultima_ia_en
  lotes/{lote_id}                    origen mensual|compra|ajuste, cantidad_inicial,
                                     restante, vence_en, pago_id
  operaciones/{operacion_id}         caso_uid, accion (enum), coste, estado
                                     reservada|confirmada|devuelta, vale_correctivo,
                                     creada_en, cerrada_en
  movimientos/{auto_id}              lote_id, operacion_id?, pago_id?, tipo
                                     alta|consumo|devolucion|caducidad|reembolso|ajuste,
                                     cantidad, creado_en            (solo se añaden)
  pagos/{pago_id}                    proveedor, id_proveedor, concepto, importe_pen, estado
planes/{plan_id}                     nombre, max_casos_activos, coins_mensuales, precio_pen
eventos_proveedor/{id_evento}        tipo, recibido_en, procesado_en
```

- **Ningún campo de texto libre** en `operaciones` ni en `movimientos`; `accion`
  es un enumerado validado en el servidor. Cumple el invariante 5.
- **Unicidad del correo:** la impone Firebase Auth; además se guarda
  `correo_normalizado` calculado en el servidor, nunca el que mande el cliente.
- **Webhooks idempotentes:** el evento se crea con `create()` en
  `eventos_proveedor/{id}`; si ya existe, falla y no se da nada dos veces.
- **El saldo se calcula** sumando `restante` de los lotes vigentes (pocos por
  usuario); no se guarda aparte. Excepción deliberada: `casos_activos` es un
  contador porque sirve de punto de serialización de las ranuras.
- **Concurrencia:** las transacciones de Firestore son optimistas y se reintentan
  si otro proceso cambió lo leído. Máximo 500 escrituras por transacción (sobra).
  Un documento admite en torno a 1 escritura por segundo sostenida:
  `usuarios/{uid}` solo se toca al reclamar o liberar ranuras, no en cada análisis.
- **Reglas de seguridad (`firestore.rules`):**
  ```
  match /usuarios/{uid}/{document=**} {
    allow read: if request.auth != null && request.auth.uid == uid;
    allow write: if false;      // solo el Admin SDK del servidor escribe
  }
  match /planes/{id} { allow read: if true; allow write: if false; }
  match /eventos_proveedor/{id} { allow read, write: if false; }
  ```
  El Admin SDK ignora las reglas, por eso la clave de servicio vive solo en
  variables de entorno del servidor y nunca llega al cliente.
- **Tareas programadas** (reservas de más de 5 minutos, caducidades diarias,
  renovación mensual de Coins): Vercel Cron llamando a rutas protegidas con un
  secreto. Alternativa: Cloud Scheduler.
- **Diferencia con SQL:** no hay `CHECK`, claves foráneas ni joins. Las garantías
  (saldo ≥ 0, una operación por id, tope de ranuras) viven en el código de las
  transacciones y se fijan con pruebas contra el **emulador de Firestore**.

---

## 6. Interfaz (discreta, dentro del diseño existente)

- **Cuenta:** pantallas de registro, inicio de sesión, verificación y
  recuperación, fuera de la mesa clínica.
- **Biblioteca:** contador «2 de 2 casos activos»; acciones de archivar (con
  confirmación) y reactivar; aviso al llegar al tope, con dos salidas (archivar
  uno o mejorar el plan).
- **`CosteIA`** junto a cada botón generativo: «4 Coins · te quedan 16». Si el
  coste es mayor que 1, pide confirmación («Saldo actual 20 → quedarán 16»). Sin
  saldo, el botón se desactiva y explica cómo seguir; el resto de la pantalla no
  cambia.
- **Configuración → Plan y Coins** (sustituye la entrada «Próximamente» de
  `components/Configuracion.tsx`): saldo total, mensuales, comprados, próxima
  caducidad, próxima renovación, historial (acción, coste, fecha, estado),
  recargas, comparación de planes, mejorar o bajar de plan, y cancelar la
  renovación.

---

## 7. Privacidad y aspectos legales (para revisar con un asesor)

**Aviso nuevo en `app/page.tsx`** (sustituye al actual, ~línea 714):

> «ACIA no guarda tus notas ni tus casos: viven cifrados en este dispositivo. Para
> el análisis, el texto se envía a OpenAI y no se conserva. En nuestro servidor
> solo están tu correo, tu plan y un registro de consumo (acción, coste, fecha).»

La frase sobre OpenAI **solo es cierta con la retención cero firmada**.

**Requisitos externos que bloquean:**

1. DPA y retención cero con OpenAI.
2. Consentimiento informado del paciente para el tratamiento de datos de salud
   por un tercero (lo recaba el terapeuta).

**Perú:**

- **Ley 29733** de Protección de Datos Personales y su nuevo reglamento (D. S.
  016-2024-JUS). Los datos de salud son **sensibles**: requieren consentimiento
  expreso y por escrito, inscripción del banco de datos ante la ANPD, régimen de
  **transferencia internacional** (OpenAI y Google Cloud están fuera de Perú) y
  medidas de seguridad. Hay que definir si ACIA es responsable o encargado del
  tratamiento.
- **Código de Protección y Defensa del Consumidor (Ley 29571):** Libro de
  Reclamaciones virtual obligatorio, información clara del precio, renovación
  automática y cancelación sencilla, y validez de la caducidad de Coins a 12 meses.
- **SUNAT:** emisión de boletas y facturas electrónicas, IGV sobre servicios
  digitales y régimen tributario de la empresa.
- **Colegio de Psicólogos del Perú:** el código de ética exige secreto
  profesional y uso de herramientas de terceros con información del paciente.
- **Producto sanitario (DIGEMID):** confirmar que la herramienta no cuenta como
  software médico regulado. Debe presentarse como apoyo a la formulación, no
  como diagnóstico.

---

## 8. Pruebas de la 13B

1. Gratuito: no se puede activar un cuarto caso.
2. Dos dispositivos o pestañas que reclaman ranura a la vez no superan el tope.
3. Archivar (tras confirmar) libera una ranura; reactivar la ocupa.
4. Nada se archiva ni se elimina por inactividad, saldo cero o cancelación.
5. Bajar de plan no borra ni bloquea la lectura de ningún caso.
6. Una generación válida descuenta su coste exacto.
7. Una llamada fallida, truncada o que no valida devuelve el crédito.
8. Los reintentos técnicos dentro de una operación cobran una sola vez.
9. Reanalizar una sección ya analizada por decisión del terapeuta cobra 1 Coin.
10. La regeneración con vale correctivo (▲ de origen IA) cuesta 0; sin vale, cuesta 1.
11. La pasada crítica no genera un cobro aparte y se ejecuta en todos los planes.
12. Dos peticiones simultáneas no dejan el saldo en negativo.
13. Repetir el mismo `operacion_id` no cobra dos veces.
14. Un webhook duplicado no da Coins dos veces.
15. Un usuario no puede leer el saldo de otro ni escribir en el suyo desde el
    cliente (reglas de Firestore, probadas con el emulador).
16. El registro de consumo no contiene texto de la nota, del prompt ni del análisis.
17. Sin Coins funcionan los validadores, las alertas, la lectura, la edición, el
    archivo, la exportación y las versiones.
18. **Invariante 4:** el mismo caso con saldo y en el plan gratuito da exactamente
    las mismas alertas. La función de cobro solo envuelve la llamada al modelo.
19. Las caducidades consumen y retiran los lotes en el orden correcto.
20. Los reembolsos y contracargos dejan los movimientos cuadrados.

---

## 9. Hoja de ruta de la 13B (cada etapa, con pruebas y commit)

1. Activar la pasada crítica en todos los análisis; añadir log de tokens a la
   pasada crítica y a `reanalizar-seccion`, y medirlas con evals.
2. Cuentas: Firebase Auth, emulador local de Auth y Firestore, pantallas de cuenta y asociación de la biblioteca local
   con `usuario_id`.
3. Ranuras: `caso_uid`, tabla y transacción de reclamar, archivar y reactivar;
   integración con la biblioteca.
4. Coins: lotes, movimientos, operaciones; reservar, confirmar y devolver; vales
   correctivos; `CosteIA`.
5. Panel de plan y Coins en Configuración.
6. Pagos en modo de pruebas (sandbox de Culqi): suscripciones, paquetes y webhooks.
7. Pruebas de concurrencia y seguridad; documentación.
8. **Cobro real y datos reales:** solo cuando estén cerrados los requisitos de la
   sección 7.

---

## 10. Decisiones que necesito de ti

1. ~~Proveedor de autenticación y base de datos~~ **Decidido: Firebase Auth +
   Firestore.** Pendiente: confirmar la región (propongo `southamerica-east1`) y
   quién crea el proyecto de Google Cloud con facturación y alerta de presupuesto.
2. **Pasarela de pago:** Culqi (recomendado) o Mercado Pago.
3. **Precios:** Profesional S/ 49, Intensivo S/ 129 y paquetes de S/ 19, 49 y 139.
4. **Reanálisis de sección:** 1 Coin con techo de salida de 3 000, o 2 Coins con
   el techo actual de 8 000.
5. **Estado «en pausa»:** ¿ocupa ranura? (recomiendo que sí).
6. **IA en casos por encima del tope** tras bajar de plan: ¿se permite?
   (recomiendo que sí).
7. Confirmar quién gestiona el **DPA con OpenAI** y la **asesoría legal**, antes
   del paso 8 de la hoja de ruta.
