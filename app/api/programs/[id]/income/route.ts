import { accessErrorResponse, assertCanManageDivision, requireRegisteredUser } from "@/db/access-control";
import { createIncome, deleteReceipt, saveReceipt } from "@/db/program-finance";
import { getProgram, getProgramTask } from "@/db/program-management";
import { logProgramActivity } from "@/db/program-activity";

const allowedTypes = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);
function idOf(raw: string) { const id = Number(raw); return Number.isInteger(id) && id > 0 ? id : null; }

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  let receiptKey: string | null = null;
  try {
    const user = await requireRegisteredUser(); const id = idOf((await context.params).id);
    if (!id) return Response.json({ error: "ID program tidak valid." }, { status: 400 });
    const program = await getProgram(id); if (!program) return Response.json({ error: "Program tidak ditemukan." }, { status: 404 });
    assertCanManageDivision(user, program.divisionId);
    const form = await request.formData(); const description = String(form.get("description") ?? "").trim();
    const source = String(form.get("source") ?? "Lainnya").trim(); const incomeDate = String(form.get("incomeDate") ?? "").trim();
    const amount = Math.max(0, Math.round(Number(form.get("amount")) || 0));
    const treasuryAccountId = Number(form.get("treasuryAccountId"));
    const taskId = Number(form.get("taskId")) || null;
    if (!description || !incomeDate || amount <= 0 || !treasuryAccountId) return Response.json({ error: "Uraian, rekening, tanggal, dan nominal wajib diisi." }, { status: 400 });
    if (taskId && !(await getProgramTask(taskId, id))) return Response.json({ error: "Breakdown pekerjaan tidak sesuai program." }, { status: 400 });
    const receipt = form.get("receipt"); let receiptName: string | null = null; let receiptType: string | null = null;
    if (receipt instanceof File && receipt.size > 0) {
      if (receipt.size > 5 * 1024 * 1024) return Response.json({ error: "Ukuran bukti maksimal 5 MB." }, { status: 400 });
      if (!allowedTypes.has(receipt.type)) return Response.json({ error: "Bukti harus berupa PDF, JPG, PNG, atau WebP." }, { status: 400 });
      receiptKey = await saveReceipt(id, receipt); receiptName = receipt.name.slice(0, 180); receiptType = receipt.type;
    }
    const income = await createIncome(id, user.id, { taskId, description, source: source || "Lainnya", incomeDate, amount, treasuryAccountId, receiptKey, receiptName, receiptType });
    await logProgramActivity(user.id, id, "income_created", `Mencatat penerimaan ${description} sebesar Rp${amount.toLocaleString("id-ID")}.`);
    return Response.json({ income }, { status: 201 });
  } catch (reason) { if (receiptKey) await deleteReceipt(receiptKey).catch(() => undefined); return accessErrorResponse(reason, "Penerimaan belum dapat disimpan."); }
}
