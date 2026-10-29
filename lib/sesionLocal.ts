/**
 * Recuerda en este dispositivo la clave maestra de la bóveda (CMD) para no
 * pedir la contraseña en cada recarga.
 *
 * Se guarda como `CryptoKey` NO extraíble en IndexedDB: el navegador la
 * conserva pero ningún script puede leer sus bytes ni enviarla a ningún sitio;
 * solo puede usarla mientras la página esté abierta. Se borra al cerrar
 * sesión. Quien tenga el navegador abierto en este dispositivo y sin cerrar
 * sesión puede abrir los casos, igual que con cualquier sesión iniciada.
 */

const BD = "acia-sesion";
const ALMACEN = "cmd";
const ID = "actual";

interface Guardada {
  id: string;
  uid: string;
  version_clave: number;
  cmd: CryptoKey;
}

function abrir(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  return new Promise((resolver) => {
    try {
      const solicitud = indexedDB.open(BD, 1);
      solicitud.onupgradeneeded = () => solicitud.result.createObjectStore(ALMACEN, { keyPath: "id" });
      solicitud.onsuccess = () => resolver(solicitud.result);
      solicitud.onerror = () => resolver(null);
      solicitud.onblocked = () => resolver(null);
    } catch {
      resolver(null);
    }
  });
}

async function usar<T>(modo: IDBTransactionMode, accion: (a: IDBObjectStore) => IDBRequest<T>): Promise<T | null> {
  const bd = await abrir();
  if (!bd) return null;
  try {
    return await new Promise<T | null>((resolver) => {
      const solicitud = accion(bd.transaction(ALMACEN, modo).objectStore(ALMACEN));
      solicitud.onsuccess = () => resolver(solicitud.result);
      solicitud.onerror = () => resolver(null);
    });
  } catch {
    return null;
  } finally {
    bd.close();
  }
}

export async function guardarCmdLocal(uid: string, versionClave: number, cmd: CryptoKey): Promise<void> {
  const registro: Guardada = { id: ID, uid, version_clave: versionClave, cmd };
  await usar("readwrite", (a) => a.put(registro));
}

export async function leerCmdLocal(uid: string): Promise<{ version_clave: number; cmd: CryptoKey } | null> {
  const r = (await usar("readonly", (a) => a.get(ID))) as Guardada | null | undefined;
  return r && r.uid === uid ? { version_clave: r.version_clave, cmd: r.cmd } : null;
}

export async function borrarCmdLocal(): Promise<void> {
  await usar("readwrite", (a) => a.delete(ID));
}
