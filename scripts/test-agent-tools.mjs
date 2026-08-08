/**
 * Storyline agent test suite. Run: node scripts/test-agent-tools.mjs
 *
 * Covers the parts of the agent where being wrong is expensive or invisible:
 * the two tools that spend the director's money, the thread-scoped history, and
 * the wall-clock budget that stops a long turn dying at the function ceiling
 * with nothing written back.
 */

import { createRequire } from "node:module";

const require_ = createRequire(import.meta.url);
const tools = require_("../functions/optiqSkills/agentTools.js");
const { runStorylineAgent, MAX_STEPS, TURN_BUDGET_MS } = require_("../functions/optiqSkills/agent.js");
const { scorePrompt } = require_("../functions/audioPost.js");

let passed = 0;
const failures = [];

function test(name, fn) {
  try {
    const out = fn();
    if (out instanceof Promise) throw new Error("use testAsync for async cases");
    passed++;
    console.log(`  ok  ${name}`);
  } catch (err) {
    failures.push(name);
    console.error(`FAIL  ${name}\n      ${err?.message ?? err}`);
  }
}

async function testAsync(name, fn) {
  try {
    await fn();
    passed++;
    console.log(`  ok  ${name}`);
  } catch (err) {
    failures.push(name);
    console.error(`FAIL  ${name}\n      ${err?.message ?? err}`);
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

/** A film with three scenes, all rendered unless told otherwise. */
function makeProject(overrides = {}) {
  const scenes = [1, 2, 3].map((n) => ({
    sceneNumber: n,
    setting: `Scene ${n}`,
    action: "hands work",
    dialogue: "",
    sound: "NO MUSIC.",
    fullPrompt: `Black Gambian Gambian NO MUSIC. Musically silent. No soundtrack. ${"word ".repeat(1400)}`,
  }));
  const videoStatus = { 0: { status: "succeeded", url: "u0" }, 1: { status: "succeeded", url: "u1" }, 2: { status: "succeeded", url: "u2" } };
  return {
    id: "p1",
    uid: "u1",
    title: "From Our Soil",
    scenes,
    videoStatus,
    prepaidRenders: 0,
    aspectRatio: "9:16",
    ...overrides,
  };
}

function ctxFor(project, extra = {}) {
  return {
    project,
    saveProject: async (patch) => Object.assign(project, patch),
    progress: async () => undefined,
    vertexFetch: async () => {
      throw new Error("vertexFetch should not be called by these tools");
    },
    ...extra,
  };
}

// ── The tool surface ────────────────────────────────────────────────────────

test("the production tools are declared to the model", () => {
  const names = tools.functionDeclarations().map((d) => d.name);
  for (const name of ["render_scene", "rescore_film", "get_audio"]) {
    assert(names.includes(name), `${name} is not declared`);
  }
});

test("money-spending tools are flagged as writes in the work log", () => {
  assert(tools.WRITE_TOOLS.has("render_scene"), "render_scene not flagged");
  assert(tools.WRITE_TOOLS.has("rescore_film"), "rescore_film not flagged");
  assert(!tools.WRITE_TOOLS.has("get_audio"), "get_audio is read-only and must not be flagged");
});

test("every declared tool has a description that mentions cost where it applies", () => {
  const byName = new Map(tools.functionDeclarations().map((d) => [d.name, d.description]));
  assert(/cost/i.test(byName.get("render_scene")), "render_scene must warn about cost");
  assert(/asked/i.test(byName.get("render_scene")), "render_scene must say to wait to be asked");
});

// ── render_scene ────────────────────────────────────────────────────────────

await testAsync("render_scene shoots the scene and reports what it cost", async () => {
  const project = makeProject();
  const calls = [];
  const ctx = ctxFor(project, {
    renderScene: async (idx, prompt) => {
      calls.push({ idx, prompt });
      return { id: "gen_1", cost: 150, usedPrepaid: false };
    },
  });
  const result = await tools.callTool("render_scene", { sceneNumber: 2 }, ctx);
  assert(result.started, `did not start: ${JSON.stringify(result)}`);
  assert(calls.length === 1 && calls[0].idx === 1, `wrong scene index: ${JSON.stringify(calls)}`);
  assert(result.cost === 150, `cost ${result.cost}`);
  assert(/wallet/.test(result.paidFrom), `paidFrom: ${result.paidFrom}`);
});

await testAsync("render_scene reports a prepaid render as free", async () => {
  const ctx = ctxFor(makeProject({ prepaidRenders: 3 }), {
    renderScene: async () => ({ id: "gen_2", cost: 0, usedPrepaid: true }),
  });
  const result = await tools.callTool("render_scene", { sceneNumber: 1 }, ctx);
  assert(result.cost === 0, `cost ${result.cost}`);
  assert(/prepaid/.test(result.paidFrom), `paidFrom: ${result.paidFrom}`);
});

await testAsync("render_scene prefers the director's own edited prompt", async () => {
  const project = makeProject();
  project.videoStatus[0] = { status: "idle", customPrompt: "THE DIRECTOR'S OWN VERSION" };
  let seen = null;
  const ctx = ctxFor(project, {
    renderScene: async (_idx, prompt) => {
      seen = prompt;
      return { id: "g", cost: 0, usedPrepaid: true };
    },
  });
  await tools.callTool("render_scene", { sceneNumber: 1 }, ctx);
  assert(seen === "THE DIRECTOR'S OWN VERSION", `sent: ${String(seen).slice(0, 40)}`);
});

await testAsync("render_scene refuses a scene that is already rendering", async () => {
  const project = makeProject();
  project.videoStatus[0] = { status: "rendering", id: "in_flight" };
  let called = false;
  const ctx = ctxFor(project, {
    renderScene: async () => {
      called = true;
      return { id: "g", cost: 150, usedPrepaid: false };
    },
  });
  const result = await tools.callTool("render_scene", { sceneNumber: 1 }, ctx);
  assert(!called, "it started a second render of an in-flight scene");
  assert(/already rendering/.test(result.note || ""), `note: ${result.note}`);
});

await testAsync("render_scene rejects a scene that does not exist", async () => {
  let called = false;
  const ctx = ctxFor(makeProject(), {
    renderScene: async () => {
      called = true;
      return {};
    },
  });
  const result = await tools.callTool("render_scene", { sceneNumber: 99 }, ctx);
  assert(!called && /no scene 99/.test(result.error || ""), `result: ${JSON.stringify(result)}`);
});

await testAsync("render_scene declines cleanly when the power was not injected", async () => {
  // Belt and braces: a context without the callback must refuse, not throw.
  const result = await tools.callTool("render_scene", { sceneNumber: 1 }, ctxFor(makeProject()));
  assert(/isn't available/.test(result.error || ""), `result: ${JSON.stringify(result)}`);
});

// ── rescore_film ────────────────────────────────────────────────────────────

await testAsync("rescore_film starts a pass and passes the vibe through", async () => {
  let seen = "unset";
  const ctx = ctxFor(makeProject(), {
    rescoreFilm: async (vibe) => {
      seen = vibe;
    },
  });
  const result = await tools.callTool("rescore_film", { vibe: "warmer and slower" }, ctx);
  assert(result.started, `did not start: ${JSON.stringify(result)}`);
  assert(seen === "warmer and slower", `vibe was ${seen}`);
});

await testAsync("rescore_film refuses until the whole film has rendered", async () => {
  // The score is written against the finished cut, so this is not a nicety.
  const project = makeProject();
  project.videoStatus[2] = { status: "idle" };
  let called = false;
  const ctx = ctxFor(project, {
    rescoreFilm: async () => {
      called = true;
    },
  });
  const result = await tools.callTool("rescore_film", {}, ctx);
  assert(!called, "it scored an unfinished cut");
  assert(/haven't rendered/.test(result.error || ""), `error: ${result.error}`);
});

await testAsync("rescore_film will not stack a second pass on a running one", async () => {
  let called = false;
  const ctx = ctxFor(makeProject({ audioStage: "scoring" }), {
    rescoreFilm: async () => {
      called = true;
    },
  });
  const result = await tools.callTool("rescore_film", {}, ctx);
  assert(!called, "it queued a duplicate pass");
  assert(/already running/.test(result.note || ""), `note: ${result.note}`);
});

await testAsync("rescore_film runs again once a previous pass finished or failed", async () => {
  for (const stage of ["ready", "failed"]) {
    let called = false;
    const ctx = ctxFor(makeProject({ audioStage: stage }), {
      rescoreFilm: async () => {
        called = true;
      },
    });
    const result = await tools.callTool("rescore_film", {}, ctx);
    assert(called && result.started, `stage "${stage}" blocked a re-score: ${JSON.stringify(result)}`);
  }
});

test("the director's score direction outranks the derived tone in the prompt", () => {
  const prompt = scorePrompt({
    concept: "a family sells paste",
    brandName: "Sidrah",
    videoTypeNoun: "narrated ad",
    toneHint: "proud and bright",
    scoreNote: "warmer and slower, almost no percussion",
  });
  assert(/takes priority/.test(prompt), "the note is not marked as priority");
  assert(prompt.indexOf("warmer and slower") < prompt.indexOf("proud and bright"), "the note must lead the tone hint");
  assert(/No vocals/i.test(prompt), "the instrumental-only rule was lost");
});

// ── photograph_scenes / get_shot_board ──────────────────────────────────────

await testAsync("photograph_scenes turns scene NUMBERS into board indexes", async () => {
  let seen = null;
  const ctx = ctxFor(makeProject(), {
    buildShotBoard: async (indexes, keepDesign) => {
      seen = { indexes, keepDesign };
    },
  });
  const result = await tools.callTool("photograph_scenes", { sceneNumbers: [2, 3], keepDesign: true }, ctx);
  assert(result.started, `did not start: ${JSON.stringify(result)}`);
  // Scene 2 is index 1 — the off-by-one that would silently photograph the
  // wrong scenes, and the reason this test exists.
  assert(JSON.stringify(seen.indexes) === "[1,2]", `indexes were ${JSON.stringify(seen.indexes)}`);
  assert(seen.keepDesign === true, "keepDesign was dropped");
});

await testAsync("photograph_scenes with no scenes means the whole film", async () => {
  let seen = "unset";
  const ctx = ctxFor(makeProject(), {
    buildShotBoard: async (indexes) => {
      seen = indexes;
    },
  });
  const result = await tools.callTool("photograph_scenes", {}, ctx);
  assert(result.started && seen.length === 0, `result: ${JSON.stringify(result)}, indexes: ${JSON.stringify(seen)}`);
});

await testAsync("photograph_scenes refuses a scene that does not exist", async () => {
  let called = false;
  const ctx = ctxFor(makeProject(), {
    buildShotBoard: async () => {
      called = true;
    },
  });
  const result = await tools.callTool("photograph_scenes", { sceneNumbers: [99] }, ctx);
  assert(!called && /No scene matches 99/.test(result.error || ""), `result: ${JSON.stringify(result)}`);
});

await testAsync("photograph_scenes will not stack a second pass on a running one", async () => {
  let called = false;
  const ctx = ctxFor(makeProject({ shotBoardStage: "framing" }), {
    buildShotBoard: async () => {
      called = true;
    },
  });
  const result = await tools.callTool("photograph_scenes", {}, ctx);
  assert(!called && /already being photographed/.test(result.note || ""), `result: ${JSON.stringify(result)}`);
});

await testAsync("photograph_scenes runs again once a pass finished or failed", async () => {
  for (const stage of ["ready", "failed", "partial"]) {
    let called = false;
    const ctx = ctxFor(makeProject({ shotBoardStage: stage }), {
      buildShotBoard: async () => {
        called = true;
      },
    });
    await tools.callTool("photograph_scenes", {}, ctx);
    assert(called, `stage "${stage}" blocked a new pass`);
  }
});

await testAsync("get_shot_board reads the board rather than guessing at it", async () => {
  const project = makeProject({
    shotBoardStage: "ready",
    shotBoard: {
      continuity: {
        locations: [
          { key: "taxi", name: "Inside the taxi", scenes: [2, 3], geometry: "The steering wheel is on the LEFT; Modou drives.", vehicle: true },
        ],
      },
      setPlates: [{ key: "taxi", name: "Inside the taxi", url: "https://x/taxi.png" }],
      propPlates: [{ key: "letter", name: "The bank letter", kind: "document", detail: "TRUST BANK GAMBIA" }],
      scenes: {
        // Firestore hands index keys back as strings — the tool must read both.
        1: { sceneNumber: 2, coverage: "Two setups.", shots: [{ time: "0.0–5.0s", label: "Wide", camera: "c", blocking: "b", entry: "straight-into-action", url: "https://x/f1.png" }] },
      },
    },
  });
  const result = await tools.callTool("get_shot_board", {}, ctxFor(project));
  assert(result.locations[0].vehicle && /steering wheel is on the LEFT/.test(result.locations[0].geometry), "the vehicle geometry never made it back");
  assert(result.locations[0].photographed === true, "the set plate was not reported");
  assert(result.objects[0].detail === "TRUST BANK GAMBIA", "the object's readable detail was lost");
  assert(result.scenes[1].setups[0].photographed === true, "scene 2's frame was not reported");
  assert(result.scenes[0].setups.length === 0, "scene 1 has no setups and must say so");
});

await testAsync("get_shot_board says plainly when a film has never been photographed", async () => {
  const result = await tools.callTool("get_shot_board", {}, ctxFor(makeProject()));
  assert(/never run/.test(result.stage) && /photograph_scenes/.test(result.note || ""), `result: ${JSON.stringify(result)}`);
});

// ── get_audio ───────────────────────────────────────────────────────────────

await testAsync("get_audio reports what is actually on the tracks", async () => {
  const project = makeProject({
    audioStage: "ready",
    musicUrl: "https://cdn/score.mp3",
    audioReport: {
      filmDuration: 48.2,
      narrationLines: 3,
      musicSegments: 2,
      voice: "Deep, wise, slow Gambian man",
      violations: [],
      notes: ["Scene 2's length could not be measured; assumed 10s."],
      at: "2026-08-06T12:00:00.000Z",
    },
  });
  const result = await tools.callTool("get_audio", {}, ctxFor(project));
  assert(result.stage === "ready", `stage ${result.stage}`);
  assert(result.narrationLines === 3, `lines ${result.narrationLines}`);
  assert(result.problems.length === 1, `problems ${JSON.stringify(result.problems)}`);
  assert(/Gambian man/.test(result.voice), `voice ${result.voice}`);
});

await testAsync("get_audio says so plainly when nothing has been laid", async () => {
  const result = await tools.callTool("get_audio", {}, ctxFor(makeProject()));
  assert(result.stage === "never run", `stage ${result.stage}`);
  assert(result.narrationLines === 0 && result.musicSegments === 0, "counts should be zero");
});

// ── The turn budget ─────────────────────────────────────────────────────────

test("the step ceiling was raised but is still bounded", () => {
  assert(MAX_STEPS > 10, `MAX_STEPS is ${MAX_STEPS} — the whole point was to raise it`);
  assert(MAX_STEPS <= 40, `MAX_STEPS is ${MAX_STEPS} — unbounded loops burn the function`);
});

test("the wall-clock budget leaves room inside the function ceiling", () => {
  // The function dies at 540s. The budget has to stop the loop early enough to
  // still make a closing model call and write the answer back.
  assert(TURN_BUDGET_MS < 540_000, `budget ${TURN_BUDGET_MS}ms exceeds the function ceiling`);
  assert(540_000 - TURN_BUDGET_MS >= 60_000, "less than a minute of headroom to write the answer");
});

await testAsync("a turn that runs out of time still answers instead of dying silently", async () => {
  // Simulates the real failure: a slow tool eats the budget. The loop must stop
  // calling tools and produce prose the director can act on.
  const project = makeProject();
  let modelCalls = 0;
  let toolCalls = 0;
  const vertexFetch = async (_path, body) => {
    modelCalls++;
    const lastPart = body.contents[body.contents.length - 1]?.parts?.[0]?.text || "";
    if (/out of time/.test(lastPart)) {
      return {
        candidates: [
          { finishReason: "STOP", content: { parts: [{ text: "I rewrote scene 1. Scene 2 is still outstanding." }] } },
        ],
      };
    }
    // Otherwise keep asking for a tool, forever.
    return {
      candidates: [
        {
          finishReason: "STOP",
          content: { parts: [{ functionCall: { name: "get_film", args: {} } }] },
        },
      ],
    };
  };

  // Burn the budget on the first tool call.
  const originalNow = Date.now;
  let clock = originalNow();
  Date.now = () => clock;
  try {
    const result = await runStorylineAgent({
      vertexFetch,
      project,
      saveProject: async () => undefined,
      history: [],
      message: "fix the film",
      onSteps: async () => {
        toolCalls++;
        clock += TURN_BUDGET_MS; // the tool took longer than the whole budget
      },
    });
    assert(/still outstanding/.test(result.text), `no closing answer: ${result.text}`);
    assert(modelCalls <= 4, `made ${modelCalls} model calls — it should have stopped early`);
  } finally {
    Date.now = originalNow;
  }
});

await testAsync("an unknown tool name is refused, not thrown", async () => {
  const result = await tools.callTool("delete_everything", {}, ctxFor(makeProject()));
  assert(result && result.error, `expected an error result, got ${JSON.stringify(result)}`);
});

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length > 0) process.exit(1);
