// ─── OPTIQ STORY X — THE LOCATION BIBLE ─────────────────────────────────────
//
// THE TEXT REPLACEMENT FOR THE SHOT BOARD.
//
// This sandbox used to photograph its film before filming it: a plate for every
// place, an arrangement plate generated from that, an object plate, and a frame
// per camera setup — a hundred-plus images, and the only thing the video model
// was ever shown. ./shotBoard.js and functions/shotBoardRun.js still hold that
// machinery and NOTHING IN THIS PIPELINE CALLS THEM ANY MORE. See §17.1 of the
// doctrine for the three failures that ended it; the load-bearing one is that a
// photorealistic face attached to a render of that same person in a cell, in
// handcuffs or under arrest reads to the classifier as a real person defamed, and
// is refused silently. The story types worth making are exactly the ones that
// tripped it.
//
// What the board was genuinely good at was holding a room still across twelve
// separately-generated clips. This module is how that is done in words.
//
// THE MECHANISM, IN ONE LINE: every place is written ONCE at 500–700 words and
// pasted VERBATIM into every scene set there. Identical words are what identical
// rooms are made of. A place summarised freshly per scene is a place the model
// invents freshly per scene, and it will.
//
// Two things this module does that a naive "describe the location" prompt does
// not, and both were failures in production:
//
//   THE FIXED ORDER (§17.3). Shell → surfaces → light → fixtures → dressing →
//   seating geography → background life → sound. JS composes the block from the
//   model's fields rather than letting the model lay it out, so the eight
//   sections cannot be skipped, cannot be merged, and appear in the same order in
//   every block in the film. Order is itself a consistency device: the model
//   weights position in the paragraph, and a room whose sections move around is a
//   room whose priorities keep changing.
//
//   THE SEPARATION RULE (§17.5). Two offices, two bedrooms, two branches of the
//   same bank, or one kitchen at dawn and at night, are the case where this whole
//   system quietly fails — the bible describes both as "a small office" and the
//   film now has one office in it. So sibling places must differ on four named
//   axes AND each block must name its sibling and say how it differs. A model
//   told what a place is NOT holds the difference far better than one told only
//   what it is.
//
// Nothing here calls Vertex. The pipeline runs the skill; this module owns the
// schema, the directive, the brief, the composition and the gate.

"use strict";

const { WORD_BUDGETS, isComplexPlace } = require("./index");

/** The eight sections of a location block, in the order §17.3 fixes them. */
const BLOCK_SECTIONS = [
  ["shell", "THE SHELL"],
  ["surfaces", "THE SURFACES"],
  ["light", "THE LIGHT"],
  ["fixtures", "THE FIXED FURNITURE AND FITTINGS"],
  ["dressing", "THE DRESSING"],
  ["geography", "THE SEATING AND STANDING GEOGRAPHY"],
  ["backgroundLife", "THE BACKGROUND LIFE"],
  ["sound", "THE SOUND OF THE PLACE"],
];

// ─── THE SCHEMA ─────────────────────────────────────────────────────────────

/**
 * One entry per PLACE-AND-TIME, not per place. The same kitchen at dawn and at
 * night is two entries, because one block cannot hold two light states and a
 * block that tries holds neither.
 */
const LOCATION_SCHEMA = {
  type: "OBJECT",
  properties: {
    locations: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          /** Short stable handle, e.g. "branch-office-day". */
          id: { type: "STRING" },
          /** What the storyline calls it, so a scene can be matched to it. */
          name: { type: "STRING" },
          /** Every other name the storyline's beats use for this same place. */
          aliases: { type: "ARRAY", items: { type: "STRING" } },
          /** The scene numbers set here. */
          scenes: { type: "ARRAY", items: { type: "INTEGER" } },
          timeOfDay: { type: "STRING" },
          /**
           * "complex" buys the 700-word treatment. Counters, queues, crowds,
           * signage, multiple seats, car interiors. See §17.2.
           */
          complexity: { type: "STRING", enum: ["simple", "complex"] },

          // ── The eight sections, in §17.3 order ──────────────────────────────
          shell: { type: "STRING" },
          surfaces: { type: "STRING" },
          light: { type: "STRING" },
          fixtures: { type: "STRING" },
          dressing: { type: "STRING" },
          geography: { type: "STRING" },
          backgroundLife: { type: "STRING" },
          sound: { type: "STRING" },

          /**
           * §17.5. The other place in THIS film that could be confused with this
           * one, and the four axes it differs on — written as prose that goes
           * into the block itself. Empty string when nothing resembles it.
           */
          distinctFrom: { type: "STRING" },
        },
        required: [
          "id", "name", "aliases", "scenes", "timeOfDay", "complexity",
          "shell", "surfaces", "light", "fixtures", "dressing", "geography",
          "backgroundLife", "sound", "distinctFrom",
        ],
      },
    },
  },
  required: ["locations"],
};

// ─── THE DIRECTIVE ──────────────────────────────────────────────────────────

/**
 * The location designer's system prompt.
 *
 * Deliberately states the budget in words-per-section as well as in total. Asked
 * only for "500–700 words", a model writes 500 and puts 300 of them in the first
 * section; asked per section, it fills all eight.
 */
function locationDirective({ numScenes } = {}) {
  const min = WORD_BUDGETS.backgroundMin;
  const max = WORD_BUDGETS.backgroundMax;

  return `You are the LOCATION DESIGNER of the Optiq Story swarm, and you write the film's LOCATION BIBLE.

═══ WHY THIS JOB EXISTS AND WHAT HAPPENS IF YOU DO IT THINLY ═══
This film is rendered TEXT-TO-VIDEO. No photograph, no reference image, no plate
and no frame is attached to any clip. Every one of this film's ${numScenes || "thirty"} scenes is
generated from words alone, by a model with NO MEMORY of the scene before it.

So there is exactly one thing in this entire pipeline that makes the same room
look like the same room in scene 4 and scene 19: the IDENTICAL PARAGRAPH pasted
into both. That paragraph is what you are writing. Every detail you leave out is
a detail the model invents, and it invents a different one each time — that is
how a film ends up with three versions of one kitchen and an audience that has
lost track of where it is.

You are not setting a mood. You are a location scout photographing an empty room
and writing down everything in it.

═══ THE BUDGET ═══
${min}–${max} words per location. Where in that range:
  • ${max} words — COMPLEX places. A bank, a hall, a courtroom, a police station or cell, a ward or clinic, a classroom, a restaurant or bar, a shop, a market, an office with more than one desk, a wedding, a funeral, and THE INSIDE OF A CAR. Anything with a counter, a queue, a crowd, signage, multiple seats, or more than three background people. Use all ${max}. These places have dozens of independently-invented details and every one of them is a continuity error waiting to happen.
  • ${min} words — SIMPLE places. A bedroom, a corridor, a stretch of wall, a one-room bitik, a patch of yard. Four surfaces and a handful of objects.

Below ${min} words the block does not hold a room. Do not write ${Math.round(min / 2)} words and assume the scene will fill in the rest — it will not, it is forbidden from doing so, and that is the whole design.

═══ THE EIGHT SECTIONS — WRITE ALL EIGHT, EVERY TIME ═══
Each is its own field. Do not merge them, do not leave one at a sentence.

1. shell — What kind of structure. How big in real terms: how many paces across, how high the ceiling, the shape of the footprint. EVERY door and EVERY window: which wall, how wide, which way it opens, and what is on the other side of it.

2. surfaces — Floor: material, colour, condition, what is on it. Walls: material, finish, colour, and THE MARKS — the scuff at chair height, the damp bloom in the corner, where the paint stops because a shelf used to be there. Ceiling: material, fittings, stains. Wear is the signature of a real room and models never add it unprompted.

3. light — Where it comes from: which window, which fitting, which doorway. Its colour and quality. What it lands on, what it leaves dark, where the shadows fall and how hard they are. State the time of day this block assumes.

4. fixtures — Everything that does NOT move between scenes, each placed relative to the openings and to each other. Never "a desk" — THE desk: what it is made of, how big, where it stands, which way it faces, what is on it, what is under it.

5. dressing — The loose, specific, LOCAL objects. Reach at least Rung 4 of the specificity ladder: the named local thing a Gambian audience recognises. What is stacked in the corner, taped to the wall, hanging on the nail, left on the sill. AND THE MESS: what is worn, chipped, stained, mismatched or piled where it should not be.

6. geography — THE MOST IMPORTANT FIELD YOU WRITE, and the one that stops people teleporting between clips. Name and fix EVERY position a person can occupy here: which chair, on which side of which table, facing which way, with what within reach of their hands, and what is on the wall behind them. Name them so a scene can refer to them ("the left-hand chair", "the near end of the counter", "the doorway to the yard").
   For a CAR this is the entire job and it must be exhaustive: driver's seat, front passenger, each rear seat, which way each person faces, what each can see through which window, the gap between the front seats, what is on the dashboard, what is in the door pockets, the state of the upholstery, what hangs from the mirror.

7. backgroundLife — Who else is here when this place is in use. How many, roughly what ages, what they are wearing, and — the part that always gets skipped — WHAT EACH OF THEM IS DOING, specifically. Not "customers": a woman at the second window counting notes back into an envelope, a man near the door checking a phone he is not using. Every background person is explicitly Black Gambian, and they VARY from one another — different complexions across the real range, different hair, a spread of ages and builds.

8. sound — This place's specific continuous noise, named precisely enough that every scene repeating it sounds like one recording. Not "ambient noise": the particular ceiling fan, the particular generator two compounds over, the particular distance of the road. NO MUSIC — this film's clips carry none, ever, and a radio playing in your location block would put music in every scene set here.

═══ THE SEPARATION RULE — READ THIS TWICE ═══
The single failure this bible exists to prevent, after drift itself: TWO PLACES OF THE SAME KIND BLURRING INTO ONE. Two offices, two bedrooms, two bank branches, two compounds. A bible that calls one "a small office with a desk and a window" and the other "a modest office, desk, window" has written ONE office, and the film's geography is now gone.

Whenever this film has two places of the same kind, separate them on at least FOUR axes:
  • SIZE or SHAPE — one long and narrow, one square.
  • LIGHT — one takes hard sun from a high window, one is under a fluorescent tube with a dead end.
  • A DOMINANT COLOUR or material — one bare cement and grey steel, one cream paint gone yellow and dark wood.
  • ONE UNMISTAKABLE OBJECT the other does not have, big enough to be in most frames — a wall of box files, a broken air conditioner, a ceiling fan with one blade taped.

Then, in the "distinctFrom" field, NAME the other place and say how this one differs: "This is NOT the branch office in scenes 4 and 9 — that one is narrow, fluorescent-lit and lined with box files; this one is square, sunlit, and dominated by the dark wooden cabinet on the back wall." Naming the sibling is what makes the separation survive.

THE SAME RULE BINDS TIME OF DAY. The same kitchen at dawn and at night is TWO ENTRIES in this bible, written separately, each with its own light field, each naming the other in distinctFrom. Do not write one entry and hope the scene adjusts it.

If a place genuinely has nothing in this film it could be confused with, write "Nothing else in this film resembles this place." in distinctFrom. Do not leave it empty.

═══ WHAT YOU DO NOT WRITE ═══
• NO CHARACTERS. Not one named person from the cast appears in a location block. The cast belongs to the casting registry; you write the room and the strangers in it. A named character in your block will start appearing in scenes they are not in.
• NO STORY. No events, no beats, no "this is where the argument happens". You are photographing an empty building on a day when nothing is happening.
• NO CAMERA. Where the camera goes is the scene's business. You state the geography the camera will work in; you never state a shot, an angle or a lens.
• NO MUSIC anywhere, in any field.
• NO MOOD ADJECTIVES DOING THE WORK OF DESCRIPTION. "Oppressive", "cosy", "tense", "atmospheric" are not things a camera can point at, and they are banned vocabulary. If the room is oppressive, write that the ceiling is low, the window is high and small, and the walls are the colour of wet cement.
• NOBODY UNDER 18 anywhere in backgroundLife. Every person in every frame of this film is an adult.

═══ COVERAGE ═══
EVERY location any scene of this film is set in gets an entry. Read the scene list you are given, group the scenes by place, and account for all of them — a scene whose location has no block is a scene with no room, and it will be built from nothing.
Put every name the storyline uses for a place into "aliases" so its scenes can be matched to your entry.`;
}

// ─── THE BRIEF ──────────────────────────────────────────────────────────────

/**
 * The user-turn message: the places this film actually needs, and the scenes that
 * need them.
 *
 * Built from the STORYLINE's beats rather than the compiled prompts. The beats
 * name the location in one field, which groups cleanly; the compiled prompts are
 * 3,000 words each and thirty of them do not fit in a context window alongside
 * everything else this skill has to read.
 */
function locationBrief({ storyline, registry, brief }) {
  const beats = storyline?.sceneBeats || [];

  // Group the beats by the location string the storyline gave them, preserving
  // first-appearance order so the bible reads in the order the film plays.
  const groups = new Map();
  for (const beat of beats) {
    const place = String(beat.location || "").trim() || "(unstated)";
    const key = place.toLowerCase();
    if (!groups.has(key)) groups.set(key, { name: place, scenes: [], moments: [] });
    const group = groups.get(key);
    group.scenes.push(Number(beat.sceneNumber));
    if (group.moments.length < 3) group.moments.push(String(beat.moment || "").slice(0, 180));
  }

  const places = [...groups.values()].map((group) => {
    const complex = isComplexPlace(group.name);
    return `• "${group.name}" — scene(s) ${group.scenes.join(", ")}. ${
      complex
        ? `TREAT AS COMPLEX: write the full ${WORD_BUDGETS.backgroundMax} words.`
        : `Simple unless the moments below say otherwise.`
    }
  What happens here (for geography only — do NOT write the story): ${group.moments.join(" / ")}`;
  });

  // The recurring-set anchors the casting registry already wrote. Not a
  // substitute for a block — they are a sentence each — but they are the
  // registry's committed intent and the bible must not contradict them.
  const anchors = (registry?.recurringSets || [])
    .map((s) => `• ${s.name} (scenes ${(s.scenes || []).join(", ")}): ${s.anchor}`)
    .join("\n");

  return `THE PLACES THIS FILM IS SET IN. Write a location block for every one of them.

${places.join("\n\n")}

${
    anchors
      ? `THE CASTING REGISTRY ALREADY COMMITTED TO THESE SET ANCHORS. Your blocks must be
consistent with them — expand them, never contradict them:
${anchors}`
      : ""
  }

THE FILM: ${storyline?.title || "(untitled)"} — ${storyline?.storyPitch || storyline?.concept || ""}
THE SETTING THE PREMISE ASKED FOR: ${brief?.setting || "The Gambia, West Africa"}
THE STYLE CONTRACT every block must be consistent with: ${registry?.styleHeader || "(none)"}

Now check, before you answer: does this film contain two places of the same kind?
Two offices, two bedrooms, two compounds, two shops — or one place at two times of
day? If so, separate them on four axes and name each other in distinctFrom. That
is the rule this bible fails on most often.`;
}

// ─── COMPOSITION ────────────────────────────────────────────────────────────

/**
 * Assemble one entry's eight fields into THE block — the exact text that gets
 * pasted, unchanged, into every scene set here.
 *
 * Composed in JS rather than authored as one string by the model, and that is
 * deliberate: it guarantees the §17.3 order, guarantees all eight sections are
 * present or visibly missing, and — because the same function composes the text
 * the scene-builder is told to paste AND the text the gate looks for — the two
 * cannot drift apart into a gate that fails a prompt for not containing something
 * nobody ever asked it to contain.
 */
function locationBlockText(entry) {
  if (!entry) return "";
  const header = `═══ LOCATION LOCK — ${String(entry.name || entry.id || "THE PLACE").toUpperCase()}${
    entry.timeOfDay ? `, ${String(entry.timeOfDay).toUpperCase()}` : ""
  } ═══`;

  const body = BLOCK_SECTIONS.map(([field, label]) => {
    const text = String(entry[field] || "").trim();
    return text ? `${label}. ${text}` : "";
  })
    .filter(Boolean)
    .join("\n\n");

  const separation = String(entry.distinctFrom || "").trim();

  return [header, body, separation ? `WHICH PLACE THIS IS NOT. ${separation}` : ""]
    .filter(Boolean)
    .join("\n\n");
}

/** Word count of the composed block — what the budget is actually measured on. */
function blockWordCount(entry) {
  return locationBlockText(entry).split(/\s+/).filter(Boolean).length;
}

function normalizeName(text) {
  return String(text || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

/**
 * Which location block a given scene beat belongs to.
 *
 * Matched on the entry's scene list FIRST — the designer read the whole film and
 * its allocation is the authority — then on name and aliases, which is the
 * fallback for a scene the designer's scene list missed.
 */
function locationForBeat(bible, beat) {
  const entries = bible?.locations || [];
  if (entries.length === 0 || !beat) return null;

  const number = Number(beat.sceneNumber);
  const byScene = entries.find((e) => (e.scenes || []).map(Number).includes(number));
  if (byScene) return byScene;

  const wanted = normalizeName(beat.location);
  if (!wanted) return null;
  return (
    entries.find((e) => normalizeName(e.name) === wanted) ||
    entries.find((e) =>
      (e.aliases || []).some((a) => normalizeName(a) === wanted)
    ) ||
    // Last resort: a substring match, which catches "Fatou's kitchen" against
    // "the kitchen". Better than handing the builder no room at all.
    entries.find((e) => wanted.includes(normalizeName(e.name)) || normalizeName(e.name).includes(wanted)) ||
    null
  );
}

/**
 * What the scene-builder is told about its location block.
 *
 * The instruction and the block travel together so a builder cannot receive one
 * without the other.
 */
function locationBlockDirective(entry) {
  if (!entry) {
    return `═══ NO LOCATION BLOCK EXISTS FOR THIS SCENE ═══
The location bible has no entry for this scene's place, so you must write the
place yourself, to the full ${WORD_BUDGETS.backgroundMin}–${WORD_BUDGETS.backgroundMax}-word standard: the shell and its
openings, the floor and the walls and their marks, where the light comes from and
what it leaves dark, the fixed furniture placed relative to the doors, the loose
local dressing and the mess, EVERY position a person can occupy and what is within
reach of it, every background person and what their hands are doing, and the
specific continuous sound of the place. This is the only description of this room
in the entire film — write it as though nothing else will ever say what is here,
because nothing else will.`;
  }

  const complex = entry.complexity === "complex";
  return `═══ THIS SCENE'S LOCATION BLOCK — PASTE IT VERBATIM ═══
This scene is set in ${entry.name}${entry.timeOfDay ? ` (${entry.timeOfDay})` : ""}. The film's location bible has
already written this place, once, in full. Reproduce the block below WORD FOR
WORD inside your prompt's setting/background section. Do not summarise it, do not
re-word it, do not "adapt it to this moment", do not shorten it because you have
used it before — every other scene set here is pasting these same ${blockWordCount(entry)} words, and
that identity is the ONLY thing making this the same room in every clip. Change
one sentence and this scene is set somewhere else.

${locationBlockText(entry)}

═══ WHAT YOU ADD ON TOP — AND ONLY THIS ═══
After the block, write a short STAGING paragraph of your own:
  • Where each character in this scene is, in the block's own vocabulary — use the positions it named ("seated in the left-hand chair", "standing in the doorway to the yard"). Say which way each of them faces and what is within reach of their hands.
  • What is DIFFERENT today, and only what is genuinely different: a chair pulled out, the shutter closed, a bag on the table that does not live there, water on the floor.
  • Anything that CHANGES during these ten seconds — a lamp switched on, the table overturned, rain starting — because a fixed description cannot carry a change.

DO NOT RE-DESCRIBE THE WALLS, THE FLOOR, THE LIGHT, THE FURNITURE OR THE BACKGROUND PEOPLE. The block above already did, and your second account of one wall and its first account are two descriptions the model reconciles by inventing a third. Paste, stage, stop.${
    complex
      ? `\n\nTHIS IS A COMPLEX LOCATION. Its block is long because it has to be. Do not trim it to make room elsewhere — take the room out of your own prose instead.`
      : ""
  }`;
}

// ─── THE GATE ───────────────────────────────────────────────────────────────

/**
 * How much of `needle` appears verbatim in `haystack`, by sentence.
 *
 * A whole-block containment check is the honest test but it is brittle at 700
 * words: one interleaved staging sentence and a perfectly good paste fails. So
 * coverage is measured per sentence, which tolerates the builder threading its
 * staging through the block while still catching the thing that actually matters
 * — a block that has been PARAPHRASED rather than pasted, where almost no
 * sentence survives intact.
 */
function verbatimCoverage(haystack, needle) {
  const sentences = String(needle || "")
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => normalizeName(s))
    .filter((s) => s.split(" ").length >= 5);
  if (sentences.length === 0) return 1;
  const hay = normalizeName(haystack);
  const hit = sentences.filter((s) => hay.includes(s)).length;
  return hit / sentences.length;
}

/** Below this share of surviving sentences, the block was rewritten, not pasted. */
const MIN_BLOCK_COVERAGE = 0.75;

/**
 * Violations for the bible as a whole, for the repair pass.
 *
 * Run before a single scene is compiled, because every scene pastes these blocks
 * verbatim: a thin block caught here is one repair, and caught after thirty scene
 * prompts have embedded it, it is thirty.
 */
function locationViolations(bible, storyline) {
  const entries = (bible?.locations || []).filter(Boolean);
  const violations = [];
  const beats = storyline?.sceneBeats || [];

  if (entries.length === 0) {
    return ["The location bible is empty. Every place this film is set in needs a block."];
  }

  // 1. COVERAGE — every scene has a room.
  const orphans = beats.filter((beat) => !locationForBeat(bible, beat));
  if (orphans.length > 0) {
    const names = [...new Set(orphans.map((b) => String(b.location || "(unstated)")))];
    violations.push(
      `${orphans.length} scene(s) have no location block: scene(s) ` +
        `${orphans.map((b) => b.sceneNumber).join(", ")}, set in ${names.join(" / ")}. ` +
        `Every scene must resolve to a block — add the missing places, and put every name the ` +
        `storyline uses for a place into that entry's "aliases" so its scenes match.`
    );
  }

  // 2. THE BUDGET — measured on the composed block, which is what actually gets
  //    pasted, not on the sum of the fields the model thinks it wrote.
  for (const entry of entries) {
    const words = blockWordCount(entry);
    const complex = entry.complexity === "complex" || isComplexPlace(entry.name);
    const floor = complex ? WORD_BUDGETS.backgroundMax : WORD_BUDGETS.backgroundMin;
    if (words < floor) {
      violations.push(
        `"${entry.name}" is ${words} words — a ${complex ? "COMPLEX" : "simple"} place owes ${floor}. ` +
          `This block is pasted into every scene set there and it is the only description of that room in ` +
          `the whole film. Expand the thin sections with authored specifics: the marks on the walls, what ` +
          `is under the furniture, every position a person can sit or stand in and what is in reach of it, ` +
          `each background person and what their hands are doing. Never filler, never mood adjectives.`
      );
    }
  }

  // 3. THE EIGHT SECTIONS — present, and none of them a token sentence.
  for (const entry of entries) {
    const thin = BLOCK_SECTIONS.filter(
      ([field]) => String(entry[field] || "").split(/\s+/).filter(Boolean).length < 15
    ).map(([, label]) => label);
    if (thin.length > 0) {
      violations.push(
        `"${entry.name}" has empty or one-line section(s): ${thin.join(", ")}. All eight sections are ` +
          `written for every place, every time. A missing section is a set of details the video model ` +
          `invents differently in every clip.`
      );
    }
    // geography is singled out because it is the one that stops people
    // teleporting, and it is the one models shortchange first.
    const geo = String(entry.geography || "").split(/\s+/).filter(Boolean).length;
    if (geo > 0 && geo < 45) {
      violations.push(
        `"${entry.name}" gives only ${geo} words to the SEATING AND STANDING GEOGRAPHY. This is the field ` +
          `that stops people teleporting between clips. Name and fix EVERY position a person can occupy ` +
          `here — which chair, which side of which table, facing which way, what is within reach and what ` +
          `is on the wall behind them — so a scene can refer to them by name.`
      );
    }
  }

  // 4. THE SEPARATION RULE — the failure that makes a film lose its geography.
  for (const entry of entries) {
    if (!String(entry.distinctFrom || "").trim()) {
      violations.push(
        `"${entry.name}" leaves distinctFrom empty. Name the place in this film it could be confused with ` +
          `and say how it differs, or state plainly that nothing else in this film resembles it.`
      );
    }
  }
  const siblings = new Map();
  for (const entry of entries) {
    const kind = placeKind(entry.name);
    if (!kind) continue;
    if (!siblings.has(kind)) siblings.set(kind, []);
    siblings.get(kind).push(entry);
  }
  for (const [kind, group] of siblings) {
    if (group.length < 2) continue;
    for (const entry of group) {
      const others = group.filter((e) => e !== entry);
      const named = others.some((o) =>
        normalizeName(entry.distinctFrom).includes(normalizeName(o.name))
      );
      if (!named) {
        violations.push(
          `This film has ${group.length} places of the same kind ("${kind}": ${group
            .map((e) => e.name)
            .join(", ")}), and "${entry.name}" never names the others in distinctFrom. Two rooms of one ` +
            `kind described in similar words ARE one room to the video model. Separate them on four axes — ` +
            `size or shape, light, a dominant colour or material, and one unmistakable object the other ` +
            `does not have — then name the sibling and say how this one differs.`
        );
      }
    }
  }

  // 5. NO CAST IN THE ROOMS. A named character in a location block appears in
  //    every scene that block is pasted into, including the ones they are not in.
  const castNames = (storyline?.sceneBeats || [])
    .flatMap((b) => b.charactersPresent || [])
    .map((n) => String(n).trim())
    .filter((n) => n.length > 2);
  const unique = [...new Set(castNames)];
  for (const entry of entries) {
    const block = normalizeName(locationBlockText(entry));
    const found = unique.filter((name) => block.includes(` ${normalizeName(name)} `));
    if (found.length > 0) {
      violations.push(
        `"${entry.name}" names ${[...new Set(found)].join(", ")} from the cast. A location block is pasted ` +
          `into every scene set there, so a character named in it walks into scenes they are not in. ` +
          `Describe the room and the strangers in it; the cast belongs to the casting registry.`
      );
    }
  }

  return violations;
}

/**
 * The rough kind of place a name denotes — "office", "kitchen", "bank".
 *
 * Only used to spot siblings, so it is deliberately coarse: the last meaningful
 * noun in the name is right often enough ("the branch office" → office, "Fatou's
 * kitchen" → kitchen) and a miss only costs one un-run check.
 */
const PLACE_STOPWORDS = new Set([
  "the", "a", "an", "of", "at", "in", "on", "day", "night", "morning", "evening",
  "dawn", "dusk", "interior", "exterior", "int", "ext", "s",
]);

function placeKind(name) {
  const words = normalizeName(name)
    .split(" ")
    .filter((w) => w && !PLACE_STOPWORDS.has(w));
  return words.length ? words[words.length - 1] : "";
}

module.exports = {
  LOCATION_SCHEMA,
  locationDirective,
  locationBrief,
  locationBlockText,
  locationBlockDirective,
  locationForBeat,
  locationViolations,
  blockWordCount,
  verbatimCoverage,
  MIN_BLOCK_COVERAGE,
  BLOCK_SECTIONS,
};
