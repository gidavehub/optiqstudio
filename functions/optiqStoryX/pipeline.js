// ─── OPTIQ STORY X — THE AGENTIC LONG-FORM SWARM ────────────────────────────
//
// THE EXPERIMENTAL STORY SANDBOX'S PIPELINE. A complete, independent twin of
// functions/optiqStory/pipeline.js, for long-form films that are PHOTOGRAPHED
// before they are filmed.
//
// It shares no code with the other three boxes on purpose. The ad pipeline is the
// one that earns, it works, and nothing in this file may ever be able to change
// how it behaves. Where they look alike, that is a deliberate copy, not a shared
// dependency — they are free to diverge and they will.
//
// WHAT THIS PIPELINE PRODUCES, AND WHAT IT DELIBERATELY DOES NOT
//
// It produces THE BLUEPRINT: the storyline, the cast registry, the world plan and
// every scene's full 1,500–2,000-word script. Then it STOPS. It renders no
// pictures and no video, and the film sits at `blueprint-ready` until the
// director reads it and presses Continue.
//
// That is the point of this film type. At 30 scenes the board is 100+ images and
// the clips are the whole budget, so the two expensive stages are gated behind a
// human who has read what they are about to buy. The board is stage 2
// (functions/shotBoardRun.js) and the render is stage 3.
//
// It also renders NO character reference sheets on its own. The sheets exist here
// only as inputs to the board's frames, so they are spent in stage 2 where the
// frames are, not in a stage the director might never continue past.
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
// What may be filmed. Enforced exactly like adults-only above — a mandate at
// every tier that invents content, plus a gate that reads the result back —
// because the video model refuses to photograph violence and says nothing when
// it does. See ./safety.js.
const { shootableMandate, graphicViolations } = require("./safety");
const {
  conceptDirective,
  densityLaw,
  dialogueLaw,
  dialogueViolations,
  filmDialogueViolations,
  storylineDensityViolations,
  scenePromptDensityViolations,
  MIN_BEATS_PER_SCENE,
  TARGET_BEATS_PER_SCENE,
  MIN_LINES_PER_SCENE,
  TARGET_LINES_PER_SCENE,
  MAX_LINES_PER_SCENE,
  MIN_LINES_PER_MINUTE,
  SPEAKING_SECONDS,
} = require("./creative");
// Only the PLAN is needed here. `characterRefPrompt` is used by the shot-board
// job when it photographs the sheets, and `refsForScene` / `refClause` exist to
// attach a sheet to a render — which this film type never does.
const { planCharacterRefs } = require("./characterRefs");
const {
  noMusicMandate,
  NO_MUSIC_RESTATEMENT,
  silenceSpecDirective,
  sceneSoundViolations,
  registrySoundViolations,
} = require("./soundPolicy");
const {
  isAdaptation,
  adaptationMandate,
  coverageViolations,
  repetitionViolations,
} = require("./adaptation");
const {
  storyStructureLaw,
  dramaMandate,
  noCommercialMandate,
  storyStructureViolations,
  storyPurityViolations,
  scenePurityViolations,
  ACTS,
} = require("./storyCraft");

const OPTIQ_TEXT_MODEL = "gemini-3.5-flash";

/**
 * The id this sandbox answers to. The router in functions/index.js sends only
 * this videoType here; every other one goes to one of the other three boxes.
 */
const STORYX_VIDEO_TYPE = "short-film-story-x";

const SCENE_SECONDS = 10;

/**
 * How long one blueprint pass may run before it saves what it has and asks to be
 * continued.
 *
 * The Cloud Function ceiling is 540s. At 30 scenes the scene-builders alone are
 * well past that, and a pass that dies at the ceiling has written nothing — the
 * director waits nine minutes and gets a failure. So the pass watches the clock,
 * stops cleanly between scenes, writes what it finished, and enqueues a
 * continuation that skips everything already built.
 *
 * 430s leaves ~110s of headroom for the write-back and the continuation enqueue,
 * which is generous on purpose: running out of time while SAVING is the one
 * failure mode that loses work.
 */
const BLUEPRINT_PASS_BUDGET_MS = 430 * 1000;

/**
 * What a story film IS, stated once and pasted wherever a skill needs to know.
 *
 * The ad swarm's FILM_KINDS table has three entries because an ad has three
 * shapes. This sandbox has exactly one kind of film, so it is a constant rather
 * than a lookup — and every skill in here can assume it.
 */
const STORY_KIND = {
  id: STORYX_VIDEO_TYPE,
  noun: "short film",
  register:
    "This is an ORIGINAL SHORT FILM — an entertainment piece, made to be watched for its own sake. There is NO brand, NO product, NO client and NOTHING being sold or promoted anywhere in it. It is a complete story with a hook, a want, a turn, a climax and an ending that happens on screen inside the run-time. Real people, real stakes, a specific outcome. No pitch, no tagline, no call to action, no logo, no end card and no narrator: the only words are the characters' own, spoken on camera. The STORY is the hero.",
  // People speak on camera and there is no separately-recorded narration. Both
  // are read by audio post — footage gain stays at 1 and no voiceover is written.
  dialogueInVideo: true,
  ttsVoiceover: false,
  branded: false,
};

/**
 * The rules every scene's long prompt must satisfy.
 *
 * READ THIS BEFORE CHANGING ANY OF THEM. In the other three sandboxes this block
 * governs the text that is SENT TO THE VIDEO MODEL, and every rule in it exists
 * to stop that model inventing a different-looking world.
 *
 * Here it governs the BLUEPRINT — the script the director reads and approves, and
 * the source the shot board photographs the world from. The rules therefore still
 * bind, and bind hard: a place cannot be photographed from a paragraph that never
 * said what is in it, and a complexion the registry never named is a complexion
 * the plates will each invent differently.
 *
 * What the video model actually receives is the FRAMED PROMPT, compiled from this
 * one after the pictures exist, and it obeys the OPPOSITE rule — it carries no
 * appearance at all, because the frames carry it better. See
 * `framedPromptDirective` in ./shotBoard.js. Do not "simplify" the rules below on
 * the grounds that the render no longer needs them; the render does not, and the
 * photography does.
 */
const MANDATORY_PROMPT_RULES = `NON-NEGOTIABLE PROMPT RULES (every single scene's fullPrompt MUST satisfy ALL of these — no exceptions):

0. READ THIS FIRST — THIS FILM IS PHOTOGRAPHED, AND THAT CHANGES WHAT A PROMPT IS FOR.
   Every scene of this film gets STILL PHOTOGRAPHS taken of it before any video is rendered: the place, the arrangement inside it, the objects, and one frame per camera setup. Those photographs are attached to the render and they are the ONLY thing the video model is shown of how anything looks.
   So how things LOOK is already settled, in pictures, far more exactly than any sentence can settle it. Your job is EVERYTHING THE PICTURES CANNOT CARRY: what happens, who says what, in what voice, what it sounds like, and where the camera goes.
   DESCRIBING APPEARANCE HERE ACTIVELY HARMS THE FILM. It gives the model two accounts of one thing — the photograph and your paragraph — and it reconciles them by inventing a third. That is what swaps outfits between shots, changes haircuts mid-scene and puts one character's clothes on another. This is not a theory; it is the failure this rule exists to stop.

1. THE BUDGET, AND WHERE IT GOES. ${WORD_BUDGETS.scenePromptMin}–${WORD_BUDGETS.scenePromptMax} words, spent roughly like this:
   • ~45% DIALOGUE — the lines themselves, every one, attributed, with each speaker's voice profile.
   • ~30% ACTION — timestamped beats, physical verbs, one change of state each.
   • ~15% SOUND — the ambience and a named noise for every physical event.
   • ~10% CAMERA and the identification block below.
   If your prompt is mostly description, you have written the wrong prompt. Count it.

2. IDENTIFY PEOPLE, DO NOT DESCRIBE THEM. Each character present gets ONE SHORT LINE: their NAME, WHERE THEY ARE in the frame ("seated left of the table", "standing in the doorway"), and — in a few words only — WHAT THEY ARE WEARING IN THIS SCENE, purely so two people can be told apart and their clothes cannot swap.
   That is the whole appearance budget. NO face. NO complexion. NO build. NO hair. NO height. NO age. NO distinguishing marks. The photographs carry all of it, exactly, and every word you add about it is a word arguing with them.
   Then state plainly: every person visible is one of the people in the attached frames; nobody else appears; each keeps the exact face and clothing they have there; and where the words and the frames disagree, THE FRAMES ARE RIGHT.

3. THE SETTING IS ONE LINE. Name the place and the time of day so the reader knows where they are. That is all. Do not inventory the walls, the floor, the furniture, the light, the clutter or the background people — all of that is in the plates, and re-describing it is the single fastest way to make the room drift between shots.
   The ONE exception: something that CHANGES during these ten seconds — a lamp switched on, a table overturned, rain starting — because a still cannot show a change. Say what changes, in a clause.

4. DIALOGUE IS THE BIGGEST BLOCK ON THE PAGE. See the dialogue law below. Every line, in order, attributed by name, with the speaker's locked VOICE PROFILE pasted verbatim before their first line. This is the film. Nothing here is optional and nothing may be summarised — "they argue about the money" is a stage direction, not dialogue, and the clip comes back with nobody speaking.

5. ACTION — TIMESTAMPED, PHYSICAL, AND UNDERNEATH THE TALKING. At least ${MIN_BEATS_PER_SCENE} beats (aim ${TARGET_BEATS_PER_SCENE}), each a CHANGE OF STATE with its own timestamp and its own physical verb. Hands do things while mouths move. A camera move is not a beat; a mood is not a beat; somebody continuing what they were already doing is not a beat.

6. CAMERA — where it sits and where it travels across each setup, and where the cuts fall. Short: the frames already show where the camera IS, so this is only where it GOES.

7. SOUND — the continuous ambience under the whole clip and how loud it sits under the voices, plus a specific named noise for every physical event in the beats. Something that touches, opens, closes, lands, tears, spills, starts or stops MAKES A NOISE, and an unnamed one comes back silent. The locked sound spec appears verbatim.

8. STORY ELEMENTS, NOT PRODUCTS — nothing in this film is being sold. Objects the story needs (a tin, a phone, a letter, a metal bar) are ELEMENTS: named where they are used, never presented to the audience, never hero-shot. The test: is the camera showing this object to the CHARACTERS or to the AUDIENCE? Shown to the audience, it is an ad shot — cut it.

9. THE STORY IS THE HERO — this scene serves a specific obligation (the open, the want, the turn, an escalation, the climax or the landing) and it must visibly do that job. There is no logo, no tagline, no call to action, no closing plate and no narrator anywhere in this film.

10. CUTS WITHIN SCENES — when the storyline plans cuts, the ten seconds contains those hard cuts, each with its own timestamped beat.

11. NO MUSIC — the video model generates NO music, ever. No soundtrack, no melody, no instrumental bed, no humming or singing, no music from a radio or phone inside the scene, no sting on a cut. The clip carries ONLY the diegetic sound of the physical events, the location's ambience, and the characters' spoken dialogue. The score is composed separately afterwards and laid under the finished cut. Stated in the ABSOLUTE RULES, restated at the top of the SOUND block, and restated again at the end: one mention does not survive a long prompt.

12. ADULTS ONLY — every person visible is 18 or older. No child, no toddler, no schoolchild, no teenager under 18 appears in any frame, in any role, foreground or background. If the story implied one, they are written as an adult of 18+ doing the same thing. Never state an age below 18.

13. THE CAMERA NEVER WATCHES THE VIOLENCE — the story keeps its teeth; the frame does not show the act. No weapon anywhere in shot (not held, not on a surface, not in the background), no blow/tackle/pin/grab/drag as it lands, nobody restrained or handcuffed, nobody cowering or with hands raised, no blood or wounds, and no crime performed on camera. Photograph the instant BEFORE, the aftermath, the face of somebody watching, or hold the frame while it happens just outside it — and NAME THE SOUND of it exactly, which is where the violence belongs and is completely unrestricted. Threats and menace in DIALOGUE are unrestricted too. This exists because the video model silently refuses to photograph violence and the scene comes back empty: a robbery filmed on the merchant's face renders, and the same robbery filmed on the raised club does not.

14. VOICE PROFILES — every character who SPEAKS has their locked VOICE PROFILE pasted VERBATIM in the DIALOGUE block before their first line: pitch, register, texture, pace, accent and their one habit of speech. This is the one consistency a picture CANNOT hold. A face survives thirty clips because thirty photographs say what it looks like; a voice survives them only because every prompt repeats the same words about it. A film whose lead sounds like four different people has failed as completely as one whose lead looks like four different people.`;

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

/**
 * Is this character NAMED in the text?
 *
 * The identification check that replaced the Locked Character Block check. On a
 * photographed film the face comes from the stills, so what a prompt owes is not
 * a description but a POINTER — and a pointer that never says the name points at
 * nothing.
 */
function namedIn(text, name) {
  const clean = String(name || "").trim();
  if (!clean) return true;
  const escaped = clean.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\b${escaped}\\b`, "i").test(String(text || ""));
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
          /**
           * THE SCENE'S ACTUAL SPOKEN LINES, written here at storyline time.
           *
           * The strongest lever there is on dialogue density, and the reason it
           * lives on the beat rather than being left to the scene-builder: a
           * storyline that plans two lines produces a two-line scene however
           * loudly the builder is told to write seven. Making the storyline
           * commit to the whole exchange up front is what actually fills the
           * film with talk — and it lets the gate catch a thin scene while
           * repairing it is one call instead of a 2,000-word rebuild.
           *
           * Format: "NAME: the line", in the order spoken.
           */
          dialogue: { type: "ARRAY", items: { type: "STRING" } },
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
          "charactersPresent", "dialogue", "cuts",
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
          /**
           * The locked VOICE PROFILE — the one consistency the photographs cannot
           * carry, and therefore the most load-bearing string in this registry.
           * Pasted verbatim into every scene this character speaks in, and it
           * survives into the framed prompt when every other description is cut.
           */
          voice: { type: "STRING" },
          /** One physical habit the audience learns to read. See §15.8. */
          tell: { type: "STRING" },
          scenes: { type: "ARRAY", items: { type: "INTEGER" } },
        },
        required: ["name", "role", "lcb", "wardrobe", "voice", "tell", "scenes"],
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
 * passing a placeholder the wizard never collected. `generateImage` / `storeImage`
 * are likewise accepted and ignored: this stage spends no image quota at all.
 *
 * RESUMABLE. At 30–60 scenes the scene-builders alone outlast the 540s function
 * ceiling, so the pass takes a `previous` blueprint and a deadline: it reuses
 * every scene already built, builds what it can in the time it has, and returns
 * `done: false` with the rest listed. The caller enqueues a continuation. Nothing
 * is ever rebuilt, so a long film converges across a few passes and the director
 * watches the count climb.
 */
async function runOptiqStoryXBlueprint({
  vertexFetch,
  prompt,
  length,
  aspectRatio,
  onStage,
  /** Stable per film (the project id) so a retried generation re-casts the same
   * people rather than silently swapping a face mid-way. */
  castingSeed,
  /**
   * What a previous pass already finished, straight off the project doc. The
   * expensive halves are the storyline+registry (which decide the film) and the
   * per-scene prompts (which are 2,000 words each); both are reused verbatim.
   */
  previous = null,
  /** Wall-clock budget for THIS pass. Defaults to one function invocation. */
  budgetMs = BLUEPRINT_PASS_BUDGET_MS,
}) {
  const runStorySkill = makeSkillRunner(vertexFetch);
  const kind = STORY_KIND;
  const numScenes = scenesForLength(length);

  // The clock this pass runs against. Checked BETWEEN units of work, never
  // inside one: abandoning a scene-builder call halfway spends the tokens and
  // keeps nothing.
  const startedAt = Date.now();
  const outOfTime = () => Date.now() - startedAt > budgetMs;

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

  // ── PREMISE, OR A STORY TO ADAPT? ─────────────────────────────────────────
  //
  // The single most consequential branch in this pipeline. A one-line premise
  // wants the concept room: invent, diverge, reject the literal reading, find
  // the film hiding in the idea. A FINISHED STORY wants none of that — running
  // the concept room over it produces a different film with the same title, and
  // deletes what the director actually wrote.
  //
  // See ./adaptation.js for the failure that made this necessary.
  const adapting = isAdaptation(prompt);
  const adaptation = adapting ? adaptationMandate({ numScenes, sourceStory: prompt }) : "";
  if (adapting) {
    console.log(
      `[storyX] ADAPTATION MODE — the director supplied a ${countWords(prompt)}-word story. ` +
        `The concept room is skipped; nothing is invented.`
    );
  }

  // ── WHAT A PREVIOUS PASS ALREADY DECIDED ──────────────────────────────────
  //
  // The film's SPINE — the premise reading, the storyline and the registry — is
  // decided once and never re-decided. Re-running the storyline skill on a
  // continuation would hand pass 2 a different film from the one pass 1 wrote
  // fifteen scenes of, and the director would watch their story change under
  // them. So a continuation reuses all three verbatim and spends its whole budget
  // on the scenes that are still missing.
  const reusedBrief = previous?.brief || null;
  const reusedStoryline = (previous?.storyline?.sceneBeats || []).length ? previous.storyline : null;
  const reusedRegistry = previous?.registry?.characters ? previous.registry : null;
  const reusingSpine = !!(reusedBrief && reusedStoryline && reusedRegistry);
  if (reusingSpine) {
    console.log(
      `[storyX blueprint] continuation: reusing the storyline (${reusedStoryline.sceneBeats.length} beats) ` +
        `and the registry (${(reusedRegistry.characters || []).length} character(s))`
    );
  }

  // ── SKILL 1: PREMISE ANALYST ──────────────────────────────────────────────
  const brief = reusedBrief || await runStorySkill(
    "brief-analyst",
    `You are the PREMISE ANALYST, the first skill in the Optiq Story swarm — the agentic system that turns a director's premise into an original short film worth watching. Downstream skills (concept room, storyline, casting-registry, scene-builders) act strictly on YOUR reading, so be precise.

WHAT YOU ARE ANALYSING FOR: ${kind.register}

${noCommercialMandate()}

${adultsOnlyMandate()}

${shootableMandate()}

${adaptation}

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
  // Skipped entirely on a continuation (the storyline it produces is already in
  // hand) AND on an adaptation (the story it would invent is not wanted — the
  // director already wrote one).
  if (!reusingSpine && !adapting) try {
    conceptRoom = await runStorySkill(
      "concept-room",
      `${creativeBrief}

${densityLaw({ numScenes })}

${dialogueLaw()}

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
  // Hoisted into a variable rather than passed inline, because the fidelity
  // re-roll below has to write the storyline AGAIN from exactly the same brief
  // — a re-write against a different system prompt would fix the faults by
  // producing a different film, which is the thing being fixed.
  const storylineSystemPrompt = `You are STORYLINE — the most important skill in the Optiq Story swarm, and the thing that decides whether anyone watches this film past the third second. Your only job: make the whole ${kind.noun} ONE complete story. Not a vibe, not a mood reel, not a situation — a story with a beginning, a middle and an end that happens on screen.

WHAT KIND OF FILM THIS IS: ${kind.register}

${noCommercialMandate()}

${adultsOnlyMandate()}

${shootableMandate()}

How you work:
1. ${
      adapting
        ? `THE DIRECTOR HAS ALREADY WRITTEN THIS STORY. It is reproduced in full above. Do not invent a story, do not improve theirs, do not find a better angle. Walk their story from its first sentence to its last, list every event in it, and allocate the ${numScenes} scenes across those events so that ALL of it is filmed. Every location they wrote gets filmed in that location. Every character they named is in it, and no character they did not name is. It ends the way they ended it.`
        : winner
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
7. DIALOGUE — AND THIS IS THE MOST IMPORTANT INSTRUCTION ON THIS PAGE. You do not sketch the dialogue here, you WRITE IT. Every beat's "dialogue" field carries that scene's actual spoken lines, in order, as "NAME: the line".

   ${MIN_LINES_PER_SCENE}–${MAX_LINES_PER_SCENE} lines per scene, aiming for ${TARGET_LINES_PER_SCENE}, and at least ${MIN_LINES_PER_MINUTE} across every 60 seconds of run-time. Roughly ${SPEAKING_SECONDS} of every 10 seconds has somebody talking.

   Do not write a scene and leave its lines for later — a scene planned with two lines gets built with two lines, and the film comes out silent. The talk IS the story: the argument, the accusation, the denial, the thing somebody should not have said. Write the whole exchange, back and forth, people cutting each other off.

   Still no exposition. Nobody says the theme, nobody narrates the backstory, and no line begins "ever since father died and left us the shop". They argue about what to do NOW, and the past leaks out sideways because somebody is angry enough to bring it up.

   A SILENT SCENE IS A FAILED SCENE in this film type. If you have written one, you have written the wrong scene.

${conceptSection}

${adaptation}

${dramaMandate()}

${storyStructureLaw({ numScenes })}

${densityLaw({ numScenes })}

${dialogueLaw()}

${sceneCastingDirective()}

THE PREMISE ANALYST'S ANALYSIS (follow its casting decision, its stakes and its tone):
${JSON.stringify(brief, null, 2)}

HOUSE DOCTRINE:
${knowledgeFor("storyline")}`;

  let storyline =
    reusedStoryline ||
    (await runStorySkill("storyline", storylineSystemPrompt, [{ text: briefText }], STORYLINE_SCHEMA));

  // ── GATE: STRUCTURE, DENSITY, CASTING, AD-PURITY ──────────────────────────
  //
  // The cheapest place in the whole pipeline to fix a broken film. A missing
  // ending caught here is one repair call; caught after the scenes are built it
  // is N rebuilds of 2,000 words each, and caught after rendering it is the
  // director's money.
  //
  // Skipped on a continuation. This storyline already passed on the pass that
  // wrote it, and re-gating a storyline that has scenes hanging off it risks the
  // doctor rewriting beats those scenes were built from.
  const storyFaults = reusingSpine ? [] : [
    ...storyStructureViolations(storyline, { numScenes }),
    ...storylineDensityViolations(storyline, { numScenes }),
    // The dialogue floor, checked at BOTH scales — the film's 30-per-60-seconds
    // and each scene's own count. This is the cheapest place in the pipeline to
    // catch a thin film: a repair here is one call, and the same fault caught
    // after thirty scene prompts have been written from this outline is thirty
    // rebuilds of 2,000 words each.
    ...filmDialogueViolations(storyline, { numScenes }),
    // ADAPTATION FIDELITY. Two failures that every other gate in this list waves
    // through, because each individual scene is perfectly well-formed:
    //   • the film quietly relocating into one easy room, and
    //   • the same beat written eleven times because the story ran out.
    // Both happened. See ./adaptation.js.
    ...repetitionViolations(storyline, { numScenes }),
    ...(adapting ? coverageViolations(storyline, prompt) : []),
    ...(storyline.sceneBeats || []).flatMap((beat) =>
      dialogueViolations(
        { dialogue: (beat.dialogue || []).join("\n") },
        { where: `Scene ${beat.sceneNumber ?? "?"}` }
      )
    ),
    ...sceneCastingViolations(storyline.sceneBeats),
    ...storyPurityViolations(storyline),
    ...minorViolations(JSON.stringify(storyline.sceneBeats || []), "The outline"),
    // The earliest place a beat that cannot be photographed can be caught. A
    // storyline that plans "he beats the merchant with a club" sends that staging
    // down through the scene builder, the world bible and the shot board, and by
    // the time the video model refuses it, four passes have agreed on it.
    ...graphicViolations(JSON.stringify(storyline.sceneBeats || []), "The outline"),
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

ONE EXCEPTION, AND IT OVERRIDES THE PARAGRAPH ABOVE. If the violations include
scenes concentrated in one location, scenes repeated, or the director's story
not being covered, then re-spreading the film IS the repair and you must do it
properly — move scenes to the places the source puts them, replace repeated
beats with the events that were skipped, and add the phases of the story that
never got filmed. That is not "changing more than you were asked"; it is the
only thing that fixes those faults.

${noCommercialMandate()}

${adaptation}

${dramaMandate()}

${storyStructureLaw({ numScenes })}

${densityLaw({ numScenes })}

${dialogueLaw()}

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

        // ── THE FIDELITY RE-ROLL ──────────────────────────────────────────
        //
        // A doctor asked to "fix these violations without changing anything
        // else" cannot fix a film that is in the wrong place. Re-spreading
        // thirty scenes across six locations is not a repair, it is the
        // storyline again — so when the fidelity faults survive the doctor, the
        // storyline is WRITTEN AGAIN, once, with the faults in front of it.
        //
        // Worth the extra text call by a wide margin: this is the difference
        // between the director's film and a different film with their title,
        // and the alternative is finding out after the board has been paid for.
        const fidelity = [
          ...repetitionViolations(storyline, { numScenes }),
          ...(adapting ? coverageViolations(storyline, prompt) : []),
        ];
        if (fidelity.length > 0) {
          console.warn(
            `[storyX fidelity] ${fidelity.length} fault(s) survived the doctor; re-writing the storyline:`,
            fidelity.map((v) => v.slice(0, 160))
          );
          try {
            const rewritten = await runStorySkill(
              "storyline-refidelity",
              `${storylineSystemPrompt}

═══ YOUR PREVIOUS ATTEMPT FAILED, AND IT FAILED ON THE THING THAT MATTERS MOST ═══
You already wrote this storyline once and it did not film the story you were
given. Read these faults, then write the film AGAIN from the source.

${fidelity.map((v, i) => `${i + 1}. ${v}`).join("\n\n")}

Before you write a single scene, do this: list the events of the director's
story in order, from its first sentence to its last. Count them. Then allocate
the ${numScenes} scenes across that list so every event on it gets filmed, in
the place the story puts it. If two scenes on your list would be the same
moment, one of them is wrong.`,
              [{ text: briefText }],
              STORYLINE_SCHEMA
            );
            if ((rewritten?.sceneBeats || []).length >= (storyline.sceneBeats || []).length) {
              const after = [
                ...repetitionViolations(rewritten, { numScenes }),
                ...(adapting ? coverageViolations(rewritten, prompt) : []),
              ];
              console.log(`[storyX fidelity] ${fidelity.length} → ${after.length} fault(s) after the re-write`);
              // Adopt only if it is genuinely better. A re-write that is worse
              // than what it replaced is a re-write that should not have run.
              if (after.length < fidelity.length) storyline = rewritten;
            }
          } catch (err) {
            console.error("[storyX fidelity] re-write failed; keeping the doctored storyline", err);
          }
        }
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
1c. THE VOICE PROFILE — 30–50 words per character, and THE MOST IMPORTANT THING YOU WRITE. Every other lock in this registry is backed up by a photograph downstream; this one is not. This film is photographed before it is filmed, so a face survives thirty separate clips because thirty stills say what it looks like — but a VOICE survives them only because every prompt repeats the same words about it. Get this wrong and the lead sounds like four different people across one film.
   Write, for each character: PITCH (low / mid / high, and where it sits for their age and build), TEXTURE (smoky, clear, reedy, gravelly, breathy, nasal), PACE (fast and clipped, unhurried, halting), VOLUME AT REST (soft-spoken, carries across a room), ACCENT AND LANGUAGE (Gambian English, Wolof-inflected, mission-school precise, coastal), and ONE SPEECH HABIT that is theirs alone — trailing the ends of sentences, answering before you finish, a laugh that arrives before the joke does, going quiet when angry instead of loud.
   Be concrete and be DIFFERENT for each of them. Two characters with "warm, measured, mid-range" voices are one character. Spread them the way the casting palette spreads complexions: contrast is what makes two people on a soundtrack legible as two people.
   Physical voice only. This is not a temperament note and not an acting direction — those belong in the scenes.
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

  let registry = reusedRegistry || await runStorySkill(
    "casting-registry",
    registrySystemPrompt,
    [{ text: briefText }],
    REGISTRY_SCHEMA
  );

  // ── GATE: CASTING VARIETY + SOUND POLICY ──────────────────────────────────
  // Both run before a single scene is built, because the registry is what every
  // scene-builder pastes verbatim: a monochrome cast or a music-specifying sound
  // spec caught here is ONE repair, caught later it is every scene in the film.
  //
  // Skipped on a continuation, and this one matters more than the storyline's:
  // a repair pass here may legitimately CHANGE a character's locked block, and
  // every scene an earlier pass already built pasted the OLD one verbatim. The
  // film would come out with two versions of the same person and the gate below
  // would then fail every reused scene for "missing" its lock.
  const registryFaults = reusingSpine ? [] : [
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

  // ── STAGE 4b: THE CAST SHEET PLAN (planned here, PHOTOGRAPHED IN STAGE 2) ──
  //
  // The other three sandboxes render their character sheets right here, on the
  // storyboard's critical path. This one deliberately does not, and it is the
  // difference that keeps the blueprint free.
  //
  // Two reasons, and the second is the real one:
  //
  //   1. Nothing in THIS film ever attaches a character sheet to a render. The
  //      sheets exist only as inputs to the board's frames, and the frames are
  //      stage 2. Spending them here would spend them in a stage the director may
  //      look at once and abandon.
  //
  //   2. The blueprint must cost nothing but text. It is the screen where the
  //      director decides whether to buy the film at all, and a stage that quietly
  //      renders eight images before they have read a word is a stage that has
  //      already charged them for a decision they have not made.
  //
  // So this writes the PLAN — who needs a sheet, and which scenes each belongs to.
  // functions/shotBoardRun.js takes it from `project.characterRefs`, finds no
  // bytes behind it, and photographs each one through its `regenerateCharacterRef`
  // callback at the moment it is first needed. The same path that heals a sheet
  // that went missing also creates the ones that never existed, so there is no
  // second code path to keep in step.
  const characterRefs = planCharacterRefs(registry, storyline.sceneBeats);
  if (characterRefs.length > 0) {
    console.log(
      `[storyX cast plan] ${characterRefs.length} sheet(s) planned, none photographed yet: ` +
        characterRefs.map((p) => p.name).join(", ")
    );
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

    // No reference images ride with a scene-builder call in this sandbox. The
    // sheets have not been photographed yet — they are stage 2's, along with the
    // frames they feed — so there is nothing to attach and nothing to write a
    // reference clause about. The builder works from the registry's words, which
    // is what it did before reference images existed and what the plate prompts
    // downstream will work from too.
    const isFinal = Number(beat.sceneNumber) === lastScene;

    return runStorySkill(
      `scene-builder-${beat.sceneNumber}`,
      `You are a SCENE BUILDER in the Optiq Story swarm. You compile ONE scene of an original short film into a single, copy-ready video-generation prompt in the canonical 14-block order. The prompt is the deliverable — everything the video model needs lives INSIDE it.

${MANDATORY_PROMPT_RULES}

${noCommercialMandate()}

${noMusicMandate({ allowDialogue: true })}

${densityLaw({ numScenes })}

${dialogueLaw()}

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
- NO REFERENCE IMAGE IS ATTACHED TO YOU, and none will be. This film is photographed AFTER this prompt is written, and FROM it: every place, every arrangement, every object and every camera setup is generated out of the words you are writing now. That is why the density rules above are not negotiable here. A wall you did not describe is a wall that two separate photographs will each guess at differently, and then the room changes between shots — which is the entire failure this film type exists to remove.
- The SOUND block opens by restating that the clip carries NO MUSIC, then the locked sound spec VERBATIM, then this scene's diegetic event sounds (every physical event has a sound). Never name an instrument, a tempo, a BPM or a musical mood: there is no score in this clip.
- The ACTION block is timestamped beats implementing the storyline's planned cuts exactly, spread across the whole ten seconds. At least ${MIN_BEATS_PER_SCENE} separate timestamped beats, aiming for ${TARGET_BEATS_PER_SCENE}, each a change of state with its own physical verb. Five verbs minimum. Ten seconds narrating one continuous activity is a failed scene.
- The DIALOGUE block is THE BIGGEST BLOCK IN THIS PROMPT and the reason the scene exists. It carries every one of the scene's ${MIN_LINES_PER_SCENE}–${MAX_LINES_PER_SCENE} lines (aim ${TARGET_LINES_PER_SCENE}) with the language tag, in the order spoken, each attributed by name — roughly ${SPEAKING_SECONDS} of the ten seconds with somebody talking. People interrupt, talk over each other, answer a different question, repeat themselves because they were ignored, and start the true sentence and stop. Nobody states the theme, nobody explains the plot, no line is exposition. A SILENT SCENE IS A FAILED SCENE here — the doctrine chapter that says otherwise was written for thirty-second adverts and does not apply.
- Also return those lines in the scene's short "dialogue" field, one per line as "NAME: the line". The gate counts them there, and the shooting brief that actually renders this scene is compiled from them.
- EVERY LINE IS ATTRIBUTED, AND EVERY SPEAKER'S VOICE PROFILE IS PASTED VERBATIM before their first line in this block. The registry below carries a "voice" for each character; reproduce it word for word, exactly as you reproduce the Locked Character Block. This is not optional and it is not padding: this film is photographed, so the pictures will hold every face still and NOTHING will hold the voices still except these words repeated identically in every scene. A line with no name attached comes back spoken by the wrong person.
- End with the CLOSING RESTATEMENT paragraph re-asserting identity, wardrobe, the key event, light, motion policy, and prohibitions — and re-asserting the no-music law a third and final time. Use wording to this effect: "${NO_MUSIC_RESTATEMENT}"
- Also return the scene's setting/action/dialogue/sound summaries as separate short fields for the UI (the fullPrompt stays complete on its own).

GOLD-STANDARD EXEMPLAR — READ THIS CAREFULLY: copy its DENSITY, its STRUCTURE and its block order. Do NOT copy its cast, its wardrobe or its complexions. The person in the exemplar is not in your film. Your characters are the ones in the consistency registry below, exactly as the registry describes them — including their specific complexions, which vary from character to character by design. If you find yourself writing "box braids", "deep warm dark-brown skin" or a rust camp-collar shirt, you are copying the exemplar's cast instead of building your own scene:
${exemplar}

BACKGROUND PEOPLE: every background person is explicitly Black Gambian, AND they vary from one another — different complexions across the real range (very deep blue-black through dark brown and golden brown to light caramel-brown), different hairstyles, a spread of ages and builds. A crowd of one identical face and one identical tone is the cliché the doctrine forbids.

HOUSE DOCTRINE:
${builderKnowledge}`,
      [
        {
          text: `THE PREMISE:
${JSON.stringify(brief, null, 2)}

THE STORY THIS SCENE BELONGS TO:
Title: ${storyline.title}
Story arc: ${storyline.storyArc}
Emotional hook: ${storyline.emotionalHook}
What is at stake: ${storyline.whatIsAtStake}
How the film ends: ${storyline.theEnding}

THIS SCENE'S PLANNED BEAT (implement exactly):
${JSON.stringify(beat, null, 2)}

═══ THIS SCENE'S DIALOGUE — ALREADY WRITTEN, REPRODUCE IT IN FULL ═══
${
            (beat.dialogue || []).length
              ? `${(beat.dialogue || []).join("\n")}

That is ${(beat.dialogue || []).length} line(s), and EVERY ONE of them goes into the DIALOGUE block of your prompt, word for word, in this order, attributed to the speaker named. Do not cut any. Do not shorten any. Do not summarise the exchange — "they argue about the money" is not dialogue, it is a stage direction, and the clip will come back with nobody saying anything.

You may add MORE lines if the exchange wants them (up to ${MAX_LINES_PER_SCENE}), and you should if it feels thin. You may not take any away.

Paste each speaker's locked VOICE PROFILE verbatim before their first line.`
              : `The storyline planned no lines for this scene, which in this film type is almost always a mistake. Write ${MIN_LINES_PER_SCENE}–${TARGET_LINES_PER_SCENE} lines of real exchange between the people present, consistent with the beat above — an interruption, an accusation, a denial, somebody talking over somebody. Only leave it silent if there is genuinely nobody on camera.`
          }

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

  // ── THE RESUMABLE BUILD ───────────────────────────────────────────────────
  //
  // Every scene a previous pass finished is kept exactly as it was. Only the
  // missing ones are built, and only for as long as this pass has clock. Anything
  // still missing when the budget runs out is reported to the caller, which
  // enqueues a continuation — so a 30-scene film converges over two or three
  // passes and never rebuilds a scene it already paid for.
  const beatsWanted = storyline.sceneBeats.slice(0, numScenes);
  const alreadyBuilt = new Map(
    (previous?.scenes || [])
      .filter((s) => s && s.fullPrompt && countWords(s.fullPrompt) >= WORD_BUDGETS.scenePromptHardFloor)
      .map((s) => [Number(s.sceneNumber), s])
  );
  const beatsToBuild = beatsWanted.filter((b) => !alreadyBuilt.has(Number(b.sceneNumber)));

  await reportStage("building", { scenesDone: alreadyBuilt.size, scenesTotal: numScenes });
  let scenesBuilt = alreadyBuilt.size;
  const missing = [];
  const freshScenes = [];

  // Three at a time, as everywhere else in these pipelines: enough to make the
  // wall-clock bearable, few enough that a 60-scene film does not walk straight
  // into the text model's per-minute cap.
  await mapWithConcurrency(beatsToBuild, 3, async (beat) => {
    // Checked before starting a scene rather than during one. A builder call
    // abandoned halfway has spent its tokens and kept nothing.
    if (outOfTime()) {
      missing.push(Number(beat.sceneNumber));
      return;
    }
    try {
      const scene = await buildScene(beat);
      freshScenes.push(scene);
      scenesBuilt += 1;
      await reportStage("building", { scenesDone: scenesBuilt, scenesTotal: numScenes });
    } catch (err) {
      // One scene that will not build must not sink the other twenty-nine. It is
      // reported as missing, and the continuation tries it again on a fresh
      // invocation — which is usually all a Vertex hiccup needs.
      console.error(
        `[storyX blueprint] scene ${beat.sceneNumber} failed to build; leaving it for the next pass:`,
        String(err?.message || err).slice(0, 200)
      );
      missing.push(Number(beat.sceneNumber));
    }
  });

  let scenes = [...alreadyBuilt.values(), ...freshScenes];

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
        // NO Locked Character Block check. This film is photographed, so the
        // face is carried by the stills and rule 2 forbids describing it here —
        // a gate demanding 200 words of face in a prompt told not to describe
        // faces would fight its own pipeline, and the gate always wins.
        //
        // What IS owed is identification: the character has to be NAMED, so the
        // model can tell which person in the attached frame is speaking.
        if (!namedIn(scene.fullPrompt, c.name)) {
          violations.push(
            `${c.name} is in this scene but is never named in the prompt. With no character sheets attached, ` +
              `the frames are the only statement of who is who — name them, say where they are in the frame, ` +
              `and give their wardrobe in a few words. Do NOT describe their face or build.`
          );
        }
        // The voice profile is only owed by a scene where this character SPEAKS —
        // a person standing silently in a doorway needs a face, not a voice, and
        // demanding one there is how a silent scene acquires dialogue to justify
        // it. Checked against the scene's dialogue field rather than the beat,
        // because that is where the builder actually put the lines.
        const speaks =
          c.voice &&
          new RegExp(`\\b${c.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(
            String(scene.dialogue || "")
          );
        if (speaks && !containsVerbatim(scene.fullPrompt, c.voice)) {
          violations.push(
            `${c.name} speaks in this scene but their locked VOICE PROFILE is missing or paraphrased from the DIALOGUE block. ` +
              `This film is photographed, so the pictures hold every face still and these words are the ONLY thing holding the voices still. ` +
              `Paste it VERBATIM: "${c.voice}"`
          );
        }
      }
    } else {
      // …and the reverse: a lock that leaked into a scene it does not belong to
      // is how the film collapses back to the same two faces everywhere.
      for (const c of registry.characters || []) {
        // Still worth catching: a builder that pasted a whole locked block into a
        // scene those people are not in has both described a face it was told not
        // to AND put the wrong person in the shot.
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
    // And the same backstop for TALK, which is the thing this film type is made
    // of. The storyline planned the lines; this catches a builder that was handed
    // seven and compiled two into the prompt, which is the failure that produces
    // a beautiful, quiet, unwatchable film.
    violations.push(...dialogueViolations(scene, { where: `Scene ${scene.sceneNumber}` }));
    // The registry gate already cleaned the locked spec, but a builder can still
    // invent a score in its own event-sound writing, so every scene is checked.
    violations.push(...sceneSoundViolations(scene.fullPrompt, { allowDialogue: true }));
    // And the one gate the ad swarm does not have: this film sells nothing.
    violations.push(...scenePurityViolations(scene));
    // Adults only, platform-wide. Checked on every scene because this is the
    // last place it can be caught for free: after this the prompt goes to the
    // video model, and a rendered minor costs money to replace.
    violations.push(...minorViolations(scene.fullPrompt, `Scene ${scene.sceneNumber}`));
    // Same reasoning as the minor gate above: the last place this is free. After
    // here the prompt goes to the video model, which refuses it without saying so
    // and bills for the attempt.
    violations.push(...graphicViolations(scene.fullPrompt, `Scene ${scene.sceneNumber}`));
    return violations;
  };

  const verifierKnowledge = knowledgeFor("scene-verifier");
  scenes = await mapWithConcurrency(scenes, 3, async (scene) => {
    // A scene an earlier pass already verified is not re-verified. It passed
    // against this same registry (the spine is never re-decided on a
    // continuation), so the only thing a second pass could produce is a
    // needlessly rewritten scene and another 2,000 tokens spent.
    if (alreadyBuilt.has(Number(scene.sceneNumber))) return scene;
    const beat = storyline.sceneBeats.find((b) => b.sceneNumber === scene.sceneNumber);
    const violations = gateViolations(scene, beat);
    if (violations.length === 0) return scene;
    // Out of clock: ship the builder's output rather than starting a repair the
    // pass cannot finish. The scene is complete and readable; it is the polish
    // that is missing, and the director can send it back from the blueprint.
    if (outOfTime()) {
      console.warn(
        `[storyX blueprint] scene ${scene.sceneNumber} has ${violations.length} violation(s) but the pass is out of ` +
          `time; shipping the builder's version`
      );
      return scene;
    }
    try {
      const repaired = await runStorySkill(
        `scene-verifier-${scene.sceneNumber}`,
        `You are the SCENE VERIFIER of the Optiq Story swarm. A scene prompt failed the quality gates. Rewrite the scene to fix EVERY listed violation without weakening the writing — you repair, you never dilute. Keep the same story beat, the same cuts, the same 14-block order. Return the corrected scene in the same JSON schema.

${MANDATORY_PROMPT_RULES}

${noCommercialMandate()}

${noMusicMandate({ allowDialogue: true })}

${densityLaw({ numScenes })}

${dialogueLaw()}

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

  // ── THE WORLD ─────────────────────────────────────────────────────────────
  //
  // What the film agrees on: its places, the dressed arrangements inside them,
  // the objects whose look must survive every cut, and the states each of those
  // passes through. One text call, and it is the plan the whole board is
  // photographed from.
  //
  // It runs HERE, at the end of the blueprint, rather than at the start of the
  // board — for two reasons. It needs the finished scene prompts to design from
  // (a place cannot be planned out of a beat that has not been written yet), and
  // the director should be able to read what their film's world will be before
  // they pay to photograph it.
  //
  // functions/shotBoardRun.js reads this straight off `shotBoard.world` and skips
  // its own world pass when it is there — see `reuseWorld` in that file. So this
  // does not duplicate work, it moves it in front of the gate.
  //
  // BEST-EFFORT. A blueprint with no world is still a complete, readable script,
  // and the board will design one for itself on the next stage. Failing the whole
  // blueprint over it would throw away thirty scene prompts.
  let world = previous?.world || null;
  if (!world && scenes.length > 0 && !outOfTime()) {
    try {
      await reportStage("worldbuilding");
      const brain = require("./shotBoard");
      world = await runStorySkill(
        "world-designer",
        `${brain.worldDirective({ numScenes, branded: false })}

HOUSE DOCTRINE:
${knowledgeFor("world-designer")}`,
        [
          {
            text: brain.worldBrief({
              scenes,
              registry,
              characterNames: (registry.characters || []).map((c) => c.name).filter(Boolean),
            }),
          },
        ],
        brain.WORLD_SCHEMA
      );
      const worldFaults = brain.worldViolations(world, scenes);
      if (worldFaults.length > 0) {
        console.warn(
          `[storyX world] ${worldFaults.length} violation(s) in the world plan; the board will repair them:`,
          worldFaults.map((v) => v.slice(0, 140))
        );
      }
      console.log(
        `[storyX world] ${(world.environments || []).length} place(s), ` +
          `${(world.settings || []).length} arrangement(s), ${(world.objects || []).length} object(s)`
      );
    } catch (err) {
      console.error(
        "[storyX world] the world pass failed; the shot board will design one itself:",
        String(err?.message || err).slice(0, 200)
      );
      world = null;
    }
  }

  const done = missing.length === 0 && scenes.length >= beatsWanted.length;
  if (!done) {
    console.log(
      `[storyX blueprint] pass finished with ${scenes.length}/${beatsWanted.length} scenes; ` +
        `${missing.length} left for the continuation: ${missing.sort((a, b) => a - b).join(", ")}`
    );
  }

  const lead = (registry.characters || [])[0] || { name: "", lcb: "", wardrobe: "" };
  return {
    /**
     * Is the blueprint COMPLETE? False means the caller must enqueue another pass
     * — everything below is still valid and must be saved, it is just not all of
     * the film yet.
     */
    done,
    /** Scene numbers this pass could not build. Empty when `done`. */
    missing: missing.sort((a, b) => a - b),
    /**
     * The film's spine, echoed back so a continuation can reuse it verbatim
     * instead of re-deciding what film this is. Persisted on the project under
     * `blueprint`; never shown to the director directly.
     */
    brief,
    storyline,
    registry,
    /** The world plan, read by functions/shotBoardRun.js in stage 2. */
    world,
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
    videoType: STORYX_VIDEO_TYPE,
    castingShape: brief.castingShape || null,
    /**
     * The cast sheet PLAN — names, prompts and the scenes each belongs to, with
     * no pictures behind them yet. The shot board photographs them in stage 2 and
     * writes the urls back onto these same entries.
     */
    characterRefs,
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

${dialogueLaw()}

You MUST:
- NEVER turn this into an ad. There is no brand, no product, no tagline, no logo, no end card and no narrator in this film. If the request asks for one, deliver the intent inside the story instead and say nothing about a brand.
- NEVER reintroduce music. If the request asks for music ("make it feel triumphant with strings"), do NOT put it in the prompt: the score is composed separately afterwards. Deliver the feeling through the diegetic sound and the action instead.
- Keep moments, not mood. Physical verbs. Banned vocabulary stays banned.
- NEVER come back with fewer events than you started with. A revision that turns four timestamped beats into one continuous activity has made the scene worse whatever else it fixed. If the request genuinely calls for a calmer scene, make it calmer WITHOUT making it emptier.
- THIS SCENE IS PHOTOGRAPHED. Still frames of it already exist and are attached to its render — they carry how every person, every object and the whole room LOOKS, and they carry it better than any sentence can. So do NOT add description of appearance, and do NOT restore any that is missing: no faces, no complexions, no builds, no hair, no wardrobe beyond the few words that tell two people apart, no inventory of the room. If the director's request is about how something LOOKS, the honest answer is that it is settled in the pictures and the scene needs re-photographing, not re-describing — say so rather than writing it in.
- KEEP AND STRENGTHEN what the pictures cannot carry: every line of DIALOGUE (never drop one, never shorten one), each speaker's VOICE PROFILE verbatim, the timestamped ACTION beats, the SOUND, and the CAMERA. These are what the prompt is for and they are where the words should go.
- If the prompt carries a SHOT BOARD block naming its attached frames, leave it exactly as it is. It is what tells the render which pictures it has.
- Re-compile at ${WORD_BUDGETS.scenePromptMin}–${WORD_BUDGETS.scenePromptMax} words, weighted the way rule 1 says: dialogue biggest, then action, then sound, then camera.
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
  runOptiqStoryXBlueprint,
  reviseStoryScene,
  MANDATORY_PROMPT_RULES,
  STORY_KIND,
  STORYX_VIDEO_TYPE,
  scenesForLength,
  SCENE_SECONDS,
  BLUEPRINT_PASS_BUDGET_MS,
};
