/**
 * Stage 4 verification — media intelligence.
 * Run: npx -y tsx scripts/test-media-engine.ts
 *
 * Unit-tests the pure helpers in lib/editor/media.ts and proves the
 * functions/mediaProbe.js CJS port produces identical output.
 */

import { createRequire } from "node:module";
import {
  parseRational,
  parseProbe,
  planFilmstrip,
  buildFilmstripArgs,
  buildProbeArgs,
  buildPcmArgs,
  downsamplePeaks,
  computeWaveform,
  waveformFromInt16LE,
  MediaMeta,
} from "../lib/editor";

const require_ = createRequire(import.meta.url);
const server = require_("../functions/mediaProbe.js");

let passed = 0;
const failures: string[] = [];

function test(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`  ok  ${name}`);
  } catch (err: any) {
    failures.push(name);
    console.error(`FAIL  ${name}\n      ${err?.message ?? err}`);
  }
}
function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}
function near(a: number | undefined, b: number, eps = 1e-3) {
  assert(a !== undefined && Math.abs(a - b) < eps, `expected ${a} ≈ ${b}`);
}
function eq(a: unknown, b: unknown, msg: string) {
  assert(JSON.stringify(a) === JSON.stringify(b), `${msg}\n  a=${JSON.stringify(a)}\n  b=${JSON.stringify(b)}`);
}

// ── Fixtures ────────────────────────────────────────────────────────────────

const videoProbe = {
  format: { duration: "12.500000" },
  streams: [
    { codec_type: "video", codec_name: "h264", width: 1920, height: 1080, r_frame_rate: "30000/1001", avg_frame_rate: "30000/1001" },
    { codec_type: "audio", codec_name: "aac" },
  ],
};
const audioProbe = {
  format: { duration: "183.4" },
  streams: [{ codec_type: "audio", codec_name: "mp3", duration: "183.4" }],
};
const imageProbe = {
  format: {},
  streams: [{ codec_type: "video", codec_name: "png", width: 800, height: 600 }],
};

// ── parseRational ─────────────────────────────────────────────────────────────

test("parseRational handles fractions, ints, and junk", () => {
  near(parseRational("30000/1001"), 29.97002997);
  near(parseRational("25"), 25);
  assert(parseRational("0/0") === undefined, "0/0 → undefined");
  assert(parseRational("N/A") === undefined, "N/A → undefined");
  assert(parseRational(undefined) === undefined, "undefined → undefined");
  near(parseRational(48000), 48000);
});

// ── parseProbe ────────────────────────────────────────────────────────────────

test("parseProbe classifies a video with audio", () => {
  const m = parseProbe(videoProbe);
  assert(m.kind === "video", "kind video");
  near(m.duration, 12.5);
  assert(m.width === 1920 && m.height === 1080, "dims");
  near(m.fps, 29.97, 0.01);
  assert(m.hasAudio && m.hasVideo, "streams");
});

test("parseProbe classifies audio-only", () => {
  const m = parseProbe(audioProbe);
  assert(m.kind === "audio", "kind audio");
  near(m.duration, 183.4);
  assert(!m.hasVideo && m.hasAudio, "streams");
});

test("parseProbe classifies a still image and nulls its duration", () => {
  const m = parseProbe(imageProbe);
  assert(m.kind === "image", "kind image");
  assert(m.duration === undefined, "no duration for image");
  assert(m.width === 800 && m.height === 600, "dims");
});

test("parseProbe honors an explicit kind hint", () => {
  const m = parseProbe(videoProbe, "audio");
  assert(m.kind === "audio", "hint wins");
});

// ── planFilmstrip ─────────────────────────────────────────────────────────────

test("planFilmstrip lays out a sprite grid for a 30s clip", () => {
  const meta: MediaMeta = { kind: "video", duration: 30, width: 1920, height: 1080, hasVideo: true, hasAudio: true };
  const plan = planFilmstrip(meta);
  assert(plan.frameCount === 30, `30 frames, got ${plan.frameCount}`);
  assert(plan.cols === 10 && plan.rows === 3, "10x3 grid");
  near(plan.fps, 1);
  assert(plan.thumbHeight % 2 === 0, "even height");
  near(plan.thumbHeight, 90); // 160 * 1080/1920 = 90
});

test("planFilmstrip caps frame count for long media", () => {
  const meta: MediaMeta = { kind: "video", duration: 600, hasVideo: true, hasAudio: false };
  const plan = planFilmstrip(meta, { maxFrames: 60, intervalSec: 1 });
  assert(plan.frameCount === 60, "capped at 60");
  near(plan.interval, 10);
});

test("planFilmstrip rejects zero duration", () => {
  let threw = false;
  try {
    planFilmstrip({ kind: "video", duration: 0, hasVideo: true, hasAudio: false });
  } catch {
    threw = true;
  }
  assert(threw, "expected throw");
});

// ── ffmpeg arg builders ───────────────────────────────────────────────────────

test("buildProbeArgs / buildPcmArgs shapes are stable", () => {
  eq(buildProbeArgs("in.mp4"),
    ["-v", "error", "-print_format", "json", "-show_format", "-show_streams", "in.mp4"],
    "probe args");
  eq(buildPcmArgs("in.mp4", "out.pcm"),
    ["-y", "-i", "in.mp4", "-vn", "-ac", "1", "-ar", "8000", "-f", "s16le", "-acodec", "pcm_s16le", "out.pcm"],
    "pcm args");
});

test("buildFilmstripArgs emits an fps,scale,tile filter", () => {
  const meta: MediaMeta = { kind: "video", duration: 30, width: 1920, height: 1080, hasVideo: true, hasAudio: false };
  const args = buildFilmstripArgs("in.mp4", planFilmstrip(meta), "out.jpg");
  const vfIdx = args.indexOf("-vf");
  assert(vfIdx !== -1, "has -vf");
  const vf = args[vfIdx + 1];
  assert(vf.includes("fps=1") && vf.includes("scale=160:90") && vf.includes("tile=10x3"), `vf=${vf}`);
});

// ── Waveform ──────────────────────────────────────────────────────────────────

test("downsamplePeaks takes max magnitude per bucket", () => {
  eq(downsamplePeaks([0, 3, -5, 1, 2, -9], 3), [3, 5, 9], "peaks");
  eq(downsamplePeaks([], 4), [], "empty");
});

test("computeWaveform normalizes int16 to 0..1", () => {
  const wf = computeWaveform([0, 16384, -32768, 8192], 2);
  eq(wf.peaks, [0.5, 1], "normalized peaks");
  assert(wf.buckets === 2, "bucket count");
});

test("waveformFromInt16LE decodes little-endian bytes", () => {
  const samples = [0, 16384, -32768, 8192];
  const bytes = new Uint8Array(samples.length * 2);
  const dv = new DataView(bytes.buffer);
  samples.forEach((s, i) => dv.setInt16(i * 2, s, true));
  const wf = waveformFromInt16LE(bytes, 2);
  eq(wf.peaks, [0.5, 1], "decoded peaks");
});

// ── Parity: TS vs CJS server port ─────────────────────────────────────────────

test("parity: parseProbe", () => {
  for (const p of [videoProbe, audioProbe, imageProbe]) {
    eq(parseProbe(p), server.parseProbe(p), "parseProbe differs");
  }
  eq(parseProbe(videoProbe, "audio"), server.parseProbe(videoProbe, "audio"), "hinted differs");
});

test("parity: planFilmstrip + buildFilmstripArgs", () => {
  const metas: MediaMeta[] = [
    { kind: "video", duration: 30, width: 1920, height: 1080, hasVideo: true, hasAudio: true },
    { kind: "video", duration: 7.3, width: 1080, height: 1920, hasVideo: true, hasAudio: false },
    { kind: "video", duration: 600, hasVideo: true, hasAudio: false },
  ];
  for (const m of metas) {
    eq(planFilmstrip(m), server.planFilmstrip(m), "plan differs");
    const plan = planFilmstrip(m);
    eq(buildFilmstripArgs("in.mp4", plan, "o.jpg"), server.buildFilmstripArgs("in.mp4", plan, "o.jpg"), "args differ");
  }
});

test("parity: pcm args + waveform math", () => {
  eq(buildPcmArgs("in.mp4", "o.pcm", 8000), server.buildPcmArgs("in.mp4", "o.pcm", 8000), "pcm args differ");
  const samples = Array.from({ length: 5000 }, (_, i) => Math.round(30000 * Math.sin(i / 7)));
  eq(computeWaveform(samples, 300), server.computeWaveform(samples, 300), "waveform differs");
});

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length > 0) process.exit(1);
