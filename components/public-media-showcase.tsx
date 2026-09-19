"use client";

import { ChevronLeft, ChevronRight, ExternalLink } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { PublicMediaItem } from "@/db/public-media";

export function PublicMediaShowcase({ items }: { items: PublicMediaItem[] }) {
  const [active, setActive] = useState(0);
  const touch = useRef(0);
  useEffect(() => {
    if (items.length < 2) return;
    const timer = window.setInterval(
      () => setActive((value) => (value + 1) % items.length),
      6000,
    );
    return () => window.clearInterval(timer);
  }, [items.length]);
  if (!items.length) return null;
  const current = items[Math.min(active, items.length - 1)];
  const move = (step: number) =>
    setActive((value) => (value + step + items.length) % items.length);
  return (
    <section className="bg-[#0d2f20] px-4 pb-3 pt-3 sm:px-0 sm:pb-0 sm:pt-0">
      <div
        className="relative mx-auto aspect-[16/9] w-full overflow-hidden rounded-2xl bg-emerald-950 shadow-2xl sm:h-[min(72vh,760px)] sm:aspect-auto sm:max-h-none sm:max-w-none sm:rounded-none"
        onTouchStart={(event) => {
          touch.current = event.touches[0].clientX;
        }}
        onTouchEnd={(event) => {
          const delta = event.changedTouches[0].clientX - touch.current;
          if (Math.abs(delta) > 45) move(delta > 0 ? -1 : 1);
        }}
      >
        {items.map((item, index) => (
          <img
            key={item.id}
            src={`/api/public-media/${item.id}/image`}
            alt={item.title || "Kegiatan TDA Pekanbaru"}
            className={`absolute inset-0 size-full object-cover transition-opacity duration-700 ${index === active ? "opacity-100" : "opacity-0"}`}
            loading={index === 0 ? "eager" : "lazy"}
          />
        ))}
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" />
        {(current.title || current.description) && (
          <div className="absolute inset-x-0 bottom-0 p-5 text-white sm:p-9">
            <p className="max-w-3xl text-2xl font-black sm:text-4xl">
              {current.title}
            </p>
            {current.description && (
              <p className="mt-2 max-w-2xl text-sm leading-6 text-white/85 sm:text-base">
                {current.description}
              </p>
            )}
            {current.linkUrl && (
              <a
                href={current.linkUrl}
                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-emerald-900"
              >
                Lihat Selengkapnya
                <ExternalLink className="size-4" />
              </a>
            )}
          </div>
        )}
        {items.length > 1 && (
          <>
            <button
              type="button"
              aria-label="Banner sebelumnya"
              onClick={() => move(-1)}
              className="absolute left-3 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-full bg-black/35 text-white backdrop-blur hover:bg-black/55"
            >
              <ChevronLeft />
            </button>
            <button
              type="button"
              aria-label="Banner berikutnya"
              onClick={() => move(1)}
              className="absolute right-3 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-full bg-black/35 text-white backdrop-blur hover:bg-black/55"
            >
              <ChevronRight />
            </button>
            <div className="absolute bottom-3 right-4 flex gap-1.5">
              {items.map((item, index) => (
                <button
                  key={item.id}
                  type="button"
                  aria-label={`Buka banner ${index + 1}`}
                  onClick={() => setActive(index)}
                  className={`h-2 rounded-full transition-all ${index === active ? "w-7 bg-white" : "w-2 bg-white/55"}`}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  );
}

export function PublicGallery({ items }: { items: PublicMediaItem[] }) {
  if (!items.length) return null;
  return (
    <section className="mx-auto max-w-7xl px-5 pb-16">
      <p className="text-sm font-bold uppercase tracking-[.16em] text-emerald-700">
        Dokumentasi
      </p>
      <h2 className="mt-2 text-3xl font-black">Kegiatan TDA Pekanbaru</h2>
      <p className="mt-2 max-w-2xl text-slate-600">
        Momen belajar, berjejaring, dan bertumbuh bersama para pengusaha
        Pekanbaru.
      </p>
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {items.map((item, index) => (
          <a
            key={item.id}
            href={item.linkUrl || `/api/public-media/${item.id}/image`}
            target={item.linkUrl ? undefined : "_blank"}
            className={`group relative overflow-hidden rounded-2xl bg-slate-200 ${index === 0 ? "col-span-2 row-span-2" : ""}`}
          >
            <img
              src={`/api/public-media/${item.id}/image`}
              alt={item.title || "Dokumentasi TDA Pekanbaru"}
              loading="lazy"
              className="aspect-square size-full object-cover transition duration-500 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-transparent" />
            <div className="absolute inset-x-0 bottom-0 p-3 text-white sm:p-4">
              <p className="font-bold">
                {item.title || "Kegiatan TDA Pekanbaru"}
              </p>
              {item.eventDate && (
                <p className="mt-1 text-xs text-white/75">
                  {new Intl.DateTimeFormat("id-ID", {
                    dateStyle: "long",
                  }).format(new Date(`${item.eventDate}T00:00:00+07:00`))}
                </p>
              )}
            </div>
          </a>
        ))}
      </div>
    </section>
  );
}
