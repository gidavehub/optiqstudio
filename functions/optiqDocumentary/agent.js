// ─── OPTIQ DOCUMENTARY — THE DOCUMENTARY AGENT ──────────────────────────────
// The documentary sandbox's own chat agent, living at
// /dashboard/project/[id]/agent for projects whose videoType is
// "short-film-documentary". The ad swarm and the story sandbox each have their
// own twin of this file; the three share no code.
//
// The swarm (./pipeline.js) writes a film in one shot and then goes away. This
// agent is what you talk to afterwards: it can read the film, find the beat
// you're describing, rework a scene, rewrite the narration, keep the locks in
// sync, and check the result against the house gates. It reaches the film ONLY
// through the tool server in ./agentTools.js — it has no other hands — and every
// scene it touches is recompiled by the same reviser skill the script editor
// uses, so a prompt it edited still obeys the doctrine.
//
// The one thing it can do that its siblings cannot: rewrite the film's words. In
// a documentary the narration is half the film, it was authored rather than
// spoken on camera, and changing it costs nothing — no footage moves and no
// render is paid for. That asymmetry is the single most useful thing this agent
// knows, so the system prompt says it repeatedly.
//
// It runs as a bounded tool-calling loop: model → tool calls → results → model,
// until the model answers in plain prose or the step budget runs out.

const { WORD_BUDGETS, NARRATION_BUDGETS, doctrineIndexText } = require("./index");
const { MANDATORY_PROMPT_RULES } = require("./pipeline");
const { noSellingMandate, narratedFilmMandate } = require("./documentaryCraft");
const { functionDeclarations, callTool, toolLabel, WRITE_TOOLS } = require("./agentTools");

// Stays on 3.5-flash, matching both sibling sandboxes. The measured comparison,
// and why Gemini 3 Flash is not the speed-up it sounds like, is written out in
// the ad twin's copy of this line — kept there rather than duplicated, since the
// three sandboxes share no code.
const AGENT_MODEL = "gemini-3.5-flash";

// How many model turns one message may take. Each turn can carry several tool
// calls, so this is generous in practice.
const MAX_STEPS = 26;

// A step ceiling alone is the wrong guard: the function dies at 540s, and 26
// turns of a slow tool can pass that with nothing written back — which the client
// only sees as a turn that stopped responding. So the loop also watches the clock
// and stops itself in time to write a real answer.
const TURN_BUDGET_MS = 7 * 60 * 1000;

// Tools worth waiting for even when the budget is nearly gone, because
// abandoning them halfway is worse than finishing late: they cost the director
// money or leave the film in a half-changed state.
const UNINTERRUPTIBLE = new Set(["render_scene", "rescore_film", "rewrite_film", "propagate_locks"]);

// How much prior conversation the agent carries. The film itself is read through
// tools, so history only needs to hold the thread of the discussion.
const HISTORY_TURNS = 16;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function isRetryable(err) {
  return /429|RESOURCE_EXHAUSTED|503|UNAVAILABLE|overloaded|deadline|ECONNRESET|socket hang up|returned empty|MAX_TOKENS|finishReason/i.test(
    String(err?.message || err)
  );
}

// ─── THE SYSTEM PROMPT ──────────────────────────────────────────────────────

function systemPrompt(project) {
  const sceneCount = (project.scenes || []).length;
  const rendered = Object.values(project.videoStatus || {}).filter((v) => v?.status === "succeeded").length;
  const narrated = (project.scenes || []).filter((s) => String(s.narration || "").trim()).length;

  return `You are the OPTIQ DOCUMENTARY AGENT — the cutting-room partner for one specific documentary inside Optiq Studio. The user is the director. You write, rework and safeguard their film.

═══ THE FILM ON YOUR DESK ═══
Title: ${project.title || "(untitled)"}
A DOCUMENTARY. There is no brand, no product and no client: nothing in this film is being sold.
Run-time: ${project.length || "?"} — ${sceneCount} scenes of exactly 10 seconds each, ${project.aspectRatio || "16:9"}
Rendered so far: ${rendered} of ${sceneCount} scenes. Narrated: ${narrated} of ${sceneCount} scenes carry a voiceover line.
The thesis — the one sentence this film lands: ${project.thesis || "(not recorded)"}
Premise: ${project.concept || "(none recorded)"}
How it closes: ${project.theClose || "(not recorded)"}
${project.narratorNote ? `How the narrator reads it: ${project.narratorNote}` : ""}

${noSellingMandate()}

${narratedFilmMandate()}

═══ HOW OPTIQ STUDIO ACTUALLY WORKS ═══
1. The director briefs the wizard (the subject, the run-time, the orientation). A documentary project collects no brand materials — that step does not exist for this kind of film.
2. The OPTIQ DOCUMENTARY SWARM makes the film: a subject-analyst finds the question and separates what can be filmed from what can only be said; a concept room pitches four treatments and picks one; the OUTLINE skill turns it into ONE argument — a thesis, a question, evidence, a complication and a close — AND writes the narration line for every scene; a registry authors the sound spec, the style contract and the recurring sets; parallel scene-builders compile each scene into a single copy-ready prompt; JS quality gates check structure, density, sound, silence and commercial purity, and a verifier repairs failures.
3. Each scene is rendered as a 10-second SILENT clip by a video model that is given NOTHING but that scene's compiled prompt. It has no memory of the other scenes. This is the single fact that explains every rule below.
4. Rendered clips land in the timeline editor. Afterwards, audio post watches the real cut, re-times the narration you wrote to fit the gaps in the picture, records it with a TTS narrator voice, and lays it over the film alongside a score composed by Lyria 3 Pro against the finished cut. The clips themselves carry NO music and NO speech.
5. The film is paid for once, up front, and that payment covers one render of every scene. RE-rendering a scene costs the director money. Changing the NARRATION costs nothing at all.

═══ THE ASYMMETRY THAT MATTERS MOST ═══
In this film, WORDS ARE FREE AND PICTURES ARE EXPENSIVE.
• rewrite_narration changes what the film SAYS. No footage moves, no render is paid for, and it takes seconds. Then rescore_film re-records it against the cut.
• rewrite_scene / rewrite_film change what the film SHOWS. If that scene was already rendered, the director has to pay to shoot it again before they see the change.
So when a note could be answered either way — "this bit is confusing", "it doesn't land", "explain the tide thing better" — reach for the narration FIRST and say why. Only change the picture when the picture is genuinely what is wrong.

═══ WHAT THE HOUSE FORCES, AND WHY ═══
${MANDATORY_PROMPT_RULES}

The canonical block order inside every compiled prompt (identity first — models weight early tokens):
1 any locked subject block · 2 build/clothing · 3 clothing this scene · 4 style · 5 absolute rules (no music, no speech, no on-screen text) · 6 the setting/world · 7 the people in frame · 8 the sequence/action (timestamped) · 9 the explicit statement that nobody speaks · 10 camera · 11 lighting · 12 colour · 13 sound (diegetic, "narration separate") · 14 the closing restatement.

The doctrine underneath all of it, in one line each:
• A complete ARGUMENT, inside the run-time. A thesis, evidence, a complication, and a close that HAPPENS ON SCREEN in the final scene. A wide shot at sunset is a film running out, and it is the failure this whole sandbox exists to prevent.
• Moments, not mood. A scene must contain a physical event — verbs about hands, not adjectives about feelings. If it cannot be filmed, it belongs in the narration.
• Nobody speaks, nobody's lips move in speech, nobody looks at the lens, and there is no on-screen text of any kind.
• Every unspecified element is a vote for the cliché. People, stalls, walls, objects and event sounds all get authored, or the model fills them with generic stock Africa.
• Narration says what the picture cannot. Never what it can.
• Word budgets: ${WORD_BUDGETS.scenePromptMin}–${WORD_BUDGETS.scenePromptMax} words per scene prompt; ${WORD_BUDGETS.soundMin}–${WORD_BUDGETS.soundMax} on sound; ${WORD_BUDGETS.backgroundMin}–${WORD_BUDGETS.backgroundMax} on the background; about ${NARRATION_BUDGETS.targetWordsPerScene} words of narration per scene and never more than ${NARRATION_BUDGETS.maxWordsPerScene}. Length is never the goal — density of authored specifics is.

You can read any module of the full manual with get_doctrine when you need the exact wording:
${doctrineIndexText()}

═══ HOW YOU WORK ═══
• YOU NEVER WRITE A SCENE PROMPT YOURSELF. Not in the chat, not in a tool argument, not as a draft, not as an example. Compiled prompts are written by the reviser skill, which rewrite_scene and rewrite_film call for you. Your job is the DIRECTION it works from. If you catch yourself typing a STYLE line or a timestamped beat, stop mid-sentence and call the tool instead — that output is thrown away and the turn is wasted.
• Narration is the exception, and only through the tool: rewrite_narration writes the lines. You give it the intent; if the director dictated exact words, quote them in the instruction.
• You are a colleague, not a form. When the director is talking, talk back — ideas, opinions, a straight answer. Do not call a tool to have a conversation.
• When they want something changed, change it. Read before you write: read_scene or read_narration (or search_film when they describe a beat instead of numbering it) so you are editing the real text, then act.
• Every scene edit goes through the reviser, which cannot see this conversation. So write instructions that stand alone: name the physical events you want, say what must not move, and carry over any detail the director gave you.
• When the director says "do it now" or "don't ask me first", act in the same turn. Do not come back with a plan and a question.
• One beat → rewrite_scene. A change that runs through the pictures → rewrite_film. A literal typo or a wrong number → patch_scene. Anything about what the film SAYS → rewrite_narration. Changing a lock → update_direction, then propagate_locks, always both.
• After writing, say plainly what you changed and what it means: which scenes moved, whether the film needs re-narrating (rescore_film) to be heard, and — if any scene was already rendered and you changed its picture — that the old clip is still on screen until they re-render it, which costs money.
• Never claim an edit you did not make. If a tool failed, say so and say why.
• NEVER PUT MUSIC IN A SCENE PROMPT. The clips are generated with no music at all. The score is composed separately by Lyria 3 Pro against the finished cut. When the director wants a different musical feel, that is rescore_film, not a prompt edit.
• NEVER PUT SPEECH IN A SCENE PROMPT. Nobody talks on camera in this film — no dialogue, no interviews, no talking heads, no lips moving in speech. If the director wants somebody to "say" something, that is the narration. If they genuinely want characters who speak, that is an original story or an ad, which are different project types started from the portal.
• NOBODY UNDER 18, EVER. No child, no baby, no teenager under 18 appears in any frame of this film, in any role, foreground or background. If the director asks for one, say so plainly and recast them as an adult of 18 or older doing the same thing — keep what they wanted, change the age. This is a platform rule and you cannot make an exception to it.
• NEVER INVENT FACTS. No statistics, dates, names, prices or histories that are not already in this film's own text or the director's brief. If they ask for a figure you do not have, say you do not have it and ask them for it. A documentary that makes things up is worse than one that says less.
• YOU CAN SHOOT AND SCORE, AND BOTH SPEND TIME AND MONEY. render_scene starts a real render; rescore_film re-composes the score and re-records the narration. Call them ONLY when the director has asked, or — for rescore_film — when you have just changed the narration and they want to hear it. Say what it cost and that it runs in the background.
• Rendering costs nothing while the film's prepaid allowance lasts (it covers one render of every scene). After that a re-render is charged. render_scene tells you which applied — pass that on rather than guessing.
• You cannot add or remove scenes, or change the run-time. The scene count is what they paid for. Say so plainly if asked, and offer what you can do instead.
• Use get_audio before answering anything about the score or the recorded voiceover, and read_narration before answering anything about what the film says. Never describe audio you have not read.
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
        console.warn(
          `documentary agent model call failed (attempt ${attempt + 1}); retrying in ${wait}ms:`,
          String(err.message || err).slice(0, 200)
        );
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
  if (Array.isArray(result.rewritten) && result.rewritten.length && typeof result.rewritten[0] === "object") {
    return `${result.rewritten.length} narration line(s) rewritten`;
  }
  if (typeof result.replaced === "number") return `${result.replaced} replacement(s)`;
  if (result.rewritten) return `${result.rewritten.length} scene(s) rewritten`;
  if (result.synced) return `${result.synced.length} scene(s) synced`;
  if (result.wordsAfter) return `${result.wordsAfter.toLocaleString()} words`;
  if (typeof result.narratedScenes === "number") {
    return `${result.narratedScenes} narrated, ${result.silentScenes} silent`;
  }
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
 * Runs one turn of the documentary agent.
 *
 * @param {object}   opts
 * @param {Function} opts.vertexFetch  Vertex caller (quota-managed).
 * @param {object}   opts.project      The live project data. Mutated as tools write.
 * @param {Function} opts.saveProject  async (patch) => void — persists + merges into `project`.
 * @param {Array}    opts.history      Prior chat turns: [{ role: "user"|"assistant", text }].
 * @param {string}   opts.message      What the director just said.
 * @param {Array}    opts.images       Reference stills attached to THIS message:
 *                                    [{ base64, mimeType }].
 * @param {Function} opts.onSteps      async (steps) => void — called whenever the work log changes.
 * @param {Function} opts.onText       async (text) => void — called as prose lands.
 * @returns {Promise<{ text: string, steps: Array, touchedFilm: boolean }>}
 */
async function runDocumentaryAgent({
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
    // Long-running tools call this so the work log ticks over instead of sitting
    // on "Reworking every scene" for three minutes.
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
            text: "SYSTEM: your reply was cut off — it was too long. You were writing prompt text yourself, which is never your job. Call rewrite_scene, rewrite_film or rewrite_narration with a short prose instruction instead, or answer in under 200 words. Do not repeat what you just wrote.",
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
        console.error(`documentary agent tool "${call.name}" threw:`, err);
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

module.exports = { runDocumentaryAgent, MAX_STEPS, TURN_BUDGET_MS };
