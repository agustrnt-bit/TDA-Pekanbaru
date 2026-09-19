import { confirmParticipantPayment } from "@/db/attendance";

const allowedTypes = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);

export async function POST(request: Request, { params }: { params: Promise<{ eventId: string }> }) {
  try {
    const { eventId } = await params;
    const form = await request.formData();
    const token = String(form.get("token") ?? "").trim();
    const method = String(form.get("method") ?? "Transfer Bank").trim();
    const proof = form.get("proof");
    if (!token || !(proof instanceof File) || proof.size === 0) return Response.json({ error: "Bukti pembayaran wajib diunggah." }, { status: 400 });
    if (proof.size > 5 * 1024 * 1024) return Response.json({ error: "Ukuran bukti maksimal 5 MB." }, { status: 400 });
    if (!allowedTypes.has(proof.type)) return Response.json({ error: "Bukti harus berupa PDF, JPG, PNG, atau WebP." }, { status: 400 });
    const participant = await confirmParticipantPayment(Number(eventId), token, method, proof);
    return Response.json({ participant });
  } catch (reason) {
    const message = reason instanceof Error ? reason.message : "";
    if (message === "PARTICIPANT_NOT_FOUND") return Response.json({ error: "Data pendaftaran tidak ditemukan." }, { status: 404 });
    if (message === "PAYMENT_NOT_REQUIRED") return Response.json({ error: "Event ini tidak memerlukan pembayaran." }, { status: 400 });
    return Response.json({ error: "Konfirmasi pembayaran belum dapat disimpan." }, { status: 500 });
  }
}
