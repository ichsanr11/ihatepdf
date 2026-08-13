"use client";

import { useState } from "react";
import { ScanText } from "lucide-react";
import { ToolPageHeader } from "@/components/tool-page-header";
import { FileDropzone } from "@/components/file-dropzone";
import { ResultPanel } from "@/components/result-panel";
import { ErrorBanner } from "@/components/error-banner";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { getToolBySlug } from "@/lib/tools";
import { ocrPdf, OCR_LANGUAGES, type OcrProgress } from "@/lib/pdf/ocr";
import { downloadBytes } from "@/lib/download";
import { baseName } from "@/lib/utils";

const tool = getToolBySlug("ocr-pdf")!;

const STAGE_LABELS: Record<string, string> = {
  "loading tesseract core": "Memuat mesin OCR",
  "initializing tesseract": "Menyiapkan mesin OCR",
  "loading language traineddata": "Mengunduh model bahasa",
  "initializing api": "Menyiapkan API",
  "recognizing text": "Membaca teks",
};

export default function OcrPdfPage() {
  const [file, setFile] = useState<File | null>(null);
  const [languages, setLanguages] = useState<string[]>(["ind", "eng"]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<OcrProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ bytes: Uint8Array; fileName: string } | null>(null);

  function toggleLanguage(code: string) {
    setLanguages((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    );
  }

  async function handleOcr() {
    if (!file || languages.length === 0) return;
    setBusy(true);
    setError(null);
    setProgress(null);
    try {
      const bytes = await file.arrayBuffer();
      const out = await ocrPdf(bytes, {
        languages,
        onProgress: setProgress,
      });
      setResult({ bytes: out, fileName: `${baseName(file.name)}_ocr.pdf` });
    } catch {
      setError("Gagal memproses OCR. Pastikan file PDF valid dan koneksi internet stabil (model bahasa perlu diunduh sekali).");
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

  const stageLabel = progress ? STAGE_LABELS[progress.stage] ?? progress.stage : "";

  return (
    <div className="container max-w-2xl py-12">
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

          {!file ? (
            <FileDropzone
              accept="application/pdf"
              onFiles={(fs) => setFile(fs[0])}
              label="Pilih PDF hasil scan"
            />
          ) : busy ? (
            <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-6">
              <p className="text-sm font-medium">
                Halaman {progress?.page ?? 1} dari {progress?.totalPages ?? "…"}
              </p>
              <Progress value={(progress?.progress ?? 0) * 100} />
              <p className="text-xs text-muted-foreground">{stageLabel || "Memulai..."}</p>
            </div>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">{file.name}</span>
              </p>

              <div>
                <p className="mb-2 text-sm font-medium">Bahasa dokumen</p>
                <div className="flex gap-3">
                  {OCR_LANGUAGES.map((lang) => (
                    <label
                      key={lang.code}
                      className="flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-2 text-sm has-[:checked]:border-primary has-[:checked]:bg-primary/5"
                    >
                      <input
                        type="checkbox"
                        checked={languages.includes(lang.code)}
                        onChange={() => toggleLanguage(lang.code)}
                        className="accent-primary"
                      />
                      {lang.label}
                    </label>
                  ))}
                </div>
              </div>

              <p className="text-xs text-muted-foreground">
                Setiap halaman dipindai jadi gambar lalu dibaca teksnya (OCR) di browser Anda —
                hasilnya PDF baru yang teksnya bisa di-select &amp; dicari, tapi tampilannya jadi
                gambar (bukan vector). Prosesnya cukup berat, bisa beberapa detik per halaman.
                Model bahasa (bukan file Anda) diunduh sekali dari CDN publik saat pertama dipakai.
              </p>

              <Button
                size="lg"
                disabled={languages.length === 0}
                onClick={handleOcr}
                className="self-start"
              >
                <ScanText className="h-4 w-4" />
                Jalankan OCR
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
