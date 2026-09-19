import { accessErrorResponse, requireTreasuryManager } from "@/db/access-control";
import { createManualTreasuryTransaction, createTreasuryTransfer, deleteManualTreasuryTransaction, getTreasuryDashboard, updateManualTreasuryTransaction } from "@/db/treasury";
import { reviewOnsitePayment } from "@/db/attendance";

function positiveAmount(value: unknown) {
  return Math.max(0, Math.round(Number(value) || 0));
}

export async function GET() {
  try {
    await requireTreasuryManager();
    return Response.json(await getTreasuryDashboard());
  } catch (reason) {
    return accessErrorResponse(reason, "Buku besar belum dapat dimuat.");
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireTreasuryManager();
    const body = await request.json() as Record<string, unknown>;
    const action = String(body.action ?? "manual");
    if (action === "delete-manual") {
      const deleted = await deleteManualTreasuryTransaction(Number(body.id));
      if (!deleted) return Response.json({ error: "Transaksi manual tidak ditemukan." }, { status: 404 });
      return Response.json({ ok: true });
    }
    if (action === "review-onsite-payment") {
      const participantId = Number(body.participantId);
      const approved = Boolean(body.approved);
      const accountId = Number(body.accountId);
      const amount = positiveAmount(body.amount);
      if (!participantId || !accountId || amount <= 0) return Response.json({ error: "Peserta, rekening, dan nominal wajib diisi." }, { status: 400 });
      await reviewOnsitePayment(participantId, approved, user.id, { accountId, amount, note: String(body.note ?? "").trim() });
      return Response.json({ ok: true });
    }
    const transactionDate = String(body.transactionDate ?? "").trim();
    const amount = positiveAmount(body.amount);
    if (!transactionDate || amount <= 0) return Response.json({ error: "Tanggal dan nominal wajib diisi." }, { status: 400 });
    if (action === "transfer") {
      await createTreasuryTransfer(user.id, {
        fromAccountId: Number(body.fromAccountId), toAccountId: Number(body.toAccountId),
        transactionDate, amount, description: String(body.description ?? "").trim(),
      });
      return Response.json({ ok: true }, { status: 201 });
    }
    const direction = String(body.direction);
    const description = String(body.description ?? "").trim();
    if ((direction !== "income" && direction !== "expense") || !description) {
      return Response.json({ error: "Jenis dan uraian transaksi wajib diisi." }, { status: 400 });
    }
    const input = {
      accountId: Number(body.accountId), direction, description,
      category: String(body.category ?? "Lainnya").trim() || "Lainnya", transactionDate, amount,
    };
    if (action === "update-manual") {
      const changed = await updateManualTreasuryTransaction(Number(body.id), input);
      if (!changed) return Response.json({ error: "Transaksi manual tidak ditemukan." }, { status: 404 });
      return Response.json({ ok: true });
    }
    await createManualTreasuryTransaction(user.id, input);
    return Response.json({ ok: true }, { status: 201 });
  } catch (reason) {
    if (reason instanceof Error && reason.message === "SAME_ACCOUNT") return Response.json({ error: "Rekening asal dan tujuan harus berbeda." }, { status: 400 });
    if (reason instanceof Error && reason.message === "ACCOUNT_NOT_FOUND") return Response.json({ error: "Rekening tidak ditemukan." }, { status: 404 });
    if (reason instanceof Error && reason.message === "INSUFFICIENT_BALANCE") return Response.json({ error: "Saldo rekening asal tidak mencukupi." }, { status: 400 });
    if (reason instanceof Error && reason.message === "PENDING_PAYMENT_NOT_FOUND") return Response.json({ error: "Pembayaran menunggu validasi tidak ditemukan." }, { status: 404 });
    return accessErrorResponse(reason, "Transaksi belum dapat disimpan.");
  }
}
