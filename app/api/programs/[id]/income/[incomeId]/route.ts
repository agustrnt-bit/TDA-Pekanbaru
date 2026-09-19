import { accessErrorResponse, assertCanManageDivision, requireRegisteredUser } from "@/db/access-control";
import { deleteIncome } from "@/db/program-finance";
import { getProgram } from "@/db/program-management";
function idOf(raw: string) { const id = Number(raw); return Number.isInteger(id) && id > 0 ? id : null; }
export async function DELETE(_request: Request, context: { params: Promise<{ id: string; incomeId: string }> }) {
  try { const user = await requireRegisteredUser(); const params = await context.params; const id = idOf(params.id); const incomeId = idOf(params.incomeId);
    if (!id || !incomeId) return Response.json({ error: "ID tidak valid." }, { status: 400 });
    const program = await getProgram(id); if (!program) return Response.json({ error: "Program tidak ditemukan." }, { status: 404 }); assertCanManageDivision(user, program.divisionId);
    if (!(await deleteIncome(incomeId, id))) return Response.json({ error: "Penerimaan tidak ditemukan." }, { status: 404 }); return Response.json({ ok: true });
  } catch (reason) { return accessErrorResponse(reason, "Penerimaan belum dapat dihapus."); }
}
