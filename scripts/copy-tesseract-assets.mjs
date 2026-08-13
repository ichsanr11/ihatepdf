// Copies the Tesseract.js runtime (web worker + WASM OCR core) from
// node_modules into public/tesseract/. Like qpdf's assets, these are loaded
// via `new Worker('/tesseract/worker.min.js')` and `importScripts(...)`
// inside it — not bundled by webpack/Turbopack — so they must be static
// files. Self-hosting these two (instead of tesseract.js's jsdelivr CDN
// default) keeps OCR from depending on a third-party CDN for its core
// engine; only the (public, non-user) language model still comes from a
// CDN by default — see lib/pdf/ocr.ts. Runs via the "postinstall" script.
import { existsSync, mkdirSync, copyFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const dest = join(root, "public", "tesseract");

const workerSrc = join(root, "node_modules", "tesseract.js", "dist", "worker.min.js");
const coreSrc = join(
  root,
  "node_modules",
  "tesseract.js-core",
  "tesseract-core-lstm.wasm.js"
);

if (!existsSync(workerSrc) || !existsSync(coreSrc)) {
  console.warn("[copy-tesseract-assets] tesseract.js not found in node_modules, skipping.");
  process.exit(0);
}

mkdirSync(dest, { recursive: true });
copyFileSync(workerSrc, join(dest, "worker.min.js"));
copyFileSync(coreSrc, join(dest, "tesseract-core-lstm.wasm.js"));

console.log(`[copy-tesseract-assets] Copied tesseract.js runtime to ${dest}`);
