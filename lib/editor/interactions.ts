/**
 * Optiq Editor Engine — interaction controller (pure, headless).
 *
 * Translates timeline gestures into engine commands. The UI converts pointer
 * events into timeline coordinates (via timescale.ts) and calls begin/update/
 * end here; this owns the drag state machine and snapping, and drives the
 * engine through a single transient transaction per gesture so an entire drag
 * collapses to one undo. No DOM, no pixels — everything is in seconds.
 */

import { EditorEngine } from "./engine";
import { clipEnd } from "./types";

export type DragKind = "move" | "trim-start" | "trim-end";

export interface InteractionOptions {
  snapEnabled?: boolean;
  /** Snap radius in px; converted to seconds using the live pxPerSecond. */
  snapThresholdPx?: number;
  /** Live zoom, so the seconds-threshold tracks the current view. */
  getPxPerSecond: () => number;
  /** Extra snap anchor (usually the playhead). */
  getPlayhead?: () => number | undefined;
}

interface DragState {
  kind: DragKind;
  clipId: string;
  /** For "move": seconds between the clip's start and the grab point. */
  grabOffset: number;
  /** Timeline duration at grab (move keeps it fixed). */
  duration: number;
}

export class InteractionController {
  private engine: EditorEngine;
  private opts: InteractionOptions;
  private drag: DragState | null = null;

  constructor(engine: EditorEngine, opts: InteractionOptions) {
    this.engine = engine;
    this.opts = opts;
  }

  get isDragging(): boolean {
    return this.drag !== null;
  }

  get activeClipId(): string | null {
    return this.drag?.clipId ?? null;
  }

  // ── Drag lifecycle ────────────────────────────────────────────────────────

  /** Begin dragging a clip body. `pointerTime` is where the grab landed. */
  beginMove(clipId: string, pointerTime: number): void {
    const loc = this.engine.findClip(clipId);
    if (!loc) return;
    this.engine.beginTransient();
    this.drag = {
      kind: "move",
      clipId,
      grabOffset: pointerTime - loc.clip.start,
      duration: loc.clip.duration,
    };
  }

  /** Begin dragging a clip edge. */
  beginTrim(clipId: string, edge: "start" | "end"): void {
    const loc = this.engine.findClip(clipId);
    if (!loc) return;
    this.engine.beginTransient();
    this.drag = {
      kind: edge === "start" ? "trim-start" : "trim-end",
      clipId,
      grabOffset: 0,
      duration: loc.clip.duration,
    };
  }

  /**
   * Update the active drag. `pointerTime` is the current pointer position in
   * seconds; `pointerTrackId` (move only) is the track the pointer is over.
   */
  update(pointerTime: number, pointerTrackId?: string): void {
    const drag = this.drag;
    if (!drag) return;

    if (drag.kind === "move") {
      const desiredStart = Math.max(0, pointerTime - drag.grabOffset);
      const start = this.snapMove(drag.clipId, desiredStart, drag.duration);
      const trackId = this.resolveTargetTrack(drag.clipId, pointerTrackId);
      this.engine.moveClip(drag.clipId, { trackId, start }, "push");
      return;
    }

    if (drag.kind === "trim-start") {
      this.engine.trimClipStart(drag.clipId, this.snapEdge(drag.clipId, pointerTime));
    } else {
      this.engine.trimClipEnd(drag.clipId, this.snapEdge(drag.clipId, pointerTime));
    }
  }

  /** Commit the drag as a single undo step. */
  end(): void {
    if (!this.drag) return;
    this.engine.commitTransient();
    this.drag = null;
  }

  /** Abort the drag, restoring the pre-drag document. */
  cancel(): void {
    if (!this.drag) return;
    this.engine.cancelTransient();
    this.drag = null;
  }

  // ── One-shot ops ──────────────────────────────────────────────────────────

  /** Razor: split whichever clip on `trackId` covers `time`. */
  razorAt(trackId: string, time: number): string | null {
    const track = this.engine.getTrack(trackId);
    if (!track) return null;
    const clip = track.clips.find((c) => time > c.start && time < clipEnd(c));
    return clip ? this.engine.splitClipAt(clip.id, time) : null;
  }

  /** Split every clip the playhead crosses (CapCut's razor-at-playhead). */
  razorAllAt(time: number): string[] {
    const created: string[] = [];
    for (const track of this.engine.getDoc().tracks) {
      const clip = track.clips.find((c) => time > c.start && time < clipEnd(c));
      if (clip) {
        const id = this.engine.splitClipAt(clip.id, time);
        if (id) created.push(id);
      }
    }
    return created;
  }

  // ── Snapping ──────────────────────────────────────────────────────────────

  private thresholdSeconds(): number {
    if (!(this.opts.snapEnabled ?? true)) return 0;
    const pps = this.opts.getPxPerSecond();
    if (!(pps > 0)) return 0;
    return (this.opts.snapThresholdPx ?? 8) / pps;
  }

  private extras(): number[] {
    const ph = this.opts.getPlayhead?.();
    return ph !== undefined ? [ph] : [];
  }

  /**
   * Snap the moved clip's nearer edge (start or end) to timeline anchors. Only
   * edges that actually landed on an anchor are candidates — `snapTime` returns
   * its input unchanged when nothing is in range, which must not count as a
   * zero-distance "snap".
   */
  private snapMove(clipId: string, desiredStart: number, duration: number): number {
    const threshold = this.thresholdSeconds();
    if (threshold <= 0) return desiredStart;
    const extra = this.extras();
    const desiredEnd = desiredStart + duration;

    const startSnap = this.engine.snapTime(desiredStart, { threshold, ignoreClipId: clipId, extra });
    const endSnapRaw = this.engine.snapTime(desiredEnd, { threshold, ignoreClipId: clipId, extra });
    const startSnapped = Math.abs(startSnap - desiredStart) > 1e-9;
    const endSnapped = Math.abs(endSnapRaw - desiredEnd) > 1e-9;

    const startAdjust = Math.abs(startSnap - desiredStart);
    const endAdjust = Math.abs(endSnapRaw - desiredEnd);

    if (startSnapped && (!endSnapped || startAdjust <= endAdjust)) return Math.max(0, startSnap);
    if (endSnapped) return Math.max(0, endSnapRaw - duration);
    return desiredStart;
  }

  private snapEdge(clipId: string, time: number): number {
    const threshold = this.thresholdSeconds();
    if (threshold <= 0) return time;
    return this.engine.snapTime(time, { threshold, ignoreClipId: clipId, extra: this.extras() });
  }

  /**
   * Pick a legal destination track for a move: keep the origin track unless the
   * pointer is over a track that can hold this clip's media.
   */
  private resolveTargetTrack(clipId: string, pointerTrackId?: string): string | undefined {
    if (!pointerTrackId) return undefined;
    const loc = this.engine.findClip(clipId);
    const target = this.engine.getTrack(pointerTrackId);
    if (!loc || !target || target.locked) return undefined;
    const assetKind = this.engine.getDoc().assets[loc.clip.assetId]?.kind;
    if (target.kind === "audio" && assetKind === "image") return undefined; // image can't go on audio
    return pointerTrackId;
  }
}
