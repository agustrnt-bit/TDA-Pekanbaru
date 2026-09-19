# Migrasi VPS TDA Pekanbaru 9.0 — Versi 61

## Safety fence
- Baseline immutable: `cd8ea7e1a86ea6200ca76d0e8106cf2b216ba930`.
- `main` tetap menjadi baseline Versi 61.
- Semua pekerjaan migrasi dilakukan pada branch `migration/vps-staging-v61`.
- Jangan mengubah DNS/domain `tdapku.my.id` sebelum staging lulus UAT dan ada persetujuan eksplisit.
- Jangan reset/hapus D1, R2, authentication, data, atau aplikasi live.
- Jangan commit `.env`, token, password, private key, dump database, atau file upload produksi.

## Audit baseline
- Node.js `>=22.13.0`.
- Vinext / Next.js 16, React 19, Vite 8.
- Cloudflare D1 binding: `DB`.
- Cloudflare R2 binding: `BUCKET`.
- Drizzle ORM/Kit, tetapi banyak service memakai API D1 langsung: `prepare`, `bind`, `all`, `first`, `run`, `batch`.
- Ada SQL SQLite-specific seperti `COLLATE NOCASE`.
- Authentication baseline membaca header `oai-authenticated-user-*` dari ChatGPT Sites.

## Arsitektur staging yang dipilih

```text
Internet tester
   |
Nginx + HTTPS
   |
TDA App (Node.js 22, Docker)
   |-- PostgreSQL (private Docker network)
   |-- private persistent upload storage

Backup offsite:
- pg_dump
- archive/checksum upload files
```

Docker Compose dipilih agar runtime aplikasi, PostgreSQL, persistent storage, dan rollback lebih mudah dikelola serta terisolasi dari aplikasi lain di VPS.

## Target VPS
Contoh struktur:

```text
/srv/tda-staging/
  app/
  env/.env.staging
  storage/uploads/
  backups/postgres/
  backups/uploads/
  logs/
```

`env/.env.staging`, database dump, dan upload produksi tidak boleh masuk GitHub.

## Tahapan migrasi
1. Audit dan hardening VPS.
2. Install Docker Engine/Compose dan Nginx.
3. Clone branch `migration/vps-staging-v61`.
4. Buat PostgreSQL staging dan storage staging kosong.
5. Adaptasi runtime Cloudflare -> Node.
6. Buat database compatibility layer D1 -> PostgreSQL.
7. Buat storage adapter R2 -> private VPS storage.
8. Buat authentication adapter untuk staging tanpa mengubah mapping user/role/division existing.
9. Build dan jalankan aplikasi dengan data staging kosong.
10. Export snapshot D1 dan seluruh object R2 tanpa menghapus sumber.
11. Import ke PostgreSQL/storage staging.
12. Rekonsiliasi jumlah row, object key, ukuran file, dan checksum.
13. UAT seluruh modul.
14. Siapkan backup final dan rollback plan.
15. Domain baru diarahkan hanya setelah persetujuan eksplisit.

## UAT wajib
- Login dan hak akses.
- Dashboard.
- Program Kerja.
- Kehadiran dan QR check-in.
- Pendaftaran Event.
- Pembayaran/Bendahara/LPJ.
- Pendaftaran Member dan Kelas Reguler.
- Feedback.
- Halaman publik.
- Upload/download flyer, QRIS, bukti pembayaran, receipt, foto, dokumen, attachment.
- Performa dan error log.

## Go-live fence
Sebelum cutover harus tersedia laporan:
- URL staging.
- commit/image yang sedang diuji.
- hasil UAT.
- jumlah tabel/row hasil migrasi.
- jumlah file/object dan total ukuran hasil migrasi.
- daftar risiko/temuan.
- backup final D1/R2.
- rollback procedure.

Tidak ada perubahan DNS atau penghentian aplikasi live sebelum seluruh poin di atas disetujui.