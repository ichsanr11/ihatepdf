"use client";

import { useState } from "react";
import { ImagePlus, Plus } from "lucide-react";
import { ToolPageHeader } from "@/components/tool-page-header";
import { FileDropzone } from "@/components/file-dropzone";
import { FileListReorder, type FileEntry } from "@/components/file-list-reorder";
import { ResultPanel } from "@/components/result-panel";
import { ErrorBanner } from "@/components/error-banner";
import { Button } from "@/components/ui/button";
import { getToolBySlug } from "@/lib/tools";
import { imagesToPdf } from "@/lib/pdf/imageToPdf";
import { downloadBytes } from "@/lib/download";

const tool = getToolBySlug("jpg-to-pdf")!;

export default function JpgToPdfPage() {
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ bytes: Uint8Array; fileName: string } | null>(null);

  function addFiles(files: File[]) {
    const images = files.filter((f) => /^image\/(jpeg|png)$/.test(f.type) || /\.(jpe?g|png)$/i.test(f.name));
    if (images.length === 0) {
      setError("Hanya file JPG/JPEG/PNG yang didukung.");
      return;
    }
    setError(null);
    setEntries((prev) => [
      ...prev,
      ...images.map((file) => ({
        id: `${file.name}-${file.size}-${Math.random()}`,
        file,
        previewUrl: URL.createObjectURL(file),
      })),
    ]);
  }

  async function handleConvert() {
    setBusy(true);
    setError(null);
    try {
      const bytes = await imagesToPdf(entries.map((e) => e.file));
      setResult({ bytes, fileName: "images.pdf" });
    } catch {
      setError("Gagal mengonversi gambar. Pastikan semua file JPG/PNG valid.");
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
              accept="image/jpeg,image/png"
              multiple
              onFiles={addFiles}
              label="Tarik & lepas gambar JPG/PNG di sini"
              hint="Setiap gambar jadi satu halaman PDF"
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
                Tambah gambar lain
                <input
                  type="file"
                  accept="image/jpeg,image/png"
                  multiple
                  className="hidden"
                  onChange={(e) => e.target.files && addFiles(Array.from(e.target.files))}
                />
              </label>

              <Button size="lg" disabled={busy} onClick={handleConvert} className="self-start">
                <ImagePlus className="h-4 w-4" />
                {busy ? "Mengonversi..." : `Konversi ${entries.length} Gambar ke PDF`}
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
