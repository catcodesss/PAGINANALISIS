import { firestoreAdmin } from "@/lib/servidor/admin";
import { purgarEliminados } from "@/lib/servidor/ranuras";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Tarea diaria de Vercel (vercel.json): borra para siempre los casos eliminados
 * hace 30 días o más. Si existe CRON_SECRET, Vercel lo manda como Bearer y se
 * exige. Aun sin él, llamarla no adelanta ningún borrado: solo hace lo que ya tocaba.
 */
export async function GET(peticion: Request) {
  const secreto = process.env.CRON_SECRET;
  if (secreto && peticion.headers.get("authorization") !== `Bearer ${secreto}`) {
    return new Response(JSON.stringify({ error: "no_autorizado" }), { status: 401 });
  }
  try {
    const { borrados } = await purgarEliminados(firestoreAdmin());
    return Response.json({ borrados });
  } catch (error) {
    console.error("Error al purgar eliminados:", error instanceof Error ? error.name : "desconocido");
    return Response.json({ error: "error_interno" }, { status: 500 });
  }
}
