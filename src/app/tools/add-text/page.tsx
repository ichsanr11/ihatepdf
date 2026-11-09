"use client";

import { useEffect, useRef, useState } from "react";
import {
  Type,
  RotateCcw,
  Plus,
  Trash2,
  Bold,
  Italic,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
} from "lucide-react";
import { ToolPageHeader } from "@/components/tool-page-header";
import { FileDropzone } from "@/components/file-dropzone";
import { ResultPanel } from "@/components/result-panel";
import { ErrorBanner } from "@/components/error-banner";
import { InfoBanner } from "@/components/info-banner";
import { Spinner } from "@/components/spinner";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PdfPagePreview } from "@/components/signature-placer";
import { TextOverlayBox } from "@/components/text-overlay-box";
import type { Placement } from "@/hooks/use-drag-resize-box";
import { getToolBySlug } from "@/lib/tools";
import { usePdfPages } from "@/hooks/use-pdf-pages";
import { FONT_OPTIONS, getFontOption, type TextFontFamily } from "@/lib/pdf/fonts";
import { addTextToPdf, type TextAlignment, type TextItem, type TextListType } from "@/lib/pdf/addText";
import { downloadBytes } from "@/lib/download";
import { baseName, cn } from "@/lib/utils";

const tool = getToolBySlug("add-text")!;

const DEFAULT_PLACEMENT: Placement = { xPct: 0.1, yPct: 0.1, widthPct: 0.5, heightPct: 0.1 };
const PREVIEW_WIDTH = 900;

const ALIGNMENT_OPTIONS: { value: TextAlignment; icon: typeof AlignLeft; label: string }[] = [
  { value: "left", icon: AlignLeft, label: "Rata kiri" },
  { value: "center", icon: AlignCenter, label: "Rata tengah" },
  { value: "right", icon: AlignRight, label: "Rata kanan" },
  { value: "justify", icon: AlignJustify, label: "Rata kiri-kanan" },
];

const LIST_OPTIONS: { value: TextListType; label: string }[] = [
  { value: "none", label: "Tanpa daftar" },
  { value: "bullet", label: "• Bullet" },
  { value: "decimal", label: "1. 2. 3." },
  { value: "alpha", label: "a. b. c." },
  { value: "roman", label: "i. ii. iii." },
];

function newId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function clamp(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v));
}

function hexToRgb01(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace("#", "");
  return {
    r: parseInt(clean.slice(0, 2), 16) / 255,
    g: parseInt(clean.slice(2, 4), 16) / 255,
    b: parseInt(clean.slice(4, 6), 16) / 255,
  };
}

interface TextInstance {
  id: string;
  text: string;
  fontFamily: TextFontFamily;
  fontSizePt: number;
  bold: boolean;
  italic: boolean;
  colorHex: string;
  alignment: TextAlignment;
  listType: TextListType;
  pageIndex: number; // 0-based target page
  applyToAllPages: boolean;
  placement: Placement;
}

export default function AddTextPage() {
  const pdfPages = usePdfPages();
  const containerRef = useRef<HTMLDivElement>(null);

  const [items, setItems] = useState<TextInstance[]>([]);
  const [activePage, setActivePage] = useState(1);
  const [containerWidthPx, setContainerWidthPx] = useState(PREVIEW_WIDTH);

  const [pageRender, setPageRender] = useState<{
    dataUrl: string;
    width: number;
    height: number;
    pageWidthPt: number;
    pageHeightPt: number;
  } | null>(null);
  const [pageRenderLoading, setPageRenderLoading] = useState(false);
  const renderCache = useRef(new Map<number, NonNullable<typeof pageRender>>());

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

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width;
      if (width) setContainerWidthPx(width);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [pageRender]);

  function addTextItem() {
    const stacked = items.filter((it) => !it.applyToAllPages && it.pageIndex === activePage - 1).length;
    const offset = Math.min(stacked * 0.05, 0.3);
    const placement: Placement = {
      xPct: clamp(DEFAULT_PLACEMENT.xPct + offset, 0, 1 - DEFAULT_PLACEMENT.widthPct),
      yPct: clamp(DEFAULT_PLACEMENT.yPct + offset, 0, 1 - DEFAULT_PLACEMENT.heightPct),
      widthPct: DEFAULT_PLACEMENT.widthPct,
      heightPct: DEFAULT_PLACEMENT.heightPct,
    };
    const instance: TextInstance = {
      id: newId(),
      text: "Teks baru",
      fontFamily: "helvetica",
      fontSizePt: 24,
      bold: false,
      italic: false,
      colorHex: "#000000",
      alignment: "left",
      listType: "none",
      pageIndex: activePage - 1,
      applyToAllPages: false,
      placement,
    };
    setItems((prev) => [...prev, instance]);
  }

  function updateItem(id: string, patch: Partial<TextInstance>) {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  }

  function removeItem(id: string) {
    setItems((prev) => prev.filter((it) => it.id !== id));
  }

  async function handleApply() {
    if (!pdfPages.file || items.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      const pdfBytes = await pdfPages.file.arrayBuffer();
      const textItems: TextItem[] = items.map((it) => ({
        text: it.text,
        fontFamily: it.fontFamily,
        fontSizePt: it.fontSizePt,
        bold: it.bold,
        italic: it.italic,
        color: hexToRgb01(it.colorHex),
        alignment: it.alignment,
        listType: it.listType,
        placement: it.placement,
        target: { allPages: it.applyToAllPages, pageIndex: it.pageIndex },
      }));
      const out = await addTextToPdf(pdfBytes, textItems);
      setResult({ bytes: out, fileName: `${baseName(pdfPages.file.name)}_text.pdf` });
    } catch {
      setError("Gagal menambahkan teks. Pastikan file PDF valid dan tidak terkunci password.");
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    pdfPages.reset();
    setItems([]);
    setActivePage(1);
    renderCache.current.clear();
    setPageRender(null);
    setResult(null);
    setError(null);
  }

  const visibleItems = items.filter((it) => it.applyToAllPages || it.pageIndex === activePage - 1);

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
              label="Pilih PDF untuk ditambahkan teks"
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
                      const count = items.filter(
                        (it) => it.applyToAllPages || it.pageIndex === t.pageNumber - 1
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
                          {count > 0 && (
                            <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-medium text-primary-foreground">
                              {count}
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
                  Seret untuk memindahkan, tarik titik di pojok untuk mengubah lebar teks
                </p>
                {pageRenderLoading || !pageRender ? (
                  <Spinner label="Merender halaman..." />
                ) : (
                  <PdfPagePreview backgroundSrc={pageRender.dataUrl} containerRef={containerRef}>
                    {visibleItems.map((it) => (
                      <TextOverlayBox
                        key={it.id}
                        containerRef={containerRef}
                        containerWidthPx={containerWidthPx}
                        pageWidthPt={pageRender.pageWidthPt}
                        text={it.text}
                        fontFamily={it.fontFamily}
                        fontSizePt={it.fontSizePt}
                        bold={it.bold}
                        italic={it.italic}
                        color={it.colorHex}
                        alignment={it.alignment}
                        listType={it.listType}
                        placement={it.placement}
                        onChange={(p) => updateItem(it.id, { placement: p })}
                        onRemove={() => removeItem(it.id)}
                        label={String(items.indexOf(it) + 1)}
                      />
                    ))}
                  </PdfPagePreview>
                )}
              </div>

              <InfoBanner message="Font di pratinjau memakai web font sebagai perkiraan visual dari font PDF aslinya, jadi posisi baris baru saat teks panjang bisa sedikit berbeda dari hasil akhir — tidak pixel-perfect, tapi sangat dekat. Font selain Helvetica/Times/Courier hanya punya varian regular & bold (tanpa italic) — bukan font asli Microsoft Word (Calibri/Cambria/Segoe UI dll tidak bisa dibagikan ulang secara legal), tapi pilihan font terbuka yang setara." />

              <div className="flex flex-col gap-3">
                <p className="text-sm font-medium">Teks {items.length > 0 && `(${items.length})`}</p>

                {items.map((it, i) => (
                  <div key={it.id} className="flex flex-col gap-3 rounded-lg border border-border bg-card p-3">
                    <div className="flex items-start gap-3">
                      <span className="mt-2 w-6 shrink-0 text-center text-xs font-medium text-muted-foreground">
                        {i + 1}
                      </span>
                      <Textarea
                        rows={2}
                        value={it.text}
                        onChange={(e) => updateItem(it.id, { text: e.target.value })}
                        placeholder="Tulis teks di sini..."
                        className="flex-1"
                      />
                      <button
                        onClick={() => removeItem(it.id)}
                        className="mt-1 shrink-0 rounded p-1.5 text-muted-foreground hover:bg-destructive hover:text-destructive-foreground"
                        aria-label="Hapus teks ini"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 pl-9">
                      <Select
                        className="w-48 shrink-0"
                        value={it.fontFamily}
                        onChange={(e) => {
                          const fontFamily = e.target.value as TextFontFamily;
                          const stillSupportsItalic = getFontOption(fontFamily).standard;
                          updateItem(it.id, {
                            fontFamily,
                            italic: stillSupportsItalic ? it.italic : false,
                          });
                        }}
                      >
                        {FONT_OPTIONS.map((f) => (
                          <option key={f.value} value={f.value}>
                            {f.label}
                          </option>
                        ))}
                      </Select>

                      <Input
                        type="number"
                        min={6}
                        max={200}
                        value={it.fontSizePt}
                        onChange={(e) =>
                          updateItem(it.id, { fontSizePt: clamp(Number(e.target.value) || 1, 6, 200) })
                        }
                        className="w-20 shrink-0"
                        title="Ukuran font (pt)"
                      />

                      <input
                        type="color"
                        value={it.colorHex}
                        onChange={(e) => updateItem(it.id, { colorHex: e.target.value })}
                        className="h-10 w-10 shrink-0 cursor-pointer rounded-md border border-input bg-background p-1"
                        title="Warna teks"
                      />

                      <button
                        onClick={() => updateItem(it.id, { bold: !it.bold })}
                        className={cn(
                          "flex h-10 w-10 shrink-0 items-center justify-center rounded-md border transition-colors",
                          it.bold
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-input text-muted-foreground hover:bg-accent"
                        )}
                        title="Bold"
                        aria-pressed={it.bold}
                      >
                        <Bold className="h-4 w-4" />
                      </button>

                      {(() => {
                        const italicSupported = getFontOption(it.fontFamily).standard;
                        return (
                          <button
                            onClick={() => italicSupported && updateItem(it.id, { italic: !it.italic })}
                            disabled={!italicSupported}
                            className={cn(
                              "flex h-10 w-10 shrink-0 items-center justify-center rounded-md border transition-colors disabled:cursor-not-allowed disabled:opacity-40",
                              it.italic
                                ? "border-primary bg-primary/10 text-primary"
                                : "border-input text-muted-foreground hover:bg-accent"
                            )}
                            title={italicSupported ? "Italic" : "Font ini tidak punya varian italic"}
                            aria-pressed={it.italic}
                          >
                            <Italic className="h-4 w-4" />
                          </button>
                        );
                      })()}

                      <div className="flex shrink-0 overflow-hidden rounded-md border border-input">
                        {ALIGNMENT_OPTIONS.map(({ value, icon: Icon, label }) => (
                          <button
                            key={value}
                            onClick={() => updateItem(it.id, { alignment: value })}
                            className={cn(
                              "flex h-10 w-10 items-center justify-center border-r border-input last:border-r-0 transition-colors",
                              it.alignment === value
                                ? "bg-primary/10 text-primary"
                                : "text-muted-foreground hover:bg-accent"
                            )}
                            title={label}
                            aria-pressed={it.alignment === value}
                          >
                            <Icon className="h-4 w-4" />
                          </button>
                        ))}
                      </div>

                      <Select
                        className="w-36 shrink-0"
                        value={it.listType}
                        onChange={(e) => updateItem(it.id, { listType: e.target.value as TextListType })}
                        title="Jenis daftar — tiap baris baru jadi satu item daftar"
                      >
                        {LIST_OPTIONS.map((l) => (
                          <option key={l.value} value={l.value}>
                            {l.label}
                          </option>
                        ))}
                      </Select>

                      <Select
                        className="w-40 shrink-0"
                        value={it.applyToAllPages ? "all" : String(it.pageIndex)}
                        onChange={(e) => {
                          const v = e.target.value;
                          updateItem(it.id, {
                            applyToAllPages: v === "all",
                            pageIndex: v === "all" ? it.pageIndex : Number(v),
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
                    </div>
                  </div>
                ))}

                <button
                  onClick={addTextItem}
                  className="flex w-fit items-center gap-2 rounded-md border border-dashed border-border px-3 py-2 text-sm text-muted-foreground hover:border-primary/60 hover:text-foreground"
                >
                  <Plus className="h-4 w-4" />
                  Tambah Teks
                </button>
                <p className="text-xs text-muted-foreground">
                  Tambahkan sebanyak yang dibutuhkan — tiap teks diatur posisi, font, ukuran, warna,
                  bold/italic, perataan, jenis daftar, dan halaman targetnya sendiri-sendiri. Setiap
                  baris baru (Enter) di kotak teks jadi satu paragraf/item daftar terpisah.
                </p>
              </div>

              <Button size="lg" disabled={busy || items.length === 0} onClick={handleApply} className="self-start">
                <Type className="h-4 w-4" />
                {busy ? "Menerapkan..." : `Terapkan ${items.length > 0 ? `${items.length} ` : ""}Teks`}
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
