"use client";

import Image from "next/image";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";
import {
  ArrowUpRight,
  BadgeCheck,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  CircleX,
  ClipboardList,
  Clock3,
  FilePenLine,
  LayoutDashboard,
  ListChecks,
  LockKeyhole,
  LogIn,
  ShieldCheck,
  UserRound,
  UsersRound,
  UserCheck,
  WalletCards,
  Menu,
  Landmark,
  ContactRound,
  Bell,
  Images,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Toaster } from "@/components/ui/sonner";
import type { AppAccess } from "@/lib/access-types";
import { anonymousAccess } from "@/lib/access-types";
import {
  getCachedJson,
  invalidateClientCache,
  prefetchJson,
} from "@/lib/client-cache";
import DashboardGuide from "@/components/program-management/dashboard-guide";

const SectionLoading = () => (
  <div className="grid min-h-[55vh] place-items-center text-sm text-muted-foreground">
    Memuat halaman…
  </div>
);
const ProgramList = dynamic(
  () => import("@/components/program-management/program-list"),
  { loading: SectionLoading },
);
const UserManagement = dynamic(
  () => import("@/components/program-management/user-management"),
  { loading: SectionLoading },
);
const ProgramCalendar = dynamic(
  () => import("@/components/program-management/program-calendar"),
  { loading: SectionLoading },
);
const ProgramReport = dynamic(
  () => import("@/components/program-management/program-report"),
  { loading: SectionLoading },
);
const ProgramFinance = dynamic(
  () => import("@/components/program-management/program-finance"),
  { loading: SectionLoading },
);
const NotificationCenter = dynamic(
  () => import("@/components/program-management/notification-center"),
  { loading: SectionLoading },
);
const AttendanceApp = dynamic(() => import("@/components/attendance-app"), {
  loading: SectionLoading,
});
const TreasuryDashboard = dynamic(
  () => import("@/components/program-management/treasury-dashboard"),
  { loading: SectionLoading },
);
const MembershipManagement = dynamic(
  () => import("@/components/membership-management"),
  { loading: SectionLoading },
);
const PublicMediaManagement = dynamic(
  () => import("@/components/program-management/public-media-management"),
  { loading: SectionLoading },
);

type View =
  | "dashboard"
  | "programs"
  | "calendar"
  | "reports"
  | "finance"
  | "treasury"
  | "attendance"
  | "membership"
  | "publication"
  | "notifications"
  | "profile";
type DashboardData = {
  summary: {
    total: number;
    pendingApproval: number;
    approved: number;
    revisionRequired: number;
    rejected: number;
    totalTasks: number;
    completedTasks: number;
    overdueTasks: number;
    averageProgress: number;
    totalBudget: number;
  };
  divisions: {
    id: number;
    code: string;
    name: string;
    sortOrder: number;
    totalPrograms: number;
    completedPrograms: number;
  }[];
  period: {
    id: number;
    name: string;
    startDate: string;
    endDate: string;
  } | null;
  nextProgramCode: string;
};

const emptyData: DashboardData = {
  summary: {
    total: 0,
    pendingApproval: 0,
    approved: 0,
    revisionRequired: 0,
    rejected: 0,
    totalTasks: 0,
    completedTasks: 0,
    overdueTasks: 0,
    averageProgress: 0,
    totalBudget: 0,
  },
  divisions: [],
  period: null,
  nextProgramCode: "PRG-2026-0001",
};

const primaryNavigation = [
  { id: "dashboard" as const, label: "Dashboard", icon: LayoutDashboard },
  { id: "programs" as const, label: "Program Kerja", icon: ClipboardList },
  { id: "calendar" as const, label: "Kalender", icon: CalendarDays },
  { id: "reports" as const, label: "Laporan", icon: BarChart3 },
  { id: "finance" as const, label: "Keuangan & LPJ", icon: WalletCards },
  { id: "treasury" as const, label: "Bendahara", icon: Landmark },
  { id: "attendance" as const, label: "Kehadiran Event", icon: UserCheck },
  {
    id: "membership" as const,
    label: "Pendaftaran Member",
    icon: ContactRound,
  },
  { id: "publication" as const, label: "Banner & Galeri", icon: Images },
  { id: "notifications" as const, label: "Notifikasi", icon: Bell },
  { id: "profile" as const, label: "Pengurus", icon: UserRound },
];

const mobilePrimaryNavigation = primaryNavigation.filter(({ id }) =>
  ["dashboard", "programs", "calendar", "attendance"].includes(id),
);
const mobileMoreNavigation = [
  ...primaryNavigation.filter(({ id }) =>
    [
      "finance",
      "treasury",
      "membership",
      "publication",
      "reports",
      "notifications",
      "profile",
    ].includes(id),
  ),
];
const viewIds = new Set<View>(primaryNavigation.map((item) => item.id));

function preloadView(view: View) {
  if (view === "programs")
    void import("@/components/program-management/program-list");
  if (view === "calendar")
    void import("@/components/program-management/program-calendar");
  if (view === "reports")
    void import("@/components/program-management/program-report");
  if (view === "finance")
    void import("@/components/program-management/program-finance");
  if (view === "treasury")
    void import("@/components/program-management/treasury-dashboard");
  if (view === "attendance") void import("@/components/attendance-app");
  if (view === "membership") void import("@/components/membership-management");
  if (view === "publication")
    void import("@/components/program-management/public-media-management");
  if (view === "notifications")
    void import("@/components/program-management/notification-center");
  if (view === "profile")
    void import("@/components/program-management/user-management");
}

const roles = [
  {
    name: "Ketua/KSB",
    key: "ketua_ksb",
    detail: "Kontrol dan persetujuan tingkat organisasi",
    icon: ShieldCheck,
  },
  {
    name: "Bendahara",
    key: "bendahara",
    detail: "Kontrol buku besar dan rekening organisasi",
    icon: Landmark,
  },
  {
    name: "Kadiv",
    key: "kadiv",
    detail: "Pengelolaan program kerja divisi",
    icon: UsersRound,
  },
  {
    name: "Viewer",
    key: "viewer",
    detail: "Akses pantau tanpa perubahan data",
    icon: UserRound,
  },
];

function PageHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="mb-6">
      <p className="text-sm font-bold uppercase tracking-[0.16em] text-primary">
        {eyebrow}
      </p>
      <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
        {title}
      </h1>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
        {description}
      </p>
    </div>
  );
}

function Dashboard({
  data,
  loading,
  error,
  onOpenDivision,
}: {
  data: DashboardData;
  loading: boolean;
  error: string;
  onOpenDivision: (divisionId: number) => void;
}) {
  const cards = [
    {
      label: "Total Program Kerja",
      value: data.summary.total,
      icon: ListChecks,
      tone: "bg-emerald-50 text-emerald-700",
    },
    {
      label: "Menunggu Approval",
      value: data.summary.pendingApproval,
      icon: Clock3,
      tone: "bg-amber-50 text-amber-700",
    },
    {
      label: "Disetujui",
      value: data.summary.approved,
      icon: CheckCircle2,
      tone: "bg-teal-50 text-teal-700",
    },
    {
      label: "Perlu Revisi",
      value: data.summary.revisionRequired,
      icon: FilePenLine,
      tone: "bg-blue-50 text-blue-700",
    },
    {
      label: "Ditolak",
      value: data.summary.rejected,
      icon: CircleX,
      tone: "bg-rose-50 text-rose-700",
    },
    {
      label: "Rata-rata Progres",
      value: `${data.summary.averageProgress}%`,
      icon: BarChart3,
      tone: "bg-violet-50 text-violet-700",
    },
    {
      label: "Tugas Selesai",
      value: `${data.summary.completedTasks}/${data.summary.totalTasks}`,
      icon: CheckCircle2,
      tone: "bg-cyan-50 text-cyan-700",
    },
    {
      label: "Tugas Terlambat",
      value: data.summary.overdueTasks,
      icon: Clock3,
      tone: "bg-orange-50 text-orange-700",
    },
  ];

  return (
    <>
      <div className="flex items-start justify-between gap-4">
        <PageHeading
          eyebrow="Monitoring Aktif"
          title="Dashboard Program Kerja"
          description="Pantau status, progres pelaksanaan, dan tenggat program kerja TDA Pekanbaru 9.0."
        />
        <DashboardGuide data={data} />
      </div>
      {error && (
        <div className="mb-5 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
          {error}
        </div>
      )}
      <section
        className="grid grid-cols-2 gap-3 lg:grid-cols-4 xl:grid-cols-8"
        aria-label="Ringkasan status program kerja"
      >
        {cards.map(({ label, value, icon: Icon, tone }, index) => (
          <article
            key={label}
            className={`rounded-2xl border bg-white p-4 shadow-sm sm:p-5 ${index === 0 ? "col-span-2 lg:col-span-1" : ""}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div
                className={`grid size-10 place-items-center rounded-xl ${tone}`}
              >
                <Icon className="size-5" />
              </div>
              <span className="text-3xl font-bold tabular-nums">
                {loading ? "—" : value}
              </span>
            </div>
            <p className="mt-4 text-sm font-semibold text-muted-foreground">
              {label}
            </p>
          </article>
        ))}
      </section>

      <section className="mt-6 grid gap-5 xl:grid-cols-[1.4fr_.8fr]">
        <article className="rounded-2xl border bg-white shadow-sm">
          <div className="flex items-center justify-between border-b px-5 py-4">
            <div>
              <h2 className="font-bold">Master Data Divisi</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Selesai jika seluruh pekerjaan program sudah tuntas
              </p>
            </div>
            <Badge variant="secondary">
              {loading ? "—" : data.divisions.length} Divisi
            </Badge>
          </div>
          <div className="grid gap-px bg-border sm:grid-cols-2 xl:grid-cols-3">
            {(loading
              ? Array.from({ length: 9 }, (_, index) => ({
                  id: index,
                  code: "…",
                  name: "Memuat divisi",
                  totalPrograms: 0,
                  completedPrograms: 0,
                }))
              : data.divisions
            ).map((division, index) => {
              const remainingPrograms = Math.max(
                0,
                Number(division.totalPrograms) -
                  Number(division.completedPrograms),
              );
              return (
                <button
                  key={division.id}
                  type="button"
                  disabled={loading}
                  onClick={() => onOpenDivision(division.id)}
                  className="group min-h-28 bg-white px-4 py-3 text-left transition hover:bg-emerald-50/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary disabled:cursor-default"
                >
                  <div className="flex items-center gap-3">
                    <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-secondary text-xs font-bold text-secondary-foreground">
                      {division.code}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-muted-foreground">
                        Divisi {String(index + 1).padStart(2, "0")}
                      </p>
                      <p className="truncate text-sm font-semibold">
                        {division.name}
                      </p>
                    </div>
                    <ArrowUpRight className="size-4 text-muted-foreground transition group-hover:text-primary" />
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-lg bg-slate-50 px-2 py-1.5">
                      <strong className="block text-sm">
                        {division.totalPrograms}
                      </strong>
                      <span className="text-[11px] text-muted-foreground">
                        Program
                      </span>
                    </div>
                    <div className="rounded-lg bg-emerald-50 px-2 py-1.5">
                      <strong className="block text-sm text-emerald-700">
                        {division.completedPrograms}
                      </strong>
                      <span className="text-[11px] text-emerald-700">
                        Selesai
                      </span>
                    </div>
                    <div className="rounded-lg bg-amber-50 px-2 py-1.5">
                      <strong className="block text-sm text-amber-700">
                        {remainingPrograms}
                      </strong>
                      <span className="text-[11px] text-amber-700">Sisa</span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </article>

        <div className="space-y-5">
          <article className="overflow-hidden rounded-2xl bg-[#153323] p-5 text-white shadow-sm">
            <p className="text-sm font-medium text-emerald-200">
              Periode aktif
            </p>
            <h2 className="mt-2 text-xl font-bold">
              {data.period?.name ?? "TDA Pekanbaru 9.0 · 2026–2029"}
            </h2>
            <div className="mt-5 rounded-xl bg-white/10 p-3 ring-1 ring-white/10">
              <p className="text-xs text-emerald-200">Format ID program</p>
              <p className="mt-1 font-mono text-lg font-bold tracking-wide">
                {data.nextProgramCode}
              </p>
            </div>
          </article>
          <article className="rounded-2xl border bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2">
              <BadgeCheck className="size-5 text-primary" />
              <h2 className="font-bold">Struktur Role</h2>
            </div>
            <div className="mt-4 space-y-3">
              {roles.map(({ name, key, icon: Icon }) => (
                <div
                  key={key}
                  className="flex items-center justify-between gap-3 rounded-xl bg-muted/50 px-3 py-2.5"
                >
                  <div className="flex items-center gap-2">
                    <Icon className="size-4 text-primary" />
                    <span className="text-sm font-semibold">{name}</span>
                  </div>
                  <code className="text-xs text-muted-foreground">{key}</code>
                </div>
              ))}
            </div>
          </article>
        </div>
      </section>
    </>
  );
}

function LoginGate({
  authenticated,
  signInPath,
  signOutPath,
}: {
  authenticated: boolean;
  signInPath: string;
  signOutPath: string;
}) {
  return (
    <div className="mx-auto grid min-h-[70vh] max-w-xl place-items-center">
      <section className="w-full rounded-3xl border bg-white p-6 text-center shadow-sm sm:p-10">
        <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-emerald-50 text-primary">
          <LockKeyhole className="size-7" />
        </div>
        <p className="mt-5 text-sm font-bold uppercase tracking-[0.16em] text-primary">
          Akses Pengurus
        </p>
        <h1 className="mt-2 text-2xl font-bold">
          {authenticated ? "Akun belum terdaftar" : "Masuk ke Program Kerja"}
        </h1>
        <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-muted-foreground">
          {authenticated
            ? "Akun ChatGPT ini belum terdaftar sebagai pengurus aktif. Ketua/KSB dapat menambahkannya melalui menu Pengurus."
            : "Gunakan akun ChatGPT yang terdaftar untuk membuka Dashboard, Program Kerja, Kalender, dan Laporan."}
        </p>
        <div className="mt-6 flex justify-center">
          <a
            href={authenticated ? signOutPath : signInPath}
            target="_top"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-primary px-5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            <LogIn className="size-4" />
            {authenticated ? "Ganti akun" : "Masuk dengan ChatGPT"}
          </a>
        </div>
      </section>
    </div>
  );
}

export default function ProgramApp({
  signInPath,
  signOutPath,
}: {
  signInPath: string;
  signOutPath: string;
}) {
  const [activeView, setActiveView] = useState<View>("dashboard");
  const [data, setData] = useState<DashboardData>(emptyData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [access, setAccess] = useState<AppAccess>(anonymousAccess);
  const [accessLoading, setAccessLoading] = useState(true);
  const [programFocusId, setProgramFocusId] = useState<number | null>(null);
  const [programDivisionId, setProgramDivisionId] = useState<number | null>(
    null,
  );
  const [unreadCount, setUnreadCount] = useState(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const handleUnreadChange = useCallback(
    (count: number) => setUnreadCount(count),
    [],
  );

  const loadDashboard = useCallback(() => {
    invalidateClientCache(
      "/api/program-management/summary",
      "/api/program-management/reports",
    );
    getCachedJson<DashboardData>(
      "/api/program-management/summary",
      30_000,
      true,
    )
      .then((payload) => {
        setData(payload);
      })
      .catch((reason) =>
        setError(
          reason instanceof Error
            ? reason.message
            : "Ringkasan belum dapat dimuat.",
        ),
      )
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const fromHash = window.location.hash.slice(1) as View;
    const fromStorage = window.localStorage.getItem(
      "tdapku-active-view",
    ) as View | null;
    const restored = viewIds.has(fromHash)
      ? fromHash
      : fromStorage && viewIds.has(fromStorage)
        ? fromStorage
        : "dashboard";
    const timer = window.setTimeout(() => setActiveView(restored), 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (accessLoading || !access.user) return;
    const connection = (
      navigator as Navigator & {
        connection?: { saveData?: boolean; effectiveType?: string };
      }
    ).connection;
    if (
      connection?.saveData ||
      connection?.effectiveType === "2g" ||
      connection?.effectiveType === "slow-2g"
    )
      return;
    const chunkTimer = window.setTimeout(
      () => primaryNavigation.forEach(({ id }) => preloadView(id)),
      900,
    );
    const dataTimer = window.setTimeout(() => {
      void prefetchJson("/api/programs", 60_000);
      void prefetchJson("/api/program-management/reports", 60_000);
      const month = new Date(Date.now() + 7 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 7);
      void prefetchJson(
        `/api/program-management/calendar?month=${month}`,
        60_000,
      );
      void prefetchJson("/api/treasury/accounts", 60_000);
      void prefetchJson("/api/attendance", 30_000);
      void prefetchJson(
        "/api/notifications?notification_limit=30&activity_limit=50",
        15_000,
      );
      if (access.permissions.manageTreasury)
        void prefetchJson("/api/treasury", 30_000);
      if (access.permissions.manageMembership)
        void prefetchJson("/api/membership", 30_000);
    }, 2200);
    return () => {
      window.clearTimeout(chunkTimer);
      window.clearTimeout(dataTimer);
    };
  }, [
    access.permissions.manageMembership,
    access.permissions.manageTreasury,
    access.user,
    accessLoading,
  ]);

  useEffect(() => {
    if (accessLoading) return;
    if (
      (activeView === "membership" && !access.permissions.manageMembership) ||
      (activeView === "treasury" && !access.permissions.manageTreasury) ||
      (activeView === "publication" && access.user?.role !== "ketua_ksb")
    ) {
      const timer = window.setTimeout(() => {
        setActiveView("dashboard");
        window.localStorage.setItem("tdapku-active-view", "dashboard");
        window.history.replaceState(
          null,
          "",
          `${window.location.pathname}${window.location.search}#dashboard`,
        );
      }, 0);
      return () => window.clearTimeout(timer);
    }
  }, [
    access.permissions.manageMembership,
    access.permissions.manageTreasury,
    accessLoading,
    activeView,
  ]);

  useEffect(() => {
    if (activeView !== "dashboard") return;
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") loadDashboard();
    }, 15_000);
    return () => window.clearInterval(interval);
  }, [activeView, loadDashboard]);

  useEffect(() => {
    let cancelled = false;
    getCachedJson<{
      access: AppAccess;
      dashboard?: DashboardData;
      unreadCount?: number;
    }>("/api/program-management/bootstrap", 30_000)
      .then((payload) => {
        if (!cancelled) {
          setAccess(payload.access);
          if (payload.dashboard) setData(payload.dashboard);
          setUnreadCount(Number(payload.unreadCount ?? 0));
        }
      })
      .catch((reason) => {
        if (!cancelled)
          setError(
            reason instanceof Error
              ? reason.message
              : "Aplikasi belum dapat dimuat.",
          );
      })
      .finally(() => {
        if (!cancelled) {
          setAccessLoading(false);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const rememberView = (view: View) => {
    window.localStorage.setItem("tdapku-active-view", view);
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}${window.location.search}#${view}`,
    );
  };
  const navigate = (view: View) => {
    if (view === "programs") setProgramDivisionId(null);
    setActiveView(view);
    rememberView(view);
    setMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const openProgramFromCalendar = (programId: number) => {
    setProgramFocusId(programId);
    navigate("programs");
  };
  const openDivisionPrograms = (divisionId: number) => {
    setProgramFocusId(null);
    setProgramDivisionId(divisionId);
    setActiveView("programs");
    rememberView("programs");
    setMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  return (
    <div className="min-h-screen bg-background lg:grid lg:grid-cols-[260px_1fr]">
      <aside className="hidden border-r bg-[#102d20] text-white lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col">
        <div className="border-b border-white/10 p-5">
          <div className="flex items-center gap-3">
            <div className="h-11 w-24 overflow-hidden rounded-lg bg-white">
              <Image
                unoptimized
                src="/tda-pekanbaru.png"
                alt="TDA Pekanbaru"
                width={96}
                height={72}
                className="h-[72px] w-24 -translate-y-[15px] object-contain"
              />
            </div>
            <div>
              <p className="text-xs font-bold text-emerald-300">
                TDA PEKANBARU
              </p>
              <p className="text-sm font-bold">Program Kerja 9.0</p>
            </div>
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto p-3" aria-label="Navigasi utama">
          <p className="px-3 pb-2 pt-3 text-xs font-bold uppercase tracking-[0.16em] text-emerald-300/70">
            Menu Utama
          </p>
          {primaryNavigation
            .filter(({ id }) =>
              id === "treasury"
                ? access.permissions.manageTreasury
                : id === "membership"
                  ? access.permissions.manageMembership
                  : id === "publication"
                    ? access.user?.role === "ketua_ksb"
                    : true,
            )
            .map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onPointerEnter={() => preloadView(id)}
                onFocus={() => preloadView(id)}
                onClick={() => navigate(id)}
                className={`mb-1 flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold transition ${activeView === id ? "bg-emerald-500 text-white shadow-lg shadow-black/10" : "text-emerald-50/80 hover:bg-white/10 hover:text-white"}`}
              >
                <Icon className="size-5" />
                <span className="flex-1">{label}</span>
                {id === "notifications" && unreadCount > 0 && (
                  <span className="grid min-w-5 place-items-center rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] text-white">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                )}
              </button>
            ))}
        </nav>
        <div className="border-t border-white/10 p-4">
          <p className="text-xs text-emerald-200/70">
            {accessLoading
              ? "Memeriksa akses…"
              : access.user
                ? access.user.email
                : access.authenticated
                  ? "Belum terdaftar"
                  : "Mode baca"}
          </p>
          <p className="mt-1 text-sm font-semibold">
            {access.user
              ? roles.find((role) => role.key === access.user?.role)?.name
              : "Let&apos;s Go Together"}
          </p>
        </div>
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b bg-white/95 px-3 backdrop-blur sm:px-4 lg:hidden">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-lg border bg-white">
              <Image
                unoptimized
                src="/tda-pekanbaru.png"
                alt="TDA Pekanbaru"
                width={160}
                height={120}
                className="h-[72px] w-24 max-w-none -translate-y-[14px] object-contain"
              />
            </div>
            <div className="min-w-0">
              <p className="truncate text-[11px] font-bold text-primary">
                TDA PEKANBARU 9.0
              </p>
              <p className="truncate text-sm font-bold">Program Kerja</p>
            </div>
          </div>
          <Badge variant="secondary" className="ml-2 shrink-0">
            Versi 61
          </Badge>
        </header>
        <main className="mx-auto max-w-[1440px] px-4 pb-28 pt-6 sm:px-6 lg:px-8 lg:pb-12 lg:pt-8">
          {accessLoading ? (
            <div className="grid min-h-[60vh] place-items-center text-sm text-muted-foreground">
              Memeriksa akses pengurus…
            </div>
          ) : !access.user ? (
            <LoginGate
              authenticated={access.authenticated}
              signInPath={signInPath}
              signOutPath={signOutPath}
            />
          ) : activeView === "dashboard" ? (
            <Dashboard
              data={data}
              loading={loading}
              error={error}
              onOpenDivision={openDivisionPrograms}
            />
          ) : activeView === "programs" ? (
            <ProgramList
              divisions={data.divisions}
              nextCode={data.nextProgramCode}
              onChanged={loadDashboard}
              access={access}
              accessLoading={accessLoading}
              signInPath={signInPath}
              focusProgramId={programFocusId}
              onFocusHandled={() => setProgramFocusId(null)}
              initialDivisionId={programDivisionId}
            />
          ) : activeView === "calendar" ? (
            <ProgramCalendar
              divisions={data.divisions}
              onOpenProgram={openProgramFromCalendar}
            />
          ) : activeView === "reports" ? (
            <ProgramReport onOpenProgram={openProgramFromCalendar} />
          ) : activeView === "finance" ? (
            <ProgramFinance access={access} />
          ) : activeView === "treasury" && access.permissions.manageTreasury ? (
            <TreasuryDashboard />
          ) : activeView === "attendance" ? (
            <AttendanceApp />
          ) : activeView === "membership" &&
            access.permissions.manageMembership ? (
            <MembershipManagement />
          ) : activeView === "publication" &&
            access.user.role === "ketua_ksb" ? (
            <PublicMediaManagement />
          ) : activeView === "notifications" ? (
            <NotificationCenter onUnreadChange={handleUnreadChange} />
          ) : (
            <UserManagement
              access={access}
              divisions={data.divisions}
              signInPath={signInPath}
              signOutPath={signOutPath}
            />
          )}
        </main>
      </div>

      <nav
        className="fixed inset-x-0 bottom-0 z-50 grid grid-cols-5 border-t bg-white/95 px-2 pb-[max(.4rem,env(safe-area-inset-bottom))] pt-1.5 shadow-[0_-8px_30px_rgba(15,45,31,.08)] backdrop-blur lg:hidden"
        aria-label="Navigasi mobile"
      >
        {mobilePrimaryNavigation.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onTouchStart={() => preloadView(id)}
            onFocus={() => preloadView(id)}
            onClick={() => navigate(id)}
            className={`relative flex min-h-14 min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1 text-[11px] font-semibold ${activeView === id ? "bg-secondary text-primary" : "text-muted-foreground"}`}
          >
            <Icon className="size-5" />
            <span className="max-w-full truncate">
              {label === "Program Kerja"
                ? "Program"
                : label === "Kehadiran Event"
                  ? "Kehadiran"
                  : label}
            </span>
          </button>
        ))}
        <button
          type="button"
          onClick={() => setMobileMenuOpen(true)}
          className={`relative flex min-h-14 min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1 text-[11px] font-semibold ${mobileMoreNavigation.some(({ id }) => id === activeView) ? "bg-secondary text-primary" : "text-muted-foreground"}`}
        >
          <Menu className="size-5" />
          <span>Lainnya</span>
          {unreadCount > 0 && (
            <span className="absolute right-[22%] top-1 grid min-w-4 place-items-center rounded-full bg-rose-500 px-1 text-[9px] text-white">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>
      </nav>
      <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
        <SheetContent
          side="bottom"
          className="rounded-t-3xl pb-[max(1.25rem,env(safe-area-inset-bottom))] lg:hidden"
        >
          <SheetHeader className="border-b px-5 pb-4 pt-5 text-left">
            <SheetTitle>Menu Lainnya</SheetTitle>
            <SheetDescription>
              Akses keuangan, laporan, notifikasi, dan pengaturan pengurus.
            </SheetDescription>
          </SheetHeader>
          <div className="grid grid-cols-2 gap-3 px-4 pb-2">
            {mobileMoreNavigation
              .filter(({ id }) =>
                id === "treasury"
                  ? access.permissions.manageTreasury
                  : id === "membership"
                    ? access.permissions.manageMembership
                    : id === "publication"
                      ? access.user?.role === "ketua_ksb"
                      : true,
              )
              .map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  onTouchStart={() => preloadView(id)}
                  onFocus={() => preloadView(id)}
                  onClick={() => navigate(id)}
                  className={`relative flex min-h-20 items-center gap-3 rounded-2xl border px-4 text-left text-sm font-semibold ${activeView === id ? "border-primary bg-secondary text-primary" : "bg-white text-foreground"}`}
                >
                  <span
                    className={`grid size-10 shrink-0 place-items-center rounded-xl ${activeView === id ? "bg-white" : "bg-muted"}`}
                  >
                    <Icon className="size-5" />
                  </span>
                  <span className="leading-5">{label}</span>
                  {id === "notifications" && unreadCount > 0 && (
                    <span className="absolute right-3 top-3 grid min-w-5 place-items-center rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] text-white">
                      {unreadCount > 99 ? "99+" : unreadCount}
                    </span>
                  )}
                </button>
              ))}
          </div>
        </SheetContent>
      </Sheet>
      <Toaster position="top-right" richColors />
    </div>
  );
}
