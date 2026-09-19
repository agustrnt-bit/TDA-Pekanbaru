import {
  getPublicEvent,
  getPublicParticipant,
  priceFor,
  registerPublicParticipant,
} from "@/db/attendance";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> },
) {
  try {
    const { eventId } = await params;
    const event = await getPublicEvent(Number(eventId));
    if (!event)
      return Response.json(
        { error: "Event tidak ditemukan." },
        { status: 404 },
      );
    const token = new URL(request.url).searchParams.get("ticket")?.trim();
    const participant = token
      ? await getPublicParticipant(Number(eventId), token)
      : null;
    return Response.json({
      event: {
        ...event,
        qrisAvailable: Boolean(event.qrisKey),
        flyerAvailable: Boolean(event.flyerKey),
        prices: {
          public: priceFor(event, "Umum"),
          member: priceFor(event, "Member TDA"),
          committee: priceFor(event, "Pengurus TDA"),
        },
        qrisKey: undefined,
        qrisName: undefined,
        qrisType: undefined,
        flyerKey: undefined,
        flyerName: undefined,
        flyerType: undefined,
      },
      participant,
    });
  } catch {
    return Response.json(
      { error: "Informasi event belum dapat dimuat." },
      { status: 500 },
    );
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> },
) {
  try {
    const { eventId } = await params;
    const body = (await request.json()) as Record<string, unknown>;
    const name = String(body.name ?? "").trim();
    const phone = String(body.phone ?? "").replace(/[^0-9+]/g, "");
    const category = String(body.category ?? "Member");
    if (!name || phone.length < 9)
      return Response.json(
        { error: "Nama dan nomor WhatsApp yang valid wajib diisi." },
        { status: 400 },
      );
    const result = await registerPublicParticipant({
      eventId: Number(eventId),
      name,
      phone,
      category,
      organization: String(body.organization ?? "").trim(),
      passportNumber: String(body.passportNumber ?? "").trim(),
    });
    return Response.json(result, {
      status: result.alreadyRegistered ? 200 : 201,
    });
  } catch (reason) {
    const message = reason instanceof Error ? reason.message : "";
    if (message === "EVENT_NOT_FOUND")
      return Response.json(
        { error: "Event tidak ditemukan." },
        { status: 404 },
      );
    if (message === "REGISTRATION_CLOSED")
      return Response.json(
        { error: "Pendaftaran untuk event ini sudah ditutup." },
        { status: 403 },
      );
    if (message === "CATEGORY_NOT_ALLOWED")
      return Response.json(
        { error: "Kategori peserta tersebut tidak tersedia untuk event ini." },
        { status: 400 },
      );
    return Response.json(
      { error: "Pendaftaran belum dapat disimpan." },
      { status: 500 },
    );
  }
}
