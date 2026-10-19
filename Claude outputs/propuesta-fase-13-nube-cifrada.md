# Fase 13 · Propuesta técnica: ACIA en la nube con cifrado de extremo a extremo

**Fecha:** 18/10/2026 · **Estado:** propuesta para aprobar. **No hay código ni cambios en reglas de Firestore.**
Adapta `propuesta-fase-13-creditos-y-planes.md` (13A) al nuevo modelo. Donde choquen, manda este documento.
Lo que no pude comprobar (precios, cuotas, condiciones de OpenAI, normas) va marcado **[verificar]**.

---

## 0. Resumen ejecutivo

1. **Es viable**, con una condición honesta: «el administrador no puede descifrar» es verdad **en reposo** (Firestore, copias, logs de base de datos). **No** es verdad frente a quien controle el código que sirve ACIA (ver §3.6), ni frente a OpenAI durante el análisis (ver §6).
2. **Diseño de claves:** una clave maestra de datos aleatoria por cuenta, envuelta por la frase de paso del terapeuta **y** por una clave de recuperación impresa. El servidor guarda solo los envoltorios. Perder ambas = perder los datos, sin excepción.
3. **Modelo de datos:** Firestore guarda sobres cifrados por caso/parte con metadatos mínimos. El saldo, los planes, las ranuras y los Coins siguen en colecciones aparte que **solo escribe el servidor** (13A intacta).
4. **El punto débil real es la IA:** OpenAI necesita texto en claro. El texto viaja navegador → nuestra ruta de Next.js (memoria, sin persistir) → OpenAI. Lo verificable son *nuestras* garantías (código, pruebas, configuración de logs); lo de OpenAI es contractual.
5. **Bloqueos externos** antes de datos reales: DPA y retención cero con OpenAI, inscripción del banco de datos ante la ANPD, asesoría legal sobre rol de responsable/encargado, y presupuesto de Google Cloud con alertas.
6. **Cambia el cálculo de costes de infraestructura** (hoy «céntimos»): ahora hay lecturas/escrituras de datos clínicos, almacenamiento y copias. Estimación en §11.

---

## 1. Qué encontré en el proyecto

| Punto | Estado real | Consecuencia |
|---|---|---|
| Cifrado | `lib/cifrado.ts`: AES-GCM 256 con clave derivada por **PBKDF2-SHA256 310 000 iteraciones** de una contraseña | Sirve de base, pero la derivación directa impide cambiar la contraseña sin recifrar todo y no permite recuperación. Además OWASP actual pide **600 000** para PBKDF2-SHA256 [verificar]; mejor Argon2id |
| Formato del sobre | `SobreCifrado {iv: number[], datos: number[]}` | Un arreglo JSON de bytes **infla ~3–4×**. En Firestore (1 MiB por documento, cobro por almacenamiento) es inviable: pasar a base64 y comprimir antes de cifrar |
| Granularidad | Un `Expediente` completo por caso en **un solo sobre** (`lib/repositorio.ts`, almacén `casos`) | Un caso con muchas sesiones y versiones superará 1 MiB. Hay que partirlo |
| Referencia / alias | Dentro del sobre, la lista exige descifrar todo | En la nube, listar casos no puede descargar todo: hace falta un **índice cifrado pequeño** |
| Repositorio | Interfaz `Repositorio` ya prevista como «punto de sustitución» | Se puede añadir `repositorioNube` sin tocar componentes. Buena noticia |
| Cuentas | `lib/firebaseCliente.ts`, `ProveedorCuenta`, `PuertaCuenta`, `asociarCuenta(usuarioId)`; commit `2132ace` (13B etapa 2) | Firebase Auth ya está. La biblioteca local ya se ata al `usuario_id` |
| Rutas de IA | `app/api/*` reciben la nota en el cuerpo, registran solo cifras (`[tokens] …`) y errores sin contenido | Cumplen hoy el invariante 5; hay que **blindarlo con pruebas automáticas** |
| Pasada crítica | Ya siempre activa (commit `82b4532`) | 13A §0 resuelto |
| `lib/pii.ts` | Enmascara correos, teléfonos, direcciones, nombres tras marcadores | Se mantiene como defensa previa al envío; **no es anonimización** (el propio archivo lo dice) |
| `lib/reporteFallo.ts` | No incluye texto de la IA ni de la nota | Correcto; es la política a conservar para cualquier telemetría |
| Límite de peticiones | En memoria y por IP | No sirve en serverless con varias instancias; pasar a contadores en Firestore por `uid` |
| Respaldo | `exportarRespaldo` cifrado con sal + testigo | Pasa a ser **copia de seguridad secundaria** del usuario; su formato debe versionarse (v3) |
| Cifrado con IV aleatorio de 96 bits | Seguro hasta ~2³² mensajes por clave | Con una clave por caso hay margen sobrado |

---

## 2. Incompatibilidades entre 13A y el nuevo modelo

| 13A decía | Problema | Cambio propuesto |
|---|---|---|
| «Los casos siguen en el dispositivo, cifrados» (§1) | Contradice la sincronización multidispositivo | La fuente de verdad pasa a Firestore (cifrado); IndexedDB queda como **caché sin conexión** |
| «El servidor solo guarda identidad, plan, ranuras y Coins» | Ahora guarda **sobres cifrados** | Colección nueva `boveda`/`casos` que el servidor (Admin SDK) **no** necesita leer |
| Reglas: «`allow write: if false`, solo escribe el Admin SDK» para todo `usuarios/{uid}/**` | Los datos clínicos los escribe el cliente directamente (sin pasar por el servidor, para que el servidor no vea ni siquiera el texto cifrado en tránsito innecesariamente y para trabajar sin conexión) | Reglas **separadas por subcolección**: administrativas = solo lectura para el cliente; clínicas = lectura/escritura del dueño con validaciones de forma y de ranura activa |
| Archivados «ilimitados mientras el almacenamiento sea local» | En la nube cada caso cuesta almacenamiento | Poner un **tope de almacenamiento por plan** (p. ej. 200 MB / 1 GB / 5 GB) en vez de casos archivados ilimitados. **Decisión tuya** |
| Dispositivo perdido = datos perdidos | Ya no | Se recupera con login + frase de paso (o clave de recuperación). Desaparece la necesidad de «liberar ranuras desde otro dispositivo» por pérdida, pero se mantiene la gestión de dispositivos |
| «Sin conexión: se puede crear un caso pendiente de ranura» | Con sincronización, la reclamación de ranura se encola | Misma idea, ahora con cola de sincronización persistente |
| Aviso de privacidad («no guarda tus notas») | **Deja de ser cierto**: guardamos sobres cifrados | Texto nuevo (§9) |
| Límite por IP en memoria | Inútil en serverless | Contador por `uid` en Firestore |
| `caso_uid` opaco | Se mantiene; ahora es también el id del documento del caso en la nube | Sin cambios |
| Transacciones, `operacion_id`, lotes, vales, pagos, webhooks | Sin cambios | **Se conservan íntegros** (requisito 7) |

---

## 3. Diseño criptográfico

### 3.1 Jerarquía de claves

```
frase de paso ──Argon2id──► KEK_frase ─┐
clave de recuperación (256 bit) ► KEK_rec ─┼─ envuelven ─► CMD  (Clave Maestra de Datos, 256 bit, aleatoria)
passkey PRF (opcional, por dispositivo) ► KEK_pk ─┘                │
                                                                    └─ envuelve ─► CC_caso (clave por caso, AES-256 aleatoria)
                                                                                      └─ cifra cada parte del caso (AES-GCM)
```

- **CMD**: se genera una sola vez en el navegador con `crypto.getRandomValues`. **Nunca sale en claro del navegador.**
- **Ranuras de clave (key slots)**, como LUKS: cada ranura es la CMD envuelta (AES-KW o AES-GCM) con una KEK distinta. El servidor guarda las ranuras: sin la frase o la clave de recuperación son opacas.
- **Clave por caso (CC)**: aísla casos (comprometer uno no abre otros), permite **borrado criptográfico** de un caso (destruir su CC envuelta ⇒ irrecuperable aunque queden copias), y deja abierta la supervisión compartida del futuro (compartir una CC, no la CMD).
- **Frase de paso ≠ contraseña de Firebase.** Deben ser distintas y la interfaz lo exige. Firebase Auth conoce la contraseña (puede restablecerla); **la frase de paso jamás sale del navegador**.

### 3.2 Derivación

- **Argon2id** vía WebAssembly (p. ej. `hash-wasm` o `argon2-browser`) con parámetros calibrados (≥ 64 MiB de memoria, 3 pasadas, 1 hilo en navegador) [verificar vigencia]. Alternativa sin dependencia: PBKDF2-SHA256 con **600 000** iteraciones. Recomiendo Argon2id; es una dependencia nueva auditada y muy usada. **Decisión tuya.**
- Parámetros de KDF (algoritmo, memoria, iteraciones, sal) viajan **dentro de cada ranura** para poder subirlos en el futuro y recifrar solo la ranura.
- Política de frase: mínimo 12 caracteres y comprobación contra lista de contraseñas filtradas (offline, lista local comprimida) o medidor tipo zxcvbn. La seguridad de todo el sistema descansa en esto, porque quien robe el documento de la ranura puede intentar fuerza bruta offline.

### 3.3 Recuperación

- Al crear la cuenta se genera la **clave de recuperación**: 256 bits aleatorios mostrados como 24 palabras o grupos Base32 + descarga en PDF para imprimir. El usuario debe **confirmar que la guardó** (reescribir 3 grupos elegidos al azar) antes de continuar.
- **ACIA no puede recuperar nada.** Si el terapeuta pierde la frase **y** la clave de recuperación, los datos son irrecuperables. Debe aceptarse expresamente con una casilla y quedar registrado (§9).
- Opción futura (no en esta fase): *recuperación social* o con custodio (Shamir 2 de 3 entre el terapeuta, un colega y un papel). La dejo señalada, no la propongo ahora.
- **Recuperación de acceso a la cuenta (Firebase)** y **recuperación de datos** son cosas distintas: restablecer la contraseña de Firebase por correo **no** da acceso a los datos. Hay que decirlo claro en la interfaz.

### 3.4 Desbloqueo entre dispositivos

1. Login con Firebase.
2. El cliente descarga `boveda/ranuras` (ranuras envueltas).
3. Pide la frase, deriva KEK, desenvuelve la CMD **en memoria** como `CryptoKey` **no extraíble** (`extractable: false`) siempre que se pueda.
4. Auto-bloqueo por inactividad (15 min por defecto) y al cerrar sesión; limpieza de claves en memoria.
5. «Recordar este dispositivo» (opcional): guarda la CMD envuelta con una clave no extraíble de WebCrypto en IndexedDB, o mejor con **passkey/WebAuthn PRF** [verificar soporte en navegadores objetivo]. Aviso: sin PRF, quien tenga acceso al perfil del navegador abre los datos; por eso va apagado por defecto en equipos compartidos.
6. Límite de intentos: la fuerza bruta online está limitada por Firebase en el login; la de la frase es **offline** y solo la frena el coste de Argon2id. No se puede aplicar bloqueo por intentos a la frase sin un servidor que la vea; **es una limitación estructural** del cifrado de extremo a extremo.

### 3.5 Rotación

| Tipo | Qué se hace | Coste |
|---|---|---|
| Cambiar frase de paso | Desenvolver CMD con la frase vieja, envolver con la nueva, reemplazar la ranura. **Los datos no se tocan** | Instantáneo |
| Regenerar clave de recuperación | Igual: nueva ranura, la vieja se borra | Instantáneo |
| Rotar CMD (sospecha de filtración) | Nueva CMD; reenvolver todas las CC | Pequeño (solo claves) |
| Rotar CC de un caso | Descifrar y recifrar todas las partes del caso en segundo plano, con `kid` nuevo; se conservan las partes viejas hasta verificar | Proporcional al caso |
| Subir parámetros de KDF | Recifrar solo la ranura | Instantáneo |

Cada sobre lleva `kid` (versión de clave) y `v` (versión de formato) para convivir varias versiones durante la rotación.

### 3.6 Lo que el cifrado NO cubre (decir la verdad)

1. **Código servido por ACIA.** Quien controle el despliegue (Vercel, el repositorio, una dependencia comprometida) podría servir JavaScript que robe la frase al escribirla. «El administrador no tiene las claves» es cierto en reposo; **no** es una garantía matemática frente a un administrador malicioso con control del código. Mitigaciones: CSP estricta, SRI en scripts externos, dependencias fijadas y auditadas (`npm audit`, bloqueo de versiones), 2FA obligatorio en GitHub, Vercel y Google Cloud, despliegues solo desde ramas protegidas, y a futuro build reproducible o extensión/PWA firmada. Se documenta en la política de privacidad como riesgo residual.
2. **Metadatos visibles:** número de casos, fechas de creación/modificación, tamaño de cada parte, frecuencia de uso, horarios, IP de conexión, `caso_uid`, consumo de Coins por acción. El tamaño revela cuánto texto hay. Mitigación: relleno (padding) a múltiplos de 4 KiB/16 KiB, y nunca poner alias ni motivos en claro.
3. **Equipo del usuario comprometido** (malware, extensión maliciosa): lee todo mientras está desbloqueado.
4. **Capturas, impresión y exportación .docx** quedan fuera del cifrado (responsabilidad del profesional).
5. **IA:** ver §6.

### 3.7 Integridad y anti-sustitución

- AES-GCM con **datos adicionales autenticados (AAD)** = `uid | caso_uid | parte_id | rev | kid | v`. Así nadie con acceso de escritura a Firestore puede mover un sobre a otro caso, otro usuario o una revisión anterior sin que falle la verificación.
- Contra el **rollback** (servidor devolviendo una versión antigua): cada parte guarda `rev` creciente y el índice cifrado del caso guarda la `rev` esperada de cada parte («cadena de revisiones»). Detecta sustituciones, no impide que un servidor malicioso *omita* escrituras recientes; eso se mitiga con las copias.

---

## 4. Modelo de datos

Dos mundos separados (requisito 6). Todo cuelga de `usuarios/{uid}`.

### 4.1 Administrativo (lo escribe **solo** el servidor; el cliente lo lee) — igual que 13A

```
usuarios/{uid}            plan_id, casos_activos, periodo_*, correo_normalizado, …
  ranuras/{caso_uid}      estado, activado_en, archivado_en, ultima_ia_en
  lotes/{lote_id}         …
  operaciones/{operacion_id}   …
  movimientos/{auto_id}   …
  pagos/{pago_id}         …
  consentimientos/{auto_id}    (nuevo, ver §9; se añade, nunca se edita)
planes/{plan_id}  ·  eventos_proveedor/{id_evento}  (sin cambios)
```

### 4.2 Clínico cifrado (lo escribe el cliente del dueño)

```
usuarios/{uid}/boveda/principal        formato, ranuras_de_clave[] (CMD envuelta + parámetros KDF),
                                       creado_en, version_clave, clave_recuperacion_confirmada_en
usuarios/{uid}/indice/{caso_uid}       sobre cifrado pequeño: alias, fase, nº sesiones, resumen para la lista
                                       + en claro: rev, actualizado_en, tamano
usuarios/{uid}/casos/{caso_uid}        cc_envuelta (CC envuelta con CMD), kid, rev_cabecera
usuarios/{uid}/casos/{caso_uid}/partes/{parte_id}
                                       sobre: {v, kid, iv, ct (base64), aad_rev}, rev, tipo_enum
                                       (sesion | nota | version | revisiones | cabecera), actualizado_en,
                                       dispositivo_id, hash_ct
usuarios/{uid}/copias/{copia_id}       copias de seguridad lógicas y metadatos de sincronización (§7)
```

- **Partes ≤ ~600 KiB** tras comprimir (CompressionStream/gzip) y cifrar; una sesión = una parte (nota + versión de formulación), las revisiones se agrupan en tramos. Esto sortea el límite de 1 MiB por documento.
- **Ningún campo de texto libre en claro**: `tipo_enum` es un enumerado; ni alias, ni motivo, ni fecha de sesión clínica en claro. (`actualizado_en` es la hora de sincronización, no de la sesión clínica.)
- Se elimina `number[]` por **base64** (o `Uint8Array` nativo de Firestore `Bytes`).

---

## 5. Reglas de seguridad de Firestore (diseño; **no se tocan todavía**)

Principios:

- Deny por defecto.
- **Administrativo**: `allow read: if dueño; allow write: if false` (como 13A).
- **Clínico**: el dueño lee y escribe solo su rama, con estas condiciones:
  - `request.auth.uid == uid` **y** `request.auth.token.email_verified == true`;
  - **App Check** exigido (rechaza clientes que no sean nuestra app) [verificar si hay que activarlo en la consola];
  - validación de **forma**: claves permitidas exactas, `ct` de tipo bytes/string con tope de tamaño, `rev` numérico entero ≥ 0, `tipo_enum` dentro de la lista, **sin campos desconocidos** (`request.resource.data.keys().hasOnly([...])`);
  - **concurrencia optimista**: en una actualización, `request.resource.data.rev == resource.data.rev + 1`;
  - **ranura activa para escribir**: `get(.../ranuras/$(caso_uid)).data.estado == 'activo'` para crear/modificar partes (leer siempre se permite: archivados siguen legibles y exportables). Cada `get()` cuenta como una lectura facturable;
  - **no se permite borrar** partes desde el cliente (solo el servidor, o una operación explícita de «eliminar caso» con confirmación); evita borrados accidentales o por un cliente manipulado.
- **Lo que las reglas NO pueden hacer:** inspeccionar el contenido cifrado ni verificar que el cliente cifró con la clave correcta. Un cliente manipulado puede subir basura cifrada con tamaño válido a su propio espacio. Es aceptable: solo daña sus propios datos, y las copias (§7) lo cubren.
- Pruebas de reglas con el **emulador** y `@firebase/rules-unit-testing` (lista en §12).

**Autenticación reforzada:**

- Correo verificado obligatorio (ya previsto).
- **MFA con TOTP** (app autenticadora) obligatorio para todos o al menos para el plan de pago. En Firebase, el MFA exige actualizar a **Identity Platform** [verificar coste y requisitos; las SMS tienen coste por mensaje]. Recomiendo TOTP, no SMS.
- Reautenticación reciente para acciones sensibles: cambiar frase, ver la clave de recuperación, exportar todo, eliminar cuenta.
- Revocación de sesiones (`revokeRefreshTokens`) desde «Mi cuenta» y lista de dispositivos.
- Políticas contra enumeración de correos y límite de registro/restablecimiento (ya configurables en Auth).

---

## 6. Procesamiento con OpenAI: qué componente ve texto descifrado

### 6.1 Mapa de exposición

| Componente | ¿Ve texto clínico en claro? | ¿Persiste? | ¿Verificable por nosotros? |
|---|---|---|---|
| Navegador del terapeuta | Sí (descifra para mostrar y editar) | Solo caché cifrada local | Sí (código abierto a auditoría propia) |
| Firestore / Cloud Storage / copias | **No** (solo sobres) | Cifrado | **Sí**: pruebas de que ninguna escritura contiene texto plano (§12) |
| Firebase Auth | No | n/a | Sí |
| **Ruta Next.js (`app/api/*`) en Vercel** | **Sí, en memoria**, durante la petición (recibe la nota y reenvía a OpenAI) | **No** (política y prueba) | **Parcialmente**: nuestro código sí; la infraestructura de Vercel, no del todo |
| Registros de Vercel / consola / Sentry u otro monitoreo | **No debe** (hoy solo cifras; sin APM con captura de cuerpos) | n/a | Sí, con prueba automática y configuración revisada |
| **OpenAI** | **Sí** | Según contrato: retención estándar de abuso (hasta ~30 días) salvo **retención cero** aprobada [verificar] | **No verificable técnicamente**; es contractual |
| Pasarela de pago (Culqi) | No (solo importes y `operacion_id`) | n/a | Sí |

### 6.2 Por qué el texto debe pasar por nuestro servidor

El navegador no puede llamar a OpenAI directamente sin exponer la clave. Y necesitamos el servidor para **reservar Coins, comprobar la ranura activa, aplicar límites y validar** (la lógica del invariante 4). Alternativa de llamar a un proveedor desde el cliente con tokens efímeros no existe para completaciones de texto de este tipo. Se descarta.

### 6.3 Minimización (lo que sí podemos hacer)

1. **Mínimo necesario**: enviar solo la nota/sesión que se analiza (más la formulación vigente si es actualización), nunca el expediente completo.
2. **Enmascarado previo** con `lib/pii.ts` y recordatorio de usar iniciales/seudónimos. Honestidad: no es anonimización.
3. **Sin persistencia en nuestro lado**: ninguna ruta escribe contenido en Firestore, disco, caché ni colas. Los resultados vuelven al cliente, que los **cifra y los guarda él**. Se añade una prueba estática que prohíbe `console.*` con variables de contenido en `app/api/**` y otra que simula una petición y comprueba que los logs solo contienen cifras.
4. **Petición a OpenAI con `store: false`** y sin metadatos con identificadores del usuario (`user` = hash opaco o nada) [verificar parámetros vigentes].
5. **Sin monitoreo de cuerpos**: sin Sentry/LogRocket/Datadog con captura de payloads; desactivar *log drains* de contenido; reducir `console.error` a nombres de error (ya se hace). Revisar el `Content-Length` y los registros de acceso de Vercel (no contienen cuerpo, sí IP y ruta) [verificar].
6. **Región**: funciones de Vercel en una región cercana y única; OpenAI con residencia de datos si la cuenta lo permite [verificar disponibilidad]. Esto importa por la **transferencia internacional** (§9).
7. **Retención cero (ZDR)** con OpenAI: hay que solicitarla y que la cuenta quede aprobada; no es automática. Mientras no esté, **no se procesan datos reales** y se muestra el aviso.
8. **El resultado de la IA también es contenido clínico** (reporteFallo.ts ya lo documenta): tampoco se registra.

### 6.4 Garantías que sí puedo defender como «técnicamente verificables»

- *Nuestras bases de datos y copias no contienen texto clínico legible* (prueba automática + revisión de reglas + inspección de la consola con una cuenta de prueba).
- *Nuestras rutas no registran ni almacenan contenido* (pruebas automáticas, revisión de configuración de Vercel).
- *La clave de descifrado no existe en nuestros servidores* (nunca se envía; revisión de código; ninguna ruta recibe frase ni CMD).

### 6.5 Garantías que **no** podemos prometer

- Que OpenAI no conserve el texto (depende del contrato y de la aprobación de ZDR).
- Que un administrador malicioso con control del código no pueda capturar la frase (§3.6).
- Que el servidor jamás «vea» el texto: lo ve en memoria durante la inferencia. El texto de la política de privacidad debe decir *«ACIA no almacena»*, no *«ACIA no puede ver»*.

**Opción más fuerte, para el futuro:** inferencia en un entorno confidencial (TEE) o modelo alojado por nosotros. No es viable ahora; la dejo como línea de trabajo si el negocio lo exige.

---

## 7. Sincronización, conflictos, copias y recuperación

### 7.1 Sincronización

- **Fuente de verdad: Firestore.** El cliente guarda en IndexedDB una caché cifrada (la misma cifra la CMD). Se puede trabajar sin conexión: los cambios van a una **cola de escritura persistente** y se suben al reconectar. El SDK de Firestore con persistencia local ya hace parte de esto; la cola de ACIA añade el cifrado y las reglas de fusión.
- `dispositivo_id` aleatorio por navegador (no identifica a la persona) para depurar conflictos.
- **Escucha en tiempo real** (`onSnapshot`) del índice de casos del usuario para ver cambios de otros dispositivos.

### 7.2 Conflictos

Lo que ayuda: el dominio es casi **solo-añadir** (`comprobarCambioExpediente` ya rechaza editar notas cerradas y borrar revisiones; las sesiones y versiones cerradas son inmutables).

| Dato | Estrategia |
|---|---|
| Sesiones, notas cerradas, versiones cerradas, revisiones | **Unión por id** (nunca hay conflicto real; dos dispositivos que crean la sesión 5 a la vez producen `n` duplicado → se renumera por orden de creación y se avisa) |
| Edición del mapa/formulación vigente | **Concurrencia optimista por parte** (`rev`): si la escritura falla por `rev` antiguo, se descarga la parte nueva, se descifra y se aplica una **fusión de tres vías por id de elemento y campo** |
| Mismo campo editado en ambos | Gana el más reciente (reloj híbrido lógico), **pero la versión perdedora se guarda como «revisión» recuperable** y se avisa al usuario. **Nunca se descarta nada en silencio** |
| Caso eliminado en un dispositivo y editado en otro | Gana la edición: se **restaura** y se avisa |

### 7.3 Copias de seguridad (todas cifradas)

1. **Firestore PITR** (recuperación a un punto en el tiempo, hasta 7 días) y **copias programadas** diarias a un bucket de Cloud Storage con retención de 30–90 días [verificar disponibilidad y precio]. Son copias de sobres cifrados: **no se pueden leer sin la frase del usuario**, lo que es coherente con el diseño, pero implica que *restaurar a mano un caso concreto requiere el consentimiento de quien posea las claves*.
2. **Copia local del usuario**: el `exportarRespaldo` actual, ahora v3 (incluye ranuras de clave envueltas). Recordatorio periódico. Es la protección contra «el servidor se perdió».
3. **Versionado de partes**: al sobrescribir una parte, la anterior pasa a `partes_historial` durante 30 días (borrado por TTL). Cubre errores del cliente y borrados accidentales.
4. **Protección contra borrado** de la base y del bucket; rol IAM de borrado separado del de despliegue.

### 7.4 Recuperación ante errores

- Todo sobre falla cerrado: si `descifrar` devuelve `null` (clave incorrecta o dato manipulado), la parte se marca **corrupta**, no se borra, y se ofrece restaurar desde `partes_historial` o desde la copia.
- Los sobres se verifican (`hash_ct` y AAD) antes de cualquier migración.
- Pruebas periódicas de restauración (simulacro mensual con un caso de prueba).

---

## 8. Migración desde IndexedDB local (sin tocar los originales)

Principios: **no se modifica ni elimina nada local hasta verificar**; reanudable; idempotente.

1. **Instantánea previa**: el usuario descarga un `exportarRespaldo` v2 (obligatorio, con casilla «guardé mi respaldo»). Se comprueba su integridad (importar en memoria y comparar conteos).
2. **Preparar la bóveda**: crear CMD, frase de paso, clave de recuperación (la confirmación es obligatoria **antes** de subir nada).
3. Para cada caso local, **modo solo lectura sobre la base original**:
   - descifrar con la clave local antigua (PBKDF2 de su contraseña actual);
   - dividir en partes, comprimir, cifrar con la CC nueva y subir en transacción por parte;
   - registrar progreso por `caso_uid` (idempotente: repetir no duplica);
   - reclamar ranura según el estado del caso (los activos que excedan el plan quedan **pendientes**, sin perder nada: 13A mantiene «nada se archiva solo»).
4. **Verificación de integridad**: para cada caso, bajar de Firestore, descifrar, reconstruir el `Expediente` y compararlo con el original mediante **huella canónica** (JSON canónico → SHA-256). Solo si coincide se marca «verificado».
5. **Congelación, no borrado**: la base local original se renombra lógicamente a «solo lectura / migrada» y se mantiene **al menos 30 días** (o hasta que el usuario la elimine con confirmación doble). Nunca se borra automáticamente.
6. **Reversión**: si algo falla, la base local sigue intacta y la app puede seguir en modo local (cuentas desactivadas funciona hoy).
7. Un caso fallido se queda local y se informa; no frena a los demás.
8. Los tests existentes `evals/migracion.test.mjs`, `evals/cifrado.test.mjs` y fixtures `01-v0.1.2.json` se extienden para cubrir v2 → nube.

---

## 9. Aspectos legales y consentimientos (Perú) — para validar con asesor

> No soy abogado; esto es un mapa de trabajo, **no asesoría legal**. Todo **[verificar con asesor]**.

### 9.1 Roles

- **El profesional** es el responsable de los datos de sus pacientes (titular del banco de datos de su consulta) y quien recaba el consentimiento informado del paciente.
- **ACIA** probablemente actúa como **encargado del tratamiento** del contenido clínico (aloja sobres cifrados que no puede leer) y como **responsable** de los datos de la cuenta (correo, facturación, consumo). Esto determina qué contrato aplica. Hay que decidirlo con asesor y reflejarlo igual en todos los documentos.
- **Subencargados:** Google Cloud/Firebase, Vercel, OpenAI, pasarela de pago. Lista pública y versionada, con aviso de cambios.

### 9.2 Normativa a revisar

- **Ley 29733** y su reglamento actualizado (D. S. 016-2024-JUS) [verificar texto vigente]: datos de salud = sensibles; consentimiento expreso y por escrito; inscripción del banco de datos ante la ANPD; **flujo transfronterizo** (Google, Vercel y OpenAI están fuera de Perú: requiere nivel adecuado de protección o garantías contractuales); medidas de seguridad; derechos ARCO; notificación de incidentes.
- Código de ética del Colegio de Psicólogos del Perú (secreto profesional, custodia de historias).
- Norma sobre historias clínicas aplicable al ejercicio de la psicología [verificar plazos de conservación: pueden chocar con «borrado criptográfico»].
- Código de Protección y Defensa del Consumidor, SUNAT, DIGEMID (como en 13A).
- **Confidencialidad no sustituida**: el cifrado de extremo a extremo reduce riesgo, pero **no** exime de las obligaciones legales.

### 9.3 Aceptación verificable y versionada

Documentos separados, cada uno con **id de versión y huella SHA-256 del texto exacto**:

| Documento | Quién lo acepta | Contenido clave |
|---|---|---|
| Términos del servicio | Terapeuta | Alcance, planes, Coins, limitación de responsabilidad, uso como apoyo y no diagnóstico |
| Política de privacidad | Terapeuta | Qué se guarda (sobres cifrados + datos de cuenta), metadatos visibles, subencargados, transferencia internacional, retención |
| **Acuerdo de tratamiento de datos (DPA, ACIA ↔ profesional)** | Terapeuta | Roles, instrucciones, subencargados, medidas técnicas, incidentes, devolución/borrado |
| **Aceptación del riesgo de pérdida de claves** | Terapeuta | «Sin frase ni clave de recuperación, ACIA no puede recuperar tus datos» |
| Declaración del profesional sobre consentimiento del paciente | Terapeuta | Que cuenta con consentimiento informado de sus pacientes para el tratamiento por terceros |

Registro en `usuarios/{uid}/consentimientos/{auto_id}` (solo añadir, lo escribe el **servidor**): `documento`, `version`, `hash_texto`, `aceptado_en`, `ip_hash` (con sal, no IP en claro), `agente_resumido`, `metodo` (clic en casilla no premarcada), `uid`. Se vuelve a pedir aceptación cuando cambia la versión, y **sin la versión vigente aceptada, no se permite subir datos clínicos ni usar IA**. El texto de cada versión se archiva de forma inmutable (bucket/versionado) para poder demostrar qué se aceptó.

---

## 10. Cambios necesarios en el código (cuando se apruebe)

**Nuevos:**

- `lib/boveda.ts` — claves, ranuras, envoltura, rotación, recuperación. Función pura y probada.
- `lib/cifrado.ts` — evolucionar: v2 (base64, AAD, `kid`, compresión), mantener lectura de v1 para migrar.
- `lib/kdf.ts` — Argon2id (WASM) con respaldo PBKDF2-600k.
- `lib/repositorioNube.ts` — implementa `Repositorio` sobre Firestore (SDK cliente), partes, índice y caché local.
- `lib/sincronizacion.ts` — cola, fusión de tres vías, resolución de conflictos.
- `lib/migracionNube.ts` — migración con huella canónica.
- `lib/consentimientos.ts` + ruta `app/api/consentimientos`.
- `firestore.rules` y `firestore.indexes.json` (hoy no existen).
- `app/api/*` — añadir autenticación (verificar ID token con Admin SDK), `caso_uid`, `operacion_id` y cobro. Lógica 13A **sin cambios**.
- Pantallas: creación de bóveda, desbloqueo, clave de recuperación, dispositivos y sesiones, migración, consentimientos.

**Modificados:** `repositorio.ts` (selección de implementación), `ProveedorCuenta`/`PuertaCuenta` (flujo login → desbloqueo), `respaldo.ts` (v3), `Configuracion.tsx`, aviso de privacidad en `app/page.tsx`, `limitePeticiones.ts` (por `uid`).

**Dependencias nuevas:** `firebase-admin` (servidor), Argon2id WASM, `@firebase/rules-unit-testing` y emulador (dev). Ninguna otra.

---

## 11. Costes (orden de magnitud; **[verificar]** precios y cuotas vigentes)

| Concepto | Qué lo mueve | Estimación |
|---|---|---|
| Firebase Auth | Usuarios activos; **MFA exige Identity Platform** | Gratis hasta cuota; luego por MAU; SMS extra (usar TOTP) |
| Firestore | Escrituras de partes, lecturas de sincronización, `get()` de reglas, almacenamiento, PITR, copias programadas | Con 1 000 usuarios activos (cada uno ~20 sesiones/mes, ~2 MB/caso con 10 casos): del orden de **decenas de USD/mes**; sube con almacenamiento y PITR |
| Cloud Storage (copias) | GB retenidos | Céntimos por GB/mes |
| App Check | reCAPTCHA Enterprise por evaluación | Cuota gratuita, luego por mil |
| Vercel | Funciones de IA (ya previsto ~20 USD) | Sin cambio sensible |
| OpenAI | Igual que 13A; **ZDR puede tener condiciones comerciales** | Sin cambio en coste unitario |
| Asesoría legal, DPA, inscripción ANPD | Una vez + revisiones | **Coste principal**, no técnico |
| Pasarela (Culqi) | Igual que 13A | Sin cambio |

Consecuencia: los márgenes de 13A §3 siguen siendo válidos para IA, pero hay que descontar **almacenamiento por usuario**. De ahí el tope de almacenamiento por plan (§2). Un tope de alertas de presupuesto en Google Cloud es obligatorio.

---

## 12. Pruebas de aceptación

**Criptografía y claves**
1. Ida y vuelta de la bóveda: crear → cerrar → desbloquear en «otro dispositivo» (navegador limpio) con frase.
2. Desbloqueo con la clave de recuperación; frase incorrecta = fallo sin pistas.
3. Cambiar la frase **no** recifra datos; las ranuras viejas dejan de servir.
4. Rotar CC de un caso: los datos siguen legibles y las partes viejas se retiran tras verificar.
5. Ningún dato de claves en claro llega a Firestore, a `localStorage` ni a las rutas del servidor (inspección de red automatizada).
6. Un sobre movido a otro `caso_uid`, otro `uid` o a una `rev` anterior **falla la verificación** (AAD).
7. El texto de una nota no aparece en ningún documento de Firestore del emulador tras guardar un caso de prueba (búsqueda de subcadenas).

**Seguridad (emulador de reglas)**
8. Usuario A no lee ni escribe nada de B (clínico ni administrativo).
9. Usuario sin correo verificado: rechazado.
10. El cliente **no** puede escribir `usuarios`, `ranuras`, `lotes`, `operaciones`, `movimientos`, `pagos`, `consentimientos`.
11. Escritura clínica con campos extra, tamaño excedido o `rev` incorrecta: rechazada.
12. Escritura en un caso con ranura **archivada**: rechazada; lectura: permitida.
13. Cliente sin App Check: rechazado.
14. El cliente no puede borrar partes.

**Sincronización**
15. Dos dispositivos editan el mismo caso sin conexión; al reconectar se fusionan sin perder datos.
16. Mismo campo editado en ambos: gana uno y el otro queda como revisión recuperable.
17. Sesión nueva creada en paralelo: ambas conservadas, renumeradas.
18. Corte de red a mitad de subida: se reanuda sin duplicar.
19. Una parte corrupta no impide abrir el resto del caso.

**Copias y recuperación**
20. Restaurar una parte desde `partes_historial`.
21. Restaurar un caso desde la copia de Firestore y descifrarlo con la frase.
22. Importar un respaldo v3 en una cuenta nueva.

**Migración**
23. Migrar el caso de ejemplo y los fixtures: huella canónica idéntica antes y después.
24. Interrumpir la migración a la mitad y reanudar: sin duplicados.
25. Tras migrar, la base local original **sigue intacta** (misma huella).
26. Un caso que falla no detiene a los demás y se informa.

**IA y privacidad**
27. Los logs de `app/api/*` en una petición de prueba solo contienen cifras y nombres de error (prueba automática).
28. Ninguna ruta de IA escribe en Firestore contenido recibido.
29. La petición a OpenAI lleva `store: false` y no incluye el `uid` ni el correo.
30. Sin consentimientos vigentes: no se suben datos clínicos ni se permite IA.

**13A (se conservan)**: las 20 pruebas de la sección 8 de 13A (ranuras, Coins, idempotencia, reembolsos, invariante 4 y 5…), ahora ejecutadas **con el nuevo almacenamiento**.

**Consentimientos**
31. Cada aceptación guarda versión y huella; al publicar una versión nueva se vuelve a pedir.

---

## 13. Riesgos principales

| Riesgo | Gravedad | Mitigación |
|---|---|---|
| Terapeuta pierde frase y clave de recuperación | Alta (datos perdidos) | Confirmación obligatoria de la clave, recordatorios, respaldo local, aceptación expresa |
| Frase débil + robo de la base | Alta | Argon2id, política de frase, App Check, rate limits en Auth |
| Código servido comprometido | Alta | CSP/SRI, 2FA en toda la cadena, dependencias fijadas, build reproducible a futuro |
| OpenAI sin DPA/ZDR firmado | **Bloqueante** | No se procesan datos reales hasta cerrarlo |
| Costes de Firestore por sincronización ruidosa | Media | Partes pequeñas, escucha solo del índice, tope de almacenamiento, alertas de presupuesto |
| Conflictos mal resueltos | Media | Dominio solo-añadir, revisión recuperable, pruebas de simulación |
| Reglas con error | Alta | Emulador, revisión cruzada, despliegue por etapas |
| Metadatos reveladores | Media | Padding, sin alias en claro, aviso en la política |
| Choque con plazos legales de conservación | Media | Asesor; el borrado criptográfico es opcional y con doble confirmación |
| Complejidad de producto (más pasos al empezar) | Media | Onboarding guiado; opción de «recordar este dispositivo» con passkey |

---

## 14. Hoja de ruta (cada etapa con pruebas, commit y revisión)

| Etapa | Contenido | Datos reales |
|---|---|---|
| 0 | Aprobación de este documento; decisiones §15; crear proyecto GCP con facturación y alerta | — |
| 1 | `lib/boveda.ts`, `kdf.ts`, `cifrado` v2, pruebas unitarias | No |
| 2 | Reglas de Firestore + emulador + pruebas 8–14 | No |
| 3 | `repositorioNube`, índice y partes, caché, flujo login → desbloqueo → clave de recuperación | No (datos de prueba) |
| 4 | Sincronización y conflictos; pruebas 15–19 | No |
| 5 | Copias, historial de partes, restauraciones; pruebas 20–22 | No |
| 6 | Consentimientos versionados + documentos legales (borrador) | No |
| 7 | Adaptar rutas de IA (token, `caso_uid`, cobro 13A, `store:false`); pruebas 27–30 | No |
| 8 | Migración local → nube; pruebas 23–26 | Solo copias de prueba |
| 9 | Resto de 13B: Coins, planes, panel, pagos sandbox | No |
| 10 | **Paso a producción con datos reales**: DPA/ZDR con OpenAI firmados, ANPD, asesor, simulacro de restauración y revisión de seguridad externa | **Sí** |

---

## 15. Decisiones que necesito de ti

1. **Aprobar el modelo de claves** (CMD + clave por caso + frase + clave de recuperación) y la **aceptación expresa** de que ACIA no puede recuperar datos.
2. **KDF:** Argon2id con dependencia WASM (recomendado) o PBKDF2-600k sin dependencias.
3. **MFA:** TOTP obligatorio, ¿para todos o solo planes de pago? (implica Identity Platform).
4. **Tope de almacenamiento por plan** en lugar de «archivados ilimitados» (propongo 200 MB / 1 GB / 5 GB).
5. **Copias en servidor:** PITR + exportación diaria con retención de 30 días, ¿ok?
6. **Rol legal de ACIA** (encargado vs responsable) y quién contrata **asesor legal**, firma el **DPA con OpenAI** y tramita la inscripción ante la ANPD.
7. **Región** de Firestore (propongo `southamerica-east1`; no se puede cambiar luego) y de las funciones de Vercel.
8. **Passkey/PRF** para «recordar este dispositivo»: ¿se incluye en esta fase o después?
9. Las decisiones pendientes de 13A (pasarela, precios, reanálisis, «en pausa», IA por encima del tope) **siguen vigentes**.

**No haré nada de esto hasta que lo apruebes.** Si quieres, propongo empezar por las etapas 1 y 2 (claves y reglas, sin datos clínicos) mientras se cierra lo legal.
