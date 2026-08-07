/**
 * Audio post-production orchestration test. Run: node scripts/test-audio-post.mjs
 *
 * Drives functions/audioPost.js end to end with every external dependency
 * stubbed — no Vertex, no ffprobe, no Storage. What it actually proves is the
 * wiring the pure tests cannot: that the scan feeds the writer, that the writer's
 * lines get spoken, that an overrunning line is rewritten SHORTER and re-spoken
 * (the loop the whole module exists for), and that what lands on the timeline is
 * a legal document.
 */

import { createRequire } from "node:module";

const require_ = createRequire(import.meta.url);
const { runAudioPost, probeDurationFromUrl } = require_("../functions/audioPost.js");
const audioPlan = require_("../functions/audioPlan.js");
const { canvasForAspect } = require_("../functions/editorEngine.js");
const { filmKind } = require_("../functions/optiqSkills/pipeline.js");

let passed = 0;
const failures = [];

function test(name, fn) {
  try {
    fn();
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

const CLIP_SECONDS = 8.04;

/** A six-scene project with every clip rendered. */
function makeProject(overrides = {}) {
  const videoStatus = {};
  const scenes = [];
  for (let i = 0; i < 6; i++) {
    scenes.push({ sceneNumber: i + 1, setting: `Scene ${i + 1}`, action: "hands work", dialogue: "", sound: "" });
    videoStatus[i] = { status: "succeeded", url: `https://cdn.example.com/scene${i}.mp4` };
  }
  return {
    id: "proj_1",
    uid: "u1",
    title: "From Our Soil",
    concept: "A family sells groundnut paste",
    brandName: "Sidrah Salaam",
    product: "Groundnut paste",
    aspectRatio: "9:16",
    musicSpec: "NO MUSIC in the clips; the compound's own noise carries everything.",
    scenes,
    videoStatus,
    ...overrides,
  };
}

/**
 * Build the stub harness.
 *
 * `ttsSeconds(text, pass)` decides how long each synthesized line "is", which is
 * how the refit loop gets exercised deterministically.
 */
function harness({ ttsSeconds, speechInScene = () => false, lyriaSeconds = 30, failLyria = false } = {}) {
  const calls = { scans: 0, writes: 0, rewrites: 0, tts: [], uploads: [], probes: [], stages: [] };

  const vertexFetch = async (path, body) => {
    const system = body.systemInstruction?.parts?.[0]?.text || "";
    const userText = (body.contents?.[0]?.parts || []).map((p) => p.text || "").join("\n");

    if (/FILM SCANNER/.test(system)) {
      calls.scans++;
      const sceneNo = Number(/This is scene (\d+)/.exec(userText)?.[1] || 1);
      const speaking = speechInScene(sceneNo - 1);
      return json({
        summary: `Scene ${sceneNo}: hands working.`,
        onScreenText: "",
        speech: speaking,
        windows: speaking ? [] : [{ startInScene: 1.5, endInScene: 6.5, note: "hands settled" }],
      });
    }
    if (/NARRATION DIRECTOR/.test(system)) {
      calls.writes++;
      // Write one line into every slot offered.
      const slotIds = [...userText.matchAll(/slotId "([^"]+)"/g)].map((m) => m[1]);
      return json({
        voiceId: "gambian-deep-male",
        styleDirection: "slower than usual, let each line settle",
        lines: slotIds.map((slotId, i) => ({ slotId, text: `Original line number ${i + 1} for this film.` })),
      });
    }
    if (/trimming voiceover lines/.test(system)) {
      calls.rewrites++;
      const slotIds = [...userText.matchAll(/slotId "([^"]+)"/g)].map((m) => m[1]);
      return json({ lines: slotIds.map((slotId) => ({ slotId, text: "Short line." })) });
    }
    throw new Error(`unexpected vertexFetch: ${system.slice(0, 120)}`);
  };

  const passBySlot = new Map();
  const ttsGenerate = async (text, voiceName, style) => {
    const key = text;
    const pass = passBySlot.get(key) ?? 0;
    passBySlot.set(key, pass + 1);
    calls.tts.push({ text, voiceName, style });
    return { base64Wav: "AAAA", durationSec: ttsSeconds(text) };
  };

  const lyriaGenerate = async () => {
    if (failLyria) throw new Error("Lyria blocked the prompt");
    return { base64: "BBBB", mimeType: "audio/mpeg", ext: "mp3" };
  };

  const uploadBase64 = async (base64, path, contentType) => {
    calls.uploads.push(path);
    return `https://cdn.example.com/${path}`;
  };

  const runCapture = async (cmd, args) => {
    const url = args[args.length - 1];
    calls.probes.push(url);
    const seconds = /score\.mp3$/.test(url) ? lyriaSeconds : CLIP_SECONDS;
    return JSON.stringify({ format: { duration: String(seconds) }, streams: [{ duration: String(seconds) }] });
  };

  const fetchVideoBase64 = async () => ({ base64: "CCCC", mimeType: "video/mp4" });

  const onStage = async (stage, meta) => calls.stages.push(meta ? `${stage}:${JSON.stringify(meta)}` : stage);

  return { calls, vertexFetch, ttsGenerate, lyriaGenerate, uploadBase64, runCapture, fetchVideoBase64, onStage };
}

function json(payload) {
  return { candidates: [{ finishReason: "STOP", content: { parts: [{ text: JSON.stringify(payload) }] } }] };
}

function run(h, { project = makeProject(), videoType = "voiceover-ad" } = {}) {
  return runAudioPost({
    vertexFetch: h.vertexFetch,
    ttsGenerate: h.ttsGenerate,
    lyriaGenerate: h.lyriaGenerate,
    uploadBase64: h.uploadBase64,
    runCapture: h.runCapture,
    fetchVideoBase64: h.fetchVideoBase64,
    plan: audioPlan,
    engineApi: { canvasForAspect, EDITOR_DOC_FIELD: "editorDoc", EDITOR_DOC_REV_FIELD: "editorDocRev" },
    project,
    projectId: project.id,
    filmKind: filmKind(videoType),
    onStage: h.onStage,
  });
}

// ── ffprobe parsing ─────────────────────────────────────────────────────────

const probeHarness = harness({ ttsSeconds: () => 2 });
const probed = await probeDurationFromUrl("https://cdn.example.com/a.mp4", probeHarness.runCapture);
test("duration is read straight off the URL", () => {
  assert(Math.abs(probed - CLIP_SECONDS) < 1e-9, `got ${probed}`);
});

test("a probe with no duration throws rather than guessing", async () => {
  let threw = false;
  try {
    await probeDurationFromUrl("x", async () => JSON.stringify({ format: {}, streams: [] }));
  } catch {
    threw = true;
  }
  assert(threw, "expected a throw");
});

// ── A. Narrated film, everything fits first time ─────────────────────────────

const hA = harness({ ttsSeconds: () => 2.4 });
const A = await run(hA);

test("A: every clip was measured", () => {
  assert(hA.calls.probes.filter((p) => /scene/.test(p)).length === 6, `${hA.calls.probes.length} probes`);
  assert(Math.abs(A.film.duration - CLIP_SECONDS * 6) < 1e-6, `film ${A.film.duration}`);
});

test("A: every scene was watched", () => {
  assert(hA.calls.scans === 6, `${hA.calls.scans} scans`);
});

test("A: narration was written and spoken", () => {
  assert(hA.calls.writes === 1, `${hA.calls.writes} write calls`);
  assert(A.narration.length > 0, "no narration placed");
  assert(hA.calls.tts.length === A.narration.length, `${hA.calls.tts.length} tts vs ${A.narration.length} placed`);
});

test("A: no rewrite was needed", () => {
  assert(hA.calls.rewrites === 0, `${hA.calls.rewrites} rewrites for lines that already fit`);
});

test("A: the chosen voice was used for every line", () => {
  assert(A.voice.voice === "Charon", `voice ${A.voice.voice}`);
  assert(hA.calls.tts.every((c) => c.voiceName === "Charon"), "a line used the wrong voice");
  assert(hA.calls.tts.every((c) => /deep, resonant Gambian man/.test(c.style)), "style direction missing");
  assert(hA.calls.tts.every((c) => /let each line settle/.test(c.style)), "per-film direction missing");
});

test("A: narration lines never overlap", () => {
  const lines = [...A.narration].sort((a, b) => a.start - b.start);
  for (let i = 0; i < lines.length - 1; i++) {
    assert(lines[i].start + lines[i].duration <= lines[i + 1].start + 1e-6, `lines ${i}/${i + 1} overlap`);
  }
});

test("A: the score was composed, measured and looped to the film", () => {
  assert(A.music, "no music");
  assert(A.music.trackDuration === 30, `track ${A.music.trackDuration}`);
  assert(A.music.segments > 1, `${A.music.segments} segments for a 48s film from a 30s track`);
  assert(A.music.gain < 0.2, `music should duck under narration, gain ${A.music.gain}`);
});

test("A: the plan passed its own review", () => {
  assert(A.violations.length === 0, `violations: ${A.violations.join("; ")}`);
});

test("A: a narrated film's footage is muted", () => {
  for (const t of A.editorDoc.tracks) {
    if (t.kind === "video") assert(t.volume === 0, `video track at ${t.volume}`);
  }
});

test("A: the document carries the audio and is portrait", () => {
  assert(A.editorDoc.width === 720 && A.editorDoc.height === 1280, `canvas ${A.editorDoc.width}×${A.editorDoc.height}`);
  const vo = A.editorDoc.tracks.find((t) => t.name === "Voiceover");
  assert(vo && vo.clips.length === A.narration.length, "voiceover track wrong");
  assert(A.editorDoc.tracks.some((t) => t.name === "Score"), "no score track");
  assert(A.editorDocRev === 1, `rev ${A.editorDocRev}`);
});

test("A: stages were reported in order", () => {
  const names = hA.calls.stages.map((s) => s.split(":")[0]);
  for (const expected of ["measuring", "scanning", "writing", "speaking", "scoring", "placing"]) {
    assert(names.includes(expected), `missing stage ${expected}`);
  }
  assert(names.indexOf("measuring") < names.indexOf("scanning"), "measure before scan");
  assert(names.indexOf("writing") < names.indexOf("speaking"), "write before speak");
  assert(names.indexOf("scoring") < names.indexOf("placing"), "score before place");
});

// ── B. The refit loop ────────────────────────────────────────────────────────

const hB = harness({
  // Original lines run way past their slot; the rewritten "Short line." fits.
  ttsSeconds: (text) => (/^Original line/.test(text) ? 12 : 2.2),
});
const B = await run(hB);

test("B: overrunning lines were rewritten and re-spoken", () => {
  assert(hB.calls.rewrites >= 1, "no rewrite happened");
  assert(hB.calls.tts.some((c) => c.text === "Short line."), "the rewritten line was never spoken");
});

test("B: only the trimmed takes reached the timeline", () => {
  assert(B.narration.length > 0, "nothing placed");
  assert(B.narration.every((n) => n.text === "Short line."), `placed: ${B.narration.map((n) => n.text).join(" | ")}`);
});

test("B: nothing that overran was placed anyway", () => {
  // The failure this guards: shipping a 12s line into a 5s gap because the
  // refit budget was ignored.
  for (const line of B.narration) assert(line.duration <= 6, `placed a ${line.duration}s line`);
  assert(B.violations.length === 0, `violations: ${B.violations.join("; ")}`);
});

// ── C. A line that never fits is dropped, not forced ────────────────────────

const hC = harness({ ttsSeconds: () => 30 });
const C = await run(hC);

test("C: hopeless lines are dropped after the refit budget runs out", () => {
  assert(C.narration.length === 0, `${C.narration.length} lines placed despite never fitting`);
  assert(C.notes.some((n) => /Dropped one narration line/.test(n)), `notes: ${C.notes.join(" | ")}`);
});

test("C: the film is still delivered, with a score and a valid document", () => {
  assert(C.music && C.music.segments > 0, "no score");
  assert(C.editorDoc.tracks.length > 0, "no document");
  assert(C.violations.length === 0, `violations: ${C.violations.join("; ")}`);
});

// ── D. Dialogue film: no narration, footage kept ─────────────────────────────

const hD = harness({ ttsSeconds: () => 2 });
const D = await run(hD, { videoType: "dialogue-ad" });

test("D: a dialogue film is never scanned or narrated", () => {
  assert(hD.calls.scans === 0, `${hD.calls.scans} scans on a dialogue film`);
  assert(hD.calls.writes === 0, "narration was written for a dialogue film");
  assert(hD.calls.tts.length === 0, "TTS ran on a dialogue film");
  assert(D.narration.length === 0, "narration placed");
});

test("D: a dialogue film keeps its own audio", () => {
  // The legacy compile path muted the video unconditionally and threw the
  // performances away. This is that bug's regression test.
  for (const t of D.editorDoc.tracks) {
    if (t.kind === "video") assert(t.volume === 1, `video track muted to ${t.volume}`);
  }
});

test("D: it still gets a score, at the louder gain", () => {
  assert(D.music.segments > 0, "no score");
  assert(D.music.gain > 0.2, `gain ${D.music.gain} — should not duck with no narration`);
});

// ── E. Scenes with speech get no narration over them ────────────────────────

const hE = harness({ ttsSeconds: () => 2.2, speechInScene: (i) => i % 2 === 0 });
const E = await run(hE);

test("E: no narration is laid over a scene where someone is speaking", () => {
  const speakingScenes = [0, 2, 4];
  for (const line of E.narration) {
    assert(!speakingScenes.includes(line.sceneIndex), `narration landed on speaking scene ${line.sceneIndex}`);
  }
  assert(E.narration.length > 0, "everything was suppressed");
});

// ── F. Degraded paths ───────────────────────────────────────────────────────

const hF = harness({ ttsSeconds: () => 2.2, failLyria: true });
const F = await run(hF);

test("F: a failed score still delivers the narration and the document", () => {
  assert(F.music === null, "music reported despite failing");
  assert(F.narration.length > 0, "narration lost with the score");
  assert(F.notes.some((n) => /No score was laid/.test(n)), `notes: ${F.notes.join(" | ")}`);
  assert(F.editorDoc.tracks.length > 0, "no document");
});

test("a film with nothing rendered refuses rather than producing an empty cut", async () => {
  let message = "";
  try {
    await run(harness({ ttsSeconds: () => 2 }), {
      project: makeProject({ videoStatus: { 0: { status: "failed" } } }),
    });
  } catch (err) {
    message = String(err.message);
  }
  assert(/has to be shot/.test(message), `unexpected: ${message}`);
});

test("an existing edited document is preserved, only gaining audio", async () => {
  // A director who has already trimmed the timeline must not lose that work.
  const base = audioPlan.baseDocFromClips(
    [0, 1, 2].map((i) => ({ sceneIndex: i, url: `https://cdn.example.com/scene${i}.mp4`, duration: 4 })),
    canvasForAspect("9:16")
  );
  base.tracks[0].clips[0].duration = 2; // a trim the director made
  base.tracks[0].clips[0].srcOut = 2;
  base.duration = audioPlan.computeDocDuration(base);

  const result = await run(harness({ ttsSeconds: () => 2.2 }), {
    project: makeProject({ editorDoc: base, editorDocRev: 7 }),
  });
  const trimmed = result.editorDoc.tracks[0].clips[0];
  assert(trimmed.duration === 2, `the director's trim was lost (${trimmed.duration}s)`);
  assert(result.editorDoc.tracks.some((t) => t.name === "Score"), "no score added");
  assert(result.editorDocRev === 8, `rev should follow the stored one, got ${result.editorDocRev}`);
});

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length > 0) process.exit(1);
