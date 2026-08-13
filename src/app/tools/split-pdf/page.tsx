"use client";

import { useState } from "react";
import { Scissors } from "lucide-react";
import { ToolPageHeader } from "@/components/tool-page-header";
import { FileDropzone } from "@/components/file-dropzone";
import { ResultPanel } from "@/components/result-panel";
import { ErrorBanner } from "@/components/error-banner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getToolBySlug } from "@/lib/tools";
import { getPageCount } from "@/lib/pdf/pageOps";
import { parsePageRanges, everyPageGroup, splitPdf, zipResults } from "@/lib/pdf/split";
import { downloadBytes } from "@/lib/download";
import { baseName } from "@/lib/utils";

const tool = getToolBySlug("split-pdf")!;

type Mode = "ranges" | "every-page";

export default function SplitPdfPage() {
  const [file, setFile] = useState<File | null>(null);
  const [pageCount, setPageCount] = useState<number | null>(null);
  const [mode, setMode] = useState<Mode>("ranges");
  const [ranges, setRanges] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ bytes: Uint8Array; fileName: string } | null>(null);

  async function handleFile(files: File[]) {
    const f = files[0];
    setError(null);
    try {
      const count = await getPageCount(await f.arrayBuffer());
      setFile(f);
      setPageCount(count);
      setRanges(count > 1 ? `1-${Math.ceil(count / 2)},${Math.ceil(count / 2) + 1}-${count}` : "1");
    } catch {
      setError("Gagal membaca PDF. Pastikan file tidak rusak.");
    }
  }

  async function handleSplit() {
    if (!file || !pageCount) return;
    setBusy(true);
    setError(null);
    try {
      const bytes = await file.arrayBuffer();
      const groups = mode === "every-page" ? everyPageGroup(pageCount) : parsePageRanges(ranges, pageCount);
      const name = baseName(file.name);
      const outputs = await splitPdf(bytes, groups, name);

      if (outputs.length === 1) {
        setResult({ bytes: outputs[0].bytes, fileName: outputs[0].fileName });
      } else {
        const zipped = await zipResults(outputs, `${name}_split.zip`);
        setResult(zipped);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal memisahkan PDF.");
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setFile(null);
    setPageCount(null);
    setResult(null);
    setError(null);
    setRanges("");
  }

  const mime = result?.fileName.endsWith(".zip") ? "application/zip" : "application/pdf";

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
            <FileDropzone accept="application/pdf" onFiles={handleFile} label="Pilih PDF untuk dipisah" />
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">{file.name}</span> · {pageCount} halaman
              </p>

              <div className="flex gap-3">
                <ModeButton active={mode === "ranges"} onClick={() => setMode("ranges")}>
                  Range kustom
                </ModeButton>
                <ModeButton active={mode === "every-page"} onClick={() => setMode("every-page")}>
                  Setiap halaman terpisah
                </ModeButton>
              </div>

              {mode === "ranges" && (
                <div>
                  <Label htmlFor="ranges">Range halaman (pisahkan dengan koma)</Label>
                  <Input
                    id="ranges"
                    className="mt-1.5"
                    value={ranges}
                    onChange={(e) => setRanges(e.target.value)}
                    placeholder="1-3,5,8-10"
                  />
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    Setiap grup jadi satu file PDF terpisah, misal &quot;1-3,5,8-10&quot; menghasilkan 3 file.
                  </p>
                </div>
              )}

              <Button size="lg" disabled={busy} onClick={handleSplit} className="self-start">
                <Scissors className="h-4 w-4" />
                {busy ? "Memisahkan..." : "Split PDF"}
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function ModeButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-md border px-4 py-2 text-sm font-medium transition-colors ${
        active
          ? "border-primary bg-primary/10 text-primary"
          : "border-border text-muted-foreground hover:bg-accent"
      }`}
    >
      {children}
    </button>
  );
}
