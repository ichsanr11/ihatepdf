"use client";

import { FFmpeg } from "@ffmpeg/ffmpeg";
import JSZip from "jszip";

export interface SegmentPlan {
  index: number;
  startSec: number;
  endSec: number;
  durationSec: number;
}

/** Pure math: how many parts a given total duration splits into at a given segment length. */
export function computeSegmentPlan(totalDurationSec: number, segmentMinutes: number): SegmentPlan[] {
  const segmentSec = segmentMinutes * 60;
  if (!(segmentSec > 0) || !(totalDurationSec > 0)) return [];

  const plan: SegmentPlan[] = [];
  let start = 0;
  let index = 1;
  while (start < totalDurationSec - 0.001) {
    const end = Math.min(start + segmentSec, totalDurationSec);
    plan.push({ index, startSec: start, endSec: end, durationSec: end - start });
    start = end;
    index++;
  }
  return plan;
}

export function formatDuration(totalSeconds: number): string {
  const s = Math.round(totalSeconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(sec).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${m}:${ss}`;
}

const MIME_BY_EXT: Record<string, string> = {
  mp3: "audio/mpeg",
  m4a: "audio/mp4",
  wav: "audio/wav",
  ogg: "audio/ogg",
  oga: "audio/ogg",
  flac: "audio/flac",
  aac: "audio/aac",
  webm: "audio/webm",
};

export function mimeTypeForFileName(fileName: string): string {
  const ext = fileName.slice(fileName.lastIndexOf(".") + 1).toLowerCase();
  return MIME_BY_EXT[ext] ?? "application/octet-stream";
}

function extensionOf(fileName: string): string {
  const i = fileName.lastIndexOf(".");
  return i >= 0 ? fileName.slice(i) : ".mp3";
}

// Single-threaded ffmpeg.wasm core, self-hosted (see scripts/copy-ffmpeg-assets.mjs)
// — no SharedArrayBuffer/COOP/COEP needed, unlike the multi-threaded core.
const CORE_URL = "/ffmpeg/ffmpeg-core.js";
const WASM_URL = "/ffmpeg/ffmpeg-core.wasm";

let ffmpegSingleton: FFmpeg | null = null;
let loadPromise: Promise<FFmpeg> | null = null;

/**
 * Lazily load (and cache) the shared ffmpeg.wasm instance. Loading fetches
 * and instantiates a ~32MB WASM module, so it only happens once per page
 * session regardless of how many files get split afterwards.
 */
async function getFFmpeg(): Promise<FFmpeg> {
  if (ffmpegSingleton?.loaded) return ffmpegSingleton;
  if (!loadPromise) {
    loadPromise = (async () => {
      const ffmpeg = new FFmpeg();
      await ffmpeg.load({ coreURL: CORE_URL, wasmURL: WASM_URL });
      ffmpegSingleton = ffmpeg;
      return ffmpeg;
    })();
  }
  return loadPromise;
}

/**
 * Read an audio file's duration via ffprobe (bundled in ffmpeg.wasm's core)
 * without decoding any of its actual audio data — cheap and memory-light
 * regardless of file length, unlike Web Audio's decodeAudioData.
 */
export async function probeDurationSec(file: File): Promise<number> {
  const ffmpeg = await getFFmpeg();
  const inputName = `probe_input${extensionOf(file.name)}`;
  const outputName = "probe_output.txt";

  await ffmpeg.writeFile(inputName, new Uint8Array(await file.arrayBuffer()));
  try {
    await ffmpeg.ffprobe([
      "-v",
      "error",
      "-show_entries",
      "format=duration",
      "-of",
      "default=noprint_wrappers=1:nokey=1",
      inputName,
      "-o",
      outputName,
    ]);
    const text = await ffmpeg.readFile(outputName, "utf8");
    const duration = parseFloat(typeof text === "string" ? text : new TextDecoder().decode(text));
    if (!(duration > 0)) {
      throw new Error("Durasi tidak terbaca dari file ini.");
    }
    return duration;
  } finally {
    await ffmpeg.deleteFile(inputName).catch(() => {});
    await ffmpeg.deleteFile(outputName).catch(() => {});
  }
}

export interface AudioSegmentFile {
  fileName: string;
  bytes: Uint8Array;
  durationSec: number;
}

/**
 * Cut `file` into segments per `plan` by remuxing (stream copy, no decode/
 * re-encode) — each cut only ever holds the original compressed file plus
 * one segment's worth of output in memory, never the fully decoded audio.
 * Keeps the original codec/container/quality intact.
 */
export async function splitAudioFile(
  file: File,
  plan: SegmentPlan[],
  onProgress?: (done: number, total: number) => void
): Promise<AudioSegmentFile[]> {
  const ffmpeg = await getFFmpeg();
  const ext = extensionOf(file.name);
  const base = file.name.replace(/\.[^/.]+$/, "");
  const inputName = `input${ext}`;

  await ffmpeg.writeFile(inputName, new Uint8Array(await file.arrayBuffer()));

  try {
    const results: AudioSegmentFile[] = [];
    for (const segment of plan) {
      const outputName = `part${segment.index}${ext}`;
      await ffmpeg.exec([
        "-ss",
        segment.startSec.toFixed(3),
        "-t",
        segment.durationSec.toFixed(3),
        "-i",
        inputName,
        "-c",
        "copy",
        outputName,
      ]);
      const bytes = (await ffmpeg.readFile(outputName)) as Uint8Array;
      await ffmpeg.deleteFile(outputName).catch(() => {});

      const partLabel = String(segment.index).padStart(2, "0");
      results.push({ fileName: `${base}_part${partLabel}${ext}`, bytes, durationSec: segment.durationSec });
      onProgress?.(segment.index, plan.length);
    }
    return results;
  } finally {
    await ffmpeg.deleteFile(inputName).catch(() => {});
  }
}

/** Bundle multiple split segments into a single downloadable .zip. */
export async function zipAudioSegments(segments: AudioSegmentFile[], zipName: string) {
  const zip = new JSZip();
  segments.forEach((s) => zip.file(s.fileName, s.bytes));
  const bytes = await zip.generateAsync({ type: "uint8array" });
  return { fileName: zipName, bytes };
}
