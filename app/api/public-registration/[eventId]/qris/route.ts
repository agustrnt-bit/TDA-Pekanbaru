import { getAttendanceFile, getPublicEvent } from "@/db/attendance";

export async function GET(_request: Request, { params }: { params: Promise<{ eventId: string }> }) {
  try {
    const event = await getPublicEvent(Number((await params).eventId));
    if (!event?.qrisKey) return Response.json({ error: "QRIS belum tersedia." }, { status: 404 });
    const object = await getAttendanceFile(event.qrisKey);
    if (!object) return Response.json({ error: "QRIS tidak ditemukan." }, { status: 404 });
    const headers = new Headers(); object.writeHttpMetadata(headers);
    headers.set("content-type", event.qrisType || "image/png");
    headers.set("content-disposition", `inline; filename*=UTF-8''${encodeURIComponent(event.qrisName || "qris-event")}`);
    headers.set("cache-control", "public, max-age=300");
    return new Response(object.body, { headers });
  } catch { return Response.json({ error: "QRIS belum dapat dibuka." }, { status: 500 }); }
}
