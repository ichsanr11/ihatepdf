"use client";

import { useState } from "react";
import { Wrench } from "lucide-react";
import { ToolPageHeader } from "@/components/tool-page-header";
import { FileDropzone } from "@/components/file-dropzone";
import { ResultPanel } from "@/components/result-panel";
import { ErrorBanner } from "@/components/error-banner";
import { Spinner } from "@/components/spinner";
import { Button } from "@/components/ui/button";
import { getToolBySlug } from "@/lib/tools";
import { repairPdf } from "@/lib/pdf/repair";
import { downloadBytes } from "@/lib/download";
import { baseName } from "@/lib/utils";

const tool = getToolBySlug("repair-pdf")!;

export default function RepairPdfPage() {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ bytes: Uint8Array; fileName: string; pageCount: number } | null>(
    null
  );

  async function handleRepair() {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const bytes = await file.arrayBuffer();
      const res = await repairPdf(bytes);
      setResult({
        bytes: res.bytes,
        fileName: `${baseName(file.name)}_repaired.pdf`,
        pageCount: res.pageCount,
      });
    } catch {
      setError(
        "File ini rusak terlalu parah untuk diperbaiki di browser — sebagian data intinya kemungkinan hilang/tidak bisa direkonstruksi."
      );
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setFile(null);
    setResult(null);
    setError(null);
  }

  return (
    <div className="container max-w-2xl py-12">
      <ToolPageHeader tool={tool} />

      {result ? (
        <div className="flex flex-col gap-4">
          <ResultPanel
            fileName={result.fileName}
            sizeBytes={result.bytes.byteLength}
            onDownload={() => downloadBytes(result.bytes, result.fileName, "application/pdf")}
            onReset={reset}
          />
          <p className="text-center text-sm text-muted-foreground">
            Berhasil memulihkan struktur file — {result.pageCount} halaman terdeteksi.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          {error && <ErrorBanner message={error} />}

          {!file ? (
            <FileDropzone
              accept="application/pdf"
              onFiles={(fs) => setFile(fs[0])}
              label="Pilih PDF yang rusak/tidak bisa dibuka"
            />
          ) : busy ? (
            <Spinner label="Memindai & membangun ulang struktur PDF..." />
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">{file.name}</span>
              </p>
              <p className="text-xs text-muted-foreground">
                Tool ini membaca file seleluasa mungkin (melewati bagian yang rusak) lalu menulis
                ulang strukturnya dari awal — efektif untuk file dengan xref table/struktur yang
                korup. Kalau datanya sendiri hilang/terpotong, tidak bisa direkonstruksi.
              </p>

              <Button size="lg" onClick={handleRepair} className="self-start">
                <Wrench className="h-4 w-4" />
                Perbaiki PDF
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
