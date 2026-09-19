import { createMembershipRegistration, getMembershipPublicConfig, getPublicMembershipRegistration } from "@/db/membership";

export async function GET(request: Request) {
  try {
    const token = new URL(request.url).searchParams.get("ticket")?.trim();
    const config = await getMembershipPublicConfig();
    return Response.json({ ...config, registration: token ? await getPublicMembershipRegistration(token) : null });
  } catch {
    return Response.json({ error: "Formulir member belum dapat dimuat." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const registration = await createMembershipRegistration(await request.json() as Record<string, unknown>);
    return Response.json({ registration }, { status: 201 });
  } catch (reason) {
    const code = reason instanceof Error ? reason.message : "";
    const messages: Record<string, string> = {
      PACKAGE_INVALID: "Paket yang dipilih tidak valid.",
      REQUIRED_FIELDS: "Lengkapi data wajib dengan format yang benar.",
      CHECKLIST_REQUIRED: "Pilih minimal satu permasalahan bisnis dan satu sistem yang sudah berjalan.",
      SHIRT_SIZE_REQUIRED: "Ukuran baju wajib dipilih untuk paket ini.",
      PASSPORT_REQUIRED: "Nomor TDA Passport wajib diisi untuk Member Existing.",
    };
    return Response.json({ error: messages[code] || "Pendaftaran belum dapat disimpan." }, { status: 400 });
  }
}
