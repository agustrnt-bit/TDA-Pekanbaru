import { accessErrorResponse, requireRegisteredUser } from "@/db/access-control";
import { getExpense, getReceipt } from "@/db/program-finance";

function idOf(raw: string) { const id = Number(raw); return Number.isInteger(id) && id > 0 ? id : null; }

export async function GET(_request: Request, context: { params: Promise<{ id: string; expenseId: string }> }) {
  try {
    await requireRegisteredUser(); const params = await context.params;
    const id = idOf(params.id); const expenseId = idOf(params.expenseId);
    if (!id || !expenseId) return Response.json({ error: "ID tidak valid." }, { status: 400 });
    const expense = await getExpense(expenseId, id);
    if (!expense?.receiptKey) return Response.json({ error: "Bukti transaksi tidak ditemukan." }, { status: 404 });
    const object = await getReceipt(expense.receiptKey);
    if (!object) return Response.json({ error: "File bukti tidak ditemukan." }, { status: 404 });
    const headers = new Headers(); object.writeHttpMetadata(headers);
    headers.set("content-type", expense.receiptType || "application/octet-stream");
    headers.set("content-disposition", `inline; filename*=UTF-8''${encodeURIComponent(expense.receiptName || "bukti")}`);
    headers.set("cache-control", "private, no-store");
    return new Response(object.body, { headers });
  } catch (reason) { return accessErrorResponse(reason, "Bukti transaksi belum dapat dibuka."); }
}
