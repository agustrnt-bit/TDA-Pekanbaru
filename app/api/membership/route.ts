import { accessErrorResponse, requireMembershipManager } from "@/db/access-control";
import { deleteMembershipRegistration, getMembershipAdminData, getMembershipRegistrations, saveMembershipFile, setMembershipPaymentStatus, setMembershipQris, updateMembershipPackage, updateMembershipRegistration, updateMembershipSettings, updateMembershipShirtStatus, upsertMembershipOption } from "@/db/membership";

const imageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function GET(request: Request) {
  try {
    await requireMembershipManager();
    if (new URL(request.url).searchParams.get("scope") === "registrations") {
      return Response.json({ registrations: await getMembershipRegistrations() });
    }
    return Response.json(await getMembershipAdminData());
  } catch (reason) {
    return accessErrorResponse(reason, "Data member belum dapat dimuat.");
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireMembershipManager();
    if (request.headers.get("content-type")?.includes("multipart/form-data")) {
      const form = await request.formData();
      if (String(form.get("action")) !== "settings") return Response.json({ error: "Aksi tidak dikenali." }, { status: 400 });
      const qris = form.get("qris");
      await updateMembershipSettings({
        adminWhatsapp: String(form.get("adminWhatsapp") ?? "6285121804468"),
        treasuryAccountId: Number(form.get("treasuryAccountId")) || null,
        paymentInstructions: String(form.get("paymentInstructions") ?? "").trim(),
      });
      if (qris instanceof File && qris.size > 0) {
        if (qris.size > 5 * 1024 * 1024) return Response.json({ error: "Ukuran QRIS maksimal 5 MB." }, { status: 400 });
        if (!imageTypes.has(qris.type)) return Response.json({ error: "QRIS harus berupa JPG, PNG, atau WebP." }, { status: 400 });
        const key = await saveMembershipFile("membership-qris", qris);
        await setMembershipQris(key, qris.name.slice(0, 180), qris.type);
      }
      return Response.json({ ok: true });
    }
    const body = await request.json() as Record<string, unknown>;
    const action = String(body.action ?? "");
    if (action === "option") {
      const label = String(body.label ?? "").trim();
      if (label.length < 1 || label.length > 120) return Response.json({ error: "Nama pilihan harus terdiri dari 1–120 karakter." }, { status: 400 });
      await upsertMembershipOption({ id: Number(body.id) || undefined, type: String(body.type ?? ""), label, isActive: body.isActive !== false });
      return Response.json({ ok: true });
    }
    if (action === "package") {
      const changed = await updateMembershipPackage({ id: Number(body.id), name: String(body.name ?? "").trim(),
        amount: Math.max(0, Math.round(Number(body.amount) || 0)), isActive: body.isActive !== false });
      if (!changed) return Response.json({ error: "Paket tidak ditemukan." }, { status: 404 });
      return Response.json({ ok: true });
    }
    if (action === "update-registration") {
      const changed = await updateMembershipRegistration(Number(body.id), body, user.id);
      if (!changed) return Response.json({ error: "Pendaftar tidak ditemukan." }, { status: 404 });
      return Response.json({ ok: true });
    }
    if (action === "delete-registration") {
      const deleted = await deleteMembershipRegistration(Number(body.id));
      if (!deleted) return Response.json({ error: "Pendaftar tidak ditemukan." }, { status: 404 });
      return Response.json({ ok: true });
    }
    if (action === "payment-status") {
      const status = String(body.status);
      if (status !== "paid" && status !== "rejected") return Response.json({ error: "Status pembayaran tidak valid." }, { status: 400 });
      const changed = await setMembershipPaymentStatus(Number(body.id), status, String(body.note ?? "").trim(), user.id,
        Math.max(0, Math.round(Number(body.amount) || 0)), String(body.paidAt ?? "").trim());
      if (!changed) return Response.json({ error: "Pendaftar tidak ditemukan." }, { status: 404 });
      return Response.json({ ok: true });
    }
    if (action === "shirt-status") {
      await updateMembershipShirtStatus(Number(body.id), String(body.shirtStatus ?? ""));
      return Response.json({ ok: true });
    }
    return Response.json({ error: "Aksi tidak dikenali." }, { status: 400 });
  } catch (reason) {
    return accessErrorResponse(reason, "Data member belum dapat disimpan.");
  }
}
