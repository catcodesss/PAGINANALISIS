"use client";

import { useEffect, useState, type FormEvent } from "react";
import { doc, getDoc } from "firebase/firestore";
import { autenticacion, firestore, normalizarCorreo } from "@/lib/firebaseCliente";
import { validarContacto } from "@/lib/perfil";

/**
 * Correo y teléfono de respaldo (opcionales). Sirven para que ACIA pueda
 * contactarte si pierdes el acceso a tu correo principal; NO abren tus casos:
 * solo tu contraseña o tu clave de recuperación lo hacen. Se guardan sin
 * verificar y los escribe el servidor (POST /api/perfil).
 */

const campo =
  "mt-1 w-full rounded-md border border-divider bg-canvas px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-accent";

export default function ContactoRespaldo() {
  const [correo, setCorreo] = useState("");
  const [telefono, setTelefono] = useState("");
  const [guardado, setGuardado] = useState({ correo: "", telefono: "" });
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [estado, setEstado] = useState<"" | "guardando" | "guardado">("");

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const usuario = autenticacion().currentUser;
        if (!usuario) return;
        const datos = (await getDoc(doc(firestore(), "usuarios", usuario.uid))).data();
        const c = datos?.contacto as { correo_respaldo?: string; telefono?: string } | undefined;
        if (vivo && c) {
          setCorreo(c.correo_respaldo ?? "");
          setTelefono(c.telefono ?? "");
          setGuardado({ correo: c.correo_respaldo ?? "", telefono: c.telefono ?? "" });
        }
      } catch {
        // Sin conexión o sin datos todavía: se muestra vacío.
      } finally {
        if (vivo) setCargando(false);
      }
    })();
    return () => {
      vivo = false;
    };
  }, []);

  async function guardar(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const r = validarContacto({ correo_respaldo: correo, telefono });
    if ("error" in r) return setError(r.error);
    const principal = autenticacion().currentUser?.email;
    if (r.contacto.correo_respaldo && principal && r.contacto.correo_respaldo === normalizarCorreo(principal)) {
      return setError("El correo de respaldo tiene que ser distinto del de tu cuenta.");
    }
    setEstado("guardando");
    try {
      const usuario = autenticacion().currentUser;
      if (!usuario) throw new Error("sin sesión");
      const respuesta = await fetch("/api/perfil", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${await usuario.getIdToken()}` },
        body: JSON.stringify({ contacto: r.contacto }),
      });
      if (!respuesta.ok) throw new Error((await respuesta.json().catch(() => null))?.message ?? "No se pudo guardar.");
      setCorreo(r.contacto.correo_respaldo);
      setTelefono(r.contacto.telefono);
      setGuardado({ correo: r.contacto.correo_respaldo, telefono: r.contacto.telefono });
      setEstado("guardado");
    } catch (err) {
      setEstado("");
      setError(err instanceof Error ? err.message : "No se pudo guardar. Inténtalo de nuevo.");
    }
  }

  const sinCambios = correo.trim().toLowerCase() === guardado.correo && telefono.replace(/[\s().-]/g, "") === guardado.telefono;

  return (
    <form onSubmit={guardar}>
      <p className="text-sm font-medium text-ink">Contacto de respaldo</p>
      <p className="mt-1 text-sm leading-relaxed text-ink-muted">
        Opcional. Sirve para contactarte si pierdes el acceso a tu correo principal.{" "}
        <strong className="text-ink">No abre tus casos</strong>: eso solo lo hacen tu
        contraseña o tu clave de recuperación.
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          Correo de respaldo
          <input
            type="email"
            autoComplete="off"
            disabled={cargando}
            className={campo}
            value={correo}
            onChange={(e) => {
              setCorreo(e.target.value);
              setEstado("");
            }}
          />
        </label>
        <label className="block text-sm">
          Teléfono
          <input
            type="tel"
            autoComplete="tel"
            placeholder="+51 994 229 729"
            disabled={cargando}
            className={campo}
            value={telefono}
            onChange={(e) => {
              setTelefono(e.target.value);
              setEstado("");
            }}
          />
        </label>
      </div>
      {error && <p role="alert" className="mt-2 text-sm text-warn">{error}</p>}
      <div className="mt-3 flex items-center gap-3">
        <button
          type="submit"
          disabled={cargando || estado === "guardando" || sinCambios}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {estado === "guardando" ? "Guardando…" : "Guardar contacto"}
        </button>
        <span role="status" className="text-sm text-ink-muted">
          {estado === "guardado" && "✓ Guardado. Aún sin verificar."}
        </span>
      </div>
    </form>
  );
}
