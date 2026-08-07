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
  syncSceneTakes,
  assetSceneIndex,
  clipEnd,
  canvasForAspect,
  conformCanvas,
} from "../lib/editor";
import {
  recordTake,
  sceneTakes,
  activeTakeIndex,
  VideoStatusEntry,
} from "../app/dashboard/_flow/types";

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

// ── Scene takes: re-rendering must not leave the timeline on the old clip ────

test("re-rendered scenes re-point every clip cut from them, edits intact", () => {
  const doc = docFromLegacyProject({
    videoStatus: {
      0: { status: "succeeded", url: "https://cdn/s0-take1.mp4" },
      1: { status: "succeeded", url: "https://cdn/s1-take1.mp4" },
    },
  });
  const engine = new EditorEngine(doc);
  const video = engine.getDoc().tracks.find((t) => t.kind === "video")!;
  // The director trims scene 1 and razors scene 2 in half before re-rendering.
  engine.trimClipEnd(video.clips[0].id, 6);
  engine.splitClipAt(engine.getDoc().tracks[0].clips[1].id, 10);
  const before = engine.getDoc().tracks[0].clips.length;

  const repointed = syncSceneTakes(engine, {
    0: { status: "succeeded", url: "https://cdn/s0-take2.mp4" },
    1: { status: "succeeded", url: "https://cdn/s1-take2.mp4" },
  });

  const after = engine.getDoc();
  assert(repointed === 2, `two assets re-pointed, got ${repointed}`);
  assert(after.tracks[0].clips.length === before, "no clips added or lost");
  near(after.tracks[0].clips[0].duration, 6);
  const urls = Object.values(after.assets).map((a) => a.url).sort();
  assert(
    JSON.stringify(urls) === JSON.stringify(["https://cdn/s0-take2.mp4", "https://cdn/s1-take2.mp4"]),
    `assets follow the new takes, got ${urls.join()}`
  );
  validateDoc(after);
});

test("re-pointing is not undoable and leaves the director's own history alone", () => {
  const engine = new EditorEngine(
    docFromLegacyProject({ videoStatus: { 0: { status: "succeeded", url: "https://cdn/old.mp4" } } })
  );
  const clipId = engine.getDoc().tracks[0].clips[0].id;
  engine.trimClipEnd(clipId, 7);
  syncSceneTakes(engine, { 0: { status: "succeeded", url: "https://cdn/new.mp4" } });

  engine.undo(); // must undo the trim, not the media swap
  const doc = engine.getDoc();
  near(doc.tracks[0].clips[0].duration, 10);
  assert(doc.assets[doc.tracks[0].clips[0].assetId].url === "https://cdn/new.mp4", "still the new take");
});

test("a scene that hasn't re-rendered keeps the take that's on the timeline", () => {
  const engine = new EditorEngine(
    docFromLegacyProject({ videoStatus: { 0: { status: "succeeded", url: "https://cdn/good.mp4" } } })
  );
  const repointed = syncSceneTakes(engine, {
    0: { status: "failed", url: undefined },
  } as any);
  assert(repointed === 0, "nothing re-pointed");
  const doc = engine.getDoc();
  assert(doc.assets[doc.tracks[0].clips[0].assetId].url === "https://cdn/good.mp4", "old take survives");
});

test("documents saved before provenance are matched by their scene label", () => {
  // Exactly the shape a pre-versioning save produced: label, no sceneIndex.
  const engine = new EditorEngine(createEmptyDoc());
  const trackId = engine.getDoc().tracks[0].id;
  const assetId = engine.addAsset({ kind: "video", url: "https://cdn/stale.mp4", duration: 10, label: "Scene 2" });
  engine.insertClip(trackId, { assetId, start: 0 });
  assert(assetSceneIndex(engine.getDoc().assets[assetId]) === 1, "Scene 2 → index 1");

  syncSceneTakes(engine, { 1: { status: "succeeded", url: "https://cdn/fresh.mp4" } });
  const asset = engine.getDoc().assets[assetId];
  assert(asset.url === "https://cdn/fresh.mp4", "re-pointed by label");
  assert(asset.sceneIndex === 1, "provenance stamped, so the label is never consulted again");
});

test("uploaded media is never mistaken for a scene clip", () => {
  const engine = new EditorEngine(createEmptyDoc());
  const trackId = engine.getDoc().tracks[0].id;
  const assetId = engine.addAsset({ kind: "video", url: "https://cdn/b-roll.mp4", duration: 10, label: "b-roll" });
  engine.insertClip(trackId, { assetId, start: 0 });
  const repointed = syncSceneTakes(engine, { 0: { status: "succeeded", url: "https://cdn/scene1.mp4" } });
  assert(repointed === 0, "untouched");
  assert(engine.getDoc().assets[assetId].url === "https://cdn/b-roll.mp4", "still the upload");
});

// ── Take history ────────────────────────────────────────────────────────────

test("a re-render appends a take and makes it active", () => {
  let entry: VideoStatusEntry = { status: "succeeded", url: "https://cdn/take1.mp4" };
  entry = recordTake(entry, { id: "gen2", url: "https://cdn/take2.mp4" });
  assert(sceneTakes(entry).length === 2, "the first clip was kept");
  assert(entry.url === "https://cdn/take2.mp4", "newest take is on air");
  assert(activeTakeIndex(entry) === 1, "active index follows");
});

test("the same generation reported twice yields one take", () => {
  let entry = recordTake({ status: "rendering" }, { id: "gen1", url: "https://cdn/a.mp4" });
  entry = recordTake(entry, { id: "gen1", url: "https://cdn/a.mp4" });
  assert(sceneTakes(entry).length === 1, `one take, got ${sceneTakes(entry).length}`);
});

test("pre-versioning scenes read as a one-take history", () => {
  const legacy: VideoStatusEntry = { status: "succeeded", url: "https://cdn/only.mp4" };
  assert(sceneTakes(legacy).length === 1, "single take");
  assert(activeTakeIndex(legacy) === 0, "and it's the active one");
  assert(activeTakeIndex({ status: "idle" }) === -1, "no clip, no take");
});

// ── The canvas ──────────────────────────────────────────────────────────────
//
// The bug these cover: every document was built at a hardcoded 1280×720, so a
// 9:16 ad previewed and exported as a slim strip pillarboxed inside a landscape
// frame. The canvas is the shape of the deliverable.

test("the canvas follows the ad's orientation", () => {
  const landscape = canvasForAspect("16:9");
  assert(landscape.width === 1280 && landscape.height === 720, `16:9 → ${landscape.width}×${landscape.height}`);
  const portrait = canvasForAspect("9:16");
  assert(portrait.width === 720 && portrait.height === 1280, `9:16 → ${portrait.width}×${portrait.height}`);
  const square = canvasForAspect("1:1");
  assert(square.width === 720 && square.height === 720, `1:1 → ${square.width}×${square.height}`);
});

test("both canvas dimensions are always even (h264 yuv420p)", () => {
  for (const aspect of ["16:9", "9:16", "1:1", "4:5", "5:4", "21:9", "3:2", 1.85, 0.54]) {
    const { width, height } = canvasForAspect(aspect);
    assert(width % 2 === 0 && height % 2 === 0, `${aspect} → ${width}×${height} is not even`);
  }
});

test("a missing or junk aspect ratio falls back to landscape", () => {
  for (const bad of [undefined, null, "", "banana", "0:0", -3, NaN]) {
    const { width, height } = canvasForAspect(bad as never);
    assert(width === 1280 && height === 720, `${String(bad)} → ${width}×${height}`);
  }
});

test("a portrait project builds a portrait document", () => {
  const doc = docFromLegacyProject({
    aspectRatio: "9:16",
    videoStatus: { 0: { status: "succeeded", url: "https://cdn/s1.mp4" } },
  });
  assert(doc.width === 720 && doc.height === 1280, `got ${doc.width}×${doc.height}`);
  // And it reaches the render job, which is what ffmpeg's frame is built from.
  const job = compileRenderJob(doc);
  assert(job.width === 720 && job.height === 1280, `job ${job.width}×${job.height}`);
  const plan = buildFfmpegPlan(job);
  assert(plan.filterComplex.includes("scale=720:1280"), "the filtergraph scales to the portrait frame");
});

test("a project with no stored orientation still builds landscape", () => {
  const doc = docFromLegacyProject({
    videoStatus: { 0: { status: "succeeded", url: "https://cdn/s1.mp4" } },
  });
  assert(doc.width === 1280 && doc.height === 720, `got ${doc.width}×${doc.height}`);
});

test("conformCanvas reshapes a document saved at the wrong canvas", () => {
  // Exactly the stored state the old code left behind: a vertical ad whose
  // saved document is landscape.
  const engine = new EditorEngine(createEmptyDoc({ width: 1280, height: 720 }));
  const track = engine.getDoc().tracks[0].id;
  const asset = engine.addAsset({ kind: "video", url: "https://cdn/a.mp4", duration: 10 });
  engine.insertClip(track, { assetId: asset, start: 0, duration: 4 });

  const changed = conformCanvas(engine, "9:16");
  assert(changed, "it reported the reshape so the caller persists it");
  const doc = engine.getDoc();
  assert(doc.width === 720 && doc.height === 1280, `got ${doc.width}×${doc.height}`);
  // The edit survives untouched — only the frame changed.
  assert(doc.tracks[0].clips.length === 1, "the clip is still there");
  near(doc.tracks[0].clips[0].duration, 4);
  validateDoc(doc);
});

test("conformCanvas is a no-op when the canvas already agrees", () => {
  const engine = new EditorEngine(createEmptyDoc({ width: 720, height: 1280 }));
  assert(conformCanvas(engine, "9:16") === false, "no change reported");
  assert(conformCanvas(engine, undefined) === true, "…but a landscape project does reshape it");
});

test("reshaping the canvas is not an undo step", () => {
  // Ctrl+Z after opening a conformed project must not restore the wrong shape.
  const engine = new EditorEngine(createEmptyDoc({ width: 1280, height: 720 }));
  conformCanvas(engine, "9:16");
  assert(!engine.canUndo(), "the conform did not land on the undo stack");
  assert(engine.getDoc().width === 720, "and the portrait canvas stuck");
});

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length > 0) process.exit(1);
