# IHatePDF

MVP client-side dari [PRD_PDF_Tools_Website.md](./PRD_PDF_Tools_Website.md) — platform pengolah PDF online ala iLovePDF.
Semua tool di bawah ini berjalan **sepenuhnya di browser**: file Anda tidak pernah diunggah ke server manapun (satu pengecualian jujur soal OCR — lihat [Privasi](#privasi) di bawah).

## Stack

- Next.js 16 (App Router) + TypeScript + TailwindCSS, komponen UI ala shadcn/ui (ditulis manual, tanpa CLI)
- [pdf-lib](https://github.com/Hopding/pdf-lib) — operasi struktural PDF (merge, split, rotate, watermark, kompresi gambar, dll)
- [pdfjs-dist](https://github.com/mozilla/pdf.js) — render thumbnail halaman & ekspor PDF→gambar
- [qpdf.js](https://github.com/j3k0/qpdf.js) (QPDF di-compile ke WebAssembly, jalan di Web Worker) — enkripsi/dekripsi PDF asli (Protect/Unlock), satu-satunya hal yang tidak bisa dilakukan pdf-lib
- [tesseract.js](https://github.com/naptha/tesseract.js) (Tesseract OCR di-compile ke WebAssembly, jalan di Web Worker) — OCR PDF hasil scan jadi bisa dicari/disalin teksnya
- [docx](https://github.com/dolanmiu/docx) — generate file `.docx` asli di browser untuk PDF to Word
- @dnd-kit — drag & drop reorder file/halaman
- Daftar kata Indonesia & Inggris (top 10k tersering, dari [`most-common-words-by-language`](https://www.npmjs.com/package/most-common-words-by-language) / [FrequencyWords](https://github.com/hermitdave/FrequencyWords), MIT) — klasifikasi kata untuk Dictionary ID-EN

## Tool yang tersedia (21)

| Kategori | Tool | Rute |
|---|---|---|
| **Workflow** | **Workflow (Gabungan Tool)** | `/tools/workflow` |
| Organize | Merge PDF | `/tools/merge-pdf` |
| Organize | Split PDF | `/tools/split-pdf` |
| Organize | Remove Pages | `/tools/remove-pages` |
| Organize | Extract Pages | `/tools/extract-pages` |
| Organize | Reorder Pages | `/tools/reorder-pages` |
| Organize | Rotate PDF | `/tools/rotate-pdf` |
| Organize | Luruskan Scan (Deskew) | `/tools/deskew-pdf` |
| Optimize | Compress PDF | `/tools/compress-pdf` |
| Optimize | Repair PDF | `/tools/repair-pdf` |
| Optimize | OCR PDF | `/tools/ocr-pdf` |
| Convert to PDF | JPG/PNG to PDF | `/tools/jpg-to-pdf` |
| Convert from PDF | PDF to JPG | `/tools/pdf-to-jpg` |
| Convert from PDF | PDF to Word | `/tools/pdf-to-word` |
| Edit | Add Watermark | `/tools/watermark-pdf` |
| Edit | Add Page Numbers | `/tools/page-numbers` |
| Security | Sign PDF | `/tools/sign-pdf` |
| Security | Remove Signature/Stamp | `/tools/remove-signature` |
| Security | Protect PDF | `/tools/protect-pdf` |
| Security | Unlock PDF | `/tools/unlock-pdf` |
| Bahasa | Dictionary ID-EN | `/tools/dictionary-id-en` |

Semua rute di atas sudah diuji end-to-end (upload → proses → download, cek console error) dengan Playwright terhadap dev server sungguhan — bukan cuma lolos build.

### Bagaimana Optimize PDF bisa jalan tanpa server?

PRD aslinya menandai Compress/Repair/OCR sebagai proses server (Ghostscript, Tesseract headless). Supaya tetap konsisten dengan arsitektur "client-side only", ketiganya diimplementasi ulang pakai teknik yang genuinely jalan di browser:

- **Compress PDF** — bukan re-render seluruh halaman jadi gambar (itu akan merusak teks vector). Tool ini mencari setiap gambar yang di-embed di dalam PDF — baik JPEG (`DCTDecode`) maupun raw bitmap `FlateDecode` (DeviceGray/DeviceRGB 8bpc, umum untuk screenshot/"print to PDF"/gambar asal PNG) — meng-kompres ulang lewat `<canvas>` di level kualitas/resolusi pilihan, lalu menaruh kembali bytes yang lebih kecil ke object PDF yang sama. Gambar dengan soft mask (transparansi) tetap ikut dikompres (viewer me-resample mask-nya independen, sesuai ISO 32000-2 §8.9.6); yang dilewati hanya gambar dengan stencil/color-key `Mask`, Indexed/CMYK/ICC color space, atau filter berantai, karena berisiko rusak kalau ikut diproses. Teks & vector tidak disentuh sama sekali. Ada juga mode "Target ukuran maksimum" (mis. ≤10MB) yang mencoba beberapa tingkat kompresi berurutan sampai tercapai. PDF yang isinya teks murni (tanpa gambar) wajar tidak banyak mengecil — itu bukan bug, tapi cara kerja tool ini didokumentasikan di UI-nya sendiri.
- **Repair PDF** — parse file selenggang mungkin (skip object yang rusak alih-alih berhenti), lalu tulis ulang strukturnya dari nol. Efektif untuk xref table/struktur yang korup; tidak bisa merekonstruksi data yang memang hilang/terpotong.
- **OCR PDF** — setiap halaman di-render jadi gambar, dibaca lewat Tesseract (WASM, jalan di Web Worker), lalu digabung jadi satu PDF baru berisi gambar halaman + lapisan teks tak terlihat yang posisinya presisi (fitur PDF-output bawaan Tesseract sendiri, bukan hasil hitung manual). Hasilnya: PDF yang teksnya bisa di-select & dicari.

### Luruskan Scan (Deskew)

Beda dengan Rotate PDF (cuma putar 90°/180°/270°, untuk orientasi) — ini untuk hasil **scan yang miring beberapa derajat** (umum terjadi kalau kertas tidak pas lurus di scanner). Per halaman: atur sudut lewat slider/input angka (langkah 0.1°, -45° sampai 45°), dengan **pratinjau langsung** (gambar halaman diputar via CSS, dengan garis bantu putus-putus sebagai referensi lurus) sebelum diterapkan beneran.

Karena atribut `/Rotate` bawaan PDF cuma mendukung kelipatan 90°, meluruskan sudut sekecil apa pun otomatis berarti halamannya di-render ulang jadi gambar beresolusi tinggi, diputar via `<canvas>`, dengan margin putih tipis supaya konten tidak terpotong di pojok — baru ditanam kembali sebagai halaman baru berukuran sama. **Hanya halaman yang sudutnya benar-benar diubah (tidak 0°) yang diproses begini** — halaman lain disalin apa adanya, tetap vector/teks asli, tidak ikut terdegradasi. Diverifikasi dengan fixture bergaris + penanda arah: arah rotasi di hasil akhir cocok 1:1 dengan arah di pratinjau (searah jarum jam untuk sudut positif), dan halaman yang tidak disentuh tetap tajam seperti aslinya.

### Workflow (Gabungan Tool)

Merantai beberapa tool sekaligus dalam satu sesi — **tanpa perlu download di antara langkah**. Upload satu PDF (atau beberapa sekaligus untuk otomatis digabung sebagai titik awal), lalu tambahkan langkah satu per satu dari 10 tool yang tersedia: Gabung PDF Lain, Urutkan Ulang Halaman, Hapus Halaman, Ambil Halaman Tertentu, Putar Halaman, Luruskan Scan, Tambah Watermark, Tambah Nomor Halaman, Tanda Tangani, Hapus Tanda Tangan/Cap. Tiap langkah beroperasi langsung di atas hasil langkah sebelumnya (`Uint8Array` di memori), ada riwayat langkah yang sudah diterapkan, tombol **Urungkan** (undo satu langkah terakhir), dan tombol **Download** yang bisa diklik kapan saja — baik di tengah proses maupun di akhir.

Secara teknis ini bukan hasil refactor tool-tool yang sudah ada (biar tidak berisiko merusak yang sudah teruji) — tiap langkah adalah komponen baru di `src/components/workflow/` yang memanggil fungsi `lib/pdf/*.ts` yang sama persis, memakai ulang hook & komponen interaktif yang sama (`usePdfPages`, `PageThumbnailGrid`, `PdfPagePreview`, `SignatureOverlayBox`, dll). Sign PDF di dalam workflow sengaja dibatasi satu tanda tangan per langkah (bukan multi-tanda tangan seperti versi standalone) — untuk tanda tangan kedua tinggal tambahkan langkah "Tanda Tangani" lagi.

Fitur yang butuh server atau yang mengubah byte PDF jadi tidak bisa diedit lagi oleh pdf-lib (Protect PDF/enkripsi, Compress, OCR, Repair) sengaja tidak dimasukkan ke rantai workflow — tool-tool itu lebih cocok jadi langkah terakhir yang berdiri sendiri setelah file di-download.

### Sign PDF

Upload PDF, lalu **tambahkan satu atau beberapa tanda tangan** ("+ Tambah Tanda Tangan") — misalnya tanda tangan dua pihak berbeda di halaman yang sama, atau paraf di tiap halaman plus tanda tangan penuh di halaman terakhir. Tiap tanda tangan independen: gambar sendiri, diseret & diubah ukuran sendiri (posisi/ukuran disimpan sebagai persentase terhadap halaman, bukan pixel, supaya tetap presisi walau halaman ukurannya beda-beda), dan halaman target sendiri (satu halaman tertentu atau "semua halaman") lewat dropdown di kartu daftar tanda tangan. Tombol Terapkan menempelkan semuanya sekaligus via `page.drawImage()` dari pdf-lib dalam satu dokumen hasil. Ada juga opsi **"Hapus latar belakang"** per tanda tangan untuk foto/gambar yang masih punya latar — warna latar dideteksi otomatis dari sampel pojok gambar (bukan diasumsikan putih), lalu piksel yang mirip warna itu dibuat transparan lewat `<canvas>` berdasarkan jarak warna (dengan falloff halus di tepi), jadi berfungsi untuk latar putih, off-white, abu-abu muda, atau tint warna lain sekalipun. Ini visual signature saja (sesuai PRD §3.6), bukan tanda tangan digital bersertifikat yang punya kekuatan hukum.

### Remove Signature/Stamp

Kebalikan dari Sign PDF, dan jujur soal batasan client-side: ada dua jenis tanda tangan/cap di PDF yang perlu ditangani beda.

- **Gambar tertanam (Image XObject)** — cap/stempel hasil scan, atau tanda tangan yang ditempel sebagai gambar (termasuk hasil dari Sign PDF ini sendiri) — tool ini mendeteksi semua gambar di tiap halaman (dengan thumbnail preview untuk JPEG & raw bitmap RGB/Gray, placeholder ikon untuk encoding lain yang tetap bisa dipilih meski tidak ada preview), lalu **beneran menghapusnya**: entry XObject dihapus dari resource dictionary halaman, bukan cuma ditutup. Sudah diverifikasi langsung: pdf.js (dan secara praktik semua viewer PDF serius) melewati referensi gambar yang sudah tidak ada alih-alih error — jadi cara ini aman tanpa perlu membongkar/menulis ulang content stream halaman.
- **Coretan langsung (vector ink atau teks, bukan gambar)** — tanda tangan yang digambar sebagai path/garis langsung ke halaman tidak mungkin "dihapus" tanpa mem-parsing & mengedit content stream PDF secara utuh (di luar scope realistis untuk tool client-side ini). Untuk kasus ini disediakan mode **"Tutup dengan Kotak"**: kotak warna solid (bisa diseret/diubah ukuran/diubah warna) yang digambar via `page.drawRectangle()` menimpa area tersebut. ⚠️ Ini **menutup secara visual, bukan menghapus** — data di baliknya masih ada di dalam file PDF. Kalau alasannya privasi/kerahasiaan (bukan cuma kerapian visual), ini belum cukup sebagai jaminan forensik.

Kedua mode bisa dipakai di satu atau banyak halaman sekaligus — tiap item (gambar yang dipilih atau kotak yang ditambahkan) independen per halaman.

### PDF to Word

Ubah PDF jadi `.docx` yang bisa diedit di Word/Google Docs, dengan **posisi, ukuran font, dan gaya (bold/italic) tiap baris teks dipertahankan** — bukan cuma dump teks mentah berurutan. Tiap halaman PDF di-scan lewat pdf.js (`getTextContent()` + `page.commonObjs` untuk metadata font asli — nama font, bold/italic, ascent — yang tidak tersedia lewat API publik `styles`), lalu tiap potongan teks ditulis sebagai paragraph dengan `frame` posisi absolut (`docx`, satuan twip = 1/20 point) persis di koordinat X/Y yang sama seperti di PDF aslinya, dengan ukuran font dikonversi ke half-point (satuan run size OOXML). Nama font PDF (termasuk font ter-embed dengan prefix subset acak seperti `ABCDEF+Helvetica`) dipetakan ke font standar Word terdekat (Arial, Times New Roman, Courier New, dst).

Diverifikasi dua lapis: isi `word/document.xml` mentah dicek byte-per-byte cocok dengan posisi/ukuran/bold/italic yang diharapkan dari fixture PDF kontrol, lalu hasilnya juga dikonversi lewat pembaca OOXML independen (bukan pdf.js atau kode sendiri) untuk sanity-check. Satu catatan teknis: run yang tidak bold/italic ditulis **tanpa** tag `<w:b>`/`<w:i>` sama sekali (bukan `<w:val="false">`) — sejumlah pembaca DOCX yang kurang strict ternyata salah mengartikan toggle eksplisit `false` sebagai `true`, jadi menghilangkan tag adalah bentuk yang paling kompatibel.

Batasan yang jujur ditampilkan di UI sebelum konversi: ini kecocokan visual yang dekat, bukan pixel-perfect. Warna teks selalu dianggap hitam (warna asli tidak dibaca), teks yang diputar/miring di PDF akan tampil lurus di hasil Word, dan **gambar di dalam PDF belum ikut disalin** — hanya teks. Halaman hasil scan tanpa teks (gambar murni, belum di-OCR) akan menghasilkan halaman kosong di Word — tool ini mendeteksi dan memperingatkan kasus ini, dengan saran menjalankan OCR PDF dulu.

### Dictionary ID-EN — bukan tool PDF, tapi tool teks

Satu-satunya tool di luar kategori PDF: tempel paragraf campuran Indonesia-Inggris, klik Generate, kata bahasa Inggris otomatis dicetak miring sementara kata Indonesia dibiarkan apa adanya. Cara kerjanya (`src/lib/dictionary/`):

1. **Tokenize** teks jadi kata + non-kata (spasi/tanda baca), supaya teks asli bisa direkonstruksi persis.
2. **Klasifikasi tiap kata**: dicek dulu ke daftar 10k kata Indonesia tersering (menang kalau ada — ini yang membuat kata serapan resmi seperti "internet"/"video"/"data" tetap tidak dicetak miring, sesuai konvensi penulisan Indonesia yang sebenarnya), baru kalau tidak ketemu dicek ke daftar 10k kata Inggris tersering. Kata yang tidak ada di keduanya (nama orang, istilah teknis, typo) ditandai "belum dikenali" — **tidak ditebak otomatis**, supaya tidak salah cetak miring.
3. Tiap kata di hasil bisa **diklik untuk toggle** miring/tidak secara manual, termasuk yang "belum dikenali".
4. **Salin hasil** dalam 2 format: HTML asli (`<i>`) via Clipboard API supaya kalau di-paste ke Word/Google Docs beneran jadi italic, atau markdown (`*kata*`) untuk tempat yang tidak menerima rich paste (Slack, Notion, dll).

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
  components/workflow/              # satu komponen "step" per tool, dipakai oleh /tools/workflow
  hooks/use-pdf-thumbnails.ts       # render halaman PDF jadi thumbnail untuk grid pemilih
  hooks/use-pdf-pages.ts            # render thumbnail + render resolusi tinggi on-demand (dipakai Sign PDF & Remove Signature)
  hooks/use-drag-resize-box.ts      # logic drag/resize pointer bersama (overlay tanda tangan & kotak redaksi)
  lib/pdf/removeMarks.ts            # deteksi/hapus Image XObject + terapkan kotak penutup (Remove Signature/Stamp)
  lib/pdf/pdfToWord.ts              # ekstrak teks+posisi+font via pdf.js, susun jadi .docx via docx
  lib/pdf/*.ts                      # semua logic pdf-lib/pdfjs/qpdf/tesseract, terpisah dari UI
  lib/dictionary/*.ts               # tokenizer + classifier + export untuk Dictionary ID-EN
  lib/tools.ts                      # katalog tool (dipakai landing page & header halaman tool)
  data/dict/*.json                  # daftar 10k kata ID & EN tersering, di-vendor statis (lihat SOURCE.md)
scripts/copy-qpdf-assets.mjs        # postinstall: salin worker+wasm qpdf.js ke public/qpdf/
scripts/copy-tesseract-assets.mjs   # postinstall: salin worker+wasm tesseract.js ke public/tesseract/
scripts/copy-pdfjs-assets.mjs       # postinstall: salin standard_fonts pdf.js ke public/pdfjs/ (metrik font standar)
```

## Yang sengaja di luar scope MVP ini

Sesuai keputusan scope "client-side only" di PRD §10 Fase 1, belum diimplementasikan:

- **Convert Office (Word/Excel/PPT) → PDF, HTML to PDF** — butuh LibreOffice headless di server, tidak ada padanan client-side yang genuine. (Arah sebaliknya, PDF → Word, sudah ada — lihat [PDF to Word](#pdf-to-word) di atas.)
- **Auth, dashboard riwayat file, subscription/payment, multi-bahasa** — bagian platform non-tool di PRD §3.7 & §8, butuh Supabase + backend.
- **Redact PDF, Compare PDF, Crop PDF, Edit PDF (teks/gambar bebas)** — bisa dibangun client-side juga, belum masuk batch ini.

Semuanya konsisten dengan roadmap Fase 2/3 di PRD dan bisa ditambah berikutnya tanpa mengubah arsitektur (tool baru = 1 halaman baru + fungsi baru di `lib/pdf/`).
