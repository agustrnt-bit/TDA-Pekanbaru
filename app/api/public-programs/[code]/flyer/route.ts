import { getProgramFlyer } from "@/db/public-programs";

export async function GET(_request: Request, { params }: { params: Promise<{ code: string }> }) {
  try {
    const flyer = await getProgramFlyer((await params).code);
    if (!flyer) return Response.json({ error: "Flyer belum tersedia." }, { status: 404 });
    const headers = new Headers(); flyer.object.writeHttpMetadata(headers);
    headers.set("content-type", flyer.type || "image/jpeg");
    headers.set("cache-control", "public, max-age=3600, stale-while-revalidate=86400");
    return new Response(flyer.object.body, { headers });
  } catch { return Response.json({ error: "Flyer belum dapat dibuka." }, { status: 500 }); }
}
