/**
 * Optiq Editor Engine — audio post-production planner.
 *
 * Pure, framework-free timing math. Nothing here calls Vertex, ffmpeg, Firebase
 * or the DOM; the orchestrator (functions/audioPost.js) does the I/O and asks
 * this module every question that has a right answer.
 *
 * WHY THIS IS A SEPARATE, PURE MODULE
 *
 * The film is scored and narrated AFTER it is cut: the video model generates no
 * music (see functions/optiqSkills/soundPolicy.js), Lyria 3 Pro composes the
 * score against the finished cut, and narrated films get a TTS voiceover laid
 * over the top. All of that is arithmetic — where a line starts, how long it may
 * run, how many words fit in the gap, where a track has to be cut and looped —
 * and arithmetic is exactly the part that must be testable without spending a
 * cent of Vertex quota.
 *
 * THE ONE HARD CONSTRAINT
 *
 * You cannot ask a TTS model for "4.2 seconds of speech". You give it words and
 * it gives you however long that took. So the flow is necessarily a LOOP:
 * estimate a word budget from the slot → synthesize → measure what actually came
 * back → if it overran, compute a tighter budget and rewrite. `planNarration`
 * and `refitRequests` are the two halves of that loop, and `SPEECH_WPS` is the
 * estimate that makes the first pass usually right.
 *
 * All times are SECONDS (floats), matching the rest of the engine.
 */

import { EditorDoc, Track, genId } from "./types";
import { EditorEngine } from "./engine";

// ── Tunables ────────────────────────────────────────────────────────────────

/**
 * Words per second of natural narration.
 *
 * ~155 words/minute is the measured rate for unhurried advertising narration,
 * which is 2.58 wps. Used only to pick the FIRST word budget; every line is
 * re-measured from the synthesized audio afterwards, so an imperfect estimate
 * costs a refit pass, never a wrong timeline.
 */
export const SPEECH_WPS = 2.58;

/**
 * Fraction of a slot a line is allowed to fill when budgeting words.
 *
 * Deliberately short of 1: speech that exactly fills its gap sounds rushed and
 * clips the visual beat it was cut to, and TTS length varies run to run.
 */
export const SLOT_FILL = 0.9;

/** Minimum speakable slot. Below this there is no line worth writing. */
export const MIN_SLOT = 1.2;

/** Silence held at the very start and end of the film, so nothing feels clipped. */
export const HEAD_ROOM = 0.15;

/**
 * Default music bed gain, by whether narration is competing with it.
 *
 * Doubled from 0.16 / 0.3 on the director's note that finished films play too
 * quietly everywhere — on the timeline, in the export and on a phone. The ratio
 * between the two is unchanged, so a narrated film still ducks its bed under the
 * voice by the same amount; both ends just moved up together.
 *
 * These pair with the footage gain in functions/audioPost.js, which went 1 → 3 in
 * the same change. Music is deliberately the smaller multiple: the dialogue and
 * the diegetic sound are the film, and a score that keeps pace with a tripled
 * footage track would bury them.
 */
export const MUSIC_GAIN_WITH_NARRATION = 0.32;
export const MUSIC_GAIN_ALONE = 0.6;

/** Music bed fades. */
export const MUSIC_FADE_IN = 1.2;
export const MUSIC_FADE_OUT = 2;

/** Crossfade between looped music segments, so a repeat doesn't click or dip. */
export const MUSIC_CROSSFADE = 1.5;

// ── The film's time map ─────────────────────────────────────────────────────

export interface SceneSpan {
  sceneIndex: number;
  start: number;
  end: number;
  duration: number;
}

export interface FilmMap {
  scenes: SceneSpan[];
  duration: number;
}

/**
 * Lay the rendered clips end to end and record where each scene lives.
 *
 * This is the film's coordinate system: everything downstream — where a line of
 * narration starts, where the music has to end — is expressed against it. Scenes
 * that never rendered contribute nothing and are skipped rather than assumed to
 * be ten seconds long, because a missing clip must not shift every later line.
 */
export function filmTimeMap(sceneDurations: (number | null | undefined)[]): FilmMap {
  const scenes: SceneSpan[] = [];
  let cursor = 0;
  sceneDurations.forEach((raw, sceneIndex) => {
    const duration = typeof raw === "number" && Number.isFinite(raw) && raw > 0 ? raw : 0;
    if (duration <= 0) return;
    scenes.push({ sceneIndex, start: round(cursor), end: round(cursor + duration), duration: round(duration) });
    cursor += duration;
  });
  return { scenes, duration: round(cursor) };
}

// ── Narration slots ─────────────────────────────────────────────────────────

/** A window the film-scanner judged speakable, in the scene's own time. */
export interface ScannedWindow {
  sceneIndex: number;
  /** Seconds from the START OF THAT SCENE. */
  startInScene: number;
  endInScene: number;
  /** What the picture is doing here — carried through so the writer has context. */
  note?: string;
}

/** A concrete, film-absolute window with a hard duration ceiling. */
export interface NarrationSlot {
  id: string;
  sceneIndex: number;
  start: number;
  end: number;
  /** end - start. The ceiling a line's audio must not exceed. */
  available: number;
  /** Words that should fit, at SPEECH_WPS × SLOT_FILL. */
  wordBudget: number;
  note?: string;
}

/**
 * Turn the scanner's per-scene windows into absolute, non-overlapping slots.
 *
 * Three things happen here, and each of them is a bug that would otherwise reach
 * the timeline: windows are clamped into their scene (a model asked for 0–12s of
 * a 10s scene), clipped out of the film's head and tail room, and — the one that
 * actually matters — sorted and de-overlapped, because two lines talking over
 * each other is the single worst failure this pipeline can ship.
 */
export function narrationSlots(
  map: FilmMap,
  windows: ScannedWindow[],
  opts: { minSlot?: number; headRoom?: number; wps?: number; fill?: number } = {}
): NarrationSlot[] {
  const minSlot = opts.minSlot ?? MIN_SLOT;
  const headRoom = opts.headRoom ?? HEAD_ROOM;
  const wps = opts.wps ?? SPEECH_WPS;
  const fill = opts.fill ?? SLOT_FILL;

  const byIndex = new Map(map.scenes.map((s) => [s.sceneIndex, s]));
  const candidates: NarrationSlot[] = [];

  for (const win of windows ?? []) {
    const scene = byIndex.get(win.sceneIndex);
    if (!scene) continue; // a window for a scene that never rendered
    const rawStart = Number(win.startInScene);
    const rawEnd = Number(win.endInScene);
    if (!Number.isFinite(rawStart) || !Number.isFinite(rawEnd)) continue;

    // Clamp into the scene, then into the film's usable span.
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

  // De-overlap: earlier slot wins, later one is pushed. A slot squeezed below
  // the floor is dropped rather than kept as a sliver nothing can be said in.
  candidates.sort((a, b) => a.start - b.start || a.end - b.end);
  const slots: NarrationSlot[] = [];
  let guard = 0;
  for (const slot of candidates) {
    const start = Math.max(slot.start, guard);
    if (slot.end - start < minSlot) continue;
    const fixed: NarrationSlot = {
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

/** How many words comfortably fit in `seconds` of narration. */
export function wordBudget(seconds: number, wps = SPEECH_WPS, fill = SLOT_FILL): number {
  return Math.max(1, Math.floor(Math.max(0, seconds) * fill * wps));
}

/** Rough duration of a line before it is synthesized. */
export function estimateSpeechDuration(text: string, wps = SPEECH_WPS): number {
  const words = countWords(text);
  return words === 0 ? 0 : round(words / wps);
}

export function countWords(text: string): number {
  return String(text ?? "").trim().split(/\s+/).filter(Boolean).length;
}

// ── Placing measured narration ──────────────────────────────────────────────

/** A written line, once its audio exists and has been measured. */
export interface NarrationTake {
  slotId: string;
  text: string;
  /** Where the audio lives. Absent while the line is still being written. */
  url?: string;
  /** MEASURED duration of the synthesized audio. */
  durationSec: number;
}

export interface NarrationPlacement {
  slotId: string;
  sceneIndex: number;
  text: string;
  url: string;
  start: number;
  duration: number;
  /** Slack left in the slot. Negative would be an overrun — never emitted. */
  slack: number;
}

export interface RefitRequest {
  slotId: string;
  text: string;
  /** What it measured. */
  actualSec: number;
  /** What it may not exceed. */
  availableSec: number;
  /** Words it must be cut to for the next attempt. */
  targetWords: number;
  currentWords: number;
  reason: string;
}

export interface NarrationPlan {
  placements: NarrationPlacement[];
  refits: RefitRequest[];
  /** Slots no line was written for. Not an error — silence is allowed. */
  unusedSlotIds: string[];
}

/**
 * Fit measured takes into their slots.
 *
 * A take that fits is placed at the START of its slot, not centred: the slot was
 * chosen to sit against a visual beat, and drifting the line later to centre it
 * in the gap breaks the sync the scan was for.
 *
 * A take that overran does NOT get placed and does NOT get truncated — truncated
 * narration ends mid-word, which is worse than none. It comes back as a
 * `RefitRequest` carrying the word count it has to hit, and the orchestrator
 * rewrites and re-synthesizes that one line. This is the loop the whole module
 * exists for.
 */
export function planNarration(
  slots: NarrationSlot[],
  takes: NarrationTake[],
  opts: { wps?: number; fill?: number } = {}
): NarrationPlan {
  const wps = opts.wps ?? SPEECH_WPS;
  const fill = opts.fill ?? SLOT_FILL;
  const bySlot = new Map(slots.map((s) => [s.id, s]));
  const placements: NarrationPlacement[] = [];
  const refits: RefitRequest[] = [];
  const used = new Set<string>();

  for (const take of takes ?? []) {
    const slot = bySlot.get(take.slotId);
    if (!slot) continue; // a take for a slot that no longer exists
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
        // Budget against the measured rate of THIS take, not the generic
        // estimate — a voice that reads slowly needs a harder cut than
        // SPEECH_WPS would suggest, and guessing again wastes a whole pass.
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

/** The rate this take actually read at, for a smarter second budget. */
function measuredWps(take: NarrationTake, fallback: number): number {
  const words = countWords(take.text);
  if (words === 0 || !(take.durationSec > 0)) return fallback;
  return words / take.durationSec;
}

// ── The music bed ───────────────────────────────────────────────────────────

export interface MusicSegment {
  /** Timeline position. */
  start: number;
  /** Source in/out of the composed track. */
  srcIn: number;
  srcOut: number;
  duration: number;
  fadeIn: number;
  fadeOut: number;
  /**
   * Which of the two music layers this rides on. Looped segments alternate so
   * consecutive repeats can OVERLAP for a crossfade — a single track forbids
   * overlaps (see validateDoc), and butt-joining loops is audible as a dip.
   */
  layer: 0 | 1;
  /**
   * Which composed track this segment plays FROM.
   *
   * Absent for an ordinary single-track score, where every segment is a repeat of
   * `plan.musicUrl`. Present only in a SUITE (see planMusicSuite), where the film
   * is scored by several different pieces laid end to end and each segment names
   * its own. The apply step falls back to `plan.musicUrl` when it is missing, so
   * every existing plan keeps working untouched.
   */
  url?: string;
}

export interface MusicPlan {
  segments: MusicSegment[];
  gain: number;
  /** How many times the composed track is repeated. 1 = no looping. */
  loops: number;
  /** True when the track was longer than the film and got cut short. */
  trimmed: boolean;
  /** Non-fatal notes worth surfacing to the director. */
  notes: string[];
}

/**
 * Cut a composed track to the film.
 *
 * Lyria 3 returns whatever length it feels like — 64s and 114s have both been
 * measured from the same prompt — and there is no length parameter to ask with.
 * So the track is either cut down or looped up to the film's exact duration,
 * which is the whole reason this function exists rather than "just set the clip
 * to the film length".
 */
export function planMusic(
  trackDuration: number,
  filmDuration: number,
  opts: {
    hasNarration?: boolean;
    gain?: number;
    fadeIn?: number;
    fadeOut?: number;
    crossfade?: number;
    maxLoops?: number;
  } = {}
): MusicPlan {
  const notes: string[] = [];
  const gain = opts.gain ?? (opts.hasNarration ? MUSIC_GAIN_WITH_NARRATION : MUSIC_GAIN_ALONE);
  const fadeIn = opts.fadeIn ?? MUSIC_FADE_IN;
  const fadeOutWanted = opts.fadeOut ?? MUSIC_FADE_OUT;
  const maxLoops = opts.maxLoops ?? 12;

  if (!(trackDuration > 0) || !(filmDuration > 0)) {
    return { segments: [], gain, loops: 0, trimmed: false, notes: ["No music laid: missing track or film duration."] };
  }

  // Fades can't be longer than what they're fading.
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
      notes: trackDuration > filmDuration + 1e-6
        ? [`Composed track (${round(trackDuration)}s) trimmed to the film's ${round(filmDuration)}s.`]
        : [],
    };
  }

  // Shorter than the film: repeat it, overlapping each repeat by the crossfade
  // so the seam is inaudible. The crossfade cannot exceed the track itself.
  const crossfade = round(Math.max(0, Math.min(opts.crossfade ?? MUSIC_CROSSFADE, trackDuration / 3)));
  const advance = trackDuration - crossfade; // how far each repeat moves the cursor
  const needed = Math.ceil((filmDuration - crossfade) / advance);
  const loops = Math.min(needed, maxLoops);
  if (loops < needed) {
    notes.push(
      `Film is ${round(filmDuration)}s but the composed track is only ${round(trackDuration)}s; capped at ${maxLoops} repeats, so the last ${round(filmDuration - (crossfade + loops * advance))}s has no bed.`
    );
  }

  const segments: MusicSegment[] = [];
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
      // First segment fades the film in; every later one fades up over its
      // predecessor's tail. Symmetrically on the way out.
      fadeIn: isFirst ? fIn : crossfade,
      fadeOut: isLast ? fOut : crossfade,
      layer: (i % 2) as 0 | 1,
    });
  }

  if (crossfade === 0 && segments.length > 1) {
    notes.push("Music loops are butt-joined (no crossfade), so the repeat may be audible.");
  }

  return { segments, gain, loops: segments.length, trimmed: false, notes };
}

/** One composed piece in a suite: where its audio lives and how long it runs. */
export interface SuiteTrack {
  url: string;
  duration: number;
}

/**
 * Score a long film with SEVERAL different composed pieces, laid end to end.
 *
 * `planMusic` loops ONE track. That is right for a 30-second ad and wrong for a
 * five-minute film: the same 60 seconds repeated five times is not a score, it is
 * a ringtone, and by the third repeat it is the most noticeable thing in the film.
 *
 * So a long film is scored as a SUITE. Each piece is composed separately, for the
 * stretch of story it sits under, and they are laid in order with a crossfade at
 * every seam. What the audience hears is music that develops.
 *
 * The mechanics are deliberately the same as the loop's, because the constraint
 * is the same: two segments on ONE track may never overlap (validateDoc forbids
 * it), so consecutive pieces alternate between layers 0 and 1 and their crossfade
 * is a real overlap rather than a butt-join.
 *
 * Tracks are used IN ORDER and each one plays once. If the suite is shorter than
 * the film, the LAST piece repeats to cover the tail rather than leaving silence
 * under the ending — the ending is the worst possible place to run out of score.
 * If it is longer, the last piece needed is trimmed and the rest go unused.
 */
export function planMusicSuite(
  tracks: SuiteTrack[],
  filmDuration: number,
  opts: {
    hasNarration?: boolean;
    gain?: number;
    fadeIn?: number;
    fadeOut?: number;
    crossfade?: number;
  } = {}
): MusicPlan {
  const notes: string[] = [];
  const gain = opts.gain ?? (opts.hasNarration ? MUSIC_GAIN_WITH_NARRATION : MUSIC_GAIN_ALONE);
  const usable = (tracks || []).filter((t) => t && t.url && t.duration > 0);

  if (usable.length === 0 || !(filmDuration > 0)) {
    return { segments: [], gain, loops: 0, trimmed: false, notes: ["No score was laid: no usable composed tracks."] };
  }
  // One piece is not a suite. Hand it to the loop planner, which already knows
  // how to stretch a single track across a film, rather than reimplementing it.
  if (usable.length === 1) {
    const single = planMusic(usable[0].duration, filmDuration, opts);
    return { ...single, segments: single.segments.map((s) => ({ ...s, url: usable[0].url })) };
  }

  const fIn = round(Math.min(opts.fadeIn ?? MUSIC_FADE_IN, filmDuration / 3));
  const fOut = round(Math.min(opts.fadeOut ?? MUSIC_FADE_OUT, filmDuration / 3));

  const segments: MusicSegment[] = [];
  let cursor = 0;
  let index = 0;
  let trimmed = false;

  // Hard ceiling on how many pieces may be laid. The loop below always advances
  // the cursor (every piece contributes at least `advance` seconds, and a piece
  // shorter than the crossfade is skipped), but a film long enough to need
  // hundreds of segments is a bug upstream, not a score.
  const MAX_SEGMENTS = 64;

  while (cursor < filmDuration - 1e-6 && segments.length < MAX_SEGMENTS) {
    // Walk the suite in order; once it is exhausted, hold on the last piece so
    // the film never runs out of score before it runs out of picture.
    const track = usable[Math.min(index, usable.length - 1)];
    const crossfade = round(Math.max(0, Math.min(opts.crossfade ?? MUSIC_CROSSFADE, track.duration / 3)));
    const remaining = filmDuration - cursor;
    const duration = round(Math.min(track.duration, remaining));
    if (duration <= 1e-6) break;

    const isFirst = segments.length === 0;
    const isLast = cursor + duration >= filmDuration - 1e-6;
    if (duration < track.duration - 1e-6) trimmed = true;

    segments.push({
      start: round(cursor),
      srcIn: 0,
      srcOut: duration,
      duration,
      // The first piece fades the film in; every later one fades up over its
      // predecessor's tail. Symmetrically on the way out.
      fadeIn: isFirst ? fIn : crossfade,
      fadeOut: isLast ? fOut : crossfade,
      layer: (segments.length % 2) as 0 | 1,
      url: track.url,
    });

    if (isLast) break;
    // Overlap the next piece onto this one's tail by the crossfade, which is what
    // makes the seam inaudible — and what forces the alternating layers.
    cursor += duration - crossfade;
    index += 1;
  }

  const used = new Set(segments.map((s) => s.url)).size;
  if (used < usable.length) {
    notes.push(
      `The film is ${round(filmDuration)}s and only needed ${used} of the ${usable.length} composed pieces.`
    );
  }
  if (index >= usable.length) {
    // Deliberately not "carries the final Ns": computing that needs the start of
    // the last DISTINCT piece, which is an easy thing to get subtly wrong, and it
    // has to be word-for-word identical to the CommonJS twin — see
    // scripts/test-audio-parity.ts, which caught exactly that.
    notes.push(`The suite (${usable.length} pieces) was shorter than the film, so the last piece carries the tail.`);
  }

  return { segments, gain, loops: segments.length, trimmed, notes };
}

// ── The whole plan ──────────────────────────────────────────────────────────

export interface AudioPlan {
  film: FilmMap;
  narration: NarrationPlacement[];
  music: MusicPlan;
  /** Gain applied to the footage's own audio (dialogue). 0 for silent films. */
  footageGain: number;
  musicUrl?: string;
}

export interface PlanViolation {
  kind: "overlap" | "overrun" | "bounds" | "empty";
  message: string;
}

/**
 * Read the finished plan back and look for what would be wrong on screen.
 *
 * This is the self-review pass: the planner is careful, but the plan is
 * assembled from model output across several passes, and the four things checked
 * here are the four a viewer would actually notice.
 */
export function validateAudioPlan(plan: AudioPlan): PlanViolation[] {
  const violations: PlanViolation[] = [];
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
        message: `Narration "${clip(line.text)}" runs ${round(line.start)}s–${round(end)}s, outside the film's ${round(film)}s.`,
      });
    }
    const next = lines[i + 1];
    if (next && end > next.start + 1e-6) {
      violations.push({
        kind: "overlap",
        message: `Narration "${clip(line.text)}" overlaps the next line by ${round(end - next.start)}s — two voices at once.`,
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

  // Two segments on the SAME layer may never overlap — the document forbids it.
  for (const layer of [0, 1] as const) {
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

// ── Writing it onto the timeline ────────────────────────────────────────────

/** Track names the planner owns. Re-running replaces them rather than stacking. */
export const MUSIC_TRACK_NAMES = ["Score", "Score B"] as const;
export const NARRATION_TRACK_NAME = "Voiceover";

/**
 * Apply the plan to a real editor document.
 *
 * Idempotent by design: the planner's own tracks are cleared first, so
 * re-running after a re-score doesn't stack three copies of the music. The
 * director's own audio tracks are never touched.
 *
 * The footage's gain is set on the video tracks, which is how a narrated film
 * gets a silent picture and a dialogue film keeps its voices — rather than the
 * legacy compile path's approach of muting the video's audio unconditionally.
 */
export function applyAudioPlan(engine: EditorEngine, plan: AudioPlan): void {
  clearPlannerTracks(engine);

  // Footage gain: the video tracks carry the dialogue.
  for (const track of engine.getDoc().tracks) {
    if (track.kind === "video") engine.setTrackProps(track.id, { volume: plan.footageGain });
  }

  if (plan.music.segments.length > 0 && (plan.musicUrl || plan.music.segments.some((s) => s.url))) {
    // One asset per distinct source. A looped single-track score has exactly one
    // and behaves as it always did; a SUITE has several, and each segment names
    // the piece it plays from.
    const assetsByUrl = new Map<string, string>();
    const assetFor = (url: string) => {
      let id = assetsByUrl.get(url);
      if (!id) {
        id = engine.addAsset({ id: genId("ast"), kind: "audio", url, label: "Composed score" });
        assetsByUrl.set(url, id);
      }
      return id;
    };
    const layerTracks = new Map<number, string>();
    for (const seg of plan.music.segments) {
      const url = seg.url || plan.musicUrl;
      if (!url) continue;
      let trackId = layerTracks.get(seg.layer);
      if (!trackId) {
        trackId = engine.addTrack("audio", MUSIC_TRACK_NAMES[seg.layer] ?? `Score ${seg.layer}`);
        engine.setTrackProps(trackId, { volume: plan.music.gain });
        layerTracks.set(seg.layer, trackId);
      }
      engine.insertClip(trackId, {
        assetId: assetFor(url),
        start: seg.start,
        srcIn: seg.srcIn,
        duration: seg.duration,
        fadeIn: seg.fadeIn,
        fadeOut: seg.fadeOut,
        label: "Score",
      });
    }
  }

  if (plan.narration.length > 0) {
    const trackId = engine.addTrack("audio", NARRATION_TRACK_NAME);
    for (const line of plan.narration) {
      const assetId = engine.addAsset({
        id: genId("ast"),
        kind: "audio",
        url: line.url,
        duration: line.duration,
        label: `VO ${line.sceneIndex + 1}`,
      });
      engine.insertClip(trackId, {
        assetId,
        start: line.start,
        srcIn: 0,
        duration: line.duration,
        label: clip(line.text, 40),
      });
    }
  }
}

/** Remove the tracks this planner owns, so applying twice is safe. */
export function clearPlannerTracks(engine: EditorEngine): void {
  const owned = new Set<string>([...MUSIC_TRACK_NAMES, NARRATION_TRACK_NAME]);
  const doomed = engine
    .getDoc()
    .tracks.filter((t: Track) => t.kind === "audio" && owned.has(t.name))
    .map((t) => t.id);
  for (const id of doomed) engine.removeTrack(id);
}

/** True when the document already carries planner-owned audio. */
export function hasPlannedAudio(doc: EditorDoc): boolean {
  const owned = new Set<string>([...MUSIC_TRACK_NAMES, NARRATION_TRACK_NAME]);
  return doc.tracks.some((t) => t.kind === "audio" && owned.has(t.name) && t.clips.length > 0);
}

// ── helpers ─────────────────────────────────────────────────────────────────

function round(v: number): number {
  return Math.round(v * 1e6) / 1e6;
}

function clip(text: string, max = 60): string {
  const s = String(text ?? "").trim();
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}
