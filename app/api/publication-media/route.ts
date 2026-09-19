import { accessErrorResponse, requireKetua } from "@/db/access-control";
import { createPublicMedia, listPublicMedia } from "@/db/public-media";

function typeOf(value: FormDataEntryValue | null) {
  return value === "gallery" ? ("gallery" as const) : ("banner" as const);
}

export async function GET() {
  try {
    await requireKetua();
    return Response.json({ items: await listPublicMedia() });
  } catch (reason) {
    return accessErrorResponse(reason, "Media publik belum dapat dimuat.");
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireKetua();
    const form = await request.formData();
    const file = form.get("image");
    if (!(file instanceof File) || file.size === 0)
      return Response.json(
        { error: "Pilih gambar terlebih dahulu." },
        { status: 400 },
      );
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type))
      return Response.json(
        { error: "Gambar harus JPG, PNG, atau WebP." },
        { status: 400 },
      );
    if (file.size > 5 * 1024 * 1024)
      return Response.json(
        { error: "Ukuran gambar maksimal 5 MB." },
        { status: 400 },
      );
    const mediaType = typeOf(form.get("mediaType"));
    const activeCount = (await listPublicMedia(mediaType, true)).length;
    const isActive = form.get("isActive") !== "false";
    if (mediaType === "banner" && isActive && activeCount >= 8)
      return Response.json(
        {
          error:
            "Maksimal 8 banner aktif. Nonaktifkan salah satu banner terlebih dahulu.",
        },
        { status: 400 },
      );
    const id = await createPublicMedia(
      {
        mediaType,
        title: String(form.get("title") || "").trim(),
        description: String(form.get("description") || "").trim(),
        eventDate: String(form.get("eventDate") || ""),
        linkUrl: String(form.get("linkUrl") || "").trim(),
        sortOrder: Number(form.get("sortOrder")) || 0,
        isActive,
      },
      file,
      user.id,
    );
    return Response.json({ id }, { status: 201 });
  } catch (reason) {
    return accessErrorResponse(reason, "Media publik belum dapat disimpan.");
  }
}
