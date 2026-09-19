import type { Metadata } from "next";
import PublicCalendar from "@/components/public-calendar";
import { listPublicPrograms } from "@/db/public-programs";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Kalender Kegiatan TDA Pekanbaru", description: "Lihat jadwal program dan kegiatan publik TDA Pekanbaru.", openGraph: { title: "Kalender Kegiatan TDA Pekanbaru", description: "Temukan jadwal kegiatan terbaru TDA Pekanbaru.", type: "website", locale: "id_ID", images: [] } };

export default async function CalendarPage() {
  const programs = await listPublicPrograms().catch(() => []);
  return <main className="min-h-screen bg-[#f3f7f3] text-slate-950"><header className="bg-[#0d2f20] text-white"><div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4"><a href="/" className="flex items-center gap-3"><img src="/tda-pekanbaru.png" alt="TDA Pekanbaru" className="h-12 w-28 rounded-lg bg-white object-contain"/><div className="hidden sm:block"><p className="text-xs font-bold tracking-[.16em] text-emerald-300">TDA PEKANBARU 9.0</p><p className="font-bold">Kalender Kegiatan</p></div></a><nav className="flex items-center gap-2 text-sm font-bold"><a href="/tentang" className="rounded-xl px-3 py-2 hover:bg-white/10">Profil</a><a href="/program" className="rounded-xl px-3 py-2 hover:bg-white/10">Program</a><a href="/member" className="rounded-xl bg-emerald-400 px-4 py-2.5 text-emerald-950">Daftar Member</a></nav></div><div className="mx-auto max-w-7xl px-5 pb-10 pt-9 sm:pb-14"><p className="text-sm font-bold uppercase tracking-[.18em] text-emerald-300">Agenda Publik</p><h1 className="mt-3 text-4xl font-black sm:text-5xl">Kalender kegiatan TDA Pekanbaru</h1><p className="mt-4 max-w-2xl text-lg leading-8 text-emerald-100">Pilih bulan, divisi, dan jenis kegiatan untuk menemukan agenda yang sesuai.</p></div></header><div className="mx-auto max-w-6xl px-5 py-8"><PublicCalendar programs={programs}/></div><footer className="mt-10 border-t bg-white px-5 py-8 text-center text-sm text-slate-500">TDA Pekanbaru 9.0 · #RiangGembira</footer></main>;
}
