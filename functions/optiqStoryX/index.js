// ─── OPTIQ STORY X — KNOWLEDGE BASE & ROUTER ────────────────────────────────
//
// THIS IS THE EXPERIMENTAL STORY SANDBOX. A complete, self-contained duplicate of
// functions/optiqStory, for LONG-FORM original short films that are PHOTOGRAPHED
// BEFORE THEY ARE FILMED.
//
// It shares NO code and NO files with the other three boxes. That is deliberate
// and load-bearing: the ad swarm earns the money, it works, and nothing in this
// directory may ever be able to change how it behaves. Four boxes, one door each.
//
//   functions/optiqSkills/      → ads (short-film ad, dialogue ad, narrated ad)
//   functions/optiqStory/       → original stories (short-film-story)
//   functions/optiqStoryX/      → THIS ONE (short-film-story-x)
//   functions/optiqDocumentary/ → documentaries (short-film-documentary)
//
// The router in functions/index.js picks between them on videoType and never
// mixes them. If you fix a craft bug in one, decide deliberately whether the
// others want the same fix — they are allowed to diverge, and they will.
//
// ════════════════════════════════════════════════════════════════════════════
// WHAT MAKES THIS ONE DIFFERENT
// ════════════════════════════════════════════════════════════════════════════
//
// 1. IT IS PURE TEXT-TO-VIDEO, AND THAT IS A REVERSAL. This sandbox used to be
//    PHOTOGRAPHED: ./shotBoard.js built the film's world as a hierarchy of stills
//    — place → arrangement → object → state → frame — and those frames were the
//    only thing the video model was shown. Character reference sheets fed them.
//    Both are GONE from this pipeline. Nothing renders from a picture here; every
//    clip is generated from words alone.
//
//    Two reasons, and the second is the one that forced it:
//
//    COST AND TIME. A thirty-scene film is 100+ plates and frames, each tier
//    generated from the picture of the tier above, against an 8-per-minute image
//    quota. That is twenty-odd minutes of photography, several resumable passes,
//    and a large image bill, before a single second of video exists.
//
//    THE CLASSIFIER. This is the real one. Hand the video model a photorealistic
//    picture of a specific person and then ask for that person in a cell, in
//    handcuffs, being arrested, cornered, accused — and it reads as a real,
//    identifiable human being placed in a defamatory situation. Which is what it
//    would be, if the face were real. The model cannot tell that the face was
//    itself generated, so it refuses, and it refuses SILENTLY: the take comes
//    back empty or bland and the money is spent. Described in words instead, the
//    same scene renders, because there is no identifiable person in the request —
//    only a character. A story with any teeth in it (arrest, accusation, jail,
//    confrontation) is unfilmable image-to-video and perfectly filmable
//    text-to-video. That is the whole argument.
//
// 2. THE SCENE PROMPT CARRIES EVERYTHING, AND IT IS THE LONGEST ON THE PLATFORM.
//    Nothing else holds the look still now, so the words have to. 2,500–3,000
//    words per scene, of which 150–250 describe each character's face and body
//    and another ~100 lock what they are wearing, and 500–700 describe the place
//    itself down to who is sitting where and what is on the shelf behind them.
//    See WORD_BUDGETS below — those ratios ARE the consistency mechanism.
//
// 3. PLACES ARE WRITTEN ONCE AND PASTED VERBATIM. The thing a plate genuinely did
//    well was hold a room still across twelve scenes. The text replacement is the
//    LOCATION BIBLE (./locations.js): one specialist writes each recurring place
//    once, at full density, and every scene set there pastes that exact paragraph
//    without changing a word. Identical words are what identical rooms are made
//    of — and two DIFFERENT rooms of the same kind (two offices, two bedrooms)
//    are forced apart by the same module, because a bible that describes them
//    both as "a small office" has already let them blur.
//
// 4. IT IS LONG. Up to 600 seconds, i.e. up to 60 scenes, where every other type
//    caps at 180. That changes the story law (a real second act, a midpoint) and
//    it changes the machinery: no stage of this pipeline fits in one function
//    invocation, so every stage is resumable.
//
// 5. IT STOPS FOR APPROVAL. Once, now, not twice — the board gate went with the
//    board. The director reads the whole blueprint (the story, the cast, the
//    location bible, every scene's script) before a single clip is bought.
//
// knowledge/  — the doctrine, copied from the ad swarm and then story-edited.
//               Part VIII (brand, product and text rendering) is deliberately
//               ABSENT: there is no brand in these films. Part XV (story craft)
//               is new and is the module that overrides the commercial instinct
//               everywhere it survives in Parts I–XIV. Part XVII (the location
//               bible) is this sandbox's own and has no counterpart elsewhere.
//
// There is deliberately NO reference-film library here. The ad swarm's library
// is six real client ads, and handing those to a story skill as "narrative
// machinery to learn from" drags every film back toward advertising. A story's
// machinery is drawn fresh per film instead — see storyCraft.js.

const fs = require("fs");
const path = require("path");

const KNOWLEDGE_DIR = path.join(__dirname, "knowledge");

const docCache = new Map();
function loadDoc(relPath) {
  if (!docCache.has(relPath)) {
    docCache.set(relPath, fs.readFileSync(path.join(KNOWLEDGE_DIR, relPath), "utf8"));
  }
  return docCache.get(relPath);
}

// ─── WORD BUDGETS (the golden ratios — non-negotiable) ──────────────────────
//
// THE LARGEST BUDGET ON THE PLATFORM, AND IT IS DELIBERATE. The other three boxes
// run 1,500–2,000 words per scene. This one runs 2,500–3,000, because it is the
// only film type where the prompt is the ONLY thing the video model ever sees.
// There is no reference sheet behind it, no plate, no frame. Every word cut here
// is a detail the model invents differently in the next clip, and a detail
// invented differently in the next clip is the film falling apart.
//
// Every scene prompt is 2,500–3,000 words. Within it:
//
//   150–250 words PER character, on the body and the face alone (the Locked
//            Character Block). Skull shape, brow, the set of the eyes, the bridge
//            and the wings of the nose, the mouth at rest, the jaw, the neck, the
//            hands, the exact complexion and its finish, the hairline, the way
//            the hair is worn today, height, build, posture, gait, age. Every
//            single part of them. This is what a casting photograph used to do,
//            and it has to be done in prose now.
//
//   ~100 words PER character on WARDROBE, separately and afterwards, so the
//            clothes cannot be summarised away when the face runs long. Garment
//            by garment, head to toe: cut, cloth, weight, colour in CAPS, how it
//            fastens, how it sits on this particular body, its condition, and the
//            one constant object that survives a change of clothes.
//
//   500–700 words on the PLACE — the location block, pasted verbatim from the
//            location bible (./locations.js) and then staged for this scene. 700
//            is not a ceiling to aim below: a bank, a hall, a courtroom, a ward,
//            the inside of a car all need every one of them. Where each person
//            is standing or seated and facing, what is within reach of their
//            hands, what is on the wall behind them, what the floor is, where the
//            light comes from and what it lands on, every background person and
//            what they are doing.
//
//   250–300 words on SOUND (the exact unscored bed, identical in every scene).
//
// The remainder — roughly a third of the prompt — is DIALOGUE, the timestamped
// action beats, the camera, and the closing restatement. Description is the
// scaffolding; the talk and the events are still the film.
const WORD_BUDGETS = {
  scenePromptMin: 2500,
  scenePromptMax: 3000,
  scenePromptHardFloor: 2200, // below this a scene fails the JS gate and is repaired
  /** The Locked Character Block: face and body, per character. */
  perCharacterMin: 150,
  perCharacterMax: 250,
  /** The wardrobe lock, per character. Budgeted apart from the face on purpose. */
  wardrobeMin: 90,
  wardrobeMax: 120,
  soundMin: 250,
  soundMax: 300,
  /** The place, per scene. The top of this range is for complex interiors. */
  backgroundMin: 500,
  backgroundMax: 700,
};

/**
 * Places that need the TOP of the background budget rather than the bottom.
 *
 * A room with four things in it can be locked in 500 words. A bank cannot: it has
 * a counter line, a glass screen, a queue of strangers, signage, a floor pattern,
 * a security guard, six desks and a door that people keep coming through, and
 * every one of those is something two separate clips will otherwise invent
 * differently. The distinction is real and the model will not make it unprompted
 * — asked for "500–700 words", it writes 500 every time.
 *
 * Used by ./locations.js to decide which places get the long treatment, and by
 * the scene gate to decide how much background a scene set there owes.
 */
// Deliberately does NOT include a kitchen, a yard, a compound, a bedroom or a
// corridor. Those are the four-surfaces-and-a-few-objects places the 500-word
// block was sized for, and sweeping them in here would make "simple" unreachable
// and every block in every film 700 words whether it needed them or not. A
// designer can still mark any of them "complex" when a particular one is busy.
const COMPLEX_PLACE_HINTS = [
  "bank", "hall", "courtroom", "court", "office", "classroom", "lecture",
  "hospital", "ward", "clinic", "surgery", "police", "station", "cell", "prison",
  "restaurant", "bar", "hotel", "lobby", "reception", "shop", "store",
  "supermarket", "market", "warehouse", "factory", "workshop", "church",
  "mosque", "school", "library", "airport", "terminal", "bus", "train",
  "car", "vehicle", "taxi", "van", "lorry", "truck", "boat", "ferry",
  "stadium", "wedding", "funeral", "party", "meeting", "conference", "studio",
];

const COMPLEX_PLACE_RE = new RegExp(`\\b(${COMPLEX_PLACE_HINTS.join("|")})s?\\b`, "i");

/**
 * True when a place name wants the 700-word treatment rather than the 500.
 *
 * Matched on WORD BOUNDARIES, which is load-bearing: as a plain substring "bus"
 * matches "business" and "car" matches "caretaker's room", and both would quietly
 * put a small room on the 700-word budget for the rest of the film.
 */
function isComplexPlace(name) {
  return COMPLEX_PLACE_RE.test(String(name || ""));
}

// ─── PER-SKILL KNOWLEDGE ROUTING ────────────────────────────────────────────
// Which doctrine modules each skill loads. Keep every skill's context lean:
// only what that specialist needs to do its one job well.
//
// 15 rides with EVERY skill in this sandbox. Parts I–XIV were written for films
// that sell something and still say so in places; 15 is the module that suspends
// the selling, and a skill that reads the craft without reading 15 will write an
// ad. It goes last in each list so it reads as the later, overriding word — the
// same mechanism by which 12 reverses 03's worked examples and 13 reverses 05's
// music rule.
const SKILL_KNOWLEDGE = {
  "brief-analyst": ["01-doctrine.md", "15-story-craft.md"],
  storyline: ["01-doctrine.md", "06-cut-logic.md", "07-voice-dialogue.md", "15-story-craft.md"],
  // 14 (character reference images) is deliberately ABSENT from every list in
  // this file. This sandbox attaches no pictures to anything, so a registry that
  // has read it writes a block sized for a photograph to back it up — which is
  // exactly the too-short block that made the faces drift. 03 alone, at the new
  // budget, is the instruction that holds.
  "casting-registry": [
    "03-character-consistency.md",
    "12-casting-variety.md",
    "04-environment-engine.md",
    "05-craft-modules.md",
    "13-sound-policy.md",
    "15-story-craft.md",
  ],
  "scene-builder": [
    "02-prompt-architecture.md",
    "04-environment-engine.md",
    "17-location-bible.md",
    "05-craft-modules.md",
    "07-voice-dialogue.md",
    "09-safety.md",
    "12-casting-variety.md",
    "13-sound-policy.md",
    "15-story-craft.md",
  ],
  "scene-verifier": [
    "01-doctrine.md",
    "09-safety.md",
    "10-failure-catalog.md",
    "12-casting-variety.md",
    "13-sound-policy.md",
    "15-story-craft.md",
  ],
  // 17 rides with the reviser because the single most common revision on this
  // film type is about a PLACE, and a reviser that has not read the bible answers
  // "make the office feel colder" by rewriting the location block — which
  // desynchronises that scene from the eleven others set in the same office.
  "scene-reviser": [
    "02-prompt-architecture.md",
    "03-character-consistency.md",
    "05-craft-modules.md",
    "10-failure-catalog.md",
    "13-sound-policy.md",
    "17-location-bible.md",
    "15-story-craft.md",
  ],
  // The location designer writes every place in the film ONCE, at full density,
  // for every scene set there to paste verbatim. 04 is what stops a place being
  // generic; 17 is the bible's own law — the word budget, the fixed order the
  // block is written in, and the separation rule that keeps two rooms of the same
  // kind from blurring into one.
  "location-designer": [
    "04-environment-engine.md",
    "17-location-bible.md",
    "05-craft-modules.md",
    "09-safety.md",
    "15-story-craft.md",
  ],
};

function knowledgeFor(skillName) {
  const files = SKILL_KNOWLEDGE[skillName] || [];
  return files.map((f) => loadDoc(f)).join("\n\n---\n\n");
}

// ─── DOCTRINE MODULES, BY NAME ──────────────────────────────────────────────
// The story agent (see ./agent.js) reads doctrine on demand rather than carrying
// the whole manual in its system prompt — the director can ask "why does every
// prompt have to say Black?" and the agent quotes the actual module.
const DOCTRINE_MODULES = {
  "story-craft": {
    file: "15-story-craft.md",
    title: "Story craft — the hook, the stakes, the turn, and an ending that actually happens (START HERE)",
  },
  doctrine: { file: "01-doctrine.md", title: "The doctrine — moments not mood, the seven laws, banned vocabulary" },
  "prompt-architecture": { file: "02-prompt-architecture.md", title: "The canonical 14-block prompt order and the length doctrine" },
  "character-consistency": { file: "03-character-consistency.md", title: "Locked Character Blocks, wardrobe locks, how a face survives every clip" },
  "environment-engine": { file: "04-environment-engine.md", title: "The specificity ladder — how a place stops being generic Africa" },
  "craft-modules": { file: "05-craft-modules.md", title: "Camera, lighting, colour and sound craft" },
  "cut-logic": { file: "06-cut-logic.md", title: "When a 10s scene is one shot and when it carries hard cuts" },
  "voice-dialogue": { file: "07-voice-dialogue.md", title: "Dialogue and language tags — how people actually talk on camera" },
  safety: { file: "09-safety.md", title: "Safety — minors, classifiers, prohibited framings" },
  "failure-catalog": { file: "10-failure-catalog.md", title: "Known generation failures and their structural fixes" },
  "casting-variety": {
    file: "12-casting-variety.md",
    title: "Casting variety — why every film stopped starring the same person, and the spread that fixes it",
  },
  "sound-policy": {
    file: "13-sound-policy.md",
    title: "The sound policy — the video model generates NO music; Lyria 3 Pro scores the finished cut instead",
  },
  "location-bible": {
    file: "17-location-bible.md",
    title:
      "The location bible — every place written once at 500–700 words and pasted verbatim, and how two rooms of the same kind are kept apart (THIS SANDBOX ONLY)",
  },
  exemplar: { file: "exemplar-scene.md", title: "A gold-standard scene prompt at full density" },
};

function doctrineIndexText() {
  return Object.entries(DOCTRINE_MODULES)
    .map(([id, m]) => `- "${id}" — ${m.title}`)
    .join("\n");
}

function doctrineModule(id) {
  const mod = DOCTRINE_MODULES[id];
  if (!mod) return null;
  return loadDoc(mod.file);
}

function exemplarScenePrompt() {
  return loadDoc("exemplar-scene.md");
}

function countWords(text) {
  return String(text || "").split(/\s+/).filter(Boolean).length;
}

module.exports = {
  WORD_BUDGETS,
  COMPLEX_PLACE_HINTS,
  isComplexPlace,
  knowledgeFor,
  DOCTRINE_MODULES,
  doctrineIndexText,
  doctrineModule,
  exemplarScenePrompt,
  countWords,
};
