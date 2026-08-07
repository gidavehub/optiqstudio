/**
 * Optiq STORY sandbox test. Run: node scripts/test-story-pipeline.mjs
 *
 * Two halves, the same shape as scripts/test-creative-pipeline.mjs.
 *
 * The pure half covers functions/optiqStory/storyCraft.js — the structure gate
 * that decides whether a film has a beginning, a turn and an actual ending, and
 * the ad-purity gate that catches a commercial reflex in a film with nothing to
 * sell.
 *
 * The wiring half drives the REAL runOptiqStoryPipeline with Vertex stubbed out,
 * capturing every system prompt the swarm builds. That is the only way to prove
 * the thing that actually matters here: that NO ad instruction reaches a story
 * skill. A unit test on a helper cannot show that, because the danger was always
 * in what the pipeline pastes into a prompt.
 */

import { createRequire } from "node:module";

const require_ = createRequire(import.meta.url);
const {
  drawStoryProvocation,
  storyStructureLaw,
  noCommercialMandate,
  storyStructureViolations,
  storyPurityViolations,
  scenePurityViolations,
  beatAct,
  ACTS,
} = require_("../functions/optiqStory/storyCraft.js");
const {
  conceptDirective,
  densityLaw,
  storylineDensityViolations,
} = require_("../functions/optiqStory/creative.js");
const { runOptiqStoryPipeline, reviseStoryScene, STORY_KIND } =
  require_("../functions/optiqStory/pipeline.js");

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

async function testAsync(name, fn) {
  try {
    await fn();
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

test("the provocation is stable per film and different between films", () => {
  const a = drawStoryProvocation("project-aaa");
  const b = drawStoryProvocation("project-aaa");
  const c = drawStoryProvocation("project-zzz");
  assert(JSON.stringify(a) === JSON.stringify(b), "the same seed must redraw the same story");
  assert(JSON.stringify(a) !== JSON.stringify(c), "two films must not draw the same provocation");
  assert(a.engines.length === 3, `${a.engines.length} engines drawn`);
  assert(new Set(a.engines).size === 3, "the three engines must be distinct");
});

test("the story palette is dramatic, not the ad swarm's comic one", () => {
  const adCreative = require_("../functions/optiqSkills/creative.js");
  const storyCraft = require_("../functions/optiqStory/storyCraft.js");
  const shared = storyCraft.STORY_ENGINES.filter((e) => adCreative.CREATIVE_ENGINES.includes(e));
  assert(shared.length === 0, `${shared.length} engine(s) shared with the ad swarm`);
});

// ── THE FIVE OBLIGATIONS ────────────────────────────────────────────────────

const GOOD_BEATS = [
  { sceneNumber: 1, act: "open", purpose: "hook", location: "kitchen", castingMode: "recurring",
    charactersPresent: ["Awa"], moment: "She stuffs notes into a rice tin. A key turns. She shoves the tin behind the pot.",
    cuts: [{ time: "0-3s", shot: "Notes going into the tin, fast." }, { time: "3-6s", shot: "A key turns in the door." }, { time: "6-10s", shot: "The tin goes behind the pot; she straightens up." }] },
  { sceneNumber: 2, act: "want", purpose: "what she is saving for", location: "kitchen", castingMode: "recurring",
    charactersPresent: ["Awa"], moment: "She counts on her fingers, checks a folded paper, hides it in her wrapper.",
    cuts: [{ time: "0-4s", shot: "Counting on fingers." }, { time: "4-7s", shot: "Unfolding the paper." }, { time: "7-10s", shot: "Folding it away into her wrapper." }] },
  { sceneNumber: 3, act: "turn", purpose: "she is seen", location: "doorway", castingMode: "recurring",
    charactersPresent: ["Awa", "Ndey"], moment: "Ndey is in the doorway holding the tin. Awa stops. Ndey sets it down.",
    cuts: [{ time: "0-3s", shot: "Ndey in the doorway, tin in hand." }, { time: "3-6s", shot: "Awa stops mid-step." }, { time: "6-10s", shot: "Ndey sets the tin on the table." }] },
  { sceneNumber: 4, act: "escalate", purpose: "it gets worse", location: "yard", castingMode: "recurring",
    charactersPresent: ["Awa", "Ndey"], moment: "Awa reaches for the tin. Ndey covers it. A neighbour calls over the wall.",
    cuts: [{ time: "0-4s", shot: "Awa reaches." }, { time: "4-7s", shot: "Ndey's hand covers the lid." }, { time: "7-10s", shot: "A neighbour's voice over the wall; both freeze." }] },
  { sceneNumber: 5, act: "climax", purpose: "the confrontation", location: "yard", castingMode: "recurring",
    charactersPresent: ["Awa", "Ndey"], moment: "Ndey opens the tin, counts it out loud, and puts her own notes in.",
    cuts: [{ time: "0-3s", shot: "The lid comes off." }, { time: "3-6s", shot: "Counting aloud." }, { time: "6-10s", shot: "She adds her own notes to the pile." }] },
  { sceneNumber: 6, act: "land", purpose: "the outcome", location: "kitchen", castingMode: "recurring",
    charactersPresent: ["Awa"], moment: "Awa puts the tin back, turns it dent-in, and leaves the lid off.",
    cuts: [{ time: "0-4s", shot: "The tin goes back on the shelf." }, { time: "4-7s", shot: "She turns it so the dent faces the wall." }, { time: "7-10s", shot: "She leaves the lid off and walks out." }] },
];

const GOOD_STORYLINE = {
  title: "The Rice Tin",
  concept: "c", storyPitch: "p", emotionalHook: "h", storyArc: "a",
  whatIsAtStake: "the school fees due on Friday",
  theEnding: "she puts the tin back on the shelf and leaves the lid off",
  sceneBeats: GOOD_BEATS,
};

test("a complete story passes the structure gate", () => {
  const v = storyStructureViolations(GOOD_STORYLINE, { numScenes: 6 });
  assert(v.length === 0, `expected none, got: ${v.map((x) => x.slice(0, 80)).join(" | ")}`);
});

test("a film that stops instead of ending is caught", () => {
  const beats = GOOD_BEATS.map((b) => (b.act === "land" ? { ...b, act: "escalate" } : b));
  const v = storyStructureViolations({ ...GOOD_STORYLINE, sceneBeats: beats }, { numScenes: 6 });
  assert(v.some((x) => /does not end — it stops/.test(x)), `missing-ending not caught: ${v.join(" | ")}`);
});

test("a film with no turn is caught", () => {
  const beats = GOOD_BEATS.map((b) => (b.act === "turn" ? { ...b, act: "escalate" } : b));
  const v = storyStructureViolations({ ...GOOD_STORYLINE, sceneBeats: beats }, { numScenes: 6 });
  assert(v.some((x) => /No scene is tagged "turn"/.test(x)), `missing turn not caught: ${v.join(" | ")}`);
});

test("a film that peaks early is caught", () => {
  const beats = GOOD_BEATS.map((b, i) => ({ ...b, act: i === 1 ? "climax" : b.act === "climax" ? "escalate" : b.act }));
  const v = storyStructureViolations({ ...GOOD_STORYLINE, sceneBeats: beats }, { numScenes: 6 });
  assert(v.some((x) => /peaks early/.test(x)), `early climax not caught: ${v.join(" | ")}`);
});

test("an untagged scene is caught", () => {
  const beats = GOOD_BEATS.map((b, i) => (i === 3 ? { ...b, act: undefined } : b));
  const v = storyStructureViolations({ ...GOOD_STORYLINE, sceneBeats: beats }, { numScenes: 6 });
  assert(v.some((x) => /carry no "act" tag/.test(x)), `untagged scene not caught: ${v.join(" | ")}`);
});

test("an ending written as a feeling is caught, an ending written as an event is not", () => {
  const feeling = storyStructureViolations(
    { ...GOOD_STORYLINE, theEnding: "she finally feels at peace and realises she was never alone" },
    { numScenes: 6 }
  );
  assert(feeling.some((x) => /written as a feeling/.test(x)), "a felt ending must be caught");
  const event = storyStructureViolations(GOOD_STORYLINE, { numScenes: 6 });
  assert(!event.some((x) => /written as a feeling/.test(x)), "a physical ending must pass");
});

test("missing stakes are caught", () => {
  const v = storyStructureViolations({ ...GOOD_STORYLINE, whatIsAtStake: "" }, { numScenes: 6 });
  assert(v.some((x) => /does not say what is at stake/.test(x)), `stakes not caught: ${v.join(" | ")}`);
});

test("beatAct tolerates junk without crashing the gate", () => {
  assert(beatAct({ act: "LAND" }) === "land", "case is tolerated");
  assert(beatAct({ act: "payoff" }) === null, "an unknown act is not silently accepted");
  assert(beatAct({}) === null, "a missing act is null");
  assert(ACTS.length === 6, `${ACTS.length} acts`);
});

// ── AD PURITY ───────────────────────────────────────────────────────────────

test("a storyline that drifts into advertising is caught", () => {
  const beats = [
    ...GOOD_BEATS.slice(0, 5),
    { ...GOOD_BEATS[5], purpose: "land the brand", moment: "The logo resolves and the tagline fades in." },
  ];
  const v = storyPurityViolations({ ...GOOD_STORYLINE, sceneBeats: beats });
  assert(v.length > 0, "an ad ending must be caught");
  assert(/written like an ad/.test(v[0]), v[0]);
});

test("a clean story storyline trips no purity violation", () => {
  const v = storyPurityViolations(GOOD_STORYLINE);
  assert(v.length === 0, `false positive: ${v.join(" | ")}`);
});

test("productPresent is refused outright", () => {
  const beats = GOOD_BEATS.map((b, i) => (i === 2 ? { ...b, productPresent: true } : b));
  const v = storyPurityViolations({ ...GOOD_STORYLINE, sceneBeats: beats });
  assert(v.some((x) => /There is no product in this film/.test(x)), `productPresent not caught: ${v.join(" | ")}`);
});

test("the scene-level purity gate does not fire on an ordinary market scene", () => {
  // The gate must survive a real 2,000-word prompt describing shops and signage.
  const prompt =
    "A busy Gambian market lane. A vendor's stall carries a hand-painted sign reading FRESH FISH. " +
    "A customer counts coins onto the wood. The shopkeeper wraps the fish in newspaper.";
  const v = scenePurityViolations({ fullPrompt: prompt });
  assert(v.length === 0, `false positive on a market scene: ${v.join(" | ")}`);
});

test("the scene-level purity gate fires on real ad apparatus", () => {
  const v = scenePurityViolations({
    fullPrompt: "The final beat is a clean end card: the logo resolves and the tagline fades in below.",
  });
  assert(v.length === 1 && /advertising apparatus/.test(v[0]), `not caught: ${v.join(" | ")}`);
});

// ── THE LAWS AS TEXT ────────────────────────────────────────────────────────

test("the structure law scales its deadlines to the run-time", () => {
  const short = storyStructureLaw({ numScenes: 6 });
  const long = storyStructureLaw({ numScenes: 18 });
  assert(/60 seconds long/.test(short), "a 6-scene film is 60 seconds");
  assert(/180 seconds long/.test(long), "an 18-scene film is 180 seconds");
  assert(/BIGGER story/.test(long), "a long film must be told it needs a bigger story");
  assert(!/BIGGER story/.test(short), "a short film should not get the long-film note");
});

test("the no-commercial mandate forbids the whole ad apparatus", () => {
  const m = noCommercialMandate();
  for (const banned of ["logo", "tagline", "call to action", "end card", "narrator", "voiceover"]) {
    assert(new RegExp(banned, "i").test(m), `the mandate never mentions "${banned}"`);
  }
  assert(/The story is the hero/i.test(m), "the mandate must state what replaces the product");
});

test("the story density law is stricter than the ad swarm's, and says why", () => {
  const law = densityLaw({ numScenes: 6 });
  assert(/BECAUSE THIS IS A STORY/.test(law), "the story-specific clause is missing");
  assert(/TALK COUNTS/.test(law), "a story's characters speak, so talk must count");
});

// ── THE WIRING (the real story pipeline, Vertex stubbed) ────────────────────

function skillReply(payload) {
  return { candidates: [{ finishReason: "STOP", content: { parts: [{ text: JSON.stringify(payload) }] } }] };
}

const REGISTRY = {
  characters: [
    { name: "Awa", role: "lead", scenes: [1, 2, 3, 4, 5, 6], tell: "she smooths her wrapper when she is lying",
      lcb: "AWA — a Black Gambian woman in her late thirties with golden-brown skin and short natural hair.",
      wardrobe: "A TEAL wax-print wrapper." },
    { name: "Ndey", role: "daughter", scenes: [3, 4, 5], tell: "she checks a pocket she has already checked",
      lcb: "NDEY — a Black Gambian girl of sixteen with very deep blue-black skin and long box braids.",
      wardrobe: "A faded YELLOW school dress." },
  ],
  elements: [{ name: "rice tin", anchor: "a dented aluminium rice tin with a loose lid", scenes: [1, 3, 5, 6] }],
  recurringSets: [{ name: "the kitchen", anchor: "a narrow kitchen with a blue-washed wall", scenes: [1, 2, 6] }],
  soundSpec: "NO MUSIC of any kind. The compound's own noise carries the clip: the fridge hum, the yard beyond, distant traffic.",
  ambienceSpec: "Low fridge hum and a quiet yard.",
  styleHeader: "Documentary-real, handheld, honest daylight. Nobody looks at the lens. Dialogue in ENGLISH.",
};

/** A prompt long enough to clear the word-count gate, carrying every lock. */
function fatPrompt(beat, chars) {
  const filler = "authored specific detail about the room and the people in it ".repeat(230);
  return [
    chars.map((c) => `${c.lcb} ${c.wardrobe}`).join(" "),
    REGISTRY.styleHeader,
    "ABSOLUTE RULES: NO MUSIC of any kind.",
    `SOUND: NO MUSIC. ${REGISTRY.soundSpec}`,
    "[0-3s] She lifts the lid. [3-6s] She counts. [6-10s] She puts it back.",
    "Every person in frame is Black Gambian.",
    filler,
    "CLOSING RESTATEMENT: unscored and musically silent, no music of any kind.",
  ].join("\n");
}

function stubStoryVertex(captured, { brokenStoryline = false } = {}) {
  return async (_path, body) => {
    const system = body.systemInstruction.parts[0].text;
    const userText = (body.contents[0].parts || []).map((p) => p.text || "").join("\n");
    captured.push({ system, userText, all: `${system}\n───── USER ─────\n${userText}` });

    if (/You are the PREMISE ANALYST/.test(system)) {
      return skillReply({
        genre: "domestic drama", premiseSummary: "a woman hides money", whoItIsAbout: "Awa",
        whatTheyWant: "to pay the school fees", whatIsInTheWay: "her daughter finds the tin",
        whatIsAtStake: "the fees due Friday", audienceFeeling: "quietly wrecked",
        toneRegister: "held-in", language: "English", setting: "Serrekunda, The Gambia",
        castingShape: "ensemble", castingRationale: "two people, one tin",
      });
    }
    if (/THE CONCEPT ROOM — ORIGINAL SHORT FILM/.test(system) && /WHAT TO RETURN/.test(system)) {
      return skillReply({
        concepts: [
          { title: "The Rice Tin", logline: "A woman hides money and is found out by the person she is hiding it for.",
            engine: "the thing taken without asking", openingImage: "notes going into a tin, fast",
            eventDensity: ["notes hidden", "key turns", "tin found", "counted aloud", "notes added", "lid left off"],
            whatIsAtStake: "the school fees", theTurn: "Ndey is already holding the tin",
            theEnding: "the tin goes back with the lid off", risk: "too quiet" },
          { title: "The Wall", logline: "A neighbour hears everything.", engine: "somebody is about to find out",
            openingImage: "an ear at a wall", eventDensity: ["listening", "a shout"],
            whatIsAtStake: "a reputation", theTurn: "the wall comes down", theEnding: "she moves out", risk: "thin" },
        ],
        pick: "The Rice Tin",
        pickRationale: "the tin generates events; the wall only generates overhearing",
      });
    }
    if (/You are the STORY DOCTOR/.test(system)) {
      return skillReply(GOOD_STORYLINE);
    }
    if (/You are STORYLINE/.test(system)) {
      if (!brokenStoryline) return skillReply(GOOD_STORYLINE);
      // A film with no ending and a beat written as an ad.
      return skillReply({
        ...GOOD_STORYLINE,
        theEnding: "",
        sceneBeats: GOOD_BEATS.map((b) =>
          b.act === "land" ? { ...b, act: "escalate", purpose: "land the brand", productPresent: true } : b
        ),
      });
    }
    if (/You are CASTING-REGISTRY/.test(system)) return skillReply(REGISTRY);
    if (/You are a SCENE BUILDER/.test(system)) {
      const n = Number(/Build scene (\d+)/.exec(userText)?.[1] || 1);
      const beat = GOOD_BEATS.find((b) => b.sceneNumber === n) || GOOD_BEATS[0];
      const chars = REGISTRY.characters.filter((c) => (beat.charactersPresent || []).includes(c.name));
      return skillReply({
        sceneNumber: n, setting: beat.location, action: beat.moment,
        dialogue: "Awa: How much?", sound: "Room tone.", fullPrompt: fatPrompt(beat, chars),
      });
    }
    if (/You are the SCENE VERIFIER/.test(system)) {
      const scene = JSON.parse(/THE SCENE TO REPAIR:\n([\s\S]+)$/.exec(userText)[1]);
      return skillReply(scene);
    }
    if (/You are the SCENE REVISER/.test(system)) {
      return { candidates: [{ finishReason: "STOP", content: { parts: [{ text: "revised prompt" }] } }] };
    }
    throw new Error(`unstubbed story skill:\n${system.slice(0, 200)}`);
  };
}

const captured = [];
const film = await runOptiqStoryPipeline({
  vertexFetch: stubStoryVertex(captured),
  prompt: "A woman hides money from her own family.",
  length: "60s",
  aspectRatio: "16:9",
  castingSeed: "story-test-1",
  // Deliberately passed and deliberately ignored — the router hands these along
  // for both kinds of film. The values are nonsense strings on purpose: a real
  // brand name would collide with the Gambian food and place vocabulary in the
  // environment doctrine and the test would fail on a coincidence.
  brandName: "Zorblaxco",
  product: "hyperwidget nine thousand",
});

await testAsync("wiring: the story pipeline builds a complete film", async () => {
  assert(film.scenes.length === 6, `${film.scenes.length} scenes`);
  assert(film.videoType === "short-film-story", `videoType is ${film.videoType}`);
  assert(film.isStory === true, "a story must be flagged as one");
  assert(film.theEnding, "the film must carry its ending");
  assert(film.whatIsAtStake, "the film must carry its stakes");
  assert(Object.keys(film.materialPlacement).length === 0, "a story places no brand materials");
});

await testAsync("wiring: NO ad instruction reaches any story skill", async () => {
  // The whole point of the sandbox. Every system prompt the swarm built is
  // scanned for the ad swarm's organising assumptions.
  const forbidden = [
    /the product or service is the hero/i,
    /land the brand/i,
    /PRODUCT CONSISTENCY/,
    /Main Product\/Service/,
    /Brand Info:/,
    /the turn \(the offering enters\)/i,
    /theOneThing/,
    /offeringType/,
    /reference storylines/i,
  ];
  for (const { system } of captured) {
    for (const pattern of forbidden) {
      assert(!pattern.test(system), `an ad instruction reached a story skill: ${pattern}\n  in: ${system.slice(0, 120)}…`);
    }
  }
});

await testAsync("wiring: the brand name and product are ignored, not passed through", async () => {
  for (const { all } of captured) {
    assert(!/Zorblaxco/i.test(all), "the brand name leaked into a story prompt");
    assert(!/hyperwidget/i.test(all), "the product leaked into a story prompt");
  }
});

await testAsync("wiring: every skill is told there is nothing to sell", async () => {
  const mandated = captured.filter(({ system }) => /THIS IS NOT AN AD\. THERE IS NOTHING TO SELL/.test(system));
  assert(mandated.length >= 4, `only ${mandated.length} skill(s) got the no-commercial mandate`);
});

await testAsync("wiring: the storyline and every scene builder get the structure law", async () => {
  const storyline = captured.find(({ system }) => /You are STORYLINE/.test(system));
  assert(/THE COMPLETE-STORY LAW/.test(storyline.system), "the storyline skill never saw the structure law");
  const builders = captured.filter(({ system }) => /You are a SCENE BUILDER/.test(system));
  assert(builders.length === 6, `${builders.length} scene builders ran`);
  for (const b of builders) {
    assert(/WHAT THIS SCENE IS FOR/.test(b.system), "a builder was not told its scene's obligation");
  }
});

await testAsync("wiring: the final scene is told to land the story, not a brand", async () => {
  const builders = captured.filter(({ system }) => /You are a SCENE BUILDER/.test(system));
  const finals = builders.filter(({ system }) => /THIS IS THE FINAL SCENE OF THE FILM/.test(system));
  assert(finals.length === 1, `${finals.length} scenes were told they were the last`);
  assert(
    /no brand to\nland, no logo to reveal/.test(finals[0].system),
    "the final scene was not told there is no brand to land"
  );
  const lastUser = builders[builders.length - 1];
  assert(
    !/land the brand/i.test(lastUser.userText) || /lands the story's outcome/.test(lastUser.userText),
    "the neighbour context still tells the last scene to land a brand"
  );
});

await testAsync("wiring: a broken storyline is sent to the story doctor before scenes are built", async () => {
  const cap2 = [];
  const repaired = await runOptiqStoryPipeline({
    vertexFetch: stubStoryVertex(cap2, { brokenStoryline: true }),
    prompt: "A woman hides money.",
    length: "60s",
    aspectRatio: "16:9",
    castingSeed: "story-test-2",
  });
  const doctor = cap2.find(({ system }) => /You are the STORY DOCTOR/.test(system));
  assert(doctor, "the story doctor never ran on a film with no ending");
  assert(/does not end — it stops/.test(doctor.userText), "the missing ending was not reported to the doctor");
  assert(/written like an ad/.test(doctor.userText), "the ad drift was not reported to the doctor");
  assert(/There is no product in this film/.test(doctor.userText), "productPresent was not reported to the doctor");
  assert(repaired.scenes.length === 6, "the repaired film must still be six scenes");
});

await testAsync("the story reviser refuses to become an ad, and runs at all", async () => {
  const cap3 = [];
  const out = await reviseStoryScene({
    vertexFetch: stubStoryVertex(cap3),
    scenePrompt: "original",
    revisionRequest: "put the logo at the end",
    characterLock: {},
    styleHeader: "",
  });
  assert(out === "revised prompt", `reviser returned ${out}`);
  const sys = cap3[0].system;
  assert(/NEVER turn this into an ad/i.test(sys), "the reviser is not told to refuse an ad");
  assert(/THIS IS NOT AN AD/.test(sys), "the reviser did not get the no-commercial mandate");
});

test("the story kind is a talking film with no narration", () => {
  // Read by audio post: footage gain 1, and no voiceover pass.
  assert(STORY_KIND.dialogueInVideo === true, "a story's characters speak on camera");
  assert(STORY_KIND.ttsVoiceover === false, "a story gets no TTS voiceover");
  assert(STORY_KIND.noun === "short film", `the score prompt would call it "${STORY_KIND.noun}"`);
});

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length > 0) process.exit(1);
