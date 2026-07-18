"use client";

import React from "react";
import { Trash2 } from "lucide-react";
import { GenerationItem } from "./types";

interface HistoryGalleryProps {
  history: GenerationItem[];
  activeItem: GenerationItem | null;
  onSelect: (item: GenerationItem) => void;
  onDelete: (id: string, e?: React.MouseEvent) => void;
}

export default function HistoryGallery({ history, activeItem, onSelect, onDelete }: HistoryGalleryProps) {
  return (
    <div className="mt-12 border-t border-neutral-900 pt-10">
      <h2 className="text-xs font-bold font-mono text-neutral-400 uppercase tracking-widest mb-6">
        IMAGE GENERATION GALLERY ({history.length})
      </h2>

      {history.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-4">
          {history.map((item) => {
            const isActive = activeItem?.id === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onSelect(item)}
                className={`relative aspect-square overflow-hidden rounded-xl border bg-neutral-950 transition-all duration-300 text-left group ${
                  isActive ? "border-blue-500" : "border-neutral-900 hover:border-neutral-700"
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={item.imageUrl} alt={item.prompt} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-2 text-[10px] text-neutral-300 leading-tight">
                  <div className="flex justify-end">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(item.id, e);
                      }}
                      className="p-1.5 rounded-lg bg-black/60 hover:bg-red-950 border border-white/5 text-neutral-400 hover:text-white transition-colors"
                      title="Delete image"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                  <p className="line-clamp-2">{item.prompt}</p>
                </div>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="rounded-xl border border-neutral-900 bg-neutral-950/30 p-10 text-center text-neutral-500 text-xs font-mono uppercase tracking-wider">
          No previous generations found. Start creating!
        </div>
      )}
    </div>
  );
}
