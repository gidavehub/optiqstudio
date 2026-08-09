/**
 * Audio post-production planner test suite.
 * Run: npx -y tsx scripts/test-audio-plan.ts
 *
 * This is the module where a bug is invisible until somebody watches a finished
 * export and hears two voices at once, or a score that stops 40 seconds early.
 * So the cases here lean on the failures that actually reach a viewer: overlaps,
 * overruns, loop seams, and the refit loop that exists because you cannot ask a
 * TTS model for "4.2 seconds of speech".
 */

import {
  EditorEngine,
  createEmptyDoc,
  validateDoc,
  canvasForAspect,
  filmTimeMap,
  narrationSlots,
  planNarration,
  planMusic,
  planMusicSuite,
  validateAudioPlan,
  applyAudioPlan,
  hasPlannedAudio,
  wordBudget,
  estimateSpeechDuration,
  countWords,
  SPEECH_WPS,
  MIN_SLOT,
  MUSIC_TRACK_NAMES,
  NARRATION_TRACK_NAME,
  AudioPlan,
  NarrationSlot,
  ScannedWindow,
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

// A six-scene film of 10s clips — the shape of a 60s ad.
const SIX_TENS = [10, 10, 10, 10, 10, 10];

// ── The film's time map ─────────────────────────────────────────────────────

test("clips lay end to end into one coordinate system", () => {
  const map = filmTimeMap(SIX_TENS);
  near(map.duration, 60);
  assert(map.scenes.length === 6, `${map.scenes.length} scenes`);
  near(map.scenes[0].start, 0);
  near(map.scenes[3].start, 30);
  near(map.scenes[5].end, 60);
});

test("scenes that never rendered are skipped, not assumed", () => {
  // The bug this prevents: treating a missing clip as 10s shifts every later
  // line of narration out of sync with the picture.
  const map = filmTimeMap([10, null, 10, undefined, 0, 10]);
  near(map.duration, 30);
  assert(map.scenes.length === 3, `${map.scenes.length} scenes`);
  assert(
    map.scenes.map((s) => s.sceneIndex).join(",") === "0,2,5",
    `kept ${map.scenes.map((s) => s.sceneIndex).join(",")}`
  );
  near(map.scenes[1].start, 10);
  near(map.scenes[2].start, 20);
});

test("real-world clip lengths accumulate without drift", () => {
  const map = filmTimeMap([8.04, 8.04, 8.04, 8.04]);
  near(map.duration, 32.16, 1e-9);
  near(map.scenes[3].start, 24.12, 1e-9);
});

test("an empty film has no duration and no scenes", () => {
  const map = filmTimeMap([]);
  near(map.duration, 0);
  assert(map.scenes.length === 0, "no scenes");
});

// ── Word budgets ────────────────────────────────────────────────────────────

test("a word budget fits inside its slot when spoken", () => {
  for (const seconds of [2, 4, 6.5, 10]) {
    const words = wordBudget(seconds);
    const spoken = words / SPEECH_WPS;
    assert(spoken <= seconds, `${words} words takes ${spoken.toFixed(2)}s, slot is ${seconds}s`);
  }
});

test("word budget and duration estimate are inverses", () => {
  const words = wordBudget(8);
  assert(estimateSpeechDuration("word ".repeat(words)) <= 8, "estimate exceeds the slot it was budgeted for");
});

test("countWords ignores padding and punctuation runs", () => {
  assert(countWords("  Buy   the   paste.  ") === 3, `got ${countWords("  Buy   the   paste.  ")}`);
  assert(countWords("") === 0, "empty");
  assert(countWords(null as never) === 0, "null");
});

// ── Slots ───────────────────────────────────────────────────────────────────

test("scanner windows become absolute film-time slots", () => {
  const map = filmTimeMap(SIX_TENS);
  const slots = narrationSlots(map, [
    { sceneIndex: 0, startInScene: 2, endInScene: 7 },
    { sceneIndex: 3, startInScene: 1, endInScene: 6 },
  ]);
  assert(slots.length === 2, `${slots.length} slots`);
  near(slots[0].start, 2);
  near(slots[0].end, 7);
  near(slots[1].start, 31);
  near(slots[1].end, 36);
  assert(slots[0].wordBudget > 0, "a budget was computed");
});

test("a window past the end of its scene is clamped into it", () => {
  const map = filmTimeMap(SIX_TENS);
  const slots = narrationSlots(map, [{ sceneIndex: 0, startInScene: 4, endInScene: 25 }]);
  assert(slots.length === 1, "one slot");
  near(slots[0].end, 10); // not 25 — the scene is only 10s long
});

test("overlapping windows are pushed apart, never left to collide", () => {
  // Two voices at once is the worst thing this pipeline can ship.
  const map = filmTimeMap(SIX_TENS);
  const slots = narrationSlots(map, [
    { sceneIndex: 0, startInScene: 0, endInScene: 8 },
    { sceneIndex: 0, startInScene: 4, endInScene: 10 },
  ]);
  for (let i = 0; i < slots.length - 1; i++) {
    assert(slots[i].end <= slots[i + 1].start + 1e-9, `slot ${i} overlaps ${i + 1}`);
  }
});

test("slots shorter than the floor are dropped", () => {
  const map = filmTimeMap(SIX_TENS);
  const slots = narrationSlots(map, [
    { sceneIndex: 1, startInScene: 0, endInScene: 0.4 },
    { sceneIndex: 2, startInScene: 3, endInScene: 8 },
  ]);
  assert(slots.length === 1, `${slots.length} slots — the sliver should be gone`);
  assert(slots[0].available >= MIN_SLOT, "survivor clears the floor");
});

test("windows for unrendered scenes are ignored", () => {
  const map = filmTimeMap([10, null, 10]);
  const slots = narrationSlots(map, [
    { sceneIndex: 1, startInScene: 1, endInScene: 8 },
    { sceneIndex: 2, startInScene: 1, endInScene: 8 },
  ]);
  assert(slots.length === 1, `${slots.length} slots`);
  assert(slots[0].sceneIndex === 2, "kept the rendered one");
});

test("narration never sits in the film's head or tail room", () => {
  const map = filmTimeMap([10]);
  const slots = narrationSlots(map, [{ sceneIndex: 0, startInScene: 0, endInScene: 10 }]);
  assert(slots[0].start > 0, "clear of the head");
  assert(slots[0].end < 10, "clear of the tail");
});

test("junk windows do not throw", () => {
  const map = filmTimeMap(SIX_TENS);
  const slots = narrationSlots(map, [
    { sceneIndex: 0, startInScene: NaN, endInScene: 5 },
    { sceneIndex: 0, startInScene: 8, endInScene: 2 }, // backwards
    { sceneIndex: 99, startInScene: 1, endInScene: 5 },
  ] as ScannedWindow[]);
  assert(Array.isArray(slots), "returned a list");
});

// ── The refit loop ──────────────────────────────────────────────────────────

function slotsFor(map = filmTimeMap(SIX_TENS)): NarrationSlot[] {
  return narrationSlots(map, [
    { sceneIndex: 0, startInScene: 2, endInScene: 7 }, // 5s
    { sceneIndex: 3, startInScene: 2, endInScene: 7 }, // 5s
  ]);
}

test("a line that fits is placed at the start of its slot", () => {
  // Start, not centre: the slot was cut to a visual beat.
  const slots = slotsFor();
  const plan = planNarration(slots, [
    { slotId: slots[0].id, text: "Made here, by hand.", url: "https://cdn/a.wav", durationSec: 3.1 },
  ]);
  assert(plan.refits.length === 0, `unexpected refits: ${plan.refits.map((r) => r.reason).join("; ")}`);
  assert(plan.placements.length === 1, "one placement");
  near(plan.placements[0].start, slots[0].start);
  near(plan.placements[0].duration, 3.1);
  near(plan.placements[0].slack, slots[0].available - 3.1);
});

test("a line that overruns is refused, not truncated", () => {
  // Truncated narration ends mid-word — worse than none.
  const slots = slotsFor();
  const plan = planNarration(slots, [
    { slotId: slots[0].id, text: "word ".repeat(40), url: "https://cdn/a.wav", durationSec: 9.4 },
  ]);
  assert(plan.placements.length === 0, "nothing was placed");
  assert(plan.refits.length === 1, "one refit");
  const refit = plan.refits[0];
  assert(refit.targetWords < refit.currentWords, `target ${refit.targetWords} should cut ${refit.currentWords}`);
  assert(/past its/.test(refit.reason), `reason reads oddly: ${refit.reason}`);
});

test("the refit budget uses the voice's MEASURED rate, not the generic estimate", () => {
  // A slow reader needs a harder cut than SPEECH_WPS would suggest; guessing
  // again with the generic rate wastes a whole synthesis pass.
  const slots = slotsFor();
  const slow = planNarration(slots, [
    // 20 words took 16s → 1.25 wps, much slower than the 2.58 default.
    { slotId: slots[0].id, text: "word ".repeat(20), url: "https://cdn/a.wav", durationSec: 16 },
  ]).refits[0];
  const generic = wordBudget(slots[0].available);
  assert(slow.targetWords < generic, `measured budget ${slow.targetWords} should be under generic ${generic}`);
});

test("a refit target actually fits when re-read at the same rate", () => {
  const slots = slotsFor();
  const refit = planNarration(slots, [
    { slotId: slots[0].id, text: "word ".repeat(30), url: "https://cdn/a.wav", durationSec: 12 },
  ]).refits[0];
  const measuredWps = 30 / 12;
  assert(
    refit.targetWords / measuredWps <= slots[0].available,
    `${refit.targetWords} words at ${measuredWps} wps still overruns ${slots[0].available}s`
  );
});

test("a line with audio but no url comes back as a refit", () => {
  const slots = slotsFor();
  const plan = planNarration(slots, [{ slotId: slots[0].id, text: "Hello.", durationSec: 1.5 }]);
  assert(plan.placements.length === 0, "not placed");
  assert(/no audio to place/.test(plan.refits[0].reason), plan.refits[0].reason);
});

test("a line that produced no audio comes back as a refit", () => {
  const slots = slotsFor();
  const plan = planNarration(slots, [
    { slotId: slots[0].id, text: "Hello.", url: "https://cdn/a.wav", durationSec: 0 },
  ]);
  assert(/no measurable audio/.test(plan.refits[0].reason), plan.refits[0].reason);
});

test("slots with no line written are reported, not treated as errors", () => {
  const slots = slotsFor();
  const plan = planNarration(slots, [
    { slotId: slots[0].id, text: "Short.", url: "https://cdn/a.wav", durationSec: 1.4 },
  ]);
  assert(plan.unusedSlotIds.length === 1, `${plan.unusedSlotIds.length} unused`);
  assert(plan.unusedSlotIds[0] === slots[1].id, "the right one");
});

test("takes for vanished slots are dropped silently", () => {
  const plan = planNarration(slotsFor(), [
    { slotId: "slot_gone", text: "Hi.", url: "https://cdn/a.wav", durationSec: 1 },
  ]);
  assert(plan.placements.length === 0 && plan.refits.length === 0, "ignored");
});

test("placed lines come back in film order", () => {
  const slots = slotsFor();
  const plan = planNarration(slots, [
    { slotId: slots[1].id, text: "Second.", url: "https://cdn/b.wav", durationSec: 2 },
    { slotId: slots[0].id, text: "First.", url: "https://cdn/a.wav", durationSec: 2 },
  ]);
  assert(plan.placements[0].text === "First.", "sorted by start");
});

// ── The music bed ───────────────────────────────────────────────────────────

test("a track longer than the film is trimmed to it", () => {
  const plan = planMusic(114, 60);
  assert(plan.segments.length === 1, `${plan.segments.length} segments`);
  near(plan.segments[0].duration, 60);
  near(plan.segments[0].srcOut, 60);
  assert(plan.trimmed, "reported as trimmed");
  assert(plan.notes.length === 1, "explained itself");
});

test("a track shorter than the film loops to cover it", () => {
  // Lyria gives no length control — 64s and 114s from the same prompt — so a
  // 180s film has to be covered by repeats.
  const plan = planMusic(64, 180);
  assert(plan.segments.length >= 3, `${plan.segments.length} segments for 180s from 64s`);
  const last = plan.segments[plan.segments.length - 1];
  near(last.start + last.duration, 180, 1e-6);
});

test("music never runs past the end of the film", () => {
  for (const [track, film] of [[64, 180], [30, 90], [114, 60], [45, 47], [10, 180]]) {
    const plan = planMusic(track, film);
    for (const seg of plan.segments) {
      assert(seg.start + seg.duration <= film + 1e-6, `${track}s→${film}s: segment overruns`);
    }
  }
});

test("looped segments alternate layers so repeats can crossfade", () => {
  // Consecutive repeats must OVERLAP to crossfade, and one track forbids
  // overlaps — hence two layers.
  const plan = planMusic(30, 120);
  assert(plan.segments.length > 2, "several loops");
  for (let i = 0; i < plan.segments.length - 1; i++) {
    assert(plan.segments[i].layer !== plan.segments[i + 1].layer, `segments ${i}/${i + 1} share a layer`);
  }
  // And they genuinely overlap, which is what makes the seam inaudible.
  const a = plan.segments[0];
  assert(a.start + a.duration > plan.segments[1].start + 1e-6, "repeats do not overlap");
});

test("same-layer segments never overlap each other", () => {
  const plan = planMusic(30, 150);
  for (const layer of [0, 1] as const) {
    const onLayer = plan.segments.filter((s) => s.layer === layer).sort((x, y) => x.start - y.start);
    for (let i = 0; i < onLayer.length - 1; i++) {
      assert(
        onLayer[i].start + onLayer[i].duration <= onLayer[i + 1].start + 1e-6,
        `layer ${layer} overlaps at segment ${i}`
      );
    }
  }
});

test("the film fades in at the start and out at the end", () => {
  const plan = planMusic(64, 180);
  assert(plan.segments[0].fadeIn > 0, "fades in");
  assert(plan.segments[plan.segments.length - 1].fadeOut > 0, "fades out");
});

test("fades cannot outlast a very short film", () => {
  const plan = planMusic(60, 3);
  for (const seg of plan.segments) {
    assert(seg.fadeIn + seg.fadeOut <= seg.duration + 1e-6, "fades outlast the clip");
  }
});

test("music ducks under narration", () => {
  const withVo = planMusic(64, 60, { hasNarration: true });
  const alone = planMusic(64, 60, { hasNarration: false });
  assert(withVo.gain < alone.gain, `${withVo.gain} should duck below ${alone.gain}`);
});

test("a runaway loop count is capped and says so", () => {
  const plan = planMusic(5, 600, { maxLoops: 4 });
  assert(plan.segments.length <= 4, `${plan.segments.length} segments`);
  assert(plan.notes.some((n) => /capped/.test(n)), "explained the cap");
});

test("a missing track or film yields no music, not a crash", () => {
  for (const [t, f] of [[0, 60], [64, 0], [-5, 60], [NaN, 60]]) {
    const plan = planMusic(t, f);
    assert(plan.segments.length === 0, `${t}/${f} produced segments`);
    assert(plan.notes.length > 0, "explained itself");
  }
});

test("a crossfade can never exceed the track it is fading", () => {
  const plan = planMusic(4, 60, { crossfade: 30 });
  for (const seg of plan.segments) {
    assert(seg.fadeIn <= seg.duration + 1e-6 && seg.fadeOut <= seg.duration + 1e-6, "fade longer than segment");
  }
});

// ── The suite (long films) ──────────────────────────────────────────────────
//
// A five-minute film scored by one looped 60s track is that track five times,
// and by the third repeat it is the loudest thing in the film. So long films get
// several composed pieces laid end to end instead.

const FIVE_PIECES = [
  { url: "https://cdn/m1.mp3", duration: 60 },
  { url: "https://cdn/m2.mp3", duration: 75 },
  { url: "https://cdn/m3.mp3", duration: 52 },
  { url: "https://cdn/m4.mp3", duration: 60 },
  { url: "https://cdn/m5.mp3", duration: 68 },
];

test("a suite lays its pieces in order, each once, and covers the film", () => {
  const plan = planMusicSuite(FIVE_PIECES, 300);
  assert(plan.segments.length >= 5, `${plan.segments.length} segments`);
  const order = plan.segments.map((s) => s.url);
  // In order, and the first five are the five pieces as composed.
  for (let i = 0; i < 5; i++) {
    assert(order[i] === FIVE_PIECES[i].url, `piece ${i + 1} is out of order`);
  }
  const last = plan.segments[plan.segments.length - 1];
  assert(Math.abs(last.start + last.duration - 300) < 0.01, "the suite does not reach the end of the film");
  assert(plan.segments[0].start === 0, "the suite does not start at the top of the film");
});

test("consecutive pieces alternate layers, so their crossfade is a real overlap", () => {
  // Two segments on ONE track may never overlap (validateDoc forbids it), so a
  // butt-join would be the only alternative — and a butt-join is audible.
  const plan = planMusicSuite(FIVE_PIECES, 300);
  for (let i = 1; i < plan.segments.length; i++) {
    assert(plan.segments[i].layer !== plan.segments[i - 1].layer, `segments ${i - 1}/${i} share a layer`);
    assert(
      plan.segments[i].start < plan.segments[i - 1].start + plan.segments[i - 1].duration,
      `segments ${i - 1}/${i} are butt-joined rather than crossfaded`
    );
  }
  for (const layer of [0, 1]) {
    const onLayer = plan.segments.filter((s) => s.layer === layer).sort((a, b) => a.start - b.start);
    for (let i = 1; i < onLayer.length; i++) {
      assert(
        onLayer[i - 1].start + onLayer[i - 1].duration <= onLayer[i].start + 1e-6,
        `two segments overlap on layer ${layer}`
      );
    }
  }
});

test("a suite shorter than the film holds on its last piece rather than going silent", () => {
  // Silence under the ending is the worst place to run out of score.
  const plan = planMusicSuite(FIVE_PIECES, 600);
  const last = plan.segments[plan.segments.length - 1];
  assert(Math.abs(last.start + last.duration - 600) < 0.01, "the film ends with no score under it");
  assert(last.url === FIVE_PIECES[4].url, "the tail must be carried by the final piece");
});

test("a suite longer than the film stops when the film does", () => {
  const plan = planMusicSuite(FIVE_PIECES, 90);
  const last = plan.segments[plan.segments.length - 1];
  assert(Math.abs(last.start + last.duration - 90) < 0.01, "the score runs past the film");
  assert(plan.trimmed, "a trimmed suite must say so");
  assert(plan.notes.some((n) => /only needed/.test(n)), "unused pieces should be reported");
});

test("one piece is not a suite — it falls back to looping, and still names its source", () => {
  const plan = planMusicSuite([FIVE_PIECES[0]], 180);
  assert(plan.segments.length > 1, "a 60s piece under a 180s film must repeat");
  assert(plan.segments.every((s) => s.url === FIVE_PIECES[0].url), "every segment must name its source");
});

test("a suite with nothing usable lays no music and says why", () => {
  for (const bad of [[], [{ url: "", duration: 60 }], [{ url: "https://x", duration: 0 }]]) {
    const plan = planMusicSuite(bad, 300);
    assert(plan.segments.length === 0, "music was laid from an unusable track");
    assert(plan.notes.length > 0, "a silent film must explain itself");
  }
  assert(planMusicSuite(FIVE_PIECES, 0).segments.length === 0, "a film with no duration gets no score");
});

test("a suite fades the film in at the top and out at the bottom", () => {
  const plan = planMusicSuite(FIVE_PIECES, 300);
  const first = plan.segments[0];
  const last = plan.segments[plan.segments.length - 1];
  assert(first.fadeIn > 0, "the score must fade in");
  assert(last.fadeOut > 0, "the score must fade out");
  for (const seg of plan.segments) {
    assert(seg.fadeIn <= seg.duration + 1e-6 && seg.fadeOut <= seg.duration + 1e-6, "fade longer than segment");
  }
});

test("a suite applies as several assets on the timeline, and the document stays legal", () => {
  const engine = new EditorEngine(createEmptyDoc(canvasForAspect("16:9")));
  const plan = planMusicSuite(FIVE_PIECES, 300);
  applyAudioPlan(engine, {
    film: filmTimeMap(Array(30).fill(10)),
    narration: [],
    music: plan,
    footageGain: 3,
    musicUrl: FIVE_PIECES[0].url,
  });
  const doc = engine.getDoc();
  validateDoc(doc);
  // MUSIC_TRACK_NAMES is a narrow tuple type, so `.includes(t.name)` does not
  // typecheck against a plain string. Widened rather than cast at the call site.
  const musicTrackNames: string[] = [...MUSIC_TRACK_NAMES];
  const scoreTracks = doc.tracks.filter((t) => musicTrackNames.includes(t.name));
  const urls = new Set(scoreTracks.flatMap((t) => t.clips.map((c) => doc.assets[c.assetId].url)));
  assert(urls.size === 5, `${urls.size} distinct score assets, expected 5`);
  for (const t of scoreTracks) assert(t.volume === plan.gain, "a score track is at the wrong gain");
});

// ── Plan validation (the self-review pass) ──────────────────────────────────

function planWith(overrides: Partial<AudioPlan> = {}): AudioPlan {
  return {
    film: filmTimeMap(SIX_TENS),
    narration: [],
    music: planMusic(64, 60),
    footageGain: 1,
    musicUrl: "https://cdn/score.mp3",
    ...overrides,
  };
}

test("a clean plan reports nothing", () => {
  const v = validateAudioPlan(planWith());
  assert(v.length === 0, `unexpected: ${v.map((x) => x.message).join("; ")}`);
});

test("validation catches two voices at once", () => {
  const v = validateAudioPlan(
    planWith({
      narration: [
        { slotId: "a", sceneIndex: 0, text: "One", url: "u", start: 2, duration: 6, slack: 0 },
        { slotId: "b", sceneIndex: 0, text: "Two", url: "u", start: 5, duration: 3, slack: 0 },
      ],
    })
  );
  assert(v.some((x) => x.kind === "overlap"), `no overlap found: ${v.map((x) => x.message).join("; ")}`);
});

test("validation catches narration past the end of the film", () => {
  const v = validateAudioPlan(
    planWith({
      narration: [{ slotId: "a", sceneIndex: 5, text: "Late", url: "u", start: 58, duration: 6, slack: 0 }],
    })
  );
  assert(v.some((x) => x.kind === "bounds"), "no bounds violation");
});

test("validation catches an empty film", () => {
  const v = validateAudioPlan(planWith({ film: filmTimeMap([]) }));
  assert(v.some((x) => x.kind === "empty"), "no empty violation");
});

test("validation catches music running long", () => {
  const music = planMusic(64, 60);
  music.segments[0].duration = 90;
  const v = validateAudioPlan(planWith({ music }));
  assert(v.some((x) => x.kind === "overrun"), "no overrun violation");
});

// ── Writing it onto the timeline ────────────────────────────────────────────

function filmDoc() {
  const engine = new EditorEngine(createEmptyDoc({ ...canvasForAspect("9:16") }));
  const videoTrack = engine.getDoc().tracks.find((t) => t.kind === "video")!.id;
  SIX_TENS.forEach((d, i) => {
    const assetId = engine.addAsset({
      kind: "video",
      url: `https://cdn/scene${i}.mp4`,
      duration: d,
      label: `Scene ${i + 1}`,
      sceneIndex: i,
    });
    engine.insertClip(videoTrack, { assetId, start: i * d, duration: d });
  });
  return engine;
}

test("applying a plan puts music and narration on the timeline", () => {
  const engine = filmDoc();
  const slots = slotsFor();
  const narration = planNarration(slots, [
    { slotId: slots[0].id, text: "Made here.", url: "https://cdn/vo1.wav", durationSec: 2.5 },
    { slotId: slots[1].id, text: "By hand.", url: "https://cdn/vo2.wav", durationSec: 2 },
  ]).placements;

  applyAudioPlan(engine, planWith({ narration, footageGain: 0 }));
  const doc = engine.getDoc();
  validateDoc(doc);

  const vo = doc.tracks.find((t) => t.name === NARRATION_TRACK_NAME);
  assert(vo && vo.clips.length === 2, "two narration clips");
  const score = doc.tracks.filter((t) => MUSIC_TRACK_NAMES.includes(t.name as never));
  assert(score.length >= 1, "a score track exists");
  assert(hasPlannedAudio(doc), "planner audio detected");
  // The film's own duration must not grow: audio fits inside the picture.
  near(doc.duration, 60);
});

test("a narrated film silences the footage; a dialogue film keeps it", () => {
  const silent = filmDoc();
  applyAudioPlan(silent, planWith({ footageGain: 0 }));
  for (const t of silent.getDoc().tracks) {
    if (t.kind === "video") near(t.volume, 0);
  }
  const spoken = filmDoc();
  applyAudioPlan(spoken, planWith({ footageGain: 1 }));
  for (const t of spoken.getDoc().tracks) {
    if (t.kind === "video") near(t.volume, 1);
  }
});

test("re-applying replaces the planner's audio instead of stacking it", () => {
  // Re-scoring a film must not leave three copies of the music playing.
  const engine = filmDoc();
  const plan = planWith();
  applyAudioPlan(engine, plan);
  const firstCount = engine.getDoc().tracks.length;
  applyAudioPlan(engine, plan);
  applyAudioPlan(engine, plan);
  assert(engine.getDoc().tracks.length === firstCount, `tracks grew to ${engine.getDoc().tracks.length}`);
  validateDoc(engine.getDoc());
});

test("applying never disturbs the director's own audio track", () => {
  const engine = filmDoc();
  const mine = engine.addTrack("audio", "My SFX");
  const assetId = engine.addAsset({ kind: "audio", url: "https://cdn/sfx.wav", duration: 3 });
  engine.insertClip(mine, { assetId, start: 5, duration: 3 });
  applyAudioPlan(engine, planWith());
  applyAudioPlan(engine, planWith());
  const kept = engine.getDoc().tracks.find((t) => t.name === "My SFX");
  assert(kept && kept.clips.length === 1, "the director's clip survived");
});

test("the applied document is renderable", () => {
  const engine = filmDoc();
  const slots = slotsFor();
  const narration = planNarration(slots, [
    { slotId: slots[0].id, text: "Made here.", url: "https://cdn/vo1.wav", durationSec: 2.5 },
  ]).placements;
  applyAudioPlan(engine, planWith({ narration, music: planMusic(30, 60), footageGain: 0 }));
  validateDoc(engine.getDoc());
  const doc = engine.getDoc();
  // Fades survived onto the clips — a bed with no fades is the tell that the
  // insert path silently dropped them.
  const score = doc.tracks.filter((t) => MUSIC_TRACK_NAMES.includes(t.name as never));
  const faded = score.flatMap((t) => t.clips).some((c) => c.fadeIn > 0 || c.fadeOut > 0);
  assert(faded, "no fades reached the timeline");
});

test("a plan with no music and no narration is still safe to apply", () => {
  const engine = filmDoc();
  applyAudioPlan(engine, planWith({ music: planMusic(0, 0), musicUrl: undefined, footageGain: 1 }));
  validateDoc(engine.getDoc());
  assert(!hasPlannedAudio(engine.getDoc()), "nothing was added");
});

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length > 0) process.exit(1);
