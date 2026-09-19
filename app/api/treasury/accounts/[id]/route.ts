import { accessErrorResponse, requireTreasuryManager } from "@/db/access-control";
import { updateTreasuryAccount } from "@/db/treasury";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireTreasuryManager();
    const id = Number((await context.params).id);
    const body = await request.json() as Record<string, unknown>;
    const name = String(body.name ?? "").trim();
    if (!Number.isInteger(id) || id < 1 || !name) return Response.json({ error: "Nama rekening wajib diisi." }, { status: 400 });
    const changed = await updateTreasuryAccount(id, {
      name, bankName: String(body.bankName ?? "").trim(), accountNumber: String(body.accountNumber ?? "").trim(),
      accountHolder: String(body.accountHolder ?? "").trim(), openingBalance: Math.max(0, Math.round(Number(body.openingBalance) || 0)),
    });
    if (!changed) return Response.json({ error: "Rekening tidak ditemukan." }, { status: 404 });
    return Response.json({ ok: true });
  } catch (reason) {
    return accessErrorResponse(reason, "Rekening belum dapat diperbarui.");
  }
}
