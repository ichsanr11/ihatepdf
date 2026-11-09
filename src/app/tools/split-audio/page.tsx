"use client";

import { useMemo, useState } from "react";
import { AudioWaveform } from "lucide-react";
import { ToolPageHeader } from "@/components/tool-page-header";
import { FileDropzone } from "@/components/file-dropzone";
import { ResultPanel } from "@/components/result-panel";
import { ErrorBanner } from "@/components/error-banner";
import { InfoBanner } from "@/components/info-banner";
import { Spinner } from "@/components/spinner";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getToolBySlug } from "@/lib/tools";
import {
  computeSegmentPlan,
  formatDuration,
  mimeTypeForFileName,
  probeDurationSec,
  splitAudioFile,
  zipAudioSegments,
} from "@/lib/audio/splitAudio";
import { downloadBytes } from "@/lib/download";
import { baseName } from "@/lib/utils";

const tool = getToolBySlug("split-audio")!;

export default function SplitAudioPage() {
  const [file, setFile] = useState<File | null>(null);
  const [durationSec, setDurationSec] = useState<number | null>(null);
  const [probing, setProbing] = useState(false);
  const [segmentMinutes, setSegmentMinutes] = useState(20);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ bytes: Uint8Array; fileName: string } | null>(null);

  const plan = useMemo(
    () => (durationSec ? computeSegmentPlan(durationSec, segmentMinutes) : []),
    [durationSec, segmentMinutes]
  );

  async function handleFile(files: File[]) {
    const f = files[0];
    setError(null);
    setProbing(true);
    try {
      const duration = await probeDurationSec(f);
      setFile(f);
      setDurationSec(duration);
      const totalMinutes = Math.max(1, Math.floor(duration / 60));
      setSegmentMinutes((prev) => Math.min(prev, totalMinutes));
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      setError(
        `Gagal membaca file audio. Pastikan formatnya didukung (mp3, wav, ogg, m4a, flac, dll). Detail teknis: ${detail}`
      );
    } finally {
      setProbing(false);
    }
  }

  async function handleSplit() {
    if (!file || !durationSec || plan.length === 0) return;
    setBusy(true);
    setError(null);
    setProgress({ done: 0, total: plan.length });
    try {
      const name = baseName(file.name);
      const segments = await splitAudioFile(file, plan, (done, total) => setProgress({ done, total }));

      if (segments.length === 1) {
        setResult({ bytes: segments[0].bytes, fileName: segments[0].fileName });
      } else {
        const zipped = await zipAudioSegments(segments, `${name}_split.zip`);
        setResult(zipped);
      }
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      setError(`Gagal memisahkan audio. Detail teknis: ${detail}`);
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }

  function reset() {
    setFile(null);
    setDurationSec(null);
    setResult(null);
    setError(null);
    setProgress(null);
  }

  const mime = result?.fileName.endsWith(".zip") ? "application/zip" : mimeTypeForFileName(result?.fileName ?? "");

  return (
    <div className="container max-w-2xl py-12">
      <ToolPageHeader tool={tool} />

      {result ? (
        <ResultPanel
          fileName={result.fileName}
          sizeBytes={result.bytes.byteLength}
          onDownload={() => downloadBytes(result.bytes, result.fileName, mime)}
          onReset={reset}
        />
      ) : (
        <div className="flex flex-col gap-5">
          {error && <ErrorBanner message={error} />}

          {!file ? (
            <FileDropzone
              accept="audio/*"
              onFiles={handleFile}
              label="Pilih file audio"
              hint="mp3, wav, ogg, m4a, flac"
            />
          ) : probing ? (
            <Spinner label="Memuat engine audio & membaca durasi... (pertama kali bisa beberapa detik)" />
          ) : busy ? (
            <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-6">
              <p className="text-sm font-medium">
                Memproses bagian {progress?.done ?? 0} dari {progress?.total ?? plan.length}
              </p>
              <Progress value={progress ? (progress.done / progress.total) * 100 : 0} />
            </div>
          ) : (
            durationSec && (
              <>
                <p className="text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">{file.name}</span> · durasi{" "}
                  {formatDuration(durationSec)}
                </p>

                <div>
                  <Label htmlFor="segment-minutes">Split tiap berapa menit</Label>
                  <Input
                    id="segment-minutes"
                    type="number"
                    min={1}
                    className="mt-1.5 max-w-[160px]"
                    value={segmentMinutes}
                    onChange={(e) => setSegmentMinutes(Math.max(1, Number(e.target.value) || 1))}
                  />
                </div>

                {plan.length > 0 && (
                  <div className="rounded-lg border border-border bg-card p-4">
                    <p className="mb-2 text-sm font-medium">
                      Akan menghasilkan {plan.length} file:
                    </p>
                    <ul className="flex flex-col gap-1 text-sm text-muted-foreground">
                      {plan.map((seg) => (
                        <li key={seg.index}>
                          Bagian {seg.index} — {formatDuration(seg.durationSec)}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <InfoBanner message="Diproses 100% di browser (tidak diunggah ke mana pun) pakai ffmpeg.wasm. Tiap bagian dipotong langsung dari file asli tanpa decode/re-encode ulang — format, codec, dan kualitas tetap sama persis seperti sumbernya, dan tidak ada batas durasi praktis karena file tidak pernah dimuat penuh sebagai audio mentah ke memori." />

                <Button size="lg" disabled={plan.length === 0} onClick={handleSplit} className="self-start">
                  <AudioWaveform className="h-4 w-4" />
                  Split Audio
                </Button>
              </>
            )
          )}
        </div>
      )}
    </div>
  );
}
