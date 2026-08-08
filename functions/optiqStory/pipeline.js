// ─── OPTIQ STORY — THE AGENTIC SHORT-FILM SWARM ─────────────────────────────
//
// THE STORY SANDBOX'S PIPELINE. A complete, independent twin of
// functions/optiqSkills/pipeline.js, for films that sell nothing.
//
// It shares no code with the ad swarm on purpose. The ad pipeline is the one that
// earns, it works, and nothing in this file may ever be able to change how it
// behaves. Where the two look alike, that is a deliberate copy, not a shared
// dependency — they are free to diverge and they will.
//
// The swarm, and how it differs from the ad swarm at each stage:
//
//   1. brief-analyst    — reads the director's premise. Classifies GENRE, not an
//                         offering. Finds the want, the obstacle and the stakes.
//                         Picks the casting shape. (Ad version: classifies a
//                         product or service and finds "the one thing".)
//   2. concept room     — four complete stories built from three drawn dramatic
//                         engines, with the losers kept in the open. (Ad version:
//                         comic engines aimed at a product.)
//   3. storyline        — THE star skill. Turns the premise into ONE complete
//                         story: a hook, a want, a turn, a climax and an ending
//                         that happens on screen. Every scene is tagged with the
//                         obligation it serves so the structure is checkable.
//                         (Ad version: hook → the offering enters → proof →
//                         payoff → brand.)
//   4. casting-registry — the consistency registry: Locked Character Blocks,
//                         wardrobe locks, story ELEMENTS (never products),
//                         recurring set blocks, the locked unscored sound spec,
//                         the style header.
//   5. scene-builder ×N — every scene's 1,500–2,000 word copy-ready prompt, in
//                         parallel, with the registry embedded verbatim.
//   6. quality gates    — JS-enforced: word count, verbatim locks, sound spec,
//                         density, story structure, and AD PURITY. Failures go
//                         through one scene-verifier repair pass.

const {
  WORD_BUDGETS,
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
  adultsOnlyMandate,
  minorViolations,
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
} = require("./characterRefs");
const {
  noMusicMandate,
  NO_MUSIC_RESTATEMENT,
  silenceSpecDirective,
  sceneSoundViolations,
  registrySoundViolations,
} = require("./soundPolicy");
const {
  storyStructureLaw,
  noCommercialMandate,
  storyStructureViolations,
  storyPurityViolations,
  scenePurityViolations,
  ACTS,
} = require("./storyCraft");

const OPTIQ_TEXT_MODEL = "gemini-3.5-flash";

/**
 * The id this sandbox answers to. The router in functions/index.js sends only
 * this videoType here; everything else goes to the ad swarm.
 */
const STORY_VIDEO_TYPE = "short-film-story";

const SCENE_SECONDS = 10;

/**
 * What a story film IS, stated once and pasted wherever a skill needs to know.
 *
 * The ad swarm's FILM_KINDS table has three entries because an ad has three
 * shapes. This sandbox has exactly one kind of film, so it is a constant rather
 * than a lookup — and every skill in here can assume it.
 */
const STORY_KIND = {
  id: STORY_VIDEO_TYPE,
  noun: "short film",
  register:
    "This is an ORIGINAL SHORT FILM — an entertainment piece, made to be watched for its own sake. There is NO brand, NO product, NO client and NOTHING being sold or promoted anywhere in it. It is a complete story with a hook, a want, a turn, a climax and an ending that happens on screen inside the run-time. Real people, real stakes, a specific outcome. No pitch, no tagline, no call to action, no logo, no end card and no narrator: the only words are the characters' own, spoken on camera. The STORY is the hero.",
  // People speak on camera and there is no separately-recorded narration. Both
  // are read by audio post — footage gain stays at 1 and no voiceover is written.
  dialogueInVideo: true,
  ttsVoiceover: false,
  branded: false,
};

// Rules 5 and 9 are where this differs from the ad swarm's block: the ad version
// says the product keeps a verbatim anchor and that the offering is the hero of
// the story. Here, objects are story elements and the STORY is the hero.
const MANDATORY_PROMPT_RULES = `NON-NEGOTIABLE PROMPT RULES (every single scene's fullPrompt MUST satisfy ALL of these — no exceptions):
1. LENGTH — every scene's fullPrompt is ${WORD_BUDGETS.scenePromptMin}–${WORD_BUDGETS.scenePromptMax} words. Every single thing visible in the frame is described. Density of authored specifics, not padding.
2. GAMBIAN ENVIRONMENT — the word "Gambian" and specific Gambian setting details (via the specificity ladder, Rung 4 minimum) appear explicitly in every prompt. The scene is unmistakably The Gambia, West Africa, unless the director's premise explicitly sets the story elsewhere — a story may be set anywhere, and if it is, that place gets the same rung-4 specificity instead.
3. BLACK PEOPLE — every single on-screen person is explicitly described with the keyword "Black" — a Black Gambian / Black West African person. Never leave skin tone implicit and never rely on "dark-skinned" alone; models have rendered under-described people as other ethnicities. State it plainly for the lead AND every background person. Each person's SPECIFIC complexion is then named exactly as the casting registry assigned it — anywhere along the real Black Gambian range, from very deep blue-black through dark brown and golden brown to light caramel-brown. Do NOT flatten everyone to "rich, deep dark skin": that produces films that all star the same person.
4. CHARACTER CONSISTENCY — each Locked Character Block (${WORD_BUDGETS.perCharacterMin}–${WORD_BUDGETS.perCharacterMax} words per character: skin, face shape, nose, lips, cheekbones, eyes, brows, hair, age, height, build, one distinguishing marker) appears VERBATIM, word-for-word identical, in every scene prompt featuring that character. Two characters = ~300–400 words of character blocks.
4b. CASTING VARIETY — no two people in the same film share a complexion, a hairstyle or a build, and the cast is spread across ages rather than clustered on one. The doctrine's worked examples ("box braids", "deep warm dark-brown skin", the rust camp-collar shirt) teach you the FORMAT of a character block and must never be reproduced as this film's cast. Background crowds get the same spread — a crowd of one identical face and tone is the cliché rule 8 forbids.
5. STORY ELEMENTS, NOT PRODUCTS — nothing in this film is a product and nothing is being sold. Objects the STORY needs (a tin, a phone, a dress, a boat, a knife, a letter) are ELEMENTS: each keeps the exact same anchor description verbatim in every scene it appears in, and its state is tracked if the story changes it. An element is never presented to the audience, never hero-shot, never turned label-out to camera. The test: is the camera showing this object to the CHARACTERS, or to the AUDIENCE? Shown to the audience, it is an ad shot — cut it.
6. SCENE-ELEMENT CONSISTENCY — recurring physical elements and recurring sets keep an identical anchor description in every scene they appear in. An object never changes appearance between scenes.
7. SOUND CONSISTENCY — the locked sound spec (${WORD_BUDGETS.soundMin}–${WORD_BUDGETS.soundMax} words locking the film's UNSCORED sound bed: the explicit absence of music, the quality of that silence, and the exact continuous ambience; NOT incidental birds/wind padding, and NEVER instruments/tempo/BPM/musical progression) is repeated VERBATIM in the sound block of every continuous scene, plus that scene's diegetic event sounds. Continuous scenes must sound like one unbroken recording.
8. BACKGROUND AUTHORSHIP — the environment plus every visible item and every background person (age, clothing, position, what they are doing) gets ${WORD_BUDGETS.backgroundMin}–${WORD_BUDGETS.backgroundMax} words. Every unspecified element is a vote for the cliché.
9. THE STORY IS THE HERO — every scene advances ONE story with a beginning, a middle and an end. This scene serves a specific obligation in that story (the open, the want, the turn, an escalation, the climax or the landing) and it must visibly do that job. Nothing is being advertised, demonstrated, recommended or launched: there is no logo, no tagline, no call to action, no brand card, no closing plate and no narrator anywhere in this film.
10. CUTS WITHIN SCENES — scenes are not always one continuous shot. When the storyline plans cuts, the 10s scene contains those hard cuts, each with its own timestamped beat and shot description.
10b. DENSITY — every 10-second scene carries at least ${MIN_BEATS_PER_SCENE} distinct beats (aim for ${TARGET_BEATS_PER_SCENE}), each a CHANGE OF STATE with its own timestamp and its own physical verb. Ten seconds of one continuous activity — carrying a cup across a room, stirring a pot, scrolling a phone — is the dead footage this whole system exists to prevent. A camera move is not a beat. A mood is not a beat. Somebody continuing to do what they were already doing is not a beat.
11. NO MUSIC — the video model generates NO music, ever. No soundtrack, no melody, no instrumental bed, no humming or singing, no music from a radio/phone/speaker inside the scene, no sting on a cut, no swell under a line. The clip carries ONLY the diegetic sound of the physical events in frame, the location's ambience, and the characters' spoken dialogue. The score is composed separately afterwards by a dedicated music model and laid under the finished cut — music invented here cannot be removed from the clip's audio, collides with that score, and wastes the render. This rule is stated in the ABSOLUTE RULES, restated at the top of the SOUND block, and restated again in the CLOSING RESTATEMENT: one mention does not survive a 2,000-word prompt.
12. ADULTS ONLY — every single person visible in this scene is 18 or older. No child, no baby, no toddler, no schoolchild, no teenager under 18 appears in any frame, in any role, foreground or background — not in a crowd, not in a doorway, not carried on somebody's back, not in a photograph on a wall. If the brief implied one, they are written as an adult of 18+ doing the same thing. State ages plainly where you state them, and never state one below 18.`;

/** "180s" → 18 scenes. The one place the scene count is decided. */
function scenesForLength(length) {
  const seconds = Number(String(length ?? "").replace(/[^0-9.]/g, "")) || 60;
  return Math.max(1, Math.round(seconds / SCENE_SECONDS));
}

// ─── SKILL RUNNER ───────────────────────────────────────────────────────────

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// A skill call is worth retrying if it hit a Vertex capacity/timeout error OR if
// the model returned something unusable — empty output, a truncated (MAX_TOKENS)
// response, or JSON we couldn't parse. All of these are usually intermittent and
// clear on a re-roll.
function isRetryableSkillError(err) {
  const msg = String(err?.message || err);
  return /429|RESOURCE_EXHAUSTED|503|UNAVAILABLE|overloaded|deadline|invalid JSON|unterminated|unexpected (end|token)|returned empty|MAX_TOKENS|finishReason/i.test(
    msg
  );
}

function makeSkillRunner(vertexFetch) {
  return async function runStorySkill(skillName, systemPrompt, userParts, responseSchema) {
    const generationConfig = { temperature: 0.8, maxOutputTokens: 32768 };
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
            `Optiq Story skill "${skillName}" returned empty output (finishReason=${finishReason || "none"}${block ? `, blockReason=${block}` : ""})`
          );
        }
        if (!responseSchema) return text.trim();
        try {
          return JSON.parse(text);
        } catch (parseErr) {
          throw new Error(
            `Optiq Story skill "${skillName}" returned invalid JSON (finishReason=${finishReason || "none"}): ${parseErr.message}`
          );
        }
      } catch (err) {
        if (attempt < backoffs.length && isRetryableSkillError(err)) {
          const wait = backoffs[attempt] + Math.floor(Math.random() * 2000);
          console.warn(
            `Optiq Story skill "${skillName}" failed (attempt ${attempt + 1}); retrying in ${wait}ms:`,
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

/** Bounded concurrency so parallel scene builds don't trip Vertex QPM limits. */
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

/** Whitespace-insensitive containment check for verbatim-lock gates. */
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

// The analyst reads a STORY premise, so its fields are a story's: genre, want,
// obstacle, stakes. There is deliberately no offeringType and no theOneThing —
// asking a model to name what is being sold is how it invents something to sell.
const PREMISE_SCHEMA = {
  type: "OBJECT",
  properties: {
    genre: { type: "STRING" },
    premiseSummary: { type: "STRING" },
    whoItIsAbout: { type: "STRING" },
    whatTheyWant: { type: "STRING" },
    whatIsInTheWay: { type: "STRING" },
    whatIsAtStake: { type: "STRING" },
    audienceFeeling: { type: "STRING" },
    toneRegister: { type: "STRING" },
    language: { type: "STRING" },
    setting: { type: "STRING" },
    castingShape: { type: "STRING", enum: ["single-lead", "ensemble", "no-hero-montage"] },
    castingRationale: { type: "STRING" },
  },
  required: [
    "genre", "premiseSummary", "whoItIsAbout", "whatTheyWant", "whatIsInTheWay",
    "whatIsAtStake", "audienceFeeling", "toneRegister", "language", "setting",
    "castingShape", "castingRationale",
  ],
};

// `concepts` is plural and required because the whole point is divergence: a
// model asked to "consider several and return the winner" returns its first idea
// and calls it the winner. Making it show the losers is what forces the others to
// exist.
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
          whatIsAtStake: { type: "STRING" },
          theTurn: { type: "STRING" },
          theEnding: { type: "STRING" },
          risk: { type: "STRING" },
        },
        required: [
          "title", "logline", "engine", "openingImage", "eventDensity",
          "whatIsAtStake", "theTurn", "theEnding", "risk",
        ],
      },
    },
    pick: { type: "STRING" },
    pickRationale: { type: "STRING" },
  },
  required: ["concepts", "pick", "pickRationale"],
};

// The storyline's own shape. `act` on every beat is what makes the five
// obligations checkable in JS — see storyStructureViolations. `theEnding` and
// `whatIsAtStake` are required at film level for the same reason: a model that
// has to write them down cannot leave them undecided.
const STORYLINE_SCHEMA = {
  type: "OBJECT",
  properties: {
    title: { type: "STRING" },
    concept: { type: "STRING" },
    storyPitch: { type: "STRING" },
    emotionalHook: { type: "STRING" },
    storyArc: { type: "STRING" },
    whatIsAtStake: { type: "STRING" },
    theEnding: { type: "STRING" },
    sceneBeats: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          sceneNumber: { type: "INTEGER" },
          /** Which of the five obligations this scene serves. */
          act: { type: "STRING", enum: ACTS },
          purpose: { type: "STRING" },
          moment: { type: "STRING" },
          location: { type: "STRING" },
          /** Who this scene needs — see sceneCastingDirective() in ./casting.js. */
          castingMode: { type: "STRING", enum: ["recurring", "fresh-faces", "no-people"] },
          charactersPresent: { type: "ARRAY", items: { type: "STRING" } },
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
          "sceneNumber", "act", "purpose", "moment", "location", "castingMode",
          "charactersPresent", "cuts",
        ],
      },
    },
  },
  required: [
    "title", "concept", "storyPitch", "emotionalHook", "storyArc",
    "whatIsAtStake", "theEnding", "sceneBeats",
  ],
};

// No `products` array. Objects a story needs are elements, and calling them
// anything else is how a film acquires a hero shot it was never asked for.
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
          /** One physical habit the audience learns to read. See §15.8. */
          tell: { type: "STRING" },
          scenes: { type: "ARRAY", items: { type: "INTEGER" } },
        },
        required: ["name", "role", "lcb", "wardrobe", "tell", "scenes"],
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
  required: ["characters", "elements", "recurringSets", "soundSpec", "ambienceSpec", "styleHeader"],
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

/**
 * Build one original short film.
 *
 * Signature-compatible with runOptiqSkillsPipeline so functions/index.js can
 * route to either without reshaping the job — but `brandName` and `product` are
 * accepted and IGNORED. A story has no brand, and a caller that passes one is
 * passing a placeholder the wizard never collected.
 */
async function runOptiqStoryPipeline({
  vertexFetch,
  prompt,
  length,
  aspectRatio,
  onStage,
  /** Stable per film (the project id) so a retried generation re-casts the same
   * people rather than silently swapping a face mid-way. */
  castingSeed,
  /**
   * async (prompt) => { base64, mimeType } — renders one character reference
   * sheet. Injected because it spends image quota and because functions/index.js
   * owns every Vertex media call. Omit it and the swarm falls back to text-only
   * consistency.
   */
  generateImage,
  /** async (id, base64, mimeType) => { path, url } — persists a reference sheet. */
  storeImage,
}) {
  const runStorySkill = makeSkillRunner(vertexFetch);
  const kind = STORY_KIND;
  const numScenes = scenesForLength(length);

  const reportStage = async (stage, meta) => {
    if (!onStage) return;
    try {
      await onStage(stage, meta);
    } catch (err) {
      console.warn("onStage reporter failed (non-fatal):", String(err?.message || err).slice(0, 120));
    }
  };

  await reportStage("analyzing");

  // No brand block, no product line, no attached-materials note. This is the
  // whole brief a story skill gets, and it is deliberately just the premise.
  const briefText = `THE DIRECTOR'S PREMISE — the story they want told:
${prompt}

WHAT KIND OF FILM THIS IS: ORIGINAL SHORT FILM
${kind.register}

The shape of the finished film:
- Run-time: ${length} → exactly ${numScenes} scenes of ${SCENE_SECONDS} seconds each
- Aspect ratio: ${aspectRatio || "16:9"}
- The characters SPEAK on camera; write their dialogue. There is no narrator and
  no voiceover anywhere in this film.
- There is NO brand, NO product and NO client. Nothing is being sold. If the
  premise above mentions a business or an object, it is a place or a thing in the
  story — never something to advertise.`;

  // ── SKILL 1: PREMISE ANALYST ──────────────────────────────────────────────
  const brief = await runStorySkill(
    "brief-analyst",
    `You are the PREMISE ANALYST, the first skill in the Optiq Story swarm — the agentic system that turns a director's premise into an original short film worth watching. Downstream skills (concept room, storyline, casting-registry, scene-builders) act strictly on YOUR reading, so be precise.

WHAT YOU ARE ANALYSING FOR: ${kind.register}

${noCommercialMandate()}

${adultsOnlyMandate()}

If the director's brief names or implies anyone under 18, say so plainly in your
reading and recast them as an adult of 18 or older doing the same thing. Never
refuse the brief over it and never quietly drop what it was about.

Your jobs:
1. Name the GENRE in the terms a film would actually be described in — domestic drama, comedy of errors, quiet thriller, coming-of-age, farce, character study, ghost story, heist-in-miniature. Not a marketing category.
2. Say what the premise literally is, in one honest sentence.
3. WHO IT IS ABOUT. One person, or the two or three whose story this is.
4. WHAT THEY WANT. Four words if you can. If you cannot say it, the premise is a situation and you must say so here — the concept room needs to know.
5. WHAT IS IN THE WAY. It has to be able to genuinely beat them.
6. WHAT IS AT STAKE — the specific thing they lose if it goes wrong, in their own
   life, on their own terms. "Her future" is not a stake; the school fees this
   Friday is a stake.
7. What the audience should be left FEELING when the last frame cuts. One line.
8. Choose the tone register, expressed as behaviour rather than adjective.
9. The SETTING. Default to The Gambia, West Africa, unless the premise clearly
   places the story somewhere else — a story may be set anywhere, and if the
   director asked for elsewhere, say so plainly here and name the specific place.
10. Choose the CASTING SHAPE. Three options, genuinely equal — there is no default:
   • "single-lead" — one recurring locked character carries the whole story. Right when the film IS one person's experience.
   • "ensemble" — two to four recurring characters who all matter, in relationship with each other. Right for anything about a family, a household, a workplace, a rivalry, a friendship, a debt between people. This is the shape most human stories actually have, and most short films want it.
   • "no-hero-montage" — many different people, each carrying one beat, nobody recurring. Rare in a story, and only right when the point is genuinely breadth: this happens to everyone.
   READ THIS CAREFULLY, IT IS A KNOWN FAILURE: this platform defaults to "single-lead" and it made every film look like the same film. Before you choose it, say what the other two would look like for this premise. If the story involves more than one person wanting something from another person, it is an ensemble — not a lead with extras. Put your real reasoning in castingRationale, naming which shape you rejected and why.
11. Choose the dialogue language (default: English; Wolof only when the premise is
    a purely local, mass-market story and the register calls for it).

HOUSE DOCTRINE:
${knowledgeFor("brief-analyst")}`,
    [{ text: briefText }],
    PREMISE_SCHEMA
  );

  // ── SKILL 2: THE CONCEPT ROOM ─────────────────────────────────────────────
  //
  // The step that stops the film being a situation. Best-effort: a failure here
  // costs the film its brainstorm, not its generation, and the storyline skill
  // still has the analysis, the structure law and the density law.
  await reportStage("storylining");
  const creativeBrief = conceptDirective(castingSeed, { numScenes });
  let conceptRoom = null;
  try {
    conceptRoom = await runStorySkill(
      "concept-room",
      `${creativeBrief}

${densityLaw({ numScenes })}

THE PREMISE ANALYST'S READING:
${JSON.stringify(brief, null, 2)}

HOUSE DOCTRINE — §1.1 (moments not mood), §1.3 (the banned vocabulary) and Part XV
(story craft) are the standard your concepts are judged against:
${knowledgeFor("brief-analyst")}`,
      [{ text: briefText }],
      CONCEPT_SCHEMA
    );
    console.log(
      `[story concept room] ${(conceptRoom.concepts || []).length} concept(s), picked "${conceptRoom.pick}": ` +
        (conceptRoom.concepts || []).map((c) => c.title).join(" · ")
    );
  } catch (err) {
    console.error(
      "story concept-room failed; the storyline skill writes unprompted:",
      String(err?.message || err).slice(0, 200)
    );
  }

  const winner =
    (conceptRoom?.concepts || []).find(
      (c) => normalize(c.title) === normalize(conceptRoom?.pick)
    ) || (conceptRoom?.concepts || [])[0] || null;
  const rejected = (conceptRoom?.concepts || []).filter((c) => c !== winner);

  const conceptSection = winner
    ? `═══ THE STORY YOU ARE WRITING (from the concept room — build THIS) ═══
Title: ${winner.title}
Logline: ${winner.logline}
The engine (what keeps generating events): ${winner.engine}
The first frame: ${winner.openingImage}
What is at stake: ${winner.whatIsAtStake}
The turn: ${winner.theTurn}
The ending — what is physically different in the last shot: ${winner.theEnding}
The room's own worry about it: ${winner.risk}
Why this one was picked over the others: ${conceptRoom?.pickRationale || "(not given)"}

Events this concept promised to deliver — the film must contain all of them, and
they are a floor, not a plan:
${(winner.eventDensity || []).map((e) => `  • ${e}`).join("\n")}

CONCEPTS THE ROOM REJECTED. They are here so you do not drift back into them
halfway through — if your storyline starts resembling one of these, you have
abandoned the story you were given:
${rejected.map((c) => `  ✗ ${c.title} — ${c.logline}`).join("\n") || "  (none)"}`
    : "";

  // ── SKILL 3: STORYLINE — the star of Optiq Story ──────────────────────────
  let storyline = await runStorySkill(
    "storyline",
    `You are STORYLINE — the most important skill in the Optiq Story swarm, and the thing that decides whether anyone watches this film past the third second. Your only job: make the whole ${kind.noun} ONE complete story. Not a vibe, not a mood reel, not a situation — a story with a beginning, a middle and an end that happens on screen.

WHAT KIND OF FILM THIS IS: ${kind.register}

${noCommercialMandate()}

${adultsOnlyMandate()}

How you work:
1. ${
      winner
        ? `The concept room has already done the ideation and handed you a winner — build THAT film. Do not re-pitch it, do not soften it, and do not quietly revert to the safe version of this premise on your way to scene 3. Your job is execution: turn a one-line concept into ${numScenes} scenes that deliver every event it promised, plus the turn and the ending it named.`
        : `Consider several candidate stories and reject the literal one first. The literal reading of any premise ("these people do the thing the premise describes") is a situation with a camera pointed at it, and it produces empty film. Pick the ONE where somebody wants something they might not get.`
    }
2. Tell that story in exactly ${numScenes} scenes × ${SCENE_SECONDS} seconds${
      numScenes >= 12
        ? ` — this is a long film, so the story must be BIGGER: a real second act with its own reversal, more people, more turns. Do NOT pad it by repeating a beat with different framing, and do not tell a six-scene story slowly.`
        : `.`
    }
3. TAG EVERY SCENE with the obligation it serves, in its "act" field. This is not
   bookkeeping — it is how the film is checked for having a beginning, a turn and
   an ending, and an untagged scene is a scene nobody decided the purpose of.
4. Plan the CUTS inside every scene, to the density law below. A ${SCENE_SECONDS}s scene is either ONE continuous locked shot (when physical continuity or an unbroken performance IS the content) or 2–4 hard cuts, each a complete moment with its own verb. Use the cut decision tree from the doctrine.
5. Every beat must be a MOMENT — a filmable physical event, verbs about hands — never an atmosphere. If a beat cannot be pointed at with a camera, replace it. Write each scene's moment as the actual sequence of events, not a summary of the mood: "she takes the lid off, the steam catches her, she swears, the boy laughs and she throws the cloth at him" rather than "a warm domestic moment in the kitchen".
6. Invent the characters the story needs (names, roles) and HONOUR THE ANALYST'S CASTING SHAPE — it is not a suggestion:
   • "single-lead" — one recurring character in most scenes. Others may appear, but the film is theirs.
   • "ensemble" — two to four recurring characters who all matter. Give them their own wants and their own beats; do not quietly demote three of them to background for one hero. Scenes should put them TOGETHER, in relationship, not take turns.
   • "no-hero-montage" — a DIFFERENT person in each scene and nobody recurring. Do not sneak a lead back in by having one person bookend it. Cast those scenes "fresh-faces" and leave charactersPresent empty; they need no locks.
   The platform's known failure is collapsing everything into one hero. If the shape says ensemble, a film that comes out with one dominant character is a FAILED brief, not a stylistic choice.
6b. Then decide, SCENE BY SCENE, who that scene actually needs — see the per-scene casting brief below. The film-wide shape says what the film is about; the casting mode says who is in front of the camera for these particular ten seconds, and they are not the same question.
7. DIALOGUE. Characters speak on camera. Keep it under ten words a line, spoken the way people actually talk — interruptions, deflections, half-answers, things somebody starts and does not finish. Nobody says the theme. Nobody explains the plot. No exposition: if a line begins "ever since father died and left us the shop", delete it and let us work it out from what we see. A scene with no dialogue at all is a legitimate and often superior choice.

${conceptSection}

${storyStructureLaw({ numScenes })}

${densityLaw({ numScenes })}

${sceneCastingDirective()}

THE PREMISE ANALYST'S ANALYSIS (follow its casting decision, its stakes and its tone):
${JSON.stringify(brief, null, 2)}

HOUSE DOCTRINE:
${knowledgeFor("storyline")}`,
    [{ text: briefText }],
    STORYLINE_SCHEMA
  );

  // ── GATE: STRUCTURE, DENSITY, CASTING, AD-PURITY ──────────────────────────
  //
  // The cheapest place in the whole pipeline to fix a broken film. A missing
  // ending caught here is one repair call; caught after the scenes are built it
  // is N rebuilds of 2,000 words each, and caught after rendering it is the
  // director's money.
  const storyFaults = [
    ...storyStructureViolations(storyline, { numScenes }),
    ...storylineDensityViolations(storyline, { numScenes }),
    ...sceneCastingViolations(storyline.sceneBeats),
    ...storyPurityViolations(storyline),
 
    ...minorViolations(JSON.stringify(storyline.sceneBeats || []), "The outline"),
  ];
  if (storyFaults.length > 0) {
    console.warn(
      `story storyline produced ${storyFaults.length} violation(s); repairing:`,
      storyFaults.map((v) => v.slice(0, 140))
    );
    try {
      const repaired = await runStorySkill(
        "storyline-doctor",
        `You are the STORY DOCTOR. A storyline has been written and it has failed the
house gates for structure, density, casting or commercial purity. Fix EVERY
violation below and change nothing else: the concept, the title, the arc, the
emotional hook and the characters all stay exactly as they are. You are punching
up scenes and repairing the spine, not rewriting the film.

${noCommercialMandate()}

${storyStructureLaw({ numScenes })}

${densityLaw({ numScenes })}

${sceneCastingDirective()}

Return the COMPLETE storyline in the same schema, with every scene present, in
order, and every scene carrying its "act" tag — not just the ones you changed.`,
        [
          {
            text: `VIOLATIONS TO FIX:
${storyFaults.map((v, i) => `${i + 1}. ${v}`).join("\n")}

THE STORYLINE TO REPAIR:
${JSON.stringify(storyline, null, 2)}`,
          },
        ],
        STORYLINE_SCHEMA
      );
      // Only adopt a repair that kept the film: a doctor that returns three of
      // six scenes has not repaired the storyline, it has deleted it.
      if ((repaired?.sceneBeats || []).length >= (storyline.sceneBeats || []).length) {
        const remaining = [
          ...storyStructureViolations(repaired, { numScenes }),
          ...storylineDensityViolations(repaired, { numScenes }),
          ...sceneCastingViolations(repaired.sceneBeats),
          ...storyPurityViolations(repaired),
        ];
        console.log(
          `[story doctor] ${storyFaults.length} → ${remaining.length} violation(s) after repair`
        );
        storyline = repaired;
      } else {
        console.warn(
          `[story doctor] returned ${(repaired?.sceneBeats || []).length} scenes for a ` +
            `${(storyline.sceneBeats || []).length}-scene film; keeping the original`
        );
      }
    } catch (err) {
      console.error("story storyline-doctor failed; keeping the original storyline", err);
    }
  }

  // ── SKILL 4: CASTING & CONSISTENCY REGISTRY ───────────────────────────────
  await reportStage("casting");
  // Only scenes cast "recurring" contribute names to the registry. A film whose
  // scenes are all fresh faces or empty frames needs no locked cast at all, and
  // authoring one for it is how those scenes end up with the same people anyway.
  const castNames = new Set();
  for (const beat of storyline.sceneBeats || []) {
    if (sceneCasting(beat) !== "recurring") continue;
    for (const name of beat.charactersPresent || []) castNames.add(normalize(name));
  }
  const recurringNames = recurringCharacterNames(storyline.sceneBeats);
  const directive = castingDirective(castingSeed, Math.max(castNames.size, 2));

  const registrySystemPrompt = `You are CASTING-REGISTRY, the consistency authority of the Optiq Story swarm. You author the single source of truth that every scene-builder pastes VERBATIM. Redundancy is the mechanism: the video model has no memory, so identity lives in your words.

${directive}

${noMusicMandate({ allowDialogue: true })}

${noCommercialMandate()}

═══ WHO YOU ARE CASTING, AND WHO YOU ARE NOT ═══
Only scenes cast "recurring" have named characters, and only those characters get
a Locked Character Block. Scenes cast "fresh-faces" are one-off people who appear
nowhere else and are written fresh inside their own scene — they do NOT belong in
this registry, and inventing locks for them is how a film ends up with the same
faces in every shot. Scenes cast "no-people" have nobody on camera at all.

The named cast of this film, from the recurring scenes: ${
    castNames.size > 0
      ? [...castNames].join(", ")
      : "NOBODY — this film has no recurring characters, so author an EMPTY characters array and put your effort into the sets, the story elements and the sound spec"
  }.${
    recurringNames.size > 0
      ? `\nOf those, these appear in two or more scenes and carry the real consistency burden: ${[...recurringNames].join(", ")}.`
      : ""
  }

Author, with these EXACT word budgets:
1. CHARACTERS — for every character named above, however many that is: a Locked Character Block of ${WORD_BUDGETS.perCharacterMin}–${WORD_BUDGETS.perCharacterMax} words. Do NOT collapse an ensemble into one lead plus extras — if the storyline names four people across its recurring scenes, author four blocks. Do NOT invent characters the storyline did not name. Physical properties only: the keyword "Black" plus Gambian/West African, the SPECIFIC complexion and finish assigned to that character by the casting palette above, face shape, nose, lips, cheekbones, eyes, brows, hair (cut/length/texture/how worn), facial hair, age, height, build, the one distinguishing marker from the palette, and one temperament line at the end. Plus a separate wardrobe lock (colours in CAPS, garment types named precisely, the closure stated, one constant object). Single-scene characters still get full blocks.
1b. THE TELL — this is a STORY, so every character also gets ONE behavioural tell: a specific physical habit that repeats and that the audience learns to read (what her hands do when she is lying; the way he checks a pocket he has already checked). One short line. It costs nothing in the word budget and it is the difference between a person and a model. A story has characters, not demographics.
2. ELEMENTS — the objects the STORY turns on, with the scenes they appear in and their exact state per scene if the story changes them. These are not products: nothing here is being sold, hero-shot, or presented to the audience. A tin, a letter, a dress, a knife, a phone — described once, exactly, and identical in every scene it appears in.
3. RECURRING SETS — every location used by 2+ scenes gets a full locked set block (walls, floor, furniture, every visible item).
4. ${silenceSpecDirective(WORD_BUDGETS.soundMin, WORD_BUDGETS.soundMax)}
5. AMBIENCE SPEC — one line locking the ambient bed. This is not music and is required: with neither a score nor an authored ambient bed, the model invents something to fill the gap, and what it invents is usually music.
6. STYLE HEADER — the film's visual contract (~60–100 words): register, optics, motion policy, prohibitions (no lens-staring, no slow motion on people), language tag, text policy. There is no brand colour and no on-screen text in this film.

THE STORYLINE (source of truth for who/where/what):
${JSON.stringify(storyline, null, 2)}

THE PREMISE:
${JSON.stringify(brief, null, 2)}

HOUSE DOCTRINE:
${knowledgeFor("casting-registry")}`;

  let registry = await runStorySkill(
    "casting-registry",
    registrySystemPrompt,
    [{ text: briefText }],
    REGISTRY_SCHEMA
  );

  // ── GATE: CASTING VARIETY + SOUND POLICY ──────────────────────────────────
  // Both run before a single scene is built, because the registry is what every
  // scene-builder pastes verbatim: a monochrome cast or a music-specifying sound
  // spec caught here is ONE repair, caught later it is every scene in the film.
  const registryFaults = [
    ...castingViolations(registry),
    ...registrySoundViolations(registry),
    // A minor written into a locked block is pasted verbatim into every scene
    // that person appears in, so this one repair is worth N later ones.
    ...minorViolations(JSON.stringify(registry.characters || []), "The casting registry"),
  ];
  if (registryFaults.length > 0) {
    console.warn(
      `story casting-registry produced ${registryFaults.length} violation(s); repairing:`,
      registryFaults.map((v) => v.slice(0, 120))
    );
    try {
      registry = await runStorySkill(
        "registry-repair",
        `${registrySystemPrompt}

═══ THIS IS A REPAIR PASS ═══
Your previous registry failed the house gates. Fix EVERY violation below and
change nothing else. Every character keeps their name, their role, their tell and
their scenes — what may change is how they look. The elements and recurring sets
stay as they were unless a violation names them.`,
        [
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
        console.warn(
          `story registry-repair still leaves ${remaining.length} violation(s); shipping anyway:`,
          remaining.map((v) => v.slice(0, 120))
        );
      }
    } catch (err) {
      console.error("story registry-repair failed; keeping the original registry", err);
    }
  }

  // ── GATE: CASTING SHAPE (reported, not repaired) ──────────────────────────
  // By this point the storyline is written and the registry is built around it,
  // and re-writing both to change the shape costs more than it saves. The log is
  // what tells us whether the analyst's rebalance is landing in production.
  const shapeFaults = castingShapeViolations(brief.castingShape, storyline.sceneBeats);
  if (shapeFaults.length > 0) {
    console.warn(
      `[story casting shape] the film did not come out as "${brief.castingShape}":`,
      shapeFaults.map((v) => v.slice(0, 160))
    );
  }

  // ── STAGE 4b: CHARACTER REFERENCE SHEETS ──────────────────────────────────
  //
  // Consistency by picture as well as by paragraph. Best-effort throughout: a
  // film with no reference sheets degrades to text-only consistency rather than
  // costing the director their generation.
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
            `story character reference for ${ref.name} failed; falling back to text-only for them:`,
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
        `[story character refs] ${characterRefs.length}/${planned.length} sheets rendered for ` +
          `${planned.map((p) => p.name).join(", ")}`
      );
    }
  }

  // ── SKILL 5: SCENE BUILDERS (parallel) ────────────────────────────────────
  const builderKnowledge = knowledgeFor("scene-builder");
  const exemplar = exemplarScenePrompt();
  const lastScene = storyline.sceneBeats.length
    ? Math.max(...storyline.sceneBeats.map((b) => Number(b.sceneNumber) || 0))
    : numScenes;

  const buildScene = async (beat) => {
    const neighborBefore = storyline.sceneBeats.find((b) => b.sceneNumber === beat.sceneNumber - 1);
    const neighborAfter = storyline.sceneBeats.find((b) => b.sceneNumber === beat.sceneNumber + 1);
    const casting = sceneCasting(beat);
    const charactersForScene = charactersForBeat(registry, beat);

    // Only the people actually IN this scene get their reference attached. A face
    // attached to a scene that character isn't in is an invitation to put them
    // there. A scene with no recurring cast carries no reference sheet at all.
    const sceneRefs = casting === "recurring" ? refsForScene(characterRefs, beat, beat.sceneNumber) : [];
    const sceneRefParts = sceneRefs
      .filter((r) => r.base64)
      .map((r) => ({ inlineData: { mimeType: r.mimeType || "image/png", data: r.base64 } }));
    const sceneRefClause = refClause(sceneRefs);
    const isFinal = Number(beat.sceneNumber) === lastScene;

    return runStorySkill(
      `scene-builder-${beat.sceneNumber}`,
      `You are a SCENE BUILDER in the Optiq Story swarm. You compile ONE scene of an original short film into a single, copy-ready video-generation prompt in the canonical 14-block order. The prompt is the deliverable — everything the video model needs lives INSIDE it.

${MANDATORY_PROMPT_RULES}

${noCommercialMandate()}

${noMusicMandate({ allowDialogue: true })}

${densityLaw({ numScenes })}

═══ WHAT THIS SCENE IS FOR ═══
This scene's obligation in the story is "${beat.act || "unstated"}". It must visibly
do that job:
  • open     — something is already wrong, strange, funny or urgent in the FIRST
               FRAME, raising a question the viewer needs answered. Never an
               establishing shot, a landscape, or somebody walking in to begin.
  • want     — we see what somebody is trying to get, physically: reaching,
               checking, hiding, counting, going back for it. Nobody explains it.
  • turn     — the story stops being what we thought it was. The situation
               changes, not just the events.
  • escalate — the pressure is higher than the scene before it. Options close.
  • climax   — the biggest moment in the film. It should be the loudest, fullest,
               most physically committed ten seconds you write.
  • land     — the OUTCOME, on camera. Something is physically different and we
               watch it become different. This is an EVENT with the full beat
               count, not a smile, not a look, not a pull-back, not a fade.
${
        isFinal
          ? `\nTHIS IS THE FINAL SCENE OF THE FILM. It ends the story. There is no brand to
land, no logo to reveal, no tagline and no closing plate — the last thing the
audience sees is the story's outcome, and it is the beat they will remember.
Spend it.`
          : ""
      }

${
        casting === "no-people"
          ? `═══ THIS SCENE HAS NOBODY IN IT ═══
No person appears on camera in this scene. No faces, no hands, no bodies, nobody
passing in the background, nobody reflected in anything. Do NOT paste a Locked
Character Block — there is no character here, and adding one contradicts the film.

This is a deliberate choice and can be the strongest ten seconds in a short film,
but it is NOT permission to write a still life. The density law still binds:
things move, land, open, tip, spill, switch on, boil over, get pushed by wind, are
lifted by something out of frame. Write the events, and let the absence of people
be the composition rather than the content.`
          : casting === "fresh-faces"
            ? freshFaceDirective(castingSeed, beat.sceneNumber)
            : `- Paste each present character's Locked Character Block and wardrobe lock VERBATIM at the top (identity first — models weight early tokens). Their behavioural tell belongs in the ACTION block, performed, not described.`
      }

Scene-specific contract:
- fullPrompt is ${WORD_BUDGETS.scenePromptMin}–${WORD_BUDGETS.scenePromptMax} words. Describe every single visible thing: in a room, the walls, the marks on the walls, the floor, every item in frame; in a market, every stall and its wares.
- Paste any story ELEMENT anchor VERBATIM wherever that object appears, and honour its state for this scene. An element is never presented to camera.
- Paste the recurring set block VERBATIM if this scene uses a recurring set.
- The ABSOLUTE RULES block states the no-music law explicitly — "NO MUSIC of any kind" — alongside the other prohibitions.
- IF a character reference image is attached to this scene, the brief below carries an "ATTACHED CHARACTER REFERENCE" clause. Reproduce that clause inside the prompt, near the top, immediately after the character blocks. It is what tells the video model to take the person and NOT the studio backdrop the reference was shot on — without it, scenes come back grey and flatly lit. Do not paraphrase it.
- The SOUND block opens by restating that the clip carries NO MUSIC, then the locked sound spec VERBATIM, then this scene's diegetic event sounds (every physical event has a sound). Never name an instrument, a tempo, a BPM or a musical mood: there is no score in this clip.
- The ACTION block is timestamped beats implementing the storyline's planned cuts exactly, spread across the whole ten seconds. At least ${MIN_BEATS_PER_SCENE} separate timestamped beats, aiming for ${TARGET_BEATS_PER_SCENE}, each a change of state with its own physical verb. Five verbs minimum. Ten seconds narrating one continuous activity is a failed scene.
- The DIALOGUE block carries the scene's spoken lines with the language tag. Under ten words a line. People interrupt, deflect, answer a different question, or start a sentence and stop. Nobody states the theme, nobody explains the plot, and no line is exposition. If the scene is stronger silent, write no dialogue and say so.
- End with the CLOSING RESTATEMENT paragraph re-asserting identity, wardrobe, the key event, light, motion policy, and prohibitions — and re-asserting the no-music law a third and final time. Use wording to this effect: "${NO_MUSIC_RESTATEMENT}"
- Also return the scene's setting/action/dialogue/sound summaries as separate short fields for the UI (the fullPrompt stays complete on its own).

GOLD-STANDARD EXEMPLAR — READ THIS CAREFULLY: copy its DENSITY, its STRUCTURE and its block order. Do NOT copy its cast, its wardrobe or its complexions. The person in the exemplar is not in your film. Your characters are the ones in the consistency registry below, exactly as the registry describes them — including their specific complexions, which vary from character to character by design. If you find yourself writing "box braids", "deep warm dark-brown skin" or a rust camp-collar shirt, you are copying the exemplar's cast instead of building your own scene:
${exemplar}

BACKGROUND PEOPLE: every background person is explicitly Black Gambian, AND they vary from one another — different complexions across the real range (very deep blue-black through dark brown and golden brown to light caramel-brown), different hairstyles, a spread of ages and builds. A crowd of one identical face and one identical tone is the cliché the doctrine forbids.

HOUSE DOCTRINE:
${builderKnowledge}`,
      [
        ...sceneRefParts,
        {
          text: `THE PREMISE:
${JSON.stringify(brief, null, 2)}${sceneRefClause ? `\n\n${sceneRefClause}` : ""}

THE STORY THIS SCENE BELONGS TO:
Title: ${storyline.title}
Story arc: ${storyline.storyArc}
Emotional hook: ${storyline.emotionalHook}
What is at stake: ${storyline.whatIsAtStake}
How the film ends: ${storyline.theEnding}

THIS SCENE'S PLANNED BEAT (implement exactly):
${JSON.stringify(beat, null, 2)}

NEIGHBOUR BEATS (for seamless continuity):
Previous: ${neighborBefore ? JSON.stringify(neighborBefore) : "none — this is the opening scene, and it opens ON an event"}
Next: ${neighborAfter ? JSON.stringify(neighborAfter) : "none — this is the FINAL scene, and it lands the story's outcome on camera"}

THE CONSISTENCY REGISTRY (paste applicable locks VERBATIM):
Who is in this scene — casting mode "${casting}":
${
            casting === "no-people"
              ? "NOBODY. This scene has no people on camera at all. There are no character locks to paste."
              : casting === "fresh-faces"
                ? "One-off people who appear in no other scene and have no locks. Write them fresh, to the palette above. Do NOT paste any character block from this film's registry."
                : JSON.stringify(charactersForScene, null, 2)
          }

Story elements in this scene: ${JSON.stringify((registry.elements || []).filter((e) => (e.scenes || []).includes(beat.sceneNumber)), null, 2)}
Recurring sets: ${JSON.stringify((registry.recurringSets || []).filter((s) => (s.scenes || []).includes(beat.sceneNumber)), null, 2)}
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

  // ── SKILL 6: QUALITY GATES + REPAIR ───────────────────────────────────────
  const gateViolations = (scene, beat) => {
    const violations = [];
    const wc = countWords(scene.fullPrompt);
    if (wc < WORD_BUDGETS.scenePromptHardFloor) {
      violations.push(
        `fullPrompt is ${wc} words — below the ${WORD_BUDGETS.scenePromptMin}-word floor. Expand with authored specifics (environment items, background people, event sounds), never filler.`
      );
    }
    // Locks are only owed by scenes that carry the recurring cast. A fresh-faces
    // or empty scene demanding a Locked Character Block is the gate arguing with
    // the storyline, and the gate always wins — which puts the leads back into
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
    violations.push(...sceneSoundViolations(scene.fullPrompt, { allowDialogue: true }));
    // And the one gate the ad swarm does not have: this film sells nothing.
    violations.push(...scenePurityViolations(scene));
    // Adults only, platform-wide. Checked on every scene because this is the
    // last place it can be caught for free: after this the prompt goes to the
    // video model, and a rendered minor costs money to replace.
    violations.push(...minorViolations(scene.fullPrompt, `Scene ${scene.sceneNumber}`));
    return violations;
  };

  const verifierKnowledge = knowledgeFor("scene-verifier");
  scenes = await mapWithConcurrency(scenes, 3, async (scene) => {
    const beat = storyline.sceneBeats.find((b) => b.sceneNumber === scene.sceneNumber);
    const violations = gateViolations(scene, beat);
    if (violations.length === 0) return scene;
    try {
      const repaired = await runStorySkill(
        `scene-verifier-${scene.sceneNumber}`,
        `You are the SCENE VERIFIER of the Optiq Story swarm. A scene prompt failed the quality gates. Rewrite the scene to fix EVERY listed violation without weakening the writing — you repair, you never dilute. Keep the same story beat, the same cuts, the same 14-block order. Return the corrected scene in the same JSON schema.

${MANDATORY_PROMPT_RULES}

${noCommercialMandate()}

${noMusicMandate({ allowDialogue: true })}

${densityLaw({ numScenes })}

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
      console.error(`story scene-verifier failed for scene ${scene.sceneNumber}; keeping builder output`, err);
      return scene;
    }
  });

  scenes.sort((a, b) => a.sceneNumber - b.sceneNumber);

  const lead = (registry.characters || [])[0] || { name: "", lcb: "", wardrobe: "" };
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
    videoType: STORY_VIDEO_TYPE,
    castingShape: brief.castingShape || null,
    /**
     * The rendered character sheets, minus their bytes. Each carries the scenes
     * it belongs to, which is what lets the caller attach it per scene instead of
     * to everything — and what the script editor shows beside the scene.
     */
    characterRefs: characterRefs.map(({ base64, ...ref }) => ref),
    /**
     * Always empty here. A story project never collects brand materials — the
     * wizard skips that step entirely — but the caller reads this field for both
     * kinds of film, so it must exist.
     */
    materialPlacement: {},
    storyArc: storyline.storyArc,
    /** Story-only extras, kept on the project so the agent and editor can read them. */
    whatIsAtStake: storyline.whatIsAtStake || null,
    theEnding: storyline.theEnding || null,
    // Historical field name, shared with the ad swarm so stored projects, the
    // client Storyboard type and the agent's tools all keep addressing it by the
    // same name. Since the no-music mandate it holds the film's UNSCORED sound
    // bed (the locked silence + ambience), not a music spec.
    musicSpec: registry.soundSpec,
    ambienceSpec: registry.ambienceSpec,
  };
}

// ─── SCENE REVISION (used by storyRevise and the story agent) ───────────────

async function reviseStoryScene({
  vertexFetch,
  scenePrompt,
  revisionRequest,
  characterLock,
  styleHeader,
  previousScenePrompt,
  nextScenePrompt,
  musicSpec,
}) {
  const runStorySkill = makeSkillRunner(vertexFetch);
  const systemPrompt = `You are the SCENE REVISER of the Optiq Story swarm, revising one scene prompt of an original short film.
Apply the director's revision request to the original prompt while preserving everything that is locked.

${noCommercialMandate()}

${noMusicMandate({ allowDialogue: true })}

${densityLaw({})}

You MUST:
- NEVER turn this into an ad. There is no brand, no product, no tagline, no logo, no end card and no narrator in this film. If the request asks for one, deliver the intent inside the story instead and say nothing about a brand.
- NEVER reintroduce music. If the request asks for music ("make it feel triumphant with strings"), do NOT put it in the prompt: the score is composed separately afterwards. Deliver the feeling through the diegetic sound and the action instead.
- Keep moments, not mood. Physical verbs. Banned vocabulary stays banned.
- NEVER come back with fewer events than you started with. A revision that turns four timestamped beats into one continuous activity has made the scene worse whatever else it fixed. If the request genuinely calls for a calmer scene, make it calmer WITHOUT making it emptier.
- Keep the Locked Character Block, wardrobe lock and style header VERBATIM.
- Re-compile into the canonical 14-block order, ${WORD_BUDGETS.scenePromptMin}–${WORD_BUDGETS.scenePromptMax} words.
- CONTINUITY: the revised scene continues seamlessly from the previous scene prompt and hands off cleanly to the next — same characters, same element states, same recurring elements, same sound spec verbatim.
- When something broke in generation, reach for the STRUCTURAL fix (lock the camera, relocate, strip a face description, split cuts) before adjusting adjectives — diagnose against the failure catalog.
- Output ONLY the newly revised compiled prompt: no JSON, no preamble, no quotes.

${MANDATORY_PROMPT_RULES}

HOUSE DOCTRINE:
${knowledgeFor("scene-reviser")}`;

  const contextBlocks = [
    previousScenePrompt ? `Previous Scene Prompt (continue from it):\n${previousScenePrompt}` : null,
    nextScenePrompt ? `Next Scene Prompt (hand off to it):\n${nextScenePrompt}` : null,
    musicSpec ? `Locked Sound Spec (repeat verbatim in the sound block):\n${musicSpec}` : null,
  ]
    .filter(Boolean)
    .join("\n\n");

  return runStorySkill(
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
  runOptiqStoryPipeline,
  reviseStoryScene,
  MANDATORY_PROMPT_RULES,
  STORY_KIND,
  STORY_VIDEO_TYPE,
  scenesForLength,
  SCENE_SECONDS,
};
