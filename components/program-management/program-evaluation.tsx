"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Gauge, LoaderCircle, Pencil, Plus, Target, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { getCachedJson, invalidateClientCache, setCachedJson } from "@/lib/client-cache";

type EvaluationStatus = "belum_diukur" | "belum_tercapai" | "sebagian" | "tercapai";
type Evaluation = {
  id: number; programId: number; indicator: string; targetValue: number; actualValue: number;
  unit: string; isMeasured: boolean; notes: string; progress: number; status: EvaluationStatus;
  createdByName: string; createdAt: string; updatedAt: string;
};

const emptyForm = { indicator: "", targetValue: "", actualValue: "", unit: "", isMeasured: false, notes: "" };
const statusLabels: Record<EvaluationStatus, string> = {
  belum_diukur: "Belum Diukur", belum_tercapai: "Belum Tercapai", sebagian: "Tercapai Sebagian", tercapai: "Tercapai",
};
const statusTone: Record<EvaluationStatus, string> = {
  belum_diukur: "bg-slate-100 text-slate-700", belum_tercapai: "bg-rose-100 text-rose-800",
  sebagian: "bg-amber-100 text-amber-800", tercapai: "bg-emerald-100 text-emerald-800",
};

function numberLabel(value: number) {
  return new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 }).format(value);
}

export default function ProgramEvaluation({ programId, canManage, onChanged }: { programId: number; canManage: boolean; onChanged: () => void }) {
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Evaluation | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Evaluation | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getCachedJson<{ evaluations: Evaluation[] }>(`/api/programs/${programId}/evaluations`, 60_000).then((payload) => {
      if (!cancelled) setEvaluations(payload.evaluations);
    }).catch((reason) => { if (!cancelled) toast.error(reason instanceof Error ? reason.message : "Evaluasi belum dapat dimuat."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [programId]);

  const summary = useMemo(() => {
    const measured = evaluations.filter((item) => item.isMeasured);
    const achieved = evaluations.filter((item) => item.status === "tercapai").length;
    const progress = measured.length ? Math.round(measured.reduce((total, item) => total + item.progress, 0) / measured.length) : 0;
    return { measured: measured.length, achieved, progress };
  }, [evaluations]);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setFormOpen(true);
  }

  function openEdit(item: Evaluation) {
    setEditing(item);
    setForm({
      indicator: item.indicator, targetValue: String(item.targetValue), actualValue: String(item.actualValue),
      unit: item.unit, isMeasured: item.isMeasured, notes: item.notes,
    });
    setFormOpen(true);
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      const response = await fetch(editing ? `/api/programs/${programId}/evaluations/${editing.id}` : `/api/programs/${programId}/evaluations`, {
        method: editing ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...form,
          targetValue: Number(form.targetValue),
          actualValue: form.isMeasured ? Number(form.actualValue) || 0 : 0,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error);
      setFormOpen(false);
      toast.success(editing ? "Capaian berhasil diperbarui." : "Indikator berhasil ditambahkan.");
      const nextEvaluations = editing ? evaluations.map((item) => item.id === payload.evaluation.id ? payload.evaluation : item) : [...evaluations, payload.evaluation];
      setEvaluations(nextEvaluations);
      invalidateClientCache("/api/programs", "/api/program-management/reports", "/api/program-management/summary");
      setCachedJson(`/api/programs/${programId}/evaluations`, { evaluations: nextEvaluations });
      onChanged();
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "Evaluasi belum dapat disimpan.");
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const response = await fetch(`/api/programs/${programId}/evaluations/${deleteTarget.id}`, { method: "DELETE" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error);
      setDeleteTarget(null);
      toast.success("Indikator capaian berhasil dihapus.");
      const nextEvaluations = evaluations.filter((item) => item.id !== deleteTarget.id);
      setEvaluations(nextEvaluations);
      invalidateClientCache("/api/programs", "/api/program-management/reports", "/api/program-management/summary");
      setCachedJson(`/api/programs/${programId}/evaluations`, { evaluations: nextEvaluations });
      onChanged();
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "Indikator belum dapat dihapus.");
    } finally {
      setDeleting(false);
    }
  }

  return <section className="overflow-hidden rounded-xl border bg-white">
    <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center sm:justify-between">
      <div><div className="flex items-center gap-2"><Gauge className="size-5 text-primary" /><h3 className="font-bold">Evaluasi & Capaian KPI</h3></div><p className="mt-1 text-sm text-muted-foreground">Ukur hasil nyata program berdasarkan indikator keberhasilan.</p></div>
      {canManage && <Button type="button" size="sm" onClick={openCreate}><Plus className="size-4" />Tambah Indikator</Button>}
    </div>
    {!loading && evaluations.length > 0 && <div className="grid grid-cols-3 gap-px border-b bg-border">
      <div className="bg-emerald-50/50 p-3 text-center"><p className="text-xl font-bold text-emerald-800">{summary.progress}%</p><p className="text-xs text-muted-foreground">Rata-rata Capaian</p></div>
      <div className="bg-white p-3 text-center"><p className="text-xl font-bold">{summary.achieved}/{evaluations.length}</p><p className="text-xs text-muted-foreground">KPI Tercapai</p></div>
      <div className="bg-white p-3 text-center"><p className="text-xl font-bold">{summary.measured}/{evaluations.length}</p><p className="text-xs text-muted-foreground">Sudah Diukur</p></div>
    </div>}
    {loading ? <div className="grid min-h-32 place-items-center"><LoaderCircle className="size-5 animate-spin text-primary" /></div> : evaluations.length === 0 ? <div className="p-8 text-center"><Target className="mx-auto size-8 text-muted-foreground" /><p className="mt-3 text-sm font-semibold">Belum ada indikator terukur.</p><p className="mt-1 text-xs text-muted-foreground">Tambahkan KPI agar hasil program dapat dievaluasi.</p></div> : <div className="divide-y">{evaluations.map((item) => <article key={item.id} className="p-4">
      <div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h4 className="font-semibold">{item.indicator}</h4><Badge className={`border-0 ${statusTone[item.status]}`}>{statusLabels[item.status]}</Badge></div><p className="mt-2 text-sm text-muted-foreground">Target <strong className="text-foreground">{numberLabel(item.targetValue)} {item.unit}</strong> · Realisasi <strong className="text-foreground">{item.isMeasured ? `${numberLabel(item.actualValue)} ${item.unit}` : "belum diukur"}</strong></p></div>{canManage && <div className="flex shrink-0"><Button type="button" variant="ghost" size="icon-sm" onClick={() => openEdit(item)} aria-label={`Edit ${item.indicator}`}><Pencil className="size-4" /></Button><Button type="button" variant="ghost" size="icon-sm" className="text-destructive" onClick={() => setDeleteTarget(item)} aria-label={`Hapus ${item.indicator}`}><Trash2 className="size-4" /></Button></div>}</div>
      <div className="mt-3 flex items-center gap-3"><Progress value={item.progress} className="flex-1" /><strong className="text-sm tabular-nums">{item.progress}%</strong></div>
      {item.notes && <p className="mt-3 rounded-lg bg-muted/50 p-3 text-sm leading-5 text-muted-foreground"><span className="font-semibold text-foreground">Catatan:</span> {item.notes}</p>}
    </article>)}</div>}

    <Dialog open={formOpen} onOpenChange={(open) => { if (!saving) setFormOpen(open); }}><DialogContent className="sm:max-w-xl"><form onSubmit={save}><DialogHeader><DialogTitle>{editing ? "Edit Capaian KPI" : "Tambah Indikator KPI"}</DialogTitle><DialogDescription>Target harus berupa angka. Persentase capaian dihitung otomatis dari realisasi dibanding target.</DialogDescription></DialogHeader><div className="grid gap-4 py-5"><div className="grid gap-2"><Label htmlFor="evaluation-indicator">Indikator keberhasilan</Label><Input id="evaluation-indicator" value={form.indicator} onChange={(event) => setForm({ ...form, indicator: event.target.value })} placeholder="Contoh: Jumlah peserta hadir" required maxLength={240} /></div><div className="grid gap-4 sm:grid-cols-2"><div className="grid gap-2"><Label htmlFor="evaluation-target">Target</Label><Input id="evaluation-target" type="number" min="0.01" step="any" value={form.targetValue} onChange={(event) => setForm({ ...form, targetValue: event.target.value })} placeholder="100" required /></div><div className="grid gap-2"><Label htmlFor="evaluation-unit">Satuan</Label><Input id="evaluation-unit" value={form.unit} onChange={(event) => setForm({ ...form, unit: event.target.value })} placeholder="peserta, %, kegiatan…" maxLength={60} /></div></div><div className="flex items-center justify-between rounded-xl border p-3"><div><Label htmlFor="evaluation-measured">Realisasi sudah diukur</Label><p className="mt-1 text-xs text-muted-foreground">Aktifkan saat hasil aktual sudah tersedia.</p></div><Switch id="evaluation-measured" checked={form.isMeasured} onCheckedChange={(checked) => setForm({ ...form, isMeasured: checked })} /></div>{form.isMeasured && <div className="grid gap-2"><Label htmlFor="evaluation-actual">Realisasi</Label><Input id="evaluation-actual" type="number" min="0" step="any" value={form.actualValue} onChange={(event) => setForm({ ...form, actualValue: event.target.value })} placeholder="0" required /></div>}<div className="grid gap-2"><Label htmlFor="evaluation-notes">Catatan evaluasi, kendala, atau tindak lanjut</Label><Textarea id="evaluation-notes" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} rows={4} maxLength={1000} placeholder="Tuliskan hasil, kendala, dan tindak lanjut yang diperlukan…" /></div></div><DialogFooter><Button type="button" variant="outline" onClick={() => setFormOpen(false)} disabled={saving}>Batal</Button><Button type="submit" disabled={saving || !form.indicator.trim() || !form.targetValue}>{saving && <LoaderCircle className="size-4 animate-spin" />}{editing ? "Simpan Perubahan" : "Tambah Indikator"}</Button></DialogFooter></form></DialogContent></Dialog>

    <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => { if (!open && !deleting) setDeleteTarget(null); }}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Hapus indikator capaian?</AlertDialogTitle><AlertDialogDescription>Indikator <strong className="text-foreground">{deleteTarget?.indicator}</strong> beserta realisasinya akan dihapus.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={deleting}>Batal</AlertDialogCancel><AlertDialogAction variant="destructive" onClick={(event) => { event.preventDefault(); void confirmDelete(); }} disabled={deleting}>{deleting && <LoaderCircle className="size-4 animate-spin" />}Hapus Indikator</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </section>;
}
