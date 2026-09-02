import type { ReactNode } from "react";

/**
 * Franja de identidad del documento: un rótulo en versalitas y una línea de
 * texto, centrados, sobre fondo crema con borde inferior ocre.
 *
 * Existe como componente propio porque hay dos franjas con el mismo
 * tratamiento visual y vidas distintas: la de «informe de ejemplo» es
 * andamiaje de la maqueta y desaparece con ella (ver CLAUDE.md), mientras que
 * el descargo de IA es permanente y viaja con todo informe. Duplicar los
 * estilos habría dejado la permanente huérfana el día que se borre la otra.
 *
 * Sin botón de cerrar y sin `print:hidden`: las dos tienen que salir también
 * en papel, que es donde el documento se lee fuera de contexto.
 */
export default function FranjaDocumento({
  rotulo,
  children,
}: {
  rotulo: string;
  children: ReactNode;
}) {
  return (
    <div className="border-b-2 border-warn bg-warn/15 px-4 py-3 text-center">
      <p className="mx-auto max-w-4xl text-sm font-medium leading-relaxed text-ink">
        <span className="font-mono text-xs uppercase tracking-wide text-warn">
          {rotulo} ·{" "}
        </span>
        {children}
      </p>
    </div>
  );
}
