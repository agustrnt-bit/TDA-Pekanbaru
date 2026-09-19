import { confirmMembershipPayment } from "@/db/membership";

const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const token = String(form.get("token") ?? "").trim();
    const method = String(form.get("method") ?? "").trim();
    const proof = form.get("proof");
    if (!token || !method || !(proof instanceof File) || !proof.size) return Response.json({ error: "Metode dan bukti pembayaran wajib diisi." }, { status: 400 });
    if (proof.size > 5 * 1024 * 1024) return Response.json({ error: "Ukuran bukti pembayaran maksimal 5 MB." }, { status: 400 });
    if (!allowedTypes.has(proof.type)) return Response.json({ error: "Bukti pembayaran harus berupa JPG, PNG, WebP, atau PDF." }, { status: 400 });
    return Response.json({ registration: await confirmMembershipPayment(token, method, proof) });
  } catch {
    return Response.json({ error: "Konfirmasi pembayaran belum dapat disimpan." }, { status: 500 });
  }
}
