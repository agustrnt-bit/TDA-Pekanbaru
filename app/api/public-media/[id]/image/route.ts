import { getPublicMediaImage } from "@/db/public-media";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id < 1)
    return new Response("Not found", { status: 404 });
  const result = await getPublicMediaImage(id, true).catch(() => null);
  if (!result) return new Response("Not found", { status: 404 });
  return new Response(result.object.body, {
    headers: {
      "Content-Type": result.imageType || "image/jpeg",
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
    },
  });
}
