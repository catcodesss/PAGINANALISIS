"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { repositorio, repositorioNube } from "@/lib/repositorio";
import { autenticacion, normalizarCorreo } from "@/lib/firebaseCliente";
import { derivarCredenciales } from "@/lib/credenciales";
import {
  avisoAlias,
  crearExpediente,
  ETIQUETA_FASE_CASO,
  type Expediente,
  type FaseCaso,
  type ResumenCaso,
} from "@/lib/casos";

/**
 * Casos guardados en el propio navegador, cifrados con una contraseña del
 * clínico (ver lib/cifrado.ts y lib/repositorio.ts).
 *
 * Habla solo con la interfaz `Repositorio`, nunca con IndexedDB: el día que el
 * almacenamiento pase a un servidor con cuentas, este componente no cambia.
 */

interface HistorialProps {
  /** Abre el formulario de caso nuevo al llegar (acción «Nuevo caso»). */
  nuevoAbierto: boolean;
  onAbrir: (expediente: Expediente) => void;
  /** Caso recién creado: la página pasa a la nota de la sesión 1. */
  onCreado: (expediente: Expediente) => void;
}

type Fase = "comprobando" | "sin_configurar" | "bloqueado" | "abierto" | "no_disponible";
type Filtro = FaseCaso | "todos";

function formatearFecha(iso: string): string {
  return new Date(iso).toLocaleDateString("es", { day: "numeric", month: "short", year: "numeric" });
}

export default function Historial({ nuevoAbierto, onAbrir, onCreado }: HistorialProps) {
  const [fase, setFase] = useState<Fase>("comprobando");
  const [contrasena, setContrasena] = useState("");
  const [repetir, setRepetir] = useState("");
  const [casos, setCasos] = useState<ResumenCaso[]>([]);
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [mensaje, setMensaje] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [formNuevo, setFormNuevo] = useState(nuevoAbierto);
  const [alias, setAlias] = useState("");
  const [motivo, setMotivo] = useState("");
  const [aBorrar, setABorrar] = useState<ResumenCaso | null>(null);
  const entradaFichero = useRef<HTMLInputElement>(null);
  // Con la nube, un respaldo se abre con la frase de la cuenta que lo creó.
  const [respaldoNube, setRespaldoNube] = useState<File | null>(null);
  const [fraseRespaldo, setFraseRespaldo] = useState("");

  /*
    Averiguar si hay historial es consultar un sistema externo (IndexedDB), que
    es justo para lo que sirve un efecto. Todo sale por el mismo camino, ya
    asíncrono, y la bandera `vivo` evita tocar el estado de un componente que ya
    se desmontó. Si la clave sigue en memoria, entra directo a la lista.
  */
  useEffect(() => {
    let vivo = true;
    (async () => {
      let f: Fase;
      if (!repositorio.disponible()) f = "no_disponible";
      else if (repositorio.desbloqueado()) f = "abierto";
      else {
        try {
          f = (await repositorio.yaConfigurado()) ? "bloqueado" : "sin_configurar";
        } catch {
          f = "no_disponible";
        }
      }
      const lista = f === "abierto" ? await repositorio.listarCasos() : [];
      if (!vivo) return;
      setFase(f);
      setCasos(lista);
    })();
    return () => {
      vivo = false;
    };
  }, []);

  const refrescar = useCallback(async () => {
    setCasos(await repositorio.listarCasos());
  }, []);

  async function conManejo(accion: () => Promise<void>) {
    setOcupado(true);
    setMensaje("");
    try {
      await accion();
    } catch (e) {
      setMensaje(e instanceof Error ? e.message : "Algo no salió bien.");
    } finally {
      setOcupado(false);
    }
  }

  /** Los análisis sueltos de antes pasan a ser casos al abrir. */
  async function entrar() {
    const { fallidos } = await repositorio.migrarHistorial();
    setFase("abierto");
    await refrescar();
    if (fallidos > 0) {
      setMensaje(
        `${fallidos} análisis antiguo${fallidos === 1 ? "" : "s"} no se pudo convertir en caso. Sigue guardado tal cual.`
      );
    }
  }

  function crear() {
    if (contrasena.length < 8) {
      setMensaje("Usa al menos 8 caracteres.");
      return;
    }
    if (contrasena !== repetir) {
      setMensaje("Las contraseñas no coinciden.");
      return;
    }
    conManejo(async () => {
      await repositorio.configurar(contrasena);
      setContrasena("");
      setRepetir("");
      await entrar();
    });
  }

  function abrir() {
    conManejo(async () => {
      if (!(await repositorio.desbloquear(contrasena))) {
        setMensaje("Contraseña incorrecta.");
        return;
      }
      setContrasena("");
      await entrar();
    });
  }

  function crearCaso() {
    conManejo(async () => {
      const expediente = crearExpediente({ alias, motivo });
      await repositorio.crearCaso(expediente);
      setAlias("");
      setMotivo("");
      setFormNuevo(false);
      onCreado(expediente);
    });
  }

  function abrirCaso(id: string) {
    conManejo(async () => {
      const expediente = await repositorio.obtenerCaso(id);
      if (expediente) onAbrir(expediente);
    });
  }

  function cambiarFase(id: string, nueva: FaseCaso) {
    conManejo(async () => {
      const expediente = await repositorio.obtenerCaso(id);
      if (!expediente) return;
      await repositorio.actualizarCaso({
        ...expediente,
        caso: { ...expediente.caso, fase: nueva, actualizado: new Date().toISOString() },
      });
      await refrescar();
    });
  }

  function eliminar(id: string) {
    conManejo(async () => {
      await repositorio.eliminarCaso(id);
      setABorrar(null);
      await refrescar();
    });
  }

  function exportar() {
    conManejo(async () => {
      const blob = await repositorio.exportarRespaldo();
      const url = URL.createObjectURL(blob);
      const enlace = document.createElement("a");
      enlace.href = url;
      enlace.download = `acia-respaldo-${new Date().toISOString().slice(0, 10)}.json`;
      enlace.click();
      URL.revokeObjectURL(url);
    });
  }

  function importarDeLaNube(fichero: File) {
    conManejo(async () => {
      const correo = autenticacion().currentUser?.email;
      const candidatas = correo
        ? [(await derivarCredenciales(normalizarCorreo(correo), fraseRespaldo)).boveda, fraseRespaldo]
        : [fraseRespaldo];
      const r = await repositorioNube()!.importarRespaldoNube(await fichero.text(), candidatas);
      setRespaldoNube(null);
      setFraseRespaldo("");
      await refrescar();
      const partes = [`${r.importados} caso${r.importados === 1 ? "" : "s"} importado${r.importados === 1 ? "" : "s"}`];
      if (r.omitidos > 0) partes.push(`${r.omitidos} ya estaba${r.omitidos === 1 ? "" : "n"} aquí`);
      if (r.fallidos > 0) partes.push(`${r.fallidos} no se pudo importar`);
      setMensaje(`${partes.join("; ")}.`);
    });
  }

  function importar(fichero: File) {
    if (repositorioNube()) {
      setRespaldoNube(fichero);
      setMensaje("");
      return;
    }
    conManejo(async () => {
      await repositorio.importarRespaldo(await fichero.text());
      await repositorio.migrarHistorial();
      await refrescar();
      setMensaje("Respaldo importado.");
    });
  }

  if (fase === "comprobando") return null;

  if (fase === "no_disponible") {
    return (
      <Marco>
        <p className="text-sm text-ink-muted">
          Este navegador no permite guardar el historial. Necesita una conexión
          segura (HTTPS) y no funciona en algunos modos de navegación privada.
        </p>
      </Marco>
    );
  }

  if (fase === "sin_configurar") {
    return (
      <Marco>
        <p className="mb-3 text-sm leading-relaxed text-ink-muted">
          Elige una contraseña para guardar tus casos. Se cifran en este
          dispositivo y no salen de él: ni nosotros ni nadie más puede leerlos.
        </p>
        <p className="mb-4 text-sm font-medium leading-relaxed text-ink">
          Si pierdes esta contraseña, los casos guardados no se pueden
          recuperar. No hay forma de restablecerla.
        </p>
        <div className="flex flex-wrap gap-2">
          <Campo
            valor={contrasena}
            onCambio={setContrasena}
            marcador="Contraseña (8 o más caracteres)"
          />
          <Campo valor={repetir} onCambio={setRepetir} marcador="Repite la contraseña" />
          <Boton onClick={crear} principal disabled={ocupado}>
            Activar
          </Boton>
        </div>
        <Mensaje texto={mensaje} />
      </Marco>
    );
  }

  if (fase === "bloqueado") {
    return (
      <Marco>
        <p className="mb-3 text-sm text-ink-muted">
          Introduce tu contraseña para ver tus casos.
        </p>
        <div className="flex flex-wrap gap-2">
          <Campo
            valor={contrasena}
            onCambio={setContrasena}
            marcador="Contraseña"
            onEnter={abrir}
          />
          <Boton onClick={abrir} principal disabled={ocupado}>
            Abrir
          </Boton>
        </div>
        <Mensaje texto={mensaje} />
      </Marco>
    );
  }

  const aviso = avisoAlias(alias);
  const visibles = casos.filter((c) =>
    filtro === "todos" ? c.fase !== "archivado" : c.fase === filtro
  );

  return (
    <Marco>
      <div className="mb-4 flex flex-wrap gap-2">
        <Boton onClick={() => setFormNuevo((v) => !v)} principal disabled={ocupado}>
          + Nuevo caso
        </Boton>
        <Boton onClick={exportar} disabled={ocupado}>
          Exportar respaldo
        </Boton>
        <Boton onClick={() => entradaFichero.current?.click()} disabled={ocupado}>
          Importar respaldo
        </Boton>
        <Boton
          onClick={() => {
            repositorio.bloquear();
            setCasos([]);
            setFase("bloqueado");
          }}
          disabled={ocupado}
        >
          Bloquear
        </Boton>
        <input
          ref={entradaFichero}
          type="file"
          accept="application/json"
          className="hidden"
          onChange={(e) => {
            const fichero = e.target.files?.[0];
            if (fichero) importar(fichero);
            e.target.value = "";
          }}
        />
      </div>

      {respaldoNube && (
        <div className="mb-5 flex flex-wrap items-center gap-2 rounded border border-divider p-3">
          <p className="w-full text-xs text-ink-muted">
            Escribe la contraseña de la cuenta que creó este respaldo ({respaldoNube.name}).
          </p>
          <input
            type="password"
            value={fraseRespaldo}
            onChange={(e) => setFraseRespaldo(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && fraseRespaldo && importarDeLaNube(respaldoNube)}
            placeholder="Contraseña de la cuenta del respaldo"
            aria-label="Contraseña de la cuenta del respaldo"
            autoComplete="off"
            autoFocus
            className="min-w-[14rem] flex-1 rounded border border-divider bg-canvas px-3 py-2 text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
          />
          <Boton onClick={() => importarDeLaNube(respaldoNube)} principal disabled={ocupado || !fraseRespaldo}>
            Importar
          </Boton>
          <Boton
            onClick={() => {
              setRespaldoNube(null);
              setFraseRespaldo("");
            }}
            disabled={ocupado}
          >
            Cancelar
          </Boton>
        </div>
      )}

      {formNuevo && (
        <div className="mb-5 flex flex-wrap gap-2 rounded border border-divider p-3">
          <input
            value={alias}
            onChange={(e) => setAlias(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && alias.trim() && crearCaso()}
            placeholder="Alias (p. ej. M.34)"
            maxLength={40}
            autoFocus
            className="min-w-[10rem] flex-1 rounded border border-divider bg-canvas px-3 py-2 text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
          />
          <input
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Motivo (opcional)"
            maxLength={120}
            className="min-w-[12rem] flex-[2] rounded border border-divider bg-canvas px-3 py-2 text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
          />
          <Boton onClick={crearCaso} principal disabled={ocupado || !alias.trim()}>
            Crear
          </Boton>
          {aviso && (
            <p role="alert" className="w-full text-xs text-warn">
              {aviso}
            </p>
          )}
        </div>
      )}

      <div role="group" aria-label="Filtrar por fase" className="mb-3 flex flex-wrap gap-1.5">
        {(["todos", "activo", "en_pausa", "archivado"] as Filtro[]).map((f) => (
          <button
            key={f}
            type="button"
            aria-pressed={filtro === f}
            onClick={() => setFiltro(f)}
            className={`rounded-full border px-2.5 py-0.5 text-xs ${filtro === f ? "border-accent bg-accent/10 text-ink" : "border-divider text-ink-muted hover:text-ink"}`}
          >
            {f === "todos" ? "Todos" : ETIQUETA_FASE_CASO[f]}
          </button>
        ))}
      </div>

      {visibles.length === 0 ? (
        <p className="text-sm text-ink-muted">Sin casos aquí.</p>
      ) : (
        <ul className="divide-y divide-divider">
          {visibles.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
              <button
                type="button"
                onClick={() => abrirCaso(c.id)}
                className="text-left text-[15px] font-medium text-accent hover:underline"
              >
                {c.alias}
              </button>
              <span className="font-mono text-[11px] uppercase tracking-wide text-ink-muted">
                {c.fecha_ultima_sesion
                  ? `S${c.ultima_sesion} · ${formatearFecha(c.fecha_ultima_sesion)}`
                  : "Sin sesiones"}
              </span>
              <span className="flex gap-2 font-mono text-[11px] text-ink-muted">
                <span title="Blancos activos">◎ {c.blancos_activos}</span>
                <span title="Preguntas abiertas">? {c.preguntas_abiertas}</span>
                {c.alertas > 0 && (
                  <span title="Avisos" className="text-warn">
                    ▲ {c.alertas}
                  </span>
                )}
              </span>
              <span className="ml-auto flex items-center gap-2">
                <select
                  value={c.fase}
                  onChange={(e) => cambiarFase(c.id, e.target.value as FaseCaso)}
                  aria-label="Fase del caso"
                  className="rounded border border-divider bg-surface px-1.5 py-0.5 text-xs text-ink-muted"
                >
                  {(Object.keys(ETIQUETA_FASE_CASO) as FaseCaso[]).map((f) => (
                    <option key={f} value={f}>
                      {ETIQUETA_FASE_CASO[f]}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setABorrar(c)}
                  aria-label={`Borrar ${c.alias}`}
                  title="Borrar"
                  className="text-xs text-ink-muted hover:text-ink"
                >
                  ✕
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
      <Mensaje texto={mensaje} />

      {aBorrar && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Borrar caso"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        >
          <div className="w-full max-w-sm rounded-xl border border-divider bg-surface p-5">
            <p className="text-sm text-ink">
              ¿Borrar <span className="font-semibold">{aBorrar.alias}</span> con todas sus
              sesiones? No se puede deshacer.
            </p>
            <p className="mt-1 text-xs text-ink-muted">Para sacarlo de la lista sin perderlo, archívalo.</p>
            <div className="mt-4 flex justify-end gap-2">
              <Boton onClick={() => setABorrar(null)}>Cancelar</Boton>
              <Boton onClick={() => eliminar(aBorrar.id)} principal disabled={ocupado}>
                Borrar
              </Boton>
            </div>
          </div>
        </div>
      )}
    </Marco>
  );
}

// --- piezas de interfaz, deliberadamente sobrias ---

function Marco({ children }: { children: React.ReactNode }) {
  return (
    <section className="mt-6 rounded-xl border border-divider bg-surface p-5 print:hidden">
      <h2 className="mb-3 font-serif text-lg font-semibold text-ink">
        Casos
      </h2>
      {children}
    </section>
  );
}

/**
 * Campo de contraseña con opción de mostrarla. Importa más de lo habitual aquí:
 * esta contraseña no se puede restablecer, así que el usuario necesita poder
 * comprobar que ha escrito lo que cree antes de confirmar.
 */
function Campo({
  valor,
  onCambio,
  marcador,
  onEnter,
}: {
  valor: string;
  onCambio: (v: string) => void;
  marcador: string;
  onEnter?: () => void;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative min-w-[14rem] flex-1">
      <input
        type={visible ? "text" : "password"}
        value={valor}
        placeholder={marcador}
        onChange={(e) => onCambio(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && onEnter?.()}
        className="w-full rounded border border-divider bg-canvas py-2 pl-3 pr-10 text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
        title={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
        // tabIndex -1: al tabular se pasa del campo al botón de acción, no aquí.
        tabIndex={-1}
        className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-ink-muted transition-colors hover:text-ink"
      >
        {visible ? (
          <EyeOff className="h-4 w-4" aria-hidden="true" />
        ) : (
          <Eye className="h-4 w-4" aria-hidden="true" />
        )}
      </button>
    </div>
  );
}

function Boton({
  children,
  onClick,
  principal,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  principal?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={
        principal
          ? "rounded bg-accent px-4 py-2 text-sm font-medium texto-sobre-acento transition-colors hover:bg-accent/90 disabled:opacity-50"
          : "rounded border border-divider bg-surface px-4 py-2 text-sm font-medium text-ink transition-colors hover:bg-canvas disabled:opacity-50"
      }
    >
      {children}
    </button>
  );
}

function Mensaje({ texto }: { texto: string }) {
  if (!texto) return null;
  return <p className="mt-3 text-sm text-ink">{texto}</p>;
}
