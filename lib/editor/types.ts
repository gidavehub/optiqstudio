/**
 * Optiq Editor Engine — core document model.
 *
 * Headless, framework-agnostic. Nothing in this module may import React,
 * Next.js, Firebase, or the DOM. The document is plain serializable data;
 * every mutation goes through the command layer in `engine.ts`.
 *
 * Units: all times are SECONDS (floats). Frame quantization happens only at
 * render/export time using `doc.fps`.
 */

export type TrackKind = "video" | "audio";

export type AssetKind = "video" | "audio" | "image";

/** A media source referenced by clips. URLs are remote (Firebase Storage / CDN). */
export interface AssetRef {
  id: string;
  kind: AssetKind;
  url: string;
  /** Intrinsic duration in seconds. Undefined for still images. */
  duration?: number;
  width?: number;
  height?: number;
  label?: string;
}

/** Normalized visual transform for video/image clips. */
export interface ClipTransform {
  /** Horizontal offset, fraction of canvas width. 0 = centered. */
  x: number;
  /** Vertical offset, fraction of canvas height. 0 = centered. */
  y: number;
  /** 1 = fit canvas (contain). */
  scale: number;
  /** Degrees, clockwise. */
  rotation: number;
  /** 0..1 */
  opacity: number;
}

export interface Clip {
  id: string;
  assetId: string;
  /** Timeline position of the clip's left edge, seconds. */
  start: number;
  /** Timeline duration, seconds (already divided by `speed`). */
  duration: number;
  /** Source-media in point, seconds. */
  srcIn: number;
  /** Source-media out point, seconds. Invariant: srcOut - srcIn === duration * speed (video/audio). */
  srcOut: number;
  /** Playback rate. 1 = normal. */
  speed: number;
  /** Audio gain 0..2 (1 = unity). Ignored for image clips. */
  volume: number;
  muted: boolean;
  /** Audio fade in/out, seconds. */
  fadeIn: number;
  fadeOut: number;
  /** Video/image only. */
  transform?: ClipTransform;
  label?: string;
}

export interface Track {
  id: string;
  kind: TrackKind;
  name: string;
  muted: boolean;
  locked: boolean;
  /** Track-level gain multiplier, 0..2. */
  volume: number;
  /** Sorted by `start`, never overlapping. */
  clips: Clip[];
}

export interface EditorDoc {
  version: 1;
  fps: number;
  width: number;
  height: number;
  /** Derived: max clip end across all tracks. Kept in sync by the engine. */
  duration: number;
  /** Render order: index 0 is the base (bottom) layer, later video tracks overlay it. */
  tracks: Track[];
  assets: Record<string, AssetRef>;
}

export const MIN_CLIP_DURATION = 0.05;

export const DEFAULT_TRANSFORM: ClipTransform = {
  x: 0,
  y: 0,
  scale: 1,
  rotation: 0,
  opacity: 1,
};

let idCounter = 0;

/** Collision-safe id without a uuid dependency (time + counter + entropy). */
export function genId(prefix: string): string {
  idCounter = (idCounter + 1) % 0xffff;
  return `${prefix}_${Date.now().toString(36)}${idCounter.toString(36)}${Math.random()
    .toString(36)
    .slice(2, 6)}`;
}

export function createEmptyDoc(
  opts: Partial<Pick<EditorDoc, "fps" | "width" | "height">> = {}
): EditorDoc {
  return {
    version: 1,
    fps: opts.fps ?? 30,
    width: opts.width ?? 1280,
    height: opts.height ?? 720,
    duration: 0,
    tracks: [
      { id: genId("trk"), kind: "video", name: "Video 1", muted: false, locked: false, volume: 1, clips: [] },
      { id: genId("trk"), kind: "audio", name: "Audio 1", muted: false, locked: false, volume: 1, clips: [] },
    ],
    assets: {},
  };
}

export function clipEnd(clip: Clip): number {
  return clip.start + clip.duration;
}

/**
 * Structural integrity check. Throws with a descriptive message on violation.
 * The engine runs this after every command in dev; the server runs it on every
 * received document before rendering.
 */
export function validateDoc(doc: EditorDoc): void {
  if (doc.version !== 1) throw new Error(`Unsupported doc version: ${doc.version}`);
  if (!(doc.fps > 0) || !(doc.width > 0) || !(doc.height > 0)) {
    throw new Error("fps/width/height must be positive");
  }
  const seenClipIds = new Set<string>();
  for (const track of doc.tracks) {
    let prevEnd = -Infinity;
    let prevStart = -Infinity;
    for (const clip of track.clips) {
      if (seenClipIds.has(clip.id)) throw new Error(`Duplicate clip id ${clip.id}`);
      seenClipIds.add(clip.id);
      if (!doc.assets[clip.assetId]) throw new Error(`Clip ${clip.id} references missing asset ${clip.assetId}`);
      if (clip.start < 0) throw new Error(`Clip ${clip.id} starts before 0`);
      if (clip.duration < MIN_CLIP_DURATION - 1e-9) {
        throw new Error(`Clip ${clip.id} shorter than minimum (${clip.duration}s)`);
      }
      if (clip.start < prevStart) throw new Error(`Track ${track.id} clips not sorted by start`);
      if (clip.start < prevEnd - 1e-9) {
        throw new Error(`Track ${track.id} has overlapping clips at ${clip.start}s`);
      }
      if (clip.speed <= 0) throw new Error(`Clip ${clip.id} has non-positive speed`);
      const asset = doc.assets[clip.assetId];
      if (asset.kind !== "image") {
        const srcSpan = clip.srcOut - clip.srcIn;
        const expected = clip.duration * clip.speed;
        if (clip.srcIn < -1e-9) throw new Error(`Clip ${clip.id} srcIn < 0`);
        if (Math.abs(srcSpan - expected) > 1e-6) {
          throw new Error(
            `Clip ${clip.id} src window (${srcSpan}) does not match duration*speed (${expected})`
          );
        }
        if (asset.duration !== undefined && clip.srcOut > asset.duration + 1e-6) {
          throw new Error(`Clip ${clip.id} srcOut ${clip.srcOut} exceeds asset duration ${asset.duration}`);
        }
      }
      prevEnd = clipEnd(clip);
      prevStart = clip.start;
    }
  }
  const computed = computeDuration(doc);
  if (Math.abs(computed - doc.duration) > 1e-6) {
    throw new Error(`doc.duration ${doc.duration} stale (computed ${computed})`);
  }
}

export function computeDuration(doc: EditorDoc): number {
  let max = 0;
  for (const track of doc.tracks) {
    for (const clip of track.clips) max = Math.max(max, clipEnd(clip));
  }
  return max;
}
