"use client";

// EditorStudio — the CapCut-style full-viewport editor (Stage 8).
//
// Thin UI over the headless engine in lib/editor: EditorEngine owns the
// document, InteractionController owns drag/trim/razor, EditorPlayer owns
// playback, EditorAutosaver persists to the project doc (editorDoc field),
// and export compiles a RenderJob for the renderJobV2 Cloud Function.
//
// Layout: media bin | preview | properties over a full-width timeline, all
// four panes resizable by dragging the dividers. The dashboard's floating
// pills are hidden on this screen (see FloatingChrome), so the top bar
// carries the Optiq Studio brand itself.

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronLeft, Edit3, Images, Redo2, Undo2, Scissors, Trash2, Magnet,
  ZoomIn, ZoomOut, Loader2, Download, Zap, Film, Music2, AlertCircle,
} from "lucide-react";
import { doc as fsDoc, updateDoc } from "firebase/firestore";
import { db } from "../../../../lib/firebase";
import {
  EditorEngine, EditorPlayer, InteractionController, EditorAutosaver,
  EditorDoc, PlaybackFrame, docFromLegacyProject, deserializeDoc, syncSceneTakes,
  compileRenderJob, clampZoom, formatTimecode, EDITOR_DOC_FIELD, EDITOR_DOC_REV_FIELD,
  resolveShortcut, clipEnd, conformCanvas,
} from "../../../../lib/editor";
import { useEditorFlow } from "../../_flow/EditorFlowProvider";
import { useAuth } from "../../../../components/AuthProvider";
import OptiqMark from "../../../../components/OptiqMark";
import useIsMobile from "../../_shared/useIsMobile";
import { audioStageLabel, audioWorking as isAudioWorking } from "../../_shared/audioStages";
import PreviewStage from "./PreviewStage";
import TimelinePanel from "./TimelinePanel";
import MediaBin from "./MediaBin";
import PropertiesPanel from "./PropertiesPanel";
import MobileEditorDock from "./MobileEditorDock";

export type EditorTool = "select" | "razor";

interface EditorStudioProps {
  project: any;
}

const clampPx = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

// A render that hasn't reported back within the function's own ceiling is
// treated as abandoned, so Export can never stay disabled forever.
const RENDER_STALE_MS = 12 * 60 * 1000;

export default function EditorStudio({ project }: EditorStudioProps) {
  const { setProductionMode, goHome, audioStage, audioReport, requestAudioPost } = useEditorFlow();
  const { apiFetch } = useAuth();
  const isMobile = useIsMobile();
  const router = useRouter();

  // ── Remote document adoption ───────────────────────────────────────────
  //
  // The audio pass runs server-side and finishes by writing a whole document —
  // the cut it was given, plus the score and the narration — at a bumped
  // revision. Without adopting it the editor would keep showing (and keep
  // autosaving) the silent document it opened with, quietly undoing the pass.
  //
  // The autosaver owns the policy: a dirty buffer keeps local, so this can never
  // take an edit-in-progress away. Adoption is a session rebuild, which is why
  // the revision is part of the session key below.
  const remoteRev = Number(project?.[EDITOR_DOC_REV_FIELD] ?? 0);
  const [adoptedRev, setAdoptedRev] = useState(remoteRev);

  // ── Engine session (one per project id + adopted revision) ─────────────
  const session = useMemo(() => {
    let initial: EditorDoc;
    try {
      initial = project?.[EDITOR_DOC_FIELD]
        ? deserializeDoc(project[EDITOR_DOC_FIELD])
        : docFromLegacyProject(project ?? {});
    } catch {
      initial = docFromLegacyProject(project ?? {});
    }
    const engine = new EditorEngine(initial);
    const interactionOpts = {
      snapEnabled: true,
      snapThresholdPx: 8,
      getPxPerSecond: () => 0, // replaced below once state exists
      getPlayhead: () => 0 as number | undefined,
    };
    const interaction = new InteractionController(engine, interactionOpts);
    const autosaver = new EditorAutosaver({
      initialRev: Number(project?.[EDITOR_DOC_REV_FIELD] ?? 0),
      save: async (payload) => {
        await updateDoc(fsDoc(db, "projects", project.id), {
          [EDITOR_DOC_FIELD]: payload.doc,
          [EDITOR_DOC_REV_FIELD]: payload.rev,
          updatedAt: new Date().toISOString(),
        });
      },
    });
    // The saved document was built from whichever takes existed then; scenes
    // re-rendered since point at new URLs. Adopt them here, before the engine
    // is bound and before the first frame is drawn, so the timeline never shows
    // a clip the director has already replaced. Binding afterwards keeps this
    // out of the autosaver — the mount effect below persists it instead, since
    // a Firestore write must not be a side effect of rendering.
    const repointed = syncSceneTakes(engine, project?.videoStatus);
    // Same reasoning for the canvas: a document saved before the canvas was
    // derived from the ad's orientation carries a hardcoded landscape frame, so
    // a vertical film would preview and export letterboxed. Conform before the
    // engine is bound and before the first frame is drawn.
    const reshaped = conformCanvas(engine, project?.aspectRatio);
    const unbind = autosaver.bindEngine(engine);
    return { engine, interaction, interactionOpts, autosaver, unbind, repointed, reshaped };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project?.id, adoptedRev]);

  const { engine, interaction, interactionOpts, autosaver } = session;

  // ── Reactive state ─────────────────────────────────────────────────────
  const [doc, setDoc] = useState<EditorDoc>(engine.getDoc());
  const [frame, setFrame] = useState<PlaybackFrame | null>(null);
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);

  // A rebuilt session — a different project, or a document adopted from the
  // server — brings a different engine, and this mirror is still holding the
  // last one's document. Reset it during render rather than in an effect so the
  // panes never paint the previous timeline for a frame, and drop the selection
  // with it, since the clip it names belongs to the document being replaced.
  const [docSession, setDocSession] = useState(session);
  if (docSession !== session) {
    setDocSession(session);
    setDoc(engine.getDoc());
    setSelectedClipId(null);
  }
  const [pps, setPps] = useState(60); // pixels per second
  const [tool, setTool] = useState<EditorTool>("select");
  const [snapOn, setSnapOn] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  // Resizable panes
  const [binW, setBinW] = useState(232);
  const [propsW, setPropsW] = useState(232);
  const [timelineH, setTimelineH] = useState(240);

  const playerRef = useRef<EditorPlayer | null>(null);
  const ppsRef = useRef(pps);
  ppsRef.current = pps;

  // Keep the interaction controller reading live zoom + playhead
  interactionOpts.getPxPerSecond = () => ppsRef.current;
  interactionOpts.getPlayhead = () => playerRef.current?.controller.getTime();
  interactionOpts.snapEnabled = snapOn;

  // Ask the autosaver whether the stored revision beats ours. It answers
  // "keep-local" whenever there is an unsaved edit or a save in flight, so an
  // arriving score can never pull the document out from under a drag.
  //
  // In an effect and not in render because `onRemote` MUTATES the autosaver's
  // base revision — it is the decision and the acknowledgement in one call, so
  // it must not run on a render that React might discard.
  useEffect(() => {
    if (remoteRev === adoptedRev) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reacting to an external store; the extra pass is the point
    if (autosaver.onRemote(remoteRev) === "adopt-remote") setAdoptedRev(remoteRev);
  }, [remoteRev, adoptedRev, autosaver]);

  useEffect(() => {
    const unsub = engine.subscribe((d) => {
      setDoc(d);
      playerRef.current?.setDoc(d);
    });
    // Persist the take adoption and canvas conform the session did on the way up.
    if (session.repointed > 0 || session.reshaped) session.autosaver.markDirty(engine.getDoc());
    return () => {
      unsub();
      session.unbind();
      void session.autosaver.flush();
      session.autosaver.dispose();
    };
  }, [engine, session]);

  // A scene re-rendered (or a take switched) in the script editor changes the
  // project's clip URLs under an open timeline. Keyed on the URLs themselves —
  // the project object is rebuilt on every parent render, so its identity says
  // nothing about whether the clips actually moved.
  const takeSignature = useMemo(() => {
    const scenes: Record<string, { url?: string } | undefined> = project?.videoStatus ?? {};
    return Object.entries(scenes)
      .map(([idx, s]) => `${idx}:${s?.url ?? ""}`)
      .join("|");
  }, [project?.videoStatus]);

  useEffect(() => {
    syncSceneTakes(engine, project?.videoStatus);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine, takeSignature]);

  const handlePlayer = useCallback((player: EditorPlayer | null) => {
    playerRef.current = player;
    if (!player) return;
    player.controller.subscribe((f) => setFrame(f));
  }, []);

  const playhead = frame?.time ?? 0;

  // ── Pane resize gestures ───────────────────────────────────────────────
  const startResize = (e: React.PointerEvent, pane: "bin" | "props" | "timeline") => {
    e.preventDefault();
    const startX = e.clientX;
    const startY = e.clientY;
    const initial = pane === "bin" ? binW : pane === "props" ? propsW : timelineH;
    const onMove = (ev: PointerEvent) => {
      if (pane === "bin") setBinW(clampPx(initial + (ev.clientX - startX), 168, 480));
      else if (pane === "props") setPropsW(clampPx(initial - (ev.clientX - startX), 168, 480));
      else setTimelineH(clampPx(initial - (ev.clientY - startY), 130, 520));
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  // ── Keyboard shortcuts ─────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const editing =
        !!target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);
      const action = resolveShortcut({
        key: e.key, ctrlKey: e.ctrlKey, shiftKey: e.shiftKey,
        altKey: e.altKey, metaKey: e.metaKey, isEditingText: editing,
      });
      if (!action) return;
      e.preventDefault();
      const player = playerRef.current;
      switch (action.type) {
        case "playPause": player?.toggle(); break;
        case "split": interaction.razorAllAt(player?.controller.getTime() ?? 0); break;
        case "delete": if (selectedClipId) { engine.removeClip(selectedClipId); setSelectedClipId(null); } break;
        case "undo": engine.undo(); break;
        case "redo": engine.redo(); break;
        case "nudge": {
          const step = action.frame ? 1 / engine.getDoc().fps : 1;
          player?.seek((player.controller.getTime() ?? 0) + (action.direction === "left" ? -step : step));
          break;
        }
        case "zoom": setPps((p) => clampZoom(action.direction === "in" ? p * 1.3 : p / 1.3)); break;
        case "seek": player?.seek(action.to === "start" ? 0 : engine.getDoc().duration); break;
        case "toggleSnap": setSnapOn((s) => !s); break;
        case "duplicate": {
          if (!selectedClipId) break;
          const loc = engine.findClip(selectedClipId);
          if (loc) {
            engine.insertClip(loc.track.id, {
              assetId: loc.clip.assetId, start: clipEnd(loc.clip),
              duration: loc.clip.duration, srcIn: loc.clip.srcIn,
              speed: loc.clip.speed, volume: loc.clip.volume, label: loc.clip.label,
            });
          }
          break;
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [engine, interaction, selectedClipId]);

  // ── Export (renderJobV2) ───────────────────────────────────────────────
  const renderStatus: string = project?.renderV2Status ?? "idle";
  const renderUrl: string | undefined = project?.renderV2Url;

  // Safety valve: a render that never reported back (instance reclaimed, or the
  // 540s function timeout hit) would otherwise leave renderV2Status on
  // "rendering" forever — which disables Export permanently, with no way out.
  // Past the function's own ceiling we treat it as abandoned and allow a retry.
  const renderStartedAt = project?.renderV2StartedAt ? Date.parse(project.renderV2StartedAt) : NaN;

  // The clock is read on a timer, never during render (reading it while
  // rendering is impure, and a plain expression would only re-evaluate when
  // something else happened to re-render). Ticking state means the button
  // frees itself while the user is sitting there watching it.
  const [nowTs, setNowTs] = useState(0);
  useEffect(() => {
    const tick = () => setNowTs(Date.now());
    const first = setTimeout(tick, 0);
    const id = setInterval(tick, 30_000);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, []);

  const renderStalled =
    renderStatus === "rendering" &&
    Number.isFinite(renderStartedAt) &&
    nowTs > 0 &&
    nowTs - renderStartedAt > RENDER_STALE_MS;

  const handleExport = async () => {
    if (exporting) return;
    setExportError(null);
    try {
      const job = compileRenderJob(engine.getDoc());
      if (job.duration <= 0) throw new Error("Timeline is empty — add clips before exporting.");
      setExporting(true);
      await autosaver.flush();
      await apiFetch("/api/project/render", {
        method: "POST",
        body: JSON.stringify({ projectId: project.id, job }),
      });
    } catch (err: any) {
      setExportError(err?.message ?? "Export failed");
    } finally {
      setExporting(false);
    }
  };

  const rendering = exporting || (renderStatus === "rendering" && !renderStalled);

  // Every stage of the audio pass except its two terminal ones. Reachable here
  // only for a RE-score: a first pass now finishes before the timeline opens.
  const audioWorking = isAudioWorking(audioStage);
  const audioNotes = (audioReport?.notes as string[] | undefined) ?? [];
  const audioViolations = (audioReport?.violations as string[] | undefined) ?? [];

  return (
    <div className="flex h-full flex-col bg-background text-foreground overflow-hidden select-none">
      {/* ── TOP BAR ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3 border-b border-line bg-surface/90 px-4 py-2.5 backdrop-blur-md shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={goHome}
            className="flex items-center gap-1 rounded-xl bg-surface border border-line px-2.5 py-1.5 text-[11px] font-semibold text-ink-3 hover:text-foreground hover:bg-surface-2 transition-colors shrink-0"
          >
            <ChevronLeft size={12} /> Portal
          </button>

          {/* Optiq Studio brand (the floating pills are hidden in this editor) */}
          <div className="hidden sm:flex items-center gap-2 shrink-0">
            <OptiqMark size={18} />
            <span className="tabular-nums text-[12px] font-bold tracking-tight lowercase text-foreground">
              optiq studio
            </span>
          </div>

          <span className="hidden sm:block h-4 w-px bg-surface-2 shrink-0" />

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Film size={13} className="text-accent-ink shrink-0" />
              <h1 className="text-xs font-bold text-foreground truncate max-w-[110px] sm:max-w-[260px]">{project?.title || "Untitled Film"}</h1>
              <span className="hidden sm:inline rounded-lg bg-surface border border-accent-line px-1.5 py-0.5 text-[8px] tabular-nums font-bold uppercase tracking-wider text-accent-ink shrink-0">
                Timeline Editor
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className={`hidden sm:inline text-[9px] tabular-nums uppercase tracking-wider ${autosaver.isDirty ? "text-orange" : "text-faint"}`}>
            {autosaver.isDirty ? "● Saving…" : "● Saved"}
          </span>

          {/* Audio post-production. The score and voiceover are written against
              the finished cut, so this runs itself once every scene lands; the
              button is only for re-running it or recovering from a failure. */}
          {audioWorking ? (
            <span className="hidden md:flex items-center gap-1.5 rounded-xl border border-accent-line bg-surface px-2.5 py-1.5 text-[10px] font-semibold text-accent-ink">
              <Loader2 size={10} className="animate-spin" />
              {audioStageLabel(audioStage)}
            </span>
          ) : (
            <button
              onClick={() => void requestAudioPost()}
              title={
                audioStage === "ready"
                  ? "Re-score and re-narrate this cut"
                  : audioStage === "failed"
                    ? "Scoring failed — try again"
                    : "Score and narrate this cut"
              }
              className={`flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-[11px] font-semibold transition-all active:scale-95 ${
                audioStage === "failed"
                  ? "border-danger bg-danger-soft text-danger hover:bg-danger-soft"
                  : "border-line bg-surface text-ink-3 hover:bg-surface-2 hover:text-accent-ink"
              }`}
            >
              <Music2 size={11} />
              <span className="hidden lg:inline">{audioStage === "ready" ? "Re-score" : "Score"}</span>
            </button>
          )}
          {/* This editor owns its navigation (the floating WorkspaceModeBar is
              hidden here), so both other faces have to be reachable from it. */}
          <button
            onClick={() => router.push(`/dashboard/project/${project?.id}/agent`)}
            aria-label="Optiq Agent"
            title="Optiq Agent"
            className="flex items-center gap-1.5 rounded-xl bg-surface border border-line px-2.5 sm:px-3 py-1.5 text-[11px] font-semibold hover:bg-surface-2 hover:text-accent-ink active:scale-95 transition-all"
          >
            <OptiqMark size={12} /> <span className="hidden md:inline">Optiq Agent</span>
          </button>
          <button
            onClick={() => setProductionMode("manual")}
            aria-label="Script editor"
            title="Script editor"
            className="flex items-center gap-1.5 rounded-xl bg-surface border border-line px-2.5 sm:px-3 py-1.5 text-[11px] font-semibold hover:bg-surface-2 hover:text-accent-ink active:scale-95 transition-all"
          >
            <Edit3 size={11} /> <span className="hidden md:inline">Script</span>
          </button>
          <button
            onClick={() => router.push(`/dashboard/project/${project?.id}/board`)}
            aria-label="Board shots"
            title="Board shots"
            className="flex items-center gap-1.5 rounded-xl bg-surface border border-line px-2.5 sm:px-3 py-1.5 text-[11px] font-semibold hover:bg-surface-2 hover:text-accent-ink active:scale-95 transition-all"
          >
            <Images size={11} /> <span className="hidden md:inline">Board</span>
          </button>
          {renderStatus === "succeeded" && renderUrl ? (
            <a
              href={renderUrl}
              download={`${(project?.title || "film").replace(/\s+/g, "_")}.mp4`}
              className="flex items-center gap-1.5 rounded-xl bg-success-soft border border-success px-3 py-1.5 text-[11px] font-bold text-success hover:bg-success-soft transition-colors"
            >
              <Download size={11} /> Download Film
            </a>
          ) : null}
          <button
            onClick={handleExport}
            disabled={rendering}
            className="flex items-center gap-1.5 rounded-xl bg-accent hover:bg-accent-hover disabled:opacity-50 px-4 py-1.5 text-[11px] font-bold text-white transition-colors shadow-lg shadow-accent/15"
          >
            {rendering ? <Loader2 size={11} className="animate-spin" /> : <Zap size={11} />}
            {rendering ? "Rendering…" : "Export Film"}
          </button>
        </div>
      </div>

      {exportError && (
        <div className="mx-4 mt-2 rounded-xl border border-danger bg-danger-soft px-3 py-2 text-[11px] text-danger shrink-0">
          Export error: {exportError}
        </div>
      )}
      {renderStatus === "failed" && project?.renderV2Error && (
        <div className="mx-4 mt-2 rounded-xl border border-danger bg-danger-soft px-3 py-2 text-[11px] text-danger shrink-0">
          Last render failed: {project.renderV2Error}
        </div>
      )}
      {renderStalled && (
        <div className="mx-4 mt-2 rounded-xl border border-orange bg-orange-soft px-3 py-2 text-[11px] text-orange shrink-0">
          The previous render stopped responding and was abandoned. You can export again.
        </div>
      )}
      {audioStage === "failed" && project?.audioError && (
        <div className="mx-4 mt-2 rounded-xl border border-danger bg-danger-soft px-3 py-2 text-[11px] text-danger shrink-0">
          Scoring failed: {project.audioError}
        </div>
      )}
      {/* What the pass could not do. Worth saying plainly — a dropped line or an
          unscored tail is the director's call to fix, not ours to hide. */}
      {audioStage === "ready" && (audioNotes.length > 0 || audioViolations.length > 0) && (
        <div className="mx-4 mt-2 flex items-start gap-2 rounded-xl border border-orange bg-orange-soft px-3 py-2 text-[11px] text-orange shrink-0">
          <AlertCircle size={12} className="mt-0.5 shrink-0" />
          <div className="min-w-0 space-y-0.5">
            {[...audioViolations, ...audioNotes].slice(0, 3).map((note, i) => (
              <p key={i}>{note}</p>
            ))}
          </div>
        </div>
      )}

      {/* ── MAIN ROW ─────────────────────────────────────────────────────
          Desktop: bin | preview | properties, all resizable.
          Mobile: just the preview — the bin becomes a filmstrip under it and
          properties becomes a sheet that rises when a clip is selected. */}
      {isMobile ? (
        <div className="flex min-h-0 flex-1 flex-col bg-surface">
          <PreviewStage engine={engine} onPlayer={handlePlayer} frame={frame} />
        </div>
      ) : (
        <>
          <div className="flex min-h-0 flex-1">
            <MediaBin project={project} engine={engine} doc={doc} playhead={playhead} width={binW} />

            {/* Bin ↔ preview divider */}
            <div
              onPointerDown={(e) => startResize(e, "bin")}
              className="group relative z-10 -mx-[3px] w-[7px] shrink-0 cursor-col-resize"
            >
              <div className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-transparent transition-colors group-hover:bg-accent group-active:bg-accent" />
            </div>

            <div className="flex min-w-0 flex-1 flex-col bg-surface">
              <PreviewStage engine={engine} onPlayer={handlePlayer} frame={frame} />
            </div>

            {/* Preview ↔ properties divider */}
            <div
              onPointerDown={(e) => startResize(e, "props")}
              className="group relative z-10 -mx-[3px] w-[7px] shrink-0 cursor-col-resize"
            >
              <div className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-transparent transition-colors group-hover:bg-accent group-active:bg-accent" />
            </div>

            <PropertiesPanel
              engine={engine}
              doc={doc}
              selectedClipId={selectedClipId}
              onDeselect={() => setSelectedClipId(null)}
              playhead={playhead}
              width={propsW}
            />
          </div>

          {/* Main row ↔ timeline divider */}
          <div
            onPointerDown={(e) => startResize(e, "timeline")}
            className="group relative z-10 -my-[3px] h-[7px] shrink-0 cursor-row-resize"
          >
            <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-transparent transition-colors group-hover:bg-accent group-active:bg-accent" />
          </div>
        </>
      )}

      {/* ── TIMELINE TOOLBAR (desktop only) ───────────────────────────────
          Scrolls sideways rather than wrapping or clipping. On phones this is
          replaced by the CapCut-style MobileEditorDock below the timeline. */}
      {!isMobile && (
      <div className="flex items-center justify-between gap-2 overflow-x-auto border-t border-line bg-background px-3 py-1.5 shrink-0 scrollbar-none">
        <div className="flex items-center gap-1 shrink-0">
          <ToolButton title="Undo (Ctrl+Z)" disabled={!engine.canUndo()} onClick={() => engine.undo()}>
            <Undo2 size={13} />
          </ToolButton>
          <ToolButton title="Redo (Ctrl+Shift+Z)" disabled={!engine.canRedo()} onClick={() => engine.redo()}>
            <Redo2 size={13} />
          </ToolButton>
          <span className="mx-1 h-4 w-px bg-surface-2" />
          <ToolButton
            title="Razor tool (click clips to split)"
            active={tool === "razor"}
            onClick={() => setTool(tool === "razor" ? "select" : "razor")}
          >
            <Scissors size={13} />
          </ToolButton>
          <ToolButton
            title="Split all tracks at playhead (S)"
            onClick={() => interaction.razorAllAt(playhead)}
          >
            <Scissors size={13} className="rotate-90" />
          </ToolButton>
          <ToolButton
            title="Delete selected clip (Del)"
            disabled={!selectedClipId}
            onClick={() => {
              if (selectedClipId) {
                engine.removeClip(selectedClipId);
                setSelectedClipId(null);
              }
            }}
          >
            <Trash2 size={13} />
          </ToolButton>
          <ToolButton title="Toggle magnetic snapping (M)" active={snapOn} onClick={() => setSnapOn(!snapOn)}>
            <Magnet size={13} />
          </ToolButton>
        </div>

        <div className="flex items-center gap-2 tabular-nums text-[10px] text-muted">
          <span className="text-foreground font-bold">{formatTimecode(playhead, doc.fps)}</span>
          <span>/</span>
          <span>{formatTimecode(doc.duration, doc.fps)}</span>
        </div>

        <div className="flex items-center gap-1.5">
          <ToolButton title="Zoom out (-)" onClick={() => setPps((p) => clampZoom(p / 1.3))}>
            <ZoomOut size={13} />
          </ToolButton>
          <input
            type="range"
            min={4}
            max={600}
            value={pps}
            onChange={(e) => setPps(clampZoom(Number(e.target.value)))}
            className="w-28 accent-accent h-1"
          />
          <ToolButton title="Zoom in (+)" onClick={() => setPps((p) => clampZoom(p * 1.3))}>
            <ZoomIn size={13} />
          </ToolButton>
        </div>
      </div>
      )}

      {/* ── TIMELINE ────────────────────────────────────────────────────── */}
      <TimelinePanel
        engine={engine}
        interaction={interaction}
        doc={doc}
        pps={pps}
        playhead={playhead}
        height={isMobile ? 176 : timelineH}
        tool={tool}
        selectedClipId={selectedClipId}
        onSelect={setSelectedClipId}
        onSeek={(t) => playerRef.current?.seek(t)}
      />

      {/* ── MOBILE: CapCut-style tool dock (tray + Add/Adjust sheets) ───── */}
      {isMobile && (
        <MobileEditorDock
          engine={engine}
          interaction={interaction}
          doc={doc}
          playhead={playhead}
          project={project}
          binWidth={binW}
          selectedClipId={selectedClipId}
          onSelect={setSelectedClipId}
        />
      )}
    </div>
  );
}

function ToolButton({
  children, onClick, title, disabled, active,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title: string;
  disabled?: boolean;
  active?: boolean;
}) {
  return (
    <button
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={`flex h-7 min-w-7 items-center justify-center rounded-lg border px-1.5 transition-colors disabled:opacity-30 ${
        active
          ? "border-accent bg-surface text-accent-ink"
          : "border-transparent text-ink-3 hover:text-foreground hover:bg-surface"
      }`}
    >
      {children}
    </button>
  );
}
