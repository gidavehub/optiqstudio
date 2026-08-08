// ─── OPTIQ DOCUMENTARY — THE AGENT'S TOOL SERVER ────────────────────────────
// Every capability the documentary agent has over a film lives here, and nowhere
// else. Each tool is declared MCP-style — a name, a description the model reads,
// a JSON-Schema parameter block, and a `run` that actually does the work — so the
// model can only touch the film through a contract we wrote.
//
// The read tools (get_film, read_scene, read_narration, search_film, check_film,
// get_doctrine) are free and instant. The picture-write tools (rewrite_scene,
// patch_scene, rewrite_film, update_direction, propagate_locks) go through the
// SAME scene-reviser skill the script editor's "revise" box uses, so a prompt the
// agent touched still obeys every house rule: locks verbatim, 1,500–2,000 words,
// the sound spec repeated, the Gambian environment, silence, no on-screen text.
// The agent cannot write a scene prompt freehand — that is deliberate.
//
// The one capability this sandbox has that its siblings do not: rewrite_narration.
// In a documentary the words are half the film, they were authored by the outline
// skill rather than spoken on camera, and changing them costs nothing but a
// re-run of audio post — no re-render, no money. It is the edit a director will
// reach for most, so it is a first-class tool rather than a side effect of
// rewriting a scene.

const { reviseDocumentaryScene } = require("./pipeline");
const { sceneSoundViolations } = require("./soundPolicy");
const { scenePurityViolations } = require("./documentaryCraft");
const { minorViolations } = require("./casting");
const {
  WORD_BUDGETS,
  NARRATION_BUDGETS,
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
 * The same checks the swarm enforces at build time, minus the ones that need the
 * full registry (which isn't persisted — only the lead subject's locked block
 * survives onto the project doc, and most documentaries have none). Giving the
 * agent this tool is what lets it answer "is my film still compliant?" with facts
 * instead of vibes.
 */
function sceneViolations(scene, project) {
  const violations = [];
  const prompt = scene.fullPrompt || "";
  const words = countWords(prompt);

  if (words < WORD_BUDGETS.scenePromptHardFloor) {
    violations.push(
      `Only ${words} words — under the ${WORD_BUDGETS.scenePromptMin}-word floor. Needs more authored specifics (environment items, people, event sounds), never filler.`
    );
  }
  const lock = project.characterLock?.description || "";
  if (lock && !containsVerbatim(prompt, lock)) {
    violations.push(
      "The locked subject block is missing or paraphrased — it must appear verbatim, word for word, at the top of the prompt."
    );
  }
  if (project.musicSpec && !containsVerbatim(prompt, project.musicSpec)) {
    violations.push(
      "The locked sound spec is missing or paraphrased in the SOUND block — it must be repeated verbatim so the whole film sounds like one unbroken recording."
    );
  }
  // This film sells nothing, nobody in it speaks, and it carries no on-screen
  // text — all three are checked together.
  violations.push(...scenePurityViolations({ fullPrompt: prompt, dialogue: scene.dialogue }));
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
  // The no-music and no-speech laws. Without this, check_film would call a scene
  // that asks the video model for a soundtrack — or for somebody to talk —
  // "clean", and both are permanent in the rendered clip.
  violations.push(...sceneSoundViolations(prompt, { allowDialogue: false }));
  // Adults only, platform-wide. check_film must never call a scene clean when
  // there is somebody under 18 in it.
  violations.push(...minorViolations(prompt, `Scene ${scene.sceneNumber}`));
  return { sceneNumber: scene.sceneNumber, words, violations };
}

// ─── SCENE SUMMARY REFRESH ──────────────────────────────────────────────────
// The script deck shows short beat cards per scene. A rewritten prompt with stale
// beat cards is worse than no beat cards, so every picture-write tool refreshes
// them from the new prompt.

const SUMMARY_SCHEMA = {
  type: "OBJECT",
  properties: {
    setting: { type: "STRING" },
    action: { type: "STRING" },
    sound: { type: "STRING" },
  },
  required: ["setting", "action", "sound"],
};

async function summariseScene(vertexFetch, fullPrompt) {
  try {
    const response = await vertexFetch(`/publishers/google/models/${SUMMARY_MODEL}:generateContent`, {
      contents: [{ role: "user", parts: [{ text: fullPrompt.slice(0, 24000) }] }],
      systemInstruction: {
        parts: [
          {
            text: `You read one compiled Optiq documentary scene prompt and return the short summary cards the script editor shows above it. One or two sentences each, present tense, concrete.
- setting: where we are.
- action: the physical beats, in order.
- sound: what the scene sounds like.
There is no dialogue in this film — nobody speaks on camera — so never report any.
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
    // Stale beat cards are a cosmetic problem; a failed rewrite is not. Never let
    // the summary pass take the whole edit down with it.
    console.warn("scene summary refresh failed (non-fatal):", String(err?.message || err).slice(0, 160));
    return null;
  }
}

/** Runs the scene-reviser skill against one scene and returns the new prompt. */
async function reviseOne(ctx, scene, instruction) {
  const scenes = ctx.project.scenes || [];
  const { idx } = sceneAt(ctx.project, scene.sceneNumber);
  return reviseDocumentaryScene({
    vertexFetch: ctx.vertexFetch,
    scenePrompt: scene.fullPrompt,
    revisionRequest: instruction,
    characterLock: ctx.project.characterLock || {},
    styleHeader: ctx.project.styleHeader || "",
    previousScenePrompt: scenes[idx - 1]?.fullPrompt || null,
    nextScenePrompt: scenes[idx + 1]?.fullPrompt || null,
    musicSpec: ctx.project.musicSpec || null,
    narration: scene.narration || null,
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

// ─── NARRATION ──────────────────────────────────────────────────────────────

const NARRATION_SCHEMA = {
  type: "OBJECT",
  properties: {
    lines: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: { sceneNumber: { type: "INTEGER" }, text: { type: "STRING" } },
        required: ["sceneNumber", "text"],
      },
    },
  },
  required: ["lines"],
};

/**
 * The film's narration as it currently stands, in scene order.
 *
 * Read off the scenes rather than the stored `narrationScript`, because the
 * scenes are what the agent and the editor both write to; the stored script is
 * the mirror kept for audio post.
 */
function narrationLines(project) {
  return (project.scenes || []).map((s) => ({
    sceneNumber: Number(s.sceneNumber) || 0,
    text: String(s.narration || "").trim(),
    words: countWords(s.narration),
  }));
}

/** Persist narration back onto the scenes AND the script audio post reads. */
async function commitNarration(ctx, byScene) {
  const scenes = (ctx.project.scenes || []).map((s) => {
    const next = byScene.get(Number(s.sceneNumber));
    return next === undefined ? s : { ...s, narration: next };
  });
  const narrationScript = scenes.map((s) => ({
    sceneNumber: Number(s.sceneNumber) || 0,
    text: String(s.narration || "").trim(),
  }));
  await ctx.saveProject({ scenes, narrationScript });
  return scenes;
}

// ─── THE TOOLS ──────────────────────────────────────────────────────────────

const TOOLS = [
  {
    name: "get_film",
    label: () => "Reading the film",
    description:
      "Read the whole film at a glance: title, thesis, arc, how it closes, the visual style contract, the locked sound spec, and a one-line index of every scene with its act, word count, narration line and render status. Cheap — call this first whenever you need your bearings. It does NOT return the full scene prompts; use read_scene for those.",
    parameters: { type: "OBJECT", properties: {} },
    run: async (_args, ctx) => {
      const p = ctx.project;
      return {
        title: p.title,
        thesis: p.thesis || null,
        premise: p.concept,
        filmArc: p.storyArc || null,
        theClose: p.theClose || null,
        narratorNote: p.narratorNote || null,
        runTime: p.length,
        aspectRatio: p.aspectRatio,
        // Usually null: a documentary follows nobody, and reporting an empty
        // character lock invites the agent to go looking for a protagonist.
        subjectLock: p.characterLock?.description ? p.characterLock : null,
        styleHeader: p.styleHeader || null,
        soundSpec: p.musicSpec || null,
        ambienceSpec: p.ambienceSpec || null,
        sceneCount: (p.scenes || []).length,
        scenes: (p.scenes || []).map((s, i) => ({
          sceneNumber: s.sceneNumber,
          setting: s.setting,
          action: String(s.action || "").slice(0, 240),
          narration: String(s.narration || "").trim() || "(silent)",
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
      "Read one scene in full — its summary cards, its narration line, and the entire compiled prompt exactly as it will be sent to the video model. Use this before editing anything so you are working from the real text, not an assumption about it.",
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
        sound: scene.sound,
        narration: String(scene.narration || "").trim() || "(this scene is unnarrated)",
        words: countWords(scene.fullPrompt),
        renderStatus: ctx.project.videoStatus?.[idx]?.status || "idle",
        fullPrompt: scene.fullPrompt,
      };
    },
  },

  {
    name: "read_narration",
    label: () => "Reading the narration",
    description:
      "Read the film's entire voiceover script in order, scene by scene, with each line's word count. This is the fastest way to judge whether the film says one continuous thing or reads like a set of captions. Call it before any narration edit, and whenever the director asks what the film actually says.",
    parameters: { type: "OBJECT", properties: {} },
    run: async (_args, ctx) => {
      const lines = narrationLines(ctx.project);
      const spoken = lines.filter((l) => l.text);
      return {
        sceneCount: lines.length,
        narratedScenes: spoken.length,
        silentScenes: lines.length - spoken.length,
        totalWords: spoken.reduce((n, l) => n + l.words, 0),
        estimatedSpeechSeconds: Math.round(
          spoken.reduce((n, l) => n + l.words, 0) / NARRATION_BUDGETS.wordsPerSecond
        ),
        wordBudget: `about ${NARRATION_BUDGETS.targetWordsPerScene} words per scene, never more than ${NARRATION_BUDGETS.maxWordsPerScene}`,
        lines,
        readThrough: spoken.map((l) => l.text).join(" "),
      };
    },
  },

  {
    name: "search_film",
    label: (a) => `Searching the film for "${a.query}"`,
    description:
      'Find which scenes mention something, without reading all of them. Matches case-insensitively across every scene prompt, summary and narration line, and returns the scene numbers plus the surrounding excerpt. Use it when the director refers to a detail rather than a scene number — "the bit with the tide", "where the narrator says it takes four days".',
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
        const haystack = [scene.setting, scene.action, scene.narration, scene.sound, scene.fullPrompt]
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
      "Run the house quality gates over the film and report what fails, per scene: prompt word count against the 1,500–2,000 word budget, the locked sound spec present verbatim, the explicit 'Black' description of on-screen people, the Gambian setting, the no-music law, the no-speech law (nobody talks on camera in this film) and the no-on-screen-text law. Also checks every narration line against the narrator's word budget. Use it after a round of edits, or whenever the director asks whether the film is still sound.",
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
        .map((s) => {
          const check = sceneViolations(s, ctx.project);
          const words = countWords(s.narration);
          if (words > NARRATION_BUDGETS.maxWordsPerScene) {
            check.violations.push(
              `The narration line is ${words} words — about ${Math.round(words / NARRATION_BUDGETS.wordsPerSecond)}s ` +
                `of speech in a ten-second scene. Cut it to ${NARRATION_BUDGETS.maxWordsPerScene} words or fewer, or ` +
                `audio post will trim it for you and pick the words itself.`
            );
          }
          return check;
        });
      const failing = results.filter((r) => r.violations.length > 0);
      return {
        checked: results.length,
        clean: results.length - failing.length,
        wordBudget: `${WORD_BUDGETS.scenePromptMin}–${WORD_BUDGETS.scenePromptMax} words per scene prompt (hard floor ${WORD_BUDGETS.scenePromptHardFloor}); narration about ${NARRATION_BUDGETS.targetWordsPerScene} words per scene`,
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
    description: `Read a module of the Optiq house film manual — the same doctrine the documentary swarm was built on. Use it when the director asks why a rule exists, when you need the exact wording of a rule before applying it, or when you are diagnosing a generation that went wrong. Modules:\n${doctrineIndexText()}`,
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
    name: "rewrite_narration",
    label: (a) =>
      a.sceneNumbers?.length ? `Rewriting the narration on scenes ${a.sceneNumbers.join(", ")}` : "Rewriting the narration",
    description:
      "Rewrite the film's voiceover — one line, several, or the whole script. This is the cheapest and most powerful edit in a documentary: the words are half the film, and changing them touches NO footage, costs NO render money, and needs no re-shoot. The rewrite is held to the narrator's word budget (about 16 words a scene, never more than 24) and to the house rules: never describe what the viewer can already see, never invent facts, plain spoken language, one continuous piece rather than captions, and silence where silence is stronger. To make a scene silent, say so in the instruction. After this, the film has to be re-narrated in audio post before the director can hear it — tell them, and offer rescore_film.",
    parameters: {
      type: "OBJECT",
      properties: {
        instruction: {
          type: "STRING",
          description:
            "What to change about the narration and why, in full. Name the meaning you want, not the exact words, unless the director gave you exact words — in which case quote them.",
        },
        sceneNumbers: {
          type: "ARRAY",
          items: { type: "INTEGER" },
          description: "Optional — rewrite only these scenes' lines. Omit to rewrite the whole script.",
        },
      },
      required: ["instruction"],
    },
    run: async (args, ctx) => {
      const p = ctx.project;
      const scenes = p.scenes || [];
      if (scenes.length === 0) return { error: "This film has no scenes yet." };
      const wanted = args.sceneNumbers?.length ? new Set(args.sceneNumbers.map(Number)) : null;
      const targets = scenes.filter((s) => !wanted || wanted.has(Number(s.sceneNumber)));
      if (targets.length === 0) return { error: "No scenes matched." };

      const system = `You are the NARRATION WRITER of the Optiq Documentary swarm. You are rewriting the voiceover of a documentary that is already written and, in places, already shot. You change ONLY the words.

THE FILM
Title: ${p.title || "(untitled)"}
Thesis — the one sentence this film lands: ${p.thesis || "(not recorded)"}
How it closes: ${p.theClose || "(not recorded)"}
${p.narratorNote ? `How the narrator should read it: ${p.narratorNote}` : ""}

THE RULES, AND THEY ARE HARD:
• The narrator reads about ${NARRATION_BUDGETS.wordsPerSecond} words a second, and each line sits in a GAP in its
  scene rather than running the full ten seconds. Aim for ${NARRATION_BUDGETS.targetWordsPerScene} words a scene.
  NEVER exceed ${NARRATION_BUDGETS.maxWordsPerScene}. A line that runs long gets cut down automatically in audio
  post, and then the machine picks the words instead of you.
• NEVER describe what the viewer can already see. The picture does that. Say what
  the picture cannot: what it costs, why it is done this way, how long it takes,
  what happens if it goes wrong, who it is for.
• It is ONE CONTINUOUS PIECE, read in order. Each line continues the one before it.
• SILENCE IS A LINE. Returning an empty string for a scene is a real choice and
  often the right one — a film talked over end to end is exhausting.
• Plain spoken language. Contractions. No advertising cliché, no rhetorical
  questions, no exclamation marks, nothing that reads like copy.
• NEVER invent facts — no statistics, dates, names, prices or histories that are
  not already in this film's own text. A documentary that makes things up is
  worse than one that says less.
• You are NOT writing the pictures. Do not describe shots, do not write stage
  directions, do not mention scene numbers inside a line.

Return a line for every scene you were asked to change, and only those scenes.`;

      const context = scenes
        .map(
          (s) =>
            `Scene ${s.sceneNumber}${wanted && !wanted.has(Number(s.sceneNumber)) ? " (NOT yours to change — context only)" : ""}: ` +
            `PICTURE — ${String(s.action || s.setting || "").slice(0, 220)}\n  CURRENT LINE — ${
              String(s.narration || "").trim() || "(silent)"
            }`
        )
        .join("\n");

      let rewritten;
      try {
        const response = await ctx.vertexFetch(`/publishers/google/models/${SUMMARY_MODEL}:generateContent`, {
          contents: [
            {
              role: "user",
              parts: [
                {
                  text: `THE DIRECTOR'S INSTRUCTION:
${args.instruction}

SCENES YOU MUST RETURN A LINE FOR: ${targets.map((s) => s.sceneNumber).join(", ")}

THE WHOLE FILM, FOR CONTEXT (so your lines still join up with the ones you are not changing):
${context}`,
                },
              ],
            },
          ],
          systemInstruction: { parts: [{ text: system }] },
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 8192,
            responseMimeType: "application/json",
            responseSchema: NARRATION_SCHEMA,
          },
        });
        const text = (response.candidates?.[0]?.content?.parts || []).map((x) => x.text || "").join("");
        rewritten = JSON.parse(text || "{}");
      } catch (err) {
        return { error: `The narration rewrite failed: ${String(err?.message || err).slice(0, 200)}` };
      }

      const allowed = new Set(targets.map((s) => Number(s.sceneNumber)));
      const byScene = new Map();
      for (const line of rewritten.lines || []) {
        const n = Number(line?.sceneNumber);
        if (!allowed.has(n)) continue;
        byScene.set(n, String(line.text || "").trim());
      }
      if (byScene.size === 0) {
        return { error: "The narration writer returned nothing usable. Nothing was changed." };
      }

      await commitNarration(ctx, byScene);

      const changed = [...byScene.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([sceneNumber, text]) => ({
          sceneNumber,
          text: text || "(silent)",
          words: countWords(text),
        }));
      const overlong = changed.filter((c) => c.words > NARRATION_BUDGETS.maxWordsPerScene);

      return {
        saved: true,
        rewritten: changed,
        overlong: overlong.map((c) => `Scene ${c.sceneNumber} is ${c.words} words and will be trimmed in audio post.`),
        note:
          "The narration is saved. The film's audio still carries the OLD voiceover until audio post runs again — " +
          "rescore_film re-records it against the cut. No footage changed and no render money was spent.",
      };
    },
  },

  {
    name: "rewrite_scene",
    label: (a) => `Rewriting scene ${a.sceneNumber}`,
    description:
      "Rewrite one scene's compiled prompt — the PICTURE — to carry out an instruction, then save it. The rewrite runs through the house scene-reviser, so any locked block, the style header and the sound spec survive verbatim, the scene stays silent (no speech, no on-screen text, no music), continuity with the neighbouring scenes is preserved, and the prompt is recompiled at 1,500–2,000 words. Give a rich, specific instruction — everything the reviser needs must be in it, because it cannot see this conversation. To change what the film SAYS rather than what it shows, use rewrite_narration instead: it is free and needs no re-render.",
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
      const updated = { ...scene, ...(summary || {}), dialogue: "", fullPrompt: newPrompt };
      await commitScenes(ctx, [{ idx, scene: updated }]);

      const check = sceneViolations(updated, ctx.project);
      return {
        saved: true,
        sceneNumber: scene.sceneNumber,
        wordsBefore: countWords(scene.fullPrompt),
        wordsAfter: check.words,
        gateViolations: check.violations,
        note: "The scene is saved and live in the editor. If it was already rendered, the old clip still shows until the director re-renders it — tell them.",
      };
    },
  },

  {
    name: "rewrite_film",
    label: (a) =>
      a.sceneNumbers?.length ? `Reworking scenes ${a.sceneNumbers.join(", ")}` : "Reworking every scene",
    description:
      "Apply one direction to the PICTURES across many scenes at once — this is how you work on the whole film rather than a single beat. Every targeted scene goes through the house scene-reviser in parallel with the same instruction plus its own continuity context, then all of them are saved together. Use it for film-wide changes: a different visual register, a location that has to change, an object whose look has to track across the film. For a change to one beat, use rewrite_scene. For a change to the WORDS, use rewrite_narration — it is free.",
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
          const rewritten = { ...scene, ...(summary || {}), dialogue: "", fullPrompt: newPrompt };
          // Committed one at a time, not in one batch at the end: a long pass can
          // run for minutes, and if the function hit its ceiling mid-flight a
          // single trailing write would throw away every scene that had already
          // finished. This way the director keeps the work and watches the scenes
          // land in the editor as they go.
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
      "Make a surgical, literal find-and-replace inside one scene's compiled prompt — no model call, no rewrite. Use it ONLY for small factual corrections where the surrounding writing must not move: a misspelt place name, a wrong number, a colour, the size of an object. Anything that changes what happens in the scene must go through rewrite_scene instead, or the prompt will fall out of the canonical structure.",
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
      "Change the film-wide fields: title, premise, thesis, how it closes, the note on how the narrator reads it, the visual style contract, the locked sound spec, the ambience spec, and (rarely) the locked subject block. Only pass the fields you are changing. IMPORTANT: changing a lock here does NOT change the scenes — the old wording is still pasted verbatim inside every scene prompt. After changing the style header, sound spec or subject lock, call propagate_locks so the film agrees with itself.",
    parameters: {
      type: "OBJECT",
      properties: {
        title: { type: "STRING" },
        premise: { type: "STRING", description: "The one-paragraph description shown under the title." },
        thesis: { type: "STRING", description: "The one sentence this film lands. A claim, not a topic." },
        theClose: { type: "STRING", description: "The physical event in the final scene that lands the thesis." },
        narratorNote: { type: "STRING", description: "How the narrator should read this film — register and pace, under 20 words." },
        subjectName: { type: "STRING" },
        subjectDescription: {
          type: "STRING",
          description: `The locked block for the one subject this film follows, if it follows anybody — ${WORD_BUDGETS.perCharacterMin}–${WORD_BUDGETS.perCharacterMax} words of physical properties only, including the keyword "Black" and Gambian/West African. Most documentaries have none.`,
        },
        subjectWardrobe: { type: "STRING", description: "The clothing lock — real workwear, colours in CAPS, garments named precisely." },
        styleHeader: { type: "STRING", description: "The visual contract, ~60–100 words: documentary register, optics, observational motion policy, prohibitions, and the no-on-screen-text policy." },
        musicSpec: {
          type: "STRING",
          description: `The locked sound spec — ${WORD_BUDGETS.soundMin}–${WORD_BUDGETS.soundMax} words locking the film's unscored, WORDLESS sound bed: no music, no speech, the quality of that silence, and the continuous ambience.`,
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
      if (args.premise) { patch.concept = args.premise; changed.push("premise"); }
      if (args.thesis) { patch.thesis = args.thesis; changed.push("thesis"); }
      if (args.theClose) { patch.theClose = args.theClose; changed.push("the close"); }
      if (args.narratorNote) { patch.narratorNote = args.narratorNote; changed.push("narrator note"); }
      if (args.styleHeader) { patch.styleHeader = args.styleHeader; changed.push("style header"); }
      if (args.musicSpec) { patch.musicSpec = args.musicSpec; changed.push("sound spec"); }
      if (args.ambienceSpec) { patch.ambienceSpec = args.ambienceSpec; changed.push("ambience spec"); }
      if (args.subjectName) { lock.name = args.subjectName; lockTouched = true; }
      if (args.subjectDescription) { lock.description = args.subjectDescription; lockTouched = true; }
      if (args.subjectWardrobe) { lock.wardrobe = args.subjectWardrobe; lockTouched = true; }
      if (lockTouched) { patch.characterLock = lock; changed.push("subject lock"); }

      if (changed.length === 0) return { error: "Nothing to change — pass at least one field." };
      await ctx.saveProject(patch);

      const needsPropagation = lockTouched || !!args.styleHeader || !!args.musicSpec;
      return {
        saved: true,
        changed,
        needsPropagation,
        note: needsPropagation
          ? "The scenes still carry the OLD wording verbatim. Call propagate_locks now, or tell the director the film is out of sync."
          : "No scene text depends on these fields.",
      };
    },
  },

  {
    name: "propagate_locks",
    label: () => "Pushing the new locks through every scene",
    description:
      "Re-run the scenes so they carry the film's CURRENT locks verbatim — the locked subject block if there is one, the style header and the sound spec. Call this straight after update_direction changes any of them. It rewrites only the locked passages' wording; the beats, the cuts and the narration stay exactly as they are.",
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

      const instruction = `SYNC PASS — the film's locks have changed. Do not change the beats, the cuts, the camera or anything the scene shows. Replace ONLY the locked passages with the current wording, pasted verbatim:

LOCKED SUBJECT BLOCK (paste verbatim at the top of the prompt, replacing any older description of this person; if it says "(none)", this film follows nobody and there is no block to paste):
${p.characterLock?.description || "(none)"}

CLOTHING LOCK (verbatim):
${p.characterLock?.wardrobe || "(none)"}

STYLE HEADER (verbatim, in the STYLE block):
${p.styleHeader || "(none)"}

LOCKED SOUND SPEC (verbatim, opening the SOUND block, before this scene's own event sounds):
${p.musicSpec || "(none)"}

Everything else in the prompt stays as it is, including the fact that nobody speaks, there is no on-screen text and there is no music. Recompile in the canonical block order at ${WORD_BUDGETS.scenePromptMin}–${WORD_BUDGETS.scenePromptMax} words.`;

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
  // The only tools that touch money or long-running jobs, so each one reports
  // plainly what it started and what it cost.

  {
    name: "render_scene",
    label: (a) => `Rendering scene ${a.sceneNumber}`,
    description:
      "Shoot one scene: send its current compiled prompt to the video model and start the render. Costs the director money unless the film's prepaid allowance still covers it, so ONLY call this when they have actually asked for a render in this conversation — never speculatively, and never 'while you're at it'. Note that a narration change needs NO render: only a change to the picture does. The render runs in the background and takes a minute or two; it does not block you. Say what it cost.",
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
    label: () => "Re-scoring and re-narrating the film",
    description:
      "Re-run audio post-production on the finished cut: re-record the narration against the real timings and compose a new score with Lyria, then lay both back on the timeline. This is what the director needs after ANY narration change — the words are saved instantly, but the film does not say them until this runs. Also use it when they want a different musical feel. Every scene has to have rendered first. Pass `vibe` to steer the music. This replaces the whole score and the whole voiceover.",
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
          error: `The score and the narration are both timed against the finished cut, and ${unrendered} scene(s) haven't rendered yet. Render them first.`,
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
            "Running now, in the background — this takes a few minutes because the narration is re-timed against the cut and the score is composed to it. The timeline updates itself when it's done.",
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
      "Read what is currently on the film's audio tracks: whether a score has been laid, how long it is, how many lines of narration were placed and which voice reads them, plus anything audio post could not do. Call this before answering a question about the music or the voiceover — never guess at it. Note the difference between the narration SCRIPT (read_narration, what the film will say) and the narration TRACK (this tool, what it currently says out loud).",
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
  "rewrite_narration",
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
  narrationLines,
};
