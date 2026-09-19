import { CheckCircle2, Pencil, Radio, UserRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Task = { id: number; categoryId: number; category: string; title: string; pic: string; dueDate: string; status: string; priority: string; notes: string; sortOrder: number };
const statuses = ["Belum Mulai", "Proses", "Selesai", "Tertunda"];

export default function HariHMode({ tasks, onStatus, onEdit }: { tasks: Task[]; onStatus: (task: Task, status: string) => void; onEdit: (task: Task) => void }) {
  const done = tasks.filter((task) => task.status === "Selesai").length;
  const progress = tasks.length ? Math.round((done / tasks.length) * 100) : 0;
  return (
    <section className="space-y-4">
      <div className="overflow-hidden rounded-2xl bg-[#153323] p-5 text-white shadow-sm sm:p-7">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div><div className="mb-2 inline-flex items-center gap-2 rounded-full bg-red-500/20 px-3 py-1 text-xs font-bold text-red-100"><Radio className="size-3.5" />MODE HARI-H</div><h2 className="text-2xl font-bold">Kendali pelaksanaan acara</h2><p className="mt-2 max-w-2xl text-sm text-emerald-100">Tampilan ringkas untuk panitia di lapangan. Perbarui status setiap tugas langsung setelah terlaksana.</p></div>
          <div className="min-w-44 rounded-xl bg-white/10 p-4 ring-1 ring-white/10"><p className="text-xs text-emerald-100">Progres Hari-H</p><p className="mt-1 text-3xl font-bold tabular-nums">{progress}%</p><Progress value={progress} className="mt-3 h-2 bg-white/20 [&_[data-slot=progress-indicator]]:bg-emerald-300" /></div>
        </div>
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        {tasks.map((task, index) => (
          <article key={task.id} className={`rounded-2xl border bg-white p-4 shadow-sm sm:p-5 ${task.status === "Selesai" ? "border-emerald-200" : task.status === "Tertunda" ? "border-rose-200" : ""}`}>
            <div className="flex items-start gap-3">
              <div className={`grid size-9 shrink-0 place-items-center rounded-full text-sm font-bold ${task.status === "Selesai" ? "bg-emerald-100 text-emerald-700" : "bg-secondary text-secondary-foreground"}`}>{task.status === "Selesai" ? <CheckCircle2 className="size-5" /> : index + 1}</div>
              <div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-2"><h3 className="font-bold leading-6">{task.title}</h3><Button variant="ghost" size="icon-sm" onClick={() => onEdit(task)} aria-label={`Edit ${task.title}`}><Pencil /></Button></div><div className="mt-2 flex flex-wrap items-center gap-2"><span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><UserRound className="size-3.5" />{task.pic || "PIC belum diisi"}</span><Badge variant="outline">{task.priority}</Badge></div>{task.notes && <p className="mt-3 rounded-lg bg-muted/70 p-2 text-xs text-muted-foreground">{task.notes}</p>}<Select value={task.status} onValueChange={(value) => onStatus(task, value)}><SelectTrigger className="mt-4 w-full"><SelectValue /></SelectTrigger><SelectContent>{statuses.map((status) => <SelectItem key={status} value={status}>{status}</SelectItem>)}</SelectContent></Select></div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
