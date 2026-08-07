/**
 * Character reference + casting shape test suite.
 * Run: node scripts/test-character-refs.mjs
 *
 * Two changes are under test, and both reverse something the codebase used to do
 * on purpose:
 *   1. Consistency now uses generated reference images, which doctrine §3.8
 *      explicitly forbade. The mitigations for the failures it documented
 *      (background contamination, identity fusion, words-vs-picture) are the
 *      thing worth testing, because getting them wrong reintroduces exactly the
 *      bugs the doctrine was written about.
 *   2. Uploads are placed per scene instead of attached to every scene.
 */

import { createRequire } from "node:module";

const require_ = createRequire(import.meta.url);
const {
  planCharacterRefs,
  characterRefPrompt,
  refsForScene,
  refClause,
  placeMaterials,
  MIN_SCENES_FOR_REF,
  MAX_REFS_PER_SCENE,
  MAX_REFS_PER_FILM,
} = require_("../functions/optiqSkills/characterRefs.js");
const { castingShapeViolations } = require_("../functions/optiqSkills/casting.js");

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

const character = (name, scenes, role = "role") => ({
  name,
  role,
  lcb: `${name.toUpperCase()} — a Black Gambian person with deep ebony skin and a short natural afro.`,
  wardrobe: `A ${name} TEAL cotton shirt, buttoned up.`,
  scenes,
});

const beat = (n, present, productPresent = false) => ({
  sceneNumber: n,
  moment: "hands work",
  location: "a compound",
  charactersPresent: present,
  productPresent,
});

// ── Who gets a reference ────────────────────────────────────────────────────

test("only characters who recur get a reference sheet", () => {
  // Doctrine §3.7 rule 3: a single-scene character has no consistency burden, so
  // an image buys nothing.
  const refs = planCharacterRefs(
    { characters: [character("Awa", [1, 2, 3]), character("Passerby", [2])] },
    [beat(1, ["Awa"]), beat(2, ["Awa", "Passerby"]), beat(3, ["Awa"])]
  );
  assert(refs.length === 1, `${refs.length} refs — the one-scene character should be excluded`);
  assert(refs[0].name === "Awa", refs[0].name);
  assert(MIN_SCENES_FOR_REF === 2, `MIN_SCENES_FOR_REF is ${MIN_SCENES_FOR_REF}`);
});

test("the beats widen a registry that undercounts a character's scenes", () => {
  // The two disagree in production, and the scene-builder trusts the beat — so
  // the beat has to count or a character loses their reference in a scene they
  // are visibly in.
  const refs = planCharacterRefs({ characters: [character("Modou", [2])] }, [
    beat(2, ["Modou"]),
    beat(3, ["Modou"]),
  ]);
  assert(refs.length === 1, "Modou should qualify via the beats");
  assert(JSON.stringify(refs[0].scenes) === "[2,3]", JSON.stringify(refs[0].scenes));
});

test("references are ordered by how much consistency work they do", () => {
  const refs = planCharacterRefs(
    { characters: [character("Minor", [1, 2]), character("Lead", [1, 2, 3, 4, 5])] },
    [beat(1, ["Lead", "Minor"]), beat(2, ["Lead", "Minor"]), beat(3, ["Lead"]), beat(4, ["Lead"]), beat(5, ["Lead"])]
  );
  assert(refs[0].name === "Lead", `first ref is ${refs[0].name}`);
  assert(refs[0].prominence < refs[1].prominence, "prominence should follow the ordering");
});

test("a film cannot spend unbounded images on its cast", () => {
  const many = Array.from({ length: 12 }, (_, i) => character(`P${i}`, [1, 2]));
  const refs = planCharacterRefs({ characters: many }, [beat(1, []), beat(2, [])]);
  assert(refs.length <= MAX_REFS_PER_FILM, `${refs.length} refs exceeds the cap of ${MAX_REFS_PER_FILM}`);
});

test("an empty or junk registry plans nothing and does not throw", () => {
  assert(planCharacterRefs({ characters: [] }, []).length === 0, "empty");
  assert(planCharacterRefs({}, []).length === 0, "no characters key");
  assert(planCharacterRefs(null, null).length === 0, "null");
  assert(planCharacterRefs({ characters: [null, { name: "" }] }, []).length === 0, "junk entries");
});

// ── The reference prompt ────────────────────────────────────────────────────

test("the reference is shot on an empty plate, so nothing can leak into a scene", () => {
  // This is the mitigation for §3.8's flyer-kitchen bleed: a reference with no
  // background has no background to contaminate with.
  const prompt = characterRefPrompt(planCharacterRefs({ characters: [character("Awa", [1, 2])] }, [beat(1, ["Awa"]), beat(2, ["Awa"])])[0]);
  for (const required of ["seamless", "NOTHING else in frame", "no props", "no location"]) {
    assert(prompt.includes(required), `the prompt does not specify "${required}"`);
  }
  assert(/one person only/i.test(prompt), "it must specify a single person (fusion risk)");
  assert(/full length/i.test(prompt), "it must be full length to fix the wardrobe");
  assert(/FACE IS SHARP/i.test(prompt), "the face has to be readable — that is the point");
});

test("the reference prompt carries the character's own words verbatim", () => {
  const ref = planCharacterRefs({ characters: [character("Awa", [1, 2])] }, [beat(1, ["Awa"]), beat(2, ["Awa"])])[0];
  const prompt = characterRefPrompt(ref);
  assert(prompt.includes(ref.lcb), "the locked character block is missing");
  assert(prompt.includes(ref.wardrobe), "the wardrobe lock is missing");
});

test("the reference is deliberately unstylised", () => {
  // A graded, shallow-focus, dramatically lit reference drags its look into every
  // scene it is attached to.
  const ref = planCharacterRefs({ characters: [character("Awa", [1, 2])] }, [beat(1, ["Awa"]), beat(2, ["Awa"])])[0];
  const prompt = characterRefPrompt(ref);
  for (const banned of ["no grade", "no film grain", "no shallow depth of field", "no dramatic shadow"]) {
    assert(prompt.toLowerCase().includes(banned), `the prompt does not forbid: ${banned}`);
  }
});

// ── Per-scene attachment ────────────────────────────────────────────────────

const CAST = planCharacterRefs(
  { characters: [character("Awa", [1, 2, 3]), character("Modou", [2, 3]), character("Binta", [3])] },
  [beat(1, ["Awa"]), beat(2, ["Awa", "Modou"]), beat(3, ["Awa", "Modou", "Binta"])]
);

test("a scene only carries the people who are in it", () => {
  // The whole point: a face attached to a scene that character isn't in is an
  // invitation to put them there.
  const scene1 = refsForScene(CAST, beat(1, ["Awa"]), 1).map((r) => r.name);
  assert(JSON.stringify(scene1) === '["Awa"]', JSON.stringify(scene1));
  const scene2 = refsForScene(CAST, beat(2, ["Awa", "Modou"]), 2).map((r) => r.name);
  assert(scene2.includes("Awa") && scene2.includes("Modou"), JSON.stringify(scene2));
});

test("a crowded scene is capped, keeping the most prominent faces", () => {
  // §3.8 rule 1: more images means more fusion. Three faces and the model averages.
  const scene3 = refsForScene(CAST, beat(3, ["Awa", "Modou", "Binta"]), 3);
  assert(scene3.length <= MAX_REFS_PER_SCENE, `${scene3.length} refs on one scene`);
  assert(scene3[0].name === "Awa", `most prominent should lead, got ${scene3[0].name}`);
});

test("a scene with nobody recurring carries no references at all", () => {
  const none = refsForScene(CAST, beat(9, ["Stranger"]), 9);
  assert(none.length === 0, `${none.length} refs on a scene with no known cast`);
  assert(refClause(none) === "", "and no clause is emitted");
});

// ── The quarantine clause ───────────────────────────────────────────────────

test("one reference gets a quarantine clause and no fusion warning", () => {
  const clause = refClause(refsForScene(CAST, beat(1, ["Awa"]), 1));
  assert(/TAKE ONLY THE PERSON/.test(clause), "no quarantine clause");
  assert(/not the grey backdrop/.test(clause), "the backdrop is not quarantined");
  assert(/WORDS WIN/.test(clause), "the words must remain the specification (§3.8 rule 3)");
  assert(!/DIFFERENT people/.test(clause), "a single reference needs no fusion warning");
});

test("two references are explicitly told apart", () => {
  const clause = refClause(refsForScene(CAST, beat(2, ["Awa", "Modou"]), 2));
  assert(/Attached image 1 is AWA/.test(clause), `image 1 not named: ${clause.slice(0, 120)}`);
  assert(/Attached image 2 is MODOU/.test(clause), "image 2 not named");
  assert(/DIFFERENT people/.test(clause), "no fusion warning for two faces");
  assert(/do not blend, merge, average or swap/.test(clause), "no explicit anti-fusion instruction");
});

// ── Placing the director's uploads ──────────────────────────────────────────

const STORY = {
  sceneBeats: [beat(1, ["Awa"]), beat(2, ["Awa"], true), beat(3, ["Awa"], true), beat(4, ["Awa"])],
};
const MATERIALS = [{ name: "tub.jpg" }, { name: "logo.png" }, { name: "mystery.jpg" }];

test("a product image lands only on the scenes the product is in", () => {
  const placed = placeMaterials(MATERIALS, [{ index: 0, kind: "product", scenes: [2, 3] }], STORY);
  assert(!(0 in placed), "the product was attached to a scene it is not in");
  assert(placed[1]?.includes(0) && placed[2]?.includes(0), `got ${JSON.stringify(placed)}`);
});

test("a logo lands where the brand lands, not on every frame", () => {
  const placed = placeMaterials(MATERIALS, [{ index: 1, kind: "logo", scenes: [] }], STORY);
  const scenesWithLogo = Object.keys(placed).filter((k) => placed[k].includes(1));
  assert(scenesWithLogo.length === 1, `logo on ${scenesWithLogo.length} scenes`);
  assert(scenesWithLogo[0] === "3", `logo should land on the last scene, got index ${scenesWithLogo[0]}`);
});

test("an unplaceable image falls back to the product scenes, never nowhere", () => {
  // Dropping a reference the director deliberately uploaded is worse than
  // over-attaching it.
  const placed = placeMaterials(MATERIALS, [{ index: 2, kind: "other", scenes: [] }], STORY);
  const scenes = Object.keys(placed).filter((k) => placed[k].includes(2));
  assert(scenes.length > 0, "the material was dropped entirely");
  assert(JSON.stringify(scenes) === '["1","2"]', `expected the product scenes, got ${JSON.stringify(scenes)}`);
});

test("a classifier that returns nothing still places every material", () => {
  const placed = placeMaterials(MATERIALS, [], STORY);
  for (let i = 0; i < MATERIALS.length; i++) {
    const scenes = Object.keys(placed).filter((k) => placed[k].includes(i));
    assert(scenes.length > 0, `material ${i} was dropped when classification failed`);
  }
});

test("a scene number outside the film is ignored", () => {
  const placed = placeMaterials(MATERIALS, [{ index: 0, kind: "product", scenes: [99, 2] }], STORY);
  const scenes = Object.keys(placed).filter((k) => placed[k].includes(0));
  assert(JSON.stringify(scenes) === '["1"]', `expected only scene 2 (index 1), got ${JSON.stringify(scenes)}`);
});

test("no materials means no placement and no crash", () => {
  assert(Object.keys(placeMaterials([], [], STORY)).length === 0, "empty");
  assert(Object.keys(placeMaterials(null, null, STORY)).length === 0, "null");
});

// ── Casting shape ───────────────────────────────────────────────────────────

test("a no-hero montage with a recurring character is caught", () => {
  // The known failure: the swarm agrees to a montage then writes a hero anyway.
  const v = castingShapeViolations("no-hero-montage", [
    beat(1, ["Awa"]),
    beat(2, ["Awa"]),
    beat(3, ["Binta"]),
  ]);
  assert(v.some((x) => /nobody recurs/.test(x)), `expected a violation: ${v.join(" | ")}`);
});

test("a genuine montage passes", () => {
  const v = castingShapeViolations("no-hero-montage", [
    beat(1, ["Awa"]),
    beat(2, ["Binta"]),
    beat(3, ["Modou"]),
  ]);
  assert(v.length === 0, `unexpected: ${v.join(" | ")}`);
});

test("an ensemble that collapsed into one lead is caught", () => {
  const v = castingShapeViolations("ensemble", [
    beat(1, ["Awa"]),
    beat(2, ["Awa"]),
    beat(3, ["Awa"]),
    beat(4, ["Awa", "Extra"]),
  ]);
  assert(v.length > 0, "a single dominant character should fail an ensemble brief");
});

test("a real ensemble passes", () => {
  const v = castingShapeViolations("ensemble", [
    beat(1, ["Awa", "Modou"]),
    beat(2, ["Awa", "Modou"]),
    beat(3, ["Modou", "Binta"]),
    beat(4, ["Awa", "Binta"]),
  ]);
  assert(v.length === 0, `unexpected: ${v.join(" | ")}`);
});

test("a single-lead film is never faulted for having a lead", () => {
  const v = castingShapeViolations("single-lead", [beat(1, ["Awa"]), beat(2, ["Awa"]), beat(3, ["Awa"])]);
  assert(v.length === 0, `unexpected: ${v.join(" | ")}`);
});

test("the shape gate never throws on missing or degenerate input", () => {
  assert(castingShapeViolations(undefined, []).length === 0, "no shape");
  assert(castingShapeViolations("ensemble", null).length === 0, "no beats");
  assert(castingShapeViolations("ensemble", [beat(1, [])]).length === 0, "one empty beat");
});

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length > 0) process.exit(1);
