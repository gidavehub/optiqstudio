/**
 * The shot board, end to end, with no Vertex and no Firestore.
 *
 *   node scripts/test-shot-board.mjs
 *
 * Every model call is stubbed, so this proves the WIRING rather than the
 * pictures: that the continuity pass and the per-scene designers are called with
 * the right briefs, that a location is photographed once and reused, that a
 * frame carries the set plate plus only the people and props in that setup, that
 * the clause appended to a scene prompt is idempotent and enumerates exactly the
 * frames the render will attach, and — the part that is hard to test any other
 * way — that running out of time leaves a resumable board rather than a mess.
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
// Three scenes, two locations, one of them a car — the case that fails most in
// production and the reason the geometry field exists.

const scenePrompt = (n, where) =>
  `SCENE ${n}. ${where}. ` +
  "A Black Gambian woman named Binta, golden-brown complexion, close-cropped hair. ".repeat(3) +
  "0.0s she opens the door. 3.0s she sits. 6.0s she reads the letter. 9.0s she looks up. ".repeat(4);

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

const CONTINUITY = {
  locations: [
    {
      key: "bank-counter",
      name: "The bank counter",
      scenes: [1],
      lock: "A cramped branch interior with a long laminate counter. ".repeat(12),
      geometry: "The counter runs down the right-hand side. The door is in the left-hand wall. The queue rail stands in front of it.",
      light: "Fluorescent overheads plus daylight through the door, mid-morning.",
      vehicle: false,
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
    },
  ],
  props: [
    {
      key: "the-letter",
      name: "The bank letter",
      kind: "document",
      scenes: [1, 2, 3],
      anchor: "A single sheet of A4 from Trust Bank Gambia, one horizontal fold.",
      detail: 'The letterhead reads "TRUST BANK GAMBIA" in navy capitals; the figure "D 4,500.00" sits near the bottom.',
      plateWorthy: true,
      reasoning: "Readable, and in three scenes.",
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
    },
  ],
  sceneLocations: [
    { sceneNumber: 1, locationKey: "bank-counter", propKeys: ["the-letter"] },
    { sceneNumber: 2, locationKey: "taxi-interior", propKeys: ["the-letter"] },
    { sceneNumber: 3, locationKey: "taxi-interior", propKeys: ["the-letter", "the-tin"] },
  ],
};

const shotPlan = (sceneNumber, characters) => ({
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
      characters,
      propKeys: ["the-letter"],
    },
    {
      order: 1,
      time: "5.0–10.0s",
      label: "Insert on the letter",
      camera: "A 50mm close insert over her right shoulder, framed tight on the letter and her hands only.",
      blocking: "The letter fills the lower two-thirds of frame, her thumbs at its left and right edges, the seat cover behind.",
      firstFrame: "The letter is open and flat, both thumbs pinning its lower corners, the figure near the bottom in shadow.",
      motion: "Her thumb slides across the figure and the paper tilts as the taxi turns.",
      entry: "straight-into-action",
      characters,
      propKeys: ["the-letter"],
    },
  ],
});

// ── Stubs ───────────────────────────────────────────────────────────────────

const calls = { continuity: 0, design: 0, images: [], loads: [] };

const vertexFetch = async (_path, body) => {
  const system = body.systemInstruction.parts[0].text;
  const user = body.contents[0].parts.map((p) => p.text || "").join("");
  let payload;
  if (system.includes("CONTINUITY SUPERVISOR")) {
    calls.continuity++;
    payload = CONTINUITY;
  } else if (system.includes("SHOT DESIGNER")) {
    calls.design++;
    const n = Number((user.match(/SCENE (\d+)/) || [])[1]) || 1;
    payload = shotPlan(n, n === 2 || n === 3 ? ["Binta", "Modou"] : ["Binta"]);
  } else {
    throw new Error("unexpected skill call");
  }
  return { candidates: [{ content: { parts: [{ text: JSON.stringify(payload) }] } }] };
};

const makeStubs = ({ failFrames = false, maxImages = Infinity } = {}) => ({
  generateImage: async (prompt, opts = {}) => {
    if (calls.images.length >= maxImages) throw new Error("stub image budget exhausted");
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

check("one continuity call for the whole film", calls.continuity === 1, `(${calls.continuity})`);
check("one shot-design call per scene", calls.design === 3, `(${calls.design})`);
check("both locations photographed", report.setPlates.filter((p) => p.url).length === 2);
check(
  "only plate-worthy objects photographed",
  report.propPlates.length === 2 && !report.propPlates.some((p) => p.key === "a-chair"),
  `(${report.propPlates.map((p) => p.key).join(", ")})`
);
check("every scene has its setups", Object.keys(report.scenes).length === 3);
check("six frames rendered", report.framesRendered === 6, `(${report.framesRendered})`);
check("the pass reports itself finished", report.done === true && report.remaining.length === 0);

const setPlateCalls = calls.images.filter((c) => c.prompt.includes("establishing photograph of ONE location"));
check("set plates are shot in the film's aspect", setPlateCalls.every((c) => c.aspectRatio === "16:9"));
check("set plates are shot empty", setPlateCalls.every((c) => c.prompt.includes("COMPLETELY EMPTY OF PEOPLE")));

const productPlate = calls.images.find((c) => c.prompt.includes("THE ATTACHED PHOTOGRAPH IS THE REAL OBJECT"));
check("the product plate is built from the client's own photo", !!productPlate && productPlate.inputs === 1);
check(
  "a document plate is NOT given the client's product photo",
  !calls.images.some((c) => c.prompt.includes("TRUST BANK GAMBIA") && c.inputs > 0)
);

const frameCalls = calls.images.filter((c) => c.prompt.includes("single frame from a live-action film"));
check("frames are shot in the film's aspect", frameCalls.every((c) => c.aspectRatio === "16:9"));
check(
  "every frame carries its set plate, its people and its prop",
  // Scene 2 is the only one with two character sheets: Modou's sheet covers
  // scene 2 alone, so scene 3 gets Binta's only even though the setup names
  // them both — a sheet never rides on a scene its character is not in (§14.4).
  // set + Binta + letter = 3; set + Binta + Modou + letter = 4.
  frameCalls.map((c) => c.inputs).join(",") === "3,3,4,4,3,3",
  `(${frameCalls.map((c) => c.inputs).join(",")})`
);
check(
  "the vehicle's seating is restated inside every taxi frame",
  frameCalls.filter((c) => c.prompt.includes("Modou is in the driver's seat on the left")).length === 4
);
check(
  "a frame names each attachment so the numbering cannot slip",
  frameCalls.every((c) => c.prompt.includes("Attached image 1 is THE LOCATION")) &&
    frameCalls.some((c) => c.prompt.includes("Attached image 2 is BINTA"))
);

// ── 2. The clause on the scene prompt ───────────────────────────────────────

console.log("\nThe clause that goes into the video prompt:");
const frames = report.scenes[1].shots;
const once = brain.applyShotBoardClause(project.scenes[1].fullPrompt, frames);
const twice = brain.applyShotBoardClause(once, frames);

check("the block lands on the prompt", once.includes(brain.SHOT_BOARD_OPEN) && once.includes(brain.SHOT_BOARD_CLOSE));
check("re-applying it does not stack a second one", twice === once);
check("stripping it restores the original", brain.stripShotBoardClause(once) === project.scenes[1].fullPrompt.trimEnd());
check(
  "it enumerates exactly the frames the render will attach",
  (once.match(/ATTACHED IMAGE \d/g) || []).length === renderAttachments({ shotBoard: report }, 1).length
);
check("it names the cut points", once.includes("0.0–5.0s") && once.includes("5.0–10.0s"));
check("it supersedes the studio-plate quarantine clause", once.includes("THIS SUPERSEDES ANY EARLIER INSTRUCTION"));
check("it forbids dissolves", /no dissolves/i.test(once));

const revised = brain.restoreShotBoardClause("A COMPLETELY REWRITTEN PROMPT.", brain.extractShotBoardClause(once));
check(
  "a revision keeps the board through a full rewrite",
  revised.startsWith("A COMPLETELY REWRITTEN PROMPT.") && revised.includes(brain.SHOT_BOARD_OPEN)
);

// ── 3. What a render attaches ───────────────────────────────────────────────

console.log("\nWhat a scene render attaches:");
const photographed = { shotBoard: report, sceneImages: { 1: [{ name: "logo", path: "x", url: "y", mimeType: "image/png" }] } };
const attached = renderAttachments(photographed, 1);
check("frames replace the reference images entirely", attached.length === 2 && attached.every((a) => a.path.includes("frame-")));
check("frames come back in shot order", attached[0].name.includes("0.0–5.0s") && attached[1].name.includes("5.0–10.0s"));
check(
  "an unphotographed scene falls back to its reference images",
  renderAttachments({ shotBoard: { scenes: {} }, sceneImages: { 0: [{ path: "a", url: "b" }] } }, 0).length === 1
);
check("a film with no board at all still renders", renderAttachments({}, 0).length === 0);

// ── 4. Running out of time ──────────────────────────────────────────────────

console.log("\nWhen the clock runs out mid-pass:");
calls.continuity = 0;
calls.design = 0;
calls.images = [];
const partial = await runShotBoard({
  vertexFetch,
  brain,
  project,
  projectId: "p1",
  uid: "u1",
  // Already expired: the plates and designs still run (they are dispatched
  // before the first check), but no frame is allowed to start.
  deadlineAt: Date.now() - 1,
  ...makeStubs(),
});
check("no frames are shot past the deadline", partial.framesRendered === 0);
check("it says it is not finished", partial.done === false);
check("it hands back every scene still to do", partial.remaining.length === 3, `(${partial.remaining.join(",")})`);

console.log("\nThe continuation pass:");
calls.continuity = 0;
calls.design = 0;
calls.images = [];
calls.loads = [];
const resumed = await runShotBoard({
  vertexFetch,
  brain,
  // As the job would see it: the first pass's board is already on the project.
  project: { ...project, shotBoard: { continuity: report.continuity, setPlates: report.setPlates, propPlates: report.propPlates, scenes: {} } },
  projectId: "p1",
  uid: "u1",
  scope: { scenes: [2] },
  ...makeStubs(),
});
check("continuity is reused, not re-run", calls.continuity === 0);
check("only the named scene is designed", calls.design === 1);
check("no plate is paid for twice", !calls.images.some((c) => c.prompt.includes("establishing photograph")));
check("the stored plates are read back from Storage", calls.loads.some((p) => p.includes("shotboard/set-")));
check("the earlier scenes stay on the board", Object.keys(resumed.scenes).includes("2") && resumed.done === true);

// ── 5. A frame that fails ───────────────────────────────────────────────────

console.log("\nWhen a picture fails:");
calls.images = [];
const degraded = await runShotBoard({
  vertexFetch,
  brain,
  project,
  projectId: "p1",
  uid: "u1",
  ...makeStubs({ failFrames: true }),
});
check("the run survives it and says what it lost", degraded.framesRendered === 6 && degraded.notes.length > 0);
check("no scene is marked done", degraded.completed.length === 0 && degraded.remaining.length === 3);
check(
  "the design survives so a retry re-shoots without re-cutting",
  Object.values(degraded.scenes).every((s) => s.shots.length === 2 && s.shots.every((shot) => !shot.url))
);
check(
  "and a scene with no rendered frame gets no clause",
  brain.shotBoardClause(degraded.scenes[1].shots) === ""
);

// ── 6. The gates ────────────────────────────────────────────────────────────

console.log("\nThe gates:");
const gapped = brain.shotPlanViolations({
  shots: [
    { order: 0, time: "0.0–4.0s", camera: "a wide from the doorway taking in the whole counter and the queue", blocking: "Binta stands at the counter on the right of frame, the clerk behind it", firstFrame: "Binta stands square to the counter with both hands flat on it, looking down at a form", motion: "she slides the form forward and the clerk picks it up", entry: "straight-into-action", characters: [], propKeys: [] },
    { order: 1, time: "6.0–10.0s", camera: "a close over the clerk's shoulder onto the form and Binta's hands", blocking: "the form fills the lower half of frame with her hands at its edges", firstFrame: "the camera pans across the form as she then signs it", motion: "she signs and pushes it back", entry: "straight-into-action", characters: [], propKeys: [] },
  ],
});
check("a gap between setups is caught", gapped.some((v) => v.includes("no gap and no overlap")));
check("a camera move written into a still is caught", gapped.some((v) => v.includes("frozen instant")));

const overCut = brain.shotPlanViolations({ shots: Array.from({ length: 6 }, (_, i) => ({ order: i, time: `${i}.0–${i + 1}.0s`, camera: "x", blocking: "y", firstFrame: "z", motion: "w", entry: "straight-into-action", characters: [], propKeys: [] })) });
check("an over-cut scene is caught", overCut.some((v) => v.includes("ceiling")));

const vagueVehicle = brain.continuityViolations(
  {
    locations: [
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
      },
    ],
    props: [],
    sceneLocations: [{ sceneNumber: 1, locationKey: "car", propKeys: [] }],
  },
  [{ sceneNumber: 1 }]
);
check(
  "a vehicle with no stated seating is caught",
  vagueVehicle.some((v) => v.includes("which side the steering wheel is on")),
  vagueVehicle[0] ? `— "${vagueVehicle[0].slice(0, 70)}…"` : ""
);

const orphan = brain.continuityViolations(
  { locations: [{ key: "a", name: "A", scenes: [1], lock: "x ".repeat(80), geometry: "the door is on the left", light: "day", vehicle: false }], props: [], sceneLocations: [{ sceneNumber: 1, locationKey: "a", propKeys: [] }] },
  [{ sceneNumber: 1 }, { sceneNumber: 2 }]
);
check("a scene with nowhere to be is caught", orphan.some((v) => v.includes("Scene 2 was not given a location")));

// ── 7. The two boxes stay apart ─────────────────────────────────────────────

console.log("\nThe two sandboxes:");
check("the story box has its own brain", storyBrain !== brain);
check(
  "and it never asks for a product",
  !storyBrain.continuityDirective({ numScenes: 6 }).includes("including the product") &&
    brain.continuityDirective({ numScenes: 6 }).includes("including the product")
);

console.log(failures === 0 ? "\nAll good.\n" : `\n${failures} failure(s).\n`);
process.exit(failures === 0 ? 0 : 1);
