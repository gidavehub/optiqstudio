/**
 * No-music policy test suite. Run: node scripts/test-sound-policy.mjs
 *
 * Covers functions/optiqSkills/soundPolicy.js. The interesting part is the
 * negation detection: "absolutely no music, no melody" must PASS while "a warm
 * kora melody builds" must FAIL, and a film prompt is full of words that look
 * musical but aren't ("a drum of oil", "he scores", "the story beat").
 */

import { createRequire } from "node:module";

const require_ = createRequire(import.meta.url);
const {
  noMusicMandate,
  NO_MUSIC_RESTATEMENT,
  silenceSpecDirective,
  sceneSoundViolations,
  registrySoundViolations,
  affirmativeMusic,
  noMusicAssertions,
} = require_("../functions/optiqSkills/soundPolicy.js");

let passed = 0;
const failures = [];

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ok  ${name}`);
  } catch (err) {
    failures.push(name);
    console.error(`FAIL  ${name}\n      ${err?.message ?? err}`);
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

// ── The mandate ─────────────────────────────────────────────────────────────

test("the mandate is roughly the 200 words the brief asked for", () => {
  const words = noMusicMandate().split(/\s+/).filter(Boolean).length;
  assert(words >= 180 && words <= 300, `mandate is ${words} words, expected ~200`);
});

test("the mandate allows dialogue by default and forbids it when muted", () => {
  assert(/spoken dialogue/.test(noMusicMandate()), "default type keeps dialogue");
  const muted = noMusicMandate({ allowDialogue: false });
  assert(/NO SPEECH either/.test(muted), "the muted type forbids speech too");
  assert(/no voiceover/.test(muted), "and names voiceover explicitly");
});

test("the mandate itself passes its own gate", () => {
  // If the injected text failed the gate, every scene would fail forever.
  assert(
    affirmativeMusic(noMusicMandate()).length === 0,
    `the mandate reads as asking for music: ${affirmativeMusic(noMusicMandate()).join(", ")}`
  );
  assert(noMusicAssertions(noMusicMandate()) >= 1, "the mandate asserts the rule");
});

test("the restatement and the registry directive pass the gate too", () => {
  assert(affirmativeMusic(NO_MUSIC_RESTATEMENT).length === 0, "restatement is clean");
  const directive = silenceSpecDirective(250, 300);
  assert(affirmativeMusic(directive).length === 0, `directive not clean: ${affirmativeMusic(directive).join(", ")}`);
  assert(/250–300 words/.test(directive), "the directive carries the word budget");
});

// ── Negation detection ──────────────────────────────────────────────────────

test("a long negated clause passes in full", () => {
  const text =
    "ABSOLUTE RULES: absolutely no music of any kind, no soundtrack, no melody, no instrumental bed, " +
    "no humming, no singing, no kora, no piano, no percussion groove.";
  assert(affirmativeMusic(text).length === 0, `flagged: ${affirmativeMusic(text).join(", ")}`);
});

test("an affirmative music instruction is caught", () => {
  const found = affirmativeMusic("A warm kora melody builds gently under the action at 90 BPM.");
  assert(found.includes("kora"), `expected kora, got ${found.join(", ")}`);
  assert(found.includes("melody"), `expected melody, got ${found.join(", ")}`);
});

test("stating the rule then contradicting it is caught", () => {
  const text = "There is no music in this clip. A soft piano motif rises as she turns.";
  const found = affirmativeMusic(text);
  assert(found.includes("piano"), `the contradiction must be caught, got ${found.join(", ")}`);
});

test("innocent film vocabulary is not mistaken for music", () => {
  // Every one of these is normal prompt language and must not fail a scene.
  const text = [
    "He rolls a rusted metal drum of groundnut oil across the yard.",
    "The boy scores, and the ball hits the back of the net.",
    "Each story beat lands on a physical event.",
    "She snaps a rubber band around the bundle of notes.",
    "The tempo of the cutting quickens across the last two beats.",
    "His heart is beating hard as he reaches the gate.",
    "A tuning fork of light falls across the counter.",
    "The band of shade under the awning moves as the sun climbs.",
  ].join(" ");
  const found = affirmativeMusic(text);
  assert(found.length === 0, `false positives: ${found.join(", ")}`);
});

test("assertion counting sees each distinct phrasing", () => {
  assert(noMusicAssertions("no music") === 1, "one");
  assert(noMusicAssertions("NO MUSIC ... musically silent ... no soundtrack") === 3, "three");
  assert(noMusicAssertions("a lovely tune") === 0, "none");
});

// ── The scene gate ──────────────────────────────────────────────────────────

const cleanScene = `
=== ABSOLUTE RULES === NO MUSIC of any kind in this clip: no soundtrack, no melody,
no instrumental bed, no humming or singing, no music from any radio or speaker.
=== SOUND === The clip carries NO MUSIC. Musically silent throughout; with no score
under it the yard's own noise carries everything — corrugate ticking in the heat, a
generator two compounds away, sandals on packed sand. Close, dry. Voiceover separate.
Event sounds: the drum's rim scraping concrete, oil slapping inside it, his breath.
=== CLOSING === ${NO_MUSIC_RESTATEMENT}
`;

test("a properly written scene passes", () => {
  const v = sceneSoundViolations(cleanScene);
  assert(v.length === 0, `expected clean, got: ${v.join(" | ")}`);
});

test("a scene that never forbids music fails", () => {
  const v = sceneSoundViolations("=== SOUND === Footsteps on sand, cloth, distant traffic.");
  assert(v.some((x) => /never forbids music/.test(x)), `expected the missing-rule fault: ${v.join(" | ")}`);
});

test("a scene asserting the rule only once fails on repetition", () => {
  const v = sceneSoundViolations("=== SOUND === No music. Footsteps on sand, cloth, distant traffic.");
  assert(
    v.some((x) => /asserted only 1 time/.test(x)),
    `expected the repetition fault: ${v.join(" | ")}`
  );
});

test("a scene asking for a score fails even if it also forbids it", () => {
  const v = sceneSoundViolations(
    `NO MUSIC. Musically silent. No soundtrack. But a triumphant string swell rises at the payoff.`
  );
  assert(v.some((x) => /asks for music/.test(x)), `expected the affirmative fault: ${v.join(" | ")}`);
});

// ── The registry gate ───────────────────────────────────────────────────────

test("a silence-locking sound spec passes", () => {
  const v = registrySoundViolations({
    soundSpec:
      "There is NO MUSIC in this film — no soundtrack, no melody, no instrumental bed, nothing tonal. " +
      "The musical silence makes the compound's own noise the whole soundtrack: corrugate ticking, a " +
      "generator two compounds away, the road beyond the wall. Close, dry, unprocessed, no reverb tail.",
    ambienceSpec: "Low generator hum, distant road, corrugate ticking in the heat.",
  });
  assert(v.length === 0, `expected clean, got: ${v.join(" | ")}`);
});

test("a music-specifying sound spec is caught before any scene is built", () => {
  const v = registrySoundViolations({
    soundSpec:
      "A warm optimistic kora melody at 92 BPM, layered with soft djembe percussion, building through " +
      "the film to a bright resolving chord under the brand card.",
    ambienceSpec: "Street noise.",
  });
  assert(v.some((x) => /specifies music/.test(x)), `expected the music fault: ${v.join(" | ")}`);
  assert(v.some((x) => /never states that there is no music/.test(x)), `expected the missing-rule fault too`);
});

test("a missing ambience spec is caught", () => {
  const v = registrySoundViolations({
    soundSpec: "NO MUSIC of any kind; musically silent, the room's own noise carries everything.",
  });
  assert(v.some((x) => /no ambience spec/.test(x)), `expected the ambience fault: ${v.join(" | ")}`);
});

test("an absent sound spec does not throw", () => {
  assert(registrySoundViolations({}).length === 0, "no spec, nothing to check");
  assert(registrySoundViolations(null).length === 0, "null registry");
});

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length > 0) process.exit(1);
