import { PDFDocument, rgb, degrees, StandardFonts } from "pdf-lib";

export interface WatermarkOptions {
  text: string;
  opacity: number; // 0-1
  fontSize: number;
  rotationDeg: number; // e.g. -45
  color: { r: number; g: number; b: number }; // 0-1 each
  layout: "center" | "tile";
}

export async function addWatermark(
  sourceBytes: ArrayBuffer,
  opts: WatermarkOptions
): Promise<Uint8Array> {
  const doc = await PDFDocument.load(sourceBytes, { ignoreEncryption: true });
  const font = await doc.embedFont(StandardFonts.HelveticaBold);
  const { text, opacity, fontSize, rotationDeg, color, layout } = opts;
  const textWidth = font.widthOfTextAtSize(text, fontSize);
  const textHeight = font.heightAtSize(fontSize);

  for (const page of doc.getPages()) {
    const { width, height } = page.getSize();

    if (layout === "center") {
      page.drawText(text, {
        x: width / 2 - textWidth / 2,
        y: height / 2 - textHeight / 2,
        size: fontSize,
        font,
        color: rgb(color.r, color.g, color.b),
        opacity,
        rotate: degrees(rotationDeg),
      });
      continue;
    }

    // Tile the watermark diagonally across the page.
    const stepX = textWidth + fontSize * 3;
    const stepY = fontSize * 5;
    for (let y = -stepY; y < height + stepY; y += stepY) {
      for (let x = -stepX; x < width + stepX; x += stepX) {
        page.drawText(text, {
          x,
          y,
          size: fontSize,
          font,
          color: rgb(color.r, color.g, color.b),
          opacity,
          rotate: degrees(rotationDeg),
        });
      }
    }
  }

  return doc.save();
}
