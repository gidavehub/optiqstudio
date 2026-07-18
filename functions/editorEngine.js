/**
 * Optiq Editor Engine — server-side renderer support (CommonJS).
 *
 * `buildFfmpegPlan` is a line-for-line port of lib/editor/edl.ts and MUST stay
 * behaviorally identical — scripts/test-render-parity.ts diffs the two
 * implementations' output on every engine change. The server never trusts a
 * client-built filtergraph: it accepts only RenderJob DATA, validates it here,
 * and builds the graph itself.
 */

"use strict";

const LIMITS = {
  maxDurationSec: 900,
  maxSegments: 200,
  maxOverlays: 60,
  maxAudio: 100,
  maxInputs: 60,
  maxSpeed: 16,
  minSpeed: 1 / 16,
};

function isFiniteNum(v) {
  return typeof v === "number" && Number.isFinite(v);
}

function assertHttpsUrl(url, what) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`${what}: invalid URL`);
  }
  if (parsed.protocol !== "https:") throw new Error(`${what}: only https URLs are allowed`);
}

/**
 * Structural + bounds validation of an untrusted RenderJob.
 * Throws Error with a client-safe message on the first violation.
 */
function validateRenderJob(job) {
  if (!job || typeof job !== "object") throw new Error("job must be an object");
  if (job.version !== 1) throw new Error("Unsupported render job version");
  if (!isFiniteNum(job.fps) || job.fps < 1 || job.fps > 60) throw new Error("fps out of range");
  if (!Number.isInteger(job.width) || !Number.isInteger(job.height)) {
    throw new Error("width/height must be integers");
  }
  if (job.width < 16 || job.width > 3840 || job.height < 16 || job.height > 3840) {
    throw new Error("width/height out of range");
  }
  if (!isFiniteNum(job.duration) || job.duration <= 0 || job.duration > LIMITS.maxDurationSec) {
    throw new Error(`duration must be 0..${LIMITS.maxDurationSec}s`);
  }
  if (!Array.isArray(job.base) || !Array.isArray(job.overlays) || !Array.isArray(job.audio)) {
    throw new Error("base/overlays/audio must be arrays");
  }
  if (job.base.length > LIMITS.maxSegments) throw new Error("too many base segments");
  if (job.overlays.length > LIMITS.maxOverlays) throw new Error("too many overlays");
  if (job.audio.length > LIMITS.maxAudio) throw new Error("too many audio entries");

  const urls = new Set();
  const checkSpeed = (s, what) => {
    if (!isFiniteNum(s) || s < LIMITS.minSpeed || s > LIMITS.maxSpeed) {
      throw new Error(`${what}: speed out of range`);
    }
  };

  for (const seg of job.base) {
    if (seg.type === "black") {
      if (!isFiniteNum(seg.duration) || seg.duration <= 0) throw new Error("black segment: bad duration");
      continue;
    }
    if (seg.type !== "media") throw new Error("base segment: unknown type");
    assertHttpsUrl(seg.url, "base segment");
    urls.add(seg.url);
    if (!isFiniteNum(seg.srcIn) || !isFiniteNum(seg.srcOut) || seg.srcIn < 0 || seg.srcOut < seg.srcIn) {
      throw new Error("base segment: bad src window");
    }
    if (!isFiniteNum(seg.duration) || seg.duration <= 0) throw new Error("base segment: bad duration");
    checkSpeed(seg.speed == null ? 1 : seg.speed, "base segment");
  }

  for (const ov of job.overlays) {
    assertHttpsUrl(ov.url, "overlay");
    urls.add(ov.url);
    if (!isFiniteNum(ov.start) || !isFiniteNum(ov.end) || ov.start < 0 || ov.end <= ov.start) {
      throw new Error("overlay: bad time window");
    }
    if (!isFiniteNum(ov.srcIn) || !isFiniteNum(ov.srcOut) || ov.srcIn < 0 || ov.srcOut < ov.srcIn) {
      throw new Error("overlay: bad src window");
    }
    checkSpeed(ov.speed, "overlay");
    const t = ov.transform;
    if (!t || typeof t !== "object") throw new Error("overlay: missing transform");
    for (const k of ["x", "y", "scale", "rotation", "opacity"]) {
      if (!isFiniteNum(t[k])) throw new Error(`overlay transform: ${k} not a number`);
    }
    if (t.scale <= 0 || t.scale > 8) throw new Error("overlay transform: scale out of range");
    if (t.opacity < 0 || t.opacity > 1) throw new Error("overlay transform: opacity out of range");
  }

  for (const a of job.audio) {
    assertHttpsUrl(a.url, "audio entry");
    urls.add(a.url);
    if (!isFiniteNum(a.srcIn) || !isFiniteNum(a.srcOut) || a.srcIn < 0 || a.srcOut <= a.srcIn) {
      throw new Error("audio entry: bad src window");
    }
    if (!isFiniteNum(a.start) || a.start < 0) throw new Error("audio entry: bad start");
    if (!isFiniteNum(a.volume) || a.volume < 0 || a.volume > 4) throw new Error("audio entry: volume out of range");
    if (!isFiniteNum(a.fadeIn) || a.fadeIn < 0 || !isFiniteNum(a.fadeOut) || a.fadeOut < 0) {
      throw new Error("audio entry: bad fades");
    }
    checkSpeed(a.speed, "audio entry");
  }

  if (urls.size > LIMITS.maxInputs) throw new Error("too many distinct input files");
  return job;
}

// ── ffmpeg plan (port of lib/editor/edl.ts — keep in lockstep) ──────────────

function round(v) {
  return Math.round(v * 1e6) / 1e6;
}

function atempoChain(speed) {
  if (Math.abs(speed - 1) < 1e-9) return [];
  const chain = [];
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

function buildFfmpegPlan(job) {
  const inputs = [];
  const inputIndex = (url) => {
    let i = inputs.indexOf(url);
    if (i === -1) {
      inputs.push(url);
      i = inputs.length - 1;
    }
    return i;
  };

  const F = [];
  const W = job.width;
  const H = job.height;
  const fps = job.fps;

  const segLabels = [];
  job.base.forEach((seg, k) => {
    const label = `bseg${k}`;
    if (seg.type === "black") {
      F.push(`color=c=black:s=${W}x${H}:r=${fps}:d=${seg.duration}[${label}]`);
    } else {
      const i = inputIndex(seg.url);
      const speed = seg.speed == null ? 1 : seg.speed;
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
  let videoLabel;
  if (segLabels.length === 0) {
    F.push(`color=c=black:s=${W}x${H}:r=${fps}:d=${Math.max(job.duration, 0.1)}[base]`);
    videoLabel = "base";
  } else if (segLabels.length === 1) {
    videoLabel = segLabels[0].slice(1, -1);
  } else {
    F.push(`${segLabels.join("")}concat=n=${segLabels.length}:v=1:a=0[base]`);
    videoLabel = "base";
  }

  job.overlays.forEach((ov, k) => {
    const i = inputIndex(ov.url);
    const t = ov.transform;
    const ow = Math.round(W * t.scale);
    const isStill = ov.kind === "image";
    const trim = isStill
      ? `loop=loop=-1:size=1,trim=duration=${ov.end - ov.start}`
      : `trim=start=${ov.srcIn}:end=${ov.srcOut}`;
    const alpha = t.opacity < 1 ? `,format=yuva420p,colorchannelmixer=aa=${t.opacity}` : "";
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

  let audioLabel;
  if (job.audio.length === 0) {
    F.push(
      `anullsrc=channel_layout=stereo:sample_rate=44100,atrim=duration=${Math.max(job.duration, 0.1)}[aout]`
    );
    audioLabel = "aout";
  } else {
    const aLabels = [];
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

module.exports = { validateRenderJob, buildFfmpegPlan, atempoChain, LIMITS };
