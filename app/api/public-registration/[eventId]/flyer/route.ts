import { getAttendanceFile, getPublicEvent } from "@/db/attendance";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ eventId: string }> },
) {
  const event = await getPublicEvent(Number((await params).eventId)).catch(
    () => null,
  );
  if (!event?.flyerKey)
    return new Response("Flyer tidak ditemukan.", { status: 404 });
  const object = await getAttendanceFile(event.flyerKey);
  if (!object) return new Response("Flyer tidak ditemukan.", { status: 404 });
  return new Response(object.body, {
    headers: {
      "Content-Type": event.flyerType || "image/jpeg",
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
    },
  });
}
