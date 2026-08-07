// ─── OPTIQ SKILLS — KNOWLEDGE BASE & ROUTER ─────────────────────────────────
// The single source of the Optiq Skills doctrine: the house film-system manual
// split into focused knowledge modules, plus an indexed library of reference
// storylines. Each agentic skill receives ONLY the modules it needs, so no
// context window is bombarded with the whole manual.
//
// knowledge/            — doctrine modules (Parts I–XI of the manual)
// knowledge/films/      — the reference film library (indexed storylines)

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
// Every scene prompt is 1,500–2,000 words. Within it:
//   150–200 words PER character (physical facial features, skin, hair, eyes,
//            nose, height, age — the Locked Character Block).
//   250–300 words on SOUND (the exact background music or the exact silence,
//            described identically in every continuous scene).
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

// ─── STORY LIBRARY INDEX ────────────────────────────────────────────────────
// Compact metadata for the brief-analyst to pick relevant reference storylines
// without loading any film content. `file` is the module handed to the
// storyline skill once selected.
const STORY_LIBRARY = [
  {
    id: "the-run",
    file: "films/film-01-the-run-brief.md",
    title: "The Run (Sidrah Salaam — groundnut paste)",
    offering: "product",
    register: "warm comedic feel-good chase; Nike-style urban run",
    pattern:
      "Forgotten-errand chase comedy: a small domestic stake (mother-in-law's approval) triggers a full-speed sprint through the real community, chaos in his wake, ending in product rescue and a warm family payoff.",
    bestFor: "consumer food/household products, comedy, community showcase, single locked hero character",
  },
  {
    id: "always-late",
    file: "films/film-02-always-late.md",
    title: "The Boy Who Was Always Late (Sidrah Salaam)",
    offering: "product",
    register: "warm, funny, heartwarming character comedy with a running gag",
    pattern:
      "Running-gag kindness story: a likeable character keeps just missing the thing everyone loves (proof of demand), receives an act of kindness, discovers the product secret, and is visibly transformed.",
    bestFor: "food/nutrition products, child or youth protagonist, kindness angle, product-as-secret reveal",
  },
  {
    id: "from-our-soil",
    file: "films/film-03-from-our-soil.md",
    title: "From Our Soil (Sidrah Salaam — process film)",
    offering: "product",
    register: "documentary-honest process; premium product graphics; national pride",
    pattern:
      "Origin/process pride story: from the soil, by our hands — honest working scenes plus gradual product-transformation graphics, landing on 'ours, pure, local'.",
    bestFor: "locally made products, agriculture, purity/quality claims, national pride, B2C trust building",
  },
  {
    id: "nyima",
    file: "films/film-04-nyima.md",
    title: "Nyima (CONNEKT — talent marketplace)",
    offering: "service",
    register: "high-end documentary realism, first-person VO, zero drama",
    pattern:
      "First-person underdog journey: real, unglamorous struggle rendered as captured moments, the service arrives as the single turn that makes the impossible normal.",
    bestFor: "services/platforms/apps, emotional long-form, personal testimony, aspiration without melodrama",
  },
  {
    id: "right-people",
    file: "films/film-05-right-people.md",
    title: "The Right People (CONNEKT — employer side)",
    offering: "service",
    register: "cinematic documentary, warm authority narrator, B2B montage",
    pattern:
      "No-hero problem montage: many different subjects each carry one felt gap (this is everyone), the service does the heavy lifting via motion graphics, landing on the institutions that matter most.",
    bestFor: "B2B services, marketplaces, tools; when no recurring character is wanted; sector breadth",
  },
  {
    id: "in-control",
    file: "films/film-06-in-control.md",
    title: "In Control (SWIPE — fintech)",
    offering: "service",
    register: "cinematic documentary + premium UI/product graphics",
    pattern:
      "Chaos-to-clarity tool story: the mess of doing it by hand (the mess IS the shot), then the product bringing visible order, proof beats for each capability, effortlessness as the closing message.",
    bestFor: "fintech/SaaS/apps, dashboards and UI, small-business owners, capability-proof structure",
  },
];

function storyLibraryIndexText() {
  return STORY_LIBRARY.map(
    (f) =>
      `- id: "${f.id}" — ${f.title}\n  offering: ${f.offering} · register: ${f.register}\n  pattern: ${f.pattern}\n  best for: ${f.bestFor}`
  ).join("\n");
}

function referenceFilmBriefs(ids) {
  const chosen = STORY_LIBRARY.filter((f) => (ids || []).includes(f.id));
  // Never dump more than two films into a context window.
  return chosen
    .slice(0, 2)
    .map((f) => loadDoc(f.file))
    .join("\n\n---\n\n");
}

// ─── PER-SKILL KNOWLEDGE ROUTING ────────────────────────────────────────────
// Which doctrine modules each skill loads. Keep every skill's context lean:
// only what that specialist needs to do its one job well.
const SKILL_KNOWLEDGE = {
  "brief-analyst": ["01-doctrine.md"],
  "storyline": ["01-doctrine.md", "06-cut-logic.md"],
  // 12 rides with 03 everywhere 03 goes: 03's worked examples are exactly what
  // makes every film cast the same person, and 12 is the counterweight.
  // 13 rides with 05 the way 12 rides with 03: 05's sound craft still teaches the
  // music-consistency rule, and 13 is what reverses it.
  // 14 rides with 03 for the same reason 12 does: it reverses part of it. 03
  // still teaches "images are for products only", and 14 is what changed.
  "casting-registry": [
    "03-character-consistency.md",
    "12-casting-variety.md",
    "14-character-references.md",
    "04-environment-engine.md",
    "05-craft-modules.md",
    "13-sound-policy.md",
  ],
  "scene-builder": [
    "02-prompt-architecture.md",
    "04-environment-engine.md",
    "05-craft-modules.md",
    "08-brand-product-text.md",
    "09-safety.md",
    "12-casting-variety.md",
    "13-sound-policy.md",
    "14-character-references.md",
  ],
  "scene-verifier": [
    "01-doctrine.md",
    "09-safety.md",
    "10-failure-catalog.md",
    "12-casting-variety.md",
    "13-sound-policy.md",
  ],
  "scene-reviser": [
    "02-prompt-architecture.md",
    "05-craft-modules.md",
    "10-failure-catalog.md",
    "13-sound-policy.md",
  ],
};

function knowledgeFor(skillName) {
  const files = SKILL_KNOWLEDGE[skillName] || [];
  return files.map((f) => loadDoc(f)).join("\n\n---\n\n");
}

// ─── DOCTRINE MODULES, BY NAME ──────────────────────────────────────────────
// The storyline agent (see ./agent.js) reads doctrine on demand rather than
// carrying the whole manual in its system prompt — the user can ask "why does
// every prompt have to say Black?" and the agent quotes the actual module.
const DOCTRINE_MODULES = {
  doctrine: { file: "01-doctrine.md", title: "The doctrine — moments not mood, the seven laws, banned vocabulary" },
  "prompt-architecture": { file: "02-prompt-architecture.md", title: "The canonical 14-block prompt order and the length doctrine" },
  "character-consistency": { file: "03-character-consistency.md", title: "Locked Character Blocks, wardrobe locks, how a face survives nine clips" },
  "environment-engine": { file: "04-environment-engine.md", title: "The specificity ladder — how a place stops being generic Africa" },
  "craft-modules": { file: "05-craft-modules.md", title: "Camera, lighting, colour and sound craft" },
  "cut-logic": { file: "06-cut-logic.md", title: "When a 10s scene is one shot and when it carries hard cuts" },
  "voice-dialogue": { file: "07-voice-dialogue.md", title: "Dialogue, language tags and voiceover" },
  "brand-product-text": { file: "08-brand-product-text.md", title: "Product anchors, packaging, on-screen text and logos" },
  safety: { file: "09-safety.md", title: "Safety — minors, classifiers, prohibited framings" },
  "failure-catalog": { file: "10-failure-catalog.md", title: "Known generation failures and their structural fixes" },
  "agent-procedure": { file: "11-agent-procedure.md", title: "How the swarm works end to end" },
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
    title: "Character reference images — consistency by picture as well as paragraph, and why it reverses §3.8",
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
  STORY_LIBRARY,
  storyLibraryIndexText,
  referenceFilmBriefs,
  knowledgeFor,
  DOCTRINE_MODULES,
  doctrineIndexText,
  doctrineModule,
  exemplarScenePrompt,
  countWords,
};
