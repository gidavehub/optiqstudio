"use client";

// AudioProjectsGrid — the "All takes" / "All tracks" wall for the Optiq Voice
// Engine and Optiq Music studios. Same card silhouette as StudioProjectsGrid so
// audio sits alongside video and image one-for-one, but the cover is an
// equalizer motif and the card plays inline (one at a time) instead of opening
// a detail route.

import React, { useEffect, useRef, useState } from "react";
import { AudioLines, Loader2, MoreVertical, Music, Pause, Play, Trash2 } from "lucide-react";

export interface AudioGridItem {
  id: string;
  status: string;
  prompt: string;
  audioUrl: string | null;
  createdAt: string;
}

interface AudioProjectsGridProps {
  items: AudioGridItem[];
  variant: "voice" | "music";
  openedMenuId: string | null;
  setOpenedMenuId: (id: string | null) => void;
  deletingIds: Set<string>;
  onDelete: (id: string, e: React.MouseEvent) => void;
  emptyTitle?: string;
  emptyHint?: string;
}

// Five bars that bounce while playing and sit low + still when idle.
function Equalizer({ playing, tint }: { playing: boolean; tint: string }) {
  return (
    <div className="flex h-10 items-end gap-[3px]">
      {[0, 1, 2, 3, 4].map((i) => (
        <span
          key={i}
          className={`w-[4px] rounded-full ${tint}`}
          style={{
            height: playing ? undefined : `${[8, 14, 10, 16, 9][i]}px`,
            animation: playing ? `optiqEq 900ms ease-in-out ${i * 120}ms infinite` : undefined,
          }}
        />
      ))}
    </div>
  );
}

export default function AudioProjectsGrid({
  items,
  variant,
  openedMenuId,
  setOpenedMenuId,
  deletingIds,
  onDelete,
  emptyTitle = "Nothing generated yet",
  emptyHint = "Type below and your takes will appear here.",
}: AudioProjectsGridProps) {
  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Stop playback if the currently-playing card disappears.
  useEffect(() => {
    if (playingId && !items.some((i) => i.id === playingId)) {
      audioRef.current?.pause();
      audioRef.current = null;
      setPlayingId(null);
    }
  }, [items, playingId]);

  useEffect(() => {
    return () => {
      audioRef.current?.pause();
      audioRef.current = null;
    };
  }, []);

  const toggle = (item: AudioGridItem, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!item.audioUrl) return;
    // Pause whatever is playing.
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (playingId === item.id) {
      setPlayingId(null);
      return;
    }
    const audio = new Audio(item.audioUrl);
    audioRef.current = audio;
    audio.onended = () => setPlayingId(null);
    audio.onerror = () => setPlayingId(null);
    void audio.play().then(() => setPlayingId(item.id)).catch(() => setPlayingId(null));
  };

  const tint = variant === "music" ? "bg-emerald-400" : "bg-blue-400";
  const CoverIcon = variant === "music" ? Music : AudioLines;

  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-6 md:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => {
        const isRendering =
          item.status === "rendering" ||
          item.status === "generating" ||
          item.status === "processing" ||
          item.status === "queued" ||
          !item.audioUrl;
        const isDeleting = deletingIds.has(item.id);
        const isPlaying = playingId === item.id;
        return (
          <div
            key={item.id}
            onClick={(e) => !isDeleting && !isRendering && toggle(item, e)}
            className={`group relative flex aspect-video cursor-pointer flex-col justify-between overflow-hidden rounded-2xl border border-neutral-900 bg-[#09090a]/60 shadow-sm transition-all duration-300 hover:border-neutral-800 hover:bg-[#0c0c0e] ${
              isDeleting ? "scale-[0.94] opacity-0 blur-[2px] pointer-events-none" : "scale-100 opacity-100"
            }`}
          >
            <div className="relative flex h-full w-full flex-1 items-center justify-center overflow-hidden">
              {isRendering ? (
                <div className="absolute inset-0 flex items-center justify-center overflow-hidden bg-[#070708] p-4">
                  <div className="absolute inset-0 z-10 bg-black/40 backdrop-blur-2xl" />
                  <div className="relative z-20 flex max-w-[85%] flex-col items-center text-center">
                    <Loader2 size={22} className="mb-3 animate-spin text-white/80" />
                    <span className="mb-2 font-mono text-[10px] uppercase tracking-widest text-neutral-400">
                      {variant === "music" ? "Composing track" : "Synthesizing take"}
                    </span>
                    <p className="line-clamp-2 px-2 text-xs font-medium leading-relaxed text-neutral-200">{item.prompt}</p>
                  </div>
                </div>
              ) : (
                <>
                  {/* Cover */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#0b0d12]">
                    <Equalizer playing={isPlaying} tint={tint} />
                    <CoverIcon size={15} className="text-neutral-700" />
                  </div>

                  {/* Center play/pause */}
                  <button
                    onClick={(e) => toggle(item, e)}
                    className="relative z-20 flex h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-black/50 text-white backdrop-blur-sm transition-all duration-300 hover:scale-105 hover:bg-black/70"
                  >
                    {isPlaying ? <Pause size={16} fill="white" /> : <Play size={16} fill="white" className="translate-x-[1px]" />}
                  </button>

                  {/* Prompt on hover */}
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 bg-black/80 p-3 opacity-0 backdrop-blur-sm transition-opacity duration-300 group-hover:opacity-100">
                    <p className="line-clamp-2 text-[11px] font-medium leading-snug text-neutral-100">{item.prompt}</p>
                  </div>
                </>
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
          <CoverIcon size={34} className="mb-4 text-neutral-700" />
          <h3 className="text-sm font-semibold text-neutral-400">{emptyTitle}</h3>
          <p className="mt-1 max-w-xs text-xs leading-normal text-neutral-600">{emptyHint}</p>
        </div>
      )}
    </div>
  );
}
