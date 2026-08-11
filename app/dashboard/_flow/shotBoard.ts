// The shot board, as the client reads it.
//
// Pure functions only — the board itself is built server-side and this file
// never writes it. See app/dashboard/_flow/types.ts for the shapes and
// functions/shotBoardRun.js for the machinery.

import {
  Scene,
  SceneImage,
  SceneShotBoard,
  ShotBoard,
  ShotBoardPlate,
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
 * The stills a scene's setups flatten to, in the order they are attached.
 *
 * One entry per attached image — a setup that MOVES contributes two, where it
 * starts and where it ends. That ordering is the numbering the shot-board clause
 * hands the video model ("ATTACHED IMAGE 2 is where this setup ends"), so this
 * function, `sceneStills` in functions/shotBoardRun.js and `stillRoll` in each
 * brain must all produce the same sequence. Change one, change all three.
 */
export function sceneStills(board: ShotBoard | null | undefined, sceneIndex: number): SceneImage[] {
  const stills: SceneImage[] = [];
  for (const shot of sceneFrames(board, sceneIndex)) {
    const label = shot.label || `Setup ${(shot.order ?? 0) + 1}`;
    stills.push({
      name: `${shot.time ? `${shot.time} · ` : ""}${label}`,
      path: shot.path as string,
      url: shot.url as string,
      mimeType: shot.mimeType || "image/png",
      order: shot.order ?? 0,
    });
    if (shot.end?.url && shot.end?.path) {
      stills.push({
        name: `${label} — ends on`,
        path: shot.end.path,
        url: shot.end.url,
        mimeType: shot.end.mimeType || "image/png",
        // The same setup, so the same order: removing either end removes the
        // setup, which is the only sensible reading of "remove this shot".
        order: shot.order ?? 0,
      });
    }
  }
  return stills;
}

/**
 * The images that ride along with one scene's video render, in order.
 *
 * THE FRAMES REPLACE EVERYTHING ELSE. A photographed scene attaches its frames
 * and nothing else — no character sheets, no object plate, no uploads:
 *
 *   The frames already contain all of it. They were generated FROM the character
 *   sheets, the place and arrangement plates, and the object plates.
 *
 *   The character sheet actively hurts here. It is a studio portrait on a grey
 *   backdrop and needs a whole quarantine clause to stop that grey following the
 *   person into the scene. A frame needs none — it IS the scene.
 *
 *   The count is a hard constraint. Five frames plus two sheets plus an upload is
 *   eight images on one video call, and the fusion warning in doctrine §3.8 does
 *   not care that some of them are frames.
 *
 * A SCENE WITH NO FRAMES ATTACHES NOTHING. There is deliberately no fallback to
 * the character sheets or the director's uploads, and this is a hard rule, not an
 * oversight: those pictures exist to build the BOARD, and the board is the only
 * thing the video model is ever shown. A studio portrait handed to the video
 * model is the grey-backdrop contamination this whole system replaced, and a
 * half-photographed film that quietly reverts to it is worse than one that
 * renders from its words — because it looks like it is working.
 *
 * This is the twin of `renderAttachments` in functions/shotBoardRun.js — the
 * agent renders through that one, the editor through this one, and they must
 * agree. Change one, change the other.
 */
export function renderAttachments(
  board: ShotBoard | null | undefined,
  sceneIndex: number
): SceneImage[] {
  return sceneStills(board, sceneIndex);
}

/**
 * The prompt a scene actually renders from.
 *
 * Two layers now: the director's own edit if they made one, otherwise the long
 * prompt. Every render path and every prompt box goes through here, so what the
 * director reads in the editor is exactly what gets sent.
 *
 * `framedPrompt` IS DELIBERATELY NOT CONSULTED, and it used to be — it sat ahead
 * of `fullPrompt` here. It is the short shooting brief written for a PHOTOGRAPHED
 * scene: a cast key, the beats, the dialogue and the camera, carrying no
 * description of how anything looks, because the attached frames carried that
 * instead. Nothing is attached to a render any more (see the header of
 * functions/optiqStoryX/pipeline.js), so a scene that still has a framedPrompt
 * from the photographed era would render an appearance-free brief with no
 * pictures behind it — a clip of nobody in particular, in a room the model made
 * up. The long prompt is the film now, always.
 */
export function renderPrompt(
  scene: Pick<Scene, "fullPrompt" | "framedPrompt">,
  customPrompt?: string | null
): string {
  return customPrompt || scene.fullPrompt;
}

/** Every photograph on one tier of the hierarchy, newest state last. */
export function platesOfTier(
  board: ShotBoard | null | undefined,
  tier: ShotBoardPlate["tier"]
): ShotBoardPlate[] {
  return (board?.plates || []).filter((plate) => plate.tier === tier && plate.url);
}

/** How many scenes of a film have been photographed, and with how many stills. */
export function boardCoverage(board: ShotBoard | null | undefined, sceneCount: number) {
  let photographed = 0;
  let frames = 0;
  for (let i = 0; i < sceneCount; i++) {
    const shots = sceneFrames(board, i);
    if (shots.length > 0) photographed++;
    frames += sceneStills(board, i).length;
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
        : "Reading the film for places, arrangements and objects";
    case "plating":
      return progress?.platesTotal
        ? `Photographing the world · ${progress.platesDone ?? 0}/${progress.platesTotal}`
        : "Photographing the world";
    case "framing":
      return progress?.framesTotal
        ? `Photographing frames · ${progress.framesDone ?? 0}/${progress.framesTotal}`
        : "Photographing frames";
    case "briefing":
      return progress?.briefsTotal
        ? `Writing the shooting briefs · ${progress.briefsDone ?? 0}/${progress.briefsTotal}`
        : "Writing the shooting briefs";
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
