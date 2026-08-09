/**
 * Audio planner TS↔JS parity. Run: npx -y tsx scripts/test-audio-parity.ts
 *
 * lib/editor/audioPlan.ts and functions/audioPlan.js hold the same arithmetic
 * twice, because `functions/` deploys on its own and cannot import from `lib/`
 * (the same reason functions/editorEngine.js exists). Duplication is only safe
 * while something diffs it, which is this file.
 *
 * Also checks the CJS-only document writer against the document invariants the
 * real engine enforces — the server has no EditorEngine to validate for it.
 */

import { createRequire } from "node:module";
import {
  filmTimeMap,
  narrationSlots,
  planNarration,
  planMusic,
  planMusicSuite,
  validateAudioPlan,
  wordBudget,
  estimateSpeechDuration,
  countWords,
  SPEECH_WPS,
  SLOT_FILL,
  MIN_SLOT,
  HEAD_ROOM,
  MUSIC_GAIN_WITH_NARRATION,
  MUSIC_GAIN_ALONE,
  MUSIC_FADE_IN,
  MUSIC_FADE_OUT,
  MUSIC_CROSSFADE,
  MUSIC_TRACK_NAMES,
  NARRATION_TRACK_NAME,
  validateDoc,
  canvasForAspect,
  EditorEngine,
  ScannedWindow,
  NarrationTake,
} from "../lib/editor";

const require_ = createRequire(import.meta.url);
const js = require_("../functions/audioPlan.js");

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

/**
 * Compare ignoring generated ids, which are random by design.
 *
 * `unusedSlotIds` needs its own case: it is an ARRAY of id strings rather than an
 * id-named field, so a key-based replacer walks straight past it and the two
 * sides "differ" on nothing but entropy.
 */
function sameShape(a: unknown, b: unknown, label: string) {
  const strip = (v: unknown): unknown =>
    JSON.parse(
      JSON.stringify(v, (key, val) => {
        if (key === "id" || key === "slotId") return "<id>";
        if (key === "unusedSlotIds" && Array.isArray(val)) return val.map(() => "<id>");
        return val;
      })
    );
  const A = JSON.stringify(strip(a));
  const B = JSON.stringify(strip(b));
  assert(A === B, `${label} diverged:\n  TS: ${A}\n  JS: ${B}`);
}

// ── Constants ───────────────────────────────────────────────────────────────

test("tunables match", () => {
  const pairs: [string, number, number][] = [
    ["SPEECH_WPS", SPEECH_WPS, js.SPEECH_WPS],
    ["SLOT_FILL", SLOT_FILL, js.SLOT_FILL],
    ["MIN_SLOT", MIN_SLOT, js.MIN_SLOT],
    ["HEAD_ROOM", HEAD_ROOM, js.HEAD_ROOM],
    ["MUSIC_GAIN_WITH_NARRATION", MUSIC_GAIN_WITH_NARRATION, js.MUSIC_GAIN_WITH_NARRATION],
    ["MUSIC_GAIN_ALONE", MUSIC_GAIN_ALONE, js.MUSIC_GAIN_ALONE],
    ["MUSIC_FADE_IN", MUSIC_FADE_IN, js.MUSIC_FADE_IN],
    ["MUSIC_FADE_OUT", MUSIC_FADE_OUT, js.MUSIC_FADE_OUT],
    ["MUSIC_CROSSFADE", MUSIC_CROSSFADE, js.MUSIC_CROSSFADE],
  ];
  for (const [name, ts, jsv] of pairs) assert(ts === jsv, `${name}: TS ${ts} vs JS ${jsv}`);
  assert(
    JSON.stringify([...MUSIC_TRACK_NAMES]) === JSON.stringify(js.MUSIC_TRACK_NAMES),
    "music track names differ"
  );
  assert(NARRATION_TRACK_NAME === js.NARRATION_TRACK_NAME, "narration track name differs");
});

// ── Pure math ───────────────────────────────────────────────────────────────

test("filmTimeMap parity across awkward inputs", () => {
  const cases = [
    [10, 10, 10, 10, 10, 10],
    [8.04, 8.04, 8.04],
    [10, null, 10, undefined, 0, 10],
    [],
    [7.999999, 0.000001],
    [180],
  ];
  for (const c of cases) {
    sameShape(filmTimeMap(c as number[]), js.filmTimeMap(c), `filmTimeMap(${JSON.stringify(c)})`);
  }
});

test("word budget and duration estimate parity", () => {
  for (const s of [0, 0.5, 1.2, 3, 5.5, 10, 47.3]) {
    assert(wordBudget(s) === js.wordBudget(s), `wordBudget(${s})`);
  }
  for (const t of ["", "one", "a few more words here", "word ".repeat(40)]) {
    assert(countWords(t) === js.countWords(t), `countWords(${t.slice(0, 12)})`);
    assert(estimateSpeechDuration(t) === js.estimateSpeechDuration(t), `estimate(${t.slice(0, 12)})`);
  }
});

test("narrationSlots parity, including clamping and de-overlapping", () => {
  const map = filmTimeMap([10, 10, 10, 10, 10, 10]);
  const jsMap = js.filmTimeMap([10, 10, 10, 10, 10, 10]);
  const windowSets: ScannedWindow[][] = [
    [{ sceneIndex: 0, startInScene: 2, endInScene: 7 }],
    [{ sceneIndex: 0, startInScene: 4, endInScene: 25 }],
    [
      { sceneIndex: 0, startInScene: 0, endInScene: 8 },
      { sceneIndex: 0, startInScene: 4, endInScene: 10 },
    ],
    [{ sceneIndex: 1, startInScene: 0, endInScene: 0.4 }],
    [{ sceneIndex: 0, startInScene: 0, endInScene: 10 }],
    [
      { sceneIndex: 5, startInScene: 1, endInScene: 9, note: "hands" },
      { sceneIndex: 2, startInScene: 1, endInScene: 9, note: "walking" },
    ],
  ];
  for (const windows of windowSets) {
    sameShape(
      narrationSlots(map, windows),
      js.narrationSlots(jsMap, windows),
      `narrationSlots(${JSON.stringify(windows)})`
    );
  }
});

test("planNarration parity, including the refit budget", () => {
  const map = filmTimeMap([10, 10, 10, 10]);
  const jsMap = js.filmTimeMap([10, 10, 10, 10]);
  const windows: ScannedWindow[] = [
    { sceneIndex: 0, startInScene: 2, endInScene: 7 },
    { sceneIndex: 2, startInScene: 2, endInScene: 7 },
  ];
  const tsSlots = narrationSlots(map, windows);
  const jsSlots = js.narrationSlots(jsMap, windows);
  // Ids differ by construction, so pair them positionally.
  const takeSets: { durationSec: number; text: string; url?: string }[][] = [
    [{ text: "Made here, by hand.", url: "https://cdn/a.wav", durationSec: 3.1 }],
    [{ text: "word ".repeat(40), url: "https://cdn/a.wav", durationSec: 9.4 }],
    [{ text: "word ".repeat(20), url: "https://cdn/a.wav", durationSec: 16 }],
    [{ text: "no url here", durationSec: 2 }],
    [{ text: "silent", url: "https://cdn/a.wav", durationSec: 0 }],
  ];
  for (const takes of takeSets) {
    const tsTakes: NarrationTake[] = takes.map((t) => ({ ...t, slotId: tsSlots[0].id }));
    const jsTakes = takes.map((t) => ({ ...t, slotId: jsSlots[0].id }));
    sameShape(
      planNarration(tsSlots, tsTakes),
      js.planNarration(jsSlots, jsTakes),
      `planNarration(${takes[0].text.slice(0, 14)})`
    );
  }
});

test("planMusic parity across trim, loop and degenerate cases", () => {
  const cases: [number, number, Record<string, unknown>][] = [
    [114, 60, {}],
    [64, 180, {}],
    [30, 120, {}],
    [30, 150, { hasNarration: true }],
    [45, 47, {}],
    [60, 3, {}],
    [5, 600, { maxLoops: 4 }],
    [4, 60, { crossfade: 30 }],
    [64, 60, { crossfade: 0 }],
    [0, 60, {}],
    [64, 0, {}],
    [64, 64, {}],
  ];
  for (const [track, film, opts] of cases) {
    sameShape(
      planMusic(track, film, opts as never),
      js.planMusic(track, film, opts),
      `planMusic(${track}, ${film}, ${JSON.stringify(opts)})`
    );
  }
});

test("planMusicSuite parity — the long-film scorer", () => {
  // The suite is what scores a five- or ten-minute film. Both twins have to lay
  // the same pieces at the same times on the same layers, or an export and a
  // timeline preview of the SAME film disagree about where the music changes.
  const pieces = [
    { url: "https://cdn/m1.mp3", duration: 60 },
    { url: "https://cdn/m2.mp3", duration: 75 },
    { url: "https://cdn/m3.mp3", duration: 52 },
    { url: "https://cdn/m4.mp3", duration: 60 },
    { url: "https://cdn/m5.mp3", duration: 68 },
  ];
  const cases: [typeof pieces, number, Record<string, unknown>][] = [
    [pieces, 300, {}],
    [pieces, 600, {}], // shorter than the film: the last piece carries the tail
    [pieces, 90, {}], // longer than the film: trimmed
    [pieces, 300, { hasNarration: true }],
    [pieces, 300, { crossfade: 0 }],
    [pieces.slice(0, 1), 180, {}], // one piece is not a suite — it loops
    [[], 300, {}],
    [pieces, 0, {}],
  ];
  for (const [tracks, film, opts] of cases) {
    sameShape(
      planMusicSuite(tracks, film, opts as never),
      js.planMusicSuite(tracks, film, opts),
      `planMusicSuite(${tracks.length} pieces, ${film}, ${JSON.stringify(opts)})`
    );
  }
});

test("validateAudioPlan parity", () => {
  const film = filmTimeMap([10, 10, 10, 10, 10, 10]);
  const jsFilm = js.filmTimeMap([10, 10, 10, 10, 10, 10]);
  const narrationSets = [
    [],
    [
      { slotId: "a", sceneIndex: 0, text: "One", url: "u", start: 2, duration: 6, slack: 0 },
      { slotId: "b", sceneIndex: 0, text: "Two", url: "u", start: 5, duration: 3, slack: 0 },
    ],
    [{ slotId: "a", sceneIndex: 5, text: "Late", url: "u", start: 58, duration: 6, slack: 0 }],
  ];
  for (const narration of narrationSets) {
    sameShape(
      validateAudioPlan({ film, narration, music: planMusic(64, 60), footageGain: 1, musicUrl: "u" } as never),
      js.validateAudioPlan({ film: jsFilm, narration, music: js.planMusic(64, 60), footageGain: 1, musicUrl: "u" }),
      `validateAudioPlan(${narration.length} lines)`
    );
  }
  // An empty film short-circuits in both.
  sameShape(
    validateAudioPlan({ film: filmTimeMap([]), narration: [], music: planMusic(0, 0), footageGain: 1 } as never),
    js.validateAudioPlan({ film: js.filmTimeMap([]), narration: [], music: js.planMusic(0, 0), footageGain: 1 }),
    "validateAudioPlan(empty film)"
  );
});

// ── The CJS-only document writer ────────────────────────────────────────────
//
// The server has no EditorEngine, so nothing validates its output for it. These
// run the real validateDoc over what it produced.

const CLIPS = [0, 1, 2, 3, 4, 5].map((i) => ({
  sceneIndex: i,
  url: `https://cdn/scene${i}.mp4`,
  duration: 8.04,
}));

function jsPlan(overrides: Record<string, unknown> = {}) {
  const film = js.filmTimeMap(CLIPS.map((c) => c.duration));
  return {
    film,
    narration: [],
    music: js.planMusic(30, film.duration, { hasNarration: false }),
    footageGain: 1,
    musicUrl: "https://cdn/score.mp3",
    ...overrides,
  };
}

test("a server-built document passes the real validateDoc", () => {
  const doc = js.baseDocFromClips(CLIPS, canvasForAspect("9:16"));
  validateDoc(doc);
  assert(doc.width === 720 && doc.height === 1280, `canvas ${doc.width}×${doc.height}`);
  assert(Math.abs(doc.duration - 8.04 * 6) < 1e-6, `duration ${doc.duration}`);
});

test("a server-applied audio plan passes the real validateDoc", () => {
  const doc = js.baseDocFromClips(CLIPS, canvasForAspect("16:9"));
  const film = js.filmTimeMap(CLIPS.map((c) => c.duration));
  const slots = js.narrationSlots(film, [
    { sceneIndex: 0, startInScene: 2, endInScene: 7 },
    { sceneIndex: 3, startInScene: 2, endInScene: 7 },
  ]);
  const narration = js.planNarration(slots, [
    { slotId: slots[0].id, text: "Made here.", url: "https://cdn/vo1.wav", durationSec: 2.5 },
    { slotId: slots[1].id, text: "By hand.", url: "https://cdn/vo2.wav", durationSec: 2.1 },
  ]).placements;

  js.applyAudioPlanToDoc(doc, jsPlan({ narration, footageGain: 0 }));
  validateDoc(doc);

  const vo = doc.tracks.find((t: any) => t.name === NARRATION_TRACK_NAME);
  assert(vo && vo.clips.length === 2, "two narration clips");
  assert(doc.tracks.some((t: any) => MUSIC_TRACK_NAMES.includes(t.name)), "a score track exists");
  for (const t of doc.tracks) if (t.kind === "video") assert(t.volume === 0, "footage muted");
});

test("the real engine accepts a server-built document", () => {
  // The strongest check available: hand the server's JSON to the TS engine.
  const doc = js.baseDocFromClips(CLIPS, canvasForAspect("9:16"));
  js.applyAudioPlanToDoc(doc, jsPlan());
  const engine = EditorEngine.fromJSON(doc);
  validateDoc(engine.getDoc());
  assert(engine.getDoc().tracks.length === doc.tracks.length, "tracks survived the round trip");
});

test("re-applying server-side replaces rather than stacks", () => {
  const doc = js.baseDocFromClips(CLIPS, canvasForAspect("16:9"));
  js.applyAudioPlanToDoc(doc, jsPlan());
  const first = doc.tracks.length;
  const firstAssets = Object.keys(doc.assets).length;
  js.applyAudioPlanToDoc(doc, jsPlan());
  js.applyAudioPlanToDoc(doc, jsPlan());
  assert(doc.tracks.length === first, `tracks grew to ${doc.tracks.length}`);
  assert(Object.keys(doc.assets).length === firstAssets, `assets grew to ${Object.keys(doc.assets).length}`);
  validateDoc(doc);
});

test("server-side apply leaves the director's own audio alone", () => {
  const doc = js.baseDocFromClips(CLIPS, canvasForAspect("16:9"));
  const assetId = "ast_mine";
  doc.assets[assetId] = { id: assetId, kind: "audio", url: "https://cdn/sfx.wav", duration: 3 };
  doc.tracks.push({
    id: "trk_mine",
    kind: "audio",
    name: "My SFX",
    muted: false,
    locked: false,
    volume: 1,
    clips: [
      { id: "clp_mine", assetId, start: 5, duration: 3, srcIn: 0, srcOut: 3, speed: 1, volume: 1, muted: false, fadeIn: 0, fadeOut: 0 },
    ],
  });
  js.applyAudioPlanToDoc(doc, jsPlan());
  js.applyAudioPlanToDoc(doc, jsPlan());
  const kept = doc.tracks.find((t: any) => t.name === "My SFX");
  assert(kept && kept.clips.length === 1, "the director's clip survived");
  assert(doc.assets[assetId], "and so did its asset");
  validateDoc(doc);
});

test("looped music on two layers still satisfies the no-overlap invariant", () => {
  // The case most likely to produce an illegal document: many crossfaded loops.
  const doc = js.baseDocFromClips(CLIPS, canvasForAspect("16:9"));
  const film = js.filmTimeMap(CLIPS.map((c) => c.duration));
  js.applyAudioPlanToDoc(doc, jsPlan({ music: js.planMusic(6, film.duration) }));
  validateDoc(doc);
  const score = doc.tracks.filter((t: any) => MUSIC_TRACK_NAMES.includes(t.name));
  assert(score.length === 2, `${score.length} score tracks — expected both layers in use`);
});

test("fades are clamped so they cannot outlast their clip", () => {
  const doc = js.baseDocFromClips(CLIPS, canvasForAspect("16:9"));
  js.applyAudioPlanToDoc(doc, jsPlan({ music: js.planMusic(60, 2.5) }));
  for (const t of doc.tracks) {
    for (const c of t.clips) {
      assert(c.fadeIn + c.fadeOut <= c.duration + 1e-6, `fades ${c.fadeIn}+${c.fadeOut} > ${c.duration}`);
    }
  }
});

test("a plan with nothing in it leaves a valid document", () => {
  const doc = js.baseDocFromClips(CLIPS, canvasForAspect("16:9"));
  js.applyAudioPlanToDoc(doc, jsPlan({ music: js.planMusic(0, 0), musicUrl: undefined }));
  validateDoc(doc);
  assert(!js.hasPlannedAudio(doc), "nothing was added");
});

test("applying to a non-document throws rather than corrupting it", () => {
  let threw = false;
  try {
    js.applyAudioPlanToDoc({}, jsPlan());
  } catch {
    threw = true;
  }
  assert(threw, "expected a throw");
});

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length > 0) process.exit(1);
