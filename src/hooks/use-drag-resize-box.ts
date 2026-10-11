"use client";

import { useRef, useState, type RefObject } from "react";

export interface Placement {
  xPct: number;
  yPct: number;
  widthPct: number;
  heightPct: number;
}

const MIN_SIZE_PCT = 0.02;

function clamp(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v));
}

/**
 * Shared drag/resize pointer logic for a box positioned (as 0-1 fractions)
 * inside some container — used by both the signature overlay (Sign PDF)
 * and the redaction cover box (Remove Signature/Stamp), so the fiddly
 * pointer-capture and percentage math lives in exactly one place.
 *
 * `aspectRatio` (width/height), if given, keeps that ratio while resizing
 * (for a signature image); omit it for a freely-resizable box (a redaction
 * rectangle, which has no "natural" shape to preserve).
 */
export function useDragResizeBox(
  containerRef: RefObject<HTMLDivElement | null>,
  placement: Placement,
  onChange: (p: Placement) => void,
  aspectRatio?: number
) {
  const [mode, setMode] = useState<"idle" | "drag" | "resize">("idle");
  const dragState = useRef({ startX: 0, startY: 0, origX: 0, origY: 0, origW: 0, origH: 0 });

  function startDrag(e: React.PointerEvent) {
    e.preventDefault();
    (e.target as Element).setPointerCapture(e.pointerId);
    dragState.current = {
      startX: e.clientX,
      startY: e.clientY,
      origX: placement.xPct,
      origY: placement.yPct,
      origW: placement.widthPct,
      origH: placement.heightPct,
    };
    setMode("drag");
  }

  function startResize(e: React.PointerEvent) {
    e.preventDefault();
    e.stopPropagation();
    (e.target as Element).setPointerCapture(e.pointerId);
    dragState.current = {
      startX: e.clientX,
      startY: e.clientY,
      origX: placement.xPct,
      origY: placement.yPct,
      origW: placement.widthPct,
      origH: placement.heightPct,
    };
    setMode("resize");
  }

  function handleMove(e: React.PointerEvent) {
    if (mode === "idle") return;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const dxPct = (e.clientX - dragState.current.startX) / rect.width;
    const dyPct = (e.clientY - dragState.current.startY) / rect.height;

    if (mode === "drag") {
      const { origX, origY, origW, origH } = dragState.current;
      onChange({
        ...placement,
        xPct: clamp(origX + dxPct, 0, 1 - origW),
        yPct: clamp(origY + dyPct, 0, 1 - origH),
      });
      return;
    }

    const { origX, origY, origW, origH } = dragState.current;
    const maxWidthPct = 1 - origX;
    const newWidthPct = clamp(origW + dxPct, MIN_SIZE_PCT, maxWidthPct);

    if (aspectRatio) {
      // Maintain the given aspect ratio in real pixel space (container
      // width/height aren't equal, so this isn't just a 1:1 ratio).
      const newWidthPx = newWidthPct * rect.width;
      const newHeightPx = newWidthPx / aspectRatio;
      const maxHeightPct = 1 - origY;
      const newHeightPct = Math.min(newHeightPx / rect.height, maxHeightPct);
      onChange({ ...placement, widthPct: newWidthPct, heightPct: newHeightPct });
    } else {
      const maxHeightPct = 1 - origY;
      const newHeightPct = clamp(origH + dyPct, MIN_SIZE_PCT, maxHeightPct);
      onChange({ ...placement, widthPct: newWidthPct, heightPct: newHeightPct });
    }
  }

  function endInteraction() {
    setMode("idle");
  }

  return { mode, startDrag, startResize, handleMove, endInteraction };
}
