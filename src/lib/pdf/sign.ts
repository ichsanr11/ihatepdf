import { PDFDocument } from "pdf-lib";

export interface SignaturePlacement {
  /** Left edge, 0-1 relative to page width. */
  xPct: number;
  /** Top edge, 0-1 relative to page height (top-origin, matches screen coordinates). */
  yPct: number;
  /** 0-1 relative to page width. */
  widthPct: number;
  /** 0-1 relative to page height. */
  heightPct: number;
}

export interface SignatureStamp {
  bytes: Uint8Array;
  mimeType: string;
  placement: SignaturePlacement;
  target: { allPages: boolean; pageIndex: number };
}

/**
 * Stamp one or more signature images onto a PDF, each at its own
 * normalized position/size and target page(s) — e.g. two different
 * signers' signatures on the same page, or one signature repeated on
 * every page plus a different one only on the last page. Percentages
 * (not points) so a placement looks right even if pages in the document
 * aren't all the same size — each page's own width/height is used to
 * convert back to points. The same image is re-embedded per stamp that
 * uses it; pdf-lib doesn't dedupe embedded images across separate calls,
 * but for the handful of small signature images this tool deals with
 * that's an irrelevant amount of overhead.
 */
export async function signPdf(sourceBytes: ArrayBuffer, stamps: SignatureStamp[]): Promise<Uint8Array> {
  const doc = await PDFDocument.load(sourceBytes, { ignoreEncryption: true });
  const allPages = doc.getPages();

  for (const stamp of stamps) {
    const isPng = stamp.mimeType === "image/png";
    const image = isPng ? await doc.embedPng(stamp.bytes) : await doc.embedJpg(stamp.bytes);
    const pages = stamp.target.allPages ? allPages : [allPages[stamp.target.pageIndex]];

    for (const page of pages) {
      const { width, height } = page.getSize();
      const imgWidth = stamp.placement.widthPct * width;
      const imgHeight = stamp.placement.heightPct * height;
      const x = stamp.placement.xPct * width;
      // UI coordinates are top-origin (y grows downward); PDF coordinates
      // are bottom-origin, so flip and account for the image's own height.
      const y = height - stamp.placement.yPct * height - imgHeight;
      page.drawImage(image, { x, y, width: imgWidth, height: imgHeight });
    }
  }

  return doc.save();
}

/**
 * Makes the background of a signature image transparent, so it overlays
 * cleanly on a document instead of sitting in an ugly box. Always returns
 * PNG bytes (need the alpha channel).
 *
 * Earlier version assumed the background was pure white (channel values
 * >= 235) — that misses a lot of real signature images: digital signature
 * pads, scans, and JPEG re-compression all commonly produce an off-white,
 * light-gray, or faintly tinted background instead of (255,255,255),
 * which that fixed threshold would never match. This version samples the
 * actual background color from the image's four corners (signature ink
 * essentially never touches the very corners) and makes pixels close to
 * *that* color transparent, by Euclidean RGB distance with a soft falloff
 * band so edges don't look jagged. Works for white, off-white, gray, or
 * tinted backgrounds alike. If the corners are already transparent, the
 * image is assumed to already have no background to strip.
 */
export async function stripWhiteBackground(
  imageBytes: Uint8Array,
  tolerance = 42
): Promise<Uint8Array> {
  const blob = new Blob([new Uint8Array(imageBytes)]);
  const bitmap = await createImageBitmap(blob);

  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas tidak didukung di browser ini");
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();

  const { width, height } = canvas;
  const imageData = ctx.getImageData(0, 0, width, height);
  const d = imageData.data;

  const cornerIndexes = [
    0,
    (width - 1) * 4,
    (height - 1) * width * 4,
    ((height - 1) * width + (width - 1)) * 4,
  ];
  let bgR = 0;
  let bgG = 0;
  let bgB = 0;
  let sampled = 0;
  for (const idx of cornerIndexes) {
    if (d[idx + 3] > 10) {
      bgR += d[idx];
      bgG += d[idx + 1];
      bgB += d[idx + 2];
      sampled++;
    }
  }
  if (sampled === 0) {
    // All four corners are already transparent — nothing to strip.
    return new Uint8Array(imageBytes);
  }
  bgR /= sampled;
  bgG /= sampled;
  bgB /= sampled;

  const innerTolerance = tolerance;
  const outerTolerance = tolerance + 35; // soft falloff band, avoids a jagged edge

  for (let i = 0; i < d.length; i += 4) {
    const dr = d[i] - bgR;
    const dg = d[i + 1] - bgG;
    const db = d[i + 2] - bgB;
    const dist = Math.sqrt(dr * dr + dg * dg + db * db);
    if (dist <= innerTolerance) {
      d[i + 3] = 0;
    } else if (dist < outerTolerance) {
      const t = (dist - innerTolerance) / (outerTolerance - innerTolerance);
      d[i + 3] = Math.round(d[i + 3] * t);
    }
  }
  ctx.putImageData(imageData, 0, 0);

  const outBlob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!outBlob) throw new Error("Gagal memproses gambar");
  return new Uint8Array(await outBlob.arrayBuffer());
}

export async function getImageDimensions(
  bytes: Uint8Array,
  mimeType: string
): Promise<{ width: number; height: number }> {
  const blob = new Blob([new Uint8Array(bytes)], { type: mimeType });
  const bitmap = await createImageBitmap(blob);
  const dims = { width: bitmap.width, height: bitmap.height };
  bitmap.close();
  return dims;
}
