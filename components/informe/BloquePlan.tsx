import type { ReactNode } from "react";
import { BloqueBase } from "./primitivas";
export default function BloquePlan({ visible, children }: { visible: boolean; children: ReactNode }) { return <BloqueBase id="plan" visible={visible}>{children}</BloqueBase>; }
