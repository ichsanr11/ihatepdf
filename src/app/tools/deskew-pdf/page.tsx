"use client";

import { useEffect, useRef, useState } from "react";
import { ScanLine, RotateCcw } from "lucide-react";
import { ToolPageHeader } from "@/components/tool-page-header";
import { FileDropzone } from "@/components/file-dropzone";
import { ResultPanel } from "@/components/result-panel";
import { ErrorBanner } from "@/components/error-banner";
import { InfoBanner } from "@/components/info-banner";
import { Spinner } from "@/components/spinner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getToolBySlug } from "@/lib/tools";
import { usePdfPages } from "@/hooks/use-pdf-pages";
import { deskewPdf } from "@/lib/pdf/deskew";
import { downloadBytes } from "@/lib/download";
import { baseName, cn } from "@/lib/utils";

const tool = getToolBySlug("deskew-pdf")!;
const PREVIEW_WIDTH = 900;
const NUDGES = [-1, -0.1, 0.1, 1];

export default function DeskewPdfPage() {
  const pdfPages = usePdfPages();
  const [activePage, setActivePage] = useState(1);
  const [angles, setAngles] = useState<Map<number, number>>(new Map());

  const [pageRender, setPageRender] = useState<{ dataUrl: string; width: number; height: number } | null>(
    null
  );
  const [pageRenderLoading, setPageRenderLoading] = useState(false);
  const renderCache = useRef(new Map<number, { dataUrl: string; width: number; height: number }>());

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ bytes: Uint8Array; fileName: string } | null>(null);

  useEffect(() => {
    if (!pdfPages.file) return;
    const cached = renderCache.current.get(activePage);
    if (cached) {
      setPageRender(cached);
      return;
    }
    setPageRenderLoading(true);
    pdfPages.renderHighRes(activePage, PREVIEW_WIDTH).then((r) => {
      if (r) {
        renderCache.current.set(activePage, r);
        setPageRender(r);
      }
      setPageRenderLoading(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePage, pdfPages.file]);

  const currentAngle = angles.get(activePage - 1) ?? 0;
  const touchedCount = Array.from(angles.values()).filter((a) => a !== 0).length;

  function setAngleForActive(angle: number) {
    const clamped = Math.max(-45, Math.min(45, Math.round(angle * 10) / 10));
    setAngles((prev) => {
      const next = new Map(prev);
      if (clamped === 0) next.delete(activePage - 1);
      else next.set(activePage - 1, clamped);
      return next;
    });
  }

  async function handleApply() {
    if (!pdfPages.file || touchedCount === 0) return;
    setBusy(true);
    setError(null);
    try {
      const bytes = await pdfPages.file.arrayBuffer();
      const out = await deskewPdf(bytes, angles);
      setResult({ bytes: out, fileName: `${baseName(pdfPages.file.name)}_lurus.pdf` });
    } catch {
      setError("Gagal meluruskan halaman. Pastikan file PDF valid.");
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    pdfPages.reset();
    setActivePage(1);
    setAngles(new Map());
    renderCache.current.clear();
    setPageRender(null);
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
          {(pdfPages.error || error) && <ErrorBanner message={pdfPages.error ?? error!} />}

          {!pdfPages.file ? (
            <FileDropzone
              accept="application/pdf"
              onFiles={(fs) => pdfPages.load(fs[0])}
              label="Pilih PDF hasil scan yang miring"
            />
          ) : pdfPages.loading || pdfPages.thumbnails.length === 0 ? (
            <Spinner label="Memuat halaman PDF..." />
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">{pdfPages.file.name}</span> ·{" "}
                  {pdfPages.thumbnails.length} halaman
                </p>
                <Button variant="outline" size="sm" onClick={reset}>
                  <RotateCcw className="h-3.5 w-3.5" />
                  Ganti PDF
                </Button>
              </div>

              <InfoBanner message="Halaman yang sudut kemiringannya diubah (tidak 0°) akan diubah jadi gambar beresolusi tinggi dengan margin putih tipis supaya konten tidak terpotong saat diluruskan. Halaman yang tidak disentuh tetap vector asli, tidak ikut berubah." />

              {pdfPages.thumbnails.length > 1 && (
                <div>
                  <p className="mb-2 text-sm font-medium">Halaman</p>
                  <div className="flex gap-2 overflow-x-auto pb-1 thin-scrollbar">
                    {pdfPages.thumbnails.map((t) => {
                      const angle = angles.get(t.pageNumber - 1) ?? 0;
                      return (
                        <button
                          key={t.pageNumber}
                          onClick={() => setActivePage(t.pageNumber)}
                          className={cn(
                            "relative shrink-0 overflow-hidden rounded-md border-2 transition-colors",
                            activePage === t.pageNumber
                              ? "border-primary"
                              : "border-transparent hover:border-border"
                          )}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={t.dataUrl} alt={`Halaman ${t.pageNumber}`} className="h-20 w-auto" />
                          {angle !== 0 && (
                            <span className="absolute right-1 top-1 rounded-full bg-primary px-1.5 text-[10px] font-medium text-primary-foreground">
                              {angle}°
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div>
                <p className="mb-2 text-sm font-medium">
                  Atur sudut sampai garis bantu terlihat sejajar dengan isi halaman
                </p>
                {pageRenderLoading || !pageRender ? (
                  <Spinner label="Merender halaman..." />
                ) : (
                  <div className="relative overflow-hidden rounded-lg border border-border bg-muted/30 p-6">
                    <div className="pointer-events-none absolute inset-0 flex flex-col justify-evenly">
                      <div className="border-t border-dashed border-primary/40" />
                      <div className="border-t border-dashed border-primary/40" />
                      <div className="border-t border-dashed border-primary/40" />
                    </div>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={pageRender.dataUrl}
                      alt="Pratinjau halaman"
                      className="mx-auto block max-w-[85%] transition-transform duration-75"
                      style={{ transform: `rotate(${currentAngle}deg)` }}
                      draggable={false}
                    />
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min={-45}
                    max={45}
                    step={0.1}
                    value={currentAngle}
                    onChange={(e) => setAngleForActive(Number(e.target.value))}
                    className="flex-1 accent-primary"
                  />
                  <Input
                    type="number"
                    step={0.1}
                    value={currentAngle}
                    onChange={(e) => setAngleForActive(Number(e.target.value))}
                    className="w-24 shrink-0"
                  />
                  <span className="shrink-0 text-sm text-muted-foreground">derajat</span>
                </div>

                <div className="flex flex-wrap gap-2">
                  {NUDGES.map((n) => (
                    <Button
                      key={n}
                      variant="outline"
                      size="sm"
                      onClick={() => setAngleForActive(currentAngle + n)}
                    >
                      {n > 0 ? `+${n}°` : `${n}°`}
                    </Button>
                  ))}
                  <Button variant="outline" size="sm" onClick={() => setAngleForActive(0)}>
                    Reset halaman ini
                  </Button>
                </div>
              </div>

              <Button size="lg" disabled={busy || touchedCount === 0} onClick={handleApply} className="self-start">
                <ScanLine className="h-4 w-4" />
                {busy
                  ? "Meluruskan..."
                  : `Luruskan${touchedCount > 0 ? ` (${touchedCount} halaman)` : ""}`}
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
