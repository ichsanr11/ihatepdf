"use client";

import { useEffect, useRef, useState } from "react";
import { ScanLine } from "lucide-react";
import { ErrorBanner } from "@/components/error-banner";
import { InfoBanner } from "@/components/info-banner";
import { Spinner } from "@/components/spinner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { usePdfPages } from "@/hooks/use-pdf-pages";
import { deskewPdf } from "@/lib/pdf/deskew";
import { bytesToPdfFile, cn, toArrayBuffer } from "@/lib/utils";
import type { WorkflowStepProps } from "./types";

const PREVIEW_WIDTH = 900;
const NUDGES = [-1, -0.1, 0.1, 1];

export function DeskewStep({ workingBytes, fileName, onApply, onCancel }: WorkflowStepProps) {
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

  useEffect(() => {
    pdfPages.load(bytesToPdfFile(workingBytes, fileName));
    // Load once from the bytes this step opened with.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    if (touchedCount === 0) return;
    setBusy(true);
    setError(null);
    try {
      const out = await deskewPdf(toArrayBuffer(workingBytes), angles);
      onApply(out, `Luruskan ${touchedCount} halaman`);
    } catch {
      setError("Gagal meluruskan halaman.");
    } finally {
      setBusy(false);
    }
  }

  if (pdfPages.loading || pdfPages.thumbnails.length === 0) {
    return <Spinner label="Memuat halaman PDF..." />;
  }

  return (
    <div className="flex flex-col gap-4">
      {(pdfPages.error || error) && <ErrorBanner message={pdfPages.error ?? error!} />}

      <InfoBanner message="Halaman yang sudutnya diubah akan jadi gambar beresolusi tinggi (margin putih tipis supaya konten tidak terpotong). Halaman yang tidak disentuh tetap seperti semula." />

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
                    activePage === t.pageNumber ? "border-primary" : "border-transparent hover:border-border"
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
        <p className="mb-2 text-sm font-medium">Atur sudut sampai garis bantu sejajar dengan isi halaman</p>
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
            <Button key={n} variant="outline" size="sm" onClick={() => setAngleForActive(currentAngle + n)}>
              {n > 0 ? `+${n}°` : `${n}°`}
            </Button>
          ))}
          <Button variant="outline" size="sm" onClick={() => setAngleForActive(0)}>
            Reset halaman ini
          </Button>
        </div>
      </div>

      <div className="flex gap-2">
        <Button disabled={busy || touchedCount === 0} onClick={handleApply}>
          <ScanLine className="h-4 w-4" />
          {busy ? "Meluruskan..." : "Terapkan"}
        </Button>
        <Button variant="outline" onClick={onCancel}>
          Batal
        </Button>
      </div>
    </div>
  );
}
