import {
  PDFDocument,
  PDFName,
  PDFRawStream,
  PDFArray,
  PDFNumber,
  decodePDFRawStream,
  type PDFDict,
} from "pdf-lib";

export type CompressLevel = "light" | "recommended" | "extreme";

const LEVELS: Record<CompressLevel, { quality: number; maxDim: number }> = {
  light: { quality: 0.82, maxDim: 2200 },
  recommended: { quality: 0.65, maxDim: 1600 },
  extreme: { quality: 0.45, maxDim: 1100 },
};

/**
 * Fallback ladder for "compress to under X MB": each step is more
 * aggressive than the last (lower JPEG quality + smaller max dimension).
 * We always re-run from the *original* bytes at each step rather than
 * compounding passes, so quality only degrades as far as actually needed
 * to hit the target instead of stacking lossy re-encodes. The last couple
 * of steps are deliberately harsh — this only runs when someone has
 * explicitly opted into a hard size ceiling.
 */
const TARGET_SIZE_LADDER: { quality: number; maxDim: number }[] = [
  { quality: 0.75, maxDim: 2000 },
  { quality: 0.6, maxDim: 1600 },
  { quality: 0.45, maxDim: 1300 },
  { quality: 0.35, maxDim: 1000 },
  { quality: 0.25, maxDim: 800 },
  { quality: 0.18, maxDim: 650 },
  { quality: 0.12, maxDim: 500 },
  { quality: 0.08, maxDim: 380 },
  { quality: 0.05, maxDim: 280 },
];

export interface CompressResult {
  bytes: Uint8Array;
  originalSize: number;
  newSize: number;
  imagesRecompressed: number;
  imagesTotal: number;
}

export interface TargetSizeResult extends CompressResult {
  reachedTarget: boolean;
  attemptsUsed: number;
}

const SUBTYPE = PDFName.of("Subtype");
const FILTER = PDFName.of("Filter");
const IMAGE = PDFName.of("Image");
const DCT_DECODE = PDFName.of("DCTDecode");
const FLATE_DECODE = PDFName.of("FlateDecode");
const MASK = PDFName.of("Mask");
const DECODE = PDFName.of("Decode");
const WIDTH = PDFName.of("Width");
const HEIGHT = PDFName.of("Height");
const BITS_PER_COMPONENT = PDFName.of("BitsPerComponent");
const LENGTH = PDFName.of("Length");
const COLOR_SPACE = PDFName.of("ColorSpace");
const DECODE_PARMS = PDFName.of("DecodeParms");
const DEVICE_GRAY = PDFName.of("DeviceGray");
const DEVICE_RGB = PDFName.of("DeviceRGB");

/**
 * "Compress PDF" for a tool that can't shell out to Ghostscript: instead of
 * rewriting the whole file, we find every raster image embedded in the PDF
 * and re-encode it at a lower quality/resolution with a plain <canvas>,
 * then splice the smaller bytes back into the same PDF object. Vector
 * graphics and text are never touched, so text stays selectable — this
 * only pays off on image-heavy PDFs (scans, photos, screenshots), which is
 * also where real compressors get most of their savings.
 *
 * Two image encodings are handled, covering the vast majority of
 * real-world files:
 *  - DCTDecode (JPEG) — the stream bytes already *are* a JPEG file.
 *  - FlateDecode raw bitmaps in DeviceGray/DeviceRGB at 8 bits/component —
 *    common for screenshots, "print to PDF" output, and images that
 *    started life as PNG. Decoded via pdf-lib's own inflate, then treated
 *    like any other pixel buffer.
 * Anything else (JPX, Indexed/CMYK color spaces, 1-bit line art, chained
 * filters, custom Decode arrays, or a stencil Mask that depends on exact
 * pixel values) is left untouched rather than risk corrupting it — see
 * isPlainDctImage / isRawBitmapImage below. A soft mask (SMask) is fine to
 * recompress around, since viewers resample it independently either way
 * (ISO 32000-2 §8.9.6).
 */
export async function compressPdf(
  sourceBytes: ArrayBuffer,
  level: CompressLevel
): Promise<CompressResult> {
  const { quality, maxDim } = LEVELS[level];
  return applyCompression(sourceBytes, quality, maxDim);
}

/**
 * Keeps re-compressing at progressively more aggressive settings (starting
 * fresh from the original bytes each time) until the output fits under
 * `targetBytes`, or we run out of steps / further steps clearly won't help
 * (e.g. the PDF has no recompressible images at all). Returns the smallest
 * result achieved either way — check `reachedTarget` to know whether the
 * target was actually hit.
 */
export async function compressPdfToTargetSize(
  sourceBytes: ArrayBuffer,
  targetBytes: number,
  onProgress?: (attempt: number, totalAttempts: number) => void
): Promise<TargetSizeResult> {
  if (sourceBytes.byteLength <= targetBytes) {
    const doc = await PDFDocument.load(sourceBytes, {
      ignoreEncryption: true,
      updateMetadata: false,
    });
    const bytes = await doc.save({ useObjectStreams: true });
    return {
      bytes,
      originalSize: sourceBytes.byteLength,
      newSize: bytes.byteLength,
      imagesRecompressed: 0,
      imagesTotal: 0,
      reachedTarget: true,
      attemptsUsed: 0,
    };
  }

  let best: CompressResult | null = null;

  for (let i = 0; i < TARGET_SIZE_LADDER.length; i++) {
    onProgress?.(i + 1, TARGET_SIZE_LADDER.length);
    const { quality, maxDim } = TARGET_SIZE_LADDER[i];
    const result = await applyCompression(sourceBytes, quality, maxDim);
    if (!best || result.newSize < best.newSize) best = result;

    if (result.newSize <= targetBytes) {
      return { ...result, reachedTarget: true, attemptsUsed: i + 1 };
    }
    // No images at all, or this pass couldn't shrink any of them further
    // (already maxed out) — later, more aggressive steps won't help either.
    if (result.imagesTotal === 0 || (i > 0 && result.imagesRecompressed === 0)) {
      break;
    }
  }

  return { ...best!, reachedTarget: false, attemptsUsed: best === null ? 0 : TARGET_SIZE_LADDER.length };
}

async function applyCompression(
  sourceBytes: ArrayBuffer,
  quality: number,
  maxDim: number
): Promise<CompressResult> {
  const doc = await PDFDocument.load(sourceBytes, {
    ignoreEncryption: true,
    updateMetadata: false,
  });
  const context = doc.context;

  let imagesRecompressed = 0;
  let imagesTotal = 0;

  for (const [ref, obj] of context.enumerateIndirectObjects()) {
    if (!(obj instanceof PDFRawStream)) continue;
    const dict = obj.dict;

    const subtype = dict.lookup(SUBTYPE);
    if (subtype !== IMAGE) continue;
    imagesTotal++;

    // A stencil/color-key Mask depends on exact original pixel values —
    // recompressing would break it. A soft mask (SMask) is a separate
    // alpha stream the viewer resamples independently, so it's fine.
    if (dict.lookup(MASK)) continue;

    const isDct = isPlainDctImage(dict);
    const rawBitmap = !isDct ? rawBitmapInfo(dict) : null;
    if (!isDct && !rawBitmap) continue;

    try {
      const recompressed = isDct
        ? await recompressJpeg(obj.contents, quality, maxDim)
        : await recompressRawBitmap(obj, rawBitmap!, quality, maxDim);
      if (!recompressed || recompressed.bytes.byteLength >= obj.contents.byteLength) continue;

      // PDFRawStream's `contents` is read-only from the outside, so we
      // swap in a fresh stream object (same dict, new bytes) rather than
      // mutating this one in place.
      dict.set(LENGTH, context.obj(recompressed.bytes.byteLength));
      dict.set(WIDTH, context.obj(recompressed.width));
      dict.set(HEIGHT, context.obj(recompressed.height));
      dict.set(BITS_PER_COMPONENT, context.obj(8));
      // Re-encoded fresh via canvas, so it's always plain JPEG/RGB now —
      // drop whatever filter/color-space/decode metadata described the
      // original encoding, since it no longer matches.
      dict.set(FILTER, DCT_DECODE);
      dict.set(COLOR_SPACE, DEVICE_RGB);
      dict.delete(DECODE_PARMS);
      dict.delete(DECODE);
      context.assign(ref, PDFRawStream.of(dict, recompressed.bytes));
      imagesRecompressed++;
    } catch {
      // Unsupported/corrupt image (e.g. a CMYK JPEG the browser can't
      // decode) — leave the original bytes in place.
    }
  }

  const outBytes = await doc.save({ useObjectStreams: true });
  return {
    bytes: outBytes,
    originalSize: sourceBytes.byteLength,
    newSize: outBytes.byteLength,
    imagesRecompressed,
    imagesTotal,
  };
}

function isPlainDctImage(dict: PDFDict): boolean {
  const filter = dict.lookup(FILTER);
  if (filter instanceof PDFName) return filter === DCT_DECODE;
  if (filter instanceof PDFArray) {
    const names = filter.asArray();
    return names.length === 1 && names[0] === DCT_DECODE;
  }
  return false;
}

interface RawBitmapInfo {
  width: number;
  height: number;
  components: 1 | 3;
}

/**
 * Recognizes a "plain" Flate-encoded raw bitmap we know how to decode
 * safely: single FlateDecode filter, 8 bits/component, DeviceGray or
 * DeviceRGB, and no custom Decode array (which could invert/remap
 * samples in a way we're not accounting for).
 */
function rawBitmapInfo(dict: PDFDict): RawBitmapInfo | null {
  const filter = dict.lookup(FILTER);
  if (filter !== FLATE_DECODE) return null;
  if (dict.lookup(DECODE)) return null;

  const bpc = dict.lookup(BITS_PER_COMPONENT);
  if (!(bpc instanceof PDFNumber) || bpc.asNumber() !== 8) return null;

  const colorSpace = dict.lookup(COLOR_SPACE);
  let components: 1 | 3;
  if (colorSpace === DEVICE_GRAY) components = 1;
  else if (colorSpace === DEVICE_RGB) components = 3;
  else return null; // Indexed, DeviceCMYK, ICCBased, etc. — not handled

  const widthObj = dict.lookup(WIDTH);
  const heightObj = dict.lookup(HEIGHT);
  if (!(widthObj instanceof PDFNumber) || !(heightObj instanceof PDFNumber)) return null;

  return { width: widthObj.asNumber(), height: heightObj.asNumber(), components };
}

async function recompressJpeg(
  jpegBytes: Uint8Array,
  quality: number,
  maxDim: number
): Promise<{ bytes: Uint8Array; width: number; height: number } | null> {
  const blob = new Blob([new Uint8Array(jpegBytes)], { type: "image/jpeg" });
  const bitmap = await createImageBitmap(blob);
  try {
    return await drawAndEncode(bitmap, bitmap.width, bitmap.height, quality, maxDim);
  } finally {
    bitmap.close();
  }
}

async function recompressRawBitmap(
  obj: PDFRawStream,
  info: RawBitmapInfo,
  quality: number,
  maxDim: number
): Promise<{ bytes: Uint8Array; width: number; height: number } | null> {
  const { width, height, components } = info;
  const expectedLen = width * height * components;

  // decodePDFRawStream() gives back a lazy inflate stream; decode() drains
  // it fully. At 8 bits/component there's no sub-byte row padding to
  // account for, so the decoded bytes map straight to pixels.
  const decoded = decodePDFRawStream(obj).decode();
  if (decoded.length < expectedLen) return null;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const imageData = ctx.createImageData(width, height);
  const out = imageData.data;
  if (components === 1) {
    for (let i = 0, j = 0; i < expectedLen; i++, j += 4) {
      const v = decoded[i];
      out[j] = v;
      out[j + 1] = v;
      out[j + 2] = v;
      out[j + 3] = 255;
    }
  } else {
    for (let i = 0, j = 0; i < expectedLen; i += 3, j += 4) {
      out[j] = decoded[i];
      out[j + 1] = decoded[i + 1];
      out[j + 2] = decoded[i + 2];
      out[j + 3] = 255;
    }
  }
  ctx.putImageData(imageData, 0, 0);

  return drawAndEncode(canvas, width, height, quality, maxDim);
}

async function drawAndEncode(
  source: CanvasImageSource,
  srcWidth: number,
  srcHeight: number,
  quality: number,
  maxDim: number
): Promise<{ bytes: Uint8Array; width: number; height: number } | null> {
  let width = srcWidth;
  let height = srcHeight;
  if (width > maxDim || height > maxDim) {
    const scale = maxDim / Math.max(width, height);
    width = Math.max(1, Math.round(width * scale));
    height = Math.max(1, Math.round(height * scale));
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(source, 0, 0, width, height);

  const outBlob: Blob | null = await new Promise((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", quality)
  );
  if (!outBlob) return null;

  return { bytes: new Uint8Array(await outBlob.arrayBuffer()), width, height };
}
