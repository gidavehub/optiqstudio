/**
 * Creative-brain + per-scene-casting test. Run: node scripts/test-creative-pipeline.mjs
 *
 * Two halves.
 *
 * The pure half covers functions/optiqSkills/creative.js — the density gate that
 * decides whether a storyline is packed or dead — and the per-scene casting logic
 * in casting.js.
 *
 * The wiring half drives the REAL runOptiqSkillsPipeline with Vertex stubbed out,
 * capturing every system prompt the swarm builds. That is the only way to prove
 * the thing that actually matters: that a scene written to have nobody in it does
 * not get handed the film's locked cast. A unit test on the helper cannot show
 * that, because the bug was always in the wiring.
 */

import { createRequire } from "node:module";

const require_ = createRequire(import.meta.url);
const {
  drawProvocation,
  conceptDirective,
  densityLaw,
  storylineDensityViolations,
  scenePromptDensityViolations,
  beatCount,
  oneShotAllowance,
  MIN_BEATS_PER_SCENE,
} = require_("../functions/optiqSkills/creative.js");
const {
  sceneCasting,
  sceneCastingViolations,
  charactersForBeat,
  recurringCharacterNames,
} = require_("../functions/optiqSkills/casting.js");
const { runOptiqSkillsPipeline, reviseScene } = require_("../functions/optiqSkills/pipeline.js");

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

// ── THE PROVOCATION ─────────────────────────────────────────────────────────

test("a seed reproduces its provocation exactly", () => {
  const a = JSON.stringify(drawProvocation("proj_abc"));
  const b = JSON.stringify(drawProvocation("proj_abc"));
  assert(a === b, "a resumed generation must chase the same idea");
});

test("different films get different provocations", () => {
  const seen = new Set();
  for (let i = 0; i < 12; i++) seen.add(JSON.stringify(drawProvocation(`proj_${i}`)));
  assert(seen.size >= 10, `only ${seen.size}/12 distinct — the draw has collapsed`);
});

test("the provocation does not march in lockstep with the casting palette", () => {
  // Both draw off the project id. Without the salt they pick the same indexes.
  const { drawCastingPalette } = require_("../functions/optiqSkills/casting.js");
  const cast = drawCastingPalette("proj_1", 3);
  const creative = drawProvocation("proj_1");
  assert(cast.complexions.length > 0 && creative.engines.length === 3, "both drew");
  const other = drawProvocation("proj_2");
  assert(JSON.stringify(creative) !== JSON.stringify(other), "salted draws diverge");
});

test("the concept room demands the losers, not just a winner", () => {
  const text = conceptDirective("proj_1", { kind: { id: "dialogue-ad", noun: "ad" }, numScenes: 6 });
  assert(/genuinely DIFFERENT concepts/.test(text), "asks for several");
  assert(/NOT LITERAL/.test(text), "bans the literal idea");
  assert(/eventDensity/.test(text), "demands a counted event list");
});

test("a narrated film's concept brief bans ideas that need explaining", () => {
  const narrated = conceptDirective("p", {
    kind: { id: "voiceover-ad", noun: "narrated ad", dialogueInVideo: false },
    numScenes: 6,
  });
  assert(/NOBODY SPEAKS ON CAMERA/.test(narrated), "states the constraint");
  assert(/disqualified/.test(narrated), "makes it a disqualification, not a note");
});

// ── THE DENSITY GATE ────────────────────────────────────────────────────────

const deadScene = {
  sceneNumber: 2,
  purpose: "establish",
  moment: "She carries a cup across the room and sets it down on the table.",
  location: "kitchen",
  castingMode: "recurring",
  charactersPresent: ["Fatou"],
  productPresent: true,
  cuts: [{ time: "0-10s", shot: "She carries the cup across the room." }],
};

const packedScene = {
  sceneNumber: 2,
  purpose: "escalate",
  moment: "The lid sticks. She wrenches it, steam hits her face, she swears, the boy is already holding out the cloth, she snatches it without looking.",
  location: "kitchen",
  castingMode: "recurring",
  charactersPresent: ["Fatou"],
  productPresent: true,
  cuts: [
    { time: "0-2s", shot: "Her hands wrench the stuck lid." },
    { time: "2-5s", shot: "Steam hits her face; she recoils and swears." },
    { time: "5-8s", shot: "The boy is already holding the cloth out." },
    { time: "8-10s", shot: "She snatches it without looking at him." },
  ],
};

test("a ten-second scene with one action is caught as dead", () => {
  const v = storylineDensityViolations({ sceneBeats: [deadScene] }, { numScenes: 1 });
  assert(v.length > 0, "the cup-carrying scene must not pass");
  assert(/only 1 beat/.test(v[0]), `expected a beat count, got: ${v[0]}`);
});

test("a packed scene passes", () => {
  const v = storylineDensityViolations(
    { sceneBeats: [{ ...packedScene, sceneNumber: 2 }, { ...packedScene, sceneNumber: 3 }] },
    { numScenes: 2 }
  );
  assert(v.length === 0, `a packed film was flagged: ${v.join(" | ")}`);
});

test("mood language is caught where it is cheap to fix", () => {
  const v = storylineDensityViolations(
    {
      sceneBeats: [
        { ...packedScene, moment: "She gazes out at the compound, establishing her hard work." },
      ],
    },
    { numScenes: 1 }
  );
  assert(v.some((x) => /mood, not as a moment/.test(x)), `not caught: ${v.join(" | ")}`);
});

test("scene 1 is held to a higher bar than the rest", () => {
  const opener = { ...packedScene, sceneNumber: 1, cuts: packedScene.cuts.slice(0, 3) };
  const v = storylineDensityViolations({ sceneBeats: [opener] }, { numScenes: 1 });
  assert(v.some((x) => /busiest scene/.test(x)), `the opener got a free pass: ${v.join(" | ")}`);
});

test("one-shot scenes are allowed, but not as the default", () => {
  assert(oneShotAllowance(9) === 3, `9-scene allowance should be 3, got ${oneShotAllowance(9)}`);
  assert(oneShotAllowance(1) === 1, "a one-scene film may be one shot");
  const beats = Array.from({ length: 8 }, (_, i) => ({ ...deadScene, sceneNumber: i + 2 }));
  const v = storylineDensityViolations({ sceneBeats: beats }, { numScenes: 8 });
  assert(v.some((x) => /single uncut shot/.test(x)), `the all-static film passed: ${v.join(" | ")}`);
});

test("beatCount reads prose when no cuts were planned", () => {
  assert(beatCount({ moment: "He drops it. She catches it. They both freeze." }) === 3, "counted clauses");
  assert(beatCount({ cuts: [{ shot: "a" }, { shot: "b" }] }) === 2, "counted cuts");
});

test("a built prompt with one timestamp is flagged", () => {
  const thin = scenePromptDensityViolations({ fullPrompt: "ACTION: 0.0s she lifts the cup and walks." });
  assert(thin.length === 1, "one timestamp is not a scene");
  const full = scenePromptDensityViolations({
    fullPrompt: "ACTION: 0.0s lid. 2.5s steam. 5.0s cloth. 8.0s snatch.",
  });
  assert(full.length === 0, `a timed scene was flagged: ${full.join(" | ")}`);
});

// ── PER-SCENE CASTING ───────────────────────────────────────────────────────

const registry = {
  characters: [
    { name: "Fatou", role: "lead", lcb: "FATOU — a Black Gambian woman…", wardrobe: "TEAL wrapper", scenes: [1, 2] },
    { name: "Ousman", role: "son", lcb: "OUSMAN — a Black Gambian boy…", wardrobe: "YELLOW jersey", scenes: [1] },
  ],
};

test("a scene with nobody in it gets nobody, not the whole cast", () => {
  const empty = { sceneNumber: 5, castingMode: "no-people", charactersPresent: [] };
  assert(charactersForBeat(registry, empty).length === 0, "the old fallback pasted every character here");
  const fresh = { sceneNumber: 6, castingMode: "fresh-faces", charactersPresent: [] };
  assert(charactersForBeat(registry, fresh).length === 0, "fresh faces carry no locks");
});

test("a recurring scene still gets its locks", () => {
  const beat = { sceneNumber: 1, castingMode: "recurring", charactersPresent: ["Fatou"] };
  const who = charactersForBeat(registry, beat);
  assert(who.length === 2, `expected Fatou (named) + Ousman (registry scene 1), got ${who.length}`);
});

test("a storyline written before casting modes existed still works", () => {
  assert(sceneCasting({ charactersPresent: ["Fatou"] }) === "recurring", "named people means recurring");
  assert(sceneCasting({}) === "recurring", "an unset mode is safe, not empty");
  assert(sceneCasting({ castingMode: "NO-PEOPLE" }) === "no-people", "case tolerated");
});

test("contradictions between mode and cast list are caught", () => {
  const v = sceneCastingViolations([
    { sceneNumber: 1, castingMode: "no-people", charactersPresent: ["Fatou"] },
    { sceneNumber: 2, castingMode: "fresh-faces", charactersPresent: ["Ousman"] },
    { sceneNumber: 3, castingMode: "recurring", charactersPresent: [] },
    { sceneNumber: 4, castingMode: "recurring", charactersPresent: ["Fatou"] },
  ]);
  assert(v.length === 3, `expected 3 contradictions, got ${v.length}: ${v.join(" | ")}`);
});

test("only recurring scenes decide who needs a lock", () => {
  const names = recurringCharacterNames([
    { sceneNumber: 1, castingMode: "recurring", charactersPresent: ["Fatou", "Ousman"] },
    { sceneNumber: 2, castingMode: "recurring", charactersPresent: ["Fatou"] },
    { sceneNumber: 3, castingMode: "fresh-faces", charactersPresent: ["Ousman"] },
  ]);
  assert(names.has("fatou"), "Fatou recurs across two scenes");
  assert(!names.has("ousman"), "Ousman's second appearance was a fresh-faces scene, which does not count");
});

test("the density law leans harder on films with no dialogue", () => {
  const talk = densityLaw({ kind: { dialogueInVideo: true }, numScenes: 6 });
  const silent = densityLaw({ kind: { dialogueInVideo: false }, numScenes: 6 });
  assert(/TALK COUNTS/.test(talk), "a talking film may run on conversation");
  assert(/NOBODY SPEAKS IN THIS FILM/.test(silent), "a silent film may not");
  assert(/stricter here, not\nlooser/.test(silent), "and is told so explicitly");
});

// ── THE WIRING (the real pipeline, Vertex stubbed) ──────────────────────────

const BEATS = [
  {
    sceneNumber: 1, purpose: "hook", location: "compound", castingMode: "recurring",
    charactersPresent: ["Fatou"], productPresent: false,
    moment: "The pot lid clatters off. She grabs it. It burns. She drops it. The boy laughs.",
    cuts: [
      { time: "0-2s", shot: "The lid clatters off the pot." },
      { time: "2-4s", shot: "She grabs at it barehanded." },
      { time: "4-7s", shot: "It burns; she drops it and shakes her hand out." },
      { time: "7-10s", shot: "The boy laughs; she throws the cloth at him." },
    ],
  },
  {
    sceneNumber: 2, purpose: "breadth", location: "market", castingMode: "fresh-faces",
    charactersPresent: [], productPresent: true,
    moment: "A seller slaps a jar down, a hand takes it, coins land, the next customer is already pushing in.",
    cuts: [
      { time: "0-3s", shot: "A seller slaps the jar onto the stall." },
      { time: "3-6s", shot: "A hand takes it; coins land on the wood." },
      { time: "6-10s", shot: "The next customer pushes in before the first has gone." },
    ],
  },
  {
    sceneNumber: 3, purpose: "land the brand", location: "table", castingMode: "no-people",
    charactersPresent: [], productPresent: true,
    moment: "The jar lands, the lid spins off, a spoon drops in, the label turns to camera.",
    cuts: [
      { time: "0-3s", shot: "The jar lands on the table." },
      { time: "3-6s", shot: "The lid spins off and settles." },
      { time: "6-10s", shot: "A spoon drops in; the label turns square to camera." },
    ],
  },
];

function skillReply(payload) {
  return { candidates: [{ finishReason: "STOP", content: { parts: [{ text: JSON.stringify(payload) }] } }] };
}

/**
 * Captures everything each skill is actually sent, and answers with a valid
 * payload. System prompt AND user text, joined: the character locks ride in the
 * user message, so a test that only read the system prompt would happily pass
 * while the whole cast leaked into an empty scene.
 */
function stubVertex(captured, { thinStoryline = false } = {}) {
  return async (_path, body) => {
    const system = body.systemInstruction.parts[0].text;
    const userText = (body.contents[0].parts || []).map((p) => p.text || "").join("\n");
    captured.push(`${system}\n\n───── USER ─────\n${userText}`);

    if (/You are the BRIEF ANALYST/.test(system)) {
      return skillReply({
        offeringType: "product", offeringSummary: "groundnut paste", targetAudience: "families",
        theOneThing: "it is ours", toneRegister: "warm comedy", language: "English",
        castingShape: "ensemble", castingRationale: "two people, one kitchen", referenceFilmIds: [],
      });
    }
    if (/THE CONCEPT ROOM/.test(system) && /WHAT TO RETURN/.test(system)) {
      return skillReply({
        concepts: [
          { title: "The Lid", logline: "A lid refuses to come off.", engine: "the thing that will not cooperate",
            openingImage: "a lid clattering", eventDensity: ["lid off", "burn", "laugh"],
            whereTheOfferingLands: "scene 3", risk: "too small" },
          { title: "The Queue", logline: "A queue forms.", engine: "an audience forms",
            openingImage: "a queue", eventDensity: ["push", "coins"], whereTheOfferingLands: "scene 2", risk: "busy" },
        ],
        pick: "The Lid",
        pickRationale: "the lid generates events; the queue only generates people",
      });
    }
    if (/You are the STORY DOCTOR/.test(system)) {
      return skillReply({
        title: "The Lid", concept: "c", storyPitch: "p", emotionalHook: "h", storyArc: "a",
        sceneBeats: BEATS,
      });
    }
    if (/You are STORYLINE/.test(system)) {
      return skillReply({
        title: "The Lid", concept: "c", storyPitch: "p", emotionalHook: "h", storyArc: "a",
        sceneBeats: thinStoryline
          ? BEATS.map((b) => ({ ...b, cuts: [{ time: "0-10s", shot: "one long action" }], moment: "one long action" }))
          : BEATS,
      });
    }
    if (/You are CASTING-REGISTRY/.test(system)) {
      return skillReply({
        characters: [
          { name: "Fatou", role: "lead", scenes: [1],
            lcb: "FATOU — a Black Gambian woman in her early forties with golden-brown skin and a tall printed headwrap.",
            wardrobe: "A TEAL wax-print wrapper." },
        ],
        products: [{ name: "jar", anchor: "a squat glass jar", scenes: [2, 3] }],
        elements: [], recurringSets: [],
        soundSpec: "NO MUSIC. The compound's own noise: fire, metal, distant voices.",
        ambienceSpec: "compound room tone",
        styleHeader: "flat honest daylight, handheld, no lens-staring",
      });
    }
    if (/You are a SCENE BUILDER/.test(system)) {
      const n = /Build scene (\d+)/.exec(body.contents[0].parts.at(-1).text)?.[1] || "1";
      return skillReply({
        sceneNumber: Number(n), setting: "s", action: "a", dialogue: "", sound: "NO MUSIC.",
        fullPrompt:
          `Black Gambian people. NO MUSIC. The compound's own noise: fire, metal, distant voices. ` +
          `ACTION: 0.0s one. 2.5s two. 5.0s three. 8.0s four. ` +
          (n === "1"
            ? "FATOU — a Black Gambian woman in her early forties with golden-brown skin and a tall printed headwrap. "
            : "") +
          "word ".repeat(1400),
      });
    }
    if (/You are the SCENE VERIFIER/.test(system)) {
      return skillReply({
        sceneNumber: 1, setting: "s", action: "a", dialogue: "", sound: "NO MUSIC.",
        fullPrompt: "repaired " + "word ".repeat(1400),
      });
    }
    throw new Error(`unexpected skill: ${system.slice(0, 90)}`);
  };
}

const captured = [];
const film = await runOptiqSkillsPipeline({
  vertexFetch: stubVertex(captured),
  prompt: "Sell our groundnut paste",
  length: "30s",
  brandName: "Sidrah Salaam",
  product: "Groundnut paste",
  aspectRatio: "9:16",
  castingSeed: "proj_wiring",
  videoType: "dialogue-ad",
});

const promptFor = (re) => captured.find((s) => re.test(s)) || "";
const storylinePrompt = promptFor(/You are STORYLINE/);
const registryPrompt = promptFor(/You are CASTING-REGISTRY/);
const builderPrompts = captured.filter((s) => /You are a SCENE BUILDER/.test(s));

test("wiring: the concept room runs and its winner reaches the storyline", () => {
  assert(/THE CONCEPT ROOM/.test(promptFor(/THE CONCEPT ROOM/)), "the concept room was called");
  assert(/build THIS/.test(storylinePrompt), "the storyline was handed a concept");
  assert(/The Lid/.test(storylinePrompt), "it got the WINNER");
  assert(/✗ The Queue/.test(storylinePrompt), "and the rejected one, so it cannot drift back into it");
});

test("wiring: the density law reaches the storyline and every scene builder", () => {
  assert(/TEN SECONDS IS A LOT OF TIME/.test(storylinePrompt), "storyline");
  assert(builderPrompts.length === 3, `expected 3 builders, got ${builderPrompts.length}`);
  assert(builderPrompts.every((p) => /TEN SECONDS IS A LOT OF TIME/.test(p)), "every builder");
});

test("wiring: a no-people scene is told nobody is in it, and gets no locks", () => {
  const scene3 = builderPrompts.find((p) => /casting mode "no-people"/.test(p) || /THIS SCENE HAS NOBODY IN IT/.test(p));
  assert(scene3, "the empty scene was built with an empty-scene brief");
  assert(/THIS SCENE HAS NOBODY IN IT/.test(scene3), "it is told so plainly");
  assert(!/FATOU — a Black Gambian woman/.test(scene3), "the lead's lock leaked into a scene she is not in");
  assert(/density law still binds/.test(scene3), "an empty scene still has to be alive");
});

test("wiring: a fresh-faces scene gets a look palette, not the locked cast", () => {
  const scene2 = builderPrompts.find((p) => /THIS SCENE'S PEOPLE ARE ONE-OFFS/.test(p));
  assert(scene2, "the montage scene got the fresh-face brief");
  assert(!/FATOU — a Black Gambian woman/.test(scene2), "the lead's lock leaked into a montage scene");
  assert(/BLACK Gambian/.test(scene2), "one-off people are still explicitly Black Gambian");
});

test("wiring: the recurring scene still carries its lock", () => {
  const scene1 = builderPrompts.find((p) => /casting mode "recurring"/.test(p));
  assert(scene1, "the recurring scene was built");
  assert(/FATOU — a Black Gambian woman/.test(scene1), "the lead's lock is where it belongs");
});

test("wiring: the registry is told which scenes actually need a cast", () => {
  assert(/WHO YOU ARE CASTING, AND WHO YOU ARE NOT/.test(registryPrompt), "the section is there");
  assert(/from the recurring scenes: fatou/i.test(registryPrompt), "it names only the recurring cast");
  assert(/do NOT belong in\nthis registry/i.test(registryPrompt), "and excludes the one-offs");
});

test("wiring: the film comes back with its casting modes intact", () => {
  assert(film.scenes.length === 3, `expected 3 scenes, got ${film.scenes.length}`);
  assert(film.castingShape === "ensemble", "the film-wide shape survived");
});

// A storyline that comes back dead must be sent to the doctor before anything
// is built on top of it.
const thinCaptured = [];
await runOptiqSkillsPipeline({
  vertexFetch: stubVertex(thinCaptured, { thinStoryline: true }),
  prompt: "Sell our groundnut paste",
  length: "30s",
  brandName: "Sidrah Salaam",
  product: "Groundnut paste",
  castingSeed: "proj_thin",
  videoType: "dialogue-ad",
});

test("wiring: a dead storyline is sent to the story doctor before scenes are built", () => {
  const doctor = thinCaptured.find((s) => /You are the STORY DOCTOR/.test(s));
  assert(doctor, "three one-shot scenes of 'one long action' went through unrepaired");
  const doctorIdx = thinCaptured.indexOf(doctor);
  const firstBuilder = thinCaptured.findIndex((s) => /You are a SCENE BUILDER/.test(s));
  assert(doctorIdx < firstBuilder, "the repair has to happen BEFORE the scenes are built");
});

// ── THE SCENE REVISER ───────────────────────────────────────────────────────
//
// Shared by the script editor's revise box and every agent write tool, and it
// was throwing a ReferenceError before it reached Vertex — so neither worked.

let reviserPrompt = null;
const revised = await reviseScene({
  vertexFetch: async (_path, body) => {
    reviserPrompt = body.systemInstruction.parts[0].text;
    return { candidates: [{ content: { parts: [{ text: "the revised prompt" }] } }] };
  },
  scenePrompt: "the original",
  revisionRequest: "make it calmer",
  videoType: "voiceover-ad",
});

test("reviseScene runs at all", () => {
  assert(revised === "the revised prompt", `got ${JSON.stringify(revised)}`);
});

test("reviseScene knows which kind of film it is revising", () => {
  assert(/NOBODY SPEAKS IN THIS FILM/.test(reviserPrompt), "a narrated film's reviser must not write dialogue");
});

test("a revision cannot quietly empty a scene out", () => {
  assert(/TEN SECONDS IS A LOT OF TIME/.test(reviserPrompt), "the density law rides along");
  assert(/NEVER come back with fewer events/.test(reviserPrompt), "and is stated as a rule of the revision");
});

// Every film made before video types existed carries dialogue in its footage.
let untypedPrompt = null;
await reviseScene({
  vertexFetch: async (_p, body) => {
    untypedPrompt = body.systemInstruction.parts[0].text;
    return { candidates: [{ content: { parts: [{ text: "ok" }] } }] };
  },
  scenePrompt: "x",
  revisionRequest: "y",
});

test("an untyped film still revises, as a dialogue ad", () => {
  assert(!/NOBODY SPEAKS IN THIS FILM/.test(untypedPrompt), "an untyped film keeps its dialogue");
});

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length > 0) process.exit(1);
