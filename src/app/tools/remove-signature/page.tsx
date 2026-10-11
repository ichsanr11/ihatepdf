"use client";

import { useEffect, useRef, useState } from "react";
import { Eraser, RotateCcw, Plus, Trash2, ImageOff } from "lucide-react";
import { ToolPageHeader } from "@/components/tool-page-header";
import { FileDropzone } from "@/components/file-dropzone";
import { ResultPanel } from "@/components/result-panel";
import { ErrorBanner } from "@/components/error-banner";
import { InfoBanner } from "@/components/info-banner";
import { Spinner } from "@/components/spinner";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { PdfPagePreview } from "@/components/signature-placer";
import { RedactOverlayBox } from "@/components/redact-overlay-box";
import type { Placement } from "@/hooks/use-drag-resize-box";
import { getToolBySlug } from "@/lib/tools";
import { usePdfPages } from "@/hooks/use-pdf-pages";
import {
  countImagesPerPage,
  listPageImages,
  applyRemovals,
  type PageImageInfo,
  type ImageRemoval,
  type RedactBoxSpec,
} from "@/lib/pdf/removeMarks";
import { downloadBytes } from "@/lib/download";
import { baseName, cn } from "@/lib/utils";

const tool = getToolBySlug("remove-signature")!;

const DEFAULT_BOX_PLACEMENT: Placement = { xPct: 0.3, yPct: 0.42, widthPct: 0.4, heightPct: 0.16 };
const PREVIEW_WIDTH = 900;

function newId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function clamp(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v));
}

function hexToRgb01(hex: string): { r: number; g: number; b: number } {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!m) return { r: 1, g: 1, b: 1 };
  return { r: parseInt(m[1], 16) / 255, g: parseInt(m[2], 16) / 255, b: parseInt(m[3], 16) / 255 };
}

function rgb01ToHex(c: { r: number; g: number; b: number }): string {
  const toHex = (v: number) => Math.round(v * 255).toString(16).padStart(2, "0");
  return `#${toHex(c.r)}${toHex(c.g)}${toHex(c.b)}`;
}

interface BoxInstance {
  id: string;
  pageIndex: number;
  placement: Placement;
  color: { r: number; g: number; b: number };
}

export default function RemoveSignaturePage() {
  const pdfPages = usePdfPages();
  const containerRef = useRef<HTMLDivElement>(null);

  const [activePage, setActivePage] = useState(1);
  const [imageCounts, setImageCounts] = useState<number[]>([]);

  const [pageImages, setPageImages] = useState<PageImageInfo[]>([]);
  const [pageImagesLoading, setPageImagesLoading] = useState(false);
  const imageListCache = useRef(new Map<number, PageImageInfo[]>());
  const [selectedImages, setSelectedImages] = useState<Set<string>>(new Set());

  const [boxes, setBoxes] = useState<BoxInstance[]>([]);

  const [pageRender, setPageRender] = useState<{ dataUrl: string; width: number; height: number } | null>(
    null
  );
  const [pageRenderLoading, setPageRenderLoading] = useState(false);
  const renderCache = useRef(new Map<number, { dataUrl: string; width: number; height: number }>());

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ bytes: Uint8Array; fileName: string } | null>(null);

  // High-res page render, same lazy+cache pattern as Sign PDF.
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

  // Count images per page once the PDF loads (cheap — no decoding).
  useEffect(() => {
    if (!pdfPages.file) return;
    pdfPages.file.arrayBuffer().then((bytes) => {
      countImagesPerPage(bytes).then(setImageCounts);
    });
  }, [pdfPages.file]);

  // Lazily list (and decode previews for) images on the active page.
  useEffect(() => {
    if (!pdfPages.file) return;
    const pageIndex = activePage - 1;
    const cached = imageListCache.current.get(pageIndex);
    if (cached) {
      setPageImages(cached);
      return;
    }
    setPageImagesLoading(true);
    pdfPages.file.arrayBuffer().then((bytes) => {
      listPageImages(bytes, pageIndex).then((images) => {
        imageListCache.current.set(pageIndex, images);
        setPageImages(images);
        setPageImagesLoading(false);
      });
    });
  }, [activePage, pdfPages.file]);

  function toggleImageSelected(name: string) {
    const key = `${activePage - 1}:${name}`;
    setSelectedImages((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function addBox() {
    const stacked = boxes.filter((b) => b.pageIndex === activePage - 1).length;
    const offset = Math.min(stacked * 0.05, 0.3);
    const placement: Placement = {
      xPct: clamp(DEFAULT_BOX_PLACEMENT.xPct - offset, 0, 1 - DEFAULT_BOX_PLACEMENT.widthPct),
      yPct: clamp(DEFAULT_BOX_PLACEMENT.yPct - offset, 0, 1 - DEFAULT_BOX_PLACEMENT.heightPct),
      widthPct: DEFAULT_BOX_PLACEMENT.widthPct,
      heightPct: DEFAULT_BOX_PLACEMENT.heightPct,
    };
    setBoxes((prev) => [...prev, { id: newId(), pageIndex: activePage - 1, placement, color: { r: 1, g: 1, b: 1 } }]);
  }

  function updateBoxPlacement(id: string, placement: Placement) {
    setBoxes((prev) => prev.map((b) => (b.id === id ? { ...b, placement } : b)));
  }

  function updateBoxColor(id: string, color: { r: number; g: number; b: number }) {
    setBoxes((prev) => prev.map((b) => (b.id === id ? { ...b, color } : b)));
  }

  function updateBoxTarget(id: string, pageIndex: number) {
    setBoxes((prev) => prev.map((b) => (b.id === id ? { ...b, pageIndex } : b)));
  }

  function removeBox(id: string) {
    setBoxes((prev) => prev.filter((b) => b.id !== id));
  }

  const totalMarked = selectedImages.size + boxes.length;

  async function handleApply() {
    if (!pdfPages.file || totalMarked === 0) return;
    setBusy(true);
    setError(null);
    try {
      const pdfBytes = await pdfPages.file.arrayBuffer();
      const imageRemovals: ImageRemoval[] = Array.from(selectedImages).map((key) => {
        const [pageIndexStr, ...rest] = key.split(":");
        return { pageIndex: Number(pageIndexStr), name: rest.join(":") };
      });
      const boxSpecs: RedactBoxSpec[] = boxes.map((b) => ({
        pageIndex: b.pageIndex,
        xPct: b.placement.xPct,
        yPct: b.placement.yPct,
        widthPct: b.placement.widthPct,
        heightPct: b.placement.heightPct,
        color: b.color,
      }));
      const out = await applyRemovals(pdfBytes, imageRemovals, boxSpecs);
      setResult({ bytes: out, fileName: `${baseName(pdfPages.file.name)}_cleaned.pdf` });
    } catch {
      setError("Gagal memproses PDF. Pastikan file valid dan tidak terkunci password.");
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    pdfPages.reset();
    setActivePage(1);
    setImageCounts([]);
    setPageImages([]);
    imageListCache.current.clear();
    setSelectedImages(new Set());
    setBoxes([]);
    renderCache.current.clear();
    setPageRender(null);
    setResult(null);
    setError(null);
  }

  const visibleBoxes = boxes.filter((b) => b.pageIndex === activePage - 1);

  return (
    <div className="container max-w-4xl py-12">
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
              label="Pilih PDF yang mau dibersihkan"
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

              <InfoBanner message="Gambar tertanam (mis. cap/stempel hasil scan) benar-benar dihapus dari PDF. Tanda tangan berupa coretan langsung (bukan gambar) tidak bisa dihapus beneran secara otomatis — pakai mode 'Tutup dengan Kotak' untuk menutupnya secara visual." />

              {pdfPages.thumbnails.length > 1 && (
                <div>
                  <p className="mb-2 text-sm font-medium">Halaman</p>
                  <div className="flex gap-2 overflow-x-auto pb-1 thin-scrollbar">
                    {pdfPages.thumbnails.map((t) => {
                      const markCount =
                        (imageCounts[t.pageNumber - 1] ?? 0) +
                        boxes.filter((b) => b.pageIndex === t.pageNumber - 1).length;
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
                          {markCount > 0 && (
                            <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-medium text-primary-foreground">
                              {markCount}
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
                  Kotak merah bisa diseret & diubah ukuran untuk menutup area tertentu
                </p>
                {pageRenderLoading || !pageRender ? (
                  <Spinner label="Merender halaman..." />
                ) : (
                  <PdfPagePreview backgroundSrc={pageRender.dataUrl} containerRef={containerRef}>
                    {visibleBoxes.map((b, i) => (
                      <RedactOverlayBox
                        key={b.id}
                        containerRef={containerRef}
                        placement={b.placement}
                        color={rgb01ToHex(b.color)}
                        onChange={(p) => updateBoxPlacement(b.id, p)}
                        onRemove={() => removeBox(b.id)}
                        label={String(i + 1)}
                      />
                    ))}
                  </PdfPagePreview>
                )}
              </div>

              <div className="flex flex-col gap-3">
                <p className="text-sm font-medium">Gambar tertanam di halaman ini</p>
                {pageImagesLoading ? (
                  <Spinner label="Memindai gambar..." className="py-6" />
                ) : pageImages.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Tidak ada gambar tertanam di halaman ini.
                  </p>
                ) : (
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                    {pageImages.map((img) => {
                      const key = `${activePage - 1}:${img.name}`;
                      const selected = selectedImages.has(key);
                      return (
                        <button
                          key={img.name}
                          onClick={() => toggleImageSelected(img.name)}
                          className={cn(
                            "flex flex-col items-center gap-1.5 rounded-lg border-2 p-2 transition-colors",
                            selected ? "border-destructive bg-destructive/5" : "border-border hover:bg-accent"
                          )}
                        >
                          <div className="flex h-16 w-full items-center justify-center overflow-hidden rounded bg-muted/40">
                            {img.previewDataUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={img.previewDataUrl} alt="" className="max-h-full max-w-full" />
                            ) : (
                              <ImageOff className="h-5 w-5 text-muted-foreground" />
                            )}
                          </div>
                          <span
                            className={cn(
                              "text-xs font-medium",
                              selected ? "text-destructive" : "text-muted-foreground"
                            )}
                          >
                            {selected ? "Akan dihapus" : "Pilih untuk hapus"}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-3">
                <p className="text-sm font-medium">
                  Kotak penutup {boxes.length > 0 && `(${boxes.length})`}
                </p>

                {boxes.map((b, i) => (
                  <div
                    key={b.id}
                    className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card p-3"
                  >
                    <input
                      type="color"
                      value={rgb01ToHex(b.color)}
                      onChange={(e) => updateBoxColor(b.id, hexToRgb01(e.target.value))}
                      className="h-8 w-8 shrink-0 cursor-pointer rounded border border-border"
                      title="Warna kotak penutup"
                    />
                    <span className="w-6 shrink-0 text-center text-xs font-medium text-muted-foreground">
                      {i + 1}
                    </span>
                    <Select
                      className="w-40 shrink-0"
                      value={String(b.pageIndex)}
                      onChange={(e) => updateBoxTarget(b.id, Number(e.target.value))}
                    >
                      {pdfPages.thumbnails.map((t) => (
                        <option key={t.pageNumber} value={t.pageNumber - 1}>
                          Halaman {t.pageNumber}
                        </option>
                      ))}
                    </Select>
                    <button
                      onClick={() => removeBox(b.id)}
                      className="ml-auto shrink-0 rounded p-1.5 text-muted-foreground hover:bg-destructive hover:text-destructive-foreground"
                      aria-label="Hapus kotak ini"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}

                <button
                  onClick={addBox}
                  className="flex w-fit cursor-pointer items-center gap-2 rounded-md border border-dashed border-border px-3 py-2 text-sm text-muted-foreground hover:border-primary/60 hover:text-foreground"
                >
                  <Plus className="h-4 w-4" />
                  Tambah Kotak Penutup
                </button>
              </div>

              <Button size="lg" disabled={busy || totalMarked === 0} onClick={handleApply} className="self-start">
                <Eraser className="h-4 w-4" />
                {busy
                  ? "Memproses..."
                  : `Terapkan${totalMarked > 0 ? ` (${totalMarked})` : ""}`}
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
