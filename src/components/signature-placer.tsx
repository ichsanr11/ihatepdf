"use client";

import type { RefObject } from "react";
import { Move, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDragResizeBox, type Placement } from "@/hooks/use-drag-resize-box";

export type { Placement };

/**
 * The page preview surface every overlay (signature or redaction box) is
 * positioned inside — just the rendered page image plus a ref for the
 * overlays to measure themselves against. Pulled apart from the overlay
 * itself so several boxes can share one page and one coordinate space.
 */
export function PdfPagePreview({
  backgroundSrc,
  containerRef,
  children,
}: {
  backgroundSrc: string;
  containerRef: RefObject<HTMLDivElement | null>;
  children?: React.ReactNode;
}) {
  return (
    <div
      ref={containerRef}
      className="relative w-full select-none overflow-hidden rounded-lg border border-border bg-muted/30"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={backgroundSrc} alt="Halaman PDF" className="block w-full" draggable={false} />
      {children}
    </div>
  );
}

/**
 * One draggable, resizable signature overlay. Several of these can sit
 * inside the same `PdfPagePreview`, each independently positioned —
 * `containerRef` points at the shared preview surface so every box
 * measures drag/resize deltas against the same coordinate space.
 * Position/size are tracked as 0-1 fractions of that container, so they
 * carry over correctly no matter how large the preview is rendered.
 */
export function SignatureOverlayBox({
  containerRef,
  signatureSrc,
  signatureAspect,
  placement,
  onChange,
  onRemove,
  label,
  highlighted = false,
}: {
  containerRef: RefObject<HTMLDivElement | null>;
  signatureSrc: string;
  /** width / height of the signature image, used to keep its proportions while resizing. */
  signatureAspect: number;
  placement: Placement;
  onChange: (p: Placement) => void;
  onRemove?: () => void;
  /** Small badge (e.g. "1") shown on the box so it's identifiable when several overlap. */
  label?: string;
  highlighted?: boolean;
}) {
  const { startDrag, startResize, handleMove, endInteraction } = useDragResizeBox(
    containerRef,
    placement,
    onChange,
    signatureAspect
  );

  return (
    <div
      onPointerDown={startDrag}
      onPointerMove={handleMove}
      onPointerUp={endInteraction}
      onPointerCancel={endInteraction}
      className={cn(
        "group absolute cursor-move touch-none border-2 border-primary bg-primary/5",
        highlighted && "ring-2 ring-primary ring-offset-2"
      )}
      style={{
        left: `${placement.xPct * 100}%`,
        top: `${placement.yPct * 100}%`,
        width: `${placement.widthPct * 100}%`,
        height: `${placement.heightPct * 100}%`,
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={signatureSrc} alt="Tanda tangan" className="h-full w-full object-contain" draggable={false} />

      {label && (
        <div className="pointer-events-none absolute -left-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[11px] font-medium text-primary-foreground">
          {label}
        </div>
      )}

      <div className="pointer-events-none absolute left-1/2 top-1/2 flex h-5 w-5 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-primary/80 text-primary-foreground opacity-0 transition-opacity group-hover:opacity-100">
        <Move className="h-3 w-3" />
      </div>

      {onRemove && (
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={onRemove}
          className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full border-2 border-background bg-destructive text-destructive-foreground opacity-0 transition-opacity hover:bg-destructive/90 group-hover:opacity-100"
          aria-label="Hapus tanda tangan ini"
        >
          <X className="h-3 w-3" />
        </button>
      )}

      <div
        onPointerDown={startResize}
        onPointerMove={handleMove}
        onPointerUp={endInteraction}
        onPointerCancel={endInteraction}
        className="absolute -bottom-2 -right-2 h-4 w-4 cursor-nwse-resize touch-none rounded-full border-2 border-primary-foreground bg-primary"
      />
    </div>
  );
}
