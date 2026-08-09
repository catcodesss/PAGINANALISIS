import type { Metadata } from "next";
import VistaEjemplo from "@/components/VistaEjemplo";
import { informeDeMaqueta } from "@/lib/maquetaInforme";

/**
 * Página de ejemplo, para revisar el formato del informe desde cualquier
 * dispositivo sin gastar una llamada al modelo.
 *
 * Se prerenderiza en el build (`force-static`): el informe se arma una sola vez,
 * cuando el repositorio entero está disponible, y lo que se despliega es HTML.
 * Así no hace falta que los ficheros de `evals/` lleguen al servidor de
 * producción ni que nadie lea del disco al servir la página.
 *
 * `noindex` porque no es contenido del producto: es una herramienta de trabajo
 * y no tiene sentido que aparezca en un buscador.
 */
export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "ACIA — informe de ejemplo",
  description:
    "Informe de ejemplo sobre un caso ficticio, para mostrar el formato del análisis. No es el análisis de ninguna nota real.",
  robots: { index: false, follow: false },
};

/** Fija, no la de hoy: la página es estática y una fecha que no cambia lo dice. */
const FECHA_EJEMPLO = "caso de ejemplo — sin fecha de sesión";

export default function PaginaMaqueta() {
  const { analisis, nota } = informeDeMaqueta();

  return (
    <VistaEjemplo analisisInicial={analisis} nota={nota} fecha={FECHA_EJEMPLO} />
  );
}
