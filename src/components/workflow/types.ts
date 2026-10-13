/**
 * Every workflow step component shares this contract: it receives the
 * current working document's bytes, renders its own self-contained
 * editor UI, and hands back the transformed bytes (plus a short label for
 * the step history) instead of downloading anything itself — that's what
 * lets several tools run back-to-back on one document without a
 * round-trip through the user's downloads folder.
 */
export interface WorkflowStepProps {
  workingBytes: Uint8Array;
  fileName: string;
  onApply: (newBytes: Uint8Array, label: string) => void;
  onCancel: () => void;
}

export type StepKind =
  | "merge"
  | "reorder"
  | "remove-pages"
  | "extract-pages"
  | "rotate"
  | "deskew"
  | "watermark"
  | "page-numbers"
  | "sign"
  | "remove-signature";

export interface StepTypeMeta {
  kind: StepKind;
  name: string;
  shortDesc: string;
  icon: string;
}

export const STEP_TYPES: StepTypeMeta[] = [
  { kind: "merge", name: "Gabung PDF Lain", shortDesc: "Tambahkan & gabung PDF lain ke dokumen ini", icon: "Combine" },
  { kind: "reorder", name: "Urutkan Ulang Halaman", shortDesc: "Seret untuk mengubah urutan halaman", icon: "ArrowUpDown" },
  { kind: "remove-pages", name: "Hapus Halaman", shortDesc: "Pilih halaman yang ingin dihapus", icon: "FileMinus2" },
  { kind: "extract-pages", name: "Ambil Halaman Tertentu", shortDesc: "Pilih halaman yang ingin disimpan", icon: "FilePlus2" },
  { kind: "rotate", name: "Putar Halaman", shortDesc: "Putar orientasi satu/semua halaman", icon: "RotateCw" },
  { kind: "deskew", name: "Luruskan Scan", shortDesc: "Luruskan halaman hasil scan yang miring", icon: "ScanLine" },
  { kind: "watermark", name: "Tambah Watermark", shortDesc: "Watermark teks di semua halaman", icon: "Stamp" },
  { kind: "page-numbers", name: "Tambah Nomor Halaman", shortDesc: "Nomor halaman otomatis", icon: "Hash" },
  { kind: "sign", name: "Tanda Tangani", shortDesc: "Tempel satu tanda tangan di posisi yang Anda atur", icon: "Signature" },
  { kind: "remove-signature", name: "Hapus Tanda Tangan/Cap", shortDesc: "Hapus gambar atau tutup area dengan kotak", icon: "Eraser" },
];
