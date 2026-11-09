import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { loadCustomFontBytes, type TextFontFamily } from "./fonts";

export type { TextFontFamily };
export type TextAlignment = "left" | "center" | "right" | "justify";
export type TextListType = "none" | "bullet" | "decimal" | "alpha" | "roman";

export interface TextPlacement {
  /** Left edge, 0-1 relative to page width. */
  xPct: number;
  /** Top edge, 0-1 relative to page height (top-origin, matches screen coordinates). */
  yPct: number;
  /** 0-1 relative to page width — the wrap width for the text, not a hard visual clip. */
  widthPct: number;
  /** 0-1 relative to page height — cosmetic only in the preview; doesn't clip the PDF output. */
  heightPct: number;
}

export interface TextRgbColor {
  r: number; // 0-1
  g: number; // 0-1
  b: number; // 0-1
}

export interface TextItem {
  text: string;
  fontFamily: TextFontFamily;
  fontSizePt: number;
  bold: boolean;
  italic: boolean;
  color: TextRgbColor;
  alignment: TextAlignment;
  listType: TextListType;
  placement: TextPlacement;
  target: { allPages: boolean; pageIndex: number };
}

const STANDARD_FAMILIES = new Set<TextFontFamily>(["helvetica", "times", "courier"]);

function resolveStandardFont(family: TextFontFamily, bold: boolean, italic: boolean): StandardFonts {
  if (family === "times") {
    if (bold && italic) return StandardFonts.TimesRomanBoldItalic;
    if (bold) return StandardFonts.TimesRomanBold;
    if (italic) return StandardFonts.TimesRomanItalic;
    return StandardFonts.TimesRoman;
  }
  if (family === "courier") {
    if (bold && italic) return StandardFonts.CourierBoldOblique;
    if (bold) return StandardFonts.CourierBold;
    if (italic) return StandardFonts.CourierOblique;
    return StandardFonts.Courier;
  }
  if (bold && italic) return StandardFonts.HelveticaBoldOblique;
  if (bold) return StandardFonts.HelveticaBold;
  if (italic) return StandardFonts.HelveticaOblique;
  return StandardFonts.Helvetica;
}

const ROMAN_TABLE: [number, string][] = [
  [1000, "m"], [900, "cm"], [500, "d"], [400, "cd"], [100, "c"], [90, "xc"],
  [50, "l"], [40, "xl"], [10, "x"], [9, "ix"], [5, "v"], [4, "iv"], [1, "i"],
];
function toRoman(n: number): string {
  let num = n;
  let out = "";
  for (const [value, symbol] of ROMAN_TABLE) {
    while (num >= value) {
      out += symbol;
      num -= value;
    }
  }
  return out;
}
/** 1 -> a, 2 -> b, ... 26 -> z, 27 -> aa, 28 -> ab, ... (spreadsheet-column style). */
function toAlpha(n: number): string {
  let num = n;
  let out = "";
  while (num > 0) {
    const rem = (num - 1) % 26;
    out = String.fromCharCode(97 + rem) + out;
    num = Math.floor((num - 1) / 26);
  }
  return out;
}

function listMarker(listType: TextListType, index1Based: number): string {
  switch (listType) {
    case "bullet":
      return "•";
    case "decimal":
      return `${index1Based}.`;
    case "alpha":
      return `${toAlpha(index1Based)}.`;
    case "roman":
      return `${toRoman(index1Based)}.`;
    default:
      return "";
  }
}

/** Breaks `text` into lines that each fit within `maxWidth` at `size`. */
function wrapWords(words: string[], font: PDFFont, size: number, maxWidth: number): string[] {
  if (words.length === 0) return [""];
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (current && font.widthOfTextAtSize(candidate, size) > maxWidth) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  lines.push(current);
  return lines;
}

/** Draws one line with extra inter-word spacing so it fills `targetWidth` exactly (standard justify behavior — never applied to a paragraph's last line). */
function drawJustifiedLine(
  page: PDFPage,
  line: string,
  font: PDFFont,
  size: number,
  color: ReturnType<typeof rgb>,
  x: number,
  y: number,
  targetWidth: number
) {
  const words = line.split(" ").filter(Boolean);
  if (words.length <= 1) {
    page.drawText(line, { x, y, size, font, color });
    return;
  }
  const wordWidths = words.map((w) => font.widthOfTextAtSize(w, size));
  const totalWordWidth = wordWidths.reduce((a, b) => a + b, 0);
  const spaceWidth = font.widthOfTextAtSize(" ", size);
  const gaps = words.length - 1;
  const extra = Math.max(0, targetWidth - totalWordWidth - spaceWidth * gaps);
  const gapWidth = spaceWidth + extra / gaps;

  let cursorX = x;
  words.forEach((word, i) => {
    page.drawText(word, { x: cursorX, y, size, font, color });
    cursorX += wordWidths[i] + gapWidth;
  });
}

function drawAlignedLine(
  page: PDFPage,
  line: string,
  font: PDFFont,
  size: number,
  color: ReturnType<typeof rgb>,
  x: number,
  y: number,
  availableWidth: number,
  alignment: TextAlignment,
  isLastLineOfParagraph: boolean
) {
  if (alignment === "justify" && !isLastLineOfParagraph) {
    drawJustifiedLine(page, line, font, size, color, x, y, availableWidth);
    return;
  }
  const lineWidth = font.widthOfTextAtSize(line, size);
  let drawX = x;
  if (alignment === "center") drawX = x + (availableWidth - lineWidth) / 2;
  else if (alignment === "right") drawX = x + (availableWidth - lineWidth);
  page.drawText(line, { x: drawX, y, size, font, color });
}

async function getFont(
  doc: PDFDocument,
  cache: Map<string, PDFFont>,
  family: TextFontFamily,
  bold: boolean,
  italic: boolean
): Promise<PDFFont> {
  // Custom (embedded) fonts only have regular/bold — italic silently falls
  // back to the matching non-italic weight (the UI disables the italic
  // toggle for these fonts so this is never a surprise to the user).
  const effectiveItalic = STANDARD_FAMILIES.has(family) && italic;
  const key = `${family}-${bold}-${effectiveItalic}`;
  let font = cache.get(key);
  if (font) return font;

  if (STANDARD_FAMILIES.has(family)) {
    font = await doc.embedFont(resolveStandardFont(family, bold, effectiveItalic));
  } else {
    const bytes = await loadCustomFontBytes(family, bold);
    font = await doc.embedFont(bytes, { subset: true });
  }
  cache.set(key, font);
  return font;
}

/**
 * Draws one or more free-form text items onto a PDF — each with its own
 * font family/size/color/style/alignment/list formatting, position, wrap
 * width, and target page(s).
 *
 * Fonts: the 3 standard PDF fonts (Helvetica/Times/Courier) use pdf-lib's
 * built-in 14 standard fonts (no embedding, always available). The broader
 * selection is embedded via @pdf-lib/fontkit from self-hosted WOFF files
 * (scripts/copy-custom-fonts.mjs) — open-licensed Google Fonts standing in
 * for "as many font choices as Word", since Word's own bundled fonts
 * (Calibri, Cambria, Segoe UI, Tahoma, ...) are Microsoft-licensed and
 * can't legally be redistributed in an open web app.
 *
 * Lists: each manual line (`\n`-separated) in an item's text is treated as
 * one list entry — bullet, decimal (1.), alpha (a.), or roman (i.) — with
 * wrapped continuation lines indented to align under the first line's text
 * rather than under the marker.
 *
 * Alignment: left/center/right position each wrapped line within the wrap
 * width; justify stretches inter-word spacing on every line except a
 * paragraph's last (the standard typographic convention).
 *
 * Positions are percentages of each page's own size, so a placement still
 * looks right even across pages of different sizes in the same document.
 */
export async function addTextToPdf(sourceBytes: ArrayBuffer, items: TextItem[]): Promise<Uint8Array> {
  const doc = await PDFDocument.load(sourceBytes, { ignoreEncryption: true });
  doc.registerFontkit(fontkit);
  const allPages = doc.getPages();
  const fontCache = new Map<string, PDFFont>();

  for (const item of items) {
    if (!item.text.trim()) continue;
    const font = await getFont(doc, fontCache, item.fontFamily, item.bold, item.italic);
    const color = rgb(item.color.r, item.color.g, item.color.b);
    const pages = item.target.allPages ? allPages : [allPages[item.target.pageIndex]];
    const lineHeight = item.fontSizePt * 1.2;
    const markerGap = item.listType === "none" ? 0 : font.widthOfTextAtSize("MM", item.fontSizePt);

    for (const page of pages) {
      const { width, height } = page.getSize();
      const x = item.placement.xPct * width;
      const maxWidth = Math.max(10, item.placement.widthPct * width);
      let baselineY = height - item.placement.yPct * height - item.fontSizePt;

      const paragraphs = item.text.split("\n");
      paragraphs.forEach((paragraph, paraIndex) => {
        const marker = listMarker(item.listType, paraIndex + 1);
        const indent = marker ? markerGap : 0;
        const wrapped = wrapWords(paragraph.split(" "), font, item.fontSizePt, maxWidth - indent);

        wrapped.forEach((line, lineIndex) => {
          const lineX = x + indent;
          const lineAvailWidth = maxWidth - indent;
          const isLastLineOfParagraph = lineIndex === wrapped.length - 1;

          if (lineIndex === 0 && marker) {
            page.drawText(marker, { x, y: baselineY, size: item.fontSizePt, font, color });
          }
          drawAlignedLine(
            page,
            line,
            font,
            item.fontSizePt,
            color,
            lineX,
            baselineY,
            lineAvailWidth,
            item.alignment,
            isLastLineOfParagraph
          );
          baselineY -= lineHeight;
        });
      });
    }
  }

  return doc.save();
}
