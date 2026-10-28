# Fase 13 · Etapa 5D · Copias del servidor (Google Cloud)

Esto **no es código**: se configura una vez en la consola de Google Cloud del proyecto de Firebase.
Los comandos y nombres de las opciones hay que **verificarlos contra la documentación vigente**
antes de usarlos (cambian). Todo lo que hay en Firestore son sobres cifrados: las copias también
lo son y **no se pueden leer sin la frase del terapeuta**.

## 1. Política TTL del historial de partes (obligatoria)

El código ya escribe `expira_en` (30 días) en `usuarios/{uid}/casos/{caso}/partes_historial/{id}`.
Falta decirle a Firestore que borre esos documentos al vencer:

- Consola → Firestore → **Time-to-live (TTL)** → crear política.
- Grupo de colección: `partes_historial`. Campo: `expira_en`.
- Sin esta política el historial **no se borra solo** (no es un fallo de seguridad, solo ocupa espacio).

## 2. Recuperación a un punto en el tiempo (PITR)

- Firestore → Base de datos → activar **Point-in-time recovery** (conserva 7 días).
- Sirve para volver a un instante si un error masivo toca los datos.

## 3. Exportación diaria programada

- Crear un bucket de Cloud Storage **en la misma región** que Firestore.
- Programar una exportación diaria de Firestore a ese bucket (Cloud Scheduler o *backup schedules* de Firestore).
- Retención de 30 a 90 días (regla de ciclo de vida del bucket).

## 4. Protección contra borrado

- Activar la **protección contra eliminación** de la base de datos de Firestore.
- Activar el **bloqueo de retención / versionado** del bucket de copias.
- Separar los roles de IAM: quien despliega no debe poder borrar copias.

## 5. Simulacro de restauración (prueba 21 de la propuesta)

Una vez al mes, con un **caso de prueba** (nunca datos reales):

1. Crear un caso de prueba y anotar su contenido.
2. Restaurar la copia a una base de datos temporal.
3. Abrir el caso con la frase y comprobar que el contenido coincide.
4. Borrar la base temporal.

Restaurar a mano un caso concreto exige que quien tiene las claves participe: sin la frase del
terapeuta nadie, ni el operador, puede abrir lo restaurado. Eso es coherente con el diseño.
