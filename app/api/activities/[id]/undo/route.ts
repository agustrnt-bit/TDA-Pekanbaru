import { undoActivity } from "@/db/tasks";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id: rawId } = await context.params;
    const id = Number(rawId);
    if (!Number.isInteger(id) || id < 1) return Response.json({ error: "ID tidak valid." }, { status: 400 });
    const success = await undoActivity(id);
    if (!success) return Response.json({ error: "Perubahan ini tidak dapat dibatalkan." }, { status: 409 });
    return Response.json({ success: true });
  } catch {
    return Response.json({ error: "Perubahan belum dapat dibatalkan." }, { status: 500 });
  }
}
