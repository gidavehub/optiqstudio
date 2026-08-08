// ─── OPTIQ DOCUMENTARY — WHO IS ON CAMERA ───────────────────────────────────
//
// The documentary sandbox's own copy of the casting machinery. It shares no code
// with the ad swarm or the story sandbox, and it inverts their default.
//
// Why this module exists at all.
//
// Every film this platform made was coming out starring the same person — not
// because the swarm ignored instructions but because it followed them perfectly:
// the doctrine's worked examples ARE a cast, and a language model reads an
// example as the answer. You cannot fix that with a sterner instruction, because
// identical inputs land a sampler in the same basin every run. What breaks it is
// a DIFFERENT INPUT per film: an explicit palette, drawn fresh, that the writer
// has to build toward.
//
// Why it is inverted here.
//
// A drama needs the same face in nine clips, so the story sandbox defaults every
// scene to the locked recurring cast. A DOCUMENTARY does not. It is about a
// subject, a place, a process or a system — and the people in it are the people
// who happen to be doing that work today. A documentary that keeps cutting back
// to one lead has quietly become a character piece, which is the story sandbox's
// job and not this one's.
//
// So in this sandbox:
//   • "fresh-faces" is the DEFAULT and the normal answer. The people in a scene
//     are one-offs, described inside that scene, never locked and never carried
//     to another one.
//   • "no-people" is common and often the strongest scene in the film: hands out
//     of frame, an object, a machine, a road, a room.
//   • "recurring" exists but is RATIONED. It is right only when the film is
//     genuinely following one person through the whole thing, and even then the
//     cap is small — see RECURRING_SUBJECT_CAP.
//
// What did NOT change: casting stays Black and Gambian, and the literal keyword
// "Black" stays mandatory in every prompt (models have rendered under-described
// people as other ethnicities, which is the whole reason that rule exists). The
// variety is a spread ACROSS the real range of Black Gambian complexions, hair,
// ages and builds — not a licence to cast someone else.

"use strict";

// ─── THE PALETTES ───────────────────────────────────────────────────────────
// Each entry is written as prompt-ready description language, because whatever
// is drawn here has to survive into a scene prompt verbatim.

const COMPLEXIONS = [
  "very deep blue-black skin with a soft matte finish",
  "deep ebony skin with a natural healthy sheen",
  "rich dark-brown skin, even-toned and smooth",
  "warm dark-brown skin with reddish undertones",
  "medium warm-brown skin with a soft glow",
  "golden-brown skin with warm amber undertones",
  "light copper-brown skin with visible warm undertones",
  "fair caramel-brown skin, noticeably lighter than those around them",
  "deep umber-brown skin with cool undertones",
  "mid-toned chestnut-brown skin, matte",
];

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

// 18 is the floor, everywhere, always — see ADULTS_ONLY_MANDATE below. There are
// no child or under-18 bands in this palette and none may be added: a palette is
// the one input the registry reliably builds toward, so an under-age band here
// would put a minor in films nobody asked to put one in.
const AGE_BANDS = [
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
  "a noticeable gap between the two front teeth",
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
  "hands visibly marked by the work — cracked knuckles, a taped finger, stained nails",
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

// The draw itself lives in ./rng.js, shared with the creative provocation. The
// algorithm is fixed: a stored film's seed has to keep reproducing its people.
const { makeRng, hashSeed, sample } = require("./rng");

/**
 * How many recurring subjects a documentary may lock.
 *
 * Small on purpose. A documentary follows a subject, not a protagonist, and the
 * moment three people are carried across the film it has become a drama with the
 * dialogue removed. One is the normal answer when the film follows somebody at
 * all; two is the ceiling.
 */
const RECURRING_SUBJECT_CAP = 2;

function drawSubjectPalette(seed, size = 4) {
  const rng = makeRng(seed === undefined ? (Math.random() * 0xffffffff) >>> 0 : hashSeed(seed));
  const n = Math.max(2, Math.min(size, 8));
  return {
    complexions: sample(COMPLEXIONS, n, rng),
    hairWomen: sample(HAIR_WOMEN, n, rng),
    hairMen: sample(HAIR_MEN, n, rng),
    facialHair: sample(FACIAL_HAIR, Math.max(2, Math.min(n, FACIAL_HAIR.length)), rng),
    ages: sample(AGE_BANDS, n, rng),
    builds: sample(BUILDS, n, rng),
    markers: sample(DISTINCTIVE_MARKERS, n, rng),
  };
}

/**
 * The people directive handed to the registry skill.
 *
 * A different block of text on every film, so the registry cannot converge on
 * one look the way it did when its only inputs were a fixed doctrine and a fixed
 * exemplar.
 */
function castingDirective(seed, castSize = 3) {
  const p = drawSubjectPalette(seed, castSize);
  const list = (items) => items.map((i) => `  - ${i}`).join("\n");

  return `═══ THE PEOPLE IN THIS FILM (BINDING) ═══
This palette is drawn fresh for every film. It exists because films kept coming
out starring the same person — one complexion, one hairstyle, one build. Treat it
as the call sheet you have been handed, not as suggestions.

EVERY on-screen person is a BLACK Gambian / West African person, and the literal
word "Black" appears in every person's description. That does not change and is
not what this palette is about. What changes is that Black Gambian people are not
one look, and this film must show that.

SKIN — assign a DIFFERENT complexion to each person you describe. Do not default
all of them to the darkest:
${list(p.complexions)}

HAIR — women in this film draw from:
${list(p.hairWomen)}
  men in this film draw from:
${list(p.hairMen)}

FACIAL HAIR — for each man:
${list(p.facialHair)}

AGE — spread the people across these bands, not clustered on one:
${list(p.ages)}

BUILD / HEIGHT — a different one per person:
${list(p.builds)}

DISTINGUISHING MARKER — give anybody described in detail exactly ONE of these.
This does more for "these are different people" than any adjective:
${list(p.markers)}

HARD RULES
1. No two people described in this film may share a complexion, a hairstyle, or a
   build.
2. Spread the ages. A film where everyone is in their twenties is a failed cast,
   and a documentary in particular will look staged.
3. NEVER reproduce the doctrine's worked examples. "Box braids", "deep warm
   dark-brown skin", "soft oval face", "naturally thick eyebrows" and the
   rust/camp-collar shirt are teaching aids showing you the FORMAT — they are not
   this film's people, and copying them is the exact failure this palette exists
   to stop.
4. Clothing is WORKWEAR, not costume: what somebody doing this job actually wears,
   marked by the work — stained, faded, tucked, taped, rolled. Nobody in a
   documentary is dressed for the camera.
5. NOBODY LOOKS AT THE LENS, nobody poses, nobody smiles for the camera, and
   nobody speaks. These are people who have not noticed they are being filmed.

${ADULTS_ONLY_MANDATE}`;
}

// ─── PER-SCENE CASTING ──────────────────────────────────────────────────────

const SCENE_CASTING_MODES = ["recurring", "fresh-faces", "no-people"];

/**
 * The default when the outline does not say — and the one real difference from
 * the other two sandboxes.
 *
 * There, an unspecified scene falls back to the locked cast, because their films
 * are about people we follow. Here it falls back to one-off faces, because this
 * film is about a subject and the reflex to be resisted is a documentary quietly
 * acquiring a protagonist.
 */
const DEFAULT_SCENE_CASTING = "fresh-faces";

/** Normalize whatever the outline returned into one of the three modes. */
function sceneCasting(beat) {
  const raw = String(beat?.castingMode || "").trim().toLowerCase();
  if (SCENE_CASTING_MODES.includes(raw)) return raw;
  // Absent (an older outline, or a model that skipped the field): infer from
  // whether the beat names anybody, which is the honest reading of the data.
  return (beat?.charactersPresent || []).length > 0 ? "recurring" : DEFAULT_SCENE_CASTING;
}

/** The per-scene people brief, for the outline skill. */
function sceneCastingDirective() {
  return `═══ WHO IS IN EACH SCENE — CHOOSE PER SCENE ═══
Set castingMode on every scene beat. In a documentary the answer is usually
"fresh-faces" or "no-people", and that is not a compromise — it is what the
format is.

  "fresh-faces" — THE DEFAULT. The people in this scene appear in NO other scene:
                  whoever is doing this work today. A seller, a boatman, a
                  welder, a queue, a crowd, a pair of hands. Leave
                  charactersPresent EMPTY and describe what these people DO; the
                  scene builder invents them to the palette. Nobody here has to
                  look the same in any other scene, so the scene is freer,
                  cheaper and far more alive.
  "no-people"   — nobody on camera at all. An object, a machine, a road, a room,
                  a surface, a tool, water, fire, hands out of frame. Common in a
                  documentary and frequently the best scene in the film — and it
                  can still be packed with events: things move, land, open, spill,
                  boil, switch on, tip over. Leave charactersPresent empty.
  "recurring"   — a named person the film follows across scenes. RATION THIS. Use
                  it only when the film genuinely follows one individual all the
                  way through, and even then keep it to one or two people in the
                  whole film. List them in charactersPresent.

WHY IT IS RATIONED: a documentary is about a subject, a place, a process or a
system. The moment three faces start recurring, the film has quietly become a
character drama with the dialogue removed — which is a different product on this
platform, made by a different pipeline. If you find yourself wanting a lead in
every scene, what you actually have is a story, and the director should be told
that rather than handed a half-documentary.

HOW TO DECIDE: ask what this specific scene needs, not what the film has been
doing. If the beat is "the whole market is already at work", that is fresh faces.
If the beat is "the salt, close, drying", that is no-people. A recurring subject
does not have to appear in a scene just because they are the subject.`;
}

/**
 * A per-scene look palette for a scene of one-off people.
 *
 * Same mechanism as the film-wide palette, salted by scene number so scene 3's
 * people do not come out looking like scene 7's. Compact on purpose: these
 * people get a good description, not a 200-word lock they will never need again.
 */
function freshFaceDirective(seed, sceneNumber) {
  const rng = makeRng(hashSeed(`fresh:${sceneNumber}:${seed ?? Math.random()}`));
  const list = (items) => items.map((i) => `  - ${i}`).join("\n");
  return `═══ THIS SCENE'S PEOPLE ARE ONE-OFFS ═══
Nobody in this scene appears anywhere else in the film. There is no locked block
for them and there must not be one: do NOT paste any character lock into this
prompt, and do NOT reuse a recurring subject here — that is how a documentary
collapses into the same two faces in every shot.

Write these people fresh, in the scene, with enough physical detail to render
cleanly once. Each is explicitly a BLACK Gambian / West African person — that
keyword is non-negotiable — and they differ visibly from one another. Draw their
looks from here:

COMPLEXIONS (spread them; not everyone the same tone):
${list(sample(COMPLEXIONS, 4, rng))}
HAIR:
${list(sample([...HAIR_WOMEN, ...HAIR_MEN], 4, rng))}
AGES:
${list(sample(AGE_BANDS, 4, rng))}
BUILDS:
${list(sample(BUILDS, 3, rng))}

Give each of them something to DO — these are people caught mid-work, not extras
arranged in a frame. And remember what this film is: NOBODY SPEAKS, nobody's lips
move in speech, nobody looks at the lens and nobody poses. They have not noticed
the camera.

${ADULTS_ONLY_MANDATE}`;
}

/**
 * Which registry subjects belong in a scene's prompt.
 *
 * A scene that names nobody gets nobody. The old ad-swarm behaviour — fall back
 * to the ENTIRE registry on the theory that some people are better than none —
 * is what pasted the whole cast into scenes written to have nobody in them.
 */
function charactersForBeat(registry, beat) {
  const mode = sceneCasting(beat);
  if (mode !== "recurring") return [];
  const characters = (registry?.characters || []).filter(Boolean);
  const named = beat?.charactersPresent || [];
  return characters.filter(
    (c) =>
      named.some((n) => normalize(n) === normalize(c.name)) ||
      (c.scenes || []).includes(beat?.sceneNumber)
  );
}

/** Names that appear in two or more scenes — the only ones needing a lock. */
function recurringCharacterNames(sceneBeats) {
  const counts = new Map();
  for (const beat of sceneBeats || []) {
    if (sceneCasting(beat) !== "recurring") continue;
    for (const raw of beat.charactersPresent || []) {
      const key = normalize(raw);
      if (!key) continue;
      counts.set(key, (counts.get(key) || 0) + 1);
    }
  }
  return new Set([...counts.entries()].filter(([, n]) => n >= 2).map(([name]) => name));
}

/**
 * Contradictions between a scene's casting mode and what it actually lists, plus
 * the documentary-only check: has the film quietly acquired a cast?
 *
 * Cheap to catch here and expensive later — a "no-people" scene that names three
 * subjects becomes a scene-builder that puts three people in a shot the outline
 * wrote to be empty.
 */
function sceneCastingViolations(sceneBeats) {
  const violations = [];
  const beats = (sceneBeats || []).filter(Boolean);

  for (const beat of beats) {
    const mode = sceneCasting(beat);
    const named = (beat.charactersPresent || []).filter((n) => String(n || "").trim());
    if (mode === "no-people" && named.length > 0) {
      violations.push(
        `Scene ${beat.sceneNumber} is cast "no-people" but lists ${named.join(", ")}. ` +
          `Either clear charactersPresent and keep the frame empty of people, or change the mode.`
      );
    }
    if (mode === "fresh-faces" && named.length > 0) {
      violations.push(
        `Scene ${beat.sceneNumber} is cast "fresh-faces" but names ${named.join(", ")}. ` +
          `Fresh faces appear in no other scene and carry no lock, so they are not named subjects — ` +
          `clear charactersPresent and describe what these one-off people DO instead.`
      );
    }
    if (mode === "recurring" && named.length === 0) {
      violations.push(
        `Scene ${beat.sceneNumber} is cast "recurring" but names nobody. Name the subject this scene shares with ` +
          `the rest of the film, or re-cast it as "fresh-faces" (one-off people) or "no-people" (nobody on camera).`
      );
    }
  }

  // The documentary-only gate: too many people carried across the film.
  const subjects = new Set();
  for (const beat of beats) {
    if (sceneCasting(beat) !== "recurring") continue;
    for (const raw of beat.charactersPresent || []) {
      const key = normalize(raw);
      if (key) subjects.add(key);
    }
  }
  if (subjects.size > RECURRING_SUBJECT_CAP) {
    violations.push(
      `This film carries ${subjects.size} recurring subjects (${[...subjects].join(", ")}) and a documentary may ` +
        `carry at most ${RECURRING_SUBJECT_CAP}. Past that it has stopped being a film about its subject and become ` +
        `a character drama with the dialogue removed. Keep the one or two the film genuinely follows, and re-cast ` +
        `the rest of those scenes as "fresh-faces" — the people who happen to be doing that work in that scene.`
    );
  }

  // And the opposite reflex: a film that put a face in literally every scene.
  const withPeople = beats.filter((b) => sceneCasting(b) !== "no-people").length;
  if (beats.length >= 6 && withPeople === beats.length) {
    violations.push(
      `Every scene in this film has people in it. A documentary needs at least one scene of nobody: the object, the ` +
        `machine, the road, the surface, the empty room. Those are usually the strongest ten seconds in the film and ` +
        `they are the cheapest to render well. Re-cast at least one scene as "no-people".`
    );
  }

  return violations;
}

// ─── THE GATE ───────────────────────────────────────────────────────────────

function normalize(text) {
  return String(text || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

/**
 * Which palette-relevant traits a subject block actually committed to.
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
 * Variety violations for a whole registry.
 *
 * Returns human-readable strings aimed at a repair pass, empty when the people
 * are genuinely varied. A film with one recurring subject is exempt from the
 * "differ from each other" checks — there is nothing to differ from — but still
 * may not be cast straight off the doctrine's examples.
 */
function castingViolations(registry) {
  const characters = (registry?.characters || []).filter(Boolean);
  const violations = [];
  if (characters.length === 0) return violations;

  if (characters.length > RECURRING_SUBJECT_CAP) {
    violations.push(
      `The registry locks ${characters.length} recurring subjects and a documentary may lock at most ` +
        `${RECURRING_SUBJECT_CAP}. Keep only the one or two the film genuinely follows across scenes; everyone else ` +
        `is written fresh inside their own scene and needs no block here.`
    );
  }

  for (const c of characters) {
    const text = normalize(`${c.lcb || ""} ${c.wardrobe || ""}`);
    const copied = HOUSE_DEFAULTS.filter((d) => text.includes(normalize(d)));
    if (copied.length > 0) {
      violations.push(
        `${c.name || "A subject"} is cast off the doctrine's worked examples (${copied.join(", ")}). ` +
          `Those are FORMAT teaching aids, not this film's people. Re-cast with a different complexion, a different ` +
          `hairstyle and different clothing, and remove those phrases entirely.`
      );
    }
    if (!/black/i.test(String(c.lcb || ""))) {
      violations.push(
        `${c.name || "A subject"}'s locked block never says "Black". Every person must be explicitly described as a ` +
          `Black Gambian / Black West African person.`
      );
    }
  }

  if (characters.length < 2) return violations;

  const seen = [];
  for (const c of characters) {
    const t = traitsOf(c);
    for (const prev of seen) {
      const sameSkin = t.skin.length > 0 && prev.traits.skin.some((s) => t.skin.includes(s));
      const sameHair = t.hair.length > 0 && prev.traits.hair.some((h) => t.hair.includes(h));
      if (sameSkin && sameHair) {
        violations.push(
          `${c.name || "A subject"} and ${prev.name || "another subject"} share both complexion and hairstyle — ` +
            `they will read as the same person on screen. Re-cast one of them onto a different complexion AND a ` +
            `different hairstyle from the palette.`
        );
      }
    }
    seen.push({ name: c.name, traits: t });
  }

  return violations;
}

/**
 * Did the film actually come out the shape the analyst asked for?
 *
 * Reported rather than repaired, and checked against the OUTLINE's beats rather
 * than the registry, since the beats are what the scene-builders implement. The
 * failure it exists to catch is the one this format is prone to: the swarm
 * agrees to a subject-led film and then writes a person-led one anyway, because
 * following one hero is the easiest thing to write.
 */
function castingShapeViolations(shape, sceneBeats) {
  const beats = (sceneBeats || []).filter(Boolean);
  const violations = [];
  if (beats.length < 2 || !shape) return violations;

  const appearances = new Map();
  for (const beat of beats) {
    if (sceneCasting(beat) !== "recurring") continue;
    for (const raw of beat.charactersPresent || []) {
      const name = normalize(raw);
      if (!name) continue;
      appearances.set(name, (appearances.get(name) || 0) + 1);
    }
  }

  if (shape === "subject-led") {
    if (appearances.size > 0) {
      violations.push(
        `The film's shape is "subject-led" — nobody recurs — but ${appearances.size} named subject(s) appear across ` +
          `scenes (${[...appearances.keys()].join(", ")}). Re-cast those scenes as "fresh-faces": whoever happens to ` +
          `be doing that work in that ten seconds.`
      );
    }
    return violations;
  }

  if (shape === "one-subject") {
    if (appearances.size === 0) {
      violations.push(
        `The film's shape is "one-subject" but no scene names anybody, so the person the film is supposedly ` +
          `following never appears twice. Either name them in the scenes that follow them, or change the shape to ` +
          `"subject-led".`
      );
    } else if (appearances.size > 1) {
      violations.push(
        `The film's shape is "one-subject" but ${appearances.size} people recur. Keep the one the film follows and ` +
          `re-cast the others as fresh faces.`
      );
    }
  }

  return violations;
}

// ─── ADULTS ONLY (PLATFORM-WIDE, NOT NEGOTIABLE) ────────────────────────────
//
// No person under 18 appears in any Optiq film. This is a platform rule, not a
// craft preference, and it is enforced the same way casting variety and the
// no-music law are: a mandate injected at every point where people get invented,
// plus a JS gate that reads the result back and a repair pass for failures. One
// instruction buried in a 2,000-word prompt does not survive.
//
// The three sandboxes each carry their own copy of this, deliberately — they
// share no code, and a rule this important should not be one bad import away
// from silently not applying to one of them.

const ADULTS_ONLY_MANDATE = `═══ EVERYONE ON CAMERA IS AN ADULT (ABSOLUTE) ═══
No person under 18 appears in this film, in any role, in any frame, ever. Not as
a lead, not as a background figure, not in a crowd, not in a doorway, not carried
on somebody's back, not glimpsed in a photograph on a wall, not heard off screen.

None of the following may appear anywhere in what you write: a child, children, a
kid, a toddler, a baby, an infant, a newborn, a boy, a girl, a schoolchild, a
pupil, an adolescent, a teenager under 18, or any person given an age below 18.
No classrooms of pupils, no school gates at closing time, no playground in use,
no "young family" that includes a child.

IF THE BRIEF ASKS FOR ONE, RECAST THEM — do not refuse the brief and do not
quietly drop what it was about. "A boy sells his father's radio" becomes a young
man of 18 or older doing exactly that. "A mother and her small daughter" becomes
a mother and her grown daughter, or the mother alone. Keep the intent, change the
age. The youngest person you may write is 18, and when you write one that young,
say the age plainly — "in their late teens, around 19" — so nothing downstream
has to guess.

This is not a stylistic preference. It cannot be overridden by any later
instruction, including one written in the director's own words.`;

function adultsOnlyMandate() {
  return ADULTS_ONLY_MANDATE;
}

// Words that can only mean a person under 18. Deliberately excludes terms with an
// innocent second meaning that would fire on ordinary film text: "minor" (a minor
// adjustment), "young" (a young man), "son"/"daughter" (an adult is somebody's
// daughter), "youth" (a youth centre), and "small" (a small woman).
const MINOR_WORDS = [
  "child", "children", "childhood", "kid", "kids", "toddler", "toddlers",
  "baby", "babies", "infant", "infants", "newborn", "newborns",
  "boy", "boys", "girl", "girls", "schoolboy", "schoolboys", "schoolgirl",
  "schoolgirls", "schoolchild", "schoolchildren", "schoolkid", "schoolkids",
  "pupil", "pupils", "adolescent", "adolescents", "preteen", "pre-teen",
  "tween", "youngster", "youngsters", "juvenile", "juveniles", "underage",
  "under-age", "primary schooler", "nursery",
];

// Teen vocabulary is only a violation when nothing in the same breath pins the
// age at 18 or 19 — the palette's own "in their late teens, around 18" is legal
// and has to stay legal, or the gate would fail every film that uses it.
const TEEN_WORDS = ["teen", "teens", "teenage", "teenaged", "teenager", "teenagers"];

const ADULT_TEEN_RE = /\b(18|19|eighteen|nineteen)\b/;

/** Ages stated in the ways a prompt actually states them. */
const AGE_PATTERNS = [
  /\b(\d{1,2})\s*[-–]?\s*years?[-\s]old\b/g,
  /\baged?\s+(?:about\s+|around\s+|roughly\s+)?(\d{1,2})\b/g,
  /\bof\s+(?:about\s+|around\s+|roughly\s+)?(\d{1,2})\s*(?:years?)?\b/g,
];

function minorSpans(text) {
  return String(text || "")
    .toLowerCase()
    .split(/[.!?;\n]+|—/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Under-18 people in any piece of generated text.
 *
 * Returns repair instructions rather than booleans — they go straight back to a
 * doctor or verifier skill, and a fault the model cannot act on is a fault that
 * ships. `where` names the thing being checked so the instruction reads sensibly
 * wherever it is used ("Scene 4", "the casting registry", "the storyline").
 */
function minorViolations(text, where = "This text") {
  const found = new Set();
  const ages = new Set();

  for (const span of minorSpans(text)) {
    for (const word of MINOR_WORDS) {
      // No escaping needed: every entry in MINOR_WORDS is letters, a hyphen or a
      // space, none of which mean anything special in a regex.
      const re = new RegExp(`(^|[^a-z-])${word}([^a-z-]|$)`);
      if (re.test(span)) found.add(word);
    }
    if (!ADULT_TEEN_RE.test(span)) {
      for (const word of TEEN_WORDS) {
        const re = new RegExp(`(^|[^a-z-])${word}([^a-z-]|$)`);
        if (re.test(span)) found.add(word);
      }
    }
    for (const pattern of AGE_PATTERNS) {
      pattern.lastIndex = 0;
      let match;
      while ((match = pattern.exec(span)) !== null) {
        const age = Number(match[1]);
        if (Number.isFinite(age) && age > 0 && age < 18) ages.add(age);
      }
    }
  }

  const violations = [];
  if (found.size > 0) {
    violations.push(
      `${where} puts a person under 18 on camera (${[...found].map((w) => `"${w}"`).join(", ")}). No minor appears ` +
        `in any Optiq film, in any role, in any frame. Recast every one of them as 18 or older doing the same ` +
        `thing — keep what the beat was about and change the age — or remove them from the frame entirely. Do not ` +
        `drop the story point over it.`
    );
  }
  if (ages.size > 0) {
    violations.push(
      `${where} states an age under 18 (${[...ages].sort((a, b) => a - b).join(", ")}). The youngest person who may ` +
        `appear in an Optiq film is 18. Raise the stated age to 18 or older and keep everything else about them.`
    );
  }
  return violations;
}

module.exports = {
  adultsOnlyMandate,
  ADULTS_ONLY_MANDATE,
  minorViolations,
  castingDirective,
  castingShapeViolations,
  drawSubjectPalette,
  castingViolations,
  traitsOf,
  sceneCasting,
  sceneCastingDirective,
  sceneCastingViolations,
  freshFaceDirective,
  charactersForBeat,
  recurringCharacterNames,
  SCENE_CASTING_MODES,
  DEFAULT_SCENE_CASTING,
  RECURRING_SUBJECT_CAP,
  COMPLEXIONS,
  HAIR_WOMEN,
  HAIR_MEN,
  FACIAL_HAIR,
  AGE_BANDS,
  BUILDS,
  DISTINCTIVE_MARKERS,
  HOUSE_DEFAULTS,
};
