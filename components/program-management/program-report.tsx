"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle, Banknote, CheckCircle2, ClipboardCheck, Download,
  LoaderCircle, Printer, Search, Target, TimerReset,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getCachedJson } from "@/lib/client-cache";

type ReportProgram = {
  id: number; programCode: string; divisionId: number; divisionCode: string; divisionName: string;
  title: string; pic: string; startDate: string; endDate: string; budget: number; status: string;
  taskCount: number; completedTaskCount: number; progress: number; overdueTaskCount: number; nearestDueDate: string;
  kpiCount: number; measuredKpiCount: number; achievedKpiCount: number; outcomeProgress: number; outcomeStatus: string;
};

type DivisionReport = {
  id: number; code: string; name: string; totalPrograms: number; approvedPrograms: number;
  totalTasks: number; completedTasks: number; overdueTasks: number; averageProgress: number; totalBudget: number;
  kpiCount: number; achievedKpiCount: number; averageOutcomeProgress: number;
};

type ReportData = {
  summary: {
    totalPrograms: number; totalBudget: number; averageProgress: number; totalTasks: number;
    completedTasks: number; overdueTasks: number; dueSoonTasks: number;
    kpiCount: number; achievedKpiCount: number; averageOutcomeProgress: number;
  };
  statuses: { status: string; total: number }[];
  divisions: DivisionReport[];
  programs: ReportProgram[];
  period: { name: string; startDate: string; endDate: string } | null;
  generatedAt: string;
};

const statusLabels: Record<string, string> = {
  draft: "Draft", pending_approval: "Menunggu Approval", approved: "Disetujui",
  revision_required: "Perlu Revisi", rejected: "Ditolak",
};

const statusTone: Record<string, string> = {
  draft: "bg-slate-100 text-slate-700", pending_approval: "bg-amber-100 text-amber-800",
  approved: "bg-emerald-100 text-emerald-800", revision_required: "bg-blue-100 text-blue-800",
  rejected: "bg-rose-100 text-rose-800",
};

const rupiah = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });
const dateFormat = new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", year: "numeric" });

function dateLabel(value: string) {
  if (!value) return "—";
  return dateFormat.format(new Date(`${value}T00:00:00Z`));
}

function csvCell(value: string | number) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

export default function ProgramReport({ onOpenProgram }: { onOpenProgram: (programId: number) => void }) {
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [division, setDivision] = useState("all");
  const [status, setStatus] = useState("all");

  useEffect(() => {
    let cancelled = false;
    getCachedJson<ReportData>("/api/program-management/reports", 60_000).then((payload) => {
      if (!cancelled) setData(payload);
    }).catch((reason) => {
      if (!cancelled) setError(reason instanceof Error ? reason.message : "Laporan belum dapat dimuat.");
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      void getCachedJson<ReportData>("/api/program-management/reports", 60_000, true)
        .then(setData).catch(() => undefined);
    }, 15_000);
    return () => window.clearInterval(interval);
  }, []);

  const filteredPrograms = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return (data?.programs ?? []).filter((program) =>
      (division === "all" || String(program.divisionId) === division) &&
      (status === "all" || program.status === status) &&
      (!keyword || [program.programCode, program.title, program.pic, program.divisionName]
        .some((value) => value.toLowerCase().includes(keyword)))
    );
  }, [data, division, query, status]);

  const exportCsv = () => {
    if (!data) return;
    const rows = [
      ["Kode", "Program Kerja", "Divisi", "PIC", "Status", "Mulai", "Selesai", "Progress", "Tugas Selesai", "Tugas Terlambat", "Capaian KPI", "KPI Tercapai", "Anggaran"],
      ...filteredPrograms.map((program) => [
        program.programCode, program.title, program.divisionName, program.pic,
        statusLabels[program.status] ?? program.status, program.startDate, program.endDate,
        `${program.progress}%`, `${program.completedTaskCount}/${program.taskCount}`,
        program.overdueTaskCount, `${program.outcomeProgress}%`, `${program.achievedKpiCount}/${program.kpiCount}`, program.budget,
      ]),
    ];
    const blob = new Blob(["\uFEFF" + rows.map((row) => row.map(csvCell).join(",")).join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `laporan-program-kerja-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <div className="grid min-h-72 place-items-center rounded-2xl border bg-white"><div className="text-center"><LoaderCircle className="mx-auto size-7 animate-spin text-primary" /><p className="mt-3 text-sm text-muted-foreground">Menyiapkan laporan…</p></div></div>;
  if (error || !data) return <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-800">{error || "Laporan belum tersedia."}</div>;

  const cards = [
    { label: "Total Program", value: data.summary.totalPrograms, icon: Target, tone: "bg-emerald-50 text-emerald-700" },
    { label: "Rata-rata Progres", value: `${data.summary.averageProgress}%`, icon: ClipboardCheck, tone: "bg-blue-50 text-blue-700" },
    { label: "Tugas Selesai", value: `${data.summary.completedTasks}/${data.summary.totalTasks}`, icon: CheckCircle2, tone: "bg-teal-50 text-teal-700" },
    { label: "Tugas Terlambat", value: data.summary.overdueTasks, icon: AlertTriangle, tone: "bg-rose-50 text-rose-700" },
    { label: "Tenggat 7 Hari", value: data.summary.dueSoonTasks, icon: TimerReset, tone: "bg-amber-50 text-amber-700" },
    { label: "Rata-rata Capaian KPI", value: `${data.summary.averageOutcomeProgress}%`, icon: Target, tone: "bg-lime-50 text-lime-700" },
    { label: "KPI Tercapai", value: `${data.summary.achievedKpiCount}/${data.summary.kpiCount}`, icon: CheckCircle2, tone: "bg-cyan-50 text-cyan-700" },
    { label: "Total Anggaran", value: rupiah.format(data.summary.totalBudget), icon: Banknote, tone: "bg-violet-50 text-violet-700", compact: true },
  ];

  return <div className="space-y-6 print:space-y-4">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div><p className="text-sm font-bold uppercase tracking-[0.16em] text-primary">Tahap 9</p><h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">Monitoring, Evaluasi & Laporan</h1><p className="mt-2 text-sm text-muted-foreground">{data.period?.name ?? "Periode aktif TDA Pekanbaru 9.0"}</p></div>
      <div className="grid grid-cols-2 gap-2 print:hidden sm:flex"><Button className="w-full sm:w-auto" variant="outline" onClick={() => window.print()}><Printer className="size-4" />Cetak</Button><Button className="w-full sm:w-auto" onClick={exportCsv}><Download className="size-4" />Ekspor CSV</Button></div>
    </div>

    <section className="grid grid-cols-2 gap-3 lg:grid-cols-4 xl:grid-cols-8">
      {cards.map(({ label, value, icon: Icon, tone, compact }) => <article key={label} className="rounded-2xl border bg-white p-4 shadow-sm"><div className={`grid size-10 place-items-center rounded-xl ${tone}`}><Icon className="size-5" /></div><p className={`mt-4 font-bold tabular-nums ${compact ? "text-base" : "text-2xl"}`}>{value}</p><p className="mt-1 text-sm font-medium text-muted-foreground">{label}</p></article>)}
    </section>

    <section className="rounded-2xl border bg-white shadow-sm">
      <div className="border-b px-5 py-4"><h2 className="font-bold">Pemantauan per Divisi</h2><p className="mt-1 text-sm text-muted-foreground">Progres pelaksanaan dari 9 divisi</p></div>
      <div className="grid gap-px bg-border sm:grid-cols-2 xl:grid-cols-3">
        {data.divisions.map((item) => <article key={item.id} className="bg-white p-4">
          <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold text-primary">{item.code}</p><h3 className="mt-1 font-semibold">{item.name}</h3></div><Badge variant="secondary">{item.totalPrograms} Program</Badge></div>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.min(100, item.averageProgress)}%` }} /></div>
          <div className="mt-2 flex justify-between text-xs text-muted-foreground"><span>Progres {item.averageProgress}%</span><span className={item.overdueTasks ? "font-semibold text-rose-600" : ""}>{item.overdueTasks} terlambat</span></div><div className="mt-3 flex items-center justify-between rounded-lg bg-emerald-50 px-3 py-2 text-xs"><span>Capaian KPI <strong>{item.averageOutcomeProgress}%</strong></span><span>{item.achievedKpiCount}/{item.kpiCount} tercapai</span></div>
        </article>)}
      </div>
    </section>

    <section className="rounded-2xl border bg-white shadow-sm">
      <div className="border-b p-4 sm:p-5">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between"><div><h2 className="font-bold">Rekap Program Kerja</h2><p className="mt-1 text-sm text-muted-foreground">{filteredPrograms.length} program sesuai filter</p></div>
          <div className="grid gap-2 sm:grid-cols-3 print:hidden">
            <div className="relative"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cari program atau PIC" className="pl-9" /></div>
            <select value={division} onChange={(event) => setDivision(event.target.value)} className="h-9 rounded-md border bg-transparent px-3 text-sm"><option value="all">Semua divisi</option>{data.divisions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
            <select value={status} onChange={(event) => setStatus(event.target.value)} className="h-9 rounded-md border bg-transparent px-3 text-sm"><option value="all">Semua status</option>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
          </div>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[920px] text-left text-sm">
          <thead className="bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="px-4 py-3">Program</th><th className="px-4 py-3">Divisi / PIC</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Tenggat</th><th className="px-4 py-3">Progres</th><th className="px-4 py-3">Capaian KPI</th><th className="px-4 py-3">Anggaran</th></tr></thead>
          <tbody className="divide-y">{filteredPrograms.map((program) => <tr key={program.id} className="hover:bg-muted/30"><td className="px-4 py-3"><button type="button" onClick={() => onOpenProgram(program.id)} className="text-left font-semibold hover:text-primary hover:underline">{program.title}</button><p className="mt-1 font-mono text-xs text-muted-foreground">{program.programCode}</p></td><td className="px-4 py-3"><p className="font-medium">{program.divisionName}</p><p className="mt-1 text-xs text-muted-foreground">{program.pic || "PIC belum ditentukan"}</p></td><td className="px-4 py-3"><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusTone[program.status] ?? "bg-muted"}`}>{statusLabels[program.status] ?? program.status}</span></td><td className="px-4 py-3"><p>{dateLabel(program.endDate)}</p>{program.overdueTaskCount > 0 && <p className="mt-1 text-xs font-semibold text-rose-600">{program.overdueTaskCount} tugas terlambat</p>}</td><td className="px-4 py-3"><div className="flex items-center gap-2"><div className="h-2 w-20 overflow-hidden rounded-full bg-muted"><div className="h-full bg-emerald-500" style={{ width: `${Math.min(100, program.progress)}%` }} /></div><span className="font-semibold tabular-nums">{program.progress}%</span></div><p className="mt-1 text-xs text-muted-foreground">{program.completedTaskCount}/{program.taskCount} tugas</p></td><td className="px-4 py-3"><div className="flex items-center gap-2"><div className="h-2 w-20 overflow-hidden rounded-full bg-muted"><div className="h-full bg-lime-500" style={{ width: `${Math.min(100, program.outcomeProgress)}%` }} /></div><span className="font-semibold tabular-nums">{program.outcomeProgress}%</span></div><p className="mt-1 text-xs text-muted-foreground">{program.achievedKpiCount}/{program.kpiCount} KPI</p></td><td className="px-4 py-3 font-medium">{rupiah.format(program.budget)}</td></tr>)}</tbody>
        </table>
        {filteredPrograms.length === 0 && <div className="p-10 text-center text-sm text-muted-foreground">Belum ada program yang sesuai dengan filter.</div>}
      </div>
    </section>
  </div>;
}
