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
  VIDEO_TYPE_CARDS,
  SHORT_FILM_MODES,
  DEFAULT_VIDEO_TYPE,
  LEGACY_VIDEO_TYPE,
  LENGTH_PRICING_GMD,
  GMD_PER_SECOND,
  SCENE_SECONDS,
  FIRST_WIZARD_STEP,
  ProjectLength,
  VideoTypeId,
  defaultLengthFor,
  isShortFilm,
  lengthSeconds,
  projectHref,
  scenesForLength,
  videoType,
  formatRunTime,
  formatRunTimeRange,
  wizardStepsFor,
} from "../app/dashboard/_flow/types";

const require_ = createRequire(import.meta.url);
const server = require_("../functions/optiqSkills/pipeline.js") as {
  FILM_KINDS: Record<string, { id: string; noun: string; register: string; dialogueInVideo: boolean; ttsVoiceover: boolean }>;
  filmKind: (id?: string) => { id: string; dialogueInVideo: boolean; ttsVoiceover: boolean };
  scenesForLength: (length: string) => number;
  SCENE_SECONDS: number;
};

// The OTHER TWO boxes. Ads, original stories and documentaries are built by three
// separate systems that share no code; several checks below exist purely to keep
// them that way.
const story = require_("../functions/optiqStory/pipeline.js") as {
  STORY_VIDEO_TYPE: string;
  STORY_KIND: { id: string; noun: string; register: string; dialogueInVideo: boolean; ttsVoiceover: boolean; branded: boolean };
  scenesForLength: (length: string) => number;
};
const doc = require_("../functions/optiqDocumentary/pipeline.js") as {
  DOCUMENTARY_VIDEO_TYPE: string;
  DOCUMENTARY_KIND: {
    id: string; noun: string; register: string; dialogueInVideo: boolean;
    ttsVoiceover: boolean; branded: boolean; narrationFromScript: boolean;
  };
  scenesForLength: (length: string) => number;
};
// The FOURTH box: the experimental long-form story, the only one that
// photographs a film before it films it.
const storyX = require_("../functions/optiqStoryX/pipeline.js") as {
  STORYX_VIDEO_TYPE: string;
  STORY_KIND: { id: string; noun: string; register: string; dialogueInVideo: boolean; ttsVoiceover: boolean; branded: boolean };
  scenesForLength: (length: string) => number;
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

test("the picker still shows exactly three cards, and the default is one of them", () => {
  // Six types exist, but only three are CARDS: the original story, the
  // experimental original story and the documentary are all reached by picking
  // Short film and then choosing what the film is for. Three across is the
  // picker's whole design — a fourth card pushes it off a phone, which is exactly
  // why the unbranded types live behind the mode screen instead.
  assert(VIDEO_TYPE_CARDS.length === 3, `${VIDEO_TYPE_CARDS.length} cards`);
  assert(VIDEO_TYPES.length === 6, `${VIDEO_TYPES.length} types`);
  assert(VIDEO_TYPE_CARDS.some((t) => t.id === DEFAULT_VIDEO_TYPE), "the default is a card");
});

test("the narrated ad is the default AND sits in the middle card", () => {
  assert(DEFAULT_VIDEO_TYPE === "voiceover-ad", `default is ${DEFAULT_VIDEO_TYPE}`);
  const middle = VIDEO_TYPE_CARDS[Math.floor(VIDEO_TYPE_CARDS.length / 2)];
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

test("card titles are short enough to fit a third of a phone screen", () => {
  // Only the CARDS are held to this — they sit three across. The mode screen is
  // two across, so its titles have twice the room.
  for (const type of VIDEO_TYPE_CARDS) {
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

test("the AD swarm knows the three ad types with the same audio treatment", () => {
  // The story type is deliberately absent here: it belongs to the other box.
  for (const type of VIDEO_TYPES.filter((t) => t.branded)) {
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

// ── THE TWO SANDBOXES ───────────────────────────────────────────────────────
//
// Ads and original stories are built by two completely separate systems. These
// checks are the guard rail on that separation: if someone ever "tidies up" by
// pointing one at the other, the money-making path changes shape and these fail.

test("the story type is unbranded and the three ad types are not", () => {
  assert(videoType("short-film-story").branded === false, "the story must be unbranded");
  for (const id of ["short-film", "dialogue-ad", "voiceover-ad"] as VideoTypeId[]) {
    assert(videoType(id).branded === true, `${id} must stay branded`);
  }
});

test("the story sandbox owns the story type, and only that one", () => {
  assert(story.STORY_VIDEO_TYPE === "short-film-story", `story box answers to ${story.STORY_VIDEO_TYPE}`);
  assert(story.STORY_KIND.branded === false, "the story kind must be unbranded");
  assert(story.STORY_KIND.dialogueInVideo === true, "a story's characters speak on camera");
  assert(story.STORY_KIND.ttsVoiceover === false, "a story gets no TTS voiceover");
});

test("neither box can build the other's films", () => {
  // The ad swarm has never heard of the story type…
  assert(!server.FILM_KINDS["short-film-story"], "the ad swarm must not know the story type");
  // …and the story box exposes exactly one kind, so it cannot be handed an ad.
  assert(story.STORY_KIND.id === "short-film-story", "the story box must expose only its own kind");
});

test("the two boxes share no code", () => {
  // Proved by module identity: if the story pipeline required the ad swarm's
  // modules, these objects would be the same instance out of Node's cache.
  const adCreative = require_("../functions/optiqSkills/creative.js");
  const storyCreative = require_("../functions/optiqStory/creative.js");
  assert(adCreative !== storyCreative, "the two concept rooms must be different modules");
  assert(
    adCreative.CREATIVE_ENGINES !== undefined && storyCreative.CREATIVE_ENGINES === undefined,
    "the story box must not carry the ad swarm's comic engine palette"
  );
  const adIndex = require_("../functions/optiqSkills/index.js");
  const storyIndex = require_("../functions/optiqStory/index.js");
  assert(adIndex.STORY_LIBRARY !== undefined, "the ad swarm keeps its reference film library");
  assert(
    storyIndex.STORY_LIBRARY === undefined,
    "the story box must NOT carry the ad reference library — six client ads is what drags a story back into advertising"
  );
});

test("the documentary sandbox owns the documentary type, and only that one", () => {
  assert(
    doc.DOCUMENTARY_VIDEO_TYPE === "short-film-documentary",
    `documentary box answers to ${doc.DOCUMENTARY_VIDEO_TYPE}`
  );
  assert(doc.DOCUMENTARY_KIND.id === "short-film-documentary", "the doc box must expose only its own kind");
  assert(doc.DOCUMENTARY_KIND.branded === false, "a documentary sells nothing");
  assert(doc.DOCUMENTARY_KIND.dialogueInVideo === false, "a documentary's footage is silent of speech");
  assert(doc.DOCUMENTARY_KIND.ttsVoiceover === true, "a documentary is narrated afterwards");
  assert(
    doc.DOCUMENTARY_KIND.narrationFromScript === true,
    "a documentary's narration is written by the swarm, not invented in audio post"
  );
});

test("the client and the documentary box agree on what a documentary is", () => {
  const client = videoType("short-film-documentary");
  assert(client.branded === doc.DOCUMENTARY_KIND.branded, "branded disagrees");
  assert(client.dialogueInVideo === doc.DOCUMENTARY_KIND.dialogueInVideo, "dialogueInVideo disagrees");
  assert(client.ttsVoiceover === doc.DOCUMENTARY_KIND.ttsVoiceover, "ttsVoiceover disagrees");
  assert(client.card === false, "the documentary is not a card — it lives behind Short film");
  assert(client.audioLabel === "Voiceover + composed score", `audio label is "${client.audioLabel}"`);
});

test("no box can build another box's films", () => {
  // The ad swarm has never heard of any unbranded type…
  assert(!server.FILM_KINDS["short-film-story"], "the ad swarm must not know the story type");
  assert(!server.FILM_KINDS["short-film-story-x"], "the ad swarm must not know the experimental story type");
  assert(!server.FILM_KINDS["short-film-documentary"], "the ad swarm must not know the documentary type");
  // …and each unbranded box exposes exactly one kind, so none can be handed an
  // ad — nor each other's films, since these ids are what index.js routes on.
  assert(story.STORY_KIND.id === "short-film-story", "the story box must expose only its own kind");
  assert(doc.DOCUMENTARY_KIND.id === "short-film-documentary", "the doc box must expose only its own kind");
  assert(storyX.STORY_KIND.id === "short-film-story-x", "the experimental box must expose only its own kind");
  // The two story boxes are the pair most likely to be confused for each other,
  // because one is a copy of the other. They must never answer to the same id:
  // that would route a photographed film to a pipeline with no board, or an
  // ordinary story to one that stops and waits for approval it will never get.
  // Compared as plain strings: these are declared as literal types, so tsc
  // "helpfully" proves the comparison can never be true and errors on it — which
  // would be reassuring if the values came from types rather than from two
  // independently-editable JS files.
  assert(
    String(story.STORY_KIND.id) !== String(storyX.STORY_KIND.id),
    "the two story boxes must not answer to the same videoType"
  );
});

test("the four boxes share no code", () => {
  // Proved by module identity: if one pipeline required another's modules, these
  // objects would be the same instance out of Node's cache.
  const creatives = {
    ad: require_("../functions/optiqSkills/creative.js"),
    story: require_("../functions/optiqStory/creative.js"),
    doc: require_("../functions/optiqDocumentary/creative.js"),
    storyX: require_("../functions/optiqStoryX/creative.js"),
  };
  const names = Object.keys(creatives) as (keyof typeof creatives)[];
  for (let i = 0; i < names.length; i++) {
    for (let j = i + 1; j < names.length; j++) {
      assert(
        creatives[names[i]] !== creatives[names[j]],
        `${names[i]} and ${names[j]} concept rooms must be different modules`
      );
    }
  }

  const docIndex = require_("../functions/optiqDocumentary/index.js");
  assert(
    docIndex.STORY_LIBRARY === undefined,
    "the doc box must NOT carry the ad reference library — six client ads is what drags a documentary into advertising"
  );
  // Each box's craft module belongs to it alone.
  const storyCraft = require_("../functions/optiqStory/storyCraft.js");
  const docCraft = require_("../functions/optiqDocumentary/documentaryCraft.js");
  const storyXCraft = require_("../functions/optiqStoryX/storyCraft.js");
  assert(storyCraft !== docCraft, "the two craft modules must be separate");
  assert(storyCraft !== storyXCraft, "the two story craft modules must be separate");
  assert(storyCraft.ACTS.join() !== docCraft.ACTS.join(), "a story's acts and a documentary's are not the same shape");
});

test("only the experimental box has a shot board, and it is the long-form one", () => {
  // The board was built for every film once and reverted on cost. It lives in
  // exactly one box now; a copy appearing in any other is the revert coming
  // undone, and it would put a hundred images in front of every ad again.
  for (const box of ["optiqSkills", "optiqStory", "optiqDocumentary"]) {
    let found = false;
    try {
      require_(`../functions/${box}/shotBoard.js`);
      found = true;
    } catch {
      /* expected: no such module */
    }
    assert(!found, `${box} must NOT have a shot board — it was reverted for exactly this reason`);
  }
  const brain = require_("../functions/optiqStoryX/shotBoard.js") as {
    framedPromptViolations: (framed: string, scene: { fullPrompt?: string }) => string[];
  };
  assert(typeof brain.framedPromptViolations === "function", "the experimental box must have its board");

  // Only the experimental type offers long run-times, and it must offer the 300s
  // the whole thing was built for.
  const x = videoType("short-film-story-x");
  assert(x.lengths.includes("300s"), "the experimental story must offer 5 minutes");
  assert(x.lengths.includes("600s"), "the experimental story must offer 10 minutes");
  for (const type of VIDEO_TYPES) {
    if (type.id === "short-film-story-x") continue;
    for (const length of type.lengths) {
      assert(
        lengthSeconds(length) <= 180,
        `${type.id} offers ${length}; only the experimental story is long form`
      );
    }
  }
});

test("each film type is routed to its own workspace tree", () => {
  // The board, blueprint and agent screens are shared by both trees, so a link
  // that guesses wrong lands the director on a workspace built for a different
  // kind of film — and because both trees render off the same project id, it
  // fails confusingly rather than loudly. projectHref is the only thing that
  // decides, so this is the only place it has to be right.
  assert(
    projectHref("short-film-story-x", "abc") === "/dashboard/project/story/abc",
    `experimental story went to ${projectHref("short-film-story-x", "abc")}`
  );
  assert(
    projectHref("short-film-story-x", "abc", "board") === "/dashboard/project/story/abc/board",
    "the board must stay inside the story tree"
  );
  assert(
    projectHref("short-film-story-x", "abc", "agent") === "/dashboard/project/story/abc/agent",
    "the agent must stay inside the story tree"
  );
  // Every OTHER type keeps the tree it has always had. An ad quietly moved to
  // /project/story would render a workspace with no reference-image tray.
  for (const type of VIDEO_TYPES) {
    if (type.id === "short-film-story-x") continue;
    assert(
      projectHref(type.id, "abc") === "/dashboard/project/abc",
      `${type.id} must stay on the original tree, got ${projectHref(type.id, "abc")}`
    );
  }
  // A project doc written before this type existed carries no videoType at all.
  assert(projectHref(null, "abc") === "/dashboard/project/abc", "an unknown type falls back to the ad tree");
  assert(projectHref(undefined, "abc") === "/dashboard/project/abc", "a missing type falls back to the ad tree");
});

test("the experimental story's render prompt carries no appearance", () => {
  // The whole trade of this film type: the pictures carry how things look, the
  // words carry everything else. A brief that describes a complexion gives the
  // model two accounts of one thing, and it reconciles them by inventing a third.
  const brain = require_("../functions/optiqStoryX/shotBoard.js") as {
    framedPromptViolations: (framed: string, scene: { fullPrompt?: string }) => string[];
  };
  const scene = { fullPrompt: 'She says "Take it back." and he does not move.' };
  const good = `CAST KEY. Awa — seated left, green wrapper. WHAT HAPPENS. 0.0s she sets the bowl down. 2.0s he stands.
DIALOGUE. Awa (low, unhurried, Wolof-inflected): "Take it back." SOUND. Room tone under everything, the bowl on wood.
NO MUSIC of any kind. CAMERA. Locked.`;
  assert(
    brain.framedPromptViolations(good, scene).every((v) => !/complexion|a face|the film's look/.test(v)),
    "a clean brief must not be flagged for appearance"
  );

  const bad = `${good} Awa has a warm dark-brown complexion and high cheekbones.`;
  const faults = brain.framedPromptViolations(bad, scene);
  assert(
    faults.some((v) => /complexion/.test(v)),
    "a brief that describes a complexion must be caught"
  );
  assert(
    faults.some((v) => /a face/.test(v)),
    "a brief that describes a face must be caught"
  );

  // And the one thing it MUST have: dialogue is worthless if nobody can tell who
  // is speaking, because no character sheet is attached to say.
  const noKey = good.replace("CAST KEY. Awa — seated left, green wrapper.", "");
  assert(
    brain.framedPromptViolations(noKey, scene).some((v) => /CAST KEY/.test(v)),
    "a brief with dialogue and no cast key must be caught"
  );
});

test("nobody under 18 is castable in any box", () => {
  // The palette is the one input the registry reliably builds toward, so an
  // under-age band in any of the three would put a minor in films nobody asked to.
  for (const box of ["optiqSkills", "optiqStory", "optiqDocumentary", "optiqStoryX"]) {
    const casting = require_(`../functions/${box}/casting.js`) as {
      AGE_BANDS: string[];
      minorViolations: (text: string, where?: string) => string[];
      adultsOnlyMandate: () => string;
    };
    for (const band of casting.AGE_BANDS) {
      assert(casting.minorViolations(band).length === 0, `${box} age band "${band}" reads as a minor`);
    }
    assert(
      /EVERYONE ON CAMERA IS AN ADULT/.test(casting.adultsOnlyMandate()),
      `${box} has no adults-only mandate`
    );
    // And the gate itself has to actually fire, or none of the above matters.
    assert(casting.minorViolations("a boy of about 8 runs past").length > 0, `${box} gate misses a child`);
    assert(casting.minorViolations("a 15-year-old sweeps up").length > 0, `${box} gate misses a stated age`);
    assert(casting.minorViolations("a woman in her fifties lifts the crate").length === 0, `${box} gate false-positives`);
  }
});

test("both boxes agree on the scene count, because both charge for it", () => {
  for (const length of ALL_LENGTHS) {
    assert(
      story.scenesForLength(length) === scenesForLength(length),
      `${length}: story box says ${story.scenesForLength(length)}, client says ${scenesForLength(length)}`
    );
    assert(
      doc.scenesForLength(length) === scenesForLength(length),
      `${length}: doc box says ${doc.scenesForLength(length)}, client says ${scenesForLength(length)}`
    );
  }
});

test("a story's wizard skips the brand brief; an ad's does not", () => {
  const storySteps = wizardStepsFor("short-film-story");
  const adSteps = wizardStepsFor("short-film");
  for (const asked of ["brand", "product", "materials"]) {
    assert(!storySteps.includes(asked as never), `a story must never be asked for "${asked}"`);
    assert(adSteps.includes(asked as never), `a short-film ad must still be asked for "${asked}"`);
  }
  const docSteps = wizardStepsFor("short-film-documentary");
  for (const asked of ["brand", "product", "materials"]) {
    assert(!docSteps.includes(asked as never), `a documentary must never be asked for "${asked}"`);
  }
  assert(docSteps.includes("mode"), "the documentary is reached through the mode screen");
  assert(storySteps.includes("mode"), "the story is reached through the mode screen");
  assert(adSteps.includes("mode"), "so is the short-film ad");
  assert(!wizardStepsFor("voiceover-ad").includes("mode"), "the narrated ad has no mode screen");
  assert(!wizardStepsFor("dialogue-ad").includes("mode"), "the dialogue ad has no mode screen");
});

test("every wizard step list starts at the projects screen and ends somewhere real", () => {
  for (const type of VIDEO_TYPES) {
    const steps = wizardStepsFor(type.id);
    assert(steps[0] === FIRST_WIZARD_STEP, `${type.id} does not start at ${FIRST_WIZARD_STEP}`);
    assert(new Set(steps).size === steps.length, `${type.id} repeats a step`);
    // The last step is the one carrying the generate button.
    const last = steps[steps.length - 1];
    assert(
      last === (type.branded ? "materials" : "canvas"),
      `${type.id} ends on "${last}"`
    );
  }
});

test("the short-film mode screen offers the advert first", () => {
  assert(SHORT_FILM_MODES.length === 4, `${SHORT_FILM_MODES.length} modes`);
  assert(SHORT_FILM_MODES[0].id === "short-film", "the advert must come first — it is the default");
  assert(SHORT_FILM_MODES[1].id === "short-film-story", "the story is the second option");
  // The experimental story sits third, next to the ordinary one it is a variant
  // of, and it is the only mode that carries a badge — because it is the only one
  // that behaves differently enough to need a warning before it is picked.
  assert(SHORT_FILM_MODES[2].id === "short-film-story-x", "the experimental story is the third option");
  assert(!!SHORT_FILM_MODES[2].badge, "the experimental mode must be marked as experimental");
  assert(SHORT_FILM_MODES[3].id === "short-film-documentary", "the documentary is the fourth option");
  for (const mode of SHORT_FILM_MODES) {
    assert(isShortFilm(mode.id), `${mode.id} is not a short film`);
    assert(!!videoType(mode.id).clip, `${mode.id} has no cover clip`);
    assert(mode.blurb.length <= 50, `"${mode.blurb}" is too long for the card`);
  }
  const clips = new Set(SHORT_FILM_MODES.map((m) => m.clip));
  assert(clips.size === SHORT_FILM_MODES.length, "no two modes may share a cover clip");
});

test("both halves of the short film offer the same run-times", () => {
  // They are the same format; only the purpose differs. A director who switches
  // from advert to story must not silently lose the length they picked.
  const ad = videoType("short-film").lengths.join(",");
  const storyLengths = videoType("short-film-story").lengths.join(",");
  assert(ad === storyLengths, `advert offers ${ad}, story offers ${storyLengths}`);
});

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length > 0) process.exit(1);
