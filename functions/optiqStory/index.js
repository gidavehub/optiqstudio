// ─── OPTIQ STORY — KNOWLEDGE BASE & ROUTER ──────────────────────────────────
//
// THIS IS THE STORY SANDBOX. It is a complete, self-contained duplicate of
// functions/optiqSkills, redesigned for ORIGINAL SHORT FILMS — entertainment
// pieces with no brand, no product and nothing being sold.
//
// It shares NO code and NO files with functions/optiqSkills. That is deliberate
// and load-bearing: the ad swarm earns the money, it works, and nothing in this
// directory may ever be able to change how it behaves. Two boxes, one door each.
//
//   functions/optiqSkills/  → ads (short-film ad, dialogue ad, narrated ad)
//   functions/optiqStory/   → original stories (short-film-story)
//
// The router in functions/index.js picks between them on videoType and never
// mixes them. If you fix a craft bug in one, decide deliberately whether the
// other wants the same fix — they are allowed to diverge, and they will.
//
// knowledge/  — the doctrine, copied from the ad swarm and then story-edited.
//               Part VIII (brand, product and text rendering) is deliberately
//               ABSENT: there is no brand in these films. Part XV (story craft)
//               is new and is the module that overrides the commercial instinct
//               everywhere it survives in Parts I–XIV.
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
// Identical to the ad swarm's, because they are a property of the video model,
// not of the film's purpose. Every scene prompt is 1,500–2,000 words. Within it:
//   150–200 words PER character (the Locked Character Block).
//   250–300 words on SOUND (the exact unscored bed, identical in every scene).
//   250–500 words on the SCENE BACKGROUND (environment + every visible item +
//            every background person: age, clothing, position, action).
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
  "casting-registry": [
    "03-character-consistency.md",
    "12-casting-variety.md",
    "14-character-references.md",
    "04-environment-engine.md",
    "05-craft-modules.md",
    "13-sound-policy.md",
    "15-story-craft.md",
  ],
  "scene-builder": [
    "02-prompt-architecture.md",
    "04-environment-engine.md",
    "05-craft-modules.md",
    "07-voice-dialogue.md",
    "09-safety.md",
    "12-casting-variety.md",
    "13-sound-policy.md",
    "14-character-references.md",
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
  // 16 rides with the reviser because a director revising a scene AFTER seeing
  // its frames talks in the shot board's language — "make the second angle
  // wider", "lose the insert" — and a reviser that has never heard of a setup
  // answers by rewriting the action instead.
  "scene-reviser": [
    "02-prompt-architecture.md",
    "05-craft-modules.md",
    "10-failure-catalog.md",
    "13-sound-policy.md",
    "16-shot-board.md",
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
  "character-references": {
    file: "14-character-references.md",
    title: "Character reference images — consistency by picture as well as paragraph",
  },
  "shot-board": {
    file: "16-shot-board.md",
    title: "The shot board — set plates, prop plates and one photographed frame per camera setup, and why the rooms stopped drifting",
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
  knowledgeFor,
  DOCTRINE_MODULES,
  doctrineIndexText,
  doctrineModule,
  exemplarScenePrompt,
  countWords,
};
