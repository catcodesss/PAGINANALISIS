import { applicationDefault, cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

/**
 * Firebase Admin SDK, solo en el servidor. IGNORA las reglas de seguridad de
 * Firestore: por eso cada operación que lo use debe comprobar a mano quién es el
 * usuario y qué le toca (lib/servidor/autenticar.ts y lib/servidor/ranuras.ts).
 *
 * Credenciales, por orden de preferencia:
 *  1. Application Default Credentials (Cloud Run, `gcloud auth application-default
 *     login` en desarrollo, o GOOGLE_APPLICATION_CREDENTIALS apuntando a un archivo
 *     FUERA del repositorio). No hace falta ninguna variable de ACIA.
 *  2. FIREBASE_ADMIN_CLIENT_EMAIL + FIREBASE_ADMIN_PRIVATE_KEY (variables privadas
 *     del servidor, p. ej. en Vercel). Nunca con prefijo NEXT_PUBLIC_.
 * El ID de proyecto sale de FIREBASE_ADMIN_PROJECT_ID o NEXT_PUBLIC_FIREBASE_PROJECT_ID.
 */

function proyecto(): string | undefined {
  return process.env.FIREBASE_ADMIN_PROJECT_ID ?? process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
}

/**
 * La clave privada tal como suele quedar al pegarla en un panel: entre
 * comillas, con "\n" literales, con saltos de Windows, o el JSON entero de la
 * cuenta de servicio. Devuelve el PEM limpio.
 */
export function normalizarClavePrivada(valor: string): string {
  let clave = valor.trim();
  if (clave.startsWith("{")) {
    try {
      const json = JSON.parse(clave) as { private_key?: unknown };
      if (typeof json.private_key === "string") clave = json.private_key.trim();
    } catch {
      // No era JSON válido: se trata como la clave tal cual.
    }
  }
  while (clave.length > 1 && /^(["']).*\1$/s.test(clave)) clave = clave.slice(1, -1).trim();
  return clave.replace(/\\r/g, "").replace(/\\n/g, "\n").replace(/\r\n?/g, "\n").trim() + "\n";
}

function aplicacion(): App {
  const existente = getApps()[0];
  if (existente) return existente;

  const correo = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const clave = process.env.FIREBASE_ADMIN_PRIVATE_KEY;
  const projectId = proyecto();

  if (correo && clave && projectId) {
    return initializeApp({
      credential: cert({
        projectId,
        clientEmail: correo,
        privateKey: normalizarClavePrivada(clave),
      }),
      projectId,
    });
  }
  return initializeApp({ credential: applicationDefault(), projectId });
}

/**
 * ¿Hay credenciales de servicio? Comprobar la revocación de una sesión consulta
 * a Google con ellas; sin credenciales, esa consulta falla y rechazaría a todos.
 * Verificar la firma y la caducidad del token no las necesita.
 */
export function hayCredencialesAdmin(): boolean {
  return Boolean(
    (process.env.FIREBASE_ADMIN_CLIENT_EMAIL && process.env.FIREBASE_ADMIN_PRIVATE_KEY) ||
      process.env.GOOGLE_APPLICATION_CREDENTIALS ||
      process.env.K_SERVICE
  );
}

export function authAdmin(): Auth {
  return getAuth(aplicacion());
}

export function firestoreAdmin(): Firestore {
  return getFirestore(aplicacion());
}
