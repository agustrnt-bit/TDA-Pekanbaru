import type { Metadata } from "next";
import EventFeedbackEntry from "@/components/event-feedback-entry";
import { getPublicEventFeedback } from "@/db/program-feedback";

export async function generateMetadata({ params }: { params: Promise<{ eventId: string }> }): Promise<Metadata> {
  try {
    const event = await getPublicEventFeedback(Number((await params).eventId));
    const title = event ? `Feedback ${event.eventName} — TDA Pekanbaru` : "Feedback Event — TDA Pekanbaru";
    const description = event ? `Sampaikan penilaian dan masukan Anda untuk ${event.eventName}, bagian dari Program Kerja ${event.programTitle}.` : "Sampaikan penilaian dan masukan Anda untuk kegiatan TDA Pekanbaru.";
    return { title, description, openGraph: { title, description, type: "website", locale: "id_ID", images: [] }, twitter: { card: "summary", title, description, images: [] } };
  } catch {
    return { title: "Feedback Event — TDA Pekanbaru", description: "Sampaikan penilaian dan masukan Anda untuk kegiatan TDA Pekanbaru." };
  }
}

export default async function EventFeedbackPage({ params }: { params: Promise<{ eventId: string }> }) {
  return <EventFeedbackEntry eventId={(await params).eventId} />;
}
