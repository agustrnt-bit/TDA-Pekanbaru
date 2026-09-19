import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Manajemen Program Kerja TDA Pekanbaru 9.0",
  description: "Dashboard program kerja dan kontrol kegiatan TDA Pekanbaru 9.0.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id">
      <body className="antialiased">{children}</body>
    </html>
  );
}
