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
import {
  ChevronLeft, Edit3, Redo2, Undo2, Scissors, Trash2, Magnet,
  ZoomIn, ZoomOut, Loader2, Download, Zap, Film,
} from "lucide-react";
import { doc as fsDoc, updateDoc } from "firebase/firestore";
import { db } from "../../../../lib/firebase";
import {
  EditorEngine, EditorPlayer, InteractionController, EditorAutosaver,
  EditorDoc, PlaybackFrame, docFromLegacyProject, deserializeDoc,
  compileRenderJob, clampZoom, formatTimecode, EDITOR_DOC_FIELD, EDITOR_DOC_REV_FIELD,
  resolveShortcut, clipEnd,
} from "../../../../lib/editor";
import { useEditorFlow } from "../../_flow/EditorFlowProvider";
import { useAuth } from "../../../../components/AuthProvider";
import useIsMobile from "../../_shared/useIsMobile";
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
  const { setProductionMode, goHome } = useEditorFlow();
  const { apiFetch } = useAuth();
  const isMobile = useIsMobile();

  // ── Engine session (one per project id) ────────────────────────────────
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
    const unbind = autosaver.bindEngine(engine);
    return { engine, interaction, interactionOpts, autosaver, unbind };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project?.id]);

  const { engine, interaction, interactionOpts, autosaver } = session;

  // ── Reactive state ─────────────────────────────────────────────────────
  const [doc, setDoc] = useState<EditorDoc>(engine.getDoc());
  const [frame, setFrame] = useState<PlaybackFrame | null>(null);
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
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

  useEffect(() => {
    const unsub = engine.subscribe((d) => {
      setDoc(d);
      playerRef.current?.setDoc(d);
    });
    return () => {
      unsub();
      session.unbind();
      void session.autosaver.flush();
      session.autosaver.dispose();
    };
  }, [engine, session]);

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

  return (
    <div className="flex h-full flex-col bg-[#070b16] text-neutral-200 overflow-hidden select-none">
      {/* ── TOP BAR ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3 border-b border-white/5 bg-[#0a0f1d]/95 px-4 py-2.5 backdrop-blur-md shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={goHome}
            className="flex items-center gap-1 rounded-lg bg-white/5 border border-white/5 px-2.5 py-1.5 text-[11px] font-semibold text-neutral-400 hover:text-white hover:bg-white/10 transition-colors shrink-0"
          >
            <ChevronLeft size={12} /> Portal
          </button>

          {/* Optiq Studio brand (the floating pills are hidden in this editor) */}
          <div className="hidden sm:flex items-center gap-2 shrink-0">
            <svg width="18" height="18" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" className="shrink-0">
              <circle cx="16" cy="16" r="16" fill="white" />
              <circle cx="16" cy="16" r="8" fill="none" stroke="black" strokeWidth={4} />
            </svg>
            <span className="font-mono text-[12px] font-bold tracking-tight lowercase text-white">
              optiq studio
            </span>
          </div>

          <span className="hidden sm:block h-4 w-px bg-white/10 shrink-0" />

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Film size={13} className="text-blue-400 shrink-0" />
              <h1 className="text-xs font-bold text-white truncate max-w-[110px] sm:max-w-[260px]">{project?.title || "Untitled Film"}</h1>
              <span className="hidden sm:inline rounded bg-[#0c152d] border border-blue-500/40 px-1.5 py-0.5 text-[8px] font-mono font-bold uppercase tracking-wider text-blue-400 shrink-0">
                Timeline Editor
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className={`hidden sm:inline text-[9px] font-mono uppercase tracking-wider ${autosaver.isDirty ? "text-yellow-400" : "text-neutral-600"}`}>
            {autosaver.isDirty ? "● Saving…" : "● Saved"}
          </span>
          <button
            onClick={() => setProductionMode("manual")}
            aria-label="Script editor"
            className="flex items-center gap-1.5 rounded-lg bg-white/5 border border-white/5 px-2.5 sm:px-3 py-1.5 text-[11px] font-semibold hover:bg-white/10 hover:text-blue-400 active:scale-95 transition-all"
          >
            <Edit3 size={11} /> <span className="hidden sm:inline">Script Editor</span>
          </button>
          {renderStatus === "succeeded" && renderUrl ? (
            <a
              href={renderUrl}
              download={`${(project?.title || "film").replace(/\s+/g, "_")}.mp4`}
              className="flex items-center gap-1.5 rounded-lg bg-emerald-600/20 border border-emerald-500/30 px-3 py-1.5 text-[11px] font-bold text-emerald-400 hover:bg-emerald-600/30 transition-colors"
            >
              <Download size={11} /> Download Film
            </a>
          ) : null}
          <button
            onClick={handleExport}
            disabled={rendering}
            className="flex items-center gap-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 px-4 py-1.5 text-[11px] font-bold text-white transition-colors shadow-lg shadow-blue-500/20"
          >
            {rendering ? <Loader2 size={11} className="animate-spin" /> : <Zap size={11} />}
            {rendering ? "Rendering…" : "Export Film"}
          </button>
        </div>
      </div>

      {exportError && (
        <div className="mx-4 mt-2 rounded-lg border border-red-500/20 bg-red-950/30 px-3 py-2 text-[11px] text-red-400 shrink-0">
          Export error: {exportError}
        </div>
      )}
      {renderStatus === "failed" && project?.renderV2Error && (
        <div className="mx-4 mt-2 rounded-lg border border-red-500/20 bg-red-950/30 px-3 py-2 text-[11px] text-red-400 shrink-0">
          Last render failed: {project.renderV2Error}
        </div>
      )}
      {renderStalled && (
        <div className="mx-4 mt-2 rounded-lg border border-amber-500/20 bg-amber-950/30 px-3 py-2 text-[11px] text-amber-400 shrink-0">
          The previous render stopped responding and was abandoned. You can export again.
        </div>
      )}

      {/* ── MAIN ROW ─────────────────────────────────────────────────────
          Desktop: bin | preview | properties, all resizable.
          Mobile: just the preview — the bin becomes a filmstrip under it and
          properties becomes a sheet that rises when a clip is selected. */}
      {isMobile ? (
        <div className="flex min-h-0 flex-1 flex-col bg-black/60">
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
              <div className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-transparent transition-colors group-hover:bg-blue-500/60 group-active:bg-blue-400" />
            </div>

            <div className="flex min-w-0 flex-1 flex-col bg-black/60">
              <PreviewStage engine={engine} onPlayer={handlePlayer} frame={frame} />
            </div>

            {/* Preview ↔ properties divider */}
            <div
              onPointerDown={(e) => startResize(e, "props")}
              className="group relative z-10 -mx-[3px] w-[7px] shrink-0 cursor-col-resize"
            >
              <div className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-transparent transition-colors group-hover:bg-blue-500/60 group-active:bg-blue-400" />
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
            <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-transparent transition-colors group-hover:bg-blue-500/60 group-active:bg-blue-400" />
          </div>
        </>
      )}

      {/* ── TIMELINE TOOLBAR (desktop only) ───────────────────────────────
          Scrolls sideways rather than wrapping or clipping. On phones this is
          replaced by the CapCut-style MobileEditorDock below the timeline. */}
      {!isMobile && (
      <div className="flex items-center justify-between gap-2 overflow-x-auto border-t border-white/5 bg-[#0a0f1d] px-3 py-1.5 shrink-0 scrollbar-none">
        <div className="flex items-center gap-1 shrink-0">
          <ToolButton title="Undo (Ctrl+Z)" disabled={!engine.canUndo()} onClick={() => engine.undo()}>
            <Undo2 size={13} />
          </ToolButton>
          <ToolButton title="Redo (Ctrl+Shift+Z)" disabled={!engine.canRedo()} onClick={() => engine.redo()}>
            <Redo2 size={13} />
          </ToolButton>
          <span className="mx-1 h-4 w-px bg-white/10" />
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

        <div className="flex items-center gap-2 font-mono text-[10px] text-neutral-500">
          <span className="text-white font-bold">{formatTimecode(playhead, doc.fps)}</span>
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
            className="w-28 accent-blue-500 h-1"
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
      className={`flex h-7 min-w-7 items-center justify-center rounded-md border px-1.5 transition-colors disabled:opacity-30 ${
        active
          ? "border-blue-500 bg-[#0c152d] text-blue-400"
          : "border-transparent text-neutral-400 hover:text-white hover:bg-white/5"
      }`}
    >
      {children}
    </button>
  );
}
