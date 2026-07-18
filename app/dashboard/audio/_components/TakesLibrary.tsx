"use client";

import React from "react";
import { Loader2, Play, Trash2, VolumeX } from "lucide-react";
import { AudioItem } from "./types";

interface TakesLibraryProps {
  history: AudioItem[];
  activeItem: AudioItem | null;
  onSelect: (item: AudioItem) => void;
  onDelete: (id: string, e: React.MouseEvent) => void;
}

export default function TakesLibrary({ history, activeItem, onSelect, onDelete }: TakesLibraryProps) {
  return (
    <div className="pt-4 border-t border-neutral-900">
      <div className="flex justify-between items-center mb-4">
        <span className="text-[10px] font-mono font-bold text-neutral-500 uppercase tracking-widest">
          Takes Library History
        </span>
        <span className="text-[9px] font-mono text-neutral-600">Showing recent 12 takes</span>
      </div>

      {history.length === 0 ? (
        <div className="rounded-2xl border border-neutral-900 p-8 text-center bg-neutral-950/20">
          <VolumeX size={20} className="text-neutral-700 mx-auto mb-2" />
          <p className="text-xs text-neutral-500 font-sans">No previous voiceover takes found.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {history.slice(0, 12).map((h) => {
            const isRendering = h.status === "queued";
            const isActive = activeItem?.id === h.id;
            return (
              <div
                key={h.id}
                onClick={() => !isRendering && onSelect(h)}
                className={`group relative rounded-xl border px-3.5 py-3 text-left transition-all backdrop-blur ${
                  isRendering
                    ? "border-dashed border-neutral-800 bg-surface/40 cursor-wait"
                    : isActive
                    ? "border-white/30 bg-surface-2"
                    : "border-neutral-900 hover:border-neutral-800 bg-surface-2/60 cursor-pointer"
                }`}
              >
                {isRendering ? (
                  <div className="flex items-center gap-3">
                    <Loader2 size={13} className="animate-spin text-neutral-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <span className="text-[10px] font-mono font-bold text-neutral-400 block uppercase tracking-wider">
                        SYNTHESIZING CUSTOM VOICE...
                      </span>
                      <p className="text-[9px] text-neutral-600 truncate mt-0.5">
                        Modal GPU worker is rendering your take.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-neutral-900 border border-neutral-800 group-hover:bg-white group-hover:text-black transition-colors">
                      <Play size={10} fill="currentColor" className="ml-0.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] font-mono font-bold text-neutral-400 block uppercase tracking-widest">
                          {h.id.startsWith("voice_") ? "AI CLONED TAKE" : "PREBUILT SPEAKER"}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[9px] text-neutral-600 font-mono group-hover:hidden">
                            {new Date(h.createdAt).toLocaleDateString()}
                          </span>
                          <button
                            onClick={(e) => onDelete(h.id, e)}
                            className="hidden group-hover:flex items-center justify-center text-neutral-500 hover:text-red-400 transition-colors p-1 rounded hover:bg-neutral-850/50"
                            title="Delete take"
                          >
                            <Trash2 size={11} />
                          </button>
                        </div>
                      </div>
                      <p className="text-[11px] text-neutral-300 truncate mt-0.5 italic leading-relaxed">
                        &ldquo;{h.prompt}&rdquo;
                      </p>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
