// ─── OPTIQ — AUDIO POST PLANNER (CommonJS port) ─────────────────────────────
//
// Port of lib/editor/audioPlan.ts, the same way functions/editorEngine.js ports
// lib/editor/edl.ts: `functions/` deploys on its own and cannot import from
// `lib/`, so the arithmetic exists twice and scripts/test-audio-parity.ts diffs
// the two on every change. If you edit one, edit both.
//
// One deliberate difference. The TS version applies a plan through EditorEngine's
// command layer; the server has no engine (only the renderer and the probe were
// ported). So `applyAudioPlanToDoc` here mutates the document JSON directly,
// upholding the same invariants validateDoc enforces: clips sorted by start,
// never overlapping within a track, srcOut - srcIn === duration × speed, and
// doc.duration equal to the furthest clip end.

"use strict";

// ── Tunables (must match the TS twin) ───────────────────────────────────────

const SPEECH_WPS = 2.58;
const SLOT_FILL = 0.9;
const MIN_SLOT = 1.2;
const HEAD_ROOM = 0.15;
const MUSIC_GAIN_WITH_NARRATION = 0.16;
const MUSIC_GAIN_ALONE = 0.3;
const MUSIC_FADE_IN = 1.2;
const MUSIC_FADE_OUT = 2;
const MUSIC_CROSSFADE = 1.5;

const MUSIC_TRACK_NAMES = ["Score", "Score B"];
const NARRATION_TRACK_NAME = "Voiceover";

const MIN_CLIP_DURATION = 0.05;

function round(v) {
  return Math.round(v * 1e6) / 1e6;
}

function clipText(text, max = 60) {
  const s = String(text == null ? "" : text).trim();
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

let idCounter = 0;
function genId(prefix) {
  idCounter = (idCounter + 1) % 0xffff;
  return `${prefix}_${Date.now().toString(36)}${idCounter.toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

// ── The film's time map ─────────────────────────────────────────────────────

function filmTimeMap(sceneDurations) {
  const scenes = [];
  let cursor = 0;
  (sceneDurations || []).forEach((raw, sceneIndex) => {
    const duration = typeof raw === "number" && Number.isFinite(raw) && raw > 0 ? raw : 0;
    if (duration <= 0) return;
    scenes.push({ sceneIndex, start: round(cursor), end: round(cursor + duration), duration: round(duration) });
    cursor += duration;
  });
  return { scenes, duration: round(cursor) };
}

// ── Word budgets ────────────────────────────────────────────────────────────

function countWords(text) {
  return String(text == null ? "" : text).trim().split(/\s+/).filter(Boolean).length;
}

function wordBudget(seconds, wps = SPEECH_WPS, fill = SLOT_FILL) {
  return Math.max(1, Math.floor(Math.max(0, seconds) * fill * wps));
}

function estimateSpeechDuration(text, wps = SPEECH_WPS) {
  const words = countWords(text);
  return words === 0 ? 0 : round(words / wps);
}

// ── Narration slots ─────────────────────────────────────────────────────────

function narrationSlots(map, windows, opts = {}) {
  const minSlot = opts.minSlot == null ? MIN_SLOT : opts.minSlot;
  const headRoom = opts.headRoom == null ? HEAD_ROOM : opts.headRoom;
  const wps = opts.wps == null ? SPEECH_WPS : opts.wps;
  const fill = opts.fill == null ? SLOT_FILL : opts.fill;

  const byIndex = new Map(map.scenes.map((s) => [s.sceneIndex, s]));
  const candidates = [];

  for (const win of windows || []) {
    const scene = byIndex.get(win.sceneIndex);
    if (!scene) continue;
    const rawStart = Number(win.startInScene);
    const rawEnd = Number(win.endInScene);
    if (!Number.isFinite(rawStart) || !Number.isFinite(rawEnd)) continue;

    const startInScene = Math.max(0, Math.min(rawStart, scene.duration));
    const endInScene = Math.max(startInScene, Math.min(rawEnd, scene.duration));
    const start = Math.max(headRoom, scene.start + startInScene);
    const end = Math.min(map.duration - headRoom, scene.start + endInScene);
    if (end - start < minSlot) continue;

    candidates.push({
      id: genId("slot"),
      sceneIndex: win.sceneIndex,
      start: round(start),
      end: round(end),
      available: round(end - start),
      wordBudget: wordBudget(end - start, wps, fill),
      note: win.note,
    });
  }

  candidates.sort((a, b) => a.start - b.start || a.end - b.end);
  const slots = [];
  let guard = 0;
  for (const slot of candidates) {
    const start = Math.max(slot.start, guard);
    if (slot.end - start < minSlot) continue;
    const fixed = {
      ...slot,
      start: round(start),
      end: round(slot.end),
      available: round(slot.end - start),
      wordBudget: wordBudget(slot.end - start, wps, fill),
    };
    slots.push(fixed);
    guard = fixed.end;
  }
  return slots;
}

// ── Placing measured narration ──────────────────────────────────────────────

function measuredWps(take, fallback) {
  const words = countWords(take.text);
  if (words === 0 || !(take.durationSec > 0)) return fallback;
  return words / take.durationSec;
}

function planNarration(slots, takes, opts = {}) {
  const wps = opts.wps == null ? SPEECH_WPS : opts.wps;
  const fill = opts.fill == null ? SLOT_FILL : opts.fill;
  const bySlot = new Map(slots.map((s) => [s.id, s]));
  const placements = [];
  const refits = [];
  const used = new Set();

  for (const take of takes || []) {
    const slot = bySlot.get(take.slotId);
    if (!slot) continue;
    used.add(slot.id);

    const actual = Number(take.durationSec);
    if (!Number.isFinite(actual) || actual <= 0) {
      refits.push({
        slotId: slot.id,
        text: take.text,
        actualSec: 0,
        availableSec: slot.available,
        targetWords: slot.wordBudget,
        currentWords: countWords(take.text),
        reason: "The line produced no measurable audio.",
      });
      continue;
    }

    if (actual > slot.available + 1e-6) {
      const over = round(actual - slot.available);
      refits.push({
        slotId: slot.id,
        text: take.text,
        actualSec: round(actual),
        availableSec: slot.available,
        targetWords: wordBudget(slot.available, measuredWps(take, wps), fill),
        currentWords: countWords(take.text),
        reason: `Runs ${over}s past its ${slot.available}s slot.`,
      });
      continue;
    }

    if (!take.url) {
      refits.push({
        slotId: slot.id,
        text: take.text,
        actualSec: round(actual),
        availableSec: slot.available,
        targetWords: slot.wordBudget,
        currentWords: countWords(take.text),
        reason: "The line has no audio to place.",
      });
      continue;
    }

    placements.push({
      slotId: slot.id,
      sceneIndex: slot.sceneIndex,
      text: take.text,
      url: take.url,
      start: slot.start,
      duration: round(actual),
      slack: round(slot.available - actual),
    });
  }

  placements.sort((a, b) => a.start - b.start);
  return {
    placements,
    refits,
    unusedSlotIds: slots.filter((s) => !used.has(s.id)).map((s) => s.id),
  };
}

// ── The music bed ───────────────────────────────────────────────────────────

function planMusic(trackDuration, filmDuration, opts = {}) {
  const notes = [];
  const gain =
    opts.gain == null ? (opts.hasNarration ? MUSIC_GAIN_WITH_NARRATION : MUSIC_GAIN_ALONE) : opts.gain;
  const fadeIn = opts.fadeIn == null ? MUSIC_FADE_IN : opts.fadeIn;
  const fadeOutWanted = opts.fadeOut == null ? MUSIC_FADE_OUT : opts.fadeOut;
  const maxLoops = opts.maxLoops == null ? 12 : opts.maxLoops;

  if (!(trackDuration > 0) || !(filmDuration > 0)) {
    return { segments: [], gain, loops: 0, trimmed: false, notes: ["No music laid: missing track or film duration."] };
  }

  const fIn = round(Math.min(fadeIn, filmDuration / 3));
  const fOut = round(Math.min(fadeOutWanted, filmDuration / 3));

  if (trackDuration >= filmDuration - 1e-6) {
    return {
      segments: [
        { start: 0, srcIn: 0, srcOut: round(filmDuration), duration: round(filmDuration), fadeIn: fIn, fadeOut: fOut, layer: 0 },
      ],
      gain,
      loops: 1,
      trimmed: trackDuration > filmDuration + 1e-6,
      notes:
        trackDuration > filmDuration + 1e-6
          ? [`Composed track (${round(trackDuration)}s) trimmed to the film's ${round(filmDuration)}s.`]
          : [],
    };
  }

  const crossfade = round(
    Math.max(0, Math.min(opts.crossfade == null ? MUSIC_CROSSFADE : opts.crossfade, trackDuration / 3))
  );
  const advance = trackDuration - crossfade;
  const needed = Math.ceil((filmDuration - crossfade) / advance);
  const loops = Math.min(needed, maxLoops);
  if (loops < needed) {
    notes.push(
      `Film is ${round(filmDuration)}s but the composed track is only ${round(trackDuration)}s; capped at ${maxLoops} repeats, so the last ${round(filmDuration - (crossfade + loops * advance))}s has no bed.`
    );
  }

  const segments = [];
  for (let i = 0; i < loops; i++) {
    const start = round(i * advance);
    if (start >= filmDuration - 1e-6) break;
    const remaining = filmDuration - start;
    const duration = round(Math.min(trackDuration, remaining));
    if (duration <= 1e-6) break;
    const isFirst = i === 0;
    const isLast = start + duration >= filmDuration - 1e-6 || i === loops - 1;
    segments.push({
      start,
      srcIn: 0,
      srcOut: duration,
      duration,
      fadeIn: isFirst ? fIn : crossfade,
      fadeOut: isLast ? fOut : crossfade,
      layer: i % 2,
    });
  }

  if (crossfade === 0 && segments.length > 1) {
    notes.push("Music loops are butt-joined (no crossfade), so the repeat may be audible.");
  }

  return { segments, gain, loops: segments.length, trimmed: false, notes };
}

// ── Plan review ─────────────────────────────────────────────────────────────

function validateAudioPlan(plan) {
  const violations = [];
  const film = plan.film.duration;

  if (film <= 0) {
    violations.push({ kind: "empty", message: "The film has no duration — nothing has rendered yet." });
    return violations;
  }

  const lines = [...plan.narration].sort((a, b) => a.start - b.start);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const end = line.start + line.duration;
    if (line.start < -1e-6 || end > film + 1e-6) {
      violations.push({
        kind: "bounds",
        message: `Narration "${clipText(line.text)}" runs ${round(line.start)}s–${round(end)}s, outside the film's ${round(film)}s.`,
      });
    }
    const next = lines[i + 1];
    if (next && end > next.start + 1e-6) {
      violations.push({
        kind: "overlap",
        message: `Narration "${clipText(line.text)}" overlaps the next line by ${round(end - next.start)}s — two voices at once.`,
      });
    }
  }

  for (const seg of plan.music.segments) {
    if (seg.start + seg.duration > film + 1e-6) {
      violations.push({
        kind: "overrun",
        message: `Music segment at ${round(seg.start)}s runs ${round(seg.start + seg.duration - film)}s past the end of the film.`,
      });
    }
  }

  for (const layer of [0, 1]) {
    const onLayer = plan.music.segments.filter((s) => s.layer === layer).sort((a, b) => a.start - b.start);
    for (let i = 0; i < onLayer.length - 1; i++) {
      const end = onLayer[i].start + onLayer[i].duration;
      if (end > onLayer[i + 1].start + 1e-6) {
        violations.push({
          kind: "overlap",
          message: `Music segments overlap on layer ${layer} at ${round(onLayer[i + 1].start)}s.`,
        });
      }
    }
  }

  return violations;
}

// ── Applying to the document (JSON level) ───────────────────────────────────

function makeTrack(name) {
  return { id: genId("trk"), kind: "audio", name, muted: false, locked: false, volume: 1, clips: [] };
}

/**
 * Build one audio clip. `speed` is always 1 here, so the document's
 * `srcOut - srcIn === duration × speed` invariant reduces to srcIn + duration.
 * Fades are scaled down together if they would outlast the clip, matching the
 * engine's insertClip.
 */
function makeAudioClip({ assetId, start, srcIn, duration, fadeIn = 0, fadeOut = 0, label }) {
  const dur = Math.max(MIN_CLIP_DURATION, round(duration));
  const wantIn = Math.max(0, fadeIn);
  const wantOut = Math.max(0, fadeOut);
  const total = wantIn + wantOut;
  const scale = total > dur && total > 0 ? dur / total : 1;
  return {
    id: genId("clp"),
    assetId,
    start: round(Math.max(0, start)),
    duration: dur,
    srcIn: round(Math.max(0, srcIn)),
    srcOut: round(Math.max(0, srcIn) + dur),
    speed: 1,
    volume: 1,
    muted: false,
    fadeIn: round(wantIn * scale),
    fadeOut: round(wantOut * scale),
    label,
  };
}

function computeDocDuration(doc) {
  let max = 0;
  for (const track of doc.tracks) {
    for (const clip of track.clips) max = Math.max(max, clip.start + clip.duration);
  }
  return round(max);
}

/** Drop the planner's own tracks, so re-scoring replaces instead of stacking. */
function clearPlannerTracks(doc) {
  const owned = new Set([...MUSIC_TRACK_NAMES, NARRATION_TRACK_NAME]);
  const keptAssetIds = new Set();
  doc.tracks = doc.tracks.filter((t) => !(t.kind === "audio" && owned.has(t.name)));
  for (const track of doc.tracks) for (const clip of track.clips) keptAssetIds.add(clip.assetId);
  // Assets nothing references any more would fail no invariant, but they would
  // accumulate a new score URL on every re-run.
  for (const id of Object.keys(doc.assets || {})) {
    if (!keptAssetIds.has(id)) delete doc.assets[id];
  }
}

/**
 * Apply a plan to an editor document, in place. Mirrors applyAudioPlan in the TS
 * twin, minus the engine: same tracks, same clip fields, same idempotence.
 */
function applyAudioPlanToDoc(doc, plan) {
  if (!doc || !Array.isArray(doc.tracks)) throw new Error("Not an editor document");
  doc.assets = doc.assets || {};
  clearPlannerTracks(doc);

  for (const track of doc.tracks) {
    if (track.kind === "video") track.volume = plan.footageGain;
  }

  if (plan.music && plan.music.segments.length > 0 && plan.musicUrl) {
    const assetId = genId("ast");
    doc.assets[assetId] = { id: assetId, kind: "audio", url: plan.musicUrl, label: "Composed score" };
    const layerTracks = new Map();
    for (const seg of plan.music.segments) {
      let track = layerTracks.get(seg.layer);
      if (!track) {
        track = makeTrack(MUSIC_TRACK_NAMES[seg.layer] || `Score ${seg.layer}`);
        track.volume = plan.music.gain;
        doc.tracks.push(track);
        layerTracks.set(seg.layer, track);
      }
      track.clips.push(
        makeAudioClip({
          assetId,
          start: seg.start,
          srcIn: seg.srcIn,
          duration: seg.duration,
          fadeIn: seg.fadeIn,
          fadeOut: seg.fadeOut,
          label: "Score",
        })
      );
    }
  }

  if (plan.narration && plan.narration.length > 0) {
    const track = makeTrack(NARRATION_TRACK_NAME);
    doc.tracks.push(track);
    for (const line of plan.narration) {
      const assetId = genId("ast");
      doc.assets[assetId] = {
        id: assetId,
        kind: "audio",
        url: line.url,
        duration: line.duration,
        label: `VO ${line.sceneIndex + 1}`,
      };
      track.clips.push(
        makeAudioClip({
          assetId,
          start: line.start,
          srcIn: 0,
          duration: line.duration,
          label: clipText(line.text, 40),
        })
      );
    }
  }

  // Keep every track sorted, which the document requires.
  for (const track of doc.tracks) track.clips.sort((a, b) => a.start - b.start);
  doc.duration = computeDocDuration(doc);
  return doc;
}

/**
 * Build a fresh editor document from the rendered clips.
 *
 * Used only when a project has never been opened in the timeline editor and so
 * has no stored document. Deliberately built from the MEASURED clip durations
 * rather than the nominal ten seconds `docFromLegacyProject` assumes — this pass
 * has already probed every clip, and using the real lengths is what keeps the
 * narration in sync with the picture.
 */
function baseDocFromClips(clips, canvas, fps = 30) {
  const videoTrack = {
    id: genId("trk"),
    kind: "video",
    name: "Video 1",
    muted: false,
    locked: false,
    volume: 1,
    clips: [],
  };
  const doc = {
    version: 1,
    fps,
    width: canvas.width,
    height: canvas.height,
    duration: 0,
    tracks: [videoTrack, { ...makeTrack("Audio 1"), volume: 1 }],
    assets: {},
  };

  let cursor = 0;
  for (const clip of clips) {
    const duration = round(clip.duration);
    if (!(duration > 0)) continue;
    const assetId = genId("ast");
    doc.assets[assetId] = {
      id: assetId,
      kind: "video",
      url: clip.url,
      duration,
      label: `Scene ${clip.sceneIndex + 1}`,
      sceneIndex: clip.sceneIndex,
    };
    videoTrack.clips.push({
      id: genId("clp"),
      assetId,
      start: round(cursor),
      duration,
      srcIn: 0,
      srcOut: duration,
      speed: 1,
      volume: 1,
      muted: false,
      fadeIn: 0,
      fadeOut: 0,
      transform: { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 },
      label: `Scene ${clip.sceneIndex + 1}`,
    });
    cursor += duration;
  }

  doc.duration = computeDocDuration(doc);
  return doc;
}

function hasPlannedAudio(doc) {
  const owned = new Set([...MUSIC_TRACK_NAMES, NARRATION_TRACK_NAME]);
  return (doc.tracks || []).some((t) => t.kind === "audio" && owned.has(t.name) && t.clips.length > 0);
}

module.exports = {
  filmTimeMap,
  narrationSlots,
  planNarration,
  planMusic,
  validateAudioPlan,
  applyAudioPlanToDoc,
  clearPlannerTracks,
  baseDocFromClips,
  hasPlannedAudio,
  computeDocDuration,
  wordBudget,
  estimateSpeechDuration,
  countWords,
  SPEECH_WPS,
  SLOT_FILL,
  MIN_SLOT,
  HEAD_ROOM,
  MUSIC_GAIN_WITH_NARRATION,
  MUSIC_GAIN_ALONE,
  MUSIC_FADE_IN,
  MUSIC_FADE_OUT,
  MUSIC_CROSSFADE,
  MUSIC_TRACK_NAMES,
  NARRATION_TRACK_NAME,
};
