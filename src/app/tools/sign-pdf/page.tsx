"use client";

import { useEffect, useRef, useState } from "react";
import { Signature, RotateCcw, Plus, Trash2 } from "lucide-react";
import { ToolPageHeader } from "@/components/tool-page-header";
import { FileDropzone } from "@/components/file-dropzone";
import { ResultPanel } from "@/components/result-panel";
import { ErrorBanner } from "@/components/error-banner";
import { Spinner } from "@/components/spinner";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { PdfPagePreview, SignatureOverlayBox, type Placement } from "@/components/signature-placer";
import { getToolBySlug } from "@/lib/tools";
import { usePdfPages } from "@/hooks/use-pdf-pages";
import { signPdf, stripWhiteBackground, getImageDimensions, type SignatureStamp } from "@/lib/pdf/sign";
import { downloadBytes } from "@/lib/download";
import { baseName, cn } from "@/lib/utils";

const tool = getToolBySlug("sign-pdf")!;

const DEFAULT_PLACEMENT: Placement = { xPct: 0.55, yPct: 0.78, widthPct: 0.3, heightPct: 0.12 };
const PREVIEW_WIDTH = 900;

function sigMimeFromFile(f: File): string {
  return f.type === "image/png" || /\.png$/i.test(f.name) ? "image/png" : "image/jpeg";
}

function newId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function clamp(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v));
}

interface SignatureInstance {
  id: string;
  originalBytes: Uint8Array;
  originalMime: string;
  activeBytes: Uint8Array;
  activeMime: string;
  previewUrl: string;
  aspect: number;
  stripBackground: boolean;
  stripBusy: boolean;
  pageIndex: number; // 0-based target page
  applyToAllPages: boolean;
  placement: Placement;
}

export default function SignPdfPage() {
  const pdfPages = usePdfPages();
  const containerRef = useRef<HTMLDivElement>(null);

  const [signatures, setSignatures] = useState<SignatureInstance[]>([]);
  const [activePage, setActivePage] = useState(1);

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
    // renderHighRes is a stable useCallback; only re-run when the file or page changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePage, pdfPages.file]);

  async function addSignatureFile(f: File) {
    setError(null);
    const bytes = new Uint8Array(await f.arrayBuffer());
    const mime = sigMimeFromFile(f);
    let aspect = 2.5;
    try {
      const dims = await getImageDimensions(bytes, mime);
      aspect = dims.width / dims.height;
    } catch {
      // Keep the fallback aspect — the resize handle self-corrects on first drag.
    }

    // Cascade the default spot a little for each extra signature already
    // targeting this page, so new ones don't land exactly on top of the last.
    const stacked = signatures.filter((s) => !s.applyToAllPages && s.pageIndex === activePage - 1).length;
    const offset = Math.min(stacked * 0.05, 0.3);
    const placement: Placement = {
      xPct: clamp(DEFAULT_PLACEMENT.xPct - offset, 0, 1 - DEFAULT_PLACEMENT.widthPct),
      yPct: clamp(DEFAULT_PLACEMENT.yPct - offset, 0, 1 - DEFAULT_PLACEMENT.heightPct),
      widthPct: DEFAULT_PLACEMENT.widthPct,
      heightPct: DEFAULT_PLACEMENT.heightPct,
    };

    const instance: SignatureInstance = {
      id: newId(),
      originalBytes: bytes,
      originalMime: mime,
      activeBytes: bytes,
      activeMime: mime,
      previewUrl: URL.createObjectURL(new Blob([bytes], { type: mime })),
      aspect,
      stripBackground: false,
      stripBusy: false,
      pageIndex: activePage - 1,
      applyToAllPages: false,
      placement,
    };
    setSignatures((prev) => [...prev, instance]);
  }

  function updatePlacement(id: string, placement: Placement) {
    setSignatures((prev) => prev.map((s) => (s.id === id ? { ...s, placement } : s)));
  }

  function setSignatureTarget(id: string, target: { pageIndex: number; applyToAllPages: boolean }) {
    setSignatures((prev) => prev.map((s) => (s.id === id ? { ...s, ...target } : s)));
  }

  function removeSignature(id: string) {
    setSignatures((prev) => {
      const target = prev.find((s) => s.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((s) => s.id !== id);
    });
  }

  async function toggleStripBackground(id: string, checked: boolean) {
    const sig = signatures.find((s) => s.id === id);
    if (!sig) return;
    setSignatures((prev) => prev.map((s) => (s.id === id ? { ...s, stripBusy: true } : s)));
    try {
      const activeBytes = checked ? await stripWhiteBackground(sig.originalBytes) : sig.originalBytes;
      const activeMime = checked ? "image/png" : sig.originalMime;
      const newPreviewUrl = URL.createObjectURL(new Blob([new Uint8Array(activeBytes)], { type: activeMime }));
      setSignatures((prev) =>
        prev.map((s) => {
          if (s.id !== id) return s;
          URL.revokeObjectURL(s.previewUrl);
          return {
            ...s,
            stripBackground: checked,
            activeBytes,
            activeMime,
            previewUrl: newPreviewUrl,
            stripBusy: false,
          };
        })
      );
    } catch {
      setError("Gagal memproses gambar tanda tangan.");
      setSignatures((prev) => prev.map((s) => (s.id === id ? { ...s, stripBusy: false } : s)));
    }
  }

  async function handleApply() {
    if (!pdfPages.file || signatures.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      const pdfBytes = await pdfPages.file.arrayBuffer();
      const stamps: SignatureStamp[] = signatures.map((s) => ({
        bytes: s.activeBytes,
        mimeType: s.activeMime,
        placement: s.placement,
        target: { allPages: s.applyToAllPages, pageIndex: s.pageIndex },
      }));
      const out = await signPdf(pdfBytes, stamps);
      setResult({ bytes: out, fileName: `${baseName(pdfPages.file.name)}_signed.pdf` });
    } catch {
      setError("Gagal menerapkan tanda tangan. Pastikan file PDF & gambar tanda tangan valid.");
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    pdfPages.reset();
    signatures.forEach((s) => URL.revokeObjectURL(s.previewUrl));
    setSignatures([]);
    setActivePage(1);
    renderCache.current.clear();
    setPageRender(null);
    setResult(null);
    setError(null);
  }

  const visibleSignatures = signatures.filter((s) => s.applyToAllPages || s.pageIndex === activePage - 1);

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
              label="Pilih PDF yang akan ditandatangani"
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

              {pdfPages.thumbnails.length > 1 && (
                <div>
                  <p className="mb-2 text-sm font-medium">Halaman yang ditampilkan</p>
                  <div className="flex gap-2 overflow-x-auto pb-1 thin-scrollbar">
                    {pdfPages.thumbnails.map((t) => {
                      const sigCount = signatures.filter(
                        (s) => s.applyToAllPages || s.pageIndex === t.pageNumber - 1
                      ).length;
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
                          {sigCount > 0 && (
                            <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-medium text-primary-foreground">
                              {sigCount}
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
                  Seret untuk memindahkan, tarik titik di pojok untuk mengubah ukuran
                </p>
                {pageRenderLoading || !pageRender ? (
                  <Spinner label="Merender halaman..." />
                ) : (
                  <PdfPagePreview backgroundSrc={pageRender.dataUrl} containerRef={containerRef}>
                    {visibleSignatures.map((s) => (
                      <SignatureOverlayBox
                        key={s.id}
                        containerRef={containerRef}
                        signatureSrc={s.previewUrl}
                        signatureAspect={s.aspect}
                        placement={s.placement}
                        onChange={(p) => updatePlacement(s.id, p)}
                        onRemove={() => removeSignature(s.id)}
                        label={String(signatures.indexOf(s) + 1)}
                      />
                    ))}
                  </PdfPagePreview>
                )}
              </div>

              <div className="flex flex-col gap-3">
                <p className="text-sm font-medium">
                  Tanda tangan {signatures.length > 0 && `(${signatures.length})`}
                </p>

                {signatures.map((s, i) => (
                  <div
                    key={s.id}
                    className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card p-3"
                  >
                    <button
                      onClick={() => setActivePage(s.applyToAllPages ? activePage : s.pageIndex + 1)}
                      className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded border border-border bg-muted/30"
                      title="Lihat di halaman"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={s.previewUrl} alt={`Tanda tangan ${i + 1}`} className="max-h-full max-w-full" />
                    </button>

                    <span className="w-6 shrink-0 text-center text-xs font-medium text-muted-foreground">
                      {i + 1}
                    </span>

                    <Select
                      className="w-40 shrink-0"
                      value={s.applyToAllPages ? "all" : String(s.pageIndex)}
                      onChange={(e) => {
                        const v = e.target.value;
                        setSignatureTarget(s.id, {
                          applyToAllPages: v === "all",
                          pageIndex: v === "all" ? s.pageIndex : Number(v),
                        });
                      }}
                    >
                      {pdfPages.thumbnails.map((t) => (
                        <option key={t.pageNumber} value={t.pageNumber - 1}>
                          Halaman {t.pageNumber}
                        </option>
                      ))}
                      <option value="all">Semua halaman</option>
                    </Select>

                    <label className="flex shrink-0 cursor-pointer items-center gap-1.5 text-xs text-muted-foreground">
                      <input
                        type="checkbox"
                        checked={s.stripBackground}
                        disabled={s.stripBusy}
                        onChange={(e) => toggleStripBackground(s.id, e.target.checked)}
                        className="accent-primary"
                      />
                      Hapus latar belakang
                      {s.stripBusy && <span>...</span>}
                    </label>

                    <button
                      onClick={() => removeSignature(s.id)}
                      className="ml-auto shrink-0 rounded p-1.5 text-muted-foreground hover:bg-destructive hover:text-destructive-foreground"
                      aria-label="Hapus tanda tangan ini"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}

                <label className="flex w-fit cursor-pointer items-center gap-2 rounded-md border border-dashed border-border px-3 py-2 text-sm text-muted-foreground hover:border-primary/60 hover:text-foreground">
                  <Plus className="h-4 w-4" />
                  Tambah Tanda Tangan
                  <input
                    type="file"
                    accept="image/png,image/jpeg"
                    className="hidden"
                    onChange={(e) => e.target.files?.[0] && addSignatureFile(e.target.files[0])}
                  />
                </label>
                <p className="text-xs text-muted-foreground">
                  Tambahkan sebanyak yang dibutuhkan — misalnya tanda tangan dua pihak yang berbeda,
                  atau paraf di tiap halaman plus tanda tangan penuh di halaman terakhir. Setiap
                  tanda tangan diatur posisi, ukuran, dan halaman targetnya sendiri-sendiri.
                </p>
              </div>

              <Button size="lg" disabled={busy || signatures.length === 0} onClick={handleApply} className="self-start">
                <Signature className="h-4 w-4" />
                {busy
                  ? "Menerapkan..."
                  : `Terapkan ${signatures.length > 0 ? `${signatures.length} ` : ""}Tanda Tangan`}
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
