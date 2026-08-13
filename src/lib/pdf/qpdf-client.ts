"use client";

/**
 * Thin promise wrapper around qpdf.js (QPDF compiled to WebAssembly, run in
 * a Web Worker). This is the one operation pdf-lib genuinely cannot do:
 * real PDF encryption/decryption. Runtime files are static assets copied
 * to public/qpdf/ by scripts/copy-qpdf-assets.mjs (see postinstall).
 *
 * Everything still runs 100% client-side — the worker + wasm never make a
 * network request, they just need to be served as static files instead of
 * bundled, since qpdf.js loads them via `new Worker(path + '...')`.
 */

interface QpdfEncryptOptions {
  arrayBuffer: ArrayBuffer;
  userPassword?: string;
  ownerPassword?: string;
  keyLength?: 40 | 128 | 256;
  callback: (err: Error | null, arrayBuffer?: ArrayBuffer) => void;
}

interface QpdfInstance {
  save: (name: string, data: ArrayBuffer, cb?: (err: Error | null) => void) => void;
  execute: (args: string[], cb?: (err: Error | null) => void) => void;
  load: (name: string, cb: (err: Error | null, data?: ArrayBuffer) => void) => void;
}

interface QpdfGlobal {
  (opts: { ready: (qpdf: QpdfInstance) => void; logger?: (line: string) => void }): void;
  encrypt: (opts: QpdfEncryptOptions) => void;
  path: string;
}

declare global {
  interface Window {
    QPDF?: QpdfGlobal;
  }
}

let scriptPromise: Promise<QpdfGlobal> | null = null;

function loadQpdf(): Promise<QpdfGlobal> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("qpdf.js hanya berjalan di browser"));
  }
  if (window.QPDF) return Promise.resolve(window.QPDF);
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "/qpdf/qpdf.js";
    script.async = true;
    script.onload = () => {
      if (window.QPDF) {
        window.QPDF.path = "/qpdf/";
        resolve(window.QPDF);
      } else {
        reject(new Error("Modul QPDF gagal dimuat"));
      }
    };
    script.onerror = () => reject(new Error("Gagal memuat modul QPDF dari /qpdf/qpdf.js"));
    document.head.appendChild(script);
  });

  return scriptPromise;
}

export async function encryptPdf(
  bytes: ArrayBuffer,
  opts: { userPassword: string; ownerPassword?: string; keyLength?: 40 | 128 | 256 }
): Promise<Uint8Array> {
  const QPDF = await loadQpdf();
  return new Promise((resolve, reject) => {
    QPDF.encrypt({
      arrayBuffer: bytes,
      userPassword: opts.userPassword,
      ownerPassword: opts.ownerPassword ?? opts.userPassword,
      keyLength: opts.keyLength ?? 256,
      callback: (err, out) => {
        if (err || !out) reject(err ?? new Error("Gagal mengenkripsi PDF"));
        else resolve(new Uint8Array(out));
      },
    });
  });
}

export async function decryptPdf(bytes: ArrayBuffer, password: string): Promise<Uint8Array> {
  const QPDF = await loadQpdf();
  return new Promise((resolve, reject) => {
    QPDF({
      ready(qpdf) {
        qpdf.save("input.pdf", bytes, (saveErr) => {
          if (saveErr) {
            reject(saveErr);
            return;
          }
          // This WASM build's argument parser requires the combined
          // `--password=value` form; a separate `--password value` pair
          // (as shown in upstream qpdf.js's own README) fails with
          // "--password must be given as --password=password".
          qpdf.execute(
            ["--decrypt", `--password=${password}`, "--", "input.pdf", "output.pdf"],
            (execErr) => {
              if (execErr) {
                reject(new Error("Password salah, atau PDF tidak bisa dibuka."));
                return;
              }
              qpdf.load("output.pdf", (loadErr, out) => {
                if (loadErr || !out) reject(loadErr ?? new Error("Gagal membaca hasil"));
                else resolve(new Uint8Array(out));
              });
            }
          );
        });
      },
    });
  });
}
