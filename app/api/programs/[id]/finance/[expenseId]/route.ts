import { accessErrorResponse, assertCanManageDivision, requireRegisteredUser } from "@/db/access-control";
import { deleteExpense, updateExpense } from "@/db/program-finance";
import { getProgram } from "@/db/program-management";

function idOf(raw: string) { const id = Number(raw); return Number.isInteger(id) && id > 0 ? id : null; }

export async function PATCH(request: Request, context: { params: Promise<{ id: string; expenseId: string }> }) {
  try {
    const user = await requireRegisteredUser(); const params = await context.params;
    const id = idOf(params.id); const expenseId = idOf(params.expenseId);
    if (!id || !expenseId) return Response.json({ error: "ID tidak valid." }, { status: 400 });
    const program = await getProgram(id); if (!program) return Response.json({ error: "Program tidak ditemukan." }, { status: 404 });
    assertCanManageDivision(user, program.divisionId);
    const body = await request.json(); const description = String(body.description ?? "").trim();
    const category = String(body.category ?? "Lainnya").trim(); const expenseDate = String(body.expenseDate ?? "").trim();
    const amount = Math.max(0, Math.round(Number(body.amount) || 0));
    if (!description || !expenseDate || amount <= 0) return Response.json({ error: "Uraian, tanggal, dan nominal wajib diisi." }, { status: 400 });
    const expense = await updateExpense(expenseId, id, { description, category, expenseDate, amount });
    if (!expense) return Response.json({ error: "Realisasi tidak ditemukan." }, { status: 404 });
    return Response.json({ expense });
  } catch (reason) { return accessErrorResponse(reason, "Realisasi belum dapat diperbarui."); }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string; expenseId: string }> }) {
  try {
    const user = await requireRegisteredUser(); const params = await context.params;
    const id = idOf(params.id); const expenseId = idOf(params.expenseId);
    if (!id || !expenseId) return Response.json({ error: "ID tidak valid." }, { status: 400 });
    const program = await getProgram(id); if (!program) return Response.json({ error: "Program tidak ditemukan." }, { status: 404 });
    assertCanManageDivision(user, program.divisionId);
    if (!(await deleteExpense(expenseId, id))) return Response.json({ error: "Realisasi tidak ditemukan." }, { status: 404 });
    return Response.json({ ok: true });
  } catch (reason) { return accessErrorResponse(reason, "Realisasi belum dapat dihapus."); }
}
