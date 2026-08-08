// ─── OPTIQ DOCUMENTARY — THE AGENTIC DOCUMENTARY SWARM ──────────────────────
//
// THE DOCUMENTARY SANDBOX'S PIPELINE. A complete, independent third twin of
// functions/optiqSkills/pipeline.js and functions/optiqStory/pipeline.js.
//
// It shares no code with either on purpose. The ad pipeline is the one that
// earns and the story pipeline is tuned; nothing in this file may ever be able
// to change how they behave. Where the three look alike, that is a deliberate
// copy, not a shared dependency — they are free to diverge and they will.
//
// What a documentary IS, on this platform:
//   • Nothing is being sold. No brand, no product, no client.
//   • NOBODY SPEAKS ON CAMERA. The footage is silent and illustrative.
//   • Every word is NARRATION, written here as part of the outline, then
//     recorded by a TTS voice against the finished cut in audio post.
//   • The score is composed afterwards by Lyria 3 Pro, as in every other type.
//   • There are hardly ever recurring characters. The people are whoever is
//     doing the work in that ten seconds, described inside their own scene and
//     never carried anywhere else — which is why this sandbox renders NO
//     character reference sheets and spends no image quota.
//
// The swarm, and how it differs from the story swarm at each stage:
//
//   1. subject-analyst — reads the director's brief. Finds the SUBJECT, the
//                        question the film owes an answer to, and what of it can
//                        actually be filmed. Picks the film's shape. (Story
//                        version: finds a want, an obstacle and stakes.)
//   2. concept room    — four complete treatments built from three drawn angles,
//                        with the losers kept in the open. (Story version:
//                        dramatic engines.)
//   3. outline         — THE star skill. Turns the brief into ONE argument: a
//                        thesis, a question, evidence, a complication and a
//                        close that lands — AND writes the narration line for
//                        every scene, to the narrator's word budget. (Story
//                        version: writes dialogue instead.)
//   4. registry        — the consistency registry: the locked unscored WORDLESS
//                        sound spec, the ambience, the style header, recurring
//                        sets, the film's key objects, and (rarely) a locked
//                        block for the one subject the film follows.
//   5. scene-builder ×N — every scene's 1,500–2,000 word copy-ready prompt, in
//                        parallel, silent, with the registry embedded verbatim.
//   6. quality gates   — JS-enforced: word count, verbatim locks, sound spec,
//                        density, argument structure, AD PURITY and SPEECH
//                        PURITY. Failures go through one scene-verifier pass.

const {
  WORD_BUDGETS,
  NARRATION_BUDGETS,
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
  RECURRING_SUBJECT_CAP,
  adultsOnlyMandate,
  minorViolations,
} = require("./casting");
const {
  conceptDirective,
  densityLaw,
  outlineDensityViolations,
  scenePromptDensityViolations,
  MIN_BEATS_PER_SCENE,
  TARGET_BEATS_PER_SCENE,
} = require("./creative");
const {
  noMusicMandate,
  NO_MUSIC_RESTATEMENT,
  silenceSpecDirective,
  sceneSoundViolations,
  registrySoundViolations,
} = require("./soundPolicy");
const {
  documentaryStructureLaw,
  noSellingMandate,
  narratedFilmMandate,
  documentaryStructureViolations,
  documentaryPurityViolations,
  scenePurityViolations,
  ACTS,
} = require("./documentaryCraft");

const OPTIQ_TEXT_MODEL = "gemini-3.5-flash";

/**
 * The id this sandbox answers to. The router in functions/index.js sends only
 * this videoType here; everything else goes to the ad swarm or the story
 * sandbox.
 */
const DOCUMENTARY_VIDEO_TYPE = "short-film-documentary";

const SCENE_SECONDS = 10;

/**
 * What a documentary IS, stated once and pasted wherever a skill needs to know.
 *
 * The three flags at the bottom are read outside this sandbox: audio post uses
 * `dialogueInVideo` to decide the footage gain (0 here — the clips carry no
 * speech, so muting them costs nothing and guarantees nothing fights the
 * narrator), `ttsVoiceover` to decide whether to write and record narration at
 * all, and `noun` for the composer's brief.
 */
const DOCUMENTARY_KIND = {
  id: DOCUMENTARY_VIDEO_TYPE,
  noun: "documentary",
  register:
    "This is a DOCUMENTARY — a film that looks at something real and says something specific about it. There is NO brand, NO product, NO client and NOTHING being sold or promoted anywhere in it. NOBODY SPEAKS ON CAMERA: the footage is silent and illustrative, carried entirely by what we SEE happening, and every word in the finished film is a narrator's voiceover written and recorded afterwards and laid over the cut. There are no interviews, no talking heads and no on-screen text of any kind. It is a complete argument with a thesis, evidence, a complication and a close that happens on screen inside the run-time. The SUBJECT is the hero.",
  dialogueInVideo: false,
  ttsVoiceover: true,
  branded: false,
  /**
   * Read by audio post. Tells it that the narration was ALREADY WRITTEN by this
   * pipeline, scene by scene, and that its job is to fit that script to the
   * measured cut rather than to invent a voiceover by watching the pictures.
   * The other narrated type on the platform (the ad) has no script and does
   * invent one.
   */
  narrationFromScript: true,
};

// Rules 5, 9, 11b and 12 are where this differs from the story swarm's block:
// objects are subjects rather than story elements, the argument is the hero, and
// two whole prohibitions exist that no other sandbox has — no speech, and no
// on-screen text.
const MANDATORY_PROMPT_RULES = `NON-NEGOTIABLE PROMPT RULES (every single scene's fullPrompt MUST satisfy ALL of these — no exceptions):
1. LENGTH — every scene's fullPrompt is ${WORD_BUDGETS.scenePromptMin}–${WORD_BUDGETS.scenePromptMax} words. Every single thing visible in the frame is described. Density of authored specifics, not padding.
2. GAMBIAN ENVIRONMENT — the word "Gambian" and specific Gambian setting details (via the specificity ladder, Rung 4 minimum) appear explicitly in every prompt. The scene is unmistakably The Gambia, West Africa, unless the director's brief explicitly sets the film elsewhere — a documentary may be set anywhere, and if it is, that place gets the same rung-4 specificity instead.
3. BLACK PEOPLE — every single on-screen person is explicitly described with the keyword "Black" — a Black Gambian / Black West African person. Never leave skin tone implicit and never rely on "dark-skinned" alone; models have rendered under-described people as other ethnicities. State it plainly for everyone in frame, foreground and background. Each person's SPECIFIC complexion is then named from the palette, anywhere along the real Black Gambian range, from very deep blue-black through dark brown and golden brown to light caramel-brown. Do NOT flatten everyone to "rich, deep dark skin": that produces films that all star the same person.
3b. VARIETY — no two people in the same scene share a complexion, a hairstyle or a build, and the people are spread across ages rather than clustered on one. The doctrine's worked examples ("box braids", "deep warm dark-brown skin", the rust camp-collar shirt) teach you the FORMAT of a person description and must never be reproduced as this film's people.
4. NOBODY SPEAKS — this film's footage is SILENT of speech. No dialogue, no conversation, no greeting, no shouted line, no talking head, no interview, no piece to camera. Nobody's lips move in speech: not talking, not mouthing, not mid-sentence. State this explicitly in the ABSOLUTE RULES, in the SOUND block, and again in the CLOSING RESTATEMENT. The narration is a separate voiceover recorded against the finished cut, and a mouth moving on screen under it breaks the film. There is NO DIALOGUE BLOCK in this prompt and the scene's dialogue field is an empty string.
5. SUBJECTS, NOT PRODUCTS — nothing in this film is a product and nothing is being sold. The objects the film looks at (a boat, a knife, a sack, a machine, a tool) are SUBJECTS: each keeps the exact same anchor description verbatim in every scene it appears in. An object is looked at closely and honestly; it is never presented to the audience, never hero-shot, never turned label-out to camera. The test: is the camera showing this object as part of the WORLD, or presenting it to the AUDIENCE the way an advert does? Presented, it is an ad shot — cut it.
6. SCENE-ELEMENT CONSISTENCY — recurring physical objects and recurring sets keep an identical anchor description in every scene they appear in. An object never changes appearance between scenes.
7. SOUND CONSISTENCY — the locked sound spec (${WORD_BUDGETS.soundMin}–${WORD_BUDGETS.soundMax} words locking the film's UNSCORED, WORDLESS sound bed: the explicit absence of music, the explicit absence of speech, the quality of that silence, and the exact continuous ambience; NEVER instruments/tempo/BPM/musical progression) is repeated VERBATIM in the sound block of every scene, plus that scene's diegetic event sounds. The film must sound like one unbroken recording, and the bed must leave room for a narrator's voice on top of it.
8. BACKGROUND AUTHORSHIP — the environment plus every visible item and every person (age, clothing, position, what they are doing) gets ${WORD_BUDGETS.backgroundMin}–${WORD_BUDGETS.backgroundMax} words. Every unspecified element is a vote for the cliché.
9. THE ARGUMENT IS THE HERO — every scene advances ONE argument with an opening, a body and a close. This scene serves a specific obligation in that argument (the open, the question, context, evidence, the complication or the close) and it must visibly do that job. Nothing is being advertised, demonstrated, recommended or launched: there is no logo, no tagline, no call to action, no brand card and no closing plate anywhere in this film.
10. CUTS WITHIN SCENES — scenes are not always one continuous shot. When the outline plans cuts, the 10s scene contains those hard cuts, each with its own timestamped beat and shot description.
10b. DENSITY — every 10-second scene carries at least ${MIN_BEATS_PER_SCENE} distinct beats (aim for ${TARGET_BEATS_PER_SCENE}), each a CHANGE OF STATE with its own timestamp and its own physical verb. Ten seconds of one continuous activity — carrying a basin across a yard, stirring a pot, sweeping — is the dead footage this whole system exists to prevent. A camera move is not a beat. A mood is not a beat. Somebody continuing to do what they were already doing is not a beat.
11. NO MUSIC — the video model generates NO music, ever. No soundtrack, no melody, no instrumental bed, no humming or singing, no music from a radio/phone/speaker inside the scene, no sting on a cut. The clip carries ONLY the diegetic sound of the physical events in frame and the location's ambience. The score is composed separately afterwards by a dedicated music model and laid under the finished cut — music invented here cannot be removed from the clip's audio, collides with that score, and wastes the render. Stated in the ABSOLUTE RULES, restated at the top of the SOUND block, and restated again in the CLOSING RESTATEMENT: one mention does not survive a 2,000-word prompt.
12. NO ON-SCREEN TEXT — no captions, no lower thirds, no subtitles, no names, no dates, no statistics, no charts, no labelled maps, no title cards, no watermarks. The video model renders text as garbled shapes, and a documentary that leans on captions has given up on its pictures. State "no on-screen text of any kind" explicitly.
13. NOBODY LOOKS AT THE LENS — no posing, no smiling for the camera, no acknowledgement of being filmed. These are people who have not noticed the camera, doing the work they were doing anyway. No slow motion on people. No golden-hour reflex on a working scene.
14. ADULTS ONLY — every single person visible in this scene is 18 or older. No child, no baby, no toddler, no schoolchild, no teenager under 18 appears in any frame, in any role, foreground or background — not in a crowd, not in a doorway, not carried on somebody's back, not in a photograph on a wall. If the brief implied one, they are written as an adult of 18+ doing the same thing. State ages plainly where you state them, and never state one below 18.`;

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
  return async function runDocSkill(skillName, systemPrompt, userParts, responseSchema) {
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
            `Optiq Documentary skill "${skillName}" returned empty output (finishReason=${finishReason || "none"}${block ? `, blockReason=${block}` : ""})`
          );
        }
        if (!responseSchema) return text.trim();
        try {
          return JSON.parse(text);
        } catch (parseErr) {
          throw new Error(
            `Optiq Documentary skill "${skillName}" returned invalid JSON (finishReason=${finishReason || "none"}): ${parseErr.message}`
          );
        }
      } catch (err) {
        if (attempt < backoffs.length && isRetryableSkillError(err)) {
          const wait = backoffs[attempt] + Math.floor(Math.random() * 2000);
          console.warn(
            `Optiq Documentary skill "${skillName}" failed (attempt ${attempt + 1}); retrying in ${wait}ms:`,
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

// The analyst reads a documentary brief, so its fields are a documentary's: the
// subject, the question, and — crucially — what of it can actually be FILMED.
// There is deliberately no offeringType and no theOneThing: asking a model to
// name what is being sold is how it invents something to sell.
const BRIEF_SCHEMA = {
  type: "OBJECT",
  properties: {
    subject: { type: "STRING" },
    briefSummary: { type: "STRING" },
    theQuestion: { type: "STRING" },
    whyItMatters: { type: "STRING" },
    whatCanBeFilmed: { type: "ARRAY", items: { type: "STRING" } },
    whatCannotBeFilmed: { type: "ARRAY", items: { type: "STRING" } },
    audienceTakeaway: { type: "STRING" },
    toneRegister: { type: "STRING" },
    narrationLanguage: { type: "STRING" },
    setting: { type: "STRING" },
    filmShape: { type: "STRING", enum: ["subject-led", "one-subject"] },
    shapeRationale: { type: "STRING" },
  },
  required: [
    "subject", "briefSummary", "theQuestion", "whyItMatters", "whatCanBeFilmed",
    "whatCannotBeFilmed", "audienceTakeaway", "toneRegister", "narrationLanguage",
    "setting", "filmShape", "shapeRationale",
  ],
};

// `treatments` is plural and required because the whole point is divergence: a
// model asked to "consider several and return the winner" returns its first idea
// and calls it the winner. Making it show the losers is what forces the others
// to exist.
const CONCEPT_SCHEMA = {
  type: "OBJECT",
  properties: {
    treatments: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          title: { type: "STRING" },
          thesis: { type: "STRING" },
          logline: { type: "STRING" },
          angle: { type: "STRING" },
          openingImage: { type: "STRING" },
          eventDensity: { type: "ARRAY", items: { type: "STRING" } },
          theComplication: { type: "STRING" },
          theClose: { type: "STRING" },
          risk: { type: "STRING" },
        },
        required: [
          "title", "thesis", "logline", "angle", "openingImage", "eventDensity",
          "theComplication", "theClose", "risk",
        ],
      },
    },
    pick: { type: "STRING" },
    pickRationale: { type: "STRING" },
  },
  required: ["treatments", "pick", "pickRationale"],
};

// The outline's own shape. `act` on every beat is what makes the obligations
// checkable in JS — see documentaryStructureViolations. `narration` on every
// beat is the other half of this sandbox's whole job: the film's words, written
// here, at the narrator's reading speed, scene by scene.
const OUTLINE_SCHEMA = {
  type: "OBJECT",
  properties: {
    title: { type: "STRING" },
    thesis: { type: "STRING" },
    premise: { type: "STRING" },
    filmArc: { type: "STRING" },
    theClose: { type: "STRING" },
    narratorNote: { type: "STRING" },
    sceneBeats: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          sceneNumber: { type: "INTEGER" },
          /** Which obligation this scene serves. */
          act: { type: "STRING", enum: ACTS },
          purpose: { type: "STRING" },
          moment: { type: "STRING" },
          location: { type: "STRING" },
          /** Who this scene needs — see sceneCastingDirective() in ./casting.js. */
          castingMode: { type: "STRING", enum: ["recurring", "fresh-faces", "no-people"] },
          charactersPresent: { type: "ARRAY", items: { type: "STRING" } },
          /** The voiceover line laid over this scene. May be an empty string. */
          narration: { type: "STRING" },
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
          "charactersPresent", "narration", "cuts",
        ],
      },
    },
  },
  required: ["title", "thesis", "premise", "filmArc", "theClose", "narratorNote", "sceneBeats"],
};

// No `products` array, and `characters` is expected to be empty or near-empty:
// see RECURRING_SUBJECT_CAP in ./casting.js.
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
    /** Always an empty string in this sandbox. Nobody speaks on camera. */
    dialogue: { type: "STRING" },
    sound: { type: "STRING" },
    /** The voiceover line that plays over this scene, carried through verbatim. */
    narration: { type: "STRING" },
    fullPrompt: { type: "STRING" },
  },
  required: ["sceneNumber", "setting", "action", "dialogue", "sound", "narration", "fullPrompt"],
};

// ─── THE PIPELINE ───────────────────────────────────────────────────────────

/**
 * Build one documentary.
 *
 * Signature-compatible with runOptiqSkillsPipeline and runOptiqStoryPipeline so
 * functions/index.js can route to any of them without reshaping the job — but
 * `brandName`, `product`, `logo`, `materials`, `generateImage` and `storeImage`
 * are accepted and IGNORED. A documentary has no brand, and it renders no
 * character reference sheets: its people are one-offs written inside their own
 * scenes, so there is nobody for a sheet to keep consistent.
 */
async function runOptiqDocumentaryPipeline({
  vertexFetch,
  prompt,
  length,
  aspectRatio,
  onStage,
  /** Stable per film (the project id) so a retried generation re-draws the same
   * provocation and the same look palette rather than lurching mid-way. */
  castingSeed,
}) {
  const runDocSkill = makeSkillRunner(vertexFetch);
  const kind = DOCUMENTARY_KIND;
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
  // whole brief a documentary skill gets, and it is deliberately just the
  // director's subject.
  const briefText = `THE DIRECTOR'S BRIEF — the documentary they want made:
${prompt}

WHAT KIND OF FILM THIS IS: DOCUMENTARY
${kind.register}

The shape of the finished film:
- Run-time: ${length} → exactly ${numScenes} scenes of ${SCENE_SECONDS} seconds each
- Aspect ratio: ${aspectRatio || "16:9"}
- The footage is SILENT. Nobody speaks on camera, there are no interviews and no
  talking heads. The film's words are a NARRATOR'S VOICEOVER, written as part of
  this outline and recorded separately afterwards over the finished cut.
- There is NO brand, NO product and NO client. Nothing is being sold. If the
  brief above mentions a business or an object, it is a place or a thing the film
  looks at — never something to advertise.`;

  // ── SKILL 1: SUBJECT ANALYST ──────────────────────────────────────────────
  const brief = await runDocSkill(
    "subject-analyst",
    `You are the SUBJECT ANALYST, the first skill in the Optiq Documentary swarm — the agentic system that turns a director's brief into a documentary worth watching. Downstream skills (concept room, outline, registry, scene-builders) act strictly on YOUR reading, so be precise.

WHAT YOU ARE ANALYSING FOR: ${kind.register}

${noSellingMandate()}

${narratedFilmMandate()}

${adultsOnlyMandate()}

If the director's brief names or implies anyone under 18, say so plainly in your
reading and recast them as an adult of 18 or older doing the same thing. Never
refuse the brief over it and never quietly drop what it was about.

Your jobs:
1. Name the SUBJECT plainly, in the terms a film would actually be described in.
2. Say what the brief literally asks for, in one honest sentence.
3. THE QUESTION. What does this film owe an answer to? A documentary that answers
   nothing is a location with a camera in it. If the brief supplies no question,
   find the one hiding in it and say so.
4. WHY IT MATTERS — to a stranger, not to the people already involved. One line.
5. WHAT CAN BE FILMED. This is the most important field you produce. List the
   specific, physical, visible things this film can actually show: hands doing
   things, objects changing state, places, processes, weather, tools, movement.
   Every item must be something a camera could point at for ten seconds. Be
   concrete — "the tide going out over the flats at 5am" not "the coastal
   environment".
6. WHAT CANNOT BE FILMED. Just as important, and the thing this format gets wrong
   most: history, statistics, opinions, causes, futures, anything that happened
   before the camera arrived, anything requiring an interview, archive or a
   graphic. Those may live in the NARRATION and must never be asked of a picture.
7. What the audience should be left KNOWING when the last frame cuts. One line.
8. Choose the tone register, expressed as behaviour rather than adjective.
9. The SETTING. Default to The Gambia, West Africa, unless the brief clearly
   places the film somewhere else — a documentary may be set anywhere, and if the
   director asked for elsewhere, say so plainly and name the specific place.
10. Choose the NARRATION LANGUAGE (default: English; Wolof only when the brief is
    a purely local, mass-market film and the register calls for it).
11. Choose the FILM SHAPE. Two options:
   • "subject-led" — THE DEFAULT AND THE NORMAL ANSWER. Nobody recurs. The film is
     about a place, a process, a system or a trade, and the people in it are
     whoever is doing that work in that scene. This is what a documentary is.
   • "one-subject" — the film genuinely follows ONE named person all the way
     through, and their face has to be the same face in most scenes.
   READ THIS CAREFULLY: choosing "one-subject" makes the film more expensive to
   keep consistent and pulls it toward being a character piece, which is a
   different product on this platform. Choose it only when the brief is explicitly
   about one person. Put your real reasoning in shapeRationale.

HOUSE DOCTRINE:
${knowledgeFor("subject-analyst")}`,
    [{ text: briefText }],
    BRIEF_SCHEMA
  );

  // ── SKILL 2: THE CONCEPT ROOM ─────────────────────────────────────────────
  //
  // The step that stops the film being a topic. Best-effort: a failure here costs
  // the film its brainstorm, not its generation, and the outline skill still has
  // the analysis, the structure law and the density law.
  await reportStage("storylining");
  const creativeBrief = conceptDirective(castingSeed, { numScenes });
  let conceptRoom = null;
  try {
    conceptRoom = await runDocSkill(
      "concept-room",
      `${creativeBrief}

${densityLaw({ numScenes })}

${narratedFilmMandate()}

THE SUBJECT ANALYST'S READING:
${JSON.stringify(brief, null, 2)}

HOUSE DOCTRINE — §1.1 (moments not mood), §1.3 (the banned vocabulary) and Part XV
(documentary craft) are the standard your treatments are judged against:
${knowledgeFor("subject-analyst")}`,
      [{ text: briefText }],
      CONCEPT_SCHEMA
    );
    console.log(
      `[doc concept room] ${(conceptRoom.treatments || []).length} treatment(s), picked "${conceptRoom.pick}": ` +
        (conceptRoom.treatments || []).map((t) => t.title).join(" · ")
    );
  } catch (err) {
    console.error(
      "documentary concept-room failed; the outline skill writes unprompted:",
      String(err?.message || err).slice(0, 200)
    );
  }

  const winner =
    (conceptRoom?.treatments || []).find(
      (t) => normalize(t.title) === normalize(conceptRoom?.pick)
    ) || (conceptRoom?.treatments || [])[0] || null;
  const rejected = (conceptRoom?.treatments || []).filter((t) => t !== winner);

  const conceptSection = winner
    ? `═══ THE FILM YOU ARE MAKING (from the concept room — build THIS) ═══
Title: ${winner.title}
THE THESIS — the one sentence this film lands: ${winner.thesis}
Logline: ${winner.logline}
The angle (how this film looks at its subject): ${winner.angle}
The first frame: ${winner.openingImage}
The complication: ${winner.theComplication}
The close — what is physically happening in the last shot: ${winner.theClose}
The room's own worry about it: ${winner.risk}
Why this one was picked over the others: ${conceptRoom?.pickRationale || "(not given)"}

Things this treatment promised to show — the film must contain all of them, and
they are a floor, not a plan:
${(winner.eventDensity || []).map((e) => `  • ${e}`).join("\n")}

TREATMENTS THE ROOM REJECTED. They are here so you do not drift back into them
halfway through — if your outline starts resembling one of these, you have
abandoned the film you were given:
${rejected.map((t) => `  ✗ ${t.title} — ${t.logline}`).join("\n") || "  (none)"}`
    : "";

  // ── SKILL 3: THE OUTLINE — the star of Optiq Documentary ──────────────────
  //
  // It does two jobs that the other sandboxes split or skip: it builds the
  // argument, AND it writes the film's words. The narration cannot be written
  // later by somebody who has not seen the argument — that is precisely how a
  // documentary ends up as pictures with a voice explaining them.
  let outline = await runDocSkill(
    "outline",
    `You are the OUTLINE — the most important skill in the Optiq Documentary swarm, and the thing that decides whether anyone watches this film past the third second. You do TWO jobs, and they are one job: you build the film's ARGUMENT, and you write the film's NARRATION.

WHAT KIND OF FILM THIS IS: ${kind.register}

${noSellingMandate()}

${narratedFilmMandate()}

${adultsOnlyMandate()}

How you work:
1. ${
      winner
        ? `The concept room has already done the ideation and handed you a winner — build THAT film. Do not re-pitch it, do not soften it, and do not quietly revert to the safe version of this subject on your way to scene 3. Your job is execution: turn a one-line thesis into ${numScenes} scenes that show every thing it promised, plus the complication and the close it named.`
        : `Consider several angles and reject the literal one first. The literal reading of any brief ("show the thing the brief describes") is a topic with a camera pointed at it, and it produces empty film. Pick the ONE that says something specific you could be wrong about.`
    }
2. Make the argument in exactly ${numScenes} scenes × ${SCENE_SECONDS} seconds${
      numScenes >= 12
        ? ` — this is a long film, so the argument must be BIGGER: a second strand, a further complication, somewhere the film goes that the first half did not prepare the audience for. Do NOT pad it by showing the same thing from another angle, and do not tell a six-scene film slowly.`
        : `.`
    }
3. TAG EVERY SCENE with the obligation it serves, in its "act" field. This is not
   bookkeeping — it is how the film is checked for an opening, an argument and a
   close, and an untagged scene is a scene nobody decided the purpose of.
4. Plan the CUTS inside every scene, to the density law below. A ${SCENE_SECONDS}s scene is either ONE continuous locked shot (when the unbroken-ness IS the content) or 2–4 hard cuts, each a complete moment with its own verb.
5. Every beat must be a MOMENT — a filmable physical event, verbs about hands — never an atmosphere and never an idea. If a beat cannot be pointed at with a camera, it belongs in the narration, not in the picture. Write each scene's moment as the actual sequence of events: "she tips the basin, the water goes over the lip, the salt slumps and holds its shape, she scrapes the edge back with the side of her hand" rather than "a woman works with salt".
6. NOBODY SPEAKS. Not in any scene, not once. If you catch yourself writing "she tells him", "he calls out", "they discuss" — stop, and write what we SEE instead: the handover, the point, the shake of the head, the shove, the shrug, the walking away.
7. WRITE THE NARRATION, scene by scene, in the "narration" field of each beat.
   THIS IS THE FILM'S VOICE AND IT IS HALF YOUR JOB. The rules:
   • The narrator reads about ${NARRATION_BUDGETS.wordsPerSecond} words a second, and the line has to sit inside a
     GAP in the picture, not run the full ten seconds. Aim for about
     ${NARRATION_BUDGETS.targetWordsPerScene} words. NEVER more than ${NARRATION_BUDGETS.maxWordsPerScene}.
   • NEVER describe what the viewer can already see. The picture does that. Say
     the thing the picture cannot: what it costs, why it is done this way, how
     long it takes, what happens if it goes wrong, who it is for, what is at the
     end of it.
   • It is ONE CONTINUOUS PIECE read in order. Scene 4's line continues scene 3's.
     Read the whole thing back start to finish: it must sound like one person
     thinking, not like ${numScenes} captions.
   • LEAVE SCENES SILENT. At least one or two scenes carry no narration at all —
     an empty string. A film talked over end to end is exhausting, and the
     strongest moment in a documentary is usually the one the narrator shuts up
     for. The close often lands harder with no words on it at all.
   • Plain spoken language. Contractions. No advertising cliché, no rhetorical
     questions, no exclamation marks, no "in a world where", no "little did they
     know". Never state the thesis outright in the first scene; the film earns it.
   • Facts must come from the director's brief or be plainly observable. Do NOT
     invent statistics, dates, names, prices or histories. A documentary that
     makes things up is worse than one that says less.
8. Invent nothing that cannot be shot. Archive footage, historical re-enactment,
   maps, graphs and interviews do not exist in this pipeline.

${conceptSection}

${documentaryStructureLaw({ numScenes })}

${densityLaw({ numScenes })}

${sceneCastingDirective()}

THE SUBJECT ANALYST'S ANALYSIS (follow its shape decision, its question and its tone; build only from what it says CAN be filmed):
${JSON.stringify(brief, null, 2)}

HOUSE DOCTRINE:
${knowledgeFor("outline")}`,
    [{ text: briefText }],
    OUTLINE_SCHEMA
  );

  // ── GATE: STRUCTURE, DENSITY, CASTING, PURITY ─────────────────────────────
  //
  // The cheapest place in the whole pipeline to fix a broken film. A missing
  // close caught here is one repair call; caught after the scenes are built it is
  // N rebuilds of 2,000 words each, and caught after rendering it is the
  // director's money.
  const outlineFaults = [
    ...documentaryStructureViolations(outline, { numScenes }),
    ...outlineDensityViolations(outline, { numScenes }),
    ...sceneCastingViolations(outline.sceneBeats),
    ...documentaryPurityViolations(outline),
 
    ...minorViolations(JSON.stringify(outline.sceneBeats || []), "The outline"),
  ];
  if (outlineFaults.length > 0) {
    console.warn(
      `documentary outline produced ${outlineFaults.length} violation(s); repairing:`,
      outlineFaults.map((v) => v.slice(0, 140))
    );
    try {
      const repaired = await runDocSkill(
        "outline-doctor",
        `You are the OUTLINE DOCTOR. A documentary outline has been written and it has
failed the house gates for structure, density, casting, speech or commercial
purity. Fix EVERY violation below and change nothing else: the thesis, the title,
the arc and the angle all stay exactly as they are. You are repairing the spine
and punching up scenes, not re-making the film.

${noSellingMandate()}

${narratedFilmMandate()}

${documentaryStructureLaw({ numScenes })}

${densityLaw({ numScenes })}

${sceneCastingDirective()}

Return the COMPLETE outline in the same schema, with every scene present, in
order, every scene carrying its "act" tag and its narration field — not just the
ones you changed.`,
        [
          {
            text: `VIOLATIONS TO FIX:
${outlineFaults.map((v, i) => `${i + 1}. ${v}`).join("\n")}

THE OUTLINE TO REPAIR:
${JSON.stringify(outline, null, 2)}`,
          },
        ],
        OUTLINE_SCHEMA
      );
      // Only adopt a repair that kept the film: a doctor that returns three of
      // six scenes has not repaired the outline, it has deleted it.
      if ((repaired?.sceneBeats || []).length >= (outline.sceneBeats || []).length) {
        const remaining = [
          ...documentaryStructureViolations(repaired, { numScenes }),
          ...outlineDensityViolations(repaired, { numScenes }),
          ...sceneCastingViolations(repaired.sceneBeats),
          ...documentaryPurityViolations(repaired),
        ];
        console.log(
          `[doc outline doctor] ${outlineFaults.length} → ${remaining.length} violation(s) after repair`
        );
        outline = repaired;
      } else {
        console.warn(
          `[doc outline doctor] returned ${(repaired?.sceneBeats || []).length} scenes for a ` +
            `${(outline.sceneBeats || []).length}-scene film; keeping the original`
        );
      }
    } catch (err) {
      console.error("documentary outline-doctor failed; keeping the original outline", err);
    }
  }

  // ── SKILL 4: THE REGISTRY ─────────────────────────────────────────────────
  await reportStage("casting");
  // Only scenes cast "recurring" contribute names. Most documentaries produce an
  // empty set here, and that is the correct and expected outcome.
  const subjectNames = new Set();
  for (const beat of outline.sceneBeats || []) {
    if (sceneCasting(beat) !== "recurring") continue;
    for (const name of beat.charactersPresent || []) subjectNames.add(normalize(name));
  }
  const directive = castingDirective(castingSeed, Math.max(subjectNames.size, 4));

  const registrySystemPrompt = `You are the REGISTRY, the consistency authority of the Optiq Documentary swarm. You author the single source of truth that every scene-builder pastes VERBATIM. Redundancy is the mechanism: the video model has no memory, so consistency lives in your words.

${directive}

${noMusicMandate({ allowDialogue: false })}

${narratedFilmMandate()}

${noSellingMandate()}

═══ WHO YOU ARE LOCKING, AND WHO YOU ARE NOT ═══
A documentary locks almost nobody. Only scenes cast "recurring" have named
subjects, and only those subjects get a locked block. Scenes cast "fresh-faces"
are one-off people who appear nowhere else and are written fresh inside their own
scene — they do NOT belong in this registry, and inventing locks for them is how
a documentary ends up with the same faces in every shot. Scenes cast "no-people"
have nobody on camera at all.

The named subjects of this film, from the recurring scenes: ${
    subjectNames.size > 0
      ? [...subjectNames].join(", ")
      : "NOBODY — this film follows no individual, which is the normal shape for a documentary. Author an EMPTY characters array and put your effort into the sets, the objects and the sound spec"
  }.
A documentary may lock at most ${RECURRING_SUBJECT_CAP} recurring subject(s). Do not exceed that, and do not invent
subjects the outline did not name.

Author, with these EXACT word budgets:
1. CHARACTERS — for each named subject above (however few that is, including
   none): a locked block of ${WORD_BUDGETS.perCharacterMin}–${WORD_BUDGETS.perCharacterMax} words. Physical properties only: the keyword
   "Black" plus Gambian/West African, the SPECIFIC complexion and finish from the
   palette above, face shape, nose, lips, cheekbones, eyes, brows, hair
   (cut/length/texture/how worn), facial hair, age, height, build, and the one
   distinguishing marker. Plus a separate clothing lock — WORKWEAR, marked by the
   work, colours in CAPS, garments named precisely, one constant object. No
   temperament line and no behavioural tell: this is a real person doing real
   work, not a character being played.
2. ELEMENTS — the OBJECTS the film looks at, with the scenes they appear in and
   their exact state per scene if the film changes them. These are not products:
   nothing here is being sold or presented to the audience. A boat, a knife, a
   sack, a machine, a mould, a tool — described once, exactly, and identical in
   every scene it appears in.
3. RECURRING SETS — every location used by 2+ scenes gets a full locked set block
   (walls, floor, surfaces, every visible item, the state it is kept in).
4. ${silenceSpecDirective(WORD_BUDGETS.soundMin, WORD_BUDGETS.soundMax)}
5. AMBIENCE SPEC — one line locking the ambient bed. This is not music and is
   required: with neither a score nor an authored ambient bed, the model invents
   something to fill the gap, and what it invents is usually music. Pitch it so a
   narrator's voice sits cleanly on top.
6. STYLE HEADER — the film's visual contract (~60–100 words): documentary
   register, optics, motion policy (observational — the camera is a witness, not
   a participant), prohibitions (no lens-staring, no posing, no slow motion on
   people, no drone-and-sunset travelogue), and the text policy: NO on-screen text
   of any kind. There is no brand colour, no logo and no caption in this film. Do
   NOT include a dialogue-language tag — nobody speaks. State instead that the
   footage is silent of speech and the narration is added afterwards.

THE OUTLINE (source of truth for who/where/what):
${JSON.stringify(outline, null, 2)}

THE BRIEF:
${JSON.stringify(brief, null, 2)}

HOUSE DOCTRINE:
${knowledgeFor("registry")}`;

  let registry = await runDocSkill(
    "registry",
    registrySystemPrompt,
    [{ text: briefText }],
    REGISTRY_SCHEMA
  );

  // ── GATE: VARIETY + SOUND POLICY ──────────────────────────────────────────
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
      `documentary registry produced ${registryFaults.length} violation(s); repairing:`,
      registryFaults.map((v) => v.slice(0, 120))
    );
    try {
      registry = await runDocSkill(
        "registry-repair",
        `${registrySystemPrompt}

═══ THIS IS A REPAIR PASS ═══
Your previous registry failed the house gates. Fix EVERY violation below and
change nothing else. The elements and recurring sets stay as they were unless a
violation names them.`,
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
        // Not fatal: a slightly samey film is still a deliverable film, and
        // failing the whole generation over it would cost the director money.
        console.warn(
          `documentary registry-repair still leaves ${remaining.length} violation(s); shipping anyway:`,
          remaining.map((v) => v.slice(0, 120))
        );
      }
    } catch (err) {
      console.error("documentary registry-repair failed; keeping the original registry", err);
    }
  }

  // ── GATE: FILM SHAPE (reported, not repaired) ─────────────────────────────
  // By this point the outline is written and the registry is built around it, and
  // re-writing both to change the shape costs more than it saves. The log is what
  // tells us whether the analyst's bias toward subject-led films is landing.
  const shapeFaults = castingShapeViolations(brief.filmShape, outline.sceneBeats);
  if (shapeFaults.length > 0) {
    console.warn(
      `[doc film shape] the film did not come out as "${brief.filmShape}":`,
      shapeFaults.map((v) => v.slice(0, 160))
    );
  }

  // NOTE: there is no character-reference stage here, and that is deliberate.
  // The other two sandboxes render a portrait sheet per locked character so a
  // face survives nine clips. A documentary's people are one-offs by design, so
  // there is nobody to keep consistent, and rendering sheets would spend image
  // quota and minutes of the job's budget to solve a problem this film does not
  // have. In the rare "one-subject" film, that person's locked block does the
  // work in text, exactly as it did before reference sheets existed.

  // ── SKILL 5: SCENE BUILDERS (parallel) ────────────────────────────────────
  const builderKnowledge = knowledgeFor("scene-builder");
  const exemplar = exemplarScenePrompt();
  const lastScene = outline.sceneBeats.length
    ? Math.max(...outline.sceneBeats.map((b) => Number(b.sceneNumber) || 0))
    : numScenes;

  const buildScene = async (beat) => {
    const neighborBefore = outline.sceneBeats.find((b) => b.sceneNumber === beat.sceneNumber - 1);
    const neighborAfter = outline.sceneBeats.find((b) => b.sceneNumber === beat.sceneNumber + 1);
    const casting = sceneCasting(beat);
    const subjectsForScene = charactersForBeat(registry, beat);
    const narration = String(beat.narration || "").trim();
    const isFinal = Number(beat.sceneNumber) === lastScene;

    return runDocSkill(
      `scene-builder-${beat.sceneNumber}`,
      `You are a SCENE BUILDER in the Optiq Documentary swarm. You compile ONE scene of a documentary into a single, copy-ready video-generation prompt in the canonical block order. The prompt is the deliverable — everything the video model needs lives INSIDE it.

${MANDATORY_PROMPT_RULES}

${noSellingMandate()}

${narratedFilmMandate()}

${noMusicMandate({ allowDialogue: false })}

${densityLaw({ numScenes })}

═══ WHAT THIS SCENE IS FOR ═══
This scene's obligation in the argument is "${beat.act || "unstated"}". It must
visibly do that job:
  • open      — something is already happening in the FIRST FRAME, raising a
                question the viewer needs answered. Never an establishing shot, a
                landscape, a drone move, or somebody walking in to begin.
  • question  — the specific physical thing that makes the film's question
                unavoidable. Shown, never captioned.
  • context   — the one thing the audience must see to care. Kept short and
                concrete; context is where documentaries die.
  • evidence  — a specific, particular, physical thing that builds the case. Not
                a general impression of the subject: THIS pair of hands, THIS
                object, THIS quantity, THIS step.
  • turn      — the complication. The cost, the difficulty, the part that does not
                fit, made visible.
  • close     — the OUTCOME, on camera. Something finishes, leaves, stops, is
                sealed, is switched off, is carried away. This is an EVENT with
                the full beat count, not a wide shot at sunset.
${
        isFinal
          ? `\nTHIS IS THE FINAL SCENE OF THE FILM. It closes the argument. There is no brand
to land, no logo to reveal and no closing plate — the last thing the audience sees
is the film's own conclusion happening physically. Spend it.`
          : ""
      }

═══ THE NARRATION OVER THIS SCENE ═══
${
        narration
          ? `A narrator's voice will play over this clip, saying:
  "${narration}"

That line is NOT in the clip and must NOT appear in the prompt as speech, text or
a subtitle. It is here so you can build the picture around it:
• Do not have the picture repeat what the line says. If the line says how heavy
  the basin is, the picture shows her shifting her grip — not a caption of the
  weight.
• Leave the voice somewhere to sit. Plan the ten seconds so there is a stretch of
  at least two and a half seconds where the action is legible and settled rather
  than mid-scramble. Density does not mean chaos.
• Nobody in frame is reacting to the narration. They cannot hear it.`
          : `NO narration plays over this clip. It runs on its own sound. That makes the
picture entirely responsible for the beat, so make it the strongest ten seconds
you can — and it means the diegetic sound of the events in frame matters more
here than anywhere else in the film. Write it in detail.`
      }

${
        casting === "no-people"
          ? `═══ THIS SCENE HAS NOBODY IN IT ═══
No person appears on camera in this scene. No faces, no hands, no bodies, nobody
passing in the background, nobody reflected in anything. Do NOT paste a locked
subject block — there is nobody here.

This is a deliberate choice and is frequently the strongest ten seconds in a
documentary, but it is NOT permission to write a still life. The density law still
binds: things move, land, open, tip, spill, switch on, boil over, get pushed by
wind, are lifted by something out of frame. Write the events, and let the absence
of people be the composition rather than the content.`
          : casting === "fresh-faces"
            ? freshFaceDirective(castingSeed, beat.sceneNumber)
            : `- Paste the present subject's locked block and clothing lock VERBATIM at the top (identity first — models weight early tokens). They are working, not performing: no posing, no lens contact, no speech.`
      }

Scene-specific contract:
- fullPrompt is ${WORD_BUDGETS.scenePromptMin}–${WORD_BUDGETS.scenePromptMax} words. Describe every single visible thing: in a room, the walls, the marks on the walls, the floor, every item in frame; in a yard, every surface, every tool, every stack.
- Paste any ELEMENT anchor VERBATIM wherever that object appears, and honour its state for this scene. An object is never presented to camera.
- Paste the recurring set block VERBATIM if this scene uses a recurring set.
- The ABSOLUTE RULES block states, explicitly: NO MUSIC of any kind; NO SPEECH of any kind and no lips moving in speech; NO on-screen text of any kind; nobody looks at the lens.
- The SOUND block opens by restating that the clip carries NO MUSIC and NO SPEECH, then the locked sound spec VERBATIM, then this scene's diegetic event sounds (every physical event has a sound). Never name an instrument, a tempo, a BPM or a musical mood: there is no score in this clip.
- The ACTION block is timestamped beats implementing the outline's planned cuts exactly, spread across the whole ten seconds. At least ${MIN_BEATS_PER_SCENE} separate timestamped beats, aiming for ${TARGET_BEATS_PER_SCENE}, each a change of state with its own physical verb. Five verbs minimum.
- There is NO DIALOGUE BLOCK. Where the block order puts dialogue, this film puts an explicit statement that nobody speaks, no lips move in speech, and the clip contains no audible words. Return an EMPTY STRING for the scene's dialogue field.
- End with the CLOSING RESTATEMENT paragraph re-asserting the setting, the key events, light, motion policy and prohibitions — and re-asserting the no-music and no-speech laws a final time. Use wording to this effect: "${NO_MUSIC_RESTATEMENT}"
- Return the scene's narration field EXACTLY as given to you above, unchanged (an empty string if there is none). You do not write, edit or improve the narration; it belongs to the outline.
- Also return the scene's setting/action/sound summaries as separate short fields for the UI (the fullPrompt stays complete on its own).

GOLD-STANDARD EXEMPLAR — READ THIS CAREFULLY: copy its DENSITY, its STRUCTURE and its block order. Do NOT copy its subject, its place or its people. Nobody in the exemplar is in your film:
${exemplar}

BACKGROUND PEOPLE: every person in frame is explicitly Black Gambian, AND they vary from one another — different complexions across the real range (very deep blue-black through dark brown and golden brown to light caramel-brown), different hairstyles, a spread of ages and builds, all in real workwear. A crowd of one identical face and one identical tone is the cliché the doctrine forbids. None of them speak and none of them look at the camera.

HOUSE DOCTRINE:
${builderKnowledge}`,
      [
        {
          text: `THE BRIEF:
${JSON.stringify(brief, null, 2)}

THE FILM THIS SCENE BELONGS TO:
Title: ${outline.title}
THE THESIS: ${outline.thesis}
The arc: ${outline.filmArc}
How the film closes: ${outline.theClose}

THIS SCENE'S PLANNED BEAT (implement exactly):
${JSON.stringify(beat, null, 2)}

THIS SCENE'S NARRATION (carry through verbatim into the narration field; never into the picture):
${narration ? JSON.stringify(narration) : '"" (this scene is unnarrated)'}

NEIGHBOUR BEATS (for seamless continuity):
Previous: ${neighborBefore ? JSON.stringify(neighborBefore) : "none — this is the opening scene, and it opens ON an event"}
Next: ${neighborAfter ? JSON.stringify(neighborAfter) : "none — this is the FINAL scene, and it closes the argument on camera"}

THE REGISTRY (paste applicable locks VERBATIM):
Who is in this scene — casting mode "${casting}":
${
            casting === "no-people"
              ? "NOBODY. This scene has no people on camera at all. There are no locks to paste."
              : casting === "fresh-faces"
                ? "One-off people who appear in no other scene and have no locks. Write them fresh, to the palette above. Do NOT paste any locked block from this film's registry."
                : JSON.stringify(subjectsForScene, null, 2)
          }

Objects in this scene: ${JSON.stringify((registry.elements || []).filter((e) => (e.scenes || []).includes(beat.sceneNumber)), null, 2)}
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
  let scenes = await mapWithConcurrency(outline.sceneBeats.slice(0, numScenes), 3, async (beat) => {
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
        `fullPrompt is ${wc} words — below the ${WORD_BUDGETS.scenePromptMin}-word floor. Expand with authored specifics (environment items, people, event sounds), never filler.`
      );
    }
    // Locks are only owed by scenes that carry a recurring subject — rare here.
    const casting = sceneCasting(beat);
    if (casting === "recurring") {
      for (const c of charactersForBeat(registry, beat)) {
        if (!containsVerbatim(scene.fullPrompt, c.lcb)) {
          violations.push(`The locked block for ${c.name} is missing or paraphrased. Paste it VERBATIM: "${c.lcb}"`);
        }
      }
    } else {
      // …and the reverse: a lock that leaked into a scene it does not belong to
      // is how the film collapses back to the same faces everywhere.
      for (const c of registry.characters || []) {
        if (c.lcb && containsVerbatim(scene.fullPrompt, c.lcb)) {
          violations.push(
            `Scene ${scene.sceneNumber} is cast "${casting}" but pastes ${c.name}'s locked block. ` +
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
    // The density backstop. The outline gate is the real defence; this catches a
    // builder that was handed four beats and wrote one long activity anyway.
    violations.push(...scenePromptDensityViolations(scene));
    // The registry gate already cleaned the locked spec, but a builder can still
    // invent a score — or a voice — in its own writing, so every scene is checked.
    violations.push(...sceneSoundViolations(scene.fullPrompt, { allowDialogue: false }));
    // And the gates neither sibling sandbox has: this film sells nothing AND
    // nobody in it speaks.
    violations.push(...scenePurityViolations(scene));
    // Adults only, platform-wide. Checked on every scene because this is the
    // last place it can be caught for free: after this the prompt goes to the
    // video model, and a rendered minor costs money to replace.
    violations.push(...minorViolations(scene.fullPrompt, `Scene ${scene.sceneNumber}`));
    return violations;
  };

  const verifierKnowledge = knowledgeFor("scene-verifier");
  scenes = await mapWithConcurrency(scenes, 3, async (scene) => {
    const beat = outline.sceneBeats.find((b) => b.sceneNumber === scene.sceneNumber);
    const violations = gateViolations(scene, beat);
    if (violations.length === 0) return scene;
    try {
      const repaired = await runDocSkill(
        `scene-verifier-${scene.sceneNumber}`,
        `You are the SCENE VERIFIER of the Optiq Documentary swarm. A scene prompt failed the quality gates. Rewrite the scene to fix EVERY listed violation without weakening the writing — you repair, you never dilute. Keep the same beat, the same cuts, the same block order, and carry the narration field through unchanged. Return the corrected scene in the same JSON schema.

${MANDATORY_PROMPT_RULES}

${noSellingMandate()}

${narratedFilmMandate()}

${noMusicMandate({ allowDialogue: false })}

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
NARRATION (carry through unchanged): ${JSON.stringify(String(beat?.narration || ""))}

THE SCENE TO REPAIR:
${JSON.stringify(scene, null, 2)}`,
          },
        ],
        SCENE_SCHEMA
      );
      return repaired;
    } catch (err) {
      console.error(`documentary scene-verifier failed for scene ${scene.sceneNumber}; keeping builder output`, err);
      return scene;
    }
  });

  scenes.sort((a, b) => a.sceneNumber - b.sceneNumber);

  // The narration is the film's spine and the swarm is not allowed to lose it. A
  // builder or verifier that dropped or "improved" a line gets overruled here
  // from the outline, which is where narration is authored.
  const narrationByScene = new Map(
    (outline.sceneBeats || []).map((b) => [Number(b.sceneNumber), String(b.narration || "").trim()])
  );
  scenes = scenes.map((scene) => ({
    ...scene,
    dialogue: "",
    narration: narrationByScene.get(Number(scene.sceneNumber)) ?? String(scene.narration || "").trim(),
  }));

  const subject = (registry.characters || [])[0] || { name: "", lcb: "", wardrobe: "" };
  return {
    title: outline.title,
    concept: outline.premise || outline.thesis,
    /**
     * Present but usually empty. Every consumer of a project reads this field
     * (the script editor, the agent's tools, the reviser), so a documentary that
     * follows nobody still has to have it — it just carries nothing.
     */
    characterLock: {
      name: subject.name || "",
      description: subject.lcb || "",
      wardrobe: subject.wardrobe || "",
    },
    styleHeader: registry.styleHeader,
    scenes,
    isStory: false,
    isDocumentary: true,
    videoType: DOCUMENTARY_VIDEO_TYPE,
    castingShape: brief.filmShape || null,
    /** Always empty: this sandbox renders no reference sheets. See the note above. */
    characterRefs: [],
    /**
     * Always empty. A documentary project never collects brand materials — the
     * wizard skips that step entirely — but the caller reads this field for every
     * kind of film, so it must exist.
     */
    materialPlacement: {},
    storyArc: outline.filmArc,
    /** Documentary-only extras, kept on the project for the agent and the editor. */
    thesis: outline.thesis || null,
    theClose: outline.theClose || null,
    narratorNote: outline.narratorNote || null,
    /**
     * The film's words, in scene order. Audio post reads this instead of
     * inventing narration by watching the clips: the argument was written here,
     * by the skill that knows what the film is for, and re-deriving it from
     * pictures is how a documentary becomes a slideshow with a voice on it.
     */
    narrationScript: (outline.sceneBeats || [])
      .slice()
      .sort((a, b) => (a.sceneNumber || 0) - (b.sceneNumber || 0))
      .map((b) => ({ sceneNumber: Number(b.sceneNumber) || 0, text: String(b.narration || "").trim() })),
    // Historical field name, shared with the other two sandboxes so stored
    // projects, the client Storyboard type and the agent's tools all keep
    // addressing it by the same name. Since the no-music mandate it holds the
    // film's UNSCORED sound bed (the locked silence + ambience), not a music spec.
    musicSpec: registry.soundSpec,
    ambienceSpec: registry.ambienceSpec,
  };
}

// ─── SCENE REVISION (used by storyRevise and the documentary agent) ─────────

async function reviseDocumentaryScene({
  vertexFetch,
  scenePrompt,
  revisionRequest,
  characterLock,
  styleHeader,
  previousScenePrompt,
  nextScenePrompt,
  musicSpec,
  /** The narration over this scene, so the reviser builds the picture around it. */
  narration,
}) {
  const runDocSkill = makeSkillRunner(vertexFetch);
  const systemPrompt = `You are the SCENE REVISER of the Optiq Documentary swarm, revising one scene prompt of a documentary.
Apply the director's revision request to the original prompt while preserving everything that is locked.

${noSellingMandate()}

${narratedFilmMandate()}

${noMusicMandate({ allowDialogue: false })}

${densityLaw({})}

You MUST:
- NEVER turn this into an ad. There is no brand, no product, no tagline, no logo and no end card in this film. If the request asks for one, deliver the intent inside the observation instead and say nothing about a brand.
- NEVER add speech. Nobody speaks on camera, no lips move in speech, there are no interviews and no talking heads. If the request asks for someone to say something, that belongs in the NARRATION, not in the picture — leave the prompt silent and let the director change the narration instead.
- NEVER add on-screen text. No captions, no lower thirds, no dates, no charts, no titles.
- NEVER reintroduce music. If the request asks for music ("make it feel hopeful with strings"), do NOT put it in the prompt: the score is composed separately afterwards. Deliver the feeling through the diegetic sound and the action instead.
- Keep moments, not mood. Physical verbs. Banned vocabulary stays banned.
- NEVER come back with fewer events than you started with. A revision that turns four timestamped beats into one continuous activity has made the scene worse whatever else it fixed.
- Keep any locked subject block, clothing lock, style header and sound spec VERBATIM.
- Re-compile into the canonical block order, ${WORD_BUDGETS.scenePromptMin}–${WORD_BUDGETS.scenePromptMax} words.
- CONTINUITY: the revised scene continues seamlessly from the previous scene prompt and hands off cleanly to the next — same objects, same states, same sound spec verbatim.
- When something broke in generation, reach for the STRUCTURAL fix (lock the camera, relocate, strip a face description, split cuts) before adjusting adjectives — diagnose against the failure catalog.
- Output ONLY the newly revised compiled prompt: no JSON, no preamble, no quotes.

${MANDATORY_PROMPT_RULES}

HOUSE DOCTRINE:
${knowledgeFor("scene-reviser")}`;

  const contextBlocks = [
    previousScenePrompt ? `Previous Scene Prompt (continue from it):\n${previousScenePrompt}` : null,
    nextScenePrompt ? `Next Scene Prompt (hand off to it):\n${nextScenePrompt}` : null,
    musicSpec ? `Locked Sound Spec (repeat verbatim in the sound block):\n${musicSpec}` : null,
    narration
      ? `The narration playing over this scene (build the picture around it; it is NOT in the clip and must never appear as speech or text):\n"${narration}"`
      : `This scene is UNNARRATED — it runs on its own diegetic sound, so the picture and the sound design carry it alone.`,
  ]
    .filter(Boolean)
    .join("\n\n");

  return runDocSkill(
    "scene-reviser",
    systemPrompt,
    [
      {
        text: `Original Scene Prompt:\n${scenePrompt}\n\nRevision Request:\n${revisionRequest}\n\nLocked Subject (may be empty — most documentaries follow nobody):\n${JSON.stringify(
          characterLock
        )}\n\nStyle Header:\n${styleHeader}${contextBlocks ? `\n\n${contextBlocks}` : ""}`,
      },
    ],
    null
  );
}

module.exports = {
  runOptiqDocumentaryPipeline,
  reviseDocumentaryScene,
  MANDATORY_PROMPT_RULES,
  DOCUMENTARY_KIND,
  DOCUMENTARY_VIDEO_TYPE,
  scenesForLength,
  SCENE_SECONDS,
};
