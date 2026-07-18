// Timeline placement policy for the CapCut-style editor.
//
// There are no "add track" buttons: tracks are born from gestures. Dropping
// media (or dragging an existing clip) onto occupied space auto-creates a new
// layer of the right kind — video/image overlays stack on top, audio voices
// stack alongside — which is what makes "drag it on top of another clip"
// expand the timeline instead of pushing clips around.

import { EditorEngine, Track, clipEnd } from "../../../../lib/editor";

export const MEDIA_DRAG_TYPE = "application/x-optiq-media";

// HTML5 drag-and-drop hides dataTransfer payloads until drop, but the slot
// hit-testing needs the dragged media's kind/duration DURING the hover. The
// media bin publishes the payload here on dragstart (same-tab only, which is
// the only case that matters).
let activeDragPayload: MediaPayload | null = null;
export function setActiveDragPayload(p: MediaPayload | null): void {
  activeDragPayload = p;
}
export function getActiveDragPayload(): MediaPayload | null {
  return activeDragPayload;
}

export interface MediaPayload {
  kind: "video" | "audio" | "image";
  url: string;
  label?: string;
  duration?: number;
  width?: number;
  height?: number;
}

export const IMAGE_DEFAULT_SECONDS = 4;

export function payloadDuration(payload: MediaPayload): number {
  if (payload.kind === "image") return IMAGE_DEFAULT_SECONDS;
  return Math.max(0.1, payload.duration ?? 3);
}

/** True when [start, start+duration) collides with no clip on the track. */
export function regionFree(
  track: Track,
  start: number,
  duration: number,
  ignoreClipId?: string
): boolean {
  return !track.clips.some(
    (c) =>
      c.id !== ignoreClipId &&
      start < clipEnd(c) - 1e-6 &&
      c.start < start + duration - 1e-6
  );
}

export function findOrAddAsset(engine: EditorEngine, payload: MediaPayload): string {
  const existing = Object.values(engine.getDoc().assets).find((a) => a.url === payload.url);
  if (existing) return existing.id;
  return engine.addAsset({
    kind: payload.kind,
    url: payload.url,
    label: payload.label,
    duration: payload.kind === "image" ? undefined : payload.duration,
    width: payload.width,
    height: payload.height,
  });
}

/**
 * Insert media at `time`. Tries the preferred track first (the lane the user
 * dropped on), then any other compatible track with free space, and finally
 * auto-creates a new layer. Returns the new clip id.
 */
export function placeMediaOnTimeline(
  engine: EditorEngine,
  payload: MediaPayload,
  time: number,
  preferredTrackId?: string
): string {
  const assetId = findOrAddAsset(engine, payload);
  const kind = payload.kind === "audio" ? "audio" : "video";
  const duration = payloadDuration(payload);
  const start = Math.max(0, time);

  const doc = engine.getDoc();
  const candidates: Track[] = [];
  const preferred = preferredTrackId ? doc.tracks.find((t) => t.id === preferredTrackId) : undefined;
  if (preferred && preferred.kind === kind && !preferred.locked) candidates.push(preferred);
  for (const t of doc.tracks) {
    if (t.kind === kind && !t.locked && t !== preferred) candidates.push(t);
  }

  // If the user dropped on a specific lane, only that lane counts — occupied
  // means "layer it", not "shove it onto some other track".
  const search = preferred && preferred.kind === kind ? [preferred] : candidates;
  for (const track of search) {
    if (regionFree(track, start, duration)) {
      return engine.insertClip(track.id, {
        assetId,
        start,
        duration: payload.kind === "image" ? IMAGE_DEFAULT_SECONDS : undefined,
        label: payload.label,
        overlap: "reject",
      });
    }
  }

  const trackId = engine.addTrack(kind);
  return engine.insertClip(trackId, {
    assetId,
    start,
    duration: payload.kind === "image" ? IMAGE_DEFAULT_SECONDS : undefined,
    label: payload.label,
    overlap: "reject",
  });
}

/**
 * Fill in a missing duration by loading remote media metadata (needed so
 * timeline math and free-region checks use the real length, not a guess).
 */
export function withDuration(payload: MediaPayload): Promise<MediaPayload> {
  if (payload.kind === "image" || payload.duration) return Promise.resolve(payload);
  return new Promise((resolve) => {
    const el = document.createElement(payload.kind === "audio" ? "audio" : "video");
    let settled = false;
    const done = (duration?: number) => {
      if (settled) return;
      settled = true;
      el.removeAttribute("src");
      resolve(duration ? { ...payload, duration } : payload);
    };
    el.preload = "metadata";
    el.onloadedmetadata = () => done(Number.isFinite(el.duration) ? el.duration : undefined);
    el.onerror = () => done(undefined);
    setTimeout(() => done(undefined), 8000);
    el.src = payload.url;
  });
}

/**
 * Re-home an existing clip onto a brand-new layer at `start` (the end of a
 * drag that landed on occupied space). `kind` defaults to the clip's current
 * track kind; an image clip can never become an audio layer.
 */
export function layerExistingClip(
  engine: EditorEngine,
  clipId: string,
  start: number,
  kind?: Track["kind"]
): void {
  const loc = engine.findClip(clipId);
  if (!loc) return;
  const trackKind = kind ?? loc.track.kind;
  const assetKind = engine.getDoc().assets[loc.clip.assetId]?.kind;
  if (trackKind === "audio" && assetKind === "image") return;
  const trackId = engine.addTrack(trackKind);
  engine.moveClip(clipId, { trackId, start: Math.max(0, start) }, "reject");
}

/**
 * Create a fresh track that sits directly ABOVE `refTrackId` as displayed:
 * for video that means one z-level higher (doc order is bottom→top, so index
 * + 1); for audio the display lists doc order top→bottom, so it goes at the
 * ref's index. This is the track a "space opened up" slot materializes into.
 */
export function createLayerTrack(engine: EditorEngine, refTrackId: string): string | null {
  const doc = engine.getDoc();
  const idx = doc.tracks.findIndex((t) => t.id === refTrackId);
  if (idx === -1) return null;
  const ref = doc.tracks[idx];
  const id = engine.addTrack(ref.kind);
  engine.moveTrack(id, ref.kind === "video" ? idx + 1 : idx);
  return id;
}

/**
 * Drop tracks that ended a gesture empty (CapCut keeps the timeline tidy),
 * always preserving at least one video and one audio track.
 */
export function pruneEmptyTracks(engine: EditorEngine): void {
  const doc = engine.getDoc();
  const keepFirst = new Set<string>();
  const firstVideo = doc.tracks.find((t) => t.kind === "video");
  const firstAudio = doc.tracks.find((t) => t.kind === "audio");
  if (firstVideo) keepFirst.add(firstVideo.id);
  if (firstAudio) keepFirst.add(firstAudio.id);
  for (const t of doc.tracks) {
    if (t.clips.length === 0 && !keepFirst.has(t.id)) engine.removeTrack(t.id);
  }
}
