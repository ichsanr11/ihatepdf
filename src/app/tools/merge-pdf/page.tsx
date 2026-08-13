"use client";

import { useState } from "react";
import { Combine, Plus } from "lucide-react";
import { ToolPageHeader } from "@/components/tool-page-header";
import { FileDropzone } from "@/components/file-dropzone";
import { FileListReorder, type FileEntry } from "@/components/file-list-reorder";
import { ResultPanel } from "@/components/result-panel";
import { ErrorBanner } from "@/components/error-banner";
import { Button } from "@/components/ui/button";
import { getToolBySlug } from "@/lib/tools";
import { mergePdfs } from "@/lib/pdf/merge";
import { downloadBytes } from "@/lib/download";

const tool = getToolBySlug("merge-pdf")!;

export default function MergePdfPage() {
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ bytes: Uint8Array; fileName: string } | null>(null);

  function addFiles(files: File[]) {
    const pdfFiles = files.filter((f) => f.type === "application/pdf" || /\.pdf$/i.test(f.name));
    if (pdfFiles.length === 0) {
      setError("Hanya file PDF yang didukung.");
      return;
    }
    setError(null);
    setEntries((prev) => [
      ...prev,
      ...pdfFiles.map((file) => ({ id: `${file.name}-${file.size}-${Math.random()}`, file })),
    ]);
  }

  async function handleMerge() {
    setBusy(true);
    setError(null);
    try {
      const bytes = await mergePdfs(entries.map((e) => e.file));
      setResult({ bytes, fileName: "merged.pdf" });
    } catch {
      setError("Gagal menggabungkan PDF. Pastikan semua file valid dan tidak rusak.");
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setEntries([]);
    setResult(null);
    setError(null);
  }

  return (
    <div className="container max-w-3xl py-12">
      <ToolPageHeader tool={tool} />

      {result ? (
        <ResultPanel
          fileName={result.fileName}
          sizeBytes={result.bytes.byteLength}
          onDownload={() => downloadBytes(result.bytes, result.fileName, "application/pdf")}
          onReset={reset}
        />
      ) : (
        <div className="flex flex-col gap-5">
          {error && <ErrorBanner message={error} />}

          {entries.length === 0 ? (
            <FileDropzone
              accept="application/pdf"
              multiple
              onFiles={addFiles}
              label="Tarik & lepas beberapa PDF di sini"
              hint="Urutan bisa diatur ulang setelah file dipilih"
            />
          ) : (
            <>
              <FileListReorder
                items={entries}
                onReorder={setEntries}
                onRemove={(id) => setEntries((prev) => prev.filter((e) => e.id !== id))}
              />

              <label className="flex w-fit cursor-pointer items-center gap-2 rounded-md border border-dashed border-border px-3 py-2 text-sm text-muted-foreground hover:border-primary/60 hover:text-foreground">
                <Plus className="h-4 w-4" />
                Tambah PDF lain
                <input
                  type="file"
                  accept="application/pdf"
                  multiple
                  className="hidden"
                  onChange={(e) => e.target.files && addFiles(Array.from(e.target.files))}
                />
              </label>

              <Button
                size="lg"
                disabled={entries.length < 2 || busy}
                onClick={handleMerge}
                className="self-start"
              >
                <Combine className="h-4 w-4" />
                {busy ? "Menggabungkan..." : `Gabungkan ${entries.length} PDF`}
              </Button>
              {entries.length === 1 && (
                <p className="text-sm text-muted-foreground">
                  Tambahkan minimal 2 file PDF untuk digabungkan.
                </p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
