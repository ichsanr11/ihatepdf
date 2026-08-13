"use client";

import { useState } from "react";
import { Stamp } from "lucide-react";
import { ToolPageHeader } from "@/components/tool-page-header";
import { FileDropzone } from "@/components/file-dropzone";
import { ResultPanel } from "@/components/result-panel";
import { ErrorBanner } from "@/components/error-banner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { getToolBySlug } from "@/lib/tools";
import { addWatermark } from "@/lib/pdf/watermark";
import { downloadBytes } from "@/lib/download";
import { baseName } from "@/lib/utils";

const tool = getToolBySlug("watermark-pdf")!;

export default function WatermarkPdfPage() {
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState("CONFIDENTIAL");
  const [opacity, setOpacity] = useState(30);
  const [fontSize, setFontSize] = useState(48);
  const [rotation, setRotation] = useState(-45);
  const [layout, setLayout] = useState<"center" | "tile">("center");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ bytes: Uint8Array; fileName: string } | null>(null);

  async function handleApply() {
    if (!file || !text.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const bytes = await file.arrayBuffer();
      const out = await addWatermark(bytes, {
        text: text.trim(),
        opacity: opacity / 100,
        fontSize,
        rotationDeg: rotation,
        color: { r: 0.55, g: 0.55, b: 0.55 },
        layout,
      });
      setResult({ bytes: out, fileName: `${baseName(file.name)}_watermarked.pdf` });
    } catch {
      setError("Gagal menambahkan watermark. Pastikan file PDF valid.");
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
            <FileDropzone accept="application/pdf" onFiles={(fs) => setFile(fs[0])} label="Pilih PDF" />
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">{file.name}</span>
              </p>

              <div>
                <Label htmlFor="text">Teks watermark</Label>
                <Input
                  id="text"
                  className="mt-1.5"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="CONFIDENTIAL"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="layout">Tata letak</Label>
                  <Select
                    id="layout"
                    className="mt-1.5"
                    value={layout}
                    onChange={(e) => setLayout(e.target.value as "center" | "tile")}
                  >
                    <option value="center">Tengah halaman</option>
                    <option value="tile">Berulang (tile)</option>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="rotation">Rotasi (derajat)</Label>
                  <Input
                    id="rotation"
                    type="number"
                    className="mt-1.5"
                    value={rotation}
                    onChange={(e) => setRotation(Number(e.target.value))}
                  />
                </div>
                <div>
                  <Label htmlFor="opacity">Transparansi ({opacity}%)</Label>
                  <input
                    id="opacity"
                    type="range"
                    min={5}
                    max={100}
                    value={opacity}
                    onChange={(e) => setOpacity(Number(e.target.value))}
                    className="mt-3 w-full accent-primary"
                  />
                </div>
                <div>
                  <Label htmlFor="fontSize">Ukuran font (pt)</Label>
                  <Input
                    id="fontSize"
                    type="number"
                    className="mt-1.5"
                    value={fontSize}
                    onChange={(e) => setFontSize(Number(e.target.value))}
                  />
                </div>
              </div>

              <Button size="lg" disabled={busy || !text.trim()} onClick={handleApply} className="self-start">
                <Stamp className="h-4 w-4" />
                {busy ? "Menerapkan..." : "Tambahkan Watermark"}
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
