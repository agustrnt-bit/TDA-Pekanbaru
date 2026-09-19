import type { Metadata } from "next";
import ProgramApp from "@/components/program-management/program-app";

export const metadata: Metadata = {
  title: "Backoffice Pengurus — TDA Pekanbaru 9.0",
  description: "Sistem internal pengelolaan Program Kerja TDA Pekanbaru 9.0.",
  robots: { index: false, follow: false },
};

export default function AdminPage() {
  return <ProgramApp signInPath="/signin-with-chatgpt?return_to=%2Fadmin" signOutPath="/signout-with-chatgpt?return_to=%2Fadmin" />;
}
