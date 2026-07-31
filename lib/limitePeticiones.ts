/**
 * Límite de peticiones por IP.
 *
 * Por qué: /api/analizar es una ruta pública sin autenticación. Cualquiera que
 * conozca la URL puede enviarle notas directamente y consumir el saldo de OpenAI
 * del propietario. Sin esto, el coste de la aplicación no tiene techo.
 *
 * LIMITACIÓN IMPORTANTE: el contador vive en memoria del proceso. En Vercel cada
 * invocación puede caer en una instancia distinta, así que el límite real es más
 * laxo que el configurado y se reinicia con cada despliegue o arranque en frío.
 * Frena el uso accidental y el abuso casual, no un ataque decidido.
 *
 * Para un límite fiable hace falta un almacén compartido (Vercel KV o Upstash).
 * La interfaz de `comprobarLimite` está pensada para poder sustituirse por una
 * implementación con KV sin tocar las rutas.
 */

interface Ventana {
  cuenta: number;
  expira: number;
}

const ventanas = new Map<string, Ventana>();

/** Cada cuánto se barre el mapa para que no crezca sin control. */
const LIMPIEZA_CADA = 500;
let operaciones = 0;

function limpiarCaducadas(ahora: number): void {
  for (const [clave, ventana] of ventanas) {
    if (ventana.expira <= ahora) ventanas.delete(clave);
  }
}

export interface ResultadoLimite {
  permitido: boolean;
  restantes: number;
  /** Segundos hasta que se libere una petición, para la cabecera Retry-After. */
  reintentarEn: number;
}

export function comprobarLimite(
  clave: string,
  maximo: number,
  ventanaMs: number
): ResultadoLimite {
  const ahora = Date.now();

  if (++operaciones % LIMPIEZA_CADA === 0) limpiarCaducadas(ahora);

  const actual = ventanas.get(clave);

  if (!actual || actual.expira <= ahora) {
    ventanas.set(clave, { cuenta: 1, expira: ahora + ventanaMs });
    return { permitido: true, restantes: maximo - 1, reintentarEn: 0 };
  }

  if (actual.cuenta >= maximo) {
    return {
      permitido: false,
      restantes: 0,
      reintentarEn: Math.ceil((actual.expira - ahora) / 1000),
    };
  }

  actual.cuenta += 1;
  return {
    permitido: true,
    restantes: maximo - actual.cuenta,
    reintentarEn: 0,
  };
}

/**
 * IP del cliente. Detrás de Vercel la conexión llega desde el proxy, así que la
 * IP real viaja en las cabeceras. Se toma el primer valor de x-forwarded-for,
 * que es el cliente original.
 *
 * Es falsificable: quien quiera saltarse el límite puede rotar la cabecera. Otra
 * razón por la que esto es una barrera de coste, no una medida de seguridad.
 */
export function ipDe(request: Request): string {
  const reenviada = request.headers.get("x-forwarded-for");
  if (reenviada) return reenviada.split(",")[0].trim();
  return request.headers.get("x-real-ip") ?? "desconocida";
}
