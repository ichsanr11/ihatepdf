import type { NextConfig } from "next";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  turbopack: {
    // Pin the workspace root to this project — otherwise Next.js walks up
    // looking for a lockfile and may latch onto an unrelated one in the
    // user's home directory.
    root: dirname(fileURLToPath(import.meta.url)),
    // pdfjs-dist's legacy build optionally references the Node "canvas"
    // package; we only ever run it in the browser, so alias it away.
    resolveAlias: {
      canvas: "./empty-module.ts",
    },
  },
};

export default nextConfig;
