/**
 * Stage 5 verification — playback scheduling + transport.
 * Run: npx -y tsx scripts/test-playback-engine.ts
 *
 * Covers the pure scheduler and the headless PlaybackController (driven with an
 * injected clock so time advances deterministically). The DOM adapter
 * (player.ts) is a thin reconciler over this and is exercised in the browser.
 */

import {
  clipAt,
  nextClip,
  sourceTimeAt,
  fadeGainAt,
  effectiveGain,
  scheduleFrame,
  needsResync,
  PlaybackController,
  PlaybackFrame,
} from "../lib/editor/playback";
import { EditorEngine } from "../lib/editor/engine";
import { createEmptyDoc } from "../lib/editor/types";

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
function near(a: number, b: number, eps = 1e-6) {
  assert(Math.abs(a - b) < eps, `expected ${a} ≈ ${b}`);
}

/** Base video clip 0–10, overlay logo 2–7, bgm 0–8 @0.2. */
function scene() {
  const e = new EditorEngine(createEmptyDoc());
  const doc = e.getDoc();
  const vTrack = doc.tracks[0].id;
  const aTrack = doc.tracks[1].id;
  const a = e.addAsset({ kind: "video", url: "https://cdn/a.mp4", duration: 10 });
  const logo = e.addAsset({ kind: "image", url: "https://cdn/logo.png" });
  const song = e.addAsset({ kind: "audio", url: "https://cdn/song.mp3", duration: 60 });
  e.insertClip(vTrack, { assetId: a, start: 0 });
  const ovTrack = e.addTrack("video", "Overlay");
  e.insertClip(ovTrack, { assetId: logo, start: 2, duration: 5 });
  e.insertClip(aTrack, { assetId: song, start: 0, duration: 8, volume: 0.2 });
  return { engine: e, doc: e.getDoc(), vTrack, aTrack, ovTrack };
}

// ── Lookups ──────────────────────────────────────────────────────────────────

test("clipAt / nextClip find the right clips", () => {
  const { doc } = scene();
  const base = doc.tracks[0];
  assert(clipAt(base, 5)?.id === base.clips[0].id, "clip covers t=5");
  assert(clipAt(base, 10) === null, "end is exclusive");
  const ov = doc.tracks.find((t) => t.name === "Overlay")!;
  assert(clipAt(ov, 0) === null, "overlay not yet active");
  assert(nextClip(ov, 0)?.start === 2, "next overlay starts at 2");
});

test("sourceTimeAt accounts for speed", () => {
  const e = new EditorEngine(createEmptyDoc());
  const v = e.getDoc().tracks[0].id;
  const a = e.addAsset({ kind: "video", url: "https://cdn/a.mp4", duration: 20 });
  const id = e.insertClip(v, { assetId: a, start: 4, srcIn: 3 });
  e.setClipSpeed(id, 2);
  const clip = e.findClip(id)!.clip;
  near(sourceTimeAt(clip, 4, false), 3); // at clip start → srcIn
  near(sourceTimeAt(clip, 6, false), 7); // +2s timeline × 2 speed = +4 source
});

// ── Fades & gain ───────────────────────────────────────────────────────────

test("fadeGainAt ramps in and out linearly", () => {
  const e = new EditorEngine(createEmptyDoc());
  const v = e.getDoc().tracks[0].id;
  const a = e.addAsset({ kind: "video", url: "https://cdn/a.mp4", duration: 10 });
  const id = e.insertClip(v, { assetId: a, start: 0 });
  e.setClipProps(id, { fadeIn: 2, fadeOut: 4 });
  const clip = e.findClip(id)!.clip;
  near(fadeGainAt(clip, 1), 0.5);
  near(fadeGainAt(clip, 5), 1);
  near(fadeGainAt(clip, 8), 0.5); // 2s from end within a 4s fadeout
});

test("effectiveGain multiplies track, clip, and fade; mute zeroes it", () => {
  const e = new EditorEngine(createEmptyDoc());
  const v = e.getDoc().tracks[0].id;
  e.setTrackProps(v, { volume: 0.5 });
  const a = e.addAsset({ kind: "video", url: "https://cdn/a.mp4", duration: 10 });
  const id = e.insertClip(v, { assetId: a, start: 0, volume: 0.8 });
  const track = e.getTrack(v)!;
  near(effectiveGain(track, e.findClip(id)!.clip, 5), 0.4);
  e.setClipProps(id, { muted: true });
  near(effectiveGain(track, e.findClip(id)!.clip, 5), 0);
});

// ── scheduleFrame ────────────────────────────────────────────────────────────

test("scheduleFrame stacks video layers bottom→top with correct modes", () => {
  const { doc } = scene();
  const frame = scheduleFrame(doc, 5, true);
  assert(frame.video.length === 2, "base + overlay");
  assert(frame.video[0].mode === "base" && frame.video[0].z === 0, "base at z0");
  assert(frame.video[1].mode === "overlay" && frame.video[1].z === 1, "overlay at z1");
  assert(frame.video[0].clipId && frame.video[1].clipId, "both active at t=5");
});

test("scheduleFrame reports empty layers over gaps and past clips", () => {
  const { doc } = scene();
  const frame = scheduleFrame(doc, 8.5, false);
  assert(frame.video[0].clipId !== null, "base still active at 8.5");
  assert(frame.video[1].clipId === null, "overlay ended by 8.5");
  assert(frame.video[1].next === undefined, "no further overlay clip");
});

test("scheduleFrame mixes video-embedded audio and audio-track clips", () => {
  const { doc } = scene();
  const frame = scheduleFrame(doc, 5, true);
  assert(frame.audio.length === 2, `two voices, got ${frame.audio.length}`);
  const song = frame.audio.find((v) => v.url.includes("song.mp3"))!;
  assert(song && song.gain === 0.2, "bgm gain 0.2");
  assert(frame.audio.every((v) => v.trackId), "voices carry trackId");
});

test("scheduleFrame drops audio once a clip ends", () => {
  const { doc } = scene();
  const frame = scheduleFrame(doc, 9, false); // song ended at 8
  assert(frame.audio.length === 1, "only base video audio remains");
  assert(frame.audio[0].url.includes("a.mp4"), "the video clip's audio");
});

test("scheduleFrame provides a preroll hint for the next clip", () => {
  const e = new EditorEngine(createEmptyDoc());
  const v = e.getDoc().tracks[0].id;
  const a = e.addAsset({ kind: "video", url: "https://cdn/a.mp4", duration: 5 });
  const b = e.addAsset({ kind: "video", url: "https://cdn/b.mp4", duration: 5 });
  e.insertClip(v, { assetId: a, start: 0, duration: 5 });
  e.insertClip(v, { assetId: b, start: 5, duration: 5 });
  const frame = scheduleFrame(e.getDoc(), 2, true);
  assert(frame.video[0].next?.url.includes("b.mp4"), "next clip hinted");
  near(frame.video[0].next!.startsAt, 5);
});

test("needsResync respects the threshold", () => {
  assert(needsResync(5, 5.5, 0.25), "0.5 drift resyncs");
  assert(!needsResync(5, 5.1, 0.25), "0.1 drift tolerated");
});

// ── Transport controller (deterministic clock) ───────────────────────────────

test("controller advances time by wall-clock delta while playing", () => {
  const { doc } = scene();
  const c = new PlaybackController(doc);
  c.seek(0);
  c.play();
  c.tick(1000); // baseline
  near(c.getTime(), 0);
  c.tick(2000); // +1s
  near(c.getTime(), 1);
  c.tick(2500); // +0.5s
  near(c.getTime(), 1.5);
});

test("controller pause freezes the playhead", () => {
  const { doc } = scene();
  const c = new PlaybackController(doc);
  c.seek(3);
  c.play();
  c.tick(1000);
  c.tick(2000);
  near(c.getTime(), 4);
  c.pause();
  c.tick(9000);
  near(c.getTime(), 4);
});

test("controller clamps and stops at the end", () => {
  const { doc } = scene();
  const c = new PlaybackController(doc);
  c.seek(9.5);
  c.play();
  c.tick(1000);
  c.tick(2000); // +1s → 10.5, clamps to 10 and stops
  near(c.getTime(), 10);
  assert(!c.isPlaying(), "stopped at end");
});

test("controller loops when enabled", () => {
  const { doc } = scene();
  const c = new PlaybackController(doc, { loop: true });
  c.seek(9.5);
  c.play();
  c.tick(1000);
  c.tick(2000); // 10.5 → wraps to 0.5
  near(c.getTime(), 0.5);
  assert(c.isPlaying(), "still playing after loop");
});

test("controller emits a frame to new subscribers immediately", () => {
  const { doc } = scene();
  const c = new PlaybackController(doc);
  c.seek(5);
  let latest: PlaybackFrame | null = null;
  c.subscribe((f) => (latest = f));
  assert(latest !== null, "got initial frame");
  assert((latest as any).video.length === 2, "frame reflects current time");
});

test("play() from the end restarts from zero", () => {
  const { doc } = scene();
  const c = new PlaybackController(doc);
  c.seek(10);
  c.play();
  near(c.getTime(), 0);
  assert(c.isPlaying(), "playing from top");
});

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length > 0) process.exit(1);
