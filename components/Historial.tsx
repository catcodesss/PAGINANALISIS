"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import type { AnalisisFuncional } from "@/lib/types";
import {
  repositorio,
  type RegistroHistorial,
  type ResumenHistorial,
} from "@/lib/repositorio";

/**
 * Historial de análisis guardados en el propio navegador, cifrado con una
 * contraseña del clínico (ver lib/cifrado.ts y lib/repositorio.ts).
 *
 * Habla solo con la interfaz `Repositorio`, nunca con IndexedDB: el día que el
 * almacenamiento pase a un servidor con cuentas, este componente no cambia.
 */

interface HistorialProps {
  /** Análisis en pantalla ahora mismo, si hay uno, para poder guardarlo. */
  analisisActual: AnalisisFuncional | null;
  notaActual: string;
  referenciaActual: string;
  onAbrir: (registro: RegistroHistorial) => void;
}

type Fase = "comprobando" | "sin_configurar" | "bloqueado" | "abierto" | "no_disponible";

function formatearFecha(iso: string): string {
  return new Date(iso).toLocaleString("es", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function Historial({
  analisisActual,
  notaActual,
  referenciaActual,
  onAbrir,
}: HistorialProps) {
  const [fase, setFase] = useState<Fase>("comprobando");
  const [contrasena, setContrasena] = useState("");
  const [repetir, setRepetir] = useState("");
  const [registros, setRegistros] = useState<ResumenHistorial[]>([]);
  const [mensaje, setMensaje] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [guardado, setGuardado] = useState(false);
  const entradaFichero = useRef<HTMLInputElement>(null);

  /*
    Averiguar si hay historial es consultar un sistema externo (IndexedDB), que
    es justo para lo que sirve un efecto. Lo que no vale es resolverlo a medias
    de forma síncrona: el caso "no disponible" se decidía en el cuerpo del
    efecto y provocaba un render en cascada. Ahora los dos caminos salen por el
    mismo sitio, ya asíncrono, y la bandera `vivo` evita tocar el estado de un
    componente que ya se desmontó — que es como aparecen los avisos de fuga.
  */
  useEffect(() => {
    let vivo = true;
    const fijar = (f: Fase) => {
      if (vivo) setFase(f);
    };

    (async () => {
      if (!repositorio.disponible()) {
        fijar("no_disponible");
        return;
      }
      try {
        fijar((await repositorio.yaConfigurado()) ? "bloqueado" : "sin_configurar");
      } catch {
        fijar("no_disponible");
      }
    })();

    return () => {
      vivo = false;
    };
  }, []);

  const refrescar = useCallback(async () => {
    setRegistros(await repositorio.listar());
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
      setFase("abierto");
      await refrescar();
    });
  }

  function abrir() {
    conManejo(async () => {
      if (!(await repositorio.desbloquear(contrasena))) {
        setMensaje("Contraseña incorrecta.");
        return;
      }
      setContrasena("");
      setFase("abierto");
      await refrescar();
    });
  }

  function guardarActual() {
    if (!analisisActual) return;
    conManejo(async () => {
      await repositorio.guardar({
        referencia: referenciaActual.trim() || "Sin referencia",
        nota: notaActual,
        analisis: analisisActual,
      });
      setGuardado(true);
      setTimeout(() => setGuardado(false), 2500);
      await refrescar();
    });
  }

  function abrirRegistro(id: string) {
    conManejo(async () => {
      const registro = await repositorio.obtener(id);
      if (registro) onAbrir(registro);
    });
  }

  function eliminar(id: string) {
    conManejo(async () => {
      await repositorio.eliminar(id);
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

  function importar(fichero: File) {
    conManejo(async () => {
      const cuantos = await repositorio.importarRespaldo(await fichero.text());
      setMensaje(`Se importaron ${cuantos} análisis.`);
      await refrescar();
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
          Elige una contraseña para guardar tus análisis. Se cifran en este
          dispositivo y no salen de él: ni nosotros ni nadie más puede leerlos.
        </p>
        <p className="mb-4 text-sm font-medium leading-relaxed text-ink">
          Si pierdes esta contraseña, los análisis guardados no se pueden
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
            Activar historial
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
          Introduce tu contraseña para ver los análisis guardados.
        </p>
        <div className="flex flex-wrap gap-2">
          <Campo
            valor={contrasena}
            onCambio={setContrasena}
            marcador="Contraseña"
            onEnter={abrir}
          />
          <Boton onClick={abrir} principal disabled={ocupado}>
            Abrir historial
          </Boton>
        </div>
        <Mensaje texto={mensaje} />
      </Marco>
    );
  }

  return (
    <Marco>
      <div className="mb-4 flex flex-wrap gap-2">
        {analisisActual && (
          <Boton onClick={guardarActual} principal disabled={ocupado}>
            {guardado ? "Guardado" : "Guardar este análisis"}
          </Boton>
        )}
        <Boton onClick={exportar} disabled={ocupado}>
          Exportar respaldo
        </Boton>
        <Boton onClick={() => entradaFichero.current?.click()} disabled={ocupado}>
          Importar respaldo
        </Boton>
        <Boton
          onClick={() => {
            repositorio.bloquear();
            setRegistros([]);
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

      {registros.length === 0 ? (
        <p className="text-sm text-ink-muted">
          Todavía no has guardado ningún análisis.
        </p>
      ) : (
        <ul className="divide-y divide-divider">
          {registros.map((r) => (
            <li key={r.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 py-2">
              <button
                type="button"
                onClick={() => abrirRegistro(r.id)}
                className="text-left text-[15px] font-medium text-accent hover:underline"
              >
                {r.referencia}
              </button>
              <span className="font-mono text-[11px] uppercase tracking-wide text-ink-muted">
                {formatearFecha(r.fecha)}
              </span>
              <span className="text-xs text-ink-muted">
                {r.conductas} {r.conductas === 1 ? "conducta" : "conductas"}
                {r.alertas > 0 && ` · ${r.alertas} revisiones`}
              </span>
              <button
                type="button"
                onClick={() => eliminar(r.id)}
                className="ml-auto text-xs text-ink-muted hover:text-ink hover:underline"
              >
                Eliminar
              </button>
            </li>
          ))}
        </ul>
      )}
      <Mensaje texto={mensaje} />
    </Marco>
  );
}

// --- piezas de interfaz, deliberadamente sobrias ---

function Marco({ children }: { children: React.ReactNode }) {
  return (
    <section className="mt-6 rounded-xl border border-divider bg-surface p-5 print:hidden">
      <h2 className="mb-3 font-serif text-lg font-semibold text-ink">
        Historial de casos
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
