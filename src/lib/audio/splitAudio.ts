"use client";

import { Mp3Encoder } from "@breezystack/lamejs";
import JSZip from "jszip";

// MPEG-1 Layer III requires samples to be fed in fixed-size blocks.
const SAMPLE_BLOCK_SIZE = 1152;
const MP3_BITRATE_KBPS = 128;
// lamejs' Mp3Encoder only supports mono or stereo; anything beyond that
// (rare multichannel recordings) is downmixed to the first two channels.
const MAX_ENCODER_CHANNELS = 2;

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

/** Decode an uploaded audio file into a raw AudioBuffer via the Web Audio API. */
export async function decodeAudioFile(file: File): Promise<AudioBuffer> {
  const arrayBuffer = await file.arrayBuffer();
  const AudioContextCtor =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const audioContext = new AudioContextCtor();
  try {
    return await audioContext.decodeAudioData(arrayBuffer);
  } catch (err) {
    const detail = err instanceof DOMException ? `${err.name}: ${err.message}` : String(err);
    throw new Error(detail);
  } finally {
    await audioContext.close();
  }
}

function floatTo16BitPCM(input: Float32Array): Int16Array {
  const output = new Int16Array(input.length);
  for (let i = 0; i < input.length; i++) {
    const s = Math.max(-1, Math.min(1, input[i]));
    output[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return output;
}

function encodeSegmentToMp3(channelData: Float32Array[], sampleRate: number): Uint8Array {
  const channels = Math.min(channelData.length, MAX_ENCODER_CHANNELS);
  const encoder = new Mp3Encoder(channels, sampleRate, MP3_BITRATE_KBPS);
  const pcm = channelData.slice(0, channels).map(floatTo16BitPCM);
  const chunks: Uint8Array[] = [];
  const length = pcm[0]?.length ?? 0;

  for (let i = 0; i < length; i += SAMPLE_BLOCK_SIZE) {
    const left = pcm[0].subarray(i, i + SAMPLE_BLOCK_SIZE);
    const right = channels > 1 ? pcm[1].subarray(i, i + SAMPLE_BLOCK_SIZE) : undefined;
    const encoded = encoder.encodeBuffer(left, right);
    if (encoded.length > 0) chunks.push(encoded);
  }
  const final = encoder.flush();
  if (final.length > 0) chunks.push(final);

  const totalLength = chunks.reduce((sum, c) => sum + c.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}

export interface AudioSegmentFile {
  fileName: string;
  bytes: Uint8Array;
  durationSec: number;
}

/** Slice a decoded AudioBuffer according to `plan` and re-encode each piece as a standalone MP3. */
export async function splitAudioBuffer(
  audioBuffer: AudioBuffer,
  plan: SegmentPlan[],
  baseName: string,
  onProgress?: (done: number, total: number) => void
): Promise<AudioSegmentFile[]> {
  const sampleRate = audioBuffer.sampleRate;
  const results: AudioSegmentFile[] = [];

  for (const segment of plan) {
    const startSample = Math.floor(segment.startSec * sampleRate);
    const endSample = Math.min(Math.floor(segment.endSec * sampleRate), audioBuffer.length);

    const channelData: Float32Array[] = [];
    for (let ch = 0; ch < audioBuffer.numberOfChannels; ch++) {
      channelData.push(audioBuffer.getChannelData(ch).slice(startSample, endSample));
    }

    const bytes = encodeSegmentToMp3(channelData, sampleRate);
    const partLabel = String(segment.index).padStart(2, "0");
    results.push({ fileName: `${baseName}_part${partLabel}.mp3`, bytes, durationSec: segment.durationSec });

    onProgress?.(segment.index, plan.length);
    // Yield to the event loop between segments so the progress bar can repaint.
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  return results;
}

/** Bundle multiple split segments into a single downloadable .zip. */
export async function zipAudioSegments(segments: AudioSegmentFile[], zipName: string) {
  const zip = new JSZip();
  segments.forEach((s) => zip.file(s.fileName, s.bytes));
  const bytes = await zip.generateAsync({ type: "uint8array" });
  return { fileName: zipName, bytes };
}
