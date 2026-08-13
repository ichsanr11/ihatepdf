// Copies the qpdf.js runtime (script + web worker + wasm glue) from
// node_modules into public/qpdf/. These are loaded at runtime via a plain
// <script> tag and `new Worker('/qpdf/qpdf-worker.js')` — they are NOT
// bundled by webpack, so they must live as static files under public/.
// Runs automatically via the "postinstall" npm script.
import { existsSync, mkdirSync, copyFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = join(__dirname, "..", "node_modules", "qpdf.js", "src");
const dest = join(__dirname, "..", "public", "qpdf");

if (!existsSync(src)) {
  console.warn("[copy-qpdf-assets] qpdf.js not found in node_modules, skipping.");
  process.exit(0);
}

const files = [
  ["qpdf.js", "qpdf.js"],
  ["qpdf-worker.js", "qpdf-worker.js"],
  [join("lib", "qpdf.js"), join("lib", "qpdf.js")],
  [join("lib", "qpdf.wasm"), join("lib", "qpdf.wasm")],
];

mkdirSync(join(dest, "lib"), { recursive: true });

for (const [from, to] of files) {
  copyFileSync(join(src, from), join(dest, to));
}

console.log(`[copy-qpdf-assets] Copied qpdf.js runtime to ${dest}`);
