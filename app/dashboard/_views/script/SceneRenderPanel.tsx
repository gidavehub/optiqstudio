"use client";

// SceneRenderPanel — the render half of a scene: the clip, or the button that
// makes it, or what went wrong. Shared by the desktop scene card and the mobile
// deck so both faces behave identically.
//
// Every render that costs money routes through onRender, which the parent wraps
// in the price-confirmation modal. The label carries the price so the charge is
// never a surprise even before the modal opens.
//
// A re-render never destroys the clip it replaces — every render is kept as a
// take, and the take strip under the video switches between them. At ~GMD 150 a
// clip, "I preferred the second one" has to be one click, not another render.

import React from "react";
import { AlertCircle, CheckCircle, ChevronLeft, ChevronRight, Play, RefreshCw, Video } from "lucide-react";
import { SceneTake } from "../../_flow/types";

export type SceneRenderStatus = "idle" | "rendering" | "succeeded" | "failed";

interface SceneRenderPanelProps {
  status: SceneRenderStatus;
  url?: string;
  error?: string;
  /** GMD this render will cost. 0 = already covered by the ad's price. */
  cost: number;
  onRender: () => void;
  /** Every clip rendered for this scene, oldest first. */
  takes?: SceneTake[];
  /** Index into `takes` currently on air. */
  activeTake?: number;
  onSelectTake?: (takeIndex: number) => void;
  /** Tighter padding for the mobile deck. */
  compact?: boolean;
}

export default function SceneRenderPanel({
  status,
  url,
  error,
  cost,
  onRender,
  takes = [],
  activeTake = -1,
  onSelectTake,
  compact = false,
}: SceneRenderPanelProps) {
  const pad = compact ? "px-5 py-10" : "px-6 py-14";
  const priceLabel = cost > 0 ? `GMD ${cost.toLocaleString()}` : "Included";
  const canSwitch = !!onSelectTake && takes.length > 1 && activeTake >= 0;

  if (status === "succeeded" && url) {
    return (
      <div className="space-y-3">
        <div className="relative aspect-video overflow-hidden rounded-3xl border border-line bg-background elevate-lg">
          <video src={url} controls playsInline className="h-full w-full object-cover" />
        </div>

        {canSwitch && (
          <div className="flex items-center gap-2 rounded-2xl border border-line bg-surface px-2 py-1.5">
            <button
              onClick={() => onSelectTake!(activeTake - 1)}
              disabled={activeTake === 0}
              aria-label="Previous take"
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-xl text-ink-3 transition-colors hover:bg-surface-2 hover:text-foreground disabled:opacity-25 disabled:hover:bg-transparent"
            >
              <ChevronLeft size={13} />
            </button>

            <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto scrollbar-none">
              {takes.map((take, i) => (
                <button
                  key={take.id || take.url}
                  onClick={() => onSelectTake!(i)}
                  title={take.createdAt ? new Date(take.createdAt).toLocaleString() : `Take ${i + 1}`}
                  className={`shrink-0 rounded-xl px-2.5 py-1 text-[10px] font-bold transition-colors ${
                    i === activeTake
                      ? "bg-accent text-white"
                      : "bg-surface text-ink-3 hover:bg-surface-2 hover:text-foreground"
                  }`}
                >
                  Take {i + 1}
                </button>
              ))}
            </div>

            <button
              onClick={() => onSelectTake!(activeTake + 1)}
              disabled={activeTake === takes.length - 1}
              aria-label="Next take"
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-xl text-ink-3 transition-colors hover:bg-surface-2 hover:text-foreground disabled:opacity-25 disabled:hover:bg-transparent"
            >
              <ChevronRight size={13} />
            </button>
          </div>
        )}

        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5 rounded-full border border-success bg-success-soft px-2.5 py-0.5 text-[11px] font-bold text-success">
            <CheckCircle size={11} />
            {canSwitch ? `Take ${activeTake + 1} of ${takes.length}` : "Rendered"}
          </span>
          <button
            onClick={onRender}
            className="flex items-center gap-1 rounded-xl border border-line bg-surface px-3 py-1.5 text-[11px] font-semibold text-ink-3 transition-colors hover:bg-surface-2 hover:text-accent-ink"
          >
            <RefreshCw size={11} /> Re-render · {priceLabel}
          </button>
        </div>
      </div>
    );
  }

  if (status === "rendering") {
    return (
      <div className={`flex flex-col items-center justify-center rounded-3xl border border-accent-line bg-surface text-center ${pad}`}>
        <RefreshCw size={26} className="animate-spin text-accent-ink" />
        <h4 className="mt-3 text-xs font-bold text-foreground">Generating clip…</h4>
        <p className="mt-2 max-w-xs text-[10px] leading-relaxed text-muted">
          The Optiq Video Engine is compiling frames. This usually takes 1–3 minutes.
        </p>
      </div>
    );
  }

  if (status === "failed") {
    return (
      <div className={`flex flex-col items-center justify-center rounded-3xl border border-danger bg-danger-soft text-center ${pad}`}>
        <AlertCircle size={24} className="text-danger" />
        <h4 className="mt-2.5 text-xs font-bold text-foreground">Generation failed</h4>
        <p className="mt-1 max-w-xs text-[10px] leading-normal text-danger">
          {error || "The render timed out."}
        </p>
        <button
          onClick={onRender}
          className="mt-3.5 flex items-center gap-1 rounded-xl border border-line bg-surface px-3.5 py-1.5 text-xs font-semibold transition-colors hover:bg-surface-2"
        >
          <RefreshCw size={11} /> Retry · {priceLabel}
        </button>
      </div>
    );
  }

  return (
    <div className={`flex flex-col items-center justify-center rounded-3xl border border-dashed border-line bg-surface text-center ${pad}`}>
      <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-full border border-line bg-surface text-muted">
        <Video size={16} />
      </span>
      <h4 className="text-xs font-bold text-foreground">No clip yet</h4>
      <p className="mt-1 max-w-xs text-[11px] leading-normal text-muted">
        Send this prompt to the Optiq Video Engine.
      </p>
      <button
        onClick={onRender}
        className="mt-4 flex items-center gap-1.5 rounded-2xl bg-accent px-5 py-2 text-xs font-bold text-white shadow-lg shadow-accent/15 transition-all hover:bg-accent-hover"
      >
        <Play size={11} fill="currentColor" /> Generate · {priceLabel}
      </button>
    </div>
  );
}
