"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { LoaderCircle, Pencil, Plus, ShieldCheck, Trash2, UserRound, UsersRound } from "lucide-react";
import { toast } from "sonner";
import type { AppAccess, UserRole } from "@/lib/access-types";
import { getCachedJson, invalidateClientCache } from "@/lib/client-cache";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

type Division = { id: number; code: string; name: string; sortOrder: number };
type ManagedUser = {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  divisionId: number | null;
  divisionName: string | null;
  isActive: boolean;
};

const roleLabels: Record<UserRole, string> = {
  ketua_ksb: "Ketua/KSB",
  bendahara: "Bendahara",
  kadiv: "Kadiv",
  viewer: "Viewer",
};
const emptyForm = { name: "", email: "", role: "viewer" as UserRole, divisionId: "", isActive: true };

export default function UserManagement({
  access, divisions, signInPath, signOutPath,
}: {
  access: AppAccess;
  divisions: Division[];
  signInPath: string;
  signOutPath: string;
}) {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(access.permissions.manageUsers);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ManagedUser | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ManagedUser | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function loadUsers() {
    if (!access.permissions.manageUsers) return;
    setLoading(true);
    try {
      const payload = await getCachedJson<{ users: ManagedUser[] }>("/api/users", 60_000, true);
      setUsers(payload.users);
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "Master Pengurus belum dapat dimuat.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!access.permissions.manageUsers) return;
    let cancelled = false;
    getCachedJson<{ users: ManagedUser[] }>("/api/users", 60_000).then((payload) => {
      if (!cancelled) setUsers(payload.users);
    }).catch((reason) => {
      if (!cancelled) toast.error(reason instanceof Error ? reason.message : "Master Pengurus belum dapat dimuat.");
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [access.permissions.manageUsers]);

  const activeCount = useMemo(() => users.filter((user) => user.isActive).length, [users]);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setFormOpen(true);
  }

  function openEdit(user: ManagedUser) {
    setEditing(user);
    setForm({
      name: user.name,
      email: user.email,
      role: user.role,
      divisionId: user.divisionId ? String(user.divisionId) : "",
      isActive: user.isActive,
    });
    setFormOpen(true);
  }

  async function saveUser(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      const response = await fetch(editing ? `/api/users/${editing.id}` : "/api/users", {
        method: editing ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...form, divisionId: form.divisionId ? Number(form.divisionId) : null }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error);
      invalidateClientCache("/api/users", "/api/program-management/bootstrap");
      setFormOpen(false);
      toast.success(editing ? "Data pengurus berhasil diperbarui." : "Pengurus berhasil ditambahkan.");
      await loadUsers();
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "Data pengurus belum dapat disimpan.");
    } finally {
      setSaving(false);
    }
  }

  async function deactivate() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const response = await fetch(`/api/users/${deleteTarget.id}`, { method: "DELETE" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error);
      invalidateClientCache("/api/users", "/api/program-management/bootstrap");
      setDeleteTarget(null);
      toast.success("Akses pengurus berhasil dinonaktifkan.");
      await loadUsers();
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "Akses pengurus belum dapat dinonaktifkan.");
    } finally {
      setDeleting(false);
    }
  }

  const identityName = access.user?.name || access.identity?.name || "Pengunjung";
  return <>
    <div className="mb-6"><p className="text-sm font-bold uppercase tracking-[0.16em] text-primary">Akun & Akses</p><h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">{access.permissions.manageUsers ? "Master Pengurus" : "Profil Hak Akses"}</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">Kelola siapa yang dapat mengubah program kerja TDA Pekanbaru 9.0 dan batas kewenangannya.</p></div>

    <section className="mb-5 flex flex-col gap-4 rounded-2xl border bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3"><div className="grid size-12 place-items-center rounded-2xl bg-secondary text-primary"><UserRound className="size-6" /></div><div><p className="font-bold">{identityName}</p><p className="text-sm text-muted-foreground">{access.identity?.email || "Belum masuk"}</p><div className="mt-2 flex flex-wrap gap-2">{access.user ? <><Badge>{roleLabels[access.user.role]}</Badge>{access.user.divisionName && <Badge variant="secondary">{access.user.divisionName}</Badge>}</> : <Badge variant="outline">{access.authenticated ? "Belum terdaftar" : "Mode baca"}</Badge>}</div></div></div>
      <Button asChild variant="outline"><a href={access.authenticated ? signOutPath : signInPath}>{access.authenticated ? "Keluar" : "Masuk dengan ChatGPT"}</a></Button>
    </section>

    {!access.authenticated && <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-900"><strong>Anda sedang menggunakan mode baca.</strong> Masuk dengan ChatGPT agar hak akses dapat dikenali.</section>}
    {access.authenticated && !access.registered && <section className="rounded-2xl border border-blue-200 bg-blue-50 p-5 text-sm leading-6 text-blue-900"><strong>Akun sudah masuk, tetapi belum terdaftar.</strong> Minta Ketua/KSB menambahkan email ini ke Master Pengurus.</section>}

    {access.permissions.manageUsers && <section className="overflow-hidden rounded-2xl border bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b p-5 sm:flex-row sm:items-center sm:justify-between"><div><div className="flex items-center gap-2"><UsersRound className="size-5 text-primary" /><h2 className="font-bold">Daftar Pengurus</h2></div><p className="mt-1 text-sm text-muted-foreground">{activeCount} akun aktif dari {users.length} akun terdaftar</p></div><Button type="button" onClick={openCreate}><Plus />Tambah Pengurus</Button></div>
      {loading ? <div className="flex min-h-48 items-center justify-center gap-2 text-sm text-muted-foreground"><LoaderCircle className="size-5 animate-spin" />Memuat pengurus…</div> : users.length === 0 ? <div className="grid min-h-48 place-items-center p-6 text-center"><div><ShieldCheck className="mx-auto size-8 text-primary" /><p className="mt-3 font-bold">Belum ada pengurus</p></div></div> : <div className="divide-y">{users.map((user) => <article key={user.id} className={`flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between ${user.isActive ? "" : "bg-muted/40 opacity-70"}`}><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="font-bold">{user.name}</p><Badge variant={user.isActive ? "secondary" : "outline"}>{user.isActive ? "Aktif" : "Nonaktif"}</Badge></div><p className="mt-1 truncate text-sm text-muted-foreground">{user.email}</p><div className="mt-2 flex flex-wrap gap-2"><Badge>{roleLabels[user.role]}</Badge>{user.divisionName && <Badge variant="outline">{user.divisionName}</Badge>}</div></div><div className="flex gap-2"><Button type="button" variant="outline" size="sm" onClick={() => openEdit(user)}><Pencil />Edit</Button>{user.isActive && user.id !== access.user?.id && <Button type="button" variant="outline" size="sm" className="text-destructive" onClick={() => setDeleteTarget(user)}><Trash2 />Nonaktifkan</Button>}</div></article>)}</div>}
    </section>}

    <Dialog open={formOpen} onOpenChange={(open) => { if (!saving) setFormOpen(open); }}><DialogContent><form onSubmit={saveUser}><DialogHeader><DialogTitle>{editing ? "Edit Pengurus" : "Tambah Pengurus"}</DialogTitle><DialogDescription>Email harus sama dengan email akun ChatGPT yang akan digunakan.</DialogDescription></DialogHeader><div className="grid gap-4 py-5"><div className="grid gap-2"><Label htmlFor="user-name">Nama lengkap</Label><Input id="user-name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required maxLength={120} /></div><div className="grid gap-2"><Label htmlFor="user-email">Email akun ChatGPT</Label><Input id="user-email" type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} required maxLength={180} /></div><div className="grid gap-4 sm:grid-cols-2"><div className="grid gap-2"><Label>Role</Label><Select value={form.role} onValueChange={(value) => setForm({ ...form, role: value as UserRole, divisionId: value === "kadiv" ? form.divisionId : "" })}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ketua_ksb">Ketua/KSB</SelectItem><SelectItem value="bendahara">Bendahara</SelectItem><SelectItem value="kadiv">Kadiv</SelectItem><SelectItem value="viewer">Viewer</SelectItem></SelectContent></Select></div><div className="grid gap-2"><Label>Divisi</Label><Select value={form.divisionId} onValueChange={(value) => setForm({ ...form, divisionId: value })} disabled={form.role !== "kadiv"}><SelectTrigger className="w-full"><SelectValue placeholder={form.role === "kadiv" ? "Pilih divisi" : "Tidak diperlukan"} /></SelectTrigger><SelectContent>{divisions.map((division) => <SelectItem key={division.id} value={String(division.id)}>{division.name}</SelectItem>)}</SelectContent></Select></div></div><div className="flex items-center justify-between rounded-xl border p-3"><div><Label htmlFor="user-active">Akun aktif</Label><p className="mt-1 text-xs text-muted-foreground">Akun nonaktif hanya dapat membaca data.</p></div><Switch id="user-active" checked={form.isActive} onCheckedChange={(checked) => setForm({ ...form, isActive: checked })} /></div></div><DialogFooter><Button type="button" variant="outline" onClick={() => setFormOpen(false)} disabled={saving}>Batal</Button><Button type="submit" disabled={saving || !form.name.trim() || !form.email.trim() || (form.role === "kadiv" && !form.divisionId)}>{saving && <LoaderCircle className="animate-spin" />}Simpan</Button></DialogFooter></form></DialogContent></Dialog>

    <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => { if (!open && !deleting) setDeleteTarget(null); }}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Nonaktifkan akses pengurus?</AlertDialogTitle><AlertDialogDescription><strong className="text-foreground">{deleteTarget?.name}</strong> tidak lagi dapat mengubah program kerja, tetapi riwayat dan datanya tetap tersimpan.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={deleting}>Batal</AlertDialogCancel><AlertDialogAction variant="destructive" onClick={(event) => { event.preventDefault(); void deactivate(); }} disabled={deleting}>{deleting && <LoaderCircle className="animate-spin" />}Nonaktifkan</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </>;
}
