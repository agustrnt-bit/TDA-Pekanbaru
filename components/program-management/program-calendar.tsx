"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CalendarDays, ChevronDown, ChevronLeft, ChevronRight, CircleDot, Clock3, Eye, LoaderCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getCachedJson } from "@/lib/client-cache";

type Division = { id: number; code: string; name: string; sortOrder: number };
type ProgramStatus = "draft" | "pending_approval" | "approved" | "revision_required" | "rejected";
type TaskStatus = "belum_mulai" | "proses" | "selesai" | "tertunda";
type CalendarEvent = {
  id: string;
  type: "program_start" | "program_end" | "task_due";
  date: string;
  title: string;
  programId: number;
  programCode: string;
  programTitle: string;
  divisionId: number;
  divisionCode: string;
  divisionName: string;
  programStatus: ProgramStatus;
  taskStatus: TaskStatus | null;
};

const weekdays = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];
const statusOptions: { value: ProgramStatus; label: string }[] = [
  { value: "draft", label: "Draft" },
  { value: "pending_approval", label: "Menunggu Approval" },
  { value: "approved", label: "Disetujui" },
  { value: "revision_required", label: "Perlu Revisi" },
  { value: "rejected", label: "Ditolak" },
];
const eventConfig = {
  program_start: { label: "Mulai Program", dot: "bg-emerald-500", chip: "bg-emerald-50 text-emerald-800 border-emerald-200" },
  program_end: { label: "Target Selesai", dot: "bg-blue-500", chip: "bg-blue-50 text-blue-800 border-blue-200" },
  task_due: { label: "Due Date Pekerjaan", dot: "bg-amber-500", chip: "bg-amber-50 text-amber-800 border-amber-200" },
};
const taskStatusLabels: Record<TaskStatus, string> = { belum_mulai: "Belum Mulai", proses: "Proses", selesai: "Selesai", tertunda: "Tertunda" };

function jakartaToday() {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function shiftMonth(month: string, amount: number) {
  const [year, monthNumber] = month.split("-").map(Number);
  return new Date(Date.UTC(year, monthNumber - 1 + amount, 1)).toISOString().slice(0, 7);
}

function monthDays(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  const first = new Date(Date.UTC(year, monthNumber - 1, 1));
  const offset = (first.getUTCDay() + 6) % 7;
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(Date.UTC(year, monthNumber - 1, 1 - offset + index));
    return { key: date.toISOString().slice(0, 10), day: date.getUTCDate(), current: date.getUTCMonth() === monthNumber - 1 };
  });
}

function addDays(date: string, amount: number) {
  const next = new Date(`${date}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + amount);
  return next.toISOString().slice(0, 10);
}

function dayLabel(value: string) {
  return new Intl.DateTimeFormat("id-ID", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Jakarta" }).format(new Date(`${value}T12:00:00+07:00`));
}

export default function ProgramCalendar({ divisions, onOpenProgram }: { divisions: Division[]; onOpenProgram: (programId: number) => void }) {
  const today = jakartaToday();
  const [month, setMonth] = useState(today.slice(0, 7));
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [divisionFilter, setDivisionFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    let cancelled = false;
    getCachedJson<{ events: CalendarEvent[] }>(`/api/program-management/calendar?month=${month}`, 60_000).then((payload) => {
      if (!cancelled) setEvents(payload.events);
    }).catch((reason) => {
      if (!cancelled) setError(reason instanceof Error ? reason.message : "Agenda program belum dapat dimuat.");
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [month]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      void getCachedJson<{ events: CalendarEvent[] }>(`/api/program-management/calendar?month=${month}`, 60_000, true)
        .then((payload) => setEvents(payload.events)).catch(() => undefined);
    }, 15_000);
    return () => window.clearInterval(interval);
  }, [month]);

  const filtered = useMemo(() => events.filter((event) => {
    const divisionMatch = divisionFilter === "all" || String(event.divisionId) === divisionFilter;
    const statusMatch = statusFilter === "all" || event.programStatus === statusFilter;
    return divisionMatch && statusMatch;
  }), [divisionFilter, events, statusFilter]);
  const calendarDays = useMemo(() => monthDays(month), [month]);
  const monthEvents = useMemo(() => filtered.filter((event) => event.date.startsWith(month)), [filtered, month]);
  const monthPrograms = useMemo(() => {
    const grouped = new Map<number, { programId: number; programCode: string; programTitle: string; divisionName: string; events: CalendarEvent[] }>();
    for (const event of monthEvents) {
      const current = grouped.get(event.programId) ?? { programId: event.programId, programCode: event.programCode, programTitle: event.programTitle, divisionName: event.divisionName, events: [] };
      current.events.push(event);
      grouped.set(event.programId, current);
    }
    return Array.from(grouped.values()).sort((left, right) => left.events[0].date.localeCompare(right.events[0].date) || left.programCode.localeCompare(right.programCode));
  }, [monthEvents]);
  const eventsByDay = useMemo(() => {
    const grouped = new Map<string, CalendarEvent[]>();
    for (const event of filtered) grouped.set(event.date, [...(grouped.get(event.date) ?? []), event]);
    return grouped;
  }, [filtered]);
  const overdue = filtered.filter((event) => event.type === "task_due" && event.taskStatus !== "selesai" && event.date < today).length;
  const dueToday = filtered.filter((event) => event.date === today && event.taskStatus !== "selesai").length;
  const nextWeek = filtered.filter((event) => event.date > today && event.date <= addDays(today, 7) && event.taskStatus !== "selesai").length;
  const monthLabel = new Intl.DateTimeFormat("id-ID", { month: "long", year: "numeric", timeZone: "Asia/Jakarta" }).format(new Date(`${month}-01T12:00:00+07:00`));

  return <>
    <div className="mb-6"><p className="text-sm font-bold uppercase tracking-[0.16em] text-primary">Kalender</p><h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">Kalender Program & Tenggat</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">Pantau jadwal program dan due date pekerjaan TDA Pekanbaru 9.0 periode 2026–2029.</p></div>

    <section className="mb-5 grid gap-3 sm:grid-cols-3"><article className="rounded-2xl border border-rose-200 bg-rose-50 p-4"><div className="flex items-center justify-between"><div><p className="text-sm font-semibold text-rose-800">Terlambat</p><p className="mt-1 text-3xl font-bold text-rose-900">{loading ? "—" : overdue}</p></div><AlertTriangle className="size-6 text-rose-600" /></div></article><article className="rounded-2xl border border-amber-200 bg-amber-50 p-4"><div className="flex items-center justify-between"><div><p className="text-sm font-semibold text-amber-800">Hari Ini</p><p className="mt-1 text-3xl font-bold text-amber-900">{loading ? "—" : dueToday}</p></div><CircleDot className="size-6 text-amber-600" /></div></article><article className="rounded-2xl border border-blue-200 bg-blue-50 p-4"><div className="flex items-center justify-between"><div><p className="text-sm font-semibold text-blue-800">7 Hari ke Depan</p><p className="mt-1 text-3xl font-bold text-blue-900">{loading ? "—" : nextWeek}</p></div><Clock3 className="size-6 text-blue-600" /></div></article></section>

    <section className="rounded-2xl border bg-white p-4 shadow-sm sm:p-5"><div className="grid gap-3 lg:grid-cols-[1fr_220px_220px]"><div className="flex items-center justify-between rounded-xl bg-muted/50 p-1"><Button type="button" variant="ghost" size="icon-sm" onClick={() => setMonth(shiftMonth(month, -1))} aria-label="Bulan sebelumnya"><ChevronLeft /></Button><div className="text-center"><p className="font-bold capitalize">{monthLabel}</p><button type="button" className="text-xs font-semibold text-primary hover:underline" onClick={() => setMonth(today.slice(0, 7))}>Kembali ke bulan ini</button></div><Button type="button" variant="ghost" size="icon-sm" onClick={() => setMonth(shiftMonth(month, 1))} aria-label="Bulan berikutnya"><ChevronRight /></Button></div><Select value={divisionFilter} onValueChange={setDivisionFilter}><SelectTrigger className="w-full"><SelectValue placeholder="Semua divisi" /></SelectTrigger><SelectContent><SelectItem value="all">Semua divisi</SelectItem>{divisions.map((division) => <SelectItem key={division.id} value={String(division.id)}>{division.name}</SelectItem>)}</SelectContent></Select><Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger className="w-full"><SelectValue placeholder="Semua status" /></SelectTrigger><SelectContent><SelectItem value="all">Semua status</SelectItem>{statusOptions.map((status) => <SelectItem key={status.value} value={status.value}>{status.label}</SelectItem>)}</SelectContent></Select></div><div className="mt-4 flex flex-wrap gap-3 border-t pt-4 text-xs text-muted-foreground">{Object.entries(eventConfig).map(([key, config]) => <span key={key} className="flex items-center gap-1.5"><span className={`size-2 rounded-full ${config.dot}`} />{config.label}</span>)}</div></section>

    {error && <div className="mt-5 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{error}</div>}

    <section className="mt-5 hidden overflow-hidden rounded-2xl border bg-white shadow-sm md:block"><div className="grid grid-cols-7 border-b bg-muted/50">{weekdays.map((day) => <div key={day} className="px-2 py-3 text-center text-xs font-bold uppercase tracking-wide text-muted-foreground">{day}</div>)}</div>{loading ? <div className="flex min-h-96 items-center justify-center gap-2 text-sm text-muted-foreground"><LoaderCircle className="size-5 animate-spin" />Memuat kalender…</div> : <div className="grid grid-cols-7">{calendarDays.map((day) => { const dayEvents = eventsByDay.get(day.key) ?? []; return <div key={day.key} className={`min-h-32 border-b border-r p-2 ${day.current ? "bg-white" : "bg-muted/20"} ${day.key === today ? "ring-2 ring-inset ring-primary/40" : ""}`}><div className="flex items-center justify-between"><span className={`grid size-7 place-items-center rounded-full text-xs font-bold ${day.key === today ? "bg-primary text-primary-foreground" : day.current ? "" : "text-muted-foreground"}`}>{day.day}</span>{dayEvents.length > 3 && <span className="text-[11px] text-muted-foreground">+{dayEvents.length - 3}</span>}</div><div className="mt-1 space-y-1">{dayEvents.slice(0, 3).map((event) => <button key={event.id} type="button" onClick={() => onOpenProgram(event.programId)} className={`block w-full truncate rounded border px-1.5 py-1 text-left text-[11px] font-semibold hover:brightness-95 ${eventConfig[event.type].chip}`} title={`${eventConfig[event.type].label}: ${event.title}`}>{event.type === "task_due" ? event.title : event.programTitle}</button>)}</div></div>; })}</div>}</section>

    <section className="mt-5 overflow-hidden rounded-2xl border bg-white shadow-sm">
      <div className="border-b p-4 sm:p-5">
        <div className="flex items-center gap-2"><CalendarDays className="size-5 text-primary" /><h2 className="font-bold capitalize">Program Kerja {monthLabel}</h2></div>
        <p className="mt-1 text-sm text-muted-foreground">{monthPrograms.length} program kerja · klik program untuk melihat due date pekerjaan</p>
      </div>
      {loading ? <div className="flex min-h-40 items-center justify-center gap-2 text-sm text-muted-foreground"><LoaderCircle className="size-5 animate-spin" />Memuat agenda…</div> : monthPrograms.length === 0 ? <div className="grid min-h-40 place-items-center p-6 text-center"><div><CalendarDays className="mx-auto size-8 text-primary" /><p className="mt-3 font-bold">Belum ada program pada bulan ini</p><p className="mt-1 text-sm text-muted-foreground">Pilih bulan lain atau ubah filter.</p></div></div> : <div className="divide-y">{monthPrograms.map((program) => {
        const tasks = program.events.filter((event) => event.type === "task_due");
        const lateTasks = tasks.filter((event) => event.taskStatus !== "selesai" && event.date < today).length;
        const firstDate = program.events[0].date;
        const lastDate = program.events[program.events.length - 1].date;
        return <Collapsible key={program.programId}>
          <CollapsibleTrigger className="group flex w-full items-start gap-3 p-4 text-left hover:bg-muted/30 sm:items-center sm:px-5">
            <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-secondary text-primary"><CalendarDays className="size-5" /></div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2"><span className="font-mono text-xs font-bold text-primary">{program.programCode}</span><Badge variant="secondary">{program.divisionName}</Badge>{lateTasks > 0 && <Badge variant="destructive">{lateTasks} terlambat</Badge>}</div>
              <h3 className="mt-1 font-bold leading-5">{program.programTitle}</h3>
              <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground"><span>{tasks.length} due date pekerjaan</span><span>{firstDate === lastDate ? dayLabel(firstDate) : `${dayLabel(firstDate)} – ${dayLabel(lastDate)}`}</span></div>
            </div>
            <span className="mt-1 flex shrink-0 items-center gap-1 text-xs font-semibold text-primary sm:mt-0"><span className="hidden sm:inline">Lihat jadwal</span><ChevronDown className="size-5 transition-transform group-data-[state=open]:rotate-180" /></span>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="border-t bg-muted/20 px-4 pb-4 pt-3 sm:px-5">
              <p className="mb-3 text-xs font-bold uppercase tracking-wide text-muted-foreground">Jadwal bulan ini</p>
              <div className="grid gap-2 lg:grid-cols-2">{program.events.map((event) => {
                const config = eventConfig[event.type];
                const isOverdue = event.type === "task_due" && event.taskStatus !== "selesai" && event.date < today;
                return <div key={event.id} className="rounded-xl border bg-white p-3"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><Badge variant="outline" className={config.chip}>{config.label}</Badge>{isOverdue && <Badge variant="destructive">Terlambat</Badge>}{event.taskStatus && <Badge variant="secondary">{taskStatusLabels[event.taskStatus]}</Badge>}</div><p className="mt-2 font-semibold leading-5">{event.title}</p></div><div className="shrink-0 text-right"><p className="text-lg font-bold">{event.date.slice(8, 10)}</p><p className="text-xs text-muted-foreground">{monthLabel.split(" ")[0].slice(0, 3)}</p></div></div></div>;
              })}</div>
              <Button type="button" variant="outline" className="mt-3 w-full sm:w-auto" onClick={() => onOpenProgram(program.programId)}><Eye />Lihat Detail Program</Button>
            </div>
          </CollapsibleContent>
        </Collapsible>;
      })}</div>}
    </section>
  </>;
}
