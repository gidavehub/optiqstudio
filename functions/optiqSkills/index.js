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
  "casting-registry": ["03-character-consistency.md", "04-environment-engine.md", "05-craft-modules.md"],
  "scene-builder": [
    "02-prompt-architecture.md",
    "04-environment-engine.md",
    "05-craft-modules.md",
    "08-brand-product-text.md",
    "09-safety.md",
  ],
  "scene-verifier": ["01-doctrine.md", "09-safety.md", "10-failure-catalog.md"],
  "scene-reviser": ["02-prompt-architecture.md", "05-craft-modules.md", "10-failure-catalog.md"],
};

function knowledgeFor(skillName) {
  const files = SKILL_KNOWLEDGE[skillName] || [];
  return files.map((f) => loadDoc(f)).join("\n\n---\n\n");
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
  exemplarScenePrompt,
  countWords,
};
