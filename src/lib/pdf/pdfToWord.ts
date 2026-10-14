import { Document, Packer, Paragraph, TextRun, FrameAnchorType, type ISectionOptions } from "docx";
import { loadPdfDocument } from "./render";

const PT_TO_TWIP = 20;
const DEFAULT_ASCENT = 0.8;

const KNOWN_WORD_FONTS = [
  "Arial",
  "Times New Roman",
  "Calibri",
  "Verdana",
  "Georgia",
  "Courier New",
  "Tahoma",
  "Trebuchet MS",
  "Garamond",
  "Cambria",
  "Comic Sans MS",
  "Impact",
];

/**
 * Picks a font name Word is actually likely to have installed. Prefers the
 * PDF's real font name (from pdf.js's internal font object — the thing
 * `getTextContent()`'s public `styles` map deliberately generalizes away)
 * when it recognizably matches a common Word font; otherwise falls back to
 * the generic family pdf.js does expose (serif/sans-serif/monospace).
 */
function mapFontFamily(genericFamily: string, realName?: string): string {
  if (realName) {
    // Strip a subset tag ("ABCDEF+Arial-BoldMT" -> "Arial-BoldMT") and any
    // style suffix after a comma or hyphen.
    const base = realName.replace(/^[A-Z]{6}\+/, "").split(/[,-]/)[0].trim();
    const lower = base.toLowerCase().replace(/\s+/g, "");
    const known = KNOWN_WORD_FONTS.find((k) => {
      const kLower = k.toLowerCase().replace(/\s+/g, "");
      return lower.includes(kLower) || kLower.includes(lower);
    });
    if (known) return known;
    if (/helvetica/i.test(base)) return "Arial";
    if (/times/i.test(base)) return "Times New Roman";
    if (/courier/i.test(base)) return "Courier New";
  }
  if (genericFamily === "serif") return "Times New Roman";
  if (genericFamily === "monospace") return "Courier New";
  return "Arial";
}

export interface PdfToWordResult {
  bytes: Uint8Array;
  pageCount: number;
  runCount: number;
  emptyPageCount: number;
}

/**
 * Rebuilds a PDF as a .docx with each line of text placed in its own
 * absolutely-positioned frame matching the PDF's coordinates, carrying the
 * real font family, size, bold and italic over from the source — not a
 * flow-layout guess. This is a genuinely close visual match, not a
 * pixel-perfect one: DOCX has no equivalent of arbitrary text rotation,
 * per-character color isn't extracted (everything comes out black), and
 * images aren't carried over — only text. Pages with no extractable text
 * (a scan with no OCR layer) come through as a blank page in the output;
 * run OCR PDF first if that's the case.
 */
export async function pdfToWord(
  sourceBytes: ArrayBuffer,
  onProgress?: (page: number, total: number) => void
): Promise<PdfToWordResult> {
  const pdf = await loadPdfDocument(sourceBytes);
  const sections: ISectionOptions[] = [];
  let runCount = 0;
  let emptyPageCount = 0;

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    onProgress?.(pageNum, pdf.numPages);
    const page = await pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale: 1 });
    const pageWidthPt = viewport.width;
    const pageHeightPt = viewport.height;

    // Forces pdf.js to actually load the fonts this page uses into
    // page.commonObjs — getTextContent() alone won't do that.
    await page.getOperatorList();
    const textContent = await page.getTextContent();

    const paragraphs: Paragraph[] = [];

    for (const item of textContent.items) {
      if (!("str" in item) || !item.str || !item.str.trim()) continue;

      const scaleX = Math.hypot(item.transform[0], item.transform[1]);
      const scaleY = Math.hypot(item.transform[2], item.transform[3]);
      const fontSizePt = scaleY || scaleX || 10;
      const xPt = item.transform[4];
      const baselineYPt = item.transform[5];

      let fontName: string | undefined;
      let bold = false;
      let italic = false;
      let ascent = DEFAULT_ASCENT;
      try {
        const fontObj = await page.commonObjs.get(item.fontName);
        if (fontObj) {
          fontName = fontObj.name;
          bold = !!fontObj.bold;
          italic = !!fontObj.italic;
          if (typeof fontObj.ascent === "number" && fontObj.ascent > 0) ascent = fontObj.ascent;
        }
      } catch {
        // Font failed to load for some reason — fall back to defaults below.
      }

      const genericFamily = textContent.styles[item.fontName]?.fontFamily ?? "sans-serif";
      const topYPt = Math.max(0, pageHeightPt - baselineYPt - fontSizePt * ascent);
      const widthPt = Math.max(item.width || fontSizePt * item.str.length * 0.5, 10);
      const heightPt = Math.max(item.height || fontSizePt * 1.2, fontSizePt * 1.1);

      paragraphs.push(
        new Paragraph({
          frame: {
            type: "absolute",
            position: { x: Math.round(xPt * PT_TO_TWIP), y: Math.round(topYPt * PT_TO_TWIP) },
            width: Math.round(widthPt * PT_TO_TWIP),
            height: Math.round(heightPt * PT_TO_TWIP),
            anchor: { horizontal: FrameAnchorType.PAGE, vertical: FrameAnchorType.PAGE },
          },
          spacing: { before: 0, after: 0 },
          children: [
            new TextRun({
              text: item.str,
              font: mapFontFamily(genericFamily, fontName),
              size: Math.max(2, Math.round(fontSizePt * 2)), // OOXML run size is in half-points
              ...(bold ? { bold: true } : {}),
              ...(italic ? { italics: true } : {}),
            }),
          ],
        })
      );
      runCount++;
    }

    if (paragraphs.length === 0) emptyPageCount++;

    sections.push({
      properties: {
        page: {
          size: {
            width: Math.round(pageWidthPt * PT_TO_TWIP),
            height: Math.round(pageHeightPt * PT_TO_TWIP),
          },
          margin: { top: 0, right: 0, bottom: 0, left: 0 },
        },
      },
      children: paragraphs.length > 0 ? paragraphs : [new Paragraph({ text: "" })],
    });

    page.cleanup();
  }

  const pageCount = pdf.numPages;
  await pdf.destroy();

  const doc = new Document({ sections });
  const blob = await Packer.toBlob(doc);
  const bytes = new Uint8Array(await blob.arrayBuffer());

  return { bytes, pageCount, runCount, emptyPageCount };
}
