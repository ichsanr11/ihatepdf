import { PDFDocument } from "pdf-lib";
import { loadPdfDocument, renderPageToCanvas } from "./render";

/**
 * Rotates a rendered page canvas by a small arbitrary angle (not just 90°
 * steps — that's what page.setRotation() is for) and pads the result with
 * white so the corners of the original content aren't clipped by the
 * rotation. The output canvas is therefore slightly larger than the input;
 * callers fit it back into the original page size, which shows up as a
 * thin white margin — the same trade-off any scan-straightening tool makes
 * to avoid cropping real content.
 */
export function rotateCanvasWithWhiteFill(source: HTMLCanvasElement, angleDeg: number): HTMLCanvasElement {
  const angleRad = (angleDeg * Math.PI) / 180;
  const w = source.width;
  const h = source.height;
  const newW = Math.ceil(Math.abs(w * Math.cos(angleRad)) + Math.abs(h * Math.sin(angleRad)));
  const newH = Math.ceil(Math.abs(w * Math.sin(angleRad)) + Math.abs(h * Math.cos(angleRad)));

  const canvas = document.createElement("canvas");
  canvas.width = newW;
  canvas.height = newH;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, newW, newH);
  ctx.translate(newW / 2, newH / 2);
  ctx.rotate(angleRad);
  ctx.drawImage(source, -w / 2, -h / 2);
  return canvas;
}

function canvasToJpegBytes(canvas: HTMLCanvasElement, quality = 0.92): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      async (blob) => {
        if (!blob) {
          reject(new Error("Gagal membuat gambar"));
          return;
        }
        resolve(new Uint8Array(await blob.arrayBuffer()));
      },
      "image/jpeg",
      quality
    );
  });
}

/**
 * Straightens one or more pages of a scanned PDF by an arbitrary per-page
 * angle (positive = clockwise). Only pages present in `skews` (with a
 * non-zero angle) are touched — each gets rasterized at `renderScale`,
 * rotated with a white-filled margin, and re-embedded as a same-size
 * replacement page. Every other page is copied through untouched, so
 * pages the user didn't adjust keep their original vector/text quality.
 *
 * This necessarily rasterizes the pages it straightens — PDF's page
 * `/Rotate` attribute only supports 90° steps, so a fine-angle correction
 * has to be baked into the pixels. That's an expected trade-off for
 * scanned pages, which are usually already just one big image per page.
 */
export async function deskewPdf(
  sourceBytes: ArrayBuffer,
  skews: Map<number, number>,
  renderScale = 2.5
): Promise<Uint8Array> {
  const srcDoc = await PDFDocument.load(sourceBytes, { ignoreEncryption: true });
  const pageCount = srcDoc.getPageCount();

  const touchedEntries = Array.from(skews.entries()).filter(([, angle]) => angle !== 0);
  if (touchedEntries.length === 0) {
    return srcDoc.save();
  }

  const pdfjsDoc = await loadPdfDocument(sourceBytes);
  const outDoc = await PDFDocument.create();

  for (let i = 0; i < pageCount; i++) {
    const angle = skews.get(i);
    if (!angle) {
      const [copied] = await outDoc.copyPages(srcDoc, [i]);
      outDoc.addPage(copied);
      continue;
    }

    const rendered = await renderPageToCanvas(pdfjsDoc, i + 1, renderScale);
    const rotated = rotateCanvasWithWhiteFill(rendered, angle);
    const jpegBytes = await canvasToJpegBytes(rotated);
    const image = await outDoc.embedJpg(jpegBytes);

    const { width, height } = srcDoc.getPage(i).getSize();
    const newPage = outDoc.addPage([width, height]);
    newPage.drawImage(image, { x: 0, y: 0, width, height });
  }

  await pdfjsDoc.destroy();
  return outDoc.save();
}
