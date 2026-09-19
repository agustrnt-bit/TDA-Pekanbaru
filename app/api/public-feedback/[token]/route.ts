import { getPublicFeedback, savePublicFeedback } from "@/db/program-feedback";

export async function GET(_request: Request, context: { params: Promise<{ token: string }> }) {
  try { const data = await getPublicFeedback((await context.params).token); if (!data) return Response.json({ error: "Peserta tidak ditemukan." }, { status: 404 }); return Response.json(data); }
  catch { return Response.json({ error: "Form feedback belum dapat dimuat." }, { status: 500 }); }
}

export async function POST(request: Request, context: { params: Promise<{ token: string }> }) {
  try { const body = await request.json(); await savePublicFeedback((await context.params).token, body.answers ?? {}); return Response.json({ ok: true }); }
  catch (reason) { return Response.json({ error: reason instanceof Error ? reason.message : "Feedback belum dapat disimpan." }, { status: 400 }); }
}
