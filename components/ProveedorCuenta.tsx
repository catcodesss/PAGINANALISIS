"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { autenticacion, cuentasActivadas, nubeActivada } from "@/lib/firebaseCliente";
import { repositorio, repositorioNube } from "@/lib/repositorio";
import { olvidarSecretoBoveda } from "@/lib/secretoSesion";
import PuertaCuenta from "./PuertaCuenta";
import PuertaBoveda from "./PuertaBoveda";
import CrearCuentaInvitado from "./CrearCuentaInvitado";

/** Se dispara cuando un invitado termina de crear su cuenta y su bóveda está abierta. */
export const EVENTO_CUENTA_CREADA = "acia:cuenta-creada";

interface ContextoCuenta {
  /** `null` si las cuentas están desactivadas (sin Firebase configurado). */
  usuario: User | null;
  cerrarSesion: () => Promise<void>;
  /** Sesión anónima: puede analizar, pero no guarda nada ni tiene bóveda. */
  invitado: boolean;
  /** Abre «Crea tu cuenta»; `motivo` explica por qué se pide ahora. No hace nada fuera del modo invitado. */
  pedirCuenta: (motivo?: string) => void;
}

const Contexto = createContext<ContextoCuenta>({
  usuario: null,
  cerrarSesion: async () => {},
  invitado: false,
  pedirCuenta: () => {},
});

export function useCuenta(): ContextoCuenta {
  return useContext(Contexto);
}

type Estado =
  | { fase: "cargando" }
  | { fase: "sin_sesion" }
  | { fase: "sin_verificar"; usuario: User }
  | { fase: "boveda"; usuario: User }
  | { fase: "invitado"; usuario: User }
  | { fase: "lista"; usuario: User | null };

/**
 * Con la nube activa, tras la cuenta hay que abrir la bóveda de claves antes de
 * usar la app. Si este dispositivo ya la tenía abierta (recarga de la página),
 * se reabre sin pedir nada.
 */
async function entrarComo(usuario: User): Promise<Estado> {
  await repositorio.asociarCuenta(usuario.uid);
  if (nubeActivada() && !repositorio.desbloqueado()) {
    await repositorioNube()?.restaurarSesion().catch(() => false);
  }
  return nubeActivada() && !repositorio.desbloqueado()
    ? { fase: "boveda", usuario }
    : { fase: "lista", usuario };
}

/**
 * Deja pasar a la aplicación con una cuenta verificada o como invitado, y ata
 * la biblioteca local a su `usuario_id` antes de montar nada que la use. Un
 * invitado no tiene `usuario_id` para la biblioteca: no se guarda nada.
 */
export default function ProveedorCuenta({ children }: { children: ReactNode }) {
  const activadas = cuentasActivadas();
  const [estado, setEstado] = useState<Estado>(
    activadas ? { fase: "cargando" } : { fase: "lista", usuario: null }
  );
  const [pidiendoCuenta, setPidiendoCuenta] = useState<{ motivo?: string } | null>(null);

  useEffect(() => {
    if (!activadas) return;
    return onAuthStateChanged(autenticacion(), async (usuario) => {
      if (!usuario) {
        await repositorio.asociarCuenta(null).catch(() => {});
        await repositorioNube()?.olvidarEnEsteDispositivo();
        setEstado({ fase: "sin_sesion" });
      } else if (usuario.isAnonymous) {
        await repositorio.asociarCuenta(null).catch(() => {});
        setEstado({ fase: "invitado", usuario });
      } else {
        // Puede haber verificado el correo en otra pestaña desde que se guardó la sesión.
        if (!usuario.emailVerified) await usuario.reload().catch(() => {});
        setEstado(usuario.emailVerified ? await entrarComo(usuario) : { fase: "sin_verificar", usuario });
      }
    });
  }, [activadas]);

  const cerrarSesion = useCallback(async () => {
    repositorio.bloquear();
    await repositorioNube()?.olvidarEnEsteDispositivo();
    olvidarSecretoBoveda();
    setPidiendoCuenta(null);
    await signOut(autenticacion());
  }, []);

  const invitado = estado.fase === "invitado";
  const pedirCuenta = useCallback(
    (motivo?: string) => {
      if (invitado) setPidiendoCuenta({ motivo });
    },
    [invitado]
  );
  const usuarioActual = estado.fase === "lista" || estado.fase === "invitado" ? estado.usuario : null;
  const valor = useMemo<ContextoCuenta>(
    () => ({ usuario: usuarioActual, cerrarSesion, invitado, pedirCuenta }),
    [usuarioActual, cerrarSesion, invitado, pedirCuenta]
  );

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
        onVerificado={async (usuario) => setEstado(await entrarComo(usuario))}
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
    <Contexto.Provider value={valor}>
      {estado.fase === "invitado" && (
        <div
          role="status"
          className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-divider bg-tierra-soft px-4 py-2 text-sm text-ink print:hidden"
        >
          <span>
            <strong>Modo invitado.</strong> Tus análisis no se guardan: si cierras la
            pestaña, se pierden.
          </span>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => {
                if (window.confirm("Si entras con otra cuenta, el análisis de esta sesión de invitado se pierde. ¿Continuar?")) {
                  void cerrarSesion();
                }
              }}
              className="text-sm text-accent underline underline-offset-2"
            >
              Ya tengo cuenta
            </button>
            <button
              type="button"
              onClick={() => pedirCuenta()}
              className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
            >
              Crear cuenta y conservarlos
            </button>
          </div>
        </div>
      )}
      {children}
      {estado.fase === "invitado" && pidiendoCuenta && (
        <CrearCuentaInvitado
          usuario={estado.usuario}
          motivo={pidiendoCuenta.motivo}
          onCerrar={() => setPidiendoCuenta(null)}
          onCreada={(usuario) => {
            // La biblioteca ya quedó asociada y abierta dentro del modal.
            setPidiendoCuenta(null);
            setEstado({ fase: "lista", usuario });
            // Espera a que la app se vuelva a pintar como cuenta antes de avisar.
            setTimeout(() => window.dispatchEvent(new Event(EVENTO_CUENTA_CREADA)), 0);
          }}
        />
      )}
    </Contexto.Provider>
  );
}
