import { PDFDocument } from "pdf-lib";

/** Merge multiple PDF files, in the given order, into a single PDF. */
export async function mergePdfs(files: File[]): Promise<Uint8Array> {
  const merged = await PDFDocument.create();

  for (const file of files) {
    const bytes = await file.arrayBuffer();
    const src = await PDFDocument.load(bytes, { ignoreEncryption: true });
    const pageIndices = src.getPageIndices();
    const copiedPages = await merged.copyPages(src, pageIndices);
    copiedPages.forEach((page) => merged.addPage(page));
  }

  return merged.save();
}
