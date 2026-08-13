import { PDFDocument, degrees } from "pdf-lib";

export interface PageSelection {
  /** 0-based index of the page in the source document. */
  index: number;
  /** Extra rotation to add on top of the page's existing rotation, in degrees. */
  addRotation?: number;
}

/**
 * Build a new PDF from a subset/reordering of a source PDF's pages.
 * Backs Remove Pages, Extract Pages, Reorder Pages and Rotate PDF alike —
 * they all reduce to "pick these pages, in this order, with this rotation".
 */
export async function buildPdfFromSelection(
  sourceBytes: ArrayBuffer,
  selection: PageSelection[]
): Promise<Uint8Array> {
  const src = await PDFDocument.load(sourceBytes, { ignoreEncryption: true });
  const out = await PDFDocument.create();

  const indices = selection.map((s) => s.index);
  const copiedPages = await out.copyPages(src, indices);

  copiedPages.forEach((page, i) => {
    const addRotation = selection[i].addRotation ?? 0;
    if (addRotation !== 0) {
      const current = page.getRotation().angle;
      page.setRotation(degrees((current + addRotation) % 360));
    }
    out.addPage(page);
  });

  return out.save();
}

/** Number of pages in a PDF, without rendering anything. */
export async function getPageCount(bytes: ArrayBuffer): Promise<number> {
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
  return doc.getPageCount();
}
