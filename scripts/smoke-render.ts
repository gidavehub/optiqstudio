/**
 * Live ffmpeg smoke test for the editor engine's render plans.
 * Run: npx -y tsx scripts/smoke-render.ts
 *
 * Requires ffmpeg + ffprobe on PATH (exits 0 with a notice if missing, so it
 * is safe in any environment). Synthesizes test media locally, builds a
 * multi-track document through the real engine (trims, gap, speed change,
 * image overlay with opacity, bgm with fades), renders it with the exact
 * argument layout renderJobV2 uses, and checks the output duration.
 */

import { spawnSync } from "node:child_process";
import { mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createRequire } from "node:module";
import {
  EditorEngine,
  createEmptyDoc,
  compileRenderJob,
  buildFfmpegPlan,
} from "../lib/editor";

function run(cmd: string, args: string[]): { ok: boolean; stderr: string; stdout: string } {
  const r = spawnSync(cmd, args, { encoding: "utf8" });
  return { ok: r.status === 0, stderr: r.stderr ?? "", stdout: r.stdout ?? "" };
}

if (!run("ffmpeg", ["-version"]).ok) {
  console.log("ffmpeg not found on PATH — smoke test skipped (run where ffmpeg is installed).");
  process.exit(0);
}

const work = join(tmpdir(), `optiq_smoke_${Date.now()}`);
mkdirSync(work, { recursive: true });

async function main() {
  // 1. Synthesize inputs (each with an audio stream, like real generated clips).
  const aPath = join(work, "a.mp4");
  const bPath = join(work, "b.mp4");
  const songPath = join(work, "song.wav");
  const logoPath = join(work, "logo.png");

  const gen = (args: string[], label: string) => {
    const r = run("ffmpeg", ["-y", ...args]);
    if (!r.ok) throw new Error(`failed generating ${label}:\n${r.stderr.slice(-800)}`);
  };
  gen(["-f", "lavfi", "-i", "testsrc=size=640x360:rate=30:duration=4",
       "-f", "lavfi", "-i", "sine=frequency=440:duration=4",
       "-c:v", "libx264", "-preset", "ultrafast", "-c:a", "aac", "-shortest", aPath], "a.mp4");
  gen(["-f", "lavfi", "-i", "smptebars=size=640x360:rate=30:duration=4",
       "-f", "lavfi", "-i", "sine=frequency=880:duration=4",
       "-c:v", "libx264", "-preset", "ultrafast", "-c:a", "aac", "-shortest", bPath], "b.mp4");
  gen(["-f", "lavfi", "-i", "sine=frequency=220:duration=12", songPath], "song.wav");
  gen(["-f", "lavfi", "-i", "color=c=white:size=160x90:d=0.1", "-frames:v", "1", logoPath], "logo.png");

  // 2. Build the document through the engine. Fake https URLs map to the local files.
  const urlMap: Record<string, string> = {
    "https://smoke.test/a.mp4": aPath,
    "https://smoke.test/b.mp4": bPath,
    "https://smoke.test/song.wav": songPath,
    "https://smoke.test/logo.png": logoPath,
  };

  const e = new EditorEngine(createEmptyDoc({ width: 640, height: 360, fps: 30 }));
  const vTrack = e.getDoc().tracks[0].id;
  const aTrack = e.getDoc().tracks[1].id;
  const a = e.addAsset({ kind: "video", url: "https://smoke.test/a.mp4", duration: 4 });
  const b = e.addAsset({ kind: "video", url: "https://smoke.test/b.mp4", duration: 4 });
  const song = e.addAsset({ kind: "audio", url: "https://smoke.test/song.wav", duration: 12 });
  const logo = e.addAsset({ kind: "image", url: "https://smoke.test/logo.png" });

  e.insertClip(vTrack, { assetId: a, start: 0, srcIn: 0.5, duration: 2 });   // trimmed clip
  const fast = e.insertClip(vTrack, { assetId: b, start: 3, duration: 3 });  // 1s gap before
  e.setClipSpeed(fast, 2);                                                    // → 2s at 2x
  const ovTrack = e.addTrack("video", "Overlay");
  const ov = e.insertClip(ovTrack, { assetId: logo, start: 1, duration: 3 });
  e.setClipProps(ov, { transform: { x: 0.3, y: -0.3, scale: 0.2, rotation: 0, opacity: 0.8 } });
  const bgm = e.insertClip(aTrack, { assetId: song, start: 0, duration: 5, volume: 0.3 });
  e.setClipProps(bgm, { fadeIn: 0.3, fadeOut: 0.5 });

  const job = compileRenderJob(e.getDoc());
  const plan = buildFfmpegPlan(job);

  // 3. Render with renderJobV2's exact argument layout.
  const outPath = join(work, "out.mp4");
  const args = ["-y"];
  for (const url of plan.inputs) args.push("-i", urlMap[url]);
  args.push(
    "-filter_complex", plan.filterComplex,
    "-map", `[${plan.videoLabel}]`,
    "-map", `[${plan.audioLabel}]`,
    "-c:v", "libx264", "-preset", "veryfast", "-crf", "21", "-pix_fmt", "yuv420p",
    "-c:a", "aac", "-b:a", "192k", "-ar", "44100", "-ac", "2",
    "-t", String(job.duration),
    "-movflags", "+faststart",
    outPath
  );
  const render = run("ffmpeg", args);
  if (!render.ok) throw new Error(`render failed:\n${render.stderr.slice(-1500)}`);
  if (!existsSync(outPath)) throw new Error("render reported success but out.mp4 missing");

  // 4. Verify duration with ffprobe (expected: doc duration = 5s).
  const probe = run("ffprobe", [
    "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", outPath,
  ]);
  if (!probe.ok) throw new Error(`ffprobe failed:\n${probe.stderr.slice(-500)}`);
  const measured = parseFloat(probe.stdout.trim());
  if (!(Math.abs(measured - job.duration) < 0.25)) {
    throw new Error(`duration mismatch: expected ~${job.duration}s, got ${measured}s`);
  }

  console.log(`SMOKE OK (render) — ${measured.toFixed(2)}s (expected ${job.duration}s) at ${outPath}`);

  // 5. Media intelligence: probe the rendered file for real metadata,
  //    filmstrip sprite, and waveform (exactly what the mediaProbe fn runs).
  const require_ = createRequire(import.meta.url);
  const { probeMedia } = require_("../functions/mediaProbe.js") as {
    probeMedia: (p: string, o: any) => Promise<any>;
  };
  const probed = await probeMedia(outPath, {});
  if (probed.meta.kind !== "video") throw new Error(`expected video, got ${probed.meta.kind}`);
  if (!(probed.meta.duration && Math.abs(probed.meta.duration - job.duration) < 0.3)) {
    throw new Error(`probe duration off: ${probed.meta.duration}`);
  }
  if (!probed.filmstrip || probed.filmstrip.buffer.length < 1000) {
    throw new Error("filmstrip sprite missing or too small");
  }
  if (!probed.waveform || probed.waveform.peaks.length === 0) {
    throw new Error("waveform peaks missing");
  }
  const maxPeak = Math.max(...probed.waveform.peaks);
  if (!(maxPeak > 0)) throw new Error("waveform is silent — audio not detected");
  console.log(
    `SMOKE OK (media) — ${probed.filmstrip.plan.frameCount} thumbs ` +
    `(${probed.filmstrip.plan.cols}x${probed.filmstrip.plan.rows}), ` +
    `${probed.waveform.peaks.length} waveform buckets, max peak ${maxPeak.toFixed(3)}`
  );
  console.log("(work dir left in place for manual inspection)");
}

main().catch((err: any) => {
  console.error(`SMOKE FAILED: ${err?.message ?? err}`);
  process.exit(1);
});
