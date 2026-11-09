"use client";

import { useCallback, useRef, useState } from "react";
import { loadPdfDocument, renderPageToCanvas } from "@/lib/pdf/render";
import type { PDFDocumentProxy } from "pdfjs-dist";

export interface SimplePageThumb {
  pageNumber: number; // 1-based
  dataUrl: string;
  width: number;
  height: number;
}

const THUMB_WIDTH = 140;

/**
 * Loads a PDF once (keeping the pdf.js document open) and exposes both a
 * small thumbnail strip for page-picking and on-demand high-resolution
 * renders of a single page — used by Sign PDF so the placement preview
 * isn't stuck at thumbnail quality.
 */
export function usePdfPages() {
  const pdfRef = useRef<PDFDocumentProxy | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [thumbnails, setThumbnails] = useState<SimplePageThumb[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (f: File) => {
    setLoading(true);
    setError(null);
    try {
      const bytes = await f.arrayBuffer();
      const pdf = await loadPdfDocument(bytes);
      pdfRef.current = pdf;

      const thumbs: SimplePageThumb[] = [];
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const baseWidth = page.getViewport({ scale: 1 }).width;
        const canvas = await renderPageToCanvas(pdf, i, THUMB_WIDTH / baseWidth);
        thumbs.push({
          pageNumber: i,
          dataUrl: canvas.toDataURL("image/jpeg", 0.8),
          width: canvas.width,
          height: canvas.height,
        });
      }

      setFile(f);
      setThumbnails(thumbs);
    } catch {
      setError("Gagal membaca PDF. Pastikan file valid, tidak rusak, dan tidak terkunci password.");
    } finally {
      setLoading(false);
    }
  }, []);

  /** Render one page at a target pixel width, for a crisper preview than the thumbnail strip. */
  const renderHighRes = useCallback(async (pageNumber: number, targetWidth: number) => {
    const pdf = pdfRef.current;
    if (!pdf) return null;
    const page = await pdf.getPage(pageNumber);
    const baseViewport = page.getViewport({ scale: 1 });
    const canvas = await renderPageToCanvas(pdf, pageNumber, targetWidth / baseViewport.width);
    return {
      dataUrl: canvas.toDataURL("image/jpeg", 0.92),
      width: canvas.width,
      height: canvas.height,
      // The page's actual size in PDF points (scale=1) — distinct from the
      // raster pixel dimensions above, needed by callers (Add Text) that
      // have to convert a point-based font size into a CSS pixel size that
      // stays correct regardless of how large the preview is rendered.
      pageWidthPt: baseViewport.width,
      pageHeightPt: baseViewport.height,
    };
  }, []);

  const reset = useCallback(() => {
    pdfRef.current?.destroy();
    pdfRef.current = null;
    setFile(null);
    setThumbnails([]);
    setError(null);
  }, []);

  return { file, thumbnails, loading, error, load, renderHighRes, reset };
}
