import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Merge Tailwind class names, letting later classes win over earlier conflicting ones. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Human-readable file size, e.g. 1536000 -> "1.5 MB". */
export function formatBytes(bytes: number, decimals = 1): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const value = bytes / Math.pow(k, i);
  return `${value.toFixed(i === 0 ? 0 : decimals)} ${sizes[i]}`;
}

/** Strip the extension from a filename, e.g. "report.pdf" -> "report". */
export function baseName(fileName: string): string {
  return fileName.replace(/\.[^/.]+$/, "");
}

/**
 * Safely extract a Uint8Array's exact byte range into a standalone
 * ArrayBuffer — most lib/pdf/*.ts functions take `sourceBytes: ArrayBuffer`
 * (matching `File.arrayBuffer()`), but chained workflow steps pass around
 * `Uint8Array` results instead (from `PDFDocument.save()`). `.slice()`
 * always allocates a fresh, exactly-sized ArrayBuffer, so this is safe
 * even if the Uint8Array is a view with a byteOffset or extra padding.
 */
export function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

/** Wrap in-memory PDF bytes as a File, e.g. to feed into hooks/components built around file uploads. */
export function bytesToPdfFile(bytes: Uint8Array, fileName: string): File {
  return new File([new Uint8Array(bytes)], fileName, { type: "application/pdf" });
}
