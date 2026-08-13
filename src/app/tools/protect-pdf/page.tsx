"use client";

import { useState } from "react";
import { Lock } from "lucide-react";
import { ToolPageHeader } from "@/components/tool-page-header";
import { FileDropzone } from "@/components/file-dropzone";
import { ResultPanel } from "@/components/result-panel";
import { ErrorBanner } from "@/components/error-banner";
import { Spinner } from "@/components/spinner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getToolBySlug } from "@/lib/tools";
import { encryptPdf } from "@/lib/pdf/qpdf-client";
import { downloadBytes } from "@/lib/download";
import { baseName } from "@/lib/utils";

const tool = getToolBySlug("protect-pdf")!;

export default function ProtectPdfPage() {
  const [file, setFile] = useState<File | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ bytes: Uint8Array; fileName: string } | null>(null);

  const mismatch = confirm.length > 0 && password !== confirm;

  async function handleProtect() {
    if (!file || !password || mismatch) return;
    setBusy(true);
    setError(null);
    try {
      const bytes = await file.arrayBuffer();
      const out = await encryptPdf(bytes, { userPassword: password, keyLength: 256 });
      setResult({ bytes: out, fileName: `${baseName(file.name)}_protected.pdf` });
    } catch {
      setError("Gagal mengenkripsi PDF. Coba lagi atau gunakan file lain.");
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setFile(null);
    setPassword("");
    setConfirm("");
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
            <FileDropzone accept="application/pdf" onFiles={(fs) => setFile(fs[0])} label="Pilih PDF" />
          ) : busy ? (
            <Spinner label="Mengenkripsi PDF (AES-256)..." />
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">{file.name}</span>
              </p>

              <div>
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  className="mt-1.5"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimal 4 karakter"
                />
              </div>
              <div>
                <Label htmlFor="confirm">Konfirmasi password</Label>
                <Input
                  id="confirm"
                  type="password"
                  className="mt-1.5"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                />
                {mismatch && <p className="mt-1.5 text-xs text-destructive">Password tidak sama.</p>}
              </div>

              <p className="text-xs text-muted-foreground">
                PDF dienkripsi AES-256 menggunakan QPDF (WebAssembly) — tetap berjalan sepenuhnya di
                browser Anda, password tidak pernah dikirim ke mana pun.
              </p>

              <Button
                size="lg"
                disabled={!password || mismatch}
                onClick={handleProtect}
                className="self-start"
              >
                <Lock className="h-4 w-4" />
                Kunci PDF
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
