/**
 * Stage 6 verification — interaction layer.
 * Run: npx -y tsx scripts/test-interaction-engine.ts
 *
 * timescale mapping, the drag/trim/razor controller (driven against a real
 * engine), and the keyboard shortcut resolver — all headless.
 */

import {
  timeToX,
  xToTime,
  zoomAround,
  clampZoom,
  niceInterval,
  rulerTicks,
  formatTimecode,
  TimeScale,
} from "../lib/editor/timescale";
import { InteractionController } from "../lib/editor/interactions";
import { resolveShortcut } from "../lib/editor/shortcuts";
import { EditorEngine } from "../lib/editor/engine";
import { createEmptyDoc, clipEnd } from "../lib/editor/types";

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
function eq(a: unknown, b: unknown, msg: string) {
  assert(JSON.stringify(a) === JSON.stringify(b), `${msg}: ${JSON.stringify(a)} != ${JSON.stringify(b)}`);
}

// ── timescale ────────────────────────────────────────────────────────────────

test("timeToX / xToTime round-trip", () => {
  const scale: TimeScale = { pxPerSecond: 80, scrollX: 120 };
  near(timeToX(5, scale), 5 * 80 - 120);
  near(xToTime(timeToX(5, scale), scale), 5);
});

test("zoomAround keeps the anchor time fixed", () => {
  const scale: TimeScale = { pxPerSecond: 80, scrollX: 120 };
  const anchorX = 200;
  const anchorTime = xToTime(anchorX, scale);
  const zoomed = zoomAround(scale, 2, anchorX);
  near(xToTime(anchorX, zoomed), anchorTime, 1e-6);
  assert(zoomed.pxPerSecond === 160, "zoomed 2x");
});

test("clampZoom respects bounds", () => {
  assert(clampZoom(1) === 4, "min");
  assert(clampZoom(9999) === 600, "max");
});

test("niceInterval keeps ticks readable", () => {
  assert(niceInterval(80) === 1, "1s at 80px/s");
  assert(niceInterval(8) >= 5, "coarser when zoomed out");
  assert(niceInterval(600) <= 0.2, "finer when zoomed in");
});

test("rulerTicks are within the viewport and label majors", () => {
  const scale: TimeScale = { pxPerSecond: 80, scrollX: 0 };
  const ticks = rulerTicks(scale, 800, 30);
  assert(ticks.length > 0, "some ticks");
  assert(ticks.every((t) => t.x >= -1 && t.x <= 801), "in viewport");
  const majors = ticks.filter((t) => t.major);
  assert(majors.every((t) => t.label), "majors labelled");
  assert(majors.some((t) => t.label === "0:05"), "has a 0:05 label");
});

test("formatTimecode formats mm:ss, fractions, and frames", () => {
  assert(formatTimecode(5) === "0:05", "0:05");
  assert(formatTimecode(65) === "1:05", "1:05");
  assert(formatTimecode(90.5) === "1:30.5", "fraction");
  assert(formatTimecode(2.5, 30) === "0:02:15", "frames");
});

// ── interaction controller ───────────────────────────────────────────────────

function rig(pxPerSecond = 100, playhead?: number) {
  const engine = new EditorEngine(createEmptyDoc());
  const doc = engine.getDoc();
  const t1 = doc.tracks[0].id; // video
  const t2 = engine.addTrack("video", "Video 2");
  const aTrack = doc.tracks[1].id; // audio
  const vid = engine.addAsset({ kind: "video", url: "https://cdn/a.mp4", duration: 30 });
  const img = engine.addAsset({ kind: "image", url: "https://cdn/logo.png" });
  const ctl = new InteractionController(engine, {
    snapEnabled: true,
    snapThresholdPx: 8,
    getPxPerSecond: () => pxPerSecond,
    getPlayhead: () => playhead,
  });
  return { engine, ctl, t1, t2, aTrack, vid, img };
}

test("move drag repositions a clip and is one undo step", () => {
  const { engine, ctl, t1, vid } = rig();
  const id = engine.insertClip(t1, { assetId: vid, start: 2, duration: 5 });
  ctl.beginMove(id, 3); // grab 1s into the clip
  ctl.update(9); // pointer at 9 → start 8
  ctl.update(12); // pointer at 12 → start 11
  ctl.end();
  near(engine.findClip(id)!.clip.start, 11);
  assert(engine.canUndo(), "has undo");
  engine.undo();
  near(engine.findClip(id)!.clip.start, 2); // whole drag reverts at once
});

test("move snaps to a neighboring clip edge", () => {
  const { engine, ctl, t1, t2, vid } = rig(100);
  engine.insertClip(t2, { assetId: vid, start: 10, duration: 5 }); // anchor edge at 10
  const id = engine.insertClip(t1, { assetId: vid, start: 0, duration: 4 });
  ctl.beginMove(id, 0);
  ctl.update(9.97); // within 8px/100pps = 0.08s of the anchor at 10
  ctl.end();
  near(engine.findClip(id)!.clip.start, 10);
});

test("snapping can be disabled", () => {
  const { engine, t1, t2, vid } = rig();
  const engine2 = engine;
  engine2.insertClip(t2, { assetId: vid, start: 10, duration: 5 });
  const noSnap = new InteractionController(engine2, {
    snapEnabled: false,
    getPxPerSecond: () => 100,
  });
  const id = engine2.insertClip(t1, { assetId: vid, start: 0, duration: 4 });
  noSnap.beginMove(id, 0);
  noSnap.update(9.97);
  noSnap.end();
  near(engine2.findClip(id)!.clip.start, 9.97);
});

test("move can cross to a compatible track", () => {
  const { engine, ctl, t1, t2, vid } = rig();
  const id = engine.insertClip(t1, { assetId: vid, start: 0, duration: 4 });
  ctl.beginMove(id, 0);
  ctl.update(0, t2);
  ctl.end();
  assert(engine.findClip(id)!.track.id === t2, "moved to track 2");
});

test("an image clip refuses to move onto an audio track", () => {
  const { engine, ctl, t1, aTrack, img } = rig();
  const id = engine.insertClip(t1, { assetId: img, start: 0, duration: 3 });
  ctl.beginMove(id, 0);
  ctl.update(0, aTrack); // pointer over audio track
  ctl.end();
  assert(engine.findClip(id)!.track.id === t1, "stayed on the video track");
});

test("trim-start and trim-end drags resize the clip", () => {
  const { engine, ctl, t1, vid } = rig(100);
  const id = engine.insertClip(t1, { assetId: vid, start: 5, srcIn: 5, duration: 10 });
  ctl.beginTrim(id, "start");
  ctl.update(7);
  ctl.end();
  near(engine.findClip(id)!.clip.start, 7);

  ctl.beginTrim(id, "end");
  ctl.update(20);
  ctl.end();
  near(clipEnd(engine.findClip(id)!.clip), 20);
});

test("cancel restores the pre-drag document", () => {
  const { engine, ctl, t1, vid } = rig();
  const id = engine.insertClip(t1, { assetId: vid, start: 3, duration: 4 });
  ctl.beginMove(id, 3);
  ctl.update(20);
  ctl.cancel();
  near(engine.findClip(id)!.clip.start, 3);
  assert(!ctl.isDragging, "drag cleared");
});

test("razorAt splits the covering clip; razorAllAt spans tracks", () => {
  const { engine, ctl, t1, t2, vid } = rig();
  engine.insertClip(t1, { assetId: vid, start: 0, duration: 10 });
  engine.insertClip(t2, { assetId: vid, start: 0, duration: 10 });
  const one = ctl.razorAt(t1, 4);
  assert(one, "split returned a clip");
  assert(engine.getTrack(t1)!.clips.length === 2, "t1 now has two clips");
  const many = ctl.razorAllAt(7);
  assert(many.length === 2, "split both tracks at the playhead");
});

// ── shortcuts ────────────────────────────────────────────────────────────────

test("shortcut resolver maps transport and edit keys", () => {
  eq(resolveShortcut({ key: " " }), { type: "playPause" }, "space");
  eq(resolveShortcut({ key: "s" }), { type: "split" }, "s");
  eq(resolveShortcut({ key: "b" }), { type: "split" }, "b blade");
  eq(resolveShortcut({ key: "Delete" }), { type: "delete" }, "delete");
  eq(resolveShortcut({ key: "Backspace" }), { type: "delete" }, "backspace");
});

test("shortcut resolver handles undo/redo on both platforms", () => {
  eq(resolveShortcut({ key: "z", ctrlKey: true }), { type: "undo" }, "ctrl+z");
  eq(resolveShortcut({ key: "z", metaKey: true }), { type: "undo" }, "cmd+z");
  eq(resolveShortcut({ key: "z", ctrlKey: true, shiftKey: true }), { type: "redo" }, "ctrl+shift+z");
  eq(resolveShortcut({ key: "y", ctrlKey: true }), { type: "redo" }, "ctrl+y");
  eq(resolveShortcut({ key: "d", ctrlKey: true }), { type: "duplicate" }, "ctrl+d");
});

test("shortcut resolver maps nudge, zoom, seek, snap", () => {
  eq(resolveShortcut({ key: "ArrowLeft" }), { type: "nudge", direction: "left", frame: true }, "nudge frame");
  eq(resolveShortcut({ key: "ArrowRight", shiftKey: true }), { type: "nudge", direction: "right", frame: false }, "coarse nudge");
  eq(resolveShortcut({ key: "=" }), { type: "zoom", direction: "in" }, "zoom in");
  eq(resolveShortcut({ key: "-" }), { type: "zoom", direction: "out" }, "zoom out");
  eq(resolveShortcut({ key: "Home" }), { type: "seek", to: "start" }, "home");
  eq(resolveShortcut({ key: "End" }), { type: "seek", to: "end" }, "end");
  eq(resolveShortcut({ key: "m" }), { type: "toggleSnap" }, "snap");
});

test("shortcut resolver ignores text fields and unknown keys", () => {
  assert(resolveShortcut({ key: " ", isEditingText: true }) === null, "typing space ignored");
  assert(resolveShortcut({ key: "q" }) === null, "unknown key");
  assert(resolveShortcut({ key: "k", ctrlKey: true }) === null, "unknown chord");
});

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length > 0) process.exit(1);
