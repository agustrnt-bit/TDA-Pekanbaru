import { accessErrorResponse, requireMembershipManager } from "@/db/access-control";
import { getMembershipFile } from "@/db/membership";
import { env } from "cloudflare:workers";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireMembershipManager();
    const { id } = await context.params;
    const row = await env.DB.prepare(`SELECT payment_proof_key AS key, payment_proof_type AS type
      FROM membership_registrations WHERE id = ?`).bind(Number(id)).first<{ key: string | null; type: string | null }>();
    if (!row?.key) return new Response("Bukti tidak ditemukan.", { status: 404 });
    const object = await getMembershipFile(row.key);
    if (!object) return new Response("Bukti tidak ditemukan.", { status: 404 });
    return new Response(object.body, { headers: { "Content-Type": row.type || "application/octet-stream", "Cache-Control": "private, max-age=60" } });
  } catch (reason) {
    return accessErrorResponse(reason, "Bukti pembayaran belum dapat dibuka.");
  }
}
