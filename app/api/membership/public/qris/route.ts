import { getMembershipFile } from "@/db/membership";
import { env } from "cloudflare:workers";

export async function GET() {
  try {
    const settings = await env.DB.prepare(`SELECT qris_key AS qrisKey, qris_type AS qrisType FROM membership_settings WHERE id = 1`)
      .first<{ qrisKey: string | null; qrisType: string | null }>();
    if (!settings?.qrisKey) return new Response("QRIS belum tersedia.", { status: 404 });
    const object = await getMembershipFile(settings.qrisKey);
    if (!object) return new Response("QRIS tidak ditemukan.", { status: 404 });
    return new Response(object.body, { headers: { "Content-Type": settings.qrisType || "image/png", "Cache-Control": "public, max-age=300" } });
  } catch {
    return new Response("QRIS belum dapat dimuat.", { status: 500 });
  }
}
