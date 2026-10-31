/**
 * Topes de casos activos por plan. Lo usan el servidor (lib/servidor/ranuras.ts,
 * que es quien los hace cumplir) y la lista de casos, que solo los muestra.
 */
export interface PlanCasos {
  id: string;
  max_casos_activos: number;
}

export const PLANES: Record<string, PlanCasos> = {
  gratuito: { id: "gratuito", max_casos_activos: 3 },
  profesional: { id: "profesional", max_casos_activos: 15 },
  intensivo: { id: "intensivo", max_casos_activos: 50 },
};
export const PLAN_POR_DEFECTO = "gratuito";

export const NOMBRE_PLAN: Record<string, string> = {
  gratuito: "Plan gratuito",
  profesional: "Plan profesional",
  intensivo: "Plan intensivo",
};

export function planDe(id: unknown): PlanCasos {
  return (typeof id === "string" && PLANES[id]) || PLANES[PLAN_POR_DEFECTO];
}
