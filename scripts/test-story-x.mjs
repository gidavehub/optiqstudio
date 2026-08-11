/**
 * Optiq STORY X sandbox test. Run: node scripts/test-story-x.mjs
 *
 * The experimental long-form story: the film type rendered PURELY FROM TEXT, that
 * stops once for the director's approval, and that runs to five or ten minutes
 * rather than three.
 *
 * IT USED TO BE PHOTOGRAPHED, and half of this file used to assert that. A shot
 * board of a hundred-plus stills was built first and the clips rendered from the
 * frames; the scene prompt was deliberately written NOT to describe how anything
 * looked, because the pictures did it better. That is all gone — see the header of
 * functions/optiqStoryX/pipeline.js, and note that the deciding reason was the
 * classifier: a photorealistic face attached to a render of that person in a cell
 * or in handcuffs reads as a real person defamed, and is refused silently while
 * still being billed.
 *
 * Four things are worth proving here and are hard to prove any other way.
 *
 * 1. NOTHING IS ATTACHED, AND THE WORDS CARRY EVERYTHING. No image function is
 *    reachable from the blueprint, no builder is told a reference is coming, and
 *    the prompt rules DEMAND the appearance description they used to forbid. This
 *    inverted, so it is the assertion most worth pinning down.
 *
 * 2. THE LOCATION BIBLE HOLDS THE ROOMS. Every place is written once and pasted
 *    verbatim into every scene set there — the text replacement for what the
 *    board's plates used to do. The designer must run BEFORE the builders (they
 *    paste what it writes), and a continuation must reuse it rather than
 *    re-designing, or scenes 16–30 end up in different rooms from scenes 1–15.
 *
 * 3. IT SURVIVES ITS OWN LENGTH. Thirty scenes of 3,000 words do not fit in one
 *    540s invocation. So the pass has to stop cleanly, report what is missing,
 *    and — on the continuation — REUSE the storyline, the registry and the bible
 *    verbatim rather than re-deciding what film this is. A continuation that
 *    re-rolls the story would change the film under a director who has already
 *    read fifteen scenes of it, and every scene built against the old registry
 *    would then fail its lock gate. This is the failure mode with no cheap
 *    symptom, so it is tested directly.
 *
 * 4. THE LOCKS ARE PASTED VERBATIM. The character block, the wardrobe and the
 *    voice all survive thirty separately-generated clips by exactly one
 *    mechanism: identical words in all thirty. The gate has to catch a scene that
 *    drops any of them.
 *
 * Vertex is stubbed throughout — this proves the WIRING, not the writing.
 */

import { createRequire } from "node:module";

const require_ = createRequire(import.meta.url);
const {
  storyStructureLaw,
  storyStructureViolations,
} = require_("../functions/optiqStoryX/storyCraft.js");
const { runOptiqStoryXBlueprint, STORY_KIND, STORYX_VIDEO_TYPE } =
  require_("../functions/optiqStoryX/pipeline.js");

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

// ── THE LONG-FORM STRUCTURE LAW ─────────────────────────────────────────────
//
// The five-obligation spine is satisfiable by a thirty-scene film that turns once
// and then escalates fifteen times — and escalating fifteen times is one scene
// fifteen times. Every individual scene passes; only the shape is wrong. These
// are the two gates that see it.

/** A 30-scene film, with whatever act pattern the caller wants to try. */
function longFilm(actFor) {
  const sceneBeats = [];
  for (let i = 1; i <= 30; i++) {
    sceneBeats.push({
      sceneNumber: i,
      act: actFor(i),
      purpose: "p",
      location: "the compound",
      castingMode: "recurring",
      charactersPresent: ["Awa"],
      moment: "She lifts the lid, counts, and puts it back.",
      // Seven lines, because this film type runs on talk: the gates below check
      // both the per-scene floor and 30 exchanges per 60 seconds.
      dialogue: [
        "AWA: You went into my things.",
        "NDEY: I went into the kitchen.",
        "AWA: It was behind the pot and now it is not.",
        "NDEY: Then ask the pot.",
        "MODOU: Both of you, sit down.",
        "AWA: Do not tell me to sit in my own house.",
        "NDEY: She never asks. She just takes and calls it borrowing.",
      ],
      cuts: [
        { time: "0-4s", shot: "The lid comes off." },
        { time: "4-7s", shot: "Counting." },
        { time: "7-10s", shot: "The lid goes back." },
      ],
    });
  }
  return {
    title: "The Long One",
    concept: "c", storyPitch: "p", emotionalHook: "h", storyArc: "a",
    whatIsAtStake: "the school fees due on Friday",
    theEnding: "she puts the tin back and leaves the lid off",
    sceneBeats,
  };
}

/** One turn at 14, climax at 25 — a spine that passes and a middle that does not. */
const oneTurn = (i) =>
  i === 1 ? "open" : i <= 3 ? "want" : i === 14 ? "turn" : i === 25 ? "climax" : i === 30 ? "land" : "escalate";

/** The same film with a real midpoint and its escalation broken up. */
const withMidpoint = (i) => {
  if (i === 1) return "open";
  if (i <= 3) return "want";
  if (i === 10 || i === 15 || i === 21) return "turn";
  if (i === 25) return "climax";
  if (i === 30) return "land";
  return "escalate";
};

test("a long film with only one turn is caught", () => {
  const v = storyStructureViolations(longFilm(oneTurn), { numScenes: 30 });
  assert(
    v.some((x) => /1 turn in it/.test(x)),
    `a single-turn 30-scene film must be caught: ${v.map((x) => x.slice(0, 60)).join(" | ")}`
  );
});

test("a long film that escalates for ten straight scenes is caught", () => {
  const v = storyStructureViolations(longFilm(oneTurn), { numScenes: 30 });
  assert(
    v.some((x) => /consecutive scenes are all tagged/.test(x)),
    `a long unbroken run must be caught: ${v.map((x) => x.slice(0, 60)).join(" | ")}`
  );
});

test("a long film with a midpoint and a broken-up middle passes", () => {
  const v = storyStructureViolations(longFilm(withMidpoint), { numScenes: 30 });
  assert(v.length === 0, `expected none, got: ${v.map((x) => x.slice(0, 90)).join(" | ")}`);
});

test("the long-form gates do NOT fire on a short film", () => {
  // A six-scene film turns once and that is correct. Applying the long-form law
  // to it would demand a midpoint in sixty seconds.
  const short = {
    ...longFilm(oneTurn),
    sceneBeats: longFilm((i) =>
      i === 1 ? "open" : i === 2 ? "want" : i === 3 ? "turn" : i === 4 ? "escalate" : i === 5 ? "climax" : "land"
    ).sceneBeats.slice(0, 6),
  };
  const v = storyStructureViolations(short, { numScenes: 6 });
  assert(!v.some((x) => /turn in it|consecutive scenes/.test(x)), `long-form gate fired on a short film: ${v.join(" | ")}`);
});

test("the long-form law only appears for genuinely long films", () => {
  assert(/THIS IS LONG FORM/.test(storyStructureLaw({ numScenes: 30 })), "a 30-scene film must get the long-form law");
  assert(/MIDPOINT/.test(storyStructureLaw({ numScenes: 30 })), "it must ask for a midpoint");
  assert(!/THIS IS LONG FORM/.test(storyStructureLaw({ numScenes: 6 })), "a 6-scene film must not get it");
});

// ── THE DIALOGUE LAW ────────────────────────────────────────────────────────
//
// What this film type is FOR. These films are watched on a phone and what holds
// a viewer is people talking, so the floor is 5–10 lines a scene and 30
// exchanges per 60 seconds. Every other sandbox's doctrine says the opposite
// ("under ten words a line", "a silent scene is often superior"), which is why
// the law is repeated at four separate skills and gated at three.

const {
  dialogueLaw,
  dialogueViolations,
  filmDialogueViolations,
  countSpokenLines,
  MIN_LINES_PER_SCENE,
  MIN_LINES_PER_MINUTE,
} = require_("../functions/optiqStoryX/creative.js");

test("spoken lines are counted however the writer formatted them", () => {
  const rows = "AWA: You took it.\nNDEY: I took nothing.\nAWA: Then where is it?";
  assert(countSpokenLines(rows) === 3, `rows: got ${countSpokenLines(rows)}`);
  // A compiled prompt legitimately runs lines together inside one paragraph.
  // Anchoring the counter to the start of a line reported these as zero, which
  // would tell a brief that kept every line that it had dropped them all.
  const inline = "DIALOGUE. AWA: You took it. NDEY: I took nothing. AWA: Then where is it?";
  assert(countSpokenLines(inline) === 3, `inline: got ${countSpokenLines(inline)}`);
  const quoted = 'She says "Take it back" and he says "I will not"';
  assert(countSpokenLines(quoted) === 2, `quoted: got ${countSpokenLines(quoted)}`);
  assert(countSpokenLines("SOUND. Room tone. CAMERA. Locked wide.") === 0, "prose must not count as speech");
});

test("a silent scene is a FAILURE here, not a stylistic choice", () => {
  const v = dialogueViolations({ dialogue: "" });
  assert(v.length === 1, "a silent scene must be caught");
  assert(/NO DIALOGUE AT ALL/.test(v[0]), v[0]);
});

test("a thin scene is caught, a packed one passes", () => {
  const thin = dialogueViolations({ dialogue: "AWA: You took it.\nNDEY: I did not." });
  assert(thin.length === 1 && /only 2 spoken line/.test(thin[0]), `thin not caught: ${thin[0]}`);
  const packed = dialogueViolations({ dialogue: beats()[0].dialogue.join("\n") });
  assert(packed.length === 0, `a 7-line scene must pass: ${packed.join(" | ")}`);
});

test("the film-wide floor is 30 exchanges per 60 seconds", () => {
  // The per-scene gate alone can be gamed: a film can sit on the floor in every
  // scene, or average out fine while eight scenes are nearly silent.
  const thin = {
    sceneBeats: Array.from({ length: 30 }, (_, i) => ({
      sceneNumber: i + 1,
      dialogue: i < 20 ? ["A: one", "B: two"] : [],
    })),
  };
  const v = filmDialogueViolations(thin, { numScenes: 30 });
  assert(v.length === 1, "a thin film must be caught");
  assert(/40 spoken line/.test(v[0]), `should count the whole film: ${v[0]}`);
  assert(new RegExp(`${(300 / 60) * MIN_LINES_PER_MINUTE} for this run-time`).test(v[0]), v[0]);
  // And it names the emptiest scenes, because "you are 110 short" is not actionable.
  assert(/emptiest scenes/.test(v[0]), "it must name which scenes to fix");
  // Built fresh rather than referencing STORYLINE, which is declared further
  // down and would be in the temporal dead zone here.
  assert(filmDialogueViolations(longFilm(withMidpoint), { numScenes: 30 }).length === 0, "a talking film must pass");
});

test("the dialogue law suspends the doctrine it contradicts, in writing", () => {
  const law = dialogueLaw();
  assert(/BOTH ARE SUSPENDED HERE/.test(law), "it must explicitly override the ad doctrine");
  assert(/SILENT SCENE IS A FAILURE/.test(law), "it must forbid the silent scene");
  assert(new RegExp(`${MIN_LINES_PER_MINUTE} exchanges in every 60`).test(law), "it must state the per-minute floor");
  assert(/BANTER IS PLOT/.test(law), "it must ask for back-and-forth, not alternating statements");
  assert(/Still no exposition|STILL NOT EXPOSITION/i.test(law), "packing lines is not licence to explain the plot");
});

test("the register is drama, with comedy inside it", () => {
  const { dramaMandate } = require_("../functions/optiqStoryX/storyCraft.js");
  const m = dramaMandate();
  assert(/This is a DRAMA/.test(m), "drama must be the stated register");
  assert(/three parts drama to one part comedy/.test(m), "the ratio must be stated");
  assert(/ALSO be the line that makes things worse/.test(m), "comedy must sit inside the drama, not beside it");
});

// ── ADAPTATION MODE ─────────────────────────────────────────────────────────
//
// The failure these exist for, in full, because it must not happen twice:
//
// A director pasted a complete story — a boy taught to steal in Brikama market,
// escalating robberies, a gang in the night markets, repeated arrests, a mother
// bribing him out, a violent heist at a coastal compound, the arrest on the
// wall, the interrogation, the raid that found her chest under the floorboards,
// the trial, the prison van. Eleven locations, a decade of time.
//
// The film came back with nineteen of thirty scenes in one holding room, eleven
// near-identical "she shoves him into the market" scenes, an invented detective,
// and a different ending. Every individual scene passed every gate that existed.

const {
  isAdaptation,
  adaptationMandate,
  coverageViolations,
  repetitionViolations,
} = require_("../functions/optiqStoryX/adaptation.js");

const SOURCE_STORY = `In the noisy alleyways of the Brikama market, where merchant stalls were crammed
under sun-bleached tarpaulins, young Modou was taught a terrible lesson by his mother Kaddy. She did not
teach him to read. She shoved him into the crowd with an order: bring back money, or do not return.
As Modou grew, her demands escalated from shoplifting to robbing street vendors and leading a gang who
terrorised the night markets. The police caught him and locked him in the damp holding cells of the
district station, but Kaddy always appeared with bribe money and theatrical tears, and outside she would
laugh and tell him he was invincible. The test came when Kaddy learned of a gold trader in an isolated
compound near the coast. She handed him a metal bar. That night Modou broke in, the trader fought back,
and Modou fled with a sack of gold, leaving him injured. The police caught him scaling the perimeter wall.
In the interrogation room he stayed smug, until Kaddy was led in wearing handcuffs: a raid on her house had
found a chest beneath the floorboards full of stolen jewelry. At the court trial the judge sentenced him to
life. As the prison van doors slammed, Modou stared through the barred window at his mother being led away.`;

test("a pasted story is detected as an adaptation; a one-line premise is not", () => {
  assert(isAdaptation(SOURCE_STORY), "a full story must be detected");
  assert(!isAdaptation("A woman hides money from her own family."), "a premise must not be");
  assert(!isAdaptation("A boy steals for his mother in the market."), "a longer premise must not be");
  // Long but not narrative — a wall of adjectives is not a story to adapt.
  assert(!isAdaptation("bright bold modern clean minimal warm ".repeat(30)), "non-narrative text must not be");
});

test("the adaptation mandate forbids the four things that went wrong", () => {
  const m = adaptationMandate({ numScenes: 30, sourceStory: SOURCE_STORY });
  assert(/USE THE WHOLE STORY/.test(m), "it must demand full coverage");
  assert(/INVENT NO CHARACTERS/.test(m), "it must forbid inventing a detective");
  assert(/RELOCATE NOTHING/.test(m), "it must forbid collapsing into one room");
  assert(/KEEP THE ENDING THEY WROTE/.test(m), "it must forbid a replacement ending");
  assert(/DO NOT REPEAT A SCENE/.test(m), "it must forbid the same beat eleven times");
  assert(m.includes("Brikama"), "the source story must be carried in the mandate itself");
  assert(/SUSPENDS EVERY INSTRUCTION YOU HAVE READ ABOUT ORIGINALITY/.test(m), "it must override the doctrine");
});

/** The blueprint the director actually got, reconstructed. */
function theFailedFilm() {
  const room = "Brikama police holding room, damp concrete walls, rusted iron pipe, low wooden desk";
  const market = "the crowded sun-bleached Brikama Market under blue plastic tarpaulins";
  const marketScenes = [1, 6, 9, 10, 12, 13, 14, 15, 16, 17, 19];
  const sceneBeats = [];
  for (let i = 1; i <= 30; i++) {
    const inMarket = marketScenes.includes(i);
    sceneBeats.push({
      sceneNumber: i,
      act: i === 1 ? "open" : i === 30 ? "land" : "escalate",
      location: inMarket ? market : room,
      purpose: inMarket ? "she sends him to steal" : "the interrogation continues",
      moment: inMarket
        ? "Kaddy aggressively shoves Modou into the crowded market lane and points toward a wealthy target. Modou stumbles, recovers with a smirk, and slips into the crowd."
        : "Inspector Jallow sits at the desk while Modou strains against the handcuffs on the iron pipe and Kaddy argues across the wooden desk.",
    });
  }
  return { sceneBeats };
}

test("a film that collapses into one room is caught", () => {
  const v = repetitionViolations(theFailedFilm(), { numScenes: 30 });
  assert(
    v.some((x) => /19 of 30 scenes happen in the same place/.test(x)),
    `location concentration not caught: ${v.map((x) => x.slice(0, 70)).join(" | ")}`
  );
});

test("the same scene written eleven times is caught", () => {
  const v = repetitionViolations(theFailedFilm(), { numScenes: 30 });
  assert(
    v.some((x) => /Scenes 1, 6, 9, 10, 12/.test(x)),
    "the repeated market scenes must be caught"
  );
  assert(
    v.some((x) => /the same scene written 19 times/.test(x)),
    "the repeated room scenes must be caught"
  );
});

test("a film that drops most of the director's story is caught", () => {
  const v = coverageViolations(theFailedFilm(), SOURCE_STORY);
  assert(v.length > 0, "dropping the story must be caught");
  assert(
    v.some((x) => /have NO SCENE anywhere in this film/.test(x)),
    `expected the coverage fault: ${v.map((x) => x.slice(0, 80)).join(" | ")}`
  );
  // Every missing event is enumerated, not summarised as a percentage — the
  // director's rule is that every event gets filmed, and a repair needs the list.
  assert(v[0].includes("   1. "), "the missing events must be listed, in order");
});

test("a faithful spread across the story's real locations PASSES", () => {
  // The film that should have been made: every phase of the source, in its own
  // place, moving forward in time. Thirty genuinely different moments.
  const scenes = [
    ["Brikama market", "Kaddy shoves young Modou at a woman's woven bag and he lifts her purse"],
    ["Brikama market", "Modou snatches a merchant's cash box off the counter and bolts"],
    ["Kaddy's front room", "Kaddy counts the stolen notes and pockets every dalasi, praising him"],
    ["Brikama market", "an older Modou palms a phone from a stall while the seller weighs rice"],
    ["a lane behind the market", "Modou strips a bicycle and sells the parts to a scrap boy"],
    ["a rival shop", "Modou smashes the shutters with a brick while the owner shouts"],
    ["the night markets", "Modou's gang surround a vendor and empty his takings tin"],
    ["the night markets", "a stallholder swings a stick at the gang and they scatter laughing"],
    ["a district street", "police grab Modou by the collar as he runs with a sack"],
    ["the district station holding cells", "Modou sits on a damp bench picking at the wall plaster"],
    ["the district station front desk", "Kaddy weeps theatrically and counts bribe notes onto the counter"],
    ["the alleyway outside the station", "Kaddy slaps his back and tells him he is invincible"],
    ["Brikama market", "Modou takes a woman's bracelet clean off her wrist in daylight"],
    ["the district station holding cells", "a second arrest, a bored officer, the same bench"],
    ["the district station front desk", "Kaddy pays again, thicker notes, no tears this time"],
    ["Kaddy's front room", "Kaddy describes the gold trader and hands Modou a heavy metal bar"],
    ["a coastal road", "Modou walks the dark road toward the compound with the bar under his shirt"],
    ["the coastal compound wall", "Modou levers a window catch and climbs through into the dark"],
    ["the trader's bedroom", "the trader wakes, grabs Modou's wrist, and they crash into a cabinet"],
    ["the trader's bedroom", "Modou strikes the trader down and the man stops moving"],
    ["the compound courtyard", "Modou fills a sack with gold while sirens start somewhere near"],
    ["the compound perimeter wall", "Modou is dragged off the wall by officers, the sack splitting open"],
    ["a police van", "Modou is driven through the night, bleeding, still smirking"],
    ["the interrogation room", "Modou boasts that his mother will pay by morning as she always does"],
    ["Kaddy's house", "officers lever up the floorboards and lift out a chest of jewelry"],
    ["Kaddy's house", "an officer photographs the cash and the ledgers spread on the bed"],
    ["the interrogation room", "the iron door opens and Kaddy is led in wearing handcuffs"],
    ["the interrogation room", "Modou reads her face and understands she was never coming to save him"],
    ["the courtroom", "the judge delivers a sentence of life imprisonment without parole"],
    ["the prison van", "Modou stares through the barred window at his mother led the other way"],
  ];
  const sceneBeats = scenes.map(([location, moment], i) => ({
    sceneNumber: i + 1,
    act: i === 0 ? "open" : i === 29 ? "land" : i === 19 ? "climax" : i === 13 ? "turn" : "escalate",
    location,
    purpose: `phase ${i + 1}`,
    moment,
  }));
  const film = { sceneBeats };
  const rep = repetitionViolations(film, { numScenes: 30 });
  assert(rep.length === 0, `a properly spread film must pass: ${rep.map((x) => x.slice(0, 110)).join(" | ")}`);
  const cov = coverageViolations(film, SOURCE_STORY);
  assert(
    !cov.some((x) => /is not an adaptation/.test(x)),
    `a film covering every phase must not be flagged as a replacement: ${cov.map((x) => x.slice(0, 110)).join(" | ")}`
  );
});

test("the gates do not fire on a legitimate short two-hander", () => {
  // A six-scene film that genuinely lives in one kitchen is a real and often
  // superior choice, and the doctrine says so. The gates are aimed at a LONG
  // film collapsing into a box, not at a short one choosing to stay in one.
  const moments = [
    "she sets the pot down hard and asks him where the money went",
    "he empties his pockets onto the table and finds nothing to show her",
    "the neighbour knocks and they both go silent until the footsteps leave",
    "she opens the tin and counts what is left, twice, saying nothing",
    "he takes the tin from her hands and she lets him",
    "he puts it back on the shelf with the lid off and walks out",
  ];
  const sceneBeats = moments.map((moment, i) => ({
    sceneNumber: i + 1,
    act: i === 0 ? "open" : i === 5 ? "land" : "escalate",
    location: "the kitchen",
    purpose: `p${i}`,
    moment,
  }));
  const v = repetitionViolations({ sceneBeats }, { numScenes: 6 });
  assert(v.length === 0, `a six-scene two-hander must pass: ${v.map((x) => x.slice(0, 100)).join(" | ")}`);
});

// ── APPEARANCE BELONGS TO THE PICTURES ──────────────────────────────────────
//
// The director's complaint, verbatim: the prompts and the agent kept checking
// that physical appearance was present, when the board shots already carry it —
// "if you start describing people there, it's going to cause a lot of confusion.
// It's going to swap different outfits, haircuts, and I've seen this play out so
// many other times."

const { MANDATORY_PROMPT_RULES } = require_("../functions/optiqStoryX/pipeline.js");
const { WORD_BUDGETS } = require_("../functions/optiqStoryX/index.js");
const { sceneViolations } = require_("../functions/optiqStoryX/agentTools.js");

test("the prompt rules demand a full description, because nothing is attached", () => {
  const r = MANDATORY_PROMPT_RULES;
  // THE INVERSION. Every one of these assertions is the opposite of what this
  // test asserted while the film was photographed, and that is the point: a
  // prompt written to the old rules and rendered under the new system produces a
  // film with a different cast in every scene.
  assert(/THIS PROMPT IS THE ENTIRE FILM\. NOTHING IS ATTACHED TO IT\./.test(r), "rule 0 must say nothing is attached");
  assert(/DESCRIBE EVERY PERSON COMPLETELY/.test(r), "rule 2 must demand the full description");
  assert(/THEN THE WARDROBE, SEPARATELY/.test(r), "wardrobe must have its own budget, or it gets cut first");
  assert(/PASTE IT VERBATIM/.test(r), "the location block must be pasted, not re-worded");
  assert(/DIALOGUE IS THE BIGGEST BLOCK ON THE PAGE/.test(r), "dialogue is still the priority");
  assert(new RegExp(`${WORD_BUDGETS.perCharacterMin}.${WORD_BUDGETS.perCharacterMax} WORDS EACH`).test(r), "the per-character budget must be stated");
  assert(new RegExp(`${WORD_BUDGETS.backgroundMax} FOR ANYWHERE COMPLICATED`).test(r), "complex places must get the top of the range");

  // And the photographed-era rules that would now break the film are GONE.
  assert(!/IDENTIFY PEOPLE, DO NOT DESCRIBE THEM/.test(r), "the do-not-describe rule must be gone");
  assert(!/NO face\. NO complexion\. NO build\. NO hair\./.test(r), "the banned-appearance list must be gone");
  assert(!/THE SETTING IS ONE LINE/.test(r), "the one-line setting rule must be gone");
  assert(!/THE FRAMES ARE RIGHT/.test(r), "there are no frames to be right");
});

test("the word budgets are the ones the director asked for", () => {
  // These numbers ARE the consistency mechanism on a film type with no pictures,
  // so they are pinned rather than left to drift with an edit to index.js.
  assert(WORD_BUDGETS.scenePromptMin === 2500 && WORD_BUDGETS.scenePromptMax === 3000, "scene prompts are 2,500–3,000");
  assert(WORD_BUDGETS.perCharacterMin === 150 && WORD_BUDGETS.perCharacterMax === 250, "150–250 words per character");
  assert(WORD_BUDGETS.wardrobeMin >= 90 && WORD_BUDGETS.wardrobeMax <= 120, "~100 words of wardrobe, budgeted apart");
  assert(WORD_BUDGETS.backgroundMax === 700, "700 words on a complicated place");
  // A hard floor above the OLD target, so nothing written for the photographed
  // pipeline can pass this gate by accident.
  assert(WORD_BUDGETS.scenePromptHardFloor > 2000, "the floor must sit above the old 2,000-word ceiling");
});

test("the agent polices the locks, and no longer polices them away", () => {
  const LCB = "AWA — a Black Gambian woman in her late thirties with golden-brown skin, a square jaw and short natural hair.";
  const WARDROBE = "A TEAL wax-print wrapper, knotted at the left hip, over a plain white cotton vest.";
  const VOICE = "Smoky, unhurried, mocking hum at the end of sentences.";
  const project = {
    musicSpec: "",
    blueprint: { registry: { characters: [{ name: "Awa", lcb: LCB, wardrobe: WARDROBE, voice: VOICE }] } },
  };

  // A prompt that does it RIGHT: every lock pasted verbatim, packed with talk.
  const good = {
    sceneNumber: 4,
    dialogue: [
      "AWA: You went in.",
      "MODOU: I went nowhere.",
      "AWA: The box is empty.",
      "MODOU: Then it was empty.",
      "AWA: Do not lie to me twice.",
    ].join("\n"),
    fullPrompt:
      `${LCB} ${WARDROBE} ` +
      `DIALOGUE. Awa — ${VOICE} AWA: You went in. ` +
      "MODOU: I went nowhere. AWA: The box is empty. MODOU: Then it was empty. AWA: Do not lie to me twice. " +
      "ACTION. 0.0s she lifts the lid. 3.0s he steps back. 6.0s she stands. " +
      "ABSOLUTE RULES: NO MUSIC of any kind. " +
      "SOUND. NO MUSIC. Room tone, the lid on wood. CAMERA. Locked wide. " +
      "authored specific detail about what happens next and how it sounds ".repeat(320) +
      " CLOSING RESTATEMENT: unscored and musically silent, no music of any kind.",
  };
  const clean = sceneViolations(good, project).violations;
  assert(clean.length === 0, `a complete prompt must pass: ${clean.join(" | ")}`);

  // THE INVERSION. A prompt that names a complexion used to be the thing that
  // got FLAGGED here. Now it is a prompt that has DROPPED the block.
  const stripped = { ...good, fullPrompt: good.fullPrompt.replace(LCB, "Awa is in the doorway.") };
  assert(
    sceneViolations(stripped, project).violations.some((v) => /Locked Character Block is missing/.test(v)),
    "a prompt that dropped the character block must be caught"
  );
  const undressed = { ...good, fullPrompt: good.fullPrompt.replace(WARDROBE, "in her usual clothes.") };
  assert(
    sceneViolations(undressed, project).violations.some((v) => /wardrobe lock is missing/.test(v)),
    "a prompt that paraphrased the wardrobe must be caught — clothes are the first thing a rewrite drops"
  );
  assert(
    !sceneViolations(good, project).violations.some((v) => /describes how someone LOOKS/i.test(v)),
    "the agent must NOT flag appearance any more — that check belonged to the photographed era"
  );

  // And a scene that has gone quiet, or dropped a voice profile.
  const quiet = { ...good, dialogue: "AWA: You went in." };
  assert(
    sceneViolations(quiet, project).violations.some((v) => /spoken line/.test(v)),
    "a thin scene must be caught"
  );
  const voiceless = { ...good, fullPrompt: good.fullPrompt.replace(VOICE, "") };
  assert(
    sceneViolations(voiceless, project).violations.some((v) => /VOICE PROFILE is missing/.test(v)),
    "a dropped voice profile must be caught"
  );

  // A short prompt is a prompt that left half the world to the model.
  const thin = { ...good, fullPrompt: `${LCB} ${WARDROBE} ${VOICE} short.` };
  assert(
    sceneViolations(thin, project).violations.some((v) => new RegExp(`${WORD_BUDGETS.scenePromptHardFloor}`).test(v)),
    "a prompt under the hard floor must be caught"
  );
});

// ── THE LOCATION BIBLE ──────────────────────────────────────────────────────
//
// The module that replaced the shot board. Its whole job is that two clips
// generated from the same 600 words come back as the same room — so the things
// worth testing are the ones that silently break that: a thin block, a block that
// was paraphrased instead of pasted, and two rooms of the same kind that were
// never told apart.

const {
  locationBlockText,
  locationForBeat,
  locationViolations,
  blockWordCount,
  verbatimCoverage,
  MIN_BLOCK_COVERAGE,
} = require_("../functions/optiqStoryX/locations.js");

/**
 * A block that JUST clears the 500-word floor, with all eight sections filled.
 *
 * Sized deliberately close to the line: a fixture that clears it by a thousand
 * words would pass the gate whatever the gate did, and the thin case below —
 * which is the one worth catching — would never fall under it.
 */
function fatLocation(over) {
  const filler = (label) => `${label} ${"specific authored detail about this room and what is in it ".repeat(6)}`;
  return {
    id: "kitchen-day",
    name: "The kitchen",
    aliases: ["kitchen"],
    scenes: [1, 2, 30],
    timeOfDay: "day",
    complexity: "simple",
    shell: filler("Six paces by four, one door to the yard and one window over the sink."),
    surfaces: filler("Bare cement floor, blue-washed walls scuffed at chair height."),
    light: filler("Hard daylight through the yard door, the far corner in shadow."),
    fixtures: filler("A wooden table centre, two stools, a gas ring on a shelf."),
    dressing: filler("A dented rice tin on the shelf, a plastic kettle, a torn calendar."),
    geography: filler("The near stool faces the door; the far stool has its back to the window."),
    backgroundLife: filler("Nobody else; a neighbour crosses the yard beyond the door."),
    sound: filler("The fridge hum, the yard beyond, distant traffic."),
    distinctFrom: "Nothing else in this film resembles this place.",
    ...over,
  };
}

test("a location block is composed in the fixed order, every time", () => {
  const text = locationBlockText(fatLocation());
  const order = ["THE SHELL", "THE SURFACES", "THE LIGHT", "THE FIXED FURNITURE", "THE DRESSING", "THE SEATING", "THE BACKGROUND LIFE", "THE SOUND OF THE PLACE"];
  let at = -1;
  for (const label of order) {
    const found = text.indexOf(label);
    assert(found > at, `${label} is out of order or missing in the composed block`);
    at = found;
  }
  assert(/WHICH PLACE THIS IS NOT/.test(text), "the separation clause must ride in the block");
  assert(blockWordCount(fatLocation()) >= 500, "a composed block must clear the budget");
});

test("the bible gate catches a thin block, an orphan scene and an unfilled section", () => {
  const storyline = { sceneBeats: [{ sceneNumber: 1, location: "the kitchen", charactersPresent: ["Awa"] }] };

  assert(locationViolations({ locations: [fatLocation()] }, storyline).length === 0, "a complete bible must pass");

  const thin = locationViolations(
    { locations: [fatLocation({ shell: "A kitchen.", surfaces: "Cement.", light: "Daylight." })] },
    storyline
  );
  assert(thin.some((v) => /words — a simple place owes/.test(v)), "a short block must be caught");
  assert(thin.some((v) => /empty or one-line section/.test(v)), "a one-line section must be caught");

  // A COMPLEX place owes 700 even when the same block would have cleared a
  // simple one. This is the whole point of the distinction — a bank has dozens
  // of independently-invented details and a bedroom does not.
  const bank = locationViolations(
    { locations: [fatLocation({ id: "bank", name: "The bank", aliases: ["the bank"], scenes: [1] })] },
    { sceneBeats: [{ sceneNumber: 1, location: "the bank" }] }
  );
  assert(bank.some((v) => /a COMPLEX place owes 700/.test(v)), "a bank on the simple budget must be caught");

  const orphan = locationViolations(
    { locations: [fatLocation({ name: "The yard", aliases: [], scenes: [9] })] },
    storyline
  );
  assert(orphan.some((v) => /have no location block/.test(v)), "a scene with no room must be caught");

  const geoThin = locationViolations({ locations: [fatLocation({ geography: "Two stools and a table." })] }, storyline);
  assert(geoThin.some((v) => /SEATING AND STANDING GEOGRAPHY/.test(v)), "a thin geography must be caught by name");
});

test("two rooms of the same kind must be told apart, or the film loses its geography", () => {
  // THE failure this module exists for, after drift itself: a bible that calls
  // both offices "a small office" has written ONE office.
  const storyline = {
    sceneBeats: [
      { sceneNumber: 1, location: "the branch office" },
      { sceneNumber: 2, location: "the head office" },
    ],
  };
  const blurred = {
    locations: [
      fatLocation({ id: "branch-office", name: "The branch office", aliases: ["branch office"], scenes: [1], distinctFrom: "Nothing else resembles it." }),
      fatLocation({ id: "head-office", name: "The head office", aliases: ["head office"], scenes: [2], distinctFrom: "Nothing else resembles it." }),
    ],
  };
  const faults = locationViolations(blurred, storyline);
  assert(faults.some((v) => /places of the same kind/.test(v)), "two offices that never name each other must be caught");

  const separated = {
    locations: [
      fatLocation({ id: "branch-office", name: "The branch office", aliases: ["branch office"], scenes: [1], distinctFrom: "This is NOT the head office in scene 2 — that one is square and sunlit; this one is narrow and fluorescent-lit." }),
      fatLocation({ id: "head-office", name: "The head office", aliases: ["head office"], scenes: [2], distinctFrom: "This is NOT the branch office in scene 1 — that one is narrow and fluorescent-lit; this one is square, sunlit and dominated by a dark wooden cabinet." }),
    ],
  };
  assert(
    !locationViolations(separated, storyline).some((v) => /places of the same kind/.test(v)),
    "naming the sibling must satisfy the separation rule"
  );
});

test("a location block that names the cast would walk them into scenes they are not in", () => {
  const storyline = { sceneBeats: [{ sceneNumber: 1, location: "the kitchen", charactersPresent: ["Awa", "Ndey"] }] };
  const contaminated = { locations: [fatLocation({ backgroundLife: `Awa is usually at the far stool. ${"and other people cross the yard beyond the door ".repeat(14)}` })] };
  assert(
    locationViolations(contaminated, storyline).some((v) => /from the cast/.test(v)),
    "a character named in a location block must be caught"
  );
});

test("a scene is matched to its block by scene list first, then by name", () => {
  const bible = { locations: [fatLocation({ scenes: [1, 2] })] };
  assert(locationForBeat(bible, { sceneNumber: 2 })?.id === "kitchen-day", "the designer's own scene list is the authority");
  // A scene the designer's list missed still finds its room by name or alias.
  assert(locationForBeat(bible, { sceneNumber: 9, location: "kitchen" })?.id === "kitchen-day", "an alias must match");
  assert(!locationForBeat(bible, { sceneNumber: 9, location: "the police station" }), "an unrelated place must not match");
});

test("paraphrasing a block fails the coverage check; pasting it with staging on top does not", () => {
  const block = locationBlockText(fatLocation());
  const pasted = `PEOPLE. Awa is on the near stool.\n${block}\nSTAGING. The stool is pulled out and the shutter is closed today.`;
  assert(verbatimCoverage(pasted, block) === 1, "a verbatim paste with staging around it must score 1");
  const reworded = block.replace(/room/g, "space").replace(/detail/g, "particular");
  assert(verbatimCoverage(reworded, block) < MIN_BLOCK_COVERAGE, "a re-worded block must fall under the floor");
});

// ── THE WIRING ──────────────────────────────────────────────────────────────

const SCENE_COUNT = 30;

function beats() {
  return longFilm(withMidpoint).sceneBeats;
}

const STORYLINE = longFilm(withMidpoint);

const REGISTRY = {
  characters: [
    {
      name: "Awa",
      role: "lead",
      scenes: Array.from({ length: SCENE_COUNT }, (_, i) => i + 1),
      tell: "she smooths her wrapper when she is lying",
      lcb: "AWA — a Black Gambian woman in her late thirties with golden-brown skin and short natural hair.",
      wardrobe: "A TEAL wax-print wrapper.",
      voice: "Low and unhurried, a smoker's rasp under it, Wolof-inflected English; she goes quiet when she is angry rather than loud.",
    },
    {
      name: "Ndey",
      role: "daughter",
      scenes: [10, 15, 21, 25, 30],
      tell: "she checks a pocket she has already checked",
      lcb: "NDEY — a Black Gambian woman of nineteen with very deep blue-black skin and long box braids.",
      wardrobe: "A faded YELLOW dress.",
      voice: "Bright and fast, high in her chest, mission-school precise; she answers before you have finished asking.",
    },
  ],
  elements: [{ name: "rice tin", anchor: "a dented aluminium rice tin with a loose lid", scenes: [1, 15, 30] }],
  recurringSets: [{ name: "the kitchen", anchor: "a narrow kitchen with a blue-washed wall", scenes: [1, 2, 30] }],
  soundSpec:
    "NO MUSIC of any kind. The compound's own noise carries the clip: the fridge hum, the yard beyond, distant traffic.",
  ambienceSpec: "Low fridge hum and a quiet yard.",
  styleHeader: "Documentary-real, handheld, honest daylight. Nobody looks at the lens. Dialogue in ENGLISH.",
};

/**
 * The stub's LOCATION BIBLE — what the shot board's WORLD plan used to be.
 *
 * Two entries rather than one, and deliberately: the kitchen and the yard exist
 * so the scene-builder wiring can be checked against a scene that resolves to a
 * block AND one that resolves to a different block. A single-location bible would
 * pass the same assertions while proving nothing about the matching.
 */
function bibleSection(text) {
  return `${text} ${"specific authored detail about this place and what is in it ".repeat(14)}`;
}

const BIBLE = {
  locations: [
    {
      id: "kitchen-day",
      name: "the kitchen",
      aliases: ["kitchen", "the compound kitchen"],
      scenes: Array.from({ length: SCENE_COUNT }, (_, i) => i + 1),
      timeOfDay: "day",
      complexity: "simple",
      shell: bibleSection("Six paces by four, one door to the yard and one window over the sink."),
      surfaces: bibleSection("Bare cement floor, blue-washed walls scuffed at chair height."),
      light: bibleSection("Hard daylight through the yard door; the far corner stays in shadow."),
      fixtures: bibleSection("A wooden table centre, two stools, a gas ring on a shelf."),
      dressing: bibleSection("A dented rice tin on the shelf, a plastic kettle, a torn calendar."),
      geography: bibleSection("The near stool faces the door; the far stool has its back to the window."),
      backgroundLife: bibleSection("Nobody else inside; a neighbour crosses the yard beyond the door."),
      sound: bibleSection("The fridge hum, the yard beyond, distant traffic."),
      distinctFrom: "Nothing else in this film resembles this place.",
    },
  ],
};

function skillReply(obj) {
  return { candidates: [{ finishReason: "STOP", content: { parts: [{ text: JSON.stringify(obj) }] } }] };
}

/** A prompt long enough to clear the word gate, carrying every lock AND the voice. */
function fatPrompt(beat, chars) {
  const filler = "authored specific detail about the room and the people in it ".repeat(230);
  return [
    chars.map((c) => `${c.lcb} ${c.wardrobe}`).join(" "),
    REGISTRY.styleHeader,
    "ABSOLUTE RULES: NO MUSIC of any kind.",
    `SOUND: NO MUSIC. ${REGISTRY.soundSpec}`,
    `DIALOGUE. ${chars.map((c) => `${c.name} — ${c.voice} ${c.name}: "How much?"`).join(" ")}`,
    "[0-3s] She lifts the lid. [3-6s] She counts. [6-10s] She puts it back.",
    "Every person in frame is Black Gambian.",
    filler,
    "CLOSING RESTATEMENT: unscored and musically silent, no music of any kind.",
  ].join("\n");
}

function stubVertex(captured, { slowScenes = false } = {}) {
  let sceneCalls = 0;
  return async (_path, body) => {
    const system = body.systemInstruction.parts[0].text;
    const userText = (body.contents[0].parts || []).map((p) => p.text || "").join("\n");
    const parts = body.contents[0].parts || [];
    captured.push({ system, userText, parts, all: `${system}\n───── USER ─────\n${userText}` });

    if (/You are the PREMISE ANALYST/.test(system)) {
      return skillReply({
        genre: "domestic drama", premiseSummary: "a woman hides money", whoItIsAbout: "Awa",
        whatTheyWant: "to pay the school fees", whatIsInTheWay: "her daughter finds the tin",
        whatIsAtStake: "the fees due Friday", audienceFeeling: "quietly wrecked",
        toneRegister: "held-in", language: "English", setting: "Serrekunda, The Gambia",
        castingShape: "ensemble", castingRationale: "two people, one tin",
      });
    }
    if (/THE CONCEPT ROOM/.test(system) && /WHAT TO RETURN/.test(system)) {
      return skillReply({
        concepts: [
          {
            title: "The Rice Tin", logline: "A woman hides money and is found out by the person she is hiding it for.",
            engine: "the thing taken without asking", openingImage: "notes going into a tin, fast",
            eventDensity: ["notes hidden", "key turns", "tin found"],
            whatIsAtStake: "the school fees", theTurn: "Ndey is already holding the tin",
            theEnding: "the tin goes back with the lid off", risk: "too quiet",
          },
        ],
        pick: "The Rice Tin",
        pickRationale: "the tin generates events",
      });
    }
    if (/You are the STORY DOCTOR/.test(system)) return skillReply(STORYLINE);
    if (/You are STORYLINE/.test(system)) return skillReply(STORYLINE);
    if (/You are CASTING-REGISTRY/.test(system)) return skillReply(REGISTRY);
    if (/You are the LOCATION DESIGNER/.test(system)) return skillReply(BIBLE);
    if (/You are a SCENE BUILDER/.test(system)) {
      // Simulates a pass that runs out of clock partway through a long film: each
      // scene "takes" long enough that the budget lapses after a handful.
      if (slowScenes) {
        sceneCalls++;
        if (sceneCalls > 5) await new Promise((r) => setTimeout(r, 60));
      }
      const n = Number(/Build scene (\d+)/.exec(userText)?.[1] || 1);
      const beat = beats().find((b) => b.sceneNumber === n) || beats()[0];
      const chars = REGISTRY.characters.filter((c) => (beat.charactersPresent || []).includes(c.name));
      return skillReply({
        sceneNumber: n, setting: beat.location, action: beat.moment,
        // The builder reproduces the storyline's planned lines — which is what
        // the whole dialogue chain is built to make it do.
        dialogue: (beat.dialogue || []).join("\n"),
        sound: "Room tone.", fullPrompt: fatPrompt(beat, chars),
      });
    }
    if (/You are the SCENE VERIFIER/.test(system)) {
      const scene = JSON.parse(/THE SCENE TO REPAIR:\n([\s\S]+)$/.exec(userText)[1]);
      return skillReply(scene);
    }
    throw new Error(`unstubbed skill:\n${system.slice(0, 200)}`);
  };
}

// ── A COMPLETE PASS ─────────────────────────────────────────────────────────

const captured = [];
const film = await runOptiqStoryXBlueprint({
  vertexFetch: stubVertex(captured),
  prompt: "A woman hides money from her own family.",
  length: "300s",
  aspectRatio: "16:9",
  castingSeed: "storyx-test-1",
  // Deliberately passed and deliberately ignored, exactly as the router does.
  brandName: "Zorblaxco",
  product: "hyperwidget nine thousand",
});

await testAsync("wiring: a 300s blueprint is 30 scenes and reports itself done", async () => {
  assert(film.scenes.length === SCENE_COUNT, `${film.scenes.length} scenes`);
  assert(film.done === true, "a completed pass must say so");
  assert(film.missing.length === 0, `${film.missing.length} scene(s) reported missing`);
  assert(film.videoType === STORYX_VIDEO_TYPE, `videoType is ${film.videoType}`);
  assert(STORY_KIND.dialogueInVideo === true, "the characters speak on camera");
});

await testAsync("wiring: NO image is made, planned, or attached, anywhere", async () => {
  // Every part of every call is text; an inlineData part would mean a picture was
  // made or attached at some point in this pipeline.
  for (const { parts } of captured) {
    assert(
      parts.every((p) => p.text !== undefined && p.inlineData === undefined),
      "an image rode along with a blueprint skill call"
    );
  }
  // And the cast sheets are not merely un-photographed, they are not PLANNED.
  // This used to assert the opposite — that two sheets were planned with no
  // bytes behind them, ready for the board to photograph in stage 2. There is no
  // stage 2, so a planned sheet is a promise nothing will keep.
  assert(
    Array.isArray(film.characterRefs) && film.characterRefs.length === 0,
    `characterRefs must be empty, got ${JSON.stringify(film.characterRefs)}`
  );
});

await testAsync("wiring: every builder is told nothing is attached, and handed its room", async () => {
  const builders = captured.filter(({ system }) => /You are a SCENE BUILDER/.test(system));
  assert(builders.length === SCENE_COUNT, `${builders.length} scene builders ran`);
  const block = locationBlockText(BIBLE.locations[0]);
  for (const b of builders) {
    assert(!/ATTACHED CHARACTER REFERENCE/.test(b.all), "a builder was told a reference was attached when none is");
    assert(
      /NOTHING IS ATTACHED TO THIS PROMPT/.test(b.system),
      "a builder must be told the words are the whole film"
    );
    // THE LOCATION BLOCK RIDES WITH THE INSTRUCTION TO PASTE IT. One without the
    // other is how a scene ends up re-inventing a room the bible already wrote.
    assert(/PASTE IT VERBATIM/.test(b.system), "a builder must be told to paste its location block");
    assert(b.system.includes(block), "a builder was not handed its actual location block");
    assert(/DO NOT RE-DESCRIBE THE WALLS/.test(b.system), "a builder must be told to stage, not re-describe");
  }
});

await testAsync("wiring: the location bible is written BEFORE the builders that paste it", async () => {
  assert(film.locations, "the blueprint must carry a location bible");
  assert((film.locations.locations || []).length > 0, "the bible has no places");
  assert(!film.world, "the shot board's world plan must be gone");

  const designerAt = captured.findIndex(({ system }) => /You are the LOCATION DESIGNER/.test(system));
  const firstBuilderAt = captured.findIndex(({ system }) => /You are a SCENE BUILDER/.test(system));
  assert(designerAt >= 0, "the location designer never ran");
  // ORDER IS LOAD-BEARING, and it is the one thing that changed structurally when
  // this replaced the world pass: the world plan ran at the END of the blueprint
  // because the board consumed it in a later stage. The bible must run BEFORE the
  // builders, because the builders paste what it writes.
  assert(
    designerAt < firstBuilderAt,
    `the location designer ran at ${designerAt}, after the first builder at ${firstBuilderAt}`
  );

  // It designs from the STORYLINE's places, so it must have seen them all.
  const designer = captured[designerAt];
  assert(/scene\(s\)/.test(designer.userText), "the designer was not shown which scenes are where");
  assert(/two places of the same kind/.test(designer.userText), "the designer was not reminded of the separation rule");
});

await testAsync("wiring: every character gets a locked VOICE, and the scenes paste it", async () => {
  const registryPrompt = captured.find(({ system }) => /You are CASTING-REGISTRY/.test(system));
  assert(/THE VOICE PROFILE/.test(registryPrompt.system), "the registry was never asked for voice profiles");
  const builder = captured.find(({ system }) => /You are a SCENE BUILDER/.test(system));
  assert(
    /VOICE PROFILE IS PASTED VERBATIM/.test(builder.system),
    "a builder was not told to paste the voice profile"
  );
  assert(
    /nothing is attached to this film/i.test(builder.system),
    "a builder was not told WHY every lock has to be pasted verbatim"
  );
  // The gate ran and did not fire: every scene with dialogue pasted the voice.
  for (const scene of film.scenes) {
    if (!/Awa:/.test(scene.dialogue || "")) continue;
    assert(
      scene.fullPrompt.includes(REGISTRY.characters[0].voice),
      `scene ${scene.sceneNumber} has Awa speaking but no voice lock`
    );
  }
});

// A whole second pass, driven by the director's own story, proving the pipeline
// switches modes rather than merely owning a module that could.
const adaptCaptured = [];
const adapted = await runOptiqStoryXBlueprint({
  vertexFetch: stubVertex(adaptCaptured),
  prompt: SOURCE_STORY,
  length: "300s",
  aspectRatio: "16:9",
  castingSeed: "storyx-adapt-1",
});

await testAsync("a supplied story SKIPS the concept room entirely", async () => {
  // The concept room's job is "reject the literal reading and invent four
  // alternatives". Run over a finished story that is not ideation, it is
  // deletion — and it is what produced a film with an invented detective in it.
  const room = adaptCaptured.filter(({ system }) => /THE CONCEPT ROOM/.test(system));
  assert(room.length === 0, `the concept room ran ${room.length} time(s) on an adaptation`);
  // The premise-mode run above must still use it, or this proves nothing.
  const premiseRoom = captured.filter(({ system }) => /THE CONCEPT ROOM/.test(system));
  assert(premiseRoom.length > 0, "the concept room must still run on a one-line premise");
});

await testAsync("every skill that could rewrite the story is handed it verbatim", async () => {
  const mandated = adaptCaptured.filter(({ system }) => /THIS IS AN ADAPTATION/.test(system));
  assert(mandated.length >= 2, `only ${mandated.length} skill(s) got the adaptation mandate`);
  // Not a summary of the story — the story.
  for (const { system } of mandated) {
    assert(system.includes("Brikama"), "a skill got the mandate without the source story in it");
    assert(system.includes("prison van"), "the source story was truncated before the ending");
    assert(/RELOCATE NOTHING/.test(system), "a skill was not told to keep the locations");
  }
  // And the storyline is told the story exists rather than told to invent one.
  const storyline = adaptCaptured.find(({ system }) => /You are STORYLINE/.test(system));
  assert(
    /THE DIRECTOR HAS ALREADY WRITTEN THIS STORY/.test(storyline.system),
    "the storyline was still told to build a concept-room winner"
  );
  assert(adapted.scenes.length === SCENE_COUNT, `${adapted.scenes.length} scenes`);
});

await testAsync("wiring: the dialogue survives the whole chain, end to end", async () => {
  // The chain that matters: the storyline WRITES the lines, the builder is handed
  // them and told to reproduce every one, the gate counts them, and the shooting
  // brief that finally renders is compiled from them. A break anywhere in that
  // produces a beautiful, quiet, unwatchable film — and every link is silent
  // about its own failure, which is why this is checked end to end rather than
  // per-unit.
  const law = captured.filter(({ system }) => /THE DIALOGUE LAW/.test(system));
  assert(law.length >= 3, `only ${law.length} skill(s) were given the dialogue law`);

  const storyline = captured.find(({ system }) => /You are STORYLINE/.test(system));
  assert(/most important instruction on this page/i.test(storyline.system), "the storyline must be told talk is the priority");

  // Every built scene carries its planned lines.
  for (const scene of film.scenes) {
    const planned = beats().find((b) => b.sceneNumber === scene.sceneNumber);
    const want = (planned?.dialogue || []).length;
    const got = countSpokenLines(scene.dialogue);
    assert(got >= want, `scene ${scene.sceneNumber}: planned ${want} lines, built ${got}`);
    assert(got >= MIN_LINES_PER_SCENE, `scene ${scene.sceneNumber} has only ${got} line(s)`);
  }

  // And the film clears the per-minute floor it is judged on.
  const total = film.scenes.reduce((n, s) => n + countSpokenLines(s.dialogue), 0);
  const required = (SCENE_COUNT * 10 / 60) * MIN_LINES_PER_MINUTE;
  assert(total >= required, `the finished film carries ${total} lines, floor is ${required}`);

  // The builder was handed the actual lines, not just told to invent some.
  const builder = captured.find(({ userText }) => /Build scene 1\b/.test(userText));
  assert(/ALREADY WRITTEN, REPRODUCE IT IN FULL/.test(builder.userText), "the builder was not handed the planned lines");
});

await testAsync("wiring: the spine is echoed back so a continuation can reuse it", async () => {
  assert(film.brief && film.storyline && film.registry, "the blueprint must return its own spine");
  assert(film.storyline.sceneBeats.length === SCENE_COUNT, "the storyline came back short");
  assert((film.registry.characters || []).length === 2, "the registry came back short");
});

await testAsync("wiring: the brand name and product are ignored, not passed through", async () => {
  for (const { all } of captured) {
    assert(!/Zorblaxco/i.test(all), "the brand name leaked into a story prompt");
    assert(!/hyperwidget/i.test(all), "the product leaked into a story prompt");
  }
});

// ── RUNNING OUT OF TIME, AND CONTINUING ─────────────────────────────────────

const partialCaptured = [];
const partial = await runOptiqStoryXBlueprint({
  vertexFetch: stubVertex(partialCaptured, { slowScenes: true }),
  prompt: "A woman hides money from her own family.",
  length: "300s",
  aspectRatio: "16:9",
  castingSeed: "storyx-test-1",
  // Tiny budget: enough to decide the film, not enough to write thirty scenes.
  budgetMs: 150,
});

await testAsync("a pass that runs out of clock stops cleanly and says what is missing", async () => {
  assert(partial.done === false, "a truncated pass must not claim to be done");
  assert(partial.missing.length > 0, "it must report the scenes it did not build");
  assert(
    partial.scenes.length + partial.missing.length === SCENE_COUNT,
    `${partial.scenes.length} built + ${partial.missing.length} missing ≠ ${SCENE_COUNT}`
  );
  // What it DID build is complete and usable, not half-written.
  for (const scene of partial.scenes) {
    assert(scene.fullPrompt && scene.fullPrompt.split(/\s+/).length > 1000, "a saved scene is truncated");
  }
  assert(
    partial.missing.every((n) => Number.isInteger(n)) &&
      partial.missing.every((n, i, a) => i === 0 || a[i - 1] < n),
    "the missing list must be sorted scene numbers"
  );
});

const continueCaptured = [];
const finished = await runOptiqStoryXBlueprint({
  vertexFetch: stubVertex(continueCaptured),
  prompt: "A woman hides money from her own family.",
  length: "300s",
  aspectRatio: "16:9",
  castingSeed: "storyx-test-1",
  // Exactly the shape functions/index.js hands a continuation — see the
  // storyXBlueprint trigger. FOUR things are carried, not three: the bible joined
  // the spine when it replaced the world plan, because a pass that re-designs the
  // rooms puts scenes 16–30 somewhere other than scenes 1–15.
  previous: {
    brief: partial.brief,
    storyline: partial.storyline,
    registry: partial.registry,
    scenes: partial.scenes,
    locations: partial.locations,
  },
});

await testAsync("the continuation finishes the film without re-deciding what it is", async () => {
  assert(finished.done === true, `the continuation did not finish: ${finished.missing.length} still missing`);
  assert(finished.scenes.length === SCENE_COUNT, `${finished.scenes.length} scenes after continuing`);

  // THE POINT OF THE TEST. Re-running the storyline would hand pass 2 a different
  // film from the one pass 1 wrote fifteen scenes of — and every reused scene
  // would then fail its lock gate against a registry it was not built from.
  const rerolled = continueCaptured.filter(({ system }) =>
    /You are STORYLINE|You are CASTING-REGISTRY|You are the PREMISE ANALYST|THE CONCEPT ROOM|You are the LOCATION DESIGNER/.test(system)
  );
  assert(rerolled.length === 0, `the continuation re-ran ${rerolled.length} spine skill(s)`);

  // THE BIBLE IS PART OF THE SPINE NOW. Same failure, one layer down: a second
  // pass that re-designed the locations would build scenes 12–30 in different
  // rooms from the eleven already written, and nothing downstream would notice
  // until the clips came back.
  assert(
    finished.locations === partial.locations,
    "the continuation did not reuse the location bible verbatim"
  );
  const block = locationBlockText(BIBLE.locations[0]);
  const lateBuilders = continueCaptured.filter(({ system }) => /You are a SCENE BUILDER/.test(system));
  assert(lateBuilders.length > 0, "the continuation built no scenes");
  for (const b of lateBuilders) {
    assert(b.system.includes(block), "a continuation builder was handed a different room");
  }

  // And it only built what was missing.
  const rebuilt = continueCaptured
    .filter(({ userText }) => /Build scene (\d+)/.test(userText))
    .map(({ userText }) => Number(/Build scene (\d+)/.exec(userText)[1]));
  assert(
    rebuilt.length === partial.missing.length,
    `the continuation built ${rebuilt.length} scenes but only ${partial.missing.length} were missing`
  );
  assert(
    rebuilt.every((n) => partial.missing.includes(n)),
    "the continuation rebuilt a scene that already existed"
  );
});

await testAsync("the finished film's scenes are in order and none are duplicated", async () => {
  const numbers = finished.scenes.map((s) => s.sceneNumber);
  assert(new Set(numbers).size === numbers.length, "a scene was built twice");
  for (let i = 1; i < numbers.length; i++) {
    assert(numbers[i] > numbers[i - 1], `scenes out of order at ${numbers[i - 1]} → ${numbers[i]}`);
  }
});

console.log(
  failures.length === 0
    ? `\n${passed} passed, 0 failed\n`
    : `\n${passed} passed, ${failures.length} failed: ${failures.join(", ")}\n`
);
process.exit(failures.length === 0 ? 0 : 1);
