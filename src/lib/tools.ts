export type ToolCategory =
  | "workflow"
  | "organize"
  | "optimize"
  | "convert-to"
  | "convert-from"
  | "edit"
  | "security"
  | "language"
  | "audio";

export interface ToolMeta {
  slug: string;
  name: string;
  shortDesc: string;
  category: ToolCategory;
  icon: string; // lucide-react icon name
  available: boolean;
}

export const categoryLabels: Record<ToolCategory, string> = {
  workflow: "Workflow",
  organize: "Organize PDF",
  optimize: "Optimize",
  "convert-to": "Convert to PDF",
  "convert-from": "Convert from PDF",
  edit: "Edit PDF",
  security: "Security",
  language: "Bahasa",
  audio: "Audio",
};

export const tools: ToolMeta[] = [
  {
    slug: "workflow",
    name: "Workflow (Gabungan Tool)",
    shortDesc: "Rantai beberapa tool sekaligus — merge, urutkan, tanda tangan, dll — tanpa download di tengah jalan",
    category: "workflow",
    icon: "Workflow",
    available: true,
  },
  {
    slug: "merge-pdf",
    name: "Merge PDF",
    shortDesc: "Gabungkan beberapa PDF jadi satu file",
    category: "organize",
    icon: "Combine",
    available: true,
  },
  {
    slug: "split-pdf",
    name: "Split PDF",
    shortDesc: "Pisahkan PDF berdasarkan halaman atau range",
    category: "organize",
    icon: "Scissors",
    available: true,
  },
  {
    slug: "remove-pages",
    name: "Remove Pages",
    shortDesc: "Hapus halaman tertentu dari PDF",
    category: "organize",
    icon: "FileMinus2",
    available: true,
  },
  {
    slug: "extract-pages",
    name: "Extract Pages",
    shortDesc: "Ambil halaman tertentu jadi file baru",
    category: "organize",
    icon: "FilePlus2",
    available: true,
  },
  {
    slug: "reorder-pages",
    name: "Reorder Pages",
    shortDesc: "Ubah urutan halaman dengan drag & drop",
    category: "organize",
    icon: "ArrowUpDown",
    available: true,
  },
  {
    slug: "rotate-pdf",
    name: "Rotate PDF",
    shortDesc: "Putar orientasi halaman PDF",
    category: "organize",
    icon: "RotateCw",
    available: true,
  },
  {
    slug: "deskew-pdf",
    name: "Luruskan Scan (Deskew)",
    shortDesc: "Luruskan halaman hasil scan yang miring, per halaman",
    category: "organize",
    icon: "ScanLine",
    available: true,
  },
  {
    slug: "compress-pdf",
    name: "Compress PDF",
    shortDesc: "Perkecil ukuran file dengan mengompres gambar di dalamnya",
    category: "optimize",
    icon: "Minimize2",
    available: true,
  },
  {
    slug: "repair-pdf",
    name: "Repair PDF",
    shortDesc: "Perbaiki file PDF yang rusak atau tidak bisa dibuka",
    category: "optimize",
    icon: "Wrench",
    available: true,
  },
  {
    slug: "ocr-pdf",
    name: "OCR PDF",
    shortDesc: "Jadikan PDF hasil scan bisa dicari & disalin teksnya",
    category: "optimize",
    icon: "ScanText",
    available: true,
  },
  {
    slug: "jpg-to-pdf",
    name: "JPG/PNG to PDF",
    shortDesc: "Ubah gambar jadi dokumen PDF",
    category: "convert-to",
    icon: "ImagePlus",
    available: true,
  },
  {
    slug: "pdf-to-jpg",
    name: "PDF to JPG",
    shortDesc: "Ekspor setiap halaman PDF jadi gambar",
    category: "convert-from",
    icon: "ImageDown",
    available: true,
  },
  {
    slug: "pdf-to-word",
    name: "PDF to Word",
    shortDesc: "Ubah PDF jadi .docx, posisi & font teks dipertahankan",
    category: "convert-from",
    icon: "FileType2",
    available: true,
  },
  {
    slug: "add-text",
    name: "Add Text",
    shortDesc: "Tambahkan teks bebas dengan font, ukuran, warna, bold/italic sendiri",
    category: "edit",
    icon: "Type",
    available: true,
  },
  {
    slug: "watermark-pdf",
    name: "Add Watermark",
    shortDesc: "Tambahkan watermark teks ke semua halaman",
    category: "edit",
    icon: "Stamp",
    available: true,
  },
  {
    slug: "page-numbers",
    name: "Add Page Numbers",
    shortDesc: "Tambahkan nomor halaman otomatis",
    category: "edit",
    icon: "Hash",
    available: true,
  },
  {
    slug: "sign-pdf",
    name: "Sign PDF",
    shortDesc: "Tempel tanda tangan (gambar) ke posisi yang Anda atur",
    category: "security",
    icon: "Signature",
    available: true,
  },
  {
    slug: "remove-signature",
    name: "Remove Signature/Stamp",
    shortDesc: "Hapus atau tutup tanda tangan & cap di satu/beberapa halaman",
    category: "security",
    icon: "Eraser",
    available: true,
  },
  {
    slug: "protect-pdf",
    name: "Protect PDF",
    shortDesc: "Kunci PDF dengan password",
    category: "security",
    icon: "Lock",
    available: true,
  },
  {
    slug: "unlock-pdf",
    name: "Unlock PDF",
    shortDesc: "Hapus password dari PDF (jika diketahui)",
    category: "security",
    icon: "Unlock",
    available: true,
  },
  {
    slug: "dictionary-id-en",
    name: "Dictionary ID-EN",
    shortDesc: "Cetak miring otomatis kata bahasa Inggris dalam teks Indonesia",
    category: "language",
    icon: "Languages",
    available: true,
  },
  {
    slug: "split-audio",
    name: "Split Audio",
    shortDesc: "Pecah file audio jadi beberapa bagian berdasarkan durasi menit",
    category: "audio",
    icon: "AudioWaveform",
    available: true,
  },
];

export function getToolBySlug(slug: string) {
  return tools.find((t) => t.slug === slug);
}
