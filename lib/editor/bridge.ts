/**
 * Optiq Editor Engine — legacy project bridge.
 *
 * Builds an EditorDoc from the existing Firestore project shape (storyboard
 * scenes + per-scene videoStatus + the old flat `timeline` array + bgm), so
 * generated clips land on a real multi-track timeline the day the editor UI
 * ships, with zero migration of stored projects.
 */

import { createEmptyDoc, EditorDoc, genId } from "./types";
import { EditorEngine } from "./engine";

export interface LegacyTimelineItem {
  sceneIndex: number;
  videoUrl?: string;
  trimStart?: number;
  trimEnd?: number;
  volume?: number;
}

export interface LegacyProjectShape {
  videoStatus?: Record<number, { status?: string; url?: string }>;
  timeline?: LegacyTimelineItem[];
  musicUrl?: string;
  musicVolume?: number;
  /** Seconds per scene in the legacy pipeline. */
  sceneDuration?: number;
}

const LEGACY_SCENE_SECONDS = 10;

export function docFromLegacyProject(proj: LegacyProjectShape): EditorDoc {
  const engine = new EditorEngine(createEmptyDoc({ fps: 30, width: 1280, height: 720 }));
  const doc = engine.getDoc();
  const videoTrackId = doc.tracks.find((t) => t.kind === "video")!.id;
  const audioTrackId = doc.tracks.find((t) => t.kind === "audio")!.id;
  const sceneSeconds = proj.sceneDuration ?? LEGACY_SCENE_SECONDS;

  const items: LegacyTimelineItem[] =
    proj.timeline && proj.timeline.length > 0
      ? proj.timeline
      : Object.entries(proj.videoStatus ?? {})
          .filter(([, s]) => s?.status === "succeeded" && s?.url)
          .map(([idx, s]) => ({ sceneIndex: Number(idx), videoUrl: s.url! }));

  let cursor = 0;
  for (const item of items) {
    const url = item.videoUrl || proj.videoStatus?.[item.sceneIndex]?.url;
    if (!url) continue;
    const srcIn = Math.max(0, item.trimStart ?? 0);
    const srcOut = Math.min(sceneSeconds, item.trimEnd ?? sceneSeconds);
    if (srcOut - srcIn <= 0) continue;
    const assetId = engine.addAsset({
      id: genId("ast"),
      kind: "video",
      url,
      duration: sceneSeconds,
      label: `Scene ${item.sceneIndex + 1}`,
    });
    engine.insertClip(videoTrackId, {
      assetId,
      start: cursor,
      srcIn,
      duration: srcOut - srcIn,
      volume: item.volume ?? 1,
      label: `Scene ${item.sceneIndex + 1}`,
    });
    cursor += srcOut - srcIn;
  }

  if (proj.musicUrl && cursor > 0) {
    const bgmId = engine.addAsset({
      id: genId("ast"),
      kind: "audio",
      url: proj.musicUrl,
      label: "Background music",
    });
    engine.insertClip(audioTrackId, {
      assetId: bgmId,
      start: 0,
      duration: cursor,
      volume: proj.musicVolume ?? 0.2,
      label: "Background music",
    });
  }

  return engine.toJSON();
}
