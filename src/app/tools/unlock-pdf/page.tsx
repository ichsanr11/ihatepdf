"use client";

import { useState } from "react";
import { Unlock } from "lucide-react";
import { ToolPageHeader } from "@/components/tool-page-header";
import { FileDropzone } from "@/components/file-dropzone";
import { ResultPanel } from "@/components/result-panel";
import { ErrorBanner } from "@/components/error-banner";
import { Spinner } from "@/components/spinner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getToolBySlug } from "@/lib/tools";
import { decryptPdf } from "@/lib/pdf/qpdf-client";
import { downloadBytes } from "@/lib/download";
import { baseName } from "@/lib/utils";

const tool = getToolBySlug("unlock-pdf")!;

export default function UnlockPdfPage() {
  const [file, setFile] = useState<File | null>(null);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ bytes: Uint8Array; fileName: string } | null>(null);

  async function handleUnlock() {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const bytes = await file.arrayBuffer();
      const out = await decryptPdf(bytes, password);
      setResult({ bytes: out, fileName: `${baseName(file.name)}_unlocked.pdf` });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal membuka PDF.");
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setFile(null);
    setPassword("");
    setResult(null);
    setError(null);
  }

  return (
    <div className="container max-w-xl py-12">
      <ToolPageHeader tool={tool} />

      {result ? (
        <ResultPanel
          fileName={result.fileName}
          sizeBytes={result.bytes.byteLength}
          onDownload={() => downloadBytes(result.bytes, result.fileName, "application/pdf")}
          onReset={reset}
        />
      ) : (
        <div className="flex flex-col gap-5">
          {error && <ErrorBanner message={error} />}

          {!file ? (
            <FileDropzone accept="application/pdf" onFiles={(fs) => setFile(fs[0])} label="Pilih PDF terkunci" />
          ) : busy ? (
            <Spinner label="Membuka kunci PDF..." />
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">{file.name}</span>
              </p>

              <div>
                <Label htmlFor="password">Password saat ini</Label>
                <Input
                  id="password"
                  type="password"
                  className="mt-1.5"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Kosongkan jika tidak ada open-password"
                />
              </div>

              <p className="text-xs text-muted-foreground">
                Tool ini hanya menghapus proteksi dari PDF yang password-nya sudah Anda ketahui —
                bukan untuk membobol PDF milik orang lain. Prosesnya berjalan lokal via QPDF
                (WebAssembly), password tidak pernah dikirim ke server.
              </p>

              <Button size="lg" onClick={handleUnlock} className="self-start">
                <Unlock className="h-4 w-4" />
                Buka Kunci PDF
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
