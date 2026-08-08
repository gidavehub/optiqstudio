// The shot board, as the client reads it.
//
// Pure functions only — the board itself is built server-side and this file
// never writes it. See app/dashboard/_flow/types.ts for the shapes and
// functions/shotBoardRun.js for the machinery.

import {
  SceneImage,
  SceneImagesMap,
  SceneShotBoard,
  ShotBoard,
  ShotBoardProgress,
  ShotBoardStage,
  ShotFrame,
} from "./types";

/** A scene's board entry. Firestore returns the index keys as strings. */
export function sceneBoard(board: ShotBoard | null | undefined, sceneIndex: number): SceneShotBoard | null {
  const scenes = board?.scenes;
  if (!scenes) return null;
  return scenes[sceneIndex] ?? scenes[String(sceneIndex)] ?? null;
}

/** The frames that actually exist for a scene, in shot order. */
export function sceneFrames(board: ShotBoard | null | undefined, sceneIndex: number): ShotFrame[] {
  return (sceneBoard(board, sceneIndex)?.shots || [])
    .filter((shot) => shot.url && shot.path)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

/** Every setup a scene has, photographed or not — what the strip draws. */
export function sceneSetups(board: ShotBoard | null | undefined, sceneIndex: number): ShotFrame[] {
  return [...(sceneBoard(board, sceneIndex)?.shots || [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

/**
 * The images that ride along with one scene's video render, in order.
 *
 * THE FRAMES REPLACE EVERYTHING ELSE. A photographed scene attaches its frames
 * and nothing else — no character sheets, no product plate, no uploads:
 *
 *   The frames already contain all of it. They were generated FROM the character
 *   sheets, the set plate and the product plate.
 *
 *   The character sheet actively hurts here. It is a studio portrait on a grey
 *   backdrop and needs a whole quarantine clause to stop that grey following the
 *   person into the scene. A frame needs none — it IS the scene.
 *
 *   The count is a hard constraint. Four frames plus two sheets plus an upload is
 *   seven images on one video call, and the fusion warning in doctrine §3.8 does
 *   not care that some of them are frames.
 *
 * A scene with no frames attaches exactly what it always did.
 *
 * This is the twin of `renderAttachments` in functions/shotBoardRun.js — the
 * agent renders through that one, the editor through this one, and they must
 * agree. Change one, change the other.
 */
export function renderAttachments(
  board: ShotBoard | null | undefined,
  sceneImages: SceneImagesMap,
  sceneIndex: number
): SceneImage[] {
  const frames = sceneFrames(board, sceneIndex);
  if (frames.length > 0) {
    return frames.map((shot, i) => ({
      name: `Frame ${i + 1}${shot.time ? ` · ${shot.time}` : ""}${shot.label ? ` — ${shot.label}` : ""}`,
      path: shot.path as string,
      url: shot.url as string,
      mimeType: shot.mimeType || "image/png",
    }));
  }
  return sceneImages[sceneIndex] || [];
}

/** How many scenes of a film have been photographed. */
export function boardCoverage(board: ShotBoard | null | undefined, sceneCount: number) {
  let photographed = 0;
  let frames = 0;
  for (let i = 0; i < sceneCount; i++) {
    const shots = sceneFrames(board, i);
    if (shots.length > 0) photographed++;
    frames += shots.length;
  }
  return { photographed, frames, sceneCount };
}

/**
 * One line for the status strip. Deliberately in the director's language —
 * "photographing" is what this is, and "designing" is not a word anyone outside
 * the pipeline would use for deciding where the camera goes.
 */
export function shotBoardStatusLabel(stage: ShotBoardStage, progress?: ShotBoardProgress | null): string {
  switch (stage) {
    case "queued":
      return "Shot board queued";
    case "designing":
      return progress?.scenesTotal
        ? `Planning the angles · ${progress.scenesDone ?? 0}/${progress.scenesTotal} scenes`
        : "Reading the film for locations and props";
    case "plating":
      return progress?.platesTotal
        ? `Photographing locations and objects · ${progress.platesDone ?? 0}/${progress.platesTotal}`
        : "Photographing locations and objects";
    case "framing":
      return progress?.framesTotal
        ? `Photographing frames · ${progress.framesDone ?? 0}/${progress.framesTotal}`
        : "Photographing frames";
    case "ready":
      return "Shot board ready";
    case "partial":
      return "Shot board partly built";
    case "failed":
      return "Shot board failed";
    default:
      return "Not photographed yet";
  }
}
