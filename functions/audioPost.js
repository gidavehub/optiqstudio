// ─── OPTIQ — AUDIO POST-PRODUCTION ──────────────────────────────────────────
//
// The film is generated silent of music (see ./optiqSkills/soundPolicy.js). This
// is the pass that scores and narrates it, AFTER the cut exists.
//
//   1. MEASURE   ffprobe every rendered clip → the film's real time map. Nominal
//                10s is a lie: omni returns ~8s clips, and building the timing on
//                the nominal value puts every later line out of sync.
//   2. SCAN      gemini-3.5-flash watches each clip on its own and reports, in
//                that scene's own seconds, what happens and where a voice can go.
//                Per-scene rather than one call over the whole film: it keeps the
//                payload under the request ceiling for an 18-scene film AND gets
//                far tighter timestamps, which is the whole point.
//   3. WRITE     one call turns the slots into narration lines, each written to a
//                word budget computed from its slot.
//   4. SPEAK     3.1-flash TTS per line. It reports exact duration from PCM byte
//                count, so no probing is needed to know what came back.
//   5. REFIT     any line that overran its slot is rewritten SHORTER against the
//                rate that voice actually read at, and re-spoken. Up to
//                MAX_REFIT_PASSES. This loop exists because you cannot ask a TTS
//                model for "4.2 seconds of speech".
//   6. SCORE     Lyria 3 Pro composes, then the track is cut/looped to the film's
//                exact length with crossfades.
//   7. PLACE     everything lands on the project's editorDoc, so it plays in the
//                timeline editor and exports with the video through the normal
//                renderJobV2 path — no bespoke audio graph.
//   8. REVIEW    the finished plan is read back for overlaps, overruns and
//                out-of-bounds lines, and what it finds is reported.
//
// All timing arithmetic lives in lib/editor/audioPlan.ts (pure, 45 tests). This
// file does I/O and nothing else clever.

"use strict";

const MAX_REFIT_PASSES = 2;
const SCAN_CONCURRENCY = 3;
const TTS_CONCURRENCY = 2;
const SCAN_MODEL = "gemini-3.5-flash";

// ─── SCHEMAS ────────────────────────────────────────────────────────────────

const SCAN_SCHEMA = {
  type: "OBJECT",
  properties: {
    summary: { type: "STRING" },
    onScreenText: { type: "STRING" },
    speech: { type: "BOOLEAN" },
    windows: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          startInScene: { type: "NUMBER" },
          endInScene: { type: "NUMBER" },
          note: { type: "STRING" },
        },
        required: ["startInScene", "endInScene", "note"],
      },
    },
  },
  required: ["summary", "onScreenText", "speech", "windows"],
};

const SCRIPT_SCHEMA = {
  type: "OBJECT",
  properties: {
    voiceId: { type: "STRING" },
    styleDirection: { type: "STRING" },
    lines: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: { slotId: { type: "STRING" }, text: { type: "STRING" } },
        required: ["slotId", "text"],
      },
    },
  },
  required: ["voiceId", "styleDirection", "lines"],
};

const REWRITE_SCHEMA = {
  type: "OBJECT",
  properties: {
    lines: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: { slotId: { type: "STRING" }, text: { type: "STRING" } },
        required: ["slotId", "text"],
      },
    },
  },
  required: ["lines"],
};

// ─── NARRATOR VOICES ────────────────────────────────────────────────────────
// A curated subset of the Optiq Voice Engine catalog (see
// app/dashboard/_shared/audio/voiceProfiles.ts) — the ones that actually work as
// a narrator, with the style direction that gets the register out of them.
// `voice` is the Gemini prebuilt speaker name.

const NARRATOR_VOICES = {
  "gambian-warm-female": {
    voice: "Kore",
    style: "Read as a warm, unhurried Gambian woman telling you something true. Gentle, close to the mic, never salesy",
    describe: "Warm Gambian woman, unhurried and sincere",
  },
  "gambian-deep-male": {
    voice: "Charon",
    style: "Read as a deep, resonant Gambian man — slow, weighty, wise, the voice of someone who has seen it. Long pauses, total authority",
    describe: "Deep, wise, slow Gambian man — the elder-statesman narrator",
  },
  "gambian-elder-female": {
    voice: "Callirrhoe",
    style: "Read as a poised older Gambian woman: graceful, measured, quietly certain, every word placed",
    describe: "Poised older Gambian woman, measured and certain",
  },
  "young-vibrant-female": {
    voice: "Leda",
    style: "Read bright, young and fast-paced, smiling through it, energy forward but never shouty",
    describe: "Young, bright and fast-paced — energetic and modern",
  },
  "young-vibrant-male": {
    voice: "Puck",
    style: "Read young, quick and upbeat, full of momentum, like a friend who cannot wait to tell you",
    describe: "Young, quick, upbeat and full of momentum",
  },
  "grounded-male": {
    voice: "Fenrir",
    style: "Read strong, grounded and plain-spoken. No performance, just conviction",
    describe: "Strong, grounded and plain-spoken",
  },
  "cinematic-deep": {
    voice: "Algieba",
    style: "Read like a cinema trailer narrator: smooth, deep, charismatic, generous pauses, every line landing",
    describe: "Smooth, deep, charismatic cinematic narrator",
  },
};

const DEFAULT_VOICE_ID = "gambian-warm-female";

function narratorVoice(id) {
  return NARRATOR_VOICES[id] || NARRATOR_VOICES[DEFAULT_VOICE_ID];
}

function voiceCatalogText() {
  return Object.entries(NARRATOR_VOICES)
    .map(([id, v]) => `- "${id}" — ${v.describe}`)
    .join("\n");
}

// ─── HELPERS ────────────────────────────────────────────────────────────────

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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

/**
 * Duration of a remote media file, via ffprobe straight off the URL.
 *
 * No download: ffprobe reads the https input itself and only needs the header,
 * which for 18 clips is the difference between seconds and minutes.
 */
async function probeDurationFromUrl(url, runCapture) {
  const out = await runCapture("ffprobe", [
    "-v", "error",
    "-print_format", "json",
    "-show_format",
    "-show_streams",
    url,
  ]);
  const probe = JSON.parse(out);
  const fromFormat = Number(probe?.format?.duration);
  if (Number.isFinite(fromFormat) && fromFormat > 0) return fromFormat;
  for (const stream of probe?.streams || []) {
    const d = Number(stream?.duration);
    if (Number.isFinite(d) && d > 0) return d;
  }
  throw new Error("ffprobe reported no duration");
}

/**
 * The scenes that have a clip on them right now, in scene order.
 *
 * Read off a project record rather than passed in, because it is asked twice —
 * once to decide what to measure, and again at the end to decide what the
 * picture actually is by then. Firestore keys numeric maps as strings once they
 * round-trip, hence the two lookups.
 */
function succeededClips(scenes, videoStatus) {
  const out = [];
  for (let i = 0; i < (scenes || []).length; i++) {
    const entry = videoStatus?.[i] || videoStatus?.[String(i)];
    if (entry?.status === "succeeded" && entry.url) out.push({ sceneIndex: i, url: entry.url });
  }
  return out;
}

/**
 * The narration a documentary arrived with, keyed by scene INDEX (0-based).
 *
 * Two sources, in order: the `narrationScript` the swarm wrote onto the project,
 * and — as the fallback, and the one that stays correct after the agent has been
 * editing — the `narration` field on each scene. The stored script is a mirror;
 * the scenes are what the agent and the script editor actually write to, so a
 * disagreement between them is resolved in the scenes' favour.
 *
 * Returns null-safe: an empty map simply means the film has no script and audio
 * post falls back to writing one.
 */
function scriptedNarration(project) {
  const byIndex = new Map();
  const scenes = project?.scenes || [];

  for (const line of project?.narrationScript || []) {
    const idx = Number(line?.sceneNumber) - 1;
    if (!Number.isInteger(idx) || idx < 0) continue;
    byIndex.set(idx, String(line.text || "").trim());
  }
  scenes.forEach((scene, idx) => {
    if (scene && scene.narration !== undefined) {
      byIndex.set(idx, String(scene.narration || "").trim());
    }
  });

  return byIndex;
}

/** Build the Lyria prompt. The film's own sound spec is the brief. */
/**
 * The movements of a long film's score suite.
 *
 * A five-minute film is not scored by one 60-second loop played five times — by
 * the third repeat the loop is the most noticeable thing in the film. So a long
 * film gets several separate pieces, composed for the stretch of story each sits
 * under, and laid end to end (see planMusicSuite).
 *
 * These are expressed as DRAMATIC POSITIONS rather than as timings, because that
 * is what the story law downstream is built on — open, want, turn/midpoint,
 * escalation, climax and landing — and it is what makes the fourth piece sound
 * like it belongs after the third.
 */
const SUITE_MOVEMENTS = [
  "MOVEMENT 1 of 5 — THE OPENING. It plays under the first fifth of the film, where something is already wrong and the audience does not yet know why. Establish the film's musical world: state its main idea plainly, at low intensity, and leave room. This is the theme every later movement is a version of.",
  "MOVEMENT 2 of 5 — THE WANT. The second fifth, where we learn what somebody is trying to get. Take movement 1's idea and give it forward motion — more pulse, more direction, still unresolved. Slightly warmer and more confident than the opening.",
  "MOVEMENT 3 of 5 — THE TURN. The middle, where the story stops being the story we thought it was. This is where the score CHANGES ITS MIND: reharmonise the main idea darker or stranger, break its rhythm, let something drop out. The listener should feel the ground move without being told.",
  "MOVEMENT 4 of 5 — THE ESCALATION. The fourth fifth, where the pressure rises and options close. The tightest and most driven of the five: shorter phrases, rising intensity, less air. Do not resolve anything here — this movement's job is to refuse to settle.",
  "MOVEMENT 5 of 5 — THE CLIMAX AND THE LANDING. The last fifth: the biggest moment in the film, and then its outcome. Bring the main idea back in full for the peak, then let it come to rest — a real ending, arriving in the last ten seconds, not a fade-out.",
];

/**
 * The high-tension suite, for film types whose palette is "high-tension".
 *
 * Same five dramatic positions — they are the story law and they do not change —
 * but written for a score with dread in it rather than warmth. The default suite
 * asks movement 2 to be "warmer and more confident", which is exactly the
 * instruction that produced the polite string-quartet cue this palette exists to
 * replace.
 */
const SUITE_MOVEMENTS_TENSION = [
  "MOVEMENT 1 of 5 — THE OPENING. It plays under the first fifth of the film, where something is already wrong and the audience does not yet know why. Do NOT establish a pleasant world and then spoil it: start with the wrongness already present. A single sustained low tone, a pulse that is slightly too slow, one unresolved interval held far longer than is comfortable. Sparse and quiet — this is the theme every later movement will distort, so leave it room to be distorted.",
  "MOVEMENT 2 of 5 — THE WANT. The second fifth, where we learn what somebody is trying to get. Take movement 1's idea and put it in motion: a low ostinato that will not stop, a pulse with a hard edge on it. More insistent than the opening, NOT warmer and NOT more confident. Something should feel like it is being counted down.",
  "MOVEMENT 3 of 5 — THE TURN. The middle, where the story stops being the story we thought it was. The score CHANGES ITS MIND, hard: reharmonise the main idea a semitone off, break the pulse mid-phrase, drop the floor out and leave one thin sustained line exposed over nothing. The listener should feel the ground move without being told.",
  "MOVEMENT 4 of 5 — THE ESCALATION. The fourth fifth, where the pressure rises and options close. The tightest and most driven of the five and it should be genuinely hard to sit through: the ostinato accelerating, layers stacking, a low pulse hitting harder and closer together, dissonance tightening, almost no air left. Resolve NOTHING. This movement's job is to refuse to settle.",
  "MOVEMENT 5 of 5 — THE CLIMAX AND THE LANDING. The last fifth: the biggest and loudest moment in the film, then its outcome. Bring everything in at full weight for the peak — this is where the score is allowed to be overwhelming — then cut it back hard and let the main idea come to rest, bleak and quiet. A real ending in the last ten seconds, arriving on purpose, not a fade-out.",
];

/**
 * How a film type wants to be scored.
 *
 * "default" is the house palette, tuned for advertising: warm, West African,
 * supportive, sitting politely under a voice. It is the right sound for a film
 * that is selling something and the WRONG sound for a film with a crime in it —
 * the same brief that gives a groundnut-paste ad its charm gives a thriller a
 * string quartet under an arrest, which was the complaint that produced this map.
 *
 * The palette is chosen by the film kind (see each sandbox's STORY_KIND), so the
 * ad swarm keeps exactly the score it has always had.
 */
const SCORE_PALETTES = {
  default: {
    movements: SUITE_MOVEMENTS,
    instrumentation:
      "West African instrumentation is welcome where it fits — kora, balafon, gentle hand percussion — alongside warm strings and soft keys.",
    register:
      "It sits UNDER dialogue and narration, so keep it supportive and uncluttered: no busy melodic lines fighting a voice, nothing shrill.",
  },
  "high-tension": {
    movements: SUITE_MOVEMENTS_TENSION,
    instrumentation:
      "HIGH-TENSION DRAMATIC SCORING. This is a thriller's score, not a chamber piece — build it from low sustained strings and cellos played close to the bridge, deep bowed bass, a low pulsing synth or drone under everything, sparse struck percussion with real weight behind it (a low drum, a metallic hit, a taut skin), muted piano used as a percussive hit rather than a melody, and controlled dissonance. West African percussion belongs here where it drives rather than decorates — a hard, dry, insistent pulse, never a pleasant groove. NO warm strings, NO soft keys, NO gentle kora or balafon figures, NO lullaby, NO folk-pretty melody, NO uplifting or inspirational bed, NO classical string-quartet elegance, NO orchestral swell of the kind that plays over a triumphant montage. If it would sit comfortably under a bank advert, it is wrong for this film.",
    register:
      "It sits UNDER dialogue, so it must not fight a voice — but supportive does NOT mean pleasant. Hold the tension in the low end and in the pulse, where speech is not, and leave the midrange clear. Keep it restrained and let it accumulate: the score gets its power from patience and from what it refuses to resolve, not from volume. Nothing shrill, nothing busy across a line, no jump-scare stingers.",
  },
};

/** The palette for a film kind, defaulting to the house one. */
function scorePalette(filmKind) {
  return SCORE_PALETTES[filmKind?.score] || SCORE_PALETTES.default;
}

function scorePrompt({ concept, brandName, videoTypeNoun, toneHint, soundSpec, scoreNote, movement, palette }) {
  const voice = palette || SCORE_PALETTES.default;
  const parts = [
    `Compose an instrumental score for a ${videoTypeNoun || "short advert"}.`,
    // One movement of a suite. It goes near the top so the composer reads WHICH
    // piece it is writing before it reads what the film is about — the same
    // early-token weighting the scene prompts rely on.
    movement
      ? `THIS IS ONE MOVEMENT OF A LONGER SCORE. The film is scored by five separate pieces laid end to end, and they must sound like one work with five parts rather than five unrelated cues — same instrumental palette, same key centre unless the movement below says otherwise, same recording character. ${movement}`
      : "",
    brandName ? `Brand: ${brandName}.` : "",
    concept ? `The film: ${String(concept).slice(0, 600)}.` : "",
    // The director's own words, and they outrank everything derived below —
    // this is what they asked for when they said "re-score it warmer".
    scoreNote ? `THE DIRECTOR'S DIRECTION FOR THIS SCORE, which takes priority: ${String(scoreNote).slice(0, 400)}.` : "",
    toneHint ? `Emotional register: ${toneHint}.` : "",
    soundSpec
      ? `The film's authored sound world (match its mood, do NOT reproduce its ambience — that is already in the footage): ${String(soundSpec).slice(0, 500)}.`
      : "",
    voice.instrumentation,
    voice.register,
    "Purely instrumental. No vocals, no lyrics, no singing, no spoken word, no sound effects.",
  ];
  return parts.filter(Boolean).join(" ");
}

// ─── THE PASS ───────────────────────────────────────────────────────────────

/**
 * Score and narrate a finished cut.
 *
 * @param {object}   opts
 * @param {Function} opts.vertexFetch       Quota-managed Vertex caller.
 * @param {Function} opts.ttsGenerate       (text, voiceName, style) => { base64Wav, durationSec }.
 * @param {Function} opts.lyriaGenerate     (prompt) => { base64, mimeType, ext }.
 * @param {Function} opts.uploadBase64      (base64, path, contentType) => url.
 * @param {Function} opts.runCapture        (cmd, args) => stdout — for ffprobe.
 * @param {Function} opts.fetchVideoBase64  (url) => { base64, mimeType } for the scan.
 * @param {object}   opts.plan              ./audioPlan (the CJS planner port).
 * @param {object}   opts.engineApi         { canvasForAspect, EDITOR_DOC_FIELD, EDITOR_DOC_REV_FIELD }.
 * @param {object}   opts.project           Live project data (scenes, videoStatus, videoType…).
 * @param {string}   opts.projectId
 * @param {object}   opts.filmKind          From optiqSkills/pipeline: { noun, dialogueInVideo, ttsVoiceover }.
 * @param {Function} [opts.reloadProject]   async () => project — re-read at the end. See step 7.
 * @param {Function} [opts.onStage]         async (stage, meta) => void.
 * @returns {Promise<object>} A report: what was laid, and anything still wrong.
 */
async function runAudioPost({
  vertexFetch,
  ttsGenerate,
  lyriaGenerate,
  uploadBase64,
  runCapture,
  fetchVideoBase64,
  plan: P,
  engineApi,
  project,
  projectId,
  filmKind,
  onStage,
  /**
   * Re-read the project at the end of the pass. Defaults to the snapshot we
   * opened with, which is what a caller without Firestore (the test harness)
   * wants — see step 7 for why the live one matters in production.
   */
  reloadProject = async () => project,
  /** Optional direction for the score, in the director's own terms. */
  scoreNote,
}) {
  const report = { stages: [], narration: [], music: null, violations: [], notes: [] };
  const stage = async (name, meta) => {
    report.stages.push(name);
    if (onStage) {
      try {
        await onStage(name, meta);
      } catch (err) {
        console.warn(`[audio ${projectId}] onStage failed (non-fatal):`, String(err?.message || err).slice(0, 120));
      }
    }
  };

  // ── 1. MEASURE ────────────────────────────────────────────────────────────
  await stage("measuring");
  const scenes = project.scenes || [];
  const videoStatus = project.videoStatus || {};
  const clips = succeededClips(scenes, videoStatus);
  if (clips.length === 0) {
    throw new Error("No rendered clips — the film has to be shot before it can be scored.");
  }

  const durations = await mapWithConcurrency(clips, SCAN_CONCURRENCY, async (clip) => {
    try {
      return await probeDurationFromUrl(clip.url, runCapture);
    } catch (err) {
      console.warn(
        `[audio ${projectId}] could not probe scene ${clip.sceneIndex + 1}, assuming 10s:`,
        String(err?.message || err).slice(0, 140)
      );
      report.notes.push(`Scene ${clip.sceneIndex + 1}'s length could not be measured; assumed 10s.`);
      return 10;
    }
  });

  // Index durations by scene so gaps stay gaps.
  const bySceneDuration = [];
  clips.forEach((clip, i) => {
    bySceneDuration[clip.sceneIndex] = durations[i];
  });
  const film = P.filmTimeMap(bySceneDuration);
  report.film = { duration: film.duration, scenes: film.scenes.length };
  if (film.duration <= 0) throw new Error("The rendered clips measured zero total length.");

  // ── 2. SCAN ───────────────────────────────────────────────────────────────
  // Only narrated films need speakable windows. A dialogue film is scanned too —
  // cheaply, text-only — because the score still wants to know the film's shape.
  const narrating = !!filmKind.ttsVoiceover;

  // A documentary arrives with its narration ALREADY WRITTEN, scene by scene, by
  // the swarm that decided what the film argues. Everything below then changes
  // shape: the scanner is looking for a home for a line that exists rather than
  // for anywhere a voice might go, scenes the outline wrote silent are not
  // scanned at all, and the write step becomes a FIT rather than an invention.
  //
  // The narrated ad works the other way round and always has: it has no script,
  // so a model watches the pictures and writes one. Both paths converge again at
  // the speak/refit loop.
  const scripted = filmKind.narrationFromScript ? scriptedNarration(project) : null;
  let windows = [];
  let sceneSummaries = [];

  if (narrating) {
    await stage("scanning", { scenesTotal: clips.length });
    let scanned = 0;
    const scans = await mapWithConcurrency(clips, SCAN_CONCURRENCY, async (clip, i) => {
      const sceneDuration = durations[i];
      const scriptedLine = scripted ? (scripted.get(clip.sceneIndex) || "") : null;
      // Scripted silence is a decision the outline made deliberately (see
      // §7.5 — the strongest moment in a documentary is usually the one the
      // narrator shuts up for). Honour it, and save a Vertex call while we are
      // at it: a scene with no line needs no window.
      if (scripted && !scriptedLine) {
        scanned += 1;
        await stage("scanning", { scenesDone: scanned, scenesTotal: clips.length });
        return {
          summary: String(scenes[clip.sceneIndex]?.action || "").slice(0, 200),
          onScreenText: "",
          speech: false,
          windows: [],
        };
      }
      try {
        const media = await fetchVideoBase64(clip.url);
        const result = await scanScene({
          vertexFetch,
          media,
          sceneDuration,
          sceneIndex: clip.sceneIndex,
          sceneCount: scenes.length,
          scene: scenes[clip.sceneIndex],
          scriptedLine,
        });
        return result;
      } catch (err) {
        console.warn(
          `[audio ${projectId}] scan failed for scene ${clip.sceneIndex + 1}:`,
          String(err?.message || err).slice(0, 160)
        );
        report.notes.push(`Scene ${clip.sceneIndex + 1} could not be watched; a default window was used.`);
        // Fall back to a conservative window inside the clip rather than losing
        // the scene from the narration entirely.
        return {
          summary: String(scenes[clip.sceneIndex]?.action || "").slice(0, 200),
          onScreenText: "",
          speech: false,
          windows: [{ startInScene: 0.6, endInScene: Math.max(0.6, sceneDuration - 0.6), note: "unwatched scene" }],
        };
      } finally {
        scanned += 1;
        await stage("scanning", { scenesDone: scanned, scenesTotal: clips.length });
      }
    });

    scans.forEach((scan, i) => {
      const sceneIndex = clips[i].sceneIndex;
      sceneSummaries.push({ sceneIndex, summary: scan.summary, onScreenText: scan.onScreenText });
      for (const win of scan.windows || []) {
        windows.push({
          sceneIndex,
          startInScene: Number(win.startInScene),
          endInScene: Number(win.endInScene),
          note: win.note,
        });
      }
    });
  }

  const slots = narrating ? P.narrationSlots(film, windows) : [];
  report.slots = slots.length;

  // ── 3 & 4 & 5. WRITE → SPEAK → REFIT ──────────────────────────────────────
  let placements = [];
  let chosenVoice = null;
  if (narrating && slots.length > 0) {
    await stage("writing");
    const script = scripted
      ? await fitNarrationScript({
          vertexFetch,
          project,
          filmKind,
          slots,
          scripted,
          sceneSummaries,
          film,
        })
      : await writeNarration({
          vertexFetch,
          project,
          filmKind,
          slots,
          sceneSummaries,
          film,
        });
    chosenVoice = narratorVoice(script.voiceId);
    report.voice = { id: script.voiceId in NARRATOR_VOICES ? script.voiceId : DEFAULT_VOICE_ID, ...chosenVoice };
    const styleDirection = script.styleDirection
      ? `${chosenVoice.style}. ${script.styleDirection}`
      : chosenVoice.style;

    let pending = (script.lines || [])
      .filter((l) => l && l.slotId && String(l.text || "").trim())
      .map((l) => ({ slotId: l.slotId, text: String(l.text).trim() }));

    const takes = new Map();
    for (let pass = 0; pass <= MAX_REFIT_PASSES; pass++) {
      if (pending.length === 0) break;
      await stage(pass === 0 ? "speaking" : "refitting", { lines: pending.length, pass });

      const spoken = await mapWithConcurrency(pending, TTS_CONCURRENCY, async (line, i) => {
        try {
          const audio = await ttsGenerate(line.text, chosenVoice.voice, styleDirection);
          const url = await uploadBase64(
            audio.base64Wav,
            `projects/${projectId}/vo/${line.slotId}_p${pass}.wav`,
            "audio/wav"
          );
          return { slotId: line.slotId, text: line.text, url, durationSec: audio.durationSec };
        } catch (err) {
          console.error(
            `[audio ${projectId}] TTS failed for ${line.slotId}:`,
            String(err?.message || err).slice(0, 160)
          );
          return { slotId: line.slotId, text: line.text, durationSec: 0 };
        }
      });
      for (const take of spoken) takes.set(take.slotId, take);

      const attempt = P.planNarration(slots, [...takes.values()]);
      placements = attempt.placements;
      if (attempt.refits.length === 0) break;

      if (pass === MAX_REFIT_PASSES) {
        // Out of passes. Ship what fits and say what was dropped rather than
        // placing a line that talks over the next one.
        for (const refit of attempt.refits) {
          report.notes.push(
            `Dropped one narration line that would not fit its ${refit.availableSec}s slot after ${MAX_REFIT_PASSES + 1} attempts.`
          );
        }
        break;
      }

      await stage("rewriting", { lines: attempt.refits.length, pass });
      const rewritten = await rewriteOverruns({ vertexFetch, refits: attempt.refits, project });
      pending = rewritten;
      // Anything the rewriter declined to return keeps its old (failing) take,
      // which planNarration will refuse again — so drop it from `takes` to make
      // the drop explicit rather than silently re-placing an overrun.
      for (const refit of attempt.refits) {
        if (!rewritten.some((r) => r.slotId === refit.slotId)) takes.delete(refit.slotId);
      }
    }
    report.narration = placements.map((p) => ({
      sceneIndex: p.sceneIndex,
      start: p.start,
      duration: p.duration,
      text: p.text,
    }));
  }

  // ── 6. SCORE ──────────────────────────────────────────────────────────────
  //
  // A SHORT film gets ONE composed track, looped to length. That is right for
  // 30–180 seconds and wrong past it: the same 60 seconds played five times is a
  // ringtone, and by the third repeat it is the loudest thing in the film. So a
  // LONG film gets a SUITE — five separate pieces, each composed for the stretch
  // of story it sits under, laid end to end with a crossfade at every seam.
  //
  // The threshold is the run-time, not the film type, so any type that grows past
  // it inherits the suite rather than needing to be added here.
  await stage("scoring");
  const SUITE_FROM_SECONDS = 200;
  const wantsSuite = film.duration >= SUITE_FROM_SECONDS;
  let musicUrl = null;
  let musicPlan = P.planMusic(0, 0);
  try {
    // Which sound this film wants. Chosen by the film KIND, so the ad swarm keeps
    // the warm house palette and the experimental story gets a thriller's score.
    const palette = scorePalette(filmKind);
    const movements = wantsSuite ? palette.movements : [null];
    const composed = [];

    for (let i = 0; i < movements.length; i++) {
      // Composed one at a time, deliberately. Lyria is metered at 4/minute
      // (vertexQuota DEFAULT_CAPS.music), so five in parallel spends the first
      // minute of the window and then waits anyway — and a serial loop means a
      // failure on movement 4 still leaves movements 1–3 to score the film with.
      let track;
      try {
        track = await lyriaGenerate(
          scorePrompt({
            concept: project.concept,
            brandName: project.brandName,
            videoTypeNoun: filmKind.noun,
            toneHint: project.storyArc,
            soundSpec: project.musicSpec,
            scoreNote,
            movement: movements[i],
            palette,
          })
        );
      } catch (err) {
        console.error(
          `[audio ${projectId}] movement ${i + 1} could not be composed:`,
          String(err?.message || err).slice(0, 180)
        );
        report.notes.push(`Movement ${i + 1} of the score could not be composed; the others carry the film.`);
        continue;
      }

      const url = await uploadBase64(
        track.base64,
        // Numbered per movement. A single-track score keeps the historical
        // `score.<ext>` path so nothing that reads an existing project breaks.
        `projects/${projectId}/${wantsSuite ? `score-${i + 1}` : "score"}.${track.ext}`,
        track.mimeType
      );

      // Lyria's length is whatever it decided — 64s and 114s have both come back
      // from the same prompt — so it has to be measured, never assumed.
      let duration;
      try {
        duration = await probeDurationFromUrl(url, runCapture);
      } catch (err) {
        console.warn(
          `[audio ${projectId}] could not probe movement ${i + 1}:`,
          String(err?.message || err).slice(0, 140)
        );
        report.notes.push(`Movement ${i + 1}'s length could not be measured, so it was laid without looping.`);
        duration = film.duration;
      }
      composed.push({ url, duration });
    }

    if (composed.length === 0) throw new Error("no movement of the score could be composed");

    // `musicUrl` stays the FIRST piece: it is the plan's fallback source for any
    // segment that does not name its own, and it is what the report links to.
    musicUrl = composed[0].url;
    musicPlan = wantsSuite
      ? P.planMusicSuite(composed, film.duration, { hasNarration: placements.length > 0 })
      : P.planMusic(composed[0].duration, film.duration, { hasNarration: placements.length > 0 });

    report.music = {
      url: musicUrl,
      trackDuration: Math.round(composed[0].duration * 100) / 100,
      segments: musicPlan.segments.length,
      loops: musicPlan.loops,
      gain: musicPlan.gain,
      ...(wantsSuite ? { suite: composed.map((c) => ({ url: c.url, duration: Math.round(c.duration * 100) / 100 })) } : {}),
    };
    report.notes.push(...musicPlan.notes);
    if (wantsSuite) {
      report.notes.push(
        `This film is ${Math.round(film.duration)}s, so it was scored as a suite of ${composed.length} ` +
          `separate composed pieces rather than one looped track.`
      );
    }
  } catch (err) {
    console.error(`[audio ${projectId}] scoring failed:`, String(err?.message || err).slice(0, 200));
    report.notes.push(`No score was laid: ${String(err?.message || err).slice(0, 160)}`);
  }

  // ── 7. PLACE ──────────────────────────────────────────────────────────────
  await stage("placing");
  const { canvasForAspect, EDITOR_DOC_FIELD, EDITOR_DOC_REV_FIELD } = engineApi;
  const canvas = canvasForAspect(project.aspectRatio);

  // Everything above took minutes — a Lyria composition alone is over a minute —
  // and the project has moved on underneath us. Re-read it, so the audio lands
  // on the film as it stands NOW rather than as it stood before the score was
  // composed: by now the director has usually opened the editor, which saves a
  // document built from the full cut, and scenes that were still rendering when
  // we measured have landed. Writing the opening snapshot's picture back over
  // that is what left a finished six-scene film showing two clips.
  let live = project;
  try {
    const fresh = await reloadProject();
    if (fresh && typeof fresh === "object") live = fresh;
  } catch (err) {
    console.warn(
      `[audio ${projectId}] could not re-read the project; laying audio on the opening snapshot:`,
      String(err?.message || err).slice(0, 140)
    );
  }

  // A document the director has already edited is preserved and only gains the
  // audio tracks. A project never opened in the editor gets one built here from
  // the MEASURED clip lengths.
  let doc = null;
  const stored = live[EDITOR_DOC_FIELD];
  if (stored && Array.isArray(stored.tracks)) {
    try {
      doc = JSON.parse(JSON.stringify(stored));
    } catch {
      doc = null;
    }
  }
  if (!doc) {
    // No document to preserve, so the picture is cut here — from the clip set as
    // it stands now, not the one this pass opened with. Lengths already probed
    // in step 1 are reused; anything that landed since is probed rather than
    // assumed, because the narration is cut to real durations.
    const liveClips = succeededClips(live.scenes || scenes, live.videoStatus || videoStatus);
    // The re-read can only ADD picture, never take it away. An empty or partial
    // read — a project mid-write, an agent turn rewriting the scene list — must
    // not be able to deliver a film with fewer clips than we just scored.
    const source = liveClips.length >= clips.length ? liveClips : clips;
    const measured = new Map(clips.map((c, i) => [c.url, durations[i]]));
    const cut = await mapWithConcurrency(source, SCAN_CONCURRENCY, async (clip) => {
      const known = measured.get(clip.url);
      if (known) return { ...clip, duration: known };
      try {
        return { ...clip, duration: await probeDurationFromUrl(clip.url, runCapture) };
      } catch (err) {
        console.warn(
          `[audio ${projectId}] could not probe late scene ${clip.sceneIndex + 1}, assuming 10s:`,
          String(err?.message || err).slice(0, 140)
        );
        return { ...clip, duration: 10 };
      }
    });
    if (cut.length !== clips.length) {
      report.notes.push(
        `The cut changed while the audio was being made — ${cut.length} clip(s) are on the timeline, ` +
          `${clips.length} were scored. The score and any narration follow the ${clips.length} that were.`
      );
    }
    doc = P.baseDocFromClips(cut, canvas);
  }
  // The canvas is the shape of the deliverable; a stored document built before
  // aspect ratios were honoured carries a landscape frame (see bridge.ts).
  doc.width = canvas.width;
  doc.height = canvas.height;

  // A narrated film's footage is silent by construction, so muting it costs
  // nothing and guarantees no stray room tone fights the voiceover. A dialogue
  // film keeps its own audio — this is the bug in the legacy compile path, which
  // muted the video unconditionally and threw the performances away.
  //
  // A dialogue film's own audio is now LIFTED rather than passed through at unity.
  // The video model returns clips mixed well below broadcast level, so a finished
  // film played quiet on every device and the performances the director paid to
  // render were the thing being lost. 3× is the measured multiple that brings them
  // up without clipping; editorEngine.js validates the range as [0, 4], so this is
  // inside the ceiling with headroom deliberately left above it.
  const FOOTAGE_GAIN = 3;
  const footageGain = filmKind.dialogueInVideo ? FOOTAGE_GAIN : 0;

  const audioPlan = {
    film,
    narration: placements,
    music: musicPlan,
    footageGain,
    musicUrl: musicUrl || undefined,
  };
  P.applyAudioPlanToDoc(doc, audioPlan);

  // ── 8. REVIEW ─────────────────────────────────────────────────────────────
  const violations = P.validateAudioPlan(audioPlan);
  report.violations = violations.map((v) => `${v.kind}: ${v.message}`);
  if (violations.length > 0) {
    console.warn(`[audio ${projectId}] plan review found ${violations.length} issue(s):`, report.violations);
  }

  report.editorDoc = doc;
  // Off the LIVE revision, not the opening one. Bumping a stale rev produces a
  // number the open editor has already passed, and its autosaver would dismiss
  // this write as an echo of its own — the music would never appear.
  report.editorDocRev = Number(live[EDITOR_DOC_REV_FIELD] ?? 0) + 1;
  report.docFields = { doc: EDITOR_DOC_FIELD, rev: EDITOR_DOC_REV_FIELD };
  return report;
}

// ─── STEP 2: WATCHING ONE SCENE ─────────────────────────────────────────────

async function scanScene({ vertexFetch, media, sceneDuration, sceneIndex, sceneCount, scene, scriptedLine = null }) {
  // A documentary's line already exists and is going into this clip somewhere, so
  // the scanner is not deciding WHETHER to narrate — it is finding the best home
  // for a line of known length. Told how long that line is, it stops proposing
  // 1.3-second slivers the refit loop would then have to shred the writing to fit.
  const scriptedWords = scriptedLine ? String(scriptedLine).trim().split(/\s+/).filter(Boolean).length : 0;
  const needed = scriptedWords ? Math.max(1.5, scriptedWords / 2.5) : 0;

  const system = `You are the FILM SCANNER for Optiq Studio's audio post-production pass. You are watching ONE ${sceneDuration.toFixed(2)}-second clip from a ${sceneCount}-scene film, and your output decides where a narrator's voice can go. Timing precision is the entire job: every second matters, and a window that is even half a second wrong puts a line of narration on top of the wrong picture.
${
    scriptedLine
      ? `
THIS SCENE'S NARRATION IS ALREADY WRITTEN. The narrator will say, over this clip:
  "${scriptedLine}"
That is ${scriptedWords} words, which takes about ${needed.toFixed(1)}s to read. Your job is to find the BEST
single home for it inside this clip — the stretch where the picture is most
settled and most legible, ideally at least ${needed.toFixed(1)}s long. Return ONE window, the best
one. If nothing in the clip is that long, return the longest usable stretch you
can find anyway and say so in the note; the line will be trimmed to fit rather
than dropped.`
      : ""
}

Report, in THIS CLIP'S OWN SECONDS (0 to ${sceneDuration.toFixed(2)} — never film-wide time):
1. summary — what physically happens, in one or two sentences. Concrete actions, in order.
2. onScreenText — any words visible in frame (a label, a sign, a logo). Empty string if none. A narrator must not read out text the viewer can already see.
3. speech — true if anyone in the clip appears to be TALKING (lips moving in speech). A narrator must never be laid over someone speaking.
4. windows — the spans where a narrator's voice would SIT WELL. Rules:
   • Only inside 0–${sceneDuration.toFixed(2)}. Never negative, never past the end.
   • Never over anybody speaking.
   • Leave the first and last ~0.4s of the clip clear so a line doesn't collide with the cut.
   • A window must be at least 1.2s long or it is useless — omit it rather than reporting a sliver.
   • Prefer the part of the shot where the picture is settled and the action is legible, not the middle of a fast movement.
   • Zero, one or two windows. MOST SCENES SHOULD HAVE AT MOST ONE. Wall-to-wall narration is the failure mode here — silence is a legitimate answer, and a film narrated over every second is exhausting.
   • note — what the picture is doing in that window, so the writer knows what the line is talking over.`;

  const parts = [];
  if (media?.base64) {
    parts.push({ inlineData: { mimeType: media.mimeType || "video/mp4", data: media.base64 } });
  }
  parts.push({
    text: `This is scene ${sceneIndex + 1} of ${sceneCount}. Exact length: ${sceneDuration.toFixed(3)}s.

What the scene was written to be (context only — report what you actually SEE):
${String(scene?.action || scene?.setting || "").slice(0, 600)}`,
  });

  const response = await vertexFetch(`/publishers/google/models/${SCAN_MODEL}:generateContent`, {
    contents: [{ role: "user", parts }],
    systemInstruction: { parts: [{ text: system }] },
    generationConfig: {
      temperature: 0.2,
      responseMimeType: "application/json",
      responseSchema: SCAN_SCHEMA,
    },
  });
  const text = response.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("") || "{}";
  const parsed = JSON.parse(text);
  // A clip where someone is speaking gets no narration at all, whatever the
  // model proposed — narration over dialogue is unusable.
  if (parsed.speech) parsed.windows = [];
  return parsed;
}

// ─── STEP 3: WRITING TO THE SLOTS ───────────────────────────────────────────

async function writeNarration({ vertexFetch, project, filmKind, slots, sceneSummaries, film }) {
  const system = `You are the NARRATION DIRECTOR for an Optiq Studio ${filmKind.noun}. The film is already shot and cut. Nobody speaks on camera. You write the voiceover that plays over it, and you pick the voice that reads it.

THE HARD PART, AND THE ONLY THING THAT MATTERS: each line goes into a FIXED SLOT with a hard time limit. A line that runs long is thrown away and rewritten, which costs a whole synthesis pass. Write to the word budget you are given for each slot — at or UNDER it, never over. Short is always safe; long is always wasted.

How to write it:
• The lines are ONE continuous piece of narration, read in order, not independent captions. Line 2 continues line 1.
• Never describe what the viewer can already see. The picture does that. Say the thing the picture cannot: why it matters, what it means, what it costs, what to do.
• Never read out text that is already on screen.
• Plain spoken language. Contractions. No advertising cliché ("unlock", "elevate", "journey", "game-changing"), no rhetorical questions, no exclamation marks.
• Not every slot needs a line. Leaving a slot empty is a real choice and often the right one — silence lets a shot land. Omit the slot entirely rather than padding it.
• The last line should land the brand or the point, but only if a slot is actually available at the end.
• Words only — no stage directions, no scene numbers, no quotes, no emoji.

Pick the voice from this catalog, matching it to the film's register:
${voiceCatalogText()}

Also give a short styleDirection (under 20 words) — how this specific film should be read, e.g. "slower than usual, let each line settle" or "brisk and warm, smiling".`;

  const slotList = slots
    .map(
      (s) =>
        `slotId "${s.id}" — scene ${s.sceneIndex + 1}, ${s.start.toFixed(2)}s–${s.end.toFixed(2)}s of the film ` +
        `(${s.available.toFixed(2)}s available → MAX ${s.wordBudget} WORDS)` +
        (s.note ? `. Picture: ${s.note}` : "")
    )
    .join("\n");

  const summaries = sceneSummaries
    .map((s) => `Scene ${s.sceneIndex + 1}: ${s.summary}${s.onScreenText ? ` [on screen: "${s.onScreenText}"]` : ""}`)
    .join("\n");

  const brief = `Brand: ${project.brandName || "the brand"}
Offering: ${project.product || "(unspecified)"}
Film: ${project.title || "(untitled)"} — ${film.duration.toFixed(1)}s total
Concept: ${String(project.concept || "").slice(0, 700)}

WHAT IS ACTUALLY ON SCREEN, scene by scene:
${summaries}

THE SLOTS YOU MAY WRITE INTO (return a line only for the ones you use):
${slotList}`;

  const response = await vertexFetch(`/publishers/google/models/${SCAN_MODEL}:generateContent`, {
    contents: [{ role: "user", parts: [{ text: brief }] }],
    systemInstruction: { parts: [{ text: system }] },
    generationConfig: {
      temperature: 0.8,
      responseMimeType: "application/json",
      responseSchema: SCRIPT_SCHEMA,
    },
  });
  const text = response.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("") || "{}";
  return JSON.parse(text);
}

// ─── STEP 3b: FITTING A SCRIPT THAT ALREADY EXISTS ──────────────────────────
//
// The documentary path. The words were written by the swarm's outline skill,
// which is the only thing in the system that knew what the film was arguing
// before the pictures existed. This step does NOT rewrite them: it maps each
// scene's line to the slot found in that scene, trims only the lines that are
// physically too long for the gap they landed in, and picks the voice.
//
// Deliberately not merged with writeNarration. That function's whole job is to
// invent a voiceover from pictures, and a model given both a script and an
// invitation to write will rewrite the script — which throws away the argument
// and produces exactly the narrated slideshow the documentary sandbox exists to
// prevent.

async function fitNarrationScript({ vertexFetch, project, filmKind, slots, scripted, sceneSummaries, film }) {
  // One line per scene, into that scene's roomiest slot. A scene with two slots
  // gets its line in the better one and leaves the other silent — a documentary
  // line is one thought and splitting it across a cut makes it two.
  const bestSlotByScene = new Map();
  for (const slot of slots) {
    const current = bestSlotByScene.get(slot.sceneIndex);
    if (!current || slot.available > current.available) bestSlotByScene.set(slot.sceneIndex, slot);
  }

  const placed = [];
  const tooLong = [];
  for (const [sceneIndex, slot] of bestSlotByScene) {
    const text = String(scripted.get(sceneIndex) || "").trim();
    if (!text) continue;
    const words = text.split(/\s+/).filter(Boolean).length;
    if (words <= slot.wordBudget) placed.push({ slotId: slot.id, text });
    else tooLong.push({ slotId: slot.id, sceneIndex, text, words, slot });
  }

  // Nothing overran: no model call at all, and the director's words reach the
  // recording booth exactly as written.
  if (tooLong.length === 0) {
    return {
      voiceId: narratorVoiceIdFor(project),
      styleDirection: String(project.narratorNote || "").slice(0, 160),
      lines: placed,
    };
  }

  const system = `You are TRIMMING the narration of an Optiq Studio ${filmKind.noun} so it fits the film that was actually shot. The script is already written and it is GOOD. You are not rewriting it and you are not improving it — you are making specific lines shorter because the gap in the picture is smaller than the line.

RULES:
• Hit the word count you are given, or go UNDER it. Over is a failure and costs another synthesis pass.
• Keep the MEANING and the exact register. Cut words, never the point.
• Cut adjectives, filler and preamble first. Then combine clauses. Then drop the least important idea.
• Never end mid-thought. A shorter complete sentence beats a clipped long one.
• Do not add anything. No new facts, no new numbers, no flourish, nothing the original line did not say.
• Words only — no notes, no quotes, no explanation of what you cut.

Return one line for each slotId given to you, and nothing else.`;

  const list = tooLong
    .map(
      (t) =>
        `slotId "${t.slotId}" (scene ${t.sceneIndex + 1}): the line is ${t.words} words but only ` +
        `${t.slot.available.toFixed(2)}s of picture is available — cut it to AT MOST ${t.slot.wordBudget} words.\n` +
        `  Line: ${t.text}`
    )
    .join("\n\n");

  const summaries = sceneSummaries
    .map((s) => `Scene ${s.sceneIndex + 1}: ${s.summary}`)
    .join("\n");

  try {
    const response = await vertexFetch(`/publishers/google/models/${SCAN_MODEL}:generateContent`, {
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `Film: ${project.title || "(untitled)"} — ${film.duration.toFixed(1)}s total
${project.thesis ? `What the film argues: ${project.thesis}` : ""}

WHAT IS ON SCREEN, scene by scene (context only):
${summaries}

LINES TO TRIM:
${list}`,
            },
          ],
        },
      ],
      systemInstruction: { parts: [{ text: system }] },
      generationConfig: {
        temperature: 0.4,
        responseMimeType: "application/json",
        responseSchema: REWRITE_SCHEMA,
      },
    });
    const text = response.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("") || "{}";
    const parsed = JSON.parse(text);
    const trimmed = new Map(
      (parsed.lines || [])
        .filter((l) => l && l.slotId && String(l.text || "").trim())
        .map((l) => [l.slotId, String(l.text).trim()])
    );
    for (const t of tooLong) {
      // A line the trimmer dropped still ships as written: the speak/refit loop
      // downstream will shorten it if it genuinely overruns, and shipping the
      // author's words is always better than shipping none.
      placed.push({ slotId: t.slotId, text: trimmed.get(t.slotId) || t.text });
    }
  } catch (err) {
    console.warn(
      "narration trim pass failed; using the script as written and letting the refit loop handle it:",
      String(err?.message || err).slice(0, 160)
    );
    for (const t of tooLong) placed.push({ slotId: t.slotId, text: t.text });
  }

  return {
    voiceId: narratorVoiceIdFor(project),
    styleDirection: String(project.narratorNote || "").slice(0, 160),
    lines: placed,
  };
}

/**
 * Pick a narrator for a film that came with its own script.
 *
 * The swarm writes a `narratorNote` ("slow, plain, no warmth added") rather than
 * naming a voice, because voices are an audio-post concern. This maps the note
 * onto the catalogue by the words that actually distinguish the voices, and
 * falls back to the house default. Deliberately not a model call: it is one
 * choice out of seven and it is not worth a round-trip.
 */
function narratorVoiceIdFor(project) {
  const note = String(project?.narratorNote || "").toLowerCase();
  if (!note) return DEFAULT_VOICE_ID;
  if (/\b(deep|weighty|authorit|elder|grave|solemn|wise)\b/.test(note)) return "gambian-deep-male";
  if (/\b(cinema|trailer|epic|sweeping|charismatic)\b/.test(note)) return "cinematic-deep";
  if (/\b(young|bright|quick|fast|upbeat|energetic|excited|curious)\b/.test(note)) {
    return /\b(man|male|his|he)\b/.test(note) ? "young-vibrant-male" : "young-vibrant-female";
  }
  if (/\b(plain|grounded|matter-of-fact|no performance|blunt|flat|dry)\b/.test(note)) return "grounded-male";
  if (/\b(older|poised|measured|graceful|stately)\b/.test(note)) return "gambian-elder-female";
  return DEFAULT_VOICE_ID;
}

// ─── STEP 5: CUTTING THE OVERRUNS ───────────────────────────────────────────

async function rewriteOverruns({ vertexFetch, refits, project }) {
  const system = `You are trimming voiceover lines that ran past their slot in an Optiq Studio film. Each line below was synthesized and MEASURED, and it is too long for the gap it has to sit in.

Rewrite each one to fit. Rules:
• Hit the target word count or go UNDER it. Over is a failure and costs another pass.
• Keep the meaning and the tone. Cut words, not the point.
• Cut adjectives, filler and preamble first. Then combine clauses. Then drop the least important idea.
• Never end mid-thought. A shorter complete sentence beats a clipped long one.
• Words only — no notes, no quotes, no explanation of what you cut.`;

  const list = refits
    .map(
      (r) =>
        `slotId "${r.slotId}": currently ${r.currentWords} words and measured ${r.actualSec}s, ` +
        `but only ${r.availableSec}s is available. Cut it to AT MOST ${r.targetWords} words.\n  Current text: ${r.text}`
    )
    .join("\n\n");

  const response = await vertexFetch(`/publishers/google/models/${SCAN_MODEL}:generateContent`, {
    contents: [
      {
        role: "user",
        parts: [{ text: `Brand: ${project.brandName || "the brand"}\n\nLines to trim:\n\n${list}` }],
      },
    ],
    systemInstruction: { parts: [{ text: system }] },
    generationConfig: {
      temperature: 0.5,
      responseMimeType: "application/json",
      responseSchema: REWRITE_SCHEMA,
    },
  });
  const text = response.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("") || "{}";
  const parsed = JSON.parse(text);
  const wanted = new Set(refits.map((r) => r.slotId));
  return (parsed.lines || [])
    .filter((l) => l && wanted.has(l.slotId) && String(l.text || "").trim())
    .map((l) => ({ slotId: l.slotId, text: String(l.text).trim() }));
}

module.exports = {
  runAudioPost,
  probeDurationFromUrl,
  scorePrompt,
  scorePalette,
  SCORE_PALETTES,
  narratorVoice,
  narratorVoiceIdFor,
  scriptedNarration,
  voiceCatalogText,
  NARRATOR_VOICES,
  DEFAULT_VOICE_ID,
  MAX_REFIT_PASSES,
};
