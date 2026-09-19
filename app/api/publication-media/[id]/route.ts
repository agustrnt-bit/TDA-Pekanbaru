import { accessErrorResponse, requireKetua } from "@/db/access-control";
import { deletePublicMedia, updatePublicMedia } from "@/db/public-media";

function idOf(value: string) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireKetua();
    const id = idOf((await params).id);
    if (!id)
      return Response.json({ error: "ID tidak valid." }, { status: 400 });
    const body = (await request.json()) as Record<string, unknown>;
    await updatePublicMedia(id, {
      mediaType: body.mediaType === "gallery" ? "gallery" : "banner",
      title: String(body.title || "").trim(),
      description: String(body.description || "").trim(),
      eventDate: String(body.eventDate || ""),
      linkUrl: String(body.linkUrl || "").trim(),
      sortOrder: Number(body.sortOrder) || 0,
      isActive: Boolean(body.isActive),
    });
    return Response.json({ ok: true });
  } catch (reason) {
    return accessErrorResponse(reason, "Media publik belum dapat diperbarui.");
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireKetua();
    const id = idOf((await params).id);
    if (!id)
      return Response.json({ error: "ID tidak valid." }, { status: 400 });
    await deletePublicMedia(id);
    return Response.json({ ok: true });
  } catch (reason) {
    return accessErrorResponse(reason, "Media publik belum dapat dihapus.");
  }
}
