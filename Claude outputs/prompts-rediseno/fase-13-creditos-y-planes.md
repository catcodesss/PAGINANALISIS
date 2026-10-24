# Fase 13 · Créditos, planes y cobro

**Condicionada.** No empieces a programar sin dos decisiones previas que no son
código. Tamaño XL: empieza en modo plan, y el plan es un documento, no código.
Requiere la fase 8.

## Prerrequisitos (fuera de Claude Code)

1. **DPA y retención cero con OpenAI** firmados. Sin ellos no se puede cobrar por
   procesar notas de pacientes reales.
2. **Decisión de cuentas.** Hoy no hay cuentas y todo es local
   (`Desktop/MONETIZACION.md`, opción A). Medir créditos exige que el servidor
   sepa quién llama. Hay que elegir entre:
   - licencia por dispositivo sin cuenta;
   - cuentas mínimas (correo y pago) sin almacenar datos clínicos en el servidor;
   - la opción B completa, que es otro proyecto.

## Contexto

Lee `CLAUDE.md` (en `Desktop/`), `Desktop/MONETIZACION.md`, `RELEVO.md` y
`CAMBIOS.md`. Diseño: `Claude outputs/mesa-clinica-acia.html` §N.

`MONETIZACION.md` advierte que cobrar por análisis empuja a no analizar el caso
dudoso. El diseño lo resuelve con una **suscripción con análisis incluidos de
sobra**, y deja los créditos para picos y operaciones pesadas.

## Reglas

1. Sigue las reglas comunes de `Claude outputs/prompts-rediseno/00-orden-y-urgencia.md`.
2. **Invariante 4.** Nunca se cobran las citas verificables, los validadores y
   sus alertas, los grados de apoyo, los huecos y preguntas, el riesgo ni el
   descargo. La pasada crítica va incluida en cada análisis, sin coste aparte.
   Ningún resultado de pago puede ser más seguro que uno gratuito. Fíjalo con
   una prueba.
3. **Sin créditos, el caso sigue funcionando entero.** Solo se detiene lo que
   genera contenido nuevo con IA.
4. **Los registros clínicos nunca son rehenes.** Leer, exportar y archivar es
   gratis siempre, también después de cancelar.
5. **No se paga el error del modelo:**
   - si una llamada falla o no valida, el crédito vuelve;
   - si una propuesta dispara ▲, regenerar esa ranura es gratis.
6. **El gasto se ve antes de gastar**: todo botón que consume lleva su coste.
7. **Invariante 5**: el registro de consumo guarda acción, coste y fecha, nunca
   contenido clínico.

## Sub-fase 13A · Documento de decisión (sin código)

Escribe en `Claude outputs/` una propuesta con:

- la arquitectura de identidad elegida y por qué;
- el proveedor de pago;
- qué datos guarda el servidor (ninguno clínico) y el aviso de privacidad que
  habría que cambiar en `app/page.tsx`;
- la tabla de costes por acción;
- los niveles;
- los riesgos legales que hay que mirar con un asesor;
- la estimación de coste real por análisis con `gpt-4o`, medida con las evals:
  tokens medios de `/api/analizar` y `/api/actualizar` por el precio vigente.

**Para ahí y espera mi aprobación.**

Tabla de partida (§N.2), para ajustar con los números:

| Acción | Coste |
|---|---|
| Editar, conectar, citar, aceptar, estados; validadores y alertas; Mapa, Preparar, versiones, comparar; datos de indicadores; exportar | Gratis |
| Analizar la nota de una sesión (primera o actualización), con preguntas, alertas y pasada crítica | 1 |
| Proponer una ranura de un blanco, reanalizar un elemento, preguntas extra, propuesta para frases sin usar | 0,25 |
| Resumen para supervisión | 1 |
| Revisión profunda del caso completo | 3 |

Niveles de partida (§N.3):

| Nivel | Incluye |
|---|---|
| Prueba | 3 casos activos y 5 análisis al mes |
| Profesional | Casos activos ilimitados y análisis incluidos ≈ casos semanales × 4 |
| Créditos sueltos | Paquetes que caducan a los doce meses |
| Formación y Equipo | Más adelante |

Lo que se vende es **seguimiento** (casos activos), no gigas: mientras el
almacenamiento sea local, no cuesta nada al servicio.

## Sub-fase 13B · Implementación

Solo tras aprobar 13A.

- **Componente `CosteIA`** junto a cada acción que consume, con el saldo. Pide
  confirmación si el coste pasa de 1.
- **Contador en el servidor** con devolución automática ante fallo de la llamada
  o de la validación.
- **Regeneración gratuita** de ranuras con ▲ de origen IA.
- **Sin saldo**: los botones de IA explican cómo seguir. El resto de la interfaz
  no cambia.
- **Configuración**: el plan, el saldo y el historial de consumo (acción, coste y
  fecha). Actualiza la lista «Próximamente» de `components/Configuracion.tsx`.
- **El límite de peticiones** (`lib/limitePeticiones.ts`) se mantiene como
  protección, independiente de los créditos.

## Verificación

- Las comprobaciones de las reglas comunes.
- **Prueba del invariante 4**: la función que comprueba el saldo nunca envuelve
  validadores, citas, alertas ni la pasada crítica. Un análisis con saldo y uno
  de prueba gratuita del mismo caso dan exactamente las mismas alertas.
- **Pruebas nuevas:**
  - devolución ante una llamada fallida (simulada);
  - regeneración gratuita tras ▲;
  - sin saldo, exportar y abrir versiones siguen funcionando.
- **Prueba nueva**: el registro de consumo no contiene texto de la nota ni del
  análisis.

## Decisiones del 18/10/2026 (sustituyen a lo anterior donde choquen)

Detalle, mediciones y precios: `Claude outputs/propuesta-fase-13-creditos-y-planes.md`.

- **Cuentas individuales por correo**: id interno inmutable, correo normalizado
  único, verificación obligatoria, recuperación. El servidor no guarda nada clínico.
- **Unidad: Coins.** Enteros, internos, no transferibles. Analizar o actualizar
  una sesión: 4. Reanalizar un elemento, preguntas extra, propuesta puntual o de
  redacción, rehacer una propuesta: 1. Resumen para supervisión: 4. Revisión
  profunda: 12. Seguridad, edición, consulta, archivo y exportación: 0.
- **Se cobra cada nueva llamada a GPT pedida voluntariamente**, aunque sea para
  rehacer una sección ya analizada. **No se cobran** los reintentos técnicos, las
  validaciones internas, la pasada crítica ni las regeneraciones correctivas por
  error del modelo (▲ de origen IA). El precio visible es el de la operación
  completa.
- **Planes:** Gratuito, con 2 casos activos y 20 Coins al mes; Profesional, con 15
  y 160; Intensivo, con 50 y 480. Los Coins mensuales no se acumulan.
  **Paquetes:** 40, 120 y 400 Coins, que caducan a los 12 meses; se consume
  primero lo que vence antes.
- **Casos:** solo los activos ocupan ranura. Archivar pide confirmación explícita
  y libera la ranura. Los archivados no tienen límite comercial y se consultan y
  exportan gratis. Reactivar exige una ranura libre. **Nunca** se archiva ni se
  elimina un caso de forma automática, ni por inactividad, ni por falta de Coins,
  ni por cancelación. Bajar de plan no borra ni bloquea la lectura.
- **Ranuras entre dispositivos:** `caso_uid` opaco reclamado en el servidor en una
  transacción. Toda llamada de IA comprueba que su ranura esté activa.
- **Antes de cobrar:** la pasada crítica tiene que estar activada en todos los
  análisis (hoy está desactivada por defecto).
- **Pruebas añadidas:** cobro de 1 Coin por un reanálisis voluntario; coste 0 de
  la regeneración con vale correctivo; los reintentos técnicos cobran una vez; el
  mismo `operacion_id` no cobra dos veces; nada se archiva solo; tope de 2 casos
  activos con dos dispositivos a la vez. La lista completa está en la sección 8
  de la propuesta.
