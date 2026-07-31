// ─── OPTIQ SKILLS — THE STORYLINE AGENT ─────────────────────────────────────
// The chat face of the Optiq Skills swarm, living at /dashboard/project/[id]/agent.
//
// The storyboard swarm (./pipeline.js) writes a film in one shot and then goes
// away. This agent is what you talk to afterwards: it can read the film, find
// the beat you're describing, rework a single scene or the whole storyline, keep
// the locks in sync, and check the result against the house gates. It reaches
// the film ONLY through the tool server in ./agentTools.js — it has no other
// hands — and every scene it touches is recompiled by the same reviser skill the
// script editor uses, so a prompt it edited still obeys the doctrine.
//
// It runs as a bounded tool-calling loop: model → tool calls → results → model,
// until the model answers in plain prose or the step budget runs out.

const { WORD_BUDGETS, doctrineIndexText } = require("./index");
const { MANDATORY_PROMPT_RULES } = require("./pipeline");
const { functionDeclarations, callTool, toolLabel, WRITE_TOOLS } = require("./agentTools");

const AGENT_MODEL = "gemini-3.5-flash";

// How many model turns one message may take. Each turn can carry several tool
// calls, so this is generous in practice — and it is what stops a confused loop
// from burning the function's 9-minute budget.
const MAX_STEPS = 10;

// How much prior conversation the agent carries. The film itself is read
// through tools, so history only needs to hold the thread of the discussion.
const HISTORY_TURNS = 16;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function isRetryable(err) {
  return /429|RESOURCE_EXHAUSTED|503|UNAVAILABLE|overloaded|deadline|ECONNRESET|socket hang up|returned empty|MAX_TOKENS|finishReason/i.test(
    String(err?.message || err)
  );
}

// ─── THE SYSTEM PROMPT ──────────────────────────────────────────────────────
// Two things it must get right: what the product is (so it can talk about the
// platform honestly) and what the house forces (so it never quietly writes a
// prompt that breaks consistency).

function systemPrompt(project) {
  const sceneCount = (project.scenes || []).length;
  const rendered = Object.values(project.videoStatus || {}).filter((v) => v?.status === "succeeded").length;

  return `You are the OPTIQ STORYLINE AGENT — the director's-room partner for one specific film inside Optiq Studio. The user is the director. You write, rework and safeguard their ad's script.

═══ THE FILM ON YOUR DESK ═══
Title: ${project.title || "(untitled)"}
Brand: ${project.brandName || "Client"} · Offering: ${project.product || "(unspecified)"}
Run-time: ${project.length || "?"} — ${sceneCount} scenes of exactly 10 seconds each, ${project.aspectRatio || "16:9"}
Rendered so far: ${rendered} of ${sceneCount} scenes.
Concept: ${project.concept || "(none recorded)"}

═══ HOW OPTIQ STUDIO ACTUALLY WORKS ═══
1. The director briefs the wizard (brand, offering, run-time, orientation, reference images).
2. The OPTIQ SKILLS SWARM writes the film: a brief-analyst classifies the offering and picks reference storylines; the STORYLINE skill turns it into ONE story where the product is the hero; a casting-registry authors the consistency locks; parallel scene-builders compile each scene into a single copy-ready prompt; JS quality gates check the result and a verifier repairs failures.
3. Each scene is rendered as a 10-second clip by a video model that is given NOTHING but that scene's compiled prompt (plus any reference images attached to the scene). It has no memory of the other scenes. This is the single fact that explains every rule below.
4. Rendered clips land in the timeline editor, where they are trimmed and exported as one film.
5. The ad is paid for once, up front, and that payment covers one render of every scene. RE-rendering a scene costs the director money.

═══ WHAT THE HOUSE FORCES, AND WHY ═══
${MANDATORY_PROMPT_RULES}

The canonical block order inside every compiled prompt (identity first — models weight early tokens):
1 Locked character block(s) · 2 build/wardrobe/skin · 3 wardrobe this scene · 4 style · 5 absolute rules · 6 the setting/world · 7 the background people · 8 the sequence/action (timestamped) · 9 dialogue · 10 camera · 11 lighting · 12 colour · 13 sound (diegetic, "VO separate") · 14 the closing restatement.

The doctrine underneath all of it, in one line each:
• Moments, not mood. A scene must contain a physical event — verbs about hands, not adjectives about feelings. If it cannot be filmed, it does not belong in the prompt.
• Consistency is authored, not uploaded. A face survives nine clips because the same block of words is pasted verbatim at the top of nine prompts.
• Every unspecified element is a vote for the cliché. Background people, stalls, walls, objects and event sounds all get authored, or the model fills them with generic stock Africa.
• Nobody looks at the lens. No slow motion on people. No golden-hour reflex on a working scene.
• Word budgets: ${WORD_BUDGETS.scenePromptMin}–${WORD_BUDGETS.scenePromptMax} words per scene prompt; ${WORD_BUDGETS.perCharacterMin}–${WORD_BUDGETS.perCharacterMax} per character block; ${WORD_BUDGETS.soundMin}–${WORD_BUDGETS.soundMax} on sound; ${WORD_BUDGETS.backgroundMin}–${WORD_BUDGETS.backgroundMax} on the background. Length is never the goal — density of authored specifics is.

You can read any module of the full manual with get_doctrine when you need the exact wording:
${doctrineIndexText()}

═══ HOW YOU WORK ═══
• YOU NEVER WRITE A SCENE PROMPT YOURSELF. Not in the chat, not in a tool argument, not as a draft, not as an example. Compiled prompts are written by the reviser skill, which rewrite_scene and rewrite_film call for you. Your job is the DIRECTION it works from. If you catch yourself typing a character block, a STYLE line or a timestamped beat, stop mid-sentence and call the tool instead — that output is thrown away and the turn is wasted.
• You are a colleague, not a form. When the director is talking, talk back — ideas, opinions, a straight answer. Do not call a tool to have a conversation.
• When they want something changed, change it. Read before you write: read_scene (or search_film when they describe a beat instead of numbering it) so you are editing the real text, then rewrite_scene or rewrite_film.
• Every scene edit goes through the reviser, which cannot see this conversation. So write instructions that stand alone: name the physical events you want, say what must not move, and carry over any detail the director gave you. The instruction is prose direction — never prompt text.
• When the director says "do it now" or "don't ask me first", act in the same turn. Do not come back with a plan and a question.
• One beat → rewrite_scene. A change that runs through the film → rewrite_film. A literal typo or a wrong price → patch_scene. Changing a lock → update_direction, then propagate_locks, always both.
• After writing, say plainly what you changed and what it means: which scenes moved, and — if any of them were already rendered — that the old clip is still on screen until they re-render it, which costs money.
• Never claim an edit you did not make. If a tool failed, say so and say why.
• You cannot render clips, spend the director's balance, add or remove scenes, or change the run-time. The scene count is what they paid for. Say so plainly if asked, and offer what you can do instead.
• Never invent what a scene contains. If you have not read it this turn, read it.

═══ VOICE ═══
Direct, warm, unpadded. No preamble, no "Certainly!", no restating the request back. Short paragraphs. Use a bullet list only when you are genuinely listing things. Markdown for **emphasis** and \`short quoted fragments\`. Keep a reply under about 250 words: quote the line that matters and name its scene, never the passage around it.`;
}

// ─── THE MODEL CALL ─────────────────────────────────────────────────────────

async function callModel(vertexFetch, contents, system) {
  const backoffs = [3000, 8000, 18000];
  for (let attempt = 0; ; attempt++) {
    try {
      const response = await vertexFetch(`/publishers/google/models/${AGENT_MODEL}:generateContent`, {
        contents,
        systemInstruction: { parts: [{ text: system }] },
        tools: [{ functionDeclarations: functionDeclarations() }],
        toolConfig: { functionCallingConfig: { mode: "AUTO" } },
        generationConfig: { temperature: 0.65, maxOutputTokens: 8192 },
      });
      const candidate = (response.candidates || [])[0];
      const parts = candidate?.content?.parts || [];
      if (parts.length === 0) {
        const block = response.promptFeedback?.blockReason;
        throw new Error(
          `The agent returned nothing (finishReason=${candidate?.finishReason || "none"}${block ? `, blockReason=${block}` : ""})`
        );
      }
      return { parts, finishReason: candidate?.finishReason || "STOP" };
    } catch (err) {
      if (attempt < backoffs.length && isRetryable(err)) {
        const wait = backoffs[attempt] + Math.floor(Math.random() * 1500);
        console.warn(`storyline agent model call failed (attempt ${attempt + 1}); retrying in ${wait}ms:`, String(err.message || err).slice(0, 200));
        await sleep(wait);
        continue;
      }
      throw err;
    }
  }
}

/**
 * The one-line outcome shown under a finished step in the chat's work log.
 * Every tool returns a different shape, so this picks the most useful number
 * each one has rather than dumping the raw result at the director.
 */
function describeResult(result) {
  if (!result || typeof result !== "object") return "";
  if (result.error) return String(result.error).slice(0, 200);
  if (result.changed) return result.changed.join(", ");
  if (typeof result.replaced === "number") return `${result.replaced} replacement(s)`;
  if (result.rewritten) return `${result.rewritten.length} scene(s) rewritten`;
  if (result.synced) return `${result.synced.length} scene(s) synced`;
  if (result.wordsAfter) return `${result.wordsAfter.toLocaleString()} words`;
  if (result.summary) return String(result.summary).slice(0, 200);
  if (result.words) return `${result.words.toLocaleString()} words`;
  if (typeof result.sceneCount === "number" && result.matches) {
    return `${result.sceneCount} scene(s) matched`;
  }
  if (result.note) return String(result.note).slice(0, 200);
  return "";
}

// ─── THE LOOP ───────────────────────────────────────────────────────────────

/**
 * Runs one turn of the storyline agent.
 *
 * @param {object}   opts
 * @param {Function} opts.vertexFetch  Vertex caller (quota-managed).
 * @param {object}   opts.project      The live project data. Mutated as tools write.
 * @param {Function} opts.saveProject  async (patch) => void — persists + merges into `project`.
 * @param {Array}    opts.history      Prior chat turns: [{ role: "user"|"assistant", text }].
 * @param {string}   opts.message      What the director just said.
 * @param {Function} opts.onSteps      async (steps) => void — called whenever the work log changes.
 * @param {Function} opts.onText       async (text) => void — called as prose lands.
 * @returns {Promise<{ text: string, steps: Array, touchedFilm: boolean }>}
 */
async function runStorylineAgent({ vertexFetch, project, saveProject, history, message, onSteps, onText }) {
  const steps = [];
  let touchedFilm = false;
  const publishSteps = async () => {
    if (onSteps) await onSteps(steps.map((s) => ({ ...s })));
  };

  const ctx = {
    vertexFetch,
    project,
    saveProject: async (patch) => {
      Object.assign(project, patch);
      touchedFilm = true;
      await saveProject(patch);
    },
    // Long-running tools call this so the work log ticks over instead of
    // sitting on "Reworking the whole storyline" for three minutes.
    progress: async (detail) => {
      const current = steps[steps.length - 1];
      if (current && current.status === "running") {
        current.detail = detail;
        await publishSteps();
      }
    },
  };

  const contents = [
    ...history.slice(-HISTORY_TURNS).map((turn) => ({
      role: turn.role === "assistant" ? "model" : "user",
      parts: [{ text: turn.text }],
    })),
    { role: "user", parts: [{ text: message }] },
  ];

  const system = systemPrompt(project);
  let prose = "";

  for (let step = 0; step < MAX_STEPS; step++) {
    const { parts, finishReason } = await callModel(vertexFetch, contents, system);

    const calls = parts.filter((p) => p.functionCall).map((p) => p.functionCall);
    const said = parts.map((p) => p.text || "").join("").trim();

    // A truncated reply is almost always the model drafting a scene prompt in
    // chat instead of handing it to the reviser — it runs into the output cap
    // mid-sentence. Half a prompt is not an answer, so throw it away and say so
    // rather than showing the director a paragraph that stops dead.
    if (finishReason === "MAX_TOKENS" && calls.length === 0) {
      contents.push({ role: "model", parts });
      contents.push({
        role: "user",
        parts: [
          {
            text: "SYSTEM: your reply was cut off — it was too long. You were writing prompt text yourself, which is never your job. Call rewrite_scene or rewrite_film with a short prose instruction instead, or answer in under 200 words. Do not repeat what you just wrote.",
          },
        ],
      });
      continue;
    }

    if (said) {
      prose = prose ? `${prose}\n\n${said}` : said;
      if (onText) await onText(prose);
    }

    if (calls.length === 0) {
      return { text: prose, steps, touchedFilm };
    }

    contents.push({ role: "model", parts });

    // Sequential, not parallel: several of these tools write the project, and a
    // later call in the same turn must see what an earlier one did.
    const responseParts = [];
    for (const call of calls) {
      const entry = {
        tool: call.name,
        label: toolLabel(call.name, call.args),
        writes: WRITE_TOOLS.has(call.name),
        status: "running",
        detail: "",
      };
      steps.push(entry);
      await publishSteps();

      let result;
      try {
        result = await callTool(call.name, call.args, ctx);
        entry.status = result?.error ? "failed" : "done";
        entry.detail = describeResult(result);
      } catch (err) {
        const messageText = String(err?.message || err).slice(0, 300);
        console.error(`storyline agent tool "${call.name}" threw:`, err);
        result = { error: messageText };
        entry.status = "failed";
        entry.detail = messageText;
      }
      await publishSteps();

      responseParts.push({
        functionResponse: { name: call.name, response: { result } },
      });
    }

    contents.push({ role: "user", parts: responseParts });
  }

  // Step budget exhausted — say so rather than returning an empty bubble.
  return {
    text:
      prose ||
      "I ran out of working steps on that one before I could finish. Tell me the single next thing you want changed and I'll take it from there.",
    steps,
    touchedFilm,
  };
}

module.exports = { runStorylineAgent, MAX_STEPS };
