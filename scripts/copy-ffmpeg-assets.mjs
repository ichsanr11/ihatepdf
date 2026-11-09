// Copies the ffmpeg.wasm single-threaded core (ESM build) into
// public/ffmpeg/ so Split Audio can load it from our own origin instead of
// a CDN — consistent with how qpdf.js/tesseract.js are self-hosted. Only
// the ESM build is needed: the FFmpeg worker (dist/esm/worker.js) is loaded
// as a module worker, which always takes the `import(coreURL)` path rather
// than `importScripts`, so the UMD build is never used at runtime.
// Runs automatically via the "postinstall" npm script.
import { existsSync, mkdirSync, copyFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = join(__dirname, "..", "node_modules", "@ffmpeg", "core", "dist", "esm");
const dest = join(__dirname, "..", "public", "ffmpeg");

if (!existsSync(src)) {
  console.warn("[copy-ffmpeg-assets] @ffmpeg/core not found, skipping.");
  process.exit(0);
}

mkdirSync(dest, { recursive: true });
for (const name of ["ffmpeg-core.js", "ffmpeg-core.wasm"]) {
  copyFileSync(join(src, name), join(dest, name));
}

console.log(`[copy-ffmpeg-assets] Copied ffmpeg.wasm core to ${dest}`);
