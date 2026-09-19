import type { Metadata } from "next";
import MembershipRegistration from "@/components/membership-registration";

export const metadata: Metadata = {
  title: "Pendaftaran Member dan Kelas Reguler TDA Pekanbaru",
  description: "Registrasi Member Baru dan Member Existing untuk mengikuti Kelas Reguler TDA Pekanbaru.",
  openGraph: {
    title: "Pendaftaran Member dan Kelas Reguler TDA Pekanbaru",
    description: "Registrasi Member Baru dan Member Existing untuk mengikuti Kelas Reguler TDA Pekanbaru.",
    type: "website",
    locale: "id_ID",
    images: [],
  },
  twitter: {
    card: "summary",
    title: "Pendaftaran Member dan Kelas Reguler TDA Pekanbaru",
    description: "Registrasi Member Baru dan Member Existing untuk mengikuti Kelas Reguler TDA Pekanbaru.",
    images: [],
  },
};

export default function MemberPage() {
  return <MembershipRegistration />;
}
