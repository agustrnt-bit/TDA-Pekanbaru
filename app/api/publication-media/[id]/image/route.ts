import { accessErrorResponse, requireKetua } from "@/db/access-control";
import { getPublicMediaImage } from "@/db/public-media";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireKetua();
    const id = Number((await params).id);
    if (!Number.isInteger(id) || id < 1)
      return new Response("Not found", { status: 404 });
    const result = await getPublicMediaImage(id, false);
    if (!result) return new Response("Not found", { status: 404 });
    return new Response(result.object.body, {
      headers: {
        "Content-Type": result.imageType || "image/jpeg",
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch (reason) {
    return accessErrorResponse(reason, "Gambar belum dapat dimuat.");
  }
}
