"use client";

import React from "react";
import { Clapperboard, Loader2, MoreVertical, Play, Trash2 } from "lucide-react";
import { HistoryItem } from "./types";

interface ProjectsGridProps {
  history: HistoryItem[];
  openedMenuId: string | null;
  setOpenedMenuId: (id: string | null) => void;
  onOpen: (item: HistoryItem) => void;
  onDelete: (id: string, e: React.MouseEvent) => void;
}

export default function ProjectsGrid({
  history,
  openedMenuId,
  setOpenedMenuId,
  onOpen,
  onDelete,
}: ProjectsGridProps) {
  return (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {history.map((item) => {
          const isRendering =
            item.status === "rendering" ||
            item.status === "generating" ||
            item.status === "processing" ||
            !item.videoUrl;
          return (
            <div
              key={item.id}
              onClick={() => onOpen(item)}
              className="group bg-[#09090a]/60 border border-neutral-900 hover:border-neutral-800 hover:bg-[#0c0c0e] rounded-2xl overflow-hidden shadow-sm transition-all duration-300 flex flex-col justify-between aspect-video relative cursor-pointer"
            >
              {/* Dynamic Blur Thumbnail Container */}
              <div className="relative flex-1 overflow-hidden flex items-center justify-center h-full w-full">
                {isRendering ? (
                  /* Generating dynamic shifting blur state with loading elements inside center */
                  <div className="absolute inset-0 bg-[#070708] overflow-hidden flex items-center justify-center p-4">
                    {/* Glowing shifting orbs */}
                    <div className="absolute -inset-[20px] opacity-40">
                      <div className="absolute top-1/4 left-1/4 w-32 h-32 rounded-full bg-neutral-600/15 blur-2xl animate-pulse" style={{ animationDuration: "4s" }} />
                      <div className="absolute bottom-1/4 right-1/4 w-36 h-36 rounded-full bg-neutral-600/20 blur-2xl animate-pulse" style={{ animationDuration: "6s" }} />
                      <div className="absolute top-1/2 right-1/3 w-28 h-28 rounded-full bg-neutral-500/10 blur-2xl animate-pulse" style={{ animationDuration: "3s" }} />
                    </div>
                    <div className="absolute inset-0 backdrop-blur-2xl bg-black/40 z-10" />

                    <div className="relative z-20 flex flex-col items-center max-w-[85%] text-center">
                      <Loader2 size={22} className="animate-spin text-white/80 mb-3" />
                      <span className="text-[10px] font-mono tracking-widest text-neutral-400 uppercase mb-2">
                        Generating shot
                      </span>
                      <p className="text-xs text-neutral-200 line-clamp-3 leading-relaxed font-sans font-medium px-2 drop-shadow">
                        {item.prompt}
                      </p>
                    </div>
                  </div>
                ) : (
                  /* Done state: Render unblurred completed preview video */
                  <div className="absolute inset-0 h-full w-full">
                    <video
                      src={item.videoUrl ?? undefined}
                      playsInline
                      muted
                      loop
                      autoPlay
                      className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-500"
                    />
                    {/* Ambient gradient overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent z-10" />

                    {/* Hover overlay — displays prompt in the center elegantly */}
                    <div className="absolute inset-0 bg-black/65 backdrop-blur-md transition-opacity duration-300 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center p-5 text-center z-20">
                      <div className="p-2 rounded-full bg-white/10 border border-white/20 mb-3 scale-90 group-hover:scale-100 transition-all duration-300">
                        <Play size={16} fill="white" className="text-white translate-x-[1px]" />
                      </div>
                      <p className="text-xs text-neutral-100 line-clamp-3 leading-relaxed font-sans font-medium max-w-[90%] px-1">
                        {item.prompt}
                      </p>
                    </div>
                  </div>
                )}

                {/* Top-Right Menu Button Actions */}
                <div className="absolute top-3 right-3 z-30">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setOpenedMenuId(openedMenuId === item.id ? null : item.id);
                    }}
                    className="p-1.5 rounded-full bg-black/60 backdrop-blur-sm border border-neutral-800 text-neutral-400 hover:text-white transition-colors hover:bg-neutral-900"
                  >
                    <MoreVertical size={13} />
                  </button>

                  {/* Popover Dropdown Actions Menu */}
                  {openedMenuId === item.id && (
                    <div className="absolute right-0 mt-1 w-28 bg-[#121314] border border-neutral-800 rounded-lg shadow-xl py-1 z-50">
                      <button
                        onClick={(e) => onDelete(item.id, e)}
                        className="w-full text-left px-3 py-1.5 text-xs text-red-400 hover:bg-neutral-900 hover:text-red-300 transition-colors flex items-center gap-1.5"
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

        {history.length === 0 && (
          <div className="col-span-full py-28 text-center text-neutral-600 flex flex-col items-center">
            <Clapperboard size={36} className="text-neutral-700 mb-4" />
            <h3 className="text-sm font-semibold text-neutral-400">No Projects Generated Yet</h3>
            <p className="text-xs text-neutral-600 max-w-xs leading-normal mt-1">
              Type your script prompt below and see the dynamic, glassmorphic generation nodes appear.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
