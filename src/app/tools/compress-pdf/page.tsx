"use client";

import { useState } from "react";
import { Minimize2 } from "lucide-react";
import { ToolPageHeader } from "@/components/tool-page-header";
import { FileDropzone } from "@/components/file-dropzone";
import { ResultPanel } from "@/components/result-panel";
import { ErrorBanner } from "@/components/error-banner";
import { InfoBanner } from "@/components/info-banner";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getToolBySlug } from "@/lib/tools";
import { compressPdf, compressPdfToTargetSize, type CompressLevel } from "@/lib/pdf/compress";
import { downloadBytes } from "@/lib/download";
import { formatBytes, baseName } from "@/lib/utils";

const tool = getToolBySlug("compress-pdf")!;

const LEVELS: { key: CompressLevel; label: string; desc: string }[] = [
  { key: "light", label: "Ringan", desc: "Kualitas gambar hampir tidak berubah" },
  { key: "recommended", label: "Rekomendasi", desc: "Keseimbangan ukuran & kualitas" },
  { key: "extreme", label: "Ekstrem", desc: "Ukuran paling kecil, gambar lebih buram" },
];

type Mode = "level" | "target";

export default function CompressPdfPage() {
  const [file, setFile] = useState<File | null>(null);
  const [mode, setMode] = useState<Mode>("level");
  const [level, setLevel] = useState<CompressLevel>("recommended");
  const [targetMB, setTargetMB] = useState(10);
  const [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState<{ n: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<{ tone: "info" | "warning"; message: string } | null>(null);
  const [result, setResult] = useState<{ bytes: Uint8Array; fileName: string } | null>(null);

  async function handleCompress() {
    if (!file) return;
    setBusy(true);
    setError(null);
    setNote(null);
    setAttempt(null);
    try {
      const bytes = await file.arrayBuffer();

      if (mode === "target") {
        const targetBytes = Math.round(targetMB * 1024 * 1024);
        const res = await compressPdfToTargetSize(bytes, targetBytes, (n, total) =>
          setAttempt({ n, total })
        );

        if (res.attemptsUsed === 0) {
          // Already under the target size — nothing needed compressing.
          setNote({ tone: "info", message: `File sudah di bawah ${targetMB}MB, jadi tidak perlu dikompres.` });
        } else if (!res.reachedTarget && res.imagesTotal === 0) {
          setNote({
            tone: "warning",
            message: `PDF ini tidak punya gambar JPEG untuk dikompres (isinya teks/vector), jadi ukurannya tidak bisa diturunkan lagi lewat tool ini — ukuran tetap ${formatBytes(res.newSize)}.`,
          });
        } else if (!res.reachedTarget) {
          setNote({
            tone: "warning",
            message: `Sudah dicoba dengan kompresi paling agresif, tapi hasil terkecil yang bisa dicapai adalah ${formatBytes(res.newSize)} — masih di atas target ${targetMB}MB. Kemungkinan gambarnya sudah banyak/besar, atau ada konten selain gambar (font, dll) yang turut menyumbang ukuran.`,
          });
        }

        setResult({ bytes: res.bytes, fileName: `${baseName(file.name)}_compressed.pdf` });
      } else {
        const res = await compressPdf(bytes, level, (n, total) => setAttempt({ n, total }));

        if (res.imagesTotal === 0) {
          setNote({
            tone: "warning",
            message:
              "PDF ini tidak memiliki gambar JPEG di dalamnya (kemungkinan isinya teks/vector saja), jadi hasilnya mungkin tidak banyak mengecil — kompresi tool ini bekerja dengan mengecilkan gambar, bukan teks.",
          });
        } else if (res.imagesRecompressed === 0) {
          setNote({
            tone: "warning",
            message: `Ditemukan ${res.imagesTotal} gambar, tapi tidak ada yang berhasil dikompres lebih kecil (mungkin formatnya tidak didukung atau sudah cukup kecil).`,
          });
        } else if (res.newSize >= res.originalSize) {
          setNote({
            tone: "warning",
            message:
              "File hasil kompresi ternyata tidak lebih kecil dari aslinya, jadi versi asli tetap dipertahankan kualitasnya di sini — coba level \"Ekstrem\" untuk hasil lebih kecil.",
          });
        }

        setResult({ bytes: res.bytes, fileName: `${baseName(file.name)}_compressed.pdf` });
      }
    } catch {
      setError("Gagal mengompres PDF. Pastikan file valid dan tidak terkunci password.");
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setFile(null);
    setResult(null);
    setError(null);
    setNote(null);
    setAttempt(null);
  }

  const originalSize = file?.size ?? 0;
  const reduction =
    result && originalSize > 0
      ? Math.round((1 - result.bytes.byteLength / originalSize) * 100)
      : 0;

  return (
    <div className="container max-w-2xl py-12">
      <ToolPageHeader tool={tool} />

      {result ? (
        <div className="flex flex-col gap-4">
          {note && (note.tone === "warning" ? (
            <ErrorBanner message={note.message} />
          ) : (
            <InfoBanner message={note.message} />
          ))}
          <ResultPanel
            fileName={result.fileName}
            sizeBytes={result.bytes.byteLength}
            onDownload={() => downloadBytes(result.bytes, result.fileName, "application/pdf")}
            onReset={reset}
          />
          <p className="text-center text-sm text-muted-foreground">
            {formatBytes(originalSize)} → {formatBytes(result.bytes.byteLength)}{" "}
            {reduction > 0 && (
              <span className="font-medium text-primary">({reduction}% lebih kecil)</span>
            )}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          {error && <ErrorBanner message={error} />}

          {!file ? (
            <FileDropzone accept="application/pdf" onFiles={(fs) => setFile(fs[0])} label="Pilih PDF" />
          ) : busy ? (
            <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-6">
              <p className="text-sm font-medium">
                {mode === "target"
                  ? `Mencoba pengaturan kompresi ${attempt?.n ?? 1} dari ${attempt?.total ?? "…"}...`
                  : attempt
                    ? `Mengompres gambar ${attempt.n} dari ${attempt.total}...`
                    : "Mengompres gambar di dalam PDF..."}
              </p>
              {attempt && attempt.total > 0 && <Progress value={(attempt.n / attempt.total) * 100} />}
            </div>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">{file.name}</span> ·{" "}
                {formatBytes(file.size)}
              </p>

              <div className="flex gap-3">
                <ModeButton active={mode === "level"} onClick={() => setMode("level")}>
                  Pilih level
                </ModeButton>
                <ModeButton active={mode === "target"} onClick={() => setMode("target")}>
                  Target ukuran maksimum
                </ModeButton>
              </div>

              {mode === "level" ? (
                <>
                  <div className="grid gap-3 sm:grid-cols-3">
                    {LEVELS.map((l) => (
                      <button
                        key={l.key}
                        onClick={() => setLevel(l.key)}
                        className={`rounded-lg border p-4 text-left transition-colors ${
                          level === l.key
                            ? "border-primary bg-primary/5"
                            : "border-border hover:bg-accent"
                        }`}
                      >
                        <p className="font-medium">{l.label}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{l.desc}</p>
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Bekerja dengan mengecilkan resolusi &amp; kualitas gambar JPEG di dalam PDF —
                    teks dan vector tidak disentuh, jadi tetap tajam dan tetap bisa di-select.
                  </p>
                </>
              ) : (
                <>
                  <div>
                    <Label htmlFor="targetMB">Ukuran maksimum hasil (MB)</Label>
                    <Input
                      id="targetMB"
                      type="number"
                      min={0.1}
                      step={0.1}
                      className="mt-1.5 max-w-[160px]"
                      value={targetMB}
                      onChange={(e) => setTargetMB(Number(e.target.value))}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Tool akan mencoba beberapa tingkat kompresi gambar secara berurutan (dari
                    ringan ke sangat agresif) sampai hasilnya di bawah {targetMB}MB, lalu berhenti
                    di percobaan pertama yang berhasil — supaya kualitas tidak turun lebih dari
                    yang diperlukan. Kalau PDF-nya sedikit/tidak ada gambar, target mungkin tidak
                    bisa tercapai walau sudah dicoba semua tingkat.
                  </p>
                </>
              )}

              <Button
                size="lg"
                onClick={handleCompress}
                disabled={mode === "target" && (!targetMB || targetMB <= 0)}
                className="self-start"
              >
                <Minimize2 className="h-4 w-4" />
                Kompres PDF
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function ModeButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-md border px-4 py-2 text-sm font-medium transition-colors ${
        active
          ? "border-primary bg-primary/10 text-primary"
          : "border-border text-muted-foreground hover:bg-accent"
      }`}
    >
      {children}
    </button>
  );
}
