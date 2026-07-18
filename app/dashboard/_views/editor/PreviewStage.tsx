"use client";

// PreviewStage — mounts the DOM playback adapter (lib/editor/player.ts) into a
// CapCut-style viewport: the stage is sized to the document's aspect ratio and
// contained in the available space (a portrait film shows as a slim column, a
// landscape film letterboxes), with zoom in/out around that fit, a fullscreen
// toggle, and a custom transport with a draggable scrub knob. All timing lives
// in the engine; this component only renders the frame state it is given.

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Maximize2, Minimize2, Pause, Play, Repeat, SkipBack, SkipForward, ZoomIn, ZoomOut,
} from "lucide-react";
import { EditorEngine, EditorPlayer, PlaybackFrame, formatTimecode } from "../../../../lib/editor";

interface PreviewStageProps {
  engine: EditorEngine;
  onPlayer: (player: EditorPlayer | null) => void;
  frame: PlaybackFrame | null;
}

const ZOOM_STEPS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4];

export default function PreviewStage({ engine, onPlayer, frame }: PreviewStageProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<EditorPlayer | null>(null);
  const [loop, setLoop] = useState(false);
  const [zoom, setZoom] = useState<number>(1); // 1 = fit
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [viewport, setViewport] = useState({ w: 0, h: 0 });

  useEffect(() => {
    if (!containerRef.current) return;
    const player = new EditorPlayer(containerRef.current, engine.getDoc());
    playerRef.current = player;
    onPlayer(player);
    return () => {
      onPlayer(null);
      player.dispose();
      playerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine]);

  // Track the viewport size so the stage can be contain-fit precisely.
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const r = entries[0]?.contentRect;
      if (r) setViewport({ w: r.width, h: r.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else {
      void rootRef.current?.requestFullscreen().catch(() => undefined);
    }
  }, []);

  const stepZoom = (dir: 1 | -1) => {
    setZoom((z) => {
      const idx = ZOOM_STEPS.findIndex((s) => Math.abs(s - z) < 1e-6);
      if (idx === -1) return 1;
      return ZOOM_STEPS[Math.max(0, Math.min(ZOOM_STEPS.length - 1, idx + dir))];
    });
  };

  const playing = frame?.playing ?? false;
  const time = frame?.time ?? 0;
  const duration = frame?.duration ?? 0;
  const doc = engine.getDoc();

  // Contain-fit the canvas in the viewport (minus a little breathing room),
  // then scale by the user zoom.
  const pad = 24;
  const availW = Math.max(0, viewport.w - pad);
  const availH = Math.max(0, viewport.h - pad);
  const fitScale = availW > 0 && availH > 0 ? Math.min(availW / doc.width, availH / doc.height) : 0;
  const scale = fitScale * zoom;
  const stageW = Math.max(1, Math.round(doc.width * scale));
  const stageH = Math.max(1, Math.round(doc.height * scale));

  const seekRatio = duration > 0 ? time / duration : 0;

  return (
    <div ref={rootRef} className="flex min-h-0 flex-1 flex-col bg-black">
      {/* Viewport */}
      <div ref={viewportRef} className="relative min-h-0 flex-1 overflow-auto">
        <div className="flex min-h-full min-w-full items-center justify-center" style={{ width: "max-content", minWidth: "100%", minHeight: "100%" }}>
          <div
            className="relative shrink-0 overflow-hidden rounded-lg border border-white/5 bg-black shadow-[0_10px_40px_rgba(0,0,0,0.9)]"
            style={{ width: stageW, height: stageH, margin: pad / 2 }}
          >
            <div ref={containerRef} className="absolute inset-0" />
            {/* Center play affordance when paused */}
            {!playing && (
              <button
                onClick={() => playerRef.current?.play()}
                className="absolute inset-0 z-20 flex items-center justify-center bg-black/20 opacity-0 hover:opacity-100 transition-opacity"
              >
                <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[#0a0f1d]/80 border border-white/15 backdrop-blur-md shadow-xl">
                  <Play size={20} className="text-white fill-white translate-x-0.5" />
                </span>
              </button>
            )}
          </div>
        </div>

        {/* Zoom chip */}
        <div className="pointer-events-none absolute right-3 top-3 z-30 rounded-full border border-white/10 bg-[#0a0f1d]/80 px-2 py-0.5 font-mono text-[9px] font-bold text-neutral-400 backdrop-blur-md">
          {Math.round(zoom * 100)}%
        </div>
      </div>

      {/* Transport bar */}
      <div className="flex items-center gap-3 border-t border-white/5 bg-[#0a0f1d]/90 px-4 py-2 shrink-0">
        <div className="flex items-center gap-1">
          <button
            onClick={() => playerRef.current?.seek(0)}
            className="p-1.5 rounded-md text-neutral-400 hover:text-white hover:bg-white/5 transition-colors"
            title="Jump to start (Home)"
          >
            <SkipBack size={14} />
          </button>
          <button
            onClick={() => playerRef.current?.toggle()}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-black hover:bg-blue-100 transition-colors shadow-md"
            title="Play / Pause (Space)"
          >
            {playing ? <Pause size={14} fill="black" /> : <Play size={14} fill="black" className="ml-0.5" />}
          </button>
          <button
            onClick={() => playerRef.current?.seek(duration)}
            className="p-1.5 rounded-md text-neutral-400 hover:text-white hover:bg-white/5 transition-colors"
            title="Jump to end (End)"
          >
            <SkipForward size={14} />
          </button>
          <button
            onClick={() => {
              const next = !loop;
              setLoop(next);
              playerRef.current?.controller.setLoop(next);
            }}
            className={`p-1.5 rounded-md transition-colors ${loop ? "text-blue-400 bg-[#0c152d]" : "text-neutral-500 hover:text-white hover:bg-white/5"}`}
            title="Loop playback"
          >
            <Repeat size={13} />
          </button>
        </div>

        {/* Scrub bar */}
        <input
          type="range"
          min={0}
          max={Math.max(duration, 0.001)}
          step={1 / doc.fps}
          value={time}
          onChange={(e) => playerRef.current?.seek(Number(e.target.value))}
          className="flex-1 h-1 accent-blue-500 cursor-pointer"
          style={{
            background: `linear-gradient(to right, #3b82f6 ${(seekRatio * 100).toFixed(2)}%, rgba(255,255,255,0.12) ${(seekRatio * 100).toFixed(2)}%)`,
          }}
        />

        <span className="font-mono text-[10px] text-neutral-400 shrink-0">
          <span className="text-white font-bold">{formatTimecode(time, doc.fps)}</span>
          <span className="text-neutral-600"> / {formatTimecode(duration, doc.fps)}</span>
        </span>

        {/* View controls */}
        <div className="flex items-center gap-0.5 border-l border-white/10 pl-2">
          <button
            onClick={() => stepZoom(-1)}
            className="p-1.5 rounded-md text-neutral-400 hover:text-white hover:bg-white/5 transition-colors"
            title="Zoom preview out"
          >
            <ZoomOut size={13} />
          </button>
          <button
            onClick={() => setZoom(1)}
            className={`rounded-md px-1.5 py-1 text-[9px] font-bold font-mono uppercase transition-colors ${
              zoom === 1 ? "text-blue-400" : "text-neutral-400 hover:text-white hover:bg-white/5"
            }`}
            title="Fit to viewport"
          >
            Fit
          </button>
          <button
            onClick={() => stepZoom(1)}
            className="p-1.5 rounded-md text-neutral-400 hover:text-white hover:bg-white/5 transition-colors"
            title="Zoom preview in"
          >
            <ZoomIn size={13} />
          </button>
          <button
            onClick={toggleFullscreen}
            className="p-1.5 rounded-md text-neutral-400 hover:text-white hover:bg-white/5 transition-colors"
            title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
          >
            {isFullscreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
          </button>
        </div>
      </div>
    </div>
  );
}
