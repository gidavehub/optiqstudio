"use client";

// SceneRenderPanel — the render half of a scene: the clip, or the button that
// makes it, or what went wrong. Shared by the desktop scene card and the mobile
// deck so both faces behave identically.
//
// Every render that costs money routes through onRender, which the parent wraps
// in the price-confirmation modal. The label carries the price so the charge is
// never a surprise even before the modal opens.

import React from "react";
import { AlertCircle, CheckCircle, Play, RefreshCw, Video } from "lucide-react";

export type SceneRenderStatus = "idle" | "rendering" | "succeeded" | "failed";

interface SceneRenderPanelProps {
  status: SceneRenderStatus;
  url?: string;
  error?: string;
  /** GMD this render will cost. 0 = already covered by the ad's price. */
  cost: number;
  onRender: () => void;
  /** Tighter padding for the mobile deck. */
  compact?: boolean;
}

export default function SceneRenderPanel({
  status,
  url,
  error,
  cost,
  onRender,
  compact = false,
}: SceneRenderPanelProps) {
  const pad = compact ? "px-5 py-10" : "px-6 py-14";
  const priceLabel = cost > 0 ? `GMD ${cost.toLocaleString()}` : "Included";

  if (status === "succeeded" && url) {
    return (
      <div className="space-y-3">
        <div className="relative aspect-video overflow-hidden rounded-2xl border border-white/10 bg-black shadow-2xl">
          <video src={url} controls playsInline className="h-full w-full object-cover" />
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5 rounded-full border border-emerald-500/15 bg-emerald-500/5 px-2.5 py-0.5 text-[11px] font-bold text-emerald-400">
            <CheckCircle size={11} /> Rendered
          </span>
          <button
            onClick={onRender}
            className="flex items-center gap-1 rounded-lg border border-white/5 bg-white/5 px-3 py-1.5 text-[11px] font-semibold text-neutral-400 transition-colors hover:bg-white/10 hover:text-blue-400"
          >
            <RefreshCw size={11} /> Re-render · {priceLabel}
          </button>
        </div>
      </div>
    );
  }

  if (status === "rendering") {
    return (
      <div className={`flex flex-col items-center justify-center rounded-2xl border border-blue-500/20 bg-[#0c152d]/40 text-center ${pad}`}>
        <RefreshCw size={26} className="animate-spin text-blue-400" />
        <h4 className="mt-3 text-xs font-bold text-white">Generating clip…</h4>
        <p className="mt-2 max-w-xs text-[10px] leading-relaxed text-neutral-500">
          The Optiq Video Engine is compiling frames. This usually takes 1–3 minutes.
        </p>
      </div>
    );
  }

  if (status === "failed") {
    return (
      <div className={`flex flex-col items-center justify-center rounded-2xl border border-red-500/15 bg-red-500/[0.03] text-center ${pad}`}>
        <AlertCircle size={24} className="text-red-400" />
        <h4 className="mt-2.5 text-xs font-bold text-white">Generation failed</h4>
        <p className="mt-1 max-w-xs text-[10px] leading-normal text-red-400">
          {error || "The render timed out."}
        </p>
        <button
          onClick={onRender}
          className="mt-3.5 flex items-center gap-1 rounded-lg border border-white/5 bg-white/5 px-3.5 py-1.5 text-xs font-semibold transition-colors hover:bg-white/10"
        >
          <RefreshCw size={11} /> Retry · {priceLabel}
        </button>
      </div>
    );
  }

  return (
    <div className={`flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 bg-white/[0.01] text-center ${pad}`}>
      <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-[#0e1630] text-neutral-500">
        <Video size={16} />
      </span>
      <h4 className="text-xs font-bold text-white">No clip yet</h4>
      <p className="mt-1 max-w-xs text-[11px] leading-normal text-neutral-500">
        Send this prompt to the Optiq Video Engine.
      </p>
      <button
        onClick={onRender}
        className="mt-4 flex items-center gap-1.5 rounded-xl bg-blue-600 px-5 py-2 text-xs font-bold text-white shadow-lg shadow-blue-500/20 transition-all hover:bg-blue-500"
      >
        <Play size={11} fill="white" /> Generate · {priceLabel}
      </button>
    </div>
  );
}
