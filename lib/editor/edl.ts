/**
 * Optiq Editor Engine — EDL compiler.
 *
 * Flattens an EditorDoc into a deterministic, self-contained RenderJob that a
 * server (Firebase Function / Cloud Run) can execute without knowing anything
 * about the editor, plus an ffmpeg plan builder that turns a RenderJob into
 * concrete `-i` inputs and a `filter_complex` graph.
 *
 * Rendering model:
 *  - Video track 0 is the BASE sequence: its clips are concatenated in order,
 *    gaps become black. Higher video tracks become time-windowed OVERLAYS.
 *  - Audio is rebuilt explicitly: embedded audio of every audible video clip
 *    plus every audio-track clip enters one amix graph with per-clip volume,
 *    speed (atempo), fades, and timeline offset (adelay). Video streams are
 *    always consumed video-only, which keeps the graph uniform.
 */

import { AssetKind, ClipTransform, EditorDoc, clipEnd, validateDoc } from "./types";

export interface RenderSegment {
  /** "media" plays a source window; "black" fills a timeline gap. */
  type: "media" | "black";
  url?: string;
  srcIn?: number;
  srcOut?: number;
  speed?: number;
  /** Timeline duration of the segment, seconds. */
  duration: number;
}

export interface RenderOverlay {
  url: string;
  kind: AssetKind;
  srcIn: number;
  srcOut: number;
  speed: number;
  /** Timeline window. */
  start: number;
  end: number;
  transform: ClipTransform;
}

export interface RenderAudio {
  url: string;
  srcIn: number;
  srcOut: number;
  speed: number;
  /** Timeline offset, seconds. */
  start: number;
  /** Final gain (clip.volume × track.volume). */
  volume: number;
  fadeIn: number;
  fadeOut: number;
}

export interface RenderJob {
  version: 1;
  fps: number;
  width: number;
  height: number;
  duration: number;
  base: RenderSegment[];
  overlays: RenderOverlay[];
  audio: RenderAudio[];
}

/** Flatten a validated document into a render job. Deterministic and pure. */
export function compileRenderJob(doc: EditorDoc): RenderJob {
  validateDoc(doc);
  const videoTracks = doc.tracks.filter((t) => t.kind === "video");
  const [baseTrack, ...overlayTracks] = videoTracks;

  const base: RenderSegment[] = [];
  const overlays: RenderOverlay[] = [];
  let cursor = 0;
  for (const clip of baseTrack?.clips ?? []) {
    const asset = doc.assets[clip.assetId];
    if (clip.start > cursor + 1e-6) {
      base.push({ type: "black", duration: round(clip.start - cursor) });
    }
    const t = clip.transform;
    const transformed =
      !!t && (t.x !== 0 || t.y !== 0 || t.scale !== 1 || t.rotation !== 0 || t.opacity !== 1);
    if (transformed) {
      // A transformed base clip can't ride the concat chain (that path always
      // fills the frame) — leave a black slot and composite it as the lowest
      // overlay so scale/position/opacity apply in the export too. Base-clip
      // overlays are pushed before overlay-track entries, preserving stacking.
      base.push({ type: "black", duration: round(clip.duration) });
      overlays.push({
        url: asset.url,
        kind: asset.kind,
        srcIn: round(clip.srcIn),
        srcOut: round(asset.kind === "image" ? clip.srcIn : clip.srcOut),
        speed: clip.speed,
        start: round(clip.start),
        end: round(clipEnd(clip)),
        transform: { ...t! },
      });
    } else {
      base.push({
        type: "media",
        url: asset.url,
        srcIn: round(clip.srcIn),
        srcOut: round(asset.kind === "image" ? clip.srcIn : clip.srcOut),
        speed: clip.speed,
        duration: round(clip.duration),
      });
    }
    cursor = clipEnd(clip);
  }
  if (doc.duration > cursor + 1e-6) {
    base.push({ type: "black", duration: round(doc.duration - cursor) });
  }

  for (const track of overlayTracks) {
    if (track.muted) continue; // muted video track = hidden layer
    for (const clip of track.clips) {
      const asset = doc.assets[clip.assetId];
      overlays.push({
        url: asset.url,
        kind: asset.kind,
        srcIn: round(clip.srcIn),
        srcOut: round(asset.kind === "image" ? clip.srcIn : clip.srcOut),
        speed: clip.speed,
        start: round(clip.start),
        end: round(clipEnd(clip)),
        transform: clip.transform ?? { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 },
      });
    }
  }

  const audio: RenderAudio[] = [];
  for (const track of doc.tracks) {
    if (track.muted) continue;
    for (const clip of track.clips) {
      const asset = doc.assets[clip.assetId];
      const audible =
        !clip.muted &&
        clip.volume * track.volume > 1e-4 &&
        (asset.kind === "audio" || asset.kind === "video");
      if (!audible) continue;
      audio.push({
        url: asset.url,
        srcIn: round(clip.srcIn),
        srcOut: round(clip.srcOut),
        speed: clip.speed,
        start: round(clip.start),
        volume: round(clip.volume * track.volume),
        fadeIn: clip.fadeIn,
        fadeOut: clip.fadeOut,
      });
    }
  }

  return {
    version: 1,
    fps: doc.fps,
    width: doc.width,
    height: doc.height,
    duration: round(doc.duration),
    base,
    overlays,
    audio,
  };
}

// ── ffmpeg plan ─────────────────────────────────────────────────────────────

export interface FfmpegPlan {
  /** Unique source URLs in `-i` order (caller downloads to local paths first). */
  inputs: string[];
  /** Complete filter_complex expression. */
  filterComplex: string;
  /** Label of the final video stream (map with `-map [label]`). */
  videoLabel: string;
  /** Label of the final audio stream. */
  audioLabel: string;
}

/**
 * Build the ffmpeg filtergraph for a render job.
 * v1 supports scale/position/opacity transforms; rotation is deferred.
 */
export function buildFfmpegPlan(job: RenderJob): FfmpegPlan {
  const inputs: string[] = [];
  const inputIndex = (url: string): number => {
    let i = inputs.indexOf(url);
    if (i === -1) {
      inputs.push(url);
      i = inputs.length - 1;
    }
    return i;
  };

  const F: string[] = [];
  const { width: W, height: H, fps } = job;

  // Base sequence → [base]
  const segLabels: string[] = [];
  job.base.forEach((seg, k) => {
    const label = `bseg${k}`;
    if (seg.type === "black") {
      F.push(`color=c=black:s=${W}x${H}:r=${fps}:d=${seg.duration}[${label}]`);
    } else {
      const i = inputIndex(seg.url!);
      const speed = seg.speed ?? 1;
      const isStill = seg.srcIn === seg.srcOut;
      const trim = isStill
        ? `loop=loop=-1:size=1,trim=duration=${seg.duration}`
        : `trim=start=${seg.srcIn}:end=${seg.srcOut}`;
      F.push(
        `[${i}:v]${trim},setpts=(PTS-STARTPTS)/${speed},fps=${fps},` +
          `scale=${W}:${H}:force_original_aspect_ratio=decrease,` +
          `pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2,setsar=1[${label}]`
      );
    }
    segLabels.push(`[${label}]`);
  });
  let videoLabel: string;
  if (segLabels.length === 0) {
    F.push(`color=c=black:s=${W}x${H}:r=${fps}:d=${Math.max(job.duration, 0.1)}[base]`);
    videoLabel = "base";
  } else if (segLabels.length === 1) {
    videoLabel = segLabels[0].slice(1, -1);
  } else {
    F.push(`${segLabels.join("")}concat=n=${segLabels.length}:v=1:a=0[base]`);
    videoLabel = "base";
  }

  // Overlays stacked in track order → [v1], [v2], ...
  job.overlays.forEach((ov, k) => {
    const i = inputIndex(ov.url);
    const t = ov.transform;
    const ow = Math.round(W * t.scale);
    const isStill = ov.kind === "image";
    const trim = isStill
      ? `loop=loop=-1:size=1,trim=duration=${ov.end - ov.start}`
      : `trim=start=${ov.srcIn}:end=${ov.srcOut}`;
    const alpha =
      t.opacity < 1 ? `,format=yuva420p,colorchannelmixer=aa=${t.opacity}` : "";
    F.push(
      `[${i}:v]${trim},setpts=(PTS-STARTPTS)/${ov.speed}+${ov.start}/TB,fps=${fps},` +
        `scale=${ow}:-2${alpha}[ov${k}]`
    );
    const x = `(W-w)/2+${Math.round(t.x * W)}`;
    const y = `(H-h)/2+${Math.round(t.y * H)}`;
    const out = `v${k + 1}`;
    F.push(
      `[${videoLabel}][ov${k}]overlay=x=${x}:y=${y}:enable='between(t,${ov.start},${ov.end})'[${out}]`
    );
    videoLabel = out;
  });

  // Audio mix → [aout]
  let audioLabel: string;
  if (job.audio.length === 0) {
    F.push(`anullsrc=channel_layout=stereo:sample_rate=44100,atrim=duration=${Math.max(job.duration, 0.1)}[aout]`);
    audioLabel = "aout";
  } else {
    const aLabels: string[] = [];
    job.audio.forEach((a, k) => {
      const i = inputIndex(a.url);
      const dur = round((a.srcOut - a.srcIn) / a.speed);
      const parts = [
        `atrim=start=${a.srcIn}:end=${a.srcOut}`,
        `asetpts=PTS-STARTPTS`,
        ...atempoChain(a.speed),
        `volume=${a.volume}`,
      ];
      if (a.fadeIn > 0) parts.push(`afade=t=in:st=0:d=${a.fadeIn}`);
      if (a.fadeOut > 0) parts.push(`afade=t=out:st=${round(Math.max(0, dur - a.fadeOut))}:d=${a.fadeOut}`);
      parts.push(`aresample=44100`, `adelay=${Math.round(a.start * 1000)}|${Math.round(a.start * 1000)}`);
      F.push(`[${i}:a]${parts.join(",")}[a${k}]`);
      aLabels.push(`[a${k}]`);
    });
    if (aLabels.length === 1) {
      audioLabel = aLabels[0].slice(1, -1);
    } else {
      F.push(`${aLabels.join("")}amix=inputs=${aLabels.length}:duration=longest:normalize=0[aout]`);
      audioLabel = "aout";
    }
  }

  return { inputs, filterComplex: F.join(";"), videoLabel, audioLabel };
}

/** ffmpeg's atempo filter only accepts 0.5–2.0; chain instances for the rest. */
export function atempoChain(speed: number): string[] {
  if (Math.abs(speed - 1) < 1e-9) return [];
  const chain: string[] = [];
  let remaining = speed;
  while (remaining > 2.0) {
    chain.push("atempo=2.0");
    remaining /= 2.0;
  }
  while (remaining < 0.5) {
    chain.push("atempo=0.5");
    remaining /= 0.5;
  }
  chain.push(`atempo=${round(remaining)}`);
  return chain;
}

function round(v: number): number {
  return Math.round(v * 1e6) / 1e6;
}
