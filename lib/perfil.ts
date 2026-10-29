/**
 * Datos básicos que se piden al crear la cuenta: nombre, fecha de nacimiento y
 * país. No son clínicos (no tocan la bóveda): los guarda el servidor junto al
 * resto de datos administrativos del usuario. Sin imports, para usarse igual
 * en el navegador y en el servidor.
 */

export interface Perfil {
  nombre: string;
  /** AAAA-MM-DD. */
  nacimiento: string;
  /** Código de `PAISES`. */
  pais: string;
}

export const PAISES: readonly { codigo: string; nombre: string }[] = [
  { codigo: "PE", nombre: "Perú" },
  { codigo: "MX", nombre: "México" },
  { codigo: "CO", nombre: "Colombia" },
  { codigo: "CL", nombre: "Chile" },
  { codigo: "AR", nombre: "Argentina" },
  { codigo: "EC", nombre: "Ecuador" },
  { codigo: "BO", nombre: "Bolivia" },
  { codigo: "UY", nombre: "Uruguay" },
  { codigo: "PY", nombre: "Paraguay" },
  { codigo: "VE", nombre: "Venezuela" },
  { codigo: "CR", nombre: "Costa Rica" },
  { codigo: "PA", nombre: "Panamá" },
  { codigo: "GT", nombre: "Guatemala" },
  { codigo: "HN", nombre: "Honduras" },
  { codigo: "SV", nombre: "El Salvador" },
  { codigo: "NI", nombre: "Nicaragua" },
  { codigo: "CU", nombre: "Cuba" },
  { codigo: "DO", nombre: "República Dominicana" },
  { codigo: "PR", nombre: "Puerto Rico" },
  { codigo: "ES", nombre: "España" },
  { codigo: "US", nombre: "Estados Unidos" },
  { codigo: "OT", nombre: "Otro país" },
];

/** ACIA es una herramienta para profesionales. */
export const EDAD_MINIMA = 18;

const FECHA = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Fecha real (no 31 de febrero) y con al menos EDAD_MINIMA años a `hoy`. */
function nacimientoValido(texto: string, hoy: Date): string | null {
  const m = FECHA.exec(texto);
  if (!m) return "Escribe tu fecha de nacimiento completa.";
  const [anio, mes, dia] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const f = new Date(Date.UTC(anio, mes - 1, dia));
  if (f.getUTCFullYear() !== anio || f.getUTCMonth() !== mes - 1 || f.getUTCDate() !== dia || anio < 1900) {
    return "La fecha de nacimiento no es válida.";
  }
  const limite = new Date(Date.UTC(hoy.getUTCFullYear() - EDAD_MINIMA, hoy.getUTCMonth(), hoy.getUTCDate()));
  if (f > limite) return `Debes tener al menos ${EDAD_MINIMA} años.`;
  return null;
}

/** Devuelve el perfil limpio, o el mensaje de lo que falta o está mal. */
export function validarPerfil(valor: unknown, hoy: Date = new Date()): { perfil: Perfil } | { error: string } {
  const v = (valor ?? {}) as Record<string, unknown>;
  const nombre = typeof v.nombre === "string" ? v.nombre.trim().replace(/\s+/g, " ") : "";
  if (nombre.length < 2) return { error: "Escribe tu nombre." };
  if (nombre.length > 80) return { error: "El nombre es demasiado largo." };
  const nacimiento = typeof v.nacimiento === "string" ? v.nacimiento : "";
  const problema = nacimientoValido(nacimiento, hoy);
  if (problema) return { error: problema };
  const pais = typeof v.pais === "string" ? v.pais : "";
  if (!PAISES.some((p) => p.codigo === pais)) return { error: "Elige tu país." };
  return { perfil: { nombre, nacimiento, pais } };
}

// --- Contacto de respaldo ---------------------------------------------------

/**
 * Correo y teléfono de respaldo, opcionales. Son datos de contacto de la
 * cuenta: NO abren la bóveda (solo la contraseña o la clave de recuperación lo
 * hacen). Se guardan sin verificar hasta que exista un envío de códigos.
 */
export interface Contacto {
  correo_respaldo: string;
  /** Con prefijo internacional, p. ej. +51994229729. */
  telefono: string;
}

const CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Cualquiera de los dos puede ir vacío; si viene, tiene que ser válido. */
export function validarContacto(valor: unknown): { contacto: Contacto } | { error: string } {
  const v = (valor ?? {}) as Record<string, unknown>;
  const correo = typeof v.correo_respaldo === "string" ? v.correo_respaldo.trim().toLowerCase() : "";
  if (correo && (correo.length > 120 || !CORREO.test(correo))) return { error: "El correo de respaldo no es válido." };
  const crudo = typeof v.telefono === "string" ? v.telefono.trim() : "";
  const telefono = crudo.replace(/[\s().-]/g, "");
  if (telefono && !/^\+[1-9]\d{7,14}$/.test(telefono)) {
    return { error: "Escribe el teléfono con el código del país, por ejemplo +51 994 229 729." };
  }
  return { contacto: { correo_respaldo: correo, telefono } };
}
