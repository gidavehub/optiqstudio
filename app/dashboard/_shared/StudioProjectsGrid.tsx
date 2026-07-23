"use client";

// StudioProjectsGrid — the shared "All Projects" wall used by Video and Image
// studios so both look and behave one-for-one.
//
// Each card: a media thumbnail, a blur+prompt+play overlay on hover, and a ⋮
// menu whose Delete gently fades the card out (opacity down, scale in, blur)
// before it's actually removed — the "it's about to go, then it goes" feel.
//
// Video thumbnails stream on hover only (HoverPreviewVideo); image thumbnails
// are plain <img>. The discriminant is `mediaType`.

import React from "react";
import { ImageIcon, Loader2, MoreVertical, Play, Trash2 } from "lucide-react";
import HoverPreviewVideo from "./HoverPreviewVideo";

export interface StudioGridItem {
  id: string;
  status: string;
  prompt: string;
  mediaUrl: string | null;
  createdAt: string;
}

interface StudioProjectsGridProps {
  items: StudioGridItem[];
  mediaType: "video" | "image";
  openedMenuId: string | null;
  setOpenedMenuId: (id: string | null) => void;
  /** Ids currently animating out (delete pending). */
  deletingIds: Set<string>;
  onOpen: (item: StudioGridItem) => void;
  onDelete: (id: string, e: React.MouseEvent) => void;
  emptyTitle?: string;
  emptyHint?: string;
}

export default function StudioProjectsGrid({
  items,
  mediaType,
  openedMenuId,
  setOpenedMenuId,
  deletingIds,
  onOpen,
  onDelete,
  emptyTitle = "No projects generated yet",
  emptyHint = "Type your prompt below and watch the generation cards appear.",
}: StudioProjectsGridProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6">
      {items.map((item) => {
        const isRendering =
          item.status === "rendering" ||
          item.status === "generating" ||
          item.status === "processing" ||
          item.status === "queued" ||
          !item.mediaUrl;
        const isDeleting = deletingIds.has(item.id);
        return (
          <div
            key={item.id}
            onClick={() => !isDeleting && onOpen(item)}
            className={`group relative flex aspect-video cursor-pointer flex-col justify-between overflow-hidden rounded-2xl border border-neutral-900 bg-[#09090a]/60 shadow-sm transition-all duration-300 hover:border-neutral-800 hover:bg-[#0c0c0e] ${
              isDeleting ? "scale-[0.94] opacity-0 blur-[2px] pointer-events-none" : "scale-100 opacity-100"
            }`}
          >
            <div className="relative flex h-full w-full flex-1 items-center justify-center overflow-hidden">
              {isRendering ? (
                <div className="absolute inset-0 flex items-center justify-center overflow-hidden bg-[#070708] p-4">
                  <div className="absolute -inset-[20px] opacity-40">
                    <div className="absolute left-1/4 top-1/4 h-32 w-32 animate-pulse rounded-full bg-neutral-600/15 blur-2xl" style={{ animationDuration: "4s" }} />
                    <div className="absolute bottom-1/4 right-1/4 h-36 w-36 animate-pulse rounded-full bg-neutral-600/20 blur-2xl" style={{ animationDuration: "6s" }} />
                    <div className="absolute right-1/3 top-1/2 h-28 w-28 animate-pulse rounded-full bg-neutral-500/10 blur-2xl" style={{ animationDuration: "3s" }} />
                  </div>
                  <div className="absolute inset-0 z-10 bg-black/40 backdrop-blur-2xl" />
                  <div className="relative z-20 flex max-w-[85%] flex-col items-center text-center">
                    <Loader2 size={22} className="mb-3 animate-spin text-white/80" />
                    <span className="mb-2 font-mono text-[10px] uppercase tracking-widest text-neutral-400">
                      {mediaType === "video" ? "Generating shot" : "Generating still"}
                    </span>
                    <p className="line-clamp-3 px-2 font-sans text-xs font-medium leading-relaxed text-neutral-200 drop-shadow">
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
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                    />
                  )}
                  <div className="absolute inset-0 z-10 bg-black/30" />
                  <div className="absolute inset-0 z-20 flex flex-col items-center justify-center p-5 text-center opacity-0 backdrop-blur-md transition-opacity duration-300 bg-black/65 group-hover:opacity-100">
                    <div className="mb-3 scale-90 rounded-full border border-white/20 bg-white/10 p-2 transition-all duration-300 group-hover:scale-100">
                      <Play size={16} fill="white" className="translate-x-[1px] text-white" />
                    </div>
                    <p className="line-clamp-3 max-w-[90%] px-1 font-sans text-xs font-medium leading-relaxed text-neutral-100">
                      {item.prompt}
                    </p>
                  </div>
                </div>
              )}

              {/* ⋮ menu */}
              <div className="absolute right-3 top-3 z-30">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setOpenedMenuId(openedMenuId === item.id ? null : item.id);
                  }}
                  className="rounded-full border border-neutral-800 bg-black/60 p-1.5 text-neutral-400 backdrop-blur-sm transition-colors hover:bg-neutral-900 hover:text-white"
                >
                  <MoreVertical size={13} />
                </button>
                {openedMenuId === item.id && (
                  <div className="absolute right-0 z-50 mt-1 w-28 rounded-lg border border-neutral-800 bg-[#121314] py-1 shadow-xl">
                    <button
                      onClick={(e) => onDelete(item.id, e)}
                      className="flex w-full items-center gap-1.5 px-3 py-1.5 text-left text-xs text-red-400 transition-colors hover:bg-neutral-900 hover:text-red-300"
                    >
                      <Trash2 size={12} />
                      Delete
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}

      {items.length === 0 && (
        <div className="col-span-full flex flex-col items-center py-24 text-center text-neutral-600 sm:py-28">
          <ImageIcon size={34} className="mb-4 text-neutral-700" />
          <h3 className="text-sm font-semibold text-neutral-400">{emptyTitle}</h3>
          <p className="mt-1 max-w-xs text-xs leading-normal text-neutral-600">{emptyHint}</p>
        </div>
      )}
    </div>
  );
}
