"use client";

// SceneBoardShots — what a photographed scene actually renders from.
//
// This is the story tree's replacement for SceneReferenceImages, and the two are
// not variations on a theme. A reference image is something the DIRECTOR attaches
// to nudge a render. A board shot is something the SYSTEM photographed, from the
// place plate, from the arrangement inside it, from the object plates and the
// cast sheets — and it is the only thing the video model is shown for this scene.
//
// So the affordances invert. There is nothing to UPLOAD here: the set is derived,
// not curated. What the director needs instead is to SEE them properly — a 56px
// thumbnail is useless for judging whether the room is right — so every still
// expands, and the strip says plainly when a scene has no pictures, because on
// this film type that scene cannot render at all.
//
// Two things the derivation cannot decide, though, and they are the director's
// alone: THIS ANGLE IS WRONG, and THIS SCENE NEEDS ONE MORE. So a still can be
// dropped, and an angle can be asked for in plain words. Both edit the stored
// shot list, which the board treats as the design on its next pass — so an added
// angle is photographed and the ones already taken are left exactly as they are.

import React, { useEffect, useState } from "react";
import { Camera, Plus, RefreshCw, Trash2, X } from "lucide-react";
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
  /** Drop one setup. `order` identifies it — the index in the strip is not it. */
  onRemove?: (sceneIndex: number, order: number) => void;
  /** Ask for one more angle, described in the director's own words. */
  onAdd?: (sceneIndex: number, note: string) => void;
  /** True while a board pass is running, so retry does not stack requests. */
  busy?: boolean;
}

export default function SceneBoardShots({
  sceneIndex,
  stills,
  aspectRatio,
  onRetry,
  onRemove,
  onAdd,
  busy = false,
}: SceneBoardShotsProps) {
  const [expanded, setExpanded] = useState<SceneImage | null>(null);
  const [adding, setAdding] = useState(false);
  const [note, setNote] = useState("");

  const submitAdd = () => {
    if (!note.trim() || !onAdd) return;
    onAdd(sceneIndex, note.trim());
    setNote("");
    setAdding(false);
  };

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
            // The remove control sits ON the still rather than beside it: at this
            // size a row of separate buttons is unreadable, and a still is the
            // only thing it could refer to.
            <div key={`${still.path}-${i}`} className="group relative">
              <button
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
              {onRemove && (
                <button
                  onClick={() => onRemove(sceneIndex, still.order ?? i)}
                  disabled={busy}
                  aria-label={`Remove ${still.name}`}
                  title="Remove this setup"
                  // Always present for touch, emphasised on hover for pointers —
                  // a control that only exists on :hover cannot be reached on a
                  // phone, and this strip is used on one.
                  className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full border border-line bg-background/90 text-ink-3 opacity-70 backdrop-blur transition-all hover:text-danger group-hover:opacity-100 disabled:opacity-30"
                >
                  <Trash2 size={11} />
                </button>
              )}
            </div>
          ))}

          {onAdd && !adding && (
            <button
              onClick={() => setAdding(true)}
              disabled={busy}
              style={aspectStyle(aspectRatio)}
              className="flex w-24 flex-col items-center justify-center gap-1 rounded-2xl border border-dashed border-line-2 text-ink-3 transition-colors hover:border-accent-line hover:text-accent-ink disabled:opacity-40"
            >
              <Plus size={14} />
              <span className="text-[9px] font-semibold">Add a shot</span>
            </button>
          )}
        </div>
      )}

      {/* ── ASKING FOR AN ANGLE ──
          One sentence, in the language a director uses on set. It becomes the
          setup's own description, so "tight on his hands under the table" is the
          shot — there is no second pass that reinterprets it. */}
      {onAdd && adding && (
        <div className="mt-2.5 space-y-2 rounded-2xl border border-accent-line bg-surface-2 p-2.5">
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submitAdd();
              if (e.key === "Escape") { setAdding(false); setNote(""); }
            }}
            autoFocus
            rows={2}
            placeholder="What should this angle see? e.g. tight on his hands under the table"
            className="w-full resize-none rounded-xl border border-line bg-background px-2.5 py-2 text-[11px] leading-relaxed text-foreground outline-none placeholder:text-faint focus:border-accent-line"
          />
          <div className="flex items-center justify-end gap-2">
            <button
              onClick={() => { setAdding(false); setNote(""); }}
              className="text-[11px] text-muted transition-colors hover:text-foreground"
            >
              Cancel
            </button>
            <button
              onClick={submitAdd}
              disabled={!note.trim() || busy}
              className="rounded-xl bg-foreground px-3 py-1.5 text-[11px] font-bold text-background transition-colors hover:bg-ink-2 disabled:opacity-40"
            >
              Photograph it
            </button>
          </div>
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
