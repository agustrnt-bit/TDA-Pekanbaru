import { accessErrorResponse, requireRegisteredUser } from "@/db/access-control";
import { getIncome, getReceipt } from "@/db/program-finance";
function idOf(raw: string) { const id = Number(raw); return Number.isInteger(id) && id > 0 ? id : null; }
export async function GET(_request: Request, context: { params: Promise<{ id: string; incomeId: string }> }) {
  try { await requireRegisteredUser(); const params = await context.params; const id = idOf(params.id); const incomeId = idOf(params.incomeId);
    if (!id || !incomeId) return Response.json({ error: "ID tidak valid." }, { status: 400 }); const income = await getIncome(incomeId, id);
    if (!income?.receiptKey) return Response.json({ error: "Bukti penerimaan tidak ditemukan." }, { status: 404 }); const object = await getReceipt(income.receiptKey);
    if (!object) return Response.json({ error: "File bukti tidak ditemukan." }, { status: 404 }); const headers = new Headers(); object.writeHttpMetadata(headers);
    headers.set("content-type", income.receiptType || "application/octet-stream"); headers.set("content-disposition", `inline; filename*=UTF-8''${encodeURIComponent(income.receiptName || "bukti-penerimaan")}`); headers.set("cache-control", "private, no-store"); return new Response(object.body, { headers });
  } catch (reason) { return accessErrorResponse(reason, "Bukti penerimaan belum dapat dibuka."); }
}
