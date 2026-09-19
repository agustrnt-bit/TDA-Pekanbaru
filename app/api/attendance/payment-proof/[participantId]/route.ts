import { accessErrorResponse, requireRegisteredUser } from "@/db/access-control";
import { getAttendanceFile } from "@/db/attendance";
import { env } from "cloudflare:workers";

export async function GET(_request: Request, { params }: { params: Promise<{ participantId: string }> }) {
  try {
    await requireRegisteredUser();
    const id = Number((await params).participantId);
    const participant = await env.DB.prepare(`SELECT payment_proof_key AS paymentProofKey,
      payment_proof_name AS paymentProofName, payment_proof_type AS paymentProofType
      FROM attendance_participants WHERE id = ? LIMIT 1`).bind(id)
      .first<{ paymentProofKey: string | null; paymentProofName: string | null; paymentProofType: string | null }>();
    if (!participant?.paymentProofKey) return Response.json({ error: "Bukti pembayaran belum tersedia." }, { status: 404 });
    const object = await getAttendanceFile(participant.paymentProofKey);
    if (!object) return Response.json({ error: "Bukti pembayaran tidak ditemukan." }, { status: 404 });
    const headers = new Headers(); object.writeHttpMetadata(headers);
    headers.set("content-type", participant.paymentProofType || "application/octet-stream");
    headers.set("content-disposition", `inline; filename*=UTF-8''${encodeURIComponent(participant.paymentProofName || "bukti-pembayaran")}`);
    headers.set("cache-control", "private, no-store");
    return new Response(object.body, { headers });
  } catch (reason) { return accessErrorResponse(reason, "Bukti pembayaran belum dapat dibuka."); }
}
