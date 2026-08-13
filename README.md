# IHatePDF

MVP client-side dari [PRD_PDF_Tools_Website.md](./PRD_PDF_Tools_Website.md) — platform pengolah PDF online ala iLovePDF.
Semua tool di bawah ini berjalan **sepenuhnya di browser**: tidak ada file yang diunggah ke server manapun.

## Stack

- Next.js 16 (App Router) + TypeScript + TailwindCSS, komponen UI ala shadcn/ui (ditulis manual, tanpa CLI)
- [pdf-lib](https://github.com/Hopding/pdf-lib) — operasi struktural PDF (merge, split, rotate, watermark, dll)
- [pdfjs-dist](https://github.com/mozilla/pdf.js) — render thumbnail halaman & ekspor PDF→gambar
- [qpdf.js](https://github.com/j3k0/qpdf.js) (QPDF di-compile ke WebAssembly, jalan di Web Worker) — satu-satunya hal yang tidak bisa dilakukan pdf-lib: enkripsi/dekripsi PDF asli (Protect/Unlock)
- @dnd-kit — drag & drop reorder file/halaman

## Tool yang tersedia (12)

| Kategori | Tool | Rute |
|---|---|---|
| Organize | Merge PDF | `/tools/merge-pdf` |
| Organize | Split PDF | `/tools/split-pdf` |
| Organize | Remove Pages | `/tools/remove-pages` |
| Organize | Extract Pages | `/tools/extract-pages` |
| Organize | Reorder Pages | `/tools/reorder-pages` |
| Organize | Rotate PDF | `/tools/rotate-pdf` |
| Convert to PDF | JPG/PNG to PDF | `/tools/jpg-to-pdf` |
| Convert from PDF | PDF to JPG | `/tools/pdf-to-jpg` |
| Edit | Add Watermark | `/tools/watermark-pdf` |
| Edit | Add Page Numbers | `/tools/page-numbers` |
| Security | Protect PDF | `/tools/protect-pdf` |
| Security | Unlock PDF | `/tools/unlock-pdf` |

Semua rute di atas sudah diuji end-to-end (upload → proses → download) dengan Playwright, termasuk alur enkripsi/dekripsi via worker WASM qpdf.

## Menjalankan secara lokal

```bash
npm install   # otomatis menyalin runtime qpdf.js ke public/qpdf/ (lihat postinstall)
npm run dev   # http://localhost:3000
```

```bash
npm run build   # production build (Turbopack)
npm run lint
```

## Struktur penting

```
src/
  app/tools/<slug>/page.tsx   # satu halaman per tool
  components/                 # UI + komponen bersama (dropzone, grid thumbnail, dll)
  hooks/use-pdf-thumbnails.ts # render halaman PDF jadi thumbnail untuk grid pemilih
  lib/pdf/*.ts                # semua logic pdf-lib/pdfjs/qpdf, terpisah dari UI
  lib/tools.ts                # katalog tool (dipakai landing page & header halaman tool)
scripts/copy-qpdf-assets.mjs  # postinstall: salin worker+wasm qpdf.js ke public/qpdf/
```

## Yang sengaja di luar scope MVP ini

Sesuai keputusan scope "client-side only" di PRD §10 Fase 1, belum diimplementasikan:

- **Compress PDF / Repair PDF** — butuh Ghostscript di server.
- **Convert Office (Word/Excel/PPT) ↔ PDF, HTML to PDF, OCR** — butuh LibreOffice/Tesseract headless di server.
- **Auth, dashboard riwayat file, subscription/payment, multi-bahasa** — bagian platform non-tool di PRD §3.7 & §8, butuh Supabase + backend.
- **Sign PDF, Redact PDF, Compare PDF, Crop PDF, Edit PDF (teks/gambar bebas)** — bisa dibangun client-side juga, belum masuk batch pertama ini.

Semuanya konsisten dengan roadmap Fase 2/3 di PRD dan bisa ditambah berikutnya tanpa mengubah arsitektur (tool baru = 1 halaman baru + fungsi baru di `lib/pdf/`).
