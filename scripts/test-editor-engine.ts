/**
 * Editor engine test suite. Run: npx -y tsx scripts/test-editor-engine.ts
 * Exits non-zero on any failure. No framework — plain asserts.
 */

import {
  EditorEngine,
  createEmptyDoc,
  validateDoc,
  compileRenderJob,
  buildFfmpegPlan,
  atempoChain,
  docFromLegacyProject,
  clipEnd,
} from "../lib/editor";

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

function rig() {
  const engine = new EditorEngine(createEmptyDoc());
  const doc = engine.getDoc();
  const vTrack = doc.tracks.find((t) => t.kind === "video")!.id;
  const aTrack = doc.tracks.find((t) => t.kind === "audio")!.id;
  const clipA = engine.addAsset({ kind: "video", url: "https://cdn/a.mp4", duration: 10 });
  const clipB = engine.addAsset({ kind: "video", url: "https://cdn/b.mp4", duration: 10 });
  const song = engine.addAsset({ kind: "audio", url: "https://cdn/song.mp3", duration: 120 });
  const logo = engine.addAsset({ kind: "image", url: "https://cdn/logo.png" });
  return { engine, vTrack, aTrack, clipA, clipB, song, logo };
}

// ── Insertion & collision ────────────────────────────────────────────────────

test("insert defaults to full asset duration and updates doc duration", () => {
  const { engine, vTrack, clipA } = rig();
  engine.insertClip(vTrack, { assetId: clipA, start: 0 });
  near(engine.getDoc().duration, 10);
});

test("inserting into occupied space pushes later clips right", () => {
  const { engine, vTrack, clipA, clipB } = rig();
  engine.insertClip(vTrack, { assetId: clipA, start: 0 });
  engine.insertClip(vTrack, { assetId: clipB, start: 0, duration: 4 });
  const clips = engine.getDoc().tracks[0].clips;
  assert(clips.length === 2, "two clips");
  // New clip lands after the clip occupying t=0; nothing overlaps.
  near(clips[0].start, 0);
  near(clips[1].start, 10);
  validateDoc(engine.getDoc());
});

test("reject mode throws on overlap", () => {
  const { engine, vTrack, clipA, clipB } = rig();
  engine.insertClip(vTrack, { assetId: clipA, start: 0 });
  let threw = false;
  try {
    engine.insertClip(vTrack, { assetId: clipB, start: 5, duration: 3, overlap: "reject" });
  } catch {
    threw = true;
  }
  assert(threw, "expected reject");
});

test("image clips get a finite default duration", () => {
  const { engine, vTrack, logo } = rig();
  engine.insertClip(vTrack, { assetId: logo, start: 2 });
  const clip = engine.getDoc().tracks[0].clips[0];
  near(clip.duration, 3);
});

// ── Trim / split / ripple ────────────────────────────────────────────────────

test("trim start respects source availability", () => {
  const { engine, vTrack, clipA } = rig();
  const id = engine.insertClip(vTrack, { assetId: clipA, start: 5 });
  engine.trimClipStart(id, 0); // would need srcIn = -5 → clamps to start=5
  near(engine.getDoc().tracks[0].clips[0].start, 5);
});

test("trim start after pre-trim can extend back", () => {
  const { engine, vTrack, clipA } = rig();
  const id = engine.insertClip(vTrack, { assetId: clipA, start: 5, srcIn: 3, duration: 7 });
  engine.trimClipStart(id, 2); // clamp: only 3s of source headroom
  const clip = engine.getDoc().tracks[0].clips[0];
  near(clip.start, 2);
  near(clip.srcIn, 0);
  near(clip.duration, 10);
});

test("trim end clamps to source and neighbor", () => {
  const { engine, vTrack, clipA, clipB } = rig();
  const a = engine.insertClip(vTrack, { assetId: clipA, start: 0, duration: 6 });
  engine.insertClip(vTrack, { assetId: clipB, start: 8, duration: 2 });
  engine.trimClipEnd(a, 20); // neighbor at 8 wins
  near(clipEnd(engine.getDoc().tracks[0].clips[0]), 8);
});

test("split produces two contiguous clips with correct source windows", () => {
  const { engine, vTrack, clipA } = rig();
  const id = engine.insertClip(vTrack, { assetId: clipA, start: 0 });
  const rightId = engine.splitClipAt(id, 4);
  assert(rightId, "split returned id");
  const [left, right] = engine.getDoc().tracks[0].clips;
  near(left.duration, 4);
  near(right.start, 4);
  near(right.duration, 6);
  near(right.srcIn, 4);
  near(right.srcOut, 10);
  validateDoc(engine.getDoc());
});

test("ripple delete closes the gap", () => {
  const { engine, vTrack, clipA, clipB } = rig();
  const a = engine.insertClip(vTrack, { assetId: clipA, start: 0, duration: 5 });
  engine.insertClip(vTrack, { assetId: clipB, start: 5, duration: 5 });
  engine.removeClip(a, true);
  const clips = engine.getDoc().tracks[0].clips;
  assert(clips.length === 1, "one clip left");
  near(clips[0].start, 0);
});

// ── Speed ────────────────────────────────────────────────────────────────────

test("speed change stretches timeline duration, keeps source window", () => {
  const { engine, vTrack, clipA } = rig();
  const id = engine.insertClip(vTrack, { assetId: clipA, start: 0 });
  engine.setClipSpeed(id, 2);
  const clip = engine.getDoc().tracks[0].clips[0];
  near(clip.duration, 5);
  near(clip.srcOut - clip.srcIn, 10);
  validateDoc(engine.getDoc());
});

test("atempo chain covers extreme rates", () => {
  assert(atempoChain(1).length === 0, "unity is empty");
  assert(atempoChain(5).join(",") === "atempo=2.0,atempo=2.0,atempo=1.25", "5x chain");
  assert(atempoChain(0.25).join(",") === "atempo=0.5,atempo=0.5", "0.25x chain");
});

// ── History ──────────────────────────────────────────────────────────────────

test("undo/redo round-trips", () => {
  const { engine, vTrack, clipA } = rig();
  engine.insertClip(vTrack, { assetId: clipA, start: 0 });
  const withClip = engine.getDoc();
  assert(engine.undo(), "undo ok");
  assert(engine.getDoc().tracks[0].clips.length === 0, "clip gone");
  assert(engine.redo(), "redo ok");
  assert(engine.getDoc().tracks[0].clips.length === 1, "clip back");
  near(engine.getDoc().duration, withClip.duration);
});

test("transient drag collapses to one undo step", () => {
  const { engine, vTrack, clipA } = rig();
  const id = engine.insertClip(vTrack, { assetId: clipA, start: 0, duration: 4 });
  engine.beginTransient();
  for (let t = 1; t <= 20; t++) engine.moveClip(id, { start: t });
  engine.commitTransient();
  near(engine.getDoc().tracks[0].clips[0].start, 20);
  engine.undo(); // one undo reverts the whole drag
  near(engine.getDoc().tracks[0].clips[0].start, 0);
});

// ── Snapping ─────────────────────────────────────────────────────────────────

test("snapTime pulls to clip edges within threshold only", () => {
  const { engine, vTrack, clipA } = rig();
  engine.insertClip(vTrack, { assetId: clipA, start: 3, duration: 4 });
  near(engine.snapTime(6.9, { threshold: 0.2 }), 7);
  near(engine.snapTime(6.5, { threshold: 0.2 }), 6.5);
});

// ── EDL & ffmpeg plan ────────────────────────────────────────────────────────

test("render job fills gaps with black and orders segments", () => {
  const { engine, vTrack, clipA, clipB } = rig();
  engine.insertClip(vTrack, { assetId: clipA, start: 2, duration: 4 });
  engine.insertClip(vTrack, { assetId: clipB, start: 8, duration: 2 });
  const job = compileRenderJob(engine.getDoc());
  assert(job.base.length === 4, `expected 4 segments, got ${job.base.length}`);
  assert(job.base[0].type === "black" && job.base[0].duration === 2, "leading gap");
  assert(job.base[2].type === "black" && job.base[2].duration === 2, "middle gap");
  near(job.duration, 10);
});

test("audio graph includes video-embedded audio and bgm with gains", () => {
  const { engine, vTrack, aTrack, clipA, song } = rig();
  engine.insertClip(vTrack, { assetId: clipA, start: 0, volume: 0.8 });
  engine.insertClip(aTrack, { assetId: song, start: 0, duration: 10, volume: 0.2 });
  const job = compileRenderJob(engine.getDoc());
  assert(job.audio.length === 2, "two audio entries");
  near(job.audio[0].volume, 0.8);
  near(job.audio[1].volume, 0.2);
});

test("muted clips and muted tracks are excluded from the mix", () => {
  const { engine, vTrack, aTrack, clipA, song } = rig();
  const v = engine.insertClip(vTrack, { assetId: clipA, start: 0 });
  engine.insertClip(aTrack, { assetId: song, start: 0, duration: 5 });
  engine.setClipProps(v, { muted: true });
  engine.setTrackProps(aTrack, { muted: true });
  const job = compileRenderJob(engine.getDoc());
  assert(job.audio.length === 0, "silent");
});

test("overlay tracks compile to overlay entries", () => {
  const { engine, vTrack, clipA, logo } = rig();
  engine.insertClip(vTrack, { assetId: clipA, start: 0 });
  const ovTrack = engine.addTrack("video", "Overlay");
  const ov = engine.insertClip(ovTrack, { assetId: logo, start: 2, duration: 5 });
  engine.setClipProps(ov, { transform: { x: 0.3, y: -0.3, scale: 0.25, rotation: 0, opacity: 0.9 } });
  const job = compileRenderJob(engine.getDoc());
  assert(job.overlays.length === 1, "one overlay");
  near(job.overlays[0].start, 2);
  near(job.overlays[0].end, 7);
  near(job.overlays[0].transform.scale, 0.25);
});

test("ffmpeg plan dedupes inputs and emits a coherent graph", () => {
  const { engine, vTrack, aTrack, clipA, song } = rig();
  engine.insertClip(vTrack, { assetId: clipA, start: 0, duration: 4 });
  const second = engine.insertClip(vTrack, { assetId: clipA, start: 4, duration: 4, srcIn: 4 });
  engine.insertClip(aTrack, { assetId: song, start: 1, duration: 6, volume: 0.3 });
  void second;
  const plan = buildFfmpegPlan(compileRenderJob(engine.getDoc()));
  assert(plan.inputs.length === 2, `deduped inputs, got ${plan.inputs.length}`);
  assert(plan.filterComplex.includes("concat=n=2:v=1:a=0"), "video concat present");
  assert(plan.filterComplex.includes("amix=inputs=3"), "audio mix of 3 sources");
  assert(plan.filterComplex.includes("adelay=1000|1000"), "bgm offset applied");
  assert(plan.videoLabel.length > 0 && plan.audioLabel.length > 0, "labels set");
});

test("empty doc still yields a renderable plan", () => {
  const engine = new EditorEngine(createEmptyDoc());
  const plan = buildFfmpegPlan(compileRenderJob(engine.getDoc()));
  assert(plan.filterComplex.includes("color=c=black"), "black base");
  assert(plan.filterComplex.includes("anullsrc"), "silent audio");
});

// ── Serialization & bridge ───────────────────────────────────────────────────

test("toJSON/fromJSON round-trips a complex doc", () => {
  const { engine, vTrack, aTrack, clipA, song } = rig();
  engine.insertClip(vTrack, { assetId: clipA, start: 0 });
  engine.insertClip(aTrack, { assetId: song, start: 0, duration: 8, volume: 0.2 });
  const restored = EditorEngine.fromJSON(JSON.parse(JSON.stringify(engine.toJSON())));
  assert(JSON.stringify(restored.getDoc()) === JSON.stringify(engine.getDoc()), "identical docs");
});

test("legacy project bridge builds a valid doc with bgm", () => {
  const doc = docFromLegacyProject({
    videoStatus: {
      0: { status: "succeeded", url: "https://cdn/s0.mp4" },
      1: { status: "succeeded", url: "https://cdn/s1.mp4" },
    },
    timeline: [
      { sceneIndex: 0, trimStart: 1, trimEnd: 9 },
      { sceneIndex: 1, trimStart: 0, trimEnd: 10, volume: 0.5 },
    ],
    musicUrl: "https://cdn/bgm.mp3",
    musicVolume: 0.25,
  });
  validateDoc(doc);
  const video = doc.tracks.find((t) => t.kind === "video")!;
  const audio = doc.tracks.find((t) => t.kind === "audio")!;
  assert(video.clips.length === 2, "two scenes");
  near(video.clips[0].duration, 8);
  near(video.clips[1].start, 8);
  assert(audio.clips.length === 1, "bgm present");
  near(doc.duration, 18);
  // The whole thing must compile straight to a plan.
  buildFfmpegPlan(compileRenderJob(doc));
});

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length > 0) process.exit(1);
