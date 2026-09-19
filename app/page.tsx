import type { Metadata } from "next";
import {
  ArrowRight,
  AtSign,
  BookOpenCheck,
  CalendarDays,
  Mail,
  MapPin,
  MessageCircle,
  Sparkles,
  UserPlus,
  UsersRound,
} from "lucide-react";
import { listPublicPrograms } from "@/db/public-programs";
import { listPublicMedia } from "@/db/public-media";
import {
  PublicGallery,
  PublicMediaShowcase,
} from "@/components/public-media-showcase";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "TDA Pekanbaru 9.0 — Tumbuh dan Berkolaborasi",
  description:
    "Portal program, kegiatan, dan pendaftaran member TDA Pekanbaru 9.0.",
  openGraph: {
    title: "TDA Pekanbaru 9.0",
    description:
      "Temukan program, kegiatan, dan ruang kolaborasi pengusaha di TDA Pekanbaru.",
    type: "website",
    locale: "id_ID",
    images: [],
  },
};

const Instagram = AtSign;

function dateLabel(value: string | null) {
  if (!value) return "Jadwal segera diumumkan";
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "long",
    timeZone: "Asia/Jakarta",
  }).format(new Date(`${value}T00:00:00+07:00`));
}

export default async function Home() {
  const [programsResult, banners, gallery] = await Promise.all([
    listPublicPrograms().catch(() => []),
    listPublicMedia("banner", true).catch(() => []),
    listPublicMedia("gallery", true).catch(() => []),
  ]);
  const programs = programsResult.slice(0, 3);
  return (
    <main className="min-h-screen bg-[#f3f7f3] text-slate-950">
      <header className="border-b border-white/10 bg-[#0d2f20] text-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4">
          <a href="/" className="flex items-center gap-3">
            <img
              src="/tda-pekanbaru.png"
              alt="TDA Pekanbaru"
              className="h-12 w-28 rounded-lg bg-white object-contain"
            />
            <div className="hidden sm:block">
              <p className="text-xs font-bold tracking-[.16em] text-emerald-300">
                KEANGGOTAAN TDA
              </p>
              <p className="font-bold">TDA Pekanbaru 9.0</p>
            </div>
          </a>
          <nav className="flex items-center gap-1">
            <a
              href="/tentang"
              className="hidden rounded-xl px-3 py-2.5 text-sm font-bold text-emerald-100 hover:bg-white/10 md:inline-flex"
            >
              Profil
            </a>
            <a
              href="/program"
              className="hidden rounded-xl px-3 py-2.5 text-sm font-bold text-emerald-100 hover:bg-white/10 sm:inline-flex"
            >
              Program
            </a>
            <a
              href="/kalender"
              className="hidden rounded-xl px-3 py-2.5 text-sm font-bold text-emerald-100 hover:bg-white/10 md:inline-flex"
            >
              Kalender
            </a>
            <a
              href="/member"
              className="rounded-xl bg-emerald-400 px-4 py-2.5 text-sm font-bold text-emerald-950"
            >
              Daftar Member
            </a>
          </nav>
        </div>
      </header>
      <PublicMediaShowcase items={banners} />
      <section className="overflow-hidden bg-[#0d2f20] text-white">
        <div className="relative mx-auto max-w-7xl px-5 pb-16 pt-14 sm:pb-24 sm:pt-20">
          <div className="absolute -right-24 top-8 size-80 rounded-full bg-emerald-400/10 blur-3xl" />
          <div className="relative max-w-4xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-white/5 px-4 py-2 text-sm font-bold text-emerald-300">
              <Sparkles className="size-4" />
              Let&apos;s 9.0 Together
            </div>
            <h1 className="mt-6 text-4xl font-black leading-[1.08] sm:text-6xl">
              Ruang bertumbuh dan berkolaborasi bagi pengusaha Pekanbaru.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-emerald-100">
              Temukan program, kelas, dan kegiatan yang membantu Anda memperluas
              wawasan, jaringan, serta peluang bisnis bersama TDA Pekanbaru.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <a
                href="/program"
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-emerald-400 px-6 font-bold text-emerald-950"
              >
                Lihat Program & Kegiatan
                <ArrowRight className="size-5" />
              </a>
              <a
                href="/member"
                className="inline-flex min-h-12 items-center justify-center rounded-xl border border-white/30 px-6 font-bold"
              >
                Daftar Member & Kelas Reguler
              </a>
            </div>
          </div>
        </div>
      </section>
      <section className="mx-auto max-w-7xl px-5 py-10 sm:py-16">
        <div className="grid gap-4 md:grid-cols-3">
          <PublicAction
            href="/tentang"
            icon={UsersRound}
            title="Profil TDA Pekanbaru"
            text="Kenali komunitas, semangat, divisi, dan ruang kolaborasi TDA Pekanbaru."
          />
          <PublicAction
            href="/kalender"
            icon={CalendarDays}
            title="Kalender Kegiatan"
            text="Lihat agenda kegiatan publik berdasarkan bulan, divisi, dan jenis acara."
          />
          <PublicAction
            href="/member"
            icon={UserPlus}
            title="Pendaftaran Member"
            text="Registrasi Member Baru, Member Existing, dan Kelas Reguler."
          />
        </div>
      </section>
      {programs.length > 0 && (
        <section className="mx-auto max-w-7xl px-5 pb-16">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-sm font-bold uppercase tracking-[.16em] text-emerald-700">
                Pilihan untuk Anda
              </p>
              <h2 className="mt-2 text-3xl font-black">Program terbaru</h2>
            </div>
            <a
              href="/program"
              className="hidden items-center gap-1 text-sm font-bold text-emerald-800 sm:flex"
            >
              Lihat semuanya
              <ArrowRight className="size-4" />
            </a>
          </div>
          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {programs.map((program) => (
              <a
                key={program.programCode}
                href={`/program/${program.programCode.toLowerCase()}`}
                className="group overflow-hidden rounded-3xl border bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-xl"
              >
                <div className="aspect-[16/10] overflow-hidden bg-gradient-to-br from-[#145c3c] to-[#17a66b]">
                  {program.flyerKey ? (
                    <img
                      src={`/api/public-programs/${program.programCode}/flyer`}
                      alt={`Flyer ${program.publicTitle || program.programTitle}`}
                      className="size-full object-cover object-top"
                    />
                  ) : (
                    <div className="flex size-full flex-col justify-between p-6 text-white">
                      <BookOpenCheck className="size-8 text-emerald-200" />
                      <h3 className="text-2xl font-black leading-tight">
                        {program.publicTitle || program.programTitle}
                      </h3>
                    </div>
                  )}
                </div>
                <div className="p-5">
                  <p className="text-xs font-bold uppercase tracking-wider text-emerald-700">
                    {program.divisionName}
                  </p>
                  <h3 className="mt-2 text-xl font-bold">
                    {program.publicTitle || program.programTitle}
                  </h3>
                  <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-600">
                    {program.tagline ||
                      "Lihat informasi lengkap program TDA Pekanbaru."}
                  </p>
                  <p className="mt-4 flex items-center gap-2 border-t pt-4 text-sm font-semibold text-slate-600">
                    <CalendarDays className="size-4 text-emerald-700" />
                    {dateLabel(program.eventDate || program.startDate)}
                  </p>
                </div>
              </a>
            ))}
          </div>
          <a
            href="/program"
            className="mt-5 flex min-h-12 items-center justify-center gap-2 rounded-xl border bg-white font-bold text-emerald-800 sm:hidden"
          >
            Lihat Semua Program
            <ArrowRight className="size-4" />
          </a>
        </section>
      )}
      <PublicGallery items={gallery} />
      <section className="bg-emerald-800 text-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-5 py-12 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-3xl font-black">Siap tumbuh bersama TDA?</h2>
            <p className="mt-2 text-emerald-100">
              Mulai perjalanan Anda melalui program dan Kelas Reguler TDA
              Pekanbaru.
            </p>
          </div>
          <a
            href="/member"
            className="inline-flex min-h-12 items-center justify-center rounded-xl bg-white px-6 font-bold text-emerald-900"
          >
            Daftar Sekarang
          </a>
        </div>
      </section>
      <footer className="bg-white">
        <div className="mx-auto grid max-w-7xl gap-8 px-5 py-10 text-sm text-slate-600 md:grid-cols-[1fr_1.4fr]">
          <div>
            <p className="font-bold text-slate-900">TDA Pekanbaru 9.0</p>
            <p className="mt-1">#RiangGembira · Let&apos;s 9.0 Together</p>
            <div className="mt-5 flex flex-wrap gap-2">
              <a
                href="mailto:pekanbaru@tangandiatas.com"
                className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 font-semibold hover:border-emerald-300 hover:text-emerald-800"
              >
                <Mail className="size-4" />
                Email
              </a>
              <a
                href="https://wa.me/6285121804468"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 font-semibold hover:border-emerald-300 hover:text-emerald-800"
              >
                <MessageCircle className="size-4" />
                WhatsApp
              </a>
              <a
                href="https://www.instagram.com/tdapekanbaru"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 font-semibold hover:border-emerald-300 hover:text-emerald-800"
              >
                <Instagram className="size-4" />
                @tdapekanbaru
              </a>
            </div>
          </div>
          <div>
            <div className="flex gap-3">
              <span className="mt-0.5 grid size-10 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-700">
                <MapPin className="size-5" />
              </span>
              <div>
                <p className="font-bold text-slate-900">
                  Sekretariat TDA Pekanbaru
                </p>
                <address className="mt-1 not-italic leading-6">
                  Gedung Menara Poltekkes Kemenkes Riau, Lantai 8<br />
                  Jl. Melur No. 26, Padang Bulan, Senapelan
                  <br />
                  Kota Pekanbaru, Riau 28156
                </address>
                <a
                  href="https://www.google.com/maps/search/?api=1&query=Gedung+Menara+Poltekkes+Kemenkes+Riau+Jl.+Melur+No.+26+Pekanbaru"
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-flex items-center gap-1 font-bold text-emerald-700 hover:text-emerald-900"
                >
                  Buka di Google Maps
                  <ArrowRight className="size-4" />
                </a>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}

function PublicAction({
  href,
  icon: Icon,
  title,
  text,
}: {
  href: string;
  icon: typeof CalendarDays;
  title: string;
  text: string;
}) {
  return (
    <a
      href={href}
      className="group rounded-3xl border bg-white p-6 shadow-sm transition hover:border-emerald-300 hover:shadow-lg"
    >
      <span className="grid size-12 place-items-center rounded-2xl bg-emerald-50 text-emerald-700">
        <Icon className="size-6" />
      </span>
      <h2 className="mt-5 text-xl font-bold">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-slate-600">{text}</p>
      <span className="mt-5 flex items-center gap-1 text-sm font-bold text-emerald-700">
        Buka{" "}
        <ArrowRight className="size-4 transition group-hover:translate-x-1" />
      </span>
    </a>
  );
}
