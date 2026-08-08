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
const {
  castingDirective,
  castingViolations,
  castingShapeViolations,
  sceneCasting,
  sceneCastingDirective,
  sceneCastingViolations,
  freshFaceDirective,
  charactersForBeat,
  recurringCharacterNames,
} = require("./casting");
const {
  conceptDirective,
  densityLaw,
  storylineDensityViolations,
  scenePromptDensityViolations,
  MIN_BEATS_PER_SCENE,
  TARGET_BEATS_PER_SCENE,
} = require("./creative");
const {
  planCharacterRefs,
  characterRefPrompt,
  refsForScene,
  refClause,
  placeMaterials,
} = require("./characterRefs");
const {
  noMusicMandate,
  NO_MUSIC_RESTATEMENT,
  silenceSpecDirective,
  sceneSoundViolations,
  registrySoundViolations,
} = require("./soundPolicy");

const OPTIQ_TEXT_MODEL = "gemini-3.5-flash";

const MANDATORY_PROMPT_RULES = `NON-NEGOTIABLE PROMPT RULES (every single scene's fullPrompt MUST satisfy ALL of these — no exceptions):
1. LENGTH — every scene's fullPrompt is ${WORD_BUDGETS.scenePromptMin}–${WORD_BUDGETS.scenePromptMax} words. Every single thing visible in the frame is described. Density of authored specifics, not padding.
2. GAMBIAN ENVIRONMENT — the word "Gambian" and specific Gambian setting details (via the specificity ladder, Rung 4 minimum) appear explicitly in every prompt. The scene is unmistakably The Gambia, West Africa, unless the user's brief explicitly sets it elsewhere.
3. BLACK PEOPLE — every single on-screen person is explicitly described with the keyword "Black" — a Black Gambian / Black West African person. Never leave skin tone implicit and never rely on "dark-skinned" alone; models have rendered under-described people as other ethnicities. State it plainly for the lead AND every background person. Each person's SPECIFIC complexion is then named exactly as the casting registry assigned it — anywhere along the real Black Gambian range, from very deep blue-black through dark brown and golden brown to light caramel-brown. Do NOT flatten everyone to "rich, deep dark skin": that instruction used to live here and it produced films that all starred the same person.
4. CHARACTER CONSISTENCY — each Locked Character Block (${WORD_BUDGETS.perCharacterMin}–${WORD_BUDGETS.perCharacterMax} words per character: skin, face shape, nose, lips, cheekbones, eyes, brows, hair, age, height, build, one distinguishing marker) appears VERBATIM, word-for-word identical, in every scene prompt featuring that character. Two characters = ~300–400 words of character blocks.
4b. CASTING VARIETY — no two people in the same film share a complexion, a hairstyle or a build, and the cast is spread across ages rather than clustered on one. The doctrine's worked examples ("box braids", "deep warm dark-brown skin", "soft oval face", the rust camp-collar shirt) teach you the FORMAT of a character block and must never be reproduced as this film's cast. Background crowds get the same spread — a crowd of one identical face and tone is the cliché rule 8 forbids.
5. PRODUCT CONSISTENCY — the product/brand item keeps the exact same anchor description verbatim in every scene where it appears. If reference product images are attached, the prompt must state the product must match the attached reference image exactly and take ONLY the product design, never the image's background.
6. SCENE-ELEMENT CONSISTENCY — recurring physical elements and recurring sets keep an identical anchor description in every scene they appear in. An object never changes appearance between scenes.
7. SOUND CONSISTENCY — the locked sound spec (${WORD_BUDGETS.soundMin}–${WORD_BUDGETS.soundMax} words locking the film's UNSCORED sound bed: the explicit absence of music, the quality of that silence, and the exact continuous ambience; NOT incidental birds/wind padding, and NEVER instruments/tempo/BPM/musical progression) is repeated VERBATIM in the sound block of every continuous scene, plus that scene's diegetic event sounds. Continuous scenes must sound like one unbroken recording.
8. BACKGROUND AUTHORSHIP — the environment plus every visible item and every background person (age, clothing, position, what they are doing) gets ${WORD_BUDGETS.backgroundMin}–${WORD_BUDGETS.backgroundMax} words. Every unspecified element is a vote for the cliché.
9. STORY, NOT SLIDESHOW — every scene advances one storyline with a beginning, middle and end across the full ad. The product or service is the hero of the story.
10. CUTS WITHIN SCENES — scenes are not always one continuous shot. When the storyline plans cuts, the 10s scene contains those hard cuts, each with its own timestamped beat and shot description.
10b. DENSITY — every 10-second scene carries at least ${MIN_BEATS_PER_SCENE} distinct beats (aim for ${TARGET_BEATS_PER_SCENE}), each a CHANGE OF STATE with its own timestamp and its own physical verb. Ten seconds of one continuous activity — carrying a cup across a room, stirring a pot, scrolling a phone — is the dead footage this whole system exists to prevent. A camera move is not a beat. A mood is not a beat. Somebody continuing to do what they were already doing is not a beat.
11. NO MUSIC — the video model generates NO music, ever, in any video type. No soundtrack, no melody, no instrumental bed, no humming or singing, no music from a radio/phone/speaker inside the scene, no sting on a cut, no swell under a line. The clip carries ONLY the diegetic sound of the physical events in frame plus the location's ambience (and dialogue where the scene has dialogue). The score is composed separately afterwards by a dedicated music model and laid under the finished cut — music invented here cannot be removed from the clip's audio, collides with that score, and wastes the render. This rule is stated in the ABSOLUTE RULES, restated at the top of the SOUND block, and restated again in the CLOSING RESTATEMENT: one mention does not survive a 2,000-word prompt.`;

// ─── THE THREE KINDS OF FILM ─────────────────────────────────────────────────
// Server-side mirror of VIDEO_TYPES in app/dashboard/_flow/types.ts. Only what
// the swarm needs: what the footage is called, whether it carries speech, and
// how the narration arrives.
//
// The no-music law is identical in all three — see ./soundPolicy.js. What differs
// is only where the VOICE comes from.

const SCENE_SECONDS = 10;

const FILM_KINDS = {
  "short-film": {
    id: "short-film",
    noun: "short film",
    // A short film is not an ad and must not be written like one. Without this
    // the storyline skill produces a 3-minute commercial.
    register:
      "This is a SHORT FILM, not a commercial. It is a story told for its own sake: real characters, real stakes, a beginning, a middle and an end. The brand or product belongs in it the way a product belongs in any film — present, meaningful, never announced. There is no pitch, no tagline read aloud, no call to action, and no brand card unless the story genuinely earns one.",
    dialogueInVideo: true,
    ttsVoiceover: false,
  },
  "dialogue-ad": {
    id: "dialogue-ad",
    noun: "ad",
    register:
      "This is an AD with dialogue. The characters speak on camera and sell the offering in their own words — never in advertising copy. The product or service is the hero of the story.",
    dialogueInVideo: true,
    ttsVoiceover: false,
  },
  "voiceover-ad": {
    id: "voiceover-ad",
    noun: "narrated ad",
    register:
      "This is a NARRATED AD. Nobody speaks on camera at all: the footage is silent and illustrative, carried entirely by what we SEE people doing. A voiceover is recorded separately afterwards and laid over the cut, so the pictures must tell the whole story on their own — every beat must read without a single word of explanation. The product or service is the hero.",
    dialogueInVideo: false,
    ttsVoiceover: true,
  },
};

// The fallback for an unset or unrecognised stored value — NOT the wizard's
// default, which is the narrated ad. Do not "fix" this to match it: every film
// made before types existed carries dialogue in its footage, and resolving those
// to the narrated kind would mute the performances in audio post. Mirrors
// LEGACY_VIDEO_TYPE in app/dashboard/_flow/types.ts.
const DEFAULT_FILM_KIND = "dialogue-ad";

function filmKind(id) {
  return FILM_KINDS[id] || FILM_KINDS[DEFAULT_FILM_KIND];
}

/** "180s" → 18 scenes. The one place the scene count is decided. */
function scenesForLength(length) {
  const seconds = Number(String(length ?? "").replace(/[^0-9.]/g, "")) || 60;
  return Math.max(1, Math.round(seconds / SCENE_SECONDS));
}

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
    castingShape: { type: "STRING", enum: ["single-lead", "ensemble", "no-hero-montage"] },
    castingRationale: { type: "STRING" },
    referenceFilmIds: { type: "ARRAY", items: { type: "STRING" } },
  },
  required: [
    "offeringType", "offeringSummary", "targetAudience", "theOneThing",
    "toneRegister", "language", "castingShape", "castingRationale", "referenceFilmIds",
  ],
};

// The concept room's output. `concepts` is plural and required because the whole
// point is divergence: a model asked to "consider several and return the winner"
// returns its first idea and calls it the winner. Making it show the losers is
// what forces the others to exist.
const CONCEPT_SCHEMA = {
  type: "OBJECT",
  properties: {
    concepts: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          title: { type: "STRING" },
          logline: { type: "STRING" },
          engine: { type: "STRING" },
          openingImage: { type: "STRING" },
          eventDensity: { type: "ARRAY", items: { type: "STRING" } },
          whereTheOfferingLands: { type: "STRING" },
          risk: { type: "STRING" },
        },
        required: [
          "title", "logline", "engine", "openingImage",
          "eventDensity", "whereTheOfferingLands", "risk",
        ],
      },
    },
    pick: { type: "STRING" },
    pickRationale: { type: "STRING" },
  },
  required: ["concepts", "pick", "pickRationale"],
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
          /** Who this scene needs — see sceneCastingDirective() in ./casting.js. */
          castingMode: { type: "STRING", enum: ["recurring", "fresh-faces", "no-people"] },
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
        required: [
          "sceneNumber", "purpose", "moment", "location", "castingMode",
          "charactersPresent", "productPresent", "cuts",
        ],
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

const MATERIAL_SCHEMA = {
  type: "OBJECT",
  properties: {
    materials: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          index: { type: "INTEGER" },
          kind: { type: "STRING", enum: ["product", "logo", "packaging", "place", "person", "other"] },
          describes: { type: "STRING" },
          scenes: { type: "ARRAY", items: { type: "INTEGER" } },
          reasoning: { type: "STRING" },
        },
        required: ["index", "kind", "describes", "scenes", "reasoning"],
      },
    },
  },
  required: ["materials"],
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
  /** Stable per film (the project id) so a retried generation re-casts the same
   * people rather than silently swapping the face mid-way. */
  castingSeed,
  /** "short-film" | "dialogue-ad" | "voiceover-ad". Absent on films made before
   * types existed, which were all dialogue ads. */
  videoType,
  /**
   * async (prompt) => { base64, mimeType } — renders one character reference
   * sheet. Injected because it spends image quota and because `functions/index.js`
   * owns every Vertex media call. Omit it and the swarm falls back to
   * text-only consistency, which is what it did before references existed.
   */
  generateImage,
  /**
   * async (id, base64, mimeType) => { path, url } — persists a reference sheet.
   * Required alongside generateImage.
   */
  storeImage,
}) {
  const runOptiqSkill = makeSkillRunner(vertexFetch);
  const kind = filmKind(videoType);
  // Derived from the run-time, not tabulated. The old
  // `length === "90s" ? 9 : length === "30s" ? 3 : 6` silently capped every
  // film at nine scenes the moment run-times past 90s existed.
  const numScenes = scenesForLength(length);
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

WHAT KIND OF FILM THIS IS: ${kind.noun.toUpperCase()}
${kind.register}
${
    kind.dialogueInVideo
      ? "The characters SPEAK on camera; write their dialogue."
      : "NOBODY SPEAKS ON CAMERA. Write no dialogue at all — the dialogue field of every scene must be empty. The story is carried entirely by what we see, and a voiceover is added separately afterwards."
  }

Brand Info:
- Brand Name: ${brandName || "Client"}
- Main Product/Service: ${product || "Client offering"}
- Run-time: ${length} → exactly ${numScenes} scenes of ${SCENE_SECONDS} seconds each
- Aspect ratio: ${aspectRatio || "16:9"}
- ${attachedImagesNote}${
    characterName || characterDesc
      ? `\n- Optional user casting hint (may be empty; the swarm makes the final casting call): ${characterName || ""} ${characterDesc || ""}`
      : ""
  }`;

  // ── SKILL 1: BRIEF ANALYST ────────────────────────────────────────────────
  const brief = await runOptiqSkill(
    "brief-analyst",
    `You are the BRIEF ANALYST, the first skill in the Optiq Skills swarm — the agentic system that turns a client brief into a jaw-dropping ${kind.noun}. Downstream skills (storyline, casting-registry, scene-builders) act strictly on YOUR analysis, so be precise.

WHAT YOU ARE ANALYSING FOR: ${kind.register}

Your jobs:
1. Classify the offering: product or service, and summarise what it literally is and does.
2. Identify the target audience and "the one thing" — if the viewer remembers one sentence, what is it?
3. Choose the tone register that will sell this best (comedy, heartwarming, documentary-honest, premium tech, first-person testimony...).
4. Decide the CASTING SHAPE. Three options, and they are genuinely equal — there is no default:
   • "single-lead" — one recurring locked character carries the whole story. Right when the film IS one person's experience: a testimony, a journey, one person's problem being solved.
   • "ensemble" — two to four recurring characters who all matter, in relationship with each other. Right for anything about a family, a household, a workplace, a transaction, a rivalry, a friendship, or a service that connects people to each other. This is the shape most human stories actually have.
   • "no-hero-montage" — many different people, each carrying one beat, nobody recurring. Right when the point is BREADTH or UNIVERSALITY: this happens to everyone, this works for every kind of business, look how many people this touches.
   READ THIS CAREFULLY, IT IS A KNOWN FAILURE: this platform has been choosing "single-lead" almost every time, and it made every film look like the same film. A single lead is the right answer ROUGHLY A THIRD of the time, not by default. Before you choose it, say to yourself what the OTHER two would look like for this brief. If the story involves more than one person talking to, buying from, cooking for, working with, or caring about another person, it is an ensemble — not a lead with extras. If the selling point is "everyone" or "any business", it is a montage. Only pick "single-lead" when the film genuinely collapses without that one person at its centre.
   Put your actual reasoning in castingRationale, naming which shape you rejected and why.
5. From the STORY LIBRARY below, select the 1–2 reference storylines whose PATTERN best fits this brief. You are selecting narrative machinery to learn from, not templates to copy.
6. ${
      kind.dialogueInVideo
        ? "Choose the dialogue language (default: English dialogue; Wolof only when the brief targets a purely local mass-market audience)."
        : "Choose the language the separately-recorded VOICEOVER will be in (default: English; Wolof only when the brief targets a purely local mass-market audience). There is no on-camera dialogue in this film."
    }

STORY LIBRARY (select by id):
${storyLibraryIndexText()}

HOUSE DOCTRINE (context for your tone/casting judgement):
${knowledgeFor("brief-analyst")}`,
    [...imageParts, { text: briefText }],
    BRIEF_SCHEMA
  );

  // ── SKILL 1b: THE CONCEPT ROOM ────────────────────────────────────────────
  //
  // The step that stops the film being a description of the product. Storyline
  // used to be asked to "internally consider several candidates and output the
  // winner", which a model does not do — it writes its first idea and labels it
  // the winner, and the first idea for any brief is the literal one.
  //
  // So the candidates are made to EXIST, in the open, with their losers attached.
  // Best-effort: a failure here costs the film its brainstorm, not its
  // generation, and the storyline skill still has the analysis and the density
  // law. See ./creative.js for why the provocation is drawn rather than stated.
  await reportStage("storylining");
  const creativeBrief = conceptDirective(castingSeed, { kind, numScenes });
  let conceptRoom = null;
  try {
    conceptRoom = await runOptiqSkill(
      "concept-room",
      `${creativeBrief}

${densityLaw({ kind, numScenes })}

THE BRIEF ANALYST'S READING OF THIS CLIENT:
${JSON.stringify(brief, null, 2)}

HOUSE DOCTRINE — §1.1 (moments not mood) and §1.3 (the banned vocabulary) are the
standard your concepts are judged against:
${knowledgeFor("brief-analyst")}`,
      [...imageParts, { text: briefText }],
      CONCEPT_SCHEMA
    );
    console.log(
      `[concept room] ${(conceptRoom.concepts || []).length} concept(s), picked "${conceptRoom.pick}": ` +
        (conceptRoom.concepts || []).map((c) => c.title).join(" · ")
    );
  } catch (err) {
    console.error(
      "concept-room failed; the storyline skill writes unprompted:",
      String(err?.message || err).slice(0, 200)
    );
  }

  const winner =
    (conceptRoom?.concepts || []).find(
      (c) => normalize(c.title) === normalize(conceptRoom?.pick)
    ) || (conceptRoom?.concepts || [])[0] || null;
  const rejected = (conceptRoom?.concepts || []).filter((c) => c !== winner);

  const conceptSection = winner
    ? `═══ THE CONCEPT YOU ARE WRITING (from the concept room — build THIS) ═══
Title: ${winner.title}
Logline: ${winner.logline}
The engine (what keeps generating events): ${winner.engine}
The first frame: ${winner.openingImage}
Where the offering lands: ${winner.whereTheOfferingLands}
The room's own worry about it: ${winner.risk}
Why this one was picked over the others: ${conceptRoom?.pickRationale || "(not given)"}

Events this concept promised to deliver — the film must contain all of them, and
they are a floor, not a plan:
${(winner.eventDensity || []).map((e) => `  • ${e}`).join("\n")}

CONCEPTS THE ROOM REJECTED. They are here so you do not drift back into them
halfway through — if your storyline starts resembling one of these, you have
abandoned the idea you were given:
${rejected.map((c) => `  ✗ ${c.title} — ${c.logline}`).join("\n") || "  (none)"}`
    : "";

  // ── SKILL 2: STORYLINE — the star of Optiq Skills ─────────────────────────
  const selectedBriefs = referenceFilmBriefs(brief.referenceFilmIds);
  // Reassigned by the story doctor below when the density gate finds faults.
  let storyline = await runOptiqSkill(
    "storyline",
    `You are STORYLINE — the most important skill in the Optiq Skills swarm, and the thing that sets this platform apart. Your only job: make the entire ${kind.noun} ONE story. Not a vibe, not a mood reel — a story with a beginning, a middle, and an end.

WHAT KIND OF FILM THIS IS: ${kind.register}

How you work:
1. ${
      winner
        ? `The concept room has already done the ideation and handed you a winner — build THAT film. Do not re-pitch it, do not soften it, and do not quietly revert to the obvious version of this brief on your way to scene 3. Your job is execution: turn a one-line concept into ${numScenes} scenes that deliver every event it promised.`
        : `Consider several candidate story ideas a real human would relate to — funny, touching, tense, proud — and reject the literal one first. The literal idea for any brief ("someone uses the product and is pleased") is a description of the offering with a camera pointed at it, and it produces empty film. Pick the ONE that evokes the strongest emotion${
            kind.id === "short-film"
              ? " and tells the truest story."
              : " AND sells the offering in a way nobody imagined."
          }`
    }
2. Tell that story in exactly ${numScenes} scenes × ${SCENE_SECONDS} seconds${
      numScenes >= 12
        ? ` — this is a long film, so the arc has room: give it a real second act, let scenes breathe, and do NOT pad it by repeating the same beat with different framing.`
        : `. Decide the arc: hook/problem → escalation → the turn (the offering enters) → proof → payoff → brand.`
    }
3. Plan the CUTS inside every scene, to the density law below. A ${SCENE_SECONDS}s scene is either ONE continuous locked shot (when physical continuity IS the content) or 2–4 hard cuts, each a complete moment with its own verb. In a 30s film you can land up to ~10 cuts total — quick and fast. Use the cut decision tree from the doctrine.
4. Every beat must be a MOMENT — a filmable physical event, verbs about hands — never an atmosphere. If a beat cannot be pointed at with a camera, replace it.
5. For each scene list: its purpose in the arc, the captured moment, the location, its casting mode, which named characters appear, and whether the product appears. Write the moment as the actual sequence of events, not a summary of the mood — "she takes the lid off, the steam catches her, she swears, the boy laughs and she throws the cloth at him" rather than "a warm domestic moment in the kitchen".
6. Invent the characters the story needs (names, roles) and HONOUR THE ANALYST'S CASTING SHAPE — it is not a suggestion:
   • "single-lead" — one recurring character in most scenes. Others may appear, but the film is theirs.
   • "ensemble" — two to four recurring characters who all matter. Give them their own wants and their own beats; do not quietly demote three of them to background for one hero. Scenes should put them TOGETHER, in relationship, not take turns.
   • "no-hero-montage" — a DIFFERENT person in each scene and nobody recurring. Do not sneak a lead back in by having one person bookend it. Cast those scenes "fresh-faces" and leave charactersPresent empty; they need no locks.
   The platform's known failure is collapsing everything into one hero. If the shape says ensemble or montage, a film that comes out with one dominant character is a FAILED brief, not a stylistic choice.
6b. Then decide, SCENE BY SCENE, who that scene actually needs — see the per-scene casting brief below. The film-wide shape says what the film is about; the casting mode says who is in front of the camera for these particular ten seconds, and they are not the same question.
7. ${
      kind.dialogueInVideo
        ? "Characters speak on camera. Keep dialogue short, spoken the way people actually talk, and never in advertising copy."
        : "NOBODY SPEAKS ON CAMERA. Plan no dialogue whatsoever — not a line, not a word. Every beat must be legible from the picture alone, because the only words this film gets are a voiceover recorded separately afterwards. If a beat only works when someone explains it, the beat is wrong: replace it with something we can SEE."
    }

${conceptSection}

${densityLaw({ kind, numScenes })}

${sceneCastingDirective()}

THE BRIEF ANALYST'S ANALYSIS (follow its casting decision and tone):
${JSON.stringify(brief, null, 2)}

REFERENCE STORYLINES (learn the narrative machinery — the stakes, escalation and payoff mechanics. Do NOT copy their plots; write a NEW story for THIS brand):
${selectedBriefs || "(none selected)"}

HOUSE DOCTRINE:
${knowledgeFor("storyline")}`,
    [{ text: briefText }],
    STORYLINE_SCHEMA
  );

  // ── GATE: DEAD CONTENT & DENSITY ──────────────────────────────────────────
  //
  // The cheapest place in the whole pipeline to fix a boring film. A thin beat
  // caught here is one repair call; the same thin beat caught after the scenes
  // are built is nine 2,000-word rebuilds, and caught after rendering it is the
  // director's money. Mood language is caught here too, for the same reason.
  const densityFaults = [
    ...storylineDensityViolations(storyline, { numScenes }),
    ...sceneCastingViolations(storyline.sceneBeats),
  ];
  if (densityFaults.length > 0) {
    console.warn(
      `storyline produced ${densityFaults.length} density/casting violation(s); repairing:`,
      densityFaults.map((v) => v.slice(0, 140))
    );
    try {
      const repaired = await runOptiqSkill(
        "storyline-doctor",
        `You are the STORY DOCTOR. A storyline has been written and it has failed the house
gates for density or casting. Fix EVERY violation below and change nothing else:
the concept, the title, the arc, the emotional hook and the characters all stay
exactly as they are. You are punching up scenes, not rewriting the film.

${densityLaw({ kind, numScenes })}

${sceneCastingDirective()}

Return the COMPLETE storyline in the same schema, with every scene present and in
order — not just the ones you changed.`,
        [
          {
            text: `VIOLATIONS TO FIX:
${densityFaults.map((v, i) => `${i + 1}. ${v}`).join("\n")}

THE STORYLINE TO REPAIR:
${JSON.stringify(storyline, null, 2)}`,
          },
        ],
        STORYLINE_SCHEMA
      );
      // Only adopt a repair that kept the film: a doctor that returns three of
      // nine scenes has not repaired the storyline, it has deleted it.
      if ((repaired?.sceneBeats || []).length >= (storyline.sceneBeats || []).length) {
        const remaining = [
          ...storylineDensityViolations(repaired, { numScenes }),
          ...sceneCastingViolations(repaired.sceneBeats),
        ];
        console.log(
          `[story doctor] ${densityFaults.length} → ${remaining.length} violation(s) after repair`
        );
        storyline = repaired;
      } else {
        console.warn(
          `[story doctor] returned ${(repaired?.sceneBeats || []).length} scenes for a ` +
            `${(storyline.sceneBeats || []).length}-scene film; keeping the original`
        );
      }
    } catch (err) {
      console.error("storyline-doctor failed; keeping the original storyline", err);
    }
  }

  // ── SKILL 3: CASTING & CONSISTENCY REGISTRY ───────────────────────────────
  await reportStage("casting");
  // Drawn fresh per film — this is what stops every ad starring the same person.
  // See the long note at the top of ./casting.js for why an instruction alone
  // could not fix it.
  // Only scenes cast "recurring" contribute names to the registry. A film whose
  // scenes are all fresh faces or empty frames needs no locked cast at all, and
  // authoring one for it was how those scenes ended up with the same people in
  // them anyway.
  const castNames = new Set();
  for (const beat of storyline.sceneBeats || []) {
    if (sceneCasting(beat) !== "recurring") continue;
    for (const name of beat.charactersPresent || []) castNames.add(normalize(name));
  }
  const recurringNames = recurringCharacterNames(storyline.sceneBeats);
  const directive = castingDirective(castingSeed, Math.max(castNames.size, 2));

  const registrySystemPrompt = `You are CASTING-REGISTRY, the consistency authority of the Optiq Skills swarm. You author the single source of truth that every scene-builder pastes VERBATIM. Redundancy is the mechanism: the video model has no memory, so identity lives in your words.

${directive}

${noMusicMandate({ allowDialogue: kind.dialogueInVideo })}

═══ WHO YOU ARE CASTING, AND WHO YOU ARE NOT ═══
Only scenes cast "recurring" have named characters, and only those characters get
a Locked Character Block. Scenes cast "fresh-faces" are one-off people who appear
nowhere else and are written fresh inside their own scene — they do NOT belong in
this registry, and inventing locks for them is how a film ends up with the same
faces in every shot. Scenes cast "no-people" have nobody on camera at all.

The named cast of this film, from the recurring scenes: ${
    castNames.size > 0 ? [...castNames].join(", ") : "NOBODY — this film has no recurring characters, so author an EMPTY characters array and put your effort into the sets, the product anchor and the sound spec"
  }.${
    recurringNames.size > 0
      ? `\nOf those, these appear in two or more scenes and carry the real consistency burden: ${[...recurringNames].join(", ")}.`
      : ""
  }

Author, with these EXACT word budgets:
1. CHARACTERS — for every character named above, however many that is: a Locked Character Block of ${WORD_BUDGETS.perCharacterMin}–${WORD_BUDGETS.perCharacterMax} words. Do NOT collapse an ensemble into one lead plus extras — if the storyline names five people across its recurring scenes, author five blocks. Do NOT invent characters the storyline did not name. Physical properties only: the keyword "Black" plus Gambian/West African, the SPECIFIC complexion and finish assigned to that character by the casting palette above, face shape, nose, lips, cheekbones, eyes, brows, hair (cut/length/texture/how worn), facial hair, age, height, build, the one distinguishing marker from the palette, and one temperament line at the end. Plus a separate wardrobe lock (colours in CAPS, garment types named precisely, the closure stated, one constant object). Single-scene characters still get full blocks.
2. PRODUCTS — the exact product anchor (shape, label text, colors, size, wear). ${attachedImagesNote}
3. ELEMENTS — recurring story-carrying objects, with the scenes they appear in and their exact state per scene if mid-transformation.
4. RECURRING SETS — every location used by 2+ scenes gets a full locked set block (walls, floor, furniture, every visible item).
5. ${silenceSpecDirective(WORD_BUDGETS.soundMin, WORD_BUDGETS.soundMax)}
6. AMBIENCE SPEC — one line locking the ambient bed. This is not music and is required: with neither a score nor an authored ambient bed, the model invents something to fill the gap, and what it invents is usually music.
7. STYLE HEADER — the film's visual contract (~60–100 words): register, optics, motion policy, prohibitions (no lens-staring, no slow motion on people), language tag, text policy.

THE STORYLINE (source of truth for who/where/what):
${JSON.stringify(storyline, null, 2)}

THE BRIEF:
${JSON.stringify(brief, null, 2)}

HOUSE DOCTRINE:
${knowledgeFor("casting-registry")}`;

  let registry = await runOptiqSkill(
    "casting-registry",
    registrySystemPrompt,
    [...imageParts, { text: briefText }],
    REGISTRY_SCHEMA
  );

  // ── GATE: CASTING VARIETY + SOUND POLICY ──────────────────────────────────
  // Both run before a single scene is built, because the registry is what every
  // scene-builder pastes verbatim: a monochrome cast or a music-specifying sound
  // spec caught here is ONE repair, caught later it is every scene in the film.
  // One combined repair call rather than two — the failures are independent but
  // the fix is the same document.
  const registryFaults = [...castingViolations(registry), ...registrySoundViolations(registry)];
  if (registryFaults.length > 0) {
    console.warn(
      `casting-registry produced ${registryFaults.length} violation(s); repairing:`,
      registryFaults.map((v) => v.slice(0, 120))
    );
    try {
      registry = await runOptiqSkill(
        "registry-repair",
        `${registrySystemPrompt}

═══ THIS IS A REPAIR PASS ═══
Your previous registry failed the house gates. Fix EVERY violation below and
change nothing else. Every character keeps their name, their role and their
scenes — what may change is how they look. The products, elements and recurring
sets stay as they were unless a violation names them.`,
        [
          ...imageParts,
          {
            text: `VIOLATIONS TO FIX:
${registryFaults.map((v, i) => `${i + 1}. ${v}`).join("\n")}

THE REGISTRY TO REPAIR:
${JSON.stringify(registry, null, 2)}`,
          },
        ],
        REGISTRY_SCHEMA
      );
      const remaining = [...castingViolations(registry), ...registrySoundViolations(registry)];
      if (remaining.length > 0) {
        // Not fatal: a slightly samey cast is still a deliverable film, and
        // failing the whole generation over it would cost the director money.
        // The per-scene gates downstream get a second bite at the sound rule.
        console.warn(
          `registry-repair still leaves ${remaining.length} violation(s); shipping anyway:`,
          remaining.map((v) => v.slice(0, 120))
        );
      }
    } catch (err) {
      console.error("registry-repair failed; keeping the original registry", err);
    }
  }

  // ── GATE: CASTING SHAPE ───────────────────────────────────────────────────
  // Not repaired, only reported: by this point the storyline is written and the
  // registry is built around it, and re-writing both to change the shape costs
  // more than it saves. The log is what tells us whether the analyst's rebalance
  // is actually landing in production.
  const shapeFaults = castingShapeViolations(brief.castingShape, storyline.sceneBeats);
  if (shapeFaults.length > 0) {
    console.warn(
      `[casting shape] the film did not come out as "${brief.castingShape}":`,
      shapeFaults.map((v) => v.slice(0, 160))
    );
  }

  // ── STAGE 3a: WHERE THE DIRECTOR'S OWN UPLOADS BELONG ─────────────────────
  //
  // Every uploaded image used to be attached to every scene. That is wrong in
  // both directions: a product shot has no business in a scene the product isn't
  // in, and a logo pasted onto all nine scenes invites the model to paint it into
  // every frame. So each upload is looked at and placed.
  //
  // Best-effort: on any failure `placeMaterials` falls back to the product scenes,
  // and failing that to all of them — the old behaviour, which is wrong but never
  // worse than silently dropping a reference the director chose to upload.
  let materialPlacement = {};
  if (imageParts.length > 0 && (materials || []).length > 0) {
    let classifications = [];
    try {
      const verdict = await runOptiqSkill(
        "material-placement",
        `You are placing the director's own uploaded reference images into a film that has already been storyboarded. Each image is attached in order — image 1 is material index 0, image 2 is index 1, and so on.

For EACH image, decide what it is and WHICH SCENES it should ride along with when those scenes are rendered. An attached reference tells the video model "put this exact thing in the frame", so an image on the wrong scene actively damages that scene.

How to place them:
- A PRODUCT or PACKAGING shot goes on the scenes where that product is actually in frame — the beats below say which. Never on a scene it does not appear in.
- A LOGO goes on the one or two scenes where the brand actually lands, normally the last. A logo on every scene gets painted into every frame.
- A PLACE or interior goes only on scenes set there.
- A PERSON goes only on scenes that person is in. If you cannot tell who they are, return no scenes.
- Anything you genuinely cannot place: return an empty scenes array and say why. That is a valid, useful answer — do NOT guess a scene to fill the field.

Return scene NUMBERS as shown in the storyline (1-based).`,
        [
          ...imageParts,
          {
            text: `THE FILM'S SCENES:
${(storyline.sceneBeats || [])
              .map(
                (b) =>
                  `Scene ${b.sceneNumber}: ${b.moment} — at ${b.location}. Product in frame: ${
                    b.productPresent ? "YES" : "no"
                  }. People: ${(b.charactersPresent || []).join(", ") || "none named"}`
              )
              .join("\n")}

THE UPLOADED MATERIALS, in order:
${(materials || []).map((m, i) => `Index ${i}: "${m.name || "untitled"}"`).join("\n")}

Brand: ${brandName || "Client"} · Offering: ${product || "(unspecified)"}`,
          },
        ],
        MATERIAL_SCHEMA
      );
      classifications = verdict?.materials || [];
      console.log(
        `[materials] placed ${classifications.length}:`,
        classifications.map((c) => `${c.index}=${c.kind}→[${(c.scenes || []).join(",")}]`).join(" ")
      );
    } catch (err) {
      console.error(
        "material placement failed; falling back to the product scenes:",
        String(err?.message || err).slice(0, 200)
      );
    }
    materialPlacement = placeMaterials(materials, classifications, storyline);
  }

  // ── STAGE 3b: CHARACTER REFERENCE SHEETS ──────────────────────────────────
  //
  // Consistency by picture as well as by paragraph — see ./characterRefs.js for
  // why this reverses doctrine §3.8, and for the four failure modes it mitigates.
  //
  // Best-effort throughout: a film with no reference sheets is the film this
  // platform shipped until now, so a failure here degrades to text-only
  // consistency rather than costing the director their generation.
  let characterRefs = [];
  if (generateImage && storeImage) {
    const planned = planCharacterRefs(registry, storyline.sceneBeats);
    if (planned.length > 0) {
      await reportStage("casting", { refsTotal: planned.length, refsDone: 0 });
      let refsDone = 0;
      // Two at a time: image quota is tighter than text, and this sits on the
      // critical path before any scene can be built.
      const rendered = await mapWithConcurrency(planned, 2, async (ref) => {
        try {
          const image = await generateImage(characterRefPrompt(ref));
          const stored = await storeImage(ref.id, image.base64, image.mimeType);
          // base64 is kept in memory only, to attach to the scene-builder calls
          // below. It is stripped before the film is returned — a Firestore doc
          // is capped at 1MB and one PNG blows straight through it.
          return {
            ...ref,
            path: stored.path,
            url: stored.url,
            mimeType: image.mimeType,
            base64: image.base64,
          };
        } catch (err) {
          console.error(
            `character reference for ${ref.name} failed; falling back to text-only for them:`,
            String(err?.message || err).slice(0, 200)
          );
          return null;
        } finally {
          refsDone += 1;
          await reportStage("casting", { refsTotal: planned.length, refsDone });
        }
      });
      characterRefs = rendered.filter(Boolean);
      console.log(
        `[character refs] ${characterRefs.length}/${planned.length} sheets rendered for ` +
          `${planned.map((p) => p.name).join(", ")}`
      );
    }
  }

  // ── SKILL 4: SCENE BUILDERS (parallel) ────────────────────────────────────
  const builderKnowledge = knowledgeFor("scene-builder");
  const exemplar = exemplarScenePrompt();

  const buildScene = async (beat) => {
    const neighborBefore = storyline.sceneBeats.find((b) => b.sceneNumber === beat.sceneNumber - 1);
    const neighborAfter = storyline.sceneBeats.find((b) => b.sceneNumber === beat.sceneNumber + 1);
    const casting = sceneCasting(beat);
    // A scene that names nobody now gets nobody. The old fallback pasted the
    // ENTIRE registry into any scene without a named character, which is
    // precisely how a film ends up with its two leads standing in every shot.
    const charactersForScene = charactersForBeat(registry, beat);

    // Only the people actually IN this scene get their reference attached. This
    // is the whole point of per-scene placement: a face attached to a scene that
    // character isn't in is an invitation to put them there. A scene with no
    // recurring cast carries no reference sheet at all.
    const sceneRefs = casting === "recurring" ? refsForScene(characterRefs, beat, beat.sceneNumber) : [];
    const sceneRefParts = sceneRefs
      .filter((r) => r.base64)
      .map((r) => ({ inlineData: { mimeType: r.mimeType || "image/png", data: r.base64 } }));
    const sceneRefClause = refClause(sceneRefs);

    return runOptiqSkill(
      `scene-builder-${beat.sceneNumber}`,
      `You are a SCENE BUILDER in the Optiq Skills swarm. You compile ONE scene of the film into a single, copy-ready video-generation prompt in the canonical 14-block order. The prompt is the deliverable — everything the video model needs lives INSIDE it.

${MANDATORY_PROMPT_RULES}

${noMusicMandate({ allowDialogue: kind.dialogueInVideo })}

${densityLaw({ kind, numScenes })}

${
        casting === "no-people"
          ? `═══ THIS SCENE HAS NOBODY IN IT ═══
No person appears on camera in this scene. No faces, no hands, no bodies, nobody
passing in the background, nobody reflected in anything. Do NOT paste a Locked
Character Block — there is no character here, and adding one contradicts the film.

This is a deliberate choice and often the strongest ten seconds in an ad, but it
is NOT permission to write a still life. The density law still binds: things move,
land, open, tip, spill, switch on, boil over, get pushed by wind, are lifted by
something out of frame. Write the events, and let the absence of people be the
composition rather than the content.`
          : casting === "fresh-faces"
            ? freshFaceDirective(castingSeed, beat.sceneNumber)
            : `- Paste each present character's Locked Character Block and wardrobe lock VERBATIM at the top (identity first — models weight early tokens).`
      }

Scene-specific contract:
- fullPrompt is ${WORD_BUDGETS.scenePromptMin}–${WORD_BUDGETS.scenePromptMax} words. Describe every single visible thing: in a room, the walls, the marks on the walls, the floor, every item in frame; in a market, every stall and its wares.
- Paste the product anchor VERBATIM wherever the product appears${imageParts.length > 0 ? ", with the reference-image quarantine clause" : ""}.
- Paste the recurring set block VERBATIM if this scene uses a recurring set.
- The ABSOLUTE RULES block states the no-music law explicitly — "NO MUSIC of any kind" — alongside the other prohibitions.
- IF a character reference image is attached to this scene, the brief below carries an "ATTACHED CHARACTER REFERENCE" clause. Reproduce that clause inside the prompt, near the top, immediately after the character blocks. It is what tells the video model to take the person and NOT the studio backdrop the reference was shot on — without it, scenes come back grey and flatly lit. Do not paraphrase it.
- The SOUND block opens by restating that the clip carries NO MUSIC, then the locked sound spec VERBATIM, then this scene's diegetic event sounds (every physical event has a sound). Flag "voiceover separate". Never name an instrument, a tempo, a BPM or a musical mood: there is no score in this clip.
- The ACTION block is timestamped beats implementing the storyline's planned cuts exactly, spread across the whole ten seconds. At least ${MIN_BEATS_PER_SCENE} separate timestamped beats, aiming for ${TARGET_BEATS_PER_SCENE}, each a change of state with its own physical verb. Five verbs minimum. Ten seconds narrating one continuous activity is a failed scene.
- ${
        kind.dialogueInVideo
          ? "The DIALOGUE block carries the scene's spoken lines, short and natural, with the language tag."
          : "There is NO DIALOGUE block, because nobody speaks in this film. State explicitly in the prompt that no character speaks, that no lips move in speech, and that the clip contains no audible words of any kind. Return an EMPTY STRING for the scene's dialogue field. The narration is recorded separately afterwards and laid over the cut."
      }
- End with the CLOSING RESTATEMENT paragraph re-asserting identity, wardrobe, the key event, light, motion policy, and prohibitions — and re-asserting the no-music law a third and final time. Use wording to this effect: "${NO_MUSIC_RESTATEMENT}"
- Also return the scene's setting/action/dialogue/sound summaries as separate short fields for the UI (the fullPrompt stays complete on its own).

GOLD-STANDARD EXEMPLAR — READ THIS CAREFULLY: copy its DENSITY, its STRUCTURE and its block order. Do NOT copy its cast, its wardrobe or its complexions. The person in the exemplar is not in your film. Your characters are the ones in the consistency registry below, exactly as the registry describes them — including their specific complexions, which vary from character to character by design. If you find yourself writing "box braids", "deep warm dark-brown skin" or a rust camp-collar shirt, you are copying the exemplar's cast instead of building your own scene:
${exemplar}

BACKGROUND PEOPLE: every background person is explicitly Black Gambian, AND they vary from one another — different complexions across the real range (very deep blue-black through dark brown and golden brown to light caramel-brown), different hairstyles, a spread of ages and builds. A crowd of one identical face and one identical tone is the cliché the doctrine forbids.

HOUSE DOCTRINE:
${builderKnowledge}`,
      [
        // Character references first, then the brand/product plate — and the
        // product plate only for scenes the product is actually in, rather than
        // on all nine. Fewer, more relevant images means less for the model to
        // fuse (doctrine §3.8 rule 1).
        ...sceneRefParts,
        ...(beat.productPresent ? imageParts : []),
        {
          text: `THE BRIEF:
${JSON.stringify(brief, null, 2)}${sceneRefClause ? `\n\n${sceneRefClause}` : ""}

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
Who is in this scene — casting mode "${casting}":
${
            casting === "no-people"
              ? "NOBODY. This scene has no people on camera at all. There are no character locks to paste."
              : casting === "fresh-faces"
                ? "One-off people who appear in no other scene and have no locks. Write them fresh, to the palette above. Do NOT paste any character block from this film's registry."
                : JSON.stringify(charactersForScene, null, 2)
          }

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
    // Locks are only owed by scenes that carry the recurring cast. A fresh-faces
    // or empty scene demanding a Locked Character Block was the gate arguing with
    // the storyline, and the gate always won — which put the leads back into
    // scenes written to be without them.
    const casting = sceneCasting(beat);
    if (casting === "recurring") {
      for (const c of charactersForBeat(registry, beat)) {
        if (!containsVerbatim(scene.fullPrompt, c.lcb)) {
          violations.push(`The Locked Character Block for ${c.name} is missing or paraphrased. Paste it VERBATIM: "${c.lcb}"`);
        }
      }
    } else {
      // …and the reverse: a lock that leaked into a scene it does not belong to
      // is how the film collapses back to the same two faces everywhere.
      for (const c of registry.characters || []) {
        if (c.lcb && containsVerbatim(scene.fullPrompt, c.lcb)) {
          violations.push(
            `Scene ${scene.sceneNumber} is cast "${casting}" but pastes ${c.name}'s Locked Character Block. ` +
              `${c.name} is not in this scene. Remove the block entirely and ${
                casting === "no-people"
                  ? "keep every person out of frame — this scene has nobody in it."
                  : "write the scene's own one-off people instead, who appear nowhere else in the film."
              }`
          );
        }
      }
    }
    if (registry.soundSpec && !containsVerbatim(scene.fullPrompt, registry.soundSpec)) {
      violations.push(`The locked sound spec is missing or paraphrased in the SOUND block. Paste it VERBATIM: "${registry.soundSpec}"`);
    }
    if (casting !== "no-people" && !/black/i.test(scene.fullPrompt)) {
      violations.push(`The keyword "Black" never appears — every on-screen person must be explicitly described as Black Gambian / Black West African.`);
    }
    // The density backstop. The storyline gate is the real defence; this catches
    // a builder that was handed four beats and wrote one long activity anyway.
    violations.push(...scenePromptDensityViolations(scene));
    // The registry gate already cleaned the locked spec, but a builder can still
    // invent a score in its own event-sound writing, so every scene is checked.
    violations.push(...sceneSoundViolations(scene.fullPrompt, { allowDialogue: kind.dialogueInVideo }));
    if (!kind.dialogueInVideo && String(scene.dialogue || "").trim()) {
      violations.push(
        `The scene returned dialogue ("${String(scene.dialogue).slice(0, 60)}…") but nobody speaks in this film. ` +
          `Return an empty dialogue field and carry the beat in the picture instead.`
      );
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

${noMusicMandate({ allowDialogue: kind.dialogueInVideo })}

${densityLaw({ kind, numScenes })}

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
    videoType: kind.id,
    castingShape: brief.castingShape || null,
    /**
     * The rendered character sheets, minus their bytes. Each carries the scenes
     * it belongs to, which is what lets the caller attach it per scene instead of
     * to everything — and what the script editor shows beside the scene.
     */
    characterRefs: characterRefs.map(({ base64, ...ref }) => ref),
    /**
     * Which uploaded materials belong on which scene, keyed by 0-based scene
     * index → array of indexes into `materials`. Replaces attaching every upload
     * to every scene.
     */
    materialPlacement,
    storyArc: storyline.storyArc,
    // Historical field name. Since the no-music mandate this holds the film's
    // UNSCORED sound bed (the locked silence + ambience), not a music spec —
    // kept as `musicSpec` because stored projects, the client Storyboard type
    // and the agent's tools all address it by that name.
    musicSpec: registry.soundSpec,
    ambienceSpec: registry.ambienceSpec,
    /**
     * The world locks, kept on the project for the shot board (see
     * ./shotBoard.js and ../shotBoardRun.js).
     *
     * These already live inside every scene prompt, pasted verbatim — but only as
     * prose, mixed into two thousand words. The continuity supervisor that
     * photographs this film has to know which locations and objects the swarm
     * ALREADY committed to, so it extends those locks rather than authoring a
     * second, contradictory set. The characters are deliberately not here: they
     * have their own reference sheets, which are a better record than the text.
     */
    consistencyRegistry: {
      products: registry.products || [],
      elements: registry.elements || [],
      recurringSets: registry.recurringSets || [],
    },
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
  /**
   * Which of the three kinds of film this scene belongs to. Absent on films made
   * before types existed, which `filmKind` resolves to the dialogue ad.
   *
   * This used to read an undeclared `kind` from the pipeline function above,
   * which is a ReferenceError, not a fallback: every revision threw before it
   * reached Vertex. That took out the script editor's revise box AND every
   * agent write tool, since they all come through here.
   */
  videoType,
}) {
  const kind = filmKind(videoType);
  const runOptiqSkill = makeSkillRunner(vertexFetch);
  const systemPrompt = `You are the SCENE REVISER of the Optiq Skills swarm, revising one scene prompt of a film.
Apply the user's revision request to the original prompt while preserving everything that is locked.

${noMusicMandate({ allowDialogue: kind.dialogueInVideo })}

${densityLaw({ kind })}

You MUST:
- NEVER reintroduce music. If the director's request asks for music ("add an upbeat track", "make it feel triumphant with strings"), do NOT put it in the prompt: the score is composed separately afterwards by a dedicated music model. Deliver the feeling through the diegetic sound and the action instead, and the composed track will carry the rest.
- Keep moments, not mood. Physical verbs. Banned vocabulary stays banned.
- NEVER come back with fewer events than you started with. A revision that turns four timestamped beats into one continuous activity has made the scene worse whatever else it fixed, and ten seconds of one action is the failure this whole system exists to prevent. If the director's request genuinely calls for a calmer scene, make it calmer WITHOUT making it emptier.
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

module.exports = {
  runOptiqSkillsPipeline,
  reviseScene,
  MANDATORY_PROMPT_RULES,
  FILM_KINDS,
  filmKind,
  scenesForLength,
  SCENE_SECONDS,
};
