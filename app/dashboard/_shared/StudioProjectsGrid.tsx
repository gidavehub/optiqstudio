"use client";

// StudioProjectsGrid — the shared "All Projects" wall used by Video and Image
// studios so both look and behave one-for-one.
//
// Each card: a media thumbnail, a blur+prompt overlay on hover, a reuse button
// that loads the original prompt AND its reference images back into the console,
// and a ⋮ menu whose Delete gently fades the card out (opacity down, scale in,
// blur) before it's actually removed.
//
// Video thumbnails stream on hover only (HoverPreviewVideo) and carry a play
// affordance; image thumbnails are plain <img> and deliberately do NOT — there
// is nothing to play on a still.
//
// Cards listed in `freshIds` were created in this session and play a one-shot
// pop-in so a new generation visibly lands on the wall.

import React, { useState } from "react";
import { ImageIcon, Loader2, MoreVertical, Play, RotateCcw, Trash2 } from "lucide-react";
import HoverPreviewVideo from "./HoverPreviewVideo";
import { gridBox, recordAspect } from "./aspect";

export interface StudioGridItem {
  id: string;
  status: string;
  prompt: string;
  mediaUrl: string | null;
  createdAt: string;
  /** What the generation was made at — "16:9", "9:16", "1:1", … Cards are cut
   *  to this, so a portrait shot is a portrait card rather than a letterboxed
   *  16:9 one. Missing on records written before it was stored. */
  aspectRatio?: string | null;
  /** Measured pixel size, when a path recorded it. Beats aspectRatio, since
   *  it is what the file actually is rather than what was asked for. */
  width?: number | null;
  height?: number | null;
}

interface StudioProjectsGridProps {
  items: StudioGridItem[];
  mediaType: "video" | "image";
  openedMenuId: string | null;
  setOpenedMenuId: (id: string | null) => void;
  /** Ids currently animating out (delete pending). */
  deletingIds: Set<string>;
  /** Ids created this session — they play the landing animation once. */
  freshIds?: Set<string>;
  onOpen: (item: StudioGridItem) => void;
  onDelete: (id: string, e: React.MouseEvent) => void;
  /** Loads this generation's prompt + reference images back into the console. */
  onReuse?: (id: string, e: React.MouseEvent) => void;
  emptyTitle?: string;
  emptyHint?: string;
  /** How many cards to show before "View more" — and how many each tap adds. */
  pageSize?: number;
}

export default function StudioProjectsGrid({
  items,
  mediaType,
  openedMenuId,
  setOpenedMenuId,
  deletingIds,
  freshIds,
  onOpen,
  onDelete,
  onReuse,
  emptyTitle = "No projects generated yet",
  emptyHint = "Type your prompt below and watch the generation cards appear.",
  pageSize = 12,
}: StudioProjectsGridProps) {
  // Only `visible` cards are mounted. This is the difference between a handful
  // of video tiles decoding and all of them: the cards below the fold are not
  // hidden with CSS, they do not exist yet.
  const [visible, setVisible] = useState(pageSize);
  // Where the most recent batch starts, so only the new cards animate in and
  // the ones already on screen stay put.
  const [batchFrom, setBatchFrom] = useState(Infinity);

  const shown = items.slice(0, visible);
  const remaining = items.length - shown.length;

  const showMore = () => {
    setBatchFrom(visible);
    setVisible((v) => v + pageSize);
  };

  return (
    // items-start matters: grid items stretch by default, so once cards carry
    // their own aspect ratio a 16:9 sitting beside a 9:16 would be pulled to
    // the tall one's height and letterboxed again by the back door.
    <div className="grid grid-cols-2 items-start gap-3 md:grid-cols-2 lg:grid-cols-3 sm:gap-6">
      {shown.map((item, idx) => {
        const isRendering =
          item.status === "rendering" ||
          item.status === "generating" ||
          item.status === "processing" ||
          item.status === "queued" ||
          !item.mediaUrl;
        const isDeleting = deletingIds.has(item.id);
        const isFresh = freshIds?.has(item.id);
        // Landscape fills the column; portrait is height-capped so it does not
        // tower over the cards beside it. See gridBox.
        const box = gridBox(recordAspect(item));
        return (
          <div
            key={item.id}
            onClick={() => !isDeleting && onOpen(item)}
            // The shape is data, so it is an inline style — a runtime
            // `aspect-[..]` class never reaches Tailwind's compiler. While the
            // card is still rendering this is the REQUESTED ratio, so the
            // placeholder is already the shape of what is coming.
            style={box.style}
            className={`group relative flex cursor-pointer flex-col justify-between overflow-hidden rounded-3xl border border-line bg-surface shadow-sm transition-all duration-300 hover:border-line hover:bg-background ${box.className} ${
              isDeleting ? "scale-[0.94] opacity-0 blur-[2px] pointer-events-none" : "scale-100 opacity-100"
            } ${isFresh && !isDeleting ? "animate-card-pop" : ""} ${
              idx >= batchFrom ? "animate-rise" : ""
            }`}
          >
            <div className="relative flex h-full w-full flex-1 items-center justify-center overflow-hidden">
              {isRendering ? (
                <div className="absolute inset-0 flex items-center justify-center overflow-hidden bg-background p-4">
                  <div className="absolute -inset-[20px] opacity-40">
                    <div className="absolute left-1/4 top-1/4 h-32 w-32 animate-pulse rounded-full bg-surface-3 blur-2xl" style={{ animationDuration: "4s" }} />
                    <div className="absolute bottom-1/4 right-1/4 h-36 w-36 animate-pulse rounded-full bg-surface-3 blur-2xl" style={{ animationDuration: "6s" }} />
                    <div className="absolute right-1/3 top-1/2 h-28 w-28 animate-pulse rounded-full bg-surface-2 blur-2xl" style={{ animationDuration: "3s" }} />
                  </div>
                  <div className="absolute inset-0 z-10 bg-background/50 backdrop-blur-2xl" />
                  <div className="relative z-20 flex max-w-[85%] flex-col items-center text-center">
                    <Loader2 size={22} className="mb-3 animate-spin text-ink-2" />
                    <span className="mb-2 tabular-nums text-[10px] uppercase tracking-widest text-ink-3">
                      {mediaType === "video" ? "Generating shot" : "Generating still"}
                    </span>
                    <p className="line-clamp-3 px-2 font-sans text-xs font-medium leading-relaxed text-foreground drop-shadow">
                      {item.prompt}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="absolute inset-0 h-full w-full">
                  {mediaType === "video" ? (
                    <HoverPreviewVideo
                      src={item.mediaUrl ?? ""}
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                    />
                  ) : (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={item.mediaUrl ?? ""}
                      alt={item.prompt}
                      loading="lazy"
                      decoding="async"
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                    />
                  )}
                  {/* No veil at rest — the render shows exactly as it came out
                      of the model. The blur and tint belong to the hover state. */}
                  <div className="absolute inset-0 z-20 flex flex-col items-center justify-center p-5 text-center opacity-0 backdrop-blur-md transition-opacity duration-300 bg-background/75 group-hover:opacity-100">
                    {/* Only footage gets a play affordance — a still has nothing to play. */}
                    {mediaType === "video" && (
                      <div className="mb-3 scale-90 rounded-full border border-line-2 bg-surface-2 p-2 transition-all duration-300 group-hover:scale-100">
                        <Play size={16} fill="currentColor" className="translate-x-[1px] text-foreground" />
                      </div>
                    )}
                    <p className="line-clamp-3 max-w-[90%] px-1 font-sans text-xs font-medium leading-relaxed text-foreground">
                      {item.prompt}
                    </p>
                  </div>
                </div>
              )}

              {/* Card actions: reuse · ⋮ menu */}
              <div className="absolute right-3 top-3 z-30 flex items-center gap-1.5">
                {onReuse && !item.id.startsWith("temp_") && (
                  <button
                    onClick={(e) => onReuse(item.id, e)}
                    title="Reuse this prompt and its reference images"
                    className="rounded-full border border-line bg-background/80 p-1.5 text-ink-3 backdrop-blur-sm transition-colors hover:bg-surface hover:text-foreground"
                  >
                    <RotateCcw size={13} />
                  </button>
                )}
                <div className="relative">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setOpenedMenuId(openedMenuId === item.id ? null : item.id);
                    }}
                    className="rounded-full border border-line bg-background/80 p-1.5 text-ink-3 backdrop-blur-sm transition-colors hover:bg-surface hover:text-foreground"
                  >
                    <MoreVertical size={13} />
                  </button>
                  {openedMenuId === item.id && (
                    <div className="absolute right-0 z-50 mt-1 w-32 rounded-xl border border-line bg-surface py-1 shadow-xl">
                      {onReuse && !item.id.startsWith("temp_") && (
                        <button
                          onClick={(e) => onReuse(item.id, e)}
                          className="flex w-full items-center gap-1.5 px-3 py-1.5 text-left text-xs text-ink-2 transition-colors hover:bg-surface hover:text-foreground"
                        >
                          <RotateCcw size={12} />
                          Reuse prompt
                        </button>
                      )}
                      <button
                        onClick={(e) => onDelete(item.id, e)}
                        className="flex w-full items-center gap-1.5 px-3 py-1.5 text-left text-xs text-danger transition-colors hover:bg-surface hover:text-danger"
                      >
                        <Trash2 size={12} />
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })}

      {items.length === 0 && (
        <div className="col-span-full flex flex-col items-center py-24 text-center text-faint sm:py-28">
          <ImageIcon size={34} className="mb-4 text-faint" />
          <h3 className="text-sm font-semibold text-ink-3">{emptyTitle}</h3>
          <p className="mt-1 max-w-xs text-xs leading-normal text-faint">{emptyHint}</p>
        </div>
      )}

      {remaining > 0 && (
        <div className="col-span-full flex justify-center pt-2">
          <button
            onClick={showMore}
            className="flex items-center gap-2 rounded-full border border-line bg-surface px-6 py-2.5 text-xs font-bold text-foreground transition-all hover:border-accent hover:bg-background active:scale-95"
          >
            View more
            <span className="tabular-nums text-muted">{remaining}</span>
          </button>
        </div>
      )}
    </div>
  );
}
