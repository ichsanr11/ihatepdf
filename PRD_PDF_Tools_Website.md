# Product Requirements Document (PRD)
## Platform Pengolah PDF Online (Clone iLovePDF)

**Versi:** 1.0
**Tanggal:** 12 Agustus 2026
**Pemilik Produk:** Paw
**Status:** Draft

---

## 1. Latar Belakang & Tujuan

Membangun platform web untuk mengolah file PDF secara online (merge, split, compress, convert, edit, dll.), sebagai alternatif ringan dari iLovePDF. Fokus utama produk: performa cepat, biaya infrastruktur rendah, dan privasi pengguna (file tidak disimpan permanen).

**Tujuan bisnis:**
- Menyediakan tool PDF gratis yang menarik traffic organik (SEO per-tool)
- Membangun basis pengguna terdaftar untuk fitur premium (batch processing, file besar, tanpa iklan, riwayat file)
- Monetisasi via langganan premium dan/atau iklan

**Tujuan produk:**
- Semua operasi umum PDF tersedia dalam satu platform
- Proses cepat, sebagian besar tanpa upload ke server (client-side)
- Aman: file otomatis terhapus setelah periode tertentu

---

## 2. Target Pengguna

- Pelajar/mahasiswa (compress tugas, convert ke Word)
- Pekerja kantoran (merge dokumen, tanda tangan, convert Excel/PPT)
- Freelancer/UMKM (invoice, kontrak, watermark, proteksi dokumen)
- Pengguna umum yang butuh tool cepat tanpa install software

---

## 3. Lingkup Fitur (Scope)

### 3.1 Organize PDF
| Fitur | Deskripsi | Eksekusi |
|---|---|---|
| Merge PDF | Gabung beberapa PDF jadi satu | Client-side |
| Split PDF | Pisah PDF per halaman/range | Client-side |
| Remove Pages | Hapus halaman tertentu | Client-side |
| Extract Pages | Ambil halaman tertentu jadi file baru | Client-side |
| Reorder/Sort Pages | Ubah urutan halaman | Client-side |
| Rotate PDF | Putar halaman | Client-side |

### 3.2 Optimize
| Fitur | Deskripsi | Eksekusi |
|---|---|---|
| Compress PDF | Kecilkan ukuran file (basic/strong/extreme) | Server (Ghostscript) |
| Repair PDF | Perbaiki file corrupt | Server |

### 3.3 Convert to PDF
| Fitur | Deskripsi | Eksekusi |
|---|---|---|
| JPG/PNG to PDF | Gambar ke PDF | Client-side |
| Word/Excel/PPT to PDF | Office ke PDF | Server (LibreOffice headless) |
| HTML to PDF | Halaman web ke PDF | Server |

### 3.4 Convert from PDF
| Fitur | Deskripsi | Eksekusi |
|---|---|---|
| PDF to Word/Excel/PPT | PDF ke Office | Server (LibreOffice headless) |
| PDF to JPG/PNG | PDF ke gambar | Server (poppler) |
| PDF to PDF/A | Format arsip | Server |

### 3.5 Edit PDF
| Fitur | Deskripsi | Eksekusi |
|---|---|---|
| Edit PDF | Tambah teks, gambar, bentuk | Client-side |
| Add Page Numbers | Nomor halaman | Client-side |
| Add Watermark | Watermark teks/gambar | Client-side |
| Crop PDF | Potong margin/area | Client-side |

### 3.6 Security
| Fitur | Deskripsi | Eksekusi |
|---|---|---|
| Protect PDF | Tambah password | Client-side |
| Unlock PDF | Hapus password (jika diketahui) | Client-side |
| Sign PDF | Tanda tangan digital/gambar | Client-side |
| Redact PDF | Hitamkan/hapus data sensitif | Client-side |
| Compare PDF | Bandingkan 2 versi dokumen | Server |

### 3.7 Fitur Platform (Non-tool)
- Autentikasi (email, Google OAuth)
- Dashboard riwayat file & job (untuk user login)
- Auto-delete file setelah 1–2 jam (guest) / sesuai plan (member)
- Batas ukuran file & jumlah proses harian (guest vs free vs premium)
- Halaman status/progress job (real-time) untuk proses berat
- Multi-bahasa (ID/EN)
- Sistem langganan (Free / Pro / Business)

**Di luar scope v1:** aplikasi mobile native, API publik berbayar, kolaborasi real-time multi-user, e-signature bersertifikat legal (hanya visual signature).

---

## 4. Tech Stack

| Layer | Teknologi |
|---|---|
| Frontend | Next.js (App Router) + TypeScript + TailwindCSS + shadcn/ui |
| Hosting Frontend | Vercel |
| Proses PDF ringan | pdf-lib, pdf.js, jsPDF (jalan di browser) |
| Backend proses berat | Node.js/Python microservice (Docker) — LibreOffice headless, Ghostscript, poppler, Tesseract OCR |
| Hosting backend berat | Fly.io / Railway / VPS |
| Database | Supabase (Postgres) |
| Storage file | Supabase Storage + auto-delete via pg_cron |
| Auth | Supabase Auth |
| Realtime status job | Supabase Realtime |
| Queue job berat | pg-boss (di atas Postgres Supabase) |
| Payment | Midtrans (utama) / Stripe (opsional global) |

---

## 5. Arsitektur Alur Sistem

1. User upload file → untuk tool ringan, diproses langsung di browser (tidak pernah menyentuh server) → hasil didownload langsung.
2. Untuk tool berat: file diupload ke Supabase Storage → job dibuat di tabel `jobs` → worker backend mengambil job dari queue → proses → hasil diupload kembali ke Storage → status job diupdate → frontend mendapat notifikasi via Supabase Realtime → user download hasil.
3. Cron job (pg_cron/Edge Function terjadwal) menghapus file di Storage yang sudah melewati masa retensi.

---

## 6. Model Data (Ringkas)

**users** — dikelola Supabase Auth (id, email, plan, created_at)

**jobs**
- id, user_id (nullable untuk guest), tool_type, status (pending/processing/done/failed), input_file_url, output_file_url, created_at, expires_at

**usage_limits**
- user_id/session_id, date, jumlah_proses, total_ukuran_file

**subscriptions**
- user_id, plan, status, provider_ref, current_period_end

---

## 7. Non-Functional Requirements

- Waktu proses client-side: instan–2 detik untuk file <20MB
- Waktu proses server-side: <30 detik untuk file <20MB (compress/convert)
- Ukuran file maksimum: 20MB (guest), 50MB (free), 200MB+ (premium)
- File otomatis terhapus dari storage maksimum 2 jam setelah proses (guest)
- Uptime target: 99.5%
- Semua transfer file via HTTPS, file di-encrypt at rest (default Supabase Storage)

---

## 8. Monetisasi

| Plan | Harga (indikatif) | Batasan |
|---|---|---|
| Free/Guest | Rp0 | Limit ukuran file, limit proses harian, ada iklan |
| Pro | ~Rp39.000–59.000/bulan | File lebih besar, tanpa iklan, riwayat file, batch processing |
| Business | Custom | Multi-user, prioritas proses, retensi file lebih lama |

---

## 9. Metrik Keberhasilan (KPI)

- Jumlah file diproses per hari
- Conversion rate guest → registered user
- Conversion rate free → paid
- Average processing time per tool
- Bounce rate halaman tool (indikator SEO & UX)

---

## 10. Roadmap (Indikatif)

**Fase 1 (MVP — 4–6 minggu)**
Merge, split, compress, PDF↔JPG, protect/unlock, watermark, page numbers. Auth dasar, auto-delete file.

**Fase 2 (6–8 minggu)**
PDF↔Word/Excel/PPT, edit PDF, sign PDF, dashboard riwayat, sistem plan & payment.

**Fase 3**
OCR, redact, compare PDF, batch processing, optimasi performa, multi-bahasa.

---

## 11. Risiko & Mitigasi

| Risiko | Mitigasi |
|---|---|
| Biaya server membengkak akibat proses berat (convert/OCR) | Maksimalkan proses client-side; batasi ukuran file & rate limit untuk guest |
| File sensitif tersimpan lama | Auto-delete agresif + enkripsi + kebijakan retensi jelas |
| Beban server saat traffic tinggi | Queue system (pg-boss) + auto-scaling worker berbasis Docker |
| Kompetisi tool sejenis sudah mapan | Fokus SEO tool-specific page + UX lebih cepat & ringan |
