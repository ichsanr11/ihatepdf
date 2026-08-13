/**
 * Trigger a browser download for in-memory bytes without ever touching a
 * server — every tool on this site processes files locally, so results are
 * handed straight back to the user via an object URL.
 */
export function downloadBytes(
  bytes: Uint8Array,
  fileName: string,
  mimeType = "application/octet-stream"
) {
  const blob = new Blob([new Uint8Array(bytes)], { type: mimeType });
  downloadBlob(blob, fileName);
}

export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  // Give the browser a tick to start the download before revoking.
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
