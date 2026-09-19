"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { CalendarDays, CheckCircle2, LoaderCircle, Pencil, Plus, Search, Trash2, UserRound, X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { getCachedJson, invalidateClientCache, setCachedJson } from "@/lib/client-cache";

type TaskStatus = "belum_mulai" | "proses" | "selesai" | "tertunda";
type ProgramTask = {
  id: number;
  programId: number;
  title: string;
  pic: string;
  dueDate: string;
  status: TaskStatus;
  notes: string;
  usesBudget: number;
  budgetAmount: number;
  incomeTarget: number;
  realizedExpense: number;
  realizedIncome: number;
  assignedDivisionIds: string;
  assignedDivisionNames: string;
  createdAt: string;
  updatedAt: string;
};

const statuses: { value: TaskStatus; label: string; className: string }[] = [
  { value: "belum_mulai", label: "Belum Mulai", className: "bg-slate-100 text-slate-700" },
  { value: "proses", label: "Proses", className: "bg-amber-100 text-amber-800" },
  { value: "selesai", label: "Selesai", className: "bg-emerald-100 text-emerald-800" },
  { value: "tertunda", label: "Tertunda", className: "bg-rose-100 text-rose-800" },
];
const emptyForm = { title: "", pic: "", dueDate: "", status: "belum_mulai" as TaskStatus, notes: "", usesBudget: false, budgetAmount: "", incomeTarget: "", assignedDivisionIds: [] as number[] };
const money = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });

function TaskStatusBadge({ status }: { status: TaskStatus }) {
  const item = statuses.find((option) => option.value === status) ?? statuses[0];
  return <Badge variant="outline" className={`border-0 ${item.className}`}>{item.label}</Badge>;
}

function dateLabel(value: string) {
  if (!value) return "Belum ditentukan";
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeZone: "Asia/Jakarta" }).format(new Date(`${value}T00:00:00+07:00`));
}

export default function ProgramTaskList({ programId, divisions, canManage, onChanged }: { programId: number; divisions: { id: number; name: string }[]; canManage: boolean; onChanged: () => void }) {
  const [tasks, setTasks] = useState<ProgramTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ProgramTask | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ProgramTask | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const filteredTasks = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase("id-ID");
    if (!query) return tasks;

    return tasks.filter((task) => {
      const statusLabel = statuses.find((status) => status.value === task.status)?.label ?? task.status;
      return [task.title, task.pic, task.notes, statusLabel, task.dueDate, dateLabel(task.dueDate)]
        .join(" ")
        .toLocaleLowerCase("id-ID")
        .includes(query);
    });
  }, [searchQuery, tasks]);

  useEffect(() => {
    let cancelled = false;
    getCachedJson<{ tasks: ProgramTask[] }>(`/api/programs/${programId}/tasks`, 60_000).then((payload) => {
      if (!cancelled) setTasks(payload.tasks);
    }).catch((reason) => {
      if (!cancelled) toast.error(reason instanceof Error ? reason.message : "Breakdown pekerjaan belum dapat dimuat.");
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [programId]);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setFormOpen(true);
  }

  function openEdit(task: ProgramTask) {
    setEditing(task);
    setForm({ title: task.title, pic: task.pic, dueDate: task.dueDate, status: task.status, notes: task.notes,
      usesBudget: Boolean(task.usesBudget), budgetAmount: String(task.budgetAmount || ""), incomeTarget: String(task.incomeTarget || ""),
      assignedDivisionIds: task.assignedDivisionIds ? task.assignedDivisionIds.split(",").map(Number).filter(Boolean) : [] });
    setFormOpen(true);
  }

  async function saveTask(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      const url = editing ? `/api/programs/${programId}/tasks/${editing.id}` : `/api/programs/${programId}/tasks`;
      const response = await fetch(url, {
        method: editing ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(form),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error);
      setFormOpen(false);
      toast.success(editing ? "Pekerjaan berhasil diperbarui." : "Pekerjaan berhasil ditambahkan.");
      const nextTasks = editing ? tasks.map((task) => task.id === payload.task.id ? payload.task : task) : [...tasks, payload.task];
      setTasks(nextTasks);
      invalidateClientCache("/api/programs", "/api/program-management/calendar", "/api/program-management/reports", "/api/program-management/summary");
      setCachedJson(`/api/programs/${programId}/tasks`, { tasks: nextTasks });
      onChanged();
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "Pekerjaan belum dapat disimpan.");
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus(task: ProgramTask, status: TaskStatus) {
    try {
      const response = await fetch(`/api/programs/${programId}/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...task, status }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error);
      const nextTasks = tasks.map((item) => item.id === payload.task.id ? payload.task : item);
      setTasks(nextTasks);
      invalidateClientCache("/api/programs", "/api/program-management/calendar", "/api/program-management/reports", "/api/program-management/summary");
      setCachedJson(`/api/programs/${programId}/tasks`, { tasks: nextTasks });
      onChanged();
      toast.success("Status pekerjaan diperbarui.");
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "Status belum dapat diperbarui.");
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const response = await fetch(`/api/programs/${programId}/tasks/${deleteTarget.id}`, { method: "DELETE" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error);
      setDeleteTarget(null);
      const nextTasks = tasks.filter((task) => task.id !== deleteTarget.id);
      setTasks(nextTasks);
      invalidateClientCache("/api/programs", "/api/program-management/calendar", "/api/program-management/reports", "/api/program-management/summary");
      setCachedJson(`/api/programs/${programId}/tasks`, { tasks: nextTasks });
      onChanged();
      toast.success("Pekerjaan berhasil dihapus.");
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "Pekerjaan belum dapat dihapus.");
    } finally {
      setDeleting(false);
    }
  }

  return <section className="space-y-3">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-bold">Breakdown Pekerjaan</h3><p className="mt-1 text-xs text-muted-foreground">{tasks.length} pekerjaan dalam program ini</p></div>{canManage && <Button type="button" size="sm" className="shrink-0" onClick={openCreate}><Plus />Tambah Pekerjaan</Button>}</div>
    {!loading && tasks.length > 0 && <div><Label htmlFor="task-search" className="sr-only">Cari pekerjaan</Label><div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input id="task-search" type="search" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Cari nama pekerjaan, PIC, catatan, status, atau due date…" className="h-10 pl-9 pr-10" autoComplete="off" />{searchQuery && <Button type="button" variant="ghost" size="icon-sm" className="absolute right-1 top-1/2 -translate-y-1/2" onClick={() => setSearchQuery("")} aria-label="Hapus pencarian"><X /></Button>}</div>{searchQuery.trim() && <p className="mt-1.5 text-xs text-muted-foreground">{filteredTasks.length} dari {tasks.length} pekerjaan ditemukan</p>}</div>}
    {loading ? <div className="flex min-h-24 items-center justify-center gap-2 text-sm text-muted-foreground"><LoaderCircle className="size-4 animate-spin" />Memuat pekerjaan…</div> : tasks.length === 0 ? <div className="rounded-xl border border-dashed p-5 text-center"><CheckCircle2 className="mx-auto size-7 text-primary" /><p className="mt-2 text-sm font-bold">Belum ada breakdown pekerjaan</p><p className="mt-1 text-xs text-muted-foreground">Tambahkan langkah-langkah pelaksanaan agar progres dapat dihitung otomatis.</p></div> : filteredTasks.length === 0 ? <div className="rounded-xl border border-dashed p-5 text-center"><Search className="mx-auto size-7 text-muted-foreground" /><p className="mt-2 text-sm font-bold">Pekerjaan tidak ditemukan</p><p className="mt-1 text-xs text-muted-foreground">Coba kata kunci lain atau hapus pencarian.</p><Button type="button" variant="outline" size="sm" className="mt-3" onClick={() => setSearchQuery("")}>Hapus Pencarian</Button></div> : <div className="space-y-3">{filteredTasks.map((task) => <article key={task.id} className="rounded-xl border p-3"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><h4 className="text-sm font-bold leading-5">{task.title}</h4><div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground"><span className="flex items-center gap-1"><UserRound className="size-3.5" />{task.pic || "PIC belum dipilih"}</span><span className="flex items-center gap-1"><CalendarDays className="size-3.5" />{dateLabel(task.dueDate)}</span></div></div><TaskStatusBadge status={task.status} /></div>{task.assignedDivisionNames && <p className="mt-3 text-xs font-semibold text-primary">Divisi: {task.assignedDivisionNames}</p>}{task.usesBudget ? <div className="mt-3 grid gap-2 rounded-xl bg-slate-50 p-3 text-xs sm:grid-cols-3"><div><span className="text-muted-foreground">Anggaran</span><strong className="mt-1 block">{money.format(task.budgetAmount)}</strong></div><div><span className="text-muted-foreground">Realisasi</span><strong className={`mt-1 block ${task.realizedExpense > task.budgetAmount ? "text-rose-600" : "text-emerald-700"}`}>{money.format(task.realizedExpense)}</strong></div><div><span className="text-muted-foreground">Status</span><strong className={`mt-1 block ${task.realizedExpense > task.budgetAmount ? "text-rose-600" : task.budgetAmount && task.realizedExpense >= task.budgetAmount * .8 ? "text-amber-700" : "text-emerald-700"}`}>{task.realizedExpense > task.budgetAmount ? "Over Budget" : task.budgetAmount && task.realizedExpense >= task.budgetAmount * .8 ? "Mendekati Batas" : "Aman"}</strong></div>{task.incomeTarget > 0 && <div className="sm:col-span-3">Target penerimaan {money.format(task.incomeTarget)} · Realisasi {money.format(task.realizedIncome)}</div>}</div> : <p className="mt-3 text-xs text-muted-foreground">Tanpa anggaran khusus</p>}{task.notes && <p className="mt-3 rounded-lg bg-muted/50 p-2 text-xs leading-5 text-muted-foreground">{task.notes}</p>}{canManage && <div className="mt-3 flex items-center gap-2"><Select value={task.status} onValueChange={(value) => void changeStatus(task, value as TaskStatus)}><SelectTrigger size="sm" className="min-w-0 flex-1"><SelectValue /></SelectTrigger><SelectContent>{statuses.map((status) => <SelectItem key={status.value} value={status.value}>{status.label}</SelectItem>)}</SelectContent></Select><Button type="button" variant="ghost" size="icon-sm" onClick={() => openEdit(task)} aria-label={`Edit ${task.title}`}><Pencil /></Button><Button type="button" variant="ghost" size="icon-sm" className="text-destructive" onClick={() => setDeleteTarget(task)} aria-label={`Hapus ${task.title}`}><Trash2 /></Button></div>}</article>)}</div>}

    <Dialog open={formOpen} onOpenChange={(open) => { if (!saving) setFormOpen(open); }}><DialogContent><form onSubmit={saveTask}><DialogHeader><DialogTitle>{editing ? "Edit Pekerjaan" : "Tambah Pekerjaan"}</DialogTitle><DialogDescription>Breakdown pelaksanaan program kerja beserta PIC dan due date.</DialogDescription></DialogHeader><div className="grid gap-4 py-5"><div className="grid gap-2"><Label htmlFor="task-title">Nama pekerjaan</Label><Input id="task-title" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="Contoh: Susun konsep kegiatan" required maxLength={180} /></div><div className="grid gap-4 sm:grid-cols-2"><div className="grid gap-2"><Label htmlFor="task-pic">PIC</Label><Input id="task-pic" value={form.pic} onChange={(event) => setForm({ ...form, pic: event.target.value })} placeholder="Nama penanggung jawab" maxLength={100} /></div><div className="grid gap-2"><Label htmlFor="task-due">Due date</Label><Input id="task-due" type="date" value={form.dueDate} onChange={(event) => setForm({ ...form, dueDate: event.target.value })} /></div></div><div className="grid gap-2"><Label>Status</Label><Select value={form.status} onValueChange={(value) => setForm({ ...form, status: value as TaskStatus })}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent>{statuses.map((status) => <SelectItem key={status.value} value={status.value}>{status.label}</SelectItem>)}</SelectContent></Select></div><label className="flex items-center justify-between rounded-xl border p-3"><span><strong className="block text-sm">Menggunakan anggaran</strong><span className="text-xs text-muted-foreground">Aktifkan untuk mengontrol realisasi pekerjaan.</span></span><input type="checkbox" checked={form.usesBudget} onChange={(event) => setForm({ ...form, usesBudget: event.target.checked })} className="size-5 accent-emerald-700" /></label>{form.usesBudget && <div className="grid gap-4 sm:grid-cols-2"><div className="grid gap-2"><Label>Anggaran pengeluaran</Label><Input type="number" min="0" step="1000" value={form.budgetAmount} onChange={(event) => setForm({ ...form, budgetAmount: event.target.value })} /></div><div className="grid gap-2"><Label>Target penerimaan (opsional)</Label><Input type="number" min="0" step="1000" value={form.incomeTarget} onChange={(event) => setForm({ ...form, incomeTarget: event.target.value })} /></div></div>}<div className="grid gap-2"><Label>Divisi pelaksana</Label><div className="grid gap-2 rounded-xl border p-3 sm:grid-cols-2">{divisions.map((division) => <label key={division.id} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.assignedDivisionIds.includes(division.id)} onChange={(event) => setForm({ ...form, assignedDivisionIds: event.target.checked ? [...form.assignedDivisionIds, division.id] : form.assignedDivisionIds.filter((id) => id !== division.id) })} className="size-4 accent-emerald-700" />{division.name}</label>)}</div><p className="text-xs text-muted-foreground">Pengurus divisi yang dipilih akan menerima notifikasi.</p></div><div className="grid gap-2"><Label htmlFor="task-notes">Catatan</Label><Textarea id="task-notes" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} placeholder="Kebutuhan, kendala, atau informasi tambahan…" rows={3} maxLength={800} /></div></div><DialogFooter><Button type="button" variant="outline" onClick={() => setFormOpen(false)} disabled={saving}>Batal</Button><Button type="submit" disabled={saving || !form.title.trim()}>{saving && <LoaderCircle className="animate-spin" />}{editing ? "Simpan Perubahan" : "Tambah Pekerjaan"}</Button></DialogFooter></form></DialogContent></Dialog>

    <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => { if (!open && !deleting) setDeleteTarget(null); }}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Hapus pekerjaan?</AlertDialogTitle><AlertDialogDescription>Pekerjaan <strong className="text-foreground">{deleteTarget?.title}</strong> akan dihapus dari breakdown program.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={deleting}>Batal</AlertDialogCancel><AlertDialogAction variant="destructive" onClick={(event) => { event.preventDefault(); void confirmDelete(); }} disabled={deleting}>{deleting && <LoaderCircle className="animate-spin" />}Hapus</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </section>;
}
