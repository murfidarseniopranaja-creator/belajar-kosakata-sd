# KosaKata — Belajar jadi seru! 🌱

Starter frontend untuk aplikasi belajar kosakata bahasa Inggris bagi siswa sekolah dasar. Dibuat dengan React, Vite, TypeScript, Tailwind CSS, Lucide, dan Supabase JS.

## Menjalankan di komputer

```bash
npm install
cp .env.example .env.local
npm run dev
```

Aplikasi dapat dijalankan tanpa kredensial Supabase dengan data contoh. Untuk menghubungkan Supabase, isi `VITE_SUPABASE_URL` dan `VITE_SUPABASE_ANON_KEY` di `.env.local`, lalu jalankan ulang dev server.

## Perintah

- `npm run dev` — server pengembangan Vite
- `npm run build` — pemeriksaan TypeScript dan build produksi
- `npm run preview` — melihat build produksi secara lokal

## Supabase

Jalankan `supabase/schema.sql` di SQL Editor proyek Supabase untuk membuat tabel `categories`, `vocabulary`, dan `quiz_scores`.

## Deploy ke Vercel

Impor repositori di Vercel dan biarkan framework terdeteksi sebagai Vite. Atur environment variables `VITE_SUPABASE_URL` dan `VITE_SUPABASE_ANON_KEY` jika ingin menggunakan Supabase. `vercel.json` sudah mengarahkan permintaan halaman ke `index.html` agar routing SPA tidak menghasilkan 404 saat refresh.
