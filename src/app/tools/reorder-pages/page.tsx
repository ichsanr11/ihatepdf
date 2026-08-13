"use client";

import { useState } from "react";
import { ArrowUpDown } from "lucide-react";
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

const tool = getToolBySlug("reorder-pages")!;

export default function ReorderPagesPage() {
  const { file, items, setItems, loading, error, load, reset } = usePdfThumbnails();
  const [busy, setBusy] = useState(false);
  const [processError, setProcessError] = useState<string | null>(null);
  const [result, setResult] = useState<{ bytes: Uint8Array; fileName: string } | null>(null);

  async function handleSave() {
    if (!file) return;
    setBusy(true);
    setProcessError(null);
    try {
      const bytes = await file.arrayBuffer();
      const selection = items.map((i) => ({ index: i.originalIndex }));
      const out = await buildPdfFromSelection(bytes, selection);
      setResult({ bytes: out, fileName: `${baseName(file.name)}_reordered.pdf` });
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
                <p className="text-sm text-muted-foreground">Seret kartu halaman untuk mengubah urutan.</p>
                <Button disabled={busy} onClick={handleSave} className="shrink-0">
                  <ArrowUpDown className="h-4 w-4" />
                  {busy ? "Menyimpan..." : "Simpan Urutan Baru"}
                </Button>
              </div>

              <PageThumbnailGrid items={items} draggable onReorder={setItems} />
            </>
          )}
        </div>
      )}
    </div>
  );
}
