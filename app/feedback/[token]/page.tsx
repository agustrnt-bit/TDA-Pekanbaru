import type { Metadata } from "next";
import FeedbackForm from "@/components/feedback-form";
import { getPublicFeedback } from "@/db/program-feedback";

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  try {
    const data = await getPublicFeedback((await params).token);
    const title = data ? `Feedback ${data.participant.programTitle} — TDA Pekanbaru` : "Feedback Program Kerja — TDA Pekanbaru";
    const description = data ? `Form feedback ${data.participant.eventName} untuk Program Kerja ${data.participant.programTitle}.` : "Form feedback Program Kerja TDA Pekanbaru.";
    return { title, description, openGraph: { title, description, type: "website", locale: "id_ID", images: [] }, twitter: { card: "summary", title, description, images: [] } };
  } catch {
    return { title: "Feedback Program Kerja — TDA Pekanbaru", description: "Form feedback Program Kerja TDA Pekanbaru." };
  }
}

export default async function FeedbackPage({ params }: { params: Promise<{ token: string }> }) {
  return <FeedbackForm token={(await params).token} />;
}
