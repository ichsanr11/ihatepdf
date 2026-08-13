import { PDFDocument } from "pdf-lib";

export interface RepairResult {
  bytes: Uint8Array;
  pageCount: number;
}

/**
 * "Repair" a malformed PDF by parsing it as leniently as pdf-lib allows
 * (skipping/recovering from broken objects instead of throwing) and
 * re-serializing a fresh, well-formed file from whatever was recoverable.
 * This is the same principle desktop repair tools use — it fixes common
 * structural damage (broken xref tables, dangling references, stray
 * objects) but can't reconstruct data that's genuinely missing from the
 * file, so severely truncated PDFs may still fail.
 */
export async function repairPdf(sourceBytes: ArrayBuffer): Promise<RepairResult> {
  const doc = await PDFDocument.load(sourceBytes, {
    ignoreEncryption: true,
    throwOnInvalidObject: false,
    updateMetadata: false,
    capNumbers: true,
  });

  const pageCount = doc.getPageCount();
  if (pageCount === 0) {
    throw new Error("Tidak ada halaman yang bisa dipulihkan dari file ini.");
  }

  const bytes = await doc.save({ useObjectStreams: true });
  return { bytes, pageCount };
}
