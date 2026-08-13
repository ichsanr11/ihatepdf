import { PDFDocument } from "pdf-lib";
import JSZip from "jszip";

/**
 * Parse a page-range string like "1-3,5,8-10" into 0-based index groups.
 * Each comma-separated chunk becomes one output file; a single page like
 * "5" becomes a one-page group. Throws with a user-facing message on
 * invalid input.
 */
export function parsePageRanges(input: string, pageCount: number): number[][] {
  const chunks = input
    .split(",")
    .map((c) => c.trim())
    .filter(Boolean);

  if (chunks.length === 0) {
    throw new Error("Masukkan minimal satu range halaman, misal 1-3,5,8-10");
  }

  return chunks.map((chunk) => {
    const match = chunk.match(/^(\d+)(?:-(\d+))?$/);
    if (!match) {
      throw new Error(`Range tidak valid: "${chunk}"`);
    }
    const start = parseInt(match[1], 10);
    const end = match[2] ? parseInt(match[2], 10) : start;
    if (start < 1 || end > pageCount || start > end) {
      throw new Error(
        `Range "${chunk}" di luar jangkauan halaman (dokumen punya ${pageCount} halaman)`
      );
    }
    const indices: number[] = [];
    for (let p = start; p <= end; p++) indices.push(p - 1);
    return indices;
  });
}

/** Split every page of the source PDF into its own single-page PDF. */
export function everyPageGroup(pageCount: number): number[][] {
  return Array.from({ length: pageCount }, (_, i) => [i]);
}

export interface SplitResult {
  fileName: string;
  bytes: Uint8Array;
}

/** Produce one PDF per group of page indices. */
export async function splitPdf(
  sourceBytes: ArrayBuffer,
  groups: number[][],
  baseName: string
): Promise<SplitResult[]> {
  const src = await PDFDocument.load(sourceBytes, { ignoreEncryption: true });
  const results: SplitResult[] = [];

  for (let i = 0; i < groups.length; i++) {
    const out = await PDFDocument.create();
    const copied = await out.copyPages(src, groups[i]);
    copied.forEach((p) => out.addPage(p));
    const bytes = await out.save();
    const label =
      groups[i].length === 1
        ? `p${groups[i][0] + 1}`
        : `p${groups[i][0] + 1}-${groups[i][groups[i].length - 1] + 1}`;
    results.push({ fileName: `${baseName}_${label}.pdf`, bytes });
  }

  return results;
}

/** Bundle multiple split results into a single downloadable .zip. */
export async function zipResults(results: SplitResult[], zipName: string) {
  const zip = new JSZip();
  results.forEach((r) => zip.file(r.fileName, r.bytes));
  return zip.generateAsync({ type: "uint8array" }).then((bytes) => ({
    fileName: zipName,
    bytes,
  }));
}
