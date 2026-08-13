"use client";

import { useState } from "react";
import { Hash } from "lucide-react";
import { ToolPageHeader } from "@/components/tool-page-header";
import { FileDropzone } from "@/components/file-dropzone";
import { ResultPanel } from "@/components/result-panel";
import { ErrorBanner } from "@/components/error-banner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { getToolBySlug } from "@/lib/tools";
import { addPageNumbers, type NumberPosition } from "@/lib/pdf/pageNumbers";
import { downloadBytes } from "@/lib/download";
import { baseName } from "@/lib/utils";

const tool = getToolBySlug("page-numbers")!;

const formats = {
  "n-of-total": { label: "1 / 10", fn: (p: number, t: number) => `${p} / ${t}` },
  "n-only": { label: "1", fn: (p: number) => `${p}` },
  "page-n": { label: "Halaman 1", fn: (p: number) => `Halaman ${p}` },
} as const;

export default function PageNumbersPage() {
  const [file, setFile] = useState<File | null>(null);
  const [position, setPosition] = useState<NumberPosition>("bottom-center");
  const [formatKey, setFormatKey] = useState<keyof typeof formats>("n-of-total");
  const [startAt, setStartAt] = useState(1);
  const [fontSize, setFontSize] = useState(11);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ bytes: Uint8Array; fileName: string } | null>(null);

  async function handleApply() {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const bytes = await file.arrayBuffer();
      const out = await addPageNumbers(bytes, {
        position,
        fontSize,
        startAt,
        format: formats[formatKey].fn,
        marginPt: 28,
      });
      setResult({ bytes: out, fileName: `${baseName(file.name)}_numbered.pdf` });
    } catch {
      setError("Gagal menambahkan nomor halaman. Pastikan file PDF valid.");
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

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="position">Posisi</Label>
                  <Select
                    id="position"
                    className="mt-1.5"
                    value={position}
                    onChange={(e) => setPosition(e.target.value as NumberPosition)}
                  >
                    <option value="bottom-center">Bawah tengah</option>
                    <option value="bottom-right">Bawah kanan</option>
                    <option value="bottom-left">Bawah kiri</option>
                    <option value="top-center">Atas tengah</option>
                    <option value="top-right">Atas kanan</option>
                    <option value="top-left">Atas kiri</option>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="format">Format</Label>
                  <Select
                    id="format"
                    className="mt-1.5"
                    value={formatKey}
                    onChange={(e) => setFormatKey(e.target.value as keyof typeof formats)}
                  >
                    {Object.entries(formats).map(([key, f]) => (
                      <option key={key} value={key}>
                        {f.label}
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <Label htmlFor="startAt">Mulai dari</Label>
                  <Input
                    id="startAt"
                    type="number"
                    min={1}
                    className="mt-1.5"
                    value={startAt}
                    onChange={(e) => setStartAt(Number(e.target.value))}
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

              <Button size="lg" disabled={busy} onClick={handleApply} className="self-start">
                <Hash className="h-4 w-4" />
                {busy ? "Menerapkan..." : "Tambahkan Nomor Halaman"}
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
