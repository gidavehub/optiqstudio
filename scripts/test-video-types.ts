/**
 * Video-type test suite. Run: npx -y tsx scripts/test-video-types.ts
 *
 * The scene count and the film kind are decided on BOTH sides — the client
 * (prepaidRenders, pricing, wizard copy) and the swarm (how many scenes to
 * build). If they disagree, a director pays for nine scenes and gets six, so the
 * parity checks here matter more than any single unit test.
 */

import { createRequire } from "node:module";
import {
  VIDEO_TYPES,
  DEFAULT_VIDEO_TYPE,
  LEGACY_VIDEO_TYPE,
  LENGTH_PRICING_GMD,
  GMD_PER_SECOND,
  SCENE_SECONDS,
  ProjectLength,
  VideoTypeId,
  defaultLengthFor,
  lengthSeconds,
  scenesForLength,
  videoType,
  formatRunTime,
  formatRunTimeRange,
} from "../app/dashboard/_flow/types";

const require_ = createRequire(import.meta.url);
const server = require_("../functions/optiqSkills/pipeline.js") as {
  FILM_KINDS: Record<string, { id: string; noun: string; register: string; dialogueInVideo: boolean; ttsVoiceover: boolean }>;
  filmKind: (id?: string) => { id: string; dialogueInVideo: boolean; ttsVoiceover: boolean };
  scenesForLength: (length: string) => number;
  SCENE_SECONDS: number;
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

const ALL_LENGTHS = Object.keys(LENGTH_PRICING_GMD) as ProjectLength[];

// ── Run-times and scene counts ──────────────────────────────────────────────

test("a run-time buys one scene per 10 seconds", () => {
  const expected: Record<string, number> = {
    "30s": 3, "60s": 6, "90s": 9, "120s": 12, "150s": 15, "180s": 18,
  };
  for (const [length, scenes] of Object.entries(expected)) {
    assert(
      scenesForLength(length as ProjectLength) === scenes,
      `${length} → ${scenesForLength(length as ProjectLength)}, expected ${scenes}`
    );
  }
});

test("lengthSeconds parses every offered run-time", () => {
  for (const length of ALL_LENGTHS) {
    const secs = lengthSeconds(length);
    assert(secs > 0, `${length} parsed as ${secs}`);
    assert(secs % SCENE_SECONDS === 0, `${length} is not a whole number of scenes`);
  }
});

test("every run-time is priced at the platform rate", () => {
  for (const length of ALL_LENGTHS) {
    const expected = lengthSeconds(length) * GMD_PER_SECOND;
    assert(
      LENGTH_PRICING_GMD[length] === expected,
      `${length} priced ${LENGTH_PRICING_GMD[length]}, expected ${expected}`
    );
  }
});

test("the original three prices are unchanged", () => {
  // Repricing the existing ads would be a silent change to what people pay.
  assert(LENGTH_PRICING_GMD["30s"] === 450, `30s is ${LENGTH_PRICING_GMD["30s"]}`);
  assert(LENGTH_PRICING_GMD["60s"] === 900, `60s is ${LENGTH_PRICING_GMD["60s"]}`);
  assert(LENGTH_PRICING_GMD["90s"] === 1350, `90s is ${LENGTH_PRICING_GMD["90s"]}`);
});

// ── The three types ─────────────────────────────────────────────────────────

test("there are exactly three types and the default is one of them", () => {
  assert(VIDEO_TYPES.length === 3, `${VIDEO_TYPES.length} types`);
  assert(VIDEO_TYPES.some((t) => t.id === DEFAULT_VIDEO_TYPE), "the default is a real type");
});

test("the narrated ad is the default AND sits in the middle", () => {
  assert(DEFAULT_VIDEO_TYPE === "voiceover-ad", `default is ${DEFAULT_VIDEO_TYPE}`);
  const middle = VIDEO_TYPES[Math.floor(VIDEO_TYPES.length / 2)];
  assert(middle.id === DEFAULT_VIDEO_TYPE, `middle card is ${middle.id}, not the default`);
});

test("a stored value falls back to the DIALOGUE ad, not the wizard default", () => {
  // The bug this prevents: resolving a pre-types project to the narrated kind
  // sets its footage gain to 0 in audio post and silences dialogue the director
  // already paid to render.
  assert(LEGACY_VIDEO_TYPE === "dialogue-ad", `legacy fallback is ${LEGACY_VIDEO_TYPE}`);
  assert(LEGACY_VIDEO_TYPE !== DEFAULT_VIDEO_TYPE, "the two fallbacks must not be the same");
  assert(videoType(undefined).id === LEGACY_VIDEO_TYPE, "unset did not resolve to the legacy kind");
  assert(videoType(undefined).dialogueInVideo, "a legacy film must keep its dialogue");
});

test("titles are short enough to fit a third of a phone screen", () => {
  for (const type of VIDEO_TYPES) {
    assert(type.title.length <= 12, `"${type.title}" is ${type.title.length} chars — too long for the card`);
  }
});

test("every type offers only priced run-times", () => {
  for (const type of VIDEO_TYPES) {
    assert(type.lengths.length > 0, `${type.id} offers no run-times`);
    for (const length of type.lengths) {
      assert(LENGTH_PRICING_GMD[length] !== undefined, `${type.id} offers unpriced ${length}`);
    }
  }
});

test("short films run 60-180s and never 300s", () => {
  // The user's call: 300s means 30 scene-builder calls, which will not finish
  // inside one function invocation. The cap lifts when the job is chunked.
  const film = videoType("short-film");
  assert(film.lengths[0] === "60s", `starts at ${film.lengths[0]}`);
  assert(film.lengths[film.lengths.length - 1] === "180s", `ends at ${film.lengths[film.lengths.length - 1]}`);
  assert(!film.lengths.includes("300s" as ProjectLength), "300s must not be offered yet");
  assert(scenesForLength("180s") === 18, "180s is 18 scenes");
});

test("both ad types run 30/60/90s", () => {
  for (const id of ["dialogue-ad", "voiceover-ad"] as VideoTypeId[]) {
    assert(
      JSON.stringify(videoType(id).lengths) === JSON.stringify(["30s", "60s", "90s"]),
      `${id} offers ${videoType(id).lengths.join("/")}`
    );
  }
});

test("only the narrated type is voiced afterwards", () => {
  const narrated = videoType("voiceover-ad");
  assert(!narrated.dialogueInVideo, "narrated footage carries no dialogue");
  assert(narrated.ttsVoiceover, "narrated films get a TTS voiceover");
  for (const id of ["short-film", "dialogue-ad"] as VideoTypeId[]) {
    assert(videoType(id).dialogueInVideo, `${id} should carry dialogue`);
    assert(!videoType(id).ttsVoiceover, `${id} should not need a TTS voiceover`);
  }
});

test("an unknown or missing type falls back to the dialogue ad", () => {
  for (const bad of [undefined, null, "", "nonsense", "SHORT-FILM"]) {
    assert(videoType(bad as never).id === LEGACY_VIDEO_TYPE, `${String(bad)} did not fall back`);
  }
});

test("run-times read as minutes past a minute, seconds below one", () => {
  const expected: Record<string, string> = {
    "30s": "30s",
    "60s": "1 min",
    "90s": "1 min 30s",
    "120s": "2 min",
    "150s": "2 min 30s",
    "180s": "3 min",
  };
  for (const [length, label] of Object.entries(expected)) {
    assert(
      formatRunTime(length as ProjectLength) === label,
      `${length} → "${formatRunTime(length as ProjectLength)}", expected "${label}"`
    );
  }
});

test("a type's range is one compact label in a single unit", () => {
  assert(formatRunTimeRange(videoType("short-film").lengths) === "1–3 min", formatRunTimeRange(videoType("short-film").lengths));
  assert(formatRunTimeRange(videoType("voiceover-ad").lengths) === "30–90s", formatRunTimeRange(videoType("voiceover-ad").lengths));
  assert(formatRunTimeRange([]) === "", "empty range");
  assert(formatRunTimeRange(["90s"]) === "1 min 30s", formatRunTimeRange(["90s"]));
});

test("switching type always lands on a valid run-time", () => {
  // The wizard bug this prevents: choosing "short film" while 30s is selected
  // leaves an invalid pair, and the paywall then charges for it.
  for (const type of VIDEO_TYPES) {
    const fallback = defaultLengthFor(type.id);
    assert(type.lengths.includes(fallback), `${type.id} falls back to unoffered ${fallback}`);
  }
});

test("every type has the copy the picker renders", () => {
  for (const type of VIDEO_TYPES) {
    for (const field of ["title", "audioLabel", "clip"] as const) {
      assert(!!type[field] && String(type[field]).length > 0, `${type.id} is missing ${field}`);
    }
    assert(type.clip.startsWith("/media/"), `${type.id} clip path looks wrong: ${type.clip}`);
  }
});

test("no two types share a cover clip", () => {
  const clips = VIDEO_TYPES.map((t) => t.clip);
  assert(new Set(clips).size === clips.length, "two types point at the same clip");
});

// ── Client ↔ swarm parity ───────────────────────────────────────────────────

test("scene counts agree between the client and the swarm", () => {
  for (const length of ALL_LENGTHS) {
    assert(
      scenesForLength(length) === server.scenesForLength(length),
      `${length}: client ${scenesForLength(length)} vs swarm ${server.scenesForLength(length)}`
    );
  }
  assert(SCENE_SECONDS === server.SCENE_SECONDS, "scene length disagrees");
});

test("the swarm knows the same three types with the same audio treatment", () => {
  for (const type of VIDEO_TYPES) {
    const kind = server.FILM_KINDS[type.id];
    assert(kind, `the swarm has no film kind "${type.id}"`);
    assert(
      kind.dialogueInVideo === type.dialogueInVideo,
      `${type.id}: dialogueInVideo disagrees (client ${type.dialogueInVideo}, swarm ${kind.dialogueInVideo})`
    );
    assert(
      kind.ttsVoiceover === type.ttsVoiceover,
      `${type.id}: ttsVoiceover disagrees (client ${type.ttsVoiceover}, swarm ${kind.ttsVoiceover})`
    );
  }
});

test("the swarm falls back to the same LEGACY type as the client", () => {
  // Both sides must resolve an unset stored value to the dialogue ad. If the
  // swarm fell back to the wizard's default instead, a pre-types film would be
  // rebuilt as a narrated one and lose its dialogue.
  assert(server.filmKind(undefined).id === LEGACY_VIDEO_TYPE, `swarm fallback is ${server.filmKind(undefined).id}`);
  assert(server.filmKind("nonsense").id === LEGACY_VIDEO_TYPE, "swarm fallback disagrees on junk");
  assert(server.filmKind(undefined).dialogueInVideo, "the swarm's fallback must keep dialogue");
});

test("the swarm's registers say what kind of film each is", () => {
  assert(/SHORT FILM, not a commercial/i.test(server.FILM_KINDS["short-film"].register), "short film register");
  assert(/NOBODY SPEAKS ON CAMERA/i.test(server.FILM_KINDS["voiceover-ad"].register), "narrated register");
});

test("an unparseable run-time still yields a buildable film", () => {
  // A malformed stored length must not produce a zero-scene project.
  assert(server.scenesForLength("") >= 1, "empty length");
  assert(server.scenesForLength("banana") >= 1, "junk length");
  assert(server.scenesForLength(undefined as never) >= 1, "missing length");
});

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length > 0) process.exit(1);
