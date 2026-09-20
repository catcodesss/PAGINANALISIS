import type { ReactNode } from "react";
import { BloqueBase } from "./primitivas";
export default function BloqueAnalisisFuncional({ visible, children }: { visible: boolean; children: ReactNode }) { return <BloqueBase id="que-pasa" visible={visible}>{children}</BloqueBase>; }
