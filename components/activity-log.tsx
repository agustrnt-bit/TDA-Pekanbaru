import { CheckCircle2, History, RotateCcw, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";

export type Activity = { id: number; taskId: number | null; taskTitle: string; action: string; description: string; actor: string; createdAt: string; undoneAt: string | null; canUndo: number };

function formatTime(value: string) {
  return new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" }).format(new Date(`${value.replace(" ", "T")}Z`));
}

export default function ActivityLog({ activities, actor, onEditActor, onUndo, undoing }: { activities: Activity[]; actor: string; onEditActor: () => void; onUndo: (id: number) => void; undoing: number | null }) {
  return (
    <section className="overflow-hidden rounded-2xl border bg-white shadow-sm">
      <div className="flex flex-col gap-4 border-b p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div><p className="text-sm font-medium text-muted-foreground">Jejak perubahan panitia</p><h2 className="mt-1 text-xl font-bold">Riwayat aktivitas</h2></div>
        <Button variant="outline" onClick={onEditActor}><UserRound />Nama saya: {actor}</Button>
      </div>
      {activities.length === 0 ? <div className="p-12 text-center"><History className="mx-auto mb-3 size-8 text-muted-foreground" /><p className="font-semibold">Belum ada aktivitas tercatat.</p><p className="mt-1 text-sm text-muted-foreground">Perubahan berikutnya akan otomatis muncul di sini.</p></div> : (
        <div className="divide-y">{activities.map((activity) => (
          <article key={activity.id} className="flex gap-3 p-4 sm:gap-4 sm:p-5">
            <div className={`grid size-9 shrink-0 place-items-center rounded-full ${activity.undoneAt ? "bg-slate-100 text-slate-500" : "bg-emerald-50 text-emerald-700"}`}>{activity.undoneAt ? <RotateCcw className="size-4" /> : <CheckCircle2 className="size-4" />}</div>
            <div className="min-w-0 flex-1"><div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between"><div><p className="font-semibold">{activity.description}</p>{activity.taskTitle && <p className="mt-0.5 text-sm text-muted-foreground">{activity.taskTitle}</p>}</div><span className="shrink-0 text-xs text-muted-foreground">{formatTime(activity.createdAt)}</span></div><div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground"><span className="inline-flex items-center gap-1"><UserRound className="size-3" />{activity.actor}</span>{activity.undoneAt && <span className="rounded-full bg-slate-100 px-2 py-0.5">Sudah dibatalkan</span>}</div></div>
            {activity.canUndo === 1 && <Button variant="outline" size="sm" onClick={() => onUndo(activity.id)} disabled={undoing === activity.id}><RotateCcw />{undoing === activity.id ? "Membatalkan…" : "Batalkan"}</Button>}
          </article>
        ))}</div>
      )}
    </section>
  );
}
