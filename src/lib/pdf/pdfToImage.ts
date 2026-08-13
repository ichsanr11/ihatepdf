import { loadPdfDocument } from "./render";
import JSZip from "jszip";

export interface PdfToImageResult {
  fileName: string;
  blob: Blob;
}

/** Render every page of a PDF to a JPG/PNG image at the given scale (2 ~= 150dpi, 3 ~= 220dpi). */
export async function pdfToImages(
  bytes: ArrayBuffer,
  opts: { format?: "jpeg" | "png"; scale?: number; baseName?: string; password?: string } = {}
): Promise<PdfToImageResult[]> {
  const { format = "jpeg", scale = 2, baseName = "page", password } = opts;
  const pdf = await loadPdfDocument(bytes, password);
  const mime = format === "png" ? "image/png" : "image/jpeg";
  const ext = format === "png" ? "png" : "jpg";
  const results: PdfToImageResult[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const ctx = canvas.getContext("2d")!;
    if (format === "jpeg") {
      // JPEG has no alpha channel; paint white first or transparent PDF
      // regions turn black.
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    await page.render({ canvasContext: ctx, viewport }).promise;

    const blob: Blob = await new Promise((resolve, reject) =>
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("Gagal membuat gambar"))),
        mime,
        0.92
      )
    );

    const num = String(i).padStart(String(pdf.numPages).length, "0");
    results.push({ fileName: `${baseName}_${num}.${ext}`, blob });
    page.cleanup();
  }

  await pdf.destroy();
  return results;
}

export async function zipImages(results: PdfToImageResult[], zipName: string) {
  const zip = new JSZip();
  results.forEach((r) => zip.file(r.fileName, r.blob));
  const bytes = await zip.generateAsync({ type: "uint8array" });
  return { fileName: zipName, bytes };
}
