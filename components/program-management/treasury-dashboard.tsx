"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { ArrowDownLeft, ArrowRightLeft, ArrowUpRight, Banknote, Check, ExternalLink, Landmark, LoaderCircle, Pencil, Plus, Search, Settings2, Tag, Trash2, WalletCards, X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { getCachedJson } from "@/lib/client-cache";

type Account = { id: number; code: string; name: string; type: "bank" | "cash"; bankName: string; accountNumber: string; accountHolder: string; openingBalance: number; balance: number; totalIncome: number; totalExpense: number };
type Mutation = { key: string; sourceType: string; sourceId: number; accountId: number; direction: "income" | "expense"; transactionDate: string; description: string; category: string; amount: number; programCode: string | null; programTitle: string | null; createdByName: string; transferGroup: string | null };
type TreasuryCategory = { id: number; name: string; sortOrder: number };
type PendingPayment = { participantId: number; participantName: string; eventName: string; amount: number; method: string; accountId: number; paidAt: string; note: string; proofAvailable: number; receivedByName: string };
type TreasuryData = { accounts: Account[]; categories: TreasuryCategory[]; mutations: Mutation[]; pendingPayments: PendingPayment[]; summary: { openingBalance: number; totalIncome: number; totalExpense: number; balance: number } };

const emptyData: TreasuryData = { accounts: [], categories: [], mutations: [], pendingPayments: [], summary: { openingBalance: 0, totalIncome: 0, totalExpense: 0, balance: 0 } };
const today = () => new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);
const money = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });
const sourceLabels: Record<string, string> = { program_income: "Penerimaan Program", program_expense: "Pengeluaran Program", attendance_payment: "Registrasi Peserta", manual: "Transaksi Manual", internal_transfer: "Transfer Internal" };

export default function TreasuryDashboard() {
  const [data, setData] = useState<TreasuryData>(emptyData);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState("");
  const [accountFilter, setAccountFilter] = useState("all");
  const [directionFilter, setDirectionFilter] = useState("all");
  const [manualOpen, setManualOpen] = useState(false);
  const [editingManual, setEditingManual] = useState<Mutation | null>(null);
  const [deletingManual, setDeletingManual] = useState<Mutation | null>(null);
  const [transferOpen, setTransferOpen] = useState(false);
  const [accountsOpen, setAccountsOpen] = useState(false);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [newCategory, setNewCategory] = useState("");
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [manual, setManual] = useState({ direction: "income", accountId: "", description: "", category: "Lainnya", transactionDate: today(), amount: "" });
  const [transfer, setTransfer] = useState({ fromAccountId: "", toAccountId: "", description: "", transactionDate: today(), amount: "" });
  const [accountForm, setAccountForm] = useState({ name: "", bankName: "", accountNumber: "", accountHolder: "", openingBalance: "" });
  const [pendingDrafts, setPendingDrafts] = useState<Record<number, { accountId: string; amount: string; note: string }>>({});

  async function load(background = false) {
    try {
      if (!background) setLoading(true);
      const payload = await getCachedJson<TreasuryData>("/api/treasury", 30_000, background);
      setData(payload);
    } catch (reason) {
      if (!background) toast.error(reason instanceof Error ? reason.message : "Buku besar belum dapat dimuat.");
    } finally { setLoading(false); }
  }

  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, []);
  useEffect(() => {
    if (saving || manualOpen || transferOpen || accountsOpen || categoryOpen || editingAccount || deletingManual) return;
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") void load(true);
    }, 15_000);
    return () => window.clearInterval(interval);
  }, [accountsOpen, categoryOpen, deletingManual, editingAccount, manualOpen, saving, transferOpen]);

  const filtered = useMemo(() => {
    const keyword = query.trim().toLocaleLowerCase("id-ID");
    return data.mutations.filter((item) => {
      const matchesQuery = !keyword || `${item.description} ${item.category} ${item.programCode ?? ""} ${item.programTitle ?? ""} ${item.createdByName}`.toLocaleLowerCase("id-ID").includes(keyword);
      return matchesQuery && (accountFilter === "all" || String(item.accountId) === accountFilter) && (directionFilter === "all" || item.direction === directionFilter);
    });
  }, [accountFilter, data.mutations, directionFilter, query]);

  function openManual(direction: "income" | "expense") {
    setEditingManual(null);
    setManual({ direction, accountId: String(data.accounts[0]?.id ?? ""), description: "", category: "Lainnya", transactionDate: today(), amount: "" });
    setManualOpen(true);
  }

  function openManualEdit(item: Mutation) {
    setEditingManual(item);
    setManual({ direction: item.direction, accountId: String(item.accountId), description: item.description, category: item.category, transactionDate: item.transactionDate, amount: String(item.amount) });
    setManualOpen(true);
  }

  function openTransfer() {
    setTransfer({ fromAccountId: String(data.accounts[0]?.id ?? ""), toAccountId: String(data.accounts[1]?.id ?? ""), description: "", transactionDate: today(), amount: "" });
    setTransferOpen(true);
  }

  function openAccount(account: Account) {
    setEditingAccount(account);
    setAccountForm({ name: account.name, bankName: account.bankName, accountNumber: account.accountNumber, accountHolder: account.accountHolder, openingBalance: String(account.openingBalance || "") });
  }

  async function post(body: Record<string, unknown>) {
    const response = await fetch("/api/treasury", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error);
  }

  async function saveManual(event: FormEvent) {
    event.preventDefault(); setSaving(true);
    try { await post({ action: editingManual ? "update-manual" : "manual", id: editingManual?.sourceId, ...manual, accountId: Number(manual.accountId), amount: Number(manual.amount) }); setManualOpen(false); setEditingManual(null); await load(true); toast.success(editingManual ? "Transaksi manual diperbarui." : manual.direction === "income" ? "Penerimaan manual tercatat." : "Pengeluaran manual tercatat."); }
    catch (reason) { toast.error(reason instanceof Error ? reason.message : "Transaksi belum dapat disimpan."); }
    finally { setSaving(false); }
  }

  async function deleteManual() {
    if (!deletingManual) return; setSaving(true);
    try { await post({ action: "delete-manual", id: deletingManual.sourceId }); setDeletingManual(null); await load(true); toast.success("Transaksi manual dihapus."); }
    catch (reason) { toast.error(reason instanceof Error ? reason.message : "Transaksi belum dapat dihapus."); }
    finally { setSaving(false); }
  }

  async function saveTransfer(event: FormEvent) {
    event.preventDefault(); setSaving(true);
    try { await post({ action: "transfer", ...transfer, fromAccountId: Number(transfer.fromAccountId), toAccountId: Number(transfer.toAccountId), amount: Number(transfer.amount) }); setTransferOpen(false); await load(true); toast.success("Transfer internal berhasil dicatat."); }
    catch (reason) { toast.error(reason instanceof Error ? reason.message : "Transfer belum dapat disimpan."); }
    finally { setSaving(false); }
  }

  async function saveAccount(event: FormEvent) {
    event.preventDefault(); if (!editingAccount) return; setSaving(true);
    try {
      const response = await fetch(`/api/treasury/accounts/${editingAccount.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...accountForm, openingBalance: Number(accountForm.openingBalance) }) });
      const payload = await response.json(); if (!response.ok) throw new Error(payload.error);
      setEditingAccount(null); await load(true); toast.success("Informasi rekening diperbarui.");
    } catch (reason) { toast.error(reason instanceof Error ? reason.message : "Rekening belum dapat diperbarui."); }
    finally { setSaving(false); }
  }

  async function saveCategory(event: FormEvent) {
    event.preventDefault(); setSaving(true);
    try {
      const response = await fetch("/api/treasury/categories", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: newCategory }) });
      const payload = await response.json(); if (!response.ok) throw new Error(payload.error);
      setCategoryOpen(false); setNewCategory(""); await load(true);
      setManual((current) => ({ ...current, category: payload.category.name }));
      toast.success("Kategori baru ditambahkan.");
    } catch (reason) { toast.error(reason instanceof Error ? reason.message : "Kategori belum dapat ditambahkan."); }
    finally { setSaving(false); }
  }

  async function reviewPending(item: PendingPayment, approved: boolean) {
    const draft = pendingDrafts[item.participantId] ?? { accountId: String(item.accountId), amount: String(item.amount), note: item.note };
    setSaving(true);
    try {
      await post({ action: "review-onsite-payment", participantId: item.participantId, approved,
        accountId: Number(draft.accountId), amount: Number(draft.amount), note: draft.note });
      setPendingDrafts((current) => { const next = { ...current }; delete next[item.participantId]; return next; });
      await load(true); toast.success(approved ? "Pembayaran dikonfirmasi dan saldo diperbarui." : "Pembayaran ditolak untuk ditindaklanjuti.");
    } catch (reason) { toast.error(reason instanceof Error ? reason.message : "Pembayaran belum dapat diperiksa."); }
    finally { setSaving(false); }
  }

  if (loading) return <div className="grid min-h-[55vh] place-items-center text-sm text-muted-foreground"><span className="flex items-center gap-2"><LoaderCircle className="size-5 animate-spin" />Memuat buku besar…</span></div>;

  return <div className="space-y-6">
    <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between"><div><p className="text-sm font-bold uppercase tracking-[0.16em] text-primary">Kontrol Keuangan</p><h1 className="mt-2 text-2xl font-bold sm:text-3xl">Bendahara & Buku Besar</h1><p className="mt-2 text-sm text-muted-foreground">Mutasi gabungan program, registrasi peserta, transaksi umum, dan transfer internal.</p></div><div className="grid grid-cols-2 gap-2 sm:flex"><Button variant="outline" onClick={() => openManual("income")}><ArrowDownLeft />Uang Masuk</Button><Button variant="outline" onClick={() => openManual("expense")}><ArrowUpRight />Uang Keluar</Button><Button className="col-span-2" onClick={openTransfer}><ArrowRightLeft />Transfer Rekening</Button></div></div>

    <section className="grid grid-cols-2 gap-3 lg:grid-cols-4"><Summary label="Saldo Awal" value={data.summary.openingBalance} icon={WalletCards} /><Summary label="Total Penerimaan" value={data.summary.totalIncome} icon={ArrowDownLeft} tone="text-emerald-700" /><Summary label="Total Pengeluaran" value={data.summary.totalExpense} icon={ArrowUpRight} tone="text-rose-700" /><Summary label="Saldo Akhir" value={data.summary.balance} icon={Banknote} tone={data.summary.balance < 0 ? "text-rose-700" : "text-primary"} /></section>

    {data.pendingPayments.length > 0 && <section className="rounded-2xl border border-amber-200 bg-amber-50/40 shadow-sm"><div className="border-b border-amber-200 p-4 sm:p-5"><div className="flex items-center justify-between gap-3"><div><h2 className="font-bold text-amber-950">Pembayaran Event Menunggu Validasi</h2><p className="mt-1 text-sm text-amber-800">Belum masuk saldo sampai Bendahara mengonfirmasi.</p></div><Badge className="bg-amber-600 text-white">{data.pendingPayments.length}</Badge></div></div><div className="divide-y divide-amber-200">{data.pendingPayments.map((item) => { const draft = pendingDrafts[item.participantId] ?? { accountId: String(item.accountId), amount: String(item.amount), note: item.note }; return <article key={item.participantId} className="grid gap-4 p-4 sm:p-5 lg:grid-cols-[1fr_1fr_auto]"><div><p className="font-bold">{item.participantName}</p><p className="mt-1 text-sm text-muted-foreground">{item.eventName}</p><p className="mt-2 text-xs text-muted-foreground">Diterima oleh {item.receivedByName} · {item.method} · {item.paidAt}</p>{Boolean(item.proofAvailable) && <a href={`/api/attendance/payment-proof/${item.participantId}`} target="_blank" className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-primary"><ExternalLink className="size-3.5"/>Lihat bukti pembayaran</a>}</div><div className="grid gap-2 sm:grid-cols-2"><Field label="Rekening/Kas"><select value={draft.accountId} onChange={(event) => setPendingDrafts({ ...pendingDrafts, [item.participantId]: { ...draft, accountId: event.target.value } })} className="h-10 rounded-md border bg-white px-3">{data.accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select></Field><Field label="Nominal"><Input type="number" min="1" value={draft.amount} onChange={(event) => setPendingDrafts({ ...pendingDrafts, [item.participantId]: { ...draft, amount: event.target.value } })}/></Field><div className="sm:col-span-2"><Field label="Catatan Bendahara"><Input value={draft.note} onChange={(event) => setPendingDrafts({ ...pendingDrafts, [item.participantId]: { ...draft, note: event.target.value } })} placeholder="Opsional"/></Field></div></div><div className="flex gap-2 lg:flex-col lg:justify-center"><Button disabled={saving} variant="outline" className="flex-1 border-rose-200 text-rose-700 hover:text-rose-700" onClick={() => void reviewPending(item, false)}><X/>Tolak</Button><Button disabled={saving || !draft.accountId || Number(draft.amount) <= 0} className="flex-1" onClick={() => void reviewPending(item, true)}><Check/>Konfirmasi</Button></div></article>; })}</div></section>}

    <section><div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="font-bold">Rekening & Kas</h2><p className="mt-1 text-sm text-muted-foreground">Atur nama bank, nama kas, dan saldo awal pembukuan.</p></div><Button variant="outline" onClick={() => setAccountsOpen(true)}><Settings2/>Atur Rekening & Saldo Awal</Button></div><div className="grid gap-4 lg:grid-cols-3">{data.accounts.map((account) => <article key={account.id} className={`rounded-2xl border p-5 shadow-sm ${account.type === "cash" ? "bg-amber-50/50" : "bg-white"}`}><div className="flex items-start justify-between gap-3"><div className={`grid size-11 place-items-center rounded-xl ${account.type === "cash" ? "bg-amber-100 text-amber-800" : "bg-emerald-50 text-primary"}`}>{account.type === "cash" ? <Banknote className="size-5" /> : <Landmark className="size-5" />}</div><Button size="sm" variant="ghost" onClick={() => openAccount(account)} aria-label={`Atur ${account.name}`}><Settings2 />Atur</Button></div><p className="mt-4 text-sm font-semibold text-muted-foreground">{account.type === "cash" ? "Uang Tunai" : account.bankName || "Rekening Bank"}</p><h2 className="mt-1 text-lg font-bold">{account.name}</h2>{account.type === "bank" && <p className="mt-1 text-xs text-muted-foreground">{account.accountNumber || "Nomor belum diatur"}{account.accountHolder ? ` · ${account.accountHolder}` : ""}</p>}<p className={`mt-5 text-2xl font-bold ${account.balance < 0 ? "text-rose-700" : "text-primary"}`}>{money.format(account.balance)}</p><div className="mt-4 grid grid-cols-2 gap-2 text-xs"><div className="rounded-lg bg-emerald-50 p-2 text-emerald-800">Masuk<br/><strong>{money.format(account.totalIncome)}</strong></div><div className="rounded-lg bg-rose-50 p-2 text-rose-800">Keluar<br/><strong>{money.format(account.totalExpense)}</strong></div></div></article>)}</div></section>

    <section className="rounded-2xl border bg-white shadow-sm"><div className="border-b p-4 sm:p-5"><div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between"><div><h2 className="font-bold">Laporan Mutasi</h2><p className="mt-1 text-sm text-muted-foreground">Menampilkan {filtered.length} dari {data.mutations.length} transaksi terbaru.</p></div><div className="grid gap-2 sm:grid-cols-3"><label className="relative"><Search className="absolute left-3 top-3 size-4 text-muted-foreground"/><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cari transaksi…" className="pl-9"/></label><select value={accountFilter} onChange={(event) => setAccountFilter(event.target.value)} className="h-10 rounded-md border bg-white px-3 text-sm"><option value="all">Semua rekening</option>{data.accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select><select value={directionFilter} onChange={(event) => setDirectionFilter(event.target.value)} className="h-10 rounded-md border bg-white px-3 text-sm"><option value="all">Masuk & keluar</option><option value="income">Uang masuk</option><option value="expense">Uang keluar</option></select></div></div></div><div className="divide-y">{filtered.length === 0 ? <p className="p-10 text-center text-sm text-muted-foreground">Belum ada mutasi yang sesuai.</p> : filtered.map((item) => { const account = data.accounts.find((row) => row.id === item.accountId); return <article key={item.key} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5"><div className="flex min-w-0 gap-3"><span className={`grid size-10 shrink-0 place-items-center rounded-xl ${item.direction === "income" ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>{item.direction === "income" ? <ArrowDownLeft className="size-5"/> : <ArrowUpRight className="size-5"/>}</span><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="font-bold">{item.description}</p>{item.transferGroup && <Badge variant="secondary">Transfer</Badge>}</div><p className="mt-1 text-xs text-muted-foreground">{item.transactionDate} · {account?.name ?? "Rekening Utama"} · {sourceLabels[item.sourceType] ?? item.category}</p>{item.programCode && <p className="mt-1 text-xs font-semibold text-primary">{item.programCode} · {item.programTitle}</p>}</div></div><div className="pl-13 text-left sm:pl-0 sm:text-right"><p className={`font-bold ${item.direction === "income" ? "text-emerald-700" : "text-rose-700"}`}>{item.direction === "income" ? "+" : "−"}{money.format(item.amount)}</p><p className="mt-1 text-xs text-muted-foreground">{item.createdByName}</p>{item.sourceType === "manual" && <div className="mt-2 flex gap-2 sm:justify-end"><Button size="sm" variant="outline" onClick={() => openManualEdit(item)}><Pencil/>Edit</Button><Button size="sm" variant="outline" className="text-rose-700 hover:text-rose-700" onClick={() => setDeletingManual(item)}><Trash2/>Hapus</Button></div>}</div></article>; })}</div></section>

    <Dialog open={manualOpen} onOpenChange={(open) => { if (!saving) { setManualOpen(open); if (!open) setEditingManual(null); } }}><DialogContent><form onSubmit={saveManual}><DialogHeader><DialogTitle>{editingManual ? `Edit ${manual.direction === "income" ? "Uang Masuk" : "Uang Keluar"}` : manual.direction === "income" ? "Catat Uang Masuk" : "Catat Uang Keluar"}</DialogTitle><DialogDescription>{editingManual ? "Perubahan langsung memperbarui saldo dan laporan mutasi." : "Untuk transaksi di luar event dan program kerja."}</DialogDescription></DialogHeader><div className="grid gap-4 py-5"><Field label="Rekening"><select value={manual.accountId} onChange={(event) => setManual({ ...manual, accountId: event.target.value })} className="h-10 rounded-md border bg-white px-3" required>{data.accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select></Field><Field label="Uraian"><Input value={manual.description} onChange={(event) => setManual({ ...manual, description: event.target.value })} required maxLength={180}/></Field><div className="grid gap-4 sm:grid-cols-2"><div className="grid gap-2"><div className="flex items-center justify-between gap-2"><Label>Kategori</Label><Button type="button" size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setCategoryOpen(true)}><Plus/>Tambah</Button></div><select value={manual.category} onChange={(event) => setManual({ ...manual, category: event.target.value })} className="h-10 rounded-md border bg-white px-3">{!data.categories.some((item) => item.name === manual.category) && <option value={manual.category}>{manual.category}</option>}{data.categories.map((item) => <option key={item.id} value={item.name}>{item.name}</option>)}</select></div><Field label="Tanggal"><Input type="date" value={manual.transactionDate} onChange={(event) => setManual({ ...manual, transactionDate: event.target.value })} required/></Field></div><Field label="Nominal"><Input type="number" min="1" value={manual.amount} onChange={(event) => setManual({ ...manual, amount: event.target.value })} required/></Field></div><DialogFooter><Button type="button" variant="outline" onClick={() => { setManualOpen(false); setEditingManual(null); }} disabled={saving}>Batal</Button><Button disabled={saving || !manual.accountId || !manual.description.trim() || Number(manual.amount) <= 0}>{saving && <LoaderCircle className="animate-spin"/>}{editingManual ? <Pencil/> : <Plus/>}{editingManual ? "Simpan Perubahan" : "Simpan Transaksi"}</Button></DialogFooter></form></DialogContent></Dialog>

    <Dialog open={transferOpen} onOpenChange={(open) => { if (!saving) setTransferOpen(open); }}><DialogContent><form onSubmit={saveTransfer}><DialogHeader><DialogTitle>Transfer Antar Rekening</DialogTitle><DialogDescription>Dicatat sebagai keluar dan masuk berpasangan tanpa mengubah total kas.</DialogDescription></DialogHeader><div className="grid gap-4 py-5"><div className="grid gap-4 sm:grid-cols-2"><Field label="Dari"><select value={transfer.fromAccountId} onChange={(event) => setTransfer({ ...transfer, fromAccountId: event.target.value })} className="h-10 rounded-md border bg-white px-3" required>{data.accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select></Field><Field label="Ke"><select value={transfer.toAccountId} onChange={(event) => setTransfer({ ...transfer, toAccountId: event.target.value })} className="h-10 rounded-md border bg-white px-3" required>{data.accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select></Field></div><Field label="Keterangan"><Input value={transfer.description} onChange={(event) => setTransfer({ ...transfer, description: event.target.value })} placeholder="Contoh: Pengisian Kas Kecil" maxLength={180}/></Field><div className="grid gap-4 sm:grid-cols-2"><Field label="Tanggal"><Input type="date" value={transfer.transactionDate} onChange={(event) => setTransfer({ ...transfer, transactionDate: event.target.value })} required/></Field><Field label="Nominal"><Input type="number" min="1" value={transfer.amount} onChange={(event) => setTransfer({ ...transfer, amount: event.target.value })} required/></Field></div></div><DialogFooter><Button type="button" variant="outline" onClick={() => setTransferOpen(false)} disabled={saving}>Batal</Button><Button disabled={saving || transfer.fromAccountId === transfer.toAccountId || Number(transfer.amount) <= 0}>{saving && <LoaderCircle className="animate-spin"/>}<ArrowRightLeft/>Catat Transfer</Button></DialogFooter></form></DialogContent></Dialog>

    <Dialog open={Boolean(editingAccount)} onOpenChange={(open) => { if (!open && !saving) setEditingAccount(null); }}><DialogContent><form onSubmit={saveAccount}><DialogHeader><DialogTitle>Pengaturan Rekening</DialogTitle><DialogDescription>{editingAccount?.type === "cash" ? "Atur nama dan saldo awal Kas Kecil." : "Atur identitas rekening dan saldo awal pembukuan."}</DialogDescription></DialogHeader><div className="grid gap-4 py-5"><Field label="Nama di aplikasi"><Input value={accountForm.name} onChange={(event) => setAccountForm({ ...accountForm, name: event.target.value })} required maxLength={80}/></Field>{editingAccount?.type === "bank" && <><Field label="Nama bank"><Input value={accountForm.bankName} onChange={(event) => setAccountForm({ ...accountForm, bankName: event.target.value })} placeholder="Contoh: BSI" maxLength={80}/></Field><div className="grid gap-4 sm:grid-cols-2"><Field label="Nomor rekening"><Input value={accountForm.accountNumber} onChange={(event) => setAccountForm({ ...accountForm, accountNumber: event.target.value })} maxLength={60}/></Field><Field label="Nama pemilik"><Input value={accountForm.accountHolder} onChange={(event) => setAccountForm({ ...accountForm, accountHolder: event.target.value })} maxLength={100}/></Field></div></>}<Field label="Saldo awal"><Input type="number" min="0" value={accountForm.openingBalance} onChange={(event) => setAccountForm({ ...accountForm, openingBalance: event.target.value })}/></Field></div><DialogFooter><Button type="button" variant="outline" onClick={() => setEditingAccount(null)} disabled={saving}>Batal</Button><Button disabled={saving || !accountForm.name.trim()}>{saving && <LoaderCircle className="animate-spin"/>}Simpan Rekening</Button></DialogFooter></form></DialogContent></Dialog>

    <Dialog open={accountsOpen} onOpenChange={setAccountsOpen}><DialogContent><DialogHeader><DialogTitle>Atur Rekening & Saldo Awal</DialogTitle><DialogDescription>Pilih rekening atau kas yang ingin diubah.</DialogDescription></DialogHeader><div className="grid gap-3 py-5">{data.accounts.map((account) => <button type="button" key={account.id} className="flex items-center justify-between gap-4 rounded-xl border p-4 text-left hover:bg-muted/50" onClick={() => { setAccountsOpen(false); openAccount(account); }}><span><span className="block font-bold">{account.name}</span><span className="mt-1 block text-sm text-muted-foreground">{account.type === "cash" ? "Kas tunai" : account.bankName || "Rekening bank"} · Saldo awal {money.format(account.openingBalance)}</span></span><Settings2 className="size-5 shrink-0 text-primary"/></button>)}</div><DialogFooter><Button variant="outline" onClick={() => setAccountsOpen(false)}>Tutup</Button></DialogFooter></DialogContent></Dialog>

    <Dialog open={categoryOpen} onOpenChange={(open) => { if (!saving) setCategoryOpen(open); }}><DialogContent><form onSubmit={saveCategory}><DialogHeader><DialogTitle>Tambah Kategori Transaksi</DialogTitle><DialogDescription>Kategori baru akan langsung tersedia untuk pencatatan berikutnya.</DialogDescription></DialogHeader><div className="py-5"><Field label="Nama kategori"><Input value={newCategory} onChange={(event) => setNewCategory(event.target.value)} placeholder="Contoh: Zakat atau Sewa Tempat" minLength={2} maxLength={80} autoFocus required/></Field></div><DialogFooter><Button type="button" variant="outline" onClick={() => setCategoryOpen(false)} disabled={saving}>Batal</Button><Button disabled={saving || newCategory.trim().length < 2}>{saving && <LoaderCircle className="animate-spin"/>}<Tag/>Simpan Kategori</Button></DialogFooter></form></DialogContent></Dialog>
    <AlertDialog open={Boolean(deletingManual)} onOpenChange={(open) => { if (!open && !saving) setDeletingManual(null); }}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Hapus transaksi manual?</AlertDialogTitle><AlertDialogDescription>Transaksi “{deletingManual?.description}” akan dihapus dan saldo rekening otomatis dihitung ulang. Tindakan ini tidak memengaruhi data Program Kerja atau pembayaran peserta.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={saving}>Batal</AlertDialogCancel><AlertDialogAction onClick={deleteManual} disabled={saving}>{saving && <LoaderCircle className="animate-spin"/>}Hapus Transaksi</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </div>;
}

function Summary({ label, value, icon: Icon, tone = "text-foreground" }: { label: string; value: number; icon: typeof WalletCards; tone?: string }) {
  return <article className="rounded-2xl border bg-white p-4 shadow-sm"><Icon className={`size-5 ${tone}`}/><p className={`mt-3 text-lg font-bold sm:text-xl ${tone}`}>{money.format(value)}</p><p className="mt-1 text-sm text-muted-foreground">{label}</p></article>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="grid gap-2"><Label>{label}</Label>{children}</label>;
}
