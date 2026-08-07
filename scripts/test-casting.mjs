/**
 * Casting-variety test suite. Run: node scripts/test-casting.mjs
 *
 * Covers functions/optiqSkills/casting.js — the palette draw and the JS gate
 * that stops every film starring the same person. Exits non-zero on failure.
 */

import { createRequire } from "node:module";

const require_ = createRequire(import.meta.url);
const {
  castingDirective,
  drawCastingPalette,
  castingViolations,
  traitsOf,
  COMPLEXIONS,
} = require_("../functions/optiqSkills/casting.js");

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

// A cast that is genuinely varied — the shape the gate should accept.
const goodCast = {
  characters: [
    {
      name: "Fatou",
      role: "lead",
      lcb: "FATOU — a Black Gambian woman in her early forties with medium warm-brown skin with a soft glow, a broad flat nose with a wide bridge, and black hair wrapped in a tall printed headwrap. Petite and compact, around 5'2\".",
      wardrobe: "A faded TEAL wax-print wrapper worn with a plain cream blouse.",
      scenes: [1, 2],
    },
    {
      name: "Ousman",
      role: "son",
      lcb: "OUSMAN — a Black Gambian boy of about 8 with very deep blue-black skin with a soft matte finish, a noticeable gap between the two front teeth, and a completely clean-shaven bald head. Slim and slight, shorter than average.",
      wardrobe: "A washed-out YELLOW football jersey and navy shorts.",
      scenes: [1],
    },
    {
      name: "Mariama",
      role: "neighbour",
      lcb: "MARIAMA — a Black Gambian elder in their late sixties with light copper-brown skin with visible warm undertones, faint tribal facial marks on both cheeks, and a short tapered natural cut. Solidly built and heavy-set, wide-framed.",
      wardrobe: "A deep PURPLE grand mbubb with a matching headtie.",
      scenes: [2],
    },
  ],
};

// ── The palette ─────────────────────────────────────────────────────────────

test("the same seed draws the same palette", () => {
  const a = drawCastingPalette("project_abc", 3);
  const b = drawCastingPalette("project_abc", 3);
  assert(JSON.stringify(a) === JSON.stringify(b), "a retried film must re-cast the same people");
});

test("different seeds draw different palettes", () => {
  // This is the whole anti-monochrome mechanism: a different input per film.
  const seeds = ["proj_1", "proj_2", "proj_3", "proj_4", "proj_5", "proj_6"];
  const leads = seeds.map((s) => drawCastingPalette(s, 3).complexions[0]);
  assert(new Set(leads).size > 1, `every seed drew the same lead complexion: ${leads[0]}`);
});

test("a palette never repeats an item within a category", () => {
  for (const seed of ["a", "b", "c", "d", "e"]) {
    const p = drawCastingPalette(seed, 5);
    for (const [key, list] of Object.entries(p)) {
      assert(new Set(list).size === list.length, `${seed}/${key} drew a duplicate`);
    }
  }
});

test("an oversized cast cannot exhaust a palette", () => {
  const p = drawCastingPalette("big", 999);
  assert(p.complexions.length > 0 && p.complexions.length <= COMPLEXIONS.length, "complexions stayed in range");
});

test("the directive keeps the Black keyword mandatory while demanding a spread", () => {
  const text = castingDirective("proj_x", 3);
  assert(/\bBlack\b/.test(text), 'the directive must not drop the "Black" requirement');
  assert(/Gambian/.test(text), "casting stays Gambian");
  assert(/box braids/i.test(text), "it must name the doctrine's examples as off-limits");
  assert(/complexion/i.test(text), "it must talk about complexion spread");
});

test("the directive is different text per film", () => {
  assert(castingDirective("p1", 3) !== castingDirective("p2", 3), "the directive must vary per film");
});

// ── The gate ────────────────────────────────────────────────────────────────

test("a genuinely varied cast passes", () => {
  const v = castingViolations(goodCast);
  assert(v.length === 0, `expected no violations, got: ${v.join(" | ")}`);
});

test("a character lifted off the doctrine's examples is caught", () => {
  const v = castingViolations({
    characters: [
      {
        name: "Nyima",
        lcb: "NYIMA — a Black 20-year-old Gambian woman with deep warm dark-brown skin and a soft oval face, in neat medium-length black box braids.",
        wardrobe: "A rust camp-collar shirt.",
        scenes: [1],
      },
    ],
  });
  assert(v.length > 0, "copying the doctrine's worked example must fail the gate");
  assert(/worked examples/i.test(v.join(" ")), `unexpected message: ${v.join(" | ")}`);
});

test("a missing Black keyword is caught", () => {
  const v = castingViolations({
    characters: [
      {
        name: "Lamin",
        lcb: "LAMIN — a Gambian man in his late twenties with golden-brown skin and a full rounded afro. Tall and lean.",
        wardrobe: "A GREEN work shirt.",
        scenes: [1],
      },
    ],
  });
  assert(v.some((x) => /never says "Black"/.test(x)), `expected the Black check to fire: ${v.join(" | ")}`);
});

test("two characters sharing complexion AND hairstyle are caught", () => {
  const v = castingViolations({
    characters: [
      {
        name: "A",
        lcb: "A — a Black Gambian woman in her early twenties with rich dark-brown skin, even-toned and smooth, wearing long thin black box braids. Wiry and athletic.",
        wardrobe: "A BLUE dress.",
        scenes: [1],
      },
      {
        name: "B",
        lcb: "B — a Black Gambian woman in her late twenties with rich dark-brown skin, even-toned and smooth, wearing long thin black box braids. Petite and compact.",
        wardrobe: "A GREEN dress.",
        scenes: [2],
      },
    ],
  });
  assert(
    v.some((x) => /share both complexion and hairstyle/.test(x)),
    `expected the same-person check to fire: ${v.join(" | ")}`
  );
});

test("a whole cast on one complexion is caught", () => {
  // The original production symptom: distinct on paper, every one of them dark.
  const v = castingViolations({
    characters: [
      {
        name: "A",
        lcb: "A — a Black Gambian man in his thirties with deep ebony skin and a low tidy fade. Tall and broad.",
        wardrobe: "A GREY shirt.",
        scenes: [1],
      },
      {
        name: "B",
        lcb: "B — a Black Gambian woman in her fifties with deep ebony skin and a printed headwrap. Petite and compact.",
        wardrobe: "A YELLOW wrapper.",
        scenes: [1],
      },
      {
        name: "C",
        lcb: "C — a Black Gambian boy of about 8 with deep ebony skin and a completely clean-shaven bald head. Slim and slight.",
        wardrobe: "A TEAL jersey.",
        scenes: [2],
      },
    ],
  });
  assert(
    v.some((x) => /shares one complexion/.test(x)),
    `expected the range check to fire: ${v.join(" | ")}`
  );
});

test("differing complexion rescues an otherwise identical pair", () => {
  const v = castingViolations({
    characters: [
      {
        name: "A",
        lcb: "A — a Black Gambian woman with deep ebony skin and a natural healthy sheen, in chunky black cornrows braided straight back. Wiry and athletic.",
        wardrobe: "A BLUE dress.",
        scenes: [1],
      },
      {
        name: "B",
        lcb: "B — a Black Gambian woman with light copper-brown skin with visible warm undertones, in a short natural black afro. Petite and compact.",
        wardrobe: "A GREEN dress.",
        scenes: [2],
      },
    ],
  });
  assert(!v.some((x) => /share both/.test(x)), `should not flag a distinct pair: ${v.join(" | ")}`);
});

test("a one-character film is exempt from the differ-checks", () => {
  const v = castingViolations({
    characters: [
      {
        name: "Solo",
        lcb: "SOLO — a Black Gambian man in his fifties with medium warm-brown skin with a soft glow, a thin pale scar through one eyebrow, and short black dreadlocks tied back. Short and stocky.",
        wardrobe: "An OLIVE work jacket.",
        scenes: [1],
      },
    ],
  });
  assert(v.length === 0, `a single varied character is fine: ${v.join(" | ")}`);
});

test("an empty or absent registry does not throw", () => {
  assert(castingViolations({ characters: [] }).length === 0, "empty cast");
  assert(castingViolations({}).length === 0, "no characters key");
  assert(castingViolations(null).length === 0, "null registry");
  assert(castingViolations({ characters: [null, undefined] }).length === 0, "junk entries filtered");
});

test("traitsOf reads the vocabulary that carries a look", () => {
  const t = traitsOf(goodCast.characters[1]);
  assert(t.skin.length > 0, "found a complexion");
  assert(t.hair.includes("bald"), `found the hair, got ${JSON.stringify(t.hair)}`);
  assert(t.build.length > 0, "found the build");
});

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length > 0) process.exit(1);
