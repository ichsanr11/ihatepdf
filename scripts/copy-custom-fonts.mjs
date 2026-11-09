// Copies the Latin-subset Regular (400) + Bold (700) WOFF files for each
// curated @fontsource package into public/fonts/ — used by Add Text to
// offer a broader font selection than pdf-lib's 14 standard fonts, embedded
// via @pdf-lib/fontkit. WOFF (not WOFF2) is used because fontkit's WOFF
// decoder relies on the already-bundled `pako` (zlib) rather than a
// brotli decoder, so it's the safer/better-tested format to embed.
// Runs automatically via the "postinstall" npm script.
import { existsSync, mkdirSync, copyFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dest = join(__dirname, "..", "public", "fonts");

// Keep in sync with CUSTOM_FONTS in src/lib/pdf/fonts.ts.
const FAMILIES = [
  "roboto",
  "open-sans",
  "lato",
  "montserrat",
  "poppins",
  "merriweather",
  "playfair-display",
  "pt-serif",
  "source-code-pro",
  "oswald",
  "caveat",
  "nunito",
];

mkdirSync(dest, { recursive: true });
let copied = 0;

for (const family of FAMILIES) {
  const pkgDir = join(__dirname, "..", "node_modules", "@fontsource", family, "files");
  if (!existsSync(pkgDir)) {
    console.warn(`[copy-custom-fonts] @fontsource/${family} not found, skipping.`);
    continue;
  }
  for (const weight of ["400", "700"]) {
    const fileName = `${family}-latin-${weight}-normal.woff`;
    const src = join(pkgDir, fileName);
    if (!existsSync(src)) {
      console.warn(`[copy-custom-fonts] ${fileName} not found, skipping.`);
      continue;
    }
    copyFileSync(src, join(dest, fileName));
    copied++;
  }
}

console.log(`[copy-custom-fonts] Copied ${copied} font files to ${dest}`);
