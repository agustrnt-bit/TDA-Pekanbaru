import { accessErrorResponse, assertCanManageDivision, requireRegisteredUser } from "@/db/access-control";
import { getProgram } from "@/db/program-management";
import { getProgramPublication, listProgramRegistrationEvents, saveProgramFlyer, saveProgramPublication } from "@/db/public-programs";

function idOf(value: string) { const id = Number(value); return Number.isInteger(id) && id > 0 ? id : null; }

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireRegisteredUser();
    const id = idOf((await params).id);
    if (!id) return Response.json({ error: "ID program tidak valid." }, { status: 400 });
    const program = await getProgram(id);
    if (!program) return Response.json({ error: "Program kerja tidak ditemukan." }, { status: 404 });
    assertCanManageDivision(user, program.divisionId);
    const [publication, events] = await Promise.all([getProgramPublication(id), listProgramRegistrationEvents(id)]);
    return Response.json({ publication, events });
  } catch (reason) { return accessErrorResponse(reason, "Pengaturan publikasi belum dapat dimuat."); }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireRegisteredUser();
    const id = idOf((await params).id);
    if (!id) return Response.json({ error: "ID program tidak valid." }, { status: 400 });
    const program = await getProgram(id);
    if (!program) return Response.json({ error: "Program kerja tidak ditemukan." }, { status: 404 });
    assertCanManageDivision(user, program.divisionId);
    const form = await request.formData();
    const flyer = form.get("flyer");
    if (flyer instanceof File && flyer.size > 0) {
      if (!["image/jpeg", "image/png", "image/webp"].includes(flyer.type)) return Response.json({ error: "Flyer harus berupa JPG, PNG, atau WebP." }, { status: 400 });
      if (flyer.size > 5 * 1024 * 1024) return Response.json({ error: "Ukuran flyer maksimal 5 MB." }, { status: 400 });
    }
    const publication = await saveProgramPublication(id, {
      isPublished: form.get("isPublished") === "true",
      publicTitle: String(form.get("publicTitle") || "").trim() || program.title,
      tagline: String(form.get("tagline") || "").trim(),
      description: String(form.get("description") || "").trim(),
      benefits: String(form.get("benefits") || "").trim(),
      audience: String(form.get("audience") || "").trim(),
      contactName: String(form.get("contactName") || "").trim(),
      contactPhone: String(form.get("contactPhone") || "").replace(/[^0-9+]/g, ""),
      registrationEventId: Number(form.get("registrationEventId")) || null,
      isFeatured: form.get("isFeatured") === "true",
    }, user.id);
    if (flyer instanceof File && flyer.size > 0) await saveProgramFlyer(id, flyer);
    return Response.json({ publication: await getProgramPublication(id) ?? publication });
  } catch (reason) {
    if (reason instanceof Error && reason.message === "EVENT_NOT_FOUND") return Response.json({ error: "Event pendaftaran tidak terhubung ke program ini." }, { status: 400 });
    return accessErrorResponse(reason, "Pengaturan publikasi belum dapat disimpan.");
  }
}
