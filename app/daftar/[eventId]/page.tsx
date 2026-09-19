import type { Metadata } from "next";
import PublicRegistration from "@/components/public-registration";
import { getPublicEvent } from "@/db/attendance";

function eventDescription(event: Awaited<ReturnType<typeof getPublicEvent>>) {
  if (!event) return "Form registrasi event TDA Pekanbaru.";
  const date = event.eventDate
    ? new Intl.DateTimeFormat("id-ID", {
        dateStyle: "long",
        timeZone: "Asia/Jakarta",
      }).format(new Date(`${event.eventDate}T00:00:00+07:00`))
    : "Tanggal menyusul";
  return `${date} · ${event.location || "Lokasi menyusul"} · ${event.isPaid ? "Event berbayar" : "Gratis"}. Daftar sebagai peserta event TDA Pekanbaru.`;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ eventId: string }>;
}): Promise<Metadata> {
  try {
    const event = await getPublicEvent(Number((await params).eventId));
    const title = event
      ? `Registrasi ${event.publicTitle || event.name} — TDA Pekanbaru`
      : "Registrasi Event — TDA Pekanbaru";
    const description = eventDescription(event);
    const image = event?.flyerKey
      ? `https://tdapku.my.id/api/public-registration/${event.id}/flyer`
      : undefined;
    return {
      title,
      description,
      openGraph: {
        title,
        description,
        type: "website",
        locale: "id_ID",
        images: image
          ? [{ url: image, alt: `Flyer ${event?.publicTitle || event?.name}` }]
          : [],
      },
      twitter: {
        card: image ? "summary_large_image" : "summary",
        title,
        description,
        images: image ? [image] : [],
      },
    };
  } catch {
    return {
      title: "Registrasi Event — TDA Pekanbaru",
      description: "Form registrasi event TDA Pekanbaru.",
    };
  }
}

export default async function RegistrationPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  return <PublicRegistration eventId={Number(eventId)} />;
}
