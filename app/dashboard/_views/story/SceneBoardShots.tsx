"use client";

// SceneBoardShots — what a photographed scene actually renders from.
//
// This is the story tree's replacement for SceneReferenceImages, and the two are
// not variations on a theme. A reference image is something the DIRECTOR attaches
// to nudge a render. A board shot is something the SYSTEM photographed, from the
// place plate, from the arrangement inside it, from the object plates and the
// cast sheets — and it is the only thing the video model is shown for this scene.
//
// So the affordances invert. There is nothing to upload here and nothing to
// remove: the set is derived, not curated. What the director needs instead is to
// SEE them properly — a 56px thumbnail is useless for judging whether the room is
// right — so every still expands, and the strip says plainly when a scene has no
// pictures, because on this film type that scene cannot render at all.

import React, { useEffect, useState } from "react";
import { Camera, RefreshCw, X } from "lucide-react";
import { SceneImage } from "../../_flow/types";
import { aspectStyle } from "../../_shared/aspect";

interface SceneBoardShotsProps {
  sceneIndex: number;
  /** The stills this scene renders from, in attach order. */
  stills: SceneImage[];
  /** The film's shape — a board shot becomes a video frame, so it is cut to it. */
  aspectRatio: string;
  /** Re-photograph this scene. Keeps the setups; re-takes the pictures. */
  onRetry?: (sceneIndex: number) => void;
  /** True while a board pass is running, so retry does not stack requests. */
  busy?: boolean;
}

export default function SceneBoardShots({
  sceneIndex,
  stills,
  aspectRatio,
  onRetry,
  busy = false,
}: SceneBoardShotsProps) {
  const [expanded, setExpanded] = useState<SceneImage | null>(null);

  // A lightbox reachable only by mouse is a trap on a keyboard.
  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setExpanded(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [expanded]);

  return (
    <div className="rounded-[28px] border border-line bg-surface p-3.5">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wide text-muted">
          <Camera size={11} />
          Board shots — this scene renders from these
          {stills.length > 0 && (
            <span className="ml-0.5 tabular-nums normal-case tracking-normal text-faint">
              {stills.length}
            </span>
          )}
        </span>
        {onRetry && (
          <button
            onClick={() => onRetry(sceneIndex)}
            disabled={busy}
            className="text-[11px] text-muted transition-colors hover:text-accent-ink disabled:opacity-40"
          >
            <RefreshCw size={10} className="mr-1 inline" />
            {stills.length === 0 ? "Photograph" : "Re-shoot"}
          </button>
        )}
      </div>

      {stills.length === 0 ? (
        // Not a soft state. On this film type the long prompt was deliberately
        // written NOT to describe how anything looks, so a scene with no board
        // shots has nothing to attach and nothing to fall back on — rendering it
        // anyway buys ten seconds of a different film.
        <p className="mt-2.5 rounded-2xl border border-dashed border-line-2 px-3 py-2.5 text-[11px] leading-relaxed text-muted">
          {busy
            ? "Being photographed…"
            : "Not photographed yet — this scene cannot render until it is. Its script describes what happens, not how anything looks; the pictures carry that."}
        </p>
      ) : (
        <div className="mt-2.5 flex flex-wrap items-start gap-2">
          {stills.map((still, i) => (
            <button
              key={`${still.path}-${i}`}
              onClick={() => setExpanded(still)}
              title={`${still.name} — tap to expand`}
              style={aspectStyle(aspectRatio)}
              className="w-24 overflow-hidden rounded-2xl border border-line bg-background transition-colors hover:border-accent-line"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={still.url}
                alt={still.name}
                loading="lazy"
                className="h-full w-full object-cover"
              />
            </button>
          ))}
        </div>
      )}

      {/* ── EXPANDED ──
          Full-bleed, because the whole reason this component exists rather than
          the reference tray is that these need looking AT. */}
      {expanded && (
        <div
          className="fixed inset-0 z-50 flex flex-col bg-background/95 backdrop-blur-sm"
          onClick={() => setExpanded(null)}
        >
          <div className="flex shrink-0 items-start justify-between gap-3 px-4 py-3">
            <p className="min-w-0 truncate text-xs font-bold text-foreground">{expanded.name}</p>
            <button
              onClick={() => setExpanded(null)}
              aria-label="Close"
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-line bg-surface text-ink-2 transition-colors hover:text-foreground"
            >
              <X size={13} />
            </button>
          </div>
          <div className="flex min-h-0 flex-1 items-center justify-center p-4 pt-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={expanded.url}
              alt={expanded.name}
              className="max-h-full max-w-full rounded-2xl object-contain"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}
    </div>
  );
}
