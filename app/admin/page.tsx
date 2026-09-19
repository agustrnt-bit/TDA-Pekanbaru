import type { Metadata } from "next";
import ProgramApp from "@/components/program-management/program-app";
import { chatGPTSignInPath, chatGPTSignOutPath } from "@/app/chatgpt-auth";

export const metadata: Metadata = {
  title: "Backoffice Pengurus — TDA Pekanbaru 9.0",
  description: "Sistem internal pengelolaan Program Kerja TDA Pekanbaru 9.0.",
  robots: { index: false, follow: false },
};

export default function AdminPage() {
  return (
    <ProgramApp
      signInPath={chatGPTSignInPath("/admin")}
      signOutPath={chatGPTSignOutPath("/admin")}
    />
  );
}
