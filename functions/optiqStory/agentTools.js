// ─── OPTIQ SKILLS — THE STORYLINE AGENT'S TOOL SERVER ───────────────────────
// Every capability the storyline agent has over a film lives here, and nowhere
// else. Each tool is declared MCP-style — a name, a description the model reads,
// a JSON-Schema parameter block, and a `run` that actually does the work — so
// the model can only touch the film through a contract we wrote.
//
// The read tools (get_film, read_scene, search_film, check_film, get_doctrine)
// are free and instant. The write tools (rewrite_scene, patch_scene,
// rewrite_film, update_direction, propagate_locks) go through the SAME
// scene-reviser skill the script editor's "revise" box uses, so a prompt the
// agent touched still obeys every house rule: locks verbatim, 1,500–2,000
// words, the sound spec repeated, the Gambian environment, the canonical block
// order. The agent cannot write a scene prompt freehand — that is deliberate.
//
// One thing the agent deliberately CANNOT do: spend money. It never renders a
// clip and never touches the wallet. Rendering stays behind the user's own
// confirm-price modal.

const { reviseStoryScene } = require("./pipeline");
const { sceneSoundViolations } = require("./soundPolicy");
const { scenePurityViolations } = require("./storyCraft");
const {
  WORD_BUDGETS,
  countWords,
  doctrineIndexText,
  doctrineModule,
  DOCTRINE_MODULES,
} = require("./index");

// A scene rewrite is a 1,500–2,000 word generation. Three in flight is what the
// storyboard swarm uses against the same Vertex per-minute buckets.
const REWRITE_CONCURRENCY = 3;

const SUMMARY_MODEL = "gemini-3.5-flash";

// ─── SMALL HELPERS ──────────────────────────────────────────────────────────

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

function normalize(text) {
  return String(text || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function containsVerbatim(haystack, needle) {
  const n = normalize(needle);
  if (!n) return true;
  return normalize(haystack).includes(n);
}

function sceneAt(project, sceneNumber) {
  const scenes = project.scenes || [];
  const idx = scenes.findIndex((s) => Number(s.sceneNumber) === Number(sceneNumber));
  if (idx === -1) return { idx: -1, scene: null };
  return { idx, scene: scenes[idx] };
}

/**
 * The house gates, run against a scene as it is stored on the project.
 *
 * These are the same checks the storyboard swarm enforces at build time, minus
 * the ones that need the full casting registry (which isn't persisted — only
 * the lead's Locked Character Block survives onto the project doc). Giving the
 * agent this tool is what lets it answer "is my film still compliant?" with
 * facts instead of vibes.
 */
function sceneViolations(scene, project) {
  const violations = [];
  const prompt = scene.fullPrompt || "";
  const words = countWords(prompt);

  if (words < WORD_BUDGETS.scenePromptHardFloor) {
    violations.push(
      `Only ${words} words — under the ${WORD_BUDGETS.scenePromptMin}-word floor. Needs more authored specifics (environment items, background people, event sounds), never filler.`
    );
  }
  const lock = project.characterLock?.description || "";
  if (lock && !containsVerbatim(prompt, lock)) {
    violations.push(
      "The Locked Character Block is missing or paraphrased — it must appear verbatim, word for word, at the top of the prompt."
    );
  }
  if (project.musicSpec && !containsVerbatim(prompt, project.musicSpec)) {
    violations.push(
      "The locked sound spec is missing or paraphrased in the SOUND block — it must be repeated verbatim so the whole film sounds like one unbroken recording."
    );
  }
  // This film sells nothing, so the ad apparatus is a defect wherever it appears.
  violations.push(...scenePurityViolations({ fullPrompt: prompt }));
  if (!/\bblack\b/i.test(prompt)) {
    violations.push(
      'The keyword "Black" never appears — every on-screen person must be explicitly described as Black Gambian / Black West African.'
    );
  }
  if (!/gambia/i.test(prompt)) {
    violations.push(
      'The word "Gambian" never appears — the setting must be unmistakably The Gambia unless the brief set it elsewhere.'
    );
  }
  // The no-music law. Without this, check_film would call a scene that asks the
  // video model for a soundtrack "clean" — and that clip's invented score
  // collides with the track Lyria composes for the finished cut.
  violations.push(...sceneSoundViolations(prompt));
  return { sceneNumber: scene.sceneNumber, words, violations };
}

// ─── SCENE SUMMARY REFRESH ──────────────────────────────────────────────────
// The script deck shows four short beat cards per scene (setting / action /
// dialogue / sound). A rewritten prompt with stale beat cards is worse than no
// beat cards, so every write tool refreshes them from the new prompt.

const SUMMARY_SCHEMA = {
  type: "OBJECT",
  properties: {
    setting: { type: "STRING" },
    action: { type: "STRING" },
    dialogue: { type: "STRING" },
    sound: { type: "STRING" },
  },
  required: ["setting", "action", "dialogue", "sound"],
};

async function summariseScene(vertexFetch, fullPrompt) {
  try {
    const response = await vertexFetch(`/publishers/google/models/${SUMMARY_MODEL}:generateContent`, {
      contents: [{ role: "user", parts: [{ text: fullPrompt.slice(0, 24000) }] }],
      systemInstruction: {
        parts: [
          {
            text: `You read one compiled Optiq scene prompt and return the four short summary cards the script editor shows above it. One or two sentences each, present tense, concrete.
- setting: where we are.
- action: the physical beats, in order.
- dialogue: the spoken lines, or "No dialogue." if there are none.
- sound: what the scene sounds like.
Summarise only. Never invent anything the prompt does not contain.`,
          },
        ],
      },
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 2048,
        responseMimeType: "application/json",
        responseSchema: SUMMARY_SCHEMA,
      },
    });
    const text = (response.candidates?.[0]?.content?.parts || []).map((p) => p.text || "").join("");
    if (!text) return null;
    return JSON.parse(text);
  } catch (err) {
    // Stale beat cards are a cosmetic problem; a failed rewrite is not. Never
    // let the summary pass take the whole edit down with it.
    console.warn("scene summary refresh failed (non-fatal):", String(err?.message || err).slice(0, 160));
    return null;
  }
}

/** Runs the scene-reviser skill against one scene and returns the new prompt. */
async function reviseOne(ctx, scene, instruction) {
  const scenes = ctx.project.scenes || [];
  const { idx } = sceneAt(ctx.project, scene.sceneNumber);
  // No videoType argument: this sandbox only ever handles original stories, and
  // every one of them carries dialogue on camera.
  return reviseStoryScene({
    vertexFetch: ctx.vertexFetch,
    scenePrompt: scene.fullPrompt,
    revisionRequest: instruction,
    characterLock: ctx.project.characterLock || {},
    styleHeader: ctx.project.styleHeader || "",
    previousScenePrompt: scenes[idx - 1]?.fullPrompt || null,
    nextScenePrompt: scenes[idx + 1]?.fullPrompt || null,
    musicSpec: ctx.project.musicSpec || null,
  });
}

/**
 * Writes a set of rewritten scenes back to the project.
 *
 * Also clears each touched scene's `customPrompt` override. The script editor
 * renders `videoStatus[i].customPrompt || scene.fullPrompt`, so leaving a stale
 * override in place would mean the agent's work was saved but invisible.
 */
async function commitScenes(ctx, updates) {
  const scenes = [...(ctx.project.scenes || [])];
  const videoStatus = { ...(ctx.project.videoStatus || {}) };

  for (const { idx, scene } of updates) {
    scenes[idx] = scene;
    videoStatus[idx] = { ...(videoStatus[idx] || { status: "idle" }), customPrompt: scene.fullPrompt };
  }
  await ctx.saveProject({ scenes, videoStatus });
  return scenes;
}

// ─── THE TOOLS ──────────────────────────────────────────────────────────────

const TOOLS = [
  {
    name: "get_film",
    label: () => "Reading the film",
    description:
      "Read the whole film at a glance: title, concept, story arc, the locked character block, the visual style contract, the locked sound spec, and a one-line index of every scene with its word count and render status. Cheap — call this first whenever you need your bearings. It does NOT return the full scene prompts; use read_scene for those.",
    parameters: { type: "OBJECT", properties: {} },
    run: async (_args, ctx) => {
      const p = ctx.project;
      return {
        title: p.title,
        concept: p.concept,
        storyArc: p.storyArc || null,
        runTime: p.length,
        aspectRatio: p.aspectRatio,
        // No brand and no product: an original story has neither, and reporting
        // empty fields for them invites the agent to go looking for something to
        // sell. What it gets instead is the story's own spine.
        whatIsAtStake: p.whatIsAtStake || null,
        theEnding: p.theEnding || null,
        characterLock: p.characterLock || null,
        styleHeader: p.styleHeader || null,
        soundSpec: p.musicSpec || null,
        ambienceSpec: p.ambienceSpec || null,
        sceneCount: (p.scenes || []).length,
        scenes: (p.scenes || []).map((s, i) => ({
          sceneNumber: s.sceneNumber,
          setting: s.setting,
          action: String(s.action || "").slice(0, 240),
          words: countWords(s.fullPrompt),
          renderStatus: p.videoStatus?.[i]?.status || "idle",
        })),
      };
    },
  },

  {
    name: "read_scene",
    label: (a) => `Reading scene ${a.sceneNumber}`,
    description:
      "Read one scene in full — its four summary cards plus the entire compiled prompt, exactly as it will be sent to the video model. Use this before editing anything so you are working from the real text, not an assumption about it.",
    parameters: {
      type: "OBJECT",
      properties: {
        sceneNumber: { type: "INTEGER", description: "The scene's number as shown in the editor (1-based)." },
      },
      required: ["sceneNumber"],
    },
    run: async (args, ctx) => {
      const { scene, idx } = sceneAt(ctx.project, args.sceneNumber);
      if (!scene) return { error: `There is no scene ${args.sceneNumber} in this film.` };
      return {
        sceneNumber: scene.sceneNumber,
        setting: scene.setting,
        action: scene.action,
        dialogue: scene.dialogue,
        sound: scene.sound,
        words: countWords(scene.fullPrompt),
        renderStatus: ctx.project.videoStatus?.[idx]?.status || "idle",
        fullPrompt: scene.fullPrompt,
      };
    },
  },

  {
    name: "search_film",
    label: (a) => `Searching the film for "${a.query}"`,
    description:
      'Find which scenes mention something, without reading all of them. Matches case-insensitively across every scene prompt and summary and returns the scene numbers plus the surrounding excerpt. Use it when the user refers to a detail rather than a scene number — "the bit where he drops the tub", "the market stall", "the part about the price".',
    parameters: {
      type: "OBJECT",
      properties: {
        query: { type: "STRING", description: "Words or a phrase to look for." },
      },
      required: ["query"],
    },
    run: async (args, ctx) => {
      const needle = String(args.query || "").trim().toLowerCase();
      if (!needle) return { matches: [] };
      const matches = [];
      for (const scene of ctx.project.scenes || []) {
        const haystack = [scene.setting, scene.action, scene.dialogue, scene.sound, scene.fullPrompt]
          .filter(Boolean)
          .join("\n");
        const lower = haystack.toLowerCase();
        const excerpts = [];
        let from = 0;
        while (excerpts.length < 3) {
          const hit = lower.indexOf(needle, from);
          if (hit === -1) break;
          excerpts.push(haystack.slice(Math.max(0, hit - 180), hit + needle.length + 180).replace(/\s+/g, " "));
          from = hit + needle.length;
        }
        if (excerpts.length > 0) {
          matches.push({ sceneNumber: scene.sceneNumber, hits: excerpts.length, excerpts });
        }
      }
      return { query: args.query, sceneCount: matches.length, matches };
    },
  },

  {
    name: "check_film",
    label: () => "Checking every scene against the house rules",
    description:
      "Run the house quality gates over the film and report what fails, per scene: prompt word count against the 1,500–2,000 word budget, the Locked Character Block present verbatim, the locked sound spec present verbatim, the explicit 'Black' description of on-screen people, and the Gambian setting. Use it after a round of edits, or whenever the user asks whether the film is still sound.",
    parameters: {
      type: "OBJECT",
      properties: {
        sceneNumbers: {
          type: "ARRAY",
          items: { type: "INTEGER" },
          description: "Optional — check only these scenes. Omit to check the whole film.",
        },
      },
    },
    run: async (args, ctx) => {
      const wanted = args.sceneNumbers?.length ? new Set(args.sceneNumbers.map(Number)) : null;
      const results = (ctx.project.scenes || [])
        .filter((s) => !wanted || wanted.has(Number(s.sceneNumber)))
        .map((s) => sceneViolations(s, ctx.project));
      const failing = results.filter((r) => r.violations.length > 0);
      return {
        checked: results.length,
        clean: results.length - failing.length,
        wordBudget: `${WORD_BUDGETS.scenePromptMin}–${WORD_BUDGETS.scenePromptMax} words per scene (hard floor ${WORD_BUDGETS.scenePromptHardFloor})`,
        results,
        summary:
          failing.length === 0
            ? "Every checked scene passes the house gates."
            : `${failing.length} scene(s) fail at least one gate: ${failing.map((f) => f.sceneNumber).join(", ")}.`,
      };
    },
  },

  {
    name: "get_doctrine",
    label: (a) => `Reading the manual — ${String(a.module || "").replace(/-/g, " ")}`,
    description: `Read a module of the Optiq house film manual — the same doctrine the storyboard swarm was built on. Use it when the user asks why a rule exists, when you need the exact wording of a rule before applying it, or when you are diagnosing a generation that went wrong. Modules:\n${doctrineIndexText()}`,
    parameters: {
      type: "OBJECT",
      properties: {
        module: {
          type: "STRING",
          enum: Object.keys(DOCTRINE_MODULES),
          description: "Which module to read.",
        },
      },
      required: ["module"],
    },
    run: async (args) => {
      const text = doctrineModule(args.module);
      if (!text) return { error: `Unknown doctrine module "${args.module}".` };
      return { module: args.module, text };
    },
  },

  {
    name: "rewrite_scene",
    label: (a) => `Rewriting scene ${a.sceneNumber}`,
    description:
      "Rewrite one scene's compiled prompt to carry out an instruction, then save it. The rewrite runs through the house scene-reviser, so the Locked Character Block, wardrobe lock, style header and sound spec survive verbatim, continuity with the neighbouring scenes is preserved, and the prompt is recompiled to the canonical block order at 1,500–2,000 words. Give a rich, specific instruction — everything the reviser needs must be in it, because it cannot see this conversation.",
    parameters: {
      type: "OBJECT",
      properties: {
        sceneNumber: { type: "INTEGER", description: "Which scene to rewrite (1-based)." },
        instruction: {
          type: "STRING",
          description:
            "What to change and why, written as a full direction to the reviser. Name the physical events you want, not the mood. Say what must stay untouched.",
        },
      },
      required: ["sceneNumber", "instruction"],
    },
    run: async (args, ctx) => {
      const { scene, idx } = sceneAt(ctx.project, args.sceneNumber);
      if (!scene) return { error: `There is no scene ${args.sceneNumber} in this film.` };

      const newPrompt = await reviseOne(ctx, scene, args.instruction);
      const summary = await summariseScene(ctx.vertexFetch, newPrompt);
      const updated = { ...scene, ...(summary || {}), fullPrompt: newPrompt };
      await commitScenes(ctx, [{ idx, scene: updated }]);

      const check = sceneViolations(updated, ctx.project);
      return {
        saved: true,
        sceneNumber: scene.sceneNumber,
        wordsBefore: countWords(scene.fullPrompt),
        wordsAfter: check.words,
        gateViolations: check.violations,
        note: "The scene is saved and live in the editor. If it was already rendered, the old clip still shows until the user re-renders it — tell them.",
      };
    },
  },

  {
    name: "rewrite_film",
    label: (a) =>
      a.sceneNumbers?.length ? `Reworking scenes ${a.sceneNumbers.join(", ")}` : "Reworking the whole storyline",
    description:
      "Apply one direction across many scenes at once — this is how you work on the entire storyline rather than a single beat. Every targeted scene goes through the house scene-reviser in parallel with the same instruction plus its own continuity context, then all of them are saved together. Use it for film-wide changes: a different tone, a new ending, a turn that has to land earlier, a character trait carried through, an object whose state has to track across the film. For a change to one beat, use rewrite_scene instead.",
    parameters: {
      type: "OBJECT",
      properties: {
        instruction: {
          type: "STRING",
          description:
            "The film-wide direction, written so it makes sense applied to any one scene. State the through-line, not scene-specific detail.",
        },
        sceneNumbers: {
          type: "ARRAY",
          items: { type: "INTEGER" },
          description: "Optional — restrict the pass to these scenes. Omit to rework every scene.",
        },
      },
      required: ["instruction"],
    },
    run: async (args, ctx) => {
      const wanted = args.sceneNumbers?.length ? new Set(args.sceneNumbers.map(Number)) : null;
      const targets = (ctx.project.scenes || [])
        .map((scene, idx) => ({ scene, idx }))
        .filter(({ scene }) => !wanted || wanted.has(Number(scene.sceneNumber)));

      if (targets.length === 0) return { error: "No scenes matched." };

      let done = 0;
      const results = await mapWithConcurrency(targets, REWRITE_CONCURRENCY, async ({ scene, idx }) => {
        try {
          const newPrompt = await reviseOne(ctx, scene, args.instruction);
          const summary = await summariseScene(ctx.vertexFetch, newPrompt);
          const rewritten = { ...scene, ...(summary || {}), fullPrompt: newPrompt };
          // Committed one at a time, not in one batch at the end: a nine-scene
          // pass can run for minutes, and if the function hit its ceiling
          // mid-flight a single trailing write would throw away every scene
          // that had already finished. This way the director keeps the work,
          // and watches the scenes land in the editor as they go.
          await commitScenes(ctx, [{ idx, scene: rewritten }]);
          done += 1;
          await ctx.progress(`${done} of ${targets.length} scenes reworked`);
          return { idx, scene: rewritten, ok: true };
        } catch (err) {
          done += 1;
          await ctx.progress(`${done} of ${targets.length} scenes reworked`);
          return { idx, scene, ok: false, error: String(err?.message || err).slice(0, 200) };
        }
      });

      const succeeded = results.filter((r) => r.ok);
      return {
        saved: succeeded.length > 0,
        rewritten: succeeded.map((r) => r.scene.sceneNumber),
        failed: results.filter((r) => !r.ok).map((r) => ({ sceneNumber: r.scene.sceneNumber, error: r.error })),
        gateViolations: succeeded
          .map((r) => sceneViolations(r.scene, ctx.project))
          .filter((c) => c.violations.length > 0),
      };
    },
  },

  {
    name: "patch_scene",
    label: (a) => `Patching scene ${a.sceneNumber}`,
    description:
      "Make a surgical, literal find-and-replace inside one scene's compiled prompt — no model call, no rewrite. Use it ONLY for small factual corrections where the surrounding writing must not move: a misspelt character name, a wrong number, a colour, the size of an object. Anything that changes what happens in the scene must go through rewrite_scene instead, or the prompt will fall out of the canonical structure.",
    parameters: {
      type: "OBJECT",
      properties: {
        sceneNumber: { type: "INTEGER" },
        find: { type: "STRING", description: "The exact text to replace. Must appear in the prompt." },
        replace: { type: "STRING", description: "What to put in its place." },
        all: { type: "BOOLEAN", description: "Replace every occurrence (default true)." },
      },
      required: ["sceneNumber", "find", "replace"],
    },
    run: async (args, ctx) => {
      const { scene, idx } = sceneAt(ctx.project, args.sceneNumber);
      if (!scene) return { error: `There is no scene ${args.sceneNumber} in this film.` };
      const prompt = scene.fullPrompt || "";
      if (!prompt.includes(args.find)) {
        return {
          error: `"${args.find}" does not appear in scene ${args.sceneNumber} exactly as written. Read the scene and copy the text precisely, or use rewrite_scene.`,
        };
      }
      const occurrences = prompt.split(args.find).length - 1;
      const newPrompt =
        args.all === false ? prompt.replace(args.find, args.replace) : prompt.split(args.find).join(args.replace);

      const updated = { ...scene, fullPrompt: newPrompt };
      await commitScenes(ctx, [{ idx, scene: updated }]);
      return {
        saved: true,
        sceneNumber: scene.sceneNumber,
        replaced: args.all === false ? 1 : occurrences,
        words: countWords(newPrompt),
      };
    },
  },

  {
    name: "update_direction",
    label: () => "Updating the film-wide direction",
    description:
      "Change the film-wide fields: title, concept, the Locked Character Block (name / description / wardrobe), the visual style contract, the locked sound spec, the ambience spec. Only pass the fields you are changing. IMPORTANT: changing a lock here does NOT change the scenes — the old wording is still pasted verbatim inside every scene prompt. After changing the character lock, style header or sound spec, call propagate_locks so the film actually agrees with itself.",
    parameters: {
      type: "OBJECT",
      properties: {
        title: { type: "STRING" },
        concept: { type: "STRING", description: "The one-paragraph pitch shown under the title." },
        characterName: { type: "STRING" },
        characterDescription: {
          type: "STRING",
          description: `The Locked Character Block — ${WORD_BUDGETS.perCharacterMin}–${WORD_BUDGETS.perCharacterMax} words of physical properties only: the keyword "Black" plus Gambian/West African, skin tone and finish, face shape, nose, lips, cheekbones, eyes, brows, hair, facial hair, age, height, build, and one temperament line.`,
        },
        characterWardrobe: { type: "STRING", description: "The wardrobe lock — colours in CAPS, garments named precisely." },
        styleHeader: { type: "STRING", description: "The visual contract, ~60–100 words: register, optics, motion policy, prohibitions, language tag, text policy." },
        musicSpec: {
          type: "STRING",
          description: `The locked sound spec — ${WORD_BUDGETS.soundMin}–${WORD_BUDGETS.soundMax} words describing the exact background music (instruments, tempo, mood, progression) or the exact silence.`,
        },
        ambienceSpec: { type: "STRING" },
      },
    },
    run: async (args, ctx) => {
      const patch = {};
      const changed = [];
      const lock = { ...(ctx.project.characterLock || { name: "", description: "", wardrobe: "" }) };
      let lockTouched = false;

      if (args.title) { patch.title = args.title; changed.push("title"); }
      if (args.concept) { patch.concept = args.concept; changed.push("concept"); }
      if (args.styleHeader) { patch.styleHeader = args.styleHeader; changed.push("style header"); }
      if (args.musicSpec) { patch.musicSpec = args.musicSpec; changed.push("sound spec"); }
      if (args.ambienceSpec) { patch.ambienceSpec = args.ambienceSpec; changed.push("ambience spec"); }
      if (args.characterName) { lock.name = args.characterName; lockTouched = true; }
      if (args.characterDescription) { lock.description = args.characterDescription; lockTouched = true; }
      if (args.characterWardrobe) { lock.wardrobe = args.characterWardrobe; lockTouched = true; }
      if (lockTouched) { patch.characterLock = lock; changed.push("character lock"); }

      if (changed.length === 0) return { error: "Nothing to change — pass at least one field." };
      await ctx.saveProject(patch);

      const needsPropagation = lockTouched || !!args.styleHeader || !!args.musicSpec;
      return {
        saved: true,
        changed,
        needsPropagation,
        note: needsPropagation
          ? "The scenes still carry the OLD wording verbatim. Call propagate_locks now, or tell the user the film is out of sync."
          : "No scene text depends on these fields.",
      };
    },
  },

  {
    name: "propagate_locks",
    label: () => "Pushing the new locks through every scene",
    description:
      "Re-run the scenes so they carry the film's CURRENT locks verbatim — the Locked Character Block, the wardrobe lock, the style header and the sound spec. Call this straight after update_direction changes any of them. It rewrites only the locked passages' wording; the story, the beats and the cuts stay exactly as they are.",
    parameters: {
      type: "OBJECT",
      properties: {
        sceneNumbers: {
          type: "ARRAY",
          items: { type: "INTEGER" },
          description: "Optional — restrict to these scenes. Omit to sync the whole film.",
        },
      },
    },
    run: async (args, ctx) => {
      const p = ctx.project;
      const wanted = args.sceneNumbers?.length ? new Set(args.sceneNumbers.map(Number)) : null;
      const targets = (p.scenes || [])
        .map((scene, idx) => ({ scene, idx }))
        .filter(({ scene }) => !wanted || wanted.has(Number(scene.sceneNumber)))
        // Nothing to do for a scene that already carries every current lock.
        .filter(({ scene }) => sceneViolations(scene, p).violations.length > 0);

      if (targets.length === 0) {
        return { saved: false, note: "Every scene already carries the current locks verbatim. Nothing to sync." };
      }

      const instruction = `SYNC PASS — the film's locks have changed. Do not change the story, the beats, the cuts, the dialogue or the camera. Replace ONLY the locked passages with the current wording, pasted verbatim:

LOCKED CHARACTER BLOCK (paste verbatim at the top of the prompt, replacing any older description of this character):
${p.characterLock?.description || "(none)"}

WARDROBE LOCK (verbatim):
${p.characterLock?.wardrobe || "(none)"}

STYLE HEADER (verbatim, in the STYLE block):
${p.styleHeader || "(none)"}

LOCKED SOUND SPEC (verbatim, opening the SOUND block, before this scene's own event sounds):
${p.musicSpec || "(none)"}

Everything else in the prompt stays as it is. Recompile in the canonical block order at ${WORD_BUDGETS.scenePromptMin}–${WORD_BUDGETS.scenePromptMax} words.`;

      let done = 0;
      const results = await mapWithConcurrency(targets, REWRITE_CONCURRENCY, async ({ scene, idx }) => {
        try {
          const newPrompt = await reviseOne(ctx, scene, instruction);
          const synced = { ...scene, fullPrompt: newPrompt };
          // Per-scene commit, same reasoning as rewrite_film.
          await commitScenes(ctx, [{ idx, scene: synced }]);
          done += 1;
          await ctx.progress(`${done} of ${targets.length} scenes synced`);
          return { idx, scene: synced, ok: true };
        } catch (err) {
          done += 1;
          await ctx.progress(`${done} of ${targets.length} scenes synced`);
          return { idx, scene, ok: false, error: String(err?.message || err).slice(0, 200) };
        }
      });

      const succeeded = results.filter((r) => r.ok);
      return {
        saved: succeeded.length > 0,
        synced: succeeded.map((r) => r.scene.sceneNumber),
        failed: results.filter((r) => !r.ok).map((r) => ({ sceneNumber: r.scene.sceneNumber, error: r.error })),
        stillFailing: succeeded
          .map((r) => sceneViolations(r.scene, ctx.project))
          .filter((c) => c.violations.length > 0),
      };
    },
  },

  // ─── PRODUCTION TOOLS ─────────────────────────────────────────────────────
  // The agent used to be able to write the film and nothing else — a director who
  // wanted the scene they'd just fixed actually shot had to leave the room and go
  // to the script editor. These three close that gap. They are the only tools
  // that touch money or long-running jobs, so each one reports plainly what it
  // started and what it cost.

  {
    name: "render_scene",
    label: (a) => `Rendering scene ${a.sceneNumber}`,
    description:
      "Shoot one scene: send its current compiled prompt to the video model and start the render. Costs the director money unless the film's prepaid allowance still covers it, so ONLY call this when they have actually asked for a render in this conversation — never speculatively, and never 'while you're at it'. The render runs in the background and takes a minute or two; it does not block you. Say what it cost.",
    parameters: {
      type: "OBJECT",
      properties: {
        sceneNumber: { type: "INTEGER", description: "The scene's number as shown in the editor (1-based)." },
      },
      required: ["sceneNumber"],
    },
    run: async (args, ctx) => {
      if (!ctx.renderScene) {
        return { error: "Rendering isn't available in this context." };
      }
      const { scene, idx } = sceneAt(ctx.project, args.sceneNumber);
      if (!scene) return { error: `There is no scene ${args.sceneNumber} in this film.` };

      const status = ctx.project.videoStatus?.[idx]?.status;
      if (status === "rendering") {
        return { note: `Scene ${scene.sceneNumber} is already rendering. Nothing started.` };
      }
      // The director's own edited prompt wins over the compiled one, exactly as
      // it does when they press render in the script editor.
      const prompt = ctx.project.videoStatus?.[idx]?.customPrompt || scene.fullPrompt;
      try {
        const result = await ctx.renderScene(idx, prompt);
        return {
          started: true,
          sceneNumber: scene.sceneNumber,
          generationId: result.id,
          cost: result.cost,
          paidFrom: result.usedPrepaid ? "the film's prepaid allowance (no extra charge)" : "the wallet",
          note:
            "Rendering now, in the background. It takes a minute or two and the clip appears in the script editor and on the timeline when it lands.",
        };
      } catch (err) {
        return { error: String(err?.message || err).slice(0, 300) };
      }
    },
  },

  {
    name: "rescore_film",
    label: () => "Re-scoring the film",
    description:
      "Re-run audio post-production on the finished cut: compose a new score with Lyria and lay it back on the timeline at the right length. Use this when the director wants a different musical feel, or after enough of the film has changed that the old score no longer fits. Every scene has to have rendered first. Pass `vibe` to steer the music. This replaces the whole score — there is no per-section re-scoring yet, so say so if they asked for one section only. (There is no voiceover on this film to re-record; its characters speak on camera.)",
    parameters: {
      type: "OBJECT",
      properties: {
        vibe: {
          type: "STRING",
          description:
            "Optional direction for the new score in the director's own terms, e.g. 'warmer and slower, less percussion' or 'sparse and tense until the last beat'.",
        },
      },
    },
    run: async (args, ctx) => {
      if (!ctx.rescoreFilm) {
        return { error: "Re-scoring isn't available in this context." };
      }
      const scenes = ctx.project.scenes || [];
      const unrendered = scenes.filter((_, i) => ctx.project.videoStatus?.[i]?.status !== "succeeded").length;
      if (scenes.length === 0 || unrendered > 0) {
        return {
          error: `The score is written against the finished cut, and ${unrendered} scene(s) haven't rendered yet. Render them first.`,
        };
      }
      if (ctx.project.audioStage && !["ready", "failed"].includes(ctx.project.audioStage)) {
        return { note: "Audio post-production is already running on this film. Nothing started." };
      }
      try {
        await ctx.rescoreFilm(args.vibe || null);
        return {
          started: true,
          vibe: args.vibe || "(no specific direction)",
          note:
            "Re-scoring now, in the background — this takes a few minutes because the score is composed against the cut and the voiceover is re-timed to fit. The timeline updates itself when it's done.",
        };
      } catch (err) {
        return { error: String(err?.message || err).slice(0, 300) };
      }
    },
  },

  {
    name: "get_audio",
    label: () => "Checking the film's audio",
    description:
      "Read what is currently on the film's audio tracks: whether a score has been laid, how long it is, how many lines of narration were placed and which voice reads them, plus anything audio post could not do. Call this before answering a question about the music or the voiceover — never guess at it.",
    parameters: { type: "OBJECT", properties: {} },
    run: async (_args, ctx) => {
      const p = ctx.project;
      const report = p.audioReport || null;
      return {
        stage: p.audioStage || "never run",
        soundSpec: p.musicSpec || null,
        ambienceSpec: p.ambienceSpec || null,
        scoreUrl: p.musicUrl || null,
        filmDuration: report?.filmDuration ?? null,
        narrationLines: report?.narrationLines ?? 0,
        musicSegments: report?.musicSegments ?? 0,
        voice: report?.voice ?? null,
        problems: [...(report?.violations || []), ...(report?.notes || [])],
        lastRunAt: report?.at ?? null,
      };
    },
  },
];

const TOOLS_BY_NAME = new Map(TOOLS.map((t) => [t.name, t]));

/** The tool contract as Gemini function declarations. */
function functionDeclarations() {
  return TOOLS.map((t) => ({
    name: t.name,
    description: t.description,
    parameters: t.parameters,
  }));
}

/** The short human label shown in the chat's work log while a tool runs. */
function toolLabel(name, args) {
  const tool = TOOLS_BY_NAME.get(name);
  if (!tool) return name;
  try {
    return tool.label(args || {});
  } catch {
    return name;
  }
}

/** True for tools that change the film — the UI flags those differently. */
const WRITE_TOOLS = new Set([
  "rewrite_scene",
  "rewrite_film",
  "patch_scene",
  "update_direction",
  "propagate_locks",
  // Not script writes, but they change the deliverable and cost real money, so
  // the work log must flag them the same way.
  "render_scene",
  "rescore_film",
]);

async function callTool(name, args, ctx) {
  const tool = TOOLS_BY_NAME.get(name);
  if (!tool) return { error: `Unknown tool "${name}".` };
  return tool.run(args || {}, ctx);
}

module.exports = {
  functionDeclarations,
  callTool,
  toolLabel,
  WRITE_TOOLS,
  sceneViolations,
};
