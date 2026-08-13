import { PDFDocument, rgb, StandardFonts } from "pdf-lib";

export type NumberPosition =
  | "bottom-center"
  | "bottom-right"
  | "bottom-left"
  | "top-center"
  | "top-right"
  | "top-left";

export interface PageNumberOptions {
  position: NumberPosition;
  fontSize: number;
  startAt: number;
  format: (page: number, total: number) => string;
  marginPt: number;
}

export const defaultFormat = (page: number, total: number) => `${page} / ${total}`;

export async function addPageNumbers(
  sourceBytes: ArrayBuffer,
  opts: PageNumberOptions
): Promise<Uint8Array> {
  const doc = await PDFDocument.load(sourceBytes, { ignoreEncryption: true });
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const pages = doc.getPages();
  const total = pages.length;
  const { position, fontSize, startAt, format, marginPt } = opts;

  pages.forEach((page, i) => {
    const label = format(startAt + i, total);
    const { width, height } = page.getSize();
    const textWidth = font.widthOfTextAtSize(label, fontSize);

    let x: number;
    if (position.endsWith("left")) x = marginPt;
    else if (position.endsWith("right")) x = width - marginPt - textWidth;
    else x = width / 2 - textWidth / 2;

    const y = position.startsWith("top") ? height - marginPt - fontSize : marginPt;

    page.drawText(label, {
      x,
      y,
      size: fontSize,
      font,
      color: rgb(0.15, 0.15, 0.15),
    });
  });

  return doc.save();
}
