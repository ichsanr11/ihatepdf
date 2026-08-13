"use client";

import { createWorker, OEM } from "tesseract.js";
import { PDFDocument } from "pdf-lib";
import { loadPdfDocument, renderPageToCanvas } from "./render";

export interface OcrLanguage {
  code: string;
  label: string;
}

/** Kept small on purpose — each extra language is another traineddata download. */
export const OCR_LANGUAGES: OcrLanguage[] = [
  { code: "ind", label: "Indonesia" },
  { code: "eng", label: "Inggris" },
];

export interface OcrProgress {
  page: number;
  totalPages: number;
  stage: string;
  progress: number; // 0..1 within the current stage
}

/**
 * Makes a scanned/image-only PDF searchable: OCRs every page with
 * Tesseract.js (WebAssembly, runs in a Web Worker) and rebuilds a PDF where
 * each page is the original page image with an invisible, correctly
 * positioned text layer on top — the same "sandwich" technique every OCR
 * tool uses, produced here by Tesseract's own built-in PDF renderer
 * (`output.pdf`) rather than us hand-placing text boxes.
 *
 * The worker script and OCR engine (WASM) are self-hosted under
 * public/tesseract/ — see scripts/copy-tesseract-assets.mjs — so nothing
 * but the public language model is ever fetched over the network, and the
 * PDF itself never leaves the browser.
 */
export async function ocrPdf(
  sourceBytes: ArrayBuffer,
  opts: { languages: string[]; onProgress?: (p: OcrProgress) => void }
): Promise<Uint8Array> {
  const languages = opts.languages.length > 0 ? opts.languages : ["eng"];
  const pdf = await loadPdfDocument(sourceBytes);
  const totalPages = pdf.numPages;

  let currentPage = 1;
  const worker = await createWorker(languages, OEM.LSTM_ONLY, {
    workerPath: "/tesseract/worker.min.js",
    corePath: "/tesseract/tesseract-core-lstm.wasm.js",
    workerBlobURL: false,
    logger: (m) => {
      opts.onProgress?.({
        page: currentPage,
        totalPages,
        stage: m.status,
        progress: m.progress,
      });
    },
  });

  try {
    const pagePdfBytes: Uint8Array[] = [];
    for (let i = 1; i <= totalPages; i++) {
      currentPage = i;
      const canvas = await renderPageToCanvas(pdf, i, 2.5);
      const { data } = await worker.recognize(
        canvas,
        {},
        { pdf: true, text: false, hocr: false, tsv: false, blocks: false }
      );
      if (!data.pdf) {
        throw new Error(`Gagal membuat lapisan teks OCR untuk halaman ${i}.`);
      }
      pagePdfBytes.push(new Uint8Array(data.pdf));
    }

    const merged = await PDFDocument.create();
    for (const bytes of pagePdfBytes) {
      const single = await PDFDocument.load(bytes, { ignoreEncryption: true });
      const [copied] = await merged.copyPages(single, [0]);
      merged.addPage(copied);
    }
    return merged.save();
  } finally {
    await worker.terminate();
    await pdf.destroy();
  }
}
