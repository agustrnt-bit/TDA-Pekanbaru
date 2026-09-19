import type { Metadata } from "next";
import AttendanceApp from "@/components/attendance-app";

export const metadata: Metadata = {
  title: "Check-in Kehadiran Event — TDA Pekanbaru",
  description: "Halaman check-in peserta event TDA Pekanbaru melalui kamera, scanner QR, atau pencarian manual.",
  openGraph: { title: "Check-in Kehadiran Event — TDA Pekanbaru", description: "Halaman check-in peserta event TDA Pekanbaru.", type: "website", locale: "id_ID", images: [] },
  twitter: { card: "summary", title: "Check-in Kehadiran Event — TDA Pekanbaru", description: "Halaman check-in peserta event TDA Pekanbaru.", images: [] },
};

export default function FastCheckInPage() {
  return <main className="min-h-screen bg-background px-4 py-5 sm:px-6 lg:px-8">
    <div className="mx-auto max-w-[1280px]">
      <AttendanceApp fastMode />
    </div>
  </main>;
}
