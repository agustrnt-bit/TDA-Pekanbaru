import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { KeyRound } from "lucide-react";
import { getVpsSessionIdentity, safeReturnPath } from "@/lib/vps-auth";

export const metadata: Metadata = {
  title: "Ganti Password — TDA Pekanbaru",
  robots: { index: false, follow: false },
};

const errorText: Record<string, string> = {
  invalid_current_password: "Password saat ini tidak sesuai.",
  weak_password: "Password baru minimal 12 karakter.",
  mismatch: "Konfirmasi password baru tidak sama.",
  origin: "Permintaan ditolak karena asal permintaan tidak valid.",
  config: "Konfigurasi autentikasi belum lengkap.",
};

export default async function PasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ return_to?: string; error?: string }>;
}) {
  const params = await searchParams;
  const returnTo = safeReturnPath(params.return_to);
  const identity = await getVpsSessionIdentity().catch(() => null);
  if (!identity) {
    redirect(`/login?return_to=${encodeURIComponent(returnTo)}`);
  }

  const message = params.error ? errorText[params.error] : null;

  return (
    <main className="min-h-screen bg-[#f3f7f3] px-4 py-10 text-slate-950">
      <div className="mx-auto grid min-h-[80vh] max-w-md place-items-center">
        <section className="w-full rounded-3xl border border-emerald-950/10 bg-white p-6 shadow-xl shadow-emerald-950/5 sm:p-8">
          <div className="flex items-center gap-3">
            <div className="grid size-11 place-items-center rounded-2xl bg-emerald-50 text-emerald-800">
              <KeyRound className="size-5" />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-700">
                Keamanan Akun
              </p>
              <h1 className="text-xl font-black">Ganti password</h1>
            </div>
          </div>

          <p className="mt-5 text-sm leading-6 text-slate-600">
            Masuk sebagai <strong>{identity.email}</strong>. Gunakan password baru minimal 12 karakter.
          </p>

          {identity.mustChangePassword && (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Anda wajib mengganti password sementara sebelum menggunakan aplikasi.
            </div>
          )}
          {message && (
            <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
              {message}
            </div>
          )}

          <form action="/api/auth/password" method="post" className="mt-6 space-y-4">
            <input type="hidden" name="return_to" value={returnTo} />
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold">Password saat ini</span>
              <input
                name="current_password"
                type="password"
                autoComplete="current-password"
                required
                maxLength={256}
                className="h-12 w-full rounded-xl border border-slate-200 px-4 text-sm outline-none transition focus:border-emerald-600 focus:ring-4 focus:ring-emerald-600/10"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold">Password baru</span>
              <input
                name="new_password"
                type="password"
                autoComplete="new-password"
                required
                minLength={12}
                maxLength={256}
                className="h-12 w-full rounded-xl border border-slate-200 px-4 text-sm outline-none transition focus:border-emerald-600 focus:ring-4 focus:ring-emerald-600/10"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold">Ulangi password baru</span>
              <input
                name="confirm_password"
                type="password"
                autoComplete="new-password"
                required
                minLength={12}
                maxLength={256}
                className="h-12 w-full rounded-xl border border-slate-200 px-4 text-sm outline-none transition focus:border-emerald-600 focus:ring-4 focus:ring-emerald-600/10"
              />
            </label>
            <button
              type="submit"
              className="h-12 w-full rounded-xl bg-[#0d2f20] px-5 text-sm font-bold text-white transition hover:bg-[#164d35]"
            >
              Simpan password baru
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
