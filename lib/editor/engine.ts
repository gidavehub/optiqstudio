/**
 * Optiq Editor Engine — command layer.
 *
 * Owns the document, exposes every mutation as a named command, maintains
 * undo/redo history, and notifies subscribers after each committed change.
 * Immutable snapshots: commands operate on a deep clone and swap it in, so
 * subscribers (e.g. React via useSyncExternalStore) get referential updates
 * for free and history is trivially correct.
 *
 * Drag interactions use `beginTransient()`/`commitTransient()` so that a
 * hundred pointermove updates collapse into a single undo step.
 */

import {
  AssetRef,
  Clip,
  clipEnd,
  computeDuration,
  createEmptyDoc,
  DEFAULT_TRANSFORM,
  EditorDoc,
  genId,
  MIN_CLIP_DURATION,
  Track,
  TrackKind,
  validateDoc,
} from "./types";

export type OverlapMode = "push" | "reject";

export interface InsertClipOptions {
  assetId: string;
  start: number;
  /** Defaults to full asset duration (or 3s for images). */
  duration?: number;
  srcIn?: number;
  speed?: number;
  volume?: number;
  label?: string;
  overlap?: OverlapMode;
}

export interface SnapContext {
  /** Extra times worth snapping to (playhead, markers). */
  extra?: number[];
  /** Snap radius in seconds (zoom-dependent; caller converts px→sec). */
  threshold: number;
  /** Clip being dragged — its own edges are excluded from candidates. */
  ignoreClipId?: string;
}

const HISTORY_LIMIT = 100;

const deepClone: <T>(v: T) => T =
  typeof structuredClone === "function"
    ? structuredClone
    : (v) => JSON.parse(JSON.stringify(v));

export class EditorEngine {
  private doc: EditorDoc;
  private undoStack: EditorDoc[] = [];
  private redoStack: EditorDoc[] = [];
  private listeners = new Set<(doc: EditorDoc) => void>();
  private transientBase: EditorDoc | null = null;
  /** Skip per-command validation in production hot paths; always validated on export. */
  validateEveryCommand = true;

  constructor(doc?: EditorDoc) {
    this.doc = doc ? deepClone(doc) : createEmptyDoc();
    validateDoc(this.doc);
  }

  // ── Introspection ─────────────────────────────────────────────────────────

  getDoc(): EditorDoc {
    return this.doc;
  }

  subscribe(fn: (doc: EditorDoc) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  findClip(clipId: string): { track: Track; clip: Clip; index: number } | null {
    for (const track of this.doc.tracks) {
      const index = track.clips.findIndex((c) => c.id === clipId);
      if (index !== -1) return { track, clip: track.clips[index], index };
    }
    return null;
  }

  getTrack(trackId: string): Track | null {
    return this.doc.tracks.find((t) => t.id === trackId) ?? null;
  }

  // ── History ───────────────────────────────────────────────────────────────

  undo(): boolean {
    const prev = this.undoStack.pop();
    if (!prev) return false;
    this.redoStack.push(this.doc);
    this.doc = prev;
    this.emit();
    return true;
  }

  redo(): boolean {
    const next = this.redoStack.pop();
    if (!next) return false;
    this.undoStack.push(this.doc);
    this.doc = next;
    this.emit();
    return true;
  }

  /**
   * Start a transient edit (drag). Subsequent commands mutate the doc without
   * growing history until `commitTransient()` collapses everything since
   * `beginTransient()` into one undo entry (or `cancelTransient()` restores).
   */
  beginTransient(): void {
    if (this.transientBase) return;
    this.transientBase = this.doc;
  }

  commitTransient(): void {
    if (!this.transientBase) return;
    if (this.transientBase !== this.doc) {
      this.pushHistory(this.transientBase);
    }
    this.transientBase = null;
  }

  cancelTransient(): void {
    if (!this.transientBase) return;
    this.doc = this.transientBase;
    this.transientBase = null;
    this.emit();
  }

  // ── Assets ────────────────────────────────────────────────────────────────

  addAsset(asset: Omit<AssetRef, "id"> & { id?: string }): string {
    const id = asset.id ?? genId("ast");
    this.command((doc) => {
      doc.assets[id] = { ...asset, id };
    });
    return id;
  }

  removeAsset(assetId: string): void {
    this.command((doc) => {
      for (const track of doc.tracks) {
        track.clips = track.clips.filter((c) => c.assetId !== assetId);
      }
      delete doc.assets[assetId];
    });
  }

  // ── Tracks ────────────────────────────────────────────────────────────────

  addTrack(kind: TrackKind, name?: string): string {
    const id = genId("trk");
    this.command((doc) => {
      const count = doc.tracks.filter((t) => t.kind === kind).length;
      doc.tracks.push({
        id,
        kind,
        name: name ?? `${kind === "video" ? "Video" : "Audio"} ${count + 1}`,
        muted: false,
        locked: false,
        volume: 1,
        clips: [],
      });
    });
    return id;
  }

  removeTrack(trackId: string): void {
    this.command((doc) => {
      const idx = doc.tracks.findIndex((t) => t.id === trackId);
      if (idx === -1) throw new Error(`Unknown track ${trackId}`);
      doc.tracks.splice(idx, 1);
    });
  }

  moveTrack(trackId: string, toIndex: number): void {
    this.command((doc) => {
      const from = doc.tracks.findIndex((t) => t.id === trackId);
      if (from === -1) throw new Error(`Unknown track ${trackId}`);
      const [track] = doc.tracks.splice(from, 1);
      doc.tracks.splice(Math.max(0, Math.min(toIndex, doc.tracks.length)), 0, track);
    });
  }

  setTrackProps(
    trackId: string,
    props: Partial<Pick<Track, "name" | "muted" | "locked" | "volume">>
  ): void {
    this.command((doc) => {
      const track = doc.tracks.find((t) => t.id === trackId);
      if (!track) throw new Error(`Unknown track ${trackId}`);
      Object.assign(track, props);
    });
  }

  // ── Clips ─────────────────────────────────────────────────────────────────

  insertClip(trackId: string, opts: InsertClipOptions): string {
    const id = genId("clp");
    this.command((doc) => {
      const track = doc.tracks.find((t) => t.id === trackId);
      if (!track) throw new Error(`Unknown track ${trackId}`);
      if (track.locked) throw new Error(`Track ${trackId} is locked`);
      const asset = doc.assets[opts.assetId];
      if (!asset) throw new Error(`Unknown asset ${opts.assetId}`);
      if (track.kind === "audio" && asset.kind === "image") {
        throw new Error("Cannot place an image on an audio track");
      }

      const speed = opts.speed ?? 1;
      const srcIn = opts.srcIn ?? 0;
      const availableSrc =
        asset.kind === "image" ? Infinity : Math.max(0, (asset.duration ?? Infinity) - srcIn);
      const wanted =
        opts.duration ?? (asset.kind === "image" ? 3 : (asset.duration ?? 3) / speed);
      const duration = Math.max(
        MIN_CLIP_DURATION,
        Math.min(wanted, availableSrc / speed)
      );

      const clip: Clip = {
        id,
        assetId: opts.assetId,
        start: Math.max(0, opts.start),
        duration,
        srcIn,
        srcOut: asset.kind === "image" ? srcIn : srcIn + duration * speed,
        speed,
        volume: opts.volume ?? 1,
        muted: false,
        fadeIn: 0,
        fadeOut: 0,
        transform: track.kind === "video" ? { ...DEFAULT_TRANSFORM } : undefined,
        label: opts.label ?? asset.label,
      };
      placeClip(track, clip, opts.overlap ?? "push");
    });
    return id;
  }

  removeClip(clipId: string, ripple = false): void {
    this.command((doc) => {
      const loc = findClipIn(doc, clipId);
      if (!loc) throw new Error(`Unknown clip ${clipId}`);
      const { track, index, clip } = loc;
      track.clips.splice(index, 1);
      if (ripple) {
        for (const later of track.clips) {
          if (later.start >= clipEnd(clip) - 1e-9) later.start -= clip.duration;
        }
      }
    });
  }

  /**
   * Move a clip in time and optionally across tracks. Landing on occupied
   * space resolves per `overlap` ("push" shifts later clips right).
   */
  moveClip(
    clipId: string,
    to: { trackId?: string; start: number },
    overlap: OverlapMode = "push"
  ): void {
    this.command((doc) => {
      const loc = findClipIn(doc, clipId);
      if (!loc) throw new Error(`Unknown clip ${clipId}`);
      const target = to.trackId
        ? doc.tracks.find((t) => t.id === to.trackId)
        : loc.track;
      if (!target) throw new Error(`Unknown track ${to.trackId}`);
      if (target.locked) throw new Error(`Track ${target.id} is locked`);
      if (target.kind !== loc.track.kind) {
        const asset = doc.assets[loc.clip.assetId];
        if (target.kind === "audio" && asset.kind !== "audio" && asset.kind !== "video") {
          throw new Error("Clip media cannot live on an audio track");
        }
      }
      loc.track.clips.splice(loc.index, 1);
      const moved = { ...loc.clip, start: Math.max(0, to.start) };
      if (target.kind === "audio") moved.transform = undefined;
      placeClip(target, moved, overlap);
    });
  }

  /** Drag the clip's left edge. Bounded by source media, neighbors, and t=0. */
  trimClipStart(clipId: string, newStart: number): void {
    this.command((doc) => {
      const loc = findClipIn(doc, clipId);
      if (!loc) throw new Error(`Unknown clip ${clipId}`);
      const { track, clip, index } = loc;
      const asset = doc.assets[clip.assetId];
      const prev = track.clips[index - 1];
      const minStart = Math.max(
        prev ? clipEnd(prev) : 0,
        asset.kind === "image" ? 0 : clip.start - clip.srcIn / clip.speed
      );
      const maxStart = clipEnd(clip) - MIN_CLIP_DURATION;
      const start = clamp(newStart, minStart, maxStart);
      const delta = start - clip.start;
      clip.start = start;
      clip.duration -= delta;
      if (asset.kind !== "image") clip.srcIn += delta * clip.speed;
    });
  }

  /** Drag the clip's right edge. Bounded by source media and the next clip. */
  trimClipEnd(clipId: string, newEnd: number): void {
    this.command((doc) => {
      const loc = findClipIn(doc, clipId);
      if (!loc) throw new Error(`Unknown clip ${clipId}`);
      const { track, clip, index } = loc;
      const asset = doc.assets[clip.assetId];
      const next = track.clips[index + 1];
      const srcMaxEnd =
        asset.kind === "image" || asset.duration === undefined
          ? Infinity
          : clip.start + (asset.duration - clip.srcIn) / clip.speed;
      const maxEnd = Math.min(next ? next.start : Infinity, srcMaxEnd);
      const end = clamp(newEnd, clip.start + MIN_CLIP_DURATION, maxEnd);
      clip.duration = end - clip.start;
      if (asset.kind !== "image") clip.srcOut = clip.srcIn + clip.duration * clip.speed;
    });
  }

  /** Cut a clip into two at timeline time `t` (CapCut razor). */
  splitClipAt(clipId: string, t: number): string | null {
    let newId: string | null = null;
    this.command((doc) => {
      const loc = findClipIn(doc, clipId);
      if (!loc) throw new Error(`Unknown clip ${clipId}`);
      const { track, clip, index } = loc;
      if (t <= clip.start + MIN_CLIP_DURATION || t >= clipEnd(clip) - MIN_CLIP_DURATION) {
        return; // cut point too close to an edge — no-op
      }
      const asset = doc.assets[clip.assetId];
      const offset = t - clip.start;
      const right: Clip = {
        ...clip,
        id: genId("clp"),
        start: t,
        duration: clip.duration - offset,
        srcIn: asset.kind === "image" ? clip.srcIn : clip.srcIn + offset * clip.speed,
        fadeIn: 0,
        fadeOut: clip.fadeOut,
        transform: clip.transform ? { ...clip.transform } : undefined,
      };
      clip.duration = offset;
      clip.fadeOut = 0;
      if (asset.kind !== "image") clip.srcOut = clip.srcIn + offset * clip.speed;
      track.clips.splice(index + 1, 0, right);
      newId = right.id;
    });
    return newId;
  }

  /**
   * Change playback rate keeping the clip's start and source window fixed —
   * the timeline duration stretches/shrinks (CapCut behavior).
   */
  setClipSpeed(clipId: string, speed: number): void {
    if (!(speed > 0)) throw new Error("speed must be > 0");
    this.command((doc) => {
      const loc = findClipIn(doc, clipId);
      if (!loc) throw new Error(`Unknown clip ${clipId}`);
      const { track, clip, index } = loc;
      const asset = doc.assets[clip.assetId];
      if (asset.kind === "image") {
        clip.speed = speed;
        return;
      }
      const srcSpan = clip.srcOut - clip.srcIn;
      let duration = srcSpan / speed;
      const next = track.clips[index + 1];
      if (next && clip.start + duration > next.start) {
        // Not enough room: keep timeline length, shrink the source window.
        duration = next.start - clip.start;
        clip.srcOut = clip.srcIn + duration * speed;
      }
      clip.speed = speed;
      clip.duration = Math.max(MIN_CLIP_DURATION, duration);
    });
  }

  setClipProps(
    clipId: string,
    props: Partial<Pick<Clip, "volume" | "muted" | "fadeIn" | "fadeOut" | "label" | "transform">>
  ): void {
    this.command((doc) => {
      const loc = findClipIn(doc, clipId);
      if (!loc) throw new Error(`Unknown clip ${clipId}`);
      Object.assign(loc.clip, props);
    });
  }

  // ── Snapping ──────────────────────────────────────────────────────────────

  /**
   * Snap a candidate time to nearby clip edges / extra anchors. Pure helper —
   * does not mutate. Returns the snapped time (or the input unchanged).
   */
  snapTime(t: number, ctx: SnapContext): number {
    let best = t;
    let bestDist = ctx.threshold;
    const consider = (anchor: number) => {
      const d = Math.abs(anchor - t);
      if (d < bestDist) {
        bestDist = d;
        best = anchor;
      }
    };
    consider(0);
    for (const track of this.doc.tracks) {
      for (const clip of track.clips) {
        if (clip.id === ctx.ignoreClipId) continue;
        consider(clip.start);
        consider(clipEnd(clip));
      }
    }
    for (const extra of ctx.extra ?? []) consider(extra);
    return best;
  }

  // ── Serialization ─────────────────────────────────────────────────────────

  toJSON(): EditorDoc {
    return deepClone(this.doc);
  }

  static fromJSON(raw: unknown): EditorEngine {
    const doc = migrateDoc(raw);
    validateDoc(doc);
    return new EditorEngine(doc);
  }

  // ── Internals ─────────────────────────────────────────────────────────────

  private command(mutate: (doc: EditorDoc) => void): void {
    const before = this.doc;
    const draft = deepClone(this.doc);
    mutate(draft);
    draft.duration = computeDuration(draft);
    if (this.validateEveryCommand) validateDoc(draft);
    this.doc = draft;
    if (!this.transientBase) this.pushHistory(before);
    this.emit();
  }

  private pushHistory(snapshot: EditorDoc): void {
    this.undoStack.push(snapshot);
    if (this.undoStack.length > HISTORY_LIMIT) this.undoStack.shift();
    this.redoStack = [];
  }

  private emit(): void {
    for (const fn of this.listeners) fn(this.doc);
  }
}

// ── Module-level helpers ────────────────────────────────────────────────────

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function findClipIn(
  doc: EditorDoc,
  clipId: string
): { track: Track; clip: Clip; index: number } | null {
  for (const track of doc.tracks) {
    const index = track.clips.findIndex((c) => c.id === clipId);
    if (index !== -1) return { track, clip: track.clips[index], index };
  }
  return null;
}

/**
 * Insert `clip` into `track` keeping the sorted/non-overlap invariant.
 * "push": clips that would collide are shifted right by exactly the overlap.
 * "reject": throws if the clip would land on occupied space.
 */
function placeClip(track: Track, clip: Clip, mode: OverlapMode): void {
  const clips = track.clips;
  let insertAt = clips.findIndex((c) => c.start > clip.start + 1e-9);
  if (insertAt === -1) insertAt = clips.length;

  const prev = clips[insertAt - 1];
  if (prev && clipEnd(prev) > clip.start + 1e-9) {
    if (mode === "reject") throw new Error("Clip overlaps existing clip");
    clip.start = clipEnd(prev); // snap the dropped clip to the end of the clip under it
  }

  clips.splice(insertAt, 0, clip);

  // Push everything after the inserted clip right, cascading.
  for (let i = insertAt + 1; i < clips.length; i++) {
    const cur = clips[i];
    const prevEnd = clipEnd(clips[i - 1]);
    if (cur.start < prevEnd - 1e-9) {
      if (mode === "reject") throw new Error("Clip overlaps existing clip");
      cur.start = prevEnd;
    } else {
      break;
    }
  }
}

/** Version-gate for stored documents; extend as the schema evolves. */
export function migrateDoc(raw: unknown): EditorDoc {
  if (!raw || typeof raw !== "object") throw new Error("Not an editor document");
  const doc = raw as EditorDoc;
  if (doc.version !== 1) throw new Error(`Unknown editor doc version ${(doc as any).version}`);
  return structuredCloneSafe(doc);
}

function structuredCloneSafe<T>(v: T): T {
  return typeof structuredClone === "function"
    ? structuredClone(v)
    : JSON.parse(JSON.stringify(v));
}
