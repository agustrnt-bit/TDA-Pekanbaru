"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarDays, Eye, FileText, LoaderCircle, Pencil, Plus, Search, Target, Trash2, UserRound, Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import ProgramTaskList from "@/components/program-management/program-task-list";
import ProgramApproval from "@/components/program-management/program-approval";
import ProgramEvaluation from "@/components/program-management/program-evaluation";
import ProgramFeedback from "@/components/program-management/program-feedback";
import ProgramGuide from "@/components/program-management/program-guide";
import type { AppAccess } from "@/lib/access-types";
import { getCachedJson, invalidateClientCache, setCachedJson } from "@/lib/client-cache";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type Division = { id: number; code: string; name: string; sortOrder: number };
type ProgramStatus = "draft" | "pending_approval" | "approved" | "revision_required" | "rejected";
type Program = {
  id: number;
  programCode: string;
  periodId: number;
  periodName: string;
  divisionId: number;
  divisionCode: string;
  divisionName: string;
  title: string;
  summary: string;
  pic: string;
  startDate: string;
  endDate: string;
  target: string;
  budget: number;
  status: ProgramStatus;
  taskCount: number;
  completedTaskCount: number;
  progress: number;
  kpiCount: number;
  measuredKpiCount: number;
  achievedKpiCount: number;
  outcomeProgress: number;
  outcomeStatus: "belum_diukur" | "belum_tercapai" | "sebagian" | "tercapai";
  createdAt: string;
  updatedAt: string;
};

const statusOptions: { value: ProgramStatus; label: string; className: string }[] = [
  { value: "draft", label: "Draft", className: "bg-slate-100 text-slate-700" },
  { value: "pending_approval", label: "Menunggu Approval", className: "bg-amber-100 text-amber-800" },
  { value: "approved", label: "Disetujui", className: "bg-emerald-100 text-emerald-800" },
  { value: "revision_required", label: "Perlu Revisi", className: "bg-blue-100 text-blue-800" },
  { value: "rejected", label: "Ditolak", className: "bg-rose-100 text-rose-800" },
];

const emptyForm = {
  divisionId: "", title: "", summary: "", pic: "", startDate: "", endDate: "",
  target: "", budget: "", status: "draft" as ProgramStatus,
};

function StatusBadge({ status }: { status: ProgramStatus }) {
  const item = statusOptions.find((option) => option.value === status) ?? statusOptions[0];
  return <Badge variant="outline" className={`border-0 ${item.className}`}>{item.label}</Badge>;
}

const outcomeLabels = { belum_diukur: "Belum Diukur", belum_tercapai: "Belum Tercapai", sebagian: "Tercapai Sebagian", tercapai: "Tercapai" };

function formatDate(value: string) {
  const normalized = value.includes("T") ? value : `${value.replace(" ", "T")}Z`;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" }).format(date);
}

function formatDay(value: string) {
  if (!value) return "Belum ditentukan";
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeZone: "Asia/Jakarta" }).format(new Date(`${value}T00:00:00+07:00`));
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(value || 0);
}

export default function ProgramList({
  divisions,
  nextCode,
  onChanged,
  access,
  accessLoading,
  signInPath,
  focusProgramId,
  onFocusHandled,
  initialDivisionId,
}: {
  divisions: Division[];
  nextCode: string;
  onChanged: () => void;
  access: AppAccess;
  accessLoading: boolean;
  signInPath: string;
  focusProgramId: number | null;
  onFocusHandled: () => void;
  initialDivisionId: number | null;
}) {
  const [programs, setPrograms] = useState<Program[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [divisionFilter, setDivisionFilter] = useState(initialDivisionId ? String(initialDivisionId) : "all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Program | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<Program | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Program | null>(null);
  const [deleting, setDeleting] = useState(false);
  const initialFocusRef = useRef(focusProgramId);
  const focusHandledRef = useRef(onFocusHandled);
  const manageableDivisions = access.user?.role === "kadiv"
    ? divisions.filter((division) => division.id === access.user?.divisionId)
    : divisions;
  const canCreate = access.permissions.writePrograms && manageableDivisions.length > 0;
  const canManage = (program: Program) => access.permissions.manageAllPrograms
    || (access.permissions.manageOwnDivision && access.user?.divisionId === program.divisionId);
  const canEditProgram = (program: Program) => canManage(program)
    && (access.user?.role === "ketua_ksb" || !["pending_approval", "approved"].includes(program.status));
  const canDeleteProgram = (program: Program) => canManage(program)
    && (access.user?.role === "ketua_ksb" || !["pending_approval", "approved"].includes(program.status));
  const canManageTasks = (program: Program) => canManage(program)
    && (access.user?.role === "ketua_ksb" || program.status !== "pending_approval");

  async function loadPrograms(focusId?: number, force = false, background = false) {
    if (!background) setLoading(true);
    setError("");
    try {
      const payload = await getCachedJson<{ programs: Program[] }>("/api/programs", 60_000, force);
      setPrograms(payload.programs);
      if (focusId) setSelected(payload.programs.find((program: Program) => program.id === focusId) ?? null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Daftar program kerja belum dapat dimuat.");
    } finally {
      if (!background) setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    getCachedJson<{ programs: Program[] }>("/api/programs", 60_000).then((payload) => {
      if (!cancelled) {
        setPrograms(payload.programs);
        const focusId = initialFocusRef.current;
        if (focusId) {
          setSelected(payload.programs.find((program: Program) => program.id === focusId) ?? null);
          focusHandledRef.current();
        }
      }
    }).catch((reason) => {
      if (!cancelled) setError(reason instanceof Error ? reason.message : "Daftar program kerja belum dapat dimuat.");
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (editing || deleteTarget || selected) return;
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") void loadPrograms(undefined, true, true);
    }, 15_000);
    return () => window.clearInterval(interval);
  }, [deleteTarget, editing, selected]);

  const filteredPrograms = useMemo(() => {
    const keyword = search.trim().toLocaleLowerCase("id-ID");
    return programs.filter((program) => {
      const matchesSearch = !keyword || [program.programCode, program.title, program.summary, program.pic, program.target, program.divisionName]
        .some((value) => value.toLocaleLowerCase("id-ID").includes(keyword));
      const matchesDivision = divisionFilter === "all" || String(program.divisionId) === divisionFilter;
      const matchesStatus = statusFilter === "all" || program.status === statusFilter;
      return matchesSearch && matchesDivision && matchesStatus;
    });
  }, [divisionFilter, programs, search, statusFilter]);

  function openCreate() {
    if (!canCreate) return;
    setEditing(null);
    setForm({ ...emptyForm, divisionId: manageableDivisions[0] ? String(manageableDivisions[0].id) : "" });
    setFormOpen(true);
  }

  function openEdit(program: Program) {
    setEditing(program);
    setForm({
      divisionId: String(program.divisionId), title: program.title,
      summary: program.summary, pic: program.pic, startDate: program.startDate,
      endDate: program.endDate, target: program.target,
      budget: program.budget ? String(program.budget) : "", status: program.status,
    });
    setSelected(null);
    setFormOpen(true);
  }

  async function saveProgram(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      const response = await fetch(editing ? `/api/programs/${editing.id}` : "/api/programs", {
        method: editing ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...form, divisionId: Number(form.divisionId), budget: Number(form.budget) || 0 }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error);
      setFormOpen(false);
      toast.success(editing ? "Program kerja berhasil diperbarui." : "Program kerja berhasil ditambahkan.");
      const nextPrograms = editing
        ? programs.map((program) => program.id === payload.program.id ? payload.program : program)
        : [payload.program, ...programs];
      setPrograms(nextPrograms);
      setCachedJson("/api/programs", { programs: nextPrograms });
      invalidateClientCache("/api/program-management/calendar", "/api/program-management/reports", "/api/program-management/summary");
      onChanged();
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "Program kerja belum dapat disimpan.");
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const response = await fetch(`/api/programs/${deleteTarget.id}`, { method: "DELETE" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error);
      setDeleteTarget(null);
      setSelected(null);
      toast.success("Program kerja berhasil dihapus.");
      const nextPrograms = programs.filter((program) => program.id !== deleteTarget.id);
      setPrograms(nextPrograms);
      setCachedJson("/api/programs", { programs: nextPrograms });
      invalidateClientCache("/api/program-management/calendar", "/api/program-management/reports", "/api/program-management/summary");
      onChanged();
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "Program kerja belum dapat dihapus.");
    } finally {
      setDeleting(false);
    }
  }

  return <>
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div><p className="text-sm font-bold uppercase tracking-[0.16em] text-primary">Program Kerja</p><h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">Daftar Program Kerja</h1><p className="mt-2 text-sm leading-6 text-muted-foreground sm:text-base">Kelola program TDA Pekanbaru 9.0 untuk periode aktif 2026–2029.</p></div>
      <div className="flex w-full gap-2 sm:w-auto"><ProgramGuide canCreate={canCreate} />{canCreate && <Button type="button" onClick={openCreate} className="flex-1 sm:flex-none"><Plus />Tambah Program</Button>}</div>
    </div>

    {!accessLoading && !access.permissions.writePrograms && <section className="mb-5 flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 sm:flex-row sm:items-center sm:justify-between"><p><strong>Mode baca.</strong> {access.authenticated ? "Akun ini tidak memiliki izin untuk mengubah program kerja." : "Masuk dengan ChatGPT untuk menggunakan hak akses pengurus."}</p>{!access.authenticated && <Button asChild size="sm" variant="outline"><a href={signInPath}>Masuk dengan ChatGPT</a></Button>}</section>}

    <section className="rounded-2xl border bg-white p-4 shadow-sm sm:p-5">
      <div className="grid gap-3 lg:grid-cols-[minmax(260px,1fr)_220px_220px]">
        <div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cari program, PIC, target, atau divisi…" className="pl-9" aria-label="Cari program kerja" /></div>
        <Select value={divisionFilter} onValueChange={setDivisionFilter}><SelectTrigger className="w-full"><SelectValue placeholder="Semua divisi" /></SelectTrigger><SelectContent><SelectItem value="all">Semua divisi</SelectItem>{divisions.map((division) => <SelectItem key={division.id} value={String(division.id)}>{division.name}</SelectItem>)}</SelectContent></Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger className="w-full"><SelectValue placeholder="Semua status" /></SelectTrigger><SelectContent><SelectItem value="all">Semua status</SelectItem>{statusOptions.map((status) => <SelectItem key={status.value} value={status.value}>{status.label}</SelectItem>)}</SelectContent></Select>
      </div>
      <div className="mt-4 flex items-center justify-between border-t pt-4 text-sm"><span className="text-muted-foreground">Menampilkan <strong className="text-foreground">{filteredPrograms.length}</strong> dari {programs.length} program</span>{(search || divisionFilter !== "all" || statusFilter !== "all") && <Button type="button" variant="ghost" size="sm" onClick={() => { setSearch(""); setDivisionFilter("all"); setStatusFilter("all"); }}>Reset filter</Button>}</div>
    </section>

    {error && <div className="mt-5 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{error} <button type="button" className="font-bold underline" onClick={() => void loadPrograms()}>Coba lagi</button></div>}

    <section className="mt-5 overflow-hidden rounded-2xl border bg-white shadow-sm">
      {loading ? <div className="grid min-h-56 place-items-center"><div className="flex items-center gap-2 text-sm text-muted-foreground"><LoaderCircle className="size-5 animate-spin" />Memuat program kerja…</div></div> : filteredPrograms.length === 0 ? <div className="grid min-h-64 place-items-center p-6 text-center"><div><div className="mx-auto grid size-14 place-items-center rounded-2xl bg-secondary text-primary"><FileText className="size-7" /></div><h2 className="mt-4 text-lg font-bold">{programs.length ? "Program tidak ditemukan" : "Belum ada program kerja"}</h2><p className="mt-2 text-sm text-muted-foreground">{programs.length ? "Coba ubah kata pencarian atau pilihan filter." : `Program pertama akan menggunakan kode ${nextCode}.`}</p>{!programs.length && canCreate && <Button type="button" onClick={openCreate} className="mt-5"><Plus />Tambah Program Pertama</Button>}</div></div> : <>
        <div className="hidden overflow-x-auto md:block"><table className="w-full text-left text-sm"><thead className="border-b bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="px-5 py-3 font-bold">Kode & Program</th><th className="px-4 py-3 font-bold">Divisi & PIC</th><th className="px-4 py-3 font-bold">Status</th><th className="min-w-44 px-4 py-3 font-bold">Progres</th><th className="px-5 py-3 text-right font-bold">Aksi</th></tr></thead><tbody>{filteredPrograms.map((program) => <tr key={program.id} className="border-b last:border-0 hover:bg-muted/30"><td className="px-5 py-4"><p className="font-mono text-xs font-bold text-primary">{program.programCode}</p><p className="mt-1 max-w-md font-bold">{program.title}</p><p className="mt-1 max-w-md truncate text-xs text-muted-foreground">{program.summary || "Belum ada ringkasan"}</p></td><td className="px-4 py-4"><Badge variant="secondary">{program.divisionCode}</Badge><p className="mt-1 text-xs text-muted-foreground">{program.divisionName}</p><p className="mt-2 text-xs font-semibold">{program.pic || "PIC belum ditentukan"}</p></td><td className="px-4 py-4"><StatusBadge status={program.status} /></td><td className="px-4 py-4"><div className="flex items-center justify-between text-xs"><span>{program.completedTaskCount}/{program.taskCount} pekerjaan</span><strong>{program.progress}%</strong></div><Progress value={program.progress} className="mt-2" /><p className="mt-2 text-xs text-muted-foreground">Capaian KPI: <strong className="text-foreground">{program.outcomeProgress}%</strong> · {outcomeLabels[program.outcomeStatus]}</p></td><td className="px-5 py-4"><div className="flex justify-end gap-1"><Button type="button" variant="ghost" size="icon-sm" onClick={() => setSelected(program)} aria-label={`Lihat detail ${program.title}`}><Eye /></Button>{canEditProgram(program) && <Button type="button" variant="ghost" size="icon-sm" onClick={() => openEdit(program)} aria-label={`Edit ${program.title}`}><Pencil /></Button>}{canDeleteProgram(program) && <Button type="button" variant="ghost" size="icon-sm" className="text-destructive hover:bg-rose-50 hover:text-destructive" onClick={() => setDeleteTarget(program)} aria-label={`Hapus ${program.title}`}><Trash2 /></Button>}</div></td></tr>)}</tbody></table></div>
        <div className="divide-y md:hidden">{filteredPrograms.map((program) => <article key={program.id} className="p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="font-mono text-xs font-bold text-primary">{program.programCode}</p><h2 className="mt-1 font-bold leading-5">{program.title}</h2></div><StatusBadge status={program.status} /></div><div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground"><Badge variant="secondary">{program.divisionCode}</Badge><span>{program.divisionName}</span><span>•</span><span>{program.pic || "PIC belum ditentukan"}</span></div><p className="mt-3 line-clamp-2 text-sm leading-5 text-muted-foreground">{program.summary || "Belum ada ringkasan."}</p><div className="mt-4"><div className="flex items-center justify-between text-xs"><span>{program.completedTaskCount}/{program.taskCount} pekerjaan selesai</span><strong>{program.progress}%</strong></div><Progress value={program.progress} className="mt-2" /><p className="mt-2 text-xs text-muted-foreground">Capaian KPI: <strong className="text-foreground">{program.outcomeProgress}%</strong> · {outcomeLabels[program.outcomeStatus]}</p></div><div className={`mt-4 grid gap-2 ${canEditProgram(program) && canDeleteProgram(program) ? "grid-cols-3" : canEditProgram(program) || canDeleteProgram(program) ? "grid-cols-2" : "grid-cols-1"}`}><Button type="button" variant="outline" size="sm" onClick={() => setSelected(program)}><Eye />Detail</Button>{canEditProgram(program) && <Button type="button" variant="outline" size="sm" onClick={() => openEdit(program)}><Pencil />Edit</Button>}{canDeleteProgram(program) && <Button type="button" variant="outline" size="sm" className="text-destructive" onClick={() => setDeleteTarget(program)}><Trash2 />Hapus</Button>}</div></article>)}</div>
      </>}
    </section>

    <Dialog open={formOpen} onOpenChange={(open) => { if (!saving) setFormOpen(open); }}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl"><form onSubmit={saveProgram}><DialogHeader><DialogTitle>{editing ? "Edit Program Kerja" : "Tambah Program Kerja"}</DialogTitle><DialogDescription>{editing ? `Perbarui data ${editing.programCode}.` : `Kode program dibuat otomatis mulai dari ${nextCode}.`}</DialogDescription></DialogHeader><div className="grid gap-4 py-5"><div className="grid gap-2"><Label htmlFor="program-title">Nama program</Label><Input id="program-title" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="Contoh: TDA Naik Kelas" required maxLength={160} /></div><div className="grid gap-4 sm:grid-cols-2"><div className="grid gap-2"><Label>Divisi</Label><Select value={form.divisionId} onValueChange={(value) => setForm({ ...form, divisionId: value })}><SelectTrigger className="w-full"><SelectValue placeholder="Pilih divisi" /></SelectTrigger><SelectContent>{manageableDivisions.map((division) => <SelectItem key={division.id} value={String(division.id)}>{division.name}</SelectItem>)}</SelectContent></Select></div><div className="grid gap-2"><Label>Status program</Label><Select value={form.status} disabled><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent>{statusOptions.map((status) => <SelectItem key={status.value} value={status.value}>{status.label}</SelectItem>)}</SelectContent></Select></div></div><div className="grid gap-4 sm:grid-cols-2"><div className="grid gap-2"><Label htmlFor="program-pic">PIC/Penanggung jawab</Label><Input id="program-pic" value={form.pic} onChange={(event) => setForm({ ...form, pic: event.target.value })} placeholder="Nama penanggung jawab" maxLength={100} /></div><div className="grid gap-2"><Label htmlFor="program-budget">Estimasi anggaran</Label><Input id="program-budget" type="number" min="0" step="1000" value={form.budget} onChange={(event) => setForm({ ...form, budget: event.target.value })} placeholder="0" /></div></div><div className="grid gap-4 sm:grid-cols-2"><div className="grid gap-2"><Label htmlFor="program-start">Tanggal mulai</Label><Input id="program-start" type="date" value={form.startDate} onChange={(event) => setForm({ ...form, startDate: event.target.value })} /></div><div className="grid gap-2"><Label htmlFor="program-end">Target selesai</Label><Input id="program-end" type="date" min={form.startDate || undefined} value={form.endDate} onChange={(event) => setForm({ ...form, endDate: event.target.value })} /></div></div><div className="grid gap-2"><Label htmlFor="program-target">Target/indikator keberhasilan</Label><Textarea id="program-target" value={form.target} onChange={(event) => setForm({ ...form, target: event.target.value })} placeholder="Contoh: 100 peserta hadir dan tingkat kepuasan minimal 85%" rows={3} maxLength={800} /></div><div className="grid gap-2"><Label htmlFor="program-summary">Ringkasan</Label><Textarea id="program-summary" value={form.summary} onChange={(event) => setForm({ ...form, summary: event.target.value })} placeholder="Tujuan dan gambaran singkat program kerja…" rows={4} maxLength={1000} /></div></div><DialogFooter><Button type="button" variant="outline" onClick={() => setFormOpen(false)} disabled={saving}>Batal</Button><Button type="submit" disabled={saving || !form.title.trim() || !form.divisionId}>{saving && <LoaderCircle className="animate-spin" />}{editing ? "Simpan Perubahan" : "Tambah Program"}</Button></DialogFooter></form></DialogContent></Dialog>

    <Sheet open={Boolean(selected)} onOpenChange={(open) => { if (!open) setSelected(null); }}><SheetContent className="w-full overflow-y-auto sm:max-w-[calc(100vw-2rem)] lg:left-0 lg:w-screen lg:max-w-none lg:border-l-0"><SheetHeader className="border-b p-6"><SheetTitle className="pr-8 text-xl">Detail Program Kerja</SheetTitle><SheetDescription>Informasi, target, anggaran, dan kontrol pelaksanaan program.</SheetDescription></SheetHeader>{selected && <div className="mx-auto w-full max-w-[1440px] space-y-6 p-6"><div><p className="font-mono text-sm font-bold text-primary">{selected.programCode}</p><h2 className="mt-2 text-2xl font-bold leading-tight">{selected.title}</h2><div className="mt-3 flex flex-wrap gap-2"><StatusBadge status={selected.status} /><Badge variant="secondary">{selected.divisionName}</Badge></div></div><div className="grid gap-3 sm:grid-cols-2"><div className="rounded-xl border bg-muted/30 p-4"><div className="flex items-center justify-between text-sm"><span className="font-semibold">Progres Pelaksanaan</span><strong>{selected.progress}%</strong></div><Progress value={selected.progress} className="mt-3" /><p className="mt-2 text-xs text-muted-foreground">{selected.completedTaskCount} dari {selected.taskCount} pekerjaan selesai</p></div><div className="rounded-xl border bg-emerald-50/40 p-4"><div className="flex items-center justify-between text-sm"><span className="font-semibold">Capaian KPI</span><strong>{selected.outcomeProgress}%</strong></div><Progress value={selected.outcomeProgress} className="mt-3" /><p className="mt-2 text-xs text-muted-foreground">{selected.achievedKpiCount} dari {selected.kpiCount} KPI tercapai · {outcomeLabels[selected.outcomeStatus]}</p></div></div><dl className="grid gap-4 rounded-xl border p-4 text-sm sm:grid-cols-2"><div><dt className="flex items-center gap-1.5 font-semibold text-muted-foreground"><UserRound className="size-4" />PIC</dt><dd className="mt-1 font-bold">{selected.pic || "Belum ditentukan"}</dd></div><div><dt className="flex items-center gap-1.5 font-semibold text-muted-foreground"><CalendarDays className="size-4" />Pelaksanaan</dt><dd className="mt-1 font-bold">{formatDay(selected.startDate)} — {formatDay(selected.endDate)}</dd></div><div><dt className="flex items-center gap-1.5 font-semibold text-muted-foreground"><Wallet className="size-4" />Estimasi Anggaran</dt><dd className="mt-1 font-bold">{formatMoney(selected.budget)}</dd></div><div><dt className="font-semibold text-muted-foreground">Periode Kepengurusan</dt><dd className="mt-1 font-bold">{selected.periodName}</dd></div><div className="sm:col-span-2"><dt className="flex items-center gap-1.5 font-semibold text-muted-foreground"><Target className="size-4" />Target/Indikator Keberhasilan</dt><dd className="mt-1 whitespace-pre-wrap leading-6">{selected.target || "Belum ditentukan."}</dd></div><div className="sm:col-span-2"><dt className="font-semibold text-muted-foreground">Ringkasan</dt><dd className="mt-1 whitespace-pre-wrap leading-6">{selected.summary || "Belum ada ringkasan."}</dd></div><div><dt className="font-semibold text-muted-foreground">Dibuat</dt><dd className="mt-1">{formatDate(selected.createdAt)}</dd></div><div><dt className="font-semibold text-muted-foreground">Diperbarui</dt><dd className="mt-1">{formatDate(selected.updatedAt)}</dd></div></dl><ProgramApproval programId={selected.id} status={selected.status} canManage={canManage(selected)} isKetua={access.user?.role === "ketua_ksb"} onChanged={() => { void loadPrograms(selected.id); onChanged(); }} /><ProgramTaskList programId={selected.id} divisions={divisions} canManage={canManageTasks(selected)} onChanged={() => { void loadPrograms(selected.id); onChanged(); }} /><ProgramEvaluation programId={selected.id} canManage={canManageTasks(selected)} onChanged={() => { void loadPrograms(selected.id); onChanged(); }} /><ProgramFeedback programId={selected.id} canManage={canManageTasks(selected)} />{(canEditProgram(selected) || canDeleteProgram(selected)) && <div className="flex flex-wrap gap-3 border-t pt-5">{canEditProgram(selected) && <Button type="button" variant="outline" className="flex-1" onClick={() => openEdit(selected)}><Pencil />Edit Program</Button>}{canDeleteProgram(selected) && <Button type="button" variant="outline" className="flex-1 text-destructive" onClick={() => { setDeleteTarget(selected); setSelected(null); }}><Trash2 />Hapus Program</Button>}</div>}</div>}</SheetContent></Sheet>

    <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => { if (!open && !deleting) setDeleteTarget(null); }}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Hapus program kerja?</AlertDialogTitle><AlertDialogDescription>Program <strong className="text-foreground">{deleteTarget?.title}</strong> beserta pekerjaan terkait akan dihapus permanen. Tindakan ini tidak dapat dibatalkan.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={deleting}>Batal</AlertDialogCancel><AlertDialogAction variant="destructive" onClick={(event) => { event.preventDefault(); void confirmDelete(); }} disabled={deleting}>{deleting && <LoaderCircle className="animate-spin" />}Hapus Program</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </>;
}
