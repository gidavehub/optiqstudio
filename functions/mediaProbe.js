/**
 * Optiq Editor Engine — media intelligence (server, CommonJS).
 *
 * Pure helpers are a line-for-line port of lib/editor/media.ts, kept in
 * lockstep by scripts/test-media-parity.ts. The `probeMedia` orchestrator runs
 * ffprobe/ffmpeg against a local file and returns metadata + artifact buffers
 * (sprite JPEG, waveform JSON) for the caller in functions/index.js to upload.
 */

"use strict";

const IMAGE_CODECS = new Set([
  "png", "mjpeg", "jpeg", "jpg", "bmp", "gif", "webp", "tiff", "apng",
]);

function parseRational(value) {
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

function buildProbeArgs(inputPath) {
  return ["-v", "error", "-print_format", "json", "-show_format", "-show_streams", inputPath];
}

function isStillLike(videoStream, duration) {
  const codec = String((videoStream && videoStream.codec_name) || "").toLowerCase();
  if (IMAGE_CODECS.has(codec)) return true;
  return duration === undefined && !(videoStream && videoStream.nb_frames);
}

function parseProbe(probe, hint) {
  const streams = probe && Array.isArray(probe.streams) ? probe.streams : [];
  const videoStream = streams.find((s) => s && s.codec_type === "video");
  const audioStream = streams.find((s) => s && s.codec_type === "audio");
  const hasVideo = !!videoStream;
  const hasAudio = !!audioStream;

  const formatDuration = parseRational(probe && probe.format && probe.format.duration);
  const streamDuration = parseRational(
    (videoStream && videoStream.duration) || (audioStream && audioStream.duration)
  );
  const duration = formatDuration !== undefined ? formatDuration : streamDuration;

  const width = videoStream && videoStream.width ? Number(videoStream.width) : undefined;
  const height = videoStream && videoStream.height ? Number(videoStream.height) : undefined;
  const fps = parseRational(
    videoStream && (videoStream.avg_frame_rate || videoStream.r_frame_rate)
  );

  let kind;
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

function clampInt(v, lo, hi) {
  return Math.max(lo, Math.min(hi, Math.round(v)));
}

function round(v) {
  return Math.round(v * 1e6) / 1e6;
}

function round3(v) {
  return Math.round(v * 1000) / 1000;
}

function planFilmstrip(meta, opts) {
  opts = opts || {};
  const duration = meta.duration;
  if (!duration || duration <= 0) throw new Error("planFilmstrip needs a positive duration");
  const interval = opts.intervalSec != null ? opts.intervalSec : 1;
  const maxFrames = opts.maxFrames != null ? opts.maxFrames : 60;
  const frameCount = clampInt(duration / interval, 1, maxFrames);
  const actualInterval = duration / frameCount;
  const fps = round(frameCount / duration);

  const thumbWidth = opts.thumbWidth != null ? opts.thumbWidth : 160;
  const aspect = meta.width && meta.height ? meta.height / meta.width : 9 / 16;
  const thumbHeight = Math.max(2, Math.round((thumbWidth * aspect) / 2) * 2);

  const cols = Math.min(frameCount, opts.cols != null ? opts.cols : 10);
  const rows = Math.ceil(frameCount / cols);

  return { frameCount, fps, interval: round(actualInterval), thumbWidth, thumbHeight, cols, rows };
}

function buildFilmstripArgs(inputPath, plan, outPath) {
  const vf =
    `fps=${plan.fps},scale=${plan.thumbWidth}:${plan.thumbHeight},` +
    `tile=${plan.cols}x${plan.rows}`;
  return ["-y", "-i", inputPath, "-frames:v", "1", "-vf", vf, "-q:v", "4", outPath];
}

function buildPcmArgs(inputPath, outPath, sampleRate) {
  sampleRate = sampleRate || 8000;
  return [
    "-y", "-i", inputPath, "-vn", "-ac", "1", "-ar", String(sampleRate),
    "-f", "s16le", "-acodec", "pcm_s16le", outPath,
  ];
}

function downsamplePeaks(samples, buckets) {
  const n = samples.length;
  if (buckets <= 0 || n === 0) return [];
  const peaks = new Array(buckets).fill(0);
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

function computeWaveform(int16Samples, buckets) {
  const raw = downsamplePeaks(int16Samples, buckets);
  const peaks = raw.map((v) => round3(Math.min(1, v / 32768)));
  return { buckets: peaks.length, peaks };
}

function waveformFromInt16LE(bytes, buckets) {
  const sampleCount = bytes.length >> 1;
  const samples = new Int16Array(sampleCount);
  for (let i = 0; i < sampleCount; i++) {
    const lo = bytes[i * 2];
    const hi = bytes[i * 2 + 1];
    samples[i] = (hi << 8) | lo;
  }
  return computeWaveform(samples, buckets);
}

// ── Orchestration ───────────────────────────────────────────────────────────

const DEFAULT_WAVEFORM_BUCKETS = 800;

function runCapture(cmd, args) {
  const { spawn } = require("child_process");
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderrTail = "";
    proc.stdout.on("data", (c) => { stdout += c.toString(); });
    proc.stderr.on("data", (c) => { stderrTail = (stderrTail + c.toString()).slice(-4000); });
    proc.on("error", (err) => reject(new Error(`${cmd} spawn failed: ${err.message}`)));
    proc.on("close", (code) => {
      if (code === 0) return resolve(stdout);
      reject(new Error(`${cmd} exited ${code}: ${stderrTail.slice(-600)}`));
    });
  });
}

/**
 * Probe a local media file and build its timeline artifacts.
 * Returns { meta, filmstrip?: {buffer, plan}, waveform?: {json} }.
 * ffprobe/ffmpeg must be on PATH. Caller handles download/upload.
 */
async function probeMedia(localPath, opts) {
  opts = opts || {};
  const fs = require("fs");
  const path = require("path");

  const probeJson = await runCapture("ffprobe", buildProbeArgs(localPath));
  let probe;
  try {
    probe = JSON.parse(probeJson);
  } catch (e) {
    throw new Error("ffprobe returned unparseable JSON");
  }
  const meta = parseProbe(probe, opts.hint);

  const result = { meta };
  const workDir = path.dirname(localPath);

  if (meta.kind === "video" && meta.duration && meta.duration > 0) {
    const plan = planFilmstrip(meta, opts.filmstrip);
    const spritePath = path.join(workDir, "filmstrip.jpg");
    await runCapture("ffmpeg", buildFilmstripArgs(localPath, plan, spritePath));
    result.filmstrip = { buffer: await fs.promises.readFile(spritePath), plan };
  }

  if (meta.hasAudio) {
    const pcmPath = path.join(workDir, "audio.pcm");
    await runCapture("ffmpeg", buildPcmArgs(localPath, pcmPath, 8000));
    const bytes = await fs.promises.readFile(pcmPath);
    const buckets = (opts.waveform && opts.waveform.buckets) || DEFAULT_WAVEFORM_BUCKETS;
    result.waveform = waveformFromInt16LE(bytes, buckets);
  }

  return result;
}

module.exports = {
  parseRational,
  buildProbeArgs,
  parseProbe,
  planFilmstrip,
  buildFilmstripArgs,
  buildPcmArgs,
  downsamplePeaks,
  computeWaveform,
  waveformFromInt16LE,
  probeMedia,
  DEFAULT_WAVEFORM_BUCKETS,
};
