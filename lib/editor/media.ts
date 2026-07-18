/**
 * Optiq Editor Engine — media intelligence (pure core).
 *
 * Framework-free helpers for probing media and preparing the two artifacts the
 * timeline needs: filmstrip sprite sheets (video thumbnails) and waveform peak
 * arrays (audio envelopes). Nothing here touches ffmpeg, the filesystem, or the
 * network — it parses ffprobe output, plans ffmpeg commands, and downsamples
 * raw samples. The server (functions/mediaProbe.js) mirrors this and executes
 * it; scripts/test-render-parity-media.ts keeps the two in lockstep.
 */

import { AssetKind } from "./types";

const IMAGE_CODECS = new Set([
  "png",
  "mjpeg",
  "jpeg",
  "jpg",
  "bmp",
  "gif",
  "webp",
  "tiff",
  "apng",
]);

export interface MediaMeta {
  kind: AssetKind;
  /** Seconds; undefined for still images. */
  duration?: number;
  width?: number;
  height?: number;
  fps?: number;
  hasVideo: boolean;
  hasAudio: boolean;
}

/** Parse a rational like "30000/1001" or "25" into a number, or undefined. */
export function parseRational(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (trimmed === "" || trimmed === "0/0" || trimmed === "N/A") return undefined;
  const slash = trimmed.indexOf("/");
  if (slash === -1) {
    const n = Number(trimmed);
    return Number.isFinite(n) ? n : undefined;
  }
  const num = Number(trimmed.slice(0, slash));
  const den = Number(trimmed.slice(slash + 1));
  if (!Number.isFinite(num) || !Number.isFinite(den) || den === 0) return undefined;
  return num / den;
}

/** ffprobe argument vector for `-show_format -show_streams` JSON output. */
export function buildProbeArgs(inputPath: string): string[] {
  return ["-v", "error", "-print_format", "json", "-show_format", "-show_streams", inputPath];
}

/**
 * Turn ffprobe's parsed JSON into a MediaMeta. `hint` disambiguates the
 * still-image case (a PNG is a 1-frame "video" stream to ffprobe).
 */
export function parseProbe(probe: any, hint?: AssetKind): MediaMeta {
  const streams: any[] = Array.isArray(probe?.streams) ? probe.streams : [];
  const videoStream = streams.find((s) => s?.codec_type === "video");
  const audioStream = streams.find((s) => s?.codec_type === "audio");
  const hasVideo = !!videoStream;
  const hasAudio = !!audioStream;

  const formatDuration = parseRational(probe?.format?.duration);
  const streamDuration = parseRational(videoStream?.duration ?? audioStream?.duration);
  const duration = formatDuration ?? streamDuration;

  const width = videoStream?.width ? Number(videoStream.width) : undefined;
  const height = videoStream?.height ? Number(videoStream.height) : undefined;
  const fps = parseRational(videoStream?.avg_frame_rate ?? videoStream?.r_frame_rate);

  let kind: AssetKind;
  if (hint) {
    kind = hint;
  } else if (hasVideo && !hasAudio && isStillLike(videoStream, duration)) {
    kind = "image";
  } else if (hasVideo) {
    kind = "video";
  } else {
    kind = "audio";
  }

  return {
    kind,
    duration: kind === "image" ? undefined : duration,
    width,
    height,
    fps: kind === "image" ? undefined : fps,
    hasVideo,
    hasAudio,
  };
}

function isStillLike(videoStream: any, duration: number | undefined): boolean {
  const codec = String(videoStream?.codec_name ?? "").toLowerCase();
  if (IMAGE_CODECS.has(codec)) return true;
  // No timing information at all → treat as a still.
  return duration === undefined && !videoStream?.nb_frames;
}

// ── Filmstrip planning ──────────────────────────────────────────────────────

export interface FilmstripOptions {
  /** Target thumbnail width in px. */
  thumbWidth?: number;
  /** Desired seconds between thumbnails. */
  intervalSec?: number;
  /** Hard cap on total thumbnails. */
  maxFrames?: number;
  /** Sprite-sheet columns. */
  cols?: number;
}

export interface FilmstripPlan {
  frameCount: number;
  /** ffmpeg fps-filter rate that yields `frameCount` frames. */
  fps: number;
  /** Actual seconds between thumbnails. */
  interval: number;
  thumbWidth: number;
  thumbHeight: number;
  cols: number;
  rows: number;
}

function clampInt(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, Math.round(v)));
}

/** Plan a sprite sheet for a video's duration. Requires meta.duration > 0. */
export function planFilmstrip(meta: MediaMeta, opts: FilmstripOptions = {}): FilmstripPlan {
  const duration = meta.duration;
  if (!duration || duration <= 0) throw new Error("planFilmstrip needs a positive duration");
  const interval = opts.intervalSec ?? 1;
  const maxFrames = opts.maxFrames ?? 60;
  const frameCount = clampInt(duration / interval, 1, maxFrames);
  const actualInterval = duration / frameCount;
  const fps = round(frameCount / duration);

  const thumbWidth = opts.thumbWidth ?? 160;
  const aspect =
    meta.width && meta.height ? meta.height / meta.width : 9 / 16;
  // Force even height (yuv420 / most encoders require it).
  const thumbHeight = Math.max(2, Math.round((thumbWidth * aspect) / 2) * 2);

  const cols = Math.min(frameCount, opts.cols ?? 10);
  const rows = Math.ceil(frameCount / cols);

  return { frameCount, fps, interval: round(actualInterval), thumbWidth, thumbHeight, cols, rows };
}

/** ffmpeg args producing one sprite-sheet JPEG at `outPath`. */
export function buildFilmstripArgs(inputPath: string, plan: FilmstripPlan, outPath: string): string[] {
  const vf =
    `fps=${plan.fps},scale=${plan.thumbWidth}:${plan.thumbHeight},` +
    `tile=${plan.cols}x${plan.rows}`;
  return ["-y", "-i", inputPath, "-frames:v", "1", "-vf", vf, "-q:v", "4", outPath];
}

// ── Waveform peaks ──────────────────────────────────────────────────────────

/** ffmpeg args extracting mono signed-16 PCM at `sampleRate` to `outPath`. */
export function buildPcmArgs(inputPath: string, outPath: string, sampleRate = 8000): string[] {
  return [
    "-y",
    "-i",
    inputPath,
    "-vn",
    "-ac",
    "1",
    "-ar",
    String(sampleRate),
    "-f",
    "s16le",
    "-acodec",
    "pcm_s16le",
    outPath,
  ];
}

/**
 * Reduce a sample sequence to `buckets` peak magnitudes (max |sample| per
 * bucket). Generic over the sample scale; returns raw magnitudes.
 */
export function downsamplePeaks(samples: ArrayLike<number>, buckets: number): number[] {
  const n = samples.length;
  if (buckets <= 0 || n === 0) return [];
  const peaks = new Array<number>(buckets).fill(0);
  const per = n / buckets;
  for (let b = 0; b < buckets; b++) {
    const start = Math.floor(b * per);
    const end = Math.min(n, Math.floor((b + 1) * per));
    let max = 0;
    for (let i = start; i < end; i++) {
      const a = samples[i] < 0 ? -samples[i] : samples[i];
      if (a > max) max = a;
    }
    peaks[b] = max;
  }
  return peaks;
}

export interface Waveform {
  buckets: number;
  /** Normalized 0..1 peak magnitudes, 3-decimal rounded. */
  peaks: number[];
}

/** Downsample signed-16 samples to a normalized 0..1 waveform. */
export function computeWaveform(int16Samples: ArrayLike<number>, buckets: number): Waveform {
  const raw = downsamplePeaks(int16Samples, buckets);
  const peaks = raw.map((v) => round3(Math.min(1, v / 32768)));
  return { buckets: peaks.length, peaks };
}

/**
 * Read a little-endian signed-16 PCM buffer into a waveform. Accepts a
 * Uint8Array/Buffer of raw bytes (length is floored to a whole sample count).
 */
export function waveformFromInt16LE(bytes: Uint8Array, buckets: number): Waveform {
  const sampleCount = bytes.length >> 1;
  const samples = new Int16Array(sampleCount);
  for (let i = 0; i < sampleCount; i++) {
    const lo = bytes[i * 2];
    const hi = bytes[i * 2 + 1];
    samples[i] = (hi << 8) | lo; // Int16Array assignment sign-extends
  }
  return computeWaveform(samples, buckets);
}

function round(v: number): number {
  return Math.round(v * 1e6) / 1e6;
}

function round3(v: number): number {
  return Math.round(v * 1000) / 1000;
}
