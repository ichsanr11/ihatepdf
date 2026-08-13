"use client";

import { useState } from "react";
import { ImageDown } from "lucide-react";
import { ToolPageHeader } from "@/components/tool-page-header";
import { FileDropzone } from "@/components/file-dropzone";
import { ResultPanel } from "@/components/result-panel";
import { ErrorBanner } from "@/components/error-banner";
import { Spinner } from "@/components/spinner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { getToolBySlug } from "@/lib/tools";
import { pdfToImages, zipImages } from "@/lib/pdf/pdfToImage";
import { downloadBytes } from "@/lib/download";
import { baseName } from "@/lib/utils";

const tool = getToolBySlug("pdf-to-jpg")!;

export default function PdfToJpgPage() {
  const [file, setFile] = useState<File | null>(null);
  const [format, setFormat] = useState<"jpeg" | "png">("jpeg");
  const [quality, setQuality] = useState<"standard" | "high">("standard");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ bytes: Uint8Array; fileName: string } | null>(null);

  async function handleConvert() {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const bytes = await file.arrayBuffer();
      const name = baseName(file.name);
      const images = await pdfToImages(bytes, {
        format,
        scale: quality === "high" ? 3 : 2,
        baseName: name,
      });

      if (images.length === 1) {
        const buf = new Uint8Array(await images[0].blob.arrayBuffer());
        setResult({ bytes: buf, fileName: images[0].fileName });
      } else {
        const zipped = await zipImages(images, `${name}_images.zip`);
        setResult(zipped);
      }
    } catch {
      setError("Gagal mengonversi PDF ke gambar. Pastikan file valid dan tidak terkunci password.");
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setFile(null);
    setResult(null);
    setError(null);
  }

  const mime = result?.fileName.endsWith(".zip")
    ? "application/zip"
    : format === "png"
      ? "image/png"
      : "image/jpeg";

  return (
    <div className="container max-w-2xl py-12">
      <ToolPageHeader tool={tool} />

      {result ? (
        <ResultPanel
          fileName={result.fileName}
          sizeBytes={result.bytes.byteLength}
          onDownload={() => downloadBytes(result.bytes, result.fileName, mime)}
          onReset={reset}
        />
      ) : (
        <div className="flex flex-col gap-5">
          {error && <ErrorBanner message={error} />}

          {!file ? (
            <FileDropzone accept="application/pdf" onFiles={(fs) => setFile(fs[0])} label="Pilih PDF" />
          ) : busy ? (
            <Spinner label="Mengonversi halaman ke gambar..." />
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">{file.name}</span>
              </p>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="format">Format gambar</Label>
                  <Select
                    id="format"
                    className="mt-1.5"
                    value={format}
                    onChange={(e) => setFormat(e.target.value as "jpeg" | "png")}
                  >
                    <option value="jpeg">JPG</option>
                    <option value="png">PNG</option>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="quality">Kualitas</Label>
                  <Select
                    id="quality"
                    className="mt-1.5"
                    value={quality}
                    onChange={(e) => setQuality(e.target.value as "standard" | "high")}
                  >
                    <option value="standard">Standar (~150dpi)</option>
                    <option value="high">Tinggi (~220dpi)</option>
                  </Select>
                </div>
              </div>

              <Button size="lg" onClick={handleConvert} className="self-start">
                <ImageDown className="h-4 w-4" />
                Konversi ke {format === "png" ? "PNG" : "JPG"}
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
