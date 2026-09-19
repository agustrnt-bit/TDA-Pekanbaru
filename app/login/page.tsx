import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LockKeyhole } from "lucide-react";
import { getVpsSessionIdentity, safeReturnPath } from "@/lib/vps-auth";

export const metadata: Metadata = {
  title: "Masuk — TDA Pekanbaru",
  robots: { index: false, follow: false },
};

const errorText: Record<string, string> = {
  invalid_credentials: "Email atau password tidak sesuai.",
  locked: "Akun dikunci sementara karena terlalu banyak percobaan login.",
  rate_limited: "Terlalu banyak percobaan login. Coba lagi beberapa saat.",
  config: "Konfigurasi login belum lengkap.",
  origin: "Permintaan login ditolak karena asal permintaan tidak valid.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ return_to?: string; error?: string }>;
}) {
  const params = await searchParams;
  const returnTo = safeReturnPath(params.return_to);
  const identity = await getVpsSessionIdentity().catch(() => null);

  if (identity?.mustChangePassword) {
    redirect(`/account/password?return_to=${encodeURIComponent(returnTo)}`);
  }
  if (identity) redirect(returnTo);

  const message = params.error ? errorText[params.error] : null;

  return (
    <main className="min-h-screen bg-[#f3f7f3] px-4 py-10 text-slate-950">
      <div className="mx-auto grid min-h-[80vh] max-w-md place-items-center">
        <section className="w-full rounded-3xl border border-emerald-950/10 bg-white p-6 shadow-xl shadow-emerald-950/5 sm:p-8">
          <div className="flex items-center gap-3">
            <img
              src="/tda-pekanbaru.png"
              alt="TDA Pekanbaru"
              className="h-14 w-28 rounded-xl bg-white object-contain"
            />
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-700">
                Backoffice Pengurus
              </p>
              <h1 className="text-xl font-black">TDA Pekanbaru 9.0</h1>
            </div>
          </div>

          <div className="mt-8 flex items-center gap-3">
            <div className="grid size-11 place-items-center rounded-2xl bg-emerald-50 text-emerald-800">
              <LockKeyhole className="size-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Masuk ke aplikasi</h2>
              <p className="text-sm text-slate-500">Gunakan akun pengurus yang aktif.</p>
            </div>
          </div>

          {message && (
            <div className="mt-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
              {message}
            </div>
          )}

          <form action="/api/auth/login" method="post" className="mt-6 space-y-4">
            <input type="hidden" name="return_to" value={returnTo} />
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold">Email</span>
              <input
                name="email"
                type="email"
                autoComplete="username"
                required
                maxLength={320}
                className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm outline-none transition focus:border-emerald-600 focus:ring-4 focus:ring-emerald-600/10"
                placeholder="nama@email.com"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold">Password</span>
              <input
                name="password"
                type="password"
                autoComplete="current-password"
                required
                maxLength={256}
                className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm outline-none transition focus:border-emerald-600 focus:ring-4 focus:ring-emerald-600/10"
                placeholder="Masukkan password"
              />
            </label>
            <button
              type="submit"
              className="mt-2 h-12 w-full rounded-xl bg-[#0d2f20] px-5 text-sm font-bold text-white transition hover:bg-[#164d35]"
            >
              Masuk
            </button>
          </form>

          <p className="mt-5 text-center text-xs leading-5 text-slate-500">
            Akses hanya untuk akun yang terdaftar dan aktif di TDA Pekanbaru.
          </p>
        </section>
      </div>
    </main>
  );
}
