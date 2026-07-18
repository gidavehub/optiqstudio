/**
 * Stage 3 verification. Run: npx -y tsx scripts/test-render-parity.ts
 *
 * 1. Parity: functions/editorEngine.js (CJS port used by renderJobV2) must
 *    produce byte-identical ffmpeg plans to lib/editor/edl.ts for the same
 *    RenderJob.
 * 2. Validation: the server-side validator accepts every engine-produced job
 *    and rejects malformed/hostile ones.
 */

import { createRequire } from "node:module";
import {
  EditorEngine,
  createEmptyDoc,
  compileRenderJob,
  buildFfmpegPlan,
  RenderJob,
} from "../lib/editor";

const require_ = createRequire(import.meta.url);
const serverEngine = require_("../functions/editorEngine.js") as {
  validateRenderJob: (job: unknown) => RenderJob;
  buildFfmpegPlan: (job: RenderJob) => {
    inputs: string[];
    filterComplex: string;
    videoLabel: string;
    audioLabel: string;
  };
};

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

// ── Job fixtures built through the real engine ──────────────────────────────

function simpleJob(): RenderJob {
  const e = new EditorEngine(createEmptyDoc());
  const v = e.getDoc().tracks[0].id;
  const a = e.addAsset({ kind: "video", url: "https://cdn.example.com/a.mp4", duration: 10 });
  e.insertClip(v, { assetId: a, start: 0 });
  return compileRenderJob(e.getDoc());
}

function complexJob(): RenderJob {
  const e = new EditorEngine(createEmptyDoc());
  const doc = e.getDoc();
  const vTrack = doc.tracks[0].id;
  const aTrack = doc.tracks[1].id;
  const a = e.addAsset({ kind: "video", url: "https://cdn.example.com/a.mp4", duration: 10 });
  const b = e.addAsset({ kind: "video", url: "https://cdn.example.com/b.mp4", duration: 10 });
  const logo = e.addAsset({ kind: "image", url: "https://cdn.example.com/logo.png" });
  const song = e.addAsset({ kind: "audio", url: "https://cdn.example.com/song.mp3", duration: 300 });

  e.insertClip(vTrack, { assetId: a, start: 1, duration: 4, srcIn: 2 });
  const fast = e.insertClip(vTrack, { assetId: b, start: 6, duration: 4 });
  e.setClipSpeed(fast, 2.5);
  const ovTrack = e.addTrack("video", "Overlay");
  const ov = e.insertClip(ovTrack, { assetId: logo, start: 2, duration: 6 });
  e.setClipProps(ov, { transform: { x: 0.35, y: -0.35, scale: 0.2, rotation: 0, opacity: 0.85 } });
  const bgm = e.insertClip(aTrack, { assetId: song, start: 0, duration: 8, volume: 0.25 });
  e.setClipProps(bgm, { fadeIn: 0.5, fadeOut: 1 });
  return compileRenderJob(e.getDoc());
}

function emptyJob(): RenderJob {
  return compileRenderJob(new EditorEngine(createEmptyDoc()).getDoc());
}

function slowmoJob(): RenderJob {
  const e = new EditorEngine(createEmptyDoc());
  const v = e.getDoc().tracks[0].id;
  const a = e.addAsset({ kind: "video", url: "https://cdn.example.com/a.mp4", duration: 10 });
  const id = e.insertClip(v, { assetId: a, start: 0 });
  e.setClipSpeed(id, 0.25);
  return compileRenderJob(e.getDoc());
}

// ── Parity ──────────────────────────────────────────────────────────────────

const fixtures: Array<[string, () => RenderJob]> = [
  ["simple single clip", simpleJob],
  ["gaps + overlays + fades + speed", complexJob],
  ["empty document", emptyJob],
  ["extreme slow motion", slowmoJob],
];

for (const [name, make] of fixtures) {
  test(`parity: ${name}`, () => {
    const job = make();
    const ts = buildFfmpegPlan(job);
    const js = serverEngine.buildFfmpegPlan(JSON.parse(JSON.stringify(job)));
    assert(
      JSON.stringify(ts) === JSON.stringify(js),
      `plans differ\nTS: ${JSON.stringify(ts)}\nJS: ${JSON.stringify(js)}`
    );
  });
}

// ── Server-side validation ──────────────────────────────────────────────────

for (const [name, make] of fixtures) {
  if (name === "empty document") continue; // duration 0 is not renderable server-side
  test(`validator accepts engine output: ${name}`, () => {
    serverEngine.validateRenderJob(JSON.parse(JSON.stringify(make())));
  });
}

function expectReject(name: string, mutate: (job: any) => void) {
  test(`validator rejects: ${name}`, () => {
    const job: any = JSON.parse(JSON.stringify(complexJob()));
    mutate(job);
    let threw = false;
    try {
      serverEngine.validateRenderJob(job);
    } catch {
      threw = true;
    }
    assert(threw, "expected validation error");
  });
}

expectReject("non-https input URL", (j) => {
  j.base.find((s: any) => s.type === "media").url = "http://evil.example.com/a.mp4";
});
expectReject("file:// input URL", (j) => {
  j.audio[0].url = "file:///etc/passwd";
});
expectReject("absurd duration", (j) => {
  j.duration = 100000;
});
expectReject("negative srcIn", (j) => {
  j.audio[0].srcIn = -3;
});
expectReject("opacity above 1", (j) => {
  j.overlays[0].transform.opacity = 2;
});
expectReject("NaN volume", (j) => {
  j.audio[0].volume = NaN;
});
expectReject("wrong version", (j) => {
  j.version = 99;
});
expectReject("oversized canvas", (j) => {
  j.width = 100000;
});
test("validator rejects: not an object", () => {
  let threw = false;
  try {
    serverEngine.validateRenderJob("garbage");
  } catch {
    threw = true;
  }
  assert(threw, "expected validation error");
});

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length > 0) process.exit(1);
