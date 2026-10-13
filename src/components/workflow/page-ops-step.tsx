"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ErrorBanner } from "@/components/error-banner";
import { Spinner } from "@/components/spinner";
import { PageThumbnailGrid } from "@/components/page-thumbnail-grid";
import { usePdfThumbnails } from "@/hooks/use-pdf-thumbnails";
import { buildPdfFromSelection } from "@/lib/pdf/pageOps";
import { bytesToPdfFile, toArrayBuffer } from "@/lib/utils";
import type { WorkflowStepProps } from "./types";

export type PageOpsMode = "reorder" | "remove-pages" | "extract-pages" | "rotate";

const COPY: Record<PageOpsMode, { instructions: string; applyLabel: (n: number) => string }> = {
  reorder: {
    instructions: "Seret kartu halaman untuk mengubah urutan.",
    applyLabel: () => "Urutkan ulang halaman",
  },
  "remove-pages": {
    instructions: "Klik halaman yang ingin dihapus.",
    applyLabel: (n) => `Hapus ${n} halaman`,
  },
  "extract-pages": {
    instructions: "Klik halaman yang ingin disimpan.",
    applyLabel: (n) => `Ambil ${n} halaman`,
  },
  rotate: {
    instructions: "Klik ikon putar di tiap halaman, atau putar semua sekaligus.",
    applyLabel: () => "Putar halaman",
  },
};

export function PageOpsStep({
  mode,
  workingBytes,
  fileName,
  onApply,
  onCancel,
}: WorkflowStepProps & { mode: PageOpsMode }) {
  const { items, setItems, loading, error, load } = usePdfThumbnails();
  const [busy, setBusy] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);

  useEffect(() => {
    load(bytesToPdfFile(workingBytes, fileName));
    // Only load once, from the bytes this step opened with.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedCount = items.filter((i) => i.selected).length;

  function rotateOne(id: string) {
    setItems((prev) => prev.map((p) => (p.id === id ? { ...p, rotation: (p.rotation + 90) % 360 } : p)));
  }
  function rotateAll() {
    setItems((prev) => prev.map((p) => ({ ...p, rotation: (p.rotation + 90) % 360 })));
  }

  async function handleApply() {
    setApplyError(null);

    let selection: { index: number; addRotation?: number }[];
    if (mode === "remove-pages") {
      selection = items.filter((i) => !i.selected).map((i) => ({ index: i.originalIndex }));
      if (selection.length === 0) {
        setApplyError("Tidak bisa menghapus semua halaman — dokumen butuh minimal 1 halaman.");
        return;
      }
    } else if (mode === "extract-pages") {
      if (selectedCount === 0) return;
      selection = items
        .filter((i) => i.selected)
        .sort((a, b) => a.originalIndex - b.originalIndex)
        .map((i) => ({ index: i.originalIndex }));
    } else if (mode === "rotate") {
      selection = items.map((i) => ({ index: i.originalIndex, addRotation: i.rotation }));
    } else {
      selection = items.map((i) => ({ index: i.originalIndex }));
    }

    setBusy(true);
    try {
      const out = await buildPdfFromSelection(toArrayBuffer(workingBytes), selection);
      onApply(out, COPY[mode].applyLabel(selectedCount));
    } catch {
      setApplyError("Gagal memproses halaman.");
    } finally {
      setBusy(false);
    }
  }

  const canApply =
    mode === "remove-pages" || mode === "extract-pages" ? selectedCount > 0 : true;

  return (
    <div className="flex flex-col gap-4">
      {(error || applyError) && <ErrorBanner message={error ?? applyError!} />}

      {loading ? (
        <Spinner label="Merender halaman..." />
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              {COPY[mode].instructions}
              {(mode === "remove-pages" || mode === "extract-pages") && selectedCount > 0 && (
                <span className="ml-1 font-medium text-foreground">{selectedCount} halaman dipilih</span>
              )}
            </p>
            {mode === "rotate" && (
              <Button variant="outline" size="sm" onClick={rotateAll}>
                Putar Semua Halaman
              </Button>
            )}
          </div>

          <PageThumbnailGrid
            items={items}
            draggable={mode === "reorder"}
            onReorder={mode === "reorder" ? setItems : undefined}
            selectable={mode === "remove-pages" || mode === "extract-pages"}
            selectionIntent={mode === "remove-pages" ? "remove" : "keep"}
            onToggleSelect={
              mode === "remove-pages" || mode === "extract-pages"
                ? (id) => setItems((prev) => prev.map((p) => (p.id === id ? { ...p, selected: !p.selected } : p)))
                : undefined
            }
            rotatable={mode === "rotate"}
            onRotate={mode === "rotate" ? rotateOne : undefined}
          />

          <div className="flex gap-2">
            <Button onClick={handleApply} disabled={!canApply || busy}>
              {busy ? "Memproses..." : "Terapkan"}
            </Button>
            <Button variant="outline" onClick={onCancel}>
              Batal
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
