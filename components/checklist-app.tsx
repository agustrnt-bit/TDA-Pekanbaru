"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import {
  AlertTriangle, CalendarDays, Check, CheckCircle2, ChevronDown, ChevronRight, Clock3, Download,
  FolderPlus, History, LayoutDashboard, ListChecks, Pencil, Plus, Radio, Search,
  RefreshCw, Trash2, UserPlus, UserRound, UsersRound, Wifi, WifiOff,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Toaster } from "@/components/ui/sonner";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ActivityLog, { type Activity } from "@/components/activity-log";
import HariHMode from "@/components/hari-h-mode";
import PicDashboard from "@/components/pic-dashboard";

type Category = { id: number; name: string; sortOrder: number };
type Pic = { id: number; name: string };
type Task = {
  id: number; categoryId: number; category: string; title: string; pic: string;
  dueDate: string; priority: string; status: string; notes: string; sortOrder: number;
};
type Draft = Omit<Task, "id" | "category" | "sortOrder">;

const statuses = ["Belum Mulai", "Proses", "Selesai", "Tertunda"];
const priorities = ["Tinggi", "Sedang", "Rendah"];
const emptyDraft: Draft = {
  categoryId: 1, title: "", pic: "", dueDate: "2026-09-08",
  priority: "Sedang", status: "Belum Mulai", notes: "",
};

function formatDate(value: string) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })
    .format(new Date(`${value}T00:00:00Z`));
}

function getToday() {
  const parts = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: "Asia/Jakarta" })
    .formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function statusClass(status: string) {
  if (status === "Selesai") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "Proses") return "border-blue-200 bg-blue-50 text-blue-700";
  if (status === "Tertunda") return "border-rose-200 bg-rose-50 text-rose-700";
  return "border-slate-200 bg-slate-50 text-slate-600";
}

function priorityClass(priority: string) {
  if (priority === "Tinggi") return "border-amber-200 bg-amber-50 text-amber-800";
  if (priority === "Rendah") return "border-slate-200 bg-slate-50 text-slate-600";
  return "border-sky-200 bg-sky-50 text-sky-700";
}

export default function ChecklistApp() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [pics, setPics] = useState<Pic[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [picFilter, setPicFilter] = useState("");
  const [taskDialog, setTaskDialog] = useState(false);
  const [categoryDialog, setCategoryDialog] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [newCategory, setNewCategory] = useState("");
  const [newPic, setNewPic] = useState("");
  const [showPicRegistration, setShowPicRegistration] = useState(false);
  const [picQuery, setPicQuery] = useState("");
  const [picPickerOpen, setPicPickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [activeView, setActiveView] = useState("dashboard");
  const [activities, setActivities] = useState<Activity[]>([]);
  const [actor, setActor] = useState("Panitia");
  const [actorDraft, setActorDraft] = useState("Panitia");
  const [actorDialog, setActorDialog] = useState(false);
  const [undoing, setUndoing] = useState<number | null>(null);
  const [isOnline, setIsOnline] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const [externalUpdate, setExternalUpdate] = useState(false);
  const taskDialogRef = useRef(false);
  const syncInFlightRef = useRef(false);
  const today = getToday();

  async function loadData() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/tasks", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setTasks(data.tasks);
      setCategories(data.categories);
      setPics(data.pics ?? []);
      setLastSyncedAt(new Date());
      setIsOnline(true);
      if (data.categories.length) {
        setDraft((current) => data.categories.some((category: Category) => category.id === current.categoryId)
          ? current : { ...current, categoryId: data.categories[0].id });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Checklist belum dapat dimuat.");
    } finally {
      setLoading(false);
    }
  }

  async function loadActivities() {
    try {
      const response = await fetch("/api/activities", { cache: "no-store" });
      const data = await response.json();
      if (response.ok) setActivities(data.activities);
    } catch {
      // Riwayat tidak menghalangi checklist utama.
    }
  }

  useEffect(() => {
    taskDialogRef.current = taskDialog;
  }, [taskDialog]);

  useEffect(() => {
    let active = true;
    let initialized = false;
    let taskFingerprint = "";

    async function syncFromServer(showIndicator = false) {
      if (syncInFlightRef.current) return;
      syncInFlightRef.current = true;
      if (showIndicator && active) setSyncing(true);
      try {
        const [taskResponse, activityResponse] = await Promise.all([
          fetch("/api/tasks", { cache: "no-store" }),
          fetch("/api/activities", { cache: "no-store" }),
        ]);
        const data = await taskResponse.json();
        const activityData = await activityResponse.json();
        if (!taskResponse.ok) throw new Error(data.error);
        if (!active) return;

        const nextFingerprint = JSON.stringify({ tasks: data.tasks, categories: data.categories, pics: data.pics });
        if (initialized && nextFingerprint !== taskFingerprint && taskDialogRef.current) {
          setExternalUpdate(true);
        }
        taskFingerprint = nextFingerprint;
        initialized = true;

        setTasks(data.tasks);
        setCategories(data.categories);
        setPics(data.pics ?? []);
        if (activityResponse.ok) setActivities(activityData.activities);
        setLastSyncedAt(new Date());
        setIsOnline(true);
        setError("");
        if (data.categories.length) {
          setDraft((current) => data.categories.some((category: Category) => category.id === current.categoryId)
            ? current : { ...current, categoryId: data.categories[0].id });
        }
      } catch (err) {
        if (!active) return;
        setIsOnline(false);
        if (!initialized) setError(err instanceof Error ? err.message : "Checklist belum dapat dimuat.");
      } finally {
        syncInFlightRef.current = false;
        if (active) {
          setLoading(false);
          setSyncing(false);
        }
      }
    }

    const syncNow = () => void syncFromServer(false);
    const handleVisibility = () => { if (document.visibilityState === "visible") syncNow(); };
    const handleOnline = () => { setIsOnline(true); syncNow(); };
    const handleOffline = () => setIsOnline(false);

    queueMicrotask(() => {
      const savedActor = window.localStorage.getItem("sertinah-actor");
      if (savedActor && active) { setActor(savedActor); setActorDraft(savedActor); }
      void syncFromServer(true);
    });
    const interval = window.setInterval(syncNow, 3000);
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      active = false;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const stats = useMemo(() => {
    const total = tasks.length;
    const done = tasks.filter((task) => task.status === "Selesai").length;
    const process = tasks.filter((task) => task.status === "Proses").length;
    const urgent = tasks.filter((task) => task.status !== "Selesai" && task.dueDate <= today && task.priority === "Tinggi").length;
    return { total, done, process, urgent, progress: total ? Math.round((done / total) * 100) : 0 };
  }, [tasks, today]);

  const filtered = useMemo(() => tasks.filter((task) => {
    const term = search.toLowerCase();
    return (!term || `${task.title} ${task.notes}`.toLowerCase().includes(term))
      && (categoryFilter === "all" || String(task.categoryId) === categoryFilter)
      && (statusFilter === "all" || task.status === statusFilter)
      && (!picFilter || task.pic.toLowerCase().includes(picFilter.toLowerCase()));
  }), [tasks, search, categoryFilter, statusFilter, picFilter]);

  const categoryProgress = useMemo(() => categories.map((category) => {
    const items = tasks.filter((task) => task.categoryId === category.id);
    const done = items.filter((task) => task.status === "Selesai").length;
    return { ...category, total: items.length, done, percent: items.length ? Math.round((done / items.length) * 100) : 0 };
  }), [tasks, categories]);

  const matchingPics = useMemo(() => {
    const query = picQuery.trim().toLowerCase();
    return pics.filter((pic) => !query || pic.name.toLowerCase().includes(query)).slice(0, 10);
  }, [pics, picQuery]);

  function openNewTask() {
    setEditingId(null);
    setDraft({ ...emptyDraft, categoryId: categories[0]?.id ?? 1 });
    setExternalUpdate(false);
    setShowPicRegistration(false);
    setNewPic("");
    setPicQuery("");
    setPicPickerOpen(false);
    setTaskDialog(true);
  }

  function openEditTask(task: Task) {
    setEditingId(task.id);
    setDraft({ categoryId: task.categoryId, title: task.title, pic: task.pic, dueDate: task.dueDate,
      priority: task.priority, status: task.status, notes: task.notes });
    setExternalUpdate(false);
    setShowPicRegistration(false);
    setNewPic("");
    setPicQuery(task.pic);
    setPicPickerOpen(false);
    setTaskDialog(true);
  }

  async function syncNow() {
    setSyncing(true);
    await Promise.all([loadData(), loadActivities()]);
    setSyncing(false);
  }

  async function saveTask() {
    if (!draft.title.trim() || !draft.dueDate) {
      toast.error("Pekerjaan dan due date wajib diisi.");
      return;
    }
    if (picQuery.trim() && !draft.pic) {
      toast.error("Pilih nama PIC dari daftar yang muncul.");
      setPicPickerOpen(true);
      return;
    }
    setSaving(true);
    try {
      const url = editingId ? `/api/tasks/${editingId}` : "/api/tasks";
      const response = await fetch(url, { method: editingId ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...draft, actor }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setTaskDialog(false);
      setExternalUpdate(false);
      await loadData();
      await loadActivities();
      toast.success(editingId ? "Perubahan berhasil disimpan." : "Pekerjaan berhasil ditambahkan.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Perubahan belum dapat disimpan.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteCurrentTask() {
    if (!editingId) return;
    setDeleting(true);
    try {
      const response = await fetch(`/api/tasks/${editingId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actor }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setDeleteDialog(false);
      setTaskDialog(false);
      setExternalUpdate(false);
      await Promise.all([loadData(), loadActivities()]);
      toast.success("Pekerjaan dihapus. Anda dapat membatalkannya dari Aktivitas.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Pekerjaan belum dapat dihapus.");
    } finally {
      setDeleting(false);
    }
  }

  async function quickStatus(task: Task, status: string) {
    const original = tasks;
    setTasks((current) => current.map((item) => item.id === task.id ? { ...item, status } : item));
    try {
      const response = await fetch(`/api/tasks/${task.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status, actor }) });
      if (!response.ok) throw new Error();
      void loadActivities();
      toast.success("Status diperbarui.");
    } catch {
      setTasks(original);
      toast.error("Status belum dapat disimpan.");
    }
  }

  async function addCategory() {
    if (!newCategory.trim()) return;
    setSaving(true);
    try {
      const response = await fetch("/api/categories", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: newCategory, actor }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setCategories((current) => [...current, data.category]);
      setNewCategory("");
      void loadActivities();
      toast.success("Kategori berhasil ditambahkan.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Kategori belum dapat ditambahkan.");
    } finally {
      setSaving(false);
    }
  }

  async function addPic() {
    const name = newPic.trim().replace(/\s+/g, " ");
    if (name.length < 2) {
      toast.error("Nama PIC minimal 2 karakter.");
      return;
    }
    setSaving(true);
    try {
      const response = await fetch("/api/pics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, actor }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setPics((current) => [...current.filter((pic) => pic.id !== data.pic.id), data.pic]
        .sort((a, b) => a.name.localeCompare(b.name, "id")));
      setDraft((current) => ({ ...current, pic: data.pic.name }));
      setPicQuery(data.pic.name);
      setPicPickerOpen(false);
      setNewPic("");
      setShowPicRegistration(false);
      void loadActivities();
      toast.success(data.created ? "PIC berhasil didaftarkan dan dipilih." : "PIC sudah terdaftar dan langsung dipilih.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "PIC belum dapat didaftarkan.");
    } finally {
      setSaving(false);
    }
  }

  function exportCsv() {
    const columns = ["No", "Kategori", "Pekerjaan", "PIC", "Due Date", "Prioritas", "Status", "Catatan"];
    const rows = tasks.map((task, index) => [index + 1, task.category, task.title, task.pic, task.dueDate, task.priority, task.status, task.notes]);
    const csv = [columns, ...rows].map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\n");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" }));
    link.download = "checklist-sertinah-tda.csv";
    link.click();
    URL.revokeObjectURL(link.href);
  }

  function saveActor() {
    const name = actorDraft.trim() || "Panitia";
    setActor(name);
    setActorDraft(name);
    window.localStorage.setItem("sertinah-actor", name);
    setActorDialog(false);
    toast.success("Nama pengubah disimpan di perangkat ini.");
  }

  async function undoActivity(id: number) {
    setUndoing(id);
    try {
      const response = await fetch(`/api/activities/${id}/undo`, { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      await Promise.all([loadData(), loadActivities()]);
      toast.success("Perubahan berhasil dibatalkan.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Perubahan belum dapat dibatalkan.");
    } finally {
      setUndoing(null);
    }
  }

  return (
    <div className="min-h-screen pb-24 lg:pb-16">
      <Toaster richColors position="top-center" />
      <header className="relative overflow-hidden bg-[#12653b] text-white">
        <div className="absolute inset-y-0 right-0 hidden w-1/3 bg-[radial-gradient(circle_at_70%_30%,rgba(255,255,255,.18),transparent_55%)] lg:block" />
        <div className="relative mx-auto flex max-w-7xl flex-col gap-5 px-4 py-7 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:gap-4">
            <div className="h-14 w-36 shrink-0 overflow-hidden rounded-xl bg-white shadow-lg shadow-black/10 sm:h-16 sm:w-44">
              <Image
                src="/tda-pekanbaru.png"
                alt="Logo TDA Pekanbaru"
                width={176}
                height={132}
                priority
                className="h-[108px] w-36 -translate-y-[27px] object-contain sm:h-[132px] sm:w-44 sm:-translate-y-[34px]"
              />
            </div>
            <div>
              <p className="mb-1 text-xs font-bold uppercase tracking-[0.18em] text-emerald-100">Ruang kontrol panitia</p>
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Checklist SERTINAH</h1>
              <p className="mt-1 text-sm text-emerald-100">TDA Pekanbaru 9.0 · Let&apos;s Go Together</p>
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="flex items-center gap-3 rounded-2xl bg-white/10 px-4 py-3 ring-1 ring-white/15 backdrop-blur-sm">
              <CalendarDays className="size-5 text-emerald-100" aria-hidden="true" />
              <div><p className="text-xs text-emerald-100">Hari pelaksanaan</p><p className="font-bold">Rabu, 9 September 2026</p></div>
            </div>
            <Button
              variant="ghost"
              className="h-auto justify-start rounded-2xl bg-white/10 px-4 py-3 text-white ring-1 ring-white/15 hover:bg-white/20 hover:text-white"
              onClick={() => void syncNow()}
              disabled={syncing}
              aria-label="Sinkronkan data sekarang"
            >
              {isOnline ? <Wifi className="text-emerald-200" /> : <WifiOff className="text-rose-200" />}
              <span className="text-left">
                <span className="block text-xs font-normal text-emerald-100">{isOnline ? "Online · auto-sync 3 detik" : "Offline · data tetap tampil"}</span>
                <span className="flex items-center gap-1.5 font-semibold">
                  <RefreshCw className={`size-3.5 ${syncing ? "animate-spin" : ""}`} />
                  {syncing ? "Menyinkronkan…" : lastSyncedAt ? `Terbaru ${lastSyncedAt.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "Asia/Jakarta" })}` : "Sinkronkan sekarang"}
                </span>
              </span>
            </Button>
            <Button variant="secondary" className="h-auto rounded-2xl px-4 py-3" onClick={() => { setActorDraft(actor); setActorDialog(true); }}><UserRound />{actor}</Button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        <Tabs value={activeView} onValueChange={setActiveView}>
          <TabsList className="grid h-auto w-full grid-cols-3 p-1 sm:w-fit" aria-label="Mode tampilan">
            <TabsTrigger value="dashboard" className="py-2"><LayoutDashboard />Dashboard</TabsTrigger>
            <TabsTrigger value="hari-h" className="py-2"><Radio />Hari-H</TabsTrigger>
            <TabsTrigger value="activity" className="py-2"><History />Aktivitas</TabsTrigger>
          </TabsList>
        </Tabs>
        {error ? (
          <section className="rounded-2xl border border-rose-200 bg-white p-6 text-center shadow-sm">
            <AlertTriangle className="mx-auto mb-3 size-8 text-rose-500" />
            <p className="font-semibold">{error}</p><Button className="mt-4" onClick={loadData}>Coba lagi</Button>
          </section>
        ) : activeView === "dashboard" ? (
          <>
            <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label="Ringkasan progres">
              {[
                { label: "Total pekerjaan", value: stats.total, icon: ListChecks, tone: "text-emerald-700 bg-emerald-50" },
                { label: "Sudah selesai", value: stats.done, icon: CheckCircle2, tone: "text-teal-700 bg-teal-50" },
                { label: "Sedang proses", value: stats.process, icon: Clock3, tone: "text-blue-700 bg-blue-50" },
                { label: "Urgent hari ini", value: stats.urgent, icon: AlertTriangle, tone: "text-amber-700 bg-amber-50" },
              ].map(({ label, value, icon: Icon, tone }) => (
                <article key={label} className="rounded-2xl border bg-white p-5 shadow-sm">
                  <div className="flex items-center justify-between"><div className={`grid size-10 place-items-center rounded-xl ${tone}`}><Icon className="size-5" /></div><span className="text-3xl font-bold tabular-nums">{loading ? "—" : value}</span></div>
                  <p className="mt-3 text-sm font-medium text-muted-foreground">{label}</p>
                </article>
              ))}
            </section>

            <section className="grid gap-4 lg:grid-cols-[1.25fr_.75fr]">
              <article className="rounded-2xl border bg-white p-5 shadow-sm sm:p-6">
                <div className="flex items-end justify-between gap-4"><div><p className="text-sm font-medium text-muted-foreground">Progres keseluruhan</p><p className="mt-1 text-4xl font-bold tabular-nums">{stats.progress}%</p></div><p className="text-sm text-muted-foreground">{stats.done} dari {stats.total} selesai</p></div>
                <Progress value={stats.progress} className="mt-5 h-3" aria-label={`Progres keseluruhan ${stats.progress}%`} />
                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                  {categoryProgress.map((item) => (
                    <button key={item.id} onClick={() => setCategoryFilter(String(item.id))} className="group text-left" type="button">
                      <div className="mb-1.5 flex items-center justify-between gap-2"><span className="text-xs font-bold tracking-wide text-foreground">{item.name}</span><span className="text-xs tabular-nums text-muted-foreground">{item.done}/{item.total}</span></div>
                      <Progress value={item.percent} className="h-1.5 group-hover:bg-primary/25" />
                    </button>
                  ))}
                </div>
              </article>
              <article className="rounded-2xl border bg-[#153323] p-5 text-white shadow-sm sm:p-6">
                <p className="text-sm font-medium text-emerald-100">Fokus panitia</p>
                <h2 className="mt-2 text-xl font-bold">Tuntaskan yang prioritas tinggi lebih dulu.</h2>
                <p className="mt-3 text-sm leading-6 text-emerald-100">Isi PIC pada setiap pekerjaan, perbarui status setelah briefing, dan gunakan catatan untuk kendala atau keputusan rapat.</p>
                <div className="mt-5 flex items-center gap-2 text-sm font-semibold text-emerald-200"><UsersRound className="size-4" /> Data tersimpan dan siap dipantau bersama</div>
              </article>
            </section>

            <PicDashboard tasks={tasks} today={today} onEdit={(taskId) => {
              const task = tasks.find((item) => item.id === taskId);
              if (task) openEditTask(task);
            }} />

            <section className="overflow-hidden rounded-2xl border bg-white shadow-sm">
              <div className="border-b p-4 sm:p-5">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                  <div><h2 className="text-xl font-bold">Daftar pekerjaan</h2><p className="mt-1 text-sm text-muted-foreground">Menampilkan {filtered.length} dari {tasks.length} pekerjaan</p></div>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" onClick={() => setCategoryDialog(true)}><FolderPlus />Tambah kategori</Button>
                    <Button variant="outline" onClick={exportCsv}><Download />Ekspor CSV</Button>
                    <Button onClick={openNewTask}><Plus />Tambah pekerjaan</Button>
                  </div>
                </div>
                <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                  <label className="relative"><span className="sr-only">Cari pekerjaan</span><Search className="pointer-events-none absolute left-3 top-2.5 size-4 text-muted-foreground" /><Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari pekerjaan..." className="pl-9" /></label>
                  <Select value={categoryFilter} onValueChange={setCategoryFilter}><SelectTrigger className="w-full"><SelectValue placeholder="Semua kategori" /></SelectTrigger><SelectContent><SelectItem value="all">Semua kategori</SelectItem>{categories.map((category) => <SelectItem key={category.id} value={String(category.id)}>{category.name}</SelectItem>)}</SelectContent></Select>
                  <Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger className="w-full"><SelectValue placeholder="Semua status" /></SelectTrigger><SelectContent><SelectItem value="all">Semua status</SelectItem>{statuses.map((status) => <SelectItem key={status} value={status}>{status}</SelectItem>)}</SelectContent></Select>
                  <Input value={picFilter} onChange={(e) => setPicFilter(e.target.value)} placeholder="Filter PIC..." aria-label="Filter PIC" />
                </div>
                {(categoryFilter !== "all" || statusFilter !== "all" || search || picFilter) && <Button variant="ghost" size="sm" className="mt-3" onClick={() => { setCategoryFilter("all"); setStatusFilter("all"); setSearch(""); setPicFilter(""); }}>Reset filter</Button>}
              </div>

              {loading ? <div className="p-12 text-center text-muted-foreground">Memuat checklist…</div> : filtered.length === 0 ? <div className="p-12 text-center"><ListChecks className="mx-auto mb-3 size-8 text-muted-foreground" /><p className="font-semibold">Tidak ada pekerjaan yang cocok.</p><p className="mt-1 text-sm text-muted-foreground">Ubah filter atau tambahkan pekerjaan baru.</p></div> : (
                <>
                  <div className="hidden md:block">
                    <Table>
                      <TableHeader><TableRow><TableHead className="w-14 pl-5">No</TableHead><TableHead>Pekerjaan</TableHead><TableHead>PIC</TableHead><TableHead>Due date</TableHead><TableHead>Prioritas</TableHead><TableHead>Status</TableHead><TableHead className="w-14 pr-5"><span className="sr-only">Aksi</span></TableHead></TableRow></TableHeader>
                      <TableBody>{filtered.map((task) => {
                        const overdue = task.status !== "Selesai" && task.dueDate < today;
                        return <TableRow key={task.id}>
                          <TableCell className="pl-5 text-muted-foreground">{task.id}</TableCell>
                          <TableCell className="max-w-[410px] whitespace-normal py-4"><button type="button" className="text-left font-semibold hover:text-primary" onClick={() => openEditTask(task)}>{task.title}</button><div className="mt-1 flex flex-wrap gap-1.5"><Badge variant="secondary" className="text-[10px]">{task.category}</Badge>{task.notes && <span className="truncate text-xs text-muted-foreground">{task.notes}</span>}</div></TableCell>
                          <TableCell>{task.pic || <span className="text-muted-foreground">Belum diisi</span>}</TableCell>
                          <TableCell><span className={overdue ? "font-semibold text-rose-600" : ""}>{formatDate(task.dueDate)}</span></TableCell>
                          <TableCell><Badge variant="outline" className={priorityClass(task.priority)}>{task.priority}</Badge></TableCell>
                          <TableCell><Select value={task.status} onValueChange={(value) => void quickStatus(task, value)}><SelectTrigger size="sm" className={`w-[132px] border ${statusClass(task.status)}`}><SelectValue /></SelectTrigger><SelectContent>{statuses.map((status) => <SelectItem key={status} value={status}>{status}</SelectItem>)}</SelectContent></Select></TableCell>
                          <TableCell className="pr-5"><Button variant="ghost" size="icon-sm" onClick={() => openEditTask(task)} aria-label={`Edit ${task.title}`}><Pencil /></Button></TableCell>
                        </TableRow>;
                      })}</TableBody>
                    </Table>
                  </div>
                  <div className="divide-y md:hidden">{filtered.map((task) => {
                    const overdue = task.status !== "Selesai" && task.dueDate < today;
                    return <article key={task.id} className="p-4"><div className="flex items-start gap-3"><div className={`mt-1 grid size-7 shrink-0 place-items-center rounded-full text-xs font-bold ${task.status === "Selesai" ? "bg-emerald-100 text-emerald-700" : "bg-muted text-muted-foreground"}`}>{task.id}</div><div className="min-w-0 flex-1"><button type="button" className="text-left font-semibold leading-6" onClick={() => openEditTask(task)}>{task.title}</button><div className="mt-2 flex flex-wrap gap-1.5"><Badge variant="secondary" className="text-[10px]">{task.category}</Badge><Badge variant="outline" className={priorityClass(task.priority)}>{task.priority}</Badge></div><div className="mt-3 flex items-center justify-between gap-3"><div className="text-xs text-muted-foreground"><span className={overdue ? "font-semibold text-rose-600" : ""}>{formatDate(task.dueDate)}</span><span className="mx-1.5">·</span>{task.pic || "PIC belum diisi"}</div><Button variant="ghost" size="icon-sm" onClick={() => openEditTask(task)} aria-label={`Edit ${task.title}`}><ChevronRight /></Button></div><Select value={task.status} onValueChange={(value) => void quickStatus(task, value)}><SelectTrigger size="sm" className={`mt-3 w-full border ${statusClass(task.status)}`}><SelectValue /></SelectTrigger><SelectContent>{statuses.map((status) => <SelectItem key={status} value={status}>{status}</SelectItem>)}</SelectContent></Select></div></div></article>;
                  })}</div>
                </>
              )}
            </section>
          </>
        ) : activeView === "hari-h" ? (
          <HariHMode tasks={tasks.filter((task) => task.category === "HARI-H")} onStatus={(task, status) => void quickStatus(task, status)} onEdit={openEditTask} />
        ) : (
          <ActivityLog activities={activities} actor={actor} onEditActor={() => { setActorDraft(actor); setActorDialog(true); }} onUndo={(id) => void undoActivity(id)} undoing={undoing} />
        )}
      </div>

      <Dialog open={taskDialog} onOpenChange={(open) => { setTaskDialog(open); if (!open) setExternalUpdate(false); }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader><DialogTitle>{editingId ? "Edit pekerjaan" : "Tambah pekerjaan"}</DialogTitle><DialogDescription>Lengkapi penanggung jawab, target waktu, dan status pekerjaan.</DialogDescription></DialogHeader>
          {externalUpdate && (
            <div className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900" role="alert">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <p><span className="font-semibold">Ada perubahan dari panitia lain.</span> Isian Anda tidak ditimpa. Tutup lalu buka kembali form untuk mengambil data terbaru.</p>
            </div>
          )}
          <div className="grid gap-4 py-2">
            <label className="grid gap-1.5 text-sm font-medium">Pekerjaan<Input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="Tulis detail pekerjaan" /></label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-1.5 text-sm font-medium">Kategori<Select value={String(draft.categoryId)} onValueChange={(value) => setDraft({ ...draft, categoryId: Number(value) })}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent>{categories.map((category) => <SelectItem key={category.id} value={String(category.id)}>{category.name}</SelectItem>)}</SelectContent></Select></label>
              <div className="grid gap-1.5 text-sm font-medium">
                <span>PIC</span>
                <div className="flex gap-2">
                  <div
                    className="relative min-w-0 flex-1"
                    onBlur={(event) => {
                      if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setPicPickerOpen(false);
                    }}
                  >
                    <div className="relative">
                      <Input
                        value={picQuery}
                        onFocus={() => setPicPickerOpen(true)}
                        onChange={(event) => {
                          const value = event.target.value;
                          setPicQuery(value);
                          setPicPickerOpen(true);
                          if (value.trim().toLowerCase() !== draft.pic.toLowerCase()) {
                            setDraft((current) => ({ ...current, pic: "" }));
                          }
                        }}
                        placeholder="Ketik 1–2 huruf nama…"
                        className="pr-9"
                        role="combobox"
                        aria-expanded={picPickerOpen}
                        aria-controls="pic-options"
                        autoComplete="off"
                      />
                      <ChevronDown className="pointer-events-none absolute right-3 top-2.5 size-4 text-muted-foreground" />
                    </div>
                    {picPickerOpen && (
                      <div id="pic-options" role="listbox" className="absolute left-0 right-0 top-[calc(100%+6px)] z-[60] max-h-56 overflow-y-auto rounded-lg border bg-white p-1 shadow-lg">
                        {matchingPics.length ? matchingPics.map((pic) => (
                          <button
                            key={pic.id}
                            type="button"
                            role="option"
                            aria-selected={draft.pic === pic.name}
                            onClick={() => {
                              setDraft((current) => ({ ...current, pic: pic.name }));
                              setPicQuery(pic.name);
                              setPicPickerOpen(false);
                            }}
                            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-emerald-50 focus:bg-emerald-50 focus:outline-none"
                          >
                            <UserRound className="size-4 text-emerald-700" />
                            <span className="flex-1">{pic.name}</span>
                            {draft.pic === pic.name && <Check className="size-4 text-emerald-700" />}
                          </button>
                        )) : (
                          <div className="px-3 py-3 text-center text-sm text-muted-foreground">Nama belum terdaftar. Gunakan tombol orang +.</div>
                        )}
                      </div>
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => setShowPicRegistration((current) => !current)}
                    aria-label="Daftarkan PIC baru"
                    title="Daftarkan PIC baru"
                  ><UserPlus /></Button>
                </div>
                <span className="text-xs font-normal text-muted-foreground">Pilih nama tersimpan agar tidak terjadi perbedaan penulisan.</span>
              </div>
              {showPicRegistration && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 sm:col-span-2">
                  <p className="mb-2 text-sm font-semibold text-emerald-900">Daftarkan PIC baru</p>
                  <div className="flex gap-2">
                    <Input
                      value={newPic}
                      onChange={(event) => setNewPic(event.target.value)}
                      placeholder="Nama lengkap PIC"
                      className="bg-white"
                      onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void addPic(); } }}
                    />
                    <Button type="button" onClick={() => void addPic()} disabled={saving || newPic.trim().length < 2}>Daftarkan</Button>
                  </div>
                </div>
              )}
              <label className="grid gap-1.5 text-sm font-medium">Due date<Input type="date" value={draft.dueDate} onChange={(e) => setDraft({ ...draft, dueDate: e.target.value })} /></label>
              <label className="grid gap-1.5 text-sm font-medium">Prioritas<Select value={draft.priority} onValueChange={(value) => setDraft({ ...draft, priority: value })}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent>{priorities.map((priority) => <SelectItem key={priority} value={priority}>{priority}</SelectItem>)}</SelectContent></Select></label>
              <label className="grid gap-1.5 text-sm font-medium sm:col-span-2">Status<Select value={draft.status} onValueChange={(value) => setDraft({ ...draft, status: value })}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent>{statuses.map((status) => <SelectItem key={status} value={status}>{status}</SelectItem>)}</SelectContent></Select></label>
            </div>
            <label className="grid gap-1.5 text-sm font-medium">Catatan<Textarea value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} placeholder="Kendala, keputusan rapat, atau informasi tambahan" /></label>
          </div>
          <DialogFooter className="sm:justify-between">
            {editingId ? <Button type="button" variant="destructive" onClick={() => setDeleteDialog(true)} disabled={saving}><Trash2 />Hapus pekerjaan</Button> : <span />}
            <div className="flex flex-col-reverse gap-2 sm:flex-row"><Button variant="outline" onClick={() => setTaskDialog(false)}>Batal</Button><Button onClick={() => void saveTask()} disabled={saving}>{saving ? "Menyimpan…" : "Simpan pekerjaan"}</Button></div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialog} onOpenChange={setDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus pekerjaan ini?</AlertDialogTitle>
            <AlertDialogDescription>“{draft.title}” akan hilang dari checklist dan rekap PIC. Penghapusan tercatat di Aktivitas dan dapat dibatalkan dari sana.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Batal</AlertDialogCancel>
            <AlertDialogAction variant="destructive" disabled={deleting} onClick={(event) => { event.preventDefault(); void deleteCurrentTask(); }}><Trash2 />{deleting ? "Menghapus…" : "Ya, hapus"}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={categoryDialog} onOpenChange={setCategoryDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Tambah kategori</DialogTitle><DialogDescription>Kategori baru akan tersedia di filter dan form pekerjaan.</DialogDescription></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="flex gap-2"><Input value={newCategory} onChange={(e) => setNewCategory(e.target.value)} placeholder="Contoh: SPONSORSHIP" onKeyDown={(e) => { if (e.key === "Enter") void addCategory(); }} /><Button onClick={() => void addCategory()} disabled={saving || !newCategory.trim()}>Tambah</Button></div>
            <div className="flex flex-wrap gap-2">{categories.map((category) => <Badge key={category.id} variant="secondary">{category.name}</Badge>)}</div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setCategoryDialog(false)}>Selesai</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={actorDialog} onOpenChange={setActorDialog}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Nama pengubah</DialogTitle><DialogDescription>Bukan login. Nama ini hanya dipakai pada riwayat aktivitas dan disimpan di perangkat ini.</DialogDescription></DialogHeader>
          <label className="grid gap-1.5 py-2 text-sm font-medium">Nama Anda<Input value={actorDraft} onChange={(event) => setActorDraft(event.target.value)} placeholder="Contoh: Agus" onKeyDown={(event) => { if (event.key === "Enter") saveActor(); }} /></label>
          <DialogFooter><Button variant="outline" onClick={() => setActorDialog(false)}>Batal</Button><Button onClick={saveActor}>Simpan nama</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
