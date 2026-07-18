/**
 * Optiq Editor Engine — playback scheduling (pure core).
 *
 * Given an EditorDoc and a playhead time, computes the DESIRED playback state:
 * which clip each video track shows and where its source is seeked, plus every
 * audible audio voice with its effective gain (track × clip × fades). The DOM
 * adapter in player.ts reconciles real <video>/WebAudio nodes to this — it owns
 * no timing logic, so everything here is deterministic and unit-tested.
 *
 * Timeline time and source time are both in SECONDS. sourceTime advances by
 * `speed` per timeline second: srcIn + (t - start) * speed.
 */

import { Clip, ClipTransform, DEFAULT_TRANSFORM, EditorDoc, Track, clipEnd } from "./types";

export type LayerMode = "base" | "overlay";

export interface VideoLayerState {
  trackId: string;
  /** Stacking order; 0 = bottom (base). */
  z: number;
  mode: LayerMode;
  /** Active clip at the playhead, or null when the track shows nothing. */
  clipId: string | null;
  assetId?: string;
  url?: string;
  isImage: boolean;
  /** Where the underlying media element should be, seconds. */
  sourceTime: number;
  speed: number;
  transform: ClipTransform;
  /** The clip that follows on this track — a hint for prerolling. */
  next?: { clipId: string; assetId: string; url: string; startsAt: number; sourceIn: number };
}

export interface AudioVoiceState {
  trackId: string;
  clipId: string;
  assetId: string;
  url: string;
  sourceTime: number;
  /** Effective linear gain, incl. track/clip volume and fades. */
  gain: number;
  speed: number;
}

export interface PlaybackFrame {
  time: number;
  duration: number;
  playing: boolean;
  /** One entry per video track, bottom→top. */
  video: VideoLayerState[];
  /** Every audible voice at this instant. */
  audio: AudioVoiceState[];
}

/** The clip covering `time` on a track (start ≤ time < end), or null. */
export function clipAt(track: Track, time: number): Clip | null {
  for (const clip of track.clips) {
    if (time >= clip.start - 1e-9 && time < clipEnd(clip) - 1e-9) return clip;
  }
  return null;
}

/** The first clip that starts at/after `time` on a track (preroll target). */
export function nextClip(track: Track, time: number): Clip | null {
  let best: Clip | null = null;
  for (const clip of track.clips) {
    if (clip.start >= time - 1e-9) {
      if (!best || clip.start < best.start) best = clip;
    }
  }
  return best;
}

/** Map a timeline time inside a clip to its source-media time. */
export function sourceTimeAt(clip: Clip, time: number, isImage: boolean): number {
  if (isImage) return clip.srcIn;
  return clip.srcIn + (time - clip.start) * clip.speed;
}

/**
 * Fade multiplier (0..1) at `time` within a clip from its fadeIn/fadeOut.
 * Linear ramps; overlapping ramps on a very short clip multiply.
 */
export function fadeGainAt(clip: Clip, time: number): number {
  let g = 1;
  const into = time - clip.start;
  const end = clipEnd(clip);
  const remaining = end - time;
  if (clip.fadeIn > 0 && into < clip.fadeIn) g *= clamp01(into / clip.fadeIn);
  if (clip.fadeOut > 0 && remaining < clip.fadeOut) g *= clamp01(remaining / clip.fadeOut);
  return clamp01(g);
}

/** Effective linear gain of a clip on a track at `time` (0 when inaudible). */
export function effectiveGain(track: Track, clip: Clip, time: number): number {
  if (track.muted || clip.muted) return 0;
  return track.volume * clip.volume * fadeGainAt(clip, time);
}

/**
 * Compute the desired playback state at `time`. Pure — no side effects.
 * Video tracks are emitted bottom→top so the adapter can stack them directly.
 */
export function scheduleFrame(doc: EditorDoc, time: number, playing: boolean): PlaybackFrame {
  const clampedTime = Math.max(0, Math.min(time, doc.duration));
  const video: VideoLayerState[] = [];
  const audio: AudioVoiceState[] = [];

  let z = 0;
  for (const track of doc.tracks) {
    if (track.kind === "video") {
      const mode: LayerMode = z === 0 ? "base" : "overlay";
      const clip = clipAt(track, clampedTime);
      const asset = clip ? doc.assets[clip.assetId] : undefined;
      const isImage = asset?.kind === "image";
      const upcoming = nextClip(track, clampedTime);
      const upcomingAsset = upcoming ? doc.assets[upcoming.assetId] : undefined;

      video.push({
        trackId: track.id,
        z,
        mode,
        clipId: clip ? clip.id : null,
        assetId: clip?.assetId,
        url: asset?.url,
        isImage: !!isImage,
        sourceTime: clip ? sourceTimeAt(clip, clampedTime, !!isImage) : 0,
        speed: clip?.speed ?? 1,
        transform: clip?.transform ?? { ...DEFAULT_TRANSFORM },
        next:
          upcoming && upcomingAsset
            ? {
                clipId: upcoming.id,
                assetId: upcoming.assetId,
                url: upcomingAsset.url,
                startsAt: upcoming.start,
                sourceIn: upcoming.srcIn,
              }
            : undefined,
      });
      z++;
    }

    // Audio comes from audio tracks AND the embedded audio of video clips.
    for (const clip of track.clips) {
      const asset = doc.assets[clip.assetId];
      if (asset.kind === "image") continue;
      if (!(clampedTime >= clip.start - 1e-9 && clampedTime < clipEnd(clip) - 1e-9)) continue;
      const gain = effectiveGain(track, clip, clampedTime);
      if (gain <= 1e-4) continue;
      audio.push({
        trackId: track.id,
        clipId: clip.id,
        assetId: clip.assetId,
        url: asset.url,
        sourceTime: sourceTimeAt(clip, clampedTime, false),
        gain: round3(gain),
        speed: clip.speed,
      });
    }
  }

  return { time: clampedTime, duration: doc.duration, playing, video, audio };
}

/**
 * Whether a media element at `actual` source time is far enough from `expected`
 * to warrant a corrective seek (avoids fighting normal playback drift).
 */
export function needsResync(actual: number, expected: number, threshold = 0.25): boolean {
  return Math.abs(actual - expected) > threshold;
}

// ── Transport controller ────────────────────────────────────────────────────

export interface ControllerOptions {
  loop?: boolean;
  /** Wall-clock source in ms; injectable for tests. Defaults to performance.now. */
  now?: () => number;
}

/**
 * Headless transport: owns the playhead, play/pause/seek, and advances time by
 * real elapsed wall-clock on each `tick()`. Emits a scheduled PlaybackFrame to
 * subscribers. No DOM — the adapter calls `tick(now)` from requestAnimationFrame
 * and renders the frames.
 */
export class PlaybackController {
  private doc: EditorDoc;
  private time = 0;
  private playing = false;
  private loop: boolean;
  private lastTickMs: number | null = null;
  private now: () => number;
  private listeners = new Set<(frame: PlaybackFrame) => void>();

  constructor(doc: EditorDoc, opts: ControllerOptions = {}) {
    this.doc = doc;
    this.loop = opts.loop ?? false;
    this.now =
      opts.now ??
      (typeof performance !== "undefined" ? () => performance.now() : () => Date.now());
  }

  setDoc(doc: EditorDoc): void {
    this.doc = doc;
    if (this.time > doc.duration) this.time = doc.duration;
    this.emit();
  }

  getTime(): number {
    return this.time;
  }

  isPlaying(): boolean {
    return this.playing;
  }

  setLoop(loop: boolean): void {
    this.loop = loop;
  }

  subscribe(fn: (frame: PlaybackFrame) => void): () => void {
    this.listeners.add(fn);
    fn(this.frame());
    return () => this.listeners.delete(fn);
  }

  play(): void {
    if (this.doc.duration <= 0) return;
    if (this.time >= this.doc.duration - 1e-6) this.time = 0; // replay from top
    this.playing = true;
    this.lastTickMs = null;
    this.emit();
  }

  pause(): void {
    this.playing = false;
    this.lastTickMs = null;
    this.emit();
  }

  toggle(): void {
    this.playing ? this.pause() : this.play();
  }

  seek(time: number): void {
    this.time = Math.max(0, Math.min(time, this.doc.duration));
    this.lastTickMs = null;
    this.emit();
  }

  /** Advance the playhead using elapsed wall-clock since the previous tick. */
  tick(nowMs: number = this.now()): void {
    if (!this.playing) {
      this.lastTickMs = null;
      return;
    }
    if (this.lastTickMs === null) {
      this.lastTickMs = nowMs;
      return;
    }
    const dt = Math.max(0, (nowMs - this.lastTickMs) / 1000);
    this.lastTickMs = nowMs;
    this.time += dt;
    if (this.time >= this.doc.duration) {
      if (this.loop && this.doc.duration > 0) {
        this.time = this.time % this.doc.duration;
      } else {
        this.time = this.doc.duration;
        this.playing = false;
        this.lastTickMs = null;
      }
    }
    this.emit();
  }

  frame(): PlaybackFrame {
    return scheduleFrame(this.doc, this.time, this.playing);
  }

  private emit(): void {
    const f = this.frame();
    for (const fn of this.listeners) fn(f);
  }
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function round3(v: number): number {
  return Math.round(v * 1000) / 1000;
}
