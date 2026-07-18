"use client";

import React from "react";
import { Download, Image as ImageIcon, Loader2, Trash2 } from "lucide-react";
import { GenerationItem } from "./types";

interface ImageWorkspacePanelProps {
  generating: boolean;
  activeItem: GenerationItem | null;
  onDelete: (id: string, e?: React.MouseEvent) => void;
}

export default function ImageWorkspacePanel({ generating, activeItem, onDelete }: ImageWorkspacePanelProps) {
  return (
    <div className="flex flex-col gap-6">
      <div className="relative rounded-2xl border border-neutral-900 bg-surface p-4 min-h-[400px] flex items-center justify-center">
        {generating ? (
          <div className="flex flex-col items-center gap-3 text-neutral-400 py-16 animate-pulse">
            <div className="relative flex items-center justify-center">
              <div className="absolute inset-0 rounded-full border border-white/20 w-12 h-12 animate-ping" />
              <Loader2 size={24} className="animate-spin text-white" />
            </div>
            <p className="text-xs font-mono tracking-wider uppercase mt-2">DREAMING ON VERTEX AI...</p>
            <p className="text-[10px] text-neutral-600">This usually takes around 5-15 seconds</p>
          </div>
        ) : activeItem ? (
          <div className="relative group w-full h-full flex items-center justify-center">
            {/* Large preview image */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={activeItem.imageUrl}
              alt={activeItem.prompt}
              className="max-h-[500px] object-contain rounded-xl shadow-2xl border border-neutral-950 bg-neutral-950"
            />

            {/* Actions Layer on hover */}
            <div className="absolute bottom-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10">
              <a
                href={activeItem.imageUrl}
                download={`optiq-${activeItem.id}.jpg`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center rounded-lg bg-black/80 border border-white/10 hover:bg-neutral-950 p-2.5 text-white transition-colors"
                title="Download image"
              >
                <Download size={15} />
              </a>
              <button
                onClick={(e) => onDelete(activeItem.id, e)}
                className="flex items-center justify-center rounded-lg bg-black/80 border border-white/10 hover:bg-red-950 p-2.5 text-neutral-400 hover:text-white transition-colors"
                title="Delete image"
              >
                <Trash2 size={15} />
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2.5 text-neutral-500 py-16">
            <ImageIcon size={28} className="text-neutral-600" />
            <p className="text-xs font-medium">Your Workspace is Empty</p>
            <p className="text-[10px] text-neutral-600 max-w-xs text-center leading-relaxed">
              Write a creative prompt on the left to start generating gorgeous imagery.
            </p>
          </div>
        )}
      </div>

      {/* Prompt details drawer */}
      {activeItem && !generating && (
        <div className="rounded-xl border border-neutral-900 bg-neutral-950/40 p-4 space-y-2">
          <p className="text-[10px] font-bold font-mono text-neutral-500 uppercase tracking-widest">
            PROMPT DETAILS
          </p>
          <p className="text-xs text-neutral-300 leading-relaxed font-sans font-medium select-all">
            {activeItem.prompt}
          </p>
        </div>
      )}
    </div>
  );
}
