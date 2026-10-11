import {
  PDFDocument,
  PDFName,
  PDFDict,
  PDFRawStream,
  PDFArray,
  PDFNumber,
  decodePDFRawStream,
  rgb,
} from "pdf-lib";

const SUBTYPE = PDFName.of("Subtype");
const IMAGE = PDFName.of("Image");
const FILTER = PDFName.of("Filter");
const DCT_DECODE = PDFName.of("DCTDecode");
const FLATE_DECODE = PDFName.of("FlateDecode");
const WIDTH = PDFName.of("Width");
const HEIGHT = PDFName.of("Height");
const BITS_PER_COMPONENT = PDFName.of("BitsPerComponent");
const COLOR_SPACE = PDFName.of("ColorSpace");
const DEVICE_GRAY = PDFName.of("DeviceGray");
const DEVICE_RGB = PDFName.of("DeviceRGB");
const XOBJECT = PDFName.of("XObject");

export interface PageImageInfo {
  /** XObject resource name within the page, without the leading "/" — pass back to applyRemovals unchanged. */
  name: string;
  /** Small preview, or null if this image's encoding isn't one we can decode for a thumbnail (it can still be removed). */
  previewDataUrl: string | null;
  width: number;
  height: number;
}

/**
 * Cheap upfront pass: how many Image XObjects does each page reference?
 * Used for a "N gambar" badge per page without decoding any pixels.
 */
export async function countImagesPerPage(sourceBytes: ArrayBuffer): Promise<number[]> {
  const doc = await PDFDocument.load(sourceBytes, { ignoreEncryption: true, updateMetadata: false });
  return doc.getPages().map((page) => {
    const xobjDict = page.node.Resources()?.lookup(XOBJECT);
    if (!(xobjDict instanceof PDFDict)) return 0;
    let count = 0;
    for (const key of xobjDict.keys()) {
      const obj = xobjDict.lookup(key);
      if (obj instanceof PDFRawStream && obj.dict.lookup(SUBTYPE) === IMAGE) count++;
    }
    return count;
  });
}

/** List every Image XObject on one page, with a preview thumbnail where we can decode one. */
export async function listPageImages(sourceBytes: ArrayBuffer, pageIndex: number): Promise<PageImageInfo[]> {
  const doc = await PDFDocument.load(sourceBytes, { ignoreEncryption: true, updateMetadata: false });
  const page = doc.getPages()[pageIndex];
  if (!page) return [];
  const xobjDict = page.node.Resources()?.lookup(XOBJECT);
  if (!(xobjDict instanceof PDFDict)) return [];

  const results: PageImageInfo[] = [];
  for (const key of xobjDict.keys()) {
    const obj = xobjDict.lookup(key);
    if (!(obj instanceof PDFRawStream)) continue;
    if (obj.dict.lookup(SUBTYPE) !== IMAGE) continue;

    const widthObj = obj.dict.lookup(WIDTH);
    const heightObj = obj.dict.lookup(HEIGHT);
    const width = widthObj instanceof PDFNumber ? widthObj.asNumber() : 0;
    const height = heightObj instanceof PDFNumber ? heightObj.asNumber() : 0;

    let previewDataUrl: string | null = null;
    try {
      previewDataUrl = await decodeForPreview(obj);
    } catch {
      previewDataUrl = null;
    }

    results.push({ name: key.toString().replace(/^\//, ""), previewDataUrl, width, height });
  }
  return results;
}

async function decodeForPreview(obj: PDFRawStream): Promise<string | null> {
  const filter = obj.dict.lookup(FILTER);
  const isDct =
    filter === DCT_DECODE || (filter instanceof PDFArray && filter.asArray().length === 1 && filter.asArray()[0] === DCT_DECODE);

  if (isDct) {
    const blob = new Blob([new Uint8Array(obj.contents)], { type: "image/jpeg" });
    return await blobToDataUrl(blob);
  }

  if (filter === FLATE_DECODE) {
    const bpc = obj.dict.lookup(BITS_PER_COMPONENT);
    if (!(bpc instanceof PDFNumber) || bpc.asNumber() !== 8) return null;
    const colorSpace = obj.dict.lookup(COLOR_SPACE);
    const widthObj = obj.dict.lookup(WIDTH);
    const heightObj = obj.dict.lookup(HEIGHT);
    if (!(widthObj instanceof PDFNumber) || !(heightObj instanceof PDFNumber)) return null;
    const width = widthObj.asNumber();
    const height = heightObj.asNumber();

    let components: 1 | 3;
    if (colorSpace === DEVICE_GRAY) components = 1;
    else if (colorSpace === DEVICE_RGB) components = 3;
    else return null;

    const decoded = decodePDFRawStream(obj).decode();
    const expectedLen = width * height * components;
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
    return canvas.toDataURL("image/png");
  }

  return null;
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

export interface ImageRemoval {
  pageIndex: number;
  /** Resource name without leading "/", as returned by listPageImages. */
  name: string;
}

export interface RedactBoxSpec {
  pageIndex: number;
  xPct: number;
  yPct: number; // top-origin, matches screen coordinates
  widthPct: number;
  heightPct: number;
  color: { r: number; g: number; b: number }; // 0-1 each
}

/**
 * Applies both removal modes in one pass: deletes the selected Image
 * XObjects from each page's resource dictionary (PDF viewers — including
 * pdf.js, verified against this exact codepath — simply skip drawing a
 * reference that no longer resolves, rather than erroring), and draws an
 * opaque rectangle over each redaction box.
 *
 * The image's raw bytes can still be left sitting unreferenced inside the
 * saved file (pdf-lib doesn't garbage-collect orphaned objects) — this
 * removes it from the page visually and from every normal reader/printer,
 * but isn't a forensic guarantee the bytes are gone, so this tool shouldn't
 * be relied on for that bar. The redaction-box mode is a cover, not a
 * deletion, for the same reason.
 */
export async function applyRemovals(
  sourceBytes: ArrayBuffer,
  imageRemovals: ImageRemoval[],
  boxes: RedactBoxSpec[]
): Promise<Uint8Array> {
  const doc = await PDFDocument.load(sourceBytes, { ignoreEncryption: true });
  const pages = doc.getPages();

  for (const removal of imageRemovals) {
    const page = pages[removal.pageIndex];
    if (!page) continue;
    const xobjDict = page.node.Resources()?.lookup(XOBJECT);
    if (xobjDict instanceof PDFDict) {
      xobjDict.delete(PDFName.of(removal.name));
    }
  }

  for (const box of boxes) {
    const page = pages[box.pageIndex];
    if (!page) continue;
    const { width, height } = page.getSize();
    const w = box.widthPct * width;
    const h = box.heightPct * height;
    const x = box.xPct * width;
    const y = height - box.yPct * height - h;
    page.drawRectangle({ x, y, width: w, height: h, color: rgb(box.color.r, box.color.g, box.color.b) });
  }

  return doc.save();
}
