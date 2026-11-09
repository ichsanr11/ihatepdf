"use client";

import type { RefObject } from "react";
import { Move, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDragResizeBox, type Placement } from "@/hooks/use-drag-resize-box";
import { getFontOption, type TextFontFamily } from "@/lib/pdf/fonts";
import type { TextAlignment, TextListType } from "@/lib/pdf/addText";

const ROMAN_TABLE: [number, string][] = [
  [1000, "m"], [900, "cm"], [500, "d"], [400, "cd"], [100, "c"], [90, "xc"],
  [50, "l"], [40, "xl"], [10, "x"], [9, "ix"], [5, "v"], [4, "iv"], [1, "i"],
];
function toRoman(n: number): string {
  let num = n;
  let out = "";
  for (const [value, symbol] of ROMAN_TABLE) {
    while (num >= value) {
      out += symbol;
      num -= value;
    }
  }
  return out;
}
function toAlpha(n: number): string {
  let num = n;
  let out = "";
  while (num > 0) {
    out = String.fromCharCode(97 + ((num - 1) % 26)) + out;
    num = Math.floor((num - 1) / 26);
  }
  return out;
}

/** Preview-only approximation of the real PDF list markers (indent/wrap math isn't replicated exactly). */
function previewListMarkers(text: string, listType: TextListType): string {
  if (listType === "none") return text;
  return text
    .split("\n")
    .map((line, i) => {
      if (listType === "bullet") return `•  ${line}`;
      if (listType === "decimal") return `${i + 1}.  ${line}`;
      if (listType === "alpha") return `${toAlpha(i + 1)}.  ${line}`;
      return `${toRoman(i + 1)}.  ${line}`;
    })
    .join("\n");
}

/**
 * One draggable, resizable text overlay on a page preview. The font size is
 * converted from PDF points to CSS pixels using `pageWidthPt` and the
 * container's *actual rendered* CSS width (not a fixed constant), so it
 * stays visually correct however large the preview ends up on screen.
 * This is an approximation, not a pixel-perfect match — the preview
 * substitutes a web font (Arial/Times New Roman/Courier New) for the real
 * PDF font, so line-wrapping may fall at a slightly different point than
 * the final PDF.
 */
export function TextOverlayBox({
  containerRef,
  containerWidthPx,
  pageWidthPt,
  text,
  fontFamily,
  fontSizePt,
  bold,
  italic,
  color,
  alignment,
  listType,
  placement,
  onChange,
  onRemove,
  label,
  highlighted = false,
}: {
  containerRef: RefObject<HTMLDivElement | null>;
  containerWidthPx: number;
  pageWidthPt: number;
  text: string;
  fontFamily: TextFontFamily;
  fontSizePt: number;
  bold: boolean;
  italic: boolean;
  color: string;
  alignment: TextAlignment;
  listType: TextListType;
  placement: Placement;
  onChange: (p: Placement) => void;
  onRemove?: () => void;
  label?: string;
  highlighted?: boolean;
}) {
  const { startDrag, startResize, handleMove, endInteraction } = useDragResizeBox(
    containerRef,
    placement,
    onChange
  );

  const fontSizePx = pageWidthPt > 0 ? (fontSizePt / pageWidthPt) * containerWidthPx : fontSizePt;

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
      <div
        className="pointer-events-none h-full w-full overflow-visible whitespace-pre-wrap break-words"
        style={{
          fontFamily: getFontOption(fontFamily).cssFamily,
          fontWeight: bold ? 700 : 400,
          fontStyle: italic ? "italic" : "normal",
          color,
          fontSize: `${fontSizePx}px`,
          lineHeight: 1.2,
          textAlign: alignment,
        }}
      >
        {previewListMarkers(text, listType) || "Teks..."}
      </div>

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
          aria-label="Hapus teks ini"
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
