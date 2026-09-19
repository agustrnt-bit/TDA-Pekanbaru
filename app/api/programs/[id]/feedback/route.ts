import { accessErrorResponse, assertCanManageDivision, requireRegisteredUser } from "@/db/access-control";
import { addFeedbackQuestion, deleteFeedbackQuestion, getProgramFeedback, getProgramFeedbackResults, setFeedbackOpen } from "@/db/program-feedback";
import { getProgram } from "@/db/program-management";

function idOf(value: string) { const id = Number(value); return Number.isInteger(id) && id > 0 ? id : null; }

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try { await requireRegisteredUser(); const id = idOf((await context.params).id); if (!id) return Response.json({ error: "Program tidak valid." }, { status: 400 }); const url = new URL(request.url); if (url.searchParams.get("scope") === "results") return Response.json(await getProgramFeedbackResults(id, idOf(url.searchParams.get("eventId") || "") ?? undefined)); return Response.json(await getProgramFeedback(id)); }
  catch (reason) { return accessErrorResponse(reason, "Feedback belum dapat dimuat."); }
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireRegisteredUser(); const id = idOf((await context.params).id); if (!id) return Response.json({ error: "Program tidak valid." }, { status: 400 });
    const program = await getProgram(id); if (!program) return Response.json({ error: "Program tidak ditemukan." }, { status: 404 }); assertCanManageDivision(user, program.divisionId);
    const body = await request.json(); const question = String(body.question ?? "").trim(); const questionType = String(body.questionType ?? "paragraph");
    if (!question) return Response.json({ error: "Pertanyaan wajib diisi." }, { status: 400 });
    if (!["rating", "text", "paragraph", "select", "checklist"].includes(questionType)) return Response.json({ error: "Tipe pertanyaan tidak valid." }, { status: 400 });
    const options = Array.isArray(body.options) ? body.options.map(String).map((v: string) => v.trim()).filter(Boolean) : [];
    if (["select", "checklist"].includes(questionType) && options.length < 2) return Response.json({ error: "Isi minimal dua pilihan jawaban." }, { status: 400 });
    return Response.json(await addFeedbackQuestion(id, { question, questionType, options, isRequired: Boolean(body.isRequired) }), { status: 201 });
  } catch (reason) { return accessErrorResponse(reason, "Pertanyaan belum dapat disimpan."); }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try { const user = await requireRegisteredUser(); const id = idOf((await context.params).id); if (!id) return Response.json({ error: "Program tidak valid." }, { status: 400 }); const program = await getProgram(id); if (!program) return Response.json({ error: "Program tidak ditemukan." }, { status: 404 }); assertCanManageDivision(user, program.divisionId); const body = await request.json(); const ok = await setFeedbackOpen(id, Number(body.eventId), Boolean(body.open)); return Response.json({ ok }); }
  catch (reason) { return accessErrorResponse(reason, "Status feedback belum dapat diperbarui."); }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try { const user = await requireRegisteredUser(); const id = idOf((await context.params).id); if (!id) return Response.json({ error: "Program tidak valid." }, { status: 400 }); const program = await getProgram(id); if (!program) return Response.json({ error: "Program tidak ditemukan." }, { status: 404 }); assertCanManageDivision(user, program.divisionId); const questionId = Number(new URL(request.url).searchParams.get("questionId")); return Response.json({ ok: await deleteFeedbackQuestion(id, questionId) }); }
  catch (reason) { return accessErrorResponse(reason, "Pertanyaan belum dapat dihapus."); }
}
