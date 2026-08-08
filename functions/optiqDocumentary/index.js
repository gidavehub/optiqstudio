// ─── OPTIQ DOCUMENTARY — KNOWLEDGE BASE & ROUTER ────────────────────────────
//
// THIS IS THE DOCUMENTARY SANDBOX. It is a complete, self-contained third box,
// duplicated from functions/optiqStory and then re-cut for NARRATED DOCUMENTARY
// films: nothing is being sold, nobody speaks on camera, and every word in the
// finished film is a voiceover laid over the cut afterwards.
//
// It shares NO code and NO files with functions/optiqSkills or
// functions/optiqStory. That is deliberate and load-bearing: the ad swarm earns
// the money and the story sandbox is tuned, and nothing in this directory may
// ever be able to change how either of them behaves. Three boxes, one door each.
//
//   functions/optiqSkills/      → ads (short-film ad, dialogue ad, narrated ad)
//   functions/optiqStory/       → original stories (short-film-story)
//   functions/optiqDocumentary/ → documentaries (short-film-documentary)
//
// The router in functions/index.js picks between them on videoType and never
// mixes them. If you fix a craft bug in one, decide deliberately whether the
// others want the same fix — they are allowed to diverge, and they will.
//
// knowledge/  — the doctrine, copied from the story sandbox and then
//               documentary-edited. Part VIII (brand, product and text
//               rendering) is deliberately ABSENT: there is no brand in these
//               films. Part XIV (character reference images) is ABSENT too — a
//               documentary casts one-off people scene by scene, so there is
//               nobody to render a reference sheet for and no image quota is
//               spent. Part VII is NARRATION craft rather than dialogue, and
//               Part XV is the documentary-craft module that overrides the
//               dramatic instinct everywhere it survives in Parts I–XIII.
//
// There is deliberately NO reference-film library here, for the same reason the
// story sandbox has none: the ad swarm's library is six real client ads, and
// handing those to a documentary skill as "narrative machinery to learn from"
// drags every film back toward advertising.

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
// Identical to the other two sandboxes', because they are a property of the
// video model, not of the film's purpose. Every scene prompt is 1,500–2,000
// words. Within it:
//   150–200 words PER recurring subject (rare here — most people are one-offs).
//   250–300 words on SOUND (the exact unscored, wordless bed, identical in every
//            scene).
//   250–500 words on the SCENE BACKGROUND (environment + every visible item +
//            every person: age, clothing, position, action).
const WORD_BUDGETS = {
  scenePromptMin: 1500,
  scenePromptMax: 2000,
  scenePromptHardFloor: 1250, // below this a scene fails the JS gate and is repaired
  perCharacterMin: 150,
  perCharacterMax: 200,
  soundMin: 250,
  soundMax: 300,
  backgroundMin: 250,
  backgroundMax: 500,
};

/**
 * How fast the narrator reads, and therefore how many words a scene's narration
 * line may carry.
 *
 * Kept here beside the prompt budgets because it is the same kind of fact: a
 * hard property of the downstream model that every skill has to write to. The
 * TTS voice reads at roughly 2.5 words a second, and a narration line has to sit
 * inside a gap in the picture rather than run the full ten seconds — so a line
 * over ~24 words is one audio post will have to cut down and re-synthesize.
 */
const NARRATION_BUDGETS = {
  wordsPerSecond: 2.5,
  maxWordsPerScene: 24,
  targetWordsPerScene: 16,
};

// ─── PER-SKILL KNOWLEDGE ROUTING ────────────────────────────────────────────
// Which doctrine modules each skill loads. Keep every skill's context lean: only
// what that specialist needs to do its one job well.
//
// 15 rides with EVERY skill in this sandbox, and 07 with almost every one. Parts
// I–XIII were written for films that sell something and whose people talk; 15 is
// the module that suspends the selling and 07 is the module that removes the
// speech. They go last in each list so they read as the later, overriding word —
// the same mechanism by which 12 reverses 03's worked examples and 13 reverses
// 05's music rule.
const SKILL_KNOWLEDGE = {
  "subject-analyst": ["01-doctrine.md", "15-documentary-craft.md"],
  outline: [
    "01-doctrine.md",
    "06-cut-logic.md",
    "07-narration-craft.md",
    "15-documentary-craft.md",
  ],
  registry: [
    "03-character-consistency.md",
    "12-casting-variety.md",
    "04-environment-engine.md",
    "05-craft-modules.md",
    "13-sound-policy.md",
    "15-documentary-craft.md",
  ],
  "scene-builder": [
    "02-prompt-architecture.md",
    "04-environment-engine.md",
    "05-craft-modules.md",
    "09-safety.md",
    "12-casting-variety.md",
    "13-sound-policy.md",
    "07-narration-craft.md",
    "15-documentary-craft.md",
  ],
  "scene-verifier": [
    "01-doctrine.md",
    "09-safety.md",
    "10-failure-catalog.md",
    "12-casting-variety.md",
    "13-sound-policy.md",
    "07-narration-craft.md",
    "15-documentary-craft.md",
  ],
  "scene-reviser": [
    "02-prompt-architecture.md",
    "05-craft-modules.md",
    "10-failure-catalog.md",
    "13-sound-policy.md",
    "07-narration-craft.md",
    "15-documentary-craft.md",
  ],
};

function knowledgeFor(skillName) {
  const files = SKILL_KNOWLEDGE[skillName] || [];
  return files.map((f) => loadDoc(f)).join("\n\n---\n\n");
}

// ─── DOCTRINE MODULES, BY NAME ──────────────────────────────────────────────
// The documentary agent (see ./agent.js) reads doctrine on demand rather than
// carrying the whole manual in its system prompt — the director can ask "why
// can't anyone talk?" and the agent quotes the actual module.
const DOCTRINE_MODULES = {
  "documentary-craft": {
    file: "15-documentary-craft.md",
    title: "Documentary craft — the thesis, the evidence, the complication, and a close that actually lands (START HERE)",
  },
  "narration-craft": {
    file: "07-narration-craft.md",
    title: "Narration — silent footage, a voice added afterwards, and how the two are written to fit each other",
  },
  doctrine: { file: "01-doctrine.md", title: "The doctrine — moments not mood, the seven laws, banned vocabulary" },
  "prompt-architecture": { file: "02-prompt-architecture.md", title: "The canonical block order and the length doctrine" },
  "subject-consistency": { file: "03-character-consistency.md", title: "Locked blocks for a recurring subject, and why a documentary needs almost none" },
  "environment-engine": { file: "04-environment-engine.md", title: "The specificity ladder — how a place stops being generic Africa" },
  "craft-modules": { file: "05-craft-modules.md", title: "Camera, lighting, colour and sound craft" },
  "cut-logic": { file: "06-cut-logic.md", title: "When a 10s scene is one shot and when it carries hard cuts" },
  safety: { file: "09-safety.md", title: "Safety — minors, classifiers, prohibited framings" },
  "failure-catalog": { file: "10-failure-catalog.md", title: "Known generation failures and their structural fixes" },
  "casting-variety": {
    file: "12-casting-variety.md",
    title: "Variety — why every film stopped starring the same person, and the spread that fixes it",
  },
  "sound-policy": {
    file: "13-sound-policy.md",
    title: "The sound policy — the video model generates NO music and NO speech; Lyria 3 Pro scores the finished cut and the narrator is recorded over it",
  },
  exemplar: { file: "exemplar-scene.md", title: "A gold-standard silent documentary scene prompt at full density" },
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
  NARRATION_BUDGETS,
  knowledgeFor,
  DOCTRINE_MODULES,
  doctrineIndexText,
  doctrineModule,
  exemplarScenePrompt,
  countWords,
};
