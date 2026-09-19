import { getPublicEventFeedback, identifyFeedbackParticipant } from "@/db/program-feedback";

function eventIdOf(value: string) { const id = Number(value); return Number.isInteger(id) && id > 0 ? id : null; }

export async function GET(_request: Request, context: { params: Promise<{ eventId: string }> }) {
  try {
    const eventId = eventIdOf((await context.params).eventId);
    if (!eventId) return Response.json({ error: "Event tidak valid." }, { status: 400 });
    const event = await getPublicEventFeedback(eventId);
    if (!event) return Response.json({ error: "Event tidak ditemukan." }, { status: 404 });
    return Response.json(event);
  } catch { return Response.json({ error: "Form feedback belum dapat dimuat." }, { status: 500 }); }
}

export async function POST(request: Request, context: { params: Promise<{ eventId: string }> }) {
  try {
    const eventId = eventIdOf((await context.params).eventId);
    if (!eventId) return Response.json({ error: "Event tidak valid." }, { status: 400 });
    const body = await request.json();
    return Response.json(await identifyFeedbackParticipant(eventId, String(body.identity ?? "")));
  } catch (reason) { return Response.json({ error: reason instanceof Error ? reason.message : "Peserta belum dapat diverifikasi." }, { status: 400 }); }
}
