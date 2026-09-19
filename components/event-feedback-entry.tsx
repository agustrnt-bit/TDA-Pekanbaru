"use client";

import { FormEvent, useEffect, useState } from "react";
import { ArrowRight, MessageSquareText, Phone } from "lucide-react";

type EventData = { eventName: string; programTitle: string; feedbackOpen: number };

export default function EventFeedbackEntry({ eventId }: { eventId: string }) {
  const [event, setEvent] = useState<EventData | null>(null);
  const [identity, setIdentity] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { fetch(`/api/public-event-feedback/${eventId}`).then(async (response) => { const payload = await response.json(); if (!response.ok) throw new Error(payload.error); setEvent(payload); }).catch((reason) => setError(reason.message)).finally(() => setLoading(false)); }, [eventId]);
  async function submit(e: FormEvent) {
    e.preventDefault(); setSaving(true); setError("");
    try { const response = await fetch(`/api/public-event-feedback/${eventId}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ identity }) }); const payload = await response.json(); if (!response.ok) throw new Error(payload.error); window.location.assign(`/feedback/${payload.token}`); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Peserta belum dapat diverifikasi."); setSaving(false); }
  }
  if (loading) return <main className="grid min-h-screen place-items-center bg-emerald-50 p-6 text-sm text-emerald-900">Memuat feedback…</main>;
  return <main className="grid min-h-screen place-items-center bg-emerald-50 p-4 sm:p-8"><section className="w-full max-w-lg overflow-hidden rounded-3xl bg-white shadow-xl"><header className="bg-[#102d20] p-6 text-white"><MessageSquareText className="size-9 text-emerald-300"/><p className="mt-4 text-sm font-bold text-emerald-300">FEEDBACK PROGRAM TDA PEKANBARU</p><h1 className="mt-2 text-2xl font-bold">{event?.programTitle || "Feedback Peserta"}</h1><p className="mt-2 text-sm text-emerald-100">{event?.eventName}</p></header><form onSubmit={submit} className="space-y-5 p-6"><div><h2 className="text-xl font-bold">Verifikasi peserta</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">Masukkan nomor WhatsApp yang digunakan saat registrasi agar jawaban tercatat atas nama Anda.</p></div><label className="block"><span className="text-sm font-semibold">Nomor WhatsApp</span><div className="relative mt-2"><Phone className="absolute left-3 top-3.5 size-5 text-muted-foreground"/><input autoFocus inputMode="tel" value={identity} onChange={(e) => setIdentity(e.target.value)} placeholder="Contoh: 081234567890" className="h-12 w-full rounded-xl border pl-11 pr-3 text-base outline-none focus:ring-2 focus:ring-emerald-600"/></div></label>{event && !event.feedbackOpen && <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">Form feedback belum dibuka oleh panitia.</p>}{error && <p className="rounded-xl bg-rose-50 p-4 text-sm text-rose-700">{error}</p>}<button disabled={saving || !identity.trim() || !event?.feedbackOpen} className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 font-bold text-white disabled:opacity-50">{saving ? "Memverifikasi…" : "Lanjut Isi Feedback"}<ArrowRight className="size-5"/></button></form></section></main>;
}
