/**
 * Interruptor de las llamadas al modelo (vía lib/clienteIA.ts).
 *
 * Con `false` ninguna petición sale hacia la API.
 * Va como constante y no como variable de entorno para que un despliegue
 * olvidado no lo reactive por accidente (y gaste saldo con notas clínicas).
 */
export const MOTOR_IA_ACTIVO = true;

export const MENSAJE_MOTOR_DESACTIVADO =
  "La generación automática del análisis está desactivada por ahora.";
