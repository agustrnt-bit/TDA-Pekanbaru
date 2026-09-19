"use client";

import { useState } from "react";
import { AlertTriangle, CalendarDays, CheckCircle2, ChevronRight, MessageSquareText, Pencil, UserRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";

type Task = {
  id: number;
  category: string;
  title: string;
  pic: string;
  status: string;
  priority: string;
  dueDate: string;
  notes: string;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric", month: "short", year: "numeric", timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));
}

function statusClass(status: string) {
  if (status === "Selesai") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "Proses") return "border-blue-200 bg-blue-50 text-blue-700";
  if (status === "Tertunda") return "border-rose-200 bg-rose-50 text-rose-700";
  return "border-slate-200 bg-slate-50 text-slate-600";
}

export default function PicDashboard({ tasks, today, onEdit }: { tasks: Task[]; today: string; onEdit: (taskId: number) => void }) {
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const groups = Array.from(new Set(tasks.map((task) => task.pic.trim() || "Belum ditentukan")))
    .map((name) => {
      const items = tasks.filter((task) => (task.pic.trim() || "Belum ditentukan") === name);
      const done = items.filter((task) => task.status === "Selesai").length;
      const urgent = items.filter((task) => task.status !== "Selesai" && task.priority === "Tinggi" && task.dueDate <= today).length;
      return { name, items, total: items.length, done, urgent, progress: items.length ? Math.round((done / items.length) * 100) : 0 };
    })
    .sort((a, b) => (a.name === "Belum ditentukan" ? -1 : b.total - a.total));

  const selected = groups.find((group) => group.name === selectedName) ?? null;
  const categoryGroups = selected ? Array.from(new Set(selected.items.map((task) => task.category))).map((category) => {
    const items = selected.items.filter((task) => task.category === category);
    const done = items.filter((task) => task.status === "Selesai").length;
    return { category, items, done, progress: items.length ? Math.round((done / items.length) * 100) : 0 };
  }) : [];

  return (
    <>
      <section className="rounded-2xl border bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div><p className="text-sm font-medium text-muted-foreground">Kontrol penanggung jawab</p><h2 className="mt-1 text-xl font-bold">Progres per PIC</h2></div>
          <p className="text-sm text-muted-foreground">Klik nama untuk melihat rekap per kategori</p>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {groups.map((group) => (
            <button
              key={group.name}
              type="button"
              onClick={() => setSelectedName(group.name)}
              className={`group rounded-xl border p-4 text-left transition hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${group.name === "Belum ditentukan" ? "border-amber-200 bg-amber-50/70" : "bg-background/40"}`}
              aria-label={`Lihat rekap pekerjaan ${group.name}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                  <div className="grid size-9 shrink-0 place-items-center rounded-full bg-secondary text-secondary-foreground"><UserRound className="size-4" /></div>
                  <div className="min-w-0"><p className="truncate font-bold group-hover:text-primary">{group.name}</p><p className="text-xs text-muted-foreground">{group.done} dari {group.total} selesai</p></div>
                </div>
                <div className="flex items-center gap-1">
                  {group.urgent > 0 && <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-1 text-xs font-bold text-amber-800"><AlertTriangle className="size-3" />{group.urgent}</span>}
                  <ChevronRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
                </div>
              </div>
              <Progress value={group.progress} className="mt-4 h-2" aria-label={`Progres ${group.name} ${group.progress}%`} />
              <div className="mt-2 flex items-center justify-between text-xs"><span className="text-muted-foreground">Progres</span><span className="inline-flex items-center gap-1 font-bold tabular-nums">{group.progress === 100 && <CheckCircle2 className="size-3 text-emerald-600" />}{group.progress}%</span></div>
            </button>
          ))}
        </div>
      </section>

      <Dialog open={Boolean(selected)} onOpenChange={(open) => { if (!open) setSelectedName(null); }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-xl"><UserRound className="size-5 text-primary" />Rekap pekerjaan · {selected.name}</DialogTitle>
                <DialogDescription>{selected.done} dari {selected.total} pekerjaan selesai. Klik pekerjaan untuk langsung memperbarui datanya.</DialogDescription>
              </DialogHeader>

              <div className="rounded-xl border bg-muted/30 p-4">
                <div className="flex items-end justify-between gap-4"><div><p className="text-xs font-medium text-muted-foreground">Progres keseluruhan</p><p className="mt-1 text-3xl font-bold tabular-nums">{selected.progress}%</p></div>{selected.urgent > 0 && <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100"><AlertTriangle />{selected.urgent} urgent</Badge>}</div>
                <Progress value={selected.progress} className="mt-3 h-2.5" />
              </div>

              <div className="space-y-4">
                {categoryGroups.map((group) => (
                  <section key={group.category} className="overflow-hidden rounded-xl border">
                    <div className="bg-muted/40 px-4 py-3">
                      <div className="flex items-center justify-between gap-3"><div><h3 className="font-bold">{group.category}</h3><p className="text-xs text-muted-foreground">{group.done} dari {group.items.length} selesai</p></div><span className="text-sm font-bold tabular-nums text-primary">{group.progress}%</span></div>
                      <Progress value={group.progress} className="mt-2 h-1.5" />
                    </div>
                    <div className="divide-y">
                      {group.items.map((task) => {
                        const overdue = task.status !== "Selesai" && task.dueDate < today;
                        return (
                          <button
                            key={task.id}
                            type="button"
                            onClick={() => { setSelectedName(null); onEdit(task.id); }}
                            className="group/task block w-full p-4 text-left transition-colors hover:bg-emerald-50/60 focus-visible:bg-emerald-50/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
                            aria-label={`Edit pekerjaan ${task.title}`}
                          >
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                              <div className="min-w-0 flex-1"><p className="font-medium leading-5 group-hover/task:text-primary">{task.title}</p><div className="mt-2 flex flex-wrap items-center gap-2"><Badge variant="outline" className={statusClass(task.status)}>{task.status}</Badge><Badge variant="outline">{task.priority}</Badge></div>{task.notes && <div className="mt-2 flex gap-2 rounded-md bg-slate-50 px-2.5 py-2 text-xs text-muted-foreground"><MessageSquareText className="mt-0.5 size-3.5 shrink-0" /><span><span className="font-semibold text-foreground">Catatan:</span> {task.notes}</span></div>}</div>
                              <div className="flex shrink-0 items-center gap-3"><div className={`flex items-center gap-1.5 text-xs ${overdue ? "font-semibold text-rose-600" : "text-muted-foreground"}`}><CalendarDays className="size-3.5" />{formatDate(task.dueDate)}</div><Pencil className="size-3.5 text-muted-foreground group-hover/task:text-primary" /></div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </section>
                ))}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
