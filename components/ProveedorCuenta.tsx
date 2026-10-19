"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { autenticacion, cuentasActivadas, nubeActivada } from "@/lib/firebaseCliente";
import { repositorio } from "@/lib/repositorio";
import PuertaCuenta from "./PuertaCuenta";
import PuertaBoveda from "./PuertaBoveda";

interface ContextoCuenta {
  /** `null` si las cuentas están desactivadas (sin Firebase configurado). */
  usuario: User | null;
  cerrarSesion: () => Promise<void>;
}

const Contexto = createContext<ContextoCuenta>({
  usuario: null,
  cerrarSesion: async () => {},
});

export function useCuenta(): ContextoCuenta {
  return useContext(Contexto);
}

type Estado =
  | { fase: "cargando" }
  | { fase: "sin_sesion" }
  | { fase: "sin_verificar"; usuario: User }
  | { fase: "boveda"; usuario: User }
  | { fase: "lista"; usuario: User | null };

/** Con la nube activa, tras la cuenta hay que abrir la bóveda de claves antes de usar la app. */
const faseTrasCuenta = (usuario: User): Estado =>
  nubeActivada() && !repositorio.desbloqueado()
    ? { fase: "boveda", usuario }
    : { fase: "lista", usuario };

/**
 * Deja pasar a la aplicación solo con una cuenta verificada, y ata la
 * biblioteca local a su `usuario_id` antes de montar nada que la use.
 */
export default function ProveedorCuenta({ children }: { children: ReactNode }) {
  const activadas = cuentasActivadas();
  const [estado, setEstado] = useState<Estado>(
    activadas ? { fase: "cargando" } : { fase: "lista", usuario: null }
  );

  useEffect(() => {
    if (!activadas) return;
    return onAuthStateChanged(autenticacion(), async (usuario) => {
      if (!usuario) {
        await repositorio.asociarCuenta(null).catch(() => {});
        setEstado({ fase: "sin_sesion" });
      } else if (!usuario.emailVerified) {
        setEstado({ fase: "sin_verificar", usuario });
      } else {
        await repositorio.asociarCuenta(usuario.uid);
        setEstado(faseTrasCuenta(usuario));
      }
    });
  }, [activadas]);

  const cerrarSesion = async () => {
    repositorio.bloquear();
    await signOut(autenticacion());
  };

  if (estado.fase === "cargando") {
    return (
      <main className="grid min-h-screen place-items-center text-sm text-ink-muted">
        Cargando…
      </main>
    );
  }
  if (estado.fase === "sin_sesion" || estado.fase === "sin_verificar") {
    return (
      <PuertaCuenta
        pendiente={estado.fase === "sin_verificar" ? estado.usuario : null}
        onCerrarSesion={cerrarSesion}
        onVerificado={async (usuario) => {
          await repositorio.asociarCuenta(usuario.uid);
          setEstado(faseTrasCuenta(usuario));
        }}
      />
    );
  }
  if (estado.fase === "boveda") {
    const usuario = estado.usuario;
    return (
      <PuertaBoveda
        onListo={() => setEstado({ fase: "lista", usuario })}
        onCerrarSesion={cerrarSesion}
      />
    );
  }
  return (
    <Contexto.Provider value={{ usuario: estado.usuario, cerrarSesion }}>
      {children}
    </Contexto.Provider>
  );
}
