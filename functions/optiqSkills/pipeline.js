// ─── OPTIQ SKILLS — THE AGENTIC STORYBOARD SWARM ────────────────────────────
// A swarm of specialist agents that talk to each other through structured
// JSON, each loaded with only the doctrine modules it needs (see ./index.js).
//
//   1. brief-analyst    — reads the brief, classifies the offering, picks the
//                         relevant reference storylines from the story library,
//                         decides the casting approach.
//   2. storyline        — THE star skill. Turns the brief into ONE story that
//                         makes the product/service the hero: arc, emotional
//                         hook, scene beats and the cuts inside every scene.
//   3. casting-registry — authors the consistency registry: Locked Character
//                         Blocks (150–200 words each), wardrobe locks, product
//                         anchors, recurring set blocks, the locked 250–300
//                         word sound spec, and the style header.
//   4. scene-builder ×N — builds every scene's 1,500–2,000 word copy-ready
//                         prompt in parallel, embedding the registry verbatim.
//   5. quality gates    — JS-enforced checks (word count, verbatim locks,
//                         sound spec presence); failing scenes go through one
//                         scene-verifier repair pass.

const {
  WORD_BUDGETS,
  storyLibraryIndexText,
  referenceFilmBriefs,
  knowledgeFor,
  exemplarScenePrompt,
  countWords,
} = require("./index");

const OPTIQ_TEXT_MODEL = "gemini-3.5-flash";

const MANDATORY_PROMPT_RULES = `NON-NEGOTIABLE PROMPT RULES (every single scene's fullPrompt MUST satisfy ALL of these — no exceptions):
1. LENGTH — every scene's fullPrompt is ${WORD_BUDGETS.scenePromptMin}–${WORD_BUDGETS.scenePromptMax} words. Every single thing visible in the frame is described. Density of authored specifics, not padding.
2. GAMBIAN ENVIRONMENT — the word "Gambian" and specific Gambian setting details (via the specificity ladder, Rung 4 minimum) appear explicitly in every prompt. The scene is unmistakably The Gambia, West Africa, unless the user's brief explicitly sets it elsewhere.
3. BLACK PEOPLE — every single on-screen person is explicitly described with the keyword "Black" — a Black Gambian / Black West African person with rich, deep dark skin tone. Never leave skin tone implicit and never rely on "dark-skinned" alone; models have rendered under-described people as other ethnicities. State it plainly for the lead AND every background person.
4. CHARACTER CONSISTENCY — each Locked Character Block (${WORD_BUDGETS.perCharacterMin}–${WORD_BUDGETS.perCharacterMax} words per character: skin, face shape, nose, lips, cheekbones, eyes, brows, hair, age, height, build) appears VERBATIM, word-for-word identical, in every scene prompt featuring that character. Two characters = ~300–400 words of character blocks.
5. PRODUCT CONSISTENCY — the product/brand item keeps the exact same anchor description verbatim in every scene where it appears. If reference product images are attached, the prompt must state the product must match the attached reference image exactly and take ONLY the product design, never the image's background.
6. SCENE-ELEMENT CONSISTENCY — recurring physical elements and recurring sets keep an identical anchor description in every scene they appear in. An object never changes appearance between scenes.
7. SOUND CONSISTENCY — the locked sound spec (${WORD_BUDGETS.soundMin}–${WORD_BUDGETS.soundMax} words describing the exact background music — instruments, tempo, mood, progression — or the exact silence; NOT incidental birds/wind padding) is repeated VERBATIM in the sound block of every continuous scene, plus that scene's diegetic event sounds. Continuous scenes must sound like one unbroken track.
8. BACKGROUND AUTHORSHIP — the environment plus every visible item and every background person (age, clothing, position, what they are doing) gets ${WORD_BUDGETS.backgroundMin}–${WORD_BUDGETS.backgroundMax} words. Every unspecified element is a vote for the cliché.
9. STORY, NOT SLIDESHOW — every scene advances one storyline with a beginning, middle and end across the full ad. The product or service is the hero of the story.
10. CUTS WITHIN SCENES — scenes are not always one continuous shot. When the storyline plans cuts, the 10s scene contains those hard cuts, each with its own timestamped beat and shot description.`;

// ─── SKILL RUNNER ───────────────────────────────────────────────────────────

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// A skill call is worth retrying if it hit a Vertex capacity/timeout error OR
// if the model returned something unusable — empty output, a truncated
// (MAX_TOKENS) response, or JSON we couldn't parse. All of these are usually
// intermittent and clear on a re-roll; a single one used to surface as a hard
// 500 ("Unterminated string in JSON at position N").
function isRetryableSkillError(err) {
  const msg = String(err?.message || err);
  return /429|RESOURCE_EXHAUSTED|503|UNAVAILABLE|overloaded|deadline|invalid JSON|unterminated|unexpected (end|token)|returned empty|MAX_TOKENS|finishReason/i.test(
    msg
  );
}

function makeSkillRunner(vertexFetch) {
  return async function runOptiqSkill(skillName, systemPrompt, userParts, responseSchema) {
    const generationConfig = { temperature: 0.75, maxOutputTokens: 32768 };
    if (responseSchema) {
      generationConfig.responseMimeType = "application/json";
      generationConfig.responseSchema = responseSchema;
    }
    const backoffs = [4000, 10000, 22000, 45000];
    for (let attempt = 0; ; attempt++) {
      try {
        const response = await vertexFetch(
          `/publishers/google/models/${OPTIQ_TEXT_MODEL}:generateContent`,
          {
            contents: [{ role: "user", parts: userParts }],
            systemInstruction: { parts: [{ text: systemPrompt }] },
            generationConfig,
          }
        );
        const candidate = (response.candidates || [])[0];
        const finishReason = candidate?.finishReason;
        const text = candidate?.content?.parts?.map((p) => p.text || "").join("") || "";
        if (!text) {
          const block = response.promptFeedback?.blockReason;
          throw new Error(
            `Optiq skill "${skillName}" returned empty output (finishReason=${finishReason || "none"}${block ? `, blockReason=${block}` : ""})`
          );
        }
        if (!responseSchema) return text.trim();
        try {
          return JSON.parse(text);
        } catch (parseErr) {
          // Truncated or malformed JSON — usually finishReason MAX_TOKENS.
          throw new Error(
            `Optiq skill "${skillName}" returned invalid JSON (finishReason=${finishReason || "none"}): ${parseErr.message}`
          );
        }
      } catch (err) {
        if (attempt < backoffs.length && isRetryableSkillError(err)) {
          const wait = backoffs[attempt] + Math.floor(Math.random() * 2000);
          console.warn(
            `Optiq skill "${skillName}" failed (attempt ${attempt + 1}); retrying in ${wait}ms:`,
            String(err.message || err).slice(0, 200)
          );
          await sleep(wait);
          continue;
        }
        throw err;
      }
    }
  };
}

// Runs async jobs with bounded concurrency so parallel scene builds don't
// trip Vertex QPM limits. Preserves input order in the results.
async function mapWithConcurrency(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return results;
}

// Converts wizard brand materials (data URLs) into Gemini inlineData parts so
// the skills can actually SEE the product/brand imagery they must keep
// consistent. Non-image materials are skipped.
function materialImageParts(materials) {
  const parts = [];
  for (const mat of (materials || []).slice(0, 6)) {
    const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/.exec(mat?.data || "");
    if (match) {
      parts.push({ inlineData: { mimeType: match[1], data: match[2] } });
    }
  }
  return parts;
}

// Whitespace-insensitive containment check for verbatim-lock gates.
function normalize(text) {
  return String(text || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}
function containsVerbatim(haystack, needle) {
  const h = normalize(haystack);
  const n = normalize(needle);
  if (!n) return true;
  return h.includes(n);
}

// ─── RESPONSE SCHEMAS ───────────────────────────────────────────────────────

const BRIEF_SCHEMA = {
  type: "OBJECT",
  properties: {
    offeringType: { type: "STRING", enum: ["product", "service"] },
    offeringSummary: { type: "STRING" },
    targetAudience: { type: "STRING" },
    theOneThing: { type: "STRING" },
    toneRegister: { type: "STRING" },
    language: { type: "STRING" },
    useRecurringLead: { type: "BOOLEAN" },
    castingRationale: { type: "STRING" },
    referenceFilmIds: { type: "ARRAY", items: { type: "STRING" } },
  },
  required: [
    "offeringType", "offeringSummary", "targetAudience", "theOneThing",
    "toneRegister", "language", "useRecurringLead", "castingRationale", "referenceFilmIds",
  ],
};

const STORYLINE_SCHEMA = {
  type: "OBJECT",
  properties: {
    title: { type: "STRING" },
    concept: { type: "STRING" },
    storyPitch: { type: "STRING" },
    emotionalHook: { type: "STRING" },
    storyArc: { type: "STRING" },
    sceneBeats: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          sceneNumber: { type: "INTEGER" },
          purpose: { type: "STRING" },
          moment: { type: "STRING" },
          location: { type: "STRING" },
          charactersPresent: { type: "ARRAY", items: { type: "STRING" } },
          productPresent: { type: "BOOLEAN" },
          cuts: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              properties: { time: { type: "STRING" }, shot: { type: "STRING" } },
              required: ["time", "shot"],
            },
          },
        },
        required: ["sceneNumber", "purpose", "moment", "location", "charactersPresent", "productPresent", "cuts"],
      },
    },
  },
  required: ["title", "concept", "storyPitch", "emotionalHook", "storyArc", "sceneBeats"],
};

const REGISTRY_SCHEMA = {
  type: "OBJECT",
  properties: {
    characters: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          name: { type: "STRING" },
          role: { type: "STRING" },
          lcb: { type: "STRING" },
          wardrobe: { type: "STRING" },
          scenes: { type: "ARRAY", items: { type: "INTEGER" } },
        },
        required: ["name", "role", "lcb", "wardrobe", "scenes"],
      },
    },
    products: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          name: { type: "STRING" },
          anchor: { type: "STRING" },
          scenes: { type: "ARRAY", items: { type: "INTEGER" } },
        },
        required: ["name", "anchor", "scenes"],
      },
    },
    elements: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          name: { type: "STRING" },
          anchor: { type: "STRING" },
          scenes: { type: "ARRAY", items: { type: "INTEGER" } },
        },
        required: ["name", "anchor", "scenes"],
      },
    },
    recurringSets: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          name: { type: "STRING" },
          anchor: { type: "STRING" },
          scenes: { type: "ARRAY", items: { type: "INTEGER" } },
        },
        required: ["name", "anchor", "scenes"],
      },
    },
    soundSpec: { type: "STRING" },
    ambienceSpec: { type: "STRING" },
    styleHeader: { type: "STRING" },
  },
  required: ["characters", "products", "elements", "recurringSets", "soundSpec", "ambienceSpec", "styleHeader"],
};

const SCENE_SCHEMA = {
  type: "OBJECT",
  properties: {
    sceneNumber: { type: "INTEGER" },
    setting: { type: "STRING" },
    action: { type: "STRING" },
    dialogue: { type: "STRING" },
    sound: { type: "STRING" },
    fullPrompt: { type: "STRING" },
  },
  required: ["sceneNumber", "setting", "action", "dialogue", "sound", "fullPrompt"],
};

// ─── THE PIPELINE ───────────────────────────────────────────────────────────

async function runOptiqSkillsPipeline({
  vertexFetch,
  prompt,
  length,
  brandName,
  product,
  characterName,
  characterDesc,
  logo,
  materials,
  aspectRatio,
  onStage,
}) {
  const runOptiqSkill = makeSkillRunner(vertexFetch);
  const numScenes = length === "90s" ? 9 : length === "30s" ? 3 : 6;
  // Progress reporter — lets the cloud job stream the current stage to Firestore
  // so a reopened tab shows exactly where generation is. No-op when unset.
  const reportStage = async (stage, meta) => {
    if (!onStage) return;
    try {
      await onStage(stage, meta);
    } catch (err) {
      console.warn("onStage reporter failed (non-fatal):", String(err?.message || err).slice(0, 120));
    }
  };

  await reportStage("analyzing");

  const imageParts = materialImageParts(materials || (logo ? [{ data: logo }] : []));
  const attachedImagesNote =
    imageParts.length > 0
      ? `${imageParts.length} brand/product reference image(s) are attached to this brief. Study them closely — the product, logo, colors and packaging in every scene must match them exactly (product design ONLY; never carry over an image's background).`
      : "No brand reference images attached.";

  const briefText = `User request / director's vision: ${prompt}

Brand Info:
- Brand Name: ${brandName || "Client"}
- Main Product/Service: ${product || "Client offering"}
- Ad run-time: ${length} → exactly ${numScenes} scenes of 10 seconds each
- Aspect ratio: ${aspectRatio || "16:9"}
- ${attachedImagesNote}${
    characterName || characterDesc
      ? `\n- Optional user casting hint (may be empty; the swarm makes the final casting call): ${characterName || ""} ${characterDesc || ""}`
      : ""
  }`;

  // ── SKILL 1: BRIEF ANALYST ────────────────────────────────────────────────
  const brief = await runOptiqSkill(
    "brief-analyst",
    `You are the BRIEF ANALYST, the first skill in the Optiq Skills swarm — the agentic system that turns a client brief into a jaw-dropping video ad. Downstream skills (storyline, casting-registry, scene-builders) act strictly on YOUR analysis, so be precise.

Your jobs:
1. Classify the offering: product or service, and summarise what it literally is and does.
2. Identify the target audience and "the one thing" — if the viewer remembers one sentence, what is it?
3. Choose the tone register that will sell this best (comedy, heartwarming, documentary-honest, premium tech, first-person testimony...).
4. Decide the casting approach: ONE recurring locked lead carrying the whole story, or a no-hero montage of different people (correct for B2B breadth). This is YOUR call unless the user's brief clearly demands one.
5. From the STORY LIBRARY below, select the 1–2 reference storylines whose PATTERN best fits this brief. You are selecting narrative machinery to learn from, not templates to copy.
6. Choose the dialogue language (default: English dialogue; Wolof only when the brief targets a purely local mass-market audience).

STORY LIBRARY (select by id):
${storyLibraryIndexText()}

HOUSE DOCTRINE (context for your tone/casting judgement):
${knowledgeFor("brief-analyst")}`,
    [...imageParts, { text: briefText }],
    BRIEF_SCHEMA
  );

  // ── SKILL 2: STORYLINE — the star of Optiq Skills ─────────────────────────
  await reportStage("storylining");
  const selectedBriefs = referenceFilmBriefs(brief.referenceFilmIds);
  const storyline = await runOptiqSkill(
    "storyline",
    `You are STORYLINE — the most important skill in the Optiq Skills swarm, and the thing that sets this platform apart. Your only job: make the entire ad ONE story. Not a vibe, not a mood reel — a story with a beginning, a middle, and an end, where the product or service is the HERO (or the thing that makes the hero's life easier, cheaper, better, more accessible).

How you work:
1. Internally consider several candidate story ideas a real human would relate to — funny, touching, tense, proud. Pick the ONE that evokes the strongest emotion AND sells the offering in a way nobody imagined. Output only the winner.
2. Tell that story in exactly ${numScenes} scenes × 10 seconds. Decide the arc: hook/problem → escalation → the turn (the offering enters) → proof → payoff → brand.
3. Plan the CUTS inside every scene. A 10s scene is either ONE continuous locked shot (when physical continuity IS the content) or 2–4 hard cuts, each a complete moment with its own verb. In a 30s ad you can land up to ~10 cuts total — quick and fast, maybe no dialogue. Use the cut decision tree from the doctrine.
4. Every beat must be a MOMENT — a filmable physical event, verbs about hands — never an atmosphere. If a beat cannot be pointed at with a camera, replace it.
5. For each scene list: its purpose in the arc, the captured moment, the location, which named characters appear, and whether the product appears.
6. Invent the characters the story needs (names, roles) — casting per the analyst's decision below. Keep recurring locations consistent across scenes (name them identically).

THE BRIEF ANALYST'S ANALYSIS (follow its casting decision and tone):
${JSON.stringify(brief, null, 2)}

REFERENCE STORYLINES (learn the narrative machinery — the stakes, escalation and payoff mechanics. Do NOT copy their plots; write a NEW story for THIS brand):
${selectedBriefs || "(none selected)"}

HOUSE DOCTRINE:
${knowledgeFor("storyline")}`,
    [{ text: briefText }],
    STORYLINE_SCHEMA
  );

  // ── SKILL 3: CASTING & CONSISTENCY REGISTRY ───────────────────────────────
  await reportStage("casting");
  const registry = await runOptiqSkill(
    "casting-registry",
    `You are CASTING-REGISTRY, the consistency authority of the Optiq Skills swarm. You author the single source of truth that every scene-builder pastes VERBATIM. Redundancy is the mechanism: the video model has no memory, so identity lives in your words.

Author, with these EXACT word budgets:
1. CHARACTERS — for every named character in the storyline's beats: a Locked Character Block of ${WORD_BUDGETS.perCharacterMin}–${WORD_BUDGETS.perCharacterMax} words. Physical properties only: the keyword "Black" plus Gambian/West African, exact deep dark skin tone and finish, face shape, nose, lips, cheekbones, eyes, brows, hair (cut/length/texture/how worn), facial hair, age, height, build, one temperament line at the end. Plus a separate wardrobe lock (colours in CAPS, garment types named precisely, the closure stated, one constant object). Single-scene characters still get full blocks.
2. PRODUCTS — the exact product anchor (shape, label text, colors, size, wear). ${attachedImagesNote}
3. ELEMENTS — recurring story-carrying objects, with the scenes they appear in and their exact state per scene if mid-transformation.
4. RECURRING SETS — every location used by 2+ scenes gets a full locked set block (walls, floor, furniture, every visible item).
5. SOUND SPEC — ${WORD_BUDGETS.soundMin}–${WORD_BUDGETS.soundMax} words locking the ad's continuous background sound: if music, the exact instruments, tempo/BPM feel, mood, pitch, progression; if silence, the exact quality of that silence. NOT incidental birds/breeze padding. This exact text repeats verbatim in every continuous scene.
6. AMBIENCE SPEC — one line locking the ambient bed.
7. STYLE HEADER — the film's visual contract (~60–100 words): register, optics, motion policy, prohibitions (no lens-staring, no slow motion on people), language tag, text policy.

THE STORYLINE (source of truth for who/where/what):
${JSON.stringify(storyline, null, 2)}

THE BRIEF:
${JSON.stringify(brief, null, 2)}

HOUSE DOCTRINE:
${knowledgeFor("casting-registry")}`,
    [...imageParts, { text: briefText }],
    REGISTRY_SCHEMA
  );

  // ── SKILL 4: SCENE BUILDERS (parallel) ────────────────────────────────────
  const builderKnowledge = knowledgeFor("scene-builder");
  const exemplar = exemplarScenePrompt();

  const buildScene = async (beat) => {
    const neighborBefore = storyline.sceneBeats.find((b) => b.sceneNumber === beat.sceneNumber - 1);
    const neighborAfter = storyline.sceneBeats.find((b) => b.sceneNumber === beat.sceneNumber + 1);
    const relevantCharacters = registry.characters.filter(
      (c) =>
        (beat.charactersPresent || []).some((n) => normalize(n) === normalize(c.name)) ||
        (c.scenes || []).includes(beat.sceneNumber)
    );
    const charactersForScene = relevantCharacters.length > 0 ? relevantCharacters : registry.characters;

    return runOptiqSkill(
      `scene-builder-${beat.sceneNumber}`,
      `You are a SCENE BUILDER in the Optiq Skills swarm. You compile ONE scene of the film into a single, copy-ready video-generation prompt in the canonical 14-block order. The prompt is the deliverable — everything the video model needs lives INSIDE it.

${MANDATORY_PROMPT_RULES}

Scene-specific contract:
- fullPrompt is ${WORD_BUDGETS.scenePromptMin}–${WORD_BUDGETS.scenePromptMax} words. Describe every single visible thing: in a room, the walls, the marks on the walls, the floor, every item in frame; in a market, every stall and its wares.
- Paste each present character's Locked Character Block and wardrobe lock VERBATIM at the top (identity first — models weight early tokens).
- Paste the product anchor VERBATIM wherever the product appears${imageParts.length > 0 ? ", with the reference-image quarantine clause" : ""}.
- Paste the recurring set block VERBATIM if this scene uses a recurring set.
- The SOUND block starts with the locked sound spec VERBATIM, then this scene's diegetic event sounds (every physical event has a sound). Flag "voiceover separate".
- The ACTION block is timestamped beats implementing the storyline's planned cuts exactly. Physical verbs. Five verbs minimum.
- End with the CLOSING RESTATEMENT paragraph re-asserting identity, wardrobe, the key event, light, motion policy, and prohibitions.
- Also return the scene's setting/action/dialogue/sound summaries as separate short fields for the UI (the fullPrompt stays complete on its own).

GOLD-STANDARD EXEMPLAR (match this density and structure):
${exemplar}

HOUSE DOCTRINE:
${builderKnowledge}`,
      [
        ...imageParts,
        {
          text: `THE BRIEF:
${JSON.stringify(brief, null, 2)}

THE STORYLINE ARC (the film this scene belongs to):
Title: ${storyline.title}
Story arc: ${storyline.storyArc}
Emotional hook: ${storyline.emotionalHook}

THIS SCENE'S PLANNED BEAT (implement exactly):
${JSON.stringify(beat, null, 2)}

NEIGHBOUR BEATS (for seamless continuity):
Previous: ${neighborBefore ? JSON.stringify(neighborBefore) : "none — this is the opening scene"}
Next: ${neighborAfter ? JSON.stringify(neighborAfter) : "none — this is the final scene (land the brand)"}

THE CONSISTENCY REGISTRY (paste applicable locks VERBATIM):
Characters in this scene:
${JSON.stringify(charactersForScene, null, 2)}

Products: ${JSON.stringify(registry.products, null, 2)}
Elements: ${JSON.stringify(registry.elements.filter((e) => (e.scenes || []).includes(beat.sceneNumber)), null, 2)}
Recurring sets: ${JSON.stringify(registry.recurringSets.filter((s) => (s.scenes || []).includes(beat.sceneNumber)), null, 2)}
Locked sound spec (verbatim in the sound block): ${registry.soundSpec}
Ambience spec: ${registry.ambienceSpec}
Style header: ${registry.styleHeader}

Build scene ${beat.sceneNumber} of ${numScenes}.`,
        },
      ],
      SCENE_SCHEMA
    );
  };

  await reportStage("building", { scenesDone: 0, scenesTotal: numScenes });
  let scenesBuilt = 0;
  let scenes = await mapWithConcurrency(storyline.sceneBeats.slice(0, numScenes), 3, async (beat) => {
    const scene = await buildScene(beat);
    scenesBuilt += 1;
    await reportStage("building", { scenesDone: scenesBuilt, scenesTotal: numScenes });
    return scene;
  });

  // ── SKILL 5: QUALITY GATES + REPAIR ───────────────────────────────────────
  const gateViolations = (scene, beat) => {
    const violations = [];
    const wc = countWords(scene.fullPrompt);
    if (wc < WORD_BUDGETS.scenePromptHardFloor) {
      violations.push(
        `fullPrompt is ${wc} words — below the ${WORD_BUDGETS.scenePromptMin}-word floor. Expand with authored specifics (environment items, background people, event sounds), never filler.`
      );
    }
    const present = registry.characters.filter(
      (c) =>
        (beat?.charactersPresent || []).some((n) => normalize(n) === normalize(c.name)) ||
        (c.scenes || []).includes(scene.sceneNumber)
    );
    for (const c of present) {
      if (!containsVerbatim(scene.fullPrompt, c.lcb)) {
        violations.push(`The Locked Character Block for ${c.name} is missing or paraphrased. Paste it VERBATIM: "${c.lcb}"`);
      }
    }
    if (registry.soundSpec && !containsVerbatim(scene.fullPrompt, registry.soundSpec)) {
      violations.push(`The locked sound spec is missing or paraphrased in the SOUND block. Paste it VERBATIM: "${registry.soundSpec}"`);
    }
    if (!/black/i.test(scene.fullPrompt)) {
      violations.push(`The keyword "Black" never appears — every on-screen person must be explicitly described as Black Gambian / Black West African.`);
    }
    return violations;
  };

  const verifierKnowledge = knowledgeFor("scene-verifier");
  scenes = await mapWithConcurrency(scenes, 3, async (scene) => {
      const beat = storyline.sceneBeats.find((b) => b.sceneNumber === scene.sceneNumber);
      const violations = gateViolations(scene, beat);
      if (violations.length === 0) return scene;
      try {
        const repaired = await runOptiqSkill(
          `scene-verifier-${scene.sceneNumber}`,
          `You are the SCENE VERIFIER of the Optiq Skills swarm. A scene prompt failed the quality gates. Rewrite the scene to fix EVERY listed violation without weakening the writing — you repair, you never dilute. Keep the same story beat, the same cuts, the same 14-block order. Return the corrected scene in the same JSON schema.

${MANDATORY_PROMPT_RULES}

HOUSE DOCTRINE:
${verifierKnowledge}`,
          [
            {
              text: `VIOLATIONS TO FIX:
${violations.map((v, i) => `${i + 1}. ${v}`).join("\n")}

THE SCENE'S PLANNED BEAT:
${JSON.stringify(beat, null, 2)}

LOCKED SOUND SPEC: ${registry.soundSpec}
STYLE HEADER: ${registry.styleHeader}

THE SCENE TO REPAIR:
${JSON.stringify(scene, null, 2)}`,
            },
          ],
          SCENE_SCHEMA
        );
        return repaired;
      } catch (err) {
        console.error(`scene-verifier failed for scene ${scene.sceneNumber}; keeping builder output`, err);
        return scene;
      }
  });

  scenes.sort((a, b) => a.sceneNumber - b.sceneNumber);

  const lead = registry.characters[0] || { name: "", lcb: "", wardrobe: "" };
  return {
    title: storyline.title,
    concept: storyline.storyPitch || storyline.concept,
    characterLock: {
      name: lead.name || "",
      description: lead.lcb || "",
      wardrobe: lead.wardrobe || "",
    },
    styleHeader: registry.styleHeader,
    scenes,
    isStory: true,
    storyArc: storyline.storyArc,
    musicSpec: registry.soundSpec,
    ambienceSpec: registry.ambienceSpec,
  };
}

// ─── SCENE REVISION (used by storyRevise) ───────────────────────────────────

async function reviseScene({
  vertexFetch,
  scenePrompt,
  revisionRequest,
  characterLock,
  styleHeader,
  previousScenePrompt,
  nextScenePrompt,
  musicSpec,
}) {
  const runOptiqSkill = makeSkillRunner(vertexFetch);
  const systemPrompt = `You are the SCENE REVISER of the Optiq Skills swarm, revising one scene prompt of a film.
Apply the user's revision request to the original prompt while preserving everything that is locked.

You MUST:
- Keep moments, not mood. Physical verbs. Banned vocabulary stays banned.
- Keep the Locked Character Block, wardrobe lock and style header VERBATIM.
- Re-compile into the canonical 14-block order, ${WORD_BUDGETS.scenePromptMin}–${WORD_BUDGETS.scenePromptMax} words.
- CONTINUITY: the revised scene continues seamlessly from the previous scene prompt and hands off cleanly to the next — same characters, same product state, same recurring elements, same sound spec verbatim.
- When something broke in generation, reach for the STRUCTURAL fix (lock the camera, relocate, strip a face description, split cuts) before adjusting adjectives — diagnose against the failure catalog.
- Output ONLY the newly revised compiled prompt: no JSON, no preamble, no quotes.

${MANDATORY_PROMPT_RULES}

HOUSE DOCTRINE:
${knowledgeFor("scene-reviser")}`;

  const contextBlocks = [
    previousScenePrompt
      ? `Previous Scene Prompt (continue from it):\n${previousScenePrompt}`
      : null,
    nextScenePrompt ? `Next Scene Prompt (hand off to it):\n${nextScenePrompt}` : null,
    musicSpec ? `Locked Sound Spec (repeat verbatim in the sound block):\n${musicSpec}` : null,
  ]
    .filter(Boolean)
    .join("\n\n");

  return runOptiqSkill(
    "scene-reviser",
    systemPrompt,
    [
      {
        text: `Original Scene Prompt:\n${scenePrompt}\n\nRevision Request:\n${revisionRequest}\n\nCharacter Lock:\n${JSON.stringify(
          characterLock
        )}\n\nStyle Header:\n${styleHeader}${contextBlocks ? `\n\n${contextBlocks}` : ""}`,
      },
    ],
    null
  );
}

module.exports = { runOptiqSkillsPipeline, reviseScene, MANDATORY_PROMPT_RULES };
