// ─── OPTIQ SKILLS — THE CASTING DIRECTOR ────────────────────────────────────
//
// Why this module exists.
//
// Every film was coming out starring the same person. Not because the swarm was
// ignoring instructions, but because it was following them perfectly: the
// casting-registry skill reads `03-character-consistency.md`, whose canonical
// Locked Character Block is Nyima — "deep warm dark-brown skin… neat
// medium-length black box braids" — and the scene-builders read
// `exemplar-scene.md`, which stars the man in the rust camp-collar shirt. Those
// examples are there to teach the FORMAT. A language model reads them as the
// answer. Add a prompt rule that demanded "rich, deep dark skin tone" on every
// person and the result was inevitable: one complexion, one hairstyle, one
// build, film after film.
//
// The important consequence: you cannot fix this with a sterner instruction.
// Identical inputs land a sampler in the same basin every run, so "be more
// varied" produces the same cast with more adjectives. What breaks it is a
// DIFFERENT INPUT per film — an explicit casting palette, drawn fresh each run,
// that the registry has to build toward. That is `castingDirective()`.
//
// What did NOT change: casting stays Black and Gambian, and the literal keyword
// "Black" stays mandatory in every prompt (models have rendered
// under-described people as other ethnicities, which is the whole reason that
// rule exists). The variety is a spread ACROSS the real range of Black Gambian
// complexions, hair, ages and builds — not a licence to cast someone else.

"use strict";

// ─── THE PALETTES ───────────────────────────────────────────────────────────
// Each entry is written as prompt-ready description language, because whatever
// is drawn here has to survive into a Locked Character Block verbatim.

/**
 * The complexion range. Every band is a Black Gambian / West African skin tone —
 * this is the spread that exists in any real Gambian street, and the thing the
 * old "rich, deep dark skin tone" rule flattened out.
 */
const COMPLEXIONS = [
  "very deep blue-black skin with a soft matte finish",
  "deep ebony skin with a natural healthy sheen",
  "rich dark-brown skin, even-toned and smooth",
  "warm dark-brown skin with reddish undertones",
  "medium warm-brown skin with a soft glow",
  "golden-brown skin with warm amber undertones",
  "light copper-brown skin with visible warm undertones",
  "fair caramel-brown skin, noticeably lighter than her surroundings",
  "deep umber-brown skin with cool undertones",
  "mid-toned chestnut-brown skin, matte",
];

/** Hair. The single strongest visual differentiator between two characters. */
const HAIR_WOMEN = [
  "long thin black box braids worn loose past the shoulders",
  "short natural black afro, hand-picked and even",
  "chunky black cornrows braided straight back into a low bun",
  "shoulder-length black faux locs gathered on one side",
  "a close-cropped natural black TWA (teeny-weeny afro) with a defined hairline",
  "black hair in neat bantu knots across the crown",
  "a black twist-out worn full and loose, framing the face",
  "waist-length black knotless braids, parted down the middle",
  "black hair wrapped in a tall printed headwrap, no hair visible",
  "a sleek black low ponytail pulled tight with a clean edge",
  "medium-length black senegalese twists tied back",
  "a short tapered natural cut, tight coils, shaved at the nape",
];

const HAIR_MEN = [
  "short black hair in a low tidy fade, fuller on top, clean hairline",
  "a completely clean-shaven bald head",
  "short black dreadlocks tied back at the crown",
  "a full rounded black afro, medium length",
  "black hair in tight cornrows braided straight back",
  "a very short black buzz cut, uniform all over",
  "a high-top natural cut with sharp squared edges",
  "shoulder-length black locs worn loose",
  "a receding hairline with short black hair kept close",
  "a tapered natural cut with a hard side part shaved in",
];

const FACIAL_HAIR = [
  "a neat short well-groomed black beard and trimmed moustache connecting cleanly along the jaw",
  "a completely clean-shaven face with no facial hair at all",
  "a thick full black beard grown long, untrimmed but clean",
  "a thin black chinstrap beard following the jawline",
  "a black moustache only, no beard, kept trimmed",
  "light black stubble across the jaw and chin, a few days' growth",
  "a greying salt-and-pepper black beard, short and tidy",
];

const AGE_BANDS = [
  "a child of about 8",
  "a young teenager of about 14",
  "in their late teens, around 18",
  "in their early twenties",
  "in their late twenties",
  "in their mid-thirties",
  "in their early forties",
  "in their fifties",
  "an elder in their late sixties",
];

const BUILDS = [
  "slim and slight, shorter than average",
  "tall and lean, around 6'1\"",
  "short and stocky, broad through the shoulders",
  "solidly built and heavy-set, wide-framed",
  "average height with a soft, rounded build",
  "tall and broad, powerfully built",
  "petite and compact, around 5'2\"",
  "wiry and athletic, visible muscle definition",
  "average height and average build, unremarkable",
];

/**
 * A distinguishing physical marker. Counter-intuitively the most valuable field
 * here: one specific, buildable oddity does more for "this is a different
 * person" than any amount of adjective-shuffling on skin and hair.
 */
const DISTINCTIVE_MARKERS = [
  "a small raised mole high on one cheekbone",
  "a noticeable gap between the two front teeth, visible when smiling",
  "thick-rimmed black reading glasses worn constantly",
  "a thin pale scar through one eyebrow",
  "deeply hooded eyes that make the gaze look heavy",
  "a broad flat nose with a wide bridge",
  "very full lips with a pronounced cupid's bow",
  "high sharp cheekbones that catch the light",
  "one ear noticeably more prominent than the other",
  "faint tribal facial marks on both cheeks",
  "unusually long lashes over deep-set eyes",
  "a strong square jaw with a visible chin cleft",
  "freckles scattered across the nose and upper cheeks",
  "a slight squint in one eye",
];

// The doctrine's own worked examples. These are FORMAT teaching aids, and the
// registry keeps casting them literally, so they are named and banned outright.
// Matched loosely (normalized substring) because the copy is rarely exact.
const HOUSE_DEFAULTS = [
  "box braids",
  "deep warm dark-brown skin",
  "soft oval face",
  "naturally thick eyebrows",
  "rust",
  "camp-collar",
  "cuban-collar",
];

// ─── DRAWING A PALETTE ──────────────────────────────────────────────────────

/** Tiny deterministic PRNG (mulberry32) so a seed reproduces a cast exactly. */
function makeRng(seed) {
  let a = (seed >>> 0) || 0x9e3779b9;
  return function rng() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Cheap string→int hash, so a project id can seed the draw. */
function hashSeed(value) {
  const str = String(value ?? "");
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Draw `count` distinct items from `list`. */
function sample(list, count, rng) {
  const pool = [...list];
  const out = [];
  const n = Math.min(count, pool.length);
  for (let i = 0; i < n; i++) {
    out.push(pool.splice(Math.floor(rng() * pool.length), 1)[0]);
  }
  return out;
}

/**
 * The casting palette for one film.
 *
 * `seed` should be stable per film (the project id) so a resumed or retried
 * generation casts the same people; pass nothing for a fresh random draw.
 * `castSize` is how many named characters the storyline actually needs.
 */
function drawCastingPalette(seed, castSize = 3) {
  const rng = makeRng(seed === undefined ? (Math.random() * 0xffffffff) >>> 0 : hashSeed(seed));
  const size = Math.max(1, Math.min(castSize, 8));
  return {
    complexions: sample(COMPLEXIONS, Math.max(size, 2), rng),
    hairWomen: sample(HAIR_WOMEN, Math.max(size, 2), rng),
    hairMen: sample(HAIR_MEN, Math.max(size, 2), rng),
    facialHair: sample(FACIAL_HAIR, Math.max(size, 2), rng),
    ages: sample(AGE_BANDS, Math.max(size, 2), rng),
    builds: sample(BUILDS, Math.max(size, 2), rng),
    markers: sample(DISTINCTIVE_MARKERS, Math.max(size, 2), rng),
  };
}

/**
 * The casting directive handed to the casting-registry skill.
 *
 * This is the load-bearing part of the whole module: it is a different block of
 * text on every film, so the registry cannot converge on one cast the way it did
 * when its only inputs were a fixed doctrine and a fixed exemplar.
 */
function castingDirective(seed, castSize = 3) {
  const p = drawCastingPalette(seed, castSize);
  const list = (items) => items.map((i) => `  - ${i}`).join("\n");

  return `═══ CASTING PALETTE FOR THIS FILM (BINDING) ═══
This palette is drawn fresh for every film. It exists because films kept coming
out starring the same person — one complexion, one hairstyle, one build. Treat it
as the casting call you have been handed, not as suggestions.

EVERY on-screen person is still a BLACK Gambian / West African person, and the
literal word "Black" still appears in every character's description. That does
not change and is not what this palette is about. What changes is that Black
Gambian people are not one look, and this cast must show that.

SKIN — assign a DIFFERENT complexion from this list to each named character. Do
not give two characters the same one. Do not default all of them to the darkest:
${list(p.complexions)}

HAIR — women in this film draw from:
${list(p.hairWomen)}
  men in this film draw from:
${list(p.hairMen)}

FACIAL HAIR — for each man:
${list(p.facialHair)}

AGE — spread the cast across these bands, not clustered on one:
${list(p.ages)}

BUILD / HEIGHT — a different one per character:
${list(p.builds)}

DISTINGUISHING MARKER — give each character exactly ONE of these, and write it
into their Locked Character Block. This does more for "these are different
people" than any adjective:
${list(p.markers)}

HARD RULES
1. No two characters in this film may share a complexion, a hairstyle, or a
   build. If the storyline needs five people, that is five distinct looks.
2. Spread the ages. A film where everyone is in their twenties is a failed cast.
3. NEVER reproduce the doctrine's worked examples. "Box braids", "deep warm
   dark-brown skin", "soft oval face", "naturally thick eyebrows", and the
   rust/camp-collar shirt are teaching aids showing you the FORMAT of a Locked
   Character Block — they are not this film's cast, and copying them is the exact
   failure this palette exists to stop. Write new people.
4. Wardrobe colours must also differ per character, and must not be rust.
5. Background people follow the same spread: a crowd where every face is the
   same tone is the cliché the doctrine warns about.`;
}

// ─── THE GATE ───────────────────────────────────────────────────────────────

function normalize(text) {
  return String(text || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

/**
 * Which palette-relevant traits a Locked Character Block actually committed to.
 * Deliberately coarse: it looks for the vocabulary that carries a look, so it
 * can tell "these two are the same person" from "these two differ".
 */
function traitsOf(character) {
  const text = normalize(`${character?.lcb || ""} ${character?.wardrobe || ""}`);
  const found = (words) => words.filter((w) => text.includes(w));
  return {
    skin: found([
      "blue black", "ebony", "dark brown", "umber", "chestnut", "medium brown",
      "warm brown", "golden brown", "copper", "caramel", "light brown", "fair",
    ]),
    hair: found([
      "box braids", "afro", "cornrows", "locs", "dreadlocks", "twa", "bantu",
      "twist out", "knotless", "headwrap", "ponytail", "twists", "fade", "bald",
      "buzz cut", "high top", "tapered", "shaved",
    ]),
    build: found([
      "slim", "slight", "lean", "stocky", "heavy set", "broad", "petite",
      "compact", "wiry", "athletic", "rounded", "average build",
    ]),
  };
}

/**
 * Casting-variety violations for a whole registry.
 *
 * Returns human-readable strings aimed at a repair pass, empty when the cast is
 * genuinely varied. Single-character films are exempt from the "differ from each
 * other" checks — there is nothing to differ from — but still may not be cast
 * straight off the doctrine's examples.
 */
function castingViolations(registry) {
  const characters = (registry?.characters || []).filter(Boolean);
  const violations = [];
  if (characters.length === 0) return violations;

  // 1. Nobody may be lifted from the doctrine's worked examples.
  for (const c of characters) {
    const text = normalize(`${c.lcb || ""} ${c.wardrobe || ""}`);
    const copied = HOUSE_DEFAULTS.filter((d) => text.includes(normalize(d)));
    if (copied.length > 0) {
      violations.push(
        `${c.name || "A character"} is cast off the doctrine's worked examples (${copied.join(", ")}). ` +
          `Those are FORMAT teaching aids, not this film's cast. Re-cast this character with a different ` +
          `complexion, a different hairstyle and different wardrobe colours, and remove those phrases entirely.`
      );
    }
  }

  // 2. The "Black" keyword survives per character — the rule that stops a
  //    person being rendered as another ethnicity.
  for (const c of characters) {
    if (!/black/i.test(String(c.lcb || ""))) {
      violations.push(
        `${c.name || "A character"}'s Locked Character Block never says "Black". ` +
          `Every character must be explicitly described as a Black Gambian / Black West African person.`
      );
    }
  }

  if (characters.length < 2) return violations;

  // 3. Two characters may not share a look.
  const seen = [];
  for (const c of characters) {
    const t = traitsOf(c);
    for (const prev of seen) {
      const sameSkin = t.skin.length > 0 && prev.traits.skin.some((s) => t.skin.includes(s));
      const sameHair = t.hair.length > 0 && prev.traits.hair.some((h) => t.hair.includes(h));
      if (sameSkin && sameHair) {
        violations.push(
          `${c.name || "A character"} and ${prev.name || "another character"} share both complexion and ` +
            `hairstyle — they will read as the same person on screen. Re-cast one of them onto a different ` +
            `complexion AND a different hairstyle from the casting palette.`
        );
      }
    }
    seen.push({ name: c.name, traits: t });
  }

  // 4. The cast as a whole must actually span the complexion range. This is the
  //    check that catches the original symptom: everyone plausibly distinct on
  //    paper, but every single one of them dark-skinned.
  const distinctSkin = new Set();
  let described = 0;
  for (const c of characters) {
    const t = traitsOf(c);
    if (t.skin.length > 0) {
      described++;
      distinctSkin.add(t.skin[0]);
    }
  }
  if (described >= 2 && distinctSkin.size < 2) {
    violations.push(
      `The whole cast shares one complexion ("${[...distinctSkin][0]}"). Black Gambian people are not one ` +
        `shade — spread this cast across the palette's range, including at least one noticeably lighter ` +
        `complexion, while keeping every person explicitly Black Gambian.`
    );
  }

  return violations;
}

/**
 * Did the film actually come out the shape the analyst asked for?
 *
 * The known failure this catches: the swarm agrees to an ensemble or a montage
 * and then quietly writes a single-hero film anyway, because one lead is the
 * easiest story to tell. Checked against the STORYLINE's beats rather than the
 * registry, since the beats are what the scene-builders actually implement.
 */
function castingShapeViolations(shape, sceneBeats) {
  const beats = (sceneBeats || []).filter(Boolean);
  const violations = [];
  if (beats.length < 2 || !shape) return violations;

  // How many scenes each named character appears in.
  const appearances = new Map();
  for (const beat of beats) {
    for (const raw of beat.charactersPresent || []) {
      const name = normalize(raw);
      if (!name) continue;
      appearances.set(name, (appearances.get(name) || 0) + 1);
    }
  }
  if (appearances.size === 0) return violations;

  const counts = [...appearances.values()].sort((a, b) => b - a);
  const topShare = counts[0] / beats.length;
  const recurring = counts.filter((c) => c >= 2).length;

  if (shape === "no-hero-montage") {
    if (recurring > 0) {
      violations.push(
        `The casting shape is "no-hero-montage" — nobody recurs — but ${recurring} character(s) appear in more ` +
          `than one scene. Re-cast so every scene features DIFFERENT people who appear nowhere else in the film.`
      );
    }
  } else if (shape === "ensemble") {
    if (appearances.size < 2) {
      violations.push(
        `The casting shape is "ensemble" but the film has only one named character. An ensemble needs two to four ` +
          `recurring characters who all matter, in relationship with each other.`
      );
    } else if (topShare >= 0.9 && recurring < 2) {
      violations.push(
        `The casting shape is "ensemble" but one character carries ${Math.round(topShare * 100)}% of the scenes ` +
          `with nobody else recurring — that is a single-lead film with extras. Give at least two characters real ` +
          `presence across the film.`
      );
    }
  }

  return violations;
}

module.exports = {
  castingDirective,
  castingShapeViolations,
  drawCastingPalette,
  castingViolations,
  traitsOf,
  COMPLEXIONS,
  HAIR_WOMEN,
  HAIR_MEN,
  FACIAL_HAIR,
  AGE_BANDS,
  BUILDS,
  DISTINCTIVE_MARKERS,
  HOUSE_DEFAULTS,
};
