# TDA Pekanbaru 9.0

Baseline source code aplikasi Manajemen Program TDA Pekanbaru 9.0.

## Baseline

- Versi aplikasi: **61**
- Domain produksi saat baseline: `https://tdapku.my.id`
- Tujuan repository: backup source sebelum migrasi ke VPS

## Teknologi

- Runtime: Node.js 22 atau lebih baru
- Framework: Vinext / Next.js 16 dengan React 19 dan Vite 8
- UI: Tailwind CSS dan Shadcn-compatible components
- Database produksi saat baseline: Cloudflare D1 (binding `DB`)
- File upload produksi saat baseline: Cloudflare R2 (binding `BUCKET`)
- ORM dan migration: Drizzle ORM / Drizzle Kit

## Struktur utama

- `app/` — halaman dan API routes
- `components/` — modul backoffice, pendaftaran publik, dan komponen antarmuka
- `db/` — query, layanan data, dan `schema.ts`
- `drizzle/` — migration dan snapshot database
- `worker/` — entrypoint Cloudflare Worker
- `public/` — asset publik non-sensitif
- `scripts/` — skrip instalasi dan build
- `.openai/hosting.json` — deklarasi binding D1/R2 untuk hosting saat ini

## Menjalankan secara lokal

```bash
npm ci
npm run dev
```

Build produksi:

```bash
npm run build
```

Generate migration setelah perubahan schema:

```bash
npm run db:generate
```

## Environment dan data

Salin `.env.example` menjadi `.env` hanya di lingkungan lokal atau VPS, lalu isi nilainya di sana. Jangan pernah commit `.env`, token, password, private key, dump database, atau dokumen peserta.

Versi 61 tidak menyimpan data produksi dalam repository. Data berada di Cloudflare D1 dan file upload berada di Cloudflare R2. Keduanya perlu dibackup serta dipindahkan terpisah saat migrasi VPS.

## Catatan migrasi VPS

Source baseline ini dapat dipakai sebagai dasar migrasi, tetapi belum dapat langsung dijalankan pada VPS biasa tanpa adaptasi. Saat ini kode mengakses binding Cloudflare `DB` dan `BUCKET` melalui `cloudflare:workers`.

Migrasi VPS perlu mengganti atau menyediakan adapter yang setara untuk:

- database (misalnya PostgreSQL atau MySQL);
- object storage/upload (misalnya S3/MinIO atau storage lokal yang dibackup);
- runtime dan reverse proxy HTTPS.

Sebelum cutover, lakukan restore database dan file upload pada lingkungan staging, lalu verifikasi registrasi member, event, pembayaran, check-in QR, Bendahara, dan halaman publik.

## Keamanan backup

`.gitignore` mengecualikan environment file, data, backup, log, cache, credential, private key, dan folder upload privat. Migration `drizzle/`, schema, source code, lockfile, serta asset publik tetap dilacak.
