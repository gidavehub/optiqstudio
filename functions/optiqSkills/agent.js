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

// Stays on 3.5-flash, and the shelf around it has been measured rather than
// guessed at — the real call below, same tools and temperature, on four prompts
// that must each answer with a tool call:
//
//   gemini-3.5-flash-lite    874ms
//   gemini-3.5-flash        1481ms   ← here
//   gemini-3.6-flash        2986ms
//   gemini-3-flash-preview  6123ms
//
// So "switch the agent to Gemini 3 Flash to make it faster" is backwards: it is
// the slowest of the four, there is no plain `gemini-3-flash` id (it 404s), and
// the -preview alias is the class of id Google has retired out from under this
// project before. Lite is genuinely quicker and did hold up on the real 13-tool
// set, but the director's call is to keep the tier that is proven in production.
const AGENT_MODEL = "gemini-3.5-flash";

// How many model turns one message may take. Each turn can carry several tool
// calls, so this is generous in practice.
//
// Raised from 10 because directors were hitting it on real work: a film-wide
// note that reads six scenes and rewrites three is already nine turns before the
// agent has said anything, and it now has rendering and re-scoring tools that
// take turns of their own.
const MAX_STEPS = 26;

// A step ceiling alone is the wrong guard, and raising it made that worse: the
// function dies at 540s, and 26 turns of a slow tool can pass that with nothing
// written back — which the client only sees as a turn that stopped responding.
// So the loop also watches the clock and stops itself in time to write a real
// answer. Well inside the 540s ceiling, leaving room for the final model call.
const TURN_BUDGET_MS = 7 * 60 * 1000;

// Tools that are worth waiting for even when the budget is nearly gone, because
// abandoning them halfway is worse than finishing late: they cost the director
// money or leave the film in a half-changed state.
const UNINTERRUPTIBLE = new Set(["render_scene", "rescore_film", "rewrite_film", "propagate_locks"]);

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
4. Rendered clips land in the timeline editor, where they are trimmed and exported as one film. The clips carry NO music — the score is composed afterwards by Lyria 3 Pro against the finished cut and laid under the timeline. Narrated films also get a voiceover written and recorded against that cut, timed into the gaps where nobody is speaking.
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
• NEVER PUT MUSIC IN A SCENE PROMPT. The clips are generated with no music at all — only diegetic sound, ambience and dialogue. The score is composed separately by Lyria 3 Pro against the finished cut. Music baked into a clip cannot be removed, collides with the composed score, and only a paid re-render undoes it. When the director wants a different musical feel, that is rescore_film, not a prompt edit.
• YOU CAN SHOOT AND SCORE, AND BOTH SPEND MONEY. render_scene starts a real render; rescore_film re-composes the whole score and re-records the narration. Call them ONLY when the director has asked for it in this conversation — never speculatively, never as a bonus alongside a rewrite they did ask for. When you do, say what it cost and that it runs in the background. If you are unsure whether they meant "change the words" or "change the film", ask.
• Rendering costs nothing while the ad's prepaid allowance lasts (it covers one render of every scene). After that a re-render is charged. render_scene tells you which applied — pass that on rather than guessing.
• You still cannot add or remove scenes, or change the run-time. The scene count is what they paid for. Say so plainly if asked, and offer what you can do instead.
• Use get_audio before answering anything about the music or the voiceover. Never describe a score you have not read.
• Never invent what a scene contains. If you have not read it this turn, read it.

• NOBODY UNDER 18, EVER. No child, no baby, no teenager under 18 appears in any frame of this film, in any role, foreground or background. If the director asks for one, say so plainly and recast them as an adult of 18 or older doing the same thing — keep what they wanted, change the age. This is a platform rule and you cannot make an exception to it.

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
 * @param {Array}    opts.images       Reference stills attached to THIS message:
 *                                    [{ base64, mimeType }]. Same inlineData
 *                                    shape the Image/Video studios send.
 * @param {Function} opts.onSteps      async (steps) => void — called whenever the work log changes.
 * @param {Function} opts.onText       async (text) => void — called as prose lands.
 * @returns {Promise<{ text: string, steps: Array, touchedFilm: boolean }>}
 */
async function runStorylineAgent({
  vertexFetch,
  project,
  saveProject,
  history,
  message,
  images = [],
  onSteps,
  onText,
  // Production powers, injected by the caller because they spend money — see
  // storylineAgent in functions/index.js. Absent means the tools decline rather
  // than pretending to work.
  renderScene,
  rescoreFilm,
}) {
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
    renderScene,
    rescoreFilm,
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
    {
      role: "user",
      // Images lead, text follows — the same part ordering imageGenerate and
      // videoGenerate use. The model reads the stills as context for the
      // instruction that comes after them, so a director can point at a
      // reference and say "match this grade" and be understood.
      parts: [
        ...images.map((img) => ({ inlineData: { data: img.base64, mimeType: img.mimeType } })),
        { text: message },
      ],
    },
  ];

  const system = systemPrompt(project);
  let prose = "";
  const startedAt = Date.now();
  let ranOutOfTime = false;

  for (let step = 0; step < MAX_STEPS; step++) {
    // Out of clock: ask for a closing answer instead of starting more work, so
    // the director gets a report on what was actually done rather than a turn
    // that dies silently at the function's ceiling.
    if (Date.now() - startedAt > TURN_BUDGET_MS) {
      ranOutOfTime = true;
      contents.push({
        role: "user",
        parts: [
          {
            text: "SYSTEM: you are out of time on this turn. Do NOT call any more tools. Reply now, in prose, with exactly what you changed and what is still outstanding, so the director can pick it up in the next message.",
          },
        ],
      });
      const { parts: closing } = await callModel(vertexFetch, contents, system);
      const said = closing.map((p) => p.text || "").join("").trim();
      if (said) prose = prose ? `${prose}\n\n${said}` : said;
      break;
    }

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
      // Past the budget, decline anything still queued rather than starting it —
      // except the ones that must not be abandoned midway.
      if (Date.now() - startedAt > TURN_BUDGET_MS && !UNINTERRUPTIBLE.has(call.name)) {
        responseParts.push({
          functionResponse: {
            name: call.name,
            response: {
              result: {
                error: "Skipped — this turn ran out of time. Tell the director what you did and stop.",
              },
            },
          },
        });
        continue;
      }
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

  // Budget exhausted — say so rather than returning an empty bubble.
  return {
    text:
      prose ||
      (ranOutOfTime
        ? "That turn ran long and I had to stop before I could finish. Nothing is half-written — tell me the single next thing you want and I'll pick it up."
        : "I ran out of working steps on that one before I could finish. Tell me the single next thing you want changed and I'll take it from there."),
    steps,
    touchedFilm,
  };
}

module.exports = { runStorylineAgent, MAX_STEPS, TURN_BUDGET_MS };
