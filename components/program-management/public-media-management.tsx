"use client";

import { ImagePlus, Pencil, Save, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import type { PublicMediaItem } from "@/db/public-media";

type MediaForm = {
  mediaType: "banner" | "gallery";
  title: string;
  description: string;
  eventDate: string;
  linkUrl: string;
  sortOrder: number;
  isActive: boolean;
};

const blank: MediaForm = {
  mediaType: "banner",
  title: "",
  description: "",
  eventDate: "",
  linkUrl: "",
  sortOrder: 0,
  isActive: true,
};

export default function PublicMediaManagement() {
  const [items, setItems] = useState<PublicMediaItem[]>([]);
  const [form, setForm] = useState<MediaForm>({ ...blank });
  const [image, setImage] = useState<File | null>(null);
  const [editing, setEditing] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const load = () =>
    fetch("/api/publication-media")
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        setItems(data.items);
      })
      .catch((reason) => toast.error(reason.message));
  useEffect(() => {
    load();
  }, []);
  const change = (key: string, value: string | number | boolean) =>
    setForm((current) => ({ ...current, [key]: value }));
  const reset = () => {
    setForm({ ...blank });
    setImage(null);
    setEditing(null);
  };
  const save = async () => {
    if (!editing && !image)
      return toast.error("Pilih foto yang akan diunggah.");
    setBusy(true);
    try {
      let response: Response;
      if (editing)
        response = await fetch(`/api/publication-media/${editing}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
      else {
        const body = new FormData();
        Object.entries(form).forEach(([key, value]) =>
          body.set(key, String(value)),
        );
        body.set("image", image!);
        response = await fetch("/api/publication-media", {
          method: "POST",
          body,
        });
      }
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      toast.success(
        editing ? "Informasi foto diperbarui." : "Foto berhasil ditambahkan.",
      );
      reset();
      load();
    } catch (reason) {
      toast.error(
        reason instanceof Error
          ? reason.message
          : "Belum dapat menyimpan foto.",
      );
    } finally {
      setBusy(false);
    }
  };
  const edit = (item: PublicMediaItem) => {
    setEditing(item.id);
    setForm({
      mediaType: item.mediaType,
      title: item.title,
      description: item.description,
      eventDate: item.eventDate,
      linkUrl: item.linkUrl,
      sortOrder: item.sortOrder,
      isActive: Boolean(item.isActive),
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const remove = async (item: PublicMediaItem) => {
    if (!window.confirm(`Hapus foto “${item.title || item.imageName}”?`))
      return;
    const response = await fetch(`/api/publication-media/${item.id}`, {
      method: "DELETE",
    });
    const data = await response.json();
    if (!response.ok) return toast.error(data.error);
    toast.success("Foto dihapus.");
    load();
  };
  return (
    <div>
      <div className="mb-6">
        <p className="text-sm font-bold uppercase tracking-[.16em] text-primary">
          Publikasi Website
        </p>
        <h1 className="mt-2 text-2xl font-bold sm:text-3xl">Banner & Galeri</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          Atur foto kegiatan yang tampil di beranda publik. Perubahan foto
          langsung berlaku tanpa publikasi ulang aplikasi.
        </p>
      </div>
      <section className="rounded-2xl border bg-white p-5 shadow-sm">
        <h2 className="flex items-center gap-2 font-bold">
          <ImagePlus className="size-5 text-primary" />
          {editing ? "Edit informasi foto" : "Tambah foto kegiatan"}
        </h2>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <label className="text-sm font-semibold">
            Penempatan
            <select
              value={form.mediaType}
              onChange={(e) => change("mediaType", e.target.value)}
              className="mt-2 h-11 w-full rounded-xl border bg-white px-3 font-normal"
            >
              <option value="banner">Banner utama</option>
              <option value="gallery">Galeri dokumentasi</option>
            </select>
          </label>
          <label className="text-sm font-semibold">
            Judul
            <input
              value={form.title}
              onChange={(e) => change("title", e.target.value)}
              className="mt-2 h-11 w-full rounded-xl border px-3 font-normal"
              placeholder="Contoh: Kelas Reguler TDA"
            />
          </label>
          <label className="text-sm font-semibold md:col-span-2">
            Deskripsi singkat
            <textarea
              value={form.description}
              onChange={(e) => change("description", e.target.value)}
              className="mt-2 min-h-24 w-full rounded-xl border p-3 font-normal"
              placeholder="Ceritakan kegiatan dalam satu atau dua kalimat."
            />
          </label>
          <label className="text-sm font-semibold">
            Tanggal kegiatan
            <input
              type="date"
              value={form.eventDate}
              onChange={(e) => change("eventDate", e.target.value)}
              className="mt-2 h-11 w-full rounded-xl border px-3 font-normal"
            />
          </label>
          <label className="text-sm font-semibold">
            Urutan
            <input
              type="number"
              value={form.sortOrder}
              onChange={(e) => change("sortOrder", Number(e.target.value))}
              className="mt-2 h-11 w-full rounded-xl border px-3 font-normal"
            />
          </label>
          <label className="text-sm font-semibold md:col-span-2">
            Link tujuan (opsional)
            <input
              value={form.linkUrl}
              onChange={(e) => change("linkUrl", e.target.value)}
              className="mt-2 h-11 w-full rounded-xl border px-3 font-normal"
              placeholder="/program atau https://..."
            />
          </label>
          {!editing && (
            <label className="text-sm font-semibold md:col-span-2">
              Foto
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => setImage(e.target.files?.[0] || null)}
                className="mt-2 block w-full rounded-xl border p-2 font-normal"
              />
              <span className="mt-1 block text-xs font-normal text-muted-foreground">
                JPG, PNG, atau WebP; maksimal 5 MB. Gunakan foto mendatar untuk
                banner.
              </span>
            </label>
          )}
          <label className="flex items-center gap-3 text-sm font-semibold md:col-span-2">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => change("isActive", e.target.checked)}
              className="size-4"
            />
            Langsung tampil di website publik
          </label>
        </div>
        <div className="mt-5 flex gap-3">
          <button
            type="button"
            disabled={busy}
            onClick={save}
            className="inline-flex h-11 items-center gap-2 rounded-xl bg-primary px-5 text-sm font-bold text-white disabled:opacity-60"
          >
            <Save className="size-4" />
            {busy ? "Menyimpan…" : "Simpan"}
          </button>
          {editing && (
            <button
              type="button"
              onClick={reset}
              className="h-11 rounded-xl border px-5 text-sm font-bold"
            >
              Batal
            </button>
          )}
        </div>
      </section>
      <section className="mt-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">Foto tersimpan</h2>
          <span className="text-sm text-muted-foreground">
            {items.length} foto
          </span>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((item) => (
            <article
              key={item.id}
              className="overflow-hidden rounded-2xl border bg-white shadow-sm"
            >
              <img
                src={`/api/publication-media/${item.id}/image`}
                alt={item.title}
                className="aspect-[16/9] w-full object-cover"
                loading="lazy"
              />
              <div className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-bold uppercase text-emerald-700">
                      {item.mediaType === "banner" ? "Banner" : "Galeri"}
                    </span>
                    <h3 className="mt-2 font-bold">
                      {item.title || item.imageName}
                    </h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Urutan {item.sortOrder} ·{" "}
                      {item.isActive ? "Aktif" : "Nonaktif"}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => edit(item)}
                      aria-label="Edit"
                      className="grid size-9 place-items-center rounded-lg border"
                    >
                      <Pencil className="size-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(item)}
                      aria-label="Hapus"
                      className="grid size-9 place-items-center rounded-lg border text-rose-600"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
        {!items.length && (
          <div className="rounded-2xl border border-dashed bg-white p-10 text-center text-sm text-muted-foreground">
            Belum ada foto kegiatan.
          </div>
        )}
      </section>
    </div>
  );
}
