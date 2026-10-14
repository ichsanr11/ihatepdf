// Copies pdf.js's standard-fonts metrics (character widths for the 14 base
// PDF fonts — Helvetica, Times, Courier, etc. — which are referenced by
// name but never embedded in most PDFs) into public/pdfjs/standard_fonts/.
// Without these, pdf.js falls back to rough guessed widths, which throws
// off every width-dependent feature (text extraction for PDF to Word,
// thumbnail layout) whenever a PDF relies on an unembedded standard font.
// Runs automatically via the "postinstall" npm script.
import { existsSync, mkdirSync, readdirSync, copyFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = join(__dirname, "..", "node_modules", "pdfjs-dist", "standard_fonts");
const dest = join(__dirname, "..", "public", "pdfjs", "standard_fonts");

if (!existsSync(src)) {
  console.warn("[copy-pdfjs-assets] pdfjs-dist standard_fonts not found, skipping.");
  process.exit(0);
}

mkdirSync(dest, { recursive: true });
for (const name of readdirSync(src)) {
  copyFileSync(join(src, name), join(dest, name));
}

console.log(`[copy-pdfjs-assets] Copied pdf.js standard fonts to ${dest}`);
