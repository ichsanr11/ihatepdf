"use client";

import * as pdfjsLib from "pdfjs-dist";

let workerConfigured = false;

/** Point pdf.js at its worker bundle. Must run once, client-side only. */
function ensureWorker() {
  if (workerConfigured) return;
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url
  ).toString();
  workerConfigured = true;
}

export async function loadPdfDocument(bytes: ArrayBuffer, password?: string) {
  ensureWorker();
  const loadingTask = pdfjsLib.getDocument({
    data: bytes,
    password,
  });
  return loadingTask.promise;
}

export interface PageThumbnail {
  pageNumber: number; // 1-based
  dataUrl: string;
  width: number;
  height: number;
}

/**
 * Render every page of a PDF to a small JPEG thumbnail for pickers/grids.
 * `maxWidth` keeps memory/CPU bounded for large documents.
 */
export async function renderThumbnails(
  bytes: ArrayBuffer,
  opts: { maxWidth?: number; password?: string } = {}
): Promise<PageThumbnail[]> {
  const { maxWidth = 220, password } = opts;
  const pdf = await loadPdfDocument(bytes, password);
  const thumbnails: PageThumbnail[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const baseViewport = page.getViewport({ scale: 1 });
    const scale = maxWidth / baseViewport.width;
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const ctx = canvas.getContext("2d")!;

    await page.render({ canvasContext: ctx, viewport }).promise;

    thumbnails.push({
      pageNumber: i,
      dataUrl: canvas.toDataURL("image/jpeg", 0.75),
      width: viewport.width,
      height: viewport.height,
    });

    page.cleanup();
  }

  await pdf.destroy();
  return thumbnails;
}

/** Render a single page to a full-resolution canvas, e.g. for PDF -> JPG export. */
export async function renderPageToCanvas(
  pdf: pdfjsLib.PDFDocumentProxy,
  pageNumber: number,
  scale: number
): Promise<HTMLCanvasElement> {
  const page = await pdf.getPage(pageNumber);
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  const ctx = canvas.getContext("2d")!;
  await page.render({ canvasContext: ctx, viewport }).promise;
  page.cleanup();
  return canvas;
}
