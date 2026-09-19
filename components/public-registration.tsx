"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import {
  BadgeCheck,
  Banknote,
  CalendarDays,
  Clock3,
  Download,
  MapPin,
  RefreshCw,
  TicketCheck,
  Upload,
} from "lucide-react";

type Price = { amount: number; label: string };
type EventInfo = {
  id: number;
  name: string;
  publicTitle: string;
  collaborationPartner: string;
  isCollaboration: number;
  flyerAvailable: boolean;
  eventDate: string;
  startTime: string;
  endTime: string;
  location: string;
  registrationOpen: number;
  isPaid: number;
  earlyBirdEndsAt: string;
  bankName: string;
  bankAccountNumber: string;
  bankAccountName: string;
  paymentInstructions: string;
  qrisAvailable: boolean;
  allowPublicCategory: number;
  allowMemberCategory: number;
  allowCommitteeCategory: number;
  prices: { public: Price; member: Price; committee: Price };
};
type RegistrationResult = {
  id: number;
  name: string;
  qrToken: string;
  amountDue: number;
  priceLabel: string;
  paymentStatus: string;
  paymentMethod: string;
  paymentNote: string;
  alreadyRegistered: boolean;
};

const rupiah = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});
const paymentLabels: Record<string, string> = {
  pending: "Belum Bayar",
  verification: "Menunggu Verifikasi",
  paid: "Lunas",
  onsite_pending: "Dibayar di Lokasi · Menunggu Bendahara",
  rejected: "Perlu Upload Ulang",
  not_required: "Gratis",
};

export default function PublicRegistration({ eventId }: { eventId: number }) {
  const [event, setEvent] = useState<EventInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<RegistrationResult | null>(null);
  const [qrImage, setQrImage] = useState("");
  const [proof, setProof] = useState<File | null>(null);
  const [paymentMethod, setPaymentMethod] = useState("QRIS");
  const [form, setForm] = useState({
    name: "",
    phone: "",
    category: "Member TDA",
    organization: "",
    passportNumber: "",
  });

  const load = useCallback(
    async (ticket?: string) => {
      const token =
        ticket ??
        new URLSearchParams(window.location.search).get("ticket") ??
        "";
      try {
        const response = await fetch(
          `/api/public-registration/${eventId}${token ? `?ticket=${encodeURIComponent(token)}` : ""}`,
          { cache: "no-store" },
        );
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        setEvent(data.event);
        const firstCategory = data.event.allowMemberCategory
          ? "Member TDA"
          : data.event.allowPublicCategory
            ? "Umum"
            : "Pengurus TDA";
        setForm((current) => ({ ...current, category: firstCategory }));
        if (data.participant) setResult(data.participant);
      } catch (reason) {
        setError(
          reason instanceof Error
            ? reason.message
            : "Event belum dapat dimuat.",
        );
      } finally {
        setLoading(false);
      }
    },
    [eventId],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);
  useEffect(() => {
    Promise.resolve(
      result?.qrToken
        ? QRCode.toDataURL(result.qrToken, {
            width: 320,
            margin: 2,
            errorCorrectionLevel: "M",
          })
        : "",
    ).then(setQrImage);
  }, [result?.qrToken]);
  useEffect(() => {
    if (
      !result?.qrToken ||
      (result.paymentStatus !== "verification" &&
        result.paymentStatus !== "onsite_pending")
    )
      return;
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") void load(result.qrToken);
    }, 10_000);
    return () => window.clearInterval(interval);
  }, [load, result?.paymentStatus, result?.qrToken]);

  const selectedPrice = useMemo(() => {
    if (!event) return { amount: 0, label: "Gratis" };
    if (form.category === "Pengurus TDA") return event.prices.committee;
    if (form.category === "Member TDA") return event.prices.member;
    return event.prices.public;
  }, [event, form.category]);

  async function submit(eventSubmit: React.FormEvent) {
    eventSubmit.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch(`/api/public-registration/${eventId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setResult(data);
      window.history.replaceState(
        null,
        "",
        `${window.location.pathname}?ticket=${encodeURIComponent(data.qrToken)}`,
      );
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Pendaftaran belum dapat disimpan.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function confirmPayment(eventSubmit: React.FormEvent) {
    eventSubmit.preventDefault();
    if (!result || !proof) return;
    setSubmitting(true);
    setError("");
    try {
      const payload = new FormData();
      payload.set("token", result.qrToken);
      payload.set("method", paymentMethod);
      payload.set("proof", proof);
      const response = await fetch(
        `/api/public-registration/${eventId}/payment`,
        { method: "POST", body: payload },
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setResult(data.participant);
      setProof(null);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Konfirmasi pembayaran belum dapat disimpan.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (loading)
    return (
      <main className="grid min-h-screen place-items-center bg-[#f3f7f4] px-4 text-sm text-slate-600">
        Memuat formulir pendaftaran…
      </main>
    );
  if (!event)
    return (
      <main className="grid min-h-screen place-items-center bg-[#f3f7f4] px-4">
        <div className="max-w-md rounded-3xl bg-white p-8 text-center shadow-sm">
          <h1 className="text-xl font-bold">Formulir tidak tersedia</h1>
          <p className="mt-2 text-sm text-slate-600">
            {error || "Event tidak ditemukan."}
          </p>
        </div>
      </main>
    );

  const ticketReady =
    result &&
    (result.paymentStatus === "paid" ||
      result.paymentStatus === "not_required" ||
      result.paymentStatus === "onsite_pending");
  return (
    <main className="min-h-screen bg-[#eef5f0] px-4 py-6 sm:py-10">
      <div className="mx-auto max-w-xl overflow-hidden rounded-3xl border border-emerald-950/10 bg-white shadow-xl shadow-emerald-950/10">
        {event.flyerAvailable && (
          <img
            src={`/api/public-registration/${eventId}/flyer`}
            alt={`Flyer ${event.publicTitle || event.name}`}
            className="aspect-[4/5] w-full object-cover object-top"
          />
        )}
        <header className="bg-[#102d20] px-6 py-7 text-white sm:px-8">
          <div className="flex items-center gap-3">
            <div className="h-12 w-24 overflow-hidden rounded-xl bg-white">
              <Image
                unoptimized
                src="/tda-pekanbaru.png"
                alt="TDA Pekanbaru"
                width={96}
                height={72}
                className="h-[72px] w-24 -translate-y-[12px] object-contain"
              />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-[.14em] text-emerald-300">
                Pendaftaran Event
              </p>
              <p className="text-sm font-semibold">TDA Pekanbaru 9.0</p>
            </div>
          </div>
          {Boolean(event.isCollaboration) && (
            <p className="mt-6 text-xs font-bold uppercase tracking-[.16em] text-emerald-300">
              Event Kolaborasi{" "}
              {event.collaborationPartner
                ? `${event.collaborationPartner} × `
                : ""}
              TDA Pekanbaru
            </p>
          )}
          <h1
            className={`${event.isCollaboration ? "mt-2" : "mt-6"} text-2xl font-bold leading-tight sm:text-3xl`}
          >
            {event.publicTitle || event.name}
          </h1>
          <div className="mt-5 grid gap-2 text-sm text-emerald-50 sm:grid-cols-2">
            <span className="flex items-center gap-2">
              <CalendarDays className="size-4 text-emerald-300" />
              {new Date(`${event.eventDate}T00:00:00`).toLocaleDateString(
                "id-ID",
                {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                },
              )}
            </span>
            <span className="flex items-center gap-2">
              <Clock3 className="size-4 text-emerald-300" />
              {event.startTime || "—"}–{event.endTime || "selesai"} WIB
            </span>
            <span className="flex items-center gap-2 sm:col-span-2">
              <MapPin className="size-4 text-emerald-300" />
              {event.location || "Lokasi akan diinformasikan"}
            </span>
          </div>
        </header>

        {result ? (
          <section className="px-6 py-8 sm:px-8">
            <div className="text-center">
              <span
                className={`mx-auto grid size-16 place-items-center rounded-2xl ${ticketReady ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}
              >
                <TicketCheck className="size-8" />
              </span>
              <p className="mt-5 text-sm font-bold uppercase tracking-[.14em] text-emerald-700">
                {result.alreadyRegistered
                  ? "Data Pendaftaran"
                  : "Pendaftaran Berhasil"}
              </p>
              <h2 className="mt-2 text-2xl font-bold">
                Terima kasih, {result.name}
              </h2>
            </div>
            {error && (
              <div
                role="alert"
                className="mt-5 rounded-xl bg-rose-50 p-4 text-sm font-semibold text-rose-700"
              >
                {error}
              </div>
            )}
            {!ticketReady && (
              <div className="mx-auto mt-5 max-w-sm rounded-3xl border-2 border-dashed border-amber-300 bg-amber-50 p-5 text-center">
                <p className="mb-3 text-sm font-bold text-amber-900">
                  QR Belum Aktif · Menunggu Pembayaran
                </p>
                {qrImage ? (
                  <Image
                    unoptimized
                    src={qrImage}
                    width={224}
                    height={224}
                    alt={`QR pendaftaran ${result.name}`}
                    className="mx-auto size-56 rounded-xl bg-white p-2 opacity-50"
                  />
                ) : (
                  <div className="mx-auto grid size-56 place-items-center text-sm text-amber-700">
                    Membuat QR…
                  </div>
                )}
                <p className="mt-3 text-xs leading-5 text-amber-800">
                  QR sudah tersimpan, tetapi check-in baru dapat dilakukan
                  setelah pembayaran disahkan atau dicatat petugas di lokasi.
                </p>
              </div>
            )}
            {ticketReady ? (
              <>
                <p className="mt-3 text-center text-sm leading-6 text-slate-600">
                  Tunjukkan QR ini kepada panitia saat check-in.
                </p>
                <div className="mx-auto mt-5 max-w-sm rounded-3xl border-2 border-dashed border-emerald-300 bg-emerald-50 p-5 text-center">
                  {qrImage ? (
                    <Image
                      unoptimized
                      src={qrImage}
                      width={224}
                      height={224}
                      alt={`QR check-in ${result.name}`}
                      className="mx-auto size-56 rounded-xl bg-white p-2"
                    />
                  ) : (
                    <div className="mx-auto grid size-56 place-items-center text-sm text-emerald-700">
                      Membuat QR…
                    </div>
                  )}
                  <p className="mt-4 text-xs font-bold uppercase tracking-wider text-emerald-700">
                    Kode Peserta
                  </p>
                  <p className="mt-1 font-mono text-lg font-bold text-emerald-950">
                    {result.qrToken.split("-")[0].toUpperCase()}
                  </p>
                </div>
                {qrImage && (
                  <a
                    href={qrImage}
                    download={`qr-${result.name.replaceAll(" ", "-").toLowerCase()}.png`}
                    className="mx-auto mt-4 flex h-11 w-fit items-center justify-center gap-2 rounded-xl border border-emerald-700 px-4 text-sm font-bold text-emerald-800"
                  >
                    <Download className="size-4" /> Simpan QR
                  </a>
                )}
                <p className="mt-4 text-center text-xs text-slate-500">
                  QR hanya berlaku untuk satu peserta dan satu kali check-in.
                </p>
              </>
            ) : (
              <div className="mt-6 space-y-5">
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-bold text-amber-900">
                      {paymentLabels[result.paymentStatus] ||
                        result.paymentStatus}
                    </span>
                    <strong className="text-lg text-amber-950">
                      {rupiah.format(result.amountDue)}
                    </strong>
                  </div>
                  <p className="mt-1 text-xs text-amber-800">
                    {result.priceLabel}
                  </p>
                  {result.paymentNote && (
                    <p className="mt-3 rounded-lg bg-white/70 p-3 text-sm font-semibold text-rose-700">
                      Catatan: {result.paymentNote}
                    </p>
                  )}
                </div>
                {result.paymentStatus === "verification" ? (
                  <div className="rounded-2xl bg-emerald-50 p-5 text-center">
                    <BadgeCheck className="mx-auto size-8 text-emerald-700" />
                    <p className="mt-3 font-bold text-emerald-900">
                      Bukti pembayaran sudah dikirim
                    </p>
                    <p className="mt-1 text-sm text-emerald-800">
                      Panitia sedang melakukan verifikasi. QR tiket akan muncul
                      setelah pembayaran disetujui.
                    </p>
                    <button
                      onClick={() => load(result.qrToken)}
                      className="mt-4 inline-flex h-10 items-center gap-2 rounded-xl border border-emerald-700 px-4 text-sm font-bold text-emerald-800"
                    >
                      <RefreshCw className="size-4" /> Periksa Status
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="rounded-2xl border p-5">
                      <h3 className="flex items-center gap-2 font-bold">
                        <Banknote className="size-5 text-emerald-700" /> Pilihan
                        pembayaran
                      </h3>
                      {event.qrisAvailable && (
                        <div className="mt-4 text-center">
                          <Image
                            unoptimized
                            src={`/api/public-registration/${eventId}/qris`}
                            width={480}
                            height={480}
                            alt="QRIS pembayaran event"
                            className="mx-auto max-h-80 w-auto rounded-2xl border object-contain"
                          />
                          <a
                            href={`/api/public-registration/${eventId}/qris`}
                            download
                            className="mt-3 inline-flex h-10 items-center gap-2 rounded-xl border px-4 text-sm font-bold text-emerald-800"
                          >
                            <Download className="size-4" /> Simpan QRIS
                          </a>
                          <p className="mt-2 text-xs text-slate-500">
                            Simpan atau screenshot QRIS, lalu bayar melalui
                            aplikasi pembayaran.
                          </p>
                        </div>
                      )}
                      {event.bankAccountNumber && (
                        <div className="mt-4 rounded-xl bg-slate-50 p-4">
                          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                            Transfer Bank
                          </p>
                          <p className="mt-2 font-bold">
                            {event.bankName} · {event.bankAccountNumber}
                          </p>
                          <p className="text-sm text-slate-600">
                            a.n. {event.bankAccountName}
                          </p>
                        </div>
                      )}
                      {event.paymentInstructions && (
                        <p className="mt-4 whitespace-pre-line text-sm leading-6 text-slate-600">
                          {event.paymentInstructions}
                        </p>
                      )}
                    </div>
                    <form
                      onSubmit={confirmPayment}
                      className="rounded-2xl border p-5"
                    >
                      <h3 className="font-bold">Konfirmasi pembayaran</h3>
                      <p className="mt-1 text-sm text-slate-600">
                        Pilih metode dan unggah bukti transaksi.
                      </p>
                      <Field label="Metode pembayaran">
                        <select
                          value={paymentMethod}
                          onChange={(e) => setPaymentMethod(e.target.value)}
                          className="h-12 rounded-xl border border-slate-300 bg-white px-3 text-base"
                        >
                          <option>QRIS</option>
                          <option>Transfer Bank</option>
                        </select>
                      </Field>
                      <Field label="Bukti pembayaran *">
                        <input
                          required
                          type="file"
                          accept=".pdf,.jpg,.jpeg,.png,.webp"
                          onChange={(e) =>
                            setProof(e.target.files?.[0] ?? null)
                          }
                          className="rounded-xl border border-slate-300 p-3 text-sm"
                        />
                      </Field>
                      <button
                        disabled={!proof || submitting}
                        className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 px-5 font-bold text-white disabled:opacity-50"
                      >
                        <Upload className="size-5" />
                        {submitting ? "Mengirim…" : "Kirim Konfirmasi"}
                      </button>
                    </form>
                  </>
                )}
              </div>
            )}
          </section>
        ) : (
          <form onSubmit={submit} className="space-y-4 px-6 py-7 sm:px-8">
            <div>
              <h2 className="text-xl font-bold">Data peserta</h2>
              <p className="mt-1 text-sm text-slate-600">
                Isi data berikut untuk mendaftarkan diri.
              </p>
            </div>
            {!event.registrationOpen && (
              <div className="rounded-xl bg-amber-50 p-4 text-sm font-semibold text-amber-800">
                Pendaftaran untuk event ini sudah ditutup.
              </div>
            )}
            {error && (
              <div
                role="alert"
                className="rounded-xl bg-rose-50 p-4 text-sm font-semibold text-rose-700"
              >
                {error}
              </div>
            )}
            <Field label="Nama lengkap *">
              <input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="h-12 rounded-xl border border-slate-300 px-3 text-base"
                placeholder="Sesuai nama yang digunakan"
              />
            </Field>
            <Field label="Nomor WhatsApp *">
              <input
                required
                inputMode="tel"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="h-12 rounded-xl border border-slate-300 px-3 text-base"
                placeholder="08xxxxxxxxxx"
              />
            </Field>
            <Field label="Kategori peserta">
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="h-12 rounded-xl border border-slate-300 bg-white px-3 text-base"
              >
                {Boolean(event.allowMemberCategory) && (
                  <option>Member TDA</option>
                )}
                {Boolean(event.allowCommitteeCategory) && (
                  <option>Pengurus TDA</option>
                )}
                {Boolean(event.allowPublicCategory) && <option>Umum</option>}
              </select>
            </Field>
            {event.isPaid ? (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                <p className="text-sm text-emerald-800">
                  Biaya pendaftaran · {selectedPrice.label}
                </p>
                <p className="mt-1 text-2xl font-bold text-emerald-950">
                  {rupiah.format(selectedPrice.amount)}
                </p>
                {event.earlyBirdEndsAt &&
                  selectedPrice.label.includes("Early") && (
                    <p className="mt-2 text-xs text-emerald-700">
                      Early bird berlaku sampai{" "}
                      {new Date(
                        `${event.earlyBirdEndsAt}:00+07:00`,
                      ).toLocaleString("id-ID", {
                        dateStyle: "medium",
                        timeStyle: "short",
                        timeZone: "Asia/Jakarta",
                      })}{" "}
                      WIB.
                    </p>
                  )}
              </div>
            ) : (
              <div className="rounded-xl bg-emerald-50 p-4 text-sm font-bold text-emerald-800">
                Event ini gratis.
              </div>
            )}
            <Field label="Nama usaha/instansi">
              <input
                value={form.organization}
                onChange={(e) =>
                  setForm({ ...form, organization: e.target.value })
                }
                className="h-12 rounded-xl border border-slate-300 px-3 text-base"
                placeholder="Opsional"
              />
            </Field>
            {form.category.includes("TDA") && (
              <Field label="Nomor TDA Passport">
                <input
                  value={form.passportNumber}
                  onChange={(e) =>
                    setForm({ ...form, passportNumber: e.target.value })
                  }
                  className="h-12 rounded-xl border border-slate-300 px-3 text-base"
                  placeholder="Diisi untuk verifikasi kategori"
                  required={Boolean(event.isPaid)}
                />
              </Field>
            )}
            <button
              disabled={!event.registrationOpen || submitting}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 px-5 font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              <BadgeCheck className="size-5" />
              {submitting ? "Menyimpan…" : "Daftar Sekarang"}
            </button>
            <p className="text-center text-xs leading-5 text-slate-500">
              Satu nomor WhatsApp hanya dapat didaftarkan satu kali pada event
              ini.
            </p>
          </form>
        )}
      </div>
    </main>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="mt-4 grid gap-1.5 text-sm font-semibold text-slate-800">
      {label}
      {children}
    </label>
  );
}
