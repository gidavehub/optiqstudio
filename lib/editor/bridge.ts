/**
 * Optiq Editor Engine — legacy project bridge.
 *
 * Builds an EditorDoc from the existing Firestore project shape (storyboard
 * scenes + per-scene videoStatus + the old flat `timeline` array + bgm), so
 * generated clips land on a real multi-track timeline the day the editor UI
 * ships, with zero migration of stored projects.
 */

import { AssetRef, canvasForAspect, createEmptyDoc, EditorDoc, genId } from "./types";
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
  /**
   * The orientation the ad was commissioned at ("16:9" / "9:16"), as chosen in
   * the wizard and stored on the project. This is what the canvas comes from —
   * see `canvasForAspect`. Absent on projects that predate it, which is what the
   * fallback is for.
   */
  aspectRatio?: string | number;
}

const LEGACY_SCENE_SECONDS = 10;

export function docFromLegacyProject(proj: LegacyProjectShape): EditorDoc {
  const engine = new EditorEngine(createEmptyDoc({ fps: 30, ...canvasForAspect(proj.aspectRatio) }));
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
      sceneIndex: item.sceneIndex,
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

// ── Keeping a saved document pointed at the CURRENT takes ────────────────────
//
// A scene can be re-rendered any number of times, and each render mints a clip
// at a brand-new URL. The stored editor document was built from whichever take
// existed at the time, so without this the timeline would keep playing clips
// the director has already replaced (and paid to replace).

/** `Scene 3` → 2. The label the bridge and the media bin give generated clips. */
const SCENE_LABEL = /^Scene (\d+)$/;

/**
 * Which storyboard scene an asset came from, or null if it isn't a scene clip.
 *
 * Prefers the explicit stamp. The label is a backfill for documents saved
 * before assets carried provenance — narrow on purpose (an exact `Scene N` on a
 * video asset), and it only ever runs once, because the sync writes the stamp.
 */
export function assetSceneIndex(asset: AssetRef): number | null {
  if (typeof asset.sceneIndex === "number") return asset.sceneIndex;
  if (asset.kind !== "video") return null;
  const match = SCENE_LABEL.exec(asset.label ?? "");
  return match ? Number(match[1]) - 1 : null;
}

/**
 * Conform a document's canvas to the project's orientation.
 *
 * Needed because every document saved before the canvas was derived from
 * `aspectRatio` was built at a hardcoded 1280×720, whatever the ad's shape. A
 * vertical film therefore has a landscape canvas stored on it, and would keep
 * previewing and exporting letterboxed forever — the fix to `docFromLegacyProject`
 * only helps documents built after it.
 *
 * Safe to run on every load: it is a no-op when the canvas already agrees, and
 * clip transforms are canvas fractions so nothing on the timeline moves.
 *
 * Returns true when the canvas actually changed (i.e. the caller should persist).
 */
export function conformCanvas(engine: EditorEngine, aspectRatio?: string | number): boolean {
  const target = canvasForAspect(aspectRatio);
  const doc = engine.getDoc();
  if (doc.width === target.width && doc.height === target.height) return false;
  engine.setCanvas(target.width, target.height);
  return true;
}

/**
 * Re-point every scene-derived asset at the scene's active take.
 *
 * Only the media URL moves: clip positions, trims, splits, speeds, volumes,
 * overlays and added music are untouched, because clips address their source
 * through the asset. Scenes with no successful render are left alone rather
 * than blanked — a failed re-render must never cost the director the take
 * that's already on the timeline.
 *
 * Returns how many assets actually changed source.
 */
export function syncSceneTakes(
  engine: EditorEngine,
  videoStatus: LegacyProjectShape["videoStatus"]
): number {
  if (!videoStatus) return 0;
  let repointed = 0;
  for (const asset of Object.values(engine.getDoc().assets)) {
    const sceneIndex = assetSceneIndex(asset);
    if (sceneIndex === null) continue;
    const scene = videoStatus[sceneIndex];
    if (scene?.status !== "succeeded" || !scene.url) continue;
    const stale = asset.url !== scene.url;
    if (!stale && asset.sceneIndex === sceneIndex) continue;
    engine.retargetAsset(asset.id, { url: scene.url, sceneIndex });
    if (stale) repointed++;
  }
  return repointed;
}
