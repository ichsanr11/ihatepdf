# IHatePDF

MVP client-side dari [PRD_PDF_Tools_Website.md](./PRD_PDF_Tools_Website.md) — platform pengolah PDF online ala iLovePDF.
Semua tool di bawah ini berjalan **sepenuhnya di browser**: file Anda tidak pernah diunggah ke server manapun (satu pengecualian jujur soal OCR — lihat [Privasi](#privasi) di bawah).

## Stack

- Next.js 16 (App Router) + TypeScript + TailwindCSS, komponen UI ala shadcn/ui (ditulis manual, tanpa CLI)
- [pdf-lib](https://github.com/Hopding/pdf-lib) — operasi struktural PDF (merge, split, rotate, watermark, kompresi gambar, dll)
- [pdfjs-dist](https://github.com/mozilla/pdf.js) — render thumbnail halaman & ekspor PDF→gambar
- [qpdf.js](https://github.com/j3k0/qpdf.js) (QPDF di-compile ke WebAssembly, jalan di Web Worker) — enkripsi/dekripsi PDF asli (Protect/Unlock), satu-satunya hal yang tidak bisa dilakukan pdf-lib
- [tesseract.js](https://github.com/naptha/tesseract.js) (Tesseract OCR di-compile ke WebAssembly, jalan di Web Worker) — OCR PDF hasil scan jadi bisa dicari/disalin teksnya
- @dnd-kit — drag & drop reorder file/halaman

## Tool yang tersedia (15)

| Kategori | Tool | Rute |
|---|---|---|
| Organize | Merge PDF | `/tools/merge-pdf` |
| Organize | Split PDF | `/tools/split-pdf` |
| Organize | Remove Pages | `/tools/remove-pages` |
| Organize | Extract Pages | `/tools/extract-pages` |
| Organize | Reorder Pages | `/tools/reorder-pages` |
| Organize | Rotate PDF | `/tools/rotate-pdf` |
| Optimize | Compress PDF | `/tools/compress-pdf` |
| Optimize | Repair PDF | `/tools/repair-pdf` |
| Optimize | OCR PDF | `/tools/ocr-pdf` |
| Convert to PDF | JPG/PNG to PDF | `/tools/jpg-to-pdf` |
| Convert from PDF | PDF to JPG | `/tools/pdf-to-jpg` |
| Edit | Add Watermark | `/tools/watermark-pdf` |
| Edit | Add Page Numbers | `/tools/page-numbers` |
| Security | Protect PDF | `/tools/protect-pdf` |
| Security | Unlock PDF | `/tools/unlock-pdf` |

Semua rute di atas sudah diuji end-to-end (upload → proses → download, cek console error) dengan Playwright terhadap dev server sungguhan — bukan cuma lolos build.

### Bagaimana Optimize PDF bisa jalan tanpa server?

PRD aslinya menandai Compress/Repair/OCR sebagai proses server (Ghostscript, Tesseract headless). Supaya tetap konsisten dengan arsitektur "client-side only", ketiganya diimplementasi ulang pakai teknik yang genuinely jalan di browser:

- **Compress PDF** — bukan re-render seluruh halaman jadi gambar (itu akan merusak teks vector). Tool ini mencari setiap gambar yang di-embed di dalam PDF — baik JPEG (`DCTDecode`) maupun raw bitmap `FlateDecode` (DeviceGray/DeviceRGB 8bpc, umum untuk screenshot/"print to PDF"/gambar asal PNG) — meng-kompres ulang lewat `<canvas>` di level kualitas/resolusi pilihan, lalu menaruh kembali bytes yang lebih kecil ke object PDF yang sama. Gambar dengan soft mask (transparansi) tetap ikut dikompres (viewer me-resample mask-nya independen, sesuai ISO 32000-2 §8.9.6); yang dilewati hanya gambar dengan stencil/color-key `Mask`, Indexed/CMYK/ICC color space, atau filter berantai, karena berisiko rusak kalau ikut diproses. Teks & vector tidak disentuh sama sekali. Ada juga mode "Target ukuran maksimum" (mis. ≤10MB) yang mencoba beberapa tingkat kompresi berurutan sampai tercapai. PDF yang isinya teks murni (tanpa gambar) wajar tidak banyak mengecil — itu bukan bug, tapi cara kerja tool ini didokumentasikan di UI-nya sendiri.
- **Repair PDF** — parse file selenggang mungkin (skip object yang rusak alih-alih berhenti), lalu tulis ulang strukturnya dari nol. Efektif untuk xref table/struktur yang korup; tidak bisa merekonstruksi data yang memang hilang/terpotong.
- **OCR PDF** — setiap halaman di-render jadi gambar, dibaca lewat Tesseract (WASM, jalan di Web Worker), lalu digabung jadi satu PDF baru berisi gambar halaman + lapisan teks tak terlihat yang posisinya presisi (fitur PDF-output bawaan Tesseract sendiri, bukan hasil hitung manual). Hasilnya: PDF yang teksnya bisa di-select & dicari.

## Privasi

Semua proses berjalan lokal — **kecuali OCR**, yang mengunduh model bahasa (data publik ±5–15MB/bahasa, bukan data Anda) dari CDN sekali saat pertama dipakai, lalu di-cache browser. Mesin OCR & worker-nya sendiri sudah di-hosting sendiri (self-hosted), bukan CDN. Detail lengkap ada di halaman [/privacy](./src/app/privacy/page.tsx).

## Menjalankan secara lokal

```bash
npm install   # otomatis menyalin runtime qpdf.js & tesseract.js ke public/ (lihat postinstall)
npm run dev   # http://localhost:3210
```

```bash
npm run build   # production build (Turbopack)
npm run lint
```

## Struktur penting

```
src/
  app/tools/<slug>/page.tsx        # satu halaman per tool
  components/                       # UI + komponen bersama (dropzone, grid thumbnail, dll)
  hooks/use-pdf-thumbnails.ts       # render halaman PDF jadi thumbnail untuk grid pemilih
  lib/pdf/*.ts                      # semua logic pdf-lib/pdfjs/qpdf/tesseract, terpisah dari UI
  lib/tools.ts                      # katalog tool (dipakai landing page & header halaman tool)
scripts/copy-qpdf-assets.mjs        # postinstall: salin worker+wasm qpdf.js ke public/qpdf/
scripts/copy-tesseract-assets.mjs   # postinstall: salin worker+wasm tesseract.js ke public/tesseract/
```

## Yang sengaja di luar scope MVP ini

Sesuai keputusan scope "client-side only" di PRD §10 Fase 1, belum diimplementasikan:

- **Convert Office (Word/Excel/PPT) ↔ PDF, HTML to PDF** — butuh LibreOffice headless di server, tidak ada padanan client-side yang genuine.
- **Auth, dashboard riwayat file, subscription/payment, multi-bahasa** — bagian platform non-tool di PRD §3.7 & §8, butuh Supabase + backend.
- **Sign PDF, Redact PDF, Compare PDF, Crop PDF, Edit PDF (teks/gambar bebas)** — bisa dibangun client-side juga, belum masuk batch ini.

Semuanya konsisten dengan roadmap Fase 2/3 di PRD dan bisa ditambah berikutnya tanpa mengubah arsitektur (tool baru = 1 halaman baru + fungsi baru di `lib/pdf/`).
