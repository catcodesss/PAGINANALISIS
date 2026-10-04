/**
 * Interruptor de las llamadas a OpenAI (gpt-4o y gpt-4o-mini).
 *
 * Está apagado: se dejó de usar esa API. El código de las rutas se conserva
 * para cuando haya un motor nuevo, pero ninguna petición llega a OpenAI.
 * Va como constante y no como variable de entorno para que un despliegue
 * olvidado no lo reactive por accidente (y gaste saldo con notas clínicas).
 */
export const MOTOR_IA_ACTIVO = false;

export const MENSAJE_MOTOR_DESACTIVADO =
  "La generación automática del análisis está desactivada por ahora.";
