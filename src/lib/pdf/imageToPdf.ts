import { PDFDocument } from "pdf-lib";

export type PageFit = "fit" | "fill" | "original";

/**
 * Combine one or more JPG/PNG images into a single PDF, one image per page.
 * `fit` "fit" letterboxes the image inside an A4-ish page sized to its
 * aspect ratio; "original" makes the page exactly the image's pixel size.
 */
export async function imagesToPdf(
  files: File[],
  opts: { fit?: PageFit; marginPt?: number } = {}
): Promise<Uint8Array> {
  const { marginPt = 0 } = opts;
  const doc = await PDFDocument.create();

  for (const file of files) {
    const bytes = await file.arrayBuffer();
    const isPng =
      file.type === "image/png" || /\.png$/i.test(file.name);
    const image = isPng
      ? await doc.embedPng(bytes)
      : await doc.embedJpg(bytes);

    const { width, height } = image.scale(1);
    const page = doc.addPage([width + marginPt * 2, height + marginPt * 2]);
    page.drawImage(image, {
      x: marginPt,
      y: marginPt,
      width,
      height,
    });
  }

  return doc.save();
}
