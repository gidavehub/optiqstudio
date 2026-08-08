/**
 * The shot board, end to end, with no Vertex and no Firestore.
 *
 *   node scripts/test-shot-board.mjs
 *
 * Every model call is stubbed, so this proves the WIRING rather than the
 * pictures. What it is really here to prove is the ORDER, because the order is
 * the feature: an arrangement has to be photographed on top of its place, a
 * state has to be photographed on top of the state before it, and an end frame
 * on top of its own first frame. Get any of those backwards and the tier
 * silently degrades to "generated from the same paragraph twice", which is the
 * exact failure the hierarchy exists to remove — and it degrades invisibly,
 * because the pictures still come back.
 *
 * It also covers the things that are hard to test any other way: that a location
 * is photographed once and reused, that a frame carries the right anchor plus
 * only the people and objects in that setup, that the clause enumerates exactly
 * the stills the render will attach, and that running out of time leaves a
 * resumable board rather than a mess.
 *
 * Whether the frames are any GOOD is scripts/probe-nano-banana-2.mjs's question.
 */
import { runShotBoard, renderAttachments } from "../functions/shotBoardRun.js";
import * as adBrainNs from "../functions/optiqSkills/shotBoard.js";
import * as storyBrainNs from "../functions/optiqStory/shotBoard.js";

const brain = adBrainNs.default ?? adBrainNs;
const storyBrain = storyBrainNs.default ?? storyBrainNs;

let failures = 0;
const check = (label, condition, detail = "") => {
  if (condition) {
    console.log(`  OK   ${label}${detail ? `  ${detail}` : ""}`);
  } else {
    failures++;
    console.log(`  FAIL ${label}${detail ? `  ${detail}` : ""}`);
  }
};

// ── The film under test ─────────────────────────────────────────────────────
// Three scenes, two places, one of them a car — the case that fails most in
// production and the reason the geometry field exists. The letter CHANGES
// between scenes, which is what exercises the state cascade.

const scenePrompt = (n, where) =>
  `SCENE ${n}. ${where}. ` +
  // Long on purpose: a real scene prompt is 1,500–2,000 words, and the whole
  // point of the framed prompt is that it is a fraction of that.
  "A Black Gambian woman named Binta, golden-brown complexion, close-cropped hair. ".repeat(55) +
  "0.0s she opens the door. 3.0s she sits. 6.0s she reads the letter. 9.0s she looks up. ".repeat(70);

const project = {
  uid: "u1",
  aspectRatio: "16:9",
  styleHeader: "Documentary realism, 35mm, natural light, no slow motion.",
  brandName: "Trust Bank",
  product: "a savings account",
  materials: [{ name: "product.png", path: "users/u1/materials/product.png", mimeType: "image/png" }],
  characterRefs: [
    { name: "Binta", role: "the lead", lcb: "Black Gambian woman, 34.", wardrobe: "TEAL wrap dress.", scenes: [1, 2, 3], path: "users/u1/characters/char_binta.png", mimeType: "image/png" },
    { name: "Modou", role: "the driver", lcb: "Black Gambian man, 41.", wardrobe: "GREY shirt.", scenes: [2], path: "users/u1/characters/char_modou.png", mimeType: "image/png" },
  ],
  scenes: [
    { sceneNumber: 1, setting: "A bank counter", action: "Binta is handed a letter", sound: "room tone", fullPrompt: scenePrompt(1, "Inside the bank") },
    { sceneNumber: 2, setting: "Inside the taxi", action: "Binta reads it as Modou drives", sound: "engine", fullPrompt: scenePrompt(2, "Inside the taxi") },
    { sceneNumber: 3, setting: "Inside the taxi", action: "She folds the letter away", sound: "engine", fullPrompt: scenePrompt(3, "Inside the taxi") },
  ],
};

const base = (scenes) => ({ key: "base", name: "As it starts", scenes, isBase: true, change: "" });

const WORLD = {
  environments: [
    {
      key: "bank-counter",
      name: "The bank counter",
      scenes: [1],
      lock: "A cramped branch interior with a long laminate counter. ".repeat(12),
      geometry: "The counter runs down the right-hand side. The door is in the left-hand wall. The queue rail stands in front of it.",
      light: "Fluorescent overheads plus daylight through the door, mid-morning.",
      vehicle: false,
      needsSecondAngle: true,
      secondAngle: "Looking back from behind the counter toward the door and the queue rail.",
      states: [base([1])],
    },
    {
      key: "taxi-interior",
      name: "Inside the yellow taxi",
      scenes: [2, 3],
      lock: "A 1990s Mercedes saloon with cracked black vinyl. ".repeat(12),
      geometry:
        "LEFT-HAND DRIVE: the steering wheel is on the LEFT. Modou is in the driver's seat on the left. Binta is in the front passenger seat on the right. Both front windows are down. The vehicle faces north up Kairaba Avenue.",
      light: "Hard midday sun through the windscreen.",
      vehicle: true,
      needsSecondAngle: false,
      secondAngle: "",
      states: [base([2, 3])],
    },
  ],
  settings: [
    {
      key: "cab-front",
      name: "The front of the cab",
      environmentKey: "taxi-interior",
      scenes: [2, 3],
      lock: "The two front seats dressed as they are driven in, with the dashboard clutter and the letter in play. ".repeat(2),
      layout:
        "The prayer beads hang from the mirror, centre. The phone sits face-down in the driver's-side cupholder. The letter is on Binta's knee on the passenger side, folded edge toward the window. The water bottle is in the passenger door pocket.",
      seating: "Modou is in the driver's seat on the left. Binta is in the front passenger seat on the right. Nobody is in the back.",
      objectKeys: ["the-letter"],
      states: [
        base([2]),
        { key: "tidied", name: "After she folds it away", scenes: [3], isBase: false, change: "The letter is gone from her knee and the door pocket now holds it folded in four; the water bottle has moved to the centre console." },
      ],
    },
  ],
  objects: [
    {
      key: "the-letter",
      name: "The bank letter",
      kind: "document",
      scenes: [1, 2, 3],
      anchor: "A single sheet of A4 from Trust Bank Gambia, one horizontal fold.",
      detail: 'The letterhead reads "TRUST BANK GAMBIA" in navy capitals; the figure "D 4,500.00" sits near the bottom.',
      plateWorthy: true,
      reasoning: "Readable, and in three scenes.",
      states: [
        base([1, 2]),
        { key: "creased", name: "After a day in her hand", scenes: [3], isBase: false, change: "A second fold now crosses the first, and the lower right corner is soft and furred where her thumb has worried it." },
      ],
    },
    {
      key: "the-tin",
      name: "The product tin",
      kind: "packaging",
      scenes: [3],
      anchor: "A 400g tin with a red band.",
      detail: "The brand name across the red band.",
      plateWorthy: true,
      reasoning: "Readable label.",
      states: [base([3])],
    },
    {
      key: "a-chair",
      name: "A plastic chair",
      kind: "object",
      scenes: [1],
      anchor: "A white plastic chair.",
      detail: "",
      plateWorthy: false,
      reasoning: "Background scenery, seen once.",
      states: [base([1])],
    },
  ],
  sceneWorld: [
    { sceneNumber: 1, environmentKey: "bank-counter", settingKeys: [], objectKeys: ["the-letter"] },
    { sceneNumber: 2, environmentKey: "taxi-interior", settingKeys: ["cab-front"], objectKeys: ["the-letter"] },
    { sceneNumber: 3, environmentKey: "taxi-interior", settingKeys: ["cab-front"], objectKeys: ["the-letter", "the-tin"] },
  ],
};

/** Setup 0 moves and asks for an end frame; setup 1 is locked and does not. */
const shotPlan = (sceneNumber, characters, settingKey) => ({
  sceneNumber,
  coverage: "Two setups: the wide, then the insert.",
  shots: [
    {
      order: 0,
      time: "0.0–5.0s",
      label: "Wide from the rear bench",
      camera: "A 35mm wide from the rear bench, at shoulder height, taking in both front seats and the windscreen beyond.",
      blocking: "Modou is on the left behind the wheel, Binta on the right in the passenger seat, the letter in her lap.",
      firstFrame: "Binta sits with the folded letter flat on her knee, her right hand still on the door handle, eyes down.",
      motion: "She lifts the letter, unfolds it once, and turns it towards the window light.",
      entry: "straight-into-action",
      cameraMove: "push-in",
      endFrame: "The letter is open and raised to the window, Binta's face now close behind it and turned into the light.",
      settingKey,
      reverseAngle: false,
      characters,
      objectKeys: ["the-letter"],
    },
    {
      order: 1,
      time: "5.0–10.0s",
      label: "Insert on the letter",
      camera: "A 50mm close insert over her right shoulder, framed tight on the letter and her hands only.",
      blocking: "The letter fills the lower two-thirds of frame, her thumbs at its left and right edges, the seat cover behind.",
      firstFrame: "The letter is open and flat, both thumbs pinning its lower corners, the figure near the bottom in shadow.",
      motion: "Her thumb slides down across the figure and stops flat beneath it.",
      entry: "straight-into-action",
      cameraMove: "locked",
      endFrame: "",
      settingKey,
      reverseAngle: true,
      characters,
      objectKeys: ["the-letter"],
    },
  ],
});

/** A brief that passes the gates: over the floor, keeps the sound, forbids music. */
const FRAMED_BODY = [
  "WHAT HAPPENS",
  "0.0s Binta pulls the taxi door shut behind her and drops onto the passenger seat. ".repeat(3),
  "3.0s she works the folded letter open against her knee with one thumb. ".repeat(3),
  "6.0s she raises it into the window light and her eyes track down the page. ".repeat(3),
  "9.0s she lowers it flat and turns her face to the road ahead. ".repeat(3),
  "",
  "DIALOGUE",
  "None. Neither of them speaks across these ten seconds and the silence is the point.",
  "",
  "SOUND",
  "Continuous ambience: the engine under everything, traffic passing on the right, wind through both open front windows. ".repeat(2),
  "The door thumps shut. The seat springs give. The paper crackles as the fold comes open and again as it flattens. ".repeat(2),
  "NO MUSIC of any kind — no score, no instrument, no drone, no rhythmic bed under any part of this clip.",
  "",
  "CAMERA",
  "A slow push in across the first five seconds, then a hard cut to the locked insert. No dissolves.",
].join("\n");

// Padded to clear the 1,000-word floor the way a real brief clears it — by
// spending the words on sound and performance, which is exactly where the
// budget is meant to go.
const FRAMED =
  FRAMED_BODY +
  "\n" +
  "Hold the ambience steady beneath every line and let the engine sit just under the voices throughout. ".repeat(70);

// ── Stubs ───────────────────────────────────────────────────────────────────

const calls = { world: 0, design: 0, briefs: 0, images: [], loads: [] };

const vertexFetch = async (_path, body) => {
  const system = body.systemInstruction.parts[0].text;
  const user = body.contents[0].parts.map((p) => p.text || "").join("");
  let payload;
  if (system.includes("CONTINUITY SUPERVISOR")) {
    calls.world++;
    payload = WORLD;
  } else if (system.includes("SHOT DESIGNER")) {
    calls.design++;
    const n = Number((user.match(/SCENE (\d+)/) || [])[1]) || 1;
    payload = shotPlan(n, n === 2 || n === 3 ? ["Binta", "Modou"] : ["Binta"], n === 1 ? "" : "cab-front");
  } else if (system.includes("FIRST ASSISTANT DIRECTOR")) {
    calls.briefs++;
    payload = { framedPrompt: FRAMED };
  } else {
    throw new Error("unexpected skill call");
  }
  return { candidates: [{ content: { parts: [{ text: JSON.stringify(payload) }] } }] };
};

const makeStubs = ({ failFrames = false } = {}) => ({
  generateImage: async (prompt, opts = {}) => {
    calls.images.push({ prompt, aspectRatio: opts.aspectRatio, inputs: (opts.images || []).length });
    if (failFrames && prompt.includes("single frame from a live-action film")) throw new Error("stub frame failure");
    return { base64: "AAAA", mimeType: "image/png" };
  },
  storeImage: async (path) => ({ path, url: `https://storage.example/${path}` }),
  loadImage: async (path) => {
    calls.loads.push(path);
    return "BBBB";
  },
});

/** Where a kind of picture sits in the order they were actually generated. */
const KINDS = {
  environment: "establishing photograph of ONE",
  reverse: "from a SECOND ANGLE",
  setting: "photograph of ONE DRESSED ARRANGEMENT",
  object: "reference photograph of ONE single object",
  state: "photographed LATER IN THE SAME FILM",
  frame: "single frame from a live-action film — one frozen instant",
  endFrame: "the LAST frame of a shot whose FIRST frame is attached",
};
const of = (kind) => calls.images.filter((c) => c.prompt.includes(KINDS[kind]));
const firstIndexOf = (kind) => calls.images.findIndex((c) => c.prompt.includes(KINDS[kind]));
const lastIndexOf = (kind) => calls.images.map((c) => c.prompt.includes(KINDS[kind])).lastIndexOf(true);

// ── 1. A full pass ──────────────────────────────────────────────────────────

console.log("\nA full pass over a 3-scene film:");
let report = await runShotBoard({
  vertexFetch,
  brain,
  project,
  projectId: "p1",
  uid: "u1",
  ...makeStubs(),
});

check("one world call for the whole film", calls.world === 1, `(${calls.world})`);
check("one shot-design call per scene", calls.design === 3, `(${calls.design})`);
check("both places photographed", report.plates.filter((p) => p.tier === "environment" && p.url).length === 2);
check("the second covering angle is shot only where asked for", of("reverse").length === 1, `(${of("reverse").length})`);
check("the arrangement is photographed", report.plates.some((p) => p.tier === "setting" && p.url));
check(
  "only plate-worthy objects photographed",
  report.plates.filter((p) => p.tier === "object").every((p) => p.key !== "a-chair") &&
    new Set(report.plates.filter((p) => p.tier === "object").map((p) => p.key)).size === 2,
  `(${[...new Set(report.plates.filter((p) => p.tier === "object").map((p) => p.key))].join(", ")})`
);
check("every scene has its setups", Object.keys(report.scenes).length === 3);
check("the pass reports itself finished", report.done === true && report.remaining.length === 0);

// ── 2. THE ORDER, which is the whole point ──────────────────────────────────

console.log("\nThe cascade runs top-down:");
check(
  "the second angle is shot AFTER the master it descends from",
  firstIndexOf("reverse") > firstIndexOf("environment")
);
check("the second angle is built ON the master", of("reverse").every((c) => c.inputs === 1));
check(
  "arrangements are shot AFTER every place and object they sit on",
  firstIndexOf("setting") > lastIndexOf("environment") && firstIndexOf("setting") > firstIndexOf("object")
);
check(
  "an arrangement is built ON its place and the objects in it",
  of("setting").every((c) => c.inputs >= 2),
  `(inputs: ${of("setting").map((c) => c.inputs).join(",")})`
);
check(
  "every state plate is built ON exactly one parent picture, never from words",
  of("state").length === 2 && of("state").every((c) => c.inputs === 1),
  `(${of("state").length} state plates, inputs: ${of("state").map((c) => c.inputs).join(",")})`
);
check(
  "a state is shot after the state it changes",
  of("state").every((c) => calls.images.indexOf(c) > firstIndexOf("object"))
);
check(
  "the changed letter and the changed cab are both photographed",
  report.plates.some((p) => p.tier === "object" && p.stateKey === "creased" && p.url) &&
    report.plates.some((p) => p.tier === "setting" && p.stateKey === "tidied" && p.url)
);
check("frames come last of all the pictures", firstIndexOf("frame") > lastIndexOf("setting"));
check(
  "an end frame is shot AFTER, and ON, its own first frame",
  of("endFrame").length === 3 &&
    of("endFrame").every((c) => c.inputs >= 1) &&
    firstIndexOf("endFrame") > firstIndexOf("frame"),
  `(${of("endFrame").length} end frames)`
);
check(
  "only the moving setup buys one — the locked one does not",
  of("frame").length === 6 && of("endFrame").length === 3,
  `(${of("frame").length} frames, ${of("endFrame").length} end frames)`
);

// ── 3. What each picture is told ────────────────────────────────────────────

console.log("\nWhat each picture is told:");
check("place plates are shot in the film's aspect", of("environment").every((c) => c.aspectRatio === "16:9"));
check("place plates are shot empty", of("environment").every((c) => c.prompt.includes("COMPLETELY EMPTY OF PEOPLE")));
check("arrangement plates are shot empty too", of("setting").every((c) => c.prompt.includes("COMPLETELY EMPTY OF PEOPLE")));
check("object plates are shot square", of("object").every((c) => c.aspectRatio === "1:1"));
check(
  "a state plate forbids changing anything but the change",
  of("state").every((c) => c.prompt.includes("CHANGE ONLY THAT"))
);

const productPlate = calls.images.find((c) => c.prompt.includes("THE ATTACHED PHOTOGRAPH IS THE REAL OBJECT"));
check("the product plate is built from the client's own photo", !!productPlate && productPlate.inputs === 1);
check(
  "a document plate is NOT given the client's product photo",
  !calls.images.some((c) => c.prompt.includes("TRUST BANK GAMBIA") && c.prompt.includes(KINDS.object) && c.inputs > 0)
);

const frameCalls = of("frame");
check("frames are shot in the film's aspect", frameCalls.every((c) => c.aspectRatio === "16:9"));
check(
  "a taxi frame anchors on the ARRANGEMENT, not the place",
  frameCalls.filter((c) => c.prompt.includes("Attached image 1 is THE ARRANGEMENT")).length === 4,
  `(${frameCalls.filter((c) => c.prompt.includes("Attached image 1 is THE ARRANGEMENT")).length})`
);
check(
  "a scene with no arrangement falls back to the place",
  frameCalls.filter((c) => c.prompt.includes("Attached image 1 is THE PLACE")).length === 2
);
check(
  "the place and the arrangement are never both attached",
  !frameCalls.some((c) => c.prompt.includes("is THE ARRANGEMENT") && c.prompt.includes("is THE PLACE"))
);
check(
  "every frame carries its anchor, its people and its object",
  // Scene 2 is the only one with two character sheets: Modou's sheet covers
  // scene 2 alone, so scene 3 gets Binta's only even though the setup names them
  // both — a sheet never rides on a scene its character is not in (§14.4).
  frameCalls.map((c) => c.inputs).join(",") === "3,3,4,4,3,3",
  `(${frameCalls.map((c) => c.inputs).join(",")})`
);
check(
  "the vehicle's seating is restated inside every taxi frame",
  frameCalls.filter((c) => c.prompt.includes("Modou is in the driver's seat on the left")).length === 4
);
check(
  "the arrangement's exact layout rides inside the frame prompt",
  frameCalls.filter((c) => c.prompt.includes("face-down in the driver's-side cupholder")).length === 4
);
check(
  "a frame names each attachment so the numbering cannot slip",
  frameCalls.some((c) => c.prompt.includes("Attached image 2 is BINTA"))
);
check(
  "every frame insists a real camera was in the place",
  frameCalls.every((c) => c.prompt.includes("A REAL CAMERA WAS PHYSICALLY IN THIS PLACE"))
);

// ── 4. The short prompt a photographed scene renders from ───────────────────

console.log("\nThe framed prompt:");
check("one brief per photographed scene", calls.briefs === 3, `(${calls.briefs})`);
check("every scene got one", Object.keys(report.framedPrompts).length === 3);
// Not "much shorter" — the brief is deliberately 1,000–1,500 words, because what
// a still cannot carry (every sound, every voice, every piece of timing) is a lot
// of writing. What it must not carry is the LOOK, and that is the real test.
check(
  "the brief is shorter than the script it replaces",
  report.framedPrompts[1].split(/\s+/).length < project.scenes[1].fullPrompt.split(/\s+/).length,
  `(${report.framedPrompts[1].split(/\s+/).length} vs ${project.scenes[1].fullPrompt.split(/\s+/).length} words)`
);
check(
  "and it has dropped the appearance description the frames now carry",
  !/golden-brown complexion/.test(report.framedPrompts[1])
);
check(
  "it is long enough to have actually specified the sound",
  report.framedPrompts[1].split(/\s+/).length >= brain.FRAMED_PROMPT_MIN * 0.7,
  `(${report.framedPrompts[1].split(/\s+/).length} words, floor is ${Math.round(brain.FRAMED_PROMPT_MIN * 0.7)})`
);
check("the brief keeps the no-music law", /NO MUSIC/i.test(report.framedPrompts[1]));
check("the board carries it per scene", report.scenes[1].framedPrompt === FRAMED);

// ── 5. The clause on the scene prompt ───────────────────────────────────────

console.log("\nThe clause that goes into the video prompt:");
const frames = report.scenes[1].shots;
const once = brain.applyShotBoardClause(project.scenes[1].fullPrompt, frames);
const twice = brain.applyShotBoardClause(once, frames);

check("the block lands on the prompt", once.includes(brain.SHOT_BOARD_OPEN) && once.includes(brain.SHOT_BOARD_CLOSE));
check("re-applying it does not stack a second one", twice === once);
check("stripping it restores the original", brain.stripShotBoardClause(once) === project.scenes[1].fullPrompt.trimEnd());
check(
  "it enumerates exactly the stills the render will attach",
  (once.match(/ATTACHED IMAGE \d/g) || []).length === renderAttachments({ shotBoard: report }, 1).length,
  `(${(once.match(/ATTACHED IMAGE \d/g) || []).length} vs ${renderAttachments({ shotBoard: report }, 1).length})`
);
check(
  "a moving setup's two stills are paired, not treated as a cut",
  once.includes("is where this same setup ENDS") && /do not cut between them/.test(once)
);
check("it names the cut points", once.includes("0.0–5.0s") && once.includes("5.0–10.0s"));
check("it supersedes the studio-plate quarantine clause", once.includes("THIS SUPERSEDES ANY EARLIER INSTRUCTION"));
check("it forbids dissolves", /no dissolves/i.test(once));

const revised = brain.restoreShotBoardClause("A COMPLETELY REWRITTEN PROMPT.", brain.extractShotBoardClause(once));
check(
  "a revision keeps the board through a full rewrite",
  revised.startsWith("A COMPLETELY REWRITTEN PROMPT.") && revised.includes(brain.SHOT_BOARD_OPEN)
);

// ── 6. What a render attaches ───────────────────────────────────────────────

console.log("\nWhat a scene render attaches:");
const photographed = { shotBoard: report, sceneImages: { 1: [{ name: "logo", path: "x", url: "y", mimeType: "image/png" }] } };
const attached = renderAttachments(photographed, 1);
check("stills replace the reference images entirely", attached.length === 3 && attached.every((a) => a.path.includes("frame-")));
check(
  "they come back in shot order, each setup's end right after its start",
  attached[0].name.includes("0.0–5.0s") && attached[1].name.includes("ends on") && attached[2].name.includes("5.0–10.0s"),
  `(${attached.map((a) => a.name).join(" | ")})`
);
// The rule that matters most, and the one that was wrong: an unphotographed
// scene attaches NOTHING. Character sheets and uploads build the board; the
// board is the only thing the video model is ever shown. A fallback here puts a
// grey studio portrait back in front of the video model, which is exactly the
// contamination this whole system exists to replace.
check(
  "an unphotographed scene attaches NOTHING — no fallback to reference images",
  renderAttachments(
    { shotBoard: { scenes: {} }, sceneImages: { 0: [{ name: "char sheet", path: "a", url: "b" }] } },
    0
  ).length === 0
);
check(
  "and neither does a scene whose stills all failed",
  renderAttachments(
    {
      shotBoard: { scenes: { 0: { shots: [{ order: 0, time: "0.0–10.0s", label: "Wide" }] } } },
      sceneImages: { 0: [{ name: "char sheet", path: "a", url: "b" }] },
    },
    0
  ).length === 0
);
check("a film with no board at all still renders", renderAttachments({}, 0).length === 0);

// ── 7. Running out of time ──────────────────────────────────────────────────

console.log("\nWhen the clock runs out mid-pass:");
calls.world = 0;
calls.design = 0;
calls.briefs = 0;
calls.images = [];
const partial = await runShotBoard({
  vertexFetch,
  brain,
  project,
  projectId: "p1",
  uid: "u1",
  // Already expired: the designs still run (they are dispatched before the first
  // check), but no picture is allowed to start.
  deadlineAt: Date.now() - 1,
  ...makeStubs(),
});
check("no frames are shot past the deadline", partial.framesRendered === 0);
check("no plates either", partial.plates.length === 0);
check("it says it is not finished", partial.done === false);
check("it hands back every scene still to do", partial.remaining.length === 3, `(${partial.remaining.join(",")})`);

console.log("\nThe continuation pass:");
calls.world = 0;
calls.design = 0;
calls.briefs = 0;
calls.images = [];
calls.loads = [];
const resumed = await runShotBoard({
  vertexFetch,
  brain,
  // As the job would see it: the first pass's board is already on the project.
  project: { ...project, shotBoard: { world: report.world, plates: report.plates, scenes: {} } },
  projectId: "p1",
  uid: "u1",
  scope: { scenes: [2] },
  ...makeStubs(),
});
check("the world is reused, not re-run", calls.world === 0);
check("only the named scene is designed", calls.design === 1);
check("no plate is paid for twice", of("environment").length === 0 && of("setting").length === 0 && of("state").length === 0);
check("the stored plates are read back from Storage", calls.loads.some((p) => p.includes("shotboard/setting-")));
check("the earlier scenes stay on the board", Object.keys(resumed.scenes).includes("2") && resumed.done === true);
check("the plate list is not lost on the way through", resumed.plates.length === report.plates.length);

// ── 8. A frame that fails ───────────────────────────────────────────────────

console.log("\nWhen a picture fails:");
calls.images = [];
calls.briefs = 0;
const degraded = await runShotBoard({
  vertexFetch,
  brain,
  project,
  projectId: "p1",
  uid: "u1",
  ...makeStubs({ failFrames: true }),
});
check("the run survives it and says what it lost", degraded.notes.length > 0);
check("no scene is marked done", degraded.completed.length === 0 && degraded.remaining.length === 3);
check("no brief is written for a scene with no pictures", calls.briefs === 0);
check(
  "the design survives so a retry re-shoots without re-cutting",
  Object.values(degraded.scenes).every((s) => s.shots.length === 2 && s.shots.every((shot) => !shot.url))
);
check("and a scene with no rendered frame gets no clause", brain.shotBoardClause(degraded.scenes[1].shots) === "");

// ── 8b. Self-healing ────────────────────────────────────────────────────────
//
// Three failures that look alike from the outside and want completely different
// responses. Getting these confused is expensive in a way that is invisible:
// retrying a refusal four times pays four times for the same "no", and reusing a
// plate whose file is gone produces a picture that looks fine and was built from
// prose instead of from its parent.

console.log("\nWhen the image model says no:");

const healingStubs = ({ refuse = () => false, flakeOnce = new Set() } = {}) => ({
  generateImage: async (prompt, opts = {}) => {
    calls.images.push({ prompt, aspectRatio: opts.aspectRatio, inputs: (opts.images || []).length });
    const reason = refuse(prompt);
    if (reason) throw new Error(reason);
    for (const token of flakeOnce) {
      if (prompt.includes(token)) {
        flakeOnce.delete(token);
        throw new Error("429 RESOURCE_EXHAUSTED: quota exceeded, try again");
      }
    }
    return { base64: "AAAA", mimeType: "image/png" };
  },
  storeImage: async (path) => ({ path, url: `https://storage.example/${path}` }),
  loadImage: async (path) => {
    calls.loads.push(path);
    return "BBBB";
  },
});

// A refusal, healed: the doctor rewrites the prompt and the rewrite is accepted.
calls.images = [];
let doctored = 0;
const doctorFetch = async (_path, body) => {
  const system = body.systemInstruction.parts[0].text;
  if (system.includes("PROMPT DOCTOR")) {
    doctored++;
    return {
      candidates: [
        {
          content: {
            parts: [
              {
                text: JSON.stringify({
                  prompt: `REWRITTEN. ${"A neutral, plainly worded production still of the same thing, with every position kept. ".repeat(6)}`,
                  whatChanged: "Restated one phrase in props-department language.",
                }),
              },
            ],
          },
        },
      ],
    };
  }
  return vertexFetch(_path, body);
};

const refusedOnce = new Set(["establishing photograph of ONE PLACE"]);
const blockedRun = await runShotBoard({
  vertexFetch: doctorFetch,
  brain,
  project,
  projectId: "p1",
  uid: "u1",
  ...healingStubs({
    refuse: (prompt) => {
      for (const token of refusedOnce) {
        if (prompt.includes(token)) {
          refusedOnce.delete(token);
          return "the image model returned no image (finishReason=IMAGE_SAFETY, blockReason=SAFETY)";
        }
      }
      return null;
    },
  }),
});
check("a refused prompt is sent to the doctor, not retried as-is", doctored === 1, `(${doctored})`);
check("the rewritten prompt is what gets asked next", calls.images.some((c) => c.prompt.startsWith("REWRITTEN.")));
check("the picture is still produced", blockedRun.plates.filter((p) => p.tier === "environment" && p.url).length === 2);
check("and the repair is reported, not hidden", blockedRun.healed.some((h) => /Restated one phrase/.test(h)));

// A rate limit, healed the other way: same prompt, after a wait.
console.log("\nWhen the service is just busy:");
calls.images = [];
doctored = 0;
const flakyRun = await runShotBoard({
  vertexFetch: doctorFetch,
  brain,
  project,
  projectId: "p1",
  uid: "u1",
  ...healingStubs({ flakeOnce: new Set(["reference photograph of ONE single object"]) }),
});
check("a rate limit is retried, never rewritten", doctored === 0, `(doctor called ${doctored}x)`);
check("the retry uses the identical prompt", (() => {
  // Narrowed to ONE object: two different objects both match the plate marker,
  // and comparing one object's prompt to another's proves nothing.
  const letter = calls.images.filter(
    (c) => c.prompt.includes("reference photograph of ONE single object") && c.prompt.includes("A single sheet of A4")
  );
  return letter.length >= 2 && letter[0].prompt === letter[1].prompt;
})());
check("and the object is photographed in the end", flakyRun.plates.some((p) => p.tier === "object" && p.url));

// A picture the document says exists and Storage does not have.
console.log("\nWhen a stored picture has gone missing:");
calls.images = [];
calls.loads = [];
const missing = report.plates.find((p) => p.tier === "setting");
const healedMissing = await runShotBoard({
  vertexFetch: doctorFetch,
  brain,
  project: { ...project, shotBoard: { world: report.world, plates: report.plates, scenes: {} } },
  projectId: "p1",
  uid: "u1",
  scope: { scenes: [2] },
  ...healingStubs(),
  loadImage: async (path) => {
    calls.loads.push(path);
    if (path === missing.path) throw new Error("404 No such object");
    return "BBBB";
  },
});
check(
  "the missing plate is re-shot rather than silently skipped",
  calls.images.some((c) => c.prompt.includes("photograph of ONE DRESSED ARRANGEMENT")),
  `(${calls.images.filter((c) => c.prompt.includes("DRESSED ARRANGEMENT")).length} re-shot)`
);
check("the director is told it happened", healedMissing.notes.some((n) => /was missing, so it was photographed again/.test(n)));
check("every other plate is still reused, not re-paid for", !calls.images.some((c) => c.prompt.includes("establishing photograph of ONE PLACE")));

// A character sheet that has gone missing.
console.log("\nWhen a character sheet has gone missing:");
calls.images = [];
let retakes = 0;
const healedRefs = await runShotBoard({
  vertexFetch: doctorFetch,
  brain,
  project: { ...project, shotBoard: { world: report.world, plates: report.plates, scenes: {} } },
  projectId: "p1",
  uid: "u1",
  scope: { scenes: [1] },
  ...healingStubs(),
  loadImage: async (path) => {
    if (path.includes("char_binta")) throw new Error("404 No such object");
    return "BBBB";
  },
  regenerateCharacterRef: async (ref) => {
    retakes++;
    return { path: `users/u1/projects/p1/characters/${ref.name}-new.png`, url: "https://storage.example/new.png", base64: "CCCC", mimeType: "image/png" };
  },
});
check("the sheet is re-taken", retakes === 1, `(${retakes})`);
check("it is taken once, not once per frame", retakes === 1);
check("the mended sheet is handed back for the caller to persist", !!healedRefs.characterRefs);
check(
  "the new path replaces the dead one",
  !!healedRefs.characterRefs?.find((r) => r.name === "Binta")?.path?.includes("-new.png")
);
check(
  "the untouched sheet is left exactly as it was",
  healedRefs.characterRefs?.find((r) => r.name === "Modou")?.path === "users/u1/characters/char_modou.png"
);
check("no bytes are handed back to be written into Firestore", !healedRefs.characterRefs?.some((r) => r.base64));
check("and the frames still carry a face", calls.images.filter((c) => c.prompt.includes(KINDS.frame)).every((c) => c.inputs >= 2));

// ── 9. The gates ────────────────────────────────────────────────────────────

console.log("\nThe gates:");
const gapped = brain.shotPlanViolations({
  shots: [
    { order: 0, time: "0.0–4.0s", camera: "a wide from the doorway taking in the whole counter and the queue", blocking: "Binta stands at the counter on the right of frame, the clerk behind it", firstFrame: "Binta stands square to the counter with both hands flat on it, looking down at a form", motion: "she slides the form forward and the clerk picks it up", entry: "straight-into-action", cameraMove: "locked", endFrame: "", characters: [], objectKeys: [] },
    { order: 1, time: "6.0–10.0s", camera: "a close over the clerk's shoulder onto the form and Binta's hands", blocking: "the form fills the lower half of frame with her hands at its edges", firstFrame: "the camera pans across the form as she then signs it", motion: "she signs and pushes it back", entry: "straight-into-action", cameraMove: "locked", endFrame: "", characters: [], objectKeys: [] },
  ],
});
check("a gap between setups is caught", gapped.some((v) => v.includes("no gap and no overlap")));
check("a camera move written into a still is caught", gapped.some((v) => v.includes("frozen instant")));

const overCut = brain.shotPlanViolations({ shots: Array.from({ length: 6 }, (_, i) => ({ order: i, time: `${i}.0–${i + 1}.0s`, camera: "x", blocking: "y", firstFrame: "z", motion: "w", entry: "straight-into-action", cameraMove: "locked", endFrame: "", characters: [], objectKeys: [] })) });
check("an over-cut scene is caught", overCut.some((v) => v.includes("ceiling")));

const vagueVehicle = brain.worldViolations(
  {
    environments: [
      {
        key: "car",
        name: "The car",
        scenes: [1],
        lock: "A car interior. ".repeat(40),
        // Long enough to clear the thin-geometry gate, and still says nothing
        // about who is where — which is the sentence that produces a clip where
        // the driver and the passenger have swapped.
        geometry: "The two of them sit in the front of the car together, with the road ahead of them and the town going past outside.",
        light: "Daylight.",
        vehicle: true,
        needsSecondAngle: false,
        secondAngle: "",
        states: [base([1])],
      },
    ],
    settings: [],
    objects: [],
    sceneWorld: [{ sceneNumber: 1, environmentKey: "car", settingKeys: [], objectKeys: [] }],
  },
  [{ sceneNumber: 1 }]
);
check(
  "a vehicle with no stated seating is caught",
  vagueVehicle.some((v) => v.includes("which side the steering wheel is on")),
  vagueVehicle[0] ? `— "${vagueVehicle[0].slice(0, 70)}…"` : ""
);

const wellFormedPlace = {
  key: "a", name: "A", scenes: [1], lock: "x ".repeat(80),
  geometry: "the door is on the left", light: "day", vehicle: false,
  needsSecondAngle: false, secondAngle: "", states: [base([1])],
};
const orphan = brain.worldViolations(
  { environments: [wellFormedPlace], settings: [], objects: [], sceneWorld: [{ sceneNumber: 1, environmentKey: "a", settingKeys: [], objectKeys: [] }] },
  [{ sceneNumber: 1 }, { sceneNumber: 2 }]
);
check("a scene with nowhere to be is caught", orphan.some((v) => v.includes("Scene 2 was not given an environment")));

const vagueLayout = brain.worldViolations(
  {
    environments: [wellFormedPlace],
    settings: [{ key: "t", name: "The table", environmentKey: "a", scenes: [1], lock: "y ".repeat(50), layout: "things on the table", seating: "", objectKeys: [], states: [base([1])] }],
    objects: [],
    sceneWorld: [{ sceneNumber: 1, environmentKey: "a", settingKeys: ["t"], objectKeys: [] }],
  },
  [{ sceneNumber: 1 }]
);
check("an arrangement that will not say where things are is caught", vagueLayout.some((v) => v.includes("layout")));

const twoBases = brain.worldViolations(
  {
    environments: [{ ...wellFormedPlace, states: [base([1]), { key: "b2", name: "Also base", scenes: [], isBase: true, change: "" }] }],
    settings: [],
    objects: [],
    sceneWorld: [{ sceneNumber: 1, environmentKey: "a", settingKeys: [], objectKeys: [] }],
  },
  [{ sceneNumber: 1 }]
);
check("a world with two starting states is caught", twoBases.some((v) => v.includes("base states")));

const brief = brain.framedPromptViolations(
  FRAMED.replace("NO MUSIC of any kind — no score, no instrument, no drone, no rhythmic bed under any part of this clip.", ""),
  project.scenes[1]
);
check("a brief that drops the no-music law is caught", brief.some((v) => v.includes("NO MUSIC")));
check(
  "a compliant brief is NOT flagged for saying 'no score'",
  !brain.framedPromptViolations(FRAMED, project.scenes[1]).some((v) => /names music/i.test(v))
);

// ── 10. The two boxes stay apart ────────────────────────────────────────────

console.log("\nThe two sandboxes:");
check("the story box has its own brain", storyBrain !== brain);
check(
  "and it never asks for a product",
  !storyBrain.worldDirective({ numScenes: 6 }).includes("including the product") &&
    brain.worldDirective({ numScenes: 6 }).includes("including the product")
);
check(
  "both carry the anti-copying mandate",
  storyBrain.worldDirective({ numScenes: 6 }).includes("THE EXAMPLES ARE FORMAT, NEVER CONTENT") &&
    brain.shotDesignDirective({ environment: null }).includes("THE EXAMPLES ARE FORMAT, NEVER CONTENT")
);

console.log(failures === 0 ? "\nAll good.\n" : `\n${failures} failure(s).\n`);
process.exit(failures === 0 ? 0 : 1);
