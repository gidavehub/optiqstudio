# Optiq Editor Engine — Staged Build Plan

Goal: replace the current project-route timeline with a full-viewport,
CapCut-grade video editor. The engine is built headless first (Stages 1–7);
nothing ships to the UI until Stage 8.

Theme contract (applies to everything built here): deep midnight blue canvas
`#0a0f1d`, surfaces `#0c152d` / `#0e1630` / `#131d35`, borders `white/5–10`,
accent `blue-500`, hover text `blue-400`, minimal text, mono uppercase micro
labels.

## Stage 0 — UI quick wins ✅ (2026-07-17)
- Storyboard run-time defaults to **30s**.
- Past-project cards are clip-first: autoplaying video thumbnail
  (`compileVideoUrl` → first succeeded scene), hover blur overlay, no text
  beyond a duration chip.
- Deep-blue restyle of the storyboard/project view in `app/dashboard/page.tsx`
  (neutral greys and purple glows → blue palette).

## Stage 1 — Headless engine core ✅ (2026-07-17)
`lib/editor/` — pure TypeScript, zero framework imports.
- `types.ts`: document model — multi-track (video/audio, ordered bottom→top),
  clips with `srcIn/srcOut/start/duration/speed/volume/fades/transform`,
  assets registry, `validateDoc` invariant checker.
- `engine.ts`: `EditorEngine` command layer — insert/move/trim/split/ripple/
  speed/props for clips, track CRUD, snapping helper, undo/redo (100 steps),
  transient transactions so a drag collapses to one undo entry,
  immutable snapshots + `subscribe()` (ready for `useSyncExternalStore`).

## Stage 2 — EDL compiler ✅ (2026-07-17)
- `edl.ts`: `compileRenderJob(doc)` flattens to a deterministic RenderJob —
  gap-filled base segment list, time-windowed overlays, explicit audio-mix
  entries (video-embedded audio + audio tracks, gains/fades/atempo/offsets).
- `buildFfmpegPlan(job)`: deduped inputs + complete `filter_complex`
  (concat, overlay with scale/position/opacity, amix). Rotation deferred.
- `bridge.ts`: `docFromLegacyProject()` converts existing Firestore projects
  (scenes/videoStatus/timeline/musicUrl) — no data migration needed.
- Tests: `scripts/test-editor-engine.ts` (22 cases) —
  `npx -y tsx scripts/test-editor-engine.ts`.

## Stage 3 — Server renderer v2 ✅ (2026-07-17)
- `functions/editorEngine.js` (CJS): `validateRenderJob` (rejects non-https
  URLs, out-of-range durations/speeds/opacity/canvas, NaNs, bad versions) +
  `buildFfmpegPlan` — a line-for-line port of `lib/editor/edl.ts`.
- `exports.renderJobV2` in `functions/index.js`: auth + project-ownership
  check, validates the job, replies 202, then renders in the background via
  `spawn("ffmpeg", args)` (no shell — arg array), uploads the MP4 to Storage,
  and streams status to the project doc as `renderV2Status` /
  `renderV2Url` / `renderV2Error` / `renderV2Job`. `projectCompile` untouched.
- Client route registered: `apiFetch("/api/project/render")` →
  `renderJobV2` in `components/AuthProvider.tsx` (not called until Stage 8).
- Tests: `scripts/test-render-parity.ts` (16 cases — TS↔JS plan parity +
  validator accept/reject) all pass; `scripts/smoke-render.ts` renders a real
  multi-track job with local ffmpeg and ffprobe-checks the duration (skips
  cleanly where ffmpeg is absent — RUN IT in an ffmpeg env before shipping).

Server-render field contract on the project doc:
`renderV2Status` = "rendering"|"succeeded"|"failed", `renderV2Url` (output
MP4), `renderV2Error` (message), `renderV2Job` (last submitted RenderJob).

## Stage 4 — Media intelligence ✅ (2026-07-17)
- `lib/editor/media.ts` (pure): `parseProbe` (ffprobe JSON → MediaMeta with
  duration/dims/fps/kind, still-image detection), `planFilmstrip` +
  `buildFilmstripArgs` (sprite-sheet grid), `buildPcmArgs` +
  `computeWaveform`/`waveformFromInt16LE` (normalized 0..1 peak envelope).
- `functions/mediaProbe.js`: CJS port + `probeMedia(localPath)` orchestrator
  (runs ffprobe/ffmpeg, returns meta + sprite buffer + waveform).
- `exports.mediaProbe` in `functions/index.js`: auth, https-only URL, downloads
  the asset, probes, uploads the sprite to `media/{uid}/{assetId}/filmstrip.jpg`,
  returns `{ meta, filmstrip:{url,cols,rows,frameCount,thumbWidth,thumbHeight,
  interval}, waveform:{buckets,peaks[]} }`, and best-effort writes a reusable
  `mediaIndex/{assetId}` doc. Client route NOT yet registered (added at Stage 8).
- Tests: `scripts/test-media-engine.ts` (16 — unit + TS↔JS parity) pass;
  `scripts/smoke-render.ts` now also probes the rendered file end-to-end
  (real sprite + waveform) when ffmpeg is present.

## Stage 5 — Client playback engine ✅ (2026-07-17)
- `lib/editor/playback.ts` (pure): `scheduleFrame(doc,t,playing)` computes the
  desired state — video layers bottom→top (base/overlay, active clip, seeked
  source time, transform, next-clip preroll hint) + audio voices (video-
  embedded AND audio tracks) with effective gain = track×clip×fade.
  Plus `clipAt`/`nextClip`/`sourceTimeAt`/`fadeGainAt`/`effectiveGain`/
  `needsResync`, and `PlaybackController` — headless transport (play/pause/
  seek/loop) advancing the playhead by wall-clock delta on `tick(now)` with an
  injectable clock, emitting frames to subscribers.
- `lib/editor/player.ts` (DOM adapter, untested in Node by design): reconciles
  one stacked `<video>`/`<audio>` element per track + a WebAudio GainNode each
  to the computed frame; drift-corrects via `needsResync`; drives `tick()` off
  requestAnimationFrame. Owns no timing/mixing logic.
- Tests: `scripts/test-playback-engine.ts` (16 — scheduling, fades, layering,
  audio mixing, deterministic-clock transport incl. loop/clamp) pass.

## Stage 6 — Interaction layer ✅ (2026-07-17)
- `lib/editor/timescale.ts` (pure): `timeToX`/`xToTime`, `zoomAround`
  (mouse-centered), `clampZoom`, `clampScroll`, `niceInterval`, `rulerTicks`
  (labelled majors), `formatTimecode`.
- `lib/editor/interactions.ts`: `InteractionController` over the engine — drag
  state machine for move / trim-start / trim-end via one transient transaction
  per gesture (whole drag = one undo), edge-snapping (only edges that actually
  land on an anchor snap; radius = px threshold ÷ live pxPerSecond), legal-track
  resolution (image can't cross to audio), and `razorAt`/`razorAllAt`.
- `lib/editor/shortcuts.ts` (pure): `resolveShortcut(event)` → EditorAction
  (playPause/split/delete/undo/redo/nudge/zoom/seek/toggleSnap/duplicate);
  ctrl+meta parity, ignores text-field typing.
- Tests: `scripts/test-interaction-engine.ts` (18) pass.

## Stage 7 — Persistence & realtime ✅ (2026-07-17)
- `lib/editor/persistence.ts` (pure): `sanitizeForStore` (deep-strips
  `undefined` so Firestore accepts optional fields), `serializeDoc`
  (validate + sanitize), `deserializeDoc` (migrate + validate), `hasStoredDoc`,
  and field constants `editorDoc` / `editorDocRev`.
- `lib/editor/autosave.ts`: `EditorAutosaver` — debounced writes (injectable
  timers), monotonic revisions, retry-keeps-dirty on save failure,
  `bindEngine()` to autosave every mutation, and `onRemote(rev)` conflict
  policy: dirty→keep-local (never clobber in-progress edits / undo history),
  clean+newer→adopt-remote, else ignore (own echo).
- Tests: `scripts/test-persistence-engine.ts` (11 — round-trips + fake-clock
  autosave/conflict) pass.
- Firestore wiring itself (updateDoc/onSnapshot) lands with the UI in Stage 8;
  this stage is the pure, tested policy those calls will use.

## Stage 8 — Full-viewport editor UI
CapCut layout in the project route: media bin (import, generated clips,
audio) / preview viewport / properties panel / multi-track timeline with
resizable panes, all scrollable containers, deep-blue theme. Replaces the
current storyboard timeline section entirely. Only lands once Stages 3–7 are
proven by scripts.

**Mode switch is a hard requirement.** The project route has TWO switchable
faces, and both must survive the rebuild:
1. the video editor timeline (this build), and
2. the script/prompt-engineering screen — scene prompts, including
   not-yet-generated scenes with their per-scene "generate" button.
Today this is the `productionMode` toggle ("auto-merge" ↔ "manual") with the
"Switch to Script Editor" button; the new editor must keep an equivalent
two-way switch on every project.

## Stage 9 — Surrounding-screens revamp (after Stage 8 is fully done)
Only once the editor UI is complete: restyle the script/prompt screen, the
generation/loading/downloading indicator screens, and every page leading into
the editor. Style/behavior/animation reference is the "Direct Your Vision"
page (wizard step 2). Guiding principle: **visual-first UI** — prefer images
and video clips over text everywhere (this is a video-generation platform;
project cards, pickers, confirmations, and modals should communicate with
media, not copy).
