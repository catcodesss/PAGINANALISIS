import type { ReactNode } from "react";
import { BloqueBase } from "./primitivas";
export default function BloqueMantenimiento({ visible, children }: { visible: boolean; children: ReactNode }) { return <BloqueBase id="mantenimiento" visible={visible}>{children}</BloqueBase>; }
