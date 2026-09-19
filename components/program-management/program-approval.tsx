"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Clock3, LoaderCircle, RotateCcw, Send, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { getCachedJson, invalidateClientCache, setCachedJson } from "@/lib/client-cache";

type ProgramStatus = "draft" | "pending_approval" | "approved" | "revision_required" | "rejected";
type ApprovalAction = "submit" | "approve" | "request_revision" | "reject";
type ApprovalHistory = {
  id: number;
  actorName: string;
  actorRole: "ketua_ksb" | "kadiv" | "viewer" | null;
  status: "submitted" | "approved" | "revision_required" | "rejected";
  note: string;
  sequence: number;
  createdAt: string;
};

const actionCopy: Record<ApprovalAction, { title: string; description: string; button: string }> = {
  submit: { title: "Ajukan program kerja?", description: "Program akan dikirim kepada Ketua/KSB untuk diperiksa.", button: "Ajukan Sekarang" },
  approve: { title: "Setujui program kerja?", description: "Program akan ditandai disetujui dan siap dilaksanakan.", button: "Setujui Program" },
  request_revision: { title: "Minta revisi program?", description: "Tuliskan bagian yang perlu diperbaiki oleh pengelola program.", button: "Kirim Catatan Revisi" },
  reject: { title: "Tolak program kerja?", description: "Tuliskan alasan penolakan agar tercatat dalam riwayat.", button: "Tolak Program" },
};

const historyCopy = {
  submitted: { label: "Diajukan", icon: Send, tone: "bg-amber-100 text-amber-800" },
  approved: { label: "Disetujui", icon: CheckCircle2, tone: "bg-emerald-100 text-emerald-800" },
  revision_required: { label: "Diminta Revisi", icon: RotateCcw, tone: "bg-blue-100 text-blue-800" },
  rejected: { label: "Ditolak", icon: XCircle, tone: "bg-rose-100 text-rose-800" },
};

function formatDate(value: string) {
  const normalized = value.includes("T") ? value : `${value.replace(" ", "T")}Z`;
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" }).format(new Date(normalized));
}

export default function ProgramApproval({
  programId, status, canManage, isKetua, onChanged,
}: {
  programId: number;
  status: ProgramStatus;
  canManage: boolean;
  isKetua: boolean;
  onChanged: () => void;
}) {
  const [history, setHistory] = useState<ApprovalHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState<ApprovalAction | null>(null);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getCachedJson<{ history: ApprovalHistory[] }>(`/api/programs/${programId}/approval`, 60_000).then((payload) => {
      if (!cancelled) setHistory(payload.history);
    }).catch((reason) => {
      if (!cancelled) toast.error(reason instanceof Error ? reason.message : "Riwayat persetujuan belum dapat dimuat.");
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [programId]);

  function openAction(nextAction: ApprovalAction) {
    setNote("");
    setAction(nextAction);
  }

  async function confirmAction() {
    if (!action) return;
    setSaving(true);
    try {
      const response = await fetch(`/api/programs/${programId}/approval`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, note }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error);
      setHistory(payload.history);
      invalidateClientCache("/api/programs", "/api/program-management/reports", "/api/program-management/summary");
      setCachedJson(`/api/programs/${programId}/approval`, { history: payload.history });
      setAction(null);
      toast.success(action === "submit" ? "Program berhasil diajukan." : "Keputusan persetujuan berhasil disimpan.");
      onChanged();
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "Persetujuan belum dapat disimpan.");
    } finally {
      setSaving(false);
    }
  }

  const canSubmit = canManage && ["draft", "revision_required", "rejected"].includes(status);
  const canDecide = isKetua && status === "pending_approval";
  const copy = action ? actionCopy[action] : null;
  const noteRequired = action === "request_revision" || action === "reject";

  return <section className="space-y-4 rounded-xl border p-4">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><div className="flex items-center gap-2"><Clock3 className="size-4 text-primary" /><h3 className="font-bold">Persetujuan Program</h3></div><p className="mt-1 text-xs text-muted-foreground">Pengajuan dan keputusan Ketua/KSB tercatat di sini.</p></div><div className="flex flex-wrap gap-2">{canSubmit && <Button type="button" size="sm" onClick={() => openAction("submit")}><Send />Ajukan Persetujuan</Button>}{canDecide && <><Button type="button" size="sm" onClick={() => openAction("approve")}><CheckCircle2 />Setujui</Button><Button type="button" size="sm" variant="outline" onClick={() => openAction("request_revision")}><RotateCcw />Minta Revisi</Button><Button type="button" size="sm" variant="outline" className="text-destructive" onClick={() => openAction("reject")}><XCircle />Tolak</Button></>}</div></div>

    {loading ? <div className="flex min-h-20 items-center justify-center gap-2 text-sm text-muted-foreground"><LoaderCircle className="size-4 animate-spin" />Memuat riwayat…</div> : history.length === 0 ? <div className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">Belum ada riwayat persetujuan.</div> : <div className="space-y-3">{history.map((item) => { const config = historyCopy[item.status]; const Icon = config.icon; return <article key={item.id} className="flex gap-3 rounded-lg bg-muted/40 p-3"><div className={`grid size-8 shrink-0 place-items-center rounded-full ${config.tone}`}><Icon className="size-4" /></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="text-sm font-bold">{config.label}</p><Badge variant="outline">Tahap {item.sequence}</Badge></div><p className="mt-1 text-xs text-muted-foreground">{item.actorName} · {formatDate(item.createdAt)}</p>{item.note && <p className="mt-2 whitespace-pre-wrap text-sm leading-5">{item.note}</p>}</div></article>; })}</div>}

    <Dialog open={Boolean(action)} onOpenChange={(open) => { if (!open && !saving) setAction(null); }}><DialogContent><DialogHeader><DialogTitle>{copy?.title}</DialogTitle><DialogDescription>{copy?.description}</DialogDescription></DialogHeader><div className="grid gap-2 py-4"><Label htmlFor="approval-note">Catatan {noteRequired ? "(wajib)" : "(opsional)"}</Label><Textarea id="approval-note" value={note} onChange={(event) => setNote(event.target.value)} placeholder={noteRequired ? "Tuliskan catatan yang jelas…" : "Tambahkan catatan bila diperlukan…"} rows={4} maxLength={1000} /></div><DialogFooter><Button type="button" variant="outline" onClick={() => setAction(null)} disabled={saving}>Batal</Button><Button type="button" variant={action === "reject" ? "destructive" : "default"} onClick={() => void confirmAction()} disabled={saving || (noteRequired && !note.trim())}>{saving && <LoaderCircle className="animate-spin" />}{copy?.button}</Button></DialogFooter></DialogContent></Dialog>
  </section>;
}
