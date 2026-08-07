// What the audio pass is doing right now, in the director's language.
//
// Shared because two screens report it: the production HUD, which holds the
// director there until the film has its sound, and the editor's top bar, which
// reports a re-score of a cut already open. They must not describe the same
// stage differently — "Composing the score…" in one place and "Scoring…" in the
// other reads as two different jobs running.
//
// Stage names are written by functions/audioPost.js. "queued" is ours; "ready"
// and "failed" are terminal and have no label because nothing is in progress.

export const AUDIO_STAGE_LABELS: Record<string, string> = {
  queued: "Scoring queued…",
  measuring: "Measuring the cut…",
  scanning: "Watching your film…",
  writing: "Writing the narration…",
  speaking: "Recording the voiceover…",
  rewriting: "Trimming lines to fit…",
  refitting: "Re-recording trimmed lines…",
  scoring: "Composing the score…",
  placing: "Laying it on the timeline…",
};

/** True while the pass is between its two terminal states. */
export function audioWorking(stage: string | null | undefined): boolean {
  return !!stage && stage !== "ready" && stage !== "failed";
}

/** The label for a stage, with a fallback for one this build doesn't know. */
export function audioStageLabel(stage: string | null | undefined): string {
  return AUDIO_STAGE_LABELS[stage ?? ""] ?? "Scoring your film…";
}
