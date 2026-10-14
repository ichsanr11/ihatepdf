"use client";

import { useState } from "react";
import { FileType2 } from "lucide-react";
import { ToolPageHeader } from "@/components/tool-page-header";
import { FileDropzone } from "@/components/file-dropzone";
import { ResultPanel } from "@/components/result-panel";
import { ErrorBanner } from "@/components/error-banner";
import { InfoBanner } from "@/components/info-banner";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { getToolBySlug } from "@/lib/tools";
import { pdfToWord, type PdfToWordResult } from "@/lib/pdf/pdfToWord";
import { downloadBytes } from "@/lib/download";
import { baseName } from "@/lib/utils";

const tool = getToolBySlug("pdf-to-word")!;
const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export default function PdfToWordPage() {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ page: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ bytes: Uint8Array; fileName: string; info: PdfToWordResult } | null>(
    null
  );

  async function handleConvert() {
    if (!file) return;
    setBusy(true);
    setError(null);
    setProgress(null);
    try {
      const bytes = await file.arrayBuffer();
      const out = await pdfToWord(bytes, (page, total) => setProgress({ page, total }));
      setResult({ bytes: out.bytes, fileName: `${baseName(file.name)}.docx`, info: out });
    } catch {
      setError("Gagal mengonversi PDF. Pastikan file valid dan tidak terkunci password.");
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setFile(null);
    setResult(null);
    setError(null);
    setProgress(null);
  }

  return (
    <div className="container max-w-2xl py-12">
      <ToolPageHeader tool={tool} />

      {result ? (
        <div className="flex flex-col gap-4">
          {result.info.emptyPageCount > 0 && (
            <InfoBanner
              message={`${result.info.emptyPageCount} dari ${result.info.pageCount} halaman tidak punya teks yang bisa diekstrak (kemungkinan hasil scan tanpa OCR) — halaman itu jadi kosong di file Word. Coba jalankan OCR PDF dulu kalau sumbernya hasil scan.`}
            />
          )}
          <ResultPanel
            fileName={result.fileName}
            sizeBytes={result.bytes.byteLength}
            onDownload={() => downloadBytes(result.bytes, result.fileName, DOCX_MIME)}
            onReset={reset}
          />
          <p className="text-center text-sm text-muted-foreground">
            {result.info.pageCount} halaman · {result.info.runCount} baris teks diposisikan ulang
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          {error && <ErrorBanner message={error} />}

          {!file ? (
            <FileDropzone accept="application/pdf" onFiles={(fs) => setFile(fs[0])} label="Pilih PDF" />
          ) : busy ? (
            <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-6">
              <p className="text-sm font-medium">
                Memproses halaman {progress?.page ?? 1} dari {progress?.total ?? "…"}
              </p>
              <Progress value={progress ? (progress.page / progress.total) * 100 : 0} />
            </div>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">{file.name}</span>
              </p>

              <InfoBanner message="Setiap baris teks ditempatkan ulang di posisi, ukuran font, dan gaya (bold/italic) yang sama seperti di PDF asli — bukan tebakan tata letak. Ini kecocokan visual yang dekat, bukan hasil pixel-perfect: warna teks selalu hitam, teks yang diputar/miring akan tampil lurus, dan gambar di PDF belum ikut disalin (hanya teks)." />

              <Button size="lg" onClick={handleConvert} className="self-start">
                <FileType2 className="h-4 w-4" />
                Konversi ke Word
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
