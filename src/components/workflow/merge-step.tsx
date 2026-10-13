"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ErrorBanner } from "@/components/error-banner";
import { FileListReorder, type FileEntry } from "@/components/file-list-reorder";
import { mergePdfs } from "@/lib/pdf/merge";
import { bytesToPdfFile } from "@/lib/utils";
import type { WorkflowStepProps } from "./types";

/** The working document is always first and can't be removed — this step appends/reorders PDFs after it. */
export function MergeStep({ workingBytes, fileName, onApply, onCancel }: WorkflowStepProps) {
  const [extra, setExtra] = useState<FileEntry[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function addFiles(files: File[]) {
    const pdfFiles = files.filter((f) => f.type === "application/pdf" || /\.pdf$/i.test(f.name));
    if (pdfFiles.length === 0) {
      setError("Hanya file PDF yang didukung.");
      return;
    }
    setError(null);
    setExtra((prev) => [
      ...prev,
      ...pdfFiles.map((file) => ({ id: `${file.name}-${file.size}-${Math.random()}`, file })),
    ]);
  }

  async function handleApply() {
    if (extra.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      const currentFile = bytesToPdfFile(workingBytes, fileName);
      const bytes = await mergePdfs([currentFile, ...extra.map((e) => e.file)]);
      onApply(bytes, `Gabung ${extra.length} PDF lain`);
    } catch {
      setError("Gagal menggabungkan PDF. Pastikan semua file valid.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {error && <ErrorBanner message={error} />}

      <div className="rounded-lg border border-border bg-card p-3 text-sm text-muted-foreground">
        📄 Dokumen kerja saat ini ({fileName}) — akan jadi halaman pertama
      </div>

      {extra.length > 0 && (
        <FileListReorder
          items={extra}
          onReorder={setExtra}
          onRemove={(id) => setExtra((prev) => prev.filter((e) => e.id !== id))}
        />
      )}

      <label className="flex w-fit cursor-pointer items-center gap-2 rounded-md border border-dashed border-border px-3 py-2 text-sm text-muted-foreground hover:border-primary/60 hover:text-foreground">
        <Plus className="h-4 w-4" />
        Tambah PDF untuk digabung
        <input
          type="file"
          accept="application/pdf"
          multiple
          className="hidden"
          onChange={(e) => e.target.files && addFiles(Array.from(e.target.files))}
        />
      </label>

      <div className="flex gap-2">
        <Button onClick={handleApply} disabled={extra.length === 0 || busy}>
          {busy ? "Menggabungkan..." : `Terapkan (gabung ${extra.length || ""} PDF)`}
        </Button>
        <Button variant="outline" onClick={onCancel}>
          Batal
        </Button>
      </div>
    </div>
  );
}
