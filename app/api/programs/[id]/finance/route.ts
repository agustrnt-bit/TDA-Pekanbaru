import { accessErrorResponse, assertCanManageDivision, requireRegisteredUser } from "@/db/access-control";
import { createExpense, deleteReceipt, getProgramFinance, saveReceipt, updateIncomeBudget } from "@/db/program-finance";
import { getProgram, getProgramTask, listProgramTasks } from "@/db/program-management";
import { logProgramActivity } from "@/db/program-activity";

const allowedTypes = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);
function idOf(raw: string) { const id = Number(raw); return Number.isInteger(id) && id > 0 ? id : null; }

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireRegisteredUser();
    const id = idOf((await context.params).id);
    if (!id) return Response.json({ error: "ID program tidak valid." }, { status: 400 });
    const program = await getProgram(id);
    if (!program) return Response.json({ error: "Program kerja tidak ditemukan." }, { status: 404 });
    const [finance, tasks] = await Promise.all([getProgramFinance(id), listProgramTasks(id)]);
    return Response.json({ program, ...finance, tasks });
  } catch (reason) { return accessErrorResponse(reason, "Data keuangan belum dapat dimuat."); }
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  let receiptKey: string | null = null;
  try {
    const user = await requireRegisteredUser();
    const id = idOf((await context.params).id);
    if (!id) return Response.json({ error: "ID program tidak valid." }, { status: 400 });
    const program = await getProgram(id);
    if (!program) return Response.json({ error: "Program kerja tidak ditemukan." }, { status: 404 });
    assertCanManageDivision(user, program.divisionId);
    const form = await request.formData();
    const description = String(form.get("description") ?? "").trim();
    const category = String(form.get("category") ?? "Lainnya").trim();
    const expenseDate = String(form.get("expenseDate") ?? "").trim();
    const amount = Math.max(0, Math.round(Number(form.get("amount")) || 0));
    const treasuryAccountId = Number(form.get("treasuryAccountId"));
    const taskId = Number(form.get("taskId")) || null;
    if (!description || !expenseDate || amount <= 0 || !treasuryAccountId) return Response.json({ error: "Uraian, rekening, tanggal, dan nominal wajib diisi." }, { status: 400 });
    if (taskId && !(await getProgramTask(taskId, id))) return Response.json({ error: "Breakdown pekerjaan tidak sesuai program." }, { status: 400 });
    const receipt = form.get("receipt");
    let receiptName: string | null = null;
    let receiptType: string | null = null;
    if (receipt instanceof File && receipt.size > 0) {
      if (receipt.size > 5 * 1024 * 1024) return Response.json({ error: "Ukuran bukti maksimal 5 MB." }, { status: 400 });
      if (!allowedTypes.has(receipt.type)) return Response.json({ error: "Bukti harus berupa PDF, JPG, PNG, atau WebP." }, { status: 400 });
      receiptKey = await saveReceipt(id, receipt);
      receiptName = receipt.name.slice(0, 180);
      receiptType = receipt.type;
    }
    const expense = await createExpense(id, user.id, { taskId, description, category: category || "Lainnya", expenseDate, amount, treasuryAccountId, receiptKey, receiptName, receiptType });
    await logProgramActivity(user.id, id, "expense_created", `Mencatat pengeluaran ${description} sebesar Rp${amount.toLocaleString("id-ID")}.`);
    return Response.json({ expense }, { status: 201 });
  } catch (reason) {
    if (receiptKey) await deleteReceipt(receiptKey).catch(() => undefined);
    return accessErrorResponse(reason, "Realisasi belum dapat disimpan.");
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireRegisteredUser(); const id = idOf((await context.params).id);
    if (!id) return Response.json({ error: "ID program tidak valid." }, { status: 400 });
    const program = await getProgram(id); if (!program) return Response.json({ error: "Program tidak ditemukan." }, { status: 404 });
    assertCanManageDivision(user, program.divisionId);
    const body = await request.json(); const amount = Math.max(0, Math.round(Number(body.incomeBudget) || 0));
    await updateIncomeBudget(id, amount); await logProgramActivity(user.id, id, "income_budget_updated", `Memperbarui target penerimaan menjadi Rp${amount.toLocaleString("id-ID")}.`); return Response.json({ incomeBudget: amount });
  } catch (reason) { return accessErrorResponse(reason, "Target penerimaan belum dapat disimpan."); }
}
