/**
 * Stage 7 verification — persistence & autosave.
 * Run: npx -y tsx scripts/test-persistence-engine.ts
 *
 * Firestore-safe serialization round-trips and the debounced autosave /
 * conflict manager, driven by a fake clock so timing is deterministic.
 */

import {
  sanitizeForStore,
  serializeDoc,
  deserializeDoc,
  hasStoredDoc,
  EDITOR_DOC_FIELD,
} from "../lib/editor/persistence";
import { EditorAutosaver, SavePayload } from "../lib/editor/autosave";
import { EditorEngine } from "../lib/editor/engine";
import { createEmptyDoc, validateDoc, EditorDoc } from "../lib/editor/types";

let passed = 0;
const failures: string[] = [];
const queue: Array<{ name: string; fn: () => void | Promise<void> }> = [];

function test(name: string, fn: () => void | Promise<void>) {
  queue.push({ name, fn });
}
// Intentionally NOT `asserts cond`: narrowing here would collapse values like
// `saves.length` to a literal and break later comparisons in the same flow.
function assert(cond: unknown, msg: string): void {
  if (!cond) throw new Error(msg);
}
const realTick = () => new Promise((res) => setTimeout(res, 0));

function hasUndefinedDeep(v: unknown): boolean {
  if (v === undefined) return true;
  if (v === null || typeof v !== "object") return false;
  if (Array.isArray(v)) return v.some(hasUndefinedDeep);
  return Object.values(v as Record<string, unknown>).some(hasUndefinedDeep);
}

/** A doc that exercises optional fields: audio clip (no transform), image (no duration). */
function richDoc(): EditorDoc {
  const e = new EditorEngine(createEmptyDoc());
  const doc = e.getDoc();
  const vTrack = doc.tracks[0].id;
  const aTrack = doc.tracks[1].id;
  const vid = e.addAsset({ kind: "video", url: "https://cdn/a.mp4", duration: 10 });
  const img = e.addAsset({ kind: "image", url: "https://cdn/logo.png" });
  const song = e.addAsset({ kind: "audio", url: "https://cdn/song.mp3", duration: 60 });
  e.insertClip(vTrack, { assetId: vid, start: 0 });
  const ov = e.addTrack("video", "Overlay");
  e.insertClip(ov, { assetId: img, start: 1, duration: 4 });
  e.insertClip(aTrack, { assetId: song, start: 0, duration: 8, volume: 0.2 });
  return e.toJSON();
}

// ── Fake clock ────────────────────────────────────────────────────────────────

class FakeClock {
  time = 0;
  private seq = 0;
  private jobs: { id: number; fn: () => void; at: number }[] = [];
  setTimer = (fn: () => void, ms: number) => {
    const id = ++this.seq;
    this.jobs.push({ id, fn, at: this.time + ms });
    return id;
  };
  clearTimer = (h: unknown) => {
    this.jobs = this.jobs.filter((j) => j.id !== h);
  };
  now = () => this.time;
  async advance(ms: number) {
    this.time += ms;
    const due = this.jobs.filter((j) => j.at <= this.time).sort((a, b) => a.at - b.at);
    this.jobs = this.jobs.filter((j) => j.at > this.time);
    for (const j of due) j.fn();
    // Let any async save() chains settle.
    await realTick();
    await realTick();
  }
}

function makeSaver(clock: FakeClock, save: (p: SavePayload) => Promise<void>, initialRev = 0) {
  return new EditorAutosaver({
    debounceMs: 1000,
    initialRev,
    now: clock.now,
    setTimer: clock.setTimer,
    clearTimer: clock.clearTimer,
    save,
  });
}

// ── Serialization ─────────────────────────────────────────────────────────────

test("sanitizeForStore drops undefined but keeps null and arrays", () => {
  const input = { a: 1, b: undefined, c: null, d: [1, { e: undefined, f: 2 }] };
  const out = sanitizeForStore(input) as any;
  assert(!("b" in out), "undefined key removed");
  assert(out.c === null, "null preserved");
  assert(out.d.length === 2, "array length preserved");
  assert(!("e" in out.d[1]) && out.d[1].f === 2, "nested undefined removed");
});

test("serializeDoc yields a Firestore-safe object with no undefined", () => {
  const stored = serializeDoc(richDoc());
  assert(!hasUndefinedDeep(stored), "no undefined anywhere");
  const audioClip = stored.tracks.find((t) => t.kind === "audio")!.clips[0];
  assert(!("transform" in audioClip), "audio clip has no transform key");
  const baseVideoClip = stored.tracks.find((t) => t.kind === "video")!.clips[0];
  assert("transform" in baseVideoClip, "video clip keeps transform");
});

test("serialize → deserialize round-trips to an equal, valid doc", () => {
  const doc = richDoc();
  const restored = deserializeDoc(JSON.parse(JSON.stringify(serializeDoc(doc))));
  validateDoc(restored);
  assert(JSON.stringify(restored) === JSON.stringify(doc), "docs identical after round-trip");
});

test("deserializeDoc rejects an unknown version", () => {
  let threw = false;
  try {
    deserializeDoc({ version: 2, fps: 30, width: 1280, height: 720, duration: 0, tracks: [], assets: {} });
  } catch {
    threw = true;
  }
  assert(threw, "expected version rejection");
});

test("hasStoredDoc detects the editor field", () => {
  assert(hasStoredDoc({ [EDITOR_DOC_FIELD]: { version: 1 } }), "present");
  assert(!hasStoredDoc({}), "absent");
  assert(!hasStoredDoc(null), "null-safe");
});

// ── Autosave ──────────────────────────────────────────────────────────────────

test("autosave debounces and coalesces rapid edits into one write", async () => {
  const clock = new FakeClock();
  const saves: SavePayload[] = [];
  const saver = makeSaver(clock, async (p) => { saves.push(p); });
  const doc = richDoc();
  saver.markDirty(doc);
  saver.markDirty(doc);
  saver.markDirty(doc);
  await clock.advance(500);
  assert(saves.length === 0, "not saved before debounce");
  await clock.advance(600); // total 1100ms > 1000ms
  assert(saves.length === 1, `one coalesced save, got ${saves.length}`);
  assert(saves[0].rev === 1, "rev bumped to 1");
  assert(saver.rev === 1 && !saver.isDirty, "clean at rev 1");
});

test("flush writes immediately without waiting for the debounce", async () => {
  const clock = new FakeClock();
  const saves: SavePayload[] = [];
  const saver = makeSaver(clock, async (p) => { saves.push(p); });
  saver.markDirty(richDoc());
  await saver.flush();
  assert(saves.length === 1, "flushed immediately");
  assert(saver.rev === 1, "rev advanced");
});

test("a failed save keeps the buffer dirty and retries", async () => {
  const clock = new FakeClock();
  let attempts: number = 0;
  const saver = makeSaver(clock, async () => {
    attempts++;
    if (attempts === 1) throw new Error("network down");
  });
  saver.markDirty(richDoc());
  await clock.advance(1100);
  assert(attempts === 1 && saver.isDirty, "first attempt failed, still dirty");
  assert(saver.rev === 0, "rev not bumped on failure");
  await clock.advance(1100); // rescheduled retry fires
  assert(attempts === 2 && !saver.isDirty, "retry succeeded");
  assert(saver.rev === 1, "rev bumped after successful retry");
});

test("onRemote keeps local edits and never clobbers unsaved work", () => {
  const clock = new FakeClock();
  const saver = makeSaver(clock, async () => {}, 3);
  saver.markDirty(richDoc()); // now dirty
  assert(saver.onRemote(4) === "keep-local", "dirty buffer wins");
});

test("onRemote adopts a strictly newer remote when clean, ignores echoes", () => {
  const clock = new FakeClock();
  const saver = makeSaver(clock, async () => {}, 2);
  assert(saver.onRemote(5) === "adopt-remote", "newer adopted");
  assert(saver.rev === 5, "adopted rev");
  assert(saver.onRemote(5) === "ignore", "echo ignored");
  assert(saver.onRemote(3) === "ignore", "stale ignored");
});

test("bindEngine autosaves on every engine mutation", async () => {
  const clock = new FakeClock();
  const saves: SavePayload[] = [];
  const saver = makeSaver(clock, async (p) => { saves.push(p); });
  const engine = new EditorEngine(createEmptyDoc());
  const unbind = saver.bindEngine(engine);
  const vid = engine.addAsset({ kind: "video", url: "https://cdn/a.mp4", duration: 10 });
  engine.insertClip(engine.getDoc().tracks[0].id, { assetId: vid, start: 0 });
  assert(saver.isDirty, "engine change marked dirty");
  await clock.advance(1100);
  assert(saves.length === 1, "autosaved after debounce");
  unbind();
});

// ── Runner ────────────────────────────────────────────────────────────────────

(async () => {
  for (const { name, fn } of queue) {
    try {
      await fn();
      passed++;
      console.log(`  ok  ${name}`);
    } catch (err: any) {
      failures.push(name);
      console.error(`FAIL  ${name}\n      ${err?.message ?? err}`);
    }
  }
  console.log(`\n${passed} passed, ${failures.length} failed`);
  if (failures.length > 0) process.exit(1);
})();
