"use client";

import type { RefObject } from "react";
import { Move, X } from "lucide-react";
import { useDragResizeBox, type Placement } from "@/hooks/use-drag-resize-box";

/**
 * A draggable, freely-resizable solid rectangle used to visually cover a
 * signature or stamp that isn't a removable embedded image (e.g. ink
 * strokes or text drawn straight into the page content). Unlike
 * `SignatureOverlayBox` this has no "natural" aspect ratio to preserve —
 * resize is unconstrained — and it paints a flat color instead of an
 * image, since that's what actually gets drawn onto the PDF.
 */
export function RedactOverlayBox({
  containerRef,
  placement,
  onChange,
  onRemove,
  color = "#ffffff",
  label,
}: {
  containerRef: RefObject<HTMLDivElement | null>;
  placement: Placement;
  onChange: (p: Placement) => void;
  onRemove?: () => void;
  color?: string;
  label?: string;
}) {
  const { startDrag, startResize, handleMove, endInteraction } = useDragResizeBox(
    containerRef,
    placement,
    onChange
  );

  return (
    <div
      onPointerDown={startDrag}
      onPointerMove={handleMove}
      onPointerUp={endInteraction}
      onPointerCancel={endInteraction}
      className="group absolute cursor-move touch-none border-2 border-dashed border-destructive"
      style={{
        left: `${placement.xPct * 100}%`,
        top: `${placement.yPct * 100}%`,
        width: `${placement.widthPct * 100}%`,
        height: `${placement.heightPct * 100}%`,
        backgroundColor: color,
      }}
    >
      {label && (
        <div className="pointer-events-none absolute -left-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-[11px] font-medium text-destructive-foreground">
          {label}
        </div>
      )}

      <div className="pointer-events-none absolute left-1/2 top-1/2 flex h-5 w-5 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-destructive/80 text-destructive-foreground opacity-0 transition-opacity group-hover:opacity-100">
        <Move className="h-3 w-3" />
      </div>

      {onRemove && (
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={onRemove}
          className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full border-2 border-background bg-destructive text-destructive-foreground opacity-0 transition-opacity hover:bg-destructive/90 group-hover:opacity-100"
          aria-label="Hapus kotak ini"
        >
          <X className="h-3 w-3" />
        </button>
      )}

      <div
        onPointerDown={startResize}
        onPointerMove={handleMove}
        onPointerUp={endInteraction}
        onPointerCancel={endInteraction}
        className="absolute -bottom-2 -right-2 h-4 w-4 cursor-nwse-resize touch-none rounded-full border-2 border-background bg-destructive"
      />
    </div>
  );
}
