"use client";

import { useState } from "react";
import { FileMinus2 } from "lucide-react";
import { ToolPageHeader } from "@/components/tool-page-header";
import { FileDropzone } from "@/components/file-dropzone";
import { PageThumbnailGrid } from "@/components/page-thumbnail-grid";
import { ResultPanel } from "@/components/result-panel";
import { ErrorBanner } from "@/components/error-banner";
import { Spinner } from "@/components/spinner";
import { Button } from "@/components/ui/button";
import { getToolBySlug } from "@/lib/tools";
import { usePdfThumbnails } from "@/hooks/use-pdf-thumbnails";
import { buildPdfFromSelection } from "@/lib/pdf/pageOps";
import { downloadBytes } from "@/lib/download";
import { baseName } from "@/lib/utils";

const tool = getToolBySlug("remove-pages")!;

export default function RemovePagesPage() {
  const { file, items, setItems, loading, error, load, reset } = usePdfThumbnails();
  const [busy, setBusy] = useState(false);
  const [processError, setProcessError] = useState<string | null>(null);
  const [result, setResult] = useState<{ bytes: Uint8Array; fileName: string } | null>(null);

  const selectedCount = items.filter((i) => i.selected).length;

  async function handleRemove() {
    if (!file) return;
    setBusy(true);
    setProcessError(null);
    try {
      const bytes = await file.arrayBuffer();
      const kept = items.filter((i) => !i.selected).map((i) => ({ index: i.originalIndex }));
      if (kept.length === 0) {
        setProcessError("Tidak bisa menghapus semua halaman — dokumen butuh minimal 1 halaman.");
        return;
      }
      const out = await buildPdfFromSelection(bytes, kept);
      setResult({ bytes: out, fileName: `${baseName(file.name)}_removed.pdf` });
    } catch {
      setProcessError("Gagal memproses PDF.");
    } finally {
      setBusy(false);
    }
  }

  function fullReset() {
    reset();
    setResult(null);
    setProcessError(null);
  }

  return (
    <div className="container max-w-5xl py-12">
      <ToolPageHeader tool={tool} />

      {result ? (
        <ResultPanel
          fileName={result.fileName}
          sizeBytes={result.bytes.byteLength}
          onDownload={() => downloadBytes(result.bytes, result.fileName, "application/pdf")}
          onReset={fullReset}
        />
      ) : (
        <div className="flex flex-col gap-5">
          {(error || processError) && <ErrorBanner message={error ?? processError!} />}

          {!file ? (
            <FileDropzone accept="application/pdf" onFiles={(fs) => load(fs[0])} label="Pilih PDF" />
          ) : loading ? (
            <Spinner label="Merender halaman..." />
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-muted-foreground">
                  Klik halaman yang ingin dihapus.{" "}
                  {selectedCount > 0 && (
                    <span className="font-medium text-destructive">{selectedCount} halaman dipilih</span>
                  )}
                </p>
                <Button
                  disabled={selectedCount === 0 || busy}
                  onClick={handleRemove}
                  className="shrink-0"
                >
                  <FileMinus2 className="h-4 w-4" />
                  {busy ? "Memproses..." : `Hapus ${selectedCount || ""} Halaman`}
                </Button>
              </div>

              <PageThumbnailGrid
                items={items}
                selectable
                selectionIntent="remove"
                onToggleSelect={(id) =>
                  setItems((prev) =>
                    prev.map((p) => (p.id === id ? { ...p, selected: !p.selected } : p))
                  )
                }
              />
            </>
          )}
        </div>
      )}
    </div>
  );
}
