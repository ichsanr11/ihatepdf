// Patches two Turbopack incompatibilities in the installed @ffmpeg/ffmpeg
// package (both are dead code for us — we never pass a custom
// classWorkerURL/coreURL shape that would hit the dynamic branches — but
// Turbopack statically analyzes them anyway and fails regardless):
//
// 1. classes.js: FFmpeg.load() picks between two Worker URLs at runtime —
//    `classWorkerURL` (caller-supplied, dynamic) or a hardcoded
//    "./worker.js" fallback. Turbopack fails the whole build on the dynamic
//    branch ("Module not found: Can't resolve (<dynamic> | 'undefined')").
//
// 2. worker.js: loads ffmpeg-core.js via `import(_coreURL)`, a runtime
//    string. The library already has a `/* @vite-ignore */` comment to stop
//    Vite from statically analyzing it; Turbopack needs its own
//    `/* webpackIgnore: true */` comment (which it honors for webpack
//    compat) to do the same, or it throws at runtime ("Cannot find module
//    as expression is too dynamic").
//
// Runs automatically via the "postinstall" npm script.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const esmDir = join(__dirname, "..", "node_modules", "@ffmpeg", "ffmpeg", "dist", "esm");

function patch(fileName, needle, replacement) {
  const target = join(esmDir, fileName);
  if (!existsSync(target)) {
    console.warn(`[patch-ffmpeg-worker] ${fileName} not found, skipping.`);
    return;
  }
  const original = readFileSync(target, "utf8");
  if (original.includes(replacement)) {
    console.log(`[patch-ffmpeg-worker] ${fileName} already patched, skipping.`);
    return;
  }
  if (!original.includes(needle)) {
    console.warn(
      `[patch-ffmpeg-worker] ${fileName}: expected code not found (package version may have changed) — skipping patch.`
    );
    return;
  }
  writeFileSync(target, original.replace(needle, replacement));
  console.log(`[patch-ffmpeg-worker] Patched ${target}`);
}

patch(
  "classes.js",
  `this.#worker = classWorkerURL ?
                new Worker(new URL(classWorkerURL, import.meta.url), {
                    type: "module",
                }) :
                // We need to duplicated the code here to enable webpack
                // to bundle worekr.js here.
                new Worker(new URL("./worker.js", import.meta.url), {
                    type: "module",
                });`,
  `this.#worker = new Worker(new URL("./worker.js", import.meta.url), {
                type: "module",
            });`
);

patch(
  "worker.js",
  `self.createFFmpegCore = (await import(
        /* @vite-ignore */ _coreURL)).default;`,
  `self.createFFmpegCore = (await import(
        /* @vite-ignore */ /* webpackIgnore: true */ _coreURL)).default;`
);
