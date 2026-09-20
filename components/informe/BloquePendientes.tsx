import type { ReactNode } from "react";
import { BloqueBase } from "./primitivas";
export default function BloquePendientes({ visible, children }: { visible: boolean; children: ReactNode }) { return <BloqueBase id="pendientes" visible={visible}>{children}</BloqueBase>; }
