import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";

/**
 * Firebase en el navegador. Solo sirve para identidad (Firebase Auth): el
 * servidor no recibe nada clínico, y plan, ranuras y Coins se escriben desde
 * rutas del servidor (fase 13A §5).
 *
 * Sin las variables NEXT_PUBLIC_FIREBASE_*, las cuentas quedan desactivadas y la
 * aplicación funciona como antes, sin inicio de sesión.
 */

const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export function cuentasActivadas(): boolean {
  return Boolean(config.apiKey && config.authDomain && config.projectId && config.appId);
}

export function autenticacion(): Auth {
  const app: FirebaseApp = getApps().length ? getApp() : initializeApp(config);
  return getAuth(app);
}

/** Mismo criterio que el servidor: minúsculas y sin espacios. No se tocan puntos ni +etiquetas. */
export function normalizarCorreo(correo: string): string {
  return correo.trim().toLowerCase();
}
