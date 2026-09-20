import type { ReactNode } from "react";
import { BloqueBase } from "./primitivas";
export default function BloqueSintesis({ visible, children }: { visible: boolean; children: ReactNode }) { return <BloqueBase id="sintesis" visible={visible}>{children}</BloqueBase>; }
